// Contrôle qualité des contenus, utilisé par le sous-agent recetteur et avant chaque mise en ligne.
// Usage : node scripts/valider-contenus.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const warn = [];
const modDir = join(root, 'web/src/content/modules');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

for (const f of [...walk(join(root, 'web/src/content')), ...walk(join(root, 'contenus')), ...walk(join(root, 'backend/quiz')), ...walk(join(root, 'backend/charte')).filter((x) => x.endsWith('.json')), ...walk(join(root, 'web/public/ressources')).filter((x) => /\.(md|txt)$/.test(x))]) {
  const t = readFileSync(f, 'utf8');
  if (t.includes('—')) errors.push(`${f} : tiret cadratin interdit`);
  if (/socamex/i.test(t)) errors.push(`${f} : nom de client réel`);
  if (/il ne s'agit pas de/i.test(t)) warn.push(`${f} : tournure « il ne s'agit pas de » à reformuler`);
  if (/ia-bois\.kosm\.io|ia-bois point kosm/i.test(t)) errors.push(`${f} : ancienne adresse ia-bois.kosm.io, utiliser perfia.kosm.io`);
  if (/ch[êe]ne[^\n]{0,40}\bC(14|16|18|20|22|24|27|30)\b/i.test(t)) errors.push(`${f} : classe de résistance résineux (C..) associée au chêne, les feuillus sont en classe D`);
  if (/(?<!« )\bskill\b|\bbaseline\b/i.test(t)) warn.push(`${f} : anglicisme (skill, baseline) à traduire pour le public filière`);
}

// ---------- Générateur de charte IA : cohérence des questions, règles et clauses ----------
{
  const dir = join(root, 'backend/charte');
  const lire = (n) => { try { return JSON.parse(readFileSync(join(dir, n + '.json'), 'utf8')); } catch (e) { errors.push(`backend/charte/${n}.json : JSON invalide (${e.message})`); return null; } };
  const Q = lire('questions'), R = lire('regles'), C = lire('clauses');
  if (Q && R && C) {
    for (const n of ['questions', 'regles', 'clauses']) if (/imprim/i.test(readFileSync(join(dir, n + '.json'), 'utf8'))) errors.push(`backend/charte/${n}.json : ne jamais parler d'imprimer, toujours de télécharger en PDF`);
    const q = Object.fromEntries(Q.questions.map((x) => [x.cle, x]));
    const vals = (cle) => (q[cle].options || []).map((o) => o.v);
    for (const cle of ['entreprise', 'maillon', 'effectif', 'pilote', 'referent', 'outils', 'payes', 'usages', 'formation', 'donnees', 'confidentialite', 'souverainete', 'ton']) if (!q[cle]) errors.push(`questions.json : question « ${cle} » absente`);
    if (Q.ecrans.flatMap((e) => e.questions).sort().join() !== Object.keys(q).sort().join()) errors.push('questions.json : chaque question doit figurer dans exactement un écran');
    // Chaque réponse doit avoir son effet dans les règles
    for (const d of vals('donnees')) if (!R.niveau_par_donnee[d]) errors.push(`regles.json : niveau_par_donnee sans « ${d} »`);
    for (const o of vals('outils').filter((x) => !(q.outils.exclusives || []).includes(x))) {
      if (!R.outils[o]) errors.push(`regles.json : outil « ${o} » sans catégorie`);
      if (!R.libelles_outils[o]) errors.push(`regles.json : outil « ${o} » sans libellé`);
    }
    for (const u of vals('usages')) if (!R.libelles_usages[u] || !R.libelles_usages_courts[u]) errors.push(`regles.json : usage « ${u} » sans libellé (long et court)`);
    for (const d of vals('donnees')) if (!R.libelles_donnees[d]) errors.push(`regles.json : donnée « ${d} » sans libellé`);
    for (const m of vals('maillon')) if (!R.libelles_maillons[m]) errors.push(`regles.json : maillon « ${m} » sans libellé`);
    for (const c of Object.values(R.outils)) if (!R.matrice[c]) errors.push(`regles.json : catégorie « ${c} » absente de la matrice`);
    for (const [c, m] of Object.entries(R.matrice)) for (const n of R.niveaux) if (!R.libelles_autorisation[m[n]]) errors.push(`regles.json : matrice ${c}/${n} : valeur « ${m[n]} » inconnue`);
    for (const id of ['former', 'sortir_comptes', 'garder_donnees', 'cas_processotheque', 'deployer']) if (!R.recommandations[id]) errors.push(`regles.json : recommandation « ${id} » absente`);
    // Clauses : sections connues, conditions valides, variables connues, trois tons si variantes
    const sections = new Set([...R.titres_regles.map((_, i) => 'regle' + (i + 1)), ...Object.keys(R.titres_sections)]);
    const cles = new Set([...Object.keys(q), 'niveau', 'categories', 'outils_insuffisants', 'donnees_secret', 'donnees_confidentiel']);
    const variables = new Set(['entreprise', 'referent', 'date_entree', 'date_revue', 'niveau_libelle', 'maillon_libelle', 'usages_liste', 'donnees_conf_liste', 'donnees_secret_liste', 'outils_personnels']);
    const ids = new Set();
    for (const c of C.clauses) {
      if (ids.has(c.id)) errors.push(`clauses.json : identifiant « ${c.id} » en double`); ids.add(c.id);
      if (!sections.has(c.section)) errors.push(`clauses.json : ${c.id} : section « ${c.section} » inconnue`);
      for (const [k, v] of Object.entries(c.condition || {})) {
        if (!cles.has(k)) errors.push(`clauses.json : ${c.id} : condition sur « ${k} » inconnue`);
        else if (q[k]?.options) for (const x of [].concat(v)) if (!vals(k).includes(x)) errors.push(`clauses.json : ${c.id} : valeur « ${x} » inconnue pour ${k}`);
      }
      const textes = typeof c.texte === 'string' ? [c.texte] : ['encourageant', 'prudent', 'strict'].map((t) => c.texte[t] ?? (errors.push(`clauses.json : ${c.id} : ton « ${t} » manquant`), ''));
      for (const t of textes) for (const m of t.matchAll(/\{\{(\w+)\}\}/g)) if (!variables.has(m[1])) errors.push(`clauses.json : ${c.id} : variable {{${m[1]}}} inconnue`);
    }
    for (let i = 1; i <= 5; i++) if (!C.clauses.some((c) => c.section === 'regle' + i)) errors.push(`clauses.json : aucune clause pour la règle ${i}`);
    // Cohérence de la charte produite, sur des profils représentatifs : la charte ne doit jamais autoriser
    // ce que son propre catalogue interdit, ni laisser une variable non remplie.
    const M = createRequire(import.meta.url)(join(dir, 'moteur.js'));
    const choix = (cle) => vals(cle).filter((v) => !(q[cle].exclusives || []).includes(v));
    const profils = [];
    for (const outils of [['aucun'], ['chatgpt'], ['chatgpt', 'copilot'], ['mistral', 'logiciel_metier'], ['claude', 'gemini']])
      for (const payes of [[], outils.slice(0, 1)])
        for (const donnees of [['aucune'], ['fournisseurs'], ['devis', 'clients'], ['plans'], ['rh', 'procedes']])
          for (const confidentialite of ['souvent', 'non'])
            for (const effectif of ['1-9', '50-249'])
              profils.push({ entreprise: 'Test', maillon: 'bureau_etudes', effectif, pilote: 'personne', referent: '', outils, payes, usages: choix('usages').slice(0, 4), formation: 'aucun', donnees, confidentialite, souverainete: 'exigence', ton: 'strict' });
    const incoherences = new Set();
    // Export vers les assistants (web/src/lib/charte-skill.js) : sous la limite, nom de skill valide, pas de tiret cadratin.
    const X = await import(join(root, 'web/src/lib/charte-skill.js'));
    for (const brut of profils) {
      const v = M.valider(brut, Q);
      if (!v.ok) { incoherences.add(`profil invalide (${v.erreurs.join(', ')})`); continue; }
      const s = M.synthese(v.reponses, R, C, {});
      const sections = M.chartesComplete(v.reponses, R, C, s.niveau, {});
      const texte = [...s.regles.map((r) => r.texte), ...sections.flatMap((x) => x.clauses.map((c) => c.texte))].join('\n');
      const ids = new Set(sections.flatMap((x) => x.clauses.map((c) => c.id)));
      const recoitConfidentiel = s.catalogue.some((o) => o.niveaux.confidentiel !== 'non');
      if (/\{\{/.test(texte)) incoherences.add('variable non remplie dans la charte');
      if (ids.has('sB-devis') && s.catalogue.length && !recoitConfidentiel && ['confidentiel', 'secret'].includes(s.niveau)) incoherences.add('la FAQ autorise les devis alors qu\'aucun outil ne peut les recevoir');
      if (s.outils_insuffisants && !ids.has('s3-suspendu')) incoherences.add('usages autorisés sans suspension alors qu\'aucun outil ne peut recevoir les données');
      if (s.catalogue.some((o) => o.categorie === 'personnel') && !ids.has('s7-personnel')) incoherences.add('comptes personnels au catalogue sans clause qui les encadre');
      if (s.catalogue.some((o) => o.outil === 'copilot' && o.categorie === 'personnel')) incoherences.add('Copilot Microsoft 365 classé en compte personnel');
      if (s.regles.some((r) => r.texte.split(/\s+/).length > 55)) incoherences.add('une des cinq règles dépasse 55 mots');
      for (const e of X.exportsOutils({ ...s, entreprise: brut.entreprise }, v.reponses, R)) {
        try {
          const t = e.texte ? e.texte() : '';
          const f = e.fichiers ? e.fichiers() : [];
          if ([t, ...f.map((x) => x[1])].some((x) => x.includes('—'))) incoherences.add(`export ${e.outil} : tiret cadratin`);
          if (f.length) {
            const [chemin, md] = f[0];
            const nom = (md.match(/^name: (.+)$/m) || [])[1] || '';
            const desc = JSON.parse((md.match(/^description: (.+)$/m) || [])[1] || '""');
            if (!/^[a-z0-9-]{1,64}$/.test(nom) || /claude|anthropic/.test(nom) || chemin !== nom + '/SKILL.md') incoherences.add(`skill ${e.outil} : nom « ${nom} » invalide ou différent du dossier`);
            if (!desc || desc.length > 1024 || /[<>]/.test(desc)) incoherences.add(`skill ${e.outil} : description vide, trop longue ou avec < >`);
          }
        } catch (err) { incoherences.add(`export ${e.outil} : ${err.message}`); }
      }
    }
    for (const x of incoherences) errors.push(`charte générée : ${x}`);
    for (const sec of Object.keys(R.titres_sections)) if (!['6', '7'].includes(sec) && !C.clauses.some((c) => c.section === sec)) errors.push(`clauses.json : aucune clause pour la section ${sec}`);
  }
}

for (const file of readdirSync(modDir).filter((x) => x.endsWith('.md'))) {
  const t = readFileSync(join(modDir, file), 'utf8');
  const fm = t.split('---')[1] || '';
  const id = (fm.match(/^id:\s*(\S+)/m) || [])[1];
  if (`${id}.md` !== file) errors.push(`${file} : id « ${id} » différent du nom de fichier`);
  const quiz = /^quiz:\s*true/m.test(fm);
  const qf = join(root, 'backend/quiz', `${id}.json`);
  if (quiz && !existsSync(qf)) errors.push(`${file} : quiz: true mais ${qf} absent`);
  if (quiz && existsSync(qf)) {
    try {
      const q = JSON.parse(readFileSync(qf, 'utf8'));
      if (q.module !== id) errors.push(`${qf} : module « ${q.module} » attendu « ${id} »`);
      for (const x of q.questions) {
        if (!x.id || !x.enonce || !Array.isArray(x.choix) || !Array.isArray(x.bonnes) || !x.bonnes.length) errors.push(`${qf} : question ${x.id} incomplète`);
        if (x.bonnes.some((b) => b < 0 || b >= x.choix.length)) errors.push(`${qf} : ${x.id} bonne réponse hors des choix`);
        if (!x.explication) warn.push(`${qf} : ${x.id} sans explication`);
      }
    } catch (e) { errors.push(`${qf} : JSON invalide (${e.message})`); }
  }
  if (/^exercice:\s*true/m.test(fm) && !/^## Exercice/m.test(t)) errors.push(`${file} : exercice: true sans section « ## Exercice »`);
  for (const m of fm.matchAll(/type:\s*fiche\s*\n\s*ref:\s*(\S+)/g)) if (!existsSync(join(root, 'web/src/content/fiches', `${m[1]}.md`))) errors.push(`${file} : fiche ${m[1]} absente`);
  for (const m of fm.matchAll(/type:\s*fichier\s*\n\s*ref:\s*(\S+)/g)) if (!existsSync(join(root, 'web/public/ressources', m[1]))) errors.push(`${file} : ressource ${m[1]} absente`);
  for (const m of fm.matchAll(/type:\s*fichier\s*\n\s*ref:\s*(\S+)/g)) if (!/\.(docx|xlsx|pdf)$/.test(m[1])) errors.push(`${file} : ressource ${m[1]} : à remplir en .docx (ou .xlsx), à lire en .pdf ; pas de .txt ni de .md`);
  for (const m of fm.matchAll(/script:\s*(\S+)/g)) if (!existsSync(join(root, 'contenus/scripts', `${m[1]}.md`))) warn.push(`${file} : script ${m[1]} pas encore écrit`);
  if (/src:\s*""/.test(fm)) warn.push(`${file} : vidéo(s) à tourner`);
}

// ---------- Parcours : modules existants, numéros uniques, badges définis ----------
{
  const P = JSON.parse(readFileSync(join(root, 'backend/parcours.json'), 'utf8'));
  if (JSON.stringify(P).includes('—')) errors.push('backend/parcours.json : tiret cadratin interdit');
  const ids = new Set(readdirSync(modDir).filter((x) => x.endsWith('.md')).map((x) => x.replace(/\.md$/, '')));
  const utilises = new Set();
  for (const p of P.parcours) {
    const labels = new Set();
    for (const m of p.modules) {
      if (!ids.has(m.id)) errors.push(`parcours ${p.id} : module ${m.id} absent de web/src/content/modules`);
      if (labels.has(m.label)) errors.push(`parcours ${p.id} : numéro ${m.label} en double`);
      labels.add(m.label); utilises.add(m.id);
    }
    if (!P.badges[p.badge]) errors.push(`parcours ${p.id} : badge ${p.badge} non défini`);
    for (const ph of p.phases || []) for (const m of ph.modules) if (!p.modules.some((x) => x.id === m)) errors.push(`parcours ${p.id} : phase « ${ph.titre} » : ${m} hors du parcours`);
  }
  for (const id of ids) if (!utilises.has(id)) warn.push(`module ${id} dans aucun parcours`);
  for (const [code, b] of Object.entries(P.badges)) for (const m of b.requis || []) if (!ids.has(m)) errors.push(`badge ${code} : module requis ${m} absent`);
}

warn.forEach((w) => console.log('ATTENTION', w));
errors.forEach((e) => console.log('ERREUR   ', e));
console.log(`\n${errors.length} erreur(s), ${warn.length} point(s) d'attention.`);
process.exit(errors.length ? 1 : 0);
