/// <reference path="../pb_data/types.d.ts" />
// Routes du générateur de charte IA (docs/EVOLUTION-CHARTE-IA.md, section 7).

// ---------- Questions, règles et clauses : aucune donnée personnelle ----------
routerAdd("GET", "/api/academie/charte/regles", (e) => {
  const Ch = require(`${__hooks}/lib/charte.js`)
  return e.json(200, Ch.referentiel())
})

// ---------- Mode libre : valide, recalcule, enregistre, pousse le lead, envoie les mails ----------
routerAdd("POST", "/api/academie/charte", (e) => {
  const A = require(`${__hooks}/lib/academie.js`)
  const Ch = require(`${__hooks}/lib/charte.js`)
  const body = e.requestInfo().body || {}

  const prenom = Ch.texteCourt(body.prenom, 120)
  const email = Ch.texteCourt(body.email, 200).toLowerCase()
  if (!prenom) return e.json(400, { message: "Le prénom est obligatoire." })
  if (!Ch.emailValide(email)) return e.json(400, { message: "L'adresse email n'est pas valide." })

  const ipHash = $security.sha256(String(e.realIP()))
  if (Ch.envoisRecents(e.app, ipHash) >= Ch.LIMITE_ENVOIS) {
    return e.json(429, { message: "Trop d'envois depuis cette adresse. Réessayez dans quelques minutes." })
  }

  const referent = Ch.texteCourt(body.referent, 200)
  const calcul = Ch.calculer(body.reponses, { referent: referent })
  if (!calcul.ok) return e.json(400, { message: "Certaines réponses sont manquantes ou invalides.", champs: calcul.erreurs })
  const s = calcul.synthese

  const rec = new Record(e.app.findCollectionByNameOrId("chartes"))
  rec.set("source", "libre")
  rec.set("prenom", prenom)
  rec.set("email", email)
  rec.set("fonction", Ch.texteCourt(body.fonction, 200))
  rec.set("referent", referent)
  rec.set("newsletter", body.newsletter === true)
  rec.set("utm", Ch.utmDepuis(body.utm))
  rec.set("jeton", $security.randomString(32))
  rec.set("ip_hash", ipHash)
  Ch.appliquerSynthese(rec, calcul.reponses, s, s.regles)
  // Un compte existant avec le même email récupère la charte tout de suite.
  try { rec.set("user", e.app.findAuthRecordByEmail("users", email).id) } catch (_) {}
  e.app.save(rec)

  // Ni Brevo ni les mails ne bloquent la réponse.
  Ch.pousserBrevo(e.app, rec, calcul.reponses, s)
  try { Ch.mailLead(e.app, A, rec, s) } catch (err) { e.app.logger().warn("Charte IA : mail au lead", "error", String(err)) }
  try { Ch.mailNotification(e.app, A, rec, calcul.reponses, s) } catch (err) { e.app.logger().warn("Charte IA : notification", "error", String(err)) }

  return e.json(200, { id: rec.id, jeton: rec.get("jeton"), niveau: s.niveau, score: s.score, palier: s.palier, recommandations: s.recommandations })
})

// ---------- Mode m7 : charte du compte, modifiable ----------
routerAdd("POST", "/api/academie/charte/m7", (e) => {
  const Ch = require(`${__hooks}/lib/charte.js`)
  const body = e.requestInfo().body || {}
  const brut = Object.assign({}, body.reponses || {})
  // Entreprise et maillon viennent du profil quand le formulaire ne les fournit pas.
  if (!brut.entreprise) brut.entreprise = e.auth.get("entreprise")
  if (!brut.maillon) brut.maillon = e.auth.get("maillon")
  const calcul = Ch.calculer(brut, { referent: Ch.texteCourt(body.referent, 200) })
  if (!calcul.ok) return e.json(400, { message: "Certaines réponses sont manquantes ou invalides.", champs: calcul.erreurs })
  const s = calcul.synthese
  const regles = Ch.nettoyerRegles(body.regles, s.regles)

  let rec
  try {
    rec = e.app.findFirstRecordByFilter("chartes", "user = {:u} && source = 'm7'", { u: e.auth.id })
  } catch (_) {
    rec = new Record(e.app.findCollectionByNameOrId("chartes"))
    rec.set("source", "m7")
    rec.set("user", e.auth.id)
    rec.set("jeton", $security.randomString(32))
  }
  rec.set("email", String(e.auth.get("email") || "").toLowerCase())
  rec.set("prenom", Ch.texteCourt(e.auth.get("name"), 120))
  rec.set("fonction", Ch.texteCourt(e.auth.get("fonction"), 200))
  rec.set("referent", Ch.texteCourt(body.referent, 200))
  Ch.appliquerSynthese(rec, calcul.reponses, s, regles)
  e.app.save(rec)
  return e.json(200, { id: rec.id, niveau: s.niveau, score: s.score, palier: s.palier, recommandations: s.recommandations, regles: regles })
}, $apis.requireAuth("users"))

// ---------- Synthèse par jeton, sans compte ----------
routerAdd("GET", "/api/academie/charte/{jeton}", (e) => {
  const Ch = require(`${__hooks}/lib/charte.js`)
  const jeton = e.request.pathValue("jeton")
  if (!/^[A-Za-z0-9]{32}$/.test(jeton)) return e.json(404, { message: "Synthèse introuvable." })
  let rec
  try {
    rec = e.app.findFirstRecordByFilter("chartes", "jeton = {:j} && source = 'libre'", { j: jeton })
  } catch (_) {
    return e.json(404, { message: "Synthèse introuvable." })
  }
  const rep = Ch.champJson(rec, "reponses")
  const calcul = Ch.calculer(rep, { referent: rec.get("referent"), date: new Date(String(rec.get("created")).replace(" ", "T")) })
  if (!calcul.ok) return e.json(404, { message: "Synthèse introuvable." })
  const s = calcul.synthese
  // Ni email, ni empreinte d'IP, ni identifiant de compte : seulement ce que la page de synthèse affiche.
  return e.json(200, {
    prenom: rec.get("prenom"), entreprise: rec.get("entreprise"), maillon: rec.get("maillon"), effectif: rec.get("effectif"),
    referent: rec.get("referent"), created: rec.get("created"), reponses: calcul.reponses,
    niveau: s.niveau, niveau_libelle: s.niveau_libelle, score: s.score, detail: s.detail, palier: s.palier, palier_libelle: s.palier_libelle,
    catalogue: s.catalogue, recommandations: s.recommandations_detail, regles: Ch.champJson(rec, "regles"),
  })
})

// ---------- Rattachement : les chartes « libre » du même email suivent la création du compte ----------
onRecordAfterCreateSuccess((e) => {
  const Ch = require(`${__hooks}/lib/charte.js`)
  try { Ch.rattacher(e.app, e.record) } catch (err) { e.app.logger().warn("Charte IA : rattachement", "error", String(err)) }
  e.next()
}, "users")
