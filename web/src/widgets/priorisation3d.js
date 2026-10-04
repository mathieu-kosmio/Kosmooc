import { shell, store, esc, reduced, COLORS } from './util.js';

// Notes indicatives des huit cas proposés au module 0 (valeur, fréquence, faisabilité, contrôlabilité).
const EXEMPLES = [
  { nom: 'Devis vers fiche', v: 3, f: 3, fa: 3, c: 2 },
  { nom: 'Lire un DCE', v: 3, f: 2, fa: 3, c: 2 },
  { nom: 'Tri des mails', v: 2, f: 3, fa: 3, c: 3 },
  { nom: 'Compte rendu', v: 2, f: 3, fa: 3, c: 3 },
  { nom: 'Fiche EUDR', v: 2, f: 1, fa: 3, c: 2 },
  { nom: 'Liste de débit', v: 3, f: 3, fa: 2, c: 2 },
  { nom: 'Synthèse ERP', v: 2, f: 3, fa: 2, c: 2 },
  { nom: 'Mode opératoire', v: 3, f: 1, fa: 2, c: 2 },
];
const CRITERES = [
  { k: 'v', label: 'Valeur', aide: 'gain attendu (hypothèse)' },
  { k: 'f', label: 'Fréquence', aide: 'combien de fois par mois' },
  { k: 'fa', label: 'Faisabilité', aide: 'entrées et sortie identifiables' },
  { k: 'c', label: 'Contrôlabilité', aide: 'vérifiable à coût raisonnable' },
];
const verdict = (s) => {
  const p = s.v * s.f * s.fa * s.c;
  if ([s.v, s.f, s.fa, s.c].includes(1)) return { p, txt: 'Un critère à 1 tire tout vers le bas : envisagez un autre cas.', col: COLORS.red };
  if (p >= 36) return { p, txt: 'Bon candidat pour un prototype.', col: COLORS.green };
  return { p, txt: 'À challenger : quel critère pouvez-vous améliorer ?', col: COLORS.gold };
};

