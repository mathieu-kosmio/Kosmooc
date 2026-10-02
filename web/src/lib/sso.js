import { pb, esc, errMsg } from './pb.js';

// Affiche un bouton par fournisseur OAuth2/OIDC configuré dans PocketBase
// (par exemple « Certifiko » via un fournisseur OIDC). Rien ne s'affiche sinon.
export async function renderSso(container, onDone) {
  if (!container) return;
  try {
    const methods = await pb.collection('users').listAuthMethods();
    const providers = methods?.oauth2?.enabled ? methods.oauth2.providers || [] : [];
    if (!providers.length) return;
    container.hidden = false;
    container.innerHTML = providers
      .map((p) => `<button type="button" class="btn btn--secondary" data-provider="${esc(p.name)}" style="width:100%;justify-content:center">Continuer avec ${esc(p.displayName || p.name)}</button>`)
      .join('') + '<p class="t-small" style="text-align:center;color:var(--grey-600)">ou avec votre email</p>';
    container.querySelectorAll('[data-provider]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await pb.collection('users').authWithOAuth2({ provider: btn.dataset.provider });
          if (onDone) onDone(); else window.location.href = '/parcours/';
        } catch (err) {
          container.insertAdjacentHTML('beforeend', `<div class="alert alert--error">${esc(errMsg(err))}</div>`);
        }
      });
    });
  } catch (_) { /* API indisponible : on reste sur le formulaire */ }
}
