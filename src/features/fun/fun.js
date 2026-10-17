(function () {
  'use strict';

  const { lt } = window.RoUtilityI18n;
  const KEY = 'routilityFun';
  const KINDS = new Set(['asset', 'bundle', 'pass', 'product', 'other']);
  let settings = null;
  let state = { spent: 0, items: [] };
  const patched = new WeakSet();
  let realNow = null;
  let markReady;
  const ready = new Promise(r => { markReady = r; });

  const num = (v, max) => (Number.isFinite(v) && v >= 0 && v <= max ? Math.floor(v) : null);

  function item(x) {
    if (!x || typeof x !== 'object' || !KINDS.has(x.kind)) return null;
    const id = num(x.id, Number.MAX_SAFE_INTEGER);
    const price = num(x.price, 1e12);
    const at = num(x.at, Number.MAX_SAFE_INTEGER);
    if (id == null || price == null || at == null) return null;
    const out = { kind: x.kind, id, name: typeof x.name === 'string' ? x.name.slice(0, 200) : '', price, at };
    if (num(x.type, 1000)) out.type = x.type;
    if (num(x.bundleType, 100)) out.bundleType = x.bundleType;
    if (num(x.icon, Number.MAX_SAFE_INTEGER)) out.icon = x.icon;
    const c = x.creator;
    if (c && typeof c === 'object' && typeof c.name === 'string') {
      out.creator = { id: num(c.id, Number.MAX_SAFE_INTEGER) || 0, name: c.name.slice(0, 100), type: c.type === 'Group' ? 'Group' : 'User', verified: c.verified === true };
    }
    const uuid = (v) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v.toLowerCase() : null);
    if (uuid(x.cid)) out.cid = uuid(x.cid);
    if (x.limited === true) out.limited = true;
    const l = x.listing;
    if (l && typeof l === 'object') {
      const listing = {};
      if (uuid(l.cid)) listing.cid = uuid(l.cid);
      if (uuid(l.instance)) listing.instance = uuid(l.instance);
      if (uuid(l.product)) listing.product = uuid(l.product);
      if (num(l.seller, Number.MAX_SAFE_INTEGER)) listing.seller = l.seller;
      if (num(l.uaid, Number.MAX_SAFE_INTEGER)) listing.uaid = l.uaid;
      if (num(l.serial, 1e9) != null) listing.serial = l.serial;
      if (listing.instance || listing.uaid) out.listing = listing;
    }
    return out;
  }

  function clean(v) {
    const o = v && typeof v === 'object' ? v : {};
    const items = (Array.isArray(o.items) ? o.items : []).map(item).filter(Boolean).slice(-500);
    const ids = new Set(items.filter(x => x.kind === 'asset').map(x => x.id));
    const bundles = items.some(x => x.kind === 'bundle');
    const worn = (Array.isArray(o.worn) ? o.worn : []).filter(id => Number.isFinite(id) && (bundles || ids.has(id))).slice(0, 50);
    return { spent: num(o.spent, 1e13) || 0, items, worn };
  }

  function amount() {
    const raw = settings.fakeRobuxAmount === undefined ? '1000000' : String(settings.fakeRobuxAmount);
    const n = Number(raw.replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? Math.min(n, 1e12) : 0;
  }

  function multiplier() {
    const m = Number(settings.fakeRobuxMode);
    return Number.isFinite(m) && m > 1 ? Math.min(m, 1e6) : 0;
  }

  const buying = () => !!settings && settings.fakeBuy === true;

  function requests() {
    const pick = settings.fakeRequestsAdd === undefined ? 'amount' : String(settings.fakeRequestsAdd);
    const n = Number(pick === 'amount' ? String(settings.fakeRequestsAmount === undefined ? '500' : settings.fakeRequestsAmount).replace(/[^\d]/g, '') : pick);
    return settings.fakeRequests === true && Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), 1e9) : 0;
  }

  function config() {
    return { robux: settings.fakeRobux === true, amount: amount(), mult: multiplier(), buy: buying(), spent: state.spent, items: state.items, worn: state.worn, requests: requests() };
  }

  function post() {
    if (settings) window.postMessage({ type: 'routility-fun', cfg: config() }, location.origin);
  }

  function owned(kind, id) {
    if (!buying()) return null;
    const n = Number(id);
    return state.items.find(x => x.kind === kind && x.id === n) || null;
  }

  function save(rec) {
    const keep = rec.kind === 'product' || rec.kind === 'other' || !!rec.listing;
    state = {
      spent: state.spent + rec.price,
      items: state.items.filter(x => keep || !(x.kind === rec.kind && x.id === rec.id)).concat(rec).slice(-500),
      worn: state.worn,
    };
    chrome.storage.local.set({ [KEY]: state });
  }

  const HEADSHOT_KEY = 'routilityFunHeadshot';
  const headshots = new Map();

  async function getJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function wornList() {
    if (!buying()) return [];
    const seen = new Set();
    return state.items.filter(x => x.kind === 'asset' && state.worn.includes(x.id) && !seen.has(x.id) && seen.add(x.id)).map(x => ({ id: x.id, name: x.name, type: x.type }));
  }

  async function headshot(circular) {
    const worn = wornList();
    if (!worn.length) return null;
    const [av, custom] = await Promise.all([
      getJson('https://avatar.roblox.com/v2/avatar/avatar'),
      getJson('https://avatar.roblox.com/v1/avatar/thumbnail-customizations'),
    ]);
    if (!av) return null;
    const c = ((custom && custom.avatarThumbnailCustomizations) || []).find(x => x.thumbnailType === 1) || {};
    const cam = { emote: Number(c.emoteAssetId) || 0, fov: Number(c.camera && c.camera.fieldOfViewDeg) || 30, rot: Number(c.camera && c.camera.yRotDeg) || 0, dist: Number(c.camera && c.camera.distanceScale) || -1 };
    const sig = JSON.stringify([3, av.playerAvatarType, av.scales, av.bodyColor3s, (av.assets || []).map(a => [a.id, a.meta || null]), worn.map(x => x.id), cam, !!circular]);
    const stored = await new Promise(r => chrome.storage.local.get(HEADSHOT_KEY, st => r(Array.isArray(st[HEADSHOT_KEY]) ? st[HEADSHOT_KEY] : [])));
    const hit = stored.find(x => x && x.sig === sig && typeof x.url === 'string');
    if (hit) return hit.url;
    const [ui] = await Promise.all([import(chrome.runtime.getURL('src/preview/ui.js')), import(chrome.runtime.getURL('src/preview/mesh.js'))]);
    const url = await ui.headshotImage(worn, cam, 420, !!circular);
    if (url) chrome.storage.local.set({ [HEADSHOT_KEY]: stored.filter(x => x && x.sig !== sig).slice(-1).concat({ sig, url }) });
    return url;
  }

  const bodies = new Map();
  let bodySeq = 0;

  function bodyRender(size) {
    if (!bodies.has(size)) {
      const id = ++bodySeq;
      bodies.set(size, new Promise((resolve) => {
        const done = (e) => {
          if (e.source !== window || !e.data || e.data.type !== 'routility-fun-render-done' || e.data.id !== id) return;
          window.removeEventListener('message', done);
          clearTimeout(timer);
          resolve(typeof e.data.url === 'string' && /^https:\/\/[\w.-]+\.rbxcdn\.com\//.test(e.data.url) ? e.data.url : null);
        };
        const timer = setTimeout(() => {
          window.removeEventListener('message', done);
          resolve(null);
        }, 25000);
        window.addEventListener('message', done);
        window.postMessage({ type: 'routility-fun-render', id, size }, location.origin);
      }));
    }
    const out = bodies.get(size);
    out.then((url) => { if (!url && bodies.get(size) === out) bodies.delete(size); });
    return out;
  }

  function headshotFor(circular) {
    const key = !!circular;
    if (!headshots.has(key)) {
      const job = ready.then(() => headshot(key)).catch(() => null);
      headshots.set(key, job);
      job.then((url) => { if (!url && headshots.get(key) === job) headshots.delete(key); });
    }
    return headshots.get(key);
  }

  const myId = () => String(document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid') || '');
  const THUMBS = /^https:\/\/thumbnails\.roblox\.com\/v1\/(batch|users\/avatar(?:-headshot|-bust)?)(?:[?#]|$)/i;
  const WEARING = /^https:\/\/avatar\.roblox\.com\/v1\/users\/(\d+)\/(currently-wearing|avatar)(?:[?#]|$)/i;

  async function swapThumbs(url, pending, init) {
    const res = await pending;
    await ready;
    const me = myId();
    if (!res.ok || !me) return res;
    let data;
    try { data = await res.clone().json(); } catch { return res; }
    const list = data && Array.isArray(data.data) ? data.data : null;
    if (!list || !list.some(x => String(x.targetId) === me)) return res;
    const want = [];
    if (/\/batch/i.test(url)) {
      let body = [];
      try { body = JSON.parse(init && typeof init.body === 'string' ? init.body : '[]'); } catch {}
      for (const x of list) {
        if (String(x.targetId) !== me) continue;
        const q = (Array.isArray(body) ? body : []).find(r => r && r.requestId === x.requestId) || {};
        if (q.type === 'Avatar') want.push({ x, head: false, size: q.size });
        else if (/^Avatar(HeadShot|Bust)$/i.test(String(q.type || ''))) want.push({ x, head: true, circular: !!q.isCircular });
      }
    } else {
      const u = new URL(url);
      const head = /avatar-(headshot|bust)/i.test(u.pathname);
      for (const x of list) if (String(x.targetId) === me) want.push({ x, head, size: u.searchParams.get('size'), circular: String(u.searchParams.get('isCircular')).toLowerCase() === 'true' });
    }
    let changed = false;
    for (const w of want) {
      const img = w.head ? await headshotFor(w.circular) : await bodyRender(/^\d+x\d+$/.test(String(w.size || '')) ? String(w.size) : '352x352');
      if (!img) continue;
      w.x.imageUrl = img;
      w.x.state = 'Completed';
      changed = true;
    }
    return changed ? new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
  }

  const TYPE_NAMES = { 2: 'TShirt', 8: 'Hat', 11: 'Shirt', 12: 'Pants', 17: 'Head', 18: 'Face', 19: 'Gear', 27: 'Torso', 28: 'RightArm', 29: 'LeftArm', 30: 'LeftLeg', 31: 'RightLeg', 41: 'HairAccessory', 42: 'FaceAccessory', 43: 'NeckAccessory', 44: 'ShoulderAccessory', 45: 'FrontAccessory', 46: 'BackAccessory', 47: 'WaistAccessory', 48: 'ClimbAnimation', 49: 'DeathAnimation', 50: 'FallAnimation', 51: 'IdleAnimation', 52: 'JumpAnimation', 53: 'RunAnimation', 54: 'SwimAnimation', 55: 'WalkAnimation', 56: 'PoseAnimation', 57: 'EarAccessory', 58: 'EyeAccessory', 64: 'TShirtAccessory', 65: 'ShirtAccessory', 66: 'PantsAccessory', 67: 'JacketAccessory', 68: 'SweaterAccessory', 69: 'ShortsAccessory', 70: 'LeftShoeAccessory', 71: 'RightShoeAccessory', 72: 'DressSkirtAccessory', 76: 'EyebrowAccessory', 77: 'EyelashAccessory', 78: 'MoodAnimation', 79: 'DynamicHead' };

  async function swapWearing(kind, pending) {
    const res = await pending;
    if (!res.ok) return res;
    let data;
    try { data = await res.clone().json(); } catch { return res; }
    const worn = wornList();
    if (kind === 'currently-wearing' && data && Array.isArray(data.assetIds)) {
      for (const x of worn) if (!data.assetIds.includes(x.id)) data.assetIds.push(x.id);
    } else if (kind === 'avatar' && data && Array.isArray(data.assets)) {
      for (const x of worn) if (!data.assets.some(a => Number(a.id) === x.id)) data.assets.push({ id: x.id, name: x.name, assetType: { id: x.type, name: TYPE_NAMES[x.type] || 'Hat' }, currentVersionId: 0 });
    } else return res;
    return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: res.headers });
  }

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = '';
    try { url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || ''; } catch {}
    if (!settings || !buying() || !wornList().length || location.pathname.startsWith('/my/avatar')) return nativeFetch.apply(this, arguments);
    if (THUMBS.test(url)) return swapThumbs(url, nativeFetch.apply(this, arguments), init);
    const w = url.match(WEARING);
    if (w && w[1] === myId()) return swapWearing(w[2].toLowerCase(), nativeFetch.apply(this, arguments));
    return nativeFetch.apply(this, arguments);
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || !settings) return;
    if (e.data.type === 'routility-fun-headshot') {
      const circular = !!e.data.circular;
      if (!headshots.has(circular)) headshots.set(circular, headshot(circular).catch(() => null));
      headshots.get(circular).then(url => window.postMessage({ type: 'routility-fun-headshot-done', id: e.data.id, url: url || null }, location.origin));
      return;
    }
    if (e.data.type === 'routility-fun-hello') post();
    else if (e.data.type === 'routility-fun-bought' && buying()) {
      const rec = item(e.data.item);
      if (rec) save(rec);
    } else if (e.data.type === 'routility-fun-worn' && buying() && Array.isArray(e.data.ids)) {
      const next = clean({ spent: state.spent, items: state.items, worn: e.data.ids });
      if (next.worn.join(',') === state.worn.join(',')) return;
      state = next;
      chrome.storage.local.set({ [KEY]: state });
    }
  });

  function shownBalance(real) {
    const base = settings.fakeRobux !== true ? real : multiplier() ? real * multiplier() : amount();
    return Math.max(0, base - (buying() ? state.spent : 0));
  }

  function realBalance() {
    const uid = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    if (!realNow && uid) {
      realNow = fetch(`https://economy.roblox.com/v1/users/${uid}/currency`, { credentials: 'include' })
        .then(res => (res.ok ? res.json() : null))
        .then(d => (d && typeof d.robux === 'number' ? d.robux : null))
        .catch(() => null);
    }
    return realNow || Promise.resolve(null);
  }

  function patchBalance() {
    if (!(settings.fakeRobux === true || buying()) || !document.querySelector('[data-user-balance-robux]')) return;
    realBalance().then((real) => {
      if (real == null) return;
      const want = String(shownBalance(real));
      for (const node of document.querySelectorAll('[data-user-balance-robux]')) {
        if (node.getAttribute('data-user-balance-robux') === String(real) && want !== String(real)) node.setAttribute('data-user-balance-robux', want);
      }
    });
  }

  function patchPass() {
    const box = document.querySelector('#item-container[data-asset-type="Game Pass"]');
    if (!box || patched.has(box) || !owned('pass', box.dataset.deleteId)) return;
    const text = box.querySelector('#item-details .price-container-text');
    const action = box.querySelector('#item-details .action-button');
    const by = box.querySelector('.item-name-container .text-label');
    if (!text || !action || !by || !by.parentElement) return;
    patched.add(box);
    const divider = document.createElement('div');
    divider.className = 'divider';
    divider.innerHTML = '&nbsp;';
    const check = document.createElement('div');
    check.className = 'label-checkmark';
    const tick = document.createElement('span');
    tick.className = 'icon-checkmark-white-bold';
    check.appendChild(tick);
    const label = document.createElement('span');
    label.textContent = lt('Item Owned');
    by.after(divider, check, label);
    if (!text.querySelector('.item-first-line')) {
      const line = document.createElement('div');
      line.className = 'item-first-line';
      line.textContent = lt('This item is available in your inventory.');
      text.prepend(line);
    }
    const uid = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid') || '';
    const link = document.createElement('a');
    link.id = 'inventory-button';
    link.href = `https://www.roblox.com/users/${uid}/inventory`;
    link.className = 'btn-fixed-width-lg btn-control-md';
    link.dataset.buttonAction = 'inventory';
    link.textContent = ` ${lt('Inventory')} `;
    action.replaceChildren(link);
  }

  function patch() {
    if (!settings) return;
    patchBalance();
    patchPass();
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch();
    });
  });

  chrome.storage.local.get(['routilitySettings', KEY], (st) => {
    settings = st.routilitySettings || {};
    state = clean(st[KEY]);
    markReady();
    post();
    if (settings.fakeRobux === true || buying()) {
      observer.observe(document, { childList: true, subtree: true });
      window.addEventListener('load', () => setTimeout(() => observer.disconnect(), 4000), { once: true });
      patch();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !settings) return;
    if (changes.routilitySettings) settings = changes.routilitySettings.newValue || {};
    if (changes[KEY]) state = clean(changes[KEY].newValue);
    if (changes.routilitySettings || changes[KEY]) {
      headshots.clear();
      bodies.clear();
      post();
      patch();
    }
  });

  window.RoUtilityFun = {
    owned: (kind, id) => owned(kind, id),
    copies: (id) => (buying() ? state.items.filter(x => x.kind === 'asset' && x.id === Number(id)).map(x => (x.listing && x.listing.serial != null ? x.listing.serial : null)) : []),
    ready,
    worn: () => wornList(),
    headshot: (circular) => ready.then(() => (wornList().length ? headshotFor(circular) : null)),
    typeName: (type) => TYPE_NAMES[type] || '',
    inventory: (userId, type) => ready.then(() => (buying() && String(userId) === myId() ? state.items.filter(x => x.kind === 'asset' && x.type === Number(type)).sort((a, b) => b.at - a.at) : [])),
    render: (size) => ready.then(() => {
      if (!buying() || !state.worn.length) return null;
      bodies.delete(size);
      return bodyRender(size);
    }),
  };
})();
