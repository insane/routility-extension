import * as THREE from '../../vendor/three.module.js';

const ACCESSORY = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58, 76, 77]);
const LAYERED = new Set([64, 65, 66, 67, 68, 69, 70, 71, 72]);
const HEADS = new Set([17, 79]);
const BODY = new Set([27, 28, 29, 30, 31]);
const R6_RIG = '134202675113006';
const R15_RIG = '117612227055721';
const TEMPLATE_W = 585;
const TEMPLATE_H = 559;

const files = new Map();
const meshes = new Map();
const textures = new Map();
let dracoReady = null;

function send(msg) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; resolve(res); });
    } catch {
      resolve(null);
    }
  });
}

const BUILTIN = { 'fonts/sword.mesh': '12221720' };

export function assetIdOf(value) {
  const builtin = String(value || '').match(/^rbxasset:\/\/(.+)$/i);
  if (builtin) return BUILTIN[builtin[1].toLowerCase()] || null;
  const m = String(value || '').match(/(?:id=|rbxassetid:\/\/|\/asset\/\?id=)\s*(\d+)/i) || String(value || '').trim().match(/^(\d+)$/);
  return m ? m[1] : null;
}

const CACHE_NAME = 'routility-avatar-v1';
const CACHE_DAYS = 14;

async function fromCache(key) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (!hit) return null;
    if (Date.now() - Number(hit.headers.get('x-at') || 0) > CACHE_DAYS * 86400000) return null;
    return { buffer: await hit.arrayBuffer(), type: Number(hit.headers.get('x-type')) || 0 };
  } catch {
    return null;
  }
}

function toCache(key, value) {
  caches.open(CACHE_NAME)
    .then(cache => cache.put(key, new Response(value.buffer.slice(0), { headers: { 'x-type': String(value.type || 0), 'x-at': String(Date.now()) } })))
    .catch(() => {});
}

export async function fetchAsset(id, format) {
  const key = id + '|' + (format || '');
  if (!files.has(key)) {
    files.set(key, (async () => {
      const cacheKey = 'https://routility.invalid/asset/' + id + '/' + (format || 'raw');
      const hit = await fromCache(cacheKey);
      if (hit) return hit;
      const res = await send({ type: 'assetFile', id: String(id), format: format || '' });
      if (!res || res.status !== 200) throw new Error('asset ' + id + ' ' + (res && res.status));
      let r = await fetch(res.location).catch(() => null);
      if (!r || !r.ok) {
        await new Promise(w => setTimeout(w, 800));
        r = await fetch(res.location).catch(() => null);
      }
      if (!r || !r.ok) throw new Error('download ' + id);
      const value = { buffer: await r.arrayBuffer(), type: res.assetTypeId };
      toCache(cacheKey, value);
      return value;
    })());
    files.get(key).catch(() => files.delete(key));
  }
  return files.get(key);
}

export async function loadModel(id, format) {
  const { buffer, type } = await fetchAsset(id, format);
  return { model: window.RoUtilityRbxm.parse(buffer), type };
}

async function draco() {
  if (!dracoReady) {
    dracoReady = (async () => {
      if (!window.DracoDecoderModule) await send({ type: 'loadDraco' });
      if (!window.DracoDecoderModule) throw new Error('draco unavailable');
      const wasmBinary = await (await fetch(chrome.runtime.getURL('vendor/draco_decoder.wasm'))).arrayBuffer();
      return window.DracoDecoderModule({ wasmBinary });
    })();
    dracoReady.catch(() => { dracoReady = null; });
  }
  return dracoReady;
}

async function decodeDraco(bytes) {
  const D = await draco();
  const decoder = new D.Decoder();
  const buffer = new D.DecoderBuffer();
  buffer.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.byteLength);
  const mesh = new D.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error('draco decode failed');
  const numPoints = mesh.num_points();
  const numFaces = mesh.num_faces();
  const read = (uid, comps) => {
    const attr = decoder.GetAttributeByUniqueId(mesh, uid);
    if (!attr || attr.ptr === 0) return null;
    const arr = new D.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attr, arr);
    const out = new Float32Array(numPoints * comps);
    for (let i = 0; i < out.length; i++) out[i] = arr.GetValue(i);
    D.destroy(arr);
    return out;
  };
  const pos = read(0, 3);
  const nrm = read(1, 3);
  const uvRaw = read(2, 2);
  const uv = uvRaw ? uvRaw.map((v, i) => i % 2 ? 1 - v : v) : null;
  const idx = new Uint32Array(numFaces * 3);
  const face = new D.DracoInt32Array();
  for (let f = 0; f < numFaces; f++) {
    decoder.GetFaceFromMesh(mesh, f, face);
    idx[f * 3] = face.GetValue(0);
    idx[f * 3 + 1] = face.GetValue(1);
    idx[f * 3 + 2] = face.GetValue(2);
  }
  D.destroy(face);
  D.destroy(mesh);
  D.destroy(buffer);
  D.destroy(decoder);
  return { pos, nrm, uv, col: null, idx };
}

export async function loadMesh(id) {
  if (!meshes.has(id)) {
    meshes.set(id, (async () => {
      const { buffer } = await fetchAsset(id);
      const m = await window.RoUtilityMesh.parse(buffer, decodeDraco);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
      if (m.nrm) g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
      if (m.uv) g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      g.setIndex(new THREE.BufferAttribute(m.idx, 1));
      if (!m.nrm) g.computeVertexNormals();
      g.computeBoundingBox();
      return g;
    })());
    meshes.get(id).catch(() => meshes.delete(id));
  }
  return meshes.get(id);
}

export async function loadTexture(id, upright) {
  const key = id + (upright ? '|u' : '');
  if (!textures.has(key)) {
    textures.set(key, (async () => {
      const { buffer } = await fetchAsset(id);
      return createImageBitmap(new Blob([buffer]), upright ? {} : { imageOrientation: 'flipY' });
    })());
    textures.get(key).catch(() => textures.delete(key));
  }
  return textures.get(key);
}

export function cf(v) {
  const m = new THREE.Matrix4();
  if (!v || v.kind !== 'cframe') return m;
  const r = v.mat;
  const p = v.raw || v.pos;
  m.set(r[0], r[1], r[2], p[0], r[3], r[4], r[5], p[1], r[6], r[7], r[8], p[2], 0, 0, 0, 1);
  return m;
}

export function prop(inst, name) {
  return inst && inst.props.find(p => p.name === name);
}

export function vec(inst, ...names) {
  for (const n of names) {
    const p = prop(inst, n);
    if (p && p.kind === 'tuple') return new THREE.Vector3(...(p.raw || p.value));
  }
  return null;
}

export function descendants(inst) {
  return [inst, ...inst.children.flatMap(descendants)];
}

function hexColor(hex) {
  return new THREE.Color('#' + String(hex || 'A3A2A5').replace('#', ''));
}

function partColor(inst) {
  const p = prop(inst, 'Color3uint8') || prop(inst, 'Color');
  if (p && p.kind === 'color') return new THREE.Color(p.value[0], p.value[1], p.value[2]);
  return new THREE.Color(0.64, 0.64, 0.65);
}

const REDUCED = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_PARTICLES = 400;
const DIRECTIONS = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];

function num(inst, ...names) {
  for (const n of names) {
    const p = prop(inst, n);
    if (p && Number.isFinite(Number(p.value))) return Number(p.value);
  }
  return null;
}

function noiseSprite(size, seed, shape) {
  const data = new Uint8Array(size * size * 4);
  const hash = (x, y) => { const n = Math.sin(x * seed[0] + y * seed[1]) * 43758.5453; return n - Math.floor(n); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.max(0, Math.min(1, shape(nx, ny, x, y, noise))) * 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.shared = true;
  return t;
}

const sprites = {};

function smokeSprite() {
  return sprites.smoke || (sprites.smoke = noiseSprite(64, [91.7, 271.3], (x, y, px, py, n) => {
    const s = n(px / 9, py / 9) * 0.6 + n(px / 4, py / 4) * 0.4;
    return Math.max(0, Math.min(1, (1 - Math.hypot(x, y)) * 1.35)) ** 1.5 * (0.7 + 0.3 * s);
  }));
}

function flameSprite() {
  return sprites.flame || (sprites.flame = noiseSprite(64, [127.1, 311.7], (x, y, px, py, n) => {
    const s = n(px / 7, py / 7) * 0.5 + n(px / 3.5, py / 3.5) * 0.3 + n(px / 1.6, py / 1.6) * 0.2;
    return (1 - Math.hypot(x * 1.15, y * 0.9)) * 1.6 - (1 - s) * 0.75;
  }));
}

function fireSprite() {
  return sprites.fire || (sprites.fire = noiseSprite(128, [63.7, 157.9], (x, y, px, py, n) => {
    const s = n(px / 14, py / 14) * 0.55 + n(px / 6, py / 6) * 0.3 + n(px / 2.5, py / 2.5) * 0.15;
    const r = Math.hypot(x, y);
    return (r < 0.5 ? 1 : Math.max(0, 1 - (r - 0.5) / 0.42) ** 1.6) * (0.2 + 0.62 * s);
  }));
}

function sparkleSprite(rgba) {
  const key = rgba ? 'sparkRgba' : 'spark';
  if (sprites[key]) return sprites[key];
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const r = Math.hypot(nx, ny);
      let rays = 0;
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        const len = k % 2 ? 0.62 : 0.98;
        const width = k % 2 ? 0.026 : 0.032;
        const along = nx * Math.cos(ang) + ny * Math.sin(ang);
        if (along <= 0 || along >= len) continue;
        const fall = 1 - along / len;
        const across = Math.abs(-nx * Math.sin(ang) + ny * Math.cos(ang));
        rays = Math.max(rays, Math.exp(-((across / (width * fall + 0.006)) ** 2)) * fall ** 1.4);
      }
      const star = Math.min(1, rays + 0.85 * Math.exp(-((r / 0.09) ** 2)));
      const glow = Math.min(1, 0.7 * Math.exp(-((r / 0.2) ** 2)) + 0.18 * Math.exp(-((r / 0.45) ** 2))) * Math.max(0, 1 - r);
      const core = Math.exp(-((r / 0.04) ** 2));
      const i = (y * size + x) * 4;
      if (rgba) {
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.min(1, star + 0.45 * glow) * 255;
      } else {
        data[i] = star * 255;
        data[i + 1] = glow * 255;
        data[i + 2] = core * 255;
        data[i + 3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.shared = true;
  sprites[key] = t;
  return t;
}

let seqIndex = 0;
let seqT = 0;

function seqFind(keys, t) {
  seqIndex = 0;
  seqT = 0;
  if (t <= keys[0][0]) return;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b[0]) {
      seqIndex = i;
      seqT = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
      return;
    }
  }
  seqIndex = keys.length - 1;
}

