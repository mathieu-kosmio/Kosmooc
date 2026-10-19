// Générateur de charte IA. Deux modes :
//   libre : visiteur sans compte. Questions, aperçu, puis formulaire de lead (aucune donnée envoyée avant).
//   m7    : apprenant connecté. Profil prérempli ; l'apprenant écrit ses cinq règles, la proposition reste un appui.
import { shell, esc, flash } from './util.js';
import { docx, downloadBlob } from './docx.js';
import { pb, user, errMsg } from '../lib/pb.js';
import { questions, valider, synthese, blocsDocx, nomFichier, PIED } from '../lib/charte-moteur.js';
import { syntheseHtml, tableauOutils, constatHtml, brancherInstallation } from '../lib/charte-synthese.js';

const parCle = Object.fromEntries(questions.questions.map((q) => [q.cle, q]));
const NB_ECRANS = questions.ecrans.length;

function utmDepuisUrl() {
  const p = new URLSearchParams(window.location.search);
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => { if (p.get(k)) out[k] = p.get(k); });
  return out;
}

// Remonte en haut de l'activité sans la glisser sous l'en-tête fixe du site.
function remonter(el) {
  const entete = document.querySelector('.site-header')?.offsetHeight || 0;
  const y = el.getBoundingClientRect().top + window.scrollY - entete - 16;
  if (y < window.scrollY) window.scrollTo({ top: y, behavior: 'smooth' });
}

