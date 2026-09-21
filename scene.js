
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const N = 5;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const posterMode = new URLSearchParams(location.search).has('poster');
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

const V2 = document.documentElement.getAttribute('data-v') !== '1';

function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

function layout() {
  const rnd = mulberry(20260907);
  const used = new Uint8Array(N * N * N);
  const id = (x, y, z) => (y * N + z) * N + x;
  const blocks = [];

  [[0, 4, 2], [4, 1, 4], [2, 4, 0]].forEach(([x, y, z]) => { used[id(x, y, z)] = 2; });

  used[id(4, 4, 4)] = 1;
  blocks.push({ x: 4, y: 4, z: 4, w: 1, h: 1, d: 1, one: true });
  const fits = (x, y, z, w, h, d) => {
    if (x + w > N || y + h > N || z + d > N) return false;
    for (let yy = y; yy < y + h; yy++) for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) {
      if (used[id(xx, yy, zz)]) return false;
    }
    return true;
  };
  for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (used[id(x, y, z)]) continue;
    const pick = [3, 2, 2, 1][Math.floor(rnd() * 4)];
    let w = pick, d = rnd() < 0.5 ? 2 : 1, h = rnd() < 0.3 ? 2 : 1;
    while (!fits(x, y, z, w, h, d)) {
      if (h > 1) h--; else if (d > 1) d--; else if (w > 1) w--; else break;
    }
    for (let yy = y; yy < y + h; yy++) for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) used[id(xx, yy, zz)] = 1;
    blocks.push({ x, y, z, w, h, d, one: false });
  }
  const half = (N - 1) / 2;
  return blocks.map((b, i) => {
    const cx = b.x + (b.w - 1) / 2 - half, cy = b.y + (b.h - 1) / 2, cz = b.z + (b.d - 1) / 2 - half;

    const out = new THREE.Vector3(cx, cy - half, cz);
    if (out.lengthSq() < 0.01) out.set(0.4, 0.2, 0.6);
    out.normalize();
    out.x = Math.abs(out.x) * 0.9 + 0.35;
    out.y += (rnd() - 0.5) * 0.9;
    out.z += (rnd() - 0.5) * 0.6;
    out.normalize();
    return {
      ...b, i,
      home: new THREE.Vector3(cx, cy, cz),
      out, dist: 2.6 + rnd() * 3.2,
      tilt: new THREE.Euler((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.5),
      jitter: rnd()
    };
  });
}

function concreteTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = mulberry(7);
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S), d = img.data;

  const oct = (cell, amp) => {
    const gw = Math.ceil(S / cell) + 1, grid = new Float32Array(gw * gw);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gx = x / cell, gy = y / cell, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1], cc = grid[(y0 + 1) * gw + x0], dd = grid[(y0 + 1) * gw + x0 + 1];
      const v = lerp(lerp(a, b, fx), lerp(cc, dd, fx), fy) - 0.5;
      const k = (y * S + x) * 4;
      d[k] += v * amp; d[k + 1] += v * amp; d[k + 2] += v * amp;
    }
  };
  oct(120, 22); oct(30, 16); oct(7, 12); oct(2, 12);
  g.putImageData(img, 0, 0);

  g.globalAlpha = 0.07;
  for (let i = 0; i < 26; i++) {
    const y = rnd() * S, h = 0.5 + rnd() * 1.2;
    g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.fillRect(0, y, S, h);
  }

  g.globalAlpha = 0.28; g.fillStyle = '#3a3a3a';
  for (let i = 0; i < 160; i++) {
    const r = 0.6 + rnd() * 2.2;
    g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const geomCache = new Map();
function geometry(w, h, d) {
  const key = w + 'x' + h + 'x' + d;
  if (!geomCache.has(key)) {
    const s = 0.992;
    geomCache.set(key, new RoundedBoxGeometry(w * s, h * s, d * s, 2, 0.03));
  }
  return geomCache.get(key);
}

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
})();