function seqValue(keys, k) {
  const a = keys[seqIndex];
  const b = keys[seqIndex + 1] || a;
  return a[k] + (b[k] - a[k]) * seqT;
}

function seqJitter(keys, rand, base) {
  const i = seqIndex;
  const a = keys[i];
  const b = keys[i + 1] || a;
  const j = keys[i + 1] ? i + 1 : i;
  const va = a[1] + (a[2] || 0) * rand[base + i];
  return va + (b[1] + (b[2] || 0) * rand[base + j] - va) * seqT;
}

const hasEnvelope = (keys) => keys.some(k => k[2]);
const pick = (range) => (range ? Number(range[0]) + Math.random() * (Number(range[1] ?? range[0]) - Number(range[0])) : 0);
const rangeOf = (inst, name) => { const p = prop(inst, name); return p && Array.isArray(p.value) ? p.value : p && Array.isArray(p.raw) ? p.raw : null; };
const numOf = (inst, name, d) => { const p = prop(inst, name); return p && Number.isFinite(Number(p.value)) ? Number(p.value) : d; };
const enumOf = (inst, name, d) => { const p = prop(inst, name); const v = p && (typeof p.value === 'object' && p.value ? p.value.value : p.value); return Number.isFinite(Number(v)) ? Number(v) : d; };
const boolOf = (inst, name, d) => { const p = prop(inst, name); return p ? p.value !== false && p.value !== 'false' : d; };
const colorOf3 = (inst, name, d) => { const p = prop(inst, name); return p && p.kind === 'color' ? p.value : d; };
const keysOf = (inst, name) => { const p = prop(inst, name); return p && p.keys && p.keys.length ? p.keys : null; };

const INSTANCE_ATTRS = ['iPos', 'iVel', 'iCol', 'iSize', 'iMisc'];
const tmpPos = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
let quadCorners = null;

const PARTICLE_VERTEX = `attribute vec2 corner; attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec2 iSize; attribute vec4 iMisc;
  uniform float orient; uniform float zoff; uniform vec2 grid;
  varying vec2 vUv; varying vec2 vUv2; varying float vB; varying float vA; varying vec4 vC;
  vec2 cell(float f) { float n = grid.x * grid.y; f = mod(f, n); float col = mod(f, grid.x); float row = floor(f / grid.x);
    return (vec2(col, row) + vec2(corner.x + 0.5, 0.5 - corner.y)) / grid; }
  void main() {
    vA = iMisc.y;
    if (vA <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vC = iCol;
    float r = -iMisc.x, cs = cos(r), sn = sin(r);
    vec2 c = corner * iSize;
    vec2 rc = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
    vec4 wp = modelMatrix * vec4(iPos, 1.0);
    vec3 toCam = normalize(cameraPosition - wp.xyz);
    if (orient < 0.5) {
      vec4 mv = viewMatrix * wp;
      float d = max(0.05, -mv.z), nd = max(0.05, d - zoff), k = nd / d;
      mv.xyz *= k;
      mv.xy += rc * k;
      gl_Position = projectionMatrix * mv;
    } else {
      vec3 up, right;
      if (orient < 1.5) { up = vec3(0.0, 1.0, 0.0); right = normalize(cross(up, toCam) + vec3(1e-5, 0.0, 0.0)); }
      else {
        vec3 v = mat3(modelMatrix) * iVel;
        v = length(v) > 1e-5 ? normalize(v) : vec3(0.0, 1.0, 0.0);
        if (orient < 2.5) { up = v; right = normalize(cross(up, toCam) + vec3(1e-5, 0.0, 0.0)); }
        else { right = normalize(abs(v.y) < 0.99 ? cross(v, vec3(0.0, 1.0, 0.0)) : cross(v, vec3(1.0, 0.0, 0.0))); up = cross(right, v); }
      }
      vec3 p = wp.xyz + right * rc.x + up * rc.y + toCam * zoff;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }
    vUv = cell(iMisc.z);
    vUv2 = cell(iMisc.z + 1.0);
    vB = iMisc.w;
  }`;

const PARTICLE_FRAGMENT = `uniform sampler2D map; uniform float hasMap; uniform float sparkle; uniform float blendFrames;
  varying vec2 vUv; varying vec2 vUv2; varying float vB; varying float vA; varying vec4 vC;
  void main() {
    if (hasMap < 0.5) discard;
    vec4 t = texture2D(map, vUv);
    if (blendFrames > 0.5 && vB > 0.0) t = mix(t, texture2D(map, vUv2), vB);
    if (sparkle > 0.5) {
      float lift = 1.0 - max(vC.r, max(vC.g, vC.b));
      vec3 col = vC.rgb * (t.r * 1.3 + t.g * 0.85) + vec3(t.b * 0.95 + lift * 0.55 * (t.r + 0.35 * t.g));
      col *= vA; if (max(col.r, max(col.g, col.b)) < 0.004) discard;
      gl_FragColor = vec4(col, clamp((t.r * 0.35 + t.g * 0.15) * vA, 0.0, 1.0) * 0.3);
      return;
    }
    float a = t.a * vA; if (a < 0.004) discard;
    gl_FragColor = vec4(t.rgb * vC.rgb * a, a * (1.0 - vC.a)); }`;

const EFFECT_CLASS = /^(Sparkles|ParticleEmitter|Smoke|Fire)$/;

