// Fonctions partagées des hooks de l'Académie PerfIA.
// Chargées avec require() à l'intérieur de chaque handler (contrainte JSVM PocketBase).

// Parcours et badges : backend/parcours.json, même fichier que le front.
function loadParcours() {
  const path = $os.getenv("ACADEMIE_PARCOURS") || (__hooks + "/../parcours.json")
  return JSON.parse(toString($os.readFile(path)))
}

const BADGE = {
  code: "perfia-n1",
  intitule: "IA générative en entreprise, filière bois, Niveau 1",
  validiteMois: 24,
  competences: ["C1", "C2", "C3", "C4", "C5", "C6"],
}
const BADGE_BASES = "perfia-bases"

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
  const badge = emettreBadge(app, userId, BADGE.code, {
    evaluation: evaluation.id,
    competences: evaluation.get("criteres") || {},
    certifiko_ref: submission.get("certifiko_ref") || "",
  })
  if (!badge) return { emis: false, raison: "badge déjà émis" }
  return { emis: true, badgeId: badge.id }
}

// Émet un badge (une fois par personne et par code), puis prévient par mail. Renvoie null s'il existe déjà.
function emettreBadge(app, userId, code, extra) {
  try {
    app.findFirstRecordByFilter("badges", "user = {:u} && code = {:c}", { u: userId, c: code })
    return null
  } catch (_) {}
  const def = loadParcours().badges[code]
  const user = app.findRecordById("users", userId)
  const col = app.findCollectionByNameOrId("badges")
  const badge = new Record(col)
  const now = new Date()
  badge.set("user", userId)
  badge.set("code", code)
  badge.set("intitule", def.intitule)
  badge.set("titulaire", user.get("name") || user.get("email"))
  badge.set("entreprise", user.get("entreprise"))
  badge.set("emis_le", now.toISOString().replace("T", " "))
  badge.set("expire_le", addMonths(now, def.validite_mois || 24).toISOString().replace("T", " "))
  for (const k in (extra || {})) badge.set(k, extra[k])
  app.save(badge)
  const lien = appUrl(app) + "/badge/?id=" + badge.id
  sendMail(app, user.get("email"),
    code === BADGE_BASES ? "Votre attestation PerfIA « Les bases de l'IA »" : "Votre badge PerfIA Niveau 1",
    "<p>Bonjour,</p><p>" + (code === BADGE_BASES ? "Vous avez terminé le parcours « Les bases de l'IA ». Votre attestation" : "Votre projet final a été validé. Votre badge") +
    " <strong>" + def.intitule + "</strong> est disponible, au format Open Badges.</p>" +
    "<p>Lien de vérification et téléchargement : " + lien + "</p><p>L'équipe PerfIA</p>")
  return badge
}

// Attestation « Les bases de l'IA » : émise dès que tous les modules requis sont terminés,
// quel que soit le parcours dans lequel l'apprenant les a suivis.
function issueBasesIfEligible(app, userId) {
  const def = loadParcours().badges[BADGE_BASES]
  if (!def) return { emis: false, raison: "badge non défini" }
  for (const m of def.requis) {
    try {
      app.findFirstRecordByFilter("progress", "user = {:u} && module = {:m} && statut = 'termine'", { u: userId, m: m })
    } catch (_) { return { emis: false, raison: "module " + m + " non terminé" } }
  }
  const badge = emettreBadge(app, userId, BADGE_BASES, { competences: { modules: def.requis } })
  return badge ? { emis: true, badgeId: badge.id } : { emis: false, raison: "badge déjà émis" }
}

// ---------- Open Badges 2.0, vérification hébergée ----------
// Émetteur, classe de badge et assertion sont des documents JSON-LD publics servis par l'API ;
// l'image du badge peut être « cuite » (assertion intégrée dans le SVG) pour être importée ailleurs.
function obBase(app) { return appUrl(app).replace(/\/$/, "") + "/api/academie/ob" }

function obIssuer(app) {
  return {
    "@context": "https://w3id.org/openbadges/v2",
    type: "Issuer",
    id: obBase(app) + "/issuer",
    name: "Kosmio",
    url: "https://kosm.io",
    email: "mathieu@kosm.io",
    description: "Kosmio, studio de plateformes numériques pour la transition, émet les badges de l'Académie PerfIA, programme IA de la filière forêt-bois mené avec Xylofutur.",
    image: appUrl(app).replace(/\/$/, "") + "/favicon.svg",
  }
}

