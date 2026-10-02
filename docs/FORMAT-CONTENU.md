# Format des contenus de l'Académie PerfIA

Tout le contenu pédagogique vit dans le dépôt, en fichiers texte. La plateforme ne stocke que les données vivantes (comptes, progression, tentatives, dépôts, évaluations, badges).

## 1. Module : `web/src/content/modules/<id>.md`

Nom de fichier : `m0.md` à `m9.md`.

```yaml
---
id: m0                      # identifiant stable, minuscules
ordre: 0                    # ordre d'affichage
titre: "Bienvenue et autodiagnostic"
duree: 15                   # minutes, entier
resume: "Une phrase qui dit ce que l'apprenant sait faire à la fin."
objectifs:                  # 2 à 4 objectifs, formulés « Je sais… »
  - "Je sais situer mon usage actuel de l'IA."
competences: [C1]           # compétences du badge travaillées (C1 à C6), liste vide possible
statut: pret                # pret | trame  (trame = plan seulement, contenu à produire)
videos:                     # 0 à 3 vidéos
  - titre: "Pourquoi ce parcours"
    duree: "4 min"
    src: ""                 # URL de la vidéo hébergée ; vide = vidéo à tourner
    script: m0-v1           # renvoie à contenus/scripts/m0-v1.md
ressources:                 # téléchargements et fiches
  - titre: "Fiche mémo M0"
    type: fiche             # fiche = page imprimable générée depuis web/src/content/fiches/<ref>.md
    ref: m0
  - titre: "Devis exemple (cas devis vers fiche de production)"
    type: fichier           # fichier = téléchargement depuis web/public/ressources/<ref>
    ref: cas-devis/DEVIS_DEV-2026-0412.txt
quiz: true                  # true si backend/quiz/<id>.json existe
exercice: true              # true si le corps contient une section « ## Exercice »
---
```

Corps en Markdown :

- sections `##` courtes, phrases de moins de 25 mots, ton direct, vouvoiement ;
- une section `## Exercice` quand `exercice: true` : consigne pas à pas sur le cas fil rouge, livrable attendu, durée ;
- pas de tiret cadratin (le caractère « — » est interdit) ;
- pas de tournure « il ne s'agit pas de X mais de Y » ;
- aucune marque client réelle : SOCAMEX devient « votre entreprise » ou une entreprise fictive (« Menuiserie des Landes »).

## 2. Quiz : `backend/quiz/<id>.json`

Les bonnes réponses restent côté serveur. Le front reçoit une version sans réponses générée au build.

```json
{
  "module": "m1",
  "seuil": 0.8,
  "questions": [
    {
      "id": "q1",
      "enonce": "Que fait un modèle de langage quand il répond ?",
      "choix": ["Il cherche la réponse dans une base de données", "Il produit la suite de texte la plus plausible", "Il recopie un document de référence"],
      "bonnes": [1],
      "explication": "Un LLM prédit la suite la plus plausible à partir de la demande et du contexte. D'où l'intérêt de vérifier."
    }
  ]
}
```

`bonnes` est une liste d'index (base 0). Plusieurs bonnes réponses possibles : la question devient à choix multiples. 5 questions par module.

## 3. Fiche mémo : `web/src/content/fiches/<id>.md`

2 pages imprimées maximum. Frontmatter : `titre`, `module`. Corps : l'essentiel du module, un encadré « À retenir », la consigne de l'exercice en résumé.

## 4. Script vidéo : `contenus/scripts/<id>-v<n>.md`

Tableau en deux colonnes « Ce qu'on voit » / « Ce qu'on dit », 130 mots par minute de parole, une idée par vidéo, une question d'accroche au début, une consigne à la fin. Frontmatter : `titre`, `module`, `duree_cible`, `statut` (brouillon | relu | tourne).

## 5. Compétences du badge N1

| Code | Compétence | Preuve |
|---|---|---|
| C1 | Expliquer le fonctionnement et les limites d'une IA générative | Quiz M1 ≥ 80 % |
| C2 | Formuler une demande efficace | Demande C de l'exercice M2 |
| C3 | Décider si une tâche relève de l'IA | Grille M3 |
| C4 | Formuler un cas d'usage | Fiche E-T-S-C (M4) |
| C5 | Construire et tester un prototype réutilisable | Prompt métier et tableau de test (M5, M6) |
| C6 | Utiliser l'IA de façon responsable | Charte 5 règles et autodiagnostic dépendance (M7, M8) |
