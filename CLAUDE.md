# Académie PerfIA : consignes pour Claude

Plateforme de formation du Parcours IA filière bois (Kosmio × Xylofutur), Niveau 1. Lire `SPEC.md` pour la plateforme et `docs/FORMAT-CONTENU.md` pour les contenus.

## Organisation des agents

- `strategiste-perfia` (Opus) pilote : il planifie, délègue, contrôle et rend compte à Mathieu.
- Sous-agents Sonnet : `redacteur-modules`, `concepteur-cas`, `dev-plateforme`, `recetteur`.
- Lancer le pilotage : « Utilise l'agent strategiste-perfia pour faire le point et planifier la journée. »

## Commandes

| Commande | Effet |
|---|---|
| `npm run valider` | Contrôle des contenus (format, quiz, ressources, règles d'écriture) |
| `npm run build` | Construit le site dans `backend/pb_public` |
| `npm run dev:api` / `npm run dev:web` | PocketBase local / front en direct |
| `npm run test:api` | 23 contrôles d'API et de droits (PocketBase lancé, superuser `admin@kosm.io` ou `SUPW`) |
| `npm run test:e2e` | Parcours navigateur complet : inscription, quiz, dépôts, évaluation, badge |

## Règles

- Contenus : pas de tiret cadratin, pas de « il ne s'agit pas de X mais de Y », aucun nom de client réel, aucun gain présenté comme mesuré s'il ne l'est pas.
- Schéma : nouvelle migration pour toute évolution, jamais de modification d'une migration déployée.
- Hooks : logique partagée dans `backend/pb_hooks/lib/academie.js`, chargée par `require` dans chaque handler.
- `docs/sources/` contient des documents client internes : ne jamais les publier ni les copier dans `web/`.
- Mathieu valide les scripts, la voix, les mises en ligne, les prix et tout envoi externe.
