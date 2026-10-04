export const store = {
  get(k, d) { try { const v = localStorage.getItem('perfia.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('perfia.' + k, JSON.stringify(v)); } catch (_) { /* stockage indisponible */ } },
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** Cadre commun d'une activité : bandeau, titre, consigne, corps. */
export function shell(el, { eyebrow = 'Activité', titre, consigne = '', type = '' }) {
  el.classList.add('wg');
  if (type) el.classList.add('wg--' + type);
  el.innerHTML = `
    <div class="wg__head">
      <span class="wg__eyebrow">${esc(eyebrow)}</span>
      <h3 class="wg__title">${esc(titre)}</h3>
      ${consigne ? `<p class="wg__consigne">${consigne}</p>` : ''}
    </div>
    <div class="wg__body"></div>`;
  return el.querySelector('.wg__body');
}

export function flash(btn, txt) {
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = txt;
  setTimeout(() => { btn.textContent = old; }, 1600);
}

export async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); flash(btn, 'Copié'); }
  catch (_) { flash(btn, 'Copie impossible'); }
}

export function download(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const fmt = (n, d = 0) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Lit une variable CSS du thème (couleurs Kosmio × Xylofutur). */
export const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export const COLORS = {
  green: '#00B194', greenDark: '#009982', greenLight: '#E6F7F4',
  gold: '#BA8748', goldDark: '#9F7338', goldLight: '#F8EFE2',
  sage: '#7C9E98', sageDark: '#65857F', sageLight: '#EEF3F2',
  ink: '#1F2D3D', ink7: '#3B4B5E', grey: '#5D6C73', line: '#C9BFB1', sand: '#FBF6EE', red: '#B23A3A', redLight: '#FDECEC',
};
