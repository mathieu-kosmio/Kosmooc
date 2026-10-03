#!/usr/bin/env bash
# Lance l'Académie PerfIA en local avec des comptes de démonstration.
# Usage : bash scripts/demarrer-local.sh        (relance sans effacer les données)
#         bash scripts/demarrer-local.sh --reset (repart d'une base vide)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8090}"
B="http://127.0.0.1:$PORT"
PB_VERSION=0.30.0
ADMIN_EMAIL=admin@perfia.local
ADMIN_PW='Admin-PerfIA-2026'
LOG="$ROOT/backend/pocketbase.log"

# Node : nvm, Homebrew ou système
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true; fi
command -v node >/dev/null || { echo "Node.js est requis (https://nodejs.org)"; exit 1; }

cd "$ROOT/backend"

# 1. PocketBase (téléchargé une seule fois)
if [ ! -x ./pocketbase ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) ARCH=darwin_arm64 ;; Darwin-x86_64) ARCH=darwin_amd64 ;;
    Linux-x86_64) ARCH=linux_amd64 ;; Linux-aarch64) ARCH=linux_arm64 ;;
    *) echo "Système non prévu : $(uname -s) $(uname -m)"; exit 1 ;;
  esac
  echo "Téléchargement de PocketBase $PB_VERSION ($ARCH)…"
  curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${ARCH}.zip"
  unzip -oq pb.zip pocketbase && rm pb.zip && chmod +x pocketbase
fi

# 2. Arrêt d'une instance précédente, base remise à zéro si demandé
if command -v lsof >/dev/null; then
  OLD=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$OLD" ] && kill $OLD 2>/dev/null && sleep 1
fi
[ "${1:-}" = "--reset" ] && rm -rf pb_data
FIRST=0; [ -d pb_data ] || FIRST=1
./pocketbase migrate up --dir=pb_data >/dev/null
./pocketbase superuser upsert "$ADMIN_EMAIL" "$ADMIN_PW" --dir=pb_data >/dev/null

# 3. Site
cd "$ROOT/web"
[ -d node_modules ] || { echo "Installation des dépendances du site…"; npm install --silent; }
echo "Construction du site…"
npx astro build >/dev/null

# 4. Démarrage. E-mails via Brevo : clé lue dans BREVO_API, sinon dans cles.env (ligne « BREVO : clé »).
cd "$ROOT/backend"
if [ -z "${BREVO_API:-}" ] && [ -f "$ROOT/cles.env" ]; then
  BREVO_API="$(sed -nE 's/^BREVO[[:space:]]*[:=][[:space:]]*//p' "$ROOT/cles.env" | head -1)"
fi
export APP_BREVO_API_KEY="${BREVO_API:-}"
export APP_MAIL_FROM="${APP_MAIL_FROM:-mathieu@kosm.io}"
nohup ./pocketbase serve --http="127.0.0.1:$PORT" --dir=pb_data > "$LOG" 2>&1 &
for _ in $(seq 1 30); do curl -fs "$B/api/health" >/dev/null 2>&1 && break; sleep 0.5; done

# 5. Comptes de démonstration (première fois seulement)
if [ "$FIRST" = 1 ]; then
  echo "Création des comptes de démonstration…"
  node "$ROOT/scripts/seed-demo.mjs" "$B" "$ADMIN_EMAIL" "$ADMIN_PW" "$ROOT/backend/quiz"
fi

cat <<EOF

  Académie PerfIA lancée : $B

  Apprenant démo     apprenant@perfia.local / Demo-2026   (modules 0 et 1 faits, projet final déposé)
  Évaluatrice démo   evaluatrice@perfia.local / Demo-2026 (espace Évaluation)
  Administration     $B/_/   $ADMIN_EMAIL / $ADMIN_PW

  Journal : $LOG
  Arrêter : kill \$(lsof -tiTCP:$PORT -sTCP:LISTEN)
EOF
[ "$(uname -s)" = Darwin ] && open "$B" || true
