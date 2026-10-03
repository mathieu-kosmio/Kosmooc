# Spécification : Académie PerfIA (Parcours IA filière bois, Niveau 1)

Version 1.0 · 3 octobre 2026 · Kosmio × Xylofutur

## 1. Objet

Plateforme légère de formation en ligne pour le Niveau 1 du Parcours IA filière bois : inscription, parcours de 10 modules (texte, vidéos, ressources téléchargeables, exercices, quiz), suivi de progression, dépôt d'un projet final, évaluation sur 6 compétences et émission d'un badge vérifiable. Elle prépare l'entrée vers le Niveau 2 (déploiement souverain en intra).

Modèle de référence : l'Académie du Numérique Responsable (parcours modulaire, quiz, attestation).

## 2. Choix techniques

| Sujet | Choix | Raison |
|---|---|---|
| Back-end | PocketBase 0.30 (binaire Go + SQLite) | Comptes, fichiers, règles d'accès, admin, OAuth2/OIDC inclus ; un seul binaire ; sobre et auto-hébergé |
| Front | Astro 7 en statique, servi par PocketBase (`pb_public`) | Pages légères, contenu en Markdown, même origine que l'API |
| Contenu | Fichiers dans Git (`web/src/content`, `backend/quiz`, `contenus/scripts`) | Production par agents en propositions de modification relues ; historique |
| Quiz | Corrigés côté serveur (`/api/academie/quiz/{module}`) | Les bonnes réponses ne quittent jamais le serveur |
| Déploiement | Un conteneur Docker sur Coolify, volume `/pb/pb_data` | Cohérent avec l'infrastructure Kosmio |
| Évaluation | Interne (espace évaluateur), avec envoi optionnel à Certifiko | Le pilote ne dépend pas de Certifiko ; branchement par variables d'environnement |
| SSO | Fournisseur OIDC configuré dans PocketBase (Certifiko ou fournisseur d'identité commun) | Bouton affiché automatiquement dès qu'un fournisseur est actif |

## 3. Rôles

- **Visiteur** : accueil, programme, modules 0 et 1 en lecture, vérification d'un badge.
- **Apprenant** : tous les modules, quiz, exercices, progression, projet final, badge.
- **Évaluateur** (attribué uniquement par un superuser) : indicateurs, dépôts, évaluation C1 à C6.
- **Superuser** : administration PocketBase (`/_/`), paramètres SMTP, OAuth2, rôles.

## 4. Modèle de données

| Collection | Champs principaux | Écriture |
|---|---|---|
| `users` (auth) | name, email, entreprise, fonction, maillon, cas_fil_rouge, role (apprenant, evaluateur), consentement | Inscription publique ; le rôle évaluateur est interdit à l'apprenant |
| `progress` | user, module, statut (en_cours, termine) ; unique (user, module) | Apprenant pour lui-même ; « terminé » refusé si le quiz du module n'est pas réussi |
| `quiz_attempts` | user, module, score, total, reussi, reponses | Serveur uniquement |
| `submissions` | user, module, type (exercice, projet_final), fichiers (protégés), lien, commentaire, statut, certifiko_ref | Création par l'apprenant (statut forcé à « déposé ») ; mise à jour par l'évaluateur |
| `evaluations` | submission, evaluateur, criteres (C1 à C6), decision (valide, a_reprendre), commentaire, source | Évaluateur ou retour Certifiko |
| `badges` | user, code, intitule, titulaire, entreprise, emis_le, expire_le, evaluation, competences | Serveur uniquement ; consultable par son identifiant, liste fermée |

## 5. Règles métier

1. Un module avec quiz n'est « terminé » qu'après une tentative réussie (seuil du fichier quiz : 80 % pour M1, 60 % sinon).
2. Le projet final est déposé après M9 ; un seul dépôt en attente à la fois ; nouveau dépôt possible si « à reprendre ».
3. Pour valider un projet final, l'évaluateur coche les 6 compétences (l'interface l'impose) ; C1 est pré-cochée si le quiz M1 est réussi.
4. Le badge `perfia-n1` est émis automatiquement à la validation d'un projet final si le quiz M1 est réussi ; validité 24 mois ; un badge par personne.
5. Emails (si SMTP configuré) : bienvenue, badge émis, dépôt à reprendre.

## 6. API spécifique

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/academie/quiz/{module}` | Public | Questions sans réponses |
| POST | `/api/academie/quiz/{module}` | Apprenant | Correction, enregistrement, explications |
| GET | `/api/academie/stats` | Évaluateur | Inscrits, dépôts, badges, progression et quiz par module |
| POST | `/api/academie/certifiko/callback` | Secret partagé | Retour d'évaluation Certifiko |

## 7. Pages

`/` accueil · `/programme/` · `/inscription/` · `/connexion/` · `/modules/m0/` à `/modules/m9/` · `/fiches/m0/` à `/fiches/m9/` (imprimables) · `/parcours/` · `/projet-final/` · `/evaluation/` · `/badge/?id=` · `/confidentialite/`

## 8. Critères d'acceptation (tous vérifiés par les tests)

- [x] Inscription, connexion, réinitialisation du mot de passe
- [x] Un apprenant ne peut pas devenir évaluateur
- [x] Modules 0 et 1 lisibles sans compte, les autres demandent un compte
- [x] Quiz sans réponses côté client, correction serveur, explications après réponse
- [x] Module non terminable sans quiz réussi
- [x] Dépôt d'exercice et de projet final avec fichiers protégés
- [x] Évaluation C1 à C6, décision, retour visible par l'apprenant
- [x] Badge émis automatiquement, vérifiable publiquement par son lien, partage LinkedIn
- [x] Indicateurs de suivi pour l'évaluateur

## 9. Limites connues et suite

- Le contenu des modules 2 à 9 est masqué côté navigateur pour les visiteurs ; il reste dans le HTML statique. Suffisant pour un pilote gratuit ; à servir depuis l'API si le N1 devient payant.
- Badge au format PocketBase + page de vérification ; export Open Badges 3.0 à ajouter (ou émission par Certifiko).
- Paiement, comptes entreprise (un dirigeant suit ses salariés), tuteur IA et rapport « votre cas déployé chez vous » : lots S2 à S4 de la feuille de route.
- Vidéos : 20 vidéos en motion design (voix de synthèse, personnage illustré), servies depuis `web/public/videos/` avec sous-titres VTT et vignette. Remplaçables par un avatar filmé en V2 sans changer la plateforme.