function makeRenderer(canvas) {
  if (!hasWebGL) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'low-power',
      preserveDrawingBuffer: posterMode
    });
  } catch (e) { return null; }
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function buildCube(scene, tex, tint) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, bumpMap: tex, bumpScale: 0.25, color: tint, roughness: 0.93, metalness: 0.0
  });
  const blocks = layout();
  const meshes = blocks.map((b) => {
    const m = new THREE.Mesh(geometry(b.w, b.h, b.d), b.one ? mat.clone() : mat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.copy(b.home);
    m.userData = b;
    scene.add(m);
    return m;
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.42 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true;
  scene.add(ground);
  return { meshes, mat, ground };
}

function lights(scene, keyColor, keyIntensity, skyColor, groundColor, hemi) {
  const key = new THREE.DirectionalLight(keyColor, keyIntensity);
  key.position.set(-6, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.camera.left = key.shadow.camera.bottom = -7;
  key.shadow.camera.right = key.shadow.camera.top = 7;
  key.shadow.bias = -0.0008; key.shadow.radius = 3;
  scene.add(key);
  const h = new THREE.HemisphereLight(skyColor, groundColor, hemi);
  scene.add(h);
  return { key, hemi: h };
}

function orbit(cam, target, az, el, dist) {
  cam.position.set(
    target.x + dist * Math.sin(az) * Math.cos(el),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(az) * Math.cos(el)
  );
  cam.lookAt(target);
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
if (finePointer && !reduce) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
  }, { passive: true });
}
function pointerStep() {
  pointer.x += (pointer.tx - pointer.x) * 0.06;
  pointer.y += (pointer.ty - pointer.y) * 0.06;
  return Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > 0.0015;
}

function readP(actEl, fallback) {
  const v = parseFloat(getComputedStyle(actEl).getPropertyValue('--sc-p'));
  return Number.isFinite(v) ? v : fallback;
}

function runtime(host, actEl, renderer, draw, restP) {
  let visible = false, raf = 0, lastP = -1, ready = false;
  const canvas = renderer.domElement;
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    draw.resize(w, h);
    lastP = -1;
  }
  function frame() {
    raf = 0;
    const p = window.__forceP != null ? window.__forceP : (reduce ? restP : readP(actEl, restP));
    const moving = reduce ? false : pointerStep();
    if (Math.abs(p - lastP) > 0.0005 || moving || !ready) {
      draw.update(p, pointer);
      renderer.render(draw.scene, draw.camera);
      lastP = p;
      if (!ready) { ready = true; host.classList.add('is-ready'); }
    }
    if (visible && !reduce) raf = requestAnimationFrame(frame);
  }
  new ResizeObserver(() => { size(); if (!raf) raf = requestAnimationFrame(frame); }).observe(host);
  size();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
      });
    }, { rootMargin: '20% 0px', threshold: 0 }).observe(host);
  } else { visible = true; raf = requestAnimationFrame(frame); }
  return { redraw() { lastP = -1; if (!raf) raf = requestAnimationFrame(frame); } };
}