export default async function charte(el, ds) {
  const mode = ds.mode === 'm7' ? 'm7' : 'libre';
  const u = user();
  const body = shell(el, mode === 'm7'
    ? { eyebrow: 'Activité · votre charte', titre: 'Écrire la charte IA de votre entreprise', consigne: 'Répondez aux questions, puis écrivez vos cinq règles avec vos mots. Une proposition vous sert d’appui.' }
    : { titre: '' });
  el.classList.add('wg--charte');

  if (mode === 'm7' && !u) {
    body.innerHTML = `<p class="wg-note">Connectez-vous pour écrire et enregistrer votre charte. <a href="/connexion/?suite=${encodeURIComponent(window.location.pathname)}">Se connecter</a></p>`;
    return;
  }

  const st = { etape: 0, rep: { outils: [], payes: [], usages: [], donnees: [] }, regles: null, saved: null, resultat: null };
  if (mode === 'm7') {
    st.rep.entreprise = u.entreprise || '';
    st.rep.maillon = u.maillon || '';
    try {
      const r = await pb.collection('chartes').getList(1, 1, { filter: pb.filter('user = {:u} && source = "m7"', { u: u.id }), sort: '-updated' });
      if (r.items[0]) {
        const c = r.items[0];
        const lu = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
        st.rep = { ...st.rep, ...lu(c.reponses), referent: c.referent || lu(c.reponses).referent || '' };
        st.regles = lu(c.regles).map((x) => x.texte);
        st.saved = c;
        st.etape = NB_ECRANS;
      }
    } catch (_) { /* première visite ou lecture impossible : on part de zéro */ }
  }

  // ---------- Questionnaire ----------
  const optionsDe = (q) => (q.options_depuis ? q.options.filter((o) => (st.rep[q.options_depuis] || []).includes(o.v)) : q.options);
  const aide = (q) => (q.aide ? `<p class="ch-aide" id="ch-aide-${q.cle}">${esc(q.aide)}</p>` : '');
  const decrit = (q) => (q.aide ? ` aria-describedby="ch-aide-${q.cle}"` : '');

  const champ = (q) => {
    const v = st.rep[q.cle];
    if (q.type === 'texte') {
      return `<div class="ch-q"><label for="ch-${q.cle}" class="ch-q__label">${esc(q.libelle)}${q.requis ? '' : ' <span class="ch-facultatif">facultatif</span>'}</label>${aide(q)}<input type="text" id="ch-${q.cle}" data-cle="${q.cle}" maxlength="${q.max}" value="${esc(v || '')}"${decrit(q)} autocomplete="${q.cle === 'entreprise' ? 'organization' : 'name'}"></div>`;
    }
    if (q.affichage === 'liste') {
      return `<div class="ch-q"><label for="ch-${q.cle}" class="ch-q__label">${esc(q.libelle)}</label>${aide(q)}<select id="ch-${q.cle}" data-cle="${q.cle}"${decrit(q)}><option value="">Choisir</option>${q.options.map((o) => `<option value="${esc(o.v)}"${v === o.v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>`;
    }
    const opts = optionsDe(q);
    if (q.options_depuis && !opts.length) return '';
    const multi = q.type === 'multiple';
    const longues = opts.some((o) => o.l.length > 24);
    return `<fieldset class="ch-q"${decrit(q)}><legend class="ch-q__label">${esc(q.libelle)}${multi ? ' <span class="ch-facultatif">plusieurs réponses possibles</span>' : ''}</legend>${aide(q)}
      <div class="ch-opts${longues ? '' : ' ch-opts--courtes'}">${opts.map((o) => {
        const on = multi ? (v || []).includes(o.v) : v === o.v;
        return `<label class="ch-opt"><input type="${multi ? 'checkbox' : 'radio'}" name="ch-${q.cle}" data-cle="${q.cle}" value="${esc(o.v)}"${on ? ' checked' : ''}><span>${esc(o.l)}</span></label>`;
      }).join('')}</div></fieldset>`;
  };

  const manquantes = (ecran) => ecran.questions.map((c) => parCle[c]).filter((q) => {
    if (!q.requis) return false;
    const v = st.rep[q.cle];
    return Array.isArray(v) ? !v.length : !String(v || '').trim();
  });

  function vueQuestions() {
    const ecran = questions.ecrans[st.etape];
    body.innerHTML = `
      <div class="ch-progress"><span>Étape ${st.etape + 1} sur ${NB_ECRANS} · ${esc(ecran.titre)}</span><span class="ch-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${NB_ECRANS + 1}" aria-valuenow="${st.etape + 1}" aria-label="Avancement"><i style="width:${((st.etape + 1) / (NB_ECRANS + 1)) * 100}%"></i></span></div>
      <div class="ch-ecran">${ecran.questions.map((c) => champ(parCle[c])).join('')}</div>
      <div id="ch-msg" role="alert"></div>
      <div class="ch-nav">
        ${st.etape > 0 ? '<button type="button" class="btn btn--ghost" data-act="prec">← Précédent</button>' : '<span></span>'}
        <button type="button" class="btn btn--primary" data-act="suiv">${st.etape === NB_ECRANS - 1 ? (mode === 'm7' ? 'Écrire mes règles →' : 'Voir ma charte →') : 'Suivant →'}</button>
      </div>`;
  }

  const lire = (t) => {
    const cle = t.dataset.cle;
    if (!cle) return;
    const q = parCle[cle];
    if (q.type !== 'multiple') { st.rep[cle] = t.value; return; }
    const excl = q.exclusives || [];
    let cur = new Set(st.rep[cle] || []);
    if (t.checked) { if (excl.includes(t.value)) cur = new Set([t.value]); else excl.forEach((x) => cur.delete(x)); cur.add(t.value); } else cur.delete(t.value);
    st.rep[cle] = [...cur];
    body.querySelectorAll(`input[data-cle="${cle}"]`).forEach((i) => { i.checked = cur.has(i.value); });
    // Une question dépend de celle-ci (« payés » parmi les outils) : on la redessine en gardant le focus.
    if (questions.questions.some((x) => x.options_depuis === cle)) {
      st.rep.payes = (st.rep.payes || []).filter((x) => cur.has(x));
      vueQuestions();
      body.querySelector(`input[data-cle="${cle}"][value="${t.value}"]`)?.focus();
    }
  };

  // ---------- Aperçu (libre) ----------
  const reponses = () => valider(st.rep).reponses;

  function vueApercu() {
    const s = synthese(reponses());
    body.innerHTML = `
      <div class="ch-apercu">
        <p class="ch-progress"><span>Votre charte, avant envoi</span></p>
        ${constatHtml(s)}
        <h3>Vos cinq règles</h3>
        <ol class="ch-regles">${s.regles.map((r) => `<li><strong>${esc(r.titre)}</strong><p>${esc(r.texte)}</p></li>`).join('')}</ol>
        <h3>Ce que vos outils peuvent recevoir</h3>
        ${tableauOutils(s.catalogue)}
      </div>
      <form class="ch-form" id="ch-form" novalidate>
        <h3>Recevoir la charte à signer</h3>
        <p class="t-small">Une page à afficher et à signer, et en annexe la charte détaillée (.docx, modifiable). Vous recevez aussi votre score de maturité et trois recommandations.</p>
        <div class="row">
          <div class="field"><label for="ch-prenom">Prénom</label><input id="ch-prenom" name="prenom" type="text" required autocomplete="given-name"></div>
          <div class="field"><label for="ch-email">Email professionnel</label><input id="ch-email" name="email" type="email" required autocomplete="email" inputmode="email"></div>
        </div>
        <div class="field"><label for="ch-fonction">Fonction <span class="ch-facultatif">facultatif</span></label><input id="ch-fonction" name="fonction" type="text" autocomplete="organization-title"></div>
        <label class="check"><input type="checkbox" name="newsletter"> <span>Je souhaite recevoir les actualités PerfIA.</span></label>
        <p class="t-small wg-muted">Kosmio, responsable du traitement, utilise ces données pour vous envoyer votre charte, assurer le suivi de votre demande et, si vous cochez la case, vous écrire sur l’actualité PerfIA. <a href="/confidentialite/">En savoir plus</a>.</p>
        <div id="ch-msg" role="alert"></div>
        <div class="ch-nav"><button type="button" class="btn btn--ghost" data-act="prec">← Modifier mes réponses</button><button type="submit" class="btn btn--primary">Recevoir ma charte →</button></div>
      </form>`;
    body.querySelector('#ch-form').addEventListener('submit', envoyerLibre);
  }

  async function envoyerLibre(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const get = (k) => String(f.get(k) || '').trim();
    const msg = body.querySelector('#ch-msg');
    const erreurs = [];
    if (!get('prenom')) erreurs.push(['ch-prenom', 'Indiquez votre prénom.']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(get('email'))) erreurs.push(['ch-email', 'Indiquez une adresse email valide, par exemple prenom@entreprise.fr.']);
    body.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    if (erreurs.length) {
      erreurs.forEach(([id]) => body.querySelector('#' + id).setAttribute('aria-invalid', 'true'));
      msg.innerHTML = `<div class="alert alert--error">${erreurs.map(([, m]) => esc(m)).join(' ')}</div>`;
      body.querySelector('#' + erreurs[0][0]).focus();
      return;
    }
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Préparation de votre charte…';
    try {
      const rep = reponses();
      const res = await pb.send('/api/academie/charte', {
        method: 'POST',
        body: { prenom: get('prenom'), email: get('email'), fonction: get('fonction'), referent: rep.referent, newsletter: f.get('newsletter') === 'on', utm: utmDepuisUrl(), reponses: rep },
      });
      st.resultat = { jeton: res.jeton, email: get('email') };
      await vueResultatLibre(rep);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Recevoir ma charte →';
      msg.innerHTML = `<div class="alert alert--error">${esc(errMsg(err))} Vos réponses sont conservées : réessayez.</div>`;
    }
  }

  const telecharger = (rep, textes = null) => {
    const regles = textes ? synthese(rep).regles.map((r, i) => ({ titre: r.titre, texte: textes[i] || r.texte })) : null;
    downloadBlob(nomFichier(rep), docx(blocsDocx(rep, {}, regles), { pied: PIED }));
  };

  async function vueResultatLibre(rep) {
    // La synthèse affichée est celle que le serveur a recalculée.
    let data;
    try {
      data = await pb.send('/api/academie/charte/' + st.resultat.jeton, { method: 'GET' });
    } catch (_) {
      const s = synthese(rep);
      data = { ...s, entreprise: rep.entreprise, maillon: rep.maillon, referent: rep.referent, reponses: rep, recommandations: s.recommandations_detail };
    }
    document.querySelector('.charte-intro')?.setAttribute('hidden', '');
    body.innerHTML = `
      <div class="ch-pret">
        <p class="ch-pret__titre">Votre charte est prête.</p>
        <p class="t-small">Le téléchargement démarre ; un récapitulatif part aussi à ${esc(st.resultat.email)}.</p>
        <div class="wg-actions no-print">
          <button type="button" class="btn btn--primary" data-act="docx">Télécharger la charte à signer (.docx)</button>
          <button type="button" class="btn btn--ghost" data-act="pdf">Télécharger cette synthèse en PDF</button>
        </div>
        <p class="t-small no-print">Lien permanent de votre synthèse : <a href="/charte/synthese/?j=${esc(st.resultat.jeton)}">à garder ou à transmettre</a>.</p>
      </div>
      ${syntheseHtml(data, { email: st.resultat.email })}`;
    brancherInstallation(body, data);
    remonter(el);
    try { telecharger(rep); } catch (err) { console.error(err); }
  }

  // ---------- Règles à écrire (m7) ----------
  function vueRegles() {
    const s = synthese(reponses());
    if (!st.regles) st.regles = s.regles.map(() => '');
    body.innerHTML = `
      ${constatHtml(s)}
      <p class="wg-note">Écrivez chaque règle en une ou deux phrases, avec vos mots. La proposition sert d’appui : reprenez-la, puis adaptez-la à votre entreprise.</p>
      ${s.regles.map((r, i) => `<div class="ch-rule">
        <label for="ch-r${i}">${i + 1}. ${esc(r.titre)}</label>
        <p class="ch-proposition" id="ch-p${i}"><span>Proposition :</span> ${esc(r.texte)} <button type="button" class="wg-link" data-reprendre="${i}">Reprendre</button></p>
        <textarea id="ch-r${i}" data-regle="${i}" maxlength="2000" aria-describedby="ch-p${i}">${esc(st.regles[i] || '')}</textarea>
      </div>`).join('')}
      <div id="ch-msg" role="alert">${st.saved ? '<div class="alert alert--info">Charte enregistrée précédemment : vous pouvez la modifier.</div>' : ''}</div>
      <div class="ch-nav">
        <button type="button" class="btn btn--ghost" data-act="prec">← Modifier mes réponses</button>
        <span class="wg-actions"><button type="button" class="btn btn--secondary" data-act="docx">Télécharger en .docx</button><button type="button" class="btn btn--primary" data-act="save">Enregistrer ma charte</button></span>
      </div>`;
  }

  async function enregistrerM7(btn) {
    const msg = body.querySelector('#ch-msg');
    const vides = st.regles.map((t, i) => (String(t).trim() ? null : i)).filter((i) => i !== null);
    if (vides.length) {
      msg.innerHTML = `<div class="alert alert--error">Écrivez les cinq règles avant d’enregistrer (règle${vides.length > 1 ? 's' : ''} ${vides.map((i) => i + 1).join(', ')}).</div>`;
      body.querySelector(`#ch-r${vides[0]}`).focus();
      return;
    }
    const rep = reponses();
    const titres = synthese(rep).regles;
    btn.disabled = true;
    try {
      const res = await pb.send('/api/academie/charte/m7', { method: 'POST', body: { reponses: rep, referent: rep.referent, regles: titres.map((r, i) => ({ titre: r.titre, texte: st.regles[i] })) } });
      st.saved = { id: res.id };
      msg.innerHTML = '<div class="alert alert--ok">Charte enregistrée. Téléchargez-la en .docx et joignez-la à l’exercice ci-dessous.</div>';
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
    if (e.target.dataset.regle !== undefined) st.regles[+e.target.dataset.regle] = e.target.value;
    else if (e.target.dataset.cle && parCle[e.target.dataset.cle].type === 'texte') st.rep[e.target.dataset.cle] = e.target.value;
  });
  body.addEventListener('change', (e) => { if (e.target.dataset.cle) lire(e.target); });
  body.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-reprendre]');
    if (r) {
      const i = +r.dataset.reprendre;
      const t = body.querySelector(`#ch-r${i}`);
      t.value = synthese(reponses()).regles[i].texte;
      st.regles[i] = t.value;
      t.focus();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'prec') { st.etape = Math.max(0, st.etape - 1); afficher(); remonter(el); }
    if (act === 'suiv') {
      const m = manquantes(questions.ecrans[st.etape]);
      if (m.length) {
        body.querySelector('#ch-msg').innerHTML = `<div class="alert alert--error">Il manque : ${m.map((q) => esc(q.libelle)).join(' ; ')}</div>`;
        body.querySelector(`[data-cle="${m[0].cle}"]`)?.focus();
        return;
      }
      st.etape++; afficher(); remonter(el);
      if (st.etape < NB_ECRANS) body.querySelector('[data-cle]')?.focus({ preventScroll: true });
    }
    if (act === 'docx') {
      telecharger(reponses(), mode === 'm7' ? st.regles : null);
      flash(b, 'Téléchargée');
    }
    if (act === 'pdf') window.print();
    if (act === 'save') await enregistrerM7(b);
  });

  afficher();
}
