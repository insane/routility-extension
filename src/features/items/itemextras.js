(function () {
  'use strict';

  const { el, onFrame, formatNumber, verifiedBadge, json } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]';
  const DAY = 24 * 60 * 60 * 1000;
  const CACHE_MS = 15 * 60 * 1000;
  let st = null;

  function cached(key) {
    try {
      const v = JSON.parse(sessionStorage.getItem(key) || 'null');
      return v && Date.now() - v.at < CACHE_MS ? v.data : undefined;
    } catch {
      return undefined;
    }
  }

  function remember(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
  }

  function shortDate(iso) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '';
  }

  function ago(iso) {
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY));
    if (days < 1) return lt('today');
    if (days < 30) return ltn(days, '{n} day ago', '{n} days ago');
    if (days < 365) { const m = Math.max(1, Math.floor(days / 30.44)); return ltn(m, '{n} month ago', '{n} months ago'); }
    const y = Math.floor(days / 365.25);
    return ltn(y, '{n} year ago', '{n} years ago');
  }

  async function acquired(s) {
    const fake = window.RoUtilityFun && window.RoUtilityFun.owned('asset', s.itemId);
    if (fake) return { when: new Date(fake.at).toISOString(), copies: 1 };
    const key = `routilityAcquired:${s.me}:${s.itemId}`;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const owned = await json(`https://inventory.roblox.com/v1/users/${s.me}/items/Asset/${s.itemId}/is-owned`);
    if (owned !== true) {
      if (owned === false) remember(key, null);
      return null;
    }
    const details = await json(`https://economy.roblox.com/v2/assets/${s.itemId}/details`);
    const type = details && Number(details.AssetTypeId);
    if (!type) return null;
    const copies = [];
    let cursor = '';
    for (let i = 0; i < 30 && st === s; i++) {
      const page = await json(`https://inventory.roblox.com/v2/users/${s.me}/inventory/${type}?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!page) break;
      for (const x of page.data || []) {
        if (Number(x.assetId) !== s.itemId) continue;
        const tradable = !!(x.collectibleItemId || x.serialNumber);
        const when = tradable ? x.updated || x.created : x.created;
        if (when) copies.push(when);
      }
      cursor = page.nextPageCursor;
      if (copies.length || !cursor) break;
    }
    const result = copies.length ? { when: copies.sort()[0], copies: copies.length } : null;
    remember(key, result);
    return result;
  }

  const FACE_IMG = '.item-details-thumbnail-container .thumbnail-2d-container img';

  async function faceThumb(id) {
    const key = 'routilityFaceThumb:' + id;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const details = await json(`https://economy.roblox.com/v2/assets/${id}/details`);
    if (!details || Number(details.AssetTypeId) !== 18) { remember(key, null); return null; }
    const t = await json(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`);
    const url = t && t.data && t.data[0] && t.data[0].state === 'Completed' ? t.data[0].imageUrl : null;
    remember(key, url);
    return url;
  }

  const pendingFace = new Map();

  function applyFace(s, id) {
    faceThumb(id).then(url => { if (st !== s || !url) return; s.faceUrl = url; place(); });
  }

  function classicFace(bundleId, assetId) {
    pendingFace.set(String(bundleId), assetId);
    if (st && st.opts.bundle && st.opts.classicFace && String(st.itemId) === String(bundleId)) applyFace(st, assetId);
  }

  function placeFace(s) {
    if (!s.faceUrl) return;
    const img = document.querySelector(FACE_IMG);
    if (!img) return;
    if (img.src !== s.faceUrl) {
      if (!img.dataset.routilityOrig) img.dataset.routilityOrig = img.src;
      img.src = s.faceUrl;
      img.classList.add('routility-face-thumb');
    }
    if (s.faceImg !== img) {
      s.faceObs?.disconnect();
      s.faceImg = img;
      s.faceObs = new MutationObserver(() => { if (st === s && img.src !== s.faceUrl) placeFace(s); });
      s.faceObs.observe(img, { attributes: true, attributeFilter: ['src'] });
    }
  }

  const RIGID = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58]);

  async function measure(s) {
    const type = Number(document.querySelector('#item-container')?.dataset.assetTypeId) || 0;
    if (type && !RIGID.has(type)) return null;
    const key = 'routilitySize:' + s.itemId;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const [av] = await Promise.all([import(chrome.runtime.getURL('src/preview/avatar.js')), import(chrome.runtime.getURL('src/preview/mesh.js'))]);
    const file = await av.fetchAsset(String(s.itemId));
    if (!RIGID.has(Number(file.type))) { remember(key, null); return null; }
    const model = window.RoUtilityRbxm.parse(file.buffer);
    const handle = model.roots.flatMap(av.descendants).find(i => i.name === 'Handle' && /Part$/.test(i.className));
    if (!handle) return null;
    let size = null;
    if (handle.className === 'MeshPart') size = av.vec(handle, 'size', 'Size');
    else {
      const special = handle.children.find(c => c.className === 'SpecialMesh');
      const meshId = special && av.assetIdOf((av.prop(special, 'MeshId') || {}).value);
      if (!meshId) return null;
      const g = await av.loadMesh(meshId);
      const box = g.boundingBox;
      const scale = av.vec(special, 'Scale') || { x: 1, y: 1, z: 1 };
      size = { x: (box.max.x - box.min.x) * scale.x, y: (box.max.y - box.min.y) * scale.y, z: (box.max.z - box.min.z) * scale.z };
    }
    const result = size && [size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0) ? [size.x, size.y, size.z] : null;
    remember(key, result);
    return result;
  }

  function placeSize(s) {
    const size = s.size;
    if (!size) return;
    const details = document.querySelector('#item-details');
    if (!details || details.querySelector('.routility-size-row')) return;
    const rows = [...details.querySelectorAll(':scope > .item-info-row-container')];
    const after = details.querySelector('.routility-acquired-row') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Created') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Type');
    if (!after) return;
    const n = v => v.toFixed(1);
    const row = el('div', 'clearfix item-info-row-container routility-injected routility-size-row');
    row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow row-label', lt('Size')));
    const value = el('span', 'font-body text', lt('{x} × {y} × {z} studs', { x: n(size[0]), y: n(size[1]), z: n(size[2]) }));
    value.dataset.rtTip = lt('Width × height × depth of the accessory’s mesh, before your avatar’s scaling.');
    row.appendChild(value);
    window.RoUtilityUI.rowGate(() => {
      if (!details.isConnected || !after.isConnected || details.querySelector('.' + row.className.split(' ').pop())) return;
      after.after(row);
      if (!document.hidden) row.classList.add('routility-reveal');
    });
  }

  async function lastSale(id) {
    const key = 'routilityLastSale:' + id;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const d = await json(`https://economy.roblox.com/v2/assets/${id}/details`);
    if (!d) return null;
    const price = Number(d.PriceInRobux);
    const made = Date.parse(d.Created);
    const changed = Date.parse(d.Updated);
    const when = Number.isFinite(made) && Number.isFinite(changed) && changed >= made && changed - made <= 400 * 86400000 ? d.Updated : null;
    const result = !d.IsForSale && price > 0 ? { price, when } : null;
    remember(key, result);
    return result;
  }

  function placeLastSale(s) {
    const l = s.lastSale;
    if (!l) return;
    const details = document.querySelector('#item-details');
    if (!details || details.querySelector('.routility-lastsale-row')) return;
    const rows = [...details.querySelectorAll(':scope > .item-info-row-container')];
    const after = details.querySelector('.routility-size-row') || details.querySelector('.routility-acquired-row') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Updated') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Created') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Type');
    if (!after) return;
    const row = el('div', 'clearfix item-info-row-container routility-injected routility-lastsale-row');
    row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow row-label', lt('Last On Sale')));
    const value = el('span', 'font-body text routility-lastsale-value');
    if (l.when) value.appendChild(document.createTextNode(lt('{date} for ', { date: shortDate(l.when) })));
    value.appendChild(el('span', 'icon-robux-16x16 routility-lastsale-robux'));
    value.appendChild(el('span', 'text-robux', formatNumber(l.price)));
    value.dataset.rtTip = l.when ? lt('The last price Roblox sold it for, and when its listing last changed. Roblox doesn’t publish the exact day a sale ended.') : lt('The last price Roblox sold it for. Roblox doesn’t publish when its sale ended.');
    row.appendChild(value);
    window.RoUtilityUI.rowGate(() => {
      if (!details.isConnected || !after.isConnected || details.querySelector('.' + row.className.split(' ').pop())) return;
      after.after(row);
      if (!document.hidden) row.classList.add('routility-reveal');
    });
  }

  async function uploader(s) {
    const key = 'routilityUploader2:' + s.itemId;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const d = await json(`https://economy.roblox.com/v2/assets/${s.itemId}/details`);
    if (!d || !d.Creator) return null;
    const listed = d.Creator.CreatorType === 'User' ? Number(d.Creator.CreatorTargetId) : 0;
    const av = await import(chrome.runtime.getURL('src/preview/avatar.js'));
    const file = await av.fetchAsset(String(s.itemId));
    const text = new TextDecoder('latin1').decode(file.buffer);
    const ids = [...new Set([...text.matchAll(/(?:rbxassetid:\/\/|[?&]id=)(\d{5,})/g)].map(m => m[1]))].filter(id => id !== String(s.itemId)).slice(0, 6);
    let userId = 0;
    for (const id of ids) {
      if (st !== s) return null;
      const a = await json(`https://economy.roblox.com/v2/assets/${id}/details`);
      const c = a && a.Creator;
      if (c && c.CreatorType === 'User' && Number(c.CreatorTargetId) > 1 && Number(c.CreatorTargetId) !== listed) { userId = Number(c.CreatorTargetId); break; }
    }
    let result = null;
    if (userId) {
      const u = await json(`https://users.roblox.com/v1/users/${userId}`);
      if (u && u.name) result = { id: userId, name: u.name, displayName: u.displayName || u.name, verified: !!u.hasVerifiedBadge, creator: d.Creator.Name || '' };
    }
    remember(key, result);
    return result;
  }

  function placeUploader(s) {
    const u = s.uploader;
    if (!u) return;
    const details = document.querySelector('#item-details');
    if (!details || details.querySelector('.routility-uploader-row')) return;
    const rows = [...details.querySelectorAll(':scope > .item-info-row-container')];
    const after = rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Created') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Type');
    if (!after) return;
    const row = el('div', 'clearfix item-info-row-container routility-injected routility-uploader-row');
    const label = el('div', 'font-header-1 text-subheader text-label text-overflow row-label', lt('Uploaded By'));
    label.dataset.rtTip = lt('The account that uploaded this item’s mesh and textures. Roblox only lists {creator}.', { creator: u.creator });
    row.appendChild(label);
    const value = el('a', 'font-body text routility-uploader-value');
    value.href = `https://www.roblox.com/users/${u.id}/profile`;
    const name = el('span', 'routility-uploader-name', u.displayName);
    value.append(face(u.pic, false), name);
    if (u.verified) value.appendChild(verifiedBadge());
    value.appendChild(el('span', 'content-muted routility-uploader-user', '@' + u.name));
    row.appendChild(value);
    window.RoUtilityUI.rowGate(() => {
      if (!details.isConnected || !after.isConnected || details.querySelector('.routility-uploader-row')) return;
      after.after(row);
      if (!document.hidden) row.classList.add('routility-reveal');
    });
  }

  async function saleInfo(s) {
    const type = s.opts.bundle ? 'Bundle' : 'Asset';
    const key = `routilitySaleInfo2:${type}:${s.itemId}`;
    const hit = cached(key);
    if (hit !== undefined) return hit;
    const cat = await json(`https://catalog.roblox.com/v1/catalog/items/${s.itemId}/details?itemType=${type}`);
    if (!cat || !cat.collectibleItemId) { if (cat) remember(key, null); return null; }
    const wantResale = s.opts.resale && (cat.hasResellers || (cat.itemRestrictions || []).some(r => /^(Limited|LimitedUnique|Collectible)$/.test(r)));
    const [items, resale] = await Promise.all([
      s.opts.saleInfo ? robloxPost('https://apis.roblox.com/marketplace-items/v1/items/details', { itemIds: [cat.collectibleItemId] }) : null,
      wantResale ? json(`https://apis.roblox.com/marketplace-sales/v1/item/${cat.collectibleItemId}/get-resale-parameters`) : null
    ]);
    const m = Array.isArray(items) ? items[0] || {} : {};
    const universeIds = (m.universeIds || []).filter(Boolean).slice(0, 3);
    let games = [];
    if (universeIds.length) {
      const g = await json(`https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`);
      games = ((g && g.data) || []).map(x => ({ name: x.name, placeId: x.rootPlaceId })).filter(x => x.name && x.placeId);
    }
    const deadline = Date.parse(m.offSaleDeadline || cat.offSaleDeadline || '');
    const onSale = !cat.isOffSale;
    const result = {
      games,
      left: onSale && Number(m.unitsAvailableForConsumption) > 0 ? Number(m.unitsAvailableForConsumption) : 0,
      total: Number(cat.totalQuantity) || Number(m.assetStock) || 0,
      limit: onSale && Number(m.unitsAvailableForConsumption) > 0 && Number(m.quantityLimitPerUser) > 0 ? Number(m.quantityLimitPerUser) : 0,
      ends: onSale && deadline > Date.now() ? new Date(deadline).toISOString() : null,
      restocks: Number(m.totalRestockedQuantity) > 0 ? { n: Number(m.totalRestockedQuantity), when: m.lastRestockedTime || null } : null,
      fee: resale && Number(resale.resalePercentageFee) > 0 ? { pct: Number(resale.resalePercentageFee), floor: Number(resale.priceFloor) || 0 } : null
    };
    remember(key, result);
    return result;
  }

  function untilText(iso) {
    const ms = Date.parse(iso) - Date.now();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return ltn(Math.max(1, Math.ceil(ms / 60000)), 'in {n} minute', 'in {n} minutes');
    if (h < 48) return ltn(h, 'in {n} hour', 'in {n} hours');
    return ltn(Math.floor(h / 24), 'in {n} day', 'in {n} days');
  }

  function saleRows(s) {
    const i = s.saleInfo;
    if (!i) return [];
    const rows = [];
    if (s.opts.saleInfo) {
      if (i.games.length) {
        const v = el('span', 'font-body text');
        i.games.forEach((g, n) => {
          if (n) v.appendChild(document.createTextNode(', '));
          const a = el('a', 'text-link', g.name);
          a.href = `https://www.roblox.com/games/${g.placeId}`;
          v.appendChild(a);
        });
        v.dataset.rtTip = lt('The game where its original copies are sold.');
        rows.push(['saleplace', lt('Sold In'), v]);
      }
      if (i.left) {
        const v = el('span', 'font-body text', i.total ? lt('{left} left of {total}', { left: formatNumber(i.left), total: formatNumber(i.total) }) : lt('{left} left', { left: formatNumber(i.left) }));
        rows.push(['stock', lt('Stock'), v]);
      }
      if (i.limit) rows.push(['limit', lt('Limit'), el('span', 'font-body text', ltn(i.limit, '{n} per person', '{n} per person'))]);
      if (i.ends) {
        const v = el('span', 'font-body text');
        v.append(document.createTextNode(shortDate(i.ends)), el('span', 'content-muted routility-acquired-ago', ', ' + untilText(i.ends)));
        v.dataset.rtTip = lt('When Roblox takes it off sale.');
        rows.push(['ends', lt('Sale Ends'), v]);
      }
      if (i.restocks) {
        const v = el('span', 'font-body text', ltn(i.restocks.n, '{n} time', '{n} times'));
        if (i.restocks.when) v.appendChild(el('span', 'content-muted routility-acquired-ago', ', ' + lt('last {date}', { date: shortDate(i.restocks.when) })));
        v.dataset.rtTip = lt('How many times the creator added more copies, and when they last did.');
        rows.push(['restock', lt('Restocks'), v]);
      }
    }
    if (s.opts.resale && i.fee) {
      const v = el('span', 'font-body text routility-lastsale-value');
      v.appendChild(el('span', null, lt('{pct}% fee', { pct: i.fee.pct }) + (i.fee.floor ? ',' : '')));
      if (i.fee.floor) v.append(el('span', 'content-muted', lt('lowest price')), el('span', 'icon-robux-16x16 routility-lastsale-robux'), el('span', 'text-robux', formatNumber(i.fee.floor)));
      const keep = i.fee.floor ? Math.max(0, i.fee.floor - Math.max(1, Math.round(i.fee.floor * i.fee.pct / 100))) : 0;
      v.dataset.rtTip = i.fee.floor
        ? lt('Roblox keeps {pct}% of every resale. The lowest price you can list it for is R$ {floor}, which pays you R$ {keep}.', { pct: i.fee.pct, floor: formatNumber(i.fee.floor), keep: formatNumber(keep) })
        : lt('Roblox keeps {pct}% of every resale.', { pct: i.fee.pct });
      rows.push(['fee', lt('Seller Fee'), v]);
    }
    return rows;
  }

  function placeSaleInfo(s) {
    const details = document.querySelector('#item-details');
    if (!details) return;
    const native = [...details.querySelectorAll(':scope > .item-info-row-container')];
    const label = t => native.find(r => r.querySelector('.row-label')?.textContent.trim() === t);
    const resellable = label('Resellable');
    const noResale = resellable && /^No$/i.test([...resellable.children].slice(1).map(c => c.textContent.trim()).join(''));
    const rows = saleRows(s).filter(r => !(noResale && r[0] === 'fee'));
    if (!rows.length) return;
    let after = details.querySelector('.routility-lastsale-row') || details.querySelector('.routility-size-row') || details.querySelector('.routility-acquired-row') || label('Updated') || label('Created') || label('Type');
    if (!after) return;
    for (const [cls, name, value] of rows) {
      const existing = details.querySelector('.routility-sale-' + cls);
      if (existing) { after = existing; continue; }
      const row = el('div', 'clearfix item-info-row-container routility-injected routility-sale-row routility-sale-' + cls);
      row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow row-label', name));
      row.appendChild(value);
      const prev = after;
      window.RoUtilityUI.rowGate(() => {
        if (!details.isConnected || !prev.isConnected || details.querySelector('.routility-sale-' + cls)) return;
        prev.after(row);
        if (!document.hidden) row.classList.add('routility-reveal');
      });
      after = row;
    }
  }

  function placeAcquired(s) {
    const a = s.acquired;
    if (!a) return;
    const details = document.querySelector('#item-details');
    if (!details || details.querySelector('.routility-acquired-row')) return;
    const rows = [...details.querySelectorAll(':scope > .item-info-row-container')];
    const after = rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Created') || rows.find(r => r.querySelector('.row-label')?.textContent.trim() === 'Type');
    if (!after) return;
    const row = el('div', 'clearfix item-info-row-container routility-injected routility-acquired-row');
    row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow row-label', lt('Acquired')));
    const value = el('span', 'font-body text');
    value.appendChild(document.createTextNode(shortDate(a.when)));
    value.appendChild(el('span', 'content-muted routility-acquired-ago', ', ' + ago(a.when) + (a.copies > 1 ? ', ' + ltn(a.copies, 'first of your {n} copy', 'first of your {n} copies') : '')));
    row.appendChild(value);
    window.RoUtilityUI.rowGate(() => {
      if (!details.isConnected || !after.isConnected || details.querySelector('.' + row.className.split(' ').pop())) return;
      after.after(row);
      if (!document.hidden) row.classList.add('routility-reveal');
    });
  }

  const OWN_KEY = 'routilityFriendsOwn2';
  const OWN_TTL = 30 * 60 * 1000;
  let csrf = '';

  function storageGet(key) {
    return new Promise(r => { try { chrome.storage.local.get(key, v => r(v[key] || {})); } catch { r({}); } });
  }

  function storageSet(key, value) {
    try { chrome.storage.local.set({ [key]: value }); } catch {}
  }

  async function robloxPost(url, body) {
    for (let tries = 0; tries < 4; tries++) {
      try {
        const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: JSON.stringify(body) });
        const token = res.status === 403 && res.headers.get('x-csrf-token');
        if (token) {
          csrf = token;
          continue;
        }
        if (res.status === 429 || res.status >= 500) {
          await new Promise(w => setTimeout(w, 1500 * (tries + 1)));
          continue;
        }
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function cachedOwners(s) {
    const all = await storageGet(OWN_KEY);
    const hit = all[s.ownKey];
    return hit && Date.now() - hit.at < OWN_TTL ? hit.owners : null;
  }

  async function scanOwners(s) {
    const ids = [];
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const res = await robloxPost('https://apis.roblox.com/social-proof-api/v1/social-proof/entity/connections', { entityType: s.opts.bundle ? 'Bundle' : 'Asset', entityId: s.itemId, connectionType: 'Friend', ...(cursor ? { cursor } : {}) });
      if (st !== s) return null;
      if (!res) return null;
      for (const c of res.connections || []) if (Number(c.id) > 0) ids.push(Number(c.id));
      if (!res.cursor || res.cursor === cursor) break;
      cursor = res.cursor;
    }
    const unique = [...new Set(ids)];
    const owners = [];
    for (let i = 0; i < unique.length; i += 100) {
      const named = await robloxPost('https://users.roblox.com/v1/users', { userIds: unique.slice(i, i + 100), excludeBannedUsers: false });
      if (st !== s) return null;
      const byId = new Map(((named && named.data) || []).map(u => [Number(u.id), u]));
      for (const id of unique.slice(i, i + 100)) {
        const u = byId.get(id);
        owners.push({ id, name: (u && u.name) || '', displayName: (u && (u.displayName || u.name)) || '', verified: !!(u && u.hasVerifiedBadge) });
      }
    }
    owners.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
    const all = await storageGet(OWN_KEY);
    all[s.ownKey] = { at: Date.now(), owners };
    const keys = Object.keys(all);
    if (keys.length > 300) keys.sort((x, y) => all[x].at - all[y].at).slice(0, keys.length - 300).forEach(k => delete all[k]);
    storageSet(OWN_KEY, all);
    return owners;
  }

  function face(src, big) {
    const f = el('span', 'routility-mutual-face' + (big ? ' routility-mutual-face-lg' : ''));
    if (!big) f.style.width = f.style.height = '18px';
    if (src) {
      const img = el('img');
      img.alt = '';
      img.src = src;
      f.appendChild(img);
    }
    return f;
  }

  function closePop() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.routility-friendsown-chip, .routility-mutual-pop')) document.activeElement.blur();
    document.querySelector('.routility-friendsown-pop')?.remove();
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', esc, true);
    if (st && st.untrack) { st.untrack(); st.untrack = null; }
  }

  function outside(e) { if (!e.target.closest?.('.routility-friendsown-pop, .routility-friendsown-chip')) closePop(); }
  function esc(e) { if (e.key === 'Escape') closePop(); }

  function openPop(s, anchor) {
    if (document.querySelector('.routility-friendsown-pop')) return closePop();
    const pop = el('div', 'routility-injected routility-mutual-pop routility-friendsown-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.appendChild(el('div', 'text-label content-default routility-mutual-pop-title', ltn(s.owners.length, '{count} friend owns this', '{count} friends own this', { count: formatNumber(s.owners.length) })));
    const list = el('ul', 'routility-mutual-list');
    for (const f of s.owners) {
      const li = el('li');
      const a = el('a', 'routility-mutual-row relative clip group/interactable');
      a.href = `/users/${f.id}/profile`;
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      const text = el('span', 'routility-mutual-text');
      const name = el('span', 'routility-mutual-name');
      name.appendChild(el('span', 'text-overflow', f.displayName || f.name));
      if (f.verified) name.appendChild(verifiedBadge());
      text.append(name, el('span', 'routility-mutual-user text-overflow', '@' + f.name));
      a.append(layer, face(s.pics[f.id], true), text);
      li.appendChild(a);
      list.appendChild(li);
    }
    pop.appendChild(list);
    document.body.appendChild(pop);
    window.RoUtilityUI.keyNav(pop, '.routility-mutual-row', true);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left))) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
    };
    place();
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', esc, true);
    s.untrack = window.RoUtilityUI.trackPopover(pop, anchor, place, closePop);
  }

  function chipShell() {
    const chip = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility routility-injected routility-friendsown-chip');
    chip.type = 'button';
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    chip.appendChild(layer);
    return chip;
  }

  function renderChip(s, chip) {
    while (chip.childNodes.length > 1) chip.lastChild.remove();
    chip.classList.toggle('routility-friendsown-busy', s.phase === 'busy');
    chip.disabled = s.phase === 'busy';
    if (s.phase === 'done' && s.owners && s.owners.length) {
      const stack = el('span', 'routility-mutual-stack');
      for (const f of s.owners.slice(0, 3)) stack.appendChild(face(s.pics[f.id]));
      chip.append(stack, el('span', 'padding-y-xsmall text-no-wrap', ltn(s.owners.length, '{count} Friend owns', '{count} Friends own', { count: formatNumber(s.owners.length) })));
      return;
    }
    if (s.phase === 'done') {
      chip.append(el('span', 'padding-y-xsmall text-no-wrap', lt('No friends own this')));
      return;
    }
    const stack = el('span', 'routility-mutual-stack routility-friendsown-sk');
    for (let i = 0; i < 3; i++) stack.appendChild(el('span', 'routility-friendsown-sk-face'));
    chip.append(stack, el('span', 'routility-friendsown-sk-text'));
  }

  async function finish(s, owners) {
    if (st !== s) return;
    if (owners && owners.length) {
      const pics = await window.RoUtilityUI.request({ type: 'getHeadshots', ids: owners.slice(0, 100).map(f => String(f.id)) }, r => r && typeof r === 'object');
      if (st !== s) return;
      s.pics = pics || {};
    }
    s.owners = owners || [];
    s.phase = 'done';
    s.ownersDone?.(s.owners);
    if (s.chip) renderChip(s, s.chip);
  }

  function startScan(s) {
    if (s.phase !== 'idle') return;
    s.phase = 'busy';
    if (s.chip) renderChip(s, s.chip);
    scanOwners(s).then(owners => finish(s, owners));
  }

  function placeChip(s) {
    if (!s.phase) return;
    const fav = document.querySelector('.favorites-button-container');
    const host = fav && fav.parentElement;
    if (!host || host.querySelector('.routility-friendsown-chip')) return;
    const chip = s.chip = chipShell();
    renderChip(s, chip);
    chip.addEventListener('click', () => {
      if (s.phase === 'done' && s.owners && s.owners.length) openPop(s, chip);
    });
    host.classList.add('routility-friendsown-host');
    const owners = host.querySelector('.routility-owners-chip');
    if (owners) owners.before(chip);
    else host.appendChild(chip);
    if (!document.hidden) chip.classList.add('routility-reveal');
  }

  const ROW_ORDER = ['uploader-row', 'acquired-row', 'size-row', 'lastsale-row', 'sale-saleplace', 'sale-stock', 'sale-limit', 'sale-ends', 'sale-restock', 'sale-fee'];

  function keepOrder() {
    const details = document.querySelector('#item-details');
    if (!details) return;
    const rows = ROW_ORDER.map(c => details.querySelector(':scope > .routility-' + c)).filter(Boolean);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].nextElementSibling !== rows[i]) rows[i - 1].after(rows[i]);
    }
  }

  function place() {
    const s = st;
    if (!s) return;
    if (s.opts.uploader) placeUploader(s);
    if (s.opts.acquired) placeAcquired(s);
    if (s.opts.size) placeSize(s);
    if (s.opts.lastSale) placeLastSale(s);
    if (s.opts.saleInfo || s.opts.resale) placeSaleInfo(s);
    keepOrder();
    if (s.opts.friends) placeChip(s);
    if (s.opts.classicFace) placeFace(s);
  }

  function setup(itemId, opts) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me) return;
    teardown();
    const s = st = { itemId: Number(itemId), me, opts, acquired: null, owners: null, pics: {} };
    s.ownersReady = new Promise((resolve) => { s.ownersDone = resolve; });
    s.observer = new MutationObserver(onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    if (opts.acquired) acquired(s).then(a => { if (st !== s) return; s.acquired = a; place(); });
    if (opts.lastSale && !opts.bundle) lastSale(s.itemId).then(l => { if (st !== s) return; s.lastSale = l; place(); });
    if (opts.saleInfo || opts.resale) saleInfo(s).catch(() => null).then(i => { if (st !== s) return; s.saleInfo = i; place(); });
    if (opts.uploader && !opts.bundle) uploader(s).catch(() => null).then(async u => {
      if (st !== s || !u) return;
      const pics = await window.RoUtilityUI.request({ type: 'getHeadshots', ids: [String(u.id)] }, r => r && typeof r === 'object');
      if (st !== s) return;
      s.uploader = Object.assign({}, u, { pic: (pics || {})[u.id] || '' });
      place();
    });
    const faceId = opts.bundle ? pendingFace.get(String(itemId)) : itemId;
    if (opts.classicFace && faceId) applyFace(s, faceId);
    if (opts.size) {
      const go = () => measure(s).catch(() => null).then(size => { if (st !== s) return; s.size = size; place(); });
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 });
      else setTimeout(go, 1500);
    }
    if (opts.friends) {
      s.ownKey = (opts.bundle ? 'b' : 'a') + s.itemId;
      cachedOwners(s).then(async owners => {
        if (st !== s) return;
        if (owners) await finish(s, owners);
        else s.phase = 'idle';
        place();
        startScan(s);
      });
    }
  }

  function teardown() {
    if (!st) return;
    closePop();
    st.observer.disconnect();
    st.faceObs?.disconnect();
    document.querySelectorAll('img.routility-face-thumb').forEach(img => {
      if (img.dataset.routilityOrig) img.src = img.dataset.routilityOrig;
      img.classList.remove('routility-face-thumb');
      delete img.dataset.routilityOrig;
    });
    st = null;
    document.querySelectorAll('.routility-acquired-row, .routility-size-row, .routility-lastsale-row, .routility-sale-row, .routility-uploader-row, .routility-friendsown-chip').forEach(n => n.remove());
    document.querySelectorAll('.routility-friendsown-host').forEach(n => n.classList.remove('routility-friendsown-host'));
  }

  function friendOwners(itemId) {
    const s = st;
    if (!s || !s.opts.friends || s.opts.bundle || s.itemId !== Number(itemId)) return Promise.resolve([]);
    return s.ownersReady;
  }

  window.RoUtilityItemExtras = { setup, teardown, classicFace, friendOwners };
})();