function hero(host, actEl, tex) {
  const canvas = host.querySelector('.scene__canvas');
  const renderer = makeRenderer(canvas);
  if (!renderer) return null;
  const scene = new THREE.Scene();

  scene.fog = V2 ? new THREE.Fog(0xa8702a, 10, 36) : new THREE.Fog(0x131417, 15, 30);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const { meshes, ground } = buildCube(scene, tex, V2 ? 0xc9a06a : 0xaab0b8);
  if (V2) meshes[0].material.bumpScale = 0.1;

  ground.material = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.15, color: 0x3e434c, roughness: 0.97 });
  ground.material.map = tex.clone(); ground.material.map.repeat.set(6, 6); ground.material.map.needsUpdate = true;
  if (V2) ground.visible = false;
  const glow = V2 ? new THREE.PointLight(0xffc58a, 34, 30, 2) : new THREE.PointLight(0x9fb4d6, 30, 24, 2);
  if (V2) glow.position.set(-5, 7, -3); else glow.position.set(3, 1.2, -6);
  scene.add(glow);
  const L = V2 ? lights(scene, 0xffdcaa, 4.6, 0xb9803a, 0x2a1206, 1.1) : lights(scene, 0xd9e4f4, 3.2, 0x4a5262, 0x0b0b0d, 0.9);
  if (V2) {

    L.key.position.set(-7, 9, -11);
    const fillW = new THREE.DirectionalLight(0xffc48c, 1.5); fillW.position.set(6, 3, 8); scene.add(fillW);
  }

  const rim = new THREE.DirectionalLight(0xffb070, 0);
  rim.position.set(6, 2.5, -5); scene.add(rim);
  const target = new THREE.Vector3();
  let mobile = false, aspect = 1, stateClosed = false;

  const draw = {
    scene, camera,
    resize(w, h) { aspect = w / h; mobile = w <= 700; camera.aspect = aspect; camera.updateProjectionMatrix(); },
    update(p, ptr) {
      const t = smooth(0, 0.8, p);
      meshes.forEach((m) => {
        const b = m.userData;

        const w0 = b.y * 0.13 + b.jitter * 0.05, w1 = w0 + (V2 ? 0.55 : 0.42);
        const k = easeOut(smooth(w0, w1, t));
        m.position.copy(b.home).addScaledVector(b.out, b.dist * (V2 ? 1.6 : 1) * (1 - k));
        m.rotation.set(b.tilt.x * (1 - k), b.tilt.y * (1 - k), b.tilt.z * (1 - k));
      });

      const az = lerp(-0.62, 0.34, easeOut(smooth(0, 1, p))) + (ptr.x * 0.045);
      const el = lerp(mobile ? 0.44 : 0.36, mobile ? 0.3 : 0.14, smooth(0, 1, p)) + (ptr.y * -0.03);
      const dist = lerp(mobile ? 21 : 18.5, mobile ? 26 : 20, smooth(0, 1, p));
      if (mobile) target.set(0.3, lerp(6.0, 5.4, p), 0);
      else target.set(lerp(-5.8, -5.2, p), lerp(2.5, 2.2, p), 0);
      orbit(camera, target, az, el, dist);
      rim.intensity = smooth(0.78, 1, p) * 1.6;
      L.key.intensity = 3.2 - smooth(0.78, 1, p) * 0.6;
      const closed = t > 0.8;
      if (closed !== stateClosed) { stateClosed = closed; host.setAttribute('data-sc-verify-state', closed ? 'doos=dicht' : 'doos=los'); }

      if (!reduce) host.style.opacity = String(1 - smooth(0.88, 1, p));
    }
  };
  const rt = runtime(host, actEl, renderer, draw, 1);

  const nearCanvas = host.querySelector('.scene__near');
  const nearRenderer = nearCanvas ? makeRenderer(nearCanvas) : null;
  if (nearRenderer) {
    const ns = new THREE.Scene();
    const nc = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    const slab = new THREE.Mesh(geometry(3, 1, 1), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.6, color: V2 ? 0xb8905c : 0x8a9099, roughness: 0.95 }));
    slab.scale.set(1.25, 1.35, 1.6);
    ns.add(slab);
    const nk = new THREE.DirectionalLight(V2 ? 0xffd9a6 : 0xd6e1f0, 2.2); nk.position.set(-3, 4, 3); ns.add(nk);
    ns.add(V2 ? new THREE.HemisphereLight(0x9a6a2e, 0x1a0a02, 0.6) : new THREE.HemisphereLight(0x3b4352, 0x0b0b0d, 0.6));
    const ndraw = {
      scene: ns, camera: nc,
      resize(w, h) { nc.aspect = w / h; nc.updateProjectionMatrix(); },
      update(p, ptr) {
        slab.position.set(2.05 + ptr.x * 0.28 + p * 0.35, -1.55 - p * 0.9 + ptr.y * 0.16, -2.9);
        slab.rotation.set(0.12, -0.55 + p * 0.18, 0.06);
        nc.position.set(0, 0, 0); nc.lookAt(0, 0, -1);
      }
    };
    runtime(host, actEl, nearRenderer, ndraw, 1);
  }
  return rt;
}

