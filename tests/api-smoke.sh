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
# ---------- Générateur de charte IA ----------
REP='{"entreprise":"Test charte SARL","maillon":"bureau_etudes","effectif":"10-49","pilote":"dirigeant","outils":["chatgpt"],"cadre":"non","usages":["devis","plans"],"formation":"aucun","donnees":["plans"],"confidentialite":"souvent","souverainete":"exigence","ton":"prudent"}'
LIBRE(){ echo "{\"prenom\":\"Lea\",\"email\":\"$1\",\"fonction\":\"Gérante\",\"referent\":\"Lea Martin\",\"newsletter\":false,\"niveau\":\"public\",\"score\":100,\"palier\":\"pilotage\",\"reponses\":$REP}"; }
sup(){ curl -s -o /tmp/r.json -w "%{http_code}" "$B$1" -H "Authorization: $STOK" ${2:+-XDELETE}; }
# Nettoyage des chartes d'un essai précédent (la limite d'envois compte les 10 dernières minutes).
curl -s -G "$B/api/collections/chartes/records" --data-urlencode "perPage=200" --data-urlencode "filter=entreprise ~ 'Test charte'" -H "Authorization: $STOK" > /tmp/c.json
for id in $(python3 -c "import json;[print(x['id']) for x in json.load(open('/tmp/c.json'))['items']]"); do sup /api/collections/chartes/records/$id del >/dev/null; done
check "règles de la charte publiques" "$(curl -s $B/api/academie/charte/regles | grep -c '"questions"')" 1
check "charte : email invalide refusé" "$(post /api/academie/charte "$(LIBRE pas-un-email)")" 400
check "charte : réponses manquantes refusées" "$(post /api/academie/charte "{\"prenom\":\"Lea\",\"email\":\"l$R@t.fr\",\"reponses\":{}}")" 400
check "charte libre enregistrée" "$(post /api/academie/charte "$(LIBRE l$R@t.fr)")" 200
check "charte : niveau recalculé côté serveur" "$(j 'd["niveau"]' < /tmp/r.json)" secret
check "charte : score falsifié ignoré" "$(j 'd["score"] < 50' < /tmp/r.json)" True
JET=$(j 'd["jeton"]' < /tmp/r.json)
check "synthèse par jeton" "$(curl -s $B/api/academie/charte/$JET | j 'd["entreprise"]')" "Test charte SARL"
check "synthèse sans email" "$(curl -s $B/api/academie/charte/$JET | grep -c '@')" 0
check "synthèse : jeton inconnu" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/academie/charte/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)" 404
check "chartes fermées au public" "$(curl -s $B/api/collections/chartes/records | j 'd["totalItems"]')" 0
check "chartes : écriture directe refusée" "$(post /api/collections/chartes/records '{"source":"libre","jeton":"x"}' $TOK)" 403
check "charte m7 refusée sans compte" "$(post /api/academie/charte/m7 "{\"reponses\":$REP}")" 401
check "charte m7 enregistrée" "$(post /api/academie/charte/m7 "{\"reponses\":$REP,\"referent\":\"Alice\"}" $TOK)" 200
M7=$(j 'd["id"]' < /tmp/r.json)
check "charte m7 : cinq règles" "$(j 'len(d["regles"])' < /tmp/r.json)" 5
check "charte m7 : règles modifiées conservées" "$(post /api/academie/charte/m7 "{\"reponses\":$REP,\"regles\":[{\"texte\":\"R1 modifiée\"},{\"texte\":\"R2\"},{\"texte\":\"R3\"},{\"texte\":\"R4\"},{\"texte\":\"R5\"}]}" $TOK >/dev/null; j 'd["regles"][0]["texte"]' < /tmp/r.json)" "R1 modifiée"
check "charte m7 : mise à jour sans doublon" "$(j 'd["id"]' < /tmp/r.json)" "$M7"
check "charte m7 visible de son auteur" "$(curl -s "$B/api/collections/chartes/records?filter=source='m7'" -H "Authorization: $TOK" | j 'd["totalItems"]')" 1
check "charte libre d'un autre invisible" "$(curl -s "$B/api/collections/chartes/records?filter=source='libre'" -H "Authorization: $TOK" | j 'd["totalItems"]')" 0
check "charte m7 visible de l'évaluateur" "$(curl -s "$B/api/collections/chartes/records?filter=id='$M7'" -H "Authorization: $ETOK" | j 'd["totalItems"]')" 1
post /api/collections/users/records "{\"email\":\"l$R@t.fr\",\"password\":\"Test-12345\",\"passwordConfirm\":\"Test-12345\",\"name\":\"Lea\"}" >/dev/null
post /api/collections/users/auth-with-password "{\"identity\":\"l$R@t.fr\",\"password\":\"Test-12345\"}" >/dev/null; LTOK=$(j 'd["token"]' < /tmp/r.json)
check "inscription : charte libre rattachée au compte" "$(curl -s "$B/api/collections/chartes/records?filter=source='libre'" -H "Authorization: $LTOK" | j 'd["totalItems"]')" 1
check "statistiques : chartes" "$(curl -s $B/api/academie/stats -H "Authorization: $ETOK" | j 'd["chartes"]["total"] >= 2')" True
CODE=200; N=0
while [ "$CODE" = 200 ] && [ $N -lt 12 ]; do CODE=$(post /api/academie/charte "$(LIBRE r$N$R@t.fr)"); N=$((N+1)); done
check "limite de 10 envois par IP" "$CODE" 429
exit $FAIL