class ParticleEffect {
  constructor(inst, host, local, size) {
    this.host = host;
    this.local = local || new THREE.Matrix4();
    const kind = inst.className;
    const onAttachment = !!(inst.parent && inst.parent.className === 'Attachment');
    const c = { shape: onAttachment ? -1 : 0, style: 0, inout: 0, partial: 1, orient: 0, zoff: 0, squash: null, flip: null, timeScale: Math.max(0, Math.min(1, numOf(inst, 'TimeScale', 1))), vi: 0, brightness: 1, li: 0, le: 0, dir: 1, spread: [0, 0] };
    if (kind === 'Sparkles') {
      const col = colorOf3(inst, 'SparkleColor', null) || colorOf3(inst, 'Color', null) || [0.565, 0.098, 1];
      Object.assign(c, {
        rate: 24, life: [1.3, 1.9], speed: [3.4, 6.6], spread: [180, 180],
        size: [[0, 0.3, 0], [0.3, 0.6, 0], [0.5, 0.85, 0], [0.6, 1.05, 0], [0.7, 1.35, 0], [0.8, 1.8, 0], [0.9, 2.4, 0], [1, 3.3, 0]],
        transp: [[0, 1, 0], [0.15, 1, 0], [0.3, 0.5, 0], [0.45, 0.32, 0], [0.65, 0.38, 0], [0.8, 0.57, 0], [0.95, 0.85, 0], [1, 1, 0]],
        color: [[0, ...col, 0], [1, ...col, 0]], le: 1, rot: [-10, 10], rotSpeed: [0, 0], accel: [0, 0.6, 0], drag: 0.7, locked: false, tex: sparkleSprite(false), sparkle: true,
      });
    } else if (kind === 'Fire') {
      const c1 = colorOf3(inst, 'Color', [0.925, 0.545, 0.275]);
      const c2 = colorOf3(inst, 'SecondaryColor', [0.545, 0.314, 0.216]);
      const sz = Math.max(2, Math.min(30, num(inst, 'size_xml', 'Size') ?? 5));
      const heat = Math.max(-25, Math.min(25, num(inst, 'heat_xml', 'Heat') ?? 9));
      const sign = heat < 0 ? -1 : 1;
      const h = Math.abs(heat);
      Object.assign(c, {
        rate: 65, life: [0.9, 1.4], speed: [(1 + h * 0.15) * sign, (1.6 + h * 0.19) * sign], spread: [8, 8], dir: 1,
        size: [[0, sz * 0.62, 0], [0.4, sz * 0.48, 0], [1, sz * 0.07, 0]],
        transp: [[0, 0.5, 0], [0.1, 0.1, 0], [0.6, 0.35, 0], [1, 1, 0]],
        color: [[0, ...c1, 0], [1, ...c1, 0]], le: 0.4,
        inner: { share: 0.4, size: 0.55, life: 1.6, le: 1, accel: [0, h * 0.35 * sign, 0], color: [[0, ...c2, 0], [1, ...c2, 0]] },
        rot: [0, 360], rotSpeed: [-90, 90], accel: [0, 0, 0], drag: 0, locked: false, tex: flameSprite(), shape: -2, coreR: sz * 0.07,
      });
    } else if (kind === 'Smoke') {
      const col = colorOf3(inst, 'Color', [1, 1, 1]);
      const opacity = Math.max(0, Math.min(1, numOf(inst, 'Opacity', 0.5)));
      const rise = Math.max(-25, Math.min(25, numOf(inst, 'RiseVelocity', 1)));
      const sz = Math.max(0.1, Math.min(100, numOf(inst, 'Size', 1)));
      Object.assign(c, {
        rate: 12, life: [3, 4.5], speed: [rise * 0.8, rise * 1.2], spread: [12, 12], dir: 1,
        size: [[0, sz * 1.2, 0], [1, sz * 3.2, 0]],
        transp: [[0, 1 - opacity * 0.75, 0], [0.15, 1 - opacity * 0.75, 0], [1, 1, 0]],
        color: [[0, ...col, 0], [1, ...col, 0]], le: 0, rot: [0, 360], rotSpeed: [-25, 25], accel: [0, 0, 0], drag: 0.25, locked: false, tex: smokeSprite(), shape: -2, coreR: sz * 0.3,
      });
    } else {
      Object.assign(c, {
        rate: numOf(inst, 'Rate', 20),
        life: rangeOf(inst, 'Lifetime') || [5, 10],
        speed: rangeOf(inst, 'Speed') || [5, 5],
        spread: rangeOf(inst, 'SpreadAngle') || [0, 0],
        dir: enumOf(inst, 'EmissionDirection', 1),
        size: keysOf(inst, 'Size') || [[0, 1, 0], [1, 1, 0]],
        transp: keysOf(inst, 'Transparency') || [[0, 0, 0], [1, 0, 0]],
        color: keysOf(inst, 'Color') || [[0, 1, 1, 1, 0], [1, 1, 1, 1, 0]],
        squash: keysOf(inst, 'Squash'),
        le: Math.max(0, Math.min(1, numOf(inst, 'LightEmission', 0))),
        li: Math.max(0, Math.min(1, numOf(inst, 'LightInfluence', 0))),
        brightness: Math.max(0, numOf(inst, 'Brightness', 1)),
        rot: rangeOf(inst, 'Rotation') || [0, 0],
        rotSpeed: rangeOf(inst, 'RotSpeed') || [0, 0],
        accel: rangeOf(inst, 'Acceleration') || [0, 0, 0],
        drag: numOf(inst, 'Drag', 0),
        locked: boolOf(inst, 'LockedToPart', false),
        vi: Math.max(0, Math.min(1, numOf(inst, 'VelocityInheritance', 0))),
        orient: enumOf(inst, 'Orientation', 0),
        zoff: numOf(inst, 'ZOffset', 0),
        style: enumOf(inst, 'ShapeStyle', 0),
        inout: enumOf(inst, 'ShapeInOut', 0),
        partial: Math.max(0, Math.min(1, numOf(inst, 'ShapePartial', 1))),
      });
      if (!onAttachment) c.shape = enumOf(inst, 'Shape', 0);
      if (c.squash && !c.squash.some(k => k[1])) c.squash = null;
      const layout = enumOf(inst, 'FlipbookLayout', 0);
      const gx = layout === 1 ? 2 : layout === 2 ? 4 : layout === 3 ? 8 : layout === 4 ? Math.max(1, numOf(inst, 'FlipbookSizeX', 1)) : 1;
      const gy = layout === 1 ? 2 : layout === 2 ? 4 : layout === 3 ? 8 : layout === 4 ? Math.max(1, numOf(inst, 'FlipbookSizeY', 1)) : 1;
      if (gx * gy > 1) {
        const fps = rangeOf(inst, 'FlipbookFramerate') || [1, 1];
        c.flip = { gx, gy, n: gx * gy, mode: enumOf(inst, 'FlipbookMode', 0), fps: [Math.min(30, Number(fps[0]) || 0), Math.min(30, Number(fps[1] ?? fps[0]) || 0)], startRandom: boolOf(inst, 'FlipbookStartRandom', false), blend: boolOf(inst, 'FlipbookBlendFrames', true) };
      }
      const texture = String((prop(inst, 'Texture') || prop(inst, 'TextureContent') || {}).value || '');
      const texId = assetIdOf(texture);
      const builtin = !texId && /^rbxasset:/i.test(texture) ? texture.toLowerCase() : '';
      if (!texId) c.tex = /fire/.test(builtin) ? fireSprite() : /smoke|cloud|explosion|puff/.test(builtin) ? smokeSprite() : sparkleSprite(true);
      else {
        loadTexture(texId, true).then((bitmap) => {
          const t = new THREE.Texture(bitmap);
          t.flipY = false;
          t.colorSpace = THREE.SRGBColorSpace;
          t.needsUpdate = true;
          if (c.flip) {
            t.generateMipmaps = false;
            t.minFilter = THREE.LinearFilter;
          }
          this.material.uniforms.map.value = t;
          this.material.uniforms.hasMap.value = 1;
          this.ownTexture = t;
        }).catch(() => {});
      }
    }
    if (REDUCED) c.rate *= 0.15;
    c.rate = Math.max(0, Math.min(Number(c.rate) || 0, 2000));
    const longest = Math.max(...c.life.map(Number).filter(Number.isFinite), 0);
    if (!(longest > 0)) c.rate = 0;
    const span = Math.max(0.05, longest * (c.inner ? Math.max(1, c.inner.life) : 1));
    const want = Math.ceil(c.rate * span * 1.15) + 2;
    this.cap = Math.max(4, Math.min(MAX_PARTICLES, want));
    c.boost = want > this.cap && c.le > 0.5 ? Math.min(2.5, want / this.cap) : 1;
    if (want > this.cap) c.rate *= (this.cap - 2) / (want - 2);
    this.c = c;
    const n = this.cap;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1e9);
    this.life = new Float32Array(n).fill(1);
    this.rot = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.layer = new Uint8Array(n);
    this.frameStart = new Float32Array(n);
    this.frameRate = new Float32Array(n);
    this.nSize = c.size.length;
    this.nTransp = c.transp.length;
    this.nSquash = c.squash ? c.squash.length : 0;
    this.envelope = hasEnvelope(c.size) || hasEnvelope(c.transp) || (c.squash && hasEnvelope(c.squash));
    if (this.envelope) {
      this.randSize = new Float32Array(n * this.nSize);
      this.randTransp = new Float32Array(n * this.nTransp);
      this.randSquash = new Float32Array(n * Math.max(1, this.nSquash));
    }
    this.iPos = new Float32Array(n * 3);
    this.iVel = new Float32Array(n * 3);
    this.iCol = new Float32Array(n * 4);
    this.iSize = new Float32Array(n * 2);
    this.iMisc = new Float32Array(n * 4);
    if (!quadCorners) quadCorners = { corner: new THREE.Float32BufferAttribute([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], 2), index: [0, 1, 2, 0, 2, 3] };
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    geo.setAttribute('corner', quadCorners.corner);
    geo.setIndex(quadCorners.index);
    const attr = (arr, size) => new THREE.InstancedBufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', attr(this.iPos, 3));
    geo.setAttribute('iVel', attr(this.iVel, 3));
    geo.setAttribute('iCol', attr(this.iCol, 4));
    geo.setAttribute('iSize', attr(this.iSize, 2));
    geo.setAttribute('iMisc', attr(this.iMisc, 4));
    geo.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: c.tex || null },
        hasMap: { value: c.tex ? 1 : 0 },
        sparkle: { value: c.sparkle ? 1 : 0 },
        orient: { value: c.orient },
        zoff: { value: c.zoff },
        grid: { value: new THREE.Vector2(c.flip ? c.flip.gx : 1, c.flip ? c.flip.gy : 1) },
        blendFrames: { value: c.flip && c.flip.blend ? 1 : 0 },
      },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
    });
    this.points = new THREE.Mesh(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.matrixAutoUpdate = false;
    this.points.userData.effect = true;
    this.carry = 0;
    this.world = new THREE.Matrix4();
    this.frameM = new THREE.Matrix4();
    this.inv = new THREE.Matrix4();
    this.accel = new THREE.Vector3();
    this.innerAccel = new THREE.Vector3();
    this.hostInv = host.userData.local ? host.userData.local.clone().invert() : new THREE.Matrix4();
    const part = host.userData.inst || host.userData.part;
    this.size = size || (part && vec(part, 'Size', 'size')) || new THREE.Vector3(1, 1, 1);
  }

  emitterFrame() {
    this.host.updateWorldMatrix(true, false);
    this.world.copy(this.host.matrixWorld).multiply(this.hostInv).multiply(this.local);
    this.frameM.copy(this.world);
    return this.frameM;
  }

  emitShape() {
    const c = this.c;
    const size = this.size;
    const p = tmpPos.set(0, 0, 0);
    const dir = tmpDir;
    const d = DIRECTIONS[Math.max(0, Math.min(5, c.dir | 0))];
    dir.set(d[0], d[1], d[2]);
    const surface = c.style === 1;
    let radial = false;
    if (c.shape === -2) {
      const r = (c.coreR || 0.3) * Math.cbrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      p.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th));
    } else if (c.shape === 0) {
      p.set((Math.random() - 0.5) * size.x, (Math.random() - 0.5) * size.y, (Math.random() - 0.5) * size.z);
      if (surface) {
        const ax = size.y * size.z, ay = size.x * size.z, az = size.x * size.y;
        const roll = Math.random() * (ax + ay + az);
        const side = Math.random() < 0.5 ? -0.5 : 0.5;
        if (roll < ax) p.x = side * size.x;
        else if (roll < ax + ay) p.y = side * size.y;
        else p.z = side * size.z;
      }
    } else if (c.shape === 1) {
      const lo = Math.cos(Math.PI * c.partial);
      const z = 1 - Math.random() * (1 - lo);
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const th = Math.random() * Math.PI * 2;
      tmpA.set(r * Math.cos(th), r * Math.sin(th), z);
      tmpQuat.setFromUnitVectors(tmpB.set(0, 0, 1), dir);
      tmpA.applyQuaternion(tmpQuat);
      const k = surface ? 1 : Math.cbrt(Math.random());
      p.set(tmpA.x * k * size.x / 2, tmpA.y * k * size.y / 2, tmpA.z * k * size.z / 2);
      dir.copy(tmpA);
      radial = true;
    } else if (c.shape === 2) {
      const h = Math.random();
      const th = Math.random() * Math.PI * 2;
      const r = (surface ? 1 : Math.sqrt(Math.random())) * (1 + (c.partial - 1) * h);
      tmpA.set(Math.cos(th), 0, Math.sin(th));
      tmpQuat.setFromUnitVectors(tmpB.set(0, 1, 0), dir);
      tmpA.applyQuaternion(tmpQuat);
      const off = h - 0.5;
      p.set(tmpA.x * r * size.x / 2 + dir.x * off * Math.abs(size.x), tmpA.y * r * size.y / 2 + dir.y * off * Math.abs(size.y), tmpA.z * r * size.z / 2 + dir.z * off * Math.abs(size.z));
      dir.copy(tmpA);
      radial = true;
    } else if (c.shape === 3) {
      const th = Math.random() * Math.PI * 2;
      const inner = surface ? 1 : c.partial;
      const r = surface ? 1 : Math.sqrt(inner * inner + Math.random() * (1 - inner * inner));
      tmpA.set(Math.cos(th) * r, 0, Math.sin(th) * r);
      tmpQuat.setFromUnitVectors(tmpB.set(0, 1, 0), dir);
      tmpA.applyQuaternion(tmpQuat);
      p.set(tmpA.x * size.x / 2, tmpA.y * size.y / 2, tmpA.z * size.z / 2);
    }
    const sx = THREE.MathUtils.degToRad(Number(c.spread[0]) || 0);
    const sy = THREE.MathUtils.degToRad(Number(c.spread[1] ?? c.spread[0]) || 0);
    if (sx || sy) {
      if (radial || Math.abs(d[1]) >= 0.5) tmpEuler.set((Math.random() * 2 - 1) * sx, 0, (Math.random() * 2 - 1) * sy, 'XYZ');
      else tmpEuler.set(0, (Math.random() * 2 - 1) * sx, (Math.random() * 2 - 1) * sy, 'XYZ');
      dir.applyEuler(tmpEuler);
    }
    if (c.inout === 1 || (c.inout === 2 && Math.random() < 0.5)) dir.negate();
  }

  spawn(i, frame) {
    const c = this.c;
    this.emitShape();
    const p = tmpPos;
    const speed = pick(c.speed);
    const v = tmpB.copy(tmpDir).multiplyScalar(speed);
    if (!c.locked) {
      p.applyMatrix4(frame);
      v.copy(tmpDir).transformDirection(frame).multiplyScalar(speed);
      if (!Number.isFinite(v.x)) v.set(0, 0, 0);
    }
    const k = i * 3;
    this.pos[k] = p.x;
    this.pos[k + 1] = p.y;
    this.pos[k + 2] = p.z;
    this.vel[k] = v.x;
    this.vel[k + 1] = v.y;
    this.vel[k + 2] = v.z;
    this.age[i] = 0;
    const inner = c.inner && Math.random() < c.inner.share;
    this.layer[i] = inner ? 1 : 0;
    this.life[i] = Math.max(0.05, pick(c.life) * (inner ? c.inner.life : 1));
    this.rot[i] = THREE.MathUtils.degToRad(pick(c.rot));
    this.spin[i] = THREE.MathUtils.degToRad(pick(c.rotSpeed));
    if (this.envelope) {
      for (let j = 0; j < this.nSize; j++) this.randSize[i * this.nSize + j] = Math.random() * 2 - 1;
      for (let j = 0; j < this.nTransp; j++) this.randTransp[i * this.nTransp + j] = Math.random() * 2 - 1;
      for (let j = 0; j < this.nSquash; j++) this.randSquash[i * this.nSquash + j] = Math.random() * 2 - 1;
    }
    if (c.flip) {
      this.frameRate[i] = pick(c.flip.fps);
      this.frameStart[i] = c.flip.startRandom ? Math.floor(Math.random() * c.flip.n) : 0;
    }
  }

  flipFrame(i, t) {
    const f = this.c.flip;
    const n = f.n;
    const age = this.age[i];
    let at;
    if (f.mode === 1) at = Math.min(n - 1, t * n);
    else if (f.mode === 2) {
      const loop = Math.max(1, 2 * n - 2);
      const x = (this.frameStart[i] + age * this.frameRate[i]) % loop;
      at = x < n ? x : loop - x;
    } else if (f.mode === 3) {
      const step = Math.floor(this.frameStart[i] * 7.31 + age * this.frameRate[i]);
      return [Math.floor(((((Math.sin((i + 1) * 12.9898 + step * 78.233) * 43758.5453) % 1) + 1) % 1) * n), 0];
    } else at = (this.frameStart[i] + age * this.frameRate[i]) % n;
    const whole = Math.floor(at);
    return [whole, f.mode === 2 ? 0 : at - whole];
  }

  update(dt) {
    const c = this.c;
    dt *= c.timeScale;
    const frame = this.emitterFrame();
    const on = this.host.visible !== false;
    this.points.visible = on;
    const parent = this.points.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      this.inv.copy(parent.matrixWorld).invert();
    } else this.inv.identity();
    tmpA.fromArray(c.accel.map(Number));
    if (c.locked) {
      this.points.matrix.copy(this.inv).multiply(this.world);
      this.world.decompose(tmpB, tmpQuat, tmpScale);
      tmpQuat.invert();
    } else {
      this.points.matrix.copy(this.inv);
      tmpQuat.identity();
    }
    this.accel.copy(tmpA).applyQuaternion(tmpQuat);
    if (c.inner) this.innerAccel.fromArray(c.inner.accel).applyQuaternion(tmpQuat).add(this.accel);
    this.points.matrixWorldNeedsUpdate = true;
    this.carry += c.rate * dt;
    let due = Math.floor(this.carry);
    this.carry -= due;
    const drag = c.drag ? 0.5 ** (c.drag * dt) : 1;
    const bright = Math.min(8, c.brightness * (1 - c.li) + c.li) * c.boost;
    for (let i = 0; i < this.cap; i++) {
      if (this.age[i] >= this.life[i]) {
        if (due > 0 && on) {
          this.spawn(i, frame);
          due--;
        } else {
          this.iMisc[i * 4 + 1] = 0;
          continue;
        }
      }
      this.age[i] += dt;
      const t = Math.min(1, this.age[i] / this.life[i]);
      const k = i * 3;
      const inner = this.layer[i] === 1;
      const acc = inner ? this.innerAccel : this.accel;
      this.vel[k] = (this.vel[k] + acc.x * dt) * drag;
      this.vel[k + 1] = (this.vel[k + 1] + acc.y * dt) * drag;
      this.vel[k + 2] = (this.vel[k + 2] + acc.z * dt) * drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
      this.iPos[k] = this.pos[k];
      this.iPos[k + 1] = this.pos[k + 1];
      this.iPos[k + 2] = this.pos[k + 2];
      this.iVel[k] = this.vel[k];
      this.iVel[k + 1] = this.vel[k + 1];
      this.iVel[k + 2] = this.vel[k + 2];
      seqFind(c.size, t);
      const s = Math.max(0, this.envelope ? seqJitter(c.size, this.randSize, i * this.nSize) : seqValue(c.size, 1)) * (inner ? c.inner.size : 1);
      let w = s;
      let h = s;
      if (c.squash) {
        seqFind(c.squash, t);
        const q = this.envelope ? seqJitter(c.squash, this.randSquash, i * this.nSquash) : seqValue(c.squash, 1);
        const f = 1 + Math.abs(q);
        if (q > 0) { w = s / f; h = s * f; } else if (q < 0) { w = s * f; h = s / f; }
      }
      this.iSize[i * 2] = w;
      this.iSize[i * 2 + 1] = h;
      seqFind(c.transp, t);
      const tr = this.envelope ? seqJitter(c.transp, this.randTransp, i * this.nTransp) : seqValue(c.transp, 1);
      const col = inner ? c.inner.color : c.color;
      seqFind(col, t);
      const m = i * 4;
      this.iCol[m] = seqValue(col, 1) * bright;
      this.iCol[m + 1] = seqValue(col, 2) * bright;
      this.iCol[m + 2] = seqValue(col, 3) * bright;
      this.iCol[m + 3] = inner ? c.inner.le : c.le;
      this.iMisc[m] = this.rot[i];
      this.iMisc[m + 1] = t >= 1 ? 0 : Math.max(0, Math.min(1, 1 - tr));
      if (c.flip) {
        const [fr, blend] = this.flipFrame(i, t);
        this.iMisc[m + 2] = fr;
        this.iMisc[m + 3] = blend;
      }
    }
    const geo = this.points.geometry;
    for (const a of INSTANCE_ATTRS) geo.attributes[a].needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    if (this.ownTexture) this.ownTexture.dispose();
  }
}

