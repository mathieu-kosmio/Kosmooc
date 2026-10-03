/// <reference path="../pb_data/types.d.ts" />
// Nom de l'application, expéditeur et e-mails de compte en français
// (sujet « Réinitialiser votre mot de passe Mooc PerfIA », etc.).

migrate((app) => {
  const settings = app.settings()
  settings.meta.appName = "Mooc PerfIA"
  settings.meta.senderName = "Mooc PerfIA"
  settings.meta.senderAddress = "mathieu@kosm.io"
  app.save(settings)

  const bouton = (url, libelle) =>
    '<p><a class="btn" href="' + url + '" target="_blank" rel="noopener">' + libelle + "</a></p>"

  const users = app.findCollectionByNameOrId("users")
  users.verificationTemplate.subject = "Confirmez votre adresse e-mail pour {APP_NAME}"
  users.verificationTemplate.body =
    "<p>Bonjour,</p><p>Confirmez votre adresse e-mail pour activer votre compte {APP_NAME}.</p>" +
    bouton("{APP_URL}/_/#/auth/confirm-verification/{TOKEN}", "Confirmer mon adresse") +
    "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p><p>L'équipe PerfIA</p>"
  users.resetPasswordTemplate.subject = "Réinitialiser votre mot de passe {APP_NAME}"
  users.resetPasswordTemplate.body =
    "<p>Bonjour,</p><p>Vous avez demandé la réinitialisation de votre mot de passe {APP_NAME}.</p>" +
    bouton("{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}", "Choisir un nouveau mot de passe") +
    "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p><p>L'équipe PerfIA</p>"
  users.confirmEmailChangeTemplate.subject = "Confirmez votre nouvelle adresse e-mail pour {APP_NAME}"
  users.confirmEmailChangeTemplate.body =
    "<p>Bonjour,</p><p>Confirmez le changement d'adresse e-mail de votre compte {APP_NAME}.</p>" +
    bouton("{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}", "Confirmer la nouvelle adresse") +
    "<p>L'équipe PerfIA</p>"
  app.save(users)
}, (app) => {
  // Pas de retour arrière : les réglages d'origine n'ont aucune valeur à restaurer.
})
