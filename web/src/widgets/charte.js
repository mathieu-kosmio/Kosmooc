// Générateur de charte IA. Deux modes :
//   libre : visiteur sans compte, 12 questions, aperçu, puis formulaire de lead (aucune donnée envoyée avant)
//   m7    : apprenant connecté, champs du profil préremplis, cinq règles réécrites dans des champs modifiables
import { shell, esc, flash } from './util.js';
import { docx, downloadBlob } from './docx.js';
import { pb, user, errMsg } from '../lib/pb.js';
import { questions, valider, synthese, blocsDocx, nomFichier, PIED } from '../lib/charte-moteur.js';
import { syntheseHtml } from '../lib/charte-synthese.js';

const parCle = Object.fromEntries(questions.questions.map((q) => [q.cle, q]));
const NB_ECRANS = questions.ecrans.length;

function utmDepuisUrl() {
  const p = new URLSearchParams(window.location.search);
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => { if (p.get(k)) out[k] = p.get(k); });
  return out;
}

export default async function charte(el, ds) {
  const mode = ds.mode === 'm7' ? 'm7' : 'libre';
  const u = user();
  const body = shell(el, mode === 'm7'
    ? { eyebrow: 'Activité · votre charte', titre: 'Générer la charte IA de votre entreprise', consigne: 'Répondez aux douze questions : le générateur propose cinq règles de départ, que vous réécrivez ensuite avec vos mots.' }
    : { eyebrow: 'Outil gratuit', titre: 'Générez la charte IA de votre entreprise', consigne: 'Douze questions, cinq minutes. Rien n’est envoyé avant que vous ne demandiez votre charte.' });

  if (mode === 'm7' && !u) {
    body.innerHTML = `<p class="wg-note">Connectez-vous pour générer et enregistrer votre charte. <a href="/connexion/?suite=${encodeURIComponent(window.location.pathname)}">Se connecter</a></p>`;
    return;
  }

  const st = { etape: 0, rep: { outils: [], usages: [], donnees: [] }, regles: null, referent: '', saved: null, resultat: null };
  if (mode === 'm7') {
    st.rep.entreprise = u.entreprise || '';
    st.rep.maillon = u.maillon || '';
    try {
      const r = await pb.collection('chartes').getList(1, 1, { filter: pb.filter('user = {:u} && source = "m7"', { u: u.id }), sort: '-updated' });
      if (r.items[0]) {
        const c = r.items[0];
        st.rep = { ...st.rep, ...(typeof c.reponses === 'string' ? JSON.parse(c.reponses) : c.reponses) };
        st.regles = (typeof c.regles === 'string' ? JSON.parse(c.regles) : c.regles).map((x) => ({ titre: x.titre, texte: x.texte }));
        st.referent = c.referent || '';
        st.saved = c;
        st.etape = NB_ECRANS;
      }
    } catch (_) { /* première visite ou lecture impossible : on part de zéro */ }
  }

  // ---------- Questionnaire ----------
  const champ = (q) => {
    const v = st.rep[q.cle];
    if (q.type === 'texte') return `<fieldset class="ch-q"><legend><label for="ch-${q.cle}">${esc(q.libelle)}</label></legend><input type="text" id="ch-${q.cle}" data-cle="${q.cle}" maxlength="${q.max}" value="${esc(v || '')}" autocomplete="organization"></fieldset>`;
    const multi = q.type === 'multiple';
    const opts = q.options.map((o) => {
      const on = multi ? (v || []).includes(o.v) : v === o.v;
      return `<label class="ch-opt"><input type="${multi ? 'checkbox' : 'radio'}" name="ch-${q.cle}" data-cle="${q.cle}" value="${esc(o.v)}"${on ? ' checked' : ''}><span>${esc(o.l)}</span></label>`;
    }).join('');
    return `<fieldset class="ch-q"><legend>${esc(q.libelle)}${multi ? ' <small class="wg-muted">(plusieurs réponses possibles)</small>' : ''}</legend><div class="ch-opts">${opts}</div></fieldset>`;
  };

  const manquantes = (ecran) => ecran.questions.map((c) => parCle[c]).filter((q) => {
    if (!q.requis) return false;
    const v = st.rep[q.cle];
    return Array.isArray(v) ? !v.length : !String(v || '').trim();
  });

  function vueQuestions() {
    const ecran = questions.ecrans[st.etape];
    body.innerHTML = `
      <div class="ch-progress"><span>Étape ${st.etape + 1} sur ${NB_ECRANS} · ${esc(ecran.titre)}</span><span class="ch-progress__bar" aria-hidden="true"><i style="width:${((st.etape + 1) / (NB_ECRANS + 1)) * 100}%"></i></span></div>
      ${ecran.questions.map((c) => champ(parCle[c])).join('')}
      <div id="ch-msg" role="alert"></div>
      <div class="ch-nav">
        ${st.etape > 0 ? '<button type="button" class="btn btn--ghost btn--sm" data-act="prec">← Précédent</button>' : '<span></span>'}
        <button type="button" class="btn btn--primary btn--sm" data-act="suiv">${st.etape === NB_ECRANS - 1 ? 'Voir mon aperçu →' : 'Suivant →'}</button>
      </div>`;
  }

  const lire = (t) => {
    const cle = t.dataset.cle;
    if (!cle) return;
    const q = parCle[cle];
    if (q.type === 'texte') st.rep[cle] = t.value;
    else if (q.type === 'choix') st.rep[cle] = t.value;
    else {
      const excl = q.exclusives || [];
      let cur = new Set(st.rep[cle] || []);
      if (t.checked) { if (excl.includes(t.value)) cur = new Set([t.value]); else excl.forEach((x) => cur.delete(x)); cur.add(t.value); } else cur.delete(t.value);
      st.rep[cle] = [...cur];
      body.querySelectorAll(`input[data-cle="${cle}"]`).forEach((i) => { i.checked = cur.has(i.value); });
    }
  };

  // ---------- Aperçu (libre) ----------
  const apercu = () => synthese(valider(st.rep).reponses, { referent: st.referent });

  function vueApercu() {
    const s = apercu();
    body.innerHTML = `
      <div class="ch-apercu">
        <div class="wg-stats">
          <div><strong>${esc(s.niveau_libelle)}</strong><span>niveau de données le plus élevé</span></div>
          <div><strong>${s.score} / 100</strong><span>score de maturité</span></div>
          <div><strong>${esc(s.palier_libelle)}</strong><span>palier</span></div>
        </div>
        <h4>Votre charte en cinq règles</h4>
        <ol>${s.regles.map((r) => `<li><strong>${esc(r.titre)}</strong><p>${esc(r.texte)}</p></li>`).join('')}</ol>
      </div>
      <div class="ch-teaser"><strong>Dans votre charte complète :</strong>
        <ul><li>11 sections et 2 annexes, à télécharger en .docx, adaptées à vos usages et à vos données</li><li>le catalogue de vos outils classés selon vos données</li><li>trois recommandations pour la suite</li></ul></div>
      <form class="ch-form" id="ch-form" novalidate>
        <div class="row">
          <div class="field"><label for="ch-prenom">Prénom</label><input id="ch-prenom" name="prenom" type="text" required autocomplete="given-name"></div>
          <div class="field"><label for="ch-email">Email professionnel</label><input id="ch-email" name="email" type="email" required autocomplete="email"></div>
        </div>
        <div class="row">
          <div class="field"><label for="ch-fonction">Fonction</label><input id="ch-fonction" name="fonction" type="text" autocomplete="organization-title"></div>
          <div class="field"><label for="ch-referent">Nom du référent IA <small>(facultatif)</small></label><input id="ch-referent" name="referent" type="text" maxlength="200"></div>
        </div>
        <label class="check"><input type="checkbox" name="newsletter"> <span>Je souhaite recevoir les actualités PerfIA (facultatif).</span></label>
        <p class="t-small wg-muted">Kosmio, responsable du traitement, utilise ces données pour vous envoyer votre charte, assurer le suivi commercial de votre demande et, si vous cochez la case, vous écrire sur l’actualité PerfIA. <a href="/confidentialite/">En savoir plus</a>.</p>
        <div id="ch-msg" role="alert"></div>
        <div class="ch-nav"><button type="button" class="btn btn--ghost btn--sm" data-act="prec">← Modifier mes réponses</button><button type="submit" class="btn btn--primary">Recevoir ma charte complète →</button></div>
      </form>`;
    body.querySelector('#ch-form').addEventListener('submit', envoyerLibre);
  }

  async function envoyerLibre(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const get = (k) => String(f.get(k) || '').trim();
    const msg = body.querySelector('#ch-msg');
    if (!get('prenom') || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(get('email'))) {
      msg.innerHTML = '<div class="alert alert--error">Merci d’indiquer votre prénom et une adresse email valide.</div>';
      return;
    }
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const rep = valider(st.rep).reponses;
      const res = await pb.send('/api/academie/charte', {
        method: 'POST',
        body: { prenom: get('prenom'), email: get('email'), fonction: get('fonction'), referent: get('referent'), newsletter: f.get('newsletter') === 'on', utm: utmDepuisUrl(), reponses: rep },
      });
      st.referent = get('referent');
      st.resultat = { jeton: res.jeton, email: get('email') };
      await vueResultatLibre(rep);
    } catch (err) {
      btn.disabled = false;
      msg.innerHTML = `<div class="alert alert--error">${esc(errMsg(err))}</div>`;
    }
  }

  const telecharger = (rep, regles = null) => downloadBlob(nomFichier(rep), docx(blocsDocx(rep, { referent: st.referent }, regles), { pied: PIED }));

  async function vueResultatLibre(rep) {
    // La synthèse affichée est celle que le serveur a recalculée.
    let data;
    try {
      data = await pb.send('/api/academie/charte/' + st.resultat.jeton, { method: 'GET' });
    } catch (_) {
      const s = synthese(rep, { referent: st.referent });
      data = { entreprise: rep.entreprise, maillon: rep.maillon, niveau_libelle: s.niveau_libelle, score: s.score, detail: s.detail, palier_libelle: s.palier_libelle, catalogue: s.catalogue, recommandations: s.recommandations_detail, regles: s.regles };
    }
    body.innerHTML = `
      <div class="alert alert--ok">Votre charte est prête. Elle se télécharge automatiquement ; un récapitulatif vous est aussi envoyé par email.</div>
      <div class="wg-actions no-print">
        <button type="button" class="btn btn--primary btn--sm" data-act="docx">Télécharger la charte complète (.docx)</button>
        <button type="button" class="btn btn--secondary btn--sm" data-act="pdf">Télécharger la synthèse en PDF</button>
        <a class="t-small" href="/charte/synthese/?j=${esc(st.resultat.jeton)}">Lien de votre synthèse</a>
      </div>
      ${syntheseHtml(data, { email: st.resultat.email })}`;
    try { telecharger(rep); } catch (err) { console.error(err); }
  }

  // ---------- Règles modifiables (m7) ----------
  function vueRegles() {
    const rep = valider(st.rep).reponses;
    if (!st.regles) st.regles = synthese(rep, { referent: st.referent }).regles.map((r) => ({ titre: r.titre, texte: r.texte }));
    const s = synthese(rep, { referent: st.referent });
    body.innerHTML = `
      <div class="wg-stats">
        <div><strong>${esc(s.niveau_libelle)}</strong><span>niveau de données le plus élevé</span></div>
        <div><strong>${s.score} / 100</strong><span>score de maturité</span></div>
        <div><strong>${esc(s.palier_libelle)}</strong><span>palier</span></div>
      </div>
      <p class="wg-note">Voici cinq règles de départ. Réécrivez chacune avec vos mots, en une à deux phrases : une charte courte, comprise et applicable dès demain.</p>
      ${st.regles.map((r, i) => `<div class="ch-rule"><label for="ch-r${i}">${i + 1}. ${esc(r.titre)}</label><textarea id="ch-r${i}" data-regle="${i}" maxlength="2000">${esc(r.texte)}</textarea></div>`).join('')}
      <div class="field"><label for="ch-referent">Personne responsable de la charte</label><input id="ch-referent" type="text" maxlength="200" value="${esc(st.referent)}"><small>Elle apparaît dans la charte, avec une date de revue à 12 mois.</small></div>
      <div id="ch-msg" role="alert">${st.saved ? '<div class="alert alert--info">Charte enregistrée précédemment : vous pouvez la modifier.</div>' : ''}</div>
      <div class="ch-nav">
        <span class="wg-actions"><button type="button" class="btn btn--ghost btn--sm" data-act="prec">← Modifier mes réponses</button><button type="button" class="wg-link" data-act="regen">Repartir de la proposition</button></span>
        <span class="wg-actions"><button type="button" class="btn btn--secondary btn--sm" data-act="docx">Télécharger en .docx</button><button type="button" class="btn btn--primary btn--sm" data-act="save">Enregistrer ma charte</button></span>
      </div>`;
  }

  async function enregistrerM7(btn) {
    const msg = body.querySelector('#ch-msg');
    const rep = valider(st.rep).reponses;
    btn.disabled = true;
    try {
      const res = await pb.send('/api/academie/charte/m7', { method: 'POST', body: { reponses: rep, regles: st.regles, referent: st.referent } });
      st.saved = { id: res.id };
      msg.innerHTML = `<div class="alert alert--ok">Charte enregistrée. Niveau de données ${esc(res.niveau)}, maturité ${esc(res.palier)} (${res.score} sur 100). Téléchargez-la en .docx et joignez-la à l’exercice ci-dessous.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="alert alert--error">${esc(errMsg(err))}</div>`;
    }
    btn.disabled = false;
  }

  // ---------- Pilotage ----------
  function afficher() {
    if (st.etape < NB_ECRANS) vueQuestions();
    else if (mode === 'm7') vueRegles();
    else vueApercu();
  }

  body.addEventListener('input', (e) => {
    if (e.target.dataset.regle !== undefined) st.regles[+e.target.dataset.regle].texte = e.target.value;
    else if (e.target.id === 'ch-referent' && mode === 'm7') st.referent = e.target.value;
  });
  body.addEventListener('change', (e) => { if (e.target.dataset.cle) lire(e.target); });
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'prec') { st.etape = Math.max(0, st.etape - 1); afficher(); el.scrollIntoView({ block: 'start' }); }
    if (act === 'suiv') {
      body.querySelectorAll('input[type="text"][data-cle]').forEach(lire);
      const m = manquantes(questions.ecrans[st.etape]);
      if (m.length) { body.querySelector('#ch-msg').innerHTML = `<div class="alert alert--error">Merci de répondre à : ${m.map((q) => esc(q.libelle)).join(' ; ')}</div>`; return; }
      st.etape++; afficher(); el.scrollIntoView({ block: 'start' });
    }
    if (act === 'regen') { st.regles = null; vueRegles(); }
    if (act === 'docx') {
      const rep = valider(st.rep).reponses;
      telecharger(rep, mode === 'm7' ? st.regles : null);
      flash(b, 'Téléchargée');
    }
    if (act === 'pdf') window.print();
    if (act === 'save') await enregistrerM7(b);
  });

  afficher();
}
