import { shell, store, fmt, esc, copy, COLORS } from './util.js';

const CHAMPS = [
  { k: 'volume', label: 'Volume annuel', unite: 'fois par an' },
  { k: 'temps', label: 'Temps unitaire, exceptions comprises', unite: 'minutes' },
  { k: 'horaire', label: 'Coût horaire chargé', unite: '€ / heure' },
  { k: 'erreurs', label: "Taux d'erreur", unite: '% des cas' },
  { k: 'coutErreur', label: "Coût moyen d'une erreur", unite: '€' },
];

export default function pointdepart(el) {
  const body = shell(el, { eyebrow: 'Calculateur · point de départ', titre: 'Ce que coûte votre tâche aujourd’hui', consigne: 'Pour chaque donnée, dites si elle est mesurée ou estimée. Le temps unitaire peut venir de votre relevé.' });
  const releve = store.get('releve', []);
  const mins = releve.map((r) => +r.minutes).filter((x) => x > 0);
  const st = store.get('pointdepart', { volume: 50, temps: 30, horaire: 40, erreurs: 5, coutErreur: 150, src: {}, gain: 30 });
  if (mins.length && !st.src.temps) { st.temps = Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10; st.src.temps = 'mesure'; }

  function render() {
    const tempsAn = st.volume * st.temps / 60;
    const cTemps = tempsAn * st.horaire;
    const cErr = st.volume * (st.erreurs / 100) * st.coutErreur;
    const total = cTemps + cErr;
    const gain = cTemps * st.gain / 100;
    const nbEst = CHAMPS.filter((c) => st.src[c.k] !== 'mesure').length;
    body.innerHTML = `
      <div class="wg-pd">
        ${CHAMPS.map((c) => `<div class="wg-pd__row">
          <label>${esc(c.label)}<span class="wg-pd__in"><input type="number" min="0" step="any" data-k="${c.k}" value="${st[c.k]}"><span>${esc(c.unite)}</span></span></label>
          <div class="wg-seg wg-seg--sm" role="radiogroup" aria-label="Origine de la donnée">
            <button type="button" role="radio" data-src="${c.k}" data-v="mesure" aria-checked="${st.src[c.k] === 'mesure'}" class="${st.src[c.k] === 'mesure' ? 'is-on is-on--green' : ''}">Mesuré</button>
            <button type="button" role="radio" data-src="${c.k}" data-v="estime" aria-checked="${st.src[c.k] !== 'mesure'}" class="${st.src[c.k] !== 'mesure' ? 'is-on is-on--gold' : ''}">Estimé</button>
          </div></div>`).join('')}
        ${mins.length ? `<p class="t-small wg-muted">Votre relevé : ${mins.length} occurrence(s), moyenne ${fmt(mins.reduce((a, b) => a + b, 0) / mins.length, 1)} min.</p>` : ''}
      </div>
      <div class="wg-stats">
        <div><strong>${fmt(tempsAn, 0)} h</strong><span>par an sur la tâche</span></div>
        <div><strong>${fmt(cTemps, 0)} €</strong><span>coût du temps</span></div>
        <div><strong>${fmt(cErr, 0)} €</strong><span>coût des erreurs</span></div>
        <div><strong>${fmt(total, 0)} €</strong><span>coût annuel total</span></div>
      </div>
      <div class="wg-hyp">
        <label>Hypothèse de temps gagné : <strong>${st.gain} %</strong><input type="range" min="0" max="80" step="5" data-gain value="${st.gain}"></label>
        <p><span class="wg-badge wg-badge--gold">Hypothèse, à vérifier</span> soit environ <strong>${fmt(gain, 0)} € par an</strong>, si le gain se confirme sur votre plan de mesure, contrôle humain compris.</p>
      </div>
      <p class="wg-note">${nbEst === 0 ? 'Toutes vos données sont mesurées : rare, et précieux.' : `${nbEst} donnée(s) estimée(s) : écrivez « estimé » à côté dans votre projet final. Ce n’est pas un défaut, c’est de l’honnêteté.`}</p>
      <div class="wg-actions"><button type="button" class="btn btn--secondary btn--sm" data-act="copy">Copier pour le projet final</button></div>`;
  }
  const save = () => store.set('pointdepart', st);
  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.k) { st[t.dataset.k] = +t.value || 0; save(); render(); }
    if (t.dataset.gain !== undefined) { st.gain = +t.value; save(); render(); }
  });
  body.addEventListener('input', (e) => { if (e.target.dataset.gain !== undefined) { st.gain = +e.target.value; save(); render(); body.querySelector('[data-gain]')?.focus(); } });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-src]');
    if (b) { st.src[b.dataset.src] = b.dataset.v; save(); render(); return; }
    const a = e.target.closest('[data-act="copy"]');
    if (a) copy(CHAMPS.map((c) => `${c.label} : ${st[c.k]} ${c.unite} (${st.src[c.k] === 'mesure' ? 'mesuré' : 'estimé'})`).join('\n') + `\nHypothèse de temps gagné : ${st.gain} % (à vérifier)`, a);
  });
  render();
}
