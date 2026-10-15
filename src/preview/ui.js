import * as THREE from '../../vendor/three.module.js';
import { AvatarScene, buildAvatar, Animator, loadAnimation, ANIMS, pose, setAdjust, warm as warmAssets } from './avatar.js';

const { lt, LT } = window.RoUtilityI18n;

const ACCESSORY = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58, 76, 77]);
const SINGLE = new Set([2, 11, 12, 17, 79, 18, 27, 28, 29, 30, 31]);
const BODY_PARTS = new Set([27, 28, 29, 30, 31]);
const LAYERED_TRY = new Set([64, 65, 66, 67, 68, 69, 70, 71, 72]);
const ANIM_TYPES = { 51: LT('Idle'), 55: LT('Walk'), 53: LT('Run'), 52: LT('Jump'), 50: LT('Fall'), 48: LT('Climb'), 54: LT('Swim'), 56: LT('Pose') };
const BASE_ANIMS = [LT('Idle'), LT('Walk'), LT('Run'), LT('Jump')];
const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function chip(label, on, onClick) {
  const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-pv-chip ' + (on ? 'bg-inverse-surface-0 content-inverse-emphasis' : 'bg-shift-300 content-action-utility'));
  b.type = 'button';
  const layer = el('div', STATE_LAYER);
  layer.setAttribute('aria-hidden', 'true');
  b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', label));
  b.addEventListener('click', onClick);
  return b;
}

async function myAvatar() {
  const r = await fetch('https://avatar.roblox.com/v2/avatar/avatar', { credentials: 'include' });
  if (!r.ok) throw new Error('avatar');
  return r.json();
}

let current = null;
let avatarData = null;

function avatarOnce() {
  if (!avatarData) avatarData = myAvatar().catch((e) => { avatarData = null; throw e; });
  return avatarData;
}

export async function warm(item) {
  try {
    const data = await avatarOnce();
    const kind = data.playerAvatarType === 'R15' ? 'R15' : 'R6';
    const assets = (data.assets || []).map(a => ({ id: String(a.id), type: a.assetType && a.assetType.id }));
    if (item) for (const a of item.items || [item]) if (a.type !== 61) assets.push({ id: String(a.id), type: a.type });
    await warmAssets(kind, assets);
  } catch {}
}

