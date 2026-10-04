import { shell, store, esc, copy } from './util.js';
import { docx, downloadBlob } from './docx.js';

const CHAMPS = [
  { id: 'E', label: 'Entrée', q: 'Quelles données ou quels documents sont disponibles ?', ex: 'Le devis accepté, parfois un plan ou un mail' },
  { id: 'T', label: 'Transformation', q: 'Que faut-il comprendre, extraire, comparer ou générer ?', ex: 'Identifier les lignes à produire et leurs caractéristiques' },
  { id: 'S', label: 'Sortie', q: 'Quel résultat concret est produit ?', ex: 'Une fiche de production standardisée' },
  { id: 'C', label: 'Contrôle', q: "Qu'est-ce qu'un humain doit impérativement vérifier ?", ex: 'Dimensions, essences, quantités, délais, informations manquantes' },
  { id: 'U', label: 'Utilisateur', q: 'Qui se sert de la sortie ?', ex: 'Le chef de production' },
  { id: 'X', label: 'Test prévu', q: 'Comment comparerez-vous le résultat à la bonne réponse ?', ex: 'Sur trois devis, dont un jamais vu' },
];

export default function etsc(el) {
  const body = shell(el, { eyebrow: 'Outil · fiche E-T-S-C', titre: 'Remplissez la fiche de votre cas', consigne: 'Une à trois phrases par case. Tout est enregistré dans ce navigateur ; copiez ou téléchargez la fiche pour votre projet final.' });
  const v = store.get('etsc', {});

  const texte = () => ['Fiche E-T-S-C', ...CHAMPS.map((c) => `${c.label} : ${v[c.id] || ''}`)].join('\n');

  body.innerHTML = `
    <div class="wg-etsc">
      ${CHAMPS.map((c) => `<label class="wg-etsc__case wg-etsc__case--${c.id}">
        <span class="wg-etsc__letter">${c.id === 'U' || c.id === 'X' ? '+' : c.id}</span>
        <span class="wg-etsc__label">${esc(c.label)}</span>
        <span class="t-small wg-muted">${esc(c.q)}</span>
        <textarea data-k="${c.id}" rows="3" placeholder="ex. ${esc(c.ex)}">${esc(v[c.id] || '')}</textarea>
      </label>`).join('')}
    </div>
    <div class="wg-actions">
      <button type="button" class="btn btn--primary btn--sm" data-act="copy">Copier la fiche</button>
      <button type="button" class="btn btn--secondary btn--sm" data-act="dl">Télécharger (Word)</button>
      <span class="wg-score" data-progress></span>
    </div>`;
  const prog = () => {
    const n = ['E', 'T', 'S', 'C'].filter((k) => (v[k] || '').trim().length > 10).length;
    body.querySelector('[data-progress]').textContent = n === 4 ? 'Les quatre cases sont remplies.' : `${n} / 4 cases principales remplies${(v.C || '').trim().length < 10 ? ' · n’oubliez pas le Contrôle' : ''}`;
  };
  body.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k) { v[k] = e.target.value; store.set('etsc', v); prog(); } });
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'copy') copy(texte(), a);
    if (a?.dataset.act === 'dl') downloadBlob('fiche-etsc.docx', docx([{ titre: 'Fiche E-T-S-C de mon cas' }, ...CHAMPS.map((c) => ({ sous: c.label, aide: c.q, texte: v[c.id] || '' })), { note: 'Académie PerfIA · à joindre à votre projet final (partie 2).' }]));
  });
  prog();
}