function material(color, map) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  if (map) {
    m.map = map;
    m.alphaTest = 0.5;
  }
  return m;
}

function bitmapTexture(bitmap) {
  const t = new THREE.Texture(bitmap);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const MESH = {
  shirt: '2957742631', pants: '2957742558', tshirt: '2957742706',
  torso15: '2957742957', leftArm15: '2957742791', rightArm15: '2957742881',
  Torso: '2957740857', 'Left Arm': '2957740508', 'Left Leg': '2957740624', 'Right Arm': '2957740703', 'Right Leg': '2957740776',
  head: '2957715294', face: '2957705858',
};

let compositor = null;

function composite(w, h, layers) {
  if (!compositor) {
    compositor = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true, antialias: true });
    compositor.setPixelRatio(1);
  }
  compositor.setSize(w, h, false);
  compositor.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, w, h, 0, -1000, 1000);
  const used = [];
  layers.forEach((l, i) => {
    if (!l || !l.geometry || !l.bitmap) return;
    const m = new THREE.MeshBasicMaterial({ map: bitmapTexture(l.bitmap), transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(l.geometry, m);
    mesh.renderOrder = i;
    scene.add(mesh);
    used.push(m);
  });
  compositor.render(scene, cam);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(compositor.domElement, 0, 0, w, h);
  for (const m of used) { m.map.dispose(); m.dispose(); }
  return c;
}

function paint(color, layers, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#' + color.getHexString();
  g.fillRect(0, 0, w, h);
  for (const l of layers) if (l) g.drawImage(l, 0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

async function linkedImage(assetId, propNames, upright) {
  try {
    const { model } = await loadModel(assetId);
    for (const n of model.roots.flatMap(descendants)) {
      for (const name of propNames) {
        const id = assetIdOf((prop(n, name) || {}).value);
        if (id) return await loadTexture(id, upright);
      }
    }
  } catch {}
  return null;
}

async function clothing(kind, assets, failed) {
  const shirt = assets.find(a => a.type === 11);
  const pants = assets.find(a => a.type === 12);
  const tshirt = assets.find(a => a.type === 2);
  const [shirtImg, pantsImg, tshirtImg, tshirtUp] = await Promise.all([
    shirt ? linkedImage(shirt.id, ['ShirtTemplate']) : null,
    pants ? linkedImage(pants.id, ['PantsTemplate']) : null,
    tshirt ? linkedImage(tshirt.id, ['Graphic']) : null,
    tshirt && kind === 'R15' ? linkedImage(tshirt.id, ['Graphic'], true) : null,
  ]);
  if (shirt && !shirtImg) failed.push(shirt.id + ': shirt');
  if (pants && !pantsImg) failed.push(pants.id + ': pants');
  if (!shirtImg && !pantsImg && !tshirtImg) return null;
  const meshes = {};
  await Promise.all(Object.entries(MESH).filter(([k]) => /shirt|pants|tshirt|15$/.test(k)).map(async ([k, id]) => { meshes[k] = await loadMesh(id).catch(() => null); }));
  if (kind === 'R6') {
    return { r6: composite(1024, 512, [{ geometry: meshes.pants, bitmap: pantsImg }, { geometry: meshes.shirt, bitmap: shirtImg }, { geometry: meshes.tshirt, bitmap: tshirtImg }]) };
  }
  const torso = composite(388, 272, [{ geometry: meshes.torso15, bitmap: pantsImg }, { geometry: meshes.torso15, bitmap: shirtImg }]);
  if (tshirtUp) torso.getContext('2d').drawImage(tshirtUp, 2, 74, 128, 128);
  return {
    torso,
    leftArm: composite(264, 284, [{ geometry: meshes.leftArm15, bitmap: shirtImg }]),
    rightArm: composite(264, 284, [{ geometry: meshes.rightArm15, bitmap: shirtImg }]),
    leftLeg: composite(264, 284, [{ geometry: meshes.leftArm15, bitmap: pantsImg }]),
    rightLeg: composite(264, 284, [{ geometry: meshes.rightArm15, bitmap: pantsImg }]),
  };
}

function r15Slot(name) {
  if (/Torso/.test(name)) return 'torso';
  if (/^Left(Upper|Lower)Arm$|^LeftHand$/.test(name)) return 'leftArm';
  if (/^Right(Upper|Lower)Arm$|^RightHand$/.test(name)) return 'rightArm';
  if (/^Left(Upper|Lower)Leg$|^LeftFoot$/.test(name)) return 'leftLeg';
  if (/^Right(Upper|Lower)Leg$|^RightFoot$/.test(name)) return 'rightLeg';
  return null;
}

async function pool(tasks, size) {
  let i = 0;
  const worker = async () => { while (i < tasks.length) await tasks[i++](); };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
}

export class AvatarScene {
  constructor(canvas, opts = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-0.47, 0.82, -0.31).multiplyScalar(16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 8, bottom: -4, near: 1, far: 40 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.scene.add(sun.target);
    const back = new THREE.DirectionalLight(0xffffff, 0.6);
    back.position.set(0.47, 0.4, 0.31).multiplyScalar(16);
    this.scene.add(back);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.yaw = -0.45;
    this.pitch = 0.1;
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sg = shadowCanvas.getContext('2d');
    const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.distance = 14;
    this.target = new THREE.Vector3(0, 0, 0);
    this.running = true;
    this.onFrame = null;
    this.clock = new THREE.Timer();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.dYaw = 0;
    this.dPitch = 0;
    this.zoomTo = null;
    if (opts.controls !== false) this.bindControls(canvas);
  }

  bindControls(canvas) {
    let last = null;
    this.dYaw = 0;
    this.dPitch = 0;
    this.zoomTo = null;
    canvas.addEventListener('pointerdown', (e) => {
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!last) return;
      const k = (2 * Math.PI) / (canvas.clientHeight || 420);
      this.dYaw += (e.clientX - last.x) * k;
      this.dPitch += (e.clientY - last.y) * k;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => { last = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const base = this.zoomTo ?? this.distance;
      this.zoomTo = Math.max(3, Math.min(30, base * Math.pow(0.95, -e.deltaY / 40)));
    }, { passive: false });
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    this.clock.update();
    const dt = Math.min(0.1, this.clock.getDelta());
    if (this.onFrame) this.onFrame(dt);
    if (this.effects) for (const fx of this.effects) fx.update(dt);
    const damp = 1 - Math.pow(0.9, dt * 60);
    this.yaw += this.dYaw * damp;
    this.pitch = Math.max(-0.45, Math.min(1.45, this.pitch + this.dPitch * damp));
    this.dYaw *= 1 - damp;
    this.dPitch *= 1 - damp;
    if (this.zoomTo != null) {
      this.distance += (this.zoomTo - this.distance) * Math.min(1, damp * 1.6);
      if (Math.abs(this.zoomTo - this.distance) < 0.01) this.zoomTo = null;
    }
    const d = this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }

  frameBox(box) {
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(this.target);
    this.shadow.position.set(this.target.x, box.min.y + 0.01, this.target.z);
    this.ground.position.set(this.target.x, box.min.y, this.target.z);
    this.sun.target.position.copy(this.target);
    const fit = Math.max(size.y, size.x * 0.9) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.distance = Math.max(4, fit * 1.7);
  }

  clear() {
    for (const fx of this.effects || []) if (fx.ownTexture) fx.ownTexture.dispose();
    this.effects = null;
    this.root.traverse(o => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
      if (o.material) {
        if (o.material.map && !o.material.map.userData?.shared) o.material.map.dispose();
        o.material.dispose();
      }
    });
    this.root.clear();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clear();
    this.renderer.dispose();
  }
}

export class Rig {
  constructor(model, kind) {
    this.kind = kind;
    this.model = model;
    this.parts = new Map();
    this.attachments = new Map();
    this.joints = [];
    for (const n of model.roots.flatMap(descendants)) {
      if (n.className === 'Part' || n.className === 'MeshPart') this.parts.set(n.name, n);
    }
    for (const part of this.parts.values()) {
      for (const c of part.children) if (c.className === 'Attachment') this.attachments.set(c.name, { part, inst: c });
    }
    for (const n of model.roots.flatMap(descendants)) {
      if (n.className !== 'Motor6D') continue;
      const p0 = prop(n, 'Part0');
      const p1 = prop(n, 'Part1');
      const part0 = p0 && model.byRef.get(p0.value);
      const part1 = p1 && model.byRef.get(p1.value);
      if (!part0 || !part1) continue;
      this.joints.push({ name: n.name, part0, part1, c0: cf(prop(n, 'C0')), c1: cf(prop(n, 'C1')), transform: new THREE.Matrix4() });
    }
    this.root = this.parts.get('HumanoidRootPart');
    this.baseParts = new Map(this.parts);
    this.world = new Map();
    this.solve();
  }

  replacePart(name, inst) {
    const old = this.parts.get(name);
    if (!old) return;
    this.parts.set(name, inst);
    for (const c of inst.children) if (c.className === 'Attachment') this.attachments.set(c.name, { part: inst, inst: c });
    for (const j of this.joints) {
      if (j.part0 === old) j.part0 = inst;
      if (j.part1 === old) j.part1 = inst;
    }
    if (this.kind === 'R15') this.rebuildJoints();
  }

  rebuildJoints() {
    const rigAtt = (part, name) => part.children.find(c => c.className === 'Attachment' && c.name === name);
    for (const j of this.joints) {
      const a0 = rigAtt(j.part0, j.name + 'RigAttachment');
      const a1 = rigAtt(j.part1, j.name + 'RigAttachment');
      if (a0 && a1) {
        j.c0 = cf(prop(a0, 'CFrame'));
        j.c1 = cf(prop(a1, 'CFrame'));
      }
    }
  }

  scaleOf(part) {
    return (this.scales && this.scales.get(part)) || null;
  }

  scaled(m, part) {
    const s = this.scaleOf(part);
    const out = m.clone();
    if (!s) return out;
    out.elements[12] *= s.x;
    out.elements[13] *= s.y;
    out.elements[14] *= s.z;
    return out;
  }

  applyScales(fn) {
    this.scales = new Map();
    for (const part of this.parts.values()) {
      const s = fn(part);
      if (s) this.scales.set(part, s);
    }
  }

  solve() {
    this.world.clear();
    const rootCF = new THREE.Matrix4();
    if (this.root) this.world.set(this.root, rootCF);
    let changed = true;
    while (changed) {
      changed = false;
      for (const j of this.joints) {
        if (!this.world.has(j.part0) || this.world.has(j.part1)) continue;
        const m = this.world.get(j.part0).clone().multiply(this.scaled(j.c0, j.part0)).multiply(j.transform).multiply(this.scaled(j.c1, j.part1).invert());
        this.world.set(j.part1, m);
        changed = true;
      }
    }
  }

  attachmentWorld(name) {
    const a = this.attachments.get(name);
    if (!a || !this.world.has(a.part)) return null;
    return this.world.get(a.part).clone().multiply(this.scaled(cf(prop(a.inst, 'CFrame')), a.part));
  }
}

export async function loadRig(kind) {
  const { model } = await loadModel(kind === 'R15' ? R15_RIG : R6_RIG);
  return new Rig(model, kind);
}

function scaleFor(inst, geometry) {
  const size = vec(inst, 'Size', 'size') || new THREE.Vector3(1, 1, 1);
  const initial = vec(inst, 'InitialSize');
  if (initial && initial.x && initial.y && initial.z) return size.clone().divide(initial);
  if (geometry && geometry.boundingBox) {
    const b = geometry.boundingBox.getSize(new THREE.Vector3());
    return new THREE.Vector3(b.x ? size.x / b.x : 1, b.y ? size.y / b.y : 1, b.z ? size.z / b.z : 1);
  }
  return new THREE.Vector3(1, 1, 1);
}

async function partMesh(inst, color) {
  const meshId = assetIdOf((prop(inst, 'MeshId') || prop(inst, 'MeshContent') || {}).value);
  const texId = assetIdOf((prop(inst, 'TextureID') || prop(inst, 'TextureContent') || {}).value);
  const special = inst.className === 'MeshPart' && meshId ? null : inst.children.find(c => c.className === 'SpecialMesh');
  const sid = special && assetIdOf((prop(special, 'MeshId') || {}).value);
  const surface = inst.children.find(c => c.className === 'SurfaceAppearance');
  const surfaceMap = surface && assetIdOf((prop(surface, 'ColorMap') || prop(surface, 'ColorMapContent') || {}).value);
  const tex = texId || surfaceMap || (special ? assetIdOf((prop(special, 'TextureId') || {}).value) : null);
  const [geometry, bitmap] = await Promise.all([
    inst.className === 'MeshPart' && meshId ? loadMesh(meshId) : sid ? loadMesh(sid) : null,
    tex ? loadTexture(tex, inst.className === 'MeshPart').catch(() => null) : null,
  ]);
  const base = color || partColor(inst);
  const side = bitmap ? Math.min(1024, Math.max(bitmap.width || 0, bitmap.height || 0)) || 512 : 0;
  const map = bitmap ? (inst.className === 'MeshPart' ? paint(base, [bitmap], side, side) : bitmapTexture(bitmap)) : null;
  if (!geometry) return null;
  const tint = special && map ? vec(special, 'VertexColor') : null;
  const mesh = new THREE.Mesh(geometry, material(map ? (tint ? new THREE.Color(tint.x, tint.y, tint.z) : new THREE.Color(1, 1, 1)) : base, map));
  mesh.geometry.userData.shared = true;
  const see = Number((prop(inst, 'Transparency') || {}).value) || 0;
  if (see >= 0.99) mesh.visible = false;
  if (see > 0) {
    mesh.material.transparent = true;
    mesh.material.opacity = Math.max(0.08, 1 - see);
    mesh.material.alphaTest = 0.01;
    mesh.material.depthWrite = false;
    mesh.material.side = THREE.DoubleSide;
    mesh.userData.translucent = true;
  }
  const enabled = (c) => (prop(c, 'Enabled') || { value: true }).value !== false;
  const fx = [];
  const own = cf(prop(inst, 'CFrame'));
  for (const c of inst.children) {
    if (EFFECT_CLASS.test(c.className) && enabled(c)) fx.push({ inst: c, local: null });
    if (/^(Part|MeshPart|UnionOperation)$/.test(c.className)) {
      const list = c.children.filter(e => EFFECT_CLASS.test(e.className) && enabled(e));
      if (list.length) {
        const rel = own.clone().invert().multiply(cf(prop(c, 'CFrame')));
        for (const e of list) fx.push({ inst: e, local: rel, size: vec(c, 'Size', 'size') });
      }
    }
    if (c.className === 'Attachment') {
      for (const e of c.children) {
        if (!EFFECT_CLASS.test(e.className) || !enabled(e)) continue;
        e.parent = c;
        fx.push({ inst: e, local: cf(prop(c, 'CFrame')) });
      }
    }
  }
  if (fx.length) mesh.userData.fx = fx;
  mesh.userData.inst = inst;
  const local = new THREE.Matrix4();
  if (special) {
    const scale = vec(special, 'Scale') || new THREE.Vector3(1, 1, 1);
    const offset = vec(special, 'Offset') || new THREE.Vector3();
    local.compose(offset, new THREE.Quaternion(), scale);
  } else {
    local.compose(new THREE.Vector3(), new THREE.Quaternion(), scaleFor(inst, geometry));
  }
  mesh.userData.local = local;
  return mesh;
}

const uvKey = (u, v) => Math.round(u * 1e4) * 100003 + Math.round(v * 1e4);

function partScale(inst, rig) {
  const size = vec(inst, 'Size', 'size');
  const initial = vec(inst, 'InitialSize');
  const s = size && initial && initial.x && initial.y && initial.z ? size.clone().divide(initial) : new THREE.Vector3(1, 1, 1);
  const extra = rig.scaleOf(inst);
  return extra ? s.multiply(extra) : s;
}

async function bodyCage(rig) {
  if (!rig.cage) {
    rig.cage = (async () => {
      rig.solve();
      const out = new Map();
      await Promise.all([...rig.parts].map(async ([name, inst]) => {
        const world = rig.world.get(inst);
        if (!world || name === 'HumanoidRootPart') return;
        let target = inst.children.find(c => c.className === 'WrapTarget');
        let stretch = null;
        if (!target) {
          const base = rig.baseParts && rig.baseParts.get(name);
          target = base && base.children.find(c => c.className === 'WrapTarget');
          const was = base && vec(base, 'Size', 'size');
          const now = vec(inst, 'Size', 'size');
          if (was && now && was.x && was.y && was.z) stretch = now.clone().divide(was);
        }
        const cageId = target && assetIdOf((prop(target, 'CageMeshId') || {}).value);
        if (!cageId) return;
        const geo = await loadMesh(cageId).catch(() => null);
        const uv = geo && geo.getAttribute('uv');
        if (!uv) return;
        const sc = stretch || partScale(inst, rig);
        const m = world.clone().multiply(new THREE.Matrix4().makeScale(sc.x, sc.y, sc.z)).multiply(cf(prop(target, 'CageOrigin')));
        const pos = geo.getAttribute('position');
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          const key = uvKey(uv.getX(i), uv.getY(i));
          if (!out.has(key)) out.set(key, { p: v.fromBufferAttribute(pos, i).applyMatrix4(m).clone(), part: inst });
        }
      }));
      return out;
    })();
  }
  return rig.cage;
}

function nearestFinder(points, cell) {
  const grid = new Map();
  const key = (x, y, z) => (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512);
  points.forEach((p, i) => {
    const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  return (q, count) => {
    const cx = Math.floor(q.x / cell);
    const cy = Math.floor(q.y / cell);
    const cz = Math.floor(q.z / cell);
    const found = [];
    for (let ring = 0, stop = -1; ring < 64; ring++) {
      for (let x = cx - ring; x <= cx + ring; x++) {
        for (let y = cy - ring; y <= cy + ring; y++) {
          for (let z = cz - ring; z <= cz + ring; z++) {
            if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== ring) continue;
            const list = grid.get(key(x, y, z));
            if (list) for (const i of list) found.push(i);
          }
        }
      }
      if (found.length >= count && stop < 0) stop = ring + 1;
      if (stop >= 0 && ring >= stop) break;
    }
    return found.map(i => [i, points[i].distanceToSquared(q)]).sort((a, b) => a[1] - b[1]).slice(0, count);
  };
}

async function wrapLayered(handle, rig, assetId, layer) {
  const wrap = handle.children.find(c => c.className === 'WrapLayer');
  const refId = wrap && assetIdOf((prop(wrap, 'ReferenceMeshId') || {}).value);
  if (!refId) return null;
  const [mesh, ref, cage] = await Promise.all([partMesh(handle), loadMesh(refId).catch(() => null), bodyCage(rig)]);
  if (!mesh || !ref || !cage.size) return null;
  const uv = ref.getAttribute('uv');
  if (!uv) return null;
  const refPos = ref.getAttribute('position');
  const origin = cf(prop(wrap, 'ReferenceOrigin'));
  const from = [];
  const to = [];
  const owner = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < refPos.count; i++) {
    const hit = cage.get(uvKey(uv.getX(i), uv.getY(i)));
    if (!hit) continue;
    from.push(v.fromBufferAttribute(refPos, i).applyMatrix4(origin).clone());
    to.push(hit.p);
    owner.push(hit.part);
  }
  if (from.length < 50) return null;
  const geo = mesh.geometry.clone();
  geo.userData = {};
  geo.applyMatrix4(mesh.userData.local);
  mesh.geometry = geo;
  mesh.userData.local = new THREE.Matrix4();
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const parts = [...new Set(owner)];
  const partIndex = new Map(parts.map((p, i) => [p, i]));
  const nearest = nearestFinder(from, 0.25);
  const count = pos.count;
  const rest = new Float32Array(count * 3);
  const restN = nrm ? new Float32Array(count * 3) : null;
  const bones = new Uint8Array(count * 4);
  const weights = new Float32Array(count * 4);
  const p = new THREE.Vector3();
  const shift = new THREE.Vector3();
  const push = 0.004 * layer;
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i);
    let total = 0;
    shift.set(0, 0, 0);
    const pull = new Map();
    for (const [j, d] of nearest(p, 8)) {
      const w = 1 / (d + 1e-4);
      total += w;
      shift.x += (to[j].x - from[j].x) * w;
      shift.y += (to[j].y - from[j].y) * w;
      shift.z += (to[j].z - from[j].z) * w;
      const b = partIndex.get(owner[j]);
      pull.set(b, (pull.get(b) || 0) + w);
    }
    if (total) shift.multiplyScalar(1 / total);
    p.add(shift);
    if (nrm && push) {
      p.x += nrm.getX(i) * push;
      p.y += nrm.getY(i) * push;
      p.z += nrm.getZ(i) * push;
    }
    rest[i * 3] = p.x;
    rest[i * 3 + 1] = p.y;
    rest[i * 3 + 2] = p.z;
    if (restN) {
      restN[i * 3] = nrm.getX(i);
      restN[i * 3 + 1] = nrm.getY(i);
      restN[i * 3 + 2] = nrm.getZ(i);
    }
    const top = [...pull].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((acc, x) => acc + x[1], 0) || 1;
    top.forEach(([b, w], k) => {
      bones[i * 4 + k] = b;
      weights[i * 4 + k] = w / sum;
    });
  }
  pos.array.set(rest);
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.accessory = { layered: true, assetId, parts, restInv: parts.map(x => rig.world.get(x).clone().invert()), rest, restN, bones, weights };
  return mesh;
}

