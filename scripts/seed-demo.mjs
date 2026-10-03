// Comptes et données de démonstration pour tester l'Académie en local.
// Usage : node scripts/seed-demo.mjs <url> <admin email> <admin mot de passe> <dossier quiz>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [B, ADMIN, ADMIN_PW, QUIZ_DIR] = process.argv.slice(2);
const PW = 'Demo-2026';

async function api(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = token;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} : ${res.status} ${JSON.stringify(data)}`);
  return data;
}
const login = async (email) => (await api('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: email, password: PW } }));
const answers = (m) => {
  const q = JSON.parse(readFileSync(join(QUIZ_DIR, `${m}.json`), 'utf8'));
  return { reponses: Object.fromEntries(q.questions.map((x) => [x.id, x.bonnes])) };
};

const su = await api('/api/collections/_superusers/auth-with-password', { method: 'POST', body: { identity: ADMIN, password: ADMIN_PW } });

// Évaluatrice
const ev = await api('/api/collections/users/records', { method: 'POST', body: { email: 'evaluatrice@perfia.local', password: PW, passwordConfirm: PW, name: 'Claire Évaluatrice', entreprise: 'Kosmio', fonction: 'Évaluatrice PerfIA', consentement: true } });
await api(`/api/collections/users/records/${ev.id}`, { method: 'PATCH', token: su.token, body: { role: 'evaluateur', verified: true } });

// Apprenant avec un parcours avancé et un projet final déposé
await api('/api/collections/users/records', { method: 'POST', body: { email: 'apprenant@perfia.local', password: PW, passwordConfirm: PW, name: 'Julien Démo', entreprise: 'Menuiserie des Landes', fonction: 'Responsable atelier', maillon: 'seconde_transformation', consentement: true } });
const a = await login('apprenant@perfia.local');
for (const m of ['m0', 'm1']) {
  await api(`/api/academie/quiz/${m}`, { method: 'POST', token: a.token, body: answers(m) });
  await api('/api/collections/progress/records', { method: 'POST', token: a.token, body: { user: a.record.id, module: m, statut: 'termine' } });
}
await api('/api/collections/progress/records', { method: 'POST', token: a.token, body: { user: a.record.id, module: 'm2', statut: 'en_cours' } });
const fd = new FormData();
fd.append('user', a.record.id); fd.append('module', 'm9'); fd.append('type', 'projet_final');
fd.append('commentaire', 'Cas fil rouge : du devis à la fiche de production. Prototype testé sur deux devis inédits.');
fd.append('fichiers', new Blob([readFileSync(join(QUIZ_DIR, '../../web/public/ressources/modele-projet-final.md'))], { type: 'text/markdown' }), 'projet-final-menuiserie-des-landes.md');
await api('/api/collections/submissions/records', { method: 'POST', token: a.token, form: fd });

// Deux autres apprenants pour peupler les indicateurs
for (const [email, name, ent, maillon] of [['scierie@perfia.local', 'Sophie Démo', 'Scierie du Plateau', 'scierie'], ['bet@perfia.local', 'Marc Démo', 'BET Ossature Sud', 'bureau_etudes']]) {
  await api('/api/collections/users/records', { method: 'POST', body: { email, password: PW, passwordConfirm: PW, name, entreprise: ent, maillon, consentement: true } });
  const u = await login(email);
  await api('/api/academie/quiz/m0', { method: 'POST', token: u.token, body: answers('m0') });
  await api('/api/collections/progress/records', { method: 'POST', token: u.token, body: { user: u.record.id, module: 'm0', statut: 'termine' } });
}
console.log('Comptes de démonstration créés.');
