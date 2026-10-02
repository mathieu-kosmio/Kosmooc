/// <reference path="../pb_data/types.d.ts" />
// Académie PerfIA : schéma initial.
// Comptes (users étendu), progression, tentatives de quiz, dépôts, évaluations, badges.

migrate((app) => {
  const EVAL = '@request.auth.role = "evaluateur"'

  // ---------- users ----------
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new TextField({ name: "entreprise", max: 200 }))
  users.fields.add(new TextField({ name: "fonction", max: 200 }))
  users.fields.add(new SelectField({
    name: "maillon", maxSelect: 1,
    values: ["sylviculture", "exploitation", "scierie", "seconde_transformation", "construction", "bureau_etudes", "negoce", "ameublement", "autre"],
  }))
  users.fields.add(new TextField({ name: "cas_fil_rouge", max: 300 }))
  users.fields.add(new SelectField({ name: "role", maxSelect: 1, values: ["apprenant", "evaluateur"] }))
  users.fields.add(new BoolField({ name: "consentement" }))
  // Un apprenant ne peut jamais s'attribuer le rôle d'évaluateur.
  users.createRule = '@request.body.role:isset = false || @request.body.role = "apprenant"'
  users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false'
  users.listRule = 'id = @request.auth.id || ' + EVAL
  users.viewRule = 'id = @request.auth.id || ' + EVAL
  app.save(users)

  const mk = (def) => {
    const fields = def.fields || []
    delete def.fields
    const c = new Collection(def)
    for (const f of fields) c.fields.add(f)
    app.save(c)
    return c
  }
  const stamps = () => [
    new AutodateField({ name: "created", onCreate: true }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
  ]
  const userRel = () => new RelationField({ name: "user", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true })

  // ---------- progress ----------
  const progress = mk({
    type: "base",
    name: "progress",
    listRule: 'user = @request.auth.id || ' + EVAL,
    viewRule: 'user = @request.auth.id || ' + EVAL,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: null,
    fields: [
      userRel(),
      new TextField({ name: "module", required: true, max: 10, pattern: "^m[0-9]+$" }),
      new SelectField({ name: "statut", maxSelect: 1, required: true, values: ["en_cours", "termine"] }),
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_progress_user_module ON progress (user, module)"],
  })

  // ---------- quiz_attempts (écrites uniquement par le serveur) ----------
  const attempts = mk({
    type: "base",
    name: "quiz_attempts",
    listRule: 'user = @request.auth.id || ' + EVAL,
    viewRule: 'user = @request.auth.id || ' + EVAL,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      userRel(),
      new TextField({ name: "module", required: true, max: 10 }),
      new NumberField({ name: "score", min: 0 }),
      new NumberField({ name: "total", min: 0 }),
      new BoolField({ name: "reussi" }),
      new JSONField({ name: "reponses", maxSize: 20000 }),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX idx_attempts_user_module ON quiz_attempts (user, module)"],
  })

  // ---------- submissions ----------
  const submissions = mk({
    type: "base",
    name: "submissions",
    listRule: 'user = @request.auth.id || ' + EVAL,
    viewRule: 'user = @request.auth.id || ' + EVAL,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id && (@request.body.statut:isset = false || @request.body.statut = "depose")',
    updateRule: EVAL,
    deleteRule: null,
    fields: [
      userRel(),
      new TextField({ name: "module", required: true, max: 10 }),
      new SelectField({ name: "type", maxSelect: 1, required: true, values: ["exercice", "projet_final"] }),
      new FileField({
        name: "fichiers", maxSelect: 10, maxSize: 20 * 1024 * 1024, protected: true,
        mimeTypes: [],
      }),
      new URLField({ name: "lien" }),
      new TextField({ name: "commentaire", max: 5000 }),
      new SelectField({ name: "statut", maxSelect: 1, values: ["depose", "en_evaluation", "valide", "a_reprendre"] }),
      new TextField({ name: "certifiko_ref", max: 200 }),
      ...stamps(),
    ],
  })

  // ---------- evaluations ----------
  const evaluations = mk({
    type: "base",
    name: "evaluations",
    listRule: EVAL + ' || submission.user = @request.auth.id',
    viewRule: EVAL + ' || submission.user = @request.auth.id',
    createRule: EVAL,
    updateRule: EVAL,
    deleteRule: null,
    fields: [
      new RelationField({ name: "submission", collectionId: submissions.id, maxSelect: 1, required: true, cascadeDelete: true }),
      new RelationField({ name: "evaluateur", collectionId: users.id, maxSelect: 1 }),
      new JSONField({ name: "criteres", maxSize: 20000 }),
      new SelectField({ name: "decision", maxSelect: 1, required: true, values: ["valide", "a_reprendre"] }),
      new TextField({ name: "commentaire", max: 5000 }),
      new SelectField({ name: "source", maxSelect: 1, values: ["academie", "certifiko"] }),
      ...stamps(),
    ],
  })

  // ---------- badges (émis uniquement par le serveur, vérifiables publiquement) ----------
  const badges = mk({
    type: "base",
    name: "badges",
    listRule: 'user = @request.auth.id || ' + EVAL,
    viewRule: "",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      userRel(),
      new TextField({ name: "code", required: true, max: 50 }),
      new TextField({ name: "intitule", required: true, max: 300 }),
      new TextField({ name: "titulaire", max: 200 }),
      new TextField({ name: "entreprise", max: 200 }),
      new DateField({ name: "emis_le" }),
      new DateField({ name: "expire_le" }),
      new RelationField({ name: "evaluation", collectionId: evaluations.id, maxSelect: 1 }),
      new JSONField({ name: "competences", maxSize: 5000 }),
      new TextField({ name: "certifiko_ref", max: 200 }),
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_badges_user_code ON badges (user, code)"],
  })
}, (app) => {
  for (const name of ["badges", "evaluations", "submissions", "quiz_attempts", "progress"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (_) {}
  }
  const users = app.findCollectionByNameOrId("users")
  for (const f of ["entreprise", "fonction", "maillon", "cas_fil_rouge", "role", "consentement"]) users.fields.removeByName(f)
  app.save(users)
})