const IDENTITY = new THREE.Matrix4();

function skinLayered(mesh, rig) {
  const a = mesh.userData.accessory;
  const moves = a.parts.map((part, i) => {
    const w = rig.world.get(part);
    return w ? w.clone().multiply(a.restInv[i]) : new THREE.Matrix4();
  });
  const moved = moves.some(m => !m.equals(IDENTITY));
  if (!moved && !a.skinned) return;
  a.skinned = moved;
  const posAttr = mesh.geometry.getAttribute('position');
  const nrmAttr = mesh.geometry.getAttribute('normal');
  const out = posAttr.array;
  const outN = nrmAttr && a.restN ? nrmAttr.array : null;
  const { rest, restN, bones, weights } = a;
  const mats = moves.map(m => m.elements);
  for (let i = 0, n = posAttr.count; i < n; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[i * 4 + k];
      if (!w) continue;
      const e = mats[bones[i * 4 + k]];
      px += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      py += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      pz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      if (outN) {
        const ax = restN[i * 3], ay = restN[i * 3 + 1], az = restN[i * 3 + 2];
        nx += w * (e[0] * ax + e[4] * ay + e[8] * az);
        ny += w * (e[1] * ax + e[5] * ay + e[9] * az);
        nz += w * (e[2] * ax + e[6] * ay + e[10] * az);
      }
    }
    out[i * 3] = px;
    out[i * 3 + 1] = py;
    out[i * 3 + 2] = pz;
    if (outN) {
      const len = Math.hypot(nx, ny, nz) || 1;
      outN[i * 3] = nx / len;
      outN[i * 3 + 1] = ny / len;
      outN[i * 3 + 2] = nz / len;
    }
  }
  posAttr.needsUpdate = true;
  if (outN) nrmAttr.needsUpdate = true;
}

