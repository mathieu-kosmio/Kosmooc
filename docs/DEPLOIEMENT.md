# Déploiement

## En local

Le plus simple : `bash scripts/demarrer-local.sh` (ajouter `--reset` pour repartir d'une base vide). Le script télécharge PocketBase, construit le site, crée des comptes de démonstration et ouvre le navigateur.

Étapes détaillées, si besoin :

```bash
# 1. PocketBase (binaire à télécharger une fois, version 0.30.0)
cd backend
curl -sSLO https://github.com/pocketbase/pocketbase/releases/download/v0.30.0/pocketbase_0.30.0_darwin_arm64.zip
unzip pocketbase_0.30.0_darwin_arm64.zip pocketbase && rm pocketbase_0.30.0_darwin_arm64.zip
./pocketbase migrate up --dir=pb_data
./pocketbase superuser upsert vous@kosm.io 'MotDePasseSolide' --dir=pb_data

# 2. Front
cd ../web && npm install && npx astro build   # écrit dans backend/pb_public

# 3. Lancer
cd ../backend && ./pocketbase serve --http=127.0.0.1:8090 --dir=pb_data
# Site : http://127.0.0.1:8090  ·  Admin : http://127.0.0.1:8090/_/
```

Pour travailler le front en direct : `npm run dev:api` dans un terminal, `npm run dev:web` dans un autre.

## Sur Coolify

1. Nouveau service à partir du dépôt Git, type « Dockerfile », port 8090.
2. Volume persistant monté sur `/pb/pb_data` (base SQLite et fichiers déposés).
3. Variables : `ACADEMIE_URL=https://academie.ia-bois.kosm.io` (exemple), et celles de Certifiko si besoin.
4. Premier démarrage, dans le terminal du conteneur :
   `/pb/pocketbase superuser upsert vous@kosm.io 'MotDePasseSolide' --dir=/pb/pb_data`
5. Admin `/_/` :
   - Paramètres, Application : nom « Académie PerfIA », URL publique ;
   - Paramètres, Mail : SMTP (Brevo ou serveur Kosmio), expéditeur ;
   - Paramètres, Sauvegardes : sauvegarde automatique quotidienne ;
   - collection `users` : passer les évaluateurs en `role = evaluateur`.
6. Vérifier : `B=https://<url> SUPW=<mot de passe> npm run test:api` puis `npm run test:e2e` (crée des comptes de test à supprimer ensuite).

## Mettre une vidéo en ligne

Héberger la vidéo (PeerTube, hébergeur européen, ou fichier MP4 dans `web/public/videos/`), puis renseigner son URL dans `src:` du module concerné. Une URL d'intégration (`/embed/`, `/videos/embed/`, YouTube, Vimeo) est affichée en iframe ; sinon un lecteur vidéo natif.

## Mettre à jour le contenu

Modifier les fichiers Markdown ou JSON, lancer `npm run valider`, puis redéployer. Les quiz sont relus au moment de la requête : un changement de quiz ne demande qu'un redéploiement du conteneur.