function obBadgeClass(app, code) {
  const P = loadParcours()
  const def = P.badges[code]
  if (!def) return null
  const site = appUrl(app).replace(/\/$/, "")
  const bc = {
    "@context": "https://w3id.org/openbadges/v2",
    type: "BadgeClass",
    id: obBase(app) + "/badges/" + code,
    name: def.intitule,
    description: def.description,
    image: obBase(app) + "/badges/" + code + "/image",
    criteria: { id: site + "/programme/#" + def.parcours, narrative: def.criteres + "\n\nCompétences : " + def.competences.join(" ; ") + "." },
    issuer: obBase(app) + "/issuer",
    tags: def.tags || [],
  }
  if (code === BADGE_BASES) {
    bc.alignment = [{
      targetName: "Règlement (UE) 2024/1689 (AI Act), article 4 : maîtrise de l'IA",
      targetUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      targetDescription: "Mesures de maîtrise de l'IA prises par les fournisseurs et déployeurs pour leur personnel, telles que précisées par le règlement (UE) 2026/1744.",
    }]
  }
  return bc
}

function isoDate(s) { return s ? String(s).replace(" ", "T").replace(/\.\d+Z$/, "Z") : undefined }

function obAssertion(app, badge) {
  const user = app.findRecordById("users", badge.get("user"))
  const salt = badge.id
  const email = String(user.get("email") || "").trim().toLowerCase()
  const a = {
    "@context": "https://w3id.org/openbadges/v2",
    type: "Assertion",
    id: obBase(app) + "/assertions/" + badge.id,
    recipient: { type: "email", hashed: true, salt: salt, identity: "sha256$" + $security.sha256(email + salt) },
    badge: obBase(app) + "/badges/" + badge.get("code"),
    issuedOn: isoDate(badge.get("emis_le")),
    verification: { type: "hosted" },
    image: obBase(app) + "/assertions/" + badge.id + "/image",
    evidence: [{ id: appUrl(app).replace(/\/$/, "") + "/badge/?id=" + badge.id, narrative: "Page de vérification publique de l'Académie PerfIA, au nom de " + (badge.get("titulaire") || "") + "." }],
  }
  const exp = isoDate(badge.get("expire_le"))
  if (exp) a.expires = exp
  return a
}

function escXml(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] }) }

// Image du badge : le sceau PerfIA, 600 × 600, palette PerfIA (même dessin que web/src/components/Seal.astro).
function obSvg(code, assertion) {
  const def = loadParcours().badges[code] || {}
  const label = escXml(def.sceau || "PERFIA")
  const titre = escXml(def.intitule || "")
  const fs = (def.sceau || "").length > 8 ? 9.5 : 11
  let cuisson = ""
  if (assertion) cuisson = '<openbadges:assertion verify="' + escXml(assertion.id) + '"><![CDATA[' + JSON.stringify(assertion) + ']]></openbadges:assertion>'
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:openbadges="http://openbadges.org" viewBox="0 0 120 120" width="600" height="600" role="img" aria-label="' + titre + '">' +
    cuisson +
    '<title>' + titre + '</title>' +
    '<circle cx="60" cy="60" r="56" fill="#E6F7F4" stroke="#00B194" stroke-width="4"/>' +
    '<circle cx="60" cy="60" r="44" fill="#fff" stroke="#BA8748" stroke-width="2" stroke-dasharray="3 4"/>' +
    '<path d="M60 30c-9 11-14 20-14 28a14 14 0 0 0 28 0c0-8-5-17-14-28z" fill="#00B194"/>' +
    '<path d="M60 46v32M60 60l-6-6M60 68l7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>' +
    '<text x="60" y="98" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="' + fs + '" font-weight="700" fill="#1F2D3D">' + label + '</text>' +
    '<text x="60" y="21" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="6" font-weight="700" letter-spacing=".8" fill="#009982">PERFIA</text>' +
    '</svg>'
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

module.exports = { guardProgress, BADGE, BADGE_BASES, loadParcours, loadQuiz, grade, hasPassedQuiz, applyEvaluation, issueBadgeIfEligible, issueBasesIfEligible, emettreBadge, obIssuer, obBadgeClass, obAssertion, obSvg, sendMail, appUrl, pushToCertifiko }