const LAYER_ORDER = { 64: 1, 65: 2, 66: 1, 69: 1, 72: 2, 68: 3, 67: 4, 70: 5, 71: 5 };

export async function buildAvatar(scene, opts) {
  const assets = opts.assets || [];
  const head = assets.find(a => HEADS.has(a.type));
  const faceAsset = assets.find(a => a.type === 18);
  const failed = [];
  const settle = (promise) => promise.then(v => v, () => null);
  const rigP = loadRig(opts.kind);
  const clothesP = clothing(opts.kind, assets, failed);
  const faceP = (faceAsset ? linkedImage(faceAsset.id, ['Texture'], true) : Promise.resolve(null)).then(img => img || loadTexture(MESH.face, true).catch(() => null));
  const headP = head ? settle(loadModel(head.id, 'avatar_meshpart_head')) : Promise.resolve(null);
  const bodyP = opts.kind === 'R15' ? Promise.all(assets.filter(x => BODY.has(x.type)).map(a => settle(loadModel(a.id)))) : Promise.resolve([]);
  const accP = assets.filter(x => ACCESSORY.has(x.type) || (LAYERED.has(x.type) && opts.kind === 'R15')).map(a => ({ a, model: loadModel(a.id, 'avatar_meshpart_accessory') }));
  const toolP = assets.filter(x => x.type === 19).map(a => ({ a, model: loadModel(a.id) }));
  for (const x of [...accP, ...toolP]) x.model.catch(() => {});
  for (const id of Object.values(MESH)) if (/^29577407|^2957715294$/.test(id) && opts.kind === 'R6') loadMesh(id).catch(() => {});

  const rig = await rigP;
  const group = new THREE.Group();
  const placed = [];
  const colors = opts.colors || {};
  const colorOf = (name) => {
    if (/Head/.test(name)) return hexColor(colors.headColor3);
    if (/Torso/.test(name)) return hexColor(colors.torsoColor3);
    if (/Left ?(Upper|Lower)?Arm|LeftHand/.test(name)) return hexColor(colors.leftArmColor3);
    if (/Right ?(Upper|Lower)?Arm|RightHand/.test(name)) return hexColor(colors.rightArmColor3);
    if (/Left ?(Upper|Lower)?Leg|LeftFoot/.test(name)) return hexColor(colors.leftLegColor3);
    if (/Right ?(Upper|Lower)?Leg|RightFoot/.test(name)) return hexColor(colors.rightLegColor3);
    return new THREE.Color(0.64, 0.64, 0.65);
  };
  const headModel = await headP;
  if (head && !headModel) failed.push(head.id + ': head');
  const headPart = headModel && headModel.model.roots.flatMap(descendants).find(n => n.className === 'MeshPart');
  if (headPart && opts.kind === 'R15') rig.replacePart('Head', headPart);
  for (const b of await bodyP) {
    if (!b) continue;
    const all = b.model.roots.flatMap(descendants);
    const folder = all.find(n => n.name === 'R15ArtistIntent') || all.find(n => n.name === 'R15Fixed');
    for (const p of folder ? folder.children : []) if (p.className === 'MeshPart') rig.replacePart(p.name, p);
  }
  if (opts.kind === 'R15') {
    const sc = opts.scales || {};
    const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
    const head = n(sc.head, 1);
    const body = new THREE.Vector3(n(sc.width, 1), n(sc.height, 1), n(sc.depth, 1));
    rig.applyScales((part) => (part.name === 'Head' ? new THREE.Vector3(head, head, head) : body.clone()));
  }
  rig.solve();
  const dynamicHead = opts.kind === 'R6' ? headPart : null;

  const partTasks = [...rig.parts].filter(([name, inst]) => name !== 'HumanoidRootPart' && rig.world.get(inst)).map(async ([name, inst]) => {
    const color = colorOf(name);
    let mesh = null;
    if (name === 'Head' && dynamicHead) {
      mesh = await partMesh(dynamicHead, color).catch(() => null);
    } else if (name === 'Head' && !(headPart && opts.kind === 'R15')) {
      const special = inst.children.find(c => c.className === 'SpecialMesh');
      const meshId = inst.className === 'MeshPart' && assetIdOf((prop(inst, 'MeshId') || {}).value);
      const [geometry, faceImg] = await Promise.all([loadMesh(opts.kind === 'R15' ? MESH.head : meshId || MESH.head).catch(() => null), faceP]);
      if (geometry) {
        mesh = new THREE.Mesh(geometry, material(new THREE.Color(1, 1, 1), paint(color, [faceImg], 256, 256)));
        const local = new THREE.Matrix4();
        if (special) local.compose(new THREE.Vector3(), new THREE.Quaternion(), (vec(special, 'Scale') || new THREE.Vector3(1.25, 1.25, 1.25)).divideScalar(1.25));
        else local.compose(new THREE.Vector3(), new THREE.Quaternion(), scaleFor(inst, geometry));
        mesh.userData.local = local;
      }
    } else if (opts.kind === 'R6') {
      const [geometry, clothes] = await Promise.all([MESH[name] ? loadMesh(MESH[name]).catch(() => null) : null, clothesP]);
      const size = vec(inst, 'size', 'Size') || new THREE.Vector3(1, 1, 1);
      const map = clothes && clothes.r6 ? paint(color, [clothes.r6], 1024, 512) : null;
      mesh = new THREE.Mesh(geometry || new THREE.BoxGeometry(size.x, size.y, size.z), material(map ? new THREE.Color(1, 1, 1) : color, map));
      const local = new THREE.Matrix4();
      if (geometry) local.compose(new THREE.Vector3(), new THREE.Quaternion(), scaleFor(inst, geometry));
      mesh.userData.local = local;
    } else {
      const [m, clothes] = await Promise.all([partMesh(inst, color).catch(() => null), clothesP]);
      mesh = m;
      const slot = r15Slot(name);
      const hasTexture = assetIdOf((prop(inst, 'TextureID') || {}).value);
      if (mesh && clothes && slot && clothes[slot]) {
        const own = hasTexture ? await loadTexture(hasTexture, inst.className === 'MeshPart').catch(() => null) : null;
        mesh.material.dispose();
        const c = clothes[slot];
        mesh.material = material(new THREE.Color(1, 1, 1), paint(color, [own, c], c.width, c.height));
      }
    }
    if (!mesh) return;
    const ps = rig.scaleOf(inst);
    if (ps) mesh.userData.local.premultiply(new THREE.Matrix4().makeScale(ps.x, ps.y, ps.z));
    mesh.castShadow = true;
    mesh.userData.part = inst;
    placed.push(mesh);
    group.add(mesh);
  });

  const accessories = [];
  const layers = assets.filter(x => LAYERED.has(x.type)).sort((x, y) => (LAYER_ORDER[x.type] || 0) - (LAYER_ORDER[y.type] || 0));
  const accTasks = accP.map(async ({ a, model }) => {
    try {
      const { model: m } = await model;
      const acc = m.roots.find(n => /Accessory|Hat/.test(n.className)) || m.roots[0];
      const handle = acc && acc.children.find(c => c.name === 'Handle');
      if (!handle) return;
      if (LAYERED.has(a.type) && opts.kind === 'R15') {
        const fitted = await wrapLayered(handle, rig, a.id, layers.indexOf(a)).catch(() => null);
        if (fitted) {
          fitted.castShadow = true;
          accessories.push(fitted);
          group.add(fitted);
          return;
        }
      }
      const att = handle.children.find(c => c.className === 'Attachment' && rig.attachments.has(c.name));
      if (!att) return;
      const mesh = await partMesh(handle);
      if (!mesh) return;
      const host = rig.attachments.get(att.name);
      const as = host && rig.scaleOf(host.part);
      const attCF = cf(prop(att, 'CFrame'));
      if (as) {
        attCF.elements[12] *= as.x;
        attCF.elements[13] *= as.y;
        attCF.elements[14] *= as.z;
        mesh.userData.local.premultiply(new THREE.Matrix4().makeScale(as.x, as.y, as.z));
      }
      mesh.userData.accessory = { attachment: att.name, offset: attCF.invert(), assetId: a.id, adjust: adjustMatrix(a.meta) };
      mesh.castShadow = true;
      accessories.push(mesh);
      group.add(mesh);
    } catch (e) {
      failed.push(a.id + ': ' + (e && e.message));
    }
  });
  const toolTasks = toolP.map(async ({ a, model }) => {
    try {
      const { model: m } = await model;
      const tool = m.roots.find(n => n.className === 'Tool') || m.roots[0];
      const handle = tool && tool.children.find(c => c.name === 'Handle');
      if (!handle) return;
      const mesh = await partMesh(handle);
      if (!mesh) return;
      const legacyGrip = opts.kind === 'R6' ? new THREE.Matrix4().makeRotationX(-Math.PI / 2) : new THREE.Matrix4();
      mesh.userData.accessory = { attachment: 'RightGripAttachment', offset: legacyGrip.multiply(cf(prop(tool, 'Grip')).invert()), assetId: a.id };
      mesh.castShadow = true;
      accessories.push(mesh);
      group.add(mesh);
    } catch (e) {
      failed.push(a.id + ': ' + (e && e.message));
    }
  });
  await Promise.all([...partTasks, ...accTasks, ...toolTasks]);

  const effects = [];
  for (const m of [...placed, ...accessories]) {
    for (const f of m.userData.fx || []) {
      try {
        const fx = new ParticleEffect(f.inst, m, f.local, f.size);
        effects.push(fx);
        group.add(fx.points);
      } catch {}
    }
  }
  const avatar = { rig, group, parts: placed, accessories, failed, effects, holding: accessories.some(m => m.userData.accessory.attachment === 'RightGripAttachment') };
  pose(avatar);
  if (opts.clearFirst) opts.clearFirst();
  scene.root.add(group);
  scene.effects = effects;
  scene.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of placed) box.expandByObject(m);
  const limit = box.clone().expandByScalar(1.5);
  for (const m of accessories) {
    const b = new THREE.Box3().setFromObject(m);
    if (!b.isEmpty()) box.union(b.intersect(limit));
  }
  scene.frameBox(box);
  return avatar;
}

