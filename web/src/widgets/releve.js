import { shell, store, esc, download, fmt, COLORS } from './util.js';

// Relevé partagé entre le module 0 (on l'ouvre) et le module 9 (on l'exploite).
export default function releve(el, { mode = 'm0' }) {
  const body = shell(el, {
    eyebrow: mode === 'm9' ? 'Votre relevé · point de départ' : 'Outil · relevé de la tâche',
    titre: mode === 'm9' ? 'Ce que dit votre relevé' : 'Chronométrez votre cas fil rouge',
    consigne: mode === 'm9'
      ? 'Les lignes saisies depuis le module 0 donnent votre temps unitaire mesuré. Ajoutez celles qui manquent, puis exportez.'
      : 'À chaque fois que la tâche se présente, ajoutez une ligne. Les données restent dans ce navigateur : exportez-les de temps en temps.',
  });
  let rows = store.get('releve', []);
  const today = new Date().toISOString().slice(0, 10);

  function stats() {
    const m = rows.map((r) => +r.minutes).filter((x) => x > 0);
    if (!m.length) return null;
    const moy = m.reduce((a, b) => a + b, 0) / m.length;
    return { n: m.length, moy, min: Math.min(...m), max: Math.max(...m), err: rows.reduce((s, r) => s + (+r.erreurs || 0), 0) };
  }

  function chart() {
    const m = rows.map((r) => +r.minutes || 0);
    if (!m.length) return '';
    const max = Math.max(...m, 1), w = 22, gap = 8, h = 90;
    const W = Math.max(240, m.length * (w + gap) + 20);
    const s = stats();
    const ym = h - (s.moy / max) * (h - 10);
    return `<svg class="wg-releve__chart" viewBox="0 0 ${W} ${h + 18}" width="${W}" height="${h + 18}" role="img" aria-label="Temps par occurrence">
      ${m.map((v, i) => { const bh = (v / max) * (h - 10); const er = +rows[i].erreurs > 0; return `<rect x="${10 + i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="3" fill="${er ? COLORS.gold : COLORS.green}"><title>${esc(rows[i].date)} : ${v} min${er ? ', ' + rows[i].erreurs + ' erreur(s)' : ''}</title></rect>`; }).join('')}
      <line x1="4" x2="${W - 4}" y1="${ym}" y2="${ym}" stroke="${COLORS.ink}" stroke-dasharray="4 4"/>
      <text x="${W - 6}" y="${ym - 4}" text-anchor="end" font-size="11" fill="${COLORS.ink}">moyenne ${fmt(s.moy, 1)} min</text>
      <text x="10" y="${h + 14}" font-size="10" fill="${COLORS.grey}">vert : sans erreur · doré : avec erreur ou reprise</text>
    </svg>`;
  }

  function render() {
    const s = stats();
    body.innerHTML = `
      <form class="wg-releve__form">
        <label>Date<input type="date" name="date" value="${today}" required></label>
        <label>Minutes passées<input type="number" name="minutes" min="1" step="1" required inputmode="numeric"></label>
        <label>Erreurs ou reprises<input type="number" name="erreurs" min="0" step="1" value="0" inputmode="numeric"></label>
        <label class="wg-grow">Note (facultatif)<input type="text" name="note" maxlength="120" placeholder="ex. devis long, ligne ambiguë"></label>
        <button class="btn btn--primary btn--sm" type="submit">Ajouter</button>
      </form>
      ${s ? `<div class="wg-stats">
          <div><strong>${s.n}</strong><span>occurrence${s.n > 1 ? 's' : ''}</span></div>
          <div><strong>${fmt(s.moy, 1)} min</strong><span>temps moyen</span></div>
          <div><strong>${s.min} à ${s.max} min</strong><span>écart</span></div>
          <div><strong>${s.err}</strong><span>erreurs ou reprises</span></div>
        </div>
        <div class="wg-scroll">${chart()}</div>
        ${mode === 'm9' ? `<p class="wg-note">À reporter dans votre projet final : temps unitaire <strong>${fmt(s.moy, 1)} min, mesuré sur ${s.n} cas</strong>${s.n < 3 ? '. Moins de trois cas : précisez-le et prolongez le relevé.' : '.'}</p>` : ''}
        <details class="wg-details"><summary>Voir et corriger les lignes</summary>
          <table class="wg-table"><thead><tr><th>Date</th><th>Min</th><th>Erreurs</th><th>Note</th><th></th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td>${esc(r.date)}</td><td>${esc(r.minutes)}</td><td>${esc(r.erreurs)}</td><td>${esc(r.note)}</td><td><button type="button" class="wg-link" data-del="${i}" aria-label="Supprimer la ligne du ${esc(r.date)}">Supprimer</button></td></tr>`).join('')}
          </tbody></table>
        </details>
        <div class="wg-actions"><button type="button" class="btn btn--secondary btn--sm" data-act="csv">Exporter en tableur (CSV)</button></div>`
      : `<p class="wg-note">Aucune ligne pour l'instant. ${mode === 'm9' ? 'Pas de relevé ? Chronométrez au moins une occurrence réelle cette semaine, et marquez le reste « estimé ».' : 'Première occurrence de la tâche : chronométrez-la, puis ajoutez-la ici.'}</p>`}`;
  }

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    rows.push({ date: f.get('date'), minutes: +f.get('minutes'), erreurs: +f.get('erreurs') || 0, note: String(f.get('note') || '') });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    store.set('releve', rows);
    render();
  });
  body.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]');
    if (d) { rows.splice(+d.dataset.del, 1); store.set('releve', rows); render(); return; }
    if (e.target.closest('[data-act="csv"]')) {
      const csv = ['date;minutes;erreurs_ou_reprises;note', ...rows.map((r) => [r.date, r.minutes, r.erreurs, '"' + String(r.note).replace(/"/g, '""') + '"'].join(';'))].join('\n');
      download('releve-cas-fil-rouge.csv', '﻿' + csv, 'text/csv');
    }
  });
  render();
}
