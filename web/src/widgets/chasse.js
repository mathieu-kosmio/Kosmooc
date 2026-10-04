import { shell, esc } from './util.js';

const DEVIS = [
  ['1', 'Poutre CHÊNE avivé D24, purgé d’aubier, 100 x 220 mm, L 5,20 m', '12 pce'],
  ['2', 'Bastaing DOU sec 18 %, 63 x 175 mm, L 4,00 m', '86 ml'],
  ['3', 'Bardage douglas claire-voie, 21 x 125 mm, brut de sciage', '145 m2'],
  ['4', 'Lambourde CHT, 40 x 60 mm, L 2,50 m', '60 ml'],
  ['6', 'Traitement autoclave classe 4, sur repère 2 uniquement', '1 forf.'],
  ['', 'Remise commerciale 3 % (rep. 1 à 5) · Délai : livraison semaine 41', ''],
];
// Fiche produite par une IA, avec cinq erreurs cachées (marquées err).
const FICHE = [
  { rep: '1', ess: { v: 'Chêne' }, sec: { v: '100 x 220' }, lg: { v: '5,20 m' }, qte: { v: '12 pce' }, obs: { v: 'Remise 3 %', err: 'La remise commerciale n’a rien à faire sur une fiche de production.' } },
  { rep: '2', ess: { v: 'Doussié', err: 'DOU = douglas dans cet atelier. Abréviation devinée au lieu d’être signalée.' }, sec: { v: '63 x 175' }, lg: { v: '4,00 m' }, qte: { v: '22 pce', err: '86 ml / 4 m = 21,5 : l’IA a refait le calcul et arrondi. Le devis dit 86 ml.' }, obs: { v: 'Autoclave classe 4' } },
  { rep: '3', ess: { v: 'Douglas' }, sec: { v: '21 x 125' }, lg: { v: 'information absente' }, qte: { v: '145 m2' }, obs: { v: 'Autoclave classe 4', err: 'Le traitement porte sur le repère 2 uniquement. Généralisation inventée.' } },
  { rep: '4', ess: { v: 'Châtaignier' }, sec: { v: '40 x 60' }, lg: { v: '2,50 m' }, qte: { v: '60 ml' }, obs: { v: '' } },
  { rep: 'Délai', ess: { v: 'Semaine 39', err: 'Le devis indique semaine 41. Une date fausse et plausible : la pire erreur.' }, sec: { v: '' }, lg: { v: '' }, qte: { v: '' }, obs: { v: '' } },
];
const COLS = [['ess', 'Essence'], ['sec', 'Section'], ['lg', 'Longueur'], ['qte', 'Quantité'], ['obs', 'Observations']];
const TOTAL = FICHE.reduce((s, r) => s + COLS.filter(([k]) => r[k].err).length, 0);

export default function chasse(el) {
  const body = shell(el, { eyebrow: 'Mini-jeu · chasse aux erreurs', titre: 'Cette fiche est fluide. Est-elle juste ?', consigne: `Une IA a produit cette fiche à partir du devis. ${TOTAL} erreurs s’y cachent. Cliquez les cases suspectes, puis vérifiez.` });
  let marked = new Set(), verifie = false, t0 = Date.now();

  function cell(r, i, k) {
    const c = r[k]; const id = i + ':' + k;
    if (!c.v) return '<td></td>';
    const m = marked.has(id);
    let cls = m ? 'is-marked' : '';
    if (verifie) cls = c.err ? (m ? 'is-found' : 'is-missed') : (m ? 'is-false' : '');
    return `<td><button type="button" class="wg-cell ${cls}" data-cell="${id}" aria-pressed="${m}" ${verifie ? 'disabled' : ''}>${esc(c.v)}</button>${verifie && c.err ? `<small class="wg-cell__why">${esc(c.err)}</small>` : ''}</td>`;
  }

  function render() {
    const found = FICHE.reduce((s, r, i) => s + COLS.filter(([k]) => r[k].err && marked.has(i + ':' + k)).length, 0);
    const faux = [...marked].filter((id) => { const [i, k] = id.split(':'); return !FICHE[i][k].err; }).length;
    body.innerHTML = `
      <div class="wg-chasse">
        <div class="wg-chasse__src"><span class="wg-chasse__label">Devis DEV-2026-0412 (extrait)</span>
          <table class="wg-table wg-table--tight"><tbody>${DEVIS.map(([r, d, q]) => `<tr><td>${esc(r)}</td><td>${esc(d)}</td><td>${esc(q)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="wg-chasse__out"><span class="wg-chasse__label">Fiche produite par l’IA</span>
          <table class="wg-table wg-table--tight wg-fiche"><thead><tr><th>Rep.</th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
          <tbody>${FICHE.map((r, i) => `<tr><th>${esc(r.rep)}</th>${COLS.map(([k]) => cell(r, i, k)).join('')}</tr>`).join('')}</tbody></table>
        </div>
      </div>
      <div class="wg-actions">
        <button type="button" class="btn btn--primary btn--sm" data-act="verif" ${verifie ? 'disabled' : ''}>Vérifier</button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="reset">Rejouer</button>
        <span class="wg-score" role="status">${verifie ? `${found} / ${TOTAL} erreurs trouvées${faux ? `, ${faux} fausse${faux > 1 ? 's' : ''} alerte${faux > 1 ? 's' : ''}` : ''} · ${Math.round((Date.now() - t0) / 1000)} s` : `${marked.size} case(s) marquée(s)`}</span>
      </div>
      ${verifie ? `<p class="wg-note">${found === TOTAL ? 'Bravo. ' : ''}Retenez la leçon : « information absente » sur la longueur du bardage est <strong>juste</strong>, le devis ne la donne pas. Une case vide honnête vaut mieux qu’une case pleine inventée.</p>` : ''}`;
  }

  body.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cell]');
    if (c && !verifie) { const id = c.dataset.cell; marked.has(id) ? marked.delete(id) : marked.add(id); render(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'verif') verifie = true; else { marked = new Set(); verifie = false; t0 = Date.now(); }
    render();
  });
  render();
}