export async function warm(kind, assets) {
  const tasks = [loadRig(kind)];
  for (const a of assets) {
    if (ACCESSORY.has(a.type) || LAYERED.has(a.type)) tasks.push(fetchAsset(a.id, 'avatar_meshpart_accessory'));
    else if (HEADS.has(a.type)) tasks.push(fetchAsset(a.id, 'avatar_meshpart_head'));
    else if ([2, 11, 12, 18, 19, 27, 28, 29, 30, 31].includes(a.type)) tasks.push(fetchAsset(a.id));
  }
  await Promise.all(tasks.map(x => x.catch(() => null)));
}

export function pose(avatar) {
  const { rig } = avatar;
  rig.solve();
  for (const mesh of avatar.parts) {
    const w = rig.world.get(mesh.userData.part);
    if (!w) continue;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(w).multiply(mesh.userData.local);
  }
  for (const mesh of avatar.accessories) {
    const a = mesh.userData.accessory;
    if (a.layered) {
      skinLayered(mesh, rig);
      continue;
    }
    const at = rig.attachmentWorld(a.attachment);
    if (!at) continue;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(at);
    if (a.adjust) mesh.matrix.multiply(a.adjust);
    mesh.matrix.multiply(a.offset).multiply(mesh.userData.local);
  }
}

