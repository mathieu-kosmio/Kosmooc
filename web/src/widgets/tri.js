import DATA from './tri-data.js';
import { shell, shuffle, esc } from './util.js';

export default function tri(el, { config }) {
  const cfg = DATA[config];
  if (!cfg) { el.textContent = ''; return; }
  const body = shell(el, { eyebrow: cfg.eyebrow, titre: cfg.titre, consigne: cfg.consigne, type: 'tri' });
  let cartes, place, selected, verifie;

  function reset() {
    cartes = shuffle(cfg.cartes).map((c, i) => ({ ...c, id: 'c' + i }));
    place = {};
    selected = null;
    verifie = false;
    render();
  }

  function cardHtml(c) {
    const col = place[c.id];
    let state = '';
    if (verifie && col) state = col === c.bonne ? 'is-good' : 'is-bad';
    return `<button type="button" class="wg-card ${state} ${selected === c.id ? 'is-selected' : ''}" draggable="${!verifie}" data-card="${c.id}" aria-pressed="${selected === c.id}">
      <span>${esc(c.texte)}</span>
      ${verifie && col ? `<small class="wg-card__why">${col === c.bonne ? '✓ ' : '✗ ' + esc(cfg.colonnes.find((x) => x.id === c.bonne).label) + ' : '}${esc(c.explication)}</small>` : ''}
    </button>`;
  }

  function render() {
    const pool = cartes.filter((c) => !place[c.id]);
    const score = cartes.filter((c) => place[c.id] === c.bonne).length;
    body.innerHTML = `
      <div class="wg-pool" data-col="" aria-label="Cartes à placer">${pool.length ? pool.map(cardHtml).join('') : '<p class="t-small wg-muted">Toutes les cartes sont placées.</p>'}</div>
      <div class="wg-cols" style="--cols:${cfg.colonnes.length}">
        ${cfg.colonnes.map((col) => `
          <div class="wg-col wg-col--${col.couleur}" data-col="${col.id}">
            <button type="button" class="wg-col__head" data-target="${col.id}">${esc(col.label)}<span class="wg-col__hint">${selected ? 'Placer ici' : ''}</span></button>
            <div class="wg-col__cards">${cartes.filter((c) => place[c.id] === col.id).map(cardHtml).join('')}</div>
          </div>`).join('')}
      </div>
      <div class="wg-actions">
        <button type="button" class="btn btn--primary btn--sm" data-act="verif" ${pool.length || verifie ? 'disabled' : ''}>Vérifier</button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="reset">Recommencer</button>
        <span class="wg-score" role="status">${verifie ? `${score} / ${cartes.length} bien placées${score === cartes.length ? ' · parfait !' : ' · lisez les explications en rouge'}` : `${cartes.length - pool.length} / ${cartes.length} placées`}</span>
      </div>`;
  }

  function move(cardId, colId) {
    if (verifie) return;
    if (colId) place[cardId] = colId; else delete place[cardId];
    selected = null;
    render();
  }

  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) { if (act.dataset.act === 'reset') reset(); else { verifie = true; render(); } return; }
    const target = e.target.closest('[data-target]');
    if (target && selected) { move(selected, target.dataset.target); return; }
    const card = e.target.closest('[data-card]');
    if (card && !verifie) {
      const id = card.dataset.card;
      if (place[id] && selected !== id) { move(id, null); return; }
      selected = selected === id ? null : id;
      render();
      body.querySelector(`[data-card="${id}"]`)?.focus();
    }
  });
  body.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-card]');
    if (card) e.dataTransfer.setData('text/plain', card.dataset.card);
  });
  body.addEventListener('dragover', (e) => { if (e.target.closest('[data-col]')) e.preventDefault(); });
  body.addEventListener('drop', (e) => {
    const zone = e.target.closest('[data-col]');
    const id = e.dataTransfer.getData('text/plain');
    if (zone && id) { e.preventDefault(); move(id, zone.dataset.col || null); }
  });

  reset();
}
