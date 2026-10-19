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
      var excl = q.exclusives || []
      var exclusive = choisies.filter(function (x) { return excl.indexOf(x) !== -1 })
      if (exclusive.length) choisies = [exclusive[0]]
      if (q.requis && !choisies.length) erreurs.push(q.cle)
      rep[q.cle] = choisies
    })
    return { ok: erreurs.length === 0, erreurs: erreurs, reponses: rep }
  }

  // ---------- Niveau de données (section 5.1) ----------
  function niveau(rep, R) {
    var n = 0
    liste(rep.donnees).forEach(function (d) {
      var l = idx(R, R.niveau_par_donnee[d])
      if (l > n) n = l
    })
    R.escalade.forEach(function (e) {
      if (liste(rep.donnees).indexOf(e.si.donnees) !== -1 && rep.confidentialite === e.si.confidentialite) {
        n = Math.max(n, idx(R, e.niveau))
      }
    })
    return R.niveaux[n]
  }

  // ---------- Catalogue d'outils (section 5.2) ----------
  function outilsDeclares(rep, R) {
    var nonEncadre = R.cadre_non_encadre.indexOf(rep.cadre) !== -1
    return liste(rep.outils)
      .filter(function (o) { return R.outils[o] })
      .map(function (o) {
        var cat = R.outils[o]
        if ((cat === 'pro_hors_ue' || cat === 'pro_ue') && nonEncadre) cat = 'personnel'
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
    detail.encadrement = decl.length ? (S.encadrement[rep.cadre] || 0) : (aucun ? S.encadrement_aucun_outil : 0)
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
    if (R.cadre_non_encadre.indexOf(rep.cadre) !== -1 && decl.length) ids.push('sortir_comptes')
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
    ctx.categories = outilsDeclares(rep, R).map(function (o) { return o.categorie })
    return ctx
  }

  function correspond(cond, ctx) {
    if (!cond) return true
    return Object.keys(cond).every(function (k) { return inter(ctx[k], cond[k]) })
  }

  function enListe(items) {
    if (!items.length) return ''
    if (items.length === 1) return items[0]
    return items.slice(0, -1).join(', ') + ' ainsi que ' + items[items.length - 1]
  }

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  function moisAnnee(d) { return MOIS[d.getMonth()] + ' ' + d.getFullYear() }
  function dateLongue(d) { return d.getDate() + (d.getDate() === 1 ? 'er ' : ' ') + moisAnnee(d) }

  function variables(rep, R, lvl, extras) {
    var now = extras && extras.date ? new Date(extras.date.getTime()) : new Date()
    var revue = new Date(now.getTime())
    revue.setFullYear(revue.getFullYear() + 1)
    var referent = extras && extras.referent ? String(extras.referent).trim() : ''
    var usages = liste(rep.usages)
    var conf = liste(rep.donnees).filter(function (d) { return ['plans', 'devis', 'clients'].indexOf(d) !== -1 })
    var secret = liste(rep.donnees).filter(function (d) { return ['rh', 'procedes'].indexOf(d) !== -1 })
    var ref = referent || 'la personne désignée par la direction'
    return {
      entreprise: rep.entreprise || 'l\'entreprise',
      referent: ref,
      date_entree: dateLongue(now),
      date_revue: moisAnnee(revue),
      niveau_libelle: R.libelles_niveaux[lvl],
      maillon_libelle: R.libelles_maillons[rep.maillon] || '',
      usages_liste: usages.length ? enListe(usages.slice(0, 4).map(function (u) { return R.libelles_usages[u] })) : 'les usages que ' + ref + ' aura validés',
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
  function clausesSection(section, C, ctx, ton, vars) {
    var toutes = C.clauses.filter(function (c) { return c.section === section })
    var normales = toutes.filter(function (c) { return !c.defaut && correspond(c.condition, ctx) })
    var retenues = normales.length ? normales : toutes.filter(function (c) { return c.defaut })
    return retenues.map(function (c) { return { id: c.id, texte: remplir(texteClause(c, ton), vars) } })
  }

  function cinqRegles(rep, R, C, lvl, extras) {
    var ctx = contexte(rep, R, lvl)
    var vars = variables(rep, R, lvl, extras)
    var ton = rep.ton || 'prudent'
    return R.titres_regles.map(function (titre, i) {
      var cl = clausesSection('regle' + (i + 1), C, ctx, ton, vars)
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
    return {
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