export function adjustMatrix(meta) {
  const p = meta && meta.position;
  const r = meta && meta.rotation;
  const s = meta && meta.scale;
  if (!p && !r && !s) return null;
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const rad = THREE.MathUtils.degToRad;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(n(p && p.X, 0), n(p && p.Y, 0), n(p && p.Z, 0)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(n(r && r.X, 0)), rad(n(r && r.Y, 0)), rad(n(r && r.Z, 0)), 'XYZ')),
    new THREE.Vector3(n(s && s.X, 1), n(s && s.Y, 1), n(s && s.Z, 1)),
  );
}

export function setAdjust(avatar, assetId, meta) {
  for (const mesh of avatar.accessories) if (String(mesh.userData.accessory.assetId) === String(assetId)) mesh.userData.accessory.adjust = adjustMatrix(meta);
  pose(avatar);
}

export const ANIMS = {
  R6: { Idle: '180435571', Walk: '180426354', Run: '180426354', Jump: '125750702', Fall: '180436148', Climb: '180436334', Tool: '182393478' },
  R15: { Idle: '507766388', Walk: '913402848', Run: '913376220', Jump: '507765000', Fall: '507767968', Climb: '507765644', Tool: '507768375' },
};
const TOOL_PARTS = new Set(['Right Arm', 'RightUpperArm', 'RightLowerArm', 'RightHand']);

function ease(style, dir, a) {
  if (style === 1) return 0;
  const curve = (x) => {
    if (style === 3 || style === 5) return x * x * x;
    if (style === 2) return x === 0 || x === 1 ? x : -Math.pow(2, 10 * (x - 1)) * Math.sin((x - 1.075) * (2 * Math.PI) / 0.3);
    if (style === 4) {
      const o = 1 - x;
      let b;
      if (o < 1 / 2.75) b = 7.5625 * o * o;
      else if (o < 2 / 2.75) b = 7.5625 * (o - 1.5 / 2.75) * (o - 1.5 / 2.75) + 0.75;
      else if (o < 2.5 / 2.75) b = 7.5625 * (o - 2.25 / 2.75) * (o - 2.25 / 2.75) + 0.9375;
      else b = 7.5625 * (o - 2.625 / 2.75) * (o - 2.625 / 2.75) + 0.984375;
      return 1 - b;
    }
    return x;
  };
  if (style === 0 || style == null) return a;
  if (dir === 1) return 1 - curve(1 - a);
  if (dir === 2) return a < 0.5 ? curve(a * 2) / 2 : 1 - curve((1 - a) * 2) / 2;
  return curve(a);
}

const ROTATION_ORDER = ['XYZ', 'XZY', 'YZX', 'YXZ', 'ZXY', 'ZYX'];

function curveKeys(inst) {
  const v = inst && prop(inst, 'ValuesAndTimes');
  const b = v && v.bytes;
  if (!b || b.length < 16) return [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = dv.getUint32(4, true);
  const timesAt = 8 + n * 14;
  if (timesAt + 8 > b.length) return [];
  const m = dv.getUint32(timesAt + 4, true);
  if (timesAt + 8 + m * 4 !== b.length) return [];
  const keys = [];
  for (let i = 0; i < Math.min(n, m); i++) keys.push({ mode: dv.getUint8(8 + i * 14), value: dv.getFloat32(8 + i * 14 + 2, true), time: dv.getInt32(timesAt + 8 + i * 4, true) / 2400 });
  return keys;
}

function curveAt(keys, t) {
  if (!keys.length) return 0;
  if (t <= keys[0].time) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= b.time) continue;
    if (a.mode === 0 || b.time <= a.time) return a.value;
    return a.value + (b.value - a.value) * ((t - a.time) / (b.time - a.time));
  }
  return keys[keys.length - 1].value;
}

function parseCurves(anim) {
  const tracks = new Map();
  let length = 0;
  const walk = (folder) => {
    for (const part of folder.children.filter(c => c.className === 'Folder')) {
      const posCurve = part.children.find(c => c.className === 'Vector3Curve');
      const rotCurve = part.children.find(c => c.className === 'EulerRotationCurve');
      const axes = (curve) => ['X', 'Y', 'Z'].map(x => curveKeys(curve && curve.children.find(c => c.name === x)));
      const pos = axes(posCurve);
      const rot = axes(rotCurve);
      const times = [...new Set([...pos, ...rot].flat().map(k => k.time))].sort((x, y) => x - y);
      if (times.length) {
        const order = ROTATION_ORDER[Number((prop(rotCurve, 'RotationOrder') || {}).value) || 0] || 'XYZ';
        tracks.set(part.name, times.map(time => ({
          time,
          pos: new THREE.Vector3(curveAt(pos[0], time), curveAt(pos[1], time), curveAt(pos[2], time)),
          quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(curveAt(rot[0], time), curveAt(rot[1], time), curveAt(rot[2], time), order)),
          style: 0,
          dir: 0,
          weight: 1,
        })));
        length = Math.max(length, times[times.length - 1]);
      }
      walk(part);
    }
  };
  walk(anim);
  return { tracks, length, loop: (prop(anim, 'Loop') || {}).value !== false, marks: new Map() };
}

export function parseAnimation(model) {
  const seq = model.roots.find(n => n.className === 'KeyframeSequence');
  if (!seq) {
    const curves = model.roots.find(n => n.className === 'CurveAnimation');
    return curves ? parseCurves(curves) : null;
  }
  const loop = (prop(seq, 'Loop') || {}).value !== false;
  const tracks = new Map();
  const marks = new Map();
  let length = 0;
  for (const kf of seq.children.filter(c => c.className === 'Keyframe')) {
    const time = Number((prop(kf, 'Time') || {}).value) || 0;
    length = Math.max(length, time);
    if (kf.name && kf.name !== 'Keyframe') marks.set(kf.name.toLowerCase(), time);
    for (const m of kf.children.filter(c => c.className === 'KeyframeMarker')) marks.set(String(m.name).toLowerCase(), time);
    const walk = (n) => {
      for (const p of n.children.filter(c => c.className === 'Pose')) {
        const m = cf(prop(p, 'CFrame'));
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        m.decompose(pos, quat, new THREE.Vector3());
        if (!tracks.has(p.name)) tracks.set(p.name, []);
        tracks.get(p.name).push({ time, pos, quat, style: (prop(p, 'EasingStyle') || {}).value ?? 0, dir: (prop(p, 'EasingDirection') || {}).value ?? 0, weight: Number((prop(p, 'Weight') || {}).value ?? 1) });
        walk(p);
      }
    };
    walk(kf);
  }
  for (const list of tracks.values()) list.sort((a, b) => a.time - b.time);
  return { tracks, length, loop, marks };
}

export async function loadAnimation(id) {
  const { model } = await loadModel(id);
  const direct = parseAnimation(model);
  if (direct) return direct;
  const refs = model.roots.flatMap(descendants).filter(n => n.className === 'Animation' && assetIdOf((prop(n, 'AnimationId') || {}).value));
  if (!refs.length) return null;
  const weight = (n) => {
    const w = n.children.find(c => c.name === 'Weight');
    return w ? Number((prop(w, 'Value') || {}).value) || 0 : 1;
  };
  const ref = refs.reduce((a, b) => weight(b) > weight(a) ? b : a);
  const { model: inner } = await loadModel(assetIdOf(prop(ref, 'AnimationId').value));
  return parseAnimation(inner);
}

export class Animator {
  constructor(avatar) {
    this.avatar = avatar;
    this.clip = null;
    this.time = 0;
    this.byPart = new Map();
    for (const j of avatar.rig.joints) this.byPart.set(j.part1.name, j);
  }

  play(clip) {
    this.clip = clip;
    this.time = 0;
    for (const j of this.avatar.rig.joints) j.transform.identity();
  }

  hold(clip) {
    this.overlay = clip;
  }

  sample(clip, t, filter, pos, quat, one) {
    for (const [name, list] of clip.tracks) {
      if (filter && !filter(name)) continue;
      const joint = this.byPart.get(name);
      if (!joint || !list.length) continue;
      let i = 0;
      while (i < list.length - 1 && list[i + 1].time <= t) i++;
      const a = list[i];
      const b = list[Math.min(i + 1, list.length - 1)];
      if (a === b || b.time <= a.time || t <= a.time) {
        pos.copy(a.pos);
        quat.copy(a.quat);
      } else {
        const k = ease(a.style, a.dir, (t - a.time) / (b.time - a.time));
        pos.lerpVectors(a.pos, b.pos, k);
        quat.slerpQuaternions(a.quat, b.quat, k);
      }
      joint.transform.compose(pos, quat, one);
    }
  }

  update(dt) {
    const clip = this.clip;
    if (!clip) return;
    this.time += dt;
    let t = this.time;
    if (clip.length > 0) t = clip.loop ? t % clip.length : Math.min(t, clip.length);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const holding = this.overlay && this.avatar.holding;
    this.sample(clip, t, holding ? (name) => !TOOL_PARTS.has(name) : null, pos, quat, one);
    if (holding) {
      const o = this.overlay;
      const ot = o.length > 0 ? this.time % o.length : 0;
      this.sample(o, ot, (name) => TOOL_PARTS.has(name), pos, quat, one);
    }
    pose(this.avatar);
  }
}
