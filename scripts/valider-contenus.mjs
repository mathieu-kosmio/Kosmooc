// Contrôle qualité des contenus, utilisé par le sous-agent recetteur et avant chaque mise en ligne.
// Usage : node scripts/valider-contenus.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const warn = [];
const modDir = join(root, 'web/src/content/modules');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

for (const f of [...walk(join(root, 'web/src/content')), ...walk(join(root, 'contenus')), ...walk(join(root, 'backend/quiz'))]) {
  const t = readFileSync(f, 'utf8');
  if (t.includes('—')) errors.push(`${f} : tiret cadratin interdit`);
  if (/socamex/i.test(t)) errors.push(`${f} : nom de client réel`);
  if (/il ne s'agit pas de/i.test(t)) warn.push(`${f} : tournure « il ne s'agit pas de » à reformuler`);
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
  for (const m of fm.matchAll(/script:\s*(\S+)/g)) if (!existsSync(join(root, 'contenus/scripts', `${m[1]}.md`))) warn.push(`${file} : script ${m[1]} pas encore écrit`);
  if (/src:\s*""/.test(fm)) warn.push(`${file} : vidéo(s) à tourner`);
}

warn.forEach((w) => console.log('ATTENTION', w));
errors.forEach((e) => console.log('ERREUR   ', e));
console.log(`\n${errors.length} erreur(s), ${warn.length} point(s) d'attention.`);
process.exit(errors.length ? 1 : 0);
