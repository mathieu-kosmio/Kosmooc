/// <reference path="../pb_data/types.d.ts" />
// Deux parcours (« Les bases de l'IA » et « Mettre en place l'IA ») : l'ancien module 7 est découpé
// en m7 (fiabilité), m11 (AI Act en pratique) et m12 (charte IA). Les apprenants qui avaient terminé
// l'ancien m7 avaient déjà écrit leur charte : m12 leur est acquis. m11 reste à suivre (contenu nouveau).

migrate((app) => {
  const faits = app.findRecordsByFilter("progress", "module = 'm7' && statut = 'termine'", "", 0, 0)
  const col = app.findCollectionByNameOrId("progress")
  for (const p of faits) {
    try {
      app.findFirstRecordByFilter("progress", "user = {:u} && module = 'm12'", { u: p.get("user") })
      continue
    } catch (_) {}
    const r = new Record(col)
    r.set("user", p.get("user"))
    r.set("module", "m12")
    r.set("statut", "termine")
    app.save(r)
  }
}, (app) => {
  // Pas de retour arrière sur la progression : les enregistrements m12 restent valables.
})
