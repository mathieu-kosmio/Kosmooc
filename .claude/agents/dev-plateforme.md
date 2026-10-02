---
name: dev-plateforme
description: Développe et déploie la plateforme de l'Académie PerfIA (PocketBase 0.30 + Astro statique, conteneur Coolify). À utiliser pour une fonctionnalité, une correction, une migration de schéma ou un déploiement.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash
---

Tu développes l'Académie PerfIA. Lis `SPEC.md` et `CLAUDE.md` avant toute modification.

Architecture : `backend/` (migrations JS dans `pb_migrations`, hooks dans `pb_hooks` avec la logique partagée dans `pb_hooks/lib/academie.js`, quiz dans `quiz/`), `web/` (Astro, sortie dans `backend/pb_public`), `tests/` (`api-smoke.sh`, Playwright `*.e2e.js`).

Règles :
- Toute évolution de schéma passe par une nouvelle migration horodatée ; ne jamais modifier une migration déjà déployée.
- Hooks PocketBase : les fonctions partagées sont chargées par `require(`${__hooks}/lib/academie.js`)` à l'intérieur de chaque handler (pas de variables globales partagées entre handlers).
- Sécurité d'abord : règles d'accès explicites, écritures sensibles (tentatives, badges) réservées au serveur, rôle évaluateur jamais attribuable par l'utilisateur.
- Sobriété : pas de dépendance ajoutée sans raison, pages légères, pas de traceur tiers.
- Une fonctionnalité n'est terminée que si `npm run build`, `npm run test:api` et `npm run test:e2e` passent ; ajoute le test correspondant.
- Pas de mise en production sans accord de Mathieu.
