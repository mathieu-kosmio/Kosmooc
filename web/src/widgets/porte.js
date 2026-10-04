import { shell, esc, copy, store } from './util.js';

const ETAPES = [
  { id: 'q1', titre: 'Faut-il automatiser ce processus ?', aide: 'Peut-on le supprimer, le simplifier, le faire moins souvent ?',
    choix: [{ v: 'oui', l: 'Oui, la tâche doit rester' }, { v: 'non', l: 'Non, on peut la supprimer ou la simplifier', fin: 'Supprimer ou simplifier', detail: 'Automatiser un processus inutile ne fait que l’accélérer. Notez le motif : c’est un résultat.' }] },
  { id: 'q2', titre: "Faut-il de l'IA pour l'automatiser ?", aide: 'La décision est-elle toujours la même pour les mêmes données ?',
    choix: [{ v: 'regle', l: 'Oui, toujours la même décision', fin: 'Règle, tableur ou fonction de votre logiciel', detail: 'Pas besoin d’IA : une formule fait mieux et plus sûrement. Vérifiez ce que vos logiciels font déjà.' }, { v: 'ia', l: 'Non, il faut comprendre un texte libre ou varié' }] },
  { id: 'q3', titre: 'Quelle IA ?', aide: 'La plus modeste qui fait le travail.',
    choix: [{ v: 'brique', l: 'Une brique déjà présente dans un outil' }, { v: 'generaliste', l: 'Un modèle généraliste en abonnement pro' }, { v: 'specialise', l: 'Un petit modèle spécialisé', note: 'Rare en PME : réservé aux usages très répétitifs et volumineux.' }] },
  { id: 'q4', titre: "Quel niveau d'autonomie ?", aide: 'Pour un premier cas : suggestion ou copilote.',
    choix: [{ v: 'suggestion', l: 'Suggestion : l’outil propose, je décide' }, { v: 'copilote', l: 'Copilote : l’outil prépare, je relis et valide' }, { v: 'auto', l: 'Automatisation encadrée', note: 'Jamais pour un premier cas : on la mérite après des mesures concluantes (module 9).' }] },
];

export default function porte(el) {
  const body = shell(el, { eyebrow: 'Outil · votre cas', titre: 'Passez votre cas fil rouge par la porte', consigne: 'Répondez dans l’ordre. Le résultat se copie dans votre carnet.' });
  let st = store.get('porte', { tache: '', rep: {} });

  function chemin() {
    const out = [];
    for (const e of ETAPES) {
      const r = st.rep[e.id];
      if (!r) return { out, current: e };
      const c = e.choix.find((x) => x.v === r);
      out.push({ e, c });
      if (c.fin) return { out, fin: c };
    }
    return { out, fin: null, complet: true };
  }

  function resume(p) {
    const lignes = [`Cas : ${st.tache || '(à nommer)'}`, ...p.out.map(({ e, c }) => `${e.titre} ${c.l}${c.note ? ' (' + c.note + ')' : ''}`)];
    if (p.fin) lignes.push(`Conclusion : ${p.fin.fin}. ${p.fin.detail}`);
    else if (p.complet) lignes.push('Conclusion : IA utile, avec le niveau d’autonomie choisi et une alternative sans IA notée.');
    return lignes.join('\n');
  }

  function render() {
    const p = chemin();
    body.innerHTML = `
      <label class="wg-field">Votre cas<input type="text" data-tache value="${esc(st.tache)}" placeholder="ex. devis vers fiche de production" maxlength="120"></label>
      <ol class="wg-steps">
        ${ETAPES.map((e, i) => {
          const done = p.out.find((x) => x.e.id === e.id);
          const isCur = p.current?.id === e.id;
          const state = done ? 'is-done' : isCur ? 'is-current' : 'is-todo';
          return `<li class="wg-step ${state}">
            <span class="wg-step__num">${i + 1}</span>
            <div><strong>${esc(e.titre)}</strong><br><span class="t-small wg-muted">${esc(e.aide)}</span>
            ${isCur ? `<div class="wg-choices">${e.choix.map((c) => `<button type="button" class="btn btn--secondary btn--sm" data-q="${e.id}" data-v="${c.v}">${esc(c.l)}</button>`).join('')}</div>` : ''}
            ${done ? `<p class="wg-step__answer">${esc(done.c.l)}${done.c.note ? `<br><span class="wg-warn">${esc(done.c.note)}</span>` : ''}</p>` : ''}</div>
          </li>`;
        }).join('')}
      </ol>
      ${p.fin || p.complet ? `<div class="wg-result"><div><p class="wg-result__title">${p.fin ? esc(p.fin.fin) : 'L’IA est justifiée pour ce cas'}</p><p>${p.fin ? esc(p.fin.detail) : 'Notez l’alternative sans IA envisagée et pourquoi vous l’écartez. Passez ensuite au module 4.'}</p></div></div>
        <div class="wg-actions"><button type="button" class="btn btn--primary btn--sm" data-act="copy">Copier pour mon carnet</button><button type="button" class="btn btn--ghost btn--sm" data-act="reset">Recommencer</button></div>` : ''}`;
  }

  body.addEventListener('input', (e) => { if (e.target.matches('[data-tache]')) { st.tache = e.target.value; store.set('porte', st); } });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (b) { st.rep[b.dataset.q] = b.dataset.v; store.set('porte', st); render(); return; }
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'copy') copy(resume(chemin()), a);
    if (a?.dataset.act === 'reset') { st = { tache: st.tache, rep: {} }; store.set('porte', st); render(); }
  });
  render();
}
