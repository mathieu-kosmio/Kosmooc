// Export de la charte IA vers les assistants d'IA (prototype, docs/EVOLUTION-CHARTE-IA.md section 16).
// Pour un outil déclaré, deux formats : un paquet Claude (zip d'un dossier SKILL.md + references/charte.md)
// et un bloc d'instructions en texte brut pour un GPT, un projet ChatGPT, un Gem, un agent Mistral ou Copilot.
// L'assistant prévient quand un dépôt dépasse ce que l'outil peut recevoir ; il ne bloque rien.
// Entrée : la synthèse (moteur.js, ou réponse de GET /api/academie/charte/{jeton}) et les réponses validées.
// Pas d'import du moteur ici : le fichier tourne aussi sous Node (npm run valider).

export const LIMITE_INSTRUCTIONS = 8000;

// Format proposé par outil, et trois lignes d'installation (libellés des menus vérifiés en octobre 2026).
export const FORMATS = {
  claude: {
    format: 'skill',
    cible: 'Claude (claude.ai)',
    etapes: [
      'Dans Paramètres, Fonctionnalités, activez l’exécution de code (sur une offre Team ou Enterprise, c’est le propriétaire du compte qui l’active).',
      'Ouvrez Personnaliser, Skills, puis « + », « Créer », « Importer » et choisissez le fichier .zip, sans le décompresser.',
      'Vérifiez que la charte est activée dans la liste, puis testez-la en déposant un faux devis.',
    ],
  },
  chatgpt: {
    format: 'texte',
    cible: 'un projet ChatGPT ou un GPT personnalisé',
    etapes: [
      'Créez un projet « Charte IA » (toutes les offres) ou, sur une offre payée, un GPT personnalisé (Explorer les GPT, Créer, Configurer).',
      'Ouvrez les instructions du projet (ou le champ Instructions du GPT) et collez le texte.',
      'Travaillez dans ce projet ou ce GPT : hors de lui, la charte ne s’applique pas.',
    ],
  },
  gemini: {
    format: 'texte',
    cible: 'un Gem Gemini',
    etapes: [
      'Sur gemini.google.com, depuis un ordinateur, ouvrez Gems puis Nouveau Gem.',
      'Nommez-le « Charte IA » et collez le texte dans le champ Instructions, puis Enregistrer.',
      'Ouvrez ce Gem pour travailler : les conversations ordinaires ne le suivent pas.',
    ],
  },
  mistral: {
    format: 'texte',
    cible: 'une Skill Mistral Vibe (ex-Le Chat)',
    etapes: [
      'Dans Mistral Vibe (ex-Le Chat), mode Work, ouvrez Context, Skills, puis New Skill.',
      'Titre « Charte IA » ; description « À utiliser dès qu’un document, un devis, des données clients ou RH sont déposés » ; collez le texte dans le champ SKILL.md.',
      'Cliquez sur Create Skill : Work l’applique quand un dépôt correspond, ou tapez « /charte-ia ».',
    ],
  },
  copilot: {
    format: 'texte',
    cible: 'un agent Copilot',
    etapes: [
      'Dans Microsoft 365 Copilot, choisissez Nouvel agent puis Passer à la configuration (onglet Configurer).',
      'Nommez l’agent « Charte IA » et collez le texte dans le champ Instructions (8 000 caractères au plus), puis Créer.',
      'Testez-le dans l’onglet Essayer, puis partagez-le avec l’équipe.',
    ],
  },
  logiciel_metier: {
    format: 'aucun',
    cible: 'l’IA de votre logiciel métier',
    etapes: [
      'Ces outils n’acceptent pas d’instructions personnalisées en général.',
      'Vérifiez dans le contrat de l’éditeur où vont les données et si elles servent à entraîner ses modèles.',
      'En attendant, appliquez-y le tableau de la charte comme pour un compte personnel.',
    ],
  },
};

