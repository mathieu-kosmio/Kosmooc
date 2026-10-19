// Parcours de l'Académie : listes ordonnées de modules, définies dans backend/parcours.json
// (même fichier que le serveur, qui s'en sert pour émettre l'attestation « Les bases de l'IA »).
// Un module a un identifiant stable (m0, m1...) et un numéro affiché propre à chaque parcours.
import data from '../../../backend/parcours.json';

export const PARCOURS = data.parcours;
export const BADGES = data.badges;
export const LIBRES = new Set(data.acces_libre);
export const PARCOURS_DEFAUT = (PARCOURS.find((p) => p.defaut) || PARCOURS[0]).id;
export const CLE_PARCOURS = 'academie.parcours';

export const fmtDuree = (d) => (d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ' ' + String(d % 60).padStart(2, '0') : ''}` : `${d} min`);

// Assemble chaque parcours avec les données des modules (collection Astro « modules »).
export function assembler(entries) {
  const mods = Object.fromEntries(entries.map((e) => [e.data.id, e.data]));
  return PARCOURS.map((p) => {
    const modules = p.modules.map((x, i) => {
      const m = mods[x.id];
      if (!m) throw new Error(`parcours ${p.id} : module ${x.id} introuvable`);
      return { ...m, label: x.label, index: i, etape: (p.etapes || []).includes(x.id), libre: LIBRES.has(x.id), communs: PARCOURS.filter((q) => q.id !== p.id && q.modules.some((y) => y.id === x.id)).map((q) => q.id) };
    });
    const duree = modules.reduce((s, m) => s + m.duree, 0);
    const phases = (p.phases || []).map((ph) => {
      const ms = modules.filter((m) => ph.modules.includes(m.id));
      const labels = ms.map((m) => m.label);
      return { ...ph, mods: ms, plage: labels.length > 1 ? `M${labels[0]} à M${labels[labels.length - 1]}` : `M${labels[0]}` };
    });
    return { ...p, modules, phases, duree, dureeTxt: fmtDuree(duree), nbModules: modules.length - 1, badgeDef: BADGES[p.badge] };
  });
}

// Parcours qui contiennent un module, le parcours par défaut en premier.
export function parcoursDe(moduleId) {
  return PARCOURS.filter((p) => p.modules.some((x) => x.id === moduleId))
    .sort((a, b) => (b.id === PARCOURS_DEFAUT) - (a.id === PARCOURS_DEFAUT));
}

// Côté navigateur : parcours choisi (paramètre ?p=, sinon dernier choix mémorisé).
export function parcoursChoisi(permis) {
  let p = null;
  try { p = new URLSearchParams(location.search).get('p'); } catch (_) {}
  if (!p || (permis && !permis.includes(p))) { try { p = localStorage.getItem(CLE_PARCOURS); } catch (_) { p = null; } }
  if (!p || (permis && !permis.includes(p))) return null;
  return p;
}
export function memoriserParcours(p) { try { localStorage.setItem(CLE_PARCOURS, p); } catch (_) {} }
