(function () {
  'use strict';


  const formatUSD = window.RoUtilityUI.formatUSD;
  const el = window.RoUtilityUI.el;
  const { lt, ltn } = window.RoUtilityI18n;

  const bundleAssets = new Map();

  function getItemIdFromURL(url) {
    const match = url.match(/\/catalog\/(\d+)/);
    if (match) return match[1];
    const bundle = url.match(/\/bundles\/(\d+)/);
    return (bundle && bundleAssets.get(bundle[1])) || null;
  }

  function nativeRow(label, valueNode) {
    const row = el('div', 'clearfix item-info-row-container routility-injected');
    row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow row-label', label));
    row.appendChild(valueNode);
    return row;
  }

  function textValue(text) {
    return el('span', 'font-body text', text);
  }

  function usdLine(item) {
    const line = el('a', 'item-price-value icon-text-wrapper clearfix icon-robux-price-container routility-injected routility-usd');
    line.href = `https://routility.io/items/${item.id}`;
    line.target = '_blank';
    line.rel = 'noopener';
    line.appendChild(window.RoUtilityUI.usdIcon('routility-logo'));
    line.appendChild(el('span', 'text-robux-lg', formatUSD(item.usd)));
    const tip = window.RoUtilityUI.valueTip(item);
    if (tip && !itemExtras.value) line.dataset.rtTip = tip;
    return line;
  }

  function valueLine(item) {
    const v = window.RoUtilityUI.itemValue(item);
    const line = el('div', 'icon-text-wrapper clearfix routility-injected routility-item-val');
    if (v) line.appendChild(window.RoUtilityUI.valueTag(v, { textClass: 'text-robux-lg' }));
    else line.appendChild(el('span', 'font-body routility-val-none', lt('Not valued yet')));
    return line;
  }

  let lastItemId = null;
  const itemData = new Map();

  function loadItemData(itemId) {
    if (!itemData.has(itemId)) {
      const pending = Promise.all([
        new Promise(r => chrome.storage.local.get('routilitySettings', s => r({ itemPrices: true, usdChart: true, owners: true, resellerDeals: true, ...(s.routilitySettings || {}) }))),
        window.RoUtilityUI.request({ type: 'getItem', id: itemId }, res => !!(res && res.ready)),
      ]).then(([settings, res]) => {
        const ready = !!(res && res.ready);
        if (!ready) itemData.delete(itemId);
        return { settings, item: res && res.item, ready };
      });
      itemData.set(itemId, pending);
    }
    return itemData.get(itemId);
  }

  const itemChanges = new Map();

  function valueChange(points, current) {
    const sorted = points.slice().sort((a, b) => a.ts - b.ts);
    const last = sorted[sorted.length - 1];
    const now = Number(current) > 0 ? Number(current) : last.usd;
    const target = last.ts - 30 * 86400;
    const base = sorted.filter(p => p.ts <= target).pop() || sorted[0];
    const days = Math.max(1, Math.round((last.ts - base.ts) / 86400));
    if (!(base.usd > 0) || base === last) return null;
    const diff = now - base.usd;
    if (Math.abs(diff) < 0.005) return { text: days >= 30 ? lt('No change in 30 days') : ltn(days, 'No change in {n} day', 'No change in {n} days'), tone: null };
    const pct = Math.round(Math.abs(diff / base.usd) * 100);
    const vars = { diff: `${diff < 0 ? '-' : '+'}${formatUSD(Math.abs(diff))}`, pct };
    return { text: days >= 30 ? lt('{diff} ({pct}%) in 30 days', vars) : ltn(days, '{diff} ({pct}%) in {n} day', '{diff} ({pct}%) in {n} days', vars), tone: diff < 0 ? 'overpay' : 'win' };
  }

  function changeRow(change) {
    const value = textValue(change.text);
    if (change.tone) value.classList.add('routility-tone-' + change.tone);
    const row = nativeRow(lt('Price Change'), value);
    row.classList.add('routility-change-row');
    return row;
  }

  function placeChangeRow(details, change) {
    if (!change || !itemExtras.change || details.querySelector('.routility-change-row')) return;
    const after = [...details.querySelectorAll('.routility-injected.item-info-row-container')].pop();
    const anchor = details.querySelector('.toggle-target.item-info-row-container');
    const row = changeRow(change);
    window.RoUtilityUI.rowGate(() => {
      if (!details.isConnected || details.querySelector('.routility-change-row')) return;
      const last = [...details.querySelectorAll('.routility-injected.item-info-row-container')].pop() || after;
      if (last && last.isConnected) last.after(row);
      else if (anchor && anchor.isConnected) details.insertBefore(row, anchor);
      else details.appendChild(row);
    });
  }

  function loadChange(itemId, item) {
    if (itemChanges.has(itemId)) return;
    itemChanges.set(itemId, null);
    window.RoUtilityUI.request({ type: 'getHistory', id: itemId }, r => !!(r && r.points)).then((res) => {
      const points = res && res.points;
      if (!points || points.length < 2) { itemChanges.delete(itemId); return; }
      const change = valueChange(points, item.usd);
      itemChanges.set(itemId, change);
      const details = document.querySelector('.item-details-section');
      if (details && getItemIdFromURL(window.location.href) === itemId && details.querySelector('.routility-injected')) placeChangeRow(details, change);
    });
  }

  function markDeals(item) {
    const rap = Number(item.rap);
    if (!(rap > 0)) return;
    for (const price of document.querySelectorAll('.reseller-item:not(.routility-owner-row) .reseller-price-container')) {
      const robux = Number(price.querySelector('.text-robux')?.textContent.replace(/[^\d]/g, ''));
      const existing = price.parentElement.querySelector('.routility-deal');
      if (!(robux > 0)) { existing?.remove(); continue; }
      const pct = Math.round((robux - rap) / rap * 100);
      const amount = Math.abs(pct) > 999 ? '>999' : Math.abs(pct);
      const text = pct === 0 ? lt('At RAP') : pct < 0 ? lt('{pct}% under RAP', { pct: amount }) : lt('{pct}% over RAP', { pct: amount });
      if (existing && existing.textContent === text) continue;
      existing?.remove();
      const note = el('span', 'font-caption-body routility-injected routility-deal' + (pct < 0 ? ' routility-tone-win' : ' text-secondary'), text);
      note.dataset.rtTip = lt('RAP {rap}', { rap: window.RoUtilityUI.formatNumber(rap) });
      price.after(note);
    }
  }

  let itemGuard = null;
  let itemRetries = 0;
  const ownedCopies = new Map();

  async function loadOwned(itemId) {
    if (ownedCopies.has(itemId)) return ownedCopies.get(itemId);
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me) return null;
    const pending = (async () => {
      const copies = [];
      let cursor = '';
      for (let page = 0; page < 5; page++) {
        let data = null;
        try {
          const res = await fetch(`https://inventory.roblox.com/v1/users/${me}/items/Asset/${itemId}?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'include' });
          data = res.ok ? await res.json() : null;
        } catch {}
        if (!data) return null;
        for (const c of data.data || []) copies.push(c.serialNumber || null);
        cursor = data.nextPageCursor;
        if (!cursor) break;
      }
      if (window.RoUtilityFun) copies.push(...window.RoUtilityFun.copies(itemId));
      if (!copies.length || copies.some(Boolean)) return copies;
      const scans = await new Promise(r => chrome.storage.local.get('routilityScans2', st => r((st.routilityScans2 || {})[me])));
      const mine = ((scans && scans.packed) || []).filter(e => String(e[0]) === String(itemId));
      if (mine.length === copies.length) return mine.map(e => e[3] || null);
      return copies;
    })();
    ownedCopies.set(itemId, pending);
    const result = await pending;
    if (!result) ownedCopies.delete(itemId);
    return result;
  }

  function placeOwnedRow(details, itemId) {
    if (!itemExtras.owned || details.querySelector('.routility-owned-row')) return;
    loadOwned(itemId).then((copies) => {
      if (!copies || !copies.length || !details.isConnected || details.querySelector('.routility-owned-row')) return;
      if (getItemIdFromURL(window.location.href) !== itemId) return;
      const { formatNumber } = window.RoUtilityUI;
      const serials = copies.filter(Boolean).sort((a, b) => a - b);
      let text = ltn(copies.length, '{n} copy', '{n} copies', { n: formatNumber(copies.length) });
      if (serials.length) {
        const shown = serials.slice(0, 6).map(n => '#' + formatNumber(n)).join(', ');
        text += ' • ' + shown + (serials.length > 6 ? ` +${formatNumber(serials.length - 6)}` : '');
      }
      const row = nativeRow(lt('You own'), textValue(text));
      row.classList.add('routility-owned-row');
      window.RoUtilityUI.rowGate(() => {
        if (!details.isConnected || details.querySelector('.routility-owned-row')) return;
        const after = [...details.querySelectorAll(':scope > .routility-injected.item-info-row-container')].pop();
        if (after) after.after(row);
        else {
          const anchor = details.querySelector('.toggle-target.item-info-row-container');
          if (anchor) details.insertBefore(row, anchor);
          else details.appendChild(row);
        }
      });
    });
  }

  function ensureItemInfo(item) {
    const details = document.querySelector('.item-details-section');
    if (!details) return;
    if (!details.querySelector('.routility-item-mark')) injectItemInfo(details, item);
    else placePriceBlock(details, item);
  }

  function injectItemPage() {
    const itemId = getItemIdFromURL(window.location.href);
    if (!itemId) return;
    if (itemId === lastItemId && document.querySelector('.routility-injected')) return;
    lastItemId = itemId;

    const details = document.querySelector('.item-details-section');
    if (!details) return;
    window.RoUtilityUI.mark('item-dom');

    loadItemData(itemId).then(({ settings, item, ready }) => {
      if (getItemIdFromURL(window.location.href) !== itemId) return;
      if (!ready) {
        if (itemRetries++ < 6) setTimeout(() => { lastItemId = null; injectItemPage(); }, 5000);
        return;
      }
      if (!item) return;
      if (settings.itemPrices) {
        loadChange(itemId, item);
        ensureItemInfo(item);
        const d = document.querySelector('.item-details-section');
        if (d) placeOwnedRow(d, String(item.id));
        const deals = settings.resellerDeals ? () => markDeals(item) : () => {};
        deals();
        itemGuard?.disconnect();
        placeSimilar(item);
        itemGuard = new MutationObserver(window.RoUtilityUI.onFrame(() => { ensureItemInfo(item); deals(); placeSimilar(item); }));
        itemGuard.observe(document.querySelector('#item-details-container') || document.body, { childList: true, subtree: true });
      }
      if (settings.usdChart) window.RoUtilityChart.setup(itemId);
      if (settings.owners) window.RoUtilityOwners.setup(itemId);
    });
  }

  const itemExtras = { stats: true, tags: true, calc: true, similar: true, usd: true, value: true, demand: true, trend: true, copies: true, change: true, owned: true };
  let similarItems = null;

  function similarList(item) {
    if (!similarItems) similarItems = window.RoUtilityUI.request({ type: 'calcItems' }, r => Array.isArray(r));
    return similarItems.then(list => {
      const target = item.usd;
      if (!(target > 0) || !list) return [];
      return list.filter(i => i.id !== String(item.id) && i.usd > 0)
        .map(i => [Math.abs(Math.log(i.usd / target)), i]).sort((a, b) => a[0] - b[0]).slice(0, 7).map(([, i]) => i)
        .sort((a, b) => b.usd - a.usd);
    });
  }

  function similarCard(i) {
    const wrap = el('div', 'item-list-item-card');
    const inner = el('div');
    const card = el('div', 'list-item item-card grid-item-container');
    const box = el('div', 'item-card-container');
    const a = el('a', 'item-card-link');
    a.href = `https://www.roblox.com/catalog/${i.id}`;
    const link = el('div', 'item-card-link');
    const thumb = el('div', 'item-card-thumb-container');
    const tin = el('div', 'item-card-thumb-container-inner');
    const span = el('span', 'thumbnail-2d-container');
    if (i.thumb) {
      const img = el('img');
      img.alt = '';
      img.src = i.thumb;
      span.appendChild(img);
    }
    const holder = el('div');
    holder.appendChild(span);
    tin.appendChild(holder);
    thumb.appendChild(tin);
    thumb.appendChild(el('span', 'restriction-icon icon-limited-label'));
    link.appendChild(thumb);
    a.appendChild(link);
    const cap = el('div', 'item-card-caption');
    const nameLink = el('div', 'item-card-name-link');
    const name = el('div', 'item-card-name', i.name);
    nameLink.appendChild(name);
    cap.appendChild(nameLink);
    const rap = el('div', 'text-overflow item-card-price font-header-2 text-subheader margin-top-none');
    rap.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', window.RoUtilityUI.formatNumber(i.rap || 0)));
    cap.appendChild(rap);
    const worthV = window.RoUtilityUI.shows('Market').value ? window.RoUtilityUI.itemValue(i) : 0;
    if (worthV) {
      const worth = el('div', 'text-overflow item-card-price font-header-2 text-subheader margin-top-none routility-injected routility-card-worth');
      const tag = el('span', 'routility-val routility-val-r');
      const vlogo = el('img', 'routility-logo');
      vlogo.src = chrome.runtime.getURL('assets/icons/logo.png');
      vlogo.alt = '';
      tag.append(vlogo, el('span', 'text-robux-tile', window.RoUtilityUI.formatNumber(worthV)));
      worth.appendChild(tag);
      cap.appendChild(worth);
    }
    const usd = el('div', 'text-overflow item-card-price font-header-2 text-subheader margin-top-none routility-injected routility-card-usd');
    usd.dataset.key = 'id:' + i.id;
    usd.dataset.text = window.RoUtilityUI.formatUSD(i.usd);
    usd.append(window.RoUtilityUI.usdIcon(), el('span', 'text-robux-tile', window.RoUtilityUI.formatUSD(i.usd)));
    cap.appendChild(usd);
    a.appendChild(cap);
    box.appendChild(a);
    card.appendChild(box);
    inner.appendChild(card);
    wrap.appendChild(inner);
    return wrap;
  }

  let similarTried = '';

  async function placeSimilar(item) {
    if (!itemExtras.similar || document.querySelector('#routility-similar')) return;
    const key = location.pathname + '|' + item.id;
    if (similarTried === key) return;
    const recs = document.querySelector('#item-list-container-recommendations');
    const resale = document.querySelector('#asset-resale-data-container');
    const anchor = recs || (resale && resale.nextElementSibling);
    if (!anchor && !resale) return;
    const reserve = el('div', 'routility-injected routility-similar-sk');
    reserve.id = 'routility-similar';
    reserve.style.minHeight = Math.max(260, Math.round((recs && recs.getBoundingClientRect().height) || 319)) + 'px';
    reserve.appendChild(el('span', 'routility-sk routility-similar-sk-title'));
    const skRow = el('div', 'routility-similar-sk-row');
    for (let i = 0; i < 6; i++) skRow.appendChild(el('span', 'routility-sk routility-similar-sk-card'));
    reserve.appendChild(skRow);
    if (recs) recs.before(reserve);
    else resale.after(reserve);
    const list = await similarList(item);
    if (!list.length || !reserve.isConnected || getItemIdFromURL(window.location.href) !== String(item.id)) {
      if (!list.length) similarTried = key;
      reserve.remove();
      return;
    }
    const root = el('div', 'routility-injected');
    root.id = 'routility-similar';
    const wrap = el('div', 'item-list');
    const cont = el('div', 'item-list-container layer');
    const title = el('div', 'item-list-carousel-title');
    title.appendChild(el('h1', 'font-header-1', lt('Similar Price')));
    cont.appendChild(title);
    const carousel = el('div', 'item-list-carousel');
    const cards = el('div', 'item-list-cards');
    for (const i of list) cards.appendChild(similarCard(i));
    carousel.appendChild(cards);
    cont.appendChild(carousel);
    wrap.appendChild(cont);
    root.appendChild(wrap);
    reserve.replaceWith(root);
    if (!document.hidden) root.classList.add('routility-reveal');
  }
  chrome.storage.local.get('routilitySettings', (st) => {
    const set = st.routilitySettings || {};
    itemExtras.stats = set.itemHoardStats !== false;
    itemExtras.tags = set.itemTags !== false;
    itemExtras.calc = set.tradeCalculator !== false && set.calcLinks !== false;
    itemExtras.similar = set.itemSimilar !== false;
    itemExtras.usd = set.itemUsd !== false;
    itemExtras.value = window.RoUtilityUI.shows('Item').value;
    itemExtras.demand = set.itemDemand !== false;
    itemExtras.trend = set.itemTrend !== false;
    itemExtras.copies = set.itemCopies !== false;
    itemExtras.change = set.itemChange !== false;
    itemExtras.owned = set.itemOwnedRow !== false;
  });

  function injectItemInfo(details, item) {
    if (!details.querySelector('.routility-item-mark')) {
      const mark = el('span', 'routility-injected routility-item-mark');
      mark.hidden = true;
      details.appendChild(mark);
    }
    injectItemRows(details, item);
  }

  function placePriceBlock(details, item) {
    if (details.querySelector('.routility-price-pair, .routility-usd, .routility-item-val')) return;
    const robuxPrice = details.querySelector('.price-info .item-price-value:not(.routility-injected)');
    const priceInfo = details.querySelector('.price-info');
    if (!priceInfo) return;
    const lines = [itemExtras.usd && usdLine(item), itemExtras.value && valueLine(item)].filter(Boolean);
    let block = lines[0];
    if (lines.length > 1) {
      block = el('div', 'routility-injected routility-price-pair');
      block.append(...lines);
    }
    if (!block) return;
    if (robuxPrice) robuxPrice.after(block);
    else priceInfo.prepend(block);
  }

  function injectItemRows(details, item) {
    window.RoUtilityUI.mark('item');
    placePriceBlock(details, item);

    const rows = [];
    if (itemExtras.demand && item.demand) rows.push(nativeRow(lt('Demand'), textValue(lt(item.demand))));
    if (itemExtras.trend && item.trend) rows.push(nativeRow(lt('Trend'), textValue(lt(item.trend))));
    if (itemExtras.copies && item.copies != null) rows.push(nativeRow(lt('Copies'), textValue(window.RoUtilityUI.formatNumber(item.copies))));
    if (itemExtras.stats && item.premiumCopies != null && (item.copies == null || item.premiumCopies <= item.copies)) rows.push(nativeRow(lt('Premium Copies'), textValue(window.RoUtilityUI.formatNumber(item.premiumCopies))));
    if (itemExtras.stats && item.hoarded && item.hoardShare > 0) rows.push(nativeRow(lt('Hoarded'), textValue(lt('{pct}% of copies', { pct: Math.round(item.hoardShare * 100) }))));
    if (itemExtras.tags && (item.rare || item.projected)) {
      const tags = el('span', 'flex items-center gap-small routility-item-tags');
      if (item.projected) {
        const p = el('span', 'foundation-web-badge inline-flex items-center radius-circle height-600 padding-x-small bg-system-alert content-inverse-emphasis');
        p.appendChild(el('span', 'text-label-small text-no-wrap', lt('Projected')));
        p.dataset.rtTip = lt('Its RAP is pushed up by recent sales above its usual price. Be careful trading for it at RAP.');
        tags.appendChild(p);
      }
      if (item.rare) {
        const r = el('span', 'foundation-web-badge inline-flex items-center radius-circle height-600 padding-x-small bg-shift-300 content-emphasis');
        r.appendChild(el('span', 'text-label-small text-no-wrap', lt('Rare')));
        r.dataset.rtTip = lt('Very few copies exist');
        tags.appendChild(r);
      }
      rows.push(nativeRow(lt('Tags'), tags));
    }
    if (itemExtras.calc) {
      const a = el('a', 'text-link font-body routility-calc-link', lt('Value it in the Trade Calculator'));
      a.href = `https://www.roblox.com/trades/calculator#give=i${item.id}`;
      rows.push(nativeRow(lt('Trade'), a));
    }

    const anchor = details.querySelector('.toggle-target.item-info-row-container');
    for (const row of rows) {
      if (anchor) details.insertBefore(row, anchor);
      else details.appendChild(row);
    }
    placeChangeRow(details, itemChanges.get(String(item.id)) || itemChanges.get(getItemIdFromURL(window.location.href)));
    placeOwnedRow(details, String(item.id));
  }

  let currentURL = window.location.href;

  let currentPath = window.location.pathname;

  function teardownAll() {
    stopWaiting();
    itemGuard?.disconnect();
    itemGuard = null;
    itemRetries = 0;
    window.RoUtilityChart.teardown();
    window.RoUtilityOwners.teardown();
    window.RoUtilityProfile.teardown();
    window.RoUtilityClassic.teardown();
    window.RoUtilityFriends.teardown();
    window.RoUtilityFriends.stopAdminBadges();
    window.RoUtilityFriends.stopFriendFilters();
    window.RoUtilityRequests.teardown();
    window.RoUtilityTransactions.teardown();
    window.RoUtilityInventory.teardown();
    window.RoUtilityTrades.teardown();
    window.RoUtilityAvatar.teardown();
    window.RoUtilityThumbCam.teardown();
    window.RoUtilityAccAdjust.teardown();
    window.RoUtilityRotator.teardown();
    window.RoUtilityFunOutfits.teardown();
    window.RoUtilityBadgeManage.teardown();
    window.RoUtilitySkinTone.teardown();
    window.RoUtilityMutual.teardown();
    window.RoUtilityFriends.stopFriendDates();
    window.RoUtilityBadges.teardown();
    window.RoUtilityInvSearch.teardown();
    window.RoUtilityListOrder.teardown();
    window.RoUtilityItemExtras.teardown();
    window.RoUtilityWearing.teardown();
    window.RoUtilityTryOn.teardown();
    window.RoUtilityPriceAlert.teardown();
    window.RoUtilityExplorer.teardown();
    window.RoUtilityOwned.teardown();
    window.RoUtilityGames.teardown();
    window.RoUtilityGames.stopPlaytime();
    window.RoUtilityMisc.teardown();
    window.RoUtilityHome.teardown();
    window.RoUtilityExtras.teardown();
  }

  function onPageChange() {
    if (!chrome.runtime?.id) {
      teardownAll();
      clearInterval(pageTimer);
      titleObserver?.disconnect();
      return;
    }
    if (window.location.href === currentURL) return;
    currentURL = window.location.href;
    if (window.location.pathname === currentPath) return;
    currentPath = window.location.pathname;
    lastItemId = null;
    teardownAll();
    handlePage();
  }

  function handlePage() {
    const path = window.location.pathname;
    window.RoUtilityMisc.setup();
    window.RoUtilityHome.setup();
    window.RoUtilityExtras.setup();
    if (path === '/request-error' && !/routility-user=\d+/.test(window.location.hash)) {
      chrome.storage.local.get(['routilitySettings', 'routilityLastProfile'], async (stored) => {
        const settings = { revealTerminated: true, ...(stored.routilitySettings || {}) };
        const last = stored.routilityLastProfile;
        const clear = () => {
          document.documentElement.classList.remove('routility-classic-on');
          document.querySelectorAll('#content > .routility-classic-loading').forEach(n => n.remove());
        };
        const nav = performance.getEntriesByType('navigation')[0]?.type;
        let shown = null;
        try { shown = sessionStorage.getItem('routilityTerminated'); } catch {}
        const candidate = last && Date.now() - last.t < 20000 ? last.id : (nav === 'reload' || nav === 'back_forward') && shown ? shown : null;
        if (!settings.revealTerminated || !candidate) return clear();
        chrome.storage.local.remove('routilityLastProfile');
        let banned = false;
        try {
          const res = await fetch(`https://users.roblox.com/v1/users/${candidate}`, { credentials: 'include' });
          banned = res.ok && (await res.json()).isBanned === true;
        } catch {}
        if (!banned || window.location.pathname !== path) return clear();
        history.replaceState(history.state, '', `/request-error?code=404#routility-user=${candidate}`);
        currentURL = window.location.href;
        handlePage();
      });
      return;
    }
    const terminated = path === '/request-error' && (window.location.hash.match(/routility-user=(\d+)/) || [])[1];
    if (terminated) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { revealTerminated: true, classicProfile: true, inventoryValues: true, ...(stored.routilitySettings || {}) };
        if (!settings.revealTerminated || window.location.pathname !== path) return;
        history.replaceState(history.state, '', `/users/${terminated}/profile`);
        try { sessionStorage.setItem('routilityTerminated', terminated); } catch {}
        currentURL = window.location.href;
        currentPath = window.location.pathname;
        window.RoUtilityClassic.setup(terminated, { terminated: true, modern: !settings.classicProfile, reveal: true, layout: settings.classicLayout });
      });
      return;
    }
    if (/^\/catalog\/\d+/i.test(path)) {
      waitForElement('.item-details-section .price-info', injectItemPage);
      waitForElement('#item-details', () => {
        chrome.storage.local.get('routilitySettings', (stored) => {
          const s = stored.routilitySettings || {};
          const id = getItemIdFromURL(window.location.href);
          if (window.location.pathname !== path || !id || (s.itemAcquired === false && s.friendsOwn === false && s.itemSize === false && s.classicFaceThumbs === false && s.lastOnSale === false)) return;
          window.RoUtilityItemExtras.setup(id, { acquired: s.itemAcquired !== false, friends: s.friendsOwn !== false, size: s.itemSize !== false, classicFace: s.classicFaceThumbs !== false, lastSale: s.lastOnSale !== false });
        });
      });
      chrome.storage.local.get('routilitySettings', (stored) => {
        const id = getItemIdFromURL(window.location.href);
        if (window.location.pathname === path && id && (stored.routilitySettings || {}).itemExplorer !== false) window.RoUtilityExplorer.setup(id);
        if (window.location.pathname === path && id && (stored.routilitySettings || {}).avatarPreview !== false) window.RoUtilityTryOn.setup(id);
        if (window.location.pathname === path && id && (stored.routilitySettings || {}).priceAlerts !== false) window.RoUtilityPriceAlert.setup(id);
      });
      return;
    }
    const bundlePage = path.match(/^\/bundles\/(\d+)/i);
    if (bundlePage) {
      window.RoUtilityUI.request({ type: 'getItem', bundle: bundlePage[1] }, res => !!(res && res.ready)).then(res => {
        if (window.location.pathname !== path || !res || !res.item) return;
        bundleAssets.set(bundlePage[1], String(res.item.id));
        window.RoUtilityItemExtras.classicFace(bundlePage[1], String(res.item.id));
        waitForElement('.item-details-section .price-info', injectItemPage);
      });
      waitForElement('#item-details', () => {
        chrome.storage.local.get('routilitySettings', (stored) => {
          const s = stored.routilitySettings || {};
          if (window.location.pathname !== path) return;
          if (s.friendsOwn !== false || s.classicFaceThumbs !== false) window.RoUtilityItemExtras.setup(bundlePage[1], { acquired: false, friends: s.friendsOwn !== false, bundle: true, classicFace: s.classicFaceThumbs !== false });
          if (s.itemExplorer !== false) window.RoUtilityExplorer.setup(bundlePage[1], { bundle: true });
          if (s.avatarPreview !== false) window.RoUtilityTryOn.setupBundle(bundlePage[1]);
        });
      });
      return;
    }
    if (/^\/catalog\/?$/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { marketplaceValues: true, ...(stored.routilitySettings || {}) };
        if (settings.marketplaceValues && window.location.pathname === path) window.RoUtilityInventory.setup();
      });
      return;
    }
    const counter = path.match(/^\/trades\/(\d+)\/counter\/?$/i);
    const tradeBuilder = /^\/users\/\d+\/trade\/?$/i.test(path) || !!counter;
    if (tradeBuilder || /^\/trades\/?$/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { tradeValues: true, ...(stored.routilitySettings || {}) };
        if (window.location.pathname !== path) return;
        window.RoUtilityTrades.setup();
        if (!tradeBuilder || !settings.tradeValues) return;
        window.RoUtilityInventory.setup();
        if (!counter) {
          window.RoUtilityProfile.setupTrade(path.match(/^\/users\/(\d+)\//)[1]);
          return;
        }
        const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
        fetch(`https://trades.roblox.com/v2/trades/${counter[1]}`, { credentials: 'include' })
          .then(r => (r.ok ? r.text() : null))
          .then((text) => {
            if (!text || window.location.pathname !== path) return;
            const ids = [...text.matchAll(/"user":\{"id":(\d+)/g)].map(m => m[1]);
            const partner = ids.find(id => id !== me);
            if (partner) window.RoUtilityProfile.setupTrade(partner);
          })
          .catch(() => {});
      });
      return;
    }
    if (/^\/(home|search\/users)\/?$/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        if ((stored.routilitySettings || {}).adminBadge !== false && window.location.pathname === path) window.RoUtilityFriends.adminBadges();
        if (/^\/search\/users/i.test(path) && (stored.routilitySettings || {}).searchTerminated !== false && window.location.pathname === path) window.RoUtilityFriends.termedSearch();
        if (/^\/search\/users/i.test(path) && window.location.pathname === path) window.RoUtilityFriends.searchCardLinks();
      });
    }
    if (/^\/transactions\/?$/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        if (window.location.pathname === path) window.RoUtilityTransactions.setup(stored.routilitySettings || {});
      });
      return;
    }
    const friendsPage = path.match(/^\/users\/(?:(\d+)\/)?friends\/?$/i);
    if (friendsPage) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { hiddenFriends: true, revealTerminated: true, friendCardMenu: true, adminBadge: true, friendFilters: true, friendManage: true, unfriendDetector: true, requestFilters: true, ...(stored.routilitySettings || {}) };
        if (window.location.pathname !== path) return;
        const owner = friendsPage[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (settings.friendsSince !== false && owner) window.RoUtilityFriends.friendDates(owner);
        if (settings.adminBadge) window.RoUtilityFriends.adminBadges();
        if (settings.friendFilters || settings.friendManage || settings.unfriendDetector) window.RoUtilityFriends.friendFilters(friendsPage[1], { filters: settings.friendFilters, manage: settings.friendManage, unfriends: settings.unfriendDetector });
        if (settings.requestFilters && !friendsPage[1]) window.RoUtilityRequests.setup();
        if (settings.hiddenFriends && friendsPage[1]) {
          window.RoUtilityFriends.setup(friendsPage[1]);
          window.RoUtilityFriends.fillUnavailable(friendsPage[1]);
        }
        if (settings.revealTerminated) window.RoUtilityFriends.revealDeleted();
        const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (settings.friendCardMenu && (!friendsPage[1] || friendsPage[1] === me)) window.RoUtilityFriends.cardMenus();
      });
      return;
    }
    const badgePage = path.match(/^\/badges\/(\d+)/i);
    if (badgePage) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        if ((stored.routilitySettings || {}).badgeProgress === false || window.location.pathname !== path) return;
        waitForElement('#item-container[data-item-type="Badge"] .item-name-container', () => {
          if (window.location.pathname === path) window.RoUtilityBadges.setupBadgePage(badgePage[1]);
        }, 15000);
      });
      return;
    }
    if (/^\/games\/\d+/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { badgeProgress: true, badgeTools: true, gameStats: true, gameAvatarType: true, ...(stored.routilitySettings || {}) };
        if (settings.stopTrailers !== false && window.location.pathname === path) window.RoUtilityGames.stopTrailers();
        if (settings.playtime !== false && window.location.pathname === path) {
          waitForElement('#game-detail-meta-data[data-universe-id]', () => {
            if (window.location.pathname === path) window.RoUtilityGames.setupPlaytime(document.querySelector('#game-detail-meta-data').dataset.universeId);
          }, 15000);
        }
        if (!(settings.badgeProgress || settings.badgeTools || settings.gameStats || settings.gameAvatarType) || window.location.pathname !== path) return;
        waitForElement('#game-detail-meta-data[data-universe-id]', () => {
          if (window.location.pathname !== path) return;
          const universeId = document.querySelector('#game-detail-meta-data').dataset.universeId;
          if (settings.badgeProgress || settings.badgeTools) window.RoUtilityBadges.setup(universeId, { progress: settings.badgeProgress, tools: settings.badgeTools });
          if (settings.gameStats || settings.gameAvatarType) window.RoUtilityGames.setup(universeId, { stats: !!settings.gameStats, avatar: !!settings.gameAvatarType });
          window.RoUtilityHome.markSeen(universeId);
        }, 15000);
      });
      return;
    }
    if (/^\/my\/avatar\/?$/i.test(path)) {
      chrome.storage.local.get('routilitySettings', (stored) => {
        const settings = { avatarSearch: true, avatarWearing: true, avatarMoreAccessories: true, avatarRig: true, avatarRemember: true, thumbCustomize: true, accessoryAdjust: true, outfitRotator: true, skinWheel: true, marketplaceValues: true, ...(stored.routilitySettings || {}) };
        if (window.location.pathname !== path) return;
        if (settings.avatarSearch) window.RoUtilityAvatar.setup();
        if (settings.avatarWearing || settings.avatarMoreAccessories) window.RoUtilityAvatar.setupWearing({ panel: settings.avatarWearing, values: settings.avatarWearingValues !== false, more: settings.avatarMoreAccessories });
        if (settings.avatarRig) window.RoUtilityAvatar.setupRig();
        if (settings.avatarRemember) window.RoUtilityAvatar.setupRemember();
        if (settings.thumbCustomize) window.RoUtilityThumbCam.setup();
        if (settings.accessoryAdjust) window.RoUtilityAccAdjust.setup();
        if (settings.outfitRotator) window.RoUtilityRotator.setup();
        if (settings.fakeBuy === true && settings.funOutfits !== false) window.RoUtilityFunOutfits.setup();
        if (settings.skinWheel) window.RoUtilitySkinTone.setup();
        if (settings.marketplaceValues) window.RoUtilityInventory.setup();
      });
      return;
    }
    const profile = path.match(/^\/users\/(\d+)\/profile\/?$/i);
    const inventory = path.match(/^\/users\/(?:(\d+)\/)?inventory\/?$/i);
    const favorites = path.match(/^\/users\/(?:(\d+)\/)?favorites\/?$/i);
    const listOwner = (inventory || favorites) && ((inventory || favorites)[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid);
    if (listOwner) chrome.storage.local.get('routilitySettings', (stored) => {
      if (window.location.pathname === path && (stored.routilitySettings || {}).listOrder !== false) window.RoUtilityListOrder.setup(listOwner);
    });
    if (!profile && !inventory) return;
    chrome.storage.local.get('routilitySettings', (stored) => {
      const settings = { inventoryValues: true, classicProfile: true, mutualFriends: true, hiddenFriends: true, ...(stored.routilitySettings || {}) };
      if (window.location.pathname !== path) return;
      if (profile && settings.mutualFriends) window.RoUtilityMutual.setup(profile[1], { hidden: settings.hiddenFriends });
      if (profile && settings.badgeDates !== false) window.RoUtilityOwned.setup(profile[1], { items: false, badges: true });
      if (inventory && settings.inventorySearch !== false) {
        const invOwner = inventory[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (invOwner) window.RoUtilityInvSearch.setup(invOwner);
      }
      if (inventory && settings.badgeManage !== false) {
        const invOwner = inventory[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (invOwner) window.RoUtilityBadgeManage.setup(invOwner);
      }
      if (inventory && (settings.ownedSince !== false || settings.badgeDates !== false)) {
        const invOwner = inventory[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (invOwner) window.RoUtilityOwned.setup(invOwner, { items: settings.ownedSince !== false, badges: settings.badgeDates !== false });
      }
      if (profile && !settings.classicProfile && settings.gearFix !== false) window.RoUtilityWearing.setup(profile[1]);
      if (profile && settings.classicProfile) window.RoUtilityClassic.setup(profile[1], { reveal: settings.revealTerminated !== false, layout: settings.classicLayout });
      else document.documentElement.classList.remove('routility-classic-on');
      if (!settings.inventoryValues) return;
      if (profile) window.RoUtilityProfile.setup(profile[1], settings.classicProfile ? 'classic' : 'profile');
      if (inventory) {
        const owner = inventory[1] || document.querySelector('meta[name="user-data"]')?.dataset.userid;
        if (owner) window.RoUtilityProfile.setup(owner, 'inventory');
      }
      window.RoUtilityInventory.setup();
    });
  }

  function waitForElement(selector, callback, maxWait = 60000) {
    if (document.querySelector(selector)) {
      callback();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!waiters.has(observer) || !document.querySelector(selector)) return;
      waiters.delete(observer);
      observer.disconnect();
      callback();
    });
    waiters.add(observer);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      waiters.delete(observer);
      observer.disconnect();
    }, maxWait);
  }

  const waiters = new Set();

  function stopWaiting() {
    for (const o of waiters) o.disconnect();
    waiters.clear();
  }

  let titleObserver = null;
  let pageTimer = 0;
  const boot = () => {
    titleObserver = new MutationObserver(onPageChange);
    titleObserver.observe(document.querySelector('head > title') || document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('popstate', () => setTimeout(onPageChange, 100));
    pageTimer = setInterval(onPageChange, 1000);

    const startItem = /^\/catalog\/\d+/i.test(window.location.pathname) && getItemIdFromURL(window.location.href);
    if (startItem) loadItemData(startItem);
    else chrome.runtime.sendMessage({ type: 'warm' }, () => void chrome.runtime.lastError);

    handlePage();
  };
  const i18n = window.RoUtilityI18n;
  if (i18n && i18n.ready) i18n.ready.then(boot, boot);
  else boot();
})();