export async function open(host, item) {
  close();
  const wrap = el('div', 'routility-injected routility-pv');
  const canvas = el('canvas', 'routility-pv-canvas');
  const skeleton = el('div', 'routility-pv-skel');
  for (const part of ['head', 'torso', 'arm-l', 'arm-r', 'leg-l', 'leg-r']) skeleton.appendChild(el('span', 'routility-sk routility-pv-sk-' + part));
  const top = el('div', 'routility-pv-top');
  const kinds = el('div', 'routility-pv-kinds');
  const closeBtn = el('button', 'btn-control btn-control-md routility-pv-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', lt('Close preview'));
  closeBtn.textContent = '✕';
  top.append(kinds, closeBtn);
  const bottom = el('div', 'routility-pv-bottom');
  const outfitBtn = el('button', 'btn-control btn-control-md routility-pv-outfit-btn', lt('Outfit'));
  outfitBtn.type = 'button';
  const anims = el('div', 'routility-pv-anims');
  bottom.append(outfitBtn, anims);
  const emotePanel = el('div', 'routility-pv-panel routility-pv-emotes');
  emotePanel.hidden = true;
  const bar = el('div', 'routility-pv-bar');
  bar.hidden = true;
  const panel = el('div', 'routility-pv-panel');
  panel.hidden = true;
  wrap.append(canvas, skeleton, bar, top, bottom, panel, emotePanel);
  host.appendChild(wrap);

  const scene = new AvatarScene(canvas);
  const fit = () => {
    const r = wrap.getBoundingClientRect();
    if (r.width && r.height) scene.resize(r.width, r.height);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);

  const state = current = { wrap, scene, ro, avatar: null, data: null, kind: null, off: new Set(), building: 0, anim: 'Idle', animator: null, clips: new Map() };
  closeBtn.addEventListener('click', close);

  let data;
  try {
    data = await avatarOnce();
  } catch {
    skeleton.remove();
    wrap.appendChild(el('div', 'routility-pv-msg', lt('Sign in to preview items on your avatar.')));
    return;
  }
  if (current !== state) return;
  state.data = data;
  const worn = (data.assets || []).map(a => ({ id: String(a.id), type: a.assetType && a.assetType.id, name: a.name, meta: a.meta }));
  const tried = item ? (item.items || [item]).map(a => ({ id: String(a.id), type: a.type, name: a.name || item.name || lt('This item'), tried: true })) : [];
  const tryEmote = tried.find(t => t.type === 61);
  state.kind = data.playerAvatarType === 'R15' || tryEmote || tried.some(t => ANIM_TYPES[t.type] || BODY_PARTS.has(t.type) || LAYERED_TRY.has(t.type) || (!document.documentElement.classList.contains('routility-keep-r6') && (t.type === 18 || t.type === 79))) ? 'R15' : 'R6';
  if (tryEmote) state.anim = 'emote:' + tryEmote.id;
  const extraAnims = [...new Set(tried.map(t => ANIM_TYPES[t.type]).filter(n => n && !BASE_ANIMS.includes(n)))];
  if (tried.length === 1 && ANIM_TYPES[tried[0].type]) state.anim = ANIM_TYPES[tried[0].type];

  const outfit = () => {
    let list = worn.filter(a => !state.off.has(a.id));
    for (const t of tried) {
      if (state.off.has(t.id) || t.type === 61) continue;
      if (SINGLE.has(t.type) || ANIM_TYPES[t.type]) list = list.filter(a => a.type !== t.type && !(t.type === 79 && a.type === 17) && !(t.type === 17 && a.type === 79));
      if (!list.some(a => a.id === t.id)) list.push(t);
    }
    return list;
  };

  const renderKinds = () => {
    kinds.textContent = '';
    for (const k of ['R6', 'R15']) kinds.appendChild(chip(k, state.kind === k, () => { if (state.kind !== k) { state.kind = k; renderKinds(); build(); } }));
  };

  const build = async () => {
    const ticket = ++state.building;
    if (state.avatar) bar.hidden = false;
    else skeleton.hidden = false;
    const yaw = scene.yaw;
    try {
      const avatar = await buildAvatar(scene, { kind: state.kind, colors: data.bodyColor3s, scales: data.scales, assets: outfit(), staging: true, clearFirst: () => { if (ticket === state.building) scene.clear(); } });
      if (ticket !== state.building || current !== state) return;
      state.avatar = avatar;
      scene.yaw = yaw;
      if (avatar.failed && avatar.failed.length && !state.retried) {
        state.retried = true;
        setTimeout(() => { if (current === state && ticket === state.building) build(); }, 2500);
      }
      state.animator = new Animator(avatar);
      scene.onFrame = (dt) => state.animator && state.animator.update(dt);
      playAnim(state.anim);
    } catch (e) {
      if (ticket === state.building) wrap.appendChild(el('div', 'routility-pv-msg', lt('Couldn’t build your avatar right now.')));
    }
    if (ticket === state.building) {
      skeleton.hidden = true;
      bar.hidden = true;
      wrap.classList.add('routility-pv-ready');
    }
  };

  const renderPanel = async () => {
    panel.textContent = '';
    const rows = [...tried, ...worn.filter(a => !tried.some(t => t.id === a.id))];
    const thumbs = await new Promise(r => chrome.runtime.sendMessage({ type: 'getAssetThumbs', ids: rows.map(a => a.id) }, (res) => { void chrome.runtime.lastError; r(res || {}); }));
    if (current !== state) return;
    panel.textContent = '';
    for (const a of rows) {
      const row = el('label', 'routility-pv-row');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !state.off.has(a.id);
      box.addEventListener('change', () => {
        if (box.checked) state.off.delete(a.id);
        else state.off.add(a.id);
        build();
      });
      const pic = el('span', 'routility-pv-thumb');
      if (thumbs[a.id]) {
        const img = el('img');
        img.src = thumbs[a.id];
        img.alt = '';
        pic.appendChild(img);
      }
      const name = el('span', 'routility-pv-name text-overflow', a.name);
      row.append(box, pic, name);
      if (a.tried) row.appendChild(el('span', 'routility-pv-tag', lt('Trying on')));
      panel.appendChild(row);
    }
  };

  const animId = (name) => {
    if (name.startsWith('emote:')) return name.slice(6);
    if (state.kind === 'R15') {
      const own = outfit().find(a => ANIM_TYPES[a.type] === name);
      if (own) return own.id;
    }
    return (ANIMS[state.kind] || ANIMS.R6)[name];
  };

  async function playAnim(name) {
    state.anim = name;
    renderAnims();
    const id = animId(name);
    const key = state.kind + ':' + id;
    if (!id || !state.animator) return;
    const get = (anim) => {
      const k = state.kind + ':' + anim;
      if (!state.clips.has(k)) state.clips.set(k, loadAnimation(anim).catch(() => null));
      return state.clips.get(k);
    };
    const toolId = (ANIMS[state.kind] || ANIMS.R6).Tool;
    const [clip, tool] = await Promise.all([get(id), state.avatar && state.avatar.holding ? get(toolId) : null]);
    if (current !== state || state.anim !== name || !state.animator) return;
    state.animator.play(clip);
    state.animator.hold(tool);
  }

  function renderAnims() {
    anims.textContent = '';
    for (const name of [...BASE_ANIMS, ...extraAnims]) anims.appendChild(chip(lt(name), state.anim === name, () => playAnim(name)));
    if (tryEmote) anims.appendChild(chip(tryEmote.name, state.anim === 'emote:' + tryEmote.id, () => playAnim('emote:' + tryEmote.id)));
    const emotes = ((data && data.emotes) || []).filter(e => !tryEmote || String(e.assetId) !== tryEmote.id);
    if (emotes.length) {
      const on = state.anim.startsWith('emote:') && (!tryEmote || state.anim !== 'emote:' + tryEmote.id);
      anims.appendChild(chip(on ? (emotes.find(e => 'emote:' + e.assetId === state.anim) || {}).assetName || lt('Emote') : lt('Emotes'), on, () => {
        emotePanel.hidden = !emotePanel.hidden;
        panel.hidden = true;
        if (!emotePanel.hidden) {
          emotePanel.textContent = '';
          for (const e of emotes) {
            const row = el('button', 'routility-pv-row routility-pv-emote', e.assetName);
            row.type = 'button';
            row.addEventListener('click', () => { emotePanel.hidden = true; playAnim('emote:' + e.assetId); });
            emotePanel.appendChild(row);
          }
        }
      }));
    }
  }

  outfitBtn.addEventListener('click', () => {
    emotePanel.hidden = true;
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !panel.childElementCount) renderPanel();
  });

  renderKinds();
  renderAnims();
  build();
}