const liste = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const slug = (s) => String(s || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Nom du skill : minuscules, chiffres et tirets, 64 caractères au plus, identique au nom du dossier,
// sans les mots réservés « claude » et « anthropic », refusés à l'import.
export const nomSkill = (entreprise) => ('charte-ia-' + slug(entreprise).replace(/claude|anthropic/g, 'x')).slice(0, 64).replace(/-+$/, '');

// Niveau d'une catégorie de données, escalade comprise (même règle que moteur.js, niveauDonnee).
function niveauDonnee(d, rep, R) {
  let l = R.niveaux.indexOf(R.niveau_par_donnee[d]);
  R.escalade.forEach((e) => { if (e.si.donnees === d && rep.confidentialite === e.si.confidentialite) l = Math.max(l, R.niveaux.indexOf(e.niveau)); });
  return R.niveaux[l];
}

// Ce qui sert à tous les formats : l'outil, ce qu'il peut recevoir, les données de l'entreprise par niveau,
// et pour chaque niveau refusé, un autre outil déclaré qui l'accepte.
function contexte(data, rep, outil, R) {
  const o = data.catalogue.find((x) => x.outil === outil);
  if (!o) throw new Error(`Outil « ${outil} » absent du catalogue de la charte.`);
  const parNiveau = {};
  R.niveaux.forEach((n, i) => { parNiveau[n] = { libelle: R.libelles_niveaux[n], exemples: R.classification[i][1], regle: R.classification[i][2], chez_nous: [] }; });
  liste(rep.donnees).filter((d) => d !== 'aucune').forEach((d) => parNiveau[niveauDonnee(d, rep, R)].chez_nous.push(R.libelles_donnees[d]));
  const autres = data.catalogue.filter((x) => x.outil !== outil);
  const ailleurs = {};
  R.niveaux.forEach((n) => {
    if (o.niveaux[n] === 'oui') return;
    const ok = autres.filter((x) => x.niveaux[n] === 'oui' || (x.niveaux[n] === 'anonymisation' && o.niveaux[n] === 'non'));
    if (ok.length) ailleurs[n] = ok.map((x) => x.libelle + (x.niveaux[n] === 'anonymisation' ? ' (après anonymisation)' : '')).join(' ou ');
  });
  const referent = String(data.referent || rep.referent || '').trim() || 'le référent IA désigné par la direction';
  return { o, parNiveau, ailleurs, referent, entreprise: data.entreprise || rep.entreprise || 'l\'entreprise', regles: data.regles || [] };
}

// Ce que l'outil peut recevoir, niveau par niveau, et la marche à suivre quand le niveau est dépassé.
function lignesNiveaux(c, R) {
  return R.niveaux.map((n) => {
    const p = c.parNiveau[n];
    const a = c.o.niveaux[n];
    const chez = p.chez_nous.length ? ` Chez nous : ${p.chez_nous.join(', ')}.` : '';
    let suite = '';
    if (a === 'anonymisation') suite = ' Marche à suivre : retirer ou remplacer noms, adresses, prix et références avant de déposer.';
    else if (a === 'non' || a === 'validation' || a === 'verifier') {
      const alt = c.ailleurs[n] ? `utiliser ${c.ailleurs[n]}` : 'ne pas passer par l\'IA';
      suite = ` Marche à suivre : ${alt}, ou demander à ${c.referent}.`;
    }
    return `- ${p.libelle} (${p.exemples}).${chez} Dans ${c.o.libelle} : ${R.libelles_autorisation[a]}.${suite}`;
  });
}

// Phrase d'avertissement type, alignée sur ce que l'outil accepte vraiment pour un devis.
function exemple(c) {
  const outil = c.o.libelle;
  const a = c.o.niveaux.confidentiel;
  if (a === 'anonymisation') return `Charte IA, règle 2 : ce devis contient des prix et un nom de client (Confidentiel), que ${outil} ne doit recevoir qu'anonymisé ; la prochaine fois, remplacez-les par [client] et [montant] ou demandez à ${c.referent} (ce devis est déjà transmis).`;
  if (a === 'oui') return `Charte IA, règle 2 : ce tableau contient des données RH nominatives (Secret), que ${outil} ne reçoit qu'après validation de ${c.referent} (ce tableau est déjà transmis).`;
  const alt = c.ailleurs.confidentiel ? `passez par ${c.ailleurs.confidentiel}` : 'gardez-le hors de l\'IA';
  return `Charte IA, règle 2 : ce devis contient des prix et un nom de client (Confidentiel), que ${outil} ne doit pas recevoir ; la prochaine fois, ${alt} ou demandez à ${c.referent} (ce devis est déjà transmis).`;
}

// Le comportement attendu, commun au skill et aux instructions.
function consignes(c) {
  const outil = c.o.libelle;
  return [
    `Tu aides l'équipe de ${c.entreprise} à respecter sa charte IA quand elle travaille dans ${outil}. Tu fais ton travail normalement et tu ajoutes, seulement quand c'est utile, un avertissement court.`,
    '',
    'À chaque contenu que l\'utilisateur dépose ou colle (document, tableau, mail, photo, données) :',
    '1. Classe-le au niveau le plus élevé de ce qu\'il contient réellement, selon le tableau ci-dessous. Repères : une procédure ou une liste de fournisseurs est Interne ; un devis, un prix négocié, un export clients, la demande d\'un client nommé (quantités, prix, délais), un plan ou une note de calcul pour un client nommé est Confidentiel ; des salaires, une évaluation nominative, un procédé maison ou des comptes analytiques sont Secret.',
    `2. Compare ce niveau à ce que ${outil} peut recevoir.`,
    `3. S'il le dépasse, commence ta réponse par une seule phrase : le niveau repéré, la règle 2 de la charte, la marche à suivre du tableau et le fait que le contenu est déjà transmis. Exemple : « ${exemple(c)} » Puis réponds normalement à la demande.`,
    '4. Sois honnête : l\'avertissement arrive après la transmission et sert pour la prochaine fois. Si l\'utilisateur demande quoi faire, il peut supprimer la conversation.',
    '5. Ne refuse jamais, ne fais pas la morale, ne répète pas l\'avertissement pour le même document dans la conversation. Si le contenu est conforme, ne parle pas de la charte.',
    '6. Pour un devis, un chiffrage, un calcul (dimensionnement, structure, quantités) ou un message destiné à un client, termine par une ligne : « Règle 3 : à relire par une personne avant envoi » (pour un calcul de structure, par la personne compétente).',
    '7. Quand tu n\'es pas sûr d\'un chiffre, d\'une norme, d\'une référence ou d\'un fait, écris « à vérifier » à côté (règle 4). Ne l\'invente pas.',
    '',
    'Pas d\'avertissement pour : une question générale (essences, normes, méthode, rédaction d\'une fiche de poste), un exemple inventé, un document déjà anonymisé, des informations publiques (catalogue, plaquette, site web, prix publics), un nom de client isolé sans prix ni contenu de contrat, une question sur la charte elle-même. En cas de doute entre deux niveaux, retiens le plus bas et signale-le en une phrase.',
  ];
}

const reglesTexte = (c) => c.regles.map((r, i) => `${i + 1}. ${r.titre} : ${r.texte}`);

/**
 * Bloc d'instructions en texte brut, pour un outil du catalogue.
 * data : synthèse (entreprise, referent, catalogue, regles) ; rep : réponses validées ; R : regles.json.
 */
export function instructions(data, rep, outil, R) {
  const c = contexte(data, rep, outil, R);
  const t = [
    `CHARTE IA DE ${c.entreprise.toUpperCase()} : CONSIGNES POUR ${c.o.libelle.toUpperCase()}`,
    '',
    ...consignes(c),
    '',
    `CE QUE ${c.o.libelle.toUpperCase()} PEUT RECEVOIR`,
    ...lignesNiveaux(c, R),
    '',
    'LES CINQ RÈGLES DE LA CHARTE',
    ...reglesTexte(c),
    '',
    `Référent IA : ${c.referent}. Ces consignes rappellent la charte ; elles ne remplacent ni les réglages d'administration de l'outil ni la protection des données chez l'éditeur.`,
  ].join('\n');
  if (t.length > LIMITE_INSTRUCTIONS) throw new Error(`Instructions trop longues (${t.length} caractères, limite ${LIMITE_INSTRUCTIONS}).`);
  return t;
}

/** Fichiers du paquet Claude : [[chemin, contenu]]. */
export function fichiersSkill(data, rep, outil, R) {
  const c = contexte(data, rep, outil, R);
  const nom = nomSkill(c.entreprise);
  const description = `Charte IA de ${c.entreprise}. À utiliser dès que l'utilisateur dépose ou colle un document ou un texte de l'entreprise : devis, chiffrage, plan, note de calcul, procédure interne, compte rendu, données clients, fournisseurs ou RH, tableau de prix ou de chiffres (ventes, marges, comptes), ou demande de rédiger pour un client (mail, offre, réponse à un appel d'offres). Classe le contenu selon les quatre niveaux de la charte, prévient en une phrase si ${c.o.libelle} ne doit pas le recevoir, rappelle la relecture humaine et marque ce qui est à vérifier.`
    .replace(/[<>]/g, '').slice(0, 1024);
  const skill = [
    '---',
    `name: ${nom}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    `# Charte IA de ${c.entreprise}`,
    '',
    ...consignes(c),
    '',
    `Le tableau des niveaux, ce que ${c.o.libelle} peut recevoir et les cinq règles sont dans references/charte.md : lis-le avant de classer un contenu.`,
    '',
    'Limite à garder en tête : tu vois le contenu une fois qu\'il est déposé. Tu rappelles la charte, tu ne la fais pas respecter ; la vraie protection passe par les réglages d\'administration et le contrat de l\'outil.',
    '',
  ].join('\n');
  const ref = [
    `# Charte IA de ${c.entreprise} : ce que ${c.o.libelle} peut recevoir`,
    '',
    `Catégorie de l'outil dans la charte : ${c.o.categorie_libelle}. Référent IA : ${c.referent}.`,
    '',
    '## Niveaux de données',
    '',
    ...lignesNiveaux(c, R),
    '',
    '## Règle de chaque niveau dans la charte',
    '',
    ...R.niveaux.map((n) => `- ${c.parNiveau[n].libelle} : ${c.parNiveau[n].regle}.`),
    '',
    '## Les cinq règles',
    '',
    ...reglesTexte(c),
    '',
    '## Exemples de classement',
    '',
    '- « Rédige un mail de relance pour le devis 2026-114 de la menuiserie X, 18 400 € HT » : Confidentiel (client nommé et prix).',
    '- Le même mail avec « [client] » et « [montant] » à la place : plus rien d\'identifiant, Public.',
    '- Le tableau des salaires ou une évaluation annuelle nominative : Secret.',
    '- « Quelle classe d\'emploi pour un bardage en douglas ? » : Public, pas d\'avertissement.',
    '- Une note de calcul de charpente pour un client : Confidentiel au moins (Secret si le client impose la confidentialité) ; rappeler la règle 3.',
    '',
  ].join('\n');
  return [[`${nom}/SKILL.md`, skill], [`${nom}/references/charte.md`, ref]];
}

/**
 * Pour chaque outil du catalogue : son format, sa cible, ses trois lignes d'installation,
 * et de quoi produire le paquet (zip Claude) ou le texte à copier.
 */
export function exportsOutils(data, rep, R) {
  return data.catalogue.map((o) => {
    const f = FORMATS[o.outil] || FORMATS.logiciel_metier;
    const e = { outil: o.outil, libelle: o.libelle, format: f.format, cible: f.cible, etapes: f.etapes };
    if (f.format === 'skill') e.fichiers = () => fichiersSkill(data, rep, o.outil, R);
    if (f.format !== 'aucun') e.texte = () => instructions(data, rep, o.outil, R);
    return e;
  });
}

export const nomZip = (data, rep) => nomSkill(data.entreprise || rep.entreprise) + '.zip';
