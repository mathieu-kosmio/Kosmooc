/// <reference path="../pb_data/types.d.ts" />
// Générateur de charte IA : collection `chartes`.
// Écriture par les routes serveur uniquement (createRule, updateRule, deleteRule = null).
// Voir docs/EVOLUTION-CHARTE-IA.md, section 6.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  // Garde-fou : sans le test sur auth.id, une charte « libre » (user vide) serait lisible par tout le monde,
  // car « user = @request.auth.id » est vrai quand les deux sont vides.
  const LECTURE = '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "evaluateur")'

  const chartes = new Collection({
    type: "base",
    name: "chartes",
    listRule: LECTURE,
    viewRule: LECTURE,
    createRule: null, updateRule: null, deleteRule: null,
  })
  chartes.fields.add(new RelationField({ name: "user", collectionId: users.id, maxSelect: 1, cascadeDelete: false }))
  chartes.fields.add(new SelectField({ name: "source", maxSelect: 1, required: true, values: ["libre", "m7"] }))
  chartes.fields.add(new TextField({ name: "prenom", max: 120 }))
  chartes.fields.add(new TextField({ name: "email", max: 200 }))
  chartes.fields.add(new TextField({ name: "fonction", max: 200 }))
  chartes.fields.add(new TextField({ name: "entreprise", max: 120 }))
  chartes.fields.add(new SelectField({
    name: "maillon", maxSelect: 1,
    values: ["sylviculture", "exploitation", "scierie", "seconde_transformation", "construction", "bureau_etudes", "negoce", "ameublement", "autre"],
  }))
  chartes.fields.add(new SelectField({ name: "effectif", maxSelect: 1, values: ["1-9", "10-49", "50-249", "250+"] }))
  chartes.fields.add(new TextField({ name: "referent", max: 200 }))
  chartes.fields.add(new JSONField({ name: "reponses", maxSize: 20000 }))
  chartes.fields.add(new JSONField({ name: "regles", maxSize: 20000 }))
  chartes.fields.add(new SelectField({ name: "niveau_donnees", maxSelect: 1, values: ["public", "interne", "confidentiel", "secret"] }))
  chartes.fields.add(new NumberField({ name: "score", min: 0, max: 100, onlyInt: true }))
  chartes.fields.add(new SelectField({ name: "palier", maxSelect: 1, values: ["decouverte", "structuration", "pilotage"] }))
  chartes.fields.add(new SelectField({ name: "statut", maxSelect: 1, values: ["chaud", "tiede", "froid"] }))
  chartes.fields.add(new JSONField({ name: "recommandations", maxSize: 5000 }))
  chartes.fields.add(new BoolField({ name: "newsletter" }))
  chartes.fields.add(new TextField({ name: "utm", max: 250 }))
  chartes.fields.add(new TextField({ name: "jeton", max: 32 }))
  // Empreinte de l'adresse IP (jamais l'adresse), pour la limite d'envois.
  chartes.fields.add(new TextField({ name: "ip_hash", max: 64 }))
  chartes.fields.add(new AutodateField({ name: "created", onCreate: true }))
  chartes.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
  chartes.indexes = [
    "CREATE UNIQUE INDEX idx_chartes_jeton ON chartes (jeton)",
    "CREATE INDEX idx_chartes_email ON chartes (email)",
    "CREATE INDEX idx_chartes_user ON chartes (user)",
    "CREATE INDEX idx_chartes_ip ON chartes (ip_hash, created)",
  ]
  app.save(chartes)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("chartes")) } catch (_) {}
})
