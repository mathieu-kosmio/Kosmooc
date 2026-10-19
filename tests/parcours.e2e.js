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
  await expect(page.getByRole('heading', { level: 1 })).toContainText("Prenez en main l'IA");
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
  await page.waitForURL('**/modules/m0/**');
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
  await page.goto('/parcours/?p=mettre-en-place');
  await expect(page.locator('[data-panel="mettre-en-place"] [data-pct]')).toHaveText('17 %');
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
  await page.goto('/parcours/?p=mettre-en-place');
  const mep = page.locator('[data-panel="mettre-en-place"]');
  await expect(mep.locator('[data-badge-stat]')).toHaveText('Obtenu');
  await mep.getByRole('link', { name: 'Voir, télécharger et partager' }).click();
  await expect(page.locator('#ok')).toBeVisible();
  await expect(page.locator('#titulaire')).toHaveText('Alice Martin');
  await page.screenshot({ path: 'captures/badge.png', fullPage: true });

  // Vérification publique sans compte
  const anon = await (await browser.newContext({ baseURL: B })).newPage();
  await anon.goto(page.url());
  await expect(anon.locator('#ok')).toBeVisible();
});

test('parcours Les bases de l\'IA : modules communs acquis, attestation Open Badges', async ({ page, request }) => {
  const email = `bases${rnd}@test.fr`;
  await page.goto('/inscription/');
  await page.fill('#name', 'Bruno Bases');
  await page.fill('#email', email);
  await page.fill('#entreprise', 'Scierie du Lot');
  await page.selectOption('#maillon', 'scierie');
  await page.check('input[name="parcours"][value="bases"]');
  await page.fill('#password', 'Test-12345');
  await page.check('#consentement');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/modules/m10/**');
  await expect(page.locator('.eyebrow').first()).toContainText("Les bases de l'IA · Module 0");
  await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
  await expect(page.locator('#status-msg .alert--ok')).toBeVisible();

  for (const m of ['m1', 'm2', 'm7', 'm11']) {
    await page.goto(`/modules/${m}/?p=bases`);
    await answerQuiz(page, m);
    await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
    await expect(page.locator('#status-msg .alert--ok')).toBeVisible();
  }
  // Le dernier module annonce l'attestation, émise par le serveur
  await expect(page.locator('#attestation a')).toBeVisible();

  // Tableau de bord : parcours terminé, attestation obtenue, modules communs acquis dans l'autre parcours
  await page.goto('/parcours/?p=bases');
  const bases = page.locator('[data-panel="bases"]');
  await expect(bases.locator('[data-pct]')).toHaveText('100 %');
  await expect(bases.locator('[data-badge-stat]')).toHaveText('Obtenu');
  await page.getByRole('tab', { name: /Mettre en place/ }).click();
  const mep = page.locator('[data-panel="mettre-en-place"]');
  await expect(mep.locator('[data-mid="m1"] [data-status]')).toHaveText('Terminé, acquis');
  await expect(mep.locator('[data-mid="m11"] [data-status]')).toHaveText('Terminé, acquis');
  await expect(mep.locator('[data-mid="m3"] [data-status]')).toHaveText('À faire');
  await page.screenshot({ path: 'captures/parcours-bases.png', fullPage: true });

  // Dans « Mettre en place », le module suivant de M6 saute les modules déjà acquis
  await page.goto('/modules/m6/?p=mettre-en-place');
  await expect(page.locator('nav.pager[data-ctx="mettre-en-place"] [data-next]')).toContainText('Écrire la charte IA');

  // Attestation : page publique et Open Badges 2.0
  await page.goto('/parcours/?p=bases');
  await bases.getByRole('link', { name: 'Voir, télécharger et partager' }).click();
  await expect(page.locator('#eyebrow')).toHaveText('Attestation vérifiée');
  const href = await page.locator('#ob-json').getAttribute('href');
  const a = await (await request.get(href)).json();
  expect(a.type).toBe('Assertion');
  expect(a.verification.type).toBe('hosted');
  expect(a.recipient.hashed).toBe(true);
  const bc = await (await request.get(a.badge)).json();
  expect(bc.type).toBe('BadgeClass');
  expect(bc.alignment[0].targetName).toContain('article 4');
  const img = await (await request.get(`${href}/image`)).text();
  expect(img).toContain('<openbadges:assertion');
  await page.screenshot({ path: 'captures/attestation-bases.png', fullPage: true });
});
