# Évolution : générateur de charte IA (outil d'acquisition)

Version 0.1 · 19 octobre 2026 · Kosmio × Xylofutur · statut : à valider par Mathieu

## 1. Objet

Ajouter à Kosmooc un générateur de charte IA, utilisable de deux façons :

- **en accès libre** depuis le menu « Outils » de perfia.kosm.io : un dirigeant obtient en 5 minutes la charte IA de son entreprise en échange de son email ;
- **comme activité du module 7** de l'Académie (« Utiliser l'IA de façon fiable »), dont l'exercice demande déjà de rédiger la charte IA en cinq règles.

L'outil est la première marche du parcours de conversion : charte IA → Académie PerfIA → prestation de formation → accompagnement au déploiement → déploiement du harnais souverain.

Périmètre de ce document : **lot 1** (générateur, capture de lead, intégration au M7 et au site). Le **lot 2** (charte co-construite avec les salariés) est cadré en section 12 et rejoint le lot « comptes entreprise » de `SPEC.md` § 9.

## 2. Existant réutilisé

| Brique existante | Emplacement | Usage dans l'évolution |
|---|---|---|
| Template de charte complète (11 sections, classification des données à 4 niveaux, catalogue d'outils) | `112-PerfIA-Bois/11_Charte-IA-Interne/Template_Charte-IA-Interne_v1.md` | Source des clauses de la charte complète (.docx) |
| Charte en cinq règles | `web/src/content/modules/m7.md`, section « La charte IA en cinq règles » | Structure de la charte courte affichée à l'écran et dans la synthèse |
| Génération .docx dans le navigateur | `web/src/widgets/docx.js` | Génération de la charte complète, sans service serveur |
| Activités interactives | `web/src/widgets/index.js` (`data-widget`) | Nouveau widget `charte`, monté en page libre et dans le M7 |
| Pages « Télécharger en PDF » | `web/src/pages/fiches/[id].astro` (`window.print()`, classe `no-print`) | Synthèse téléchargeable en PDF |
| Quiz corrigés côté serveur (JSON dans `backend/quiz/`) | `backend/pb_hooks/lib/academie.js` | Même modèle : règles dans `backend/charte/`, recalcul côté serveur |
| Envoi des mails par Brevo | `backend/pb_hooks/mail.pb.js` (`APP_BREVO_API_KEY`) | Mail de restitution et notification interne |
| Liste de leads Brevo du site (liste 17, attribut `SOURCE`) | `07_Web/site-public/server.js` | Mêmes conventions : liste 17, `SOURCE = outil-charte-ia` |
| Champ `maillon` des comptes | migration `1759400000_academie_init.js` | Mêmes valeurs pour la question « activité » |

## 3. Parcours utilisateur

### 3.1 Accès libre (lead magnet)

1. Le visiteur arrive sur `https://mooc-ia.kosm.io/charte/` depuis le menu « Outils » du site PerfIA (paramètres `utm_*` conservés).
2. Il répond à 12 questions en 3 écrans (organisation, outils et usages, données), avec une barre de progression. Aucune donnée n'est envoyée au serveur pendant cette étape.
3. Il voit l'aperçu : sa charte en cinq règles complète, son niveau de données, son score de maturité. Le détail de la charte complète et les recommandations sont masqués.
4. Il saisit prénom, email professionnel, fonction, nom du référent IA (facultatif), et coche ou non l'abonnement aux actualités PerfIA.
5. L'envoi crée l'enregistrement `chartes` côté serveur, puis la page :
   - télécharge la charte complète en .docx (générée dans le navigateur) ;
   - affiche la synthèse (score, palier, catalogue d'outils classés, 3 recommandations) avec un bouton « Télécharger en PDF » ;
   - propose trois suites : « Former votre équipe avec l'Académie » (inscription pré-remplie), « Choisir vos outils » (choix-ia), « Échanger 30 minutes » (cal.com).
6. Il reçoit un mail récapitulatif avec le lien de sa synthèse.

### 3.2 Dans le module 7

1. L'apprenant connecté fait les étapes 1 à 3 de l'exercice comme aujourd'hui.
2. À l'étape 4, le widget `charte` en mode `m7` s'ouvre avec les champs du profil déjà remplis (entreprise, maillon). Il propose les cinq règles comme point de départ, que l'apprenant réécrit avec ses mots dans des champs modifiables.
3. La charte est enregistrée dans `chartes` (rattachée au compte, `source = m7`). L'apprenant peut la télécharger en .docx et la joindre comme exercice du M7 (dépôt `submissions` existant).
4. Pas de formulaire de lead : le compte existe déjà.

## 4. Questionnaire

| # | Question | Type | Réponses | Clé |
|---|---|---|---|---|
| Q1 | Nom de l'entreprise | Texte (120 car.) | Libre | `entreprise` |
| Q2 | Votre maillon de la filière | Choix unique | Valeurs de `users.maillon` (sylviculture, exploitation, scierie, seconde transformation, construction, bureau d'études, négoce, ameublement, autre) | `maillon` |
| Q3 | Effectif | Choix unique | 1 à 9, 10 à 49, 50 à 249, 250 et plus | `effectif` |
| Q4 | Qui pilote le numérique ? | Choix unique | Le dirigeant, un responsable interne, un prestataire, personne | `pilote` |
| Q5 | Outils d'IA utilisés aujourd'hui | Choix multiple | ChatGPT, Copilot Microsoft 365, Gemini, Claude, Mistral Le Chat, IA intégrée à un logiciel métier, aucun, je ne sais pas | `outils` |
| Q6 | Ces outils sont-ils payés par l'entreprise ? | Choix unique | Oui tous, en partie, non (comptes personnels), je ne sais pas | `cadre` |
| Q7 | Pour quoi faire ? | Choix multiple | Rédaction et mails, devis et chiffrage, lecture de plans et documents techniques, appels d'offres, commercial et marketing, RH et recrutement, analyse de données | `usages` |
| Q8 | Combien de salariés sont formés à l'IA ? | Choix unique | Aucun, quelques-uns, la moitié ou plus | `formation` |
| Q9 | Quelles données pourraient passer dans un outil d'IA ? | Choix multiple | Plans et notes de calcul, devis et prix, données clients, données RH, données fournisseurs et traçabilité, procédés et savoir-faire, aucune donnée sensible | `donnees` |
| Q10 | Vos clients imposent-ils une confidentialité contractuelle ? | Choix unique | Oui souvent, parfois, non | `confidentialite` |
| Q11 | Vos données doivent-elles rester hébergées en France ou en Europe ? | Choix unique | Oui c'est une exigence, ce serait préférable, indifférent | `souverainete` |
| Q12 | Quel ton pour la charte ? | Choix unique | Encourageant, prudent, strict | `ton` |

Les libellés et les valeurs vivent dans `backend/charte/questions.json`, copié dans le front au build (comme les quiz).

## 5. Règles de génération

Toutes les règles sont déterministes et décrites dans `backend/charte/regles.json`. Le front les applique pour l'aperçu ; le serveur les rejoue à l'enregistrement pour que le niveau et le score stockés soient fiables.

### 5.1 Niveau de données (classification du template, § 6.1)

Le niveau retenu est le plus élevé déclenché.

| Réponse | Niveau |
|---|---|
| Données RH, procédés et savoir-faire | Secret |
| Plans et notes de calcul, devis et prix, données clients | Confidentiel |
| Plans et notes de calcul avec Q10 = oui souvent | Secret |
| Données fournisseurs et traçabilité | Interne |
| Aucune donnée sensible | Public |

Q11 = exigence ajoute une règle d'hébergement en France ou en UE pour les niveaux Confidentiel et Secret.

### 5.2 Catalogue d'outils (template, § 7 et annexe A)

Chaque outil déclaré en Q5 est rangé dans une catégorie, puis reçoit les niveaux de données autorisés.

| Catégorie | Public | Interne | Confidentiel | Secret |
|---|---|---|---|---|
| Compte personnel ou offre gratuite | Oui | Non | Non | Non |
| Offre professionnelle hors UE (sans entraînement sur les données) | Oui | Oui | Après anonymisation | Non |
| Offre professionnelle hébergée en UE | Oui | Oui | Après anonymisation | Non |
| IA privée hébergée (harnais souverain) | Oui | Oui | Oui | Après validation du référent |
| IA intégrée à un logiciel métier | Selon le contrat de l'éditeur, à vérifier par le référent | | | |

Q6 = « non » ou « en partie » classe les outils déclarés en « compte personnel » tant que l'entreprise ne les a pas encadrés.

### 5.3 Charte courte en cinq règles (format du M7)

| Règle | Contenu généré |
|---|---|
| 1. Ce que nous autorisons | 2 à 4 usages tirés de Q7, avec un cas de la processothèque selon le maillon |
| 2. Ce que nous ne transmettons pas | Les catégories de Q9 au niveau Confidentiel ou Secret, avec la règle d'anonymisation |
| 3. Ce qui est toujours contrôlé par une personne | Une phrase par usage à risque ; pour bureau d'études et construction, la relecture de tout calcul ou dimensionnement |
| 4. Comment nous signalons une information incertaine | Clause fixe, variante selon le ton |
| 5. Comment nous conservons et améliorons les usages | Référent IA, date de revue à 12 mois, registre des usages |

### 5.4 Charte complète (.docx)

Sections 1 à 11 et annexes A et B du template v1. Les variables `{{…}}` sont remplacées par les réponses ; les sections 3 à 7 sont filtrées selon Q7, Q9 et Q5 ; les clauses existent en 3 variantes de ton. Les clauses vivent dans `backend/charte/clauses.json`, une entrée par clause : `id`, `section`, `condition`, `texte.encourageant`, `texte.prudent`, `texte.strict`.

Pied de page : « Modèle généré par PerfIA (Kosmio × Xylofutur), à adapter et à faire valider. Ce document ne constitue pas un conseil juridique. »

### 5.5 Score de maturité et recommandations

| Critère | Points | Source |
|---|---|---|
| Pilotage identifié | 0 à 15 | Q4 |
| Outils payés et encadrés | 0 à 25 | Q5, Q6 |
| Salariés formés | 0 à 25 | Q8 |
| Outils adaptés au niveau de données | 0 à 25 | Q5, Q9 à Q11 |
| Diversité des usages | 0 à 10 | Q7 |

Paliers : Découverte (moins de 40), Structuration (40 à 69), Pilotage (70 et plus).

Trois recommandations au plus, dans cet ordre de priorité :

1. Q8 = aucun → « Former votre équipe » : Académie PerfIA, inscription pré-remplie.
2. Q6 = non ou en partie → « Sortir des comptes personnels » : `https://perfia.kosm.io/choix-ia.html`.
3. Niveau Secret ou Confidentiel avec un outil hors UE déclaré → « Garder vos données sensibles chez vous » : `https://perfia.kosm.io/souverainete.html`.
4. Q7 contient devis et chiffrage ou appels d'offres → un cas de la processothèque (`https://processotheque.kosmio.dev/referentiel?source=charte`).
5. Palier Pilotage → « Passer au déploiement » : `https://cal.com/kosmio/ia-automatisation`.

## 6. Modèle de données

Nouvelle migration `backend/pb_migrations/<horodatage>_charte_ia.js` (jamais de modification des migrations déployées).

| Collection `chartes` | Type | Remarque |
|---|---|---|
| `user` | relation `users`, facultative | Remplie en mode `m7`, ou au rattachement après inscription |
| `source` | select : `libre`, `m7` | |
| `prenom`, `email`, `fonction` | texte | Mode `libre` uniquement |
| `entreprise`, `maillon`, `effectif` | texte, select, select | |
| `referent` | texte, facultatif | |
| `reponses` | json | Réponses brutes Q1 à Q12 |
| `regles` | json | Les cinq règles, modifiées par l'apprenant en mode `m7` |
| `niveau_donnees` | select : `public`, `interne`, `confidentiel`, `secret` | Recalculé par le serveur |
| `score` | nombre 0 à 100 | Recalculé par le serveur |
| `palier` | select : `decouverte`, `structuration`, `pilotage` | |
| `recommandations` | json | Identifiants des recommandations |
| `newsletter` | booléen | Consentement explicite, non coché par défaut |
| `utm` | texte (250) | `utm_source`, `utm_medium`, `utm_campaign` |
| `jeton` | texte (32), unique | Lien de synthèse sans compte |
| `created`, `updated` | autodate | |

Règles d'accès : `listRule` et `viewRule` = `user = @request.auth.id || @request.auth.role = "evaluateur"` ; `createRule`, `updateRule`, `deleteRule` = `null` (écriture par les routes serveur uniquement).

## 7. API

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/academie/charte/regles` | Public | Questions, règles et clauses (aucune donnée personnelle) |
| POST | `/api/academie/charte` | Public, limité à 10 envois par IP et par 10 minutes | Mode `libre` : valide, recalcule, enregistre, pousse le lead dans Brevo, envoie les mails ; renvoie `{ id, jeton, niveau, score, palier, recommandations }` |
| POST | `/api/academie/charte/m7` | Apprenant | Mode `m7` : enregistre ou met à jour la charte du compte |
| GET | `/api/academie/charte/{jeton}` | Détenteur du jeton | Données de la synthèse en mode `libre` |

Logique partagée dans `backend/pb_hooks/lib/charte.js` (niveau, catalogue, score, recommandations), chargée par `require` comme `academie.js`.

**Brevo** (même clé que `mail.pb.js`) : mise à jour du contact dans la liste 17 avec `FIRSTNAME`, `COMPANY`, `SOURCE = outil-charte-ia` et, si les attributs sont créés chez Brevo, `CHARTE_SCORE`, `CHARTE_PALIER`, `CHARTE_NIVEAU`, `MAILLON`. Un échec Brevo n'empêche jamais l'enregistrement ni le téléchargement.

**Mails** (par `sendMail` de `academie.js`) :

- au lead : « Votre charte IA » avec le lien de synthèse `/charte/synthese/?j=<jeton>`, les trois suites et la séance cal.com ;
- à mathieu@kosm.io : notification avec entreprise, maillon, effectif, niveau, score, palier, outils déclarés et le statut chaud, tiède ou froid (section 9).

**Rattachement** : à la création d'un compte (`onRecordAfterCreateSuccess` sur `users`), les chartes `libre` du même email sans `user` sont rattachées au compte.

**Indicateurs** : `/api/academie/stats` ajoute le nombre de chartes par source, palier et niveau, et le taux de chartes suivies d'une inscription.

## 8. Front (Kosmooc)

| Élément | Fichier | Détail |
|---|---|---|
| Page libre | `web/src/pages/charte/index.astro` | Accessible sans compte ; titre « Générez la charte IA de votre entreprise » ; widget `charte` en mode `libre` |
| Page de synthèse | `web/src/pages/charte/synthese.astro` | Lit `?j=` ; bouton « Télécharger en PDF » (`window.print()`, classe `no-print`) ; liens de suite |
| Widget | `web/src/widgets/charte.js`, déclaré dans `widgets/index.js` | Questionnaire en 3 écrans, aperçu, formulaire, téléchargement ; mode `m7` avec champs modifiables |
| Génération .docx | `web/src/widgets/docx.js` | Ajouter un bloc `tableau` (catalogue d'outils, matrice classification × outils) et un pied de page |
| Module 7 | `web/src/content/modules/m7.md` | Insérer `<div data-widget="charte" data-mode="m7">` dans l'exercice, entre les étapes 3 et 4 ; reformuler l'étape 4 : « Partez de la proposition générée et réécrivez les cinq règles avec vos mots » |
| Inscription | `web/src/pages/inscription.astro` | Pré-remplissage par paramètres `?email=&entreprise=&maillon=&source=charte` |
| Accueil Académie | `web/src/pages/index.astro` | Encart « Outil gratuit : votre charte IA en 5 minutes » |

Règles d'écriture inchangées (`npm run valider`) : pas de tiret cadratin, pas de nom de client réel, jamais « imprimer », toujours « télécharger en PDF ». Le contrôle de `valider-contenus.mjs` s'étend à `backend/charte/*.json`.

## 9. Intégration au site PerfIA (perfia.kosm.io)

Dépôt : `112-PerfIA-Bois/07_Web/site-public`.

| Emplacement | Modification |
|---|---|
| `index.html`, menu « Outils » (`#nav-outils`) | Nouvelle entrée en tête : titre « Charte IA », description « La charte IA de votre entreprise en 5 minutes », lien `https://mooc-ia.kosm.io/charte/?utm_source=perfia&utm_medium=nav`, `target="_blank"` et icône ↗ comme les autres liens externes |
| `index.html`, après la section `#outil-choix-ia` | Nouvelle section `#outil-charte-ia` sur le même modèle : surtitre « Outil gratuit », titre « Votre charte IA en 5 minutes », phrase sur l'AI Act (article 4, maîtrise de l'IA des équipes), bouton « Générer ma charte (5 min) → » (`utm_medium=section`) |
| `index.html`, FAQ « Et la confidentialité de nos plans et documents clients ? » | Ajouter le lien « Générez votre charte IA → » |
| `choix-ia.html`, écran de résultat | Lien « Encadrer ces outils : générez votre charte IA → » (`utm_medium=choix-ia`) |
| `souverainete.html` | Lien vers l'outil dans la partie sur les niveaux de protection (`utm_medium=souverainete`) |

La section et le menu suivent `design-system/tokens.css` et `assets/site-nav.css`. Vérifier le menu sur mobile.

**Scoring commercial** (calculé par le serveur, affiché dans la notification) :

- chaud : niveau Confidentiel ou Secret, effectif de 10 ou plus, outil hors UE ou compte personnel déclaré ;
- tiède : palier Découverte ou Structuration, hors critères « chaud » ;
- froid : effectif de 1 à 9 et niveau Public ou Interne.

Les relances (J+7 « votre charte est-elle signée ? » avec lien vers l'Académie) sont des automatisations Brevo filtrées sur `SOURCE = outil-charte-ia`, configurées par Mathieu, hors code.

## 10. RGPD

- Aucune réponse n'est envoyée au serveur avant le formulaire ; un visiteur qui s'arrête à l'aperçu ne laisse aucune donnée.
- Mentions sous le formulaire : responsable Kosmio, finalités (envoi de la charte, suivi commercial, actualités si la case est cochée), lien vers `/confidentialite/`.
- Mettre à jour `/confidentialite/` : collection `chartes`, durée de conservation (3 ans après le dernier contact), Brevo comme sous-traitant.
- Les statistiques agrégées (maillon, effectif, palier, niveau) peuvent servir à un baromètre de la filière, sans données nominatives.

## 11. Critères d'acceptation

- [ ] Questionnaire, aperçu et charte en cinq règles fonctionnent sans compte et sans appel serveur avant le formulaire
- [ ] Le serveur recalcule niveau, score et palier ; une valeur falsifiée envoyée par le client est ignorée
- [ ] Le .docx s'ouvre dans Word et LibreOffice, avec catalogue et matrice en tableaux
- [ ] Synthèse accessible par jeton, téléchargeable en PDF, sans exposer d'autre charte
- [ ] Lead présent dans Brevo (liste 17, `SOURCE = outil-charte-ia`) et notification reçue ; un échec Brevo ne bloque pas le téléchargement
- [ ] Limite de 10 envois par IP et par 10 minutes
- [ ] Mode `m7` : charte rattachée au compte, modifiable, téléchargeable, déposable comme exercice
- [ ] Une inscription avec le même email rattache les chartes `libre` existantes
- [ ] Inscription pré-remplie depuis la synthèse
- [ ] Entrée du menu « Outils », section et liens croisés présents sur le site PerfIA, avec leurs paramètres UTM
- [ ] `npm run valider`, `npm run test:api` (nouveaux contrôles de droits sur `chartes`) et `npm run test:e2e` (parcours libre complet et mode `m7`) passent

## 12. Lot 2 : charte co-construite avec les salariés (cadrage)

Offre payante, à tester d'abord chez un client PerfIA. Elle s'appuie sur les comptes entreprise prévus par `SPEC.md` § 9.

| Étape (3 à 4 semaines) | Fonction |
|---|---|
| Diagnostic salariés | Questionnaire anonyme sur les outils, les usages et les craintes |
| Consultation | Avis par règle : d'accord, à amender, commentaire |
| Arbitrage | Le référent IA tranche ; trace des propositions retenues ou écartées |
| Publication | Attestation de prise de connaissance et quiz court, preuve de maîtrise de l'IA (AI Act, art. 4) |
| Révision annuelle | Nouvelle consultation nourrie des RETEX |

Collections envisagées : `organisations`, `membres` (rôle dirigeant, référent, salarié), `consultations`, `avis`, `arbitrages`, `attestations`. Une charte annexée au règlement intérieur demande probablement la consultation du CSE à partir de 50 salariés : à faire confirmer par un juriste. Certifiko reste une option pour une attestation vérifiable demandée par un client.

## 13. À valider par Mathieu

1. Adresse de l'outil : `mooc-ia.kosm.io/charte/` (proposée) ou une adresse sur `perfia.kosm.io`.
2. Relecture juridique de `clauses.json` avant mise en ligne, et par qui.
3. Création des attributs Brevo `CHARTE_SCORE`, `CHARTE_PALIER`, `CHARTE_NIVEAU`, `MAILLON`, et de la séquence de relance.
4. Co-branding Xylofutur sur la charte générée.
5. Libellés du menu, de la section du site et du mail au lead.
6. Publication de la bibliothèque de clauses en licence ouverte (commun numérique de la filière).

## 14. Réalisation du lot 1 (19 octobre 2026)

Livré : générateur (mode libre et mode `m7`), capture de lead, intégration au M7, pages `/charte/` et `/charte/synthese/`, entrées du site PerfIA. Écarts et choix à connaître :

| Sujet | Choix retenu |
|---|---|
| Moteur | Un seul fichier, `backend/charte/moteur.js`, exécuté par PocketBase (`require`) et par le navigateur (import `?raw`) : l'aperçu et le recalcul serveur ne peuvent pas diverger. |
| Règles d'accès `chartes` | Ajout de `@request.auth.id != ""` : sans lui, une charte « libre » (champ `user` vide) serait lisible par tout visiteur, car `user = @request.auth.id` est vrai quand les deux sont vides. |
| Champs ajoutés à `chartes` | `statut` (chaud, tiède, froid, utile aux statistiques) et `ip_hash` (empreinte de l'IP pour la limite de 10 envois, jamais l'adresse). |
| Limite d'envois | Comptée dans le hook, par `ip_hash` sur 10 minutes, pour ne pas freiner le mode `m7` (le limiteur natif de PocketBase compte par préfixe de chemin). |
| Brevo | Repli sur `FIRSTNAME` et `SOURCE` si les attributs `CHARTE_*` et `MAILLON` n'existent pas encore (même logique que `site-public/server.js`). Attribut `NEWSLETTER` ajouté pour que la case de consentement ait un effet : à créer chez Brevo avec les autres. |
| Calcul du score | Barèmes dans `regles.json`. Hypothèses : pilotage responsable 15, dirigeant ou prestataire 10 ; sans outil d'IA, 10 points d'encadrement et 10 d'adéquation. |
| Co-branding Xylofutur | Mention « Kosmio × Xylofutur » en texte (note de couverture, pied de page, mails). Pas de logo image dans le .docx. |
| Menu « Outils » | L'entrée est aussi ajoutée dans `choix-ia.html` et `souverainete.html`, qui copient le même menu. |
| Variables d'environnement | `CHARTE_NOTIF_TO` (défaut mathieu@kosm.io), `BREVO_LIST_ID` (défaut 17), `ACADEMIE_URL` (liens des mails). |

Reste à votre main : attributs et séquence de relance Brevo, choix de la licence de la bibliothèque de clauses (`backend/charte/clauses.json`), relecture des libellés et des clauses, mise en ligne.

## 15. Version 2 après la critique du 19 octobre 2026

| Sujet | Changement |
|---|---|
| Q6 | « Ces outils sont-ils payés ? » devient « Lesquels sont payés par l'entreprise ? », outil par outil. Copilot Microsoft 365 n'est jamais classé en compte personnel (`toujours_pro`). Score d'encadrement proportionnel aux outils payés. |
| Référent | Demandé à l'écran 1 (champ `referent` des réponses), pour que l'aperçu le cite. |
| Cohérence | Quand aucun outil déclaré ne peut recevoir de données Confidentielles, la charte suspend les usages concernés (règle 1, section 3, FAQ) au lieu de les autoriser. Les plans escaladés en Secret ne sont plus traités comme Confidentiels dans la règle 2. `npm run valider` simule 200 profils et refuse toute contradiction. |
| Cinq règles | Une à trois phrases, 40 mots environ, contrôles limités aux deux plus importants (`limites` dans `regles.json`). |
| Livrable | Page 1 à afficher et à signer : cinq règles, outils autorisés, validation par la direction et le référent. Charte détaillée en annexe. Plus de score ni de palier dans le document. Engagements lourds (canal interne, retour trimestriel) réservés aux effectifs de 50 et plus. |
| Écrans | Plus de titre en double, maillon en liste déroulante, cibles de 48 px, référent et aides par question, aperçu avec constat et tableau des outils, prochaines étapes numérotées en fin de synthèse. En M7, les règles ne sont plus préremplies : la proposition s'affiche au-dessus d'une zone vide, avec un bouton « Reprendre ». |

## 16. Prototype : la charte installée dans les assistants (19 octobre 2026)

Objectif : décider si l'on industrialise un export de la charte vers les assistants d'IA du prospect. L'assistant classe ce que l'utilisateur dépose selon les quatre niveaux, compare au niveau autorisé pour cet outil et prévient en une phrase (règle concernée, marche à suivre, référent nommé), sans refuser ni moraliser. Il rappelle la relecture (règle 3) sur les devis, calculs et messages clients, et marque « à vérifier » ce qui est incertain (règle 4). C'est un outil de sensibilisation : l'avertissement arrive après la transmission du contenu à l'outil. La protection réelle passe par les réglages d'administration, la protection des données côté éditeur ou un harnais souverain.

### 16.1 Réalisation

| Élément | Contenu |
|---|---|
| `web/src/lib/charte-skill.js` | Générateur sans dépendance au moteur (il prend la synthèse, les réponses validées et `regles.json`), donc exécutable dans le navigateur et sous Node. `instructions()` : texte brut pour un outil. `fichiersSkill()` : `charte-ia-<entreprise>/SKILL.md` et `references/charte.md`. `exportsOutils()` : pour chaque outil du catalogue, format, cible, trois lignes d'installation. |
| Contenu | Consignes de comportement, tableau des quatre niveaux avec les exemples de `classification`, les données déclarées par l'entreprise rangées à leur niveau (escalade comprise), l'autorisation de l'outil pour chaque niveau et la marche à suivre (anonymiser, autre outil déclaré qui accepte ce niveau, ne pas passer par l'IA, référent). Les cinq règles de la charte. La phrase d'avertissement d'exemple suit ce que l'outil accepte vraiment. |
| Synthèse | Section « Installer la charte dans vos assistants » (`installationHtml`, `brancherInstallation` dans `charte-synthese.js`), à l'écran après l'envoi et sur `/charte/synthese/?j=`. Par outil déclaré : bouton du paquet Claude (.zip) ou « Copier les instructions », trois lignes d'installation, texte visible dans un volet repliable. |
| Zip | `zip()` de `widgets/docx.js` exporté, avec un type MIME en paramètre et une date valide (1er janvier 1980) dans les en-têtes. |
| Contrôles | `npm run valider` génère les exports des 200 profils simulés et refuse : instructions au-delà de 8 000 caractères, tiret cadratin, nom de skill invalide (minuscules, chiffres, tirets, 64 caractères, sans « claude » ni « anthropic »), nom différent du dossier, description vide, au-delà de 1 024 caractères ou avec chevrons. |

Le paquet généré passe `quick_validate.py` (outil officiel de création de skills) et se charge comme skill dans Claude Code. L'import dans claude.ai (Personnaliser, Skills) reste à faire à la main par Mathieu : je n'ai pas modifié de compte.

### 16.2 Formats retenus par outil (documentation des éditeurs vérifiée le 19 octobre 2026)

| Outil déclaré | Format proposé | Où le coller | Limite et conditions |
|---|---|---|---|
| Claude | Paquet skill (.zip d'un dossier avec `SKILL.md`), plus le texte pour un projet Claude | Personnaliser, Skills, « + », Créer, Importer | Toutes les offres, y compris gratuite ; exécution de code activée (Team et Enterprise : par le propriétaire). Nom du dossier identique au `name`. Nom 64 caractères, description 1 024. |
| ChatGPT | Texte | Instructions d'un projet (toutes les offres, y compris gratuite) ou d'un GPT personnalisé (création réservée aux offres payées) | 8 000 caractères pour un GPT (erreur bloquante au-delà). Pour un projet, aucune limite publiée. Les instructions d'un projet ne valent que dans ce projet. |
| Gemini | Texte | Gems, Nouveau Gem, Instructions (web uniquement pour la création) | Gems gratuits depuis mars 2025. Pas de limite officielle trouvée ; environ 4 000 caractères selon des sources tierces : nos textes font 4 350 à 4 500 caractères pour le profil type : à essayer dans un vrai Gem avant mise en ligne, et à raccourcir si le champ refuse. |
| Mistral | Texte collé dans le champ SKILL.md d'une Skill | Mistral Vibe (Le Chat renommé fin mai 2026), mode Work, Context, Skills, New Skill | Les Skills de Vibe suivent le standard ouvert Agent Skills, celui de Claude : le même `SKILL.md` pourrait servir tel quel. Les anciens agents de Le Chat correspondent désormais aux Skills. Pas de limite publiée. |
| Copilot Microsoft 365 | Texte | Nouvel agent, Passer à la configuration, champ Instructions | 8 000 caractères (Microsoft Learn), description 1 000, nom 30. Agent Builder accepte aussi des paquets de skills en préversion (programme Frontier) : piste à suivre. |
| IA intégrée à un logiciel métier | Aucun | | Pas d'instructions personnalisées en général : la section renvoie au contrat de l'éditeur. |

Libellés des menus : repris de la documentation en anglais de chaque éditeur et traduits ; à vérifier sur les interfaces en français avant mise en ligne.

Sources : [Claude, utiliser les skills](https://support.claude.com/en/articles/12512180-using-skills-in-claude) ; [ChatGPT, projets](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) ; [limite de 8 000 caractères des GPT](https://community.openai.com/t/how-can-i-increase-the-ceiling-for-gpt-instructions-beyond-8000-characters/801867) ; [Microsoft Learn, Agent Builder](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/agent-builder-build-agents) ; [Mistral Vibe, Skills](https://docs.mistral.ai/vibe/work/skills) ; [Le Chat devient Vibe](https://the-decoder.com/mistral-rebrands-lechat-as-vibe-betting-its-chatbots-future-is-as-a-full-blown-work-agent/) ; [Gems gratuits](https://tomsguide.com/ai/google-gemini-gems-now-available-to-all-users-without-a-subscription).

### 16.3 Limites

- **Après coup** : l'assistant voit le contenu une fois transmis. Il prévient pour la prochaine fois, il ne protège rien. La synthèse et les consignes le disent.
- **Contournable** : il suffit de travailler hors du projet, du Gem ou de l'agent, ou de désactiver le skill. Seuls les réglages d'administration (offre entreprise, entraînement désactivé, connecteurs fermés) et un harnais souverain appliquent vraiment la charte : c'est l'offre de Kosmio.
- **Déclenchement du skill** : Claude ouvre le skill quand la demande ressemble à sa description. Une question de calcul sans document ne l'a pas ouvert (cas 10) ; la relecture n'est alors pas rappelée.
- **Classement probabiliste** : le modèle classe d'après le contenu visible. Un cas limite (demande d'un client nommé sans prix, cas 19) a été manqué en v1, corrigé par un repère explicite. D'autres cas limites existeront.
- **Un outil à la fois** : chaque paquet porte la matrice d'un seul outil. Un salarié qui utilise deux assistants installe deux paquets.
- **Mise à jour** : une charte modifiée impose de réinstaller le paquet ou de recoller le texte dans chaque outil. Pas de lien vivant.
- **Langue des menus** : les étapes d'installation viennent des documentations en anglais ; libellés français à vérifier.

### 16.4 Résultats des 20 cas

Détail et messages : `tests/charte-skill-cas.md`. Profil type : scierie, ChatGPT non payé, Copilot Microsoft 365, devis et données clients. Montage A : skill Claude généré pour un compte non payé (même matrice que ChatGPT non payé), chargé par Claude Sonnet. Montage B : instructions Copilot en consignes système de Claude Sonnet.

| Version | Montage | Justes | Manqués | Abusifs | Silences justes | Règle 3 |
|---|---|---|---|---|---|---|
| v1 | A, skill | 8 sur 11 | 3 | 0 | 9 sur 9 | 7 sur 7 |
| v1 | B, Copilot | 7 sur 9 | 2 | 0 | 11 sur 11 | 7 sur 7 |
| v2 | A, skill | 11 sur 11 | 0 | 0 | 9 sur 9 | 6 sur 7 |
| v2 | B, Copilot | 9 sur 9 | 0 | 0 | 11 sur 11 | 7 sur 7 |

Aucun refus, aucune leçon de morale, aucun avertissement abusif sur les faux positifs (fiche de poste, prix publics, devis fictif, client nommé seul, question sur la charte). Marche à suivre exacte (anonymiser, Copilot pour le Confidentiel, rien pour le Secret, Claire Martin). « À vérifier » employé à bon escient. Corrections v2 : description du skill élargie, repères de classement par type de document, avertissement en une phrase qui inclut « déjà transmis » (tenu en B, trois ou quatre phrases courtes en A).

Prudence sur ces chiffres : un passage par cas, v2 réglée sur les échecs de la v1 avec les mêmes messages, un seul modèle (Claude Sonnet), aucun essai dans ChatGPT, Copilot, Gemini ou Mistral, aucun fichier déposé (texte collé seulement).

### 16.5 Pour décider de l'industrialisation

Le prototype montre que le comportement voulu est atteignable avec un texte de 4 500 caractères généré par le moteur existant, sans coût serveur. Avant d'industrialiser :

1. Importer le zip dans claude.ai et coller le texte dans un projet ChatGPT gratuit, un agent Copilot et un Gem, avec les 20 messages et un second jeu écrit par un salarié de la filière.
2. Mesurer sur trois passages par cas.
3. Décider du positionnement : l'export donne une raison concrète de revenir sur la synthèse et ouvre la conversation sur la vraie protection (réglages d'administration, harnais souverain).

Pistes : un seul paquet multi-outils pour les équipes qui utilisent plusieurs assistants ; paquet `SKILL.md` pour Mistral Vibe et Copilot (préversion), qui suivent le même standard ; rafraîchir le libellé « Mistral Le Chat » dans `regles.json`.
