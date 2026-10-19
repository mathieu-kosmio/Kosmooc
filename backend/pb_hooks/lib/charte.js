// Fonctions partagées du générateur de charte IA (docs/EVOLUTION-CHARTE-IA.md).
// Chargées avec require() à l'intérieur de chaque handler (contrainte JSVM PocketBase).
// Les règles de calcul vivent dans backend/charte/moteur.js, partagé avec le navigateur.

const LIMITE_ENVOIS = 10
const FENETRE_MS = 10 * 60 * 1000
const BREVO_SOURCE = "outil-charte-ia"

function charteDir() {
  return $os.getenv("ACADEMIE_CHARTE_DIR") || (__hooks + "/../charte")
}

function lireJson(nom) {
  return JSON.parse(toString($os.readFile(charteDir() + "/" + nom + ".json")))
}

function moteur() {
  return require(charteDir() + "/moteur.js")
}

function referentiel() {
  return { questions: lireJson("questions"), regles: lireJson("regles"), clauses: lireJson("clauses") }
}

function esc(s) {
  return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

// Un champ JSON d'un enregistrement revient en octets (JSONRaw) : on le relit en objet.
function champJson(rec, nom) {
  const v = rec.get(nom)
  try { return JSON.parse(typeof v === "string" ? v : toString(v)) } catch (_) { return null }
}

function texteCourt(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function emailValide(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200
}

// Les cinq règles envoyées par l'apprenant (mode m7) : on ne garde que du texte borné.
function nettoyerRegles(brut, generees) {
  if (!Array.isArray(brut) || brut.length !== generees.length) return generees
  return generees.map((g, i) => ({
    id: g.id,
    titre: g.titre,
    texte: texteCourt(brut[i] && brut[i].texte, 2000) || g.texte,
  }))
}

// Calcule tout ce qui dépend des réponses. Le client n'envoie jamais niveau, score ni palier : seul ce calcul fait foi.
function calculer(brut, extras) {
  const M = moteur()
  const ref = referentiel()
  const val = M.valider(brut, ref.questions)
  if (!val.ok) return { ok: false, erreurs: val.erreurs }
  return { ok: true, reponses: val.reponses, synthese: M.synthese(val.reponses, ref.regles, ref.clauses, extras), ref: ref }
}

function utmDepuis(brut) {
  const u = brut && typeof brut === "object" ? brut : {}
  const parts = []
  ;["utm_source", "utm_medium", "utm_campaign"].forEach((k) => {
    const v = texteCourt(u[k], 60).replace(/[^\w.\-]/g, "")
    if (v) parts.push(k + "=" + v)
  })
  return parts.join("&").slice(0, 250)
}

// Nombre d'enregistrements « libre » créés depuis cette empreinte d'IP dans la fenêtre.
function envoisRecents(app, ipHash) {
  const depuis = new Date(Date.now() - FENETRE_MS).toISOString().replace("T", " ")
  try {
    return app.findRecordsByFilter("chartes", "ip_hash = {:h} && source = 'libre' && created > {:d}", "-created", LIMITE_ENVOIS + 1, 0, { h: ipHash, d: depuis }).length
  } catch (_) {
    return 0
  }
}

function appliquerSynthese(rec, rep, s, regles) {
  rec.set("reponses", rep)
  rec.set("entreprise", rep.entreprise)
  rec.set("maillon", rep.maillon)
  rec.set("effectif", rep.effectif)
  rec.set("niveau_donnees", s.niveau)
  rec.set("score", s.score)
  rec.set("palier", s.palier)
  rec.set("statut", s.statut)
  rec.set("recommandations", s.recommandations)
  rec.set("regles", regles)
}

// ---------- Brevo : contact dans la liste des leads du site (liste 17) ----------
function brevoCle() {
  return String($os.getenv("APP_BREVO_API_KEY") || $os.getenv("BREVO_API") || "").trim()
}

function brevoPost(cle, payload) {
  return $http.send({
    url: "https://api.brevo.com/v3/contacts",
    method: "POST",
    timeout: 15,
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  })
}

// Un échec Brevo n'empêche jamais l'enregistrement ni le téléchargement : on journalise et on continue.
function pousserBrevo(app, rec, rep, s) {
  const cle = brevoCle()
  if (!cle) return false
  try {
    const liste = Number($os.getenv("BREVO_LIST_ID") || 17)
    const complets = {
      FIRSTNAME: rec.get("prenom"), COMPANY: rec.get("entreprise"), SOURCE: BREVO_SOURCE,
      CHARTE_SCORE: s.score, CHARTE_PALIER: s.palier, CHARTE_NIVEAU: s.niveau, MAILLON: rep.maillon,
      NEWSLETTER: rec.get("newsletter") === true,
    }
    let res = brevoPost(cle, { email: rec.get("email"), attributes: complets, listIds: [liste], updateEnabled: true })
    if (res.statusCode === 400) {
      // Attributs pas encore créés chez Brevo : repli sur le strict nécessaire.
      app.logger().warn("Charte IA : attributs Brevo refusés, repli sur FIRSTNAME et SOURCE", "reponse", String(toString(res.body)).slice(0, 200))
      res = brevoPost(cle, { email: rec.get("email"), attributes: { FIRSTNAME: rec.get("prenom"), SOURCE: BREVO_SOURCE }, listIds: [liste], updateEnabled: true })
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return true
    app.logger().warn("Charte IA : Brevo a refusé le contact", "status", res.statusCode)
  } catch (err) {
    app.logger().warn("Charte IA : Brevo injoignable", "error", String(err))
  }
  return false
}

// ---------- Mails ----------
function mailLead(app, A, rec, s) {
  const base = A.appUrl(app)
  const lien = base + "/charte/synthese/?j=" + rec.get("jeton")
  const inscription = base + "/inscription/?source=charte&email=" + encodeURIComponent(rec.get("email")) +
    "&entreprise=" + encodeURIComponent(rec.get("entreprise")) + "&maillon=" + encodeURIComponent(rec.get("maillon") || "")
  const html =
    "<p>Bonjour " + esc(rec.get("prenom")) + ",</p>" +
    "<p>Voici la synthèse de la charte IA de <strong>" + esc(rec.get("entreprise")) + "</strong> : niveau de données " + esc(s.niveau_libelle) +
    ", maturité " + esc(s.palier_libelle) + " (" + s.score + " sur 100).</p>" +
    "<p><a href=\"" + lien + "\">Retrouver ma synthèse et la télécharger en PDF</a></p>" +
    "<p>Pour aller plus loin :</p><ul>" +
    "<li><a href=\"" + inscription + "\">Former votre équipe avec l'Académie PerfIA</a></li>" +
    "<li><a href=\"https://perfia.kosm.io/choix-ia.html\">Choisir vos outils</a></li>" +
    "<li><a href=\"https://cal.com/kosmio/ia-automatisation\">Échanger 30 minutes avec nous</a></li></ul>" +
    "<p>Ce modèle est à adapter et à faire valider par vos soins. Il ne constitue pas un conseil juridique.</p>" +
    "<p>L'équipe PerfIA, Kosmio et Xylofutur</p>"
  return A.sendMail(app, rec.get("email"), "Votre charte IA", html)
}

function mailNotification(app, A, rec, rep, s) {
  const to = $os.getenv("CHARTE_NOTIF_TO") || "mathieu@kosm.io"
  const outils = (s.catalogue || []).map((o) => o.libelle).join(", ") || "aucun déclaré"
  const html =
    "<p>Nouvelle charte IA générée (" + esc(s.statut) + ").</p><ul>" +
    "<li>Entreprise : " + esc(rec.get("entreprise")) + "</li>" +
    "<li>Contact : " + esc(rec.get("prenom")) + ", " + esc(rec.get("fonction")) + ", " + esc(rec.get("email")) + "</li>" +
    "<li>Maillon : " + esc(rep.maillon) + ", effectif " + esc(rep.effectif) + "</li>" +
    "<li>Niveau de données : " + esc(s.niveau_libelle) + "</li>" +
    "<li>Score : " + s.score + " sur 100, palier " + esc(s.palier_libelle) + "</li>" +
    "<li>Outils déclarés : " + esc(outils) + "</li>" +
    "<li>Abonnement aux actualités : " + (rec.get("newsletter") ? "oui" : "non") + "</li></ul>"
  return A.sendMail(app, to, "Charte IA (" + s.statut + ") : " + rec.get("entreprise"), html)
}

// ---------- Rattachement des chartes « libre » à un compte créé ensuite ----------
function rattacher(app, user) {
  const email = String(user.get("email") || "").toLowerCase()
  if (!email) return 0
  const recs = app.findRecordsByFilter("chartes", "email = {:e} && user = ''", "-created", 50, 0, { e: email })
  recs.forEach((r) => { r.set("user", user.id); app.save(r) })
  return recs.length
}

module.exports = {
  LIMITE_ENVOIS, BREVO_SOURCE, referentiel, moteur, esc, champJson, texteCourt, emailValide, nettoyerRegles,
  calculer, utmDepuis, envoisRecents, appliquerSynthese, pousserBrevo, mailLead, mailNotification, rattacher,
}