export default async function priorisation3d(el) {
  const body = shell(el, { eyebrow: 'Outil 3D · priorisation', titre: 'Placez votre cas dans le cube', consigne: 'Valeur × fréquence × faisabilité × contrôlabilité, chacun de 1 à 3. Votre cas est la grosse sphère ; sa taille suit la faisabilité. Faites tourner le cube et comparez aux huit cas du module 0.', type: '3d' });
  const st = store.get('priorisation', { v: 2, f: 2, fa: 2, c: 2 });

  body.innerHTML = `
    <div class="wg-prio">
      <div class="wg-3d"><div class="wg-3d__host"></div><div class="wg-3d__panel" aria-live="polite"><p data-info>Cliquez une sphère grise pour voir les notes d’un exemple.</p></div></div>
      <div class="wg-prio__ctrl">
        ${CRITERES.map((c) => `<label class="wg-slider">${c.label} <output data-o="${c.k}">${st[c.k]}</output><span class="t-small wg-muted">${c.aide}</span>
          <input type="range" min="1" max="3" step="1" value="${st[c.k]}" data-k="${c.k}"></label>`).join('')}
        <div class="wg-prio__score" data-score></div>
      </div>
    </div>
    <p class="t-small wg-muted">Notes des exemples indicatives. La valeur reste une hypothèse tant qu’elle n’est pas mesurée chez vous.</p>`;
  const scoreEl = body.querySelector('[data-score]');
  const info = body.querySelector('[data-info]');
  const showScore = () => { const v = verdict(st); scoreEl.innerHTML = `<span class="wg-prio__num" style="color:${v.col}">${v.p}</span><span class="t-small">sur 81</span><p style="color:${v.col}">${v.txt}</p>`; };
  showScore();

  const { webglOk, stage, label } = await import('./three-util.js');
  if (!webglOk()) { body.querySelector('.wg-3d').innerHTML = '<p class="wg-note">3D indisponible : le calcul ci-contre reste valable.</p>'; return; }
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const host = body.querySelector('.wg-3d__host');
  const { THREE, renderer, scene, camera, onTick } = stage(host, { height: 420, camPos: [8, 5, 10] });
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 7; controls.maxDistance = 20;
  controls.autoRotate = !reduced(); controls.autoRotateSpeed = 0.5;

  const P = (v) => (v - 2) * 2; // 1..3 -> -2..2
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 5, 5)), new THREE.LineBasicMaterial({ color: COLORS.line }));
  scene.add(box);
  // zone favorable
  const zone = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.07, depthWrite: false }));
  zone.position.set(1.2, 1.2, 1.2); scene.add(zone);
  const axe = (from, to, txt, col) => {
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize(), new THREE.Vector3(...from), 5.4, new THREE.Color(col), 0.3, 0.18));
    const l = label(txt, { color: col, size: 0.36 }); l.position.set(...to); scene.add(l);
  };
  axe([-2.5, -2.5, -2.5], [3.1, -2.5, -2.5], 'Valeur', COLORS.ink);
  axe([-2.5, -2.5, -2.5], [-2.5, 3.2, -2.5], 'Fréquence', COLORS.ink);
  axe([-2.5, -2.5, -2.5], [-2.5, -2.5, 3.3], 'Contrôlabilité', COLORS.ink);
  [1, 2, 3].forEach((n) => { const l = label(String(n), { color: COLORS.grey, size: 0.26 }); l.position.set(P(n), -2.9, -2.5); scene.add(l); });

  const objs = [];
  EXEMPLES.forEach((x, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13 + 0.07 * x.fa, 24, 16), new THREE.MeshStandardMaterial({ color: COLORS.sage, transparent: true, opacity: 0.85 }));
    const jit = ((i % 4) - 1.5) * 0.32;
    m.position.set(P(x.v) + jit, P(x.f) + ((i % 2) - 0.5) * 0.3, P(x.c) - jit); scene.add(m);
    const l = label(x.nom, { color: COLORS.sageDark, size: 0.26, weight: 600 }); l.position.copy(m.position).add(new THREE.Vector3(0, 0.45, 0)); scene.add(l);
    objs.push({ m, x });
  });
  const mine = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color: COLORS.green, emissive: 0x111111 }));
  const mineLbl = label('Votre cas', { color: '#FFFFFF', size: 0.42, bg: COLORS.ink }); scene.add(mine, mineLbl);
  const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: COLORS.ink, dashSize: 0.12, gapSize: 0.1 }));
  scene.add(drop);
  const target = new THREE.Vector3(); let targetScale = 1;
  const place = () => {
    target.set(P(st.v), P(st.f), P(st.c)); targetScale = 0.2 + 0.1 * st.fa;
    mine.material.color.set(verdict(st).col);
  };
  place();
  mine.position.copy(target);

  onTick(() => {
    mine.position.lerp(target, reduced() ? 1 : 0.12);
    const s = mine.scale.x + (targetScale - mine.scale.x) * 0.12; mine.scale.setScalar(s);
    mineLbl.position.copy(mine.position).add(new THREE.Vector3(0, s + 0.35, 0));
    drop.geometry.setFromPoints([mine.position.clone(), new THREE.Vector3(mine.position.x, -2.5, mine.position.z)]); drop.computeLineDistances();
    controls.update();
  });

  body.addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    st[k] = +e.target.value; body.querySelector(`[data-o="${k}"]`).textContent = st[k];
    store.set('priorisation', st); place(); showScore();
  });

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(objs.map((o) => o.m))[0];
    if (!hit) return;
    controls.autoRotate = false;
    const { x } = objs.find((o) => o.m === hit.object); const v = verdict(x);
    info.innerHTML = `<strong>${esc(x.nom)}</strong> : valeur ${x.v}, fréquence ${x.f}, faisabilité ${x.fa}, contrôlabilité ${x.c}. Produit <strong style="color:${v.col}">${v.p}</strong>.`;
  });
}
