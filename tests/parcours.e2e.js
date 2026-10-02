// Parcours complet dans le navigateur : inscription, module, quiz, dépôt, évaluation, badge.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const B = process.env.B || 'http://127.0.0.1:8090';
const SUPW = process.env.SUPW || 'Admin-Test-2026!';
const quizDir = path.join(__dirname, '../backend/quiz');
const rnd = Date.now();
const apprenant = { email: `apprenant${rnd}@test.fr`, pw: 'Test-12345' };
const evaluateur = { email: `eval${rnd}@test.fr`, pw: 'Test-12345' };

async function answerQuiz(page, moduleId) {
  const quiz = JSON.parse(fs.readFileSync(path.join(quizDir, `${moduleId}.json`), 'utf8'));
  for (const q of quiz.questions) {
    for (const i of q.bonnes) await page.locator(`fieldset[data-q="${q.id}"] input[value="${i}"]`).check();
  }
  await page.getByRole('button', { name: 'Valider mes réponses' }).click();
  await expect(page.locator('#quiz-result .alert--ok')).toBeVisible();
}

test('parcours apprenant puis évaluation et badge', async ({ page, request, browser }) => {
  // Accueil et accès libre au module 0
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('IA générative');
  await page.goto('/modules/m3/');
  await expect(page.locator('#gate')).toBeVisible();

  // Inscription
  await page.goto('/inscription/');
  await page.fill('#name', 'Alice Martin');
  await page.fill('#email', apprenant.email);
  await page.fill('#entreprise', 'Menuiserie des Landes');
  await page.selectOption('#maillon', 'seconde_transformation');
  await page.fill('#password', apprenant.pw);
  await page.check('#consentement');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/modules/m0/');
  await expect(page.locator('#status-card')).toBeVisible();

  // Module 0 : quiz puis terminé
  await answerQuiz(page, 'm0');
  await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
  await expect(page.locator('#status-msg .alert--ok')).toBeVisible();

  // Module 1 : quiz (C1)
  await page.goto('/modules/m1/');
  await expect(page.locator('#btn-done')).toBeDisabled();
  await answerQuiz(page, 'm1');
  await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
  await expect(page.locator('#status-msg .alert--ok')).toBeVisible();

  // Exercice du module 2
  await page.goto('/modules/m2/');
  await page.locator('#exo-files').setInputFiles({ name: 'demande-c.txt', mimeType: 'text/plain', buffer: Buffer.from('Demande C') });
  await page.fill('#exo-comment', 'Ma demande C');
  await page.getByRole('button', { name: 'Déposer', exact: true }).click();
  await expect(page.locator('#exo-msg .alert--ok')).toBeVisible();

  // Fiche imprimable
  await page.goto('/fiches/m1/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fiche mémo');

  // Parcours : progression
  await page.goto('/parcours/');
  await expect(page.locator('#pct')).toHaveText('20 %');
  await page.screenshot({ path: 'captures/parcours.png', fullPage: true });

  // Projet final
  await page.goto('/projet-final/');
  await page.locator('#files').setInputFiles({ name: 'projet-final.txt', mimeType: 'text/plain', buffer: Buffer.from('Projet final') });
  await page.fill('#comment', 'Cas devis vers fiche de production');
  await page.check('#anon');
  await page.getByRole('button', { name: 'Déposer mon projet final' }).click();
  await expect(page.locator('#state .alert--ok')).toBeVisible();

  // Évaluateur créé puis promu par le superuser
  const su = await (await request.post(`${B}/api/collections/_superusers/auth-with-password`, { data: { identity: 'admin@kosm.io', password: SUPW } })).json();
  const ev = await (await request.post(`${B}/api/collections/users/records`, { data: { email: evaluateur.email, password: evaluateur.pw, passwordConfirm: evaluateur.pw, name: 'Eva Évaluatrice' } })).json();
  const promote = await request.patch(`${B}/api/collections/users/records/${ev.id}`, { headers: { Authorization: su.token }, data: { role: 'evaluateur' } });
  expect(promote.ok()).toBeTruthy();

  const ctx = await browser.newContext({ baseURL: B });
  const ep = await ctx.newPage();
  await ep.goto('/connexion/?suite=/evaluation/');
  await ep.fill('#email', evaluateur.email);
  await ep.fill('#password', evaluateur.pw);
  await ep.getByRole('button', { name: 'Se connecter' }).click();
  await ep.waitForURL('**/evaluation/');
  await expect(ep.locator('#s-aeval')).not.toHaveText('0');
  await ep.locator(`#subs tr:has-text("Alice Martin") [data-open]`).first().click();
  await expect(ep.locator('#panel')).toBeVisible();
  await expect(ep.locator('#p-info')).toContainText('réussi');
  for (const c of ['C2', 'C3', 'C4', 'C5', 'C6']) await ep.check(`input[name="${c}"]`);
  await ep.fill('#e-com', 'Très bon travail, prototype bien testé.');
  await ep.screenshot({ path: 'captures/evaluation.png', fullPage: true });
  await ep.getByRole('button', { name: 'Valider le projet' }).click();
  await expect(ep.locator('#e-msg .alert--ok')).toBeVisible();

  // Retour apprenant : badge
  await page.goto('/parcours/');
  await expect(page.locator('#badge-stat')).toHaveText('Obtenu');
  await page.getByRole('link', { name: 'Voir et partager mon badge' }).click();
  await expect(page.locator('#ok')).toBeVisible();
  await expect(page.locator('#titulaire')).toHaveText('Alice Martin');
  await page.screenshot({ path: 'captures/badge.png', fullPage: true });

  // Vérification publique sans compte
  const anon = await (await browser.newContext({ baseURL: B })).newPage();
  await anon.goto(page.url());
  await expect(anon.locator('#ok')).toBeVisible();
});
