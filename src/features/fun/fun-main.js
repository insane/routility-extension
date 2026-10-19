(function () {
  'use strict';

  const ORIGIN = location.origin;
  const waiters = [];
  const known = { item: new Map(), product: new Map(), cproduct: new Map(), pass: new Map(), listings: new Map() };
  const resale = new Map();
  let cfg = null;
  let lastReal = null;
  try { lastReal = robuxSaved(sessionStorage.getItem('routilityFunReal')); } catch {}

  function robuxSaved(v) {
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  function rememberBalance(n) {
    lastReal = n;
    try { sessionStorage.setItem('routilityFunReal', String(n)); } catch {}
  }

  function clean(c) {
    const o = c && typeof c === 'object' ? c : {};
    const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return {
      robux: o.robux === true,
      amount: n(o.amount),
      mult: n(o.mult),
      buy: o.buy === true,
      spent: n(o.spent),
      items: Array.isArray(o.items) ? o.items.filter(x => x && typeof x.kind === 'string' && Number.isFinite(x.id)) : [],
      worn: Array.isArray(o.worn) ? o.worn.filter(v => Number.isFinite(v)) : [],
      requests: n(o.requests),
    };
  }

  const balanceKey = (c) => [c.robux, c.amount, c.mult, c.buy, c.spent].join('|');

  let navTimer = 0;
  function refreshNav() {
    clearTimeout(navTimer);
    navTimer = setTimeout(() => window.dispatchEvent(new CustomEvent('navigation-update-user-currency')), 60);
  }

  function settle(c) {
    const before = cfg;
    cfg = clean(c);
    try { loadBundleParts(); } catch {}
    while (waiters.length) {
      try { waiters.shift()(); } catch {}
    }
    if (before && balanceKey(before) !== balanceKey(cfg)) refreshNav();
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.type === 'routility-fun') settle(e.data.cfg);
    else if (e.data.type === 'routility-fun-render' && cfg) {
      const id = e.data.id;
      wornRender(renderSize(e.data.size), '2dWebp').then(url => window.postMessage({ type: 'routility-fun-render-done', id, url: url || null }, ORIGIN));
    }
  });
  window.postMessage({ type: 'routility-fun-hello' }, ORIGIN);
  setTimeout(() => { if (!cfg) settle(null); }, 3000);

  const parse = (t) => {
    try { return JSON.parse(t); } catch { return undefined; }
  };
  const robux = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);

  function userMeta(attr) {
    const m = document.querySelector('meta[name="user-data"]');
    return m ? m.getAttribute(attr) || '' : '';
  }
  const me = () => Number(userMeta('data-userid')) || 0;

  function shown(real) {
    const base = !cfg.robux ? real : cfg.mult > 1 ? real * cfg.mult : cfg.amount;
    return Math.max(0, base - (cfg.buy ? cfg.spent : 0));
  }

  const picked = () => !!(cfg && cfg.robux && !(cfg.mult > 1));
  const realOrNull = () => (picked() ? 0 : lastReal);

  function owned(kind, id) {
    if (!cfg || !cfg.buy) return null;
    const n = Number(id);
    return cfg.items.find(x => x.kind === kind && x.id === n) || null;
  }

  const WEAR_NAMES = {
    2: 'TShirt', 8: 'Hat', 11: 'Shirt', 12: 'Pants', 17: 'Head', 18: 'Face', 19: 'Gear',
    27: 'Torso', 28: 'RightArm', 29: 'LeftArm', 30: 'LeftLeg', 31: 'RightLeg',
    41: 'HairAccessory', 42: 'FaceAccessory', 43: 'NeckAccessory', 44: 'ShoulderAccessory', 45: 'FrontAccessory', 46: 'BackAccessory', 47: 'WaistAccessory',
    48: 'ClimbAnimation', 49: 'DeathAnimation', 50: 'FallAnimation', 51: 'IdleAnimation', 52: 'JumpAnimation', 53: 'RunAnimation', 54: 'SwimAnimation', 55: 'WalkAnimation', 56: 'PoseAnimation',
    57: 'EarAccessory', 58: 'EyeAccessory',
    64: 'TShirtAccessory', 65: 'ShirtAccessory', 66: 'PantsAccessory', 67: 'JacketAccessory', 68: 'SweaterAccessory', 69: 'ShortsAccessory', 70: 'LeftShoeAccessory', 71: 'RightShoeAccessory', 72: 'DressSkirtAccessory',
    76: 'EyebrowAccessory', 77: 'EyelashAccessory', 78: 'MoodAnimation', 79: 'DynamicHead',
  };
  const CLASSIC_ONLY = new Set([17, 18]);
  const SINGLE_SLOT = new Set([2, 11, 12, 17, 18, 19, 27, 28, 29, 30, 31, 48, 49, 50, 51, 52, 53, 54, 55, 56, 78, 79]);
  const bundleParts = new Map();
  const partJobs = new Map();
  let realAssets = new Map();
  let realJob = null;

  function partsReady() {
    return Promise.all([...partJobs.values()]).catch(() => {});
  }

  function ensureReal() {
    if (realAssets.size) return Promise.resolve();
    if (!realJob) {
      realJob = oFetch.call(window, 'https://avatar.roblox.com/v1/avatar', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then((d) => { if (d) rememberReal(d.assets); })
        .catch(() => {})
        .finally(() => { realJob = null; });
    }
    return realJob;
  }

  function wearReady() {
    return Promise.all([partsReady(), ensureReal()]);
  }

  function anyWear() {
    return !!(cfg && cfg.buy && cfg.worn.length && cfg.items.some(x => x.kind === 'bundle' || (x.kind === 'asset' && WEAR_NAMES[x.type])));
  }

  function loadBundleParts() {
    if (!cfg || !cfg.buy) return;
    for (const b of cfg.items.filter(x => x.kind === 'bundle')) {
      if (bundleParts.has(b.id)) continue;
      bundleParts.set(b.id, null);
      partJobs.set(b.id, (async () => {
        const get = (u) => oFetch.call(window, u, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
        const d = await get(`https://catalog.roblox.com/v1/bundles/${b.id}/details`);
        const ids = ((d && d.items) || []).filter(i => i && i.type === 'Asset' && Number(i.id)).map(i => ({ id: Number(i.id), name: i.name || '', type: Number(i.assetType) || 0 }));
        const parts = [];
        for (const p of ids.slice(0, 12)) {
          let type = p.type;
          let name = p.name;
          if (!type) {
            const a = await get(`https://economy.roblox.com/v2/assets/${p.id}/details`);
            type = a ? Number(a.AssetTypeId) : 0;
            name = name || (a && a.Name) || '';
          }
          if (type && WEAR_NAMES[type]) parts.push({ kind: 'asset', id: p.id, name, type, at: b.at, bundle: b.id });
        }
        bundleParts.set(b.id, parts);
      })().catch(() => bundleParts.delete(b.id)).finally(() => partJobs.delete(b.id)));
    }
  }

  function fakeAccessories() {
    if (!cfg || !cfg.buy) return [];
    const seen = new Set();
    const own = sorted(cfg.items.filter(x => x.kind === 'asset' && WEAR_NAMES[x.type]));
    const parts = cfg.items.filter(x => x.kind === 'bundle').flatMap(b => bundleParts.get(b.id) || []);
    return own.concat(parts).filter(x => !seen.has(x.id) && seen.add(x.id));
  }

  function wornFakes() {
    const worn = new Set(cfg ? cfg.worn : []);
    return fakeAccessories().filter(x => worn.has(x.id));
  }

  function takenSlots(worn) {
    return new Set(worn.filter(x => SINGLE_SLOT.has(x.type)).map(x => x.type));
  }

  function rememberReal(list) {
    if (!Array.isArray(list)) return;
    const next = new Map();
    for (const a of list) {
      const id = Number(a && a.id);
      const type = Number(a && a.assetType && a.assetType.id);
      if (id && type) next.set(id, type);
    }
    if (next.size) realAssets = next;
  }

  function setWorn(ids) {
    const next = [...new Set(ids)];
    if (next.join(',') === cfg.worn.join(',')) return;
    cfg.worn = next;
    window.postMessage({ type: 'routility-fun-worn', ids: next }, ORIGIN);
  }

  function stripWear(b, getList, applies) {
    if (!cfg.buy || !b || !applies(b)) return null;
    const all = fakeAccessories();
    const fakes = new Set(all.map(x => x.id));
    if (!fakes.size) return null;
    const list = getList(b);
    if (!Array.isArray(list)) return null;
    const ids = list.map(a => Number(a && typeof a === 'object' ? a.id : a));
    setWorn(ids.filter(id => fakes.has(id)));
    if (!ids.some(id => fakes.has(id))) return null;
    const objects = list.some(a => a && typeof a === 'object');
    const keep = list.filter((a, i) => !fakes.has(ids[i]));
    const keptIds = new Set(keep.map(a => Number(a && typeof a === 'object' ? a.id : a)));
    const keptTypes = new Set([...keptIds].map(id => realAssets.get(id)).filter(Boolean));
    for (const type of takenSlots(all.filter(x => ids.includes(x.id)))) {
      if (keptTypes.has(type)) continue;
      for (const [id, t] of realAssets) {
        if (t !== type || keptIds.has(id)) continue;
        keep.push(objects ? { id } : id);
        keptIds.add(id);
        break;
      }
    }
    list.length = 0;
    list.push(...keep);
    return { body: JSON.stringify(b) };
  }

  function wornAvatar(kind) {
    if (!cfg || !cfg.buy) return null;
    return { wait: partsReady(), edit: (t) => {
      const d = parse(t);
      const list = d && (kind === 'v4' ? d.avatarModel && d.avatarModel.assets : d.assets);
      if (!Array.isArray(list)) return t;
      rememberReal(list);
      const worn = wornFakes();
      if (!worn.length) return t;
      const taken = takenSlots(worn);
      const keep = list.filter(a => !taken.has(Number(a && a.assetType && a.assetType.id)));
      const have = new Set(keep.map(a => Number(a.id)));
      for (const x of worn) if (!have.has(x.id)) keep.push({ id: x.id, name: x.name, assetType: { id: x.type, name: WEAR_NAMES[x.type] || 'Hat' }, currentVersionId: 0 });
      list.length = 0;
      list.push(...keep);
      return JSON.stringify(d);
    } };
  }

  const renders = new Map();
  const renderFails = new Map();
  let renderToken = '';

  async function wornRender(size, type) {
    const worn = wornFakes();
    if (!worn.length) return null;
    const get = (u) => oFetch.call(window, u, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [v1, v4] = await Promise.all([
      get('https://avatar.roblox.com/v1/avatar'),
      get('https://avatar.roblox.com/v4/avatar?selectionTypes=0&selectionTypes=1&selectionTypes=2&selectionTypes=3&selectionTypes=4&selectionTypes=5'),
    ]);
    if (!v1 || !Array.isArray(v1.assets)) return null;
    rememberReal(v1.assets);
    const taken = takenSlots(worn);
    const assets = v1.assets.filter(a => !taken.has(Number(a.assetType && a.assetType.id))).map(a => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id }));
    const have = new Set(assets.map(a => a.id));
    for (const x of worn) if (!have.has(x.id)) assets.push({ id: x.id });
    const avatarDefinition = { assets, bodyColors: (v4 && v4.avatarModel && v4.avatarModel.bodyColors) || {}, scales: v1.scales, playerAvatarType: { playerAvatarType: v1.playerAvatarType } };
    const key = type + '|' + size + '|' + JSON.stringify(avatarDefinition);
    if (renders.has(key)) return renders.get(key);
    if (Date.now() - (renderFails.get(key) || 0) < 300000) return Promise.resolve(null);
    const job = (async () => {
      const body = JSON.stringify({ thumbnailConfig: { thumbnailId: worn[0].id, thumbnailType: type, size }, avatarDefinition });
      for (let i = 0; i < 20; i++) {
        let res;
        try {
          res = await oFetch.call(window, 'https://avatar.roblox.com/v1/avatar/render', { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, renderToken ? { 'x-csrf-token': renderToken } : {}), body });
        } catch {
          return null;
        }
        if (res.status === 403 && res.headers.get('x-csrf-token')) {
          renderToken = res.headers.get('x-csrf-token');
          continue;
        }
        const d = res.ok ? await res.json().catch(() => null) : null;
        if (!d) return null;
        if (d.state === 'Completed' && d.imageUrl) return d.imageUrl;
        if (d.state && d.state !== 'Pending') return null;
        await new Promise(r => setTimeout(r, 1200));
      }
      return null;
    })();
    renders.set(key, job);
    job.then(u => {
      if (u) return;
      renders.delete(key);
      renderFails.set(key, Date.now());
    });
    return job;
  }

  const headshotJobs = new Map();
  let headshotSeq = 0;

  function fakeHeadshot(circular) {
    const key = (circular ? 'c' : 's') + ':' + wornFakes().map(x => x.id).join(',');
    if (!headshotJobs.has(key)) {
      const id = ++headshotSeq;
      headshotJobs.set(key, new Promise((resolve) => {
        const done = (e) => {
          if (e.source !== window || !e.data || e.data.type !== 'routility-fun-headshot-done' || e.data.id !== id) return;
          window.removeEventListener('message', done);
          clearTimeout(timer);
          resolve(typeof e.data.url === 'string' && e.data.url.startsWith('data:image/') ? e.data.url : null);
        };
        const timer = setTimeout(() => {
          window.removeEventListener('message', done);
          resolve(null);
        }, 25000);
        window.addEventListener('message', done);
        window.postMessage({ type: 'routility-fun-headshot', id, circular: !!circular }, ORIGIN);
      }));
    }
    return headshotJobs.get(key);
  }

  function renderSize(size) {
    return /^\d+x\d+$/.test(String(size || '')) ? String(size) : '352x352';
  }

  function bought(assetId, cid) {
    const out = { instances: new Set(), uaids: new Set(), recs: [] };
    if (!cfg || !cfg.buy) return out;
    const id = Number(assetId) || 0;
    for (const x of cfg.items) {
      const l = x.listing;
      if (!l || x.kind !== 'asset') continue;
      if (!((cid && (l.cid === cid || x.cid === cid)) || (id && x.id === id))) continue;
      out.recs.push(x);
      if (l.instance) out.instances.add(l.instance);
      if (l.uaid) out.uaids.add(Number(l.uaid));
    }
    return out;
  }

  function resaleKey(assetId, cid) {
    const b = bought(assetId, cid);
    if (!b.recs.length) return null;
    const c = cid || (b.recs.find(x => x.listing.cid) || { listing: {} }).listing.cid;
    return c ? 'c:' + c : 'a:' + (Number(assetId) || b.recs[0].id);
  }

  function learnListings(list) {
    for (const l of list || []) {
      const key = l.collectibleItemInstanceId ? String(l.collectibleItemInstanceId).toLowerCase() : l.userAssetId ? 'u' + l.userAssetId : null;
      if (key) known.listings.set(key, { price: Number(l.price) || 0, serial: Number.isFinite(l.serialNumber) ? l.serialNumber : null });
    }
  }

  function listings(key) {
    let hit = resale.get(key);
    if (!hit) {
      const url = key[0] === 'c'
        ? `https://apis.roblox.com/marketplace-sales/v1/item/${key.slice(2)}/resellers?cursor=&limit=100`
        : `https://economy.roblox.com/v1/assets/${key.slice(2)}/resellers?cursor=&limit=100`;
      hit = { list: null };
      hit.wait = oFetch.call(window, url, { credentials: 'include' })
        .then(res => (res.ok ? res.json() : null))
        .then((d) => {
          hit.list = d && Array.isArray(d.data) ? d.data : [];
          learnListings(hit.list);
        })
        .catch(() => { hit.list = []; });
      resale.set(key, hit);
    }
    return hit;
  }

  function remaining(list, b) {
    return (list || [])
      .filter(l => !(l.collectibleItemInstanceId && b.instances.has(String(l.collectibleItemInstanceId).toLowerCase())) && !(l.userAssetId && b.uaids.has(Number(l.userAssetId))))
      .sort((x, y) => x.price - y.price);
  }

  function lowest(price, next, onSale) {
    if (!next) return onSale ? price : 0;
    return onSale ? Math.min(price, next.price) : next.price;
  }

  function fixCatalog(d, rest) {
    const next = rest[0] || null;
    const onSale = !d.isOffSale && Number(d.price) > 0;
    d.hasResellers = !!next;
    d.lowestResalePrice = next ? next.price : 0;
    d.lowestPrice = lowest(Number(d.price) || 0, next, onSale);
  }

  function fixMarket(d, rest) {
    const next = rest[0] || null;
    const onSale = Number(d.price) > 0;
    d.hasResellers = !!next;
    d.lowestResalePrice = next ? next.price : 0;
    d.lowestPrice = lowest(Number(d.price) || 0, next, onSale);
    d.lowestAvailableResaleProductId = next ? next.collectibleProductId || null : null;
    d.lowestAvailableResaleItemInstanceId = next ? next.collectibleItemInstanceId || null : null;
  }

  function fixEcon(d, rest) {
    const c = d.CollectiblesItemDetails;
    if (!c) return;
    const next = rest[0] || null;
    c.CollectibleLowestResalePrice = next ? next.price : null;
    c.CollectibleLowestAvailableResaleProductId = next ? next.collectibleProductId || null : null;
    c.CollectibleLowestAvailableResaleItemInstanceId = next ? next.collectibleItemInstanceId || null : null;
  }

  function instanceId(rec) {
    if (rec.listing && rec.listing.instance) return rec.listing.instance;
    const tail = String(rec.at).padStart(12, '0').slice(-12);
    return `${String(rec.id).padStart(8, '0').slice(-8)}-0000-4000-8000-${tail}`;
  }

  function listingOf(cid, instance, product, seller, uaid) {
    const out = {};
    if (cid) out.cid = cid;
    if (instance) out.instance = String(instance).toLowerCase();
    if (product) out.product = String(product).toLowerCase();
    if (Number(seller) > 0) out.seller = Number(seller);
    if (Number(uaid) > 0) out.uaid = Number(uaid);
    const info = known.listings.get(out.instance || 'u' + out.uaid);
    if (info && info.serial != null) out.serial = info.serial;
    return out;
  }

  function decode(s) {
    const t = document.createElement('textarea');
    t.innerHTML = String(s || '');
    return t.value;
  }

  function creatorOf(id, name, type, verified) {
    return id || name ? { id: Number(id) || 0, name: String(name || ''), type: type === 'Group' ? 'Group' : 'User', verified: !!verified } : null;
  }

  function learnItem(d) {
    if (!d || !Number.isFinite(d.id)) return;
    const kind = String(d.itemType || '').toLowerCase() === 'bundle' ? 'bundle' : 'asset';
    const prev = known.item.get(kind + ':' + d.id) || {};
    const rec = Object.assign(prev, {
      kind,
      id: d.id,
      name: String(d.name || prev.name || ''),
      type: Number(d.assetType) || prev.type || 0,
      bundleType: Number(d.bundleType) || prev.bundleType || 0,
      creator: creatorOf(d.creatorTargetId, d.creatorName, d.creatorType, d.creatorHasVerifiedBadge) || prev.creator || null,
      limited: (Array.isArray(d.itemRestrictions) && d.itemRestrictions.some(r => /limited|collectible/i.test(String(r)))) || prev.limited || false,
    });
    known.item.set(kind + ':' + d.id, rec);
    if (d.collectibleItemId) known.item.set(String(d.collectibleItemId), rec);
    if (d.productId) known.product.set(String(d.productId), rec);
  }

  function learnMarket(list) {
    for (const d of Array.isArray(list) ? list : []) {
      if (!d || !d.collectibleItemId) continue;
      const kind = d.itemTargetType === 2 ? 'bundle' : 'asset';
      let rec = known.item.get(String(d.collectibleItemId)) || known.item.get(kind + ':' + d.itemTargetId);
      if (!rec && Number.isFinite(d.itemTargetId)) {
        rec = { kind, id: d.itemTargetId, name: String(d.name || ''), type: 0, bundleType: 0, creator: creatorOf(d.creatorId, d.creatorName, d.creatorType, d.creatorHasVerifiedBadge) };
        known.item.set(kind + ':' + d.itemTargetId, rec);
      }
      if (!rec) continue;
      known.item.set(String(d.collectibleItemId), rec);
      if (d.collectibleProductId) known.cproduct.set(String(d.collectibleProductId), rec);
      if (d.lowestAvailableResaleProductId) known.cproduct.set(String(d.lowestAvailableResaleProductId), rec);
    }
  }

  function learnEcon(d) {
    if (!d || !Number.isFinite(d.AssetId) || !d.AssetId) return;
    const c = d.Creator || {};
    const rec = known.item.get('asset:' + d.AssetId) || { kind: 'asset', id: d.AssetId, name: String(d.Name || ''), type: 0, bundleType: 0, creator: creatorOf(c.CreatorTargetId, c.Name, c.CreatorType, c.HasVerifiedBadge) };
    if (!rec.type) rec.type = Number(d.AssetTypeId) || 0;
    known.item.set('asset:' + d.AssetId, rec);
    if (d.ProductId) known.product.set(String(d.ProductId), rec);
    if (d.CollectibleItemId) known.item.set(String(d.CollectibleItemId), rec);
    if (d.CollectibleProductId) known.cproduct.set(String(d.CollectibleProductId), rec);
  }

  function learnPass(p) {
    if (!p || !Number.isFinite(p.id)) return null;
    const c = p.creator || {};
    const rec = Object.assign(known.pass.get(String(p.id)) || {}, {
      kind: 'pass',
      id: p.id,
      name: String(p.displayName || p.name || ''),
      icon: Number(p.displayIconImageAssetId) || 0,
      creator: creatorOf(c.creatorId, c.name, c.creatorType, false),
    });
    known.pass.set(String(p.id), rec);
    if (p.productId) known.pass.set('p' + p.productId, rec);
    return rec;
  }

  function passFromDom(productId) {
    const node = document.querySelector(`[data-product-id="${productId}"]`);
    if (!node) return null;
    const card = node.closest('.store-card, li');
    const link = card && card.querySelector('a[href*="/game-pass/"]');
    const page = node.closest('#item-container');
    const id = Number((link && (link.getAttribute('href').match(/\/game-pass\/(\d+)/) || [])[1]) || (page && page.dataset.deleteId) || 0);
    if (!id) return null;
    return known.pass.get(String(id)) || { kind: 'pass', id, name: node.dataset.itemName || pageName(), icon: Number(node.dataset.itemId) || 0, creator: creatorOf(0, node.dataset.sellerName, 'Group', false) };
  }

  function productFromDom(productId) {
    const node = document.querySelector(`[data-product-id="${productId}"], [data-developer-product-id="${productId}"]`);
    return node && node.dataset.itemName ? node.dataset.itemName : '';
  }

  function pageName() {
    const h1 = document.querySelector('#item-container h1, .item-details-name-row h1, .item-name-container h1');
    return ((h1 && h1.textContent) || document.title.replace(/\s*-\s*Roblox\s*$/, '')).trim();
  }

  function pageItem() {
    const m = location.pathname.match(/^\/(catalog|bundles|game-pass)\/(\d+)/i);
    if (!m) return null;
    const kind = { catalog: 'asset', bundles: 'bundle', 'game-pass': 'pass' }[m[1].toLowerCase()];
    return (kind === 'pass' ? known.pass.get(m[2]) : known.item.get(kind + ':' + m[2])) || { kind, id: Number(m[2]), name: pageName() };
  }

  function record(base, price) {
    const rec = { kind: base.kind, id: Number(base.id) || 0, name: String(base.name || '').slice(0, 200), price: robux(price), at: Date.now() };
    if (base.type) rec.type = base.type;
    if (base.bundleType) rec.bundleType = base.bundleType;
    if (base.icon) rec.icon = base.icon;
    if (base.limited) rec.limited = true;
    if (base.creator && (base.creator.id || base.creator.name)) rec.creator = base.creator;
    return rec;
  }

  function receipt(rec) {
    if (!rec.id && rec.kind !== 'other') rec.kind = 'other';
    const keep = rec.kind === 'product' || rec.kind === 'other' || !!rec.listing;
    cfg.items = cfg.items.filter(x => keep || !(x.kind === rec.kind && x.id === rec.id)).concat(rec);
    cfg.spent += rec.price;
    window.postMessage({ type: 'routility-fun-bought', item: rec }, ORIGIN);
    refreshNav();
  }

  const pause = () => 650 + Math.floor(Math.random() * 450);

  function sold(rec, assetType, display, wearable, productId) {
    const real = realOrNull();
    const after = real == null ? 0 : Math.max(0, shown(real) - rec.price);
    return {
      purchased: true,
      reason: 'Success',
      productId: Number(productId) || 0,
      statusCode: 200,
      title: 'Purchase Completed',
      errorMsg: '',
      showDivId: 'CompletePurchase',
      shortfallPrice: 0,
      balanceAfterSale: after,
      expectedPrice: rec.price,
      currency: 1,
      price: rec.price,
      assetId: rec.kind === 'asset' ? rec.id : 0,
      assetName: rec.name,
      assetType,
      assetTypeDisplayName: display,
      assetIsWearable: wearable,
      sellerName: rec.creator ? rec.creator.name : '',
      transactionVerb: 'bought',
      isMultiPrivateSale: false,
    };
  }

  const ASSET_NAMES = { 2: 'T-Shirt', 8: 'Hat', 11: 'Shirt', 12: 'Pants', 18: 'Face', 19: 'Gear', 41: 'Hair Accessory', 42: 'Face Accessory', 43: 'Neck Accessory', 44: 'Shoulder Accessory', 45: 'Front Accessory', 46: 'Back Accessory', 47: 'Waist Accessory' };
  const BUNDLE_TYPES = { 1: 'BodyParts', 2: 'AvatarAnimations', 3: 'Shoes', 4: 'DynamicHead', 5: 'DynamicHeadAvatar' };

  function sales(assetId, cid) {
    if (!cfg || !cfg.buy) return [];
    const id = Number(assetId) || 0;
    const c = cid ? String(cid).toLowerCase() : '';
    const hit = c && !id ? known.item.get(c) || known.item.get(String(cid)) : null;
    if (hit && hit.kind === 'asset' && hit.id) return sales(hit.id, c);
    return cfg.items
      .filter(x => x.kind === 'asset' && x.price > 0 && ((c && (x.cid === c || (x.listing && x.listing.cid === c))) || (id && x.id === id)))
      .sort((a, b) => a.at - b.at);
  }

  function dayOf(ms) {
    return new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
  }

  function addSales(d, list, rapKey) {
    if (!d || typeof d !== 'object' || !list.length) return false;
    const prices = Array.isArray(d.priceDataPoints) ? d.priceDataPoints : (d.priceDataPoints = []);
    const volumes = Array.isArray(d.volumeDataPoints) ? d.volumeDataPoints : (d.volumeDataPoints = []);
    const at = (arr, day) => arr.find(x => x && String(x.date).slice(0, 10) === day.slice(0, 10));
    const put = (arr, point) => {
      const i = arr.findIndex(x => x && Date.parse(x.date) < Date.parse(point.date));
      if (i < 0) arr.push(point);
      else arr.splice(i, 0, point);
    };
    let rap = Number(d[rapKey]) || 0;
    for (const rec of list) {
      const day = dayOf(rec.at);
      const v = at(volumes, day);
      const p = at(prices, day);
      const n = v ? Number(v.value) || 0 : 0;
      if (p) p.value = Math.round(((Number(p.value) || 0) * n + rec.price) / (n + 1));
      else put(prices, { value: rec.price, date: day });
      if (v) v.value = n + 1;
      else put(volumes, { value: 1, date: day });
      rap = rap ? Math.round(rap + (rec.price - rap) / 10) : rec.price;
    }
    d[rapKey] = rap;
    if (Number.isFinite(d.sales)) d.sales += list.length;
    return true;
  }

  function sorted(list) {
    return list.slice().sort((a, b) => b.at - a.at);
  }

  function first(url, key) {
    try { return !new URL(url).searchParams.get(key); } catch { return false; }
  }

  function descending(url) {
    try { return String(new URL(url).searchParams.get('sortOrder') || 'Desc').toLowerCase() !== 'asc'; } catch { return true; }
  }

  const ROUTES = [
    ['GET', /^https:\/\/friends\.roblox\.com\/v1\/(?:user\/friend-requests|my\/new-friend-requests)\/count(?:[?#]|$)/, () => {
      if (!cfg.requests) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || typeof d.count !== 'number') return t;
        d.count += cfg.requests;
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/economy\.roblox\.com\/v1\/users\/(\d+)\/currency(?:[?#]|$)/, (m) => {
      if (Number(m[1]) !== me() || !(cfg.robux || cfg.buy)) return null;
      if (picked()) return { fake: { now: true, body: { robux: shown(0) } } };
      return {
        edit: (t) => {
          const d = parse(t);
          if (!d || typeof d.robux !== 'number') return t;
          rememberBalance(d.robux);
          d.robux = shown(d.robux);
          return JSON.stringify(d);
        },
        rescue: () => (lastReal == null ? null : JSON.stringify({ robux: shown(lastReal) })),
      };
    }],
    ['GET', /^https:\/\/inventory\.roblox\.com\/v1\/users\/(\d+)\/items\/(asset|bundle|gamepass)\/(\d+)\/is-owned/i, (m) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      const kind = { asset: 'asset', bundle: 'bundle', gamepass: 'pass' }[m[2].toLowerCase()];
      if (!owned(kind, m[3])) return null;
      return { edit: (t) => (t.trim() === 'false' ? 'true' : t) };
    }],
    ['GET', /^https:\/\/catalog\.roblox\.com\/v1\/catalog\/items\/(\d+)\/details\?/i, (m, req) => {
      if (!cfg.buy) return null;
      const key = /itemtype=bundle/i.test(req.url) ? null : resaleKey(m[1], null);
      const hit = key && listings(key);
      return { wait: hit && hit.wait, edit: (t) => {
        const d = parse(t);
        if (!d || typeof d !== 'object' || !Number.isFinite(d.id)) return t;
        learnItem(d);
        const kind = String(d.itemType || '').toLowerCase() === 'bundle' ? 'bundle' : 'asset';
        let changed = false;
        if (owned(kind, d.id) && d.owned !== true) {
          d.owned = true;
          if (!(known.item.get(kind + ':' + d.id) || {}).limited) d.isPurchasable = false;
          changed = true;
        }
        if (kind === 'asset' && hit && hit.list) {
          const b = bought(d.id, d.collectibleItemId);
          if (b.recs.length) {
            fixCatalog(d, remaining(hit.list, b));
            changed = true;
          }
        }
        return changed ? JSON.stringify(d) : t;
      } };
    }],
    ['POST', /^https:\/\/catalog\.roblox\.com\/v1\/catalog\/items\/details(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const hits = new Map();
      for (const it of Array.isArray(b.items) ? b.items : []) {
        if (String(it && it.itemType).toLowerCase() !== 'asset') continue;
        const key = resaleKey(it.id, null);
        if (key) hits.set(Number(it.id), listings(key));
      }
      return { wait: hits.size ? Promise.all([...hits.values()].map(h => h.wait)) : null, edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        let changed = false;
        for (const x of d.data) {
          learnItem(x);
          const h = hits.get(Number(x.id));
          if (!h || !h.list || String(x.itemType).toLowerCase() !== 'asset') continue;
          fixCatalog(x, remaining(h.list, bought(x.id, x.collectibleItemId)));
          changed = true;
        }
        const have = new Set(d.data.map(x => Number(x.id)));
        for (const it of Array.isArray(b.items) ? b.items : []) {
          const rec = String(it && it.itemType).toLowerCase() === 'asset' && !have.has(Number(it.id)) && owned('asset', it.id);
          if (!rec) continue;
          have.add(rec.id);
          const c = rec.creator || { id: 1, name: 'Roblox', type: 'User', verified: true };
          d.data.push({ id: rec.id, itemType: 'Asset', assetType: rec.type || 0, name: rec.name, description: '', itemStatus: [], itemRestrictions: rec.limited ? ['Collectible'] : [], creatorHasVerifiedBadge: !!c.verified, creatorType: c.type, creatorTargetId: c.id, creatorName: c.name, price: rec.price, lowestPrice: rec.price, priceStatus: 'Off Sale', isOffSale: true, favoriteCount: 0, offSaleDeadline: null });
          changed = true;
        }
        return changed ? JSON.stringify(d) : t;
      } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/marketplace-items\/v1\/items\/details(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const hits = new Map();
      for (const id of Array.isArray(b.itemIds) ? b.itemIds : []) {
        const cid = String(id).toLowerCase();
        const key = resaleKey(null, cid);
        if (key) hits.set(cid, listings(key));
      }
      return { wait: hits.size ? Promise.all([...hits.values()].map(h => h.wait)) : null, edit: (t) => {
        const list = parse(t);
        learnMarket(list);
        if (!Array.isArray(list)) return t;
        let changed = false;
        for (const d of list) {
          const extra = d && Number.isFinite(d.sales) ? sales(d.itemTargetId, d.collectibleItemId).length : 0;
          if (extra) {
            d.sales += extra;
            changed = true;
          }
          const h = d && hits.get(String(d.collectibleItemId).toLowerCase());
          if (!h || !h.list) continue;
          fixMarket(d, remaining(h.list, bought(d.itemTargetId, String(d.collectibleItemId).toLowerCase())));
          changed = true;
        }
        return changed ? JSON.stringify(list) : t;
      } };
    }],
    ['GET', /^https:\/\/economy\.roblox\.com\/v2\/assets\/(\d+)\/details/, (m) => {
      if (!cfg.buy) return null;
      const key = resaleKey(m[1], null);
      const hit = key && listings(key);
      return { wait: hit && hit.wait, edit: (t) => {
        const d = parse(t);
        learnEcon(d);
        if (!hit || !hit.list || !d || !d.CollectiblesItemDetails) return t;
        fixEcon(d, remaining(hit.list, bought(m[1], d.CollectibleItemId ? String(d.CollectibleItemId).toLowerCase() : null)));
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/marketplace-sales\/v1\/item\/([0-9a-f-]{36})\/resale-data(?:[?#]|$)/i, (m) => {
      const list = sales(0, m[1]);
      if (!list.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        return addSales(d, list, 'recentAveragePrice') ? JSON.stringify(d) : t;
      } };
    }],
    ['GET', /^https:\/\/economy\.roblox\.com\/v1\/assets\/(\d+)\/resale-data(?:[?#]|$)/i, (m) => {
      const list = sales(m[1], null);
      if (!list.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        return addSales(d, list, 'recentAveragePrice') ? JSON.stringify(d) : t;
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/marketplace-sales\/v1\/item\/([0-9a-f-]{36})\/resellers(?:[?#]|$)/i, (m) => {
      if (!cfg.buy) return null;
      const cid = m[1].toLowerCase();
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        learnListings(d.data);
        const b = bought(null, cid);
        if (!b.instances.size) return t;
        const keep = remaining(d.data, b);
        if (keep.length === d.data.length) return t;
        d.data = d.data.filter(l => keep.includes(l));
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/economy\.roblox\.com\/v1\/assets\/(\d+)\/resellers(?:[?#]|$)/, (m) => {
      if (!cfg.buy) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        learnListings(d.data);
        const b = bought(m[1], null);
        if (!b.uaids.size) return t;
        const keep = d.data.filter(l => !b.uaids.has(Number(l.userAssetId)));
        if (keep.length === d.data.length) return t;
        d.data = keep;
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/marketplace-sales\/v1\/item\/([0-9a-f-]{36})\/resellable-instances\?/i, (m, req) => {
      if (!cfg.buy) return null;
      let owner = 0;
      try { owner = Number(new URL(req.url).searchParams.get('ownerId')); } catch {}
      if (owner !== me()) return null;
      const cid = m[1].toLowerCase();
      const mine = cfg.items.filter(x => x.kind === 'asset' && (x.listing || x.limited) && (x.cid === cid || (x.listing && x.listing.cid === cid)));
      if (!mine.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.itemInstances)) return t;
        const have = new Set(d.itemInstances.map(i => String(i.collectibleInstanceId).toLowerCase()));
        let changed = false;
        for (const x of sorted(mine)) {
          const iid = instanceId(x);
          if (have.has(iid)) continue;
          d.itemInstances.push({ collectibleInstanceId: iid, collectibleItemId: cid, collectibleProductId: (x.listing && x.listing.product) || '', serialNumber: x.listing && x.listing.serial != null ? x.listing.serial : null, isHeld: false, saleState: 'OffSale', price: 0 });
          changed = true;
        }
        return changed ? JSON.stringify(d) : t;
      } };
    }],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v1\/avatar-inventory\?/i, (m, req) => {
      loadBundleParts();
      const fakes = fakeAccessories();
      if (!fakes.length) return null;
      let u;
      try { u = new URL(req.url); } catch { return null; }
      if (u.searchParams.get('pageToken')) return null;
      const subs = new Set();
      let filtered = false;
      for (const [k, v] of u.searchParams) {
        const n = k.match(/^itemCategories\[(\d+)\]\.ItemSubType$/i);
        if (!n) continue;
        filtered = true;
        if (/^(asset|1)$/i.test(u.searchParams.get(`itemCategories[${n[1]}].ItemType`) || '')) subs.add(Number(v));
      }
      const want = fakes.filter(x => !filtered || subs.has(x.type));
      if (!want.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.avatarInventoryItems)) return t;
        const have = new Set(d.avatarInventoryItems.map(i => Number(i.itemId)));
        const extra = want.filter(x => !have.has(x.id)).map(x => ({ itemId: x.id, itemCategory: { itemType: 1, itemSubType: x.type }, itemName: x.name, availabilityStatus: 'Available', acquisitionTime: new Date(x.at).toISOString() }));
        if (!extra.length) return t;
        d.avatarInventoryItems = extra.concat(d.avatarInventoryItems);
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v1\/avatar(?:[?#]|$)/, () => wornAvatar('v1')],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v2\/avatar\/avatar(?:[?#]|$)/, () => wornAvatar('v1')],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v4\/avatar(?:[?#]|$)/, () => wornAvatar('v4')],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v1\/users\/(\d+)\/avatar(?:[?#]|$)/, (m) => (Number(m[1]) === me() ? wornAvatar('v1') : null)],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v2\/avatar\/users\/(\d+)\/avatar(?:[?#]|$)/, (m) => (Number(m[1]) === me() ? wornAvatar('v1') : null)],
    ['POST', /^https:\/\/apis\.roblox\.com\/profile-platform-api\/v1\/profiles\/get(?:[?#]|$)/, (m, req, b) => {
      if (Number(b && b.profileId) !== me() || !anyWear()) return null;
      return { wait: wearReady(), edit: (t) => {
        const d = parse(t);
        const cw = d && d.components && d.components.CurrentlyWearing;
        if (!cw || !Array.isArray(cw.assets)) return t;
        const worn = wornFakes();
        if (!worn.length) return t;
        const taken = takenSlots(worn);
        const keep = cw.assets.filter(a => !(a && a.itemType === 'Asset' && taken.has(realAssets.get(Number(a.assetId)))));
        const have = new Set(keep.map(a => Number(a && a.assetId)));
        for (const x of worn) if (!have.has(x.id)) keep.unshift({ assetId: x.id, itemType: 'Asset' });
        cw.assets = keep;
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/avatar\.roblox\.com\/v1\/users\/(\d+)\/currently-wearing/, (m) => {
      if (Number(m[1]) !== me() || !anyWear()) return null;
      return { wait: wearReady(), edit: (t) => {
        const worn = wornFakes();
        const d = parse(t);
        if (!d || !Array.isArray(d.assetIds) || !worn.length) return t;
        const taken = takenSlots(worn);
        d.assetIds = d.assetIds.filter(id => !taken.has(realAssets.get(Number(id))));
        for (const x of worn) if (!d.assetIds.includes(x.id)) d.assetIds.push(x.id);
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/transaction-records\/v1\/users\/(\d+)\/transactions\?/i, (m, req) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      let u;
      try { u = new URL(req.url); } catch { return null; }
      if (u.searchParams.get('cursor')) return null;
      const type = String(u.searchParams.get('transactionType') || '');
      if (type && !/^purchase$/i.test(type)) return null;
      const paidOnly = /paid/i.test(String(u.searchParams.get('itemPricingType') || ''));
      const mine = cfg.items.filter(x => x.at && (!paidOnly || x.price > 0 || x.limited || x.listing));
      if (!mine.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        const oldest = d.nextPageCursor && d.data.length ? Date.parse(d.data[d.data.length - 1].created) || 0 : 0;
        const rows = mine.filter(x => x.at >= oldest).map(x => ({
          id: 0,
          idHash: 'rtfun' + x.at.toString(36) + x.id,
          transactionType: 'Purchase',
          created: new Date(x.at).toISOString(),
          isPending: false,
          agent: x.creator ? { id: x.creator.id || 0, type: x.creator.type || 'User', name: x.creator.name || '' } : { id: 1, type: 'User', name: 'Roblox' },
          details: { id: x.id, name: x.name, type: { asset: 'Asset', bundle: 'Bundle', pass: 'GamePass', product: 'DeveloperProduct' }[x.kind] || 'Asset' },
          currency: { amount: -x.price, type: 'Robux' },
          purchaseToken: null,
          transactionSubtype: null,
        }));
        if (!rows.length) return t;
        d.data = rows.concat(d.data).sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/(?:economy\.roblox\.com\/v2|apis\.roblox\.com\/transaction-records\/v1)\/users\/(\d+)\/transaction-totals\?/i, (m, req) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      let frame = 'Year';
      try { frame = new URL(req.url).searchParams.get('timeFrame') || 'Year'; } catch {}
      const span = { day: 1, week: 7, month: 30, year: 365 }[String(frame).toLowerCase()] || 365;
      const since = Date.now() - span * 86400000;
      const spent = cfg.items.filter(x => x.at >= since).reduce((s, x) => s + (x.price || 0), 0);
      if (!spent) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || typeof d.purchasesTotal !== 'number') return t;
        d.purchasesTotal -= spent;
        if (typeof d.outgoingRobuxTotal === 'number') d.outgoingRobuxTotal -= spent;
        return JSON.stringify(d);
      } };
    }],
    ['PATCH', /^https:\/\/avatar\.roblox\.com\/v4\/avatar(?:[?#]|$)/, (m, req, b) => stripWear(b, d => d.avatarDefinition && d.avatarDefinition.updateAvatarModel && d.avatarDefinition.updateAvatarModel.assets, d => !Array.isArray(d.updateTypes) || d.updateTypes.includes('UpdateAssets'))],
    ['POST', /^https:\/\/avatar\.roblox\.com\/v1\/avatar\/set-wearing-assets(?:[?#]|$)/, (m, req, b) => stripWear(b, d => d.assetIds, () => true)],
    ['POST', /^https:\/\/avatar\.roblox\.com\/v2\/avatar\/set-wearing-assets(?:[?#]|$)/, (m, req, b) => stripWear(b, d => d.assets, () => true)],
    ['POST', /^https:\/\/avatar\.roblox\.com\/v1\/outfits\/\d+\/wear(?:[?#]|$)/, () => {
      if (cfg.buy && cfg.worn.length) setWorn([]);
      return null;
    }],
    ['POST', /^https:\/\/thumbnails\.roblox\.com\/v1\/batch(?:[?#]|$)/, (m, req, b) => {
      if (!Array.isArray(b) || !wornFakes().length) return null;
      const mine = b.filter(e => e && /^(Avatar|AvatarHeadShot|AvatarBust)$/.test(e.type) && Number(e.targetId) === me());
      if (!mine.length) return null;
      const urls = new Map();
      const keyOf = (e) => (e.type === 'Avatar' ? 'body:' + renderSize(e.size) : 'head:' + (e.isCircular ? 'c' : 's'));
      const jobs = [...new Set(mine.map(keyOf))].map((k) => {
        const [kind, arg] = k.split(':');
        return (kind === 'body' ? wornRender(arg, '2dWebp') : fakeHeadshot(arg === 'c')).then(u => urls.set(k, u));
      });
      const wait = Promise.all(jobs);
      return { wait, edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        let changed = false;
        for (const x of d.data) {
          const e = mine.find(q => q.requestId === x.requestId);
          const url = e && urls.get(keyOf(e));
          if (!url) continue;
          x.imageUrl = url;
          x.state = 'Completed';
          x.errorCode = 0;
          x.errorMessage = '';
          changed = true;
        }
        return changed ? JSON.stringify(d) : t;
      } };
    }],
    ['GET', /^https:\/\/thumbnails\.roblox\.com\/v1\/users\/avatar-3d\?/i, (m, req) => {
      let uid = 0;
      try { uid = Number(new URL(req.url).searchParams.get('userId')); } catch {}
      if (uid !== me() || !wornFakes().length) return null;
      let url = null;
      const wait = wornRender('352x352', '3d').then(u => { url = u; });
      return { wait, edit: (t) => {
        const d = parse(t);
        if (!d || !url) return t;
        d.imageUrl = url;
        d.state = 'Completed';
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/thumbnails\.roblox\.com\/v1\/users\/avatar-(?:headshot|bust)\?/i, (m, req) => {
      let ids = [];
      let circular = false;
      try {
        const u = new URL(req.url);
        ids = String(u.searchParams.get('userIds') || '').split(',').map(Number);
        circular = String(u.searchParams.get('isCircular')).toLowerCase() === 'true';
      } catch {}
      if (!ids.includes(me()) || !wornFakes().length) return null;
      let url = null;
      const wait = fakeHeadshot(circular).then(u => { url = u; });
      return { wait, edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data) || !url) return t;
        for (const x of d.data) {
          if (Number(x.targetId) !== me()) continue;
          x.imageUrl = url;
          x.state = 'Completed';
        }
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/thumbnails\.roblox\.com\/v1\/users\/avatar\?/i, (m, req) => {
      let size = '352x352';
      let ids = [];
      try {
        const u = new URL(req.url);
        size = renderSize(u.searchParams.get('size'));
        ids = String(u.searchParams.get('userIds') || '').split(',').map(Number);
      } catch {}
      if (!ids.includes(me()) || !wornFakes().length) return null;
      let url = null;
      const wait = wornRender(size, '2dWebp').then(u => { url = u; });
      return { wait, edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data) || !url) return t;
        for (const x of d.data) {
          if (Number(x.targetId) !== me()) continue;
          x.imageUrl = url;
          x.state = 'Completed';
        }
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/game-passes\/v1\/universes\/\d+\/game-passes/, () => {
      if (!cfg.buy) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.gamePasses)) return t;
        let changed = false;
        for (const p of d.gamePasses) {
          const rec = learnPass(p);
          if (rec && owned('pass', rec.id) && p.isOwned !== true) {
            p.isOwned = true;
            changed = true;
          }
        }
        return changed ? JSON.stringify(d) : t;
      } };
    }],
    ['GET', /^https:\/\/www\.roblox\.com\/games\/getgamepassesinnerpartial/i, () => {
      if (!cfg.buy) return null;
      return { edit: (html) => html.replace(/<li class="list-item real-game-pass">[\s\S]*?<\/li>/g, (li) => {
        const id = (li.match(/href="\/game-pass\/(\d+)\//) || [])[1];
        if (!id) return li;
        const attr = (k) => decode((li.match(new RegExp(k + '="([^"]*)"')) || [])[1]);
        const product = attr('data-product-id');
        const rec = Object.assign(known.pass.get(id) || {}, { kind: 'pass', id: Number(id), name: attr('data-item-name') || (known.pass.get(id) || {}).name || '', icon: Number(attr('data-item-id')) || (known.pass.get(id) || {}).icon || 0 });
        if (!rec.creator && attr('data-seller-name')) rec.creator = creatorOf(0, attr('data-seller-name'), 'Group', false);
        known.pass.set(id, rec);
        if (product) known.pass.set('p' + product, rec);
        if (!owned('pass', id)) return li;
        return li.replace(/<button[^>]*\bPurchaseButton\b[\s\S]*?<\/button>/, '<h5>Owned</h5>');
      }) };
    }],
    ['GET', /^https:\/\/inventory\.roblox\.com\/v1\/users\/(\d+)\/categories(?:[?#]|$)/, (m) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      const types = new Set(cfg.items.filter(x => x.kind === 'asset').map(x => x.type));
      const add = [[17, 'Classic Heads', 'Head'], [18, 'Classic Faces', 'Face']].filter(([id]) => types.has(id));
      if (!add.length) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.categories)) return t;
        const listed = new Set(d.categories.flatMap(c => (c.items || []).filter(i => i.type === 'AssetType').map(i => Number(i.id))));
        const items = add.filter(([id]) => !listed.has(id)).map(([id, name, kind]) => ({ name, displayName: name, filter: null, id, type: 'AssetType', categoryType: kind }));
        if (!items.length) return t;
        const heads = d.categories.find(c => c.categoryType === 'DynamicHead');
        if (heads && Array.isArray(heads.items)) heads.items = heads.items.concat(items);
        else d.categories.push({ name: 'Heads', displayName: 'Heads', categoryType: 'DynamicHead', items });
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/inventory\.roblox\.com\/v2\/users\/(\d+)\/inventory\/(\d+)/, (m, req) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      const mine = cfg.items.filter(x => x.kind === 'asset' && x.type === Number(m[2]));
      if (!mine.length) return null;
      const desc = descending(req.url);
      if (desc && !first(req.url, 'cursor')) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data) || (!desc && d.nextPageCursor)) return t;
        const have = new Set(d.data.map(x => Number(x.assetId)));
        const copies = new Set(d.data.map(x => String(x.collectibleItemInstanceId || '').toLowerCase()).filter(Boolean));
        const owner = (d.data[0] && d.data[0].owner) || { userId: me(), username: userMeta('data-name'), buildersClubMembershipType: 'None' };
        const extra = sorted(mine.filter(x => (x.listing ? !copies.has(instanceId(x)) : !have.has(x.id)))).map(x => {
          const when = new Date(x.at).toISOString();
          const limited = !!(x.listing || x.limited);
          return { userAssetId: x.at, assetId: x.id, assetName: x.name, collectibleItemId: limited ? x.cid || (x.listing && x.listing.cid) || null : null, collectibleItemInstanceId: limited ? instanceId(x) : null, serialNumber: x.listing && x.listing.serial != null ? x.listing.serial : null, owner, created: when, updated: when };
        });
        if (CLASSIC_ONLY.has(Number(m[2]))) {
          d.data = desc ? extra : extra.reverse();
          d.nextPageCursor = null;
          d.previousPageCursor = null;
          return JSON.stringify(d);
        }
        if (!extra.length) return t;
        d.data = desc ? extra.concat(d.data) : d.data.concat(extra.reverse());
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/catalog\.roblox\.com\/v1\/users\/(\d+)\/bundles\/(\d+)/, (m, req) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      const type = Number(m[2]);
      const mine = cfg.items.filter(x => x.kind === 'bundle' && (x.bundleType || 1) === type);
      if (!mine.length || !first(req.url, 'cursor')) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        const have = new Set(d.data.map(x => Number(x.id)));
        const extra = sorted(mine.filter(x => !have.has(x.id))).map(x => ({
          id: x.id,
          name: x.name,
          bundleType: BUNDLE_TYPES[type] || 'BodyParts',
          creator: x.creator ? { id: x.creator.id, name: x.creator.name, type: x.creator.type, hasVerifiedBadge: !!x.creator.verified } : { id: 1, name: 'Roblox', type: 'User', hasVerifiedBadge: true },
        }));
        if (!extra.length) return t;
        d.data = extra.concat(d.data);
        return JSON.stringify(d);
      } };
    }],
    ['GET', /^https:\/\/apis\.roblox\.com\/game-passes\/v1\/users\/(\d+)\/game-passes/, (m, req) => {
      if (Number(m[1]) !== me() || !cfg.buy) return null;
      const mine = cfg.items.filter(x => x.kind === 'pass');
      if (!mine.length || !first(req.url, 'exclusiveStartId')) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.gamePasses)) return t;
        const have = new Set(d.gamePasses.map(x => Number(x.gamePassId)));
        const extra = sorted(mine.filter(x => !have.has(x.id))).map(x => ({
          gamePassId: x.id,
          iconAssetId: x.icon || 0,
          name: x.name,
          description: '',
          isForSale: true,
          price: x.price,
          creator: x.creator ? { creatorType: x.creator.type, creatorId: x.creator.id, name: x.creator.name } : null,
        }));
        if (!extra.length) return t;
        d.gamePasses = extra.concat(d.gamePasses);
        return JSON.stringify(d);
      } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/marketplace-sales\/v1\/item\/([0-9a-f-]{36})\/purchase-(item|resale)(?:[?#]|$)/i, (m, req, b) => {
      if (!cfg.buy) return null;
      const cid = String(b.collectibleItemId || m[1]).toLowerCase();
      const base = known.item.get(cid) || known.item.get(String(b.collectibleItemId || m[1])) || pageItem() || { kind: 'other', id: 0, name: pageName() };
      const rec = record(base, b.expectedPrice);
      if (rec.kind === 'asset' || rec.kind === 'bundle') rec.cid = cid;
      if (m[2].toLowerCase() === 'resale' && b.collectibleItemInstanceId) rec.listing = listingOf(cid, b.collectibleItemInstanceId, b.collectibleProductId, b.expectedSellerId, 0);
      return { fake: { done: () => receipt(rec), body: { purchaseResult: 'Purchase transaction success.', purchased: true, pending: false, errorMessage: null } } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/game-passes\/v1\/game-passes\/(\d+)\/purchase(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const base = known.pass.get('p' + m[1]) || passFromDom(m[1]) || known.pass.get(m[1]) || pageItem() || { kind: 'pass', id: Number(m[1]), name: pageName() };
      const rec = record(base, b.expectedPrice);
      return { fake: { done: () => receipt(rec), body: sold(rec, 'Game Pass', 'Pass', false, m[1]) } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/developer-products\/v1\/developer-products\/(\d+)\/purchase(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const rec = record({ kind: 'product', id: Number(m[1]), name: productFromDom(m[1]) || 'Developer Product' }, b.expectedPrice);
      return { fake: { done: () => receipt(rec), body: sold(rec, 'Product', 'Developer Product', false, m[1]) } };
    }],
    ['POST', /^https:\/\/economy\.roblox\.com\/v1\/purchases\/products\/(\d+)(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const base = known.product.get(m[1]) || known.pass.get('p' + m[1]) || passFromDom(m[1]) || pageItem() || { kind: 'other', id: 0, name: pageName() };
      const rec = record(base, b.expectedPrice);
      if (rec.kind === 'asset' && Number(b.userAssetId) > 0) rec.listing = listingOf(null, null, null, b.expectedSellerId, b.userAssetId);
      const kind = rec.kind === 'pass' ? ['Game Pass', 'Pass'] : rec.kind === 'bundle' ? ['Bundle', 'Bundle'] : [ASSET_NAMES[rec.type] || 'Asset', ASSET_NAMES[rec.type] || 'Item'];
      return { fake: { done: () => receipt(rec), body: sold(rec, kind[0], kind[1], rec.kind === 'asset', m[1]) } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/cloud\/v2\/avatar-marketplace-orders(?:[?#]|$)/, (m, req, b) => {
      if (!cfg.buy) return null;
      const group = (Array.isArray(b.fulfillmentGroups) && b.fulfillmentGroups[0]) || {};
      const lines = Array.isArray(group.lineItems) ? group.lineItems : [];
      const recs = lines.map((li) => {
        const base = (li.collectibleProductId && known.cproduct.get(String(li.collectibleProductId))) || (li.virtualEconomyProductId && known.product.get(String(li.virtualEconomyProductId))) || { kind: 'other', id: 0, name: 'Item' };
        return record(base, li.agreedPriceRobux);
      });
      return { fake: { extra: 300, done: () => recs.forEach(receipt), body: { fulfillmentGroups: [{ lineItems: lines.map(li => Object.assign({}, li, { status: 'SUCCEEDED' })) }] } } };
    }],
    ['POST', /^https:\/\/apis\.roblox\.com\/v1\/subscriptions\/purchase-with-robux\//, (m, req, b) => {
      if (!cfg.buy) return null;
      const rec = record({ kind: 'other', id: 0, name: pageName() }, b.priceInRobux);
      return { fake: { done: () => receipt(rec), body: { isSuccess: true } } };
    }],
  ];

  const tradeSorts = new Map();

  function askIso(type, payload) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    return new Promise((resolve) => {
      let tries = 0;
      let timer = 0;
      const finish = (v) => {
        window.removeEventListener('message', onReply);
        clearInterval(timer);
        resolve(v);
      };
      const onReply = (e) => {
        if (e.source !== window || !e.data || e.data.type !== type + '-done' || e.data.id !== id) return;
        finish(e.data);
      };
      const ask = () => {
        if (++tries > 40) return finish(null);
        window.postMessage(Object.assign({ type, id }, payload), ORIGIN);
      };
      window.addEventListener('message', onReply);
      timer = setInterval(ask, 500);
      ask();
    });
  }

  async function tradablePage(url) {
    for (let tries = 0; tries < 5; tries++) {
      let r = null;
      try { r = await oFetch.call(window, url, { credentials: 'include' }); } catch {}
      if (r && r.status === 429) {
        await new Promise(w => setTimeout(w, 1500 * (tries + 1)));
        continue;
      }
      if (!r || !r.ok) return null;
      try { return await r.json(); } catch { return null; }
    }
    return null;
  }

  const tradeLists = new Map();

  function tradableBase(url) {
    const u = new URL(url);
    u.searchParams.delete('search');
    u.searchParams.delete('cursor');
    return u.href;
  }

  function allTradable(url) {
    const key = tradableBase(url);
    const hit = tradeLists.get(key);
    if (hit && Date.now() - hit.at < 120000) return hit.job;
    const job = (async () => {
      const items = [];
      let cursor = '';
      let userId = null;
      for (let page = 0; page < 80; page++) {
        const u = new URL(key);
        if (cursor) u.searchParams.set('cursor', cursor);
        const d = await tradablePage(u.href);
        if (!d || !Array.isArray(d.items)) return null;
        userId = d.userId;
        items.push(...d.items);
        cursor = d.nextPageCursor || '';
        if (!cursor) break;
      }
      return cursor ? null : { userId, items };
    })().catch(() => null);
    tradeLists.set(key, { at: Date.now(), job });
    job.then((v) => { if (!v) tradeLists.delete(key); });
    return job;
  }

  function sortedTradable(url) {
    url = tradableBase(url);
    const hit = tradeSorts.get(url);
    if (hit && Date.now() - hit.at < 120000) return hit.job;
    const job = (async () => {
      const gate = await askIso('routility-trade-worth', { items: [] });
      if (!gate || !gate.on) return null;
      const all = await allTradable(url);
      if (!all) return null;
      const { userId, items } = all;
      const res = await askIso('routility-trade-worth', { items: items.map(it => ({ itemTarget: it.itemTarget, itemName: it.itemName, recentAveragePrice: it.recentAveragePrice })) });
      if (!res || !res.on || !Array.isArray(res.worth) || res.worth.length !== items.length) return null;
      const order = items.map((it, i) => ({ it, i, v: Number(res.worth[i]) || 0 }));
      order.sort((a, b) => b.v - a.v || a.i - b.i);
      return JSON.stringify({ userId, items: order.map(x => x.it), nextPageCursor: null, previousPageCursor: null });
    })().catch(() => null);
    tradeSorts.set(url, { at: Date.now(), job });
    job.then((text) => { if (!text) tradeSorts.delete(url); });
    return job;
  }

  async function searchTradable(url, q) {
    const gate = await askIso('routility-trade-match', { q: '', items: [] });
    if (!gate || !gate.on) return null;
    const sorted = await sortedTradable(url);
    const base = sorted ? JSON.parse(sorted) : await allTradable(url);
    if (!base || !Array.isArray(base.items)) return null;
    const res = await askIso('routility-trade-match', { q, items: base.items.map(it => ({ itemTarget: it.itemTarget, itemName: it.itemName })) });
    if (!res || !res.on || !Array.isArray(res.keep)) return null;
    const keep = new Set(res.keep);
    return JSON.stringify({ userId: base.userId, items: base.items.filter((it, i) => keep.has(i)), nextPageCursor: null, previousPageCursor: null });
  }

  ROUTES.push(['GET', /^https:\/\/trades\.roblox\.com\/v2\/users\/\d+\/tradableItems\?/i, (m, req) => {
    if (!/^\/(?:users\/\d+\/trade|trades\/\d+\/counter)\/?$/i.test(location.pathname)) return null;
    const sp = new URL(req.url).searchParams;
    if (sp.get('cursor')) return null;
    const box = { text: null };
    const q = (sp.get('search') || '').trim();
    const wait = (q ? searchTradable(req.url, q) : sortedTradable(req.url)).then((text) => { box.text = text; }, () => {});
    return { wait, edit: t => box.text || t };
  }]);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-trade-list' || typeof e.data.id !== 'string') return;
    const id = e.data.id;
    const userId = String(e.data.userId || '');
    if (!/^\d+$/.test(userId)) return;
    allTradable(`https://trades.roblox.com/v2/users/${userId}/tradableItems?sortBy=CreationTime&sortOrder=Desc&limit=50`).then((d) => {
      const items = d ? d.items.map(it => ({ itemTarget: it.itemTarget, itemName: it.itemName })) : null;
      window.postMessage({ type: 'routility-trade-list-done', id, items }, ORIGIN);
    });
  });

  const catalogPicked = new Map();
  const catalogKey = (href) => {
    const u = new URL(href);
    u.searchParams.delete('cursor');
    return u.href;
  };
  const squashName = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
  const stemWord = (w) => (w.length > 3 ? w.replace(/(?:['’]s|s)$/, '') : w);
  const catalogItemKey = (x) => (x.itemType === 'Bundle' ? 'b' : 'a') + x.id;

  async function catalogSearch(href) {
    let r = null;
    try { r = await oFetch.call(window, href, { credentials: 'include' }); } catch {}
    if (!r || !r.ok) return [];
    const d = await r.json().catch(() => null);
    return d && Array.isArray(d.data) ? d.data : [];
  }

  async function catalogTop(href, kw) {
    const gate = await askIso('routility-catalog', { q: kw });
    if (!gate || !gate.on) return null;
    const words = kw.split(/\s+/).map(w => squashName(stemWord(w.toLowerCase()))).filter(Boolean);
    const official = new URL(href);
    official.searchParams.set('creatorName', 'Roblox');
    official.searchParams.set('includeNotForSale', 'true');
    official.searchParams.set('limit', '30');
    const named = (Array.isArray(gate.hits) ? gate.hits : []).slice(0, 3).map(async (h) => {
      const u = new URL(href);
      u.searchParams.set('keyword', h.name);
      u.searchParams.set('includeNotForSale', 'true');
      u.searchParams.set('limit', '30');
      const list = await catalogSearch(u.href);
      return list.find(x => (h.bundleId ? x.itemType === 'Bundle' && String(x.id) === h.bundleId : x.itemType === 'Asset' && String(x.id) === h.id)) || null;
    });
    const [roblox, ...hits] = await Promise.all([catalogSearch(official.href), ...named]);
    const matches = roblox.filter(x => words.length && words.every(w => squashName(x.name).includes(w)));
    const target = squashName(stemWord(kw.toLowerCase()));
    const exact = (x) => squashName(stemWord(String(x.name).toLowerCase())) === target;
    const ordered = matches.filter(exact).concat(matches.filter(x => !exact(x))).slice(0, 10);
    const seen = new Set();
    return hits.filter(Boolean).concat(ordered).filter(x => !seen.has(catalogItemKey(x)) && seen.add(catalogItemKey(x)));
  }

  ROUTES.push(['GET', /^https:\/\/catalog\.roblox\.com\/v2\/search\/items\/details\?/i, (m, req) => {
    const u = new URL(req.url);
    const sp = u.searchParams;
    const kw = (sp.get('keyword') || '').trim();
    if (!kw || kw.length > 50 || [...sp.keys()].some(k => /^creator(name|targetid)$/i.test(k))) return null;
    const key = catalogKey(req.url);
    if (sp.get('cursor')) {
      const picked = catalogPicked.get(key);
      if (!picked || !picked.size) return null;
      return { edit: (t) => {
        const d = parse(t);
        if (!d || !Array.isArray(d.data)) return t;
        d.data = d.data.filter(x => !picked.has(catalogItemKey(x)));
        return JSON.stringify(d);
      } };
    }
    const box = { top: null };
    const wait = Promise.race([catalogTop(req.url, kw), new Promise(r => setTimeout(() => r(null), 4000))]).then((top) => { box.top = top; }, () => {});
    return { wait, edit: (t) => {
      const top = box.top;
      if (!top || !top.length) return t;
      const d = parse(t);
      if (!d || !Array.isArray(d.data)) return t;
      const picked = new Set(top.map(catalogItemKey));
      catalogPicked.set(key, picked);
      d.data = top.concat(d.data.filter(x => !picked.has(catalogItemKey(x))));
      return JSON.stringify(d);
    } };
  }]);

  ROUTES.push(['POST', /^https:\/\/apis\.roblox\.com\/product-experimentation-platform\/v1\/projects\/1\/values/i, (m, req, body) => {
    if (!document.documentElement.classList.contains('routility-old-nav')) return null;
    if (!body || !body.layers || !body.layers['Website.Navigation']) return null;
    return {
      edit: (text) => {
        try {
          const d = JSON.parse(text);
          const p = d && d.layers && d.layers['Website.Navigation'] && d.layers['Website.Navigation'].parameters;
          if (!p || p.IsNewLeftNavEnabled !== true) return text;
          p.IsNewLeftNavEnabled = false;
          return JSON.stringify(d);
        } catch {
          return text;
        }
      },
    };
  }]);

  const RIGID = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58]);
  const LAYERED = new Set([64, 65, 66, 67, 68, 69, 70, 71, 72]);
  let wornJob = null;
  let wornAt = 0;

  function wornNow() {
    if (!wornJob || Date.now() - wornAt > 60000) {
      wornAt = Date.now();
      wornJob = oFetch.call(window, 'https://avatar.roblox.com/v2/avatar/avatar', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => (d && Array.isArray(d.assets) ? d.assets : null))
        .catch(() => null);
      wornJob.then((v) => { if (!v) wornJob = null; });
    }
    return wornJob;
  }

  function keepWorn(def, worn, triedType) {
    const have = new Set(def.assets.map(a => Number(a && a.id)));
    const tried = def.assets.filter(a => !worn.some(w => Number(w.id) === Number(a.id)));
    const kept = worn.filter(w => have.has(Number(w.id)) && RIGID.has(Number(w.assetType && w.assetType.id)));
    let room = 10 - tried.length - kept.length;
    const limit = 1;
    const sameWorn = triedType ? worn.filter(w => Number(w.assetType && w.assetType.id) === triedType).length : 0;
    const stacked = triedType === 8 || sameWorn > limit;
    let same = 1 + kept.filter(w => Number(w.assetType && w.assetType.id) === triedType).length;
    const add = [];
    for (const w of worn) {
      const type = Number(w.assetType && w.assetType.id);
      if (have.has(Number(w.id)) || !(RIGID.has(type) || LAYERED.has(type))) continue;
      if (triedType && type === triedType && !stacked) {
        if (same >= limit) continue;
        same++;
      }
      if (RIGID.has(type)) {
        if (room <= 0) continue;
        room--;
      }
      add.push(w.meta ? { id: Number(w.id), meta: w.meta } : { id: Number(w.id) });
      have.add(Number(w.id));
    }
    return add;
  }

  ROUTES.push(['POST', /^https:\/\/avatar\.roblox\.com\/v1\/avatar\/render(?:[?#]|$)/i, (m, req, body) => {
    if (!/^\/catalog\/\d+/i.test(location.pathname)) return null;
    const def = body && body.avatarDefinition;
    const id = Number(body && body.thumbnailConfig && body.thumbnailConfig.thumbnailId);
    if (!def || !Array.isArray(def.assets) || !def.assets.some(a => a && Number(a.id) === id)) return null;
    const p = {};
    p.wait = Promise.all([askIso('routility-tryon-keep', {}), wornNow()]).then(([gate, worn]) => {
      if (!gate || !gate.on || !worn) return;
      const add = keepWorn(def, worn, Number(gate.itemType) || 0);
      if (!add.length) return;
      p.body = JSON.stringify(Object.assign({}, body, { avatarDefinition: Object.assign({}, def, { assets: def.assets.concat(add) }) }));
    });
    return p;
  }]);

  function pick(method, url) {
    for (const [m, re, fn] of ROUTES) {
      if (m !== method) continue;
      const hit = url.match(re);
      if (hit) return (req, raw) => fn(hit, req, (typeof raw === 'string' && parse(raw)) || {});
    }
    return null;
  }

  function plan(route, req, raw) {
    try { return route(req, raw); } catch { return null; }
  }

  const XHR = XMLHttpRequest.prototype;
  const xOpen = XHR.open;
  const xSend = XHR.send;
  const getText = Object.getOwnPropertyDescriptor(XHR, 'responseText').get;
  const getResponse = Object.getOwnPropertyDescriptor(XHR, 'response').get;
  const getState = Object.getOwnPropertyDescriptor(XHR, 'readyState').get;

  function define(xhr, key, get) {
    try { Object.defineProperty(xhr, key, { configurable: true, get }); } catch {}
  }

  function fakeXhr(xhr, req, fake) {
    const text = JSON.stringify(fake.body);
    setTimeout(() => {
      try { if (fake.done) fake.done(); } catch {}
      define(xhr, 'readyState', () => 4);
      define(xhr, 'status', () => 200);
      define(xhr, 'statusText', () => 'OK');
      define(xhr, 'responseURL', () => req.url);
      define(xhr, 'responseText', () => text);
      define(xhr, 'response', () => (xhr.responseType === 'json' ? parse(text) : text));
      xhr.getAllResponseHeaders = () => 'content-type: application/json; charset=utf-8\r\n';
      xhr.getResponseHeader = (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null);
      const size = { lengthComputable: true, loaded: text.length, total: text.length };
      xhr.dispatchEvent(new Event('readystatechange'));
      xhr.dispatchEvent(new ProgressEvent('load', size));
      xhr.dispatchEvent(new ProgressEvent('loadend', size));
    }, fake.now ? 0 : pause() + (fake.extra || 0));
  }

  function rescueXhr(xhr, rescue) {
    const getStatus = Object.getOwnPropertyDescriptor(XHR, 'status').get;
    let text;
    const failed = () => {
      if (getState.call(xhr) !== 4) return false;
      const s = getStatus.call(xhr);
      if (s >= 200 && s < 300) return false;
      if (text === undefined) text = rescue();
      return text != null;
    };
    define(xhr, 'status', () => (failed() ? 200 : getStatus.call(xhr)));
    define(xhr, 'statusText', () => (failed() ? 'OK' : Object.getOwnPropertyDescriptor(XHR, 'statusText').get.call(xhr)));
    const own = (key) => Object.getOwnPropertyDescriptor(xhr, key);
    const prevText = own('responseText');
    const prevResponse = own('response');
    define(xhr, 'responseText', () => (failed() ? text : prevText ? prevText.get.call(xhr) : getText.call(xhr)));
    define(xhr, 'response', () => (failed() ? (xhr.responseType === 'json' ? parse(text) : text) : prevResponse ? prevResponse.get.call(xhr) : getResponse.call(xhr)));
  }

  function editXhr(xhr, edit) {
    let done = null;
    const result = () => {
      if (done) return done;
      let raw = null;
      if (xhr.responseType === '' || xhr.responseType === 'text') raw = getText.call(xhr);
      else if (xhr.responseType === 'json') {
        const v = getResponse.call(xhr);
        raw = v == null ? null : JSON.stringify(v);
      }
      let out = raw;
      if (raw != null) {
        try { out = edit(raw); } catch { out = raw; }
      }
      done = { text: typeof out === 'string' ? out : raw };
      return done;
    };
    define(xhr, 'responseText', () => {
      if (getState.call(xhr) !== 4) return getText.call(xhr);
      const r = result();
      return r.text == null ? getText.call(xhr) : r.text;
    });
    define(xhr, 'response', () => {
      if (getState.call(xhr) !== 4) return getResponse.call(xhr);
      const r = result();
      if (r.text == null) return getResponse.call(xhr);
      return xhr.responseType === 'json' ? parse(r.text) : r.text;
    });
  }

  XHR.open = function (method, url) {
    try {
      this.__routilityFun = { method: String(method || 'GET').toUpperCase(), url: new URL(String(url), location.href).href };
    } catch {
      this.__routilityFun = null;
    }
    return xOpen.apply(this, arguments);
  };

  const LAUNCHED = /^https:\/\/metrics\.roblox\.com\/v1\/games\/report-event.*GameLaunchSuccessWeb/i;
  function launchSeen(url) {
    if (LAUNCHED.test(url)) window.postMessage({ type: 'routility-launch-success' }, ORIGIN);
  }

  XHR.send = function (body) {
    const req = this.__routilityFun;
    if (req) launchSeen(req.url);
    const route = req && pick(req.method, req.url);
    if (!route) return xSend.apply(this, arguments);
    const args = arguments;
    const go = () => {
      const p = plan(route, req, body);
      if (p && p.fake) return fakeXhr(this, req, p.fake);
      const fire = () => {
        if (p && p.edit) editXhr(this, p.edit);
        if (p && p.rescue) rescueXhr(this, p.rescue);
        return xSend.apply(this, p && typeof p.body === 'string' ? [p.body] : args);
      };
      if (p && p.wait) {
        p.wait.then(fire, fire);
        return undefined;
      }
      return fire();
    };
    if (cfg) return go();
    waiters.push(() => {
      try { go(); } catch {}
    });
  };

  const oFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = '';
    let method = 'GET';
    try {
      url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href).href;
      method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    } catch {}
    if (url) launchSeen(url);
    const route = url && pick(method, url);
    if (!route) return oFetch.apply(this, arguments);
    const self = this;
    const args = arguments;
    return new Promise(resolve => (cfg ? resolve() : waiters.push(resolve))).then(async () => {
      let body = init && init.body;
      if (body === undefined && input instanceof Request && method !== 'GET') {
        try { body = await input.clone().text(); } catch {}
      }
      const p = plan(route, { method, url }, body);
      if (p && p.fake) {
        if (!p.fake.now) await new Promise(r => setTimeout(r, pause() + (p.fake.extra || 0)));
        try { if (p.fake.done) p.fake.done(); } catch {}
        return new Response(JSON.stringify(p.fake.body), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
      }
      if (p && p.wait) await p.wait.catch(() => {});
      const saved = () => {
        const text = p && p.rescue ? p.rescue() : null;
        return text == null ? null : new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
      };
      let res;
      try {
        if (p && typeof p.body === 'string') {
          res = input instanceof Request ? await oFetch.call(self, new Request(input, Object.assign({}, init || {}, { body: p.body }))) : await oFetch.call(self, input, Object.assign({}, init || {}, { body: p.body }));
        } else {
          res = await oFetch.apply(self, args);
        }
      } catch (e) {
        const back = saved();
        if (back) return back;
        throw e;
      }
      if (!res.ok && p && p.rescue) return saved() || res;
      if (!p || !p.edit) return res;
      try {
        const text = await res.clone().text();
        const out = p.edit(text);
        if (typeof out !== 'string' || out === text) return res;
        return new Response(out, { status: res.status, statusText: res.statusText, headers: res.headers });
      } catch {
        return res;
      }
    });
  };
})();
