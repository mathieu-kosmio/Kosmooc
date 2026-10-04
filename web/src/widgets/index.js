// Activités interactives des modules : un élément <div data-widget="nom"> dans le Markdown
// est remplacé au moment où il approche de l'écran. Chaque activité est chargée à la demande.
const loaders = {
  tri: () => import('./tri.js'),
  autodiag: () => import('./autodiag.js'),
  releve: () => import('./releve.js'),
  prediction: () => import('./prediction.js'),
  nuage3d: () => import('./nuage3d.js'),
  chasse: () => import('./chasse.js'),
  leviers: () => import('./leviers.js'),
  porte: () => import('./porte.js'),
  priorisation3d: () => import('./priorisation3d.js'),
  etsc: () => import('./etsc.js'),
  radar: () => import('./radar.js'),
  cout: () => import('./cout.js'),
  pointdepart: () => import('./pointdepart.js'),
};

export function mountWidgets(root = document) {
  root.querySelectorAll('[data-widget]').forEach((el) => {
    const load = loaders[el.dataset.widget];
    if (!load || el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const go = () => load()
      .then((m) => m.default(el, el.dataset))
      .catch((err) => { console.error(err); el.innerHTML = '<p class="wg-fallback">Activité indisponible sur ce navigateur.</p>'; });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
      }, { rootMargin: '400px' });
      io.observe(el);
    } else go();
  });
}