function heroFloat(host, actEl, tex) {
  const canvas = host.querySelector('.scene__canvas');
  const renderer = makeRenderer(canvas);
  if (!renderer) return null;
  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0xa8702a, 12, 40);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const mk = (color) => new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.1, color, roughness: 0.96, metalness: 0 });
  const matMid = mk(0xc9a06a), matFore = mk(0x6a4522), matBack = mk(0xd6b07a);

  const defs = [
    [8.0, 1.0, 1.6,  4.6, 5.8, -3.0, 1,  0.6, 0.25, 0.0,  0.02],
    [1.4, 4.6, 3.0,  8.4, 1.0, -1.0, 1,  0.3, 0.5, 0.2,  -0.02],
    [4.0, 0.9, 3.0, 10.8, 3.8, -5.0, 1,  0.8, 0.2, 0.0,  0.03],
    [6.0, 1.2, 1.4, 11.5, -1.6, 2.0, 1,  0.9, -0.3, 0.3, -0.015],
    [2.0, 2.0, 2.0, 12.8, 6.2, -2.0, 1,  0.4, 0.6, 0.0,  0.05],
    [1.2, 3.6, 2.2, 14.0, 2.4, -8.0, 2,  0.3, 0.4, 0.0,  0.02],
    [5.0, 0.8, 2.6,  7.8, 7.0, -9.0, 2,  0.7, 0.2, 0.0,  0.02],
    [9.0, 1.0, 2.0,  6.5, 4.2, -16.0, 2, 0.5, 0.1, 0.0,  0.01],
    [5.0, 2.6, 2.0,  9.4, -3.6, 5.0, 0,  1.6, -0.6, 0.4, -0.02],
  ];
  const slabs = defs.map(([w, h, d, x, y, z, layer, dx, dy, dz, rot]) => {
    const m = new THREE.Mesh(geometry(w, h, d), layer === 0 ? matFore : layer === 1 ? matMid : matBack);
    m.castShadow = layer !== 2; m.receiveShadow = true;
    m.position.set(x, y, z);
    m.userData = { home: m.position.clone(), drift: new THREE.Vector3(dx, dy, dz), rot, layer, phase: (x * 7 + y * 3) % 6.28 };
    scene.add(m);
    return m;
  });

  const key = new THREE.DirectionalLight(0xffdcaa, 4.2);
  key.position.set(-8, 12, -14); key.target.position.set(8, 2, -2); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2; key.shadow.camera.far = 70;
  key.shadow.camera.left = key.shadow.camera.bottom = -22;
  key.shadow.camera.right = key.shadow.camera.top = 22;
  key.shadow.bias = -0.0006; key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffc48c, 1.5); fill.position.set(6, 3, 10); scene.add(fill);
  const hemi = new THREE.HemisphereLight(0xb9803a, 0x2a1206, 1.0); scene.add(hemi);
  const sun = new THREE.PointLight(0xffc58a, 40, 40, 2); sun.position.set(-4, 9, -8); scene.add(sun);
  const target = new THREE.Vector3();
  let mobile = false, stateRest = false;

  const draw = {
    scene, camera,
    resize(w, h) {
      mobile = w <= 700;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const ms = mobile ? 1024 : 2048;
      if (key.shadow.mapSize.x !== ms) { key.shadow.mapSize.set(ms, ms); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    },
    update(p, ptr) {
      const s = smooth(0, 1, p);

      slabs.forEach((m) => {
        const u = m.userData;
        m.position.copy(u.home).addScaledVector(u.drift, s);
        m.rotation.set(u.rot * 0.6 * (1 - s), u.rot * (1 - s) + Math.sin(u.phase) * 0.01, u.rot * 0.4 * (1 - s));
      });
      if (mobile) {
        target.set(lerp(7.0, 7.4, s), lerp(9.0, 8.2, s), -3);
        orbit(camera, target, lerp(-0.04, 0.04, s) + ptr.x * 0.03, lerp(0.16, 0.1, s) + ptr.y * -0.02, lerp(26, 22, s));
      } else {
        target.set(lerp(3.0, 3.4, s), lerp(2.2, 2.0, s), lerp(-2, -3, s));
        orbit(camera, target, lerp(-0.06, 0.05, s) + ptr.x * 0.045, lerp(0.08, 0.04, s) + ptr.y * -0.03, lerp(16.5, 14.5, s));
      }

      const rest = p > 0.8;
      if (rest !== stateRest) { stateRest = rest; host.setAttribute('data-sc-verify-state', rest ? 'doos=dicht' : 'doos=los'); }
      if (!reduce) host.style.opacity = String(1 - smooth(0.88, 1, p));
    }
  };
  const rt = runtime(host, actEl, renderer, draw, 1);

  window.__heroProbe = (p, zone) => {
    draw.update(p, { x: 0, y: 0 });
    camera.updateMatrixWorld();
    const hits = [];
    const v = new THREE.Vector3();
    slabs.forEach((m, i) => {
      const bb = new THREE.Box3().setFromObject(m);
      let minx = 9, maxx = -9, miny = 9, maxy = -9, minD = 999;
      for (let k = 0; k < 8; k++) {
        v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z);
        const d = v.distanceTo(camera.position);
        v.project(camera);
        if (v.z > 1 || v.z < -1) continue;
        minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); minD = Math.min(minD, d);
      }
      if (minD >= fog.far) return;
      const overlap = !(maxx < zone.x0 || minx > zone.x1 || maxy < zone.y0 || miny > zone.y1);
      if (overlap) hits.push({ name: 'plaat' + i, box: [minx, maxx, miny, maxy].map((n) => +n.toFixed(2)), minD: +minD.toFixed(1) });
    });
    return hits;
  };

  const nearCanvas = host.querySelector('.scene__near');
  const nearRenderer = nearCanvas ? makeRenderer(nearCanvas) : null;
  if (nearRenderer) {
    const ns = new THREE.Scene();
    const nc = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    const slab = new THREE.Mesh(geometry(3, 1, 1), mk(0x7a5228));
    slab.scale.set(1.8, 1.5, 1.7);
    ns.add(slab);
    const nk = new THREE.DirectionalLight(0xffdcaa, 1.6); nk.position.set(-3, 4, 3); ns.add(nk);
    ns.add(new THREE.HemisphereLight(0xb9803a, 0x2a1206, 0.7));
    const ndraw = {
      scene: ns, camera: nc,
      resize(w, h) { nc.aspect = w / h; nc.updateProjectionMatrix(); },
      update(p, ptr) {
        slab.position.set(2.3 + ptr.x * 0.28 + p * 0.7, -2.1 - p * 0.6 + ptr.y * 0.16, -2.9);
        slab.rotation.set(0.1, -0.5 + p * 0.1, 0.05);
        nc.position.set(0, 0, 0); nc.lookAt(0, 0, -1);
      }
    };
    runtime(host, actEl, nearRenderer, ndraw, 1);
  }
  return rt;
}

