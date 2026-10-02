#!/usr/bin/env bash
# Test de bout en bout de l'API Académie (PocketBase lancé sur $B, superuser admin@kosm.io).
set -u
B=${B:-http://127.0.0.1:8090}; SUPW=${SUPW:-Admin-Test-2026!}; FAIL=0
j(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
check(){ if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (attendu: $3, obtenu: $2)"; FAIL=1; fi; }
R=$RANDOM
post(){ curl -s -o /tmp/r.json -w "%{http_code}" -XPOST "$B$1" -H "content-type: application/json" ${3:+-H "Authorization: $3"} -d "$2"; }
check "inscription refusée avec rôle évaluateur" "$(post /api/collections/users/records "{\"email\":\"x$R@t.fr\",\"password\":\"Test-12345\",\"passwordConfirm\":\"Test-12345\",\"role\":\"evaluateur\"}")" 400
check "inscription apprenant" "$(post /api/collections/users/records "{\"email\":\"a$R@t.fr\",\"password\":\"Test-12345\",\"passwordConfirm\":\"Test-12345\",\"name\":\"Alice\",\"entreprise\":\"Menuiserie des Landes\",\"maillon\":\"scierie\"}")" 200
check "rôle par défaut" "$(j 'd["role"]' < /tmp/r.json)" apprenant
post /api/collections/users/auth-with-password "{\"identity\":\"a$R@t.fr\",\"password\":\"Test-12345\"}" >/dev/null
TOK=$(j 'd["token"]' < /tmp/r.json); U=$(j 'd["record"]["id"]' < /tmp/r.json)
check "auto-promotion refusée" "$(curl -s -o /dev/null -w '%{http_code}' -XPATCH $B/api/collections/users/records/$U -H "Authorization: $TOK" -H 'content-type: application/json' -d '{"role":"evaluateur"}')" 404
check "quiz public sans réponses" "$(curl -s $B/api/academie/quiz/m1 | grep -c bonnes)" 0
check "module terminé refusé sans quiz" "$(post /api/collections/progress/records "{\"user\":\"$U\",\"module\":\"m1\",\"statut\":\"termine\"}" $TOK)" 400
python3 -c "import json;q=json.load(open('$(dirname $0)/../backend/quiz/m1.json'));print(json.dumps({'reponses':{x['id']:[] for x in q['questions']}}))" > /tmp/bad.json
python3 -c "import json;q=json.load(open('$(dirname $0)/../backend/quiz/m1.json'));print(json.dumps({'reponses':{x['id']:x['bonnes'] for x in q['questions']}}))" > /tmp/ans.json
post /api/academie/quiz/m1 "$(cat /tmp/bad.json)" $TOK >/dev/null; check "quiz échoué" "$(j 'd["reussi"]' < /tmp/r.json)" False
post /api/academie/quiz/m1 "$(cat /tmp/ans.json)" $TOK >/dev/null; check "quiz réussi" "$(j 'd["reussi"]' < /tmp/r.json)" True
check "module terminé après quiz" "$(post /api/collections/progress/records "{\"user\":\"$U\",\"module\":\"m1\",\"statut\":\"termine\"}" $TOK)" 200
check "doublon de progression refusé" "$(post /api/collections/progress/records "{\"user\":\"$U\",\"module\":\"m1\",\"statut\":\"en_cours\"}" $TOK)" 400
echo "projet final" > /tmp/projet.txt
check "dépôt avec statut forcé refusé" "$(curl -s -o /tmp/r.json -w '%{http_code}' -XPOST $B/api/collections/submissions/records -H "Authorization: $TOK" -F user=$U -F module=m9 -F type=projet_final -F statut=valide -F fichiers=@/tmp/projet.txt)" 400
check "dépôt du projet final" "$(curl -s -o /tmp/r.json -w '%{http_code}' -XPOST $B/api/collections/submissions/records -H "Authorization: $TOK" -F user=$U -F module=m9 -F type=projet_final -F commentaire=ok -F fichiers=@/tmp/projet.txt)" 200
S=$(j 'd["id"]' < /tmp/r.json)
check "évaluation refusée à un apprenant" "$(post /api/collections/evaluations/records "{\"submission\":\"$S\",\"decision\":\"valide\"}" $TOK)" 400
post /api/collections/_superusers/auth-with-password "{\"identity\":\"admin@kosm.io\",\"password\":\"$SUPW\"}" >/dev/null; STOK=$(j 'd["token"]' < /tmp/r.json)
post /api/collections/users/records "{\"email\":\"e$R@t.fr\",\"password\":\"Test-12345\",\"passwordConfirm\":\"Test-12345\",\"name\":\"Eva\"}" >/dev/null; E=$(j 'd["id"]' < /tmp/r.json)
check "promotion évaluateur par l'admin" "$(curl -s -o /dev/null -w '%{http_code}' -XPATCH $B/api/collections/users/records/$E -H "Authorization: $STOK" -H 'content-type: application/json' -d '{"role":"evaluateur"}')" 200
post /api/collections/users/auth-with-password "{\"identity\":\"e$R@t.fr\",\"password\":\"Test-12345\"}" >/dev/null; ETOK=$(j 'd["token"]' < /tmp/r.json)
check "l'évaluateur voit le dépôt" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/collections/submissions/records/$S -H "Authorization: $ETOK")" 200
check "évaluation validée" "$(post /api/collections/evaluations/records "{\"submission\":\"$S\",\"decision\":\"valide\",\"criteres\":{\"C1\":{\"acquis\":true},\"C2\":{\"acquis\":true},\"C3\":{\"acquis\":true},\"C4\":{\"acquis\":true},\"C5\":{\"acquis\":true},\"C6\":{\"acquis\":true}},\"commentaire\":\"Bravo\"}" $ETOK)" 200
check "évaluateur renseigné" "$(j 'd["evaluateur"]' < /tmp/r.json)" "$E"
check "dépôt passé à validé" "$(curl -s $B/api/collections/submissions/records/$S -H "Authorization: $TOK" | j 'd["statut"]')" valide
curl -s "$B/api/collections/badges/records" -H "Authorization: $TOK" > /tmp/b.json
check "badge émis" "$(j 'd["totalItems"]' < /tmp/b.json)" 1
BID=$(j 'd["items"][0]["id"]' < /tmp/b.json)
check "badge vérifiable sans compte" "$(curl -s $B/api/collections/badges/records/$BID | j 'd["titulaire"]')" Alice
check "liste des badges fermée au public" "$(curl -s $B/api/collections/badges/records | j 'd["totalItems"]')" 0
check "statistiques réservées" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/academie/stats -H "Authorization: $TOK")" 403
check "statistiques évaluateur" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/academie/stats -H "Authorization: $ETOK")" 200
exit $FAIL
