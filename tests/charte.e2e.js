// Générateur de charte IA : parcours libre complet (sans compte) et mode m7 (apprenant connecté).
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const rnd = Date.now();

async function repondre(page, r) {
  const ecran = async (champs) => {
    for (const [cle, valeurs] of Object.entries(champs)) {
      if (cle === 'entreprise' || cle === 'referent') { await page.fill(`#ch-${cle}`, valeurs); continue; }
      if (cle === 'maillon') { await page.selectOption('#ch-maillon', valeurs); continue; }
      for (const v of [].concat(valeurs)) await page.locator(`input[data-cle="${cle}"][value="${v}"]`).check();
    }
    await page.getByRole('button', { name: /Suivant|Voir ma charte|Écrire mes règles/ }).click();
  };
  await ecran(r.ecran1);
  await ecran(r.ecran2);
  await ecran(r.ecran3);
}

const REPONSES = {
  ecran1: { entreprise: 'Charpentes du Test', maillon: 'bureau_etudes', effectif: '10-49', pilote: 'dirigeant', referent: 'Paul Martin' },
  ecran2: { outils: ['chatgpt', 'copilot'], usages: ['devis', 'plans'], formation: 'aucun' },
  ecran3: { donnees: ['plans', 'devis'], confidentialite: 'souvent', souverainete: 'exigence', ton: 'prudent' },
};

test('charte IA : parcours libre, sans appel serveur avant le formulaire', async ({ page }) => {
  const appels = [];
  page.on('request', (req) => { if (req.url().includes('/api/academie/charte')) appels.push(req.method() + ' ' + new URL(req.url()).pathname); });

  await page.goto('/charte/?utm_source=perfia&utm_medium=nav');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('charte IA');

  // Un écran incomplet est refusé
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.locator('#ch-msg .alert--error')).toBeVisible();

  await repondre(page, REPONSES);
  await expect(page.locator('.ch-apercu')).toContainText('Secret');
  await expect(page.locator('.ch-apercu .ch-regles li')).toHaveCount(5);
  await expect(page.locator('.ch-apercu .ch-regles')).toContainText('Paul Martin');
  // Copilot Microsoft 365 n'est jamais classé en compte personnel
  await expect(page.locator('.ch-apercu .ch-table tbody tr', { hasText: 'Copilot' })).not.toContainText('Compte personnel');
  expect(appels).toEqual([]); // aucune donnée envoyée avant le formulaire

  // Formulaire : email invalide refusé, puis envoi
  await page.fill('#ch-prenom', 'Camille');
  await page.fill('#ch-email', 'pas-un-email');
  await page.getByRole('button', { name: 'Recevoir ma charte' }).click();
  await expect(page.locator('#ch-msg .alert--error')).toBeVisible();
  await expect(page.locator('#ch-email')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#ch-email', `camille${rnd}@example.org`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Recevoir ma charte' }).click()]);
  expect(dl.suggestedFilename()).toBe('charte-ia-charpentes-du-test.docx');
  expect(fs.readFileSync(await dl.path()).subarray(0, 2).toString()).toBe('PK');

  await expect(page.locator('.ch-synth__titre')).toContainText('Charpentes du Test');
  await expect(page.locator('.charte-intro')).toBeHidden();
  await expect(page.locator('.ch-synth')).toContainText('Secret');
  await expect(page.locator('.ch-synth .ch-table tbody tr')).toHaveCount(2); // ChatGPT et Copilot
  await expect(page.locator('.ch-etapes__liste li').first()).toContainText('Former votre équipe');
  await expect(page.getByRole('link', { name: /Rejoindre l.Académie/ }).first()).toHaveAttribute('href', /source=charte.*entreprise=Charpentes/);
  expect(appels).toEqual(['POST /api/academie/charte', expect.stringMatching(/^GET \/api\/academie\/charte\/[A-Za-z0-9]{32}$/)]);

  // Page de synthèse par jeton
  await page.getByRole('link', { name: 'à garder ou à transmettre' }).click();
  await expect(page.locator('.ch-synth__titre')).toContainText('Charpentes du Test');
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible();

  // Lien tronqué : message d'erreur, pas de fuite
  await page.goto('/charte/synthese/?j=abc');
  await expect(page.locator('.alert--error')).toBeVisible();

  // L'inscription reprend les paramètres
  await page.goto('/inscription/?source=charte&email=lea@example.org&entreprise=Scierie%20Test&maillon=scierie');
  await expect(page.locator('#email')).toHaveValue('lea@example.org');
  await expect(page.locator('#entreprise')).toHaveValue('Scierie Test');
  await expect(page.locator('#maillon')).toHaveValue('scierie');
});

test('charte IA : mode m7, profil prérempli, règles modifiables et enregistrées', async ({ page }) => {
  await page.goto('/inscription/');
  await page.fill('#name', 'Alice Martin');
  await page.fill('#email', `alice${rnd}@example.org`);
  await page.fill('#entreprise', 'Menuiserie des Landes');
  await page.selectOption('#maillon', 'seconde_transformation');
  await page.fill('#password', 'Test-12345');
  await page.check('#consentement');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/modules/m0/**');

  await page.goto('/modules/m12/');
  const widget = page.locator('[data-widget="charte"]');
  await widget.scrollIntoViewIfNeeded();
  await expect(page.locator('#ch-entreprise')).toHaveValue('Menuiserie des Landes');
  await expect(page.locator('#ch-maillon')).toHaveValue('seconde_transformation');

  await repondre(page, {
    ecran1: { effectif: '10-49', pilote: 'responsable' },
    ecran2: { outils: ['mistral'], payes: ['mistral'], usages: ['redaction', 'devis'], formation: 'quelques' },
    ecran3: { donnees: ['devis'], confidentialite: 'parfois', souverainete: 'prefere', ton: 'encourageant' },
  });
  await expect(page.locator('textarea[data-regle]')).toHaveCount(5);
  // Les règles ne sont pas préremplies : enregistrer sans les écrire est refusé
  await expect(page.locator('#ch-r0')).toHaveValue('');
  await page.getByRole('button', { name: 'Enregistrer ma charte' }).click();
  await expect(page.locator('#ch-msg .alert--error')).toContainText('cinq règles');
  await page.locator('#ch-r0').fill('Nous utilisons l’IA pour nos mails et nos devis, relus avant envoi.');
  for (const i of [1, 2, 3, 4]) await page.locator(`[data-reprendre="${i}"]`).click();
  await expect(page.locator('#ch-r1')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Enregistrer ma charte' }).click();
  await expect(page.locator('#ch-msg .alert--ok')).toContainText('Charte enregistrée');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger en .docx' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.docx$/);

  // Reprise : la charte enregistrée revient telle qu'elle a été modifiée
  await page.reload();
  await widget.scrollIntoViewIfNeeded();
  await expect(page.locator('#ch-r0')).toHaveValue('Nous utilisons l’IA pour nos mails et nos devis, relus avant envoi.');

});
