/// <reference path="../pb_data/types.d.ts" />
// Routes et règles serveur de l'Académie PerfIA.

// ---------- Quiz : questions publiques sans réponses ----------
routerAdd("GET", "/api/academie/quiz/{module}", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  const quiz = A.loadQuiz(e.request.pathValue("module"))
  if (!quiz) return e.json(404, { message: "Quiz introuvable." })
  return e.json(200, {
    module: quiz.module,
    seuil: quiz.seuil,
    questions: quiz.questions.map((q) => ({ id: q.id, enonce: q.enonce, choix: q.choix, multiple: (q.bonnes || []).length > 1 })),
  })
})

// ---------- Quiz : correction côté serveur et enregistrement de la tentative ----------
routerAdd("POST", "/api/academie/quiz/{module}", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  const moduleId = e.request.pathValue("module")
  const quiz = A.loadQuiz(moduleId)
  if (!quiz) return e.json(404, { message: "Quiz introuvable." })
  const body = e.requestInfo().body || {}
  const result = A.grade(quiz, body.reponses || {})
  const col = $app.findCollectionByNameOrId("quiz_attempts")
  const rec = new Record(col)
  rec.set("user", e.auth.id)
  rec.set("module", moduleId)
  rec.set("score", result.score)
  rec.set("total", result.total)
  rec.set("reussi", result.reussi)
  rec.set("reponses", body.reponses || {})
  $app.save(rec)
  return e.json(200, result)
}, $apis.requireAuth("users"))

// ---------- Progression : un module avec quiz n'est terminé qu'avec un quiz réussi ----------
onRecordCreateRequest((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  A.guardProgress(e)
  e.next()
}, "progress")
onRecordUpdateRequest((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  A.guardProgress(e)
  e.next()
}, "progress")

// ---------- Comptes : rôle apprenant par défaut, mail de bienvenue ----------
onRecordCreateRequest((e) => {
  if (!e.record.get("role")) e.record.set("role", "apprenant")
  e.next()
}, "users")

onRecordAfterCreateSuccess((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  A.sendMail(e.app, e.record.get("email"), "Bienvenue dans le Parcours IA filière bois",
    "<p>Bonjour,</p><p>Votre compte est créé. Commencez par le module 0 : 15 minutes pour situer votre usage de l'IA et choisir votre cas fil rouge.</p>" +
    "<p>" + A.appUrl(e.app) + "/parcours/</p><p>L'équipe PerfIA, Kosmio et Xylofutur</p>")
  e.next()
}, "users")

// ---------- Dépôts : statut initial et envoi éventuel à Certifiko ----------
onRecordCreateRequest((e) => {
  e.record.set("statut", "depose")
  e.next()
}, "submissions")

onRecordAfterCreateSuccess((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  if (e.record.get("type") === "projet_final") {
    try { A.pushToCertifiko(e.app, e.record) } catch (err) { e.app.logger().warn("Académie : envoi Certifiko", "error", String(err)) }
  }
  e.next()
}, "submissions")

// ---------- Évaluations : évaluateur renseigné, puis badge ----------
onRecordCreateRequest((e) => {
  if (e.auth) e.record.set("evaluateur", e.auth.id)
  if (!e.record.get("source")) e.record.set("source", "academie")
  e.next()
}, "evaluations")

onRecordAfterCreateSuccess((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  try { A.applyEvaluation(e.app, e.record) } catch (err) { e.app.logger().error("Académie : évaluation", "error", String(err)) }
  e.next()
}, "evaluations")

onRecordAfterUpdateSuccess((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  try { A.applyEvaluation(e.app, e.record) } catch (err) { e.app.logger().error("Académie : évaluation", "error", String(err)) }
  e.next()
}, "evaluations")

// ---------- Retour d'évaluation Certifiko (secret partagé) ----------
routerAdd("POST", "/api/academie/certifiko/callback", (e) => {
  const secret = $os.getenv("CERTIFIKO_CALLBACK_SECRET")
  if (!secret || e.request.header.get("x-certifiko-secret") !== secret) return e.json(401, { message: "Non autorisé." })
  const body = e.requestInfo().body || {}
  const submission = $app.findRecordById("submissions", body.submission_id)
  const col = $app.findCollectionByNameOrId("evaluations")
  const ev = new Record(col)
  ev.set("submission", submission.id)
  ev.set("criteres", body.criteres || {})
  ev.set("decision", body.decision === "valide" ? "valide" : "a_reprendre")
  ev.set("commentaire", body.commentaire || "")
  ev.set("source", "certifiko")
  $app.save(ev)
  return e.json(200, { ok: true, evaluation: ev.id })
})

// ---------- Indicateurs pour les évaluateurs ----------
routerAdd("GET", "/api/academie/stats", (e) => {
  if (e.auth.get("role") !== "evaluateur") return e.json(403, { message: "Réservé aux évaluateurs." })
  const count = (sql) => {
    const r = new DynamicModel({ n: 0 })
    $app.db().newQuery(sql).one(r)
    return r.n
  }
  const rows = arrayOf(new DynamicModel({ module: "", statut: "", n: 0 }))
  $app.db().newQuery("SELECT module, statut, COUNT(*) AS n FROM progress GROUP BY module, statut").all(rows)
  const quiz = arrayOf(new DynamicModel({ module: "", tentatives: 0, reussies: 0 }))
  $app.db().newQuery("SELECT module, COUNT(*) AS tentatives, SUM(CASE WHEN reussi THEN 1 ELSE 0 END) AS reussies FROM quiz_attempts GROUP BY module").all(quiz)
  return e.json(200, {
    inscrits: count("SELECT COUNT(*) AS n FROM users WHERE role = 'apprenant' OR role = ''"),
    projets_deposes: count("SELECT COUNT(*) AS n FROM submissions WHERE type = 'projet_final'"),
    a_evaluer: count("SELECT COUNT(*) AS n FROM submissions WHERE statut IN ('depose', 'en_evaluation')"),
    badges: count("SELECT COUNT(*) AS n FROM badges"),
    progression: rows,
    quiz: quiz,
  })
}, $apis.requireAuth("users"))