function blok(host, actEl, tex) {
  const canvas = host.querySelector('.scene__canvas');
  const renderer = makeRenderer(canvas);
  if (!renderer) return null;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.fog = V2 ? new THREE.Fog(0xa8702a, 24, 50) : new THREE.Fog(0x131417, 26, 48);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
  const { meshes, mat, ground } = buildCube(scene, tex, V2 ? 0xc9a06a : 0xa3a9b2);
  if (V2) mat.bumpScale = 0.1;

  ground.material = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.15, color: V2 ? 0x6a3d16 : 0x4a4f58, roughness: 0.97 });
  ground.material.map = tex.clone(); ground.material.map.repeat.set(6, 6); ground.material.map.needsUpdate = true;
  const key = new THREE.DirectionalLight(V2 ? 0xffdcaa : 0xd9e4f4, V2 ? 4.4 : 4.0);
  if (V2) key.position.set(-8, 9, -9); else key.position.set(-8, 9, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  key.shadow.camera.left = key.shadow.camera.bottom = -9;
  key.shadow.camera.right = key.shadow.camera.top = 9;
  key.shadow.bias = -0.0006; key.shadow.radius = 4;
  scene.add(key);
  scene.add(V2 ? new THREE.HemisphereLight(0xb9803a, 0x2a1206, 1.0) : new THREE.HemisphereLight(0x4a5262, 0x0b0b0d, 0.5));
  const fill = new THREE.DirectionalLight(V2 ? 0xffc48c : 0x8fa3c4, V2 ? 1.4 : 0.3); fill.position.set(7, 3, 6); scene.add(fill);

  const glow = V2 ? new THREE.PointLight(0xffc58a, 48, 30, 2) : new THREE.PointLight(0x9fb4d6, 40, 26, 2);
  if (V2) glow.position.set(-3, 6, -8); else glow.position.set(3, 1.2, -7);
  scene.add(glow);
  const one = meshes.find((m) => m.userData.one);

  const grey = new THREE.Color(V2 ? 0xc9a06a : 0xa3a9b2), red = new THREE.Color(V2 ? 0xf6d78a : 0xcd5c5c);
  const target = new THREE.Vector3();
  let stateOut = false, narrow = false;

  const draw = {
    scene, camera,
    resize(w, h) { camera.aspect = w / h; narrow = w < 520; camera.updateProjectionMatrix(); },
    update(p, ptr) {

      const k = easeOut(smooth(0.16, 0.44, p));

      const az = lerp(-0.46, -0.3, smooth(0, 1, p)) + ptr.x * 0.03;
      const el = 0.13 + ptr.y * -0.02;
      target.set(0.2, 2.2, 0.2);
      orbit(camera, target, az, el, lerp(narrow ? 25 : 23.5, narrow ? 23 : 21.5, smooth(0, 1, p)));

      one.position.copy(one.userData.home).add(V2 ? new THREE.Vector3(k * 0.9, k * 0.2, k * 1.6) : new THREE.Vector3(k * 0.55, 0, k * 1.05));
      one.material.color.copy(grey).lerp(red, smooth(0.2, 0.8, k));
      if (V2) one.material.emissive.setRGB(0.42 * k, 0.30 * k, 0.08 * k); else one.material.emissive.setRGB(0.10 * k, 0.025 * k, 0.02 * k);
      const out = k > 0.5;
      if (out !== stateOut) { stateOut = out; host.setAttribute('data-sc-verify-state', out ? 'blok=uit' : 'blok=in'); }
    }
  };
  return runtime(host, actEl, renderer, draw, 0.44);
}

const tex = concreteTexture();
const scenes = {};

if (V2) {
  const src = document.querySelector('[data-scene="hero"] .scene__poster source');
  const img = document.querySelector('[data-scene="hero"] .scene__poster img');
  if (src) src.srcset = 'posters/v2/hero-phone.png';
  if (img) img.src = 'posters/v2/hero-desktop.png';
  const blokImg = document.querySelector('[data-scene="blok"] .scene__poster img');
  if (blokImg) blokImg.src = 'posters/v2/blok.png';
}
document.querySelectorAll('[data-scene]').forEach((host) => {
  const kind = host.getAttribute('data-scene');
  const actEl = host.closest('[data-sc-act]');
  if (!actEl) return;
  const rt = kind === 'hero' ? (V2 ? heroFloat : hero)(host, actEl, tex) : kind === 'blok' ? blok(host, actEl, tex) : null;
  if (rt) scenes[kind] = rt;
  else host.classList.add('is-static');
});

window.__sceneRedraw = () => Object.values(scenes).forEach((s) => s.redraw());
window.__scenes = scenes;
