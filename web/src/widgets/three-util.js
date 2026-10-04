import * as THREE from 'three';

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (_) { return false; }
}

/** Étiquette texte toujours face à la caméra. */
export function label(text, { color = '#1F2D3D', size = 0.42, weight = 700, bg = null } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${weight} 64px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w; c.height = 96;
  ctx.font = font;
  if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(2, 8, w - 4, 80, 40); ctx.fill(); }
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(size * (w / 96), size, 1);
  sp.userData.text = text;
  return sp;
}

/** Scène, caméra, rendu, boucle qui ne tourne que lorsque le canevas est visible. */
export function stage(host, { height = 400, camPos = [0, 2, 11] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(...camPos);
  host.appendChild(renderer.domElement);
  renderer.domElement.classList.add('wg-3d__canvas');
  const size = () => { const w = host.clientWidth || 600; renderer.setSize(w, height); camera.aspect = w / height; camera.updateProjectionMatrix(); };
  size();
  new ResizeObserver(size).observe(host);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(4, 8, 6); scene.add(dl);
  let running = false, tick = () => {};
  const loop = () => { if (!running) return; tick(); renderer.render(scene, camera); requestAnimationFrame(loop); };
  new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !running) { running = true; loop(); } else if (!v) running = false; }).observe(host);
  return { THREE, renderer, scene, camera, onTick: (f) => { tick = f; } };
}
