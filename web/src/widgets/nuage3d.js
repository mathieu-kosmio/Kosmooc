import { shell, esc, reduced, COLORS } from './util.js';

const GROUPES = [
  { nom: 'Résineux', couleur: COLORS.green, centre: [-3.2, 1.3, 0.2], mots: ['douglas', 'pin maritime', 'sapin', 'épicéa', 'mélèze'] },
  { nom: 'Feuillus', couleur: COLORS.goldDark, centre: [-1.2, -1.9, 1.8], mots: ['chêne', 'châtaignier', 'hêtre', 'peuplier'] },
  { nom: 'Bois exotiques', couleur: COLORS.red, centre: [3.0, 1.2, -0.8], mots: ['doussié', 'iroko', 'teck', 'ipé'] },
  { nom: 'Documents', couleur: COLORS.sageDark, centre: [1.2, -1.6, -2.8], mots: ['devis', 'facture', 'bon de commande', 'fiche de production', 'CCTP'] },
  { nom: 'Unités', couleur: COLORS.ink7, centre: [3.0, -2.2, 2.4], mots: ['m³', 'ml', 'm²', 'pièce'] },
];

export default async function nuage3d(el) {
  const body = shell(el, { eyebrow: 'Exploration 3D', titre: 'Les régularités apprises par un modèle', consigne: 'Pendant l’entraînement, le modèle range les mots selon les contextes où ils apparaissent. Faites tourner le nuage, cliquez un mot, puis donnez du contexte à « DOU ».', type: '3d' });
  const { webglOk, stage, label } = await import('./three-util.js');
  if (!webglOk()) { body.innerHTML = '<p class="wg-note">Votre navigateur n’affiche pas la 3D. L’idée : « DOU » se trouve à mi-chemin entre « douglas » et « doussié ». Sans contexte, le modèle choisit le plus plausible ; avec votre contexte, il penche vers douglas.</p>'; return; }
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  body.innerHTML = `
    <div class="wg-3d"><div class="wg-3d__host"></div>
      <div class="wg-3d__panel" aria-live="polite"><p data-info>Cliquez un mot pour voir ses voisins.</p></div>
    </div>
    <div class="wg-seg wg-seg--wide" role="radiogroup" aria-label="Contexte donné au modèle">
      <button type="button" role="radio" aria-checked="true" class="is-on" data-ctx="0">« DOU » sans contexte</button>
      <button type="button" role="radio" aria-checked="false" data-ctx="1">+ contexte : scierie landaise</button>
    </div>
    <p class="t-small wg-muted">Représentation simplifiée : un vrai modèle range les mots dans des milliers de dimensions, pas trois.</p>`;
  const host = body.querySelector('.wg-3d__host');
  const info = body.querySelector('[data-info]');
  const { THREE, renderer, scene, camera, onTick } = stage(host, { height: 440, camPos: [0, 1.2, 13.5] });
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 18;
  controls.autoRotate = !reduced(); controls.autoRotateSpeed = 0.6;

  const mots = [];
  GROUPES.forEach((g, gi) => {
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), new THREE.MeshBasicMaterial({ color: g.couleur, transparent: true, opacity: 0.07, depthWrite: false }));
    halo.position.set(...g.centre); scene.add(halo);
    const titre = label(g.nom.toUpperCase(), { color: g.couleur, size: 0.26 }); titre.position.set(g.centre[0], g.centre[1] + 1.95, g.centre[2]); titre.material.opacity = 0.75; scene.add(titre);
    g.mots.forEach((m, i) => {
      const n = g.mots.length, yy = 1 - (2 * (i + 0.5)) / n, rr = Math.sqrt(1 - yy * yy), th = i * 2.399963 + gi;
      const p = new THREE.Vector3(g.centre[0] + Math.cos(th) * rr * 1.25, g.centre[1] + yy * 1.15, g.centre[2] + Math.sin(th) * rr * 1.25);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: g.couleur }));
      dot.position.copy(p); scene.add(dot);
      const s = label(m, { color: g.couleur, size: 0.34 }); s.position.copy(p).add(new THREE.Vector3(0, 0.28, 0)); scene.add(s);
      mots.push({ mot: m, groupe: g.nom, pos: p, sprite: s, dot });
    });
  });
  const douglas = mots.find((m) => m.mot === 'douglas').pos, doussie = mots.find((m) => m.mot === 'doussié').pos;
  const posSans = douglas.clone().lerp(doussie, 0.52).add(new THREE.Vector3(0, 0.6, 0.4));
  const posAvec = douglas.clone().add(new THREE.Vector3(0.7, 0.6, 0.5));
  const dou = { mot: 'DOU', groupe: '?', pos: posSans.clone(), sprite: label('DOU', { color: '#FFFFFF', size: 0.5, bg: COLORS.gold }), dot: new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: COLORS.gold })) };
  scene.add(dou.sprite, dou.dot); mots.push(dou);
  let cible = posSans;

  const lineMat = new THREE.LineBasicMaterial({ color: COLORS.gold });
  let lines = null, selected = null;
  function voisins(m) {
    if (m === dou) return cible === posSans ? [{ x: mots.find((x) => x.mot === 'douglas') }, { x: mots.find((x) => x.mot === 'doussié') }] : [{ x: mots.find((x) => x.mot === 'douglas') }, { x: mots.find((x) => x.mot === 'sapin') }];
    return mots.filter((x) => x !== m && x !== dou).map((x) => ({ x, d: x.pos.distanceTo(m.pos) })).sort((a, b) => a.d - b.d).slice(0, 3);
  }
  function select(m) {
    selected = m;
    if (lines) { scene.remove(lines); lines.geometry.dispose(); }
    const v = voisins(m);
    const pts = []; v.forEach(({ x }) => { pts.push(m.pos.clone(), x.pos.clone()); });
    lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat); scene.add(lines);
    if (m === dou) info.innerHTML = cible === posSans
      ? '<strong>« DOU »</strong> : à mi-chemin entre <em>douglas</em> et <em>doussié</em>. Sans contexte, le modèle tire le plus plausible, et se trompe une fois sur deux.'
      : '<strong>« DOU »</strong> : avec votre contexte, il rejoint <em>douglas</em>. Mieux encore : donnez-lui votre lexique et demandez-lui de signaler toute abréviation inconnue.';
    else info.innerHTML = `Voisins de <strong>${esc(m.mot)}</strong> : ${v.map(({ x }) => esc(x.mot)).join(', ')}.`;
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(mots.flatMap((m) => [m.sprite, m.dot]))[0];
    if (hit) { const m = mots.find((x) => x.sprite === hit.object || x.dot === hit.object); controls.autoRotate = false; select(m); }
  });

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctx]');
    if (!b) return;
    body.querySelectorAll('[data-ctx]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on); });
    cible = b.dataset.ctx === '1' ? posAvec : posSans;
    select(dou);
  });

  onTick(() => {
    dou.pos.lerp(cible, reduced() ? 1 : 0.06);
    dou.dot.position.copy(dou.pos); dou.sprite.position.copy(dou.pos).add(new THREE.Vector3(0, 0.36, 0));
    if (selected === dou && lines) { const v = voisins(dou); const pts = []; v.forEach(({ x }) => pts.push(dou.pos.clone(), x.pos.clone())); lines.geometry.setFromPoints(pts); }
    controls.update();
  });
  select(dou);
}
