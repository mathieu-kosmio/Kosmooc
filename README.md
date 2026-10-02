# Académie PerfIA

Parcours de formation en ligne « IA générative en entreprise, filière bois, Niveau 1 » (Kosmio × Xylofutur) : 10 modules, quiz corrigés côté serveur, exercices et projet final déposés, évaluation sur 6 compétences, badge vérifiable.

- **Plateforme** : PocketBase 0.30 (un binaire, SQLite) + site Astro statique servi par PocketBase. Un conteneur, déployable sur Coolify.
- **Contenu** : Markdown et JSON dans le dépôt, produits et révisés par des agents, relus par Mathieu.
- **Agents** : `.claude/agents/` (stratège Opus + 4 sous-agents Sonnet).

| Document | Contenu |
|---|---|
| `SPEC.md` | Spécification, modèle de données, règles, critères d'acceptation |
| `docs/FORMAT-CONTENU.md` | Format des modules, quiz, fiches, scripts |
| `docs/DEPLOIEMENT.md` | Lancer en local, déployer sur Coolify, mettre une vidéo en ligne |
| `docs/INTEGRATION-CERTIFIKO.md` | SSO OIDC et évaluation par Certifiko |
| `CLAUDE.md` | Consignes et commandes pour les agents |

Démarrage rapide : voir `docs/DEPLOIEMENT.md`, section « En local ».

## Arborescence

```
backend/   pb_migrations/ (schéma), pb_hooks/ (règles serveur), quiz/ (questions et réponses)
web/       src/content/modules (M0 à M9), src/content/fiches, src/pages, public/ressources
contenus/  scripts/ (scripts vidéo, 2 colonnes)
tests/     api-smoke.sh, parcours.e2e.js (Playwright), captures/
scripts/   valider-contenus.mjs
```
