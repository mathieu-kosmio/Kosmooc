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
 * Blocs du .docx.
 * Page 1, la charte qu'on affiche et qu'on signe : cinq règles (celles de l'apprenant en mode m7), outils autorisés,
 * validation par la direction. Puis, en annexe, la charte détaillée (sections 1 à 11, annexes A et B).
 * Aucun score ni palier : ce document s'adresse aux salariés, pas au prospect.
 */
export function blocsDocx(rep, extras = {}, reglesTexte = null) {
  const date = extras.date || new Date();
  const s = synthese(rep, { ...extras, date });
  const cinq = reglesTexte || s.regles;
  const revue = new Date(date.getTime()); revue.setFullYear(revue.getFullYear() + 1);
  const mois = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const referent = String(rep.referent || extras.referent || '').trim();
  const blocs = [
    { titre: `Charte IA de ${rep.entreprise}` },
    { note: `Version 1.0 · en vigueur le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · prochaine revue avant ${mois(revue)}` },
  ];
  cinq.forEach((r, i) => { blocs.push({ h3: `${i + 1}. ${r.titre}` }, { p: r.texte }); });
  blocs.push({ h3: 'Nos outils et ce qu\'ils peuvent recevoir' });
  if (s.catalogue.length) {
    blocs.push({ tableau: {
      entetes: ['Outil', ...regles.niveaux.map((n) => regles.libelles_niveaux[n])],
      lignes: s.catalogue.map((o) => [o.libelle, ...regles.niveaux.map((n) => regles.libelles_autorisation[o.niveaux[n]])]),
    } });
  } else {
    blocs.push({ p: 'Aucun outil d\'IA n\'est utilisé à ce jour. Tout nouvel outil est validé par le référent IA avant usage (annexe, section 7).' });
  }
  blocs.push({ tableau: {
    entetes: ['Validée par la direction', 'Référent IA'],
    lignes: [['Nom : ', `Nom : ${referent}`], ['Fonction : ', 'Fonction : '], ['Date : ', 'Date : '], ['Signature :\n\n', 'Signature :\n\n']],
  } });
  blocs.push({ saut: true });
  blocs.push({ titre: 'Annexe : charte détaillée' });
  blocs.push({ note: 'Le détail des règles ci-dessus : usages autorisés, données, outils, traçabilité, formation et gouvernance.' });
  for (const sec of M.chartesComplete(rep, regles, clauses, s.niveau, { ...extras, date })) {
    if (!sec.clauses.length && !sec.tableau) continue;
    blocs.push({ h2: sec.titre });
    sec.clauses.forEach((c) => blocs.push(...blocsClause(c.texte)));
    if (sec.tableau) blocs.push({ tableau: sec.tableau });
  }
  return blocs;
}

export const nomFichier = (rep) => 'charte-ia-' + String(rep.entreprise || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.docx';
