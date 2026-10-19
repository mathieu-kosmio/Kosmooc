// Moteur déterministe du générateur de charte IA.
// Une seule source pour deux exécutions : le navigateur (aperçu, par import ?raw) et PocketBase
// (recalcul à l'enregistrement, par require). Aucune dépendance, pas de ?. ni de ??.
// Les règles (regles.json), les questions (questions.json) et les clauses (clauses.json) sont passées en argument.
(function (root, factory) {
  var api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.CharteMoteur = api
})(this, function () {
  'use strict'

  function liste(v) {
    if (Array.isArray(v)) return v
    return v === undefined || v === null || v === '' ? [] : [v]
  }
  function inter(a, b) {
    return liste(a).some(function (x) { return liste(b).indexOf(x) !== -1 })
  }
  function idx(R, niveau) { return R.niveaux.indexOf(niveau) }

  // ---------- Validation et normalisation des réponses ----------
  function valider(brut, Q) {
    var erreurs = []
    var rep = {}
    var src = brut && typeof brut === 'object' ? brut : {}
    Q.questions.forEach(function (q) {
      var v = src[q.cle]
      if (q.type === 'texte') {
        var s = typeof v === 'string' ? v.trim() : ''
        if (s.length > q.max) s = s.slice(0, q.max)
        if (q.requis && !s) erreurs.push(q.cle)
        rep[q.cle] = s
        return
      }
      var valeurs = q.options.map(function (o) { return o.v })
      if (q.type === 'choix') {
        if (valeurs.indexOf(v) === -1) { if (q.requis) erreurs.push(q.cle); rep[q.cle] = '' } else rep[q.cle] = v
        return
      }
      var choisies = liste(v).filter(function (x, i, a) { return valeurs.indexOf(x) !== -1 && a.indexOf(x) === i })
      // Options filtrées par une réponse précédente (ex. : « payés » parmi les outils déclarés).
      if (q.options_depuis) choisies = choisies.filter(function (x) { return liste(rep[q.options_depuis]).indexOf(x) !== -1 })
      var excl = q.exclusives || []
      var exclusive = choisies.filter(function (x) { return excl.indexOf(x) !== -1 })
      if (exclusive.length) choisies = [exclusive[0]]
      if (q.requis && !choisies.length) erreurs.push(q.cle)
      rep[q.cle] = choisies
    })
    return { ok: erreurs.length === 0, erreurs: erreurs, reponses: rep }
  }

  // ---------- Niveau de données (section 5.1) ----------
  // Niveau d'une catégorie de données, escalade comprise (plans sous confidentialité client fréquente : Secret).
  function niveauDonnee(d, rep, R) {
    var l = idx(R, R.niveau_par_donnee[d])
    R.escalade.forEach(function (e) {
      if (e.si.donnees === d && rep.confidentialite === e.si.confidentialite) l = Math.max(l, idx(R, e.niveau))
    })
    return l
  }

  function niveau(rep, R) {
    var n = 0
    liste(rep.donnees).forEach(function (d) { n = Math.max(n, niveauDonnee(d, rep, R)) })
    return R.niveaux[n]
  }

  function donneesDeNiveau(rep, R, niveauCible) {
    return liste(rep.donnees).filter(function (d) { return niveauDonnee(d, rep, R) === idx(R, niveauCible) })
  }

  // ---------- Catalogue d'outils (section 5.2) ----------
  // Un outil professionnel non payé par l'entreprise est traité comme un compte personnel,
  // sauf ceux qui n'existent qu'en offre entreprise (Copilot Microsoft 365).
  function outilsDeclares(rep, R) {
    var payes = liste(rep.payes)
    return liste(rep.outils)
      .filter(function (o) { return R.outils[o] })
      .map(function (o) {
        var cat = R.outils[o]
        var pro = cat === 'pro_hors_ue' || cat === 'pro_ue'
        if (pro && payes.indexOf(o) === -1 && R.toujours_pro.indexOf(o) === -1) cat = 'personnel'
        return { outil: o, libelle: R.libelles_outils[o], categorie: cat }
      })
  }

  function autorisation(categorie, lvl, R) {
    return R.matrice[categorie][lvl]
  }

  function catalogue(rep, R, lvl) {
    return outilsDeclares(rep, R).map(function (o) {
      var parNiveau = {}
      R.niveaux.forEach(function (n) { parNiveau[n] = autorisation(o.categorie, n, R) })
      return { outil: o.outil, libelle: o.libelle, categorie: o.categorie, categorie_libelle: R.categories[o.categorie], niveaux: parNiveau, pour_vos_donnees: parNiveau[lvl] }
    })
  }

  // ---------- Score de maturité (section 5.5) ----------
  function palier(total, R) {
    var p = R.score.paliers[0]
    R.score.paliers.forEach(function (x) { if (total >= x.min) p = x })
    return p
  }

  function score(rep, R, lvl) {
    var S = R.score
    var decl = outilsDeclares(rep, R)
    var aucun = liste(rep.outils).indexOf('aucun') !== -1
    var detail = {}
    detail.pilotage = S.pilotage[rep.pilote] || 0
    var abonnables = decl.filter(function (o) { return o.categorie !== 'integre' })
    if (abonnables.length) {
      var encadres = abonnables.filter(function (o) { return o.categorie !== 'personnel' }).length
      detail.encadrement = Math.round(S.encadrement_max * encadres / abonnables.length)
    } else detail.encadrement = decl.length ? S.encadrement_max : (aucun ? S.encadrement_aucun_outil : 0)
    detail.formation = S.formation[rep.formation] || 0
    if (decl.length) {
      var pts = decl.map(function (o) { return S.adequation[autorisation(o.categorie, lvl, R)] || 0 })
      var a = Math.min.apply(null, pts)
      var expose = decl.some(function (o) { return o.categorie === 'pro_hors_ue' || o.categorie === 'personnel' })
      if (rep.souverainete === 'exigence' && idx(R, lvl) >= idx(R, 'confidentiel') && expose) a = Math.max(0, a - S.penalite_souverainete)
      detail.adequation = a
    } else detail.adequation = aucun ? S.adequation_aucun_outil : 0
    var n = liste(rep.usages).length
    detail.diversite = S.diversite[Math.min(n, S.diversite.length - 1)]
    var total = 0
    S.criteres.forEach(function (c) { total += Math.min(detail[c.id], c.max) })
    var p = palier(total, R)
    return { total: total, detail: detail, palier: p.id, palier_libelle: p.libelle }
  }

  // ---------- Recommandations (section 5.5) ----------
  function recommandations(rep, R, lvl, sc) {
    var decl = outilsDeclares(rep, R)
    var ids = []
    if (rep.formation === 'aucun') ids.push('former')
    if (decl.some(function (o) { return o.categorie === 'personnel' })) ids.push('sortir_comptes')
    if (idx(R, lvl) >= idx(R, 'confidentiel') && decl.some(function (o) { return o.categorie === 'pro_hors_ue' })) ids.push('garder_donnees')
    if (inter(rep.usages, ['devis', 'ao'])) ids.push('cas_processotheque')
    if (sc.palier === 'pilotage') ids.push('deployer')
    return ids.slice(0, 3)
  }

  function detailRecos(ids, R) {
    return ids.map(function (id) {
      var r = R.recommandations[id]
      return { id: id, titre: r.titre, texte: r.texte, lien: r.lien, type: r.type, action: r.action }
    })
  }

  // ---------- Statut commercial (section 9) ----------
  function statut(rep, R, lvl) {
    var decl = outilsDeclares(rep, R)
    var sensible = idx(R, lvl) >= idx(R, 'confidentiel')
    var expose = decl.some(function (o) { return o.categorie === 'pro_hors_ue' || o.categorie === 'personnel' })
    if (sensible && rep.effectif !== '1-9' && expose) return 'chaud'
    if (rep.effectif === '1-9' && !sensible) return 'froid'
    return 'tiede'
  }

  // ---------- Génération du texte ----------
  function contexte(rep, R, lvl) {
    var ctx = {}
    Object.keys(rep).forEach(function (k) { ctx[k] = rep[k] })
    ctx.niveau = lvl
    var decl = outilsDeclares(rep, R)
    ctx.categories = decl.map(function (o) { return o.categorie })
    // Données Confidentielles ou plus, et aucun outil déclaré ne peut les recevoir, même anonymisées :
    // la charte suspend alors les usages qui en ont besoin au lieu de les autoriser.
    ctx.donnees_secret = donneesDeNiveau(rep, R, 'secret').length > 0
    ctx.donnees_confidentiel = donneesDeNiveau(rep, R, 'confidentiel').length > 0
    ctx.outils_insuffisants = decl.length > 0 && idx(R, lvl) >= idx(R, 'confidentiel') &&
      !decl.some(function (o) { return R.matrice[o.categorie].confidentiel !== 'non' })
    return ctx
  }

  function correspond(cond, ctx) {
    if (!cond) return true
    return Object.keys(cond).every(function (k) { return inter(ctx[k], cond[k]) })
  }

  // Libellés courts : « a, b et c ». Libellés qui contiennent déjà « et » : « a, b ainsi que c ».
  function enListe(items, liaison) {
    if (!items.length) return ''
    if (items.length === 1) return items[0]
    return items.slice(0, -1).join(', ') + (liaison || ' ainsi que ') + items[items.length - 1]
  }

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  function moisAnnee(d) { return MOIS[d.getMonth()] + ' ' + d.getFullYear() }
  function dateLongue(d) { return d.getDate() + (d.getDate() === 1 ? 'er ' : ' ') + moisAnnee(d) }

  function variables(rep, R, lvl, extras) {
    var now = extras && extras.date ? new Date(extras.date.getTime()) : new Date()
    var revue = new Date(now.getTime())
    revue.setFullYear(revue.getFullYear() + 1)
    var referent = String(rep.referent || (extras && extras.referent) || '').trim()
    var usages = liste(rep.usages)
    var conf = donneesDeNiveau(rep, R, 'confidentiel')
    var secret = donneesDeNiveau(rep, R, 'secret')
    var ref = referent || 'la personne désignée par la direction'
    return {
      entreprise: rep.entreprise || 'l\'entreprise',
      referent: ref,
      date_entree: dateLongue(now),
      date_revue: moisAnnee(revue),
      outils_personnels: enListe(outilsDeclares(rep, R).filter(function (o) { return o.categorie === 'personnel' }).map(function (o) { return o.libelle }), ' et '),
      niveau_libelle: R.libelles_niveaux[lvl],
      maillon_libelle: R.libelles_maillons[rep.maillon] || '',
      usages_liste: usages.length ? enListe(usages.slice(0, 4).map(function (u) { return R.libelles_usages_courts[u] }), ' et ') : 'les usages que ' + ref + ' aura validés',
      donnees_conf_liste: enListe(conf.map(function (d) { return R.libelles_donnees[d] })),
      donnees_secret_liste: enListe(secret.map(function (d) { return R.libelles_donnees[d] })),
    }
  }

  // Remplace les {{variables}} ; une valeur placée en début de phrase prend une majuscule.
  function remplir(texte, vars) {
    return texte.replace(/\{\{(\w+)\}\}/g, function (m, k, pos, tout) {
      if (vars[k] === undefined) return m
      var v = String(vars[k])
      var debut = pos === 0 || /[.!?]\s+$/.test(tout.slice(0, pos)) || tout.charAt(pos - 1) === '\n'
      return debut ? v.charAt(0).toUpperCase() + v.slice(1) : v
    })
  }

  function texteClause(c, ton) {
    var t = c.texte
    if (typeof t === 'string') return t
    return t[ton] || t.prudent
  }

  // Clauses retenues pour une section : celles dont la condition est remplie ; les clauses « defaut »
  // ne servent que si aucune autre n'est retenue.
  // `limite` borne le nombre de clauses retenues (dans l'ordre du fichier, donc par priorité) pour garder les règles courtes.
  function clausesSection(section, C, ctx, ton, vars, limite) {
    var toutes = C.clauses.filter(function (c) { return c.section === section })
    var normales = toutes.filter(function (c) { return !c.defaut && correspond(c.condition, ctx) })
    if (limite) normales = normales.slice(0, limite)
    var retenues = normales.length ? normales : toutes.filter(function (c) { return c.defaut })
    return retenues.map(function (c) { return { id: c.id, texte: remplir(texteClause(c, ton), vars) } })
  }

  function cinqRegles(rep, R, C, lvl, extras) {
    var ctx = contexte(rep, R, lvl)
    var vars = variables(rep, R, lvl, extras)
    var ton = rep.ton || 'prudent'
    return R.titres_regles.map(function (titre, i) {
      var id = 'regle' + (i + 1)
      var cl = clausesSection(id, C, ctx, ton, vars, (R.limites || {})[id])
      return { id: 'regle' + (i + 1), titre: titre, texte: cl.map(function (c) { return c.texte }).join(' ') }
    })
  }

  function tableauCatalogue(rep, R, lvl) {
    var cat = catalogue(rep, R, lvl)
    var entetes = ['Outil', 'Catégorie'].concat(R.niveaux.map(function (n) { return R.libelles_niveaux[n] }))
    var lignes
    if (cat.length) {
      lignes = cat.map(function (o) {
        return [o.libelle, o.categorie_libelle].concat(R.niveaux.map(function (n) { return R.libelles_autorisation[o.niveaux[n]] }))
      })
    } else {
      lignes = ['pro_ue', 'prive'].map(function (c) {
        return [R.categories[c], 'Proposé'].concat(R.niveaux.map(function (n) { return R.libelles_autorisation[R.matrice[c][n]] }))
      })
    }
    return { entetes: entetes, lignes: lignes }
  }

  function tableauMatrice(R) {
    var entetes = ['Catégorie d\'outil'].concat(R.niveaux.map(function (n) { return R.libelles_niveaux[n] }))
    var lignes = Object.keys(R.categories).map(function (c) {
      return [R.categories[c]].concat(R.niveaux.map(function (n) { return R.libelles_autorisation[R.matrice[c][n]] }))
    })
    return { entetes: entetes, lignes: lignes }
  }

  function chartesComplete(rep, R, C, lvl, extras) {
    var ctx = contexte(rep, R, lvl)
    var vars = variables(rep, R, lvl, extras)
    var ton = rep.ton || 'prudent'
    var ordre = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'A', 'B']
    return ordre.map(function (id) {
      var s = { id: id, titre: (/^[0-9]+$/.test(id) ? id + '. ' : '') + R.titres_sections[id], clauses: clausesSection(id, C, ctx, ton, vars) }
      if (id === '6') s.tableau = { entetes: ['Niveau', 'Exemples', 'Règle'], lignes: R.classification }
      if (id === '7') s.tableau = tableauCatalogue(rep, R, lvl)
      if (id === 'A') s.tableau = tableauMatrice(R)
      return s
    })
  }

  // ---------- Point d'entrée : tout ce qui se calcule à partir des réponses ----------
  function synthese(rep, R, C, extras) {
    var lvl = niveau(rep, R)
    var sc = score(rep, R, lvl)
    var ids = recommandations(rep, R, lvl, sc)
    var faiblesses = R.score.criteres
      .filter(function (c) { return sc.detail[c.id] < c.max / 2 && R.score.explications[c.id] })
      .map(function (c) { return { id: c.id, libelle: c.libelle, texte: R.score.explications[c.id] } })
    return {
      niveau_explication: R.explications_niveaux[lvl],
      faiblesses: faiblesses,
      outils_insuffisants: contexte(rep, R, lvl).outils_insuffisants,
      niveau: lvl,
      niveau_libelle: R.libelles_niveaux[lvl],
      score: sc.total,
      detail: sc.detail,
      palier: sc.palier,
      palier_libelle: sc.palier_libelle,
      recommandations: ids,
      recommandations_detail: detailRecos(ids, R),
      statut: statut(rep, R, lvl),
      catalogue: catalogue(rep, R, lvl),
      regles: cinqRegles(rep, R, C, lvl, extras),
    }
  }

  return {
    valider: valider, niveau: niveau, score: score, recommandations: recommandations, statut: statut,
    catalogue: catalogue, synthese: synthese, cinqRegles: cinqRegles, chartesComplete: chartesComplete, detailRecos: detailRecos,
  }
})
