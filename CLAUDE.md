# Académie PerfIA : consignes pour Claude

Plateforme de formation de l'Académie PerfIA (Kosmio × Xylofutur) : deux parcours, « Les bases de l'IA » (attestation AI Act, Open Badges) et « Mettre en place l'IA » (badge Niveau 1), sur une bibliothèque de modules commune définie dans `backend/parcours.json`. Lire `SPEC.md` pour la plateforme et `docs/FORMAT-CONTENU.md` pour les contenus.

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
| `npm run test:api` | 47 contrôles d'API et de droits (dont la charte IA) (PocketBase lancé, superuser `admin@kosm.io` ou `SUPW`) |
| `npm run test:e2e` | Parcours navigateur complet : inscription, quiz, dépôts, évaluation, badge |

## Règles

- Contenus : pas de tiret cadratin, pas de « il ne s'agit pas de X mais de Y », aucun nom de client réel, aucun gain présenté comme mesuré s'il ne l'est pas.
- Schéma : nouvelle migration pour toute évolution, jamais de modification d'une migration déployée.
- Hooks : logique partagée dans `backend/pb_hooks/lib/academie.js`, chargée par `require` dans chaque handler.
- Adresse publique PerfIA : `perfia.kosm.io` (l'ancienne `ia-bois.kosm.io` est interdite, contrôlée par `npm run valider`).
- Durée annoncée : environ 2 h 35 pour les bases, 8 à 10 heures pour la mise en place ; elle se calcule depuis le champ `duree` des modules de chaque parcours, à tenir à jour.
- Modules communs (m1, m2, m7, m11) : aucun renvoi à un numéro de module propre à un seul parcours.
- `docs/sources/` contient des documents client internes : ne jamais les publier ni les copier dans `web/`.
- Mathieu valide les scripts, la voix, les mises en ligne, les prix et tout envoi externe.
- Documents : ne jamais parler d'imprimer, toujours de télécharger en PDF.
- Accompagnement : une séance individuelle en visio, réservée par l'apprenant sur https://cal.com/kosmio/perfia-academie (pas de séance collective).
