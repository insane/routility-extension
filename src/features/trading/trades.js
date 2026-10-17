(function () {
  'use strict';

  const { el, formatUSD, formatCash, formatNumber, cardKey, prices, itemValue, valueTag, shows } = window.RoUtilityUI;
  const showing = shows('Trades');
  const show = { get value() { return showing.value; }, get price() { return showing.usd; }, get worth() { return showing.value; }, get rap() { return showing.rap; } };
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const LOGO_URL = chrome.runtime.getURL('assets/icons/logo.png');
  const PRICE_SELECTOR = '.item-card-price:not(.routility-card-usd), .item-value:not(.routility-card-usd)';
  const TAB_TYPES = { Inbound: 'Inbound', Outbound: 'Outbound', Completed: 'Completed', Inactive: 'Inactive' };
  const DETAILS_KEY = 'routilityTradeDetails4';

  let observer = null;

  function logo() {
    const img = el('img', 'routility-logo');
    img.src = LOGO_URL;
    img.alt = '';
    return img;
  }

  function usdMark() {
    const icon = el('span', 'routility-usd-ic');
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function valueMark(v, textClass) {
    const tag = el('span', 'routility-val routility-val-r');
    tag.append(logo(), el('span', textClass || null, formatNumber(v)));
    return tag;
  }

  function totalLine(offer) {
    const lines = [...offer.querySelectorAll('.robux-line:not(.routility-injected)')].filter(n => n.querySelector('.robux-line-value'));
    return lines[lines.length - 1] || null;
  }

  function nativeTotal(offer) {
    const v = totalLine(offer)?.querySelector('.robux-line-value')?.textContent || '';
    const n = Number(v.replace(/[^\d]/g, ''));
    return v && Number.isFinite(n) ? n : null;
  }

  function setTone(node, tone) {
    node.classList.toggle('routility-tone-win', tone === 'win');
    node.classList.toggle('routility-tone-overpay', tone === 'overpay');
  }

  function offerCards(offer) {
    if (offer.matches('.trade-request-window-offer')) {
      return [...offer.querySelectorAll('.trade-request-item')].filter(c => c.querySelector(PRICE_SELECTOR));
    }
    return [...offer.querySelectorAll('.trade-item-card')];
  }

  function worthOf(price) {
    return itemValue(price) || (price ? Number(price.rap) || 0 : 0);
  }

  function valueLine(card, anchor, price, textClass) {
    let line = card.querySelector('.routility-card-worth');
    const v = price && show.value && card.closest('.trade-list-detail-offer') ? worthOf(price) : 0;
    if (!v) {
      line?.remove();
      return;
    }
    const key = v + '|' + itemValue(price);
    if (line && line.dataset.key === key) return;
    if (!line) {
      line = el('div', anchor.className + ' routility-injected routility-card-worth');
      anchor.after(line);
    }
    line.dataset.key = key;
    line.textContent = '';
    line.appendChild(valueMark(v, textClass));
    line.dataset.rtTip = itemValue(price) ? lt('RoUtility Value: {value} Robux', { value: formatNumber(v) }) : lt('Not valued yet, so this is its RAP');
  }

  function cardLine(card, key, price) {
    const text = price && show.price ? formatUSD(price.usd) : ' ';
    const v = 0;
    const anchor = card.querySelector(PRICE_SELECTOR);
    if (!anchor) return;
    valueLine(card, anchor, price, anchor.querySelector('[class*="text-robux"]')?.className || 'text-robux-tile');
    let line = card.querySelector('.routility-card-usd');
    if (line && line.dataset.key === (key || '') && line.dataset.text === text + '|' + v) return;
    if (!line) {
      line = el('div', anchor.className + ' routility-injected routility-card-usd');
      (card.querySelector('.routility-card-worth') || anchor).after(line);
    }
    const textClass = anchor.querySelector('[class*="text-robux"]')?.className || 'text-robux-tile';
    line.dataset.key = key || '';
    line.dataset.text = text + '|' + v;
    line.dataset.rtTip = window.RoUtilityUI.priceTitle(price);
    line.textContent = '';
    if (price && show.price) line.appendChild(card.closest('.trade-list-detail-offer') ? usdMark() : logo());
    if (show.price || !v) line.appendChild(el('span', textClass, text));
    if (v && show.value) line.appendChild(valueTag(v, { short: true, className: 'routility-card-val ' + textClass }));
  }

  const OPEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  function openButton(card) {
    const thumb = card.querySelector('.item-card-thumb-container');
    const link = card.querySelector('a[href*="/catalog/"], a[href*="/bundles/"]');
    if (!thumb || !link) return;
    const href = link.href;
    let b = thumb.querySelector(':scope > .routility-open-item');
    if (b && b.dataset.href === href) return;
    b?.remove();
    b = el('span', 'routility-injected routility-open-item');
    b.setAttribute('role', 'link');
    b.tabIndex = 0;
    b.dataset.href = href;
    b.setAttribute('aria-label', lt('Open in a new tab'));
    b.dataset.rtTip = lt('Open in a new tab');
    b.innerHTML = OPEN_SVG;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    for (const type of ['pointerdown', 'mousedown', 'mouseup']) b.addEventListener(type, (e) => e.stopPropagation(), true);
    b.addEventListener('click', (e) => { stop(e); window.open(href, '_blank', 'noopener'); });
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { stop(e); window.open(href, '_blank', 'noopener'); } });
    thumb.appendChild(b);
  }

  function summaryRow(offer, cls, label, valueText, { withLogo = false, title = '', tone = null, node = null } = {}) {
    const anchor = totalLine(offer);
    if (!anchor) return;
    const key = label + '|' + valueText + '|' + tone;
    let row = offer.querySelector('.' + cls);
    if (row && row.dataset.key === key) return;
    if (!row) {
      row = el('div', 'robux-line routility-injected ' + cls);
      const order = ['routility-trade-val', 'routility-trade-usd'];
      const before = order.slice(0, order.indexOf(cls)).reverse().map(c => offer.querySelector('.' + c)).find(Boolean);
      (before || anchor).after(row);
    }
    row.dataset.key = key;
    row.textContent = '';
    if (title) row.dataset.rtTip = title;
    else row.removeAttribute('title');
    row.appendChild(el('span', 'text-lead', label));
    const amount = el('span', 'robux-line-amount');
    if (withLogo) amount.appendChild(logo());
    if (node) {
      amount.appendChild(node);
      row.appendChild(amount);
      return;
    }
    const value = el('span', 'text-robux-lg robux-line-value', valueText);
    setTone(value, tone);
    amount.appendChild(value);
    row.appendChild(amount);
  }

  let offersToken = 0;

  async function scanOffers() {
    const token = ++offersToken;
    const offers = [...document.querySelectorAll('.trade-list-detail-offer, .trade-request-window-offer')];
    if (!offers.length) return;
    const cardsPerOffer = offers.map(offerCards);
    cardsPerOffer.forEach(cards => cards.forEach(openButton));
    const keysPerOffer = cardsPerOffer.map(cards => cards.map(cardKey));
    const pricesPerOffer = await Promise.all(keysPerOffer.map(keys => prices(keys)));
    if (pricesPerOffer.some(list => list.some(p => p === undefined))) { setTimeout(schedule, 2500); return; }
    if (token !== offersToken) return;
    const robuxUsd = [0, 0];
    const robuxRaw = [0, 0];
    if (offers.length === 2 && !offers[0].matches('.trade-request-window-offer')) {
      const id = await selectedTradeId();
      const d = id ? await rawDetail(id) : null;
      if (token !== offersToken) return;
      if (d && d.participantAOffer && d.participantBOffer) {
        const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
        const [mine, theirs] = String(d.participantBOffer.user?.id) === me ? [d.participantBOffer, d.participantAOffer] : [d.participantAOffer, d.participantBOffer];
        robuxRaw[0] = Number(mine.robux) || 0;
        robuxRaw[1] = Number(theirs.robux) || 0;
        robuxUsd[0] = robuxRaw[0] * robuxRate;
        robuxUsd[1] = robuxRaw[1] * robuxRate;
      }
    } else if (offers.length === 2) {
      const boxes = [...document.querySelectorAll('.trade-request-window .robux-input-group input')];
      offers.forEach((o, i) => {
        const box = o.querySelector('.robux-input-group input') || boxes[i];
        robuxRaw[i] = window.RoUtilityUI.parseAmount(box ? box.value : '', true);
        robuxUsd[i] = robuxRaw[i] * robuxRate;
      });
    }

    const totals = pricesPerOffer.map((list, i) => ({
      usd: list.reduce((s, p) => s + (p ? p.usd : 0), 0),
      value: list.reduce((s, p) => s + worthOf(p), 0) + robuxRaw[i],
      valued: list.filter(p => itemValue(p) > 0).length,
      priced: list.filter(Boolean).length,
      missing: list.filter(p => !p).length,
    }));

    if (!totals.some(t => t.priced > 0)) {
      offers.forEach(o => o.querySelectorAll('.routility-injected:not(.routility-open-item)').forEach(n => n.remove()));
      return;
    }

    offers.forEach((offer, i) => {
      cardsPerOffer[i].forEach((card, j) => {
        if (valuesOn && card.isConnected && cardKey(card) === keysPerOffer[i][j]) {
          cardLine(card, keysPerOffer[i][j], pricesPerOffer[i][j]);
          window.RoUtilityUI.cardTags(card, pricesPerOffer[i][j]);
        }
      });
      if (!valuesOn) {
        offer.querySelectorAll('.routility-trade-usd, .routility-trade-val, .routility-card-usd, .routility-card-worth, .routility-card-tags, .routility-trade-diffs').forEach(n => n.remove());
        return;
      }
      const t = totals[i];
      const text = t.priced ? formatUSD(t.usd) + (t.missing ? '+' : '') : (t.missing ? lt('N/A') : formatCash(0));
      const usdNode = offer.matches('.trade-list-detail-offer') ? el('span', 'routility-usd-total') : null;
      if (usdNode) usdNode.append(usdMark(), el('span', 'text-robux-lg robux-line-value', text));
      if (show.price) summaryRow(offer, 'routility-trade-usd', lt('Price:'), text, { withLogo: !usdNode, node: usdNode, title: t.missing ? ltn(t.missing, '{n} unpriced', '{n} unpriced') : '' });
      else offer.querySelector('.routility-trade-usd')?.remove();
      if (show.value && totals.some(x => x.valued > 0) && offer.matches('.trade-list-detail-offer')) summaryRow(offer, 'routility-trade-val', '', String(t.value), { node: valueMark(t.value, 'text-robux-lg robux-line-value'), title: lt('RoUtility Value, counting RAP for items we haven’t valued yet') });
      else offer.querySelector('.routility-trade-val')?.remove();
    });

    if (offers.length === 2 && offers[0].matches('.trade-request-window-offer')) {
      const withRobux = totals.map((t, i) => ({ ...t, usd: t.usd + robuxUsd[i] }));
      tradeWarning(offers, withRobux);
      lastRequest = { totals: withRobux, rap: [nativeTotal(offers[0]), nativeTotal(offers[1])], items: cardsPerOffer.map(list => list.length) };
    }
    if (offers.length === 2 && valuesOn) diffPills(offers, totals, robuxUsd);
  }

  function diffPills(offers, totals, robuxUsd = [0, 0]) {
    const host = offers[0];
    const rap = window.RoUtilityUI.formatNumber;
    const rapGive = nativeTotal(offers[0]);
    const rapGet = nativeTotal(offers[1]);
    const unsure = totals[0].missing + totals[1].missing;
    const usdGive = totals[0].usd + robuxUsd[0];
    const usdGet = totals[1].usd + robuxUsd[1];
    const key = [rapGive, rapGet, usdGive, usdGet, unsure, totals[0].value, totals[1].value].join('|');
    let box = host.querySelector(':scope > .routility-trade-diffs');
    if (box && box.dataset.key === key) return;
    box?.remove();
    box = el('div', 'routility-injected routility-trade-diffs');
    box.dataset.key = key;
    if (show.rap && rapGive !== null && rapGet !== null && (rapGive || rapGet)) {
      box.appendChild(pill(pillIcon('robux'), rapGive, rapGet, rap, lt('RAP difference • you give {give}, you get {get}', { give: rap(rapGive), get: rap(rapGet) })));
    }
    if (show.price && (totals[0].priced || totals[1].priced)) {
      const icon = pillIcon('usd');
      const vars = { give: usdAmount(usdGive), get: usdAmount(usdGet), n: rap(unsure) };
      const tip = unsure
        ? ltn(unsure, 'Price difference • you give {give}, you get {get} • {n} unpriced item not counted', 'Price difference • you give {give}, you get {get} • {n} unpriced items not counted', vars)
        : lt('Price difference • you give {give}, you get {get}', vars);
      box.appendChild(pill(icon, usdGive, usdGet, usdAmount, tip));
    }
    if (show.worth && (totals[0].valued || totals[1].valued) && host.matches('.trade-list-detail-offer')) {
      if (box.children.length) box.appendChild(el('span', 'routility-diff-break'));
      box.appendChild(worthPill(totals[0].value, totals[1].value, lt('RoUtility Value difference • you give {give}, you get {get} • RAP is used for items we haven’t valued yet', { give: rap(totals[0].value), get: rap(totals[1].value) })));
    }
    if (box.children.length) host.appendChild(box);
  }

  const tradeLists = new Map();
  const tradeDetails = new Map();
  const pendingDetails = new Map();
  const queue = [];
  let active = 0;
  let robloxCooldown = 0;
  let storedDetails = null;
  let saveTimer = 0;

  async function robloxJson(url) {
    if (Date.now() < robloxCooldown) return null;
    try {
      const res = await Promise.race([fetch(url, { credentials: 'include' }), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 30000))]);
      if (res.status === 429) {
        const wait = Number(res.headers.get('Retry-After'));
        const ms = Number.isFinite(wait) && wait > 0 ? wait * 1000 : 30000;
        robloxCooldown = Date.now() + ms;
        setTimeout(schedule, ms + 500);
        return null;
      }
      if (!res.ok) return null;
      const text = await res.text();
      return JSON.parse(text.replace(/"id":\s*(\d{15,})/g, '"id":"$1"'));
    } catch {
      return null;
    }
  }

  function currentTradeType() {
    return TAB_TYPES[new URLSearchParams(location.search).get('tab')] || 'Inbound';
  }

  async function ensureList(type, needed) {
    let list = tradeLists.get(type);
    if (!list || Date.now() - list.at > 5 * 60 * 1000) {
      list = { entries: [], cursor: '', done: false, at: Date.now(), loading: null, failedAt: 0 };
      tradeLists.set(type, list);
    }
    while (list.entries.length < needed && !list.done) {
      if (Date.now() - list.failedAt < 5000 || Date.now() < robloxCooldown) break;
      if (!list.loading) {
        list.loading = robloxJson(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=100&cursor=${encodeURIComponent(list.cursor)}`).then(page => {
          list.loading = null;
          if (!page || !Array.isArray(page.data)) {
            list.failedAt = Date.now();
            setTimeout(schedule, 5500);
            return;
          }
          for (const t of page.data) list.entries.push({ id: String(t.id), names: [t.user?.displayName, t.user?.name].filter(Boolean), created: t.created, expiration: t.expiration, active: !!t.isActive });
          list.cursor = page.nextPageCursor || '';
          if (!list.cursor) list.done = true;
        });
      }
      await list.loading;
    }
    return list.entries;
  }

  function loadStoredDetails() {
    if (!storedDetails) {
      storedDetails = new Promise(resolve => chrome.storage.local.get(DETAILS_KEY, (s) => {
        for (const [id, v] of Object.entries(s[DETAILS_KEY] || {})) if (!tradeDetails.has(id)) tradeDetails.set(id, v);
        resolve();
      }));
    }
    return storedDetails;
  }

  const detailFails = new Map();

  function saveDetails() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const keep = [...tradeDetails].filter(([, v]) => v).slice(-3000);
      chrome.storage.local.set({ [DETAILS_KEY]: Object.fromEntries(keep) });
    }, 1000);
  }

  function pump() {
    while (active < 4 && queue.length) {
      const { id, done } = queue.shift();
      active++;
      rawDetail(id).then(detail => {
        const a = detail && detail.participantAOffer;
        const b = detail && detail.participantBOffer;
        if (a && b) {
          const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
          const [mine, theirs] = String(b.user?.id) === me ? [b, a] : [a, b];
          const keys = o => (o.items || []).map(offerPriceKey).filter(Boolean);
          const rap = o => (o.items || []).reduce((s, it) => s + (Number(it.recentAveragePrice) || 0), 0);
          tradeDetails.set(id, { give: keys(mine), get: keys(theirs), rapGive: rap(mine), rapGet: rap(theirs) });
          saveDetails();
        } else if (Date.now() >= robloxCooldown) {
          const n = (detailFails.get(id) || 0) + 1;
          detailFails.set(id, n);
          if (n >= 3) tradeDetails.set(id, null);
          else tradeDetails.delete(id);
        }
      }).finally(() => {
        active--;
        done();
        pump();
      });
    }
  }

  async function loadDetail(id) {
    await loadStoredDetails();
    if (tradeDetails.has(id)) return tradeDetails.get(id);
    if (pendingDetails.has(id)) return pendingDetails.get(id);
    let done;
    const promise = new Promise(r => { done = r; }).then(() => {
      pendingDetails.delete(id);
      return tradeDetails.get(id);
    });
    pendingDetails.set(id, promise);
    queue.push({ id, done });
    pump();
    return promise;
  }

  function usdAmount(v) {
    return formatCash(v);
  }

  function pill(iconNode, give, get, format, title) {
    const diff = get - give;
    const tone = Math.abs(diff) < 0.005 ? null : diff < 0 ? 'overpay' : 'win';
    const sign = diff < 0 ? '-' : diff > 0 ? '+' : '';
    const ratio = give > 0 ? Math.round(Math.abs(diff / give * 100)) : null;
    const pct = ratio === null ? '' : ratio > 999 ? ' (>999%)' : ` (${ratio}%)`;
    const node = el('span', 'routility-row-pill' + (tone ? ' routility-pill-' + tone : ''));
    node.dataset.rtTip = title;
    if (iconNode) node.appendChild(iconNode);
    node.appendChild(el('span', null, sign + format(Math.abs(diff)) + pct));
    return node;
  }

  function pillIcon(kind) {
    const icon = el('span', 'routility-pill-ic ' + (kind === 'logo' ? 'routility-pill-ic-logo' : kind === 'usd' ? 'routility-usd-ic' : 'routility-val-icon'));
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function worthPill(give, get, title) {
    const node = pill(pillIcon('logo'), give, get, formatNumber, title);
    node.classList.add('routility-row-pill-worth');
    return node;
  }

  async function annotateRow(row, entry) {
    const detail = await loadDetail(entry.id);
    if (!detail || !row.isConnected) return;
    const [give, get] = await Promise.all([prices(detail.give), prices(detail.get)]);
    if ([...give, ...get].some(p => p === undefined)) { setTimeout(schedule, 2500); return; }
    if (!row.isConnected) return;
    row.querySelectorAll('.routility-row-pills').forEach(n => n.remove());

    const box = el('div', 'routility-injected routility-row-pills');
    box.dataset.tradeId = entry.id;
    const rap = window.RoUtilityUI.formatNumber;
    const pair = listPair.split('-');
    const valued = [...give, ...get].some(p => itemValue(p) > 0);
    const hasRap = Number.isFinite(detail.rapGive) && Number.isFinite(detail.rapGet) && (detail.rapGive || detail.rapGet);
    const wantValue = pair.includes('value') && valued;
    const wantRap = (pair.includes('rap') || (pair.includes('value') && !valued)) && hasRap;
    if (wantValue) {
      const sum = list => list.reduce((s, p) => s + worthOf(p), 0);
      const giveVal = sum(give);
      const getVal = sum(get);
      box.appendChild(worthPill(giveVal, getVal, lt('RoUtility Value: {give} vs {get} • RAP is used for items we haven’t valued yet', { give: rap(giveVal), get: rap(getVal) })));
    }
    if (wantRap) {
      box.appendChild(pill(pillIcon('robux'), detail.rapGive, detail.rapGet, rap, lt('RAP: {give} vs {get}', { give: rap(detail.rapGive), get: rap(detail.rapGet) })));
    }
    if (pair.includes('usd') && [...give, ...get].some(Boolean)) {
      const sum = list => list.reduce((s, p) => s + (p ? p.usd : 0), 0);
      const giveUsd = sum(give);
      const getUsd = sum(get);
      box.appendChild(pill(pillIcon('usd'), giveUsd, getUsd, usdAmount, lt('Price: {give} vs {get}', { give: usdAmount(giveUsd), get: usdAmount(getUsd) })));
    }
    if (!box.children.length) return;
    (row.querySelector('.trade-row-container') || row).appendChild(box);
    window.RoUtilityUI.mark('trades');
  }

  const ownCache = new Map();
  const rawDetails = new Map();
  const ownResults = new Map();
  let ownToken = 0;
  let ownOn = true;
  let ageOn = true;
  let valuesOn = true;
  let listPair = 'rap-usd';
  chrome.storage.local.get('routilitySettings', (s) => {
    valuesOn = (s.routilitySettings || {}).tradeValues !== false;
    if (/^(rap-usd|value-usd|rap-value)$/.test((s.routilitySettings || {}).tradeListPills)) listPair = s.routilitySettings.tradeListPills;
    ownOn = (s.routilitySettings || {}).tradeOwnership !== false;
    ageOn = (s.routilitySettings || {}).tradeAge !== false;
  });

  function offerPriceKey(it) {
    const t = it.itemTarget || {};
    if (t.itemType === 'Asset' && t.targetId) return 'id:' + t.targetId;
    if (t.itemType === 'Bundle' && t.targetId) return 'bundle:' + t.targetId + (it.itemName ? ':' + String(it.itemName).trim().toLowerCase() : '');
    return it.itemName ? 'name:' + String(it.itemName).trim().toLowerCase() : null;
  }

  function ownedCount(userId, assetId, type = 'Asset') {
    const key = userId + ':' + type + ':' + assetId;
    const hit = ownCache.get(key);
    if (hit && Date.now() - hit.at < 120000) return hit.job;
    const job = (async () => {
      try {
        const res = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/${type}/${assetId}?limit=100`, { credentials: 'include' });
        if (res.status === 403) return null;
        if (!res.ok) return undefined;
        const d = await res.json();
        return (d.data || []).length;
      } catch {
        return undefined;
      }
    })();
    ownCache.set(key, { at: Date.now(), job });
    return job;
  }

  function rawDetail(id) {
    if (!rawDetails.has(id)) rawDetails.set(id, robloxJson(`https://trades.roblox.com/v2/trades/${id}`).then(d => { if (!d) rawDetails.delete(id); return d; }));
    return rawDetails.get(id);
  }

  async function selectedTradeId() {
    const rows = [...document.querySelectorAll('.trade-row')];
    const i = rows.findIndex(r => r.classList.contains('selected'));
    if (i < 0) return null;
    const type = currentTradeType();
    const entries = await ensureList(type, i + 1);
    const entry = entries[i];
    const name = rows[i].querySelector('.text-lead')?.textContent.trim();
    return entry && entry.names.includes(name) ? entry.id : null;
  }

  async function missingFor(offer) {
    const counts = new Map();
    for (const it of offer.items || []) {
      const t = it.itemTarget || {};
      if ((t.itemType !== 'Asset' && t.itemType !== 'Bundle') || !t.targetId) continue;
      const key = t.itemType + ':' + t.targetId;
      const prev = counts.get(key);
      counts.set(key, { need: (prev ? prev.need : 0) + 1, name: it.itemName || '', type: t.itemType, id: String(t.targetId) });
    }
    const wanted = [...counts.values()];
    const owned = await Promise.all(wanted.map(({ id, type }) => ownedCount(offer.user.id, id, type)));
    return wanted.filter((w, k) => typeof owned[k] === 'number' && owned[k] < w.need).map(({ name, type, id }) => ({ assetId: id, bundle: type === 'Bundle', name }));
  }

  function renderOwnership(node, label, missing) {
    const key = missing.map(m => m.assetId).join(',');
    if (node.dataset.routilityOwn === key && (!key || node.querySelector('.routility-own-warning'))) return;
    node.dataset.routilityOwn = key;
    node.querySelectorAll('.routility-own-warning, .routility-own-label').forEach(n => n.remove());
    node.querySelectorAll('.routility-own-missing').forEach(n => n.classList.remove('routility-own-missing'));
    if (!missing.length) return;
    const banner = el('div', 'routility-injected routility-own-warning flex items-center gap-small radius-medium text-body-small');
    const icon = el('span', 'routility-own-icon content-system-alert');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>';
    banner.appendChild(icon);
    const text = el('span', 'routility-own-text content-default');
    text.appendChild(el('span', 'content-system-alert routility-own-label-strong', label === 'They no longer own' ? lt('No longer owned') : lt('You no longer own')));
    text.appendChild(document.createTextNode(' ' + missing.map(m => m.name).join(', ')));
    banner.appendChild(text);
    const header = node.querySelector('.trade-list-detail-offer-header');
    if (header) header.after(banner);
    else node.prepend(banner);
    for (const m of missing) {
      for (const card of node.querySelectorAll('.trade-item-card')) {
        if (!(card.querySelector('a[href*="/catalog/"], a[href*="/bundles/"]')?.getAttribute('href') || '').includes(`/${m.bundle ? 'bundles' : 'catalog'}/${m.assetId}/`)) continue;
        card.classList.add('routility-own-missing');
      }
    }
  }

  async function checkOwnership() {
    if (!ownOn) return;
    const offers = [...document.querySelectorAll('.trade-list-detail-offer')];
    if (offers.length !== 2) return;
    if (!/^(Inbound|Outbound)$/.test(currentTradeType())) {
      offers.forEach(o => renderOwnership(o, '', []));
      return;
    }
    const id = await selectedTradeId();
    if (!id) return;
    let result = ownResults.get(id);
    if (!result) {
      const token = ++ownToken;
      ownResults.set(id, null);
      const detail = await rawDetail(id);
      if (!detail || !detail.participantAOffer || !detail.participantBOffer) {
        ownResults.delete(id);
        return;
      }
      if (detail.status && detail.status !== 'Open') {
        ownResults.set(id, { mine: [], theirs: [], at: Date.now() });
        return checkOwnership();
      }
      const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
      const a = detail.participantAOffer;
      const b = detail.participantBOffer;
      const [mine, theirs] = String(b.user?.id) === me ? [b, a] : [a, b];
      const [lostMine, lostTheirs] = await Promise.all([missingFor(mine), missingFor(theirs)]);
      result = { mine: lostMine, theirs: lostTheirs, at: Date.now() };
      ownResults.set(id, result);
      if (token !== ownToken) return;
    }
    if (!result) return;
    const now = [...document.querySelectorAll('.trade-list-detail-offer')];
    if (now.length !== 2 || (await selectedTradeId()) !== id) return;
    renderOwnership(now[0], 'You no longer own', result.mine);
    renderOwnership(now[1], 'They no longer own', result.theirs);
  }

  function relative(ms) {
    const future = ms < 0;
    const s = Math.abs(ms) / 1000;
    const units = [
      [86400 * 365, n => ltn(n, 'in {n} year', 'in {n} years'), n => ltn(n, '{n} year ago', '{n} years ago')],
      [86400 * 30, n => ltn(n, 'in {n} month', 'in {n} months'), n => ltn(n, '{n} month ago', '{n} months ago')],
      [86400 * 7, n => ltn(n, 'in {n} week', 'in {n} weeks'), n => ltn(n, '{n} week ago', '{n} weeks ago')],
      [86400, n => ltn(n, 'in {n} day', 'in {n} days'), n => ltn(n, '{n} day ago', '{n} days ago')],
      [3600, n => ltn(n, 'in {n} hour', 'in {n} hours'), n => ltn(n, '{n} hour ago', '{n} hours ago')],
      [60, n => ltn(n, 'in {n} minute', 'in {n} minutes'), n => ltn(n, '{n} minute ago', '{n} minutes ago')],
    ];
    for (const [size, ahead, ago] of units) {
      const n = Math.floor(s / size);
      if (n >= 1) return future ? ahead(n) : ago(n);
    }
    return future ? lt('in under a minute') : lt('just now');
  }

  function stamp(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function dateRow(row, entry) {
    if (!ageOn || !entry.created) return;
    const node = row.querySelector('.trade-sent-date');
    if (!node || node.dataset.routilityAge === entry.id + ':' + node.textContent) return;
    const sent = new Date(entry.created).getTime();
    if (!(sent > 0)) return;
    const text = relative(Date.now() - sent).replace(/^\w/, c => c.toUpperCase());
    const parts = [lt('Sent {date}', { date: stamp(entry.created) })];
    if (entry.active && entry.expiration) {
      const left = new Date(entry.expiration).getTime() - Date.now();
      if (left > 0) parts.push(lt('Expires {time}', { time: relative(-left) }));
    }
    node.textContent = text;
    node.dataset.routilityAge = entry.id + ':' + text;
    node.dataset.rtTip = parts.join(' • ');
  }

  const FILTER_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none pointer-events-none';
  let filterQuery = '';
  let filterOn = true;
  let navOn = true;
  let names = null;
  chrome.storage.local.get('routilitySettings', (s) => {
    filterOn = (s.routilitySettings || {}).tradeFilter !== false;
    navOn = (s.routilitySettings || {}).tradeKeys !== false;
  });

  function itemNames() {
    if (!names) {
      names = catalogItems().then(list => new Map((list || []).map(i => ['id:' + i.id, i.name.toLowerCase()])));
      names.then((map) => { if (!map.size) names = null; });
    }
    return names;
  }

  function ensureFilter() {
    if (!filterOn) return;
    const chips = document.querySelector('.trade-row-list > .trade-filter-chips');
    if (!chips) return;
    if (chips.nextElementSibling?.classList.contains('routility-trade-filter')) return;
    document.querySelectorAll('.routility-trade-filter').forEach(n => n.remove());
    const box = el('div', 'routility-injected routility-trade-filter');
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis');
    field.appendChild(el('div', FILTER_LAYER));
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-emphasis');
    glass.setAttribute('aria-hidden', 'true');
    field.appendChild(glass);
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted text-body-medium placeholder:text-body-medium routility-trade-filter-input');
    input.type = 'search';
    input.placeholder = lt('Filter by item');
    input.setAttribute('aria-label', lt('Filter trades by item'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = filterQuery;
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filterQuery = input.value.trim().toLowerCase();
        applyFilter();
      }, 200);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        filterQuery = '';
        applyFilter();
      }
    });
    field.appendChild(input);
    box.appendChild(field);
    box.appendChild(el('div', 'text-body-small content-muted routility-trade-filter-note'));
    chips.after(box);
  }

  let filterToken = 0;
  let filterBusy = false;

  async function loadOlderRows(token, type) {
    const list = tradeLists.get(type);
    const before = document.querySelectorAll('.trade-row').length;
    if (list && list.done && list.entries.length <= before) return false;
    const scroller = document.querySelector('#trade-row-scroll-container');
    if (!scroller) return false;
    const keep = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll'));
    let grew = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (token !== filterToken) break;
      if (document.querySelectorAll('.trade-row').length > before) {
        grew = true;
        break;
      }
    }
    scroller.scrollTop = keep;
    return grew && token === filterToken;
  }

  async function applyFilter() {
    const token = ++filterToken;
    const note = document.querySelector('.routility-trade-filter-note');
    if (!filterQuery) {
      filterBusy = false;
      document.querySelectorAll('.trade-row').forEach(r => r.classList.remove('routility-trade-hidden'));
      if (note) note.textContent = '';
      return;
    }
    const words = filterQuery.split(/\s+/);
    const type = currentTradeType();
    const label = (shown, rows, more) => {
      const vars = { n: formatNumber(shown), query: filterQuery, count: formatNumber(rows) };
      if (more) {
        return shown
          ? ltn(shown, '{n} trade with "{query}" • checked {count} trades, loading older ones…', '{n} trades with "{query}" • checked {count} trades, loading older ones…', vars)
          : lt('Looking for "{query}" • checked {count} trades, loading older ones…', vars);
      }
      return shown ? ltn(shown, '{n} trade with "{query}"', '{n} trades with "{query}"', vars) : lt('No trades with "{query}"', vars);
    };
    let shown = 0;
    let rows = [];
    let refetched = false;
    filterBusy = true;
    try {
    for (;;) {
      rows = [...document.querySelectorAll('.trade-row')];
      const rowName = row => row.querySelector('.text-lead')?.textContent.trim();
      const lined = list => rows.every((row, i) => list[i] && list[i].names.includes(rowName(row)));
      let [entries, map] = await Promise.all([ensureList(type, rows.length), itemNames()]);
      if (token !== filterToken) return;
      if (!lined(entries) && !refetched) {
        refetched = true;
        tradeLists.delete(type);
        entries = await ensureList(type, rows.length + 10);
        if (token !== filterToken) return;
      }
      const matched = [];
      let next = 0;
      for (const row of rows) {
        const name = rowName(row);
        let k = next;
        while (k < entries.length && k < next + 10 && !entries[k].names.includes(name)) k++;
        if (k < entries.length && entries[k].names.includes(name)) {
          matched.push(entries[k]);
          next = k + 1;
        } else {
          matched.push(null);
        }
      }
      shown = 0;
      await Promise.all(rows.map(async (row, i) => {
        const entry = matched[i];
        if (!entry) {
          row.classList.add('routility-trade-hidden');
          return;
        }
        const detail = tradeDetails.has(entry.id) ? tradeDetails.get(entry.id) : await loadDetail(entry.id);
        if (token !== filterToken || !row.isConnected) return;
        const keys = detail ? [...detail.give, ...detail.get] : [];
        const hay = keys.map(k => (k.startsWith('name:') ? k.slice(5) : map.get(k) || '')).join(' | ');
        const match = words.every(w => hay.includes(w));
        row.classList.toggle('routility-trade-hidden', !match);
        if (match) shown++;
        if (note) note.textContent = label(shown, rows.length, true);
      }));
      if (token !== filterToken) return;
      if (note) note.textContent = label(shown, rows.length, true);
      if (!(await loadOlderRows(token, type))) break;
    }
    } finally {
      if (token === filterToken) {
        filterBusy = false;
        lastFilterRows = document.querySelectorAll('.trade-row').length;
      }
    }
    if (token !== filterToken) return;
    if (note) note.textContent = label(shown, rows.length, false);
  }

  function onTradeKeys(e) {
    if (!navOn || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('[role="dialog"][data-state="open"], .modal.in')) return;
    const rows = [...document.querySelectorAll('.trade-row')].filter(r => !r.classList.contains('routility-trade-hidden') && r.offsetParent);
    if (!rows.length) return;
    const i = rows.findIndex(r => r.classList.contains('selected'));
    const next = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next || next === rows[i]) return;
    e.preventDefault();
    next.click();
    next.scrollIntoView({ block: 'nearest' });
  }

  let previewOn = true;
  let warnOn = true;
  let warnAt = 0.15;
  let summaryOn = true;
  let lastRequest = null;
  chrome.storage.local.get('routilitySettings', (st) => {
    previewOn = (st.routilitySettings || {}).tradePreview !== false;
    summaryOn = (st.routilitySettings || {}).tradeSendSummary !== false;
    warnOn = (st.routilitySettings || {}).tradeWarning !== false;
    warnAt = (Number((st.routilitySettings || {}).tradeWarnAt) || 15) / 100;
  });
  let catalog = null;
  let preview = null;
  let previewTimer = null;
  let previewRow = null;

  let catalogList = null;

  function catalogItems() {
    if (!catalogList) {
      catalogList = window.RoUtilityUI.request({ type: 'calcItems' }, r => Array.isArray(r));
      catalogList.then((list) => { if (!Array.isArray(list) || !list.length) catalogList = null; });
    }
    return catalogList;
  }

  function catalogMap() {
    if (!catalog) {
      catalog = catalogItems().then((list) => {
        const map = new Map((list || []).map(i => [i.id, i]));
        map.lookup = window.RoUtilityUI.catalogFor(list || []);
        return map;
      });
      catalog.then((map) => { if (!map.size) catalog = null; });
    }
    return catalog;
  }

  function offerItemKey(it) {
    const t = it.itemTarget || {};
    return { bundle: t.itemType === 'Bundle', targetId: String(t.targetId || '') };
  }

  function closePreview() {
    clearTimeout(previewTimer);
    preview?.remove();
    preview = null;
  }

  function previewSide(label, offer, map) {
    const box = el('div', 'flex flex-col gap-xsmall');
    const items = (offer.items || []).map(it => {
      const k = offerItemKey(it);
      const c = map.lookup ? map.lookup(k) : map.get(k.targetId);
      return { name: it.itemName || (c && c.name) || '', usd: c && c.usd > 0 ? c.usd : 0, value: c ? c.value : 0, rap: Number(it.recentAveragePrice) || (c ? c.rap : 0), thumb: c ? c.thumb : '', thumbKey: (k.bundle ? 'b' : '') + k.targetId };
    });
    const usd = items.reduce((n, i) => n + i.usd, 0);
    const head = el('div', 'flex items-center justify-between gap-medium');
    head.appendChild(el('span', 'text-label-small content-muted', label));
    head.appendChild(el('span', 'text-label-medium content-emphasis', `${usdAmount(usd)}${offer.robux > 0 ? ' + R$ ' + formatNumber(offer.robux) : ''}`));
    box.appendChild(head);
    const row = el('div', 'flex items-center gap-xsmall flex-wrap');
    for (const i of items) {
      const t = el('span', 'thumbnail-2d-container routility-tp-thumb');
      if (i.thumb) {
        const img = el('img');
        img.alt = '';
        img.src = i.thumb;
        t.appendChild(img);
      } else if (/^b?\d+$/.test(i.thumbKey)) {
        t.dataset.thumbKey = i.thumbKey;
      }
      t.dataset.rtTip = `${i.name} • ${i.usd > 0 ? formatUSD(i.usd) : lt('No price')}` + (itemValue(i) ? ' • ' + lt('Value {value}', { value: formatNumber(itemValue(i)) }) : '');
      row.appendChild(t);
    }
    if (offer.robux > 0) {
      const r = el('span', 'routility-tp-thumb routility-tp-robux');
      r.append(el('span', 'icon-robux-16x16'));
      r.dataset.rtTip = ltn(offer.robux, '{n} Robux', '{n} Robux', { n: formatNumber(offer.robux) });
      row.appendChild(r);
    }
    if (!items.length && !(offer.robux > 0)) row.appendChild(el('span', 'text-body-small content-muted', lt('Nothing')));
    box.appendChild(row);
    return { node: box, usd: usd + (Number(offer.robux) || 0) * robuxRate };
  }

  async function openPreview(row, entry) {
    closePreview();
    const pop = el('div', 'routility-injected routility-trade-preview bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'tooltip');
    pop.appendChild(el('span', 'routility-sk routility-tp-sk'));
    preview = pop;
    document.body.appendChild(pop);
    const place = () => {
      const r = row.getBoundingClientRect();
      const vh = document.documentElement.clientHeight;
      pop.style.left = Math.round(r.right + 10) + 'px';
      pop.style.top = Math.round(Math.max(8, Math.min(vh - pop.offsetHeight - 8, r.top))) + 'px';
    };
    place();
    const [detail, map] = await Promise.all([rawDetail(entry.id), catalogMap()]);
    if (preview !== pop) return;
    if (!detail || !detail.participantAOffer) return closePreview();
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const a = detail.participantAOffer;
    const b = detail.participantBOffer;
    const [mine, theirs] = String(b.user?.id) === me ? [b, a] : [a, b];
    pop.textContent = '';
    const give = previewSide(lt('You give'), mine, map);
    const get = previewSide(lt('You receive'), theirs, map);
    pop.append(give.node, get.node);
    const need = [...pop.querySelectorAll('[data-thumb-key]')];
    if (need.length) {
      window.RoUtilityUI.request({ type: 'getAssetThumbs', ids: need.map(n => n.dataset.thumbKey) }).then((thumbs) => {
        if (preview !== pop || !thumbs) return;
        for (const n of need) {
          const src = thumbs[n.dataset.thumbKey];
          if (!src || n.querySelector('img')) continue;
          const img = el('img');
          img.alt = '';
          img.src = src;
          n.appendChild(img);
        }
      });
    }
    const diff = get.usd - give.usd;
    if (give.usd > 0 || get.usd > 0) {
      const line = el('div', 'flex items-center justify-between gap-medium routility-tp-foot');
      line.appendChild(el('span', 'text-label-small content-muted', lt('Difference')));
      line.appendChild(el('span', 'text-label-medium ' + (Math.abs(diff) < 0.005 ? 'content-emphasis' : diff > 0 ? 'content-system-success' : 'content-system-alert'), `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${usdAmount(Math.abs(diff))}`));
      pop.appendChild(line);
    }
    place();
  }

  async function onRowOver(e) {
    if (!previewOn) return;
    const row = e.target.closest?.('.trade-row');
    if (!row || row === previewRow) return;
    previewRow = row;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      if (!row.matches(':hover')) return;
      const rows = [...document.querySelectorAll('.trade-row')];
      const i = rows.indexOf(row);
      const entries = await ensureList(currentTradeType(), i + 1);
      const entry = entries[i];
      const name = row.querySelector('.text-lead')?.textContent.trim();
      if (!entry || !entry.names.includes(name) || !row.matches(':hover')) return;
      openPreview(row, entry);
    }, 450);
  }

  function onRowOut(e) {
    const row = e.target.closest?.('.trade-row');
    if (!row) return;
    if (e.relatedTarget && row.contains(e.relatedTarget)) return;
    if (row === previewRow) previewRow = null;
    closePreview();
  }

  function tradeWarning(offers, totals) {
    const offer = offers[0];
    if (!offer) return;
    const give = totals[0].usd;
    const get = totals[1].usd;
    const over = give > 0 && get >= 0 ? (give - get) / Math.max(get, 0.01) : 0;
    let banner = offer.querySelector('.routility-trade-warn');
    if (!warnOn || !(give > 0) || totals[0].missing || totals[1].missing || over < warnAt) {
      banner?.remove();
      return;
    }
    const vars = { pct: Math.round(over * 100) > 999 ? '999+' : Math.round(over * 100), give: formatUSD(give), get: formatCash(get) };
    const text = get > 0 ? lt('You\'re giving {pct}% more value ({give} vs {get})', vars) : lt('You\'re giving value for nothing back ({give} vs {get})', vars);
    if (banner && banner.dataset.text === text) return;
    if (!banner) {
      banner = el('div', 'routility-injected routility-own-warning routility-trade-warn flex items-center gap-small radius-medium text-body-small');
      const icon = el('span', 'routility-own-icon content-system-alert');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>';
      banner.appendChild(icon);
      banner.appendChild(el('span', 'routility-own-text content-default'));
      const header = offer.querySelector(':scope > h2, :scope > h3');
      if (header) header.after(banner);
      else offer.prepend(banner);
    }
    banner.dataset.text = text;
    banner.querySelector('.routility-own-text').textContent = text;
  }

  function sendDialog() {
    return [...document.querySelectorAll('[role="dialog"][data-state="open"]')].find(d => d.querySelector('h2')?.textContent.trim() === 'Send offer') || null;
  }

  function sendSummary() {
    const dialog = sendDialog();
    if (!dialog || !summaryOn || !lastRequest || dialog.querySelector('.routility-send-summary')) return;
    const head = dialog.querySelector('h2')?.parentElement;
    if (!head) return;
    const { totals, rap, items } = lastRequest;
    const rapFmt = window.RoUtilityUI.formatNumber;
    const usdKnown = totals[0].priced > 0 || totals[1].priced > 0;
    const give = usdKnown ? totals[0].usd : rap[0] || 0;
    const get = usdKnown ? totals[1].usd : rap[1] || 0;
    const fmt = usdKnown ? usdAmount : rapFmt;
    const anyValued = show.value && (totals[0].valued || 0) + (totals[1].valued || 0) > 0;
    const box = el('div', 'routility-injected routility-send-summary padding-x-xlarge padding-bottom-large');
    const sides = el('div', 'routility-send-sides');
    const side = (label, i) => {
      const card = el('div', 'routility-send-side');
      card.appendChild(el('div', 'text-label-small content-muted routility-send-label', label));
      const line = (iconNode, name, value) => {
        const r = el('div', 'routility-send-line text-body-medium');
        const left = el('span', 'routility-send-key content-default');
        left.appendChild(iconNode);
        left.appendChild(document.createTextNode(name));
        r.appendChild(left);
        r.appendChild(el('span', 'content-emphasis routility-send-value', value));
        return r;
      };
      const logoIcon = el('img', 'routility-send-icon');
      logoIcon.src = LOGO_URL;
      logoIcon.alt = '';
      card.appendChild(line(logoIcon, lt('Price'), totals[i].priced ? formatUSD(totals[i].usd) + (totals[i].missing ? '+' : '') : (totals[i].missing ? lt('Unpriced') : formatCash(0))));
      if (anyValued) {
        const valIcon = el('span', 'routility-val-icon routility-send-icon routility-send-val-icon');
        valIcon.setAttribute('aria-hidden', 'true');
        const v = line(valIcon, lt('Value'), '');
        v.querySelector('.routility-send-value').replaceWith(valueTag(totals[i].value, { className: 'routility-send-value', tip: false }));
        card.appendChild(v);
      }
      card.appendChild(line(el('span', 'icon-robux-16x16 routility-send-icon'), 'RAP', rap[i] === null ? '—' : rapFmt(rap[i])));
      return card;
    };
    sides.appendChild(side(ltn(items[0], 'You give • {n} item', 'You give • {n} items'), 0));
    sides.appendChild(side(ltn(items[1], 'You receive • {n} item', 'You receive • {n} items'), 1));
    box.appendChild(sides);
    const diff = get - give;
    const base = diff < 0 ? get : give;
    const pct = base > 0 ? Math.round(Math.abs(diff) / base * 100) : null;
    const amounts = { give: fmt(-diff), get: fmt(diff), pct: pct > 999 ? '>999' : pct };
    const over = give > 0 ? (give - get) / Math.max(get, 0.01) : 0;
    const tone = Math.abs(diff) < (usdKnown ? 0.005 : 1) ? 'even' : diff < 0 ? 'over' : 'win';
    const verdict = el('div', `routility-send-verdict routility-send-${tone} text-body-small`);
    verdict.textContent = tone === 'even' ? lt('Both sides are worth about the same')
      : tone === 'over' ? (pct === null ? lt('You’re giving {give} more', amounts) : lt('You’re giving {give} more ({pct}%)', amounts))
        : (pct === null ? lt('You’re getting {get} more', amounts) : lt('You’re getting {get} more ({pct}%)', amounts));
    if (totals[0].missing || totals[1].missing) verdict.dataset.rtTip = lt('Items without a RoUtility price aren’t counted');
    box.appendChild(verdict);
    if (anyValued) {
      const vd = totals[1].value - totals[0].value;
      const row = el('div', 'routility-send-valdiff text-body-small content-muted');
      row.appendChild(el('span', null, lt('Value difference')));
      row.appendChild(valueTag(Math.abs(vd), { sign: vd > 0 ? '+' : vd < 0 ? '−' : '', tip: false }));
      row.dataset.rtTip = lt('Only items with a RoUtility value are counted');
      box.appendChild(row);
    }
    if (warnOn && tone === 'over' && over >= warnAt) {
      const id = 'routility-send-review';
      const check = el('div', 'checkbox routility-send-check');
      const input = el('input');
      input.type = 'checkbox';
      input.id = id;
      const label = el('label', 'checkbox-label text-label', lt('I’ve reviewed this trade'));
      label.htmlFor = id;
      check.append(input, label);
      box.appendChild(check);
      dialog.dataset.routilityLocked = '1';
      input.addEventListener('change', () => {
        if (input.checked) delete dialog.dataset.routilityLocked;
        else dialog.dataset.routilityLocked = '1';
      });
    }
    head.after(box);
  }

  function guardSend(e) {
    const btn = e.target.closest?.('[role="dialog"][data-routility-locked="1"] .foundation-web-button.bg-action-emphasis');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const check = btn.closest('[role="dialog"]').querySelector('.routility-send-check');
    if (!check) return;
    check.classList.remove('routility-send-nudge');
    void check.offsetWidth;
    check.classList.add('routility-send-nudge');
  }

  let dialogWatch = null;

  async function scanRows() {
    const rows = [...document.querySelectorAll('.trade-row')];
    if (!rows.length) return;
    const type = currentTradeType();
    const entries = await ensureList(type, rows.length);
    if (type !== currentTradeType()) return;
    const view = scrollParent(rows[0])?.getBoundingClientRect() || { top: 0, bottom: innerHeight };
    const plan = rows.map((row, i) => {
      const entry = entries[i];
      const name = row.querySelector('.text-lead')?.textContent.trim();
      const old = row.querySelector('.routility-row-pills');
      const known = !!entry && entry.names.includes(name);
      const done = known && old && old.dataset.tradeId === entry.id;
      const rect = known && !done && !tradeDetails.has(entry.id) ? row.getBoundingClientRect() : null;
      return { row, entry, known, done, rect };
    });
    for (const { row, entry, known, done, rect } of plan) {
      if (!known) {
        row.querySelectorAll('.routility-row-pills').forEach(n => n.remove());
        continue;
      }
      dateRow(row, entry);
      if (!valuesOn) {
        row.querySelectorAll('.routility-row-pills').forEach(n => n.remove());
        continue;
      }
      if (done) continue;
      const near = !rect || (rect.bottom > view.top - 300 && rect.top < view.bottom + 600);
      if (near && row.dataset.rtPending !== entry.id) {
        row.dataset.rtPending = entry.id;
        annotateRow(row, entry).finally(() => { if (row.dataset.rtPending === entry.id) delete row.dataset.rtPending; });
      }
    }
  }

  let scrollTimer = 0;
  const onScrollRows = () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = 0;
      scanRows();
    }, 120);
  };

  let scroller = null;

  function scrollParent(node) {
    if (scroller && scroller.el.isConnected && scroller.el.contains(node)) return scroller.el;
    const found = findScrollParent(node);
    if (found) scroller = { el: found };
    return found;
  }

  function findScrollParent(node) {
    for (let n = node?.parentElement; n && n !== document.body; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  }

  let searchOn = true;
  const searchReady = new Promise((done) => {
    try {
      chrome.storage.local.get('routilitySettings', (st) => {
        searchOn = (st.routilitySettings || {}).tradeSearch !== false;
        done();
      });
    } catch {
      done();
    }
  });

  function initials(name) {
    return String(name || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean).map(w => w[0]).join('');
  }

  function tradeMatch(q, name, acr) {
    const n = String(name || '').toLowerCase();
    const a = String(acr || '').toLowerCase();
    if (!q) return 0;
    if (a && a === q) return 3;
    if (n.startsWith(q)) return 2;
    if (q.length >= 2 && a && a.startsWith(q)) return 2;
    if (q.length >= 2 && initials(name).startsWith(q)) return 1;
    return n.includes(q) ? 1 : 0;
  }

  async function matchList(q, items) {
    const map = await catalogMap();
    const query = String(q || '').trim().toLowerCase();
    return items.map((it, i) => {
      const k = offerItemKey(it || {});
      const c = map.lookup ? map.lookup(k) : map.get(k.targetId);
      const name = (it && it.itemName) || (c && c.name) || '';
      return { i, name, acr: (c && c.acr) || '', usd: c && c.usd > 0 ? c.usd : 0, key: (k.bundle ? 'b' : '') + k.targetId, score: tradeMatch(query, name, c && c.acr) };
    });
  }

  const matchAsked = new Set();
  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-trade-match') return;
    const { id, items, q } = e.data;
    if (typeof id !== 'string' || !Array.isArray(items) || matchAsked.has(id)) return;
    matchAsked.add(id);
    const reply = data => window.postMessage(Object.assign({ type: 'routility-trade-match-done', id }, data), location.origin);
    await searchReady;
    if (!searchOn) return reply({ on: false });
    if (!items.length) return reply({ on: true, keep: [] });
    const scored = await matchList(q, items);
    reply({ on: true, keep: scored.filter(x => x.score > 0).map(x => x.i) });
  });

  const invLists = new Map();

  function tradeList(userId) {
    if (!invLists.has(userId)) {
      invLists.set(userId, new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const done = (e) => {
          if (e.source !== window || !e.data || e.data.type !== 'routility-trade-list-done' || e.data.id !== id) return;
          window.removeEventListener('message', done);
          clearTimeout(timer);
          if (!Array.isArray(e.data.items)) invLists.delete(userId);
          resolve(Array.isArray(e.data.items) ? e.data.items : null);
        };
        const timer = setTimeout(() => {
          window.removeEventListener('message', done);
          invLists.delete(userId);
          resolve(null);
        }, 30000);
        window.addEventListener('message', done);
        window.postMessage({ type: 'routility-trade-list', id, userId }, location.origin);
      }));
    }
    return invLists.get(userId);
  }

  function panelUser(panel) {
    const panels = [...document.querySelectorAll('.trade-request-window .trade-inventory-panel')];
    const index = panels.indexOf(panel);
    if (index === 0) return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
    const path = location.pathname.match(/^\/users\/(\d+)\/trade/i);
    if (path) return path[1];
    const link = [...document.querySelectorAll('.trade-request-window a[href*="/users/"]')].map(a => (a.getAttribute('href') || '').match(/\/users\/(\d+)\//)).find(Boolean);
    return link ? link[1] : '';
  }

  let suggest = null;

  function closeSuggest() {
    suggest?.pop.remove();
    suggest = null;
  }

  function setSearch(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function showSuggest(input) {
    const panel = input.closest('.trade-inventory-panel');
    const q = input.value.trim().toLowerCase();
    if (!panel || q.length < 2) return closeSuggest();
    const userId = panelUser(panel);
    if (!userId) return closeSuggest();
    const items = await tradeList(userId);
    if (!items || input.value.trim().toLowerCase() !== q || document.activeElement !== input) return;
    const scored = (await matchList(q, items)).filter(x => x.score > 0);
    const seen = new Set();
    const list = scored.sort((a, b) => b.score - a.score || b.usd - a.usd).filter((x) => {
      if (seen.has(x.name)) return false;
      seen.add(x.name);
      return true;
    }).slice(0, 6);
    if (!list.length || (list.length === 1 && list[0].name.toLowerCase() === q)) return closeSuggest();
    if (!suggest || suggest.input !== input) {
      closeSuggest();
      const pop = el('ul', 'routility-injected routility-ts-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
      pop.setAttribute('role', 'listbox');
      document.body.appendChild(pop);
      suggest = { input, pop, rows: [], at: -1 };
    }
    const s = suggest;
    s.pop.textContent = '';
    s.rows = list;
    s.at = -1;
    list.forEach((x) => {
      const li = el('li', 'routility-ts-row');
      li.setAttribute('role', 'option');
      const thumb = el('span', 'thumbnail-2d-container routility-ts-thumb');
      thumb.dataset.thumbKey = x.key;
      const text = el('span', 'routility-ts-text');
      text.appendChild(el('span', 'text-body-medium content-emphasis text-overflow', x.name));
      if (x.acr) text.appendChild(el('span', 'routility-ts-acr text-label-small', x.acr));
      li.append(thumb, text);
      if (x.usd) li.appendChild(el('span', 'text-body-small content-muted routility-ts-usd', formatUSD(x.usd)));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        setSearch(input, x.name);
        closeSuggest();
      });
      s.pop.appendChild(li);
    });
    const r = input.closest('.foundation-web-input').getBoundingClientRect();
    s.pop.style.left = Math.round(r.left) + 'px';
    s.pop.style.top = Math.round(r.bottom + 6) + 'px';
    s.pop.style.width = Math.round(r.width) + 'px';
    const keys = list.map(x => x.key);
    window.RoUtilityUI.request({ type: 'getAssetThumbs', ids: keys }).then((thumbs) => {
      if (suggest !== s || !thumbs) return;
      s.pop.querySelectorAll('[data-thumb-key]').forEach((n) => {
        if (!thumbs[n.dataset.thumbKey] || n.querySelector('img')) return;
        const img = el('img');
        img.alt = '';
        img.src = thumbs[n.dataset.thumbKey];
        n.appendChild(img);
      });
    });
  }

  let suggestTimer = 0;

  function onSearchInput(e) {
    const input = e.target;
    if (input instanceof HTMLInputElement && input.closest('.trade-request-window .robux-input-group')) {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(schedule, 250);
      return;
    }
    if (!(input instanceof HTMLInputElement) || !searchOn || !input.closest('.trade-request-window .inventory-search')) return;
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => showSuggest(input), 120);
  }

  function onSearchKey(e) {
    const s = suggest;
    if (!s || e.target !== s.input) return;
    const rows = [...s.pop.children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      s.at = (s.at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows.forEach((n, i) => n.classList.toggle('routility-ts-on', i === s.at));
    } else if (e.key === 'Enter' && s.at >= 0) {
      e.preventDefault();
      setSearch(s.input, s.rows[s.at].name);
      closeSuggest();
    } else if (e.key === 'Escape') {
      closeSuggest();
    }
  }

  function onSearchBlur(e) {
    if (suggest && e.target === suggest.input) setTimeout(closeSuggest, 120);
  }

  let sortOn = true;
  const sortReady = new Promise((done) => {
    try {
      chrome.storage.local.get('routilitySettings', (st) => {
        sortOn = (st.routilitySettings || {}).tradeSort !== false;
        done();
      });
    } catch {
      done();
    }
  });
  const worthAsked = new Set();

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-trade-worth') return;
    const { id, items } = e.data;
    if (typeof id !== 'string' || !Array.isArray(items) || worthAsked.has(id)) return;
    worthAsked.add(id);
    const reply = data => window.postMessage(Object.assign({ type: 'routility-trade-worth-done', id }, data), location.origin);
    await sortReady;
    if (!sortOn) return reply({ on: false });
    const keys = items.map(it => (it && typeof it === 'object' ? offerPriceKey(it) : null));
    let got = [];
    for (let tries = 0; tries < 4; tries++) {
      got = keys.some(Boolean) ? await prices(keys) : [];
      if (!got.some(p => p === undefined)) break;
      await new Promise(r => setTimeout(r, 1500));
    }
    reply({ on: true, worth: items.map((it, i) => (got[i] && Number.isFinite(got[i].usd) ? got[i].usd : (Number(it && it.recentAveragePrice) || 0) * robuxRate)) });
  });

  let cleanOn = true;
  let robuxRate = 0.0038;
  chrome.storage.local.get('routilitySettings', (st) => {
    const s = st.routilitySettings || {};
    cleanOn = s.tradeCleanup !== false;
    robuxRate = window.RoUtilityUI.robuxRate(s);
  });

  const BROOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 3.5 13 10"/><path d="M11.2 9.3l3.5 3.5c.6.6.6 1.4 0 2l-.9.9-5.5-5.5.9-.9c.6-.6 1.4-.6 2 0z"/><path d="M8.3 10.2 4 14.5c1.4 3.2 3.4 5.2 6.5 6.5l4.3-4.3"/><path d="M7.5 17.5l2-2"/></svg>';
  const CLEAN = [
    { type: 'inbound', kind: 'overpay', title: LT('Decline Overpays'), desc: LT('Trades where you’d give more value than you get') },
    { type: 'inbound', kind: 'unowned', title: LT('Decline Unowned Items'), desc: LT('Trades with an item either of you no longer owns') },
    { type: 'inbound', kind: 'all', title: LT('Decline All'), desc: LT('Every inbound trade') },
    { type: 'outbound', kind: 'overpay', title: LT('Cancel Overpays'), desc: LT('Trades where you’d give more value than you get') },
    { type: 'outbound', kind: 'unowned', title: LT('Cancel Unowned Items'), desc: LT('Trades with an item either of you no longer owns') },
    { type: 'outbound', kind: 'all', title: LT('Cancel All'), desc: LT('Every outbound trade') },
  ];
  const CLEAN_ICONS = {
    overpay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg>',
    unowned: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/><path d="M3 3l18 18"/></svg>',
    all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  let csrf = '';

  function ensureCleanButton() {
    const actions = document.querySelector('.trades-header .trades-header-actions');
    const has = actions && actions.querySelector('.routility-clean-btn');
    if (!cleanOn || !actions) { has?.remove(); return; }
    if (has) return;
    const b = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center padding-none stroke-none select-none size-1000 radius-medium bg-action-link routility-injected routility-clean-btn');
    b.type = 'button';
    b.setAttribute('aria-label', lt('Clean Up Trades'));
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none');
    layer.setAttribute('aria-hidden', 'true');
    const icon = el('span', 'size-600 content-emphasis routility-clean-icon');
    icon.innerHTML = BROOM;
    b.append(layer, icon);
    b.addEventListener('click', openCleanup);
    actions.prepend(b);
  }

  async function listAll(type) {
    const out = [];
    let cursor = '';
    for (let page = 0; page < 30; page++) {
      const d = await robloxJson(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=100&cursor=${encodeURIComponent(cursor)}`);
      if (!d || !Array.isArray(d.data)) return page ? out : null;
      for (const t of d.data) out.push({ id: String(t.id), name: t.user?.displayName || t.user?.name || '', user: t.user?.name || '', userId: t.user?.id });
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  async function offerValue(offer) {
    const items = offer.items || [];
    const keys = items.map(offerPriceKey);
    const got = keys.some(Boolean) ? await prices(keys) : [];
    let usd = (Number(offer.robux) || 0) * robuxRate;
    items.forEach((it, i) => {
      const p = got[i];
      usd += p && Number.isFinite(p.usd) ? p.usd : (Number(it.recentAveragePrice) || 0) * robuxRate;
    });
    return usd;
  }

  async function judge(entry, kind) {
    if (kind === 'all') return { hit: true };
    const d = await rawDetail(entry.id);
    if (!d || !d.participantAOffer || !d.participantBOffer) return { hit: false, failed: true };
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const [mine, theirs] = String(d.participantBOffer.user?.id) === me ? [d.participantBOffer, d.participantAOffer] : [d.participantAOffer, d.participantBOffer];
    if (kind === 'overpay') {
      const [give, get] = await Promise.all([offerValue(mine), offerValue(theirs)]);
      return { hit: give > get * 1.005 && give - get >= 0.01, give, get };
    }
    const [a, b] = await Promise.all([missingFor(mine), missingFor(theirs)]);
    const lost = [...a, ...b].map(m => m.name).filter(Boolean);
    return { hit: lost.length > 0, lost };
  }

  async function declineTrade(id) {
    for (let i = 0; i < 6; i++) {
      try {
        const r = await fetch(`https://trades.roblox.com/v1/trades/${id}/decline`, { method: 'POST', credentials: 'include', headers: csrf ? { 'x-csrf-token': csrf } : {} });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { csrf = r.headers.get('x-csrf-token'); continue; }
        if (r.status === 429) {
          const wait = Number(r.headers.get('Retry-After'));
          await new Promise(res => setTimeout(res, Number.isFinite(wait) && wait > 0 ? wait * 1000 : 5000 * (i + 1)));
          continue;
        }
        return r.ok;
      } catch {
        await new Promise(res => setTimeout(res, 1500));
      }
    }
    return false;
  }

  function openCleanup() {
    document.querySelector('.routility-clean-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-clean-backdrop');
    const modal = el('div', 'routility-modal routility-clean-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-clean-titlebox');
    const title = el('h2', 'routility-modal-title', lt('Clean Up Trades'));
    const sub = el('span', 'text-body-medium content-muted', lt('Decline or cancel a batch of trades at once.'));
    titleBox.append(title, sub);
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, close);
    const body = el('div', 'routility-modal-body routility-clean-body');
    const foot = el('div', 'routility-clean-foot');
    modal.append(head, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    let job = null;
    let declining = false;
    let changed = false;
    const stopJob = () => {
      if (job) job.stop = true;
      job = null;
    };
    const shut = () => {
      stopJob();
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
      if (changed && !declining) location.reload();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const lists = { inbound: listAll('inbound'), outbound: listAll('outbound') };
    const btn = (text, cls, onClick) => {
      const b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    };

    function menu() {
      title.textContent = lt('Clean Up Trades');
      sub.textContent = lt('Decline or cancel a batch of trades at once.');
      body.textContent = '';
      foot.textContent = '';
      foot.hidden = true;
      for (const type of ['inbound', 'outbound']) {
        const sec = el('section', 'routility-clean-section');
        const h = el('div', 'routility-clean-section-head');
        const count = el('span', 'text-caption-medium content-muted routility-clean-count');
        count.appendChild(el('span', 'routility-clean-count-sk'));
        h.append(el('span', 'text-label-large content-emphasis', type === 'inbound' ? lt('Inbound') : lt('Outbound')), count);
        sec.appendChild(h);
        const rows = [];
        for (const a of CLEAN.filter(x => x.type === type)) {
          const row = el('button', 'routility-clean-row');
          row.type = 'button';
          const tile = el('span', 'routility-clean-tile' + (a.kind === 'all' ? ' routility-clean-tile-alert' : ''));
          const glyph = el('span', 'routility-clean-glyph');
          glyph.innerHTML = CLEAN_ICONS[a.kind];
          tile.appendChild(glyph);
          const txt = el('span', 'routility-clean-row-text');
          txt.append(el('span', 'text-label-medium content-emphasis', lt(a.title)), el('span', 'text-caption-medium content-muted', lt(a.desc)));
          row.append(tile, txt, el('span', 'icon icon-regular-chevron-large-right size-400 content-muted'));
          row.addEventListener('click', () => run(a));
          rows.push(row);
          sec.appendChild(row);
        }
        lists[type].then(l => {
          count.textContent = l ? ltn(l.length, '{n} trade', '{n} trades', { n: formatNumber(l.length) }) : lt('Couldn’t load');
          if (!l || !l.length) rows.forEach(r => { r.disabled = true; });
        });
        body.appendChild(sec);
      }
    }

    async function run(a) {
      const verb = a.type === 'inbound' ? 'Decline' : 'Cancel';
      title.textContent = lt(a.title);
      sub.textContent = lt(a.desc) + '.';
      body.textContent = '';
      foot.textContent = '';
      foot.hidden = false;
      const status = el('div', 'text-body-medium content-default routility-clean-status', lt('Loading your trades'));
      const bar = el('div', 'routility-clean-bar');
      const fill = el('span');
      bar.appendChild(fill);
      body.append(status, bar);
      const back = btn(lt('Back'), 'btn-secondary-md btn-min-width', () => {
        if (declining) return;
        stopJob();
        menu();
      });
      foot.appendChild(back);
      const me = { stop: false };
      job = me;
      const list = await lists[a.type];
      if (me.stop) return;
      if (!list) { job = null; status.textContent = lt('Roblox didn’t send your trades. Try again in a moment.'); bar.remove(); return; }
      const hits = [];
      let failed = 0;
      let done = 0;
      const queue = list.slice();
      const progress = () => {
        status.textContent = lt('Checking trades · {done} of {total}', { done: formatNumber(done), total: formatNumber(list.length) });
        fill.style.width = (done / Math.max(1, list.length)) * 100 + '%';
      };
      const cool = async () => {
        while (!me.stop && Date.now() < robloxCooldown) {
          status.textContent = lt('Roblox asked us to slow down · {done} of {total} checked, going again in {s}s', { done: formatNumber(done), total: formatNumber(list.length), s: Math.ceil((robloxCooldown - Date.now()) / 1000) });
          await new Promise(res => setTimeout(res, 1000));
        }
        if (!me.stop) progress();
      };
      const worker = async () => {
        while (queue.length && !me.stop) {
          if (Date.now() < robloxCooldown) await cool();
          if (me.stop) return;
          const t = queue.shift();
          if (!t) return;
          const r = await judge(t, a.kind);
          if (me.stop) return;
          if (r.failed && (t.tries = (t.tries || 0) + 1) < 4) {
            queue.push(t);
            if (Date.now() >= robloxCooldown) await new Promise(res => setTimeout(res, 1500 * t.tries));
            continue;
          }
          if (r.failed) failed++;
          if (r.hit) hits.push({ ...t, ...r });
          done++;
          progress();
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (me.stop) return;
      job = null;
      bar.remove();
      hits.sort((x, y) => list.indexOf(list.find(t => t.id === x.id)) - list.indexOf(list.find(t => t.id === y.id)));
      if (!hits.length) {
        const inbound = a.type === 'inbound';
        const total = { n: formatNumber(list.length) };
        const skipped = failed ? ' ' + ltn(failed, '{n} couldn’t be checked.', '{n} couldn’t be checked.', { n: formatNumber(failed) }) : '';
        status.textContent = a.kind === 'all'
          ? (inbound ? lt('You have no inbound trades.') : lt('You have no outbound trades.'))
          : (list.length === 1
            ? (inbound ? lt('Your inbound trade doesn’t match.') : lt('Your outbound trade doesn’t match.'))
            : (inbound ? ltn(list.length, 'None of your {n} inbound trades match.', 'None of your {n} inbound trades match.', total) : ltn(list.length, 'None of your {n} outbound trades match.', 'None of your {n} outbound trades match.', total))) + skipped;
        return;
      }
      const matchVars = { hits: formatNumber(hits.length), n: formatNumber(list.length) };
      status.textContent = (a.type === 'inbound'
        ? ltn(list.length, '{hits} of {n} inbound trade matches.', '{hits} of {n} inbound trades match.', matchVars)
        : ltn(list.length, '{hits} of {n} outbound trade matches.', '{hits} of {n} outbound trades match.', matchVars))
        + (failed ? ' ' + ltn(failed, '{n} couldn’t be checked.', '{n} couldn’t be checked.', { n: formatNumber(failed) }) : '');
      const ul = el('ul', 'routility-clean-list');
      for (const h of hits) {
        const li = el('li', 'routility-clean-item');
        li.dataset.id = h.id;
        const names = el('span', 'routility-clean-item-names');
        names.append(el('span', 'text-label-medium content-emphasis text-truncate-end', h.name), el('span', 'text-caption-medium content-muted text-truncate-end', h.user ? '@' + h.user : ''));
        let info = '';
        if (a.kind === 'overpay') info = lt('{give} vs {get}', { give: formatUSD(h.give), get: formatUSD(h.get) });
        if (a.kind === 'unowned') info = h.lost.join(', ');
        li.append(names, el('span', 'text-caption-medium content-default routility-clean-item-info' + (a.kind === 'overpay' ? ' routility-clean-loss' : ''), info));
        ul.appendChild(li);
      }
      body.appendChild(ul);
      const hitCount = { n: formatNumber(hits.length) };
      const go = btn(verb === 'Decline' ? ltn(hits.length, 'Decline {n} Trade', 'Decline {n} Trades', hitCount) : ltn(hits.length, 'Cancel {n} Trade', 'Cancel {n} Trades', hitCount), 'btn-alert-md btn-min-width routility-clean-go', async () => {
        const run = { stop: false };
        job = run;
        declining = true;
        go.disabled = true;
        back.disabled = true;
        let ok = 0;
        let i = 0;
        for (const h of hits) {
          if (run.stop) break;
          i++;
          const step = { i: formatNumber(i), total: formatNumber(hits.length) };
          go.textContent = verb === 'Decline' ? lt('Declining {i} of {total}', step) : lt('Canceling {i} of {total}', step);
          const li = ul.querySelector(`[data-id="${h.id}"]`);
          li?.classList.add('routility-clean-working');
          const done = await declineTrade(h.id);
          li?.classList.remove('routility-clean-working');
          li?.classList.add(done ? 'routility-clean-done' : 'routility-clean-failed');
          if (done) { ok++; changed = true; }
          await new Promise(res => setTimeout(res, 350));
        }
        declining = false;
        if (run.stop) {
          if (changed) location.reload();
          return;
        }
        job = null;
        lists[a.type] = listAll(a.type);
        const result = { ok: formatNumber(ok), n: formatNumber(hits.length) };
        status.textContent = (verb === 'Decline'
          ? ltn(hits.length, 'Declined {ok} of {n} trade.', 'Declined {ok} of {n} trades.', result)
          : ltn(hits.length, 'Canceled {ok} of {n} trade.', 'Canceled {ok} of {n} trades.', result))
          + (ok < hits.length ? ' ' + lt('Roblox refused the rest, try them again in a minute.') : '');
        go.remove();
        back.disabled = false;
        foot.appendChild(btn(lt('Done'), 'btn-primary-md btn-min-width', shut));
      });
      foot.appendChild(go);
    }

    menu();
  }

  function scan() {
    ensureCleanButton();
    ensureProof();
    scanRows();
    scanOffers();
    checkOwnership();
    ensureFilter();
    if (filterQuery) {
      const rows = document.querySelectorAll('.trade-row').length;
      if (rows !== lastFilterRows && !filterBusy) {
        lastFilterRows = rows;
        applyFilter();
      }
    }
  }

  let lastFilterRows = 0;
  let proofOn = true;
  chrome.storage.local.get('routilitySettings', (st) => {
    proofOn = (st.routilitySettings || {}).tradeProof !== false;
  });

  function proofButtonEl(label, primary) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.label = el('span', 'text-no-wrap', label);
    b.append(layer, b.label);
    return b;
  }

  function ensureProof() {
    const h2 = document.querySelector('.trades-list-detail > div > h2');
    if (!proofOn || !h2 || !document.querySelector('.trade-list-detail-offer')) {
      document.querySelectorAll('.routility-proof-btn').forEach(n => n.remove());
      return;
    }
    if (h2.querySelector('.routility-proof-btn')) return;
    const b = proofButtonEl(lt('Proof'));
    b.classList.add('routility-injected', 'routility-proof-btn');
    b.dataset.rtTip = lt('A picture of this trade and the text for a value request, ready to paste');
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProof();
    });
    h2.appendChild(b);
  }

  async function proofData() {
    const id = await selectedTradeId();
    if (!id) return null;
    const [d, map] = await Promise.all([rawDetail(id), catalogMap()]);
    if (!d || !d.participantAOffer || !d.participantBOffer) return null;
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const side = (offer) => {
      const items = (offer.items || []).map((it) => {
        const k = offerItemKey(it);
        const c = map.lookup ? map.lookup(k) : map.get(k.targetId);
        return { name: it.itemName || (c && c.name) || '', acr: (c && c.acr) || '', usd: c && c.usd > 0 ? c.usd : 0, priced: !!(c && c.usd > 0), rap: Number(it.recentAveragePrice) || (c ? c.rap : 0) || 0, serial: Number(it.serialNumber) || 0, thumbKey: (k.bundle ? 'b' : '') + k.targetId };
      });
      const robux = Number(offer.robux) || 0;
      return { user: offer.user || {}, items, robux, usd: items.reduce((n, i) => n + i.usd, 0) + robux * robuxRate, rap: items.reduce((n, i) => n + i.rap, 0), missing: items.filter(i => !i.priced).length };
    };
    const a = side(d.participantAOffer);
    const b = side(d.participantBOffer);
    const mineIsB = String(b.user.id) === String(me);
    const entry = (tradeLists.get(currentTradeType())?.entries || []).find(e => e.id === String(id));
    return { id, status: String(d.status || ''), created: d.created || (entry && entry.created) || '', sender: a, receiver: b, mine: mineIsB ? b : a, theirs: mineIsB ? a : b };
  }

  function proofText(p, comment) {
    const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const label = (s) => {
      const parts = s.items.map(i => (i.acr && i.acr.toLowerCase() !== i.name.toLowerCase() ? `${i.name} (${i.acr})` : i.name)).filter(Boolean);
      if (s.robux > 0) parts.push(`R$ ${s.robux.toLocaleString('en-US')}`);
      return parts.join(' + ') || 'Nothing';
    };
    const d = p.receiver.usd - p.sender.usd;
    const tag = Math.abs(d) < 1 ? 'even' : `${money(Math.abs(d))} ${d > 0 ? 'op' : 'LB'}`;
    const at = new Date(p.created);
    const date = isNaN(at) ? '' : `${at.getMonth() + 1}/${at.getDate()}/${String(at.getFullYear()).slice(-2)}`;
    const lines = [
      `${label(p.sender)} / ${label(p.receiver)}`,
      `${money(p.sender.usd)}${p.sender.missing ? '+' : ''} vs ${money(p.receiver.usd)}${p.receiver.missing ? '+' : ''} (${tag})`,
      `S: ${p.sender.user.name || ''}`,
      `R: ${p.receiver.user.name || ''}`,
      `D: ${date}`,
    ];
    if (comment && comment.trim()) lines.push(`C: ${comment.trim().replace(/\s+/g, ' ')}`);
    return lines.join('\n');
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function proofImage(p, opts) {
    const keys = [...new Set([...p.mine.items, ...p.theirs.items].map(i => i.thumbKey))];
    const urls = (await window.RoUtilityUI.request({ type: 'getAssetThumbs', ids: keys })) || {};
    const imgs = new Map(await Promise.all(keys.map(async k => [k, await loadImg(urls[k])])));
    const logo = await loadImg(LOGO_URL);
    const dark = !document.body.classList.contains('light-theme');
    const C = dark
      ? { bg: '#121215', tile: '#24262c', text: '#f7f7f8', muted: '#a3a6ad', line: 'rgba(255,255,255,0.12)', price: '#3aa0ff', win: '#3fc679', over: '#f35b5b' }
      : { bg: '#ffffff', tile: '#ececef', text: '#202227', muted: '#666a72', line: 'rgba(0,0,0,0.12)', price: '#0a79e0', win: '#178d4b', over: '#d23439' };
    const PAD = 28;
    const TILE = 140;
    const GAP = 18;
    const count = (s) => s.items.length + (s.robux > 0 ? 1 : 0);
    const COLS = Math.min(4, Math.max(1, count(p.mine), count(p.theirs)));
    const font = (w, s) => `${w} ${s}px "Builder Sans", "Gotham SSm", Arial, sans-serif`;
    const nf = (n) => Math.round(n).toLocaleString('en-US');
    const money = (n) => '$' + nf(n);
    const tileH = TILE + 10 + 36 + (opts.rap ? 18 : 0) + (opts.prices ? 18 : 0);
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font(700, 24);
    const them0 = p.theirs.user;
    const titleW = probe.measureText(lt('Trade with {name}', { name: them0.displayName || them0.name || '' })).width;
    probe.font = font(600, 20);
    const W = Math.ceil(Math.max(PAD * 2 + COLS * TILE + (COLS - 1) * GAP, PAD * 2 + titleW + 8 + probe.measureText('@' + (them0.name || '')).width, 560));
    const totals = 8 + (opts.rap ? 26 : 0) + (opts.prices ? 26 : 0);
    const sectionH = (s) => 34 + Math.max(1, Math.ceil(count(s) / COLS)) * (tileH + GAP) + totals;
    const H = PAD + 46 + sectionH(p.mine) + 46 + sectionH(p.theirs) + 34 + PAD;
    const scale = 2;
    const cv = document.createElement('canvas');
    cv.width = W * scale;
    cv.height = H * scale;
    const g = cv.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    const text = (s, x, y, f, color, align = 'left') => {
      g.font = f;
      g.fillStyle = color;
      g.textAlign = align;
      g.fillText(s, x, y);
      return g.measureText(s).width;
    };
    const fit = (s, max, f) => {
      g.font = f;
      if (g.measureText(s).width <= max) return s;
      let t = s;
      while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
      return t + '…';
    };
    const wrap = (s, max, f) => {
      g.font = f;
      const words = s.split(/\s+/);
      const lines = [''];
      for (const w of words) {
        const next = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
        if (g.measureText(next).width <= max || !lines[lines.length - 1]) lines[lines.length - 1] = next;
        else lines.push(w);
      }
      if (lines.length > 2) lines[1] = fit(lines.slice(1).join(' '), max, f);
      return lines.slice(0, 2).map((l, i) => (i === 0 ? fit(l, max, f) : l));
    };
    const round = (x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    let y = PAD + 26;
    const them = p.theirs.user;
    const w1 = text(lt('Trade with {name}', { name: them.displayName || them.name || '' }), PAD, y, font(700, 24), C.text);
    text('@' + (them.name || ''), PAD + w1 + 8, y, font(600, 20), C.muted);
    y += 20;
    const section = (title, s) => {
      y += 24;
      text(title, PAD, y, font(700, 17), C.text);
      y += 14;
      const cells = [...s.items.map(i => ({ item: i })), ...(s.robux > 0 ? [{ robux: s.robux }] : [])];
      if (!cells.length) {
        text(lt('Nothing'), PAD, y + 24, font(500, 14), C.muted);
        y += tileH + GAP;
      }
      cells.forEach((cell, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = PAD + col * (TILE + GAP);
        const top = y + row * (tileH + GAP);
        round(x, top, TILE, TILE, 10);
        g.fillStyle = C.tile;
        g.fill();
        if (cell.robux) {
          text('R$', x + TILE / 2, top + TILE / 2 + 4, font(800, 30), C.text, 'center');
          text(lt('Robux'), x, top + TILE + 24, font(700, 13), C.text);
          text('R$ ' + nf(cell.robux), x, top + TILE + 42, font(600, 12), C.muted);
          return;
        }
        const it = cell.item;
        const im = imgs.get(it.thumbKey);
        if (im) {
          g.save();
          round(x, top, TILE, TILE, 10);
          g.clip();
          g.drawImage(im, x + 6, top + 6, TILE - 12, TILE - 12);
          g.restore();
        }
        if (it.serial) {
          const tag = '#' + nf(it.serial);
          g.font = font(700, 11);
          const tw = g.measureText(tag).width + 12;
          round(x + 6, top + TILE - 24, tw, 18, 9);
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fill();
          text(tag, x + 12, top + TILE - 11, font(700, 11), '#ffffff');
        }
        let ty = top + TILE + 22;
        for (const line of wrap(it.name, TILE, font(700, 13))) {
          text(line, x, ty, font(700, 13), C.text);
          ty += 16;
        }
        ty = top + TILE + 10 + 36 + 14;
        if (opts.rap) {
          text('R$ ' + nf(it.rap), x, ty, font(600, 12), C.muted);
          ty += 18;
        }
        if (opts.prices) text(it.priced ? money(it.usd) : lt('No price'), x, ty, font(700, 12), it.priced ? C.price : C.muted);
      });
      y += Math.max(1, Math.ceil(cells.length / COLS)) * (tileH + GAP);
      const right = W - PAD;
      if (opts.rap) {
        y += 22;
        text(lt('Total Value:'), PAD, y, font(600, 14), C.muted);
        text('R$ ' + nf(s.rap + s.robux), right, y, font(700, 15), C.text, 'right');
      }
      if (opts.prices) {
        y += 26;
        text(lt('Price:'), PAD, y, font(600, 14), C.muted);
        text(money(s.usd) + (s.missing ? '+' : ''), right, y, font(700, 15), C.price, 'right');
      }
      y += 8;
    };
    section(lt('Items you gave'), p.mine);
    y += 24;
    g.fillStyle = C.line;
    g.fillRect(PAD, y, W - PAD * 2, 1);
    const parts = [];
    if (opts.prices) {
      const d = p.theirs.usd - p.mine.usd;
      const pct = p.mine.usd > 0 ? Math.round(Math.abs(d) / p.mine.usd * 1000) / 10 : null;
      parts.push({ s: `${d >= 0 ? '+' : '-'}${money(Math.abs(d))}${pct !== null ? ` (${pct}%)` : ''}`, c: Math.abs(d) < 1 ? C.muted : d > 0 ? C.win : C.over });
    }
    if (opts.rap) {
      const d = (p.theirs.rap + p.theirs.robux) - (p.mine.rap + p.mine.robux);
      parts.push({ s: `${d >= 0 ? '+' : '-'}R$ ${nf(Math.abs(d))}`, c: d === 0 ? C.muted : d > 0 ? C.win : C.over });
    }
    if (parts.length) {
      g.font = font(700, 13);
      const widths = parts.map(x => g.measureText(x.s).width);
      const total = widths.reduce((a, b) => a + b, 0) + (parts.length - 1) * 18 + 24;
      let x = W / 2 - total / 2;
      g.fillStyle = C.bg;
      g.fillRect(x, y - 10, total, 20);
      x += 12;
      parts.forEach((part, i) => {
        text(part.s, x, y + 5, font(700, 13), part.c);
        x += widths[i] + 18;
      });
    }
    y += 6;
    section(lt('Items you received'), p.theirs);
    y += 18;
    g.fillStyle = C.line;
    g.fillRect(PAD, y, W - PAD * 2, 1);
    y += 22;
    const at = new Date(p.created);
    let when = '';
    try { when = isNaN(at) ? '' : at.toLocaleDateString(window.RoUtilityI18n.locale(), { month: 'short', day: 'numeric', year: 'numeric' }); } catch { when = isNaN(at) ? '' : at.toDateString(); }
    text([p.status, when].filter(Boolean).join(' · '), PAD, y, font(600, 12), C.muted);
    let lx = W - PAD;
    lx -= text('routility.io', lx, y, font(600, 12), C.muted, 'right');
    lx -= 6;
    lx -= text('RoUtility', lx, y, font(800, 13), C.text, 'right');
    if (logo) g.drawImage(logo, lx - 22, y - 13, 16, 16);
    return cv;
  }

  function proofChip(label, on, onChange) {
    const b = el('button', 'relative clip group/interactable cursor-pointer routility-proof-chip text-label-medium');
    b.type = 'button';
    const paint = () => {
      b.classList.toggle('bg-inverse-surface-0', on);
      b.classList.toggle('content-inverse-emphasis', on);
      b.classList.toggle('bg-shift-300', !on);
      b.classList.toggle('content-action-utility', !on);
      b.setAttribute('aria-pressed', String(on));
    };
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    b.addEventListener('click', () => {
      on = !on;
      paint();
      onChange(on);
    });
    paint();
    return b;
  }

  async function openProof() {
    document.querySelector('.routility-proof-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-proof-backdrop');
    const modal = el('div', 'routility-modal routility-proof-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const closeBtn = el('button', 'routility-modal-icon routility-modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', lt('Close'));
    closeBtn.appendChild(el('span', 'icon icon-regular-x'));
    head.append(el('h2', 'routility-modal-title', lt('Trade Proof')), closeBtn);
    const body = el('div', 'routility-proof-body');
    const shot = el('div', 'routility-proof-shot');
    shot.appendChild(el('span', 'routility-sk routility-proof-sk'));
    const side = el('div', 'routility-proof-side');
    const opts = { prices: true, rap: true };
    const chips = el('div', 'routility-proof-chips');
    const comment = el('input', 'routility-proof-comment text-body-medium');
    comment.type = 'text';
    comment.maxLength = 200;
    comment.placeholder = lt('Comment (optional)');
    comment.setAttribute('aria-label', comment.placeholder);
    const area = el('textarea', 'routility-proof-text');
    area.spellcheck = false;
    area.rows = 6;
    area.setAttribute('aria-label', lt('Value request text'));
    const actions = el('div', 'routility-proof-actions');
    const copyImg = proofButtonEl(lt('Copy Image'), true);
    const copyText = proofButtonEl(lt('Copy Text'));
    const save = proofButtonEl(lt('Download'));
    actions.append(copyImg, copyText, save);
    const note = el('p', 'text-body-small content-muted margin-none routility-proof-note');
    const link = el('a', 'text-link', lt('the RoUtility Discord'));
    link.href = 'https://discord.gg/util';
    link.target = '_blank';
    link.rel = 'noreferrer';
    note.append(document.createTextNode(lt('Paste the picture and the text together in #value-requests on') + ' '), link, document.createTextNode('.'));
    side.append(el('span', 'text-label-medium content-muted', lt('Show in the picture')), chips, el('span', 'text-label-medium content-muted', lt('Request text')), comment, area, actions, note);
    body.append(shot, side);
    modal.append(head, body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    let alive = true;
    const shut = () => {
      alive = false;
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    backdrop.routilityShut = shut;
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const data = await proofData();
    if (!alive) return;
    if (!data) {
      shot.textContent = '';
      shot.appendChild(el('p', 'text-body-medium content-muted', lt('Couldn’t load this trade. Try again in a moment.')));
      [copyImg, copyText, save].forEach(b => { b.disabled = true; });
      return;
    }
    let canvas = null;
    let drawing = 0;
    const redraw = async () => {
      const mine = ++drawing;
      const cv = await proofImage(data, opts);
      if (!alive || mine !== drawing) return;
      canvas = cv;
      const img = el('img', 'routility-proof-img');
      img.alt = lt('Trade Proof');
      img.src = cv.toDataURL('image/png');
      shot.textContent = '';
      shot.appendChild(img);
    };
    const retext = () => { area.value = proofText(data, comment.value); };
    chips.append(proofChip(lt('Prices'), true, (on) => { opts.prices = on; redraw(); }), proofChip(lt('RAP'), true, (on) => { opts.rap = on; redraw(); }));
    comment.addEventListener('input', retext);
    retext();
    redraw();
    const flash = (b, words) => {
      const was = b.label.textContent;
      b.label.textContent = words;
      setTimeout(() => { b.label.textContent = was; }, 1600);
    };
    copyImg.addEventListener('click', () => {
      if (!canvas) return;
      const blob = new Promise((resolve, reject) => canvas.toBlob(x => (x ? resolve(x) : reject(new Error('blob'))), 'image/png'));
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(() => flash(copyImg, lt('Copied!')), () => flash(copyImg, lt('Couldn’t Copy')));
    });
    copyText.addEventListener('click', () => {
      navigator.clipboard.writeText(area.value).then(() => flash(copyText, lt('Copied!')), () => flash(copyText, lt('Couldn’t Copy')));
    });
    save.addEventListener('click', () => {
      if (!canvas) return;
      const a = el('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `trade-${data.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  const schedule = window.RoUtilityUI.onFrame(() => scan());

  function setup() {
    if (observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    document.addEventListener('scroll', onScrollRows, true);
    document.addEventListener('keydown', onTradeKeys);
    document.addEventListener('mouseover', onRowOver);
    document.addEventListener('mouseout', onRowOut);
    document.addEventListener('scroll', closePreview, true);
    document.addEventListener('click', guardSend, true);
    document.addEventListener('input', onSearchInput, true);
    document.addEventListener('keydown', onSearchKey, true);
    document.addEventListener('focusout', onSearchBlur, true);
    document.addEventListener('scroll', closeSuggest, true);
    dialogWatch = new MutationObserver(() => {
      sendSummary();
      setTimeout(sendSummary, 120);
    });
    dialogWatch.observe(document.body, { childList: true });
    schedule();
  }

  function teardown() {
    observer?.disconnect();
    observer = null;
    dialogWatch?.disconnect();
    dialogWatch = null;
    document.removeEventListener('click', guardSend, true);
    document.removeEventListener('input', onSearchInput, true);
    document.removeEventListener('keydown', onSearchKey, true);
    document.removeEventListener('focusout', onSearchBlur, true);
    document.removeEventListener('scroll', closeSuggest, true);
    closeSuggest();
    document.querySelectorAll('.routility-send-summary').forEach(n => n.remove());
    document.querySelectorAll('[data-routility-locked]').forEach(n => delete n.dataset.routilityLocked);
    document.removeEventListener('scroll', onScrollRows, true);
    document.removeEventListener('keydown', onTradeKeys);
    document.removeEventListener('mouseover', onRowOver);
    document.removeEventListener('mouseout', onRowOut);
    document.removeEventListener('scroll', closePreview, true);
    closePreview();
    document.querySelectorAll('.routility-trade-filter, .routility-proof-btn').forEach(n => n.remove());
    document.querySelectorAll('.routility-proof-backdrop').forEach(n => (n.routilityShut ? n.routilityShut() : n.remove()));
    document.querySelectorAll('.routility-trade-hidden').forEach(n => n.classList.remove('routility-trade-hidden'));
  }

  window.RoUtilityTrades = { setup, teardown };
})();
