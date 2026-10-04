import { shell, esc, COLORS, reduced } from './util.js';

// Valeurs illustratives : elles montrent le principe, pas le fonctionnement exact d'un modèle donné.
const NIVEAUX = [
  { id: 'brut', label: 'Sans contexte', prompt: 'Essence pour « Bastaing DOU sec 18 % » :', probs: { 'doussié': 41, 'douglas': 33, 'douelle': 9, '« DOU » non défini, à vérifier': 4, 'chêne': 13 } },
  { id: 'ctx', label: '+ contexte : scierie des Landes', prompt: 'Je prépare la production d’une scierie landaise. Essence pour « Bastaing DOU sec 18 % » :', probs: { 'douglas': 72, 'doussié': 12, 'douelle': 3, '« DOU » non défini, à vérifier': 6, 'chêne': 7 } },
  { id: 'regle', label: '+ lexique et règle « signale l’inconnu »', prompt: 'Lexique maison : DOU = douglas, CHT = châtaignier. Si une abréviation n’est pas définie, signale-la. Essence pour « Bastaing DOU sec 18 % » :', probs: { 'douglas': 95, 'doussié': 1, 'douelle': 0, '« DOU » non défini, à vérifier': 4, 'chêne': 0 } },
];
const BON = new Set(['douglas', '« DOU » non défini, à vérifier']);

export default function prediction(el) {
  const body = shell(el, { eyebrow: 'Expérience · 2 minutes', titre: 'La machine à prédire la suite', consigne: 'Le modèle ne cherche pas la réponse : il tire la suite la plus plausible. Choisissez ce que vous lui donnez, puis lancez dix tirages.' });
  let niv = 0, tirages = [];

  function tirer() {
    const p = NIVEAUX[niv].probs;
    let r = Math.random() * 100, acc = 0;
    for (const [mot, v] of Object.entries(p)) { acc += v; if (r < acc) return mot; }
    return Object.keys(p)[0];
  }

  function render(anim = false) {
    const N = NIVEAUX[niv];
    const ok = tirages.filter((t) => BON.has(t)).length;
    body.innerHTML = `
      <div class="wg-seg wg-seg--wide" role="radiogroup" aria-label="Ce que l'on donne au modèle">
        ${NIVEAUX.map((n, i) => `<button type="button" role="radio" aria-checked="${i === niv}" class="${i === niv ? 'is-on' : ''}" data-niv="${i}">${esc(n.label)}</button>`).join('')}
      </div>
      <p class="wg-prompt"><span class="wg-muted">Demande :</span> ${esc(N.prompt)} <span class="wg-caret">▍</span></p>
      <div class="wg-bars">
        ${Object.entries(N.probs).sort((a, b) => b[1] - a[1]).map(([mot, v]) => `
          <div class="wg-bar"><span class="wg-bar__label">${esc(mot)}</span>
            <span class="wg-bar__track"><span class="wg-bar__fill" style="width:${v}%;background:${BON.has(mot) ? COLORS.green : COLORS.gold}"></span></span>
            <span class="wg-bar__val">${v} %</span></div>`).join('')}
      </div>
      <div class="wg-actions">
        <button type="button" class="btn btn--primary btn--sm" data-act="tirer">Lancer 10 tirages</button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="vider">Effacer</button>
      </div>
      ${tirages.length ? `<div class="wg-tokens" aria-live="polite">${tirages.map((t, i) => `<span class="wg-token ${BON.has(t) ? 'is-good' : 'is-bad'}" style="--d:${anim ? i * 70 : 0}ms">${esc(t)}</span>`).join('')}</div>
        <p class="wg-note"><strong>${ok} sur ${tirages.length}</strong> réponses justes ou honnêtes. ${niv === 0 ? 'Sans contexte, « DOU » devient souvent « doussié » : c’est plausible, et faux chez vous.' : niv === 1 ? 'Le contexte resserre les choix, mais laisse encore du hasard.' : 'Votre vocabulaire et votre règle font presque tout le travail : c’est le harnais.'}</p>` : ''}
      <p class="t-small wg-muted">Probabilités illustratives, pour montrer le principe.</p>`;
  }

  body.addEventListener('click', (e) => {
    const n = e.target.closest('[data-niv]');
    if (n) { niv = +n.dataset.niv; tirages = []; render(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'tirer') { tirages = Array.from({ length: 10 }, tirer); render(!reduced()); }
    else { tirages = []; render(); }
  });
  render();
}
