import { shell, esc, COLORS } from './util.js';

const LEVIERS = [
  { id: 'contexte', label: 'Contexte', couleur: COLORS.sage, texte: 'Tu assistes la préparation de production de la Menuiserie des Landes, une scierie. DOU = douglas, CHT = châtaignier.' },
  { id: 'objectif', label: 'Objectif', couleur: COLORS.green, texte: 'Produis la fiche de production qui permettra de lancer le débit.' },
  { id: 'contraintes', label: 'Contraintes', couleur: COLORS.gold, texte: 'N’invente rien : écris « information absente ». Conserve les unités du devis. Aucun prix ni remise.' },
  { id: 'format', label: 'Format', couleur: COLORS.sageDark, texte: 'Tableau : repère, essence, section, longueur, quantité, unité, observations. Termine par « points à vérifier ».' },
];

// Chaque défaut du résultat simulé disparaît quand le bon levier est activé.
const DEFAUTS = [
  { levier: 'contexte', mal: 'Rep. 2 : essence « doussié »', bien: 'Rep. 2 : essence douglas' },
  { levier: 'objectif', mal: 'Recopie des conditions : acompte 30 %, réserve de propriété', bien: 'Uniquement ce qui sert au débit' },
  { levier: 'contraintes', mal: 'Remise 3 % et prix unitaires recopiés', bien: 'Aucun prix, aucune remise' },
  { levier: 'contraintes', mal: 'Rep. 2 : « 22 pièces » (86 ml recalculés)', bien: 'Rep. 2 : 86 ml, unité du devis conservée' },
  { levier: 'contraintes', mal: 'Bardage : longueur « 3,00 m » inventée', bien: 'Bardage : longueur « information absente »' },
  { levier: 'format', mal: 'Un paragraphe à relire en entier', bien: 'Un tableau ordonné + « points à vérifier »' },
];

export default function leviers(el) {
  const body = shell(el, { eyebrow: 'Simulateur · 3 minutes', titre: 'Activez les leviers, regardez la fiche changer', consigne: 'Même devis, même IA. Seule la demande change. Activez les leviers un par un et observez quels défauts disparaissent.' });
  const on = new Set();

  function render() {
    const ok = DEFAUTS.filter((d) => on.has(d.levier)).length;
    const pct = Math.round((ok / DEFAUTS.length) * 100);
    body.innerHTML = `
      <div class="wg-toggles">
        ${LEVIERS.map((l) => `<button type="button" class="wg-toggle ${on.has(l.id) ? 'is-on' : ''}" aria-pressed="${on.has(l.id)}" data-lev="${l.id}" style="--c:${l.couleur}"><span class="wg-toggle__sw" aria-hidden="true"></span>${l.label}</button>`).join('')}
      </div>
      <div class="wg-leviers">
        <div class="wg-leviers__prompt"><span class="wg-chasse__label">Votre demande</span>
          <p class="wg-prompt">${[...LEVIERS].filter((l) => on.has(l.id)).map((l) => `<mark style="--c:${l.couleur}">${esc(l.texte)}</mark>`).join(' ')} ${on.has('objectif') ? '' : 'Fais-moi une fiche de production avec ce devis.'}</p>
        </div>
        <div class="wg-leviers__out"><span class="wg-chasse__label">Résultat (simulé)</span>
          <ul class="wg-checks">${DEFAUTS.map((d) => on.has(d.levier) ? `<li class="is-good">${esc(d.bien)}</li>` : `<li class="is-bad">${esc(d.mal)}</li>`).join('')}</ul>
          <div class="wg-gauge" aria-label="Fiabilité ${pct} %"><span style="width:${pct}%"></span></div>
          <p class="t-small"><strong>${ok} / ${DEFAUTS.length}</strong> défauts corrigés. ${on.has('contraintes') ? '' : 'Astuce : essayez d’abord les contraintes.'}</p>
        </div>
      </div>
      <p class="t-small wg-muted">Résultat simulé pour illustrer le principe. Dans l’exercice, faites l’essai réel avec votre outil : les écarts seront les vôtres.</p>`;
  }
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lev]');
    if (!b) return;
    on.has(b.dataset.lev) ? on.delete(b.dataset.lev) : on.add(b.dataset.lev);
    render();
  });
  render();
}
