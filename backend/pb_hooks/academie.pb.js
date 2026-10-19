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

// ---------- Attestation « Les bases de l'IA » : émise dès que les modules requis sont terminés ----------
onRecordAfterCreateSuccess((e) => {
  if (e.record.get("statut") === "termine") {
    const A = require(`${__hooks}/lib/academie.js`)
    try { A.issueBasesIfEligible(e.app, e.record.get("user")) } catch (err) { e.app.logger().error("Académie : attestation bases", "error", String(err)) }
  }
  e.next()
}, "progress")
onRecordAfterUpdateSuccess((e) => {
  if (e.record.get("statut") === "termine") {
    const A = require(`${__hooks}/lib/academie.js`)
    try { A.issueBasesIfEligible(e.app, e.record.get("user")) } catch (err) { e.app.logger().error("Académie : attestation bases", "error", String(err)) }
  }
  e.next()
}, "progress")

// ---------- Open Badges 2.0 (vérification hébergée) ----------
routerAdd("GET", "/api/academie/ob/issuer", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  return e.json(200, A.obIssuer($app))
})
routerAdd("GET", "/api/academie/ob/badges/{code}", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  const bc = A.obBadgeClass($app, e.request.pathValue("code"))
  return bc ? e.json(200, bc) : e.json(404, { message: "Badge inconnu." })
})
routerAdd("GET", "/api/academie/ob/badges/{code}/image", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  const code = e.request.pathValue("code")
  if (!A.obBadgeClass($app, code)) return e.json(404, { message: "Badge inconnu." })
  e.response.header().set("Content-Type", "image/svg+xml; charset=utf-8")
  e.response.header().set("Cache-Control", "public, max-age=86400")
  return e.string(200, A.obSvg(code, null))
})
routerAdd("GET", "/api/academie/ob/assertions/{id}", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  let badge
  try { badge = $app.findRecordById("badges", e.request.pathValue("id")) } catch (_) { return e.json(404, { message: "Assertion introuvable." }) }
  return e.json(200, A.obAssertion($app, badge))
})
// Image « cuite » : l'assertion est intégrée au SVG (spécification Open Badges 2.0, baking SVG).
routerAdd("GET", "/api/academie/ob/assertions/{id}/image", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  let badge
  try { badge = $app.findRecordById("badges", e.request.pathValue("id")) } catch (_) { return e.json(404, { message: "Assertion introuvable." }) }
  e.response.header().set("Content-Type", "image/svg+xml; charset=utf-8")
  if (e.request.url.query().get("download") === "1") e.response.header().set("Content-Disposition", 'attachment; filename="openbadge-' + badge.get("code") + '-' + badge.id + '.svg"')
  return e.string(200, A.obSvg(badge.get("code"), A.obAssertion($app, badge)))
})

// ---------- Comptes : rôle apprenant par défaut, mail de bienvenue ----------
onRecordCreateRequest((e) => {
  if (!e.record.get("role")) e.record.set("role", "apprenant")
  e.next()
}, "users")

onRecordAfterCreateSuccess((e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  A.sendMail(e.app, e.record.get("email"), "Bienvenue dans l'Académie PerfIA",
    "<p>Bonjour,</p><p>Votre compte est créé. Deux parcours vous attendent : « Les bases de l'IA », environ deux heures et demie pour utiliser l'IA dans les règles de l'AI Act, et « Mettre en place l'IA », pour faire avancer une tâche réelle de votre entreprise jusqu'à un prototype testé. Les modules communs ne se font qu'une fois.</p>" +
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
  const par = (col) => {
    const r = arrayOf(new DynamicModel({ cle: "", n: 0 }))
    $app.db().newQuery("SELECT COALESCE(" + col + ", '') AS cle, COUNT(*) AS n FROM chartes GROUP BY " + col).all(r)
    return r
  }
  const chartesLibres = count("SELECT COUNT(*) AS n FROM chartes WHERE source = 'libre'")
  const chartesSuivies = count("SELECT COUNT(*) AS n FROM chartes WHERE source = 'libre' AND user != ''")
  return e.json(200, {
    chartes: {
      total: count("SELECT COUNT(*) AS n FROM chartes"),
      par_source: par("source"), par_palier: par("palier"), par_niveau: par("niveau_donnees"),
      libres_suivies_d_une_inscription: chartesSuivies,
      taux_inscription: chartesLibres ? chartesSuivies / chartesLibres : 0,
    },
    inscrits: count("SELECT COUNT(*) AS n FROM users WHERE role = 'apprenant' OR role = ''"),
    projets_deposes: count("SELECT COUNT(*) AS n FROM submissions WHERE type = 'projet_final'"),
    a_evaluer: count("SELECT COUNT(*) AS n FROM submissions WHERE statut IN ('depose', 'en_evaluation')"),
    badges: count("SELECT COUNT(*) AS n FROM badges"),
    progression: rows,
    quiz: quiz,
  })
}, $apis.requireAuth("users"))
