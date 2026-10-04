import { shell, store, esc, copy, COLORS } from './util.js';

const Q = [
  { court: 'Prompt à moi', q: 'Mon prompt métier est écrit dans un fichier que je possède.', action: 'Copiez le prompt dans un fichier texte daté, hors de l’outil.' },
  { court: 'Export', q: 'Je peux exporter mes conversations et mes documents.', action: 'Testez l’export de votre compte dès aujourd’hui.' },
  { court: 'Formats ouverts', q: 'Mes règles et gabarits sont dans des formats ouverts, hors de l’outil.', action: 'Rangez règles et gabarits en texte ou tableur, dans un dossier partagé.' },
  { court: 'Refaire ailleurs', q: 'Je referais mon prototype dans un autre outil en une demi-journée.', action: 'Essayez : recollez votre prompt dans un second outil et rejouez un cas de test.' },
  { court: 'Pas que moi', q: 'Une autre personne que moi sait l’utiliser.', action: 'Montrez le prototype à un collègue et faites-le tourner devant vous.' },
  { court: 'Plan B prix', q: 'Je sais quoi faire si le prix double ou si le service s’interrompt.', action: 'Notez l’outil de repli et le coût de bascule estimé.' },
  { court: 'Données', q: 'Je sais où sont traitées mes données et ce que prévoient les conditions.', action: 'Relisez les conditions de votre offre et notez la date de lecture.' },
  { court: 'Modèle retiré', q: 'Si mon modèle était remplacé, mes cas de test me le diraient.', action: 'Gardez deux ou trois documents de test et leur sortie attendue.' },
];
const R = ['Non', 'En partie', 'Oui'];

export default function radar(el) {
  const body = shell(el, { eyebrow: 'Autodiagnostic de dépendance', titre: 'Votre radar de portabilité', consigne: 'Plus la forme est grande, plus vous pouvez changer d’outil sans tout perdre. Chaque « non » propose une action.' });
  const rep = store.get('radar', Array(Q.length).fill(null));

  function svg() {
    const cx = 170, cy = 160, r = 120, n = Q.length;
    const pt = (i, k) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)]; };
    const rings = [0.5, 1].map((k) => `<polygon points="${Q.map((_, i) => pt(i, k).join(',')).join(' ')}" fill="none" stroke="${COLORS.line}"/>`).join('');
    const axes = Q.map((q, i) => { const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.2); const an = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end'; return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${COLORS.line}"/><text x="${lx}" y="${ly + 4}" font-size="11" text-anchor="${an}" fill="${COLORS.ink7}">${esc(q.court)}</text>`; }).join('');
    const poly = Q.map((_, i) => pt(i, Math.max(0.06, (rep[i] ?? 0) / 2)).join(',')).join(' ');
    const dots = Q.map((_, i) => rep[i] === null ? '' : `<circle cx="${pt(i, Math.max(0.06, rep[i] / 2))[0]}" cy="${pt(i, Math.max(0.06, rep[i] / 2))[1]}" r="4" fill="${[COLORS.red, COLORS.gold, COLORS.green][rep[i]]}"/>`).join('');
    return `<svg viewBox="-70 -6 480 336" width="480" height="336" role="img" aria-label="Radar de portabilité">${rings}${axes}<polygon points="${poly}" fill="${COLORS.green}" fill-opacity="0.22" stroke="${COLORS.green}" stroke-width="2"/>${dots}</svg>`;
  }

  function render() {
    const score = rep.reduce((s, x) => s + (x ?? 0), 0);
    const actions = Q.map((q, i) => (rep[i] !== null && rep[i] < 2 ? q.action : null)).filter(Boolean);
    body.innerHTML = `
      <div class="wg-radar">
        <ol class="wg-diag wg-diag--compact">${Q.map((q, i) => `<li><span>${esc(q.q)}</span><div class="wg-seg" role="radiogroup" aria-label="${esc(q.q)}">${R.map((l, j) => `<button type="button" role="radio" aria-checked="${rep[i] === j}" class="${rep[i] === j ? 'is-on ' + ['is-on--red', 'is-on--gold', ''][j] : ''}" data-i="${i}" data-j="${j}">${l}</button>`).join('')}</div></li>`).join('')}</ol>
        <div class="wg-radar__viz">${svg()}<p class="wg-result__title">Portabilité : ${score} / 16</p></div>
      </div>
      ${actions.length ? `<div class="wg-note"><strong>Vos actions pour réduire la dépendance</strong><ul>${actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
        <div class="wg-actions"><button type="button" class="btn btn--secondary btn--sm" data-act="copy">Copier le diagnostic</button></div>` : ''}`;
  }
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { rep[+b.dataset.i] = +b.dataset.j; store.set('radar', rep); render(); return; }
    const a = e.target.closest('[data-act="copy"]');
    if (a) copy(Q.map((q, i) => `${q.q} ${rep[i] === null ? '?' : R[rep[i]]}${rep[i] !== null && rep[i] < 2 ? ' · Action : ' + q.action : ''}`).join('\n'), a);
  });
  render();
}
