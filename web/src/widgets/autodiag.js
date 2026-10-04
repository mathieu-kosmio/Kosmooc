import { shell, store, esc, COLORS } from './util.js';

const ITEMS = [
  "J'ai déjà utilisé un outil d'IA générative pour une tâche de travail.",
  'Je donne du contexte et des consignes précises, pas une question en une ligne.',
  "Je relis et je vérifie systématiquement ce que l'IA produit.",
  "Je sais quels documents de mon entreprise je peux ou non lui confier.",
  "J'ai déjà gardé une consigne efficace pour la réutiliser.",
  "Je sais dire pour quelles tâches l'IA ne m'aide pas du tout.",
];
const CHOIX = ['Jamais', 'Parfois', 'Régulièrement'];
const PROFILS = [
  { max: 4, nom: 'Démarrage', couleur: COLORS.sage, texte: 'Vous partez de loin, et c’est une très bonne situation pour ce parcours : chaque module vous apportera un réflexe concret.' },
  { max: 8, nom: 'Usage', couleur: COLORS.green, texte: 'Vous utilisez déjà l’outil. Le parcours va vous donner de la méthode : demander, vérifier, réutiliser.' },
  { max: 12, nom: 'Structuration', couleur: COLORS.gold, texte: 'Vous êtes à l’aise. L’enjeu pour vous : structurer, sécuriser et transmettre vos pratiques à l’équipe.' },
];

export default function autodiag(el) {
  const body = shell(el, { eyebrow: 'Autodiagnostic · 2 minutes', titre: 'Où en êtes-vous avec l’IA ?', consigne: 'Répondez honnêtement : le résultat reste sur votre navigateur et vous le retrouverez au module 9.' });
  const saved = store.get('autodiag', null);
  const rep = saved?.rep ?? Array(ITEMS.length).fill(null);

  function render() {
    const done = rep.every((r) => r !== null);
    const score = rep.reduce((s, r) => s + (r ?? 0), 0);
    const p = PROFILS.find((x) => score <= x.max);
    body.innerHTML = `
      <ol class="wg-diag">
        ${ITEMS.map((txt, i) => `<li><span>${esc(txt)}</span><div class="wg-seg" role="radiogroup" aria-label="${esc(txt)}">
          ${CHOIX.map((c, j) => `<button type="button" role="radio" aria-checked="${rep[i] === j}" class="${rep[i] === j ? 'is-on' : ''}" data-i="${i}" data-j="${j}">${c}</button>`).join('')}
        </div></li>`).join('')}
      </ol>
      <div class="wg-result ${done ? '' : 'is-pending'}" role="status">
        ${done ? `
          <svg viewBox="0 0 240 130" width="240" height="130" aria-hidden="true">
            <path d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke="${COLORS.sageLight}" stroke-width="18" stroke-linecap="round"/>
            <path d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke="${p.couleur}" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.max(2, (score / 12) * 100)} 100"/>
            <text x="120" y="100" text-anchor="middle" font-size="30" font-weight="700" fill="${COLORS.ink}">${score}/12</text>
          </svg>
          <div><p class="wg-result__title" style="color:${p.couleur}">Profil : ${p.nom}</p><p>${p.texte}</p>
          ${saved?.date ? `<p class="t-small wg-muted">Enregistré le ${new Date(saved.date).toLocaleDateString('fr-FR')}.</p>` : ''}</div>`
        : `<p class="t-small">${rep.filter((r) => r !== null).length} / ${ITEMS.length} réponses</p>`}
      </div>`;
  }

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    rep[+b.dataset.i] = +b.dataset.j;
    if (rep.every((r) => r !== null)) store.set('autodiag', { rep, date: new Date().toISOString() });
    render();
  });
  render();
}