export async function adjustPreview(canvas) {
  const scene = new AvatarScene(canvas);
  const data = await myAvatar();
  const kind = data.playerAvatarType === 'R15' ? 'R15' : 'R6';
  const assets = (data.assets || []).map(a => ({ id: String(a.id), type: a.assetType && a.assetType.id, meta: a.meta }));
  const avatar = await buildAvatar(scene, { kind, colors: data.bodyColor3s, scales: data.scales, assets });
  const animator = new Animator(avatar);
  const ownIdle = kind === 'R15' ? assets.find(a => a.type === 51) : null;
  const [idle, tool] = await Promise.all([
    loadAnimation(ownIdle ? ownIdle.id : (ANIMS[kind] || ANIMS.R6).Idle).catch(() => null),
    avatar.holding ? loadAnimation((ANIMS[kind] || ANIMS.R6).Tool).catch(() => null) : null,
  ]);
  animator.play(idle);
  animator.hold(tool);
  animator.update(0);
  scene.root.updateMatrixWorld(true);
  const head = avatar.parts.find(m => m.userData.part && m.userData.part.name === 'Head');
  if (head) {
    const box = new THREE.Box3().setFromObject(head);
    box.getCenter(scene.target);
    scene.distance = Math.max(5, box.getSize(new THREE.Vector3()).y * 6);
  }
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) scene.resize(r.width, r.height);
  };
  fit();
  return {
    data,
    set(assetId, meta) {
      setAdjust(avatar, assetId, meta);
    },
    resize: fit,
    dispose() {
      scene.dispose();
    },
  };
}

export async function thumbPreview(canvas) {
  const scene = new AvatarScene(canvas, { controls: false });
  scene.ground.visible = false;
  scene.shadow.visible = false;
  const data = await avatarOnce();
  const kind = data.playerAvatarType === 'R15' ? 'R15' : 'R6';
  const assets = (data.assets || []).map(a => ({ id: String(a.id), type: a.assetType && a.assetType.id, meta: a.meta }));
  const avatar = await buildAvatar(scene, { kind, colors: data.bodyColor3s, scales: data.scales, assets });
  const animator = new Animator(avatar);
  const clips = new Map();
  const clip = (id) => {
    if (!clips.has(id)) clips.set(id, loadAnimation(id).catch(() => null));
    return clips.get(id);
  };
  const ownIdle = kind === 'R15' ? assets.find(a => a.type === 51) : null;
  const idle = ownIdle ? ownIdle.id : (ANIMS[kind] || ANIMS.R6).Idle;
  const headMesh = avatar.parts.find(m => m.userData.part && m.userData.part.name === 'Head');
  let ticket = 0;
  const frame = (o) => {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) scene.resize(r.width, r.height);
    const cam = scene.camera;
    cam.fov = Number(o.fov) || 30;
    cam.updateProjectionMatrix();
    scene.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    if (o.head && headMesh) {
      box.setFromObject(headMesh);
      const size = box.getSize(new THREE.Vector3());
      box.getCenter(scene.target);
      scene.target.y += size.y * 0.08;
      scene.distance = (Math.max(size.y, size.x) * 0.85) / half * (o.dist > 0 ? o.dist : 1);
      scene.pitch = 0.04;
      scene.yaw = -THREE.MathUtils.degToRad(Number(o.rot) || 0);
      return;
    } else {
      for (const m of avatar.parts) box.expandByObject(m);
      const limit = box.clone().expandByScalar(1.5);
      for (const m of avatar.accessories) {
        const b = new THREE.Box3().setFromObject(m);
        if (!b.isEmpty()) box.union(b.intersect(limit));
      }
      const size = box.getSize(new THREE.Vector3());
      box.getCenter(scene.target);
      scene.distance = (Math.max(size.y, size.x * 0.9) * 0.85) / half;
      scene.pitch = 0.12;
    }
    scene.yaw = -0.62 - THREE.MathUtils.degToRad(Number(o.rot) || 0);
  };
  return {
    async set(o) {
      const t = ++ticket;
      const posed = o.emote && kind === 'R15';
      const [c, tool] = await Promise.all([clip(posed ? String(o.emote) : idle), avatar.holding ? clip((ANIMS[kind] || ANIMS.R6).Tool) : null]);
      if (t !== ticket) return;
      animator.play(c);
      animator.hold(tool);
      if (c) {
        const mark = c.marks && c.marks.get('thumbnail');
        animator.time = posed ? (mark ?? c.length * 0.5) : 0;
        animator.update(0);
      } else pose(avatar);
      frame(o);
    },
    dispose() {
      ticket++;
      scene.dispose();
    },
  };
}

