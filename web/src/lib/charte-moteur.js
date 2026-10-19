// Moteur de la charte IA côté navigateur : le même fichier que le serveur (backend/charte/moteur.js),
// importé en texte puis évalué ici, avec les questions, règles et clauses embarquées au build.
import questions from '../../../backend/charte/questions.json';
import regles from '../../../backend/charte/regles.json';
import clauses from '../../../backend/charte/clauses.json';
import source from '../../../backend/charte/moteur.js?raw';

const M = (() => {
  const module = { exports: {} };
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports;
})();

export { questions, regles, clauses };
export const valider = (brut) => M.valider(brut, questions);
export const synthese = (rep, extras) => M.synthese(rep, regles, clauses, extras);

export const PIED = 'Modèle généré par PerfIA (Kosmio × Xylofutur), à adapter et à faire valider. Ce document ne constitue pas un conseil juridique.';

// Convertit les clauses (lignes « - », « ### ») en blocs pour docx().
function blocsClause(texte) {
  return texte.split('\n').filter((l) => l.trim()).map((l) => {
    if (l.startsWith('### ')) return { h3: l.slice(4) };
    if (l.startsWith('- ')) return { puce: l.slice(2) };
    return { p: l };
  });
}

/**
 * Blocs du .docx : couverture, charte en cinq règles (celles de l'apprenant en mode m7), puis sections 1 à 11 et annexes.
 * `reglesTexte` remplace les cinq règles générées.
 */
export function blocsDocx(rep, extras = {}, reglesTexte = null) {
  const date = extras.date || new Date();
  const s = synthese(rep, { ...extras, date });
  const cinq = reglesTexte || s.regles;
  const blocs = [
    { titre: `Charte IA : ${rep.entreprise}` },
    { note: `Charte générée avec PerfIA, Kosmio × Xylofutur · niveau de données ${s.niveau_libelle} · maturité ${s.palier_libelle} (${s.score} sur 100)` },
    { h2: 'La charte en cinq règles' },
  ];
  cinq.forEach((r, i) => { blocs.push({ h3: `${i + 1}. ${r.titre}` }, { p: r.texte }); });
  blocs.push({ saut: true });
  blocs.push({ h2: 'La charte complète' });
  for (const sec of M.chartesComplete(rep, regles, clauses, s.niveau, { ...extras, date })) {
    if (!sec.clauses.length && !sec.tableau) continue;
    blocs.push({ h2: sec.titre });
    sec.clauses.forEach((c) => blocs.push(...blocsClause(c.texte)));
    if (sec.tableau) blocs.push({ tableau: sec.tableau });
  }
  return blocs;
}

export const nomFichier = (rep) => 'charte-ia-' + String(rep.entreprise || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.docx';
