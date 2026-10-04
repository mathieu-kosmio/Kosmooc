import { shell, fmt, COLORS } from './util.js';

const CHAMPS = [
  { k: 'prix', label: 'Prix par requête (€)', step: 0.01, min: 0 },
  { k: 'reprises', label: 'Reprises moyennes par tâche', step: 0.5, min: 0 },
  { k: 'minutes', label: 'Minutes humaines par reprise', step: 1, min: 0 },
];

export default function cout(el) {
  const body = shell(el, { eyebrow: 'Calculateur', titre: 'Le coût par tâche réussie', consigne: 'Comparez deux solutions. Chiffres de départ fictifs : remplacez-les par les vôtres.' });
  const s = { A: { prix: 0.10, reprises: 2, minutes: 3 }, B: { prix: 0.22, reprises: 0, minutes: 3 }, horaire: 45 };

  const calc = (x) => {
    const machine = x.prix * (1 + x.reprises);
    const humain = x.reprises * (x.minutes / 60) * s.horaire;
    return { machine, humain, total: machine + humain };
  };

  function render() {
    const a = calc(s.A), b = calc(s.B);
    const max = Math.max(a.total, b.total, 0.01);
    const bar = (lab, c, color) => `<div class="wg-cost__row"><span class="wg-cost__lab">${lab}</span>
      <span class="wg-cost__track"><span style="width:${(c.machine / max) * 100}%;background:${color}" title="Machine"></span><span style="width:${(c.humain / max) * 100}%;background:${COLORS.gold}" title="Temps humain"></span></span>
      <strong>${fmt(c.total, 2)} €</strong></div>`;
    const best = a.total === b.total ? null : a.total < b.total ? 'A' : 'B';
    const cheaperReq = s.A.prix === s.B.prix ? null : s.A.prix < s.B.prix ? 'A' : 'B';
    body.innerHTML = `
      <div class="wg-cost">
        ${['A', 'B'].map((k) => `<fieldset class="wg-cost__sol"><legend>Solution ${k}</legend>
          ${CHAMPS.map((c) => `<label>${c.label}<input type="number" data-s="${k}" data-k="${c.k}" value="${s[k][c.k]}" step="${c.step}" min="${c.min}"></label>`).join('')}
        </fieldset>`).join('')}
        <label class="wg-cost__h">Coût horaire chargé (€)<input type="number" data-h value="${s.horaire}" step="1" min="0"></label>
      </div>
      <div class="wg-cost__bars">${bar('A', a, COLORS.sage)}${bar('B', b, COLORS.sage)}
        <p class="t-small wg-muted"><span class="wg-dot" style="background:${COLORS.sage}"></span>requêtes · <span class="wg-dot" style="background:${COLORS.gold}"></span>temps humain des reprises</p></div>
      <p class="wg-note">Coût machine seul : A ${fmt(a.machine, 2)} €, B ${fmt(b.machine, 2)} €.
        ${best ? `Avec le temps humain, <strong>la solution ${best} est la moins chère par tâche réussie</strong>${cheaperReq && cheaperReq !== best ? ', alors que sa requête coûte plus cher' : ''}.` : 'Les deux se valent.'}
        Une reprise coûte surtout du temps : c’est lui qu’il faut compter.</p>`;
  }
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.h !== undefined) s.horaire = +t.value || 0;
    else if (t.dataset.s) s[t.dataset.s][t.dataset.k] = +t.value || 0;
    else return;
    const pos = t.selectionStart, key = t.dataset.s + t.dataset.k + (t.dataset.h ?? '');
    render();
    const n = [...body.querySelectorAll('input')].find((i) => (i.dataset.s + i.dataset.k + (i.dataset.h ?? '')) === key);
    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { /* champ numérique */ } }
  });
  render();
}
