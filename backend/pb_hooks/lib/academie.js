// Fonctions partagées des hooks de l'Académie PerfIA.
// Chargées avec require() à l'intérieur de chaque handler (contrainte JSVM PocketBase).

const BADGE = {
  code: "perfia-n1",
  intitule: "IA générative en entreprise, filière bois, Niveau 1",
  validiteMois: 24,
  competences: ["C1", "C2", "C3", "C4", "C5", "C6"],
}

function quizDir() {
  return $os.getenv("ACADEMIE_QUIZ_DIR") || (__hooks + "/../quiz")
}

function loadQuiz(moduleId) {
  if (!/^m[0-9]+$/.test(moduleId)) return null
  try {
    const raw = $os.readFile(quizDir() + "/" + moduleId + ".json")
    return JSON.parse(toString(raw))
  } catch (_) {
    return null
  }
}

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  const s = a.map(Number).sort().join(",")
  return s === b.map(Number).sort().join(",")
}

function grade(quiz, reponses) {
  const corrections = []
  let score = 0
  for (const q of quiz.questions) {
    const given = (reponses && reponses[q.id]) || []
    const ok = sameSet(given, q.bonnes)
    if (ok) score++
    corrections.push({ id: q.id, correct: ok, bonnes: q.bonnes, explication: q.explication || "" })
  }
  const total = quiz.questions.length
  const seuil = typeof quiz.seuil === "number" ? quiz.seuil : 0.6
  return { score, total, seuil, reussi: total > 0 && score / total >= seuil, corrections }
}

function hasPassedQuiz(app, userId, moduleId) {
  try {
    const recs = app.findRecordsByFilter("quiz_attempts", "user = {:u} && module = {:m} && reussi = true", "-created", 1, 0, { u: userId, m: moduleId })
    return recs.length > 0
  } catch (_) {
    return false
  }
}

function addMonths(date, months) {
  const d = new Date(date.getTime())
  d.setMonth(d.getMonth() + months)
  return d
}

// Émet le badge N1 si le projet final est validé et le quiz M1 (compétence C1) réussi.
function issueBadgeIfEligible(app, submission, evaluation) {
  if (submission.get("type") !== "projet_final") return { emis: false, raison: "pas un projet final" }
  const userId = submission.get("user")
  if (!hasPassedQuiz(app, userId, "m1")) return { emis: false, raison: "quiz M1 (C1) non réussi" }
  try {
    app.findFirstRecordByFilter("badges", "user = {:u} && code = {:c}", { u: userId, c: BADGE.code })
    return { emis: false, raison: "badge déjà émis" }
  } catch (_) {}
  const user = app.findRecordById("users", userId)
  const col = app.findCollectionByNameOrId("badges")
  const badge = new Record(col)
  const now = new Date()
  badge.set("user", userId)
  badge.set("code", BADGE.code)
  badge.set("intitule", BADGE.intitule)
  badge.set("titulaire", user.get("name") || user.get("email"))
  badge.set("entreprise", user.get("entreprise"))
  badge.set("emis_le", now.toISOString().replace("T", " "))
  badge.set("expire_le", addMonths(now, BADGE.validiteMois).toISOString().replace("T", " "))
  badge.set("evaluation", evaluation.id)
  badge.set("competences", evaluation.get("criteres") || {})
  badge.set("certifiko_ref", submission.get("certifiko_ref") || "")
  app.save(badge)
  sendMail(app, user.get("email"), "Votre badge PerfIA Niveau 1",
    "<p>Bonjour,</p><p>Votre projet final a été validé. Votre badge <strong>" + BADGE.intitule + "</strong> est disponible.</p>" +
    "<p>Lien de vérification : " + appUrl(app) + "/badge/?id=" + badge.id + "</p><p>L'équipe PerfIA</p>")
  return { emis: true, badgeId: badge.id }
}

// Applique une évaluation : statut du dépôt, puis badge éventuel.
function applyEvaluation(app, evaluation) {
  const submission = app.findRecordById("submissions", evaluation.get("submission"))
  const decision = evaluation.get("decision")
  submission.set("statut", decision === "valide" ? "valide" : "a_reprendre")
  app.save(submission)
  if (decision === "valide") return issueBadgeIfEligible(app, submission, evaluation)
  try {
    const user = app.findRecordById("users", submission.get("user"))
    sendMail(app, user.get("email"), "Votre dépôt PerfIA est à reprendre",
      "<p>Bonjour,</p><p>Votre évaluateur vous a laissé un retour sur votre dépôt (" + submission.get("module") + ").</p>" +
      "<p>Consultez-le dans votre parcours : " + appUrl(app) + "/parcours/</p><p>L'équipe PerfIA</p>")
  } catch (_) {}
  return { emis: false, raison: "à reprendre" }
}

function appUrl(app) {
  return $os.getenv("ACADEMIE_URL") || app.settings().meta.appURL || ""
}

function sendMail(app, to, subject, html) {
  try {
    if (!to || !(app.settings().smtp.enabled || $os.getenv("APP_BREVO_API_KEY") || $os.getenv("BREVO_API"))) return false
    const message = new MailerMessage({
      from: { address: app.settings().meta.senderAddress, name: app.settings().meta.senderName },
      to: [{ address: to }],
      subject: subject,
      html: html,
    })
    app.newMailClient().send(message)
    return true
  } catch (err) {
    app.logger().warn("Académie : envoi de mail impossible", "error", String(err))
    return false
  }
}

// Envoi optionnel d'un projet final à Certifiko (contrat décrit dans docs/INTEGRATION-CERTIFIKO.md).
function pushToCertifiko(app, submission) {
  const url = $os.getenv("CERTIFIKO_WEBHOOK_URL")
  if (!url) return null
  const user = app.findRecordById("users", submission.get("user"))
  const files = (submission.get("fichiers") || []).map((f) => f)
  const payload = {
    source: "perfia-academie",
    referentiel: BADGE.code,
    submission_id: submission.id,
    module: submission.get("module"),
    candidat: { id: user.id, email: user.get("email"), nom: user.get("name"), entreprise: user.get("entreprise") },
    fichiers: files,
    lien: submission.get("lien"),
    commentaire: submission.get("commentaire"),
    callback_url: appUrl(app) + "/api/academie/certifiko/callback",
  }
  const res = $http.send({
    url: url,
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json", "authorization": "Bearer " + ($os.getenv("CERTIFIKO_TOKEN") || "") },
    timeout: 15,
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const ref = (res.json && (res.json.id || res.json.reference)) || ""
    submission.set("certifiko_ref", String(ref))
    submission.set("statut", "en_evaluation")
    app.save(submission)
    return ref
  }
  app.logger().warn("Académie : Certifiko a refusé le dépôt", "status", res.statusCode)
  return null
}

function guardProgress(e) {
  if (e.record.get("statut") === "termine") {
    const m = e.record.get("module")
    if (loadQuiz(m) && !hasPassedQuiz(e.app, e.record.get("user"), m)) {
      throw new BadRequestError("Réussissez le quiz du module avant de le marquer comme terminé.")
    }
  }
}

module.exports = { guardProgress, BADGE, loadQuiz, grade, hasPassedQuiz, applyEvaluation, issueBadgeIfEligible, sendMail, appUrl, pushToCertifiko }
