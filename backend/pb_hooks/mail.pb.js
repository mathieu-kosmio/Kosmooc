/// <reference path="../pb_data/types.d.ts" />
/**
 * Envoi des e-mails par l'API transactionnelle de Brevo.
 *
 * Intercepte tous les e-mails émis par PocketBase (réinitialisation de mot de passe, vérification
 * d'adresse, notifications de l'Académie) et les envoie via https://api.brevo.com/v3/smtp/email.
 * Actif dès que APP_BREVO_API_KEY est défini ; sinon PocketBase garde son SMTP habituel.
 *
 * Variables :
 *   APP_BREVO_API_KEY ou BREVO_API  clé API Brevo v3 (secret, jamais committée)
 *   APP_MAIL_FROM      expéditeur « Mooc PerfIA <adresse> » ou adresse seule, validée chez Brevo ;
 *                      à défaut, « Mooc PerfIA <mathieu@kosm.io> ».
 */
onMailerSend((e) => {
  const key = String($os.getenv("APP_BREVO_API_KEY") || $os.getenv("BREVO_API") || "").trim()
  if (!key) return e.next()

  const msg = e.message
  const addr = (a) => (a.name ? { email: a.address, name: a.name } : { email: a.address })
  let sender = addr(msg.from)
  const custom = String($os.getenv("APP_MAIL_FROM") || "Mooc PerfIA <mathieu@kosm.io>").trim()
  if (custom) {
    const m = custom.match(/^(.*?)\s*<([^>]+)>$/)
    sender = m ? (m[1].trim() ? { email: m[2].trim(), name: m[1].trim() } : { email: m[2].trim() }) : { email: custom, name: sender.name }
  }

  const body = { sender, to: (msg.to || []).map(addr), subject: msg.subject }
  if (msg.html) body.htmlContent = msg.html
  if (msg.text) body.textContent = msg.text
  if (msg.cc && msg.cc.length) body.cc = msg.cc.map(addr)
  if (msg.bcc && msg.bcc.length) body.bcc = msg.bcc.map(addr)

  const res = $http.send({
    url: "https://api.brevo.com/v3/smtp/email",
    method: "POST",
    timeout: 15,
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("Brevo a refusé l'envoi (" + res.statusCode + ")")
  }
  // e.next() omis volontairement : l'envoi SMTP par défaut est court-circuité.
})
