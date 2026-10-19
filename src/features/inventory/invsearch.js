(function () {
  'use strict';

  const { el, onFrame, request, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const PAGE = 60;
  const BADGE = '21';
  const ALL = 'all';
  const ALL_TYPES = 'TShirt,Hat,Shirt,Pants,Head,Face,Gear,HairAccessory,FaceAccessory,NeckAccessory,ShoulderAccessory,FrontAccessory,BackAccessory,WaistAccessory,TShirtAccessory,ShirtAccessory,PantsAccessory,JacketAccessory,SweaterAccessory,ShortsAccessory,LeftShoeAccessory,RightShoeAccessory,DressSkirtAccessory,EyebrowAccessory,EyelashAccessory,MoodAnimation,DynamicHead,EmoteAnimation,ClimbAnimation,DeathAnimation,FallAnimation,IdleAnimation,JumpAnimation,RunAnimation,SwimAnimation,WalkAnimation,PoseAnimation,FaceMakeup,LipMakeup,EyeMakeup';
  const COLLECTIBLE = new Set(['8', '17', '18', '19', '41', '42', '43', '44', '45', '46', '47', '64', '65', '66', '67', '68', '69', '70', '71', '72', '76', '77']);
  const SORTS = {
    collectible: [['newest', LT('Newest')], ['oldest', LT('Oldest')], ['value', LT('Price')], ['rap', 'RAP'], ['name', LT('Name')]],
    badge: [['newest', LT('Latest Earned')], ['oldest', LT('Oldest Earned')], ['name', LT('Name')]],
    plain: [['newest', LT('Newest')], ['oldest', LT('Oldest')], ['name', LT('Name')]],
  };
  let state = null;
  let csrf = '';
  let acr = null;
  let acrJob = null;

  function acronyms() {
    if (!acrJob) acrJob = request({ type: 'itemAcronyms' }, r => r && typeof r === 'object').then(r => { acr = r || {}; if (!Object.keys(acr).length) acrJob = null; });
    return acrJob;
  }

  function initials(name) {
    return String(name || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean).map(w => w[0]).join('');
  }

  function shortMatch(q, i) {
    if (q.length < 2) return false;
    return (acr && acr[i.id] === q) || (q.length >= 3 && initials(i.name) === q);
  }

  const sortsFor = (type) => SORTS[!type ? 'plain' : type.id === BADGE ? 'badge' : type.id === ALL || COLLECTIBLE.has(type.id) ? 'collectible' : 'plain'];
  const active = (s) => (s.scope === ALL && s.type ? { id: ALL, label: lt('all items') } : s.type);

  async function categories(userId) {
    if (state.categories) return state.categories;
    try {
      const res = await fetch(`https://inventory.roblox.com/v1/users/${userId}/categories${state.fav ? '/favorites' : ''}`, { credentials: 'include' });
      state.categories = res.ok ? ((await res.json()).categories || []) : [];
    } catch {
      state.categories = [];
    }
    return state.categories;
  }

  function crumbs() {
    return [...document.querySelectorAll(':is(#inventory-container, #favorites-container) .assets-explorer-title .breadcrumb-container li span.ng-binding')].map(s => s.textContent.trim());
  }

  async function currentType() {
    const s = state;
    const [cat, sub] = crumbs();
    if (!cat) return null;
    const list = await categories(s.userId);
    const category = list.find(c => c.displayName === cat);
    if (!category) return null;
    const item = (category.items || []).find(i => i.displayName === (sub || cat)) || (category.items || [])[0];
    if (!item || item.type !== 'AssetType' || item.filter || String(item.id) === '34') return null;
    const name = (item.displayName || cat).toLowerCase();
    return { id: String(item.id), label: category.categoryType === 'Accessories' || cat === 'Accessories' ? lt('{name} accessories', { name }) : name };
  }

  async function loadBadges(order) {
    const s = state;
    const out = [];
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      let res = null;
      try {
        res = await fetch(`https://badges.roblox.com/v1/users/${s.userId}/badges?limit=100&sortOrder=${order}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'include' });
      } catch {}
      if (!res) return { failed: true };
      if (res.status === 403) return { private: true };
      if (!res.ok) return { failed: true };
      const data = await res.json();
      for (const b of data.data || []) out.push({ id: String(b.id), name: b.name || '', count: 1, serials: [], badge: true, creator: b.creator || null });
      if (state !== s) return { failed: true };
      s.loaded = out.length;
      render();
      cursor = data.nextPageCursor;
      if (!cursor) break;
    }
    return { list: out, complete: !cursor };
  }

  async function loadFavorites(typeId) {
    const s = state;
    const types = typeId === ALL ? [...new Set((await categories(s.userId)).flatMap(c => (c.items || []).filter(i => i.type === 'AssetType' && !i.filter && String(i.id) !== '34').map(i => String(i.id))))] : [typeId];
    const out = [];
    let complete = true;
    let missed = false;
    for (const t of types) {
      let cursor = '';
      for (let page = 0, tries = 0; page < 20; page++) {
        if (types.length > 1) await new Promise(w => setTimeout(w, 700));
        let res = null;
        try {
          res = await fetch(`https://catalog.roblox.com/v1/favorites/users/${s.userId}/favorites/${t}/assets?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'include' });
        } catch {}
        if ((!res || res.status === 429) && tries < 6) {
          tries++;
          page--;
          await new Promise(w => setTimeout(w, 2000 * tries));
          continue;
        }
        tries = 0;
        if (res && res.status === 403) return { private: true };
        if (!res || !res.ok) {
          if (types.length === 1) return { failed: true };
          missed = true;
          cursor = '';
          break;
        }
        const data = await res.json();
        for (const x of data.data || []) out.push({ id: String(x.id), name: x.name || '', count: 1, serials: [] });
        if (state !== s) return { failed: true };
        s.loaded = out.length;
        render();
        cursor = data.nextPageCursor;
        if (!cursor) break;
      }
      if (cursor) complete = false;
    }
    return { list: out, complete, missed };
  }

  async function loadAll(typeId, asc) {
    const s = state;
    const key = typeId + (asc ? ':asc' : '');
    const order = asc ? 'Asc' : 'Desc';
    if (s.items.has(key)) return s.items.get(key);
    const job = s.fav ? (asc ? loadAll(typeId, false).then(d => (d.list ? { ...d, list: d.list.slice().reverse() } : d)) : loadFavorites(typeId)) : typeId === BADGE ? loadBadges(order) : (async () => {
      const out = [];
      let cursor = '';
      const base = typeId === ALL ? `https://inventory.roblox.com/v2/users/${s.userId}/inventory?assetTypes=${ALL_TYPES}&` : `https://inventory.roblox.com/v2/users/${s.userId}/inventory/${typeId}?`;
      for (let page = 0, tries = 0; page < (typeId === ALL ? 50 : 20); page++) {
        let res = null;
        try {
          res = await fetch(`${base}limit=100&sortOrder=${order}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'include' });
        } catch {}
        if (res && res.status === 429 && tries < 4) {
          tries++;
          page--;
          await new Promise(w => setTimeout(w, 1500 * tries));
          continue;
        }
        tries = 0;
        if (!res) return { failed: true };
        if (res.status === 403) return { private: true };
        if (!res.ok) return { failed: true };
        const data = await res.json();
        out.push(...(data.data || []));
        if (state !== s) return { failed: true };
        window.RoUtilityOwned?.feed(s.userId, data.data || []);
        s.loaded = out.length;
        render();
        cursor = data.nextPageCursor;
        if (!cursor) break;
      }
      const byAsset = new Map();
      const fakes = window.RoUtilityFun && typeId !== ALL ? await window.RoUtilityFun.inventory(s.userId, typeId) : [];
      const real = new Set(out.map(a => Number(a.assetId)));
      const extra = fakes.filter(x => x.listing || !real.has(x.id)).map(x => ({ assetId: x.id, assetName: x.name, serialNumber: x.listing ? x.listing.serial : null }));
      for (const a of asc ? out.concat(extra.reverse()) : extra.concat(out)) {
        const key = String(a.assetId);
        const hit = byAsset.get(key);
        if (hit) {
          hit.count++;
          if (a.serialNumber) hit.serials.push(a.serialNumber);
        } else {
          byAsset.set(key, { id: key, name: a.assetName || a.name || '', count: 1, serials: a.serialNumber ? [a.serialNumber] : [] });
        }
      }
      return { list: [...byAsset.values()], complete: !cursor };
    })();
    s.items.set(key, job);
    const result = await job;
    if (result.failed) s.items.delete(key);
    return result;
  }

  function searchBox(placeholder) {
    const s = state;
    const box = el('div', 'routility-injected routility-inv-search');
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable focus-visible:outline-focus disabled:outline-none stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis');
    const layer = el('div', STATE_LAYER + ' pointer-events-none');
    layer.setAttribute('aria-hidden', 'true');
    const lead = el('div', 'flex shrink-0 items-center');
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-emphasis');
    glass.setAttribute('aria-hidden', 'true');
    lead.appendChild(glass);
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium routility-av-search-input');
    input.type = 'search';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.maxLength = 100;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = s.raw;
    const trail = el('div', 'flex shrink-0 items-center');
    const clear = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center padding-none stroke-none select-none size-600 radius-circle bg-action-link routility-av-search-clear');
    clear.type = 'button';
    clear.setAttribute('aria-label', lt('Clear'));
    const clearLayer = el('div', STATE_LAYER);
    clearLayer.setAttribute('aria-hidden', 'true');
    clear.append(clearLayer, el('span', 'icon icon-regular-x size-400 content-emphasis'));
    clear.hidden = !s.raw;
    trail.appendChild(clear);
    field.append(layer, lead, input, trail);
    box.appendChild(field);
    let timer = null;
    const set = (v) => {
      s.raw = v;
      clear.hidden = !v;
      clearTimeout(timer);
      timer = setTimeout(() => run(v.trim().toLowerCase()), 250);
    };
    input.addEventListener('input', () => set(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        set('');
      }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      set('');
      input.focus();
    });
    return box;
  }

  async function ensureBox() {
    const s = state;
    if (!s || s.ensuring) return;
    const header = document.querySelector(':is(#inventory-container, #favorites-container) assets-explorer .container-header');
    if (!header) return;
    const key = crumbs().join('/');
    const existing = header.parentElement.querySelector(':scope > .routility-inv-toolbar');
    if (existing && s.key === key) return;
    s.ensuring = true;
    try {
      const type = await currentType();
      if (state !== s) return;
      s.key = key;
      if (s.type?.id !== type?.id) {
        const was = active(s)?.id;
        s.type = type;
        s.shown = PAGE;
        if (!sortsFor(active(s)).some(x => x[0] === s.sort)) s.sort = 'newest';
        if (active(s)?.id !== was) run(s.query);
      }
      existing?.remove();
      if (!type) return;
      const bar = el('div', 'routility-injected routility-inv-toolbar');
      bar.appendChild(scopeSelect());
      bar.appendChild(searchBox(s.scope === ALL ? (s.fav ? lt('Search all favorites') : lt('Search all your items')) : lt('Search {type}', { type: type.label })));
      bar.appendChild(sortSelect());
      header.after(bar);
    } finally {
      s.ensuring = false;
    }
  }

  async function run(query) {
    const s = state;
    if (!s) return;
    s.query = query;
    s.shown = PAGE;
    if ((!query && s.sort === 'newest') || !s.type) {
      s.result = null;
      render();
      return;
    }
    s.result = { loading: true };
    s.loaded = 0;
    render();
    const typeId = active(s).id;
    const asc = s.sort === 'oldest';
    const desc = asc && s.items.has(typeId) ? await s.items.get(typeId) : null;
    const data = desc && desc.complete ? { ...desc, list: desc.list.slice().reverse() } : await loadAll(typeId, asc);
    if (query) await acronyms();
    if (state !== s || s.query !== query || active(s)?.id !== typeId || (!query && s.sort === 'newest') || (s.sort === 'oldest') !== asc) return;
    s.result = data;
    render();
  }

  async function catalogDetails(ids) {
    for (let tries = 0; tries < 4; tries++) {
      try {
        const res = await fetch('https://catalog.roblox.com/v1/catalog/items/details', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
          body: JSON.stringify({ items: ids.map(id => ({ itemType: 'Asset', id: Number(id) })) }),
        });
        const token = res.status === 403 && res.headers.get('x-csrf-token');
        if (token) {
          csrf = token;
          continue;
        }
        if (res.status === 429 || res.status >= 500) {
          await new Promise(r => setTimeout(r, 1200 * (tries + 1)));
          continue;
        }
        return res.ok ? ((await res.json()).data || []) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function creatorLabel(label, creator) {
    label.textContent = '';
    if (!creator || !creator.name) {
      label.textContent = '\u00a0';
      return;
    }
    const link = el('a', 'creator-name text-overflow text-link', creator.name);
    link.href = creator.type === 'Group' ? `https://www.roblox.com/groups/${creator.id}` : `https://www.roblox.com/users/${creator.id}/profile`;
    label.append(el('span', null, lt('By')), ' ', link);
  }

  function priceRow(row, d) {
    row.textContent = '';
    const low = Number(d.lowestPrice);
    const shown = low > 0 ? low : !d.priceStatus && Number(d.price) > 0 ? Number(d.price) : null;
    if (shown !== null) {
      row.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', formatNumber(shown)));
      return;
    }
    const status = d.priceStatus || (Number(d.price) === 0 ? lt('Free') : lt('Off Sale'));
    const wrap = el('span', 'text-label');
    wrap.appendChild(el('span', 'text-overflow font-caption-body' + (/^free$/i.test(status) ? ' text-robux-tile' : ''), status));
    row.appendChild(wrap);
  }

  function applyMeta(li, d) {
    if (!d) return;
    const label = li.querySelector('.routility-inv-creator');
    if (label && label.dataset.filled !== '1') {
      creatorLabel(label, { id: d.creatorTargetId, name: d.creatorName, type: d.creatorType });
      label.dataset.filled = '1';
    }
    const row = li.querySelector('.routility-inv-price');
    if (row && row.dataset.filled !== '1') {
      priceRow(row, d);
      row.dataset.filled = '1';
    }
    const thumb = li.querySelector('.item-card-thumb-container');
    const r = d.itemRestrictions || [];
    const tag = r.includes('LimitedUnique') ? 'limited-unique' : r.includes('Limited') || r.includes('Collectible') ? 'limited' : '';
    if (thumb && tag && !thumb.querySelector('.routility-inv-limited')) thumb.appendChild(el('span', `icon-${tag}-label routility-inv-limited`));
  }

  async function fillMeta(grid) {
    const s = state;
    const cards = [...grid.querySelectorAll('li.routility-inv-card[data-asset]')];
    const want = [...new Set(cards.map(li => li.dataset.asset))].filter(id => !s.meta.has(id));
    for (let i = 0; i < want.length; i += 100) {
      const chunk = want.slice(i, i + 100);
      chunk.forEach(id => s.meta.set(id, null));
      const data = await catalogDetails(chunk);
      if (state !== s) return;
      if (!data) {
        chunk.forEach(id => s.meta.delete(id));
        continue;
      }
      for (const d of data) s.meta.set(String(d.id), d);
      for (const li of document.querySelectorAll('.routility-inv-grid li.routility-inv-card[data-asset]')) if (chunk.includes(li.dataset.asset)) applyMeta(li, s.meta.get(li.dataset.asset));
    }
  }

  function card(item) {
    const li = el('li', 'list-item item-card routility-injected routility-inv-card');
    if (!item.badge) li.dataset.asset = item.id;
    const box = el('div', 'item-card-container');
    const a = el('a', 'item-card-link');
    a.href = item.badge ? `https://www.roblox.com/badges/${item.id}/` : `https://www.roblox.com/catalog/${item.id}`;
    const thumbBox = el('div', 'item-card-thumb-container');
    const span = el('span', 'thumbnail-2d-container item-card-thumb');
    const img = el('img', 'routility-fade');
    img.alt = '';
    img.dataset.assetId = (item.badge ? 'b' : '') + item.id;
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    const cached = state.thumbs.get(item.id);
    if (cached) img.src = cached;
    span.appendChild(img);
    thumbBox.appendChild(span);
    if (item.serials.length === 1 && item.count === 1) thumbBox.appendChild(el('span', 'routility-inv-serial', '#' + formatNumber(item.serials[0])));
    const name = el('div', 'item-card-name');
    name.title = item.name;
    name.appendChild(el('span', null, item.count > 1 ? `${item.name} ×${formatNumber(item.count)}` : item.name));
    a.append(thumbBox, name);
    const label = el('div', 'text-overflow item-card-label routility-inv-creator');
    const row = el('div', 'text-overflow item-card-price routility-inv-price');
    if (item.badge) {
      creatorLabel(label, item.creator && { id: item.creator.id, name: item.creator.type === 'User' ? '@' + item.creator.name : item.creator.name, type: item.creator.type });
      label.dataset.filled = '1';
      row.dataset.filled = '1';
    } else {
      label.textContent = '\u00a0';
    }
    box.append(a, label, row);
    li.appendChild(box);
    return li;
  }

  async function badgeThumbs(ids) {
    const map = {};
    try {
      const res = await fetch(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${ids.join(',')}&size=150x150&format=Webp&isCircular=false`, { credentials: 'include' });
      const data = res.ok ? await res.json() : null;
      for (const t of (data && data.data) || []) if (t.state === 'Completed' && t.imageUrl) map[String(t.targetId)] = t.imageUrl;
    } catch {}
    return map;
  }

  async function fillThumbs(grid) {
    const s = state;
    const missing = [...grid.querySelectorAll('img[data-asset-id]:not([src])')].map(i => i.dataset.assetId).filter(id => !s.thumbs.has(id)).slice(0, 100);
    if (missing.length) {
      missing.forEach(id => s.thumbs.set(id, ''));
      const assets = missing.filter(id => id[0] !== 'b');
      const badges = missing.filter(id => id[0] === 'b').map(id => id.slice(1));
      const [map, bmap] = await Promise.all([
        assets.length ? request({ type: 'getAssetThumbs', ids: assets, size: '420x420' }) : null,
        badges.length ? badgeThumbs(badges) : null,
      ]);
      for (const id of assets) s.thumbs.set(id, (map || {})[id] || '');
      for (const id of badges) s.thumbs.set('b' + id, (bmap || {})[id] || '');
    }
    if (state !== s) return;
    for (const img of document.querySelectorAll('.routility-inv-grid img[data-asset-id]:not([src])')) {
      const src = s.thumbs.get(img.dataset.assetId);
      if (src) img.src = src;
    }
  }

  let menu = null;

  function closeMenu() {
    if (!menu) return;
    menu.pop.remove();
    document.removeEventListener('mousedown', menu.outside, true);
    menu = null;
  }

  function sortSelect() {
    const s = state;
    const options = sortsFor(active(s));
    if (!options.some(x => x[0] === s.sort)) s.sort = 'newest';
    return menuButton(lt('Sort'), options, () => s.sort, (key) => {
      s.sort = key;
      run(s.query);
    });
  }

  function scopeSelect() {
    const s = state;
    const title = window.RoUtilityI18n.lang() === 'en' ? s.type.label.replace(/(^|\s)(\S)/g, (m, a, c) => a + c.toUpperCase()) : s.type.label.charAt(0).toUpperCase() + s.type.label.slice(1);
    return menuButton(lt('In'), [['type', title], [ALL, s.fav ? LT('All Favorites') : LT('All Items')]], () => (s.scope === ALL ? ALL : 'type'), (key) => {
      if ((s.scope === ALL) === (key === ALL)) return;
      s.scope = key === ALL ? ALL : 'type';
      if (!sortsFor(active(s)).some(x => x[0] === s.sort)) s.sort = 'newest';
      s.key = '';
      document.querySelector(':is(#inventory-container, #favorites-container) assets-explorer .routility-inv-toolbar')?.remove();
      ensureBox().then(() => document.querySelector('.routility-inv-search input')?.focus());
      run(s.query);
    });
  }

  function menuButton(prefix, options, current, pick) {
    const btn = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-small shrink-0 stroke-standard stroke-contrast-alpha bg-none height-1000 radius-medium padding-x-medium content-emphasis text-label-medium routility-inv-sort');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    btn.appendChild(layer);
    btn.appendChild(el('span', 'content-muted', prefix));
    const label = el('span', null, lt(options.find(x => x[0] === current())[1]));
    btn.appendChild(label);
    btn.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis'));
    btn.addEventListener('click', () => {
      if (menu) return closeMenu();
      const pop = el('div', 'routility-injected routility-calc-pop');
      const list = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small');
      list.setAttribute('role', 'menu');
      for (const [key, text] of options) {
        const item = el('button', 'relative clip group/interactable foundation-web-menu-item flex items-center content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small radius-medium');
        item.type = 'button';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(key === current()));
        const l = el('div', STATE_LAYER);
        l.setAttribute('aria-hidden', 'true');
        item.appendChild(l);
        item.appendChild(el('span', 'grow-1 content-emphasis', lt(text)));
        item.addEventListener('click', () => {
          closeMenu();
          label.textContent = lt(text);
          pick(key);
        });
        list.appendChild(item);
      }
      pop.appendChild(list);
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      pop.style.left = Math.round(Math.min(r.left, document.documentElement.clientWidth - 200)) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
      const outside = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
      document.addEventListener('mousedown', outside, true);
      menu = { pop, outside };
    });
    return btn;
  }

  function render() {
    const s = state;
    if (!s) return;
    const explorer = document.querySelector(':is(#inventory-container, #favorites-container) assets-explorer');
    if (!explorer) return;
    let host = explorer.querySelector('.routility-inv-results');
    const searching = !!s.result;
    explorer.classList.toggle('routility-inv-searching', searching);
    if (!searching) {
      host?.remove();
      return;
    }
    const list = explorer.querySelector('ul.item-cards, .item-cards');
    if (!host) {
      host = el('div', 'routility-injected routility-inv-results');
      if (list) list.before(host);
      else explorer.appendChild(host);
    }
    host.textContent = '';
    const r = s.result;
    if (r.loading) {
      host.appendChild(el('p', 'text-secondary routility-inv-status', s.loaded ? ltn(s.loaded, '{count} item checked', '{count} items checked', { count: formatNumber(s.loaded) }) : ''));
      const sk = el('ul', 'hlist item-cards item-cards-embed routility-inv-sk');
      for (let i = 0; i < 12; i++) {
        const li = el('li', 'list-item item-card');
        li.append(el('span', 'routility-sk routility-inv-sk-thumb'), el('span', 'routility-sk routility-inv-sk-line'));
        sk.appendChild(li);
      }
      host.appendChild(sk);
      return;
    }
    if (r.private) return host.appendChild(el('p', 'text-secondary routility-inv-status', lt('This inventory is private.')));
    if (r.failed) return host.appendChild(el('p', 'text-secondary routility-inv-status', lt('Couldn’t search right now. Try again in a minute.')));
    const words = s.query ? s.query.split(/\s+/) : [];
    const squashed = words.join('');
    let hits = r.list.filter(i => words.every(w => i.name.toLowerCase().includes(w) || i.id === w) || shortMatch(squashed, i));
    const count = s.query ? ltn(hits.length, '{count} result', '{count} results', { count: formatNumber(hits.length) }) : ltn(hits.length, '{count} item', '{count} items', { count: formatNumber(hits.length) });
    host.appendChild(el('p', 'text-secondary routility-inv-status', hits.length ? (r.missed ? lt('{results} (some categories couldn’t load)', { results: count }) : r.complete ? count : lt('{results} (first 2,000 items)', { results: count })) : s.query ? lt('No items match "{query}".', { query: s.query }) : lt('Nothing here yet.')));
    if (!hits.length) return;
    if (s.sort !== 'newest' && s.sort !== 'oldest') {
      const missing = s.sort === 'name' ? [] : hits.map(i => 'id:' + i.id).filter(k => window.RoUtilityUI.priceNow(k) === undefined);
      if (missing.length) {
        window.RoUtilityUI.loadPrices(missing).then(() => { if (state === s) render(); });
      }
      const val = (i) => {
        const pr = window.RoUtilityUI.priceNow('id:' + i.id);
        return pr ? (s.sort === 'rap' ? pr.rap || 0 : pr.usd || 0) : -1;
      };
      hits = hits.slice().sort((a, b) => (s.sort === 'name' ? a.name.localeCompare(b.name) : val(b) - val(a) || a.name.localeCompare(b.name)));
    }
    const grid = el('ul', 'hlist item-cards item-cards-embed routility-inv-grid');
    hits.slice(0, s.shown).forEach(i => grid.appendChild(card(i)));
    host.appendChild(grid);
    for (const li of grid.querySelectorAll('li.routility-inv-card[data-asset]')) applyMeta(li, s.meta.get(li.dataset.asset));
    fillThumbs(grid);
    fillMeta(grid);
    window.RoUtilityInventory?.refresh();
    if (hits.length > s.shown) {
      const more = el('button', 'btn-control-sm routility-inv-more', lt('Show more'));
      more.type = 'button';
      more.addEventListener('click', () => {
        s.shown += PAGE;
        render();
      });
      host.appendChild(more);
    }
  }

  function setup(userId, opts) {
    const fav = !!(opts && opts.favorites);
    if (state && state.userId === String(userId) && state.fav === fav) return;
    teardown();
    state = { userId: String(userId), fav, raw: '', query: '', sort: 'newest', type: null, scope: 'type', key: '', items: new Map(), thumbs: new Map(), meta: new Map(), result: null, shown: PAGE, loaded: 0, categories: null };
    const s = state;
    s.observer = new MutationObserver(onFrame(() => {
      if (state !== s) return;
      ensureBox();
      const explorer = document.querySelector(':is(#inventory-container, #favorites-container) assets-explorer');
      if (explorer && s.result && !explorer.querySelector('.routility-inv-results')) render();
    }));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    ensureBox();
  }

  function teardown() {
    closeMenu();
    if (!state) return;
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-inv-toolbar, .routility-inv-results').forEach(n => n.remove());
    document.querySelectorAll('.routility-inv-searching').forEach(n => n.classList.remove('routility-inv-searching'));
  }

  window.RoUtilityInvSearch = { setup, teardown };
})();
