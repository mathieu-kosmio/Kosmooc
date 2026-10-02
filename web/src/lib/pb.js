import PocketBase from 'pocketbase';

// Même origine que le site en production ; surcharge possible en développement.
const url = import.meta.env.PUBLIC_PB_URL || (typeof window !== 'undefined' ? window.location.origin : '');
export const pb = new PocketBase(url);
pb.autoCancellation(false);

export const user = () => (pb.authStore.isValid ? pb.authStore.record : null);
export const isEvaluateur = () => user()?.role === 'evaluateur';

export function requireLogin() {
  if (!pb.authStore.isValid) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/connexion/?suite=${next}`;
    return false;
  }
  return true;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function errMsg(err) {
  const d = err?.response?.data || err?.data?.data;
  if (d && typeof d === 'object') {
    const first = Object.values(d)[0];
    if (first?.message) return first.message;
  }
  return err?.response?.message || err?.message || 'Une erreur est survenue.';
}

export const fmtDate = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
