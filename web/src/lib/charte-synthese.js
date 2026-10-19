// Rendu de la synthèse d'une charte IA : à l'écran après l'envoi, et sur /charte/synthese/?j=<jeton>.
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

function tableauCatalogue(catalogue) {
  if (!catalogue.length) return '<p class="wg-note">Aucun outil d\'IA déclaré : la charte propose une offre professionnelle hébergée en Europe ou une IA privée comme point de départ.</p>';
  const cols = regles.niveaux.map((n) => `<th scope="col">${esc(regles.libelles_niveaux[n])}</th>`).join('');
  const lignes = catalogue.map((o) => `<tr><th scope="row">${esc(o.libelle)}<small>${esc(o.categorie_libelle)}</small></th>${regles.niveaux.map((n) => `<td class="ch-auth ch-auth--${CLASSE[o.niveaux[n]]}">${esc(regles.libelles_autorisation[o.niveaux[n]])}</td>`).join('')}</tr>`).join('');
  return `<div class="wg-scroll"><table class="ch-table"><thead><tr><th scope="col">Outil déclaré</th>${cols}</tr></thead><tbody>${lignes}</tbody></table></div>`;
}

/**
 * data : { entreprise, maillon, niveau_libelle, score, detail, palier, palier_libelle, catalogue,
 *          recommandations: [{ titre, texte, lien, type, action }], regles: [{ titre, texte }] }
 */
export function syntheseHtml(data, ctx = {}) {
  const criteres = regles.score.criteres.map((c) => {
    const pts = data.detail[c.id] ?? 0;
    return `<li><span>${esc(c.libelle)}</span><span class="ch-bar" aria-hidden="true"><i style="width:${Math.round((pts / c.max) * 100)}%"></i></span><strong>${pts}/${c.max}</strong></li>`;
  }).join('');
  const recos = data.recommandations.map((r) => {
    const href = r.type === 'inscription' ? lienInscription({ ...ctx, entreprise: data.entreprise, maillon: data.maillon }) : r.lien;
    const ext = r.type === 'externe' ? ' target="_blank" rel="noopener"' : '';
    return `<li class="ch-reco"><strong>${esc(r.titre)}</strong><p>${esc(r.texte)}</p><a class="btn btn--secondary btn--sm" href="${esc(href)}"${ext}>${esc(r.action)}${r.type === 'externe' ? ' ↗' : ' →'}</a></li>`;
  }).join('');
  const cinq = data.regles.map((r, i) => `<li><strong>${esc(r.titre)}</strong><p>${esc(r.texte)}</p></li>`).join('');
  return `
    <div class="ch-synth">
      <h3>Charte IA de ${esc(data.entreprise)}</h3>
      <div class="wg-stats">
        <div><strong>${esc(data.niveau_libelle)}</strong><span>niveau de données le plus élevé</span></div>
        <div><strong>${data.score} / 100</strong><span>score de maturité</span></div>
        <div><strong>${esc(data.palier_libelle)}</strong><span>palier</span></div>
      </div>
      <h4>Votre score en détail</h4>
      <ul class="ch-criteres">${criteres}</ul>
      <h4>Vos outils, classés selon vos données</h4>
      ${tableauCatalogue(data.catalogue)}
      ${recos ? `<h4>Nos recommandations</h4><ul class="ch-recos">${recos}</ul>` : ''}
      <h4>Votre charte en cinq règles</h4>
      <ol class="ch-regles">${cinq}</ol>
      <p class="t-small wg-muted">${esc('Modèle généré par PerfIA (Kosmio × Xylofutur), à adapter et à faire valider. Ce document ne constitue pas un conseil juridique.')}</p>
      <div class="ch-suites no-print">
        <h4>Et maintenant ?</h4>
        <div class="ch-suites__row">
          <a class="btn btn--primary btn--sm" href="${esc(lienInscription({ ...ctx, entreprise: data.entreprise, maillon: data.maillon }))}">Former votre équipe avec l'Académie →</a>
          <a class="btn btn--secondary btn--sm" href="${URL_CHOIX_IA}" target="_blank" rel="noopener">Choisir vos outils ↗</a>
          <a class="btn btn--secondary btn--sm" href="${URL_RDV}" target="_blank" rel="noopener">Échanger 30 minutes ↗</a>
        </div>
      </div>
    </div>`;
}