export async function headshotImage(extra, cam, size, circular) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const scene = new AvatarScene(canvas, { controls: false });
  scene.running = false;
  cancelAnimationFrame(scene.raf);
  scene.renderer.setPixelRatio(1);
  scene.resize(size, size);
  scene.ground.visible = false;
  scene.shadow.visible = false;
  try {
    const data = await myAvatar();
    const kind = data.playerAvatarType === 'R15' ? 'R15' : 'R6';
    const assets = (data.assets || []).map(a => ({ id: String(a.id), type: a.assetType && a.assetType.id, meta: a.meta }));
    for (const x of extra) if (!assets.some(a => a.id === String(x.id))) assets.push({ id: String(x.id), type: x.type });
    const avatar = await buildAvatar(scene, { kind, colors: data.bodyColor3s, scales: data.scales, assets });
    const animator = new Animator(avatar);
    const posed = cam.emote && kind === 'R15';
    const ownIdle = kind === 'R15' ? assets.find(a => a.type === 51) : null;
    const [c, tool] = await Promise.all([
      loadAnimation(posed ? String(cam.emote) : ownIdle ? ownIdle.id : (ANIMS[kind] || ANIMS.R6).Idle).catch(() => null),
      avatar.holding ? loadAnimation((ANIMS[kind] || ANIMS.R6).Tool).catch(() => null) : null,
    ]);
    animator.play(c);
    animator.hold(tool);
    if (c) {
      const mark = c.marks && c.marks.get('thumbnail');
      animator.time = posed ? (mark ?? c.length * 0.5) : 0;
      animator.update(0);
    } else pose(avatar);
    const headMesh = avatar.parts.find(m => m.userData.part && m.userData.part.name === 'Head');
    if (!headMesh) return null;
    const camera = scene.camera;
    camera.fov = Number(cam.fov) || 30;
    camera.updateProjectionMatrix();
    scene.root.updateMatrixWorld(true);
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const box = new THREE.Box3().setFromObject(headMesh);
    const dims = box.getSize(new THREE.Vector3());
    box.getCenter(scene.target);
    scene.target.x += dims.x * 0.00375;
    scene.target.y += dims.y * 0.0575;
    scene.distance = (Math.max(dims.y, dims.x) * 0.94) / half * (cam.dist > 0 ? cam.dist : 1);
    scene.pitch = 0.00625;
    scene.yaw = -0.01875 - THREE.MathUtils.degToRad(Number(cam.rot) || 0);
    const ambient = scene.scene.children.find(o => o.isAmbientLight);
    const back = scene.scene.children.find(o => o.isDirectionalLight && o !== scene.sun);
    if (ambient) ambient.intensity = 2.29;
    if (back) back.intensity = 0.03;
    scene.sun.intensity = 1.925;
    scene.sun.position.set(Math.sin(-1.8975) * Math.cos(0.98), Math.sin(0.98), -Math.cos(-1.8975) * Math.cos(0.98)).multiplyScalar(16).add(scene.target);
    scene.sun.target.position.copy(scene.target);
    scene.sun.target.updateMatrixWorld();
    scene.frame();
    if (!circular) return canvas.toDataURL('image/png');
    const round = document.createElement('canvas');
    round.width = round.height = size;
    const g = round.getContext('2d');
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    g.clip();
    g.drawImage(canvas, 0, 0);
    return round.toDataURL('image/png');
  } finally {
    scene.dispose();
  }
}

export function close() {
  if (!current) return;
  const s = current;
  current = null;
  s.ro.disconnect();
  s.scene.dispose();
  s.wrap.remove();
}
