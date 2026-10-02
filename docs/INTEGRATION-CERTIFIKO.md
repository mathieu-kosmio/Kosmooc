# Intégration Certifiko : SSO et évaluation

L'Académie fonctionne sans Certifiko. Les deux branchements ci-dessous s'activent par configuration, sans modifier le code. À aligner avec le montage SSO de Florigin.

## 1. SSO (OpenID Connect)

PocketBase gère nativement les fournisseurs OAuth2, dont un fournisseur OIDC générique.

1. Dans Certifiko (ou le fournisseur d'identité commun Kosmio), créer un client OIDC :
   - URL de redirection : `https://<academie>/api/oauth2-redirect`
   - scopes : `openid email profile`
2. Dans l'admin PocketBase (`/_/`), collection `users`, onglet Options, OAuth2 : activer « OpenID Connect », renseigner client id, secret, URL d'autorisation, de jeton et userinfo, et le nom affiché « Certifiko ».
3. Le bouton « Continuer avec Certifiko » apparaît alors sur les pages d'inscription et de connexion (lecture de `listAuthMethods`).
4. Mapping : email et nom viennent du fournisseur ; l'apprenant complète entreprise et maillon dans son profil (à ajouter si besoin dans `/parcours/`).

Point à vérifier dans le dépôt Florigin : Certifiko est-il lui-même fournisseur d'identité, ou les deux applications délèguent-elles à un fournisseur commun ? Dans le second cas, on branche l'Académie sur ce même fournisseur.

## 2. Évaluation du projet final dans Certifiko

### Envoi (Académie vers Certifiko)

Activé si la variable `CERTIFIKO_WEBHOOK_URL` est définie. À chaque dépôt de projet final, l'Académie envoie :

```http
POST $CERTIFIKO_WEBHOOK_URL
Authorization: Bearer $CERTIFIKO_TOKEN
Content-Type: application/json

{
  "source": "perfia-academie",
  "referentiel": "perfia-n1",
  "submission_id": "abc123",
  "module": "m9",
  "candidat": { "id": "…", "email": "…", "nom": "…", "entreprise": "…" },
  "fichiers": ["projet_final_x1y2.pdf"],
  "lien": "https://…",
  "commentaire": "…",
  "callback_url": "https://<academie>/api/academie/certifiko/callback"
}
```

Réponse attendue `2xx` avec `{ "id": "<référence Certifiko>" }`. Le dépôt passe en « en évaluation » et garde la référence.

Les fichiers sont protégés : Certifiko les récupère avec un jeton de fichier émis pour un compte évaluateur technique (à créer), ou l'Académie les joint en base64 dans une version suivante.

### Retour (Certifiko vers Académie)

```http
POST https://<academie>/api/academie/certifiko/callback
x-certifiko-secret: $CERTIFIKO_CALLBACK_SECRET
Content-Type: application/json

{
  "submission_id": "abc123",
  "decision": "valide",
  "criteres": { "C1": { "acquis": true, "commentaire": "" }, "C2": { "acquis": true } },
  "commentaire": "Retour global à l'apprenant"
}
```

L'Académie crée l'évaluation (source « certifiko »), met à jour le dépôt et émet le badge selon les mêmes règles qu'une évaluation interne.

### Côté Certifiko

Créer le référentiel `perfia-n1` avec les 6 critères C1 à C6 (preuves et critères dans `SPEC.md` et `docs/FORMAT-CONTENU.md`). Le statut VÉRIFIÉ correspond à `valide`, PARTIEL et INSUFFISANT à `a_reprendre`.

## 3. Variables d'environnement

| Variable | Rôle |
|---|---|
| `ACADEMIE_URL` | URL publique, utilisée dans les emails et le callback |
| `ACADEMIE_QUIZ_DIR` | Dossier des quiz (défini dans l'image Docker) |
| `CERTIFIKO_WEBHOOK_URL` | Active l'envoi des projets finaux |
| `CERTIFIKO_TOKEN` | Jeton d'appel de Certifiko |
| `CERTIFIKO_CALLBACK_SECRET` | Secret attendu sur le retour d'évaluation |
