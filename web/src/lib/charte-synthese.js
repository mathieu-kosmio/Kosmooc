// Rendu de la synthèse d'une charte IA : à l'écran après l'envoi, et sur /charte/synthese/?j=<jeton>.
// Ordre voulu : le constat, les règles, les outils, ce qui pèse sur le score, puis les prochaines étapes (fin du parcours).
import { regles } from './charte-moteur.js';
import { esc } from './pb.js';

const URL_CHOIX_IA = 'https://perfia.kosm.io/choix-ia.html?utm_source=charte&utm_medium=synthese';
const URL_RDV = 'https://cal.com/kosmio/ia-automatisation';

export function lienInscription({ email = '', entreprise = '', maillon = '' } = {}) {
  const p = new URLSearchParams({ source: 'charte' });
  if (email) p.set('email', email);
  if (entreprise) p.set('entreprise', entreprise);
  if (maillon) p.set('maillon', maillon);
  return '/inscription/?' + p.toString();
}

const CLASSE = { oui: 'ok', anonymisation: 'warn', validation: 'warn', verifier: 'warn', non: 'no' };

// Le tableau des outils, avec un libellé lisible sans couleur (Oui, Non, Après anonymisation).
export function tableauOutils(catalogue) {
  if (!catalogue.length) return '<p class="t-small">Aucun outil d\'IA déclaré. Commencez par une offre professionnelle hébergée en Europe.</p>';
  const cols = regles.niveaux.map((n) => `<th scope="col">${esc(regles.libelles_niveaux[n])}</th>`).join('');
  const lignes = catalogue.map((o) => `<tr><th scope="row">${esc(o.libelle)}<small>${esc(o.categorie_libelle)}</small></th>${regles.niveaux.map((n) => `<td class="ch-auth ch-auth--${CLASSE[o.niveaux[n]]}">${esc(regles.libelles_autorisation[o.niveaux[n]])}</td>`).join('')}</tr>`).join('');
  return `<div class="wg-scroll"><table class="ch-table"><thead><tr><th scope="col">Outil</th>${cols}</tr></thead><tbody>${lignes}</tbody></table></div>`;
}

export function constatHtml(data) {
  return `<p class="ch-constat">Vos données les plus sensibles sont de niveau <strong>${esc(data.niveau_libelle)}</strong>. ${esc(data.niveau_explication || '')}</p>
    ${data.outils_insuffisants ? '<p class="ch-alerte">Aucun de vos outils actuels ne peut recevoir ces données, même anonymisées. Votre charte limite donc l’IA aux informations publiques jusqu’à la souscription d’une offre professionnelle.</p>' : ''}`;
}

/**
 * data : { entreprise, maillon, niveau_libelle, niveau_explication, outils_insuffisants, score, detail, palier_libelle,
 *          faiblesses, catalogue, recommandations: [{ id, titre, texte, lien, type, action }], regles: [{ titre, texte }] }
 */
export function syntheseHtml(data, ctx = {}) {
  const inscription = lienInscription({ ...ctx, entreprise: data.entreprise, maillon: data.maillon });
  const criteres = regles.score.criteres.map((c) => {
    const pts = data.detail[c.id] ?? 0;
    return `<li><span>${esc(c.libelle)}</span><span class="ch-bar" aria-hidden="true"><i style="width:${Math.round((pts / c.max) * 100)}%"></i></span><strong>${pts}/${c.max}</strong></li>`;
  }).join('');
  const faiblesses = (data.faiblesses || []).map((f) => `<li><strong>${esc(f.libelle)} :</strong> ${esc(f.texte)}</li>`).join('');

  // Prochaines étapes : les recommandations, puis l'Académie et l'échange si elles n'y figurent pas déjà.
  const etapes = data.recommandations.map((r) => ({
    titre: r.titre, texte: r.texte, action: r.action,
    href: r.type === 'inscription' ? inscription : r.lien, externe: r.type === 'externe',
  }));
  const ids = new Set(data.recommandations.map((r) => r.id));
  if (!ids.has('former')) etapes.push({ titre: 'Former votre équipe', texte: 'Une charte ne tient que si l’équipe la comprend. L’Académie PerfIA forme en 8 à 10 heures, sur vos propres dossiers.', action: 'Rejoindre l’Académie', href: inscription });
  if (!ids.has('deployer')) etapes.push({ titre: 'En parler 30 minutes', texte: 'Un échange pour relire votre charte et choisir vos outils avec nous.', action: 'Réserver un créneau', href: URL_RDV, externe: true });
  if (!ids.has('sortir_comptes') && !data.catalogue.length) etapes.push({ titre: 'Choisir vos outils', texte: 'Neuf questions pour trouver l’abonnement adapté à vos usages.', action: 'Faire le diagnostic', href: URL_CHOIX_IA, externe: true });

  return `
    <div class="ch-synth">
      <h2 class="ch-synth__titre">Charte IA de ${esc(data.entreprise)}</h2>
      ${constatHtml(data)}
      <section aria-labelledby="ch-t-regles">
        <h3 id="ch-t-regles">Vos cinq règles</h3>
        <ol class="ch-regles">${data.regles.map((r) => `<li><strong>${esc(r.titre)}</strong><p>${esc(r.texte)}</p></li>`).join('')}</ol>
      </section>
      <section aria-labelledby="ch-t-outils">
        <h3 id="ch-t-outils">Ce que vos outils peuvent recevoir</h3>
        ${tableauOutils(data.catalogue)}
      </section>
      <section aria-labelledby="ch-t-score">
        <h3 id="ch-t-score">Maturité : ${esc(data.palier_libelle)}, ${data.score} sur 100</h3>
        <ul class="ch-criteres">${criteres}</ul>
        ${faiblesses ? `<ul class="ch-faiblesses">${faiblesses}</ul>` : ''}
      </section>
      <section class="ch-etapes no-print" aria-labelledby="ch-t-etapes">
        <h3 id="ch-t-etapes">Vos prochaines étapes</h3>
        <ol class="ch-etapes__liste">${etapes.map((e) => `<li><div><strong>${esc(e.titre)}</strong><p>${esc(e.texte)}</p></div><a class="btn btn--secondary btn--sm" href="${esc(e.href)}"${e.externe ? ' target="_blank" rel="noopener"' : ''}>${esc(e.action)}${e.externe ? ' ↗' : ' →'}</a></li>`).join('')}</ol>
      </section>
      <p class="ch-mention">Modèle généré par PerfIA (Kosmio × Xylofutur), à adapter et à faire valider. Ce document ne constitue pas un conseil juridique.</p>
    </div>`;
}
