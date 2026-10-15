(function () {
  'use strict';

  const { el, formatNumber, itemValue, valueTag, shows } = window.RoUtilityUI;
  let pillPlace = 'Profile';
  const showing = shows(() => pillPlace);
  const { lt, ltn } = window.RoUtilityI18n;
  const MAX_PAGES = 50;
  const PILL_CLASS = 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility';
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const cache = new Map();

  let state = null;

  function send(msg) {
    return window.RoUtilityUI.request(msg);
  }

  const STORE_KEY = 'routilityProfileValues4';
  const TTL = 10 * 60 * 1000;

  function remember(userId, summary) {
    cache.set(userId, { summary, at: Date.now() });
    chrome.storage.local.get(STORE_KEY, (s) => {
      const all = s[STORE_KEY] || {};
      all[userId] = { summary, at: Date.now() };
      const fresh = Object.entries(all).filter(([, v]) => Date.now() - v.at < TTL).slice(-200);
      chrome.storage.local.set({ [STORE_KEY]: Object.fromEntries(fresh) });
    });
    return summary;
  }

  function recall(userId) {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.summary);
    return new Promise(resolve => chrome.storage.local.get(STORE_KEY, (s) => {
      const v = (s[STORE_KEY] || {})[userId];
      resolve(v && Date.now() - v.at < TTL ? v.summary : null);
    }));
  }


  const scans = new Map();

  const scanning = new Map();

  const SCAN_KEY = 'routilityScans2';

  function storeScan(userId, assets, complete) {
    const packed = assets.map(a => [a.assetId, a.name, Number(a.recentAveragePrice) || 0, a.serialNumber ?? null]);
    chrome.storage.local.get(SCAN_KEY, (st) => {
      const all = st[SCAN_KEY] || {};
      all[userId] = { at: Date.now(), complete, packed };
      const fresh = Object.entries(all).filter(([, v]) => Date.now() - v.at < TTL).sort((a, b) => a[1].at - b[1].at).slice(-8);
      chrome.storage.local.set({ [SCAN_KEY]: Object.fromEntries(fresh) });
    });
  }

  function storedScan(userId) {
    return new Promise(resolve => chrome.storage.local.get(SCAN_KEY, (st) => {
      const v = (st[SCAN_KEY] || {})[userId];
      if (!v || Date.now() - v.at >= TTL) return resolve(null);
      resolve({ at: v.at, complete: v.complete, assets: v.packed.map(([assetId, name, recentAveragePrice, serialNumber]) => ({ assetId, name, recentAveragePrice, serialNumber })) });
    }));
  }

  async function priced(userId, assets, complete, at) {
    const ids = [...new Set(assets.map(a => String(a.assetId)).filter(id => !id.startsWith('b')))];
    const bundleKeys = new Map();
    for (const a of assets) {
      const id = String(a.assetId);
      if (id.startsWith('b') && !bundleKeys.has(id)) bundleKeys.set(id, id.slice(1) + ':' + String(a.name || '').trim().toLowerCase());
    }
    const res = await send({ type: 'getPrices', ids, bundles: [...bundleKeys.values()] });
    const prices = Object.assign({}, (res && res.ids) || {});
    for (const [id, key] of bundleKeys) {
      const p = res && res.bundles && res.bundles[key];
      if (p) prices[id] = p;
    }
    const unpriced = !res || res.ready === false;
    const result = { private: false, assets, prices, complete, at, unpriced };
    if (!unpriced) scans.set(userId, result);
    return result;
  }

  function scan(userId) {
    const hit = scans.get(userId);
    if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit);
    if (!scanning.has(userId)) {
      const job = storedScan(userId)
        .then(stored => stored ? priced(userId, stored.assets, stored.complete, stored.at) : runScan(userId))
        .finally(() => scanning.delete(userId));
      scanning.set(userId, job);
    }
    return scanning.get(userId);
  }

  const progress = new Map();

  async function runScan(userId) {
    const r = await window.RoUtilityUI.collectibles(userId, { pages: MAX_PAGES, onProgress: n => progress.set(userId, n) });
    if (r.status === 'private') return { private: true };
    if (r.status === 'invalid') return { invalid: true };
    if (r.status !== 'ok') return null;
    const assets = r.items.map(x => ({ assetId: x.id, name: x.name, recentAveragePrice: x.rap, serialNumber: x.serial }));
    storeScan(userId, assets, r.complete);
    return priced(userId, assets, r.complete, Date.now());
  }

  async function summarize(userId) {
    const known = await recall(userId);
    if (known) return known;
    const s = await scan(userId);
    if (!s) return null;
    if (s.invalid) return { invalid: true };
    if (s.private) return remember(userId, { private: true });
    let usd = 0;
    let rap = 0;
    let count = 0;
    let worth = 0;
    let valued = 0;
    for (const a of s.assets) {
      const p = s.prices[String(a.assetId)];
      const v = itemValue(p);
      if (v) valued++;
      worth += v || (p && p.rap) || Number(a.recentAveragePrice) || 0;
      if (!p) continue;
      usd += p.usd;
      rap += p.rap || 0;
      count++;
    }
    const rapTotal = s.assets.reduce((sum, a) => sum + (Number(a.recentAveragePrice) || 0), 0);
    const summary = { private: false, usd, rap, rapTotal, worth, valued, count, complete: s.complete };
    return s.unpriced ? summary : remember(userId, summary);
  }


  const LOGO_URL = chrome.runtime.getURL('icons/logo.png');

  function pillText(summary) {
    if (summary.private) return lt('Private');
    return '$' + formatNumber(summary.usd) + (summary.complete ? '' : '+');
  }

  function makePill(userId, summary, name) {
    const a = el('a', PILL_CLASS + ' routility-value-pill');
    a.href = `https://routility.io/player/${userId}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.textDecoration = 'none';
    if (!summary.private) {
      a.addEventListener('mouseenter', () => { scan(userId); }, { once: true });
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(userId, summary, name);
      });
    }
    a.dataset.rtTip = summary.private
      ? lt('Private inventory')
      : ltn(summary.count, '{count} limited', '{count} limiteds', { count: formatNumber(summary.count) });
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    a.appendChild(layer);
    const logo = el('img', 'routility-value-logo');
    logo.src = LOGO_URL;
    logo.alt = '';
    a.appendChild(logo);
    a.appendChild(el('span', 'padding-y-xsmall text-no-wrap text-truncate-end', pillText(summary)));
    return a;
  }

  function profileName() {
    if (state && state.mode === 'classic') return document.querySelector('.routility-classic .profile-name, .routility-modern-name')?.textContent.trim() || lt('Player');
    if (state && state.mode === 'inventory') {
      const h = document.querySelector('#inventory-container .page-content > h1')?.textContent.trim() || '';
      const owner = h.replace(/'s Inventory$/i, '').trim();
      if (owner && !/^My Inventory$/i.test(h)) return owner;
      return document.querySelector('meta[name="user-data"]')?.dataset.name || lt('Your');
    }
    const t = document.title.split(' - ')[0].replace(/'s Profile$/i, '').trim();
    return t || lt('Player');
  }

  function svgIcon(path) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '20');
    s.setAttribute('height', '20');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }

  function groupItems(s) {
    const groups = new Map();
    for (const a of s.assets) {
      const id = String(a.assetId);
      const g = groups.get(id) || { id, name: a.name, rap: Number(a.recentAveragePrice) || 0, serials: [], count: 0, unique: false, price: s.prices[id] || null };
      g.count++;
      if (a.serialNumber != null) { g.unique = true; g.serials.push(a.serialNumber); }
      groups.set(id, g);
    }
    return [...groups.values()];
  }

  const SORTS = {
    value: (x, y) => ((y.price?.usd || 0) - (x.price?.usd || 0)) || (y.rap - x.rap),
    worth: (x, y) => (itemValue(y.price) - itemValue(x.price)) || ((y.price?.usd || 0) - (x.price?.usd || 0)) || (y.rap - x.rap),
    rap: (x, y) => (y.rap - x.rap) || ((y.price?.usd || 0) - (x.price?.usd || 0)),
    name: (x, y) => x.name.localeCompare(y.name),
    copies: (x, y) => (y.count - x.count) || ((y.price?.usd || 0) - (x.price?.usd || 0)),
  };
  let sortBy = 'value';
  chrome.storage.local.get('routilityModalSort', (s) => { if (SORTS[s.routilityModalSort]) sortBy = s.routilityModalSort; });

  function itemCard(g, thumbs) {
    const li = el('li', 'list-item item-card routility-modal-card');
    const container = el('div', 'item-card-container');
    const link = el('a', 'item-card-link');
    link.href = g.id.startsWith('b') ? `https://www.roblox.com/bundles/${g.id.slice(1)}` : `https://www.roblox.com/catalog/${g.id}`;
    const thumbBox = el('div', 'item-card-thumb-container');
    if (g.serials.length === 1) thumbBox.appendChild(el('div', 'item-serial-number', '#' + g.serials[0]));
    if (g.count > 1) thumbBox.appendChild(el('span', 'routility-copies', '×' + g.count));
    const holder = el('span', 'thumbnail-2d-container');
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('load', () => img.classList.add('routility-loaded'));
    if (thumbs.has(g.id)) img.src = thumbs.get(g.id);
    else img.dataset.assetId = g.id;
    holder.appendChild(img);
    thumbBox.appendChild(holder);
    thumbBox.appendChild(el('span', 'restriction-icon ' + (g.unique ? 'icon-limited-unique-label' : 'icon-limited-label')));
    link.appendChild(thumbBox);
    const name = el('div', 'item-card-name', g.name);
    link.appendChild(name);
    if (g.count > 1) {
      const copies = el('div', 'text-overflow item-card-label routility-copies-line', ltn(g.count, '{n} copy', '{n} copies'));
      if (g.serials.length) copies.dataset.rtTip = g.serials.sort((a, b) => a - b).map(n => '#' + n).join(', ');
      link.appendChild(copies);
    }
    const robux = el('div', 'text-overflow item-card-price font-header-2 text-subheader margin-top-none');
    robux.appendChild(el('span', 'icon-robux-16x16'));
    robux.appendChild(el('span', 'text-robux-tile', formatNumber(g.rap)));
    link.appendChild(robux);
    const usd = el('div', 'text-overflow item-card-price font-header-2 text-subheader margin-top-none routility-card-usd');
    if (g.price) {
      usd.dataset.rtTip = window.RoUtilityUI.priceTitle(g.price);
      const logo = el('img', 'routility-logo');
      logo.src = LOGO_URL;
      logo.alt = '';
      usd.appendChild(logo);
      usd.appendChild(el('span', 'text-robux-tile', window.RoUtilityUI.formatUSD(g.price.usd)));
      if (showing.value && itemValue(g.price)) usd.appendChild(valueTag(itemValue(g.price), { short: true, className: 'routility-card-val text-robux-tile' }));
    } else {
      usd.appendChild(el('span', 'text-robux-tile', ' '));
    }
    link.appendChild(usd);
    container.appendChild(link);
    li.appendChild(container);
    return li;
  }

  async function openModal(userId, summary, name) {
    document.querySelector('.routility-modal-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected');
    const modal = el('div', 'routility-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const title = el('h2', 'routility-modal-title', lt("{name}'s Collectibles ({price})", { name: name || profileName(), price: pillText(summary) }));
    const ext = el('a', 'routility-modal-icon');
    ext.href = `https://routility.io/player/${userId}`;
    ext.target = '_blank';
    ext.rel = 'noopener';
    ext.dataset.rtTip = lt('Open on RoUtility');
    ext.appendChild(svgIcon('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'));
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
    head.append(title, ext, close);
    const tools = el('div', 'routility-modal-tools');
    const search = el('input', 'form-control input-field routility-modal-search');
    search.type = 'text';
    search.placeholder = lt('Search by item name');
    let resort = () => {};
    const sorter = window.RoUtilityUI.dropdown([
      { value: 'value', label: lt('Price') },
      { value: 'worth', label: lt('Value') },
      { value: 'rap', label: 'RAP' },
      { value: 'name', label: lt('Name') },
      { value: 'copies', label: lt('Copies') },
    ], sortBy, (v) => {
      sortBy = v;
      chrome.storage.local.set({ routilityModalSort: v });
      resort();
    }, 'routility-modal-sort');
    tools.append(search, sorter);
    const body = el('div', 'routility-modal-body');
    const grid = el('ul', 'hlist item-cards item-cards-stackable routility-modal-grid');
    const sentinel = el('div', 'routility-modal-sentinel');
    const note = el('p', 'routility-modal-note', '');
    for (let i = 0; i < 14; i++) grid.appendChild(el('li', 'routility-modal-card routility-card-skeleton'));
    body.append(grid, note, sentinel);
    modal.append(head, tools, body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');

    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') shut(); };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const ticker = setInterval(() => {
      const n = progress.get(userId);
      if (n) note.textContent = ltn(n, '{count} item found', '{count} items found', { count: formatNumber(n) });
    }, 150);
    const s = await scan(userId);
    clearInterval(ticker);
    if (!backdrop.isConnected) return;
    grid.textContent = '';
    if (!s || s.private) {
      note.textContent = s && s.private ? lt('This inventory is private.') : lt('Couldn’t load this inventory right now.');
      return;
    }
    const all = groupItems(s).sort(SORTS[sortBy]);
    const thumbs = new Map();
    let list = all;
    let shown = 0;

    const loadThumbs = async () => {
      const missing = [...grid.querySelectorAll('img[data-asset-id]')].map(i => i.dataset.assetId).filter(id => !thumbs.has(id)).slice(0, 100);
      if (!missing.length) return;
      for (const id of missing) thumbs.set(id, '');
      const map = (await send({ type: 'getAssetThumbs', ids: missing, size: '420x420' })) || {};
      for (const id of missing) thumbs.set(id, map[id] || '');
      for (const img of grid.querySelectorAll('img[data-asset-id]')) {
        const src = thumbs.get(img.dataset.assetId);
        if (src) { img.src = src; delete img.dataset.assetId; }
      }
    };

    const renderMore = (count = 42) => {
      const next = list.slice(shown, shown + count);
      const frag = document.createDocumentFragment();
      for (const g of next) frag.appendChild(itemCard(g, thumbs));
      grid.appendChild(frag);
      shown += next.length;
      note.textContent = list.length ? '' : lt('No items match.');
      loadThumbs();
    };

    const reset = () => {
      const q = search.value.trim().toLowerCase();
      list = q ? all.filter(g => g.lower.includes(q)) : all;
      grid.textContent = '';
      shown = 0;
      renderMore(q ? 28 : 42);
    };

    for (const g of all) g.lower = g.name.toLowerCase();
    let typing = 0;
    search.addEventListener('input', () => {
      cancelAnimationFrame(typing);
      typing = requestAnimationFrame(reset);
    });
    resort = () => { all.sort(SORTS[sortBy]); body.scrollTop = 0; reset(); };
    new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && shown < list.length) requestAnimationFrame(() => renderMore());
    }, { root: body, rootMargin: '600px' }).observe(sentinel);
    reset();
    search.focus();
  }

  function makeWorthPill(userId, summary, name) {
    const a = el('a', PILL_CLASS + ' routility-worth-pill');
    a.href = `https://routility.io/player/${userId}`;
    a.style.textDecoration = 'none';
    a.dataset.rtTip = lt('RoUtility Value, counting RAP for items we haven’t valued yet');
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    a.appendChild(layer);
    const tag = valueTag(summary.worth, { tip: false, className: 'padding-y-xsmall text-no-wrap' });
    tag.lastChild.textContent += summary.complete ? '' : '+';
    a.appendChild(tag);
    a.addEventListener('mouseenter', () => { scan(userId); }, { once: true });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(userId, summary, name);
    });
    return a;
  }

  const hasWorth = (summary) => showing.value && !summary.private && Number.isFinite(summary.worth);

  function pillSet(userId, summary, name) {
    const out = [];
    if (showing.usd || summary.private) out.push(makePill(userId, summary, name));
    if (hasWorth(summary)) out.push(makeWorthPill(userId, summary, name));
    if (showing.rap && !summary.private) out.push(makeRapPill(userId, summary, name));
    return out;
  }

  function skeletonPills() {
    return [showing.usd && 'routility-value-pill', showing.value && 'routility-worth-pill', showing.rap && 'routility-rap-pill']
      .filter(Boolean).map(c => el('span', PILL_CLASS + ' ' + c + ' routility-pill-skeleton'));
  }

  function makeRapPill(userId, summary, name) {
    const a = el('a', PILL_CLASS + ' routility-rap-pill');
    a.href = `https://routility.io/player/${userId}`;
    a.style.textDecoration = 'none';
    a.dataset.rtTip = lt('Total RAP');
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    a.appendChild(layer);
    a.appendChild(el('span', 'icon-robux-16x16 routility-rap-icon'));
    const total = Number(summary.rapTotal) || 0;
    a.appendChild(el('span', 'padding-y-xsmall text-no-wrap text-truncate-end', formatNumber(total) + (summary.complete ? '' : '+')));
    a.addEventListener('mouseenter', () => { scan(userId); }, { once: true });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(userId, summary, name);
    });
    return a;
  }

  function findPillRow(userId) {
    if (state && state.mode === 'inventory') return document.querySelector('#inventory-container .page-content > h1');
    if (state && state.mode === 'classic') return document.querySelector('.routility-classic .routility-classic-pill-slot, .routility-modern .routility-classic-pill-slot');
    const followers = document.querySelector(`a[href$="/users/${userId}/friends#!/followers"]`);
    return followers ? followers.parentElement : null;
  }

  function adoptRovalra(wrap) {
    const box = [...document.querySelectorAll('.rovalra-profile-button-container')].find(n => !wrap.contains(n));
    if (!box) return;
    box.classList.add('routility-rovalra-box');
    wrap.appendChild(box);
  }

  function ensureInjected() {
    const s = state;
    if (!s || s.failed) return;
    const row = findPillRow(s.userId);
    if (!row) return;
    const want = s.summary ? 'ready' : 'loading';
    const next = row.nextElementSibling;
    if (next && next.classList.contains('routility-value-row') && next.dataset.state === want) {
      adoptRovalra(next);
      return;
    }
    document.querySelectorAll('.routility-value-row .rovalra-profile-button-container').forEach(n => row.after(n));
    document.querySelectorAll('.routility-value-row').forEach(n => n.remove());
    const modeClass = { inventory: 'flex-nowrap gap-small flex routility-inventory-pills', classic: 'flex-nowrap gap-small flex routility-classic-pills' }[s.mode];
    const wrap = el('div', (modeClass || row.className) + ' routility-injected routility-value-row');
    wrap.dataset.state = want;
    pillPlace = s.mode === 'inventory' ? 'Inventory' : 'Profile';
    if (s.summary) {
      wrap.append(...pillSet(s.userId, s.summary));
      window.RoUtilityUI.mark('profile');
    } else {
      wrap.append(...skeletonPills());
    }
    row.after(wrap);
    adoptRovalra(wrap);
  }

  let trade = null;

  function panelOwner(panel, index, partnerId) {
    const me = document.querySelector('meta[name="user-data"]');
    const label = panel.querySelector('.inventory-panel-header .inventory-label')?.textContent.trim() || '';
    if (index === 0) return { userId: me?.dataset.userid, name: me?.dataset.name || lt('Your') };
    return { userId: partnerId, name: label.replace(/'s Inventory$/i, '').trim() || lt('Player') };
  }

  function ensureTradePills() {
    const t = trade;
    if (!t) return;
    [...document.querySelectorAll('.trade-inventory-panel')].slice(0, 2).forEach((panel, index) => {
      const header = panel.querySelector('.inventory-panel-header');
      const owner = panelOwner(panel, index, t.partnerId);
      if (!header || !owner.userId) return;
      const summary = t.summaries.get(owner.userId);
      if (summary === null) return;
      const want = summary ? 'ready' : 'loading';
      const existing = header.querySelector('.routility-trade-inv-pills');
      if (existing && existing.dataset.state === want) return;
      existing?.remove();
      const wrap = el('div', 'flex-nowrap gap-small flex routility-injected routility-trade-inv-pills');
      wrap.dataset.state = want;
      pillPlace = 'Trades';
      if (summary) {
        wrap.append(...pillSet(owner.userId, summary, owner.name));
      } else {
        wrap.append(...skeletonPills());
      }
      header.appendChild(wrap);
      if (summary) window.RoUtilityUI.mark('trade-inventory');
    });
  }

  function setupTrade(partnerId) {
    if (trade && trade.partnerId === partnerId) return;
    teardownTrade();
    const t = { partnerId, summaries: new Map() };
    trade = t;
    t.observer = new MutationObserver(window.RoUtilityUI.onFrame(ensureTradePills));
    t.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    const myId = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    for (const userId of [myId, partnerId].filter(Boolean)) {
      t.summaries.set(userId, undefined);
      (async () => {
        let summary = await summarize(userId);
        for (const delay of [2000, 5000]) {
          if (summary || trade !== t) break;
          await new Promise(r => setTimeout(r, delay));
          if (trade !== t) return;
          summary = await summarize(userId);
        }
        if (trade !== t) return;
        t.summaries.set(userId, summary || null);
        if (!summary) document.querySelectorAll('.routility-trade-inv-pills[data-state="loading"]').forEach(n => n.remove());
        ensureTradePills();
      })();
    }
    ensureTradePills();
  }

  function teardownTrade() {
    if (!trade) return;
    trade.observer?.disconnect();
    trade = null;
  }

  function teardown() {
    teardownTrade();
    if (!state) return;
    state.observer?.disconnect();
    state = null;
  }

  async function setup(userId, mode = 'profile') {
    if (state && state.userId === userId && state.mode === mode) return;
    if (state) { state.observer?.disconnect(); state = null; }
    const s = { userId, mode, summary: null, failed: false };
    state = s;
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(ensureInjected));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    ensureInjected();
    let summary = await summarize(userId);
    if (summary && summary.invalid) {
      s.failed = true;
      document.querySelectorAll('.routility-value-row').forEach(n => n.remove());
      return;
    }
    for (const delay of [2000, 5000]) {
      if (summary || state !== s) break;
      await new Promise(r => setTimeout(r, delay));
      if (state !== s) return;
      summary = await summarize(userId);
    }
    if (state !== s) return;
    if (!summary) {
      s.failed = true;
      document.querySelectorAll('.routility-value-row').forEach(n => n.remove());
      return;
    }
    s.summary = summary;
    ensureInjected();
  }

  async function collectibles(userId, limit = 6) {
    const s = await scan(userId);
    if (!s) return null;
    if (s.private || s.invalid) return [];
    return groupItems(s).filter(g => g.price).sort(SORTS.value).slice(0, limit).map(g => ({ id: g.id, name: g.name, unique: g.unique, usd: g.price.usd }));
  }

  function valuePills(userId, summary, name) {
    const value = makePill(userId, summary, name);
    const rap = summary.private ? null : makeRapPill(userId, summary, name);
    return { value, rap };
  }

  window.RoUtilityProfile = { setup, setupTrade, teardown, collectibles, summarize, valuePills };
})();
