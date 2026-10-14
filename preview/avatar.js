import * as THREE from '../lib/three.module.js';

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
  const m = String(value || '').match(/(?:id=|rbxassetid:\/\/|\/asset\/\?id=)(\d+)/i) || String(value || '').match(/^(\d+)$/);
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
      const wasmBinary = await (await fetch(chrome.runtime.getURL('lib/draco_decoder.wasm'))).arrayBuffer();
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

let fireSprite = null;

function fireTexture() {
  if (fireSprite) return fireSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  fireSprite = new THREE.CanvasTexture(c);
  return fireSprite;
}

function num(inst, ...names) {
  for (const n of names) {
    const p = prop(inst, n);
    if (p && Number.isFinite(Number(p.value))) return Number(p.value);
  }
  return null;
}

class FireEffect {
  constructor(inst, host) {
    this.host = host;
    const c1 = prop(inst, 'Color');
    const c2 = prop(inst, 'SecondaryColor');
    this.c1 = c1 && c1.kind === 'color' ? new THREE.Color(...c1.value) : new THREE.Color(0.93, 0.5, 0.15);
    this.c2 = c2 && c2.kind === 'color' ? new THREE.Color(...c2.value) : new THREE.Color(0.55, 0.13, 0.05);
    const size = Math.max(2, Math.min(30, num(inst, 'size_xml', 'Size') ?? 5));
    this.heat = Math.max(0, Math.min(25, num(inst, 'heat_xml', 'Heat') ?? 9));
    this.spread = size * 0.1;
    this.count = 70;
    this.pos = new Float32Array(this.count * 3);
    this.col = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.max = new Float32Array(this.count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: size * 0.42, map: fireTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.origin = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) this.life[i] = -Math.random() * 0.8;
  }

  spawn(i) {
    const r = this.spread;
    this.pos[i * 3] = this.origin.x + (Math.random() - 0.5) * r * 2;
    this.pos[i * 3 + 1] = this.origin.y + (Math.random() - 0.5) * r * 2;
    this.pos[i * 3 + 2] = this.origin.z + (Math.random() - 0.5) * r * 2;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.35;
    this.vel[i * 3 + 1] = 0.4 + this.heat * 0.07 + Math.random() * 0.35;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    this.max[i] = 0.55 + Math.random() * 0.45;
    this.life[i] = this.max[i];
  }

  update(dt) {
    this.host.updateMatrixWorld(true);
    this.origin.setFromMatrixPosition(this.host.matrixWorld);
    if (this.points.parent) this.points.parent.worldToLocal(this.origin);
    this.points.visible = this.host.visible !== false;
    for (let i = 0; i < this.count; i++) {
      if (this.max[i] === 0) {
        this.life[i] += dt;
        if (this.life[i] < 0) continue;
        this.spawn(i);
      }
      this.life[i] -= dt;
      if (this.life[i] <= 0) this.spawn(i);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = 1 - this.life[i] / this.max[i];
      const fade = (1 - k) * (1 - k) * Math.min(1, k * 5) * 0.55;
      this.col[i * 3] = (this.c1.r + (this.c2.r - this.c1.r) * k) * fade;
      this.col[i * 3 + 1] = (this.c1.g + (this.c2.g - this.c1.g) * k) * fade;
      this.col[i * 3 + 2] = (this.c1.b + (this.c2.b - this.c1.b) * k) * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
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
  const mesh = new THREE.Mesh(geometry, material(map ? new THREE.Color(1, 1, 1) : base, map));
  mesh.geometry.userData.shared = true;
  const see = Number((prop(inst, 'Transparency') || {}).value) || 0;
  if (see > 0) {
    mesh.material.transparent = true;
    mesh.material.opacity = Math.max(0.08, 1 - see);
    mesh.material.alphaTest = 0.01;
    mesh.material.depthWrite = false;
    mesh.material.side = THREE.DoubleSide;
    mesh.userData.translucent = true;
  }
  const fires = inst.children.filter(c => c.className === 'Fire' && (prop(c, 'Enabled') || { value: true }).value !== false);
  if (fires.length) mesh.userData.fires = fires;
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
      if (mesh && clothes && slot && clothes[slot] && !hasTexture) {
        mesh.material.dispose();
        const c = clothes[slot];
        mesh.material = material(new THREE.Color(1, 1, 1), paint(color, [c], c.width, c.height));
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
  const accTasks = accP.map(async ({ a, model }) => {
    try {
      const { model: m } = await model;
      const acc = m.roots.find(n => /Accessory|Hat/.test(n.className)) || m.roots[0];
      const handle = acc && acc.children.find(c => c.name === 'Handle');
      if (!handle) return;
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
    for (const f of m.userData.fires || []) {
      const fx = new FireEffect(f, m);
      effects.push(fx);
      group.add(fx.points);
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
