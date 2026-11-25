(function () {
  'use strict';

  const { el, formatNumber, request, itemValue } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const SITE = 'https://routility.io';
  const STATE = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const ICON_YOU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/></svg>';
  const ICON_THEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>';

  let on = true;
  let catalog = null;
  const details = new Map();
  let mine = null;
  const theirs = new Map();
  let busy = false;

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  async function robloxJson(url) {
    for (let tries = 0; tries < 3; tries++) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.status === 429) { await wait(2000 * (tries + 1)); continue; }
        return r.ok ? await r.json() : null;
      } catch {
        await wait(1000);
      }
    }
    return null;
  }

  function ago(ms) {
    const sec = Math.max(0, (Date.now() - ms) / 1000);
    if (sec < 3600) return ltn(Math.max(1, Math.floor(sec / 60)), '{n} minute ago', '{n} minutes ago', { n: Math.max(1, Math.floor(sec / 60)) });
    if (sec < 86400) return ltn(Math.floor(sec / 3600), '{n} hour ago', '{n} hours ago', { n: Math.floor(sec / 3600) });
    if (sec < 86400 * 2) return lt('yesterday');
    if (sec < 86400 * 14) return ltn(Math.floor(sec / 86400), '{n} day ago', '{n} days ago', { n: Math.floor(sec / 86400) });
    if (sec < 86400 * 60) return ltn(Math.floor(sec / (86400 * 7)), '{n} week ago', '{n} weeks ago', { n: Math.floor(sec / (86400 * 7)) });
    if (sec < 86400 * 365) return ltn(Math.floor(sec / (86400 * 30)), '{n} month ago', '{n} months ago', { n: Math.floor(sec / (86400 * 30)) });
    return ltn(Math.floor(sec / (86400 * 365)), '{n} year ago', '{n} years ago', { n: Math.floor(sec / (86400 * 365)) });
  }

  function day(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function catalogMap() {
    if (!catalog) catalog = request({ type: 'calcItems' }, r => Array.isArray(r)).then(list => new Map((Array.isArray(list) ? list : []).map(i => [String(i.id), i])));
    return catalog;
  }

  const partners = new Map();

  async function partnerOf() {
    const path = location.pathname;
    const known = partners.get(path);
    if (known && (known.pid || Date.now() - known.at < 30000)) return known.pid;
    const pid = await lookupPartner(path);
    partners.set(path, { pid, at: Date.now() });
    return pid;
  }

  async function lookupPartner(path) {
    const direct = path.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/trade\/?$/i);
    if (direct) return direct[1];
    const counter = path.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?trades\/(\d+)\/counter\/?$/i);
    if (!counter) return null;
    const d = await robloxJson(`https://trades.roblox.com/v2/trades/${counter[1]}`);
    if (!d || !d.participantAOffer || !d.participantBOffer) return null;
    const a = String(d.participantAOffer.user?.id || '');
    const b = String(d.participantBOffer.user?.id || '');
    return a === me() ? b : a;
  }

  async function listType(type) {
    const out = [];
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const d = await robloxJson(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!d || !Array.isArray(d.data)) {
        out.failed = true;
        break;
      }
      out.push(...d.data);
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  function myTrades() {
    if (!mine || Date.now() - mine.at > 120000) {
      const job = Promise.all(['inbound', 'outbound', 'completed', 'inactive'].map(type => listType(type).then(list => ({ type, list })))).then((parts) => {
        if (parts.some(x => x.list.failed) && mine && mine.job === job) mine = null;
        return parts;
      });
      mine = { job, at: Date.now() };
    }
    return mine.job;
  }

  function loadWithYou(pid) {
    return myTrades().then(parts => parts
      .flatMap(({ type, list }) => list
        .filter(t => String(t.user && t.user.id) === pid)
        .map(t => ({ id: String(t.id), at: Date.parse(t.created) || 0, type, status: String(t.status || '') })))
      .sort((x, y) => y.at - x.at));
  }

  function tradeDetail(id) {
    if (!details.has(id)) {
      const job = robloxJson(`https://trades.roblox.com/v2/trades/${id}`).then((d) => {
        if (!d) details.delete(id);
        return d;
      });
      details.set(id, job);
    }
    return details.get(id);
  }


  function loadTheirs(pid, page) {
    const key = pid + ':' + page;
    if (!theirs.has(key)) {
      theirs.set(key, request({ type: 'playerTrades', id: pid, page }, r => r !== undefined).then(d => {
        if (!d) theirs.delete(key);
        return d;
      }));
    }
    return theirs.get(key);
  }

  async function trackedWithYou(pid, since) {
    const out = [];
    for (let page = 1; page <= 50; page++) {
      const d = await loadTheirs(pid, page);
      if (!d || !Array.isArray(d.trades) || !d.trades.length) break;
      out.push(...d.trades.filter(t => String(t.partner && t.partner.id) === me()));
      if (page >= (Number(d.meta && d.meta.pages) || 1) || Number(d.trades[d.trades.length - 1].ts) * 1000 < since - 60000) break;
    }
    return out;
  }

  function trackedItems(tracked, at) {
    const out = new Map();
    const after = tracked.filter(t => Number(t.ts) * 1000 >= at - 60000).sort((a, b) => a.ts - b.ts);
    for (const t of after) for (const x of [...(t.gave || []), ...(t.got || [])]) if (x.ciid && !out.has(x.ciid)) out.set(x.ciid, x);
    return out;
  }

  function statusText(t) {
    if (t.type === 'completed') return lt('Went through');
    if (t.type === 'inbound') return lt('Waiting for you');
    if (t.type === 'outbound') return lt('Waiting for them');
    if (/declin/i.test(t.status)) return lt('Declined');
    if (/expir/i.test(t.status)) return lt('Expired');
    if (/counter/i.test(t.status)) return lt('Countered');
    return lt('Closed');
  }

  function shortNum(n) {
    const v = Math.abs(n);
    if (v >= 9995e2) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) {
      const t = (v / 1e3).toFixed(v >= 1e5 ? 0 : v >= 1e4 ? 1 : 2);
      return (t.includes('.') ? t.replace(/\.?0+$/, '') : t) + 'K';
    }
    return formatNumber(Math.round(v));
  }

  function signed(n, kind, approx) {
    const span = el('span', 'routility-tp-net ' + (n > 0 ? 'routility-tp-up' : n < 0 ? 'routility-tp-down' : 'content-muted'));
    const sign = (approx ? '≈ ' : '') + (n > 0 ? '+' : n < 0 ? '−' : '');
    if (kind === 'usd') {
      span.textContent = sign + window.RoUtilityUI.formatCash(Math.abs(n));
      return span;
    }
    span.append(document.createTextNode(sign), el('span', 'routility-pill-ic routility-pill-ic-logo routility-tp-logo'), document.createTextNode(shortNum(n)));
    return span;
  }

  function nets(value, usdAmount) {
    const out = [];
    if (Number.isFinite(value)) out.push(signed(value, 'value'));
    if (Number.isFinite(usdAmount)) out.push(signed(usdAmount, 'usd'));
    return out;
  }

  function pill(icon, title) {
    const b = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center gap-small stroke-none select-none radius-medium bg-shift-200 content-default routility-tp-pill');
    b.type = 'button';
    const layer = el('div', STATE);
    layer.setAttribute('aria-hidden', 'true');
    const ic = el('span', 'routility-tp-icon content-emphasis');
    ic.innerHTML = icon;
    const info = el('span', 'text-body-small content-muted routility-tp-info');
    info.appendChild(el('span', 'routility-sk routility-tp-sk'));
    const more = el('span', 'text-label-small content-action-utility routility-tp-more');
    b.append(layer, ic, el('span', 'text-label-medium content-emphasis', title), info, more);
    b.info = info;
    b.more = more;
    return b;
  }

  function modal(title, sub) {
    document.querySelector('.routility-tp-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-tp-backdrop');
    const box = el('div', 'routility-modal routility-tp-modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titles = el('div', 'routility-clean-titlebox');
    const subEl = el('span', 'text-body-medium content-muted', sub);
    titles.append(el('h2', 'routility-modal-title', title), subEl);
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titles, close);
    const body = el('div', 'routility-modal-body routility-tp-body');
    body.sub = subEl;
    box.append(head, body);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });
    return body;
  }

  function skeletonRows(n) {
    const ul = el('ul', 'routility-clean-list routility-tp-list');
    for (let i = 0; i < n; i++) {
      const li = el('li', 'routility-clean-item');
      li.append(el('span', 'routility-sk routility-tp-sk-wide'), el('span', 'routility-sk routility-tp-sk'));
      ul.appendChild(li);
    }
    return ul;
  }

  function thumbOf(x, map) {
    const item = map.get(String(x.asset_id));
    return (item && item.thumb) || '';
  }

  function thenOf(x, map) {
    return Number(x.value_then) || Number(x.rap) || 0;
  }

  function tradeNet(t, map) {
    return (t.got || []).reduce((n, x) => n + thenOf(x, map), 0) - (t.gave || []).reduce((n, x) => n + thenOf(x, map), 0);
  }

  function itemsRow(list, map, cap) {
    const row = el('span', 'routility-tp-items');
    const shown = cap && list.length > cap ? list.slice(0, cap - 1) : list;
    for (const x of shown) {
      const it = el('a', 'routility-tp-item');
      it.href = `https://www.roblox.com/catalog/${x.asset_id}`;
      it.target = '_blank';
      it.rel = 'noopener';
      window.RoUtilityUI.itemTip(it, { name: x.name, serial: x.serial, value: Number(x.value_then) || 0, usd: Number(x.usd) || 0, rap: Number(x.rap) || 0 });
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      const src = thumbOf(x, map);
      if (src) img.src = src;
      else img.dataset.asset = String(x.asset_id);
      it.appendChild(img);
      row.appendChild(it);
    }
    if (shown.length < list.length) {
      const more = el('span', 'text-label-small content-muted routility-tp-extra', '+' + (list.length - shown.length));
      more.dataset.rtTip = list.slice(shown.length).map(x => x.name).join('\n');
      row.appendChild(more);
    }
    if (!list.length) row.appendChild(el('span', 'text-body-small content-muted', lt('Nothing')));
    return row;
  }

  function tradeRow(t, map, compact) {
    const li = el('li', 'routility-tp-trade' + (compact ? ' routility-tp-compact' : ''));
    const who = el('span', 'routility-tp-who');
    const face = el('span', 'routility-tp-face');
    const id = t.partner && t.partner.id;
    if (id && !compact) face.dataset.uid = String(id);
    if (!id) {
      face.classList.add('routility-tp-face-hidden');
      face.appendChild(el('span', 'icon icon-regular-person'));
    }
    const name = el(id ? 'a' : 'span', 'text-label-medium content-emphasis routility-tp-name', (t.partner && t.partner.name) || lt('Hidden / Private'));
    if (id) name.href = `https://www.roblox.com/users/${id}/profile`;
    const when = el('span', 'text-body-small content-muted routility-tp-when', ago(t.ts * 1000));
    when.dataset.rtTip = day(t.ts * 1000);
    const text = el('span', 'routility-tp-whotext');
    text.append(name, when);
    if (t.inferred) {
      const likely = el('span', 'text-caption-medium content-muted routility-tp-likely', lt('Likely'));
      likely.dataset.rtTip = lt('Matched from item movements, not confirmed');
      when.appendChild(likely);
    }
    if (!compact) who.appendChild(face);
    who.appendChild(text);
    const swap = el('span', 'routility-tp-swap');
    swap.append(itemsRow(t.gave || [], map, compact ? 3 : 0), el('span', 'routility-tp-arrow content-muted', '→'), itemsRow(t.got || [], map, compact ? 3 : 0));
    const nums = el('span', 'routility-tp-nums');
    nums.appendChild(signed(tradeNet(t, map), 'value', [...(t.gave || []), ...(t.got || [])].some(x => !thenOf(x))));
    if (!compact && t.net_usd != null && Number.isFinite(Number(t.net_usd))) {
      const usd = signed(Number(t.net_usd), 'usd');
      usd.className = 'text-body-small content-muted routility-tp-usd';
      nums.appendChild(usd);
    }
    li.append(who, swap, nums);
    return li;
  }

  async function fillImages(root) {
    const pics = [...root.querySelectorAll('img[data-asset]')].map(i => [i, i.dataset.asset]);
    for (const [i] of pics) delete i.dataset.asset;
    const ids = [...new Set(pics.map(([, id]) => id))];
    for (let i = 0; i < ids.length; i += 100) {
      const d = await robloxJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i, i + 100).join(',')}&size=150x150&format=Webp`);
      const urls = new Map(((d && d.data) || []).filter(x => x.imageUrl).map(x => [String(x.targetId), x.imageUrl]));
      for (const [img, id] of pics) if (urls.has(id)) img.src = urls.get(id);
    }
    await fillFaces(root);
  }

  async function fillFaces(root) {
    const faces = [...root.querySelectorAll('.routility-tp-face[data-uid]')].map(f => [f, f.dataset.uid]);
    const ids = [...new Set(faces.map(([, id]) => id))];
    for (const [f] of faces) delete f.dataset.uid;
    for (let i = 0; i < ids.length; i += 100) {
      const d = await robloxJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.slice(i, i + 100).join(',')}&size=48x48&format=Png&isCircular=false`);
      const urls = new Map(((d && d.data) || []).filter(x => x.imageUrl).map(x => [String(x.targetId), x.imageUrl]));
      for (const [f, id] of faces) {
        const url = urls.get(id);
        if (!url || f.firstChild) continue;
        const img = el('img');
        img.alt = '';
        img.src = url;
        f.appendChild(img);
      }
    }
  }

  function detailItems(offer, map, then) {
    return ((offer && offer.items) || []).map((it) => {
      const target = it.itemTarget || {};
      const c = map.get(String(target.targetId || ''));
      const rap = Number(it.recentAveragePrice) || (c && Number(c.rap)) || 0;
      const t = then && then.get(String(it.collectibleItemInstanceId || ''));
      if (t) return { asset_id: String(target.targetId || ''), name: it.itemName || (c && c.name) || '', serial: Number(it.serialNumber) || 0, value_then: Number(t.value_then) || 0, usd: Number(t.usd) || 0, rap: Number(t.rap) || rap };
      return { asset_id: String(target.targetId || ''), name: it.itemName || (c && c.name) || '', serial: Number(it.serialNumber) || 0, value_then: (c && itemValue(c)) || 0, usd: c && c.usd > 0 ? c.usd : 0, rap };
    });
  }

  function withYouRow(t) {
    const li = el('li', 'routility-tp-trade');
    const who = el('span', 'routility-tp-who');
    const text = el('span', 'routility-tp-whotext');
    const when = el('span', 'text-body-small content-muted routility-tp-when', ago(t.at));
    when.dataset.rtTip = day(t.at);
    text.append(el('span', 'text-label-medium ' + (t.type === 'completed' ? 'routility-tp-up' : 'content-emphasis'), statusText(t)), when);
    who.appendChild(text);
    const swap = el('span', 'routility-tp-swap');
    swap.appendChild(el('span', 'routility-sk routility-tp-sk-wide'));
    const nums = el('span', 'routility-tp-nums');
    li.append(who, swap, nums);
    li.fill = (d, map, then) => {
      if (!d || !d.participantAOffer || !d.participantBOffer) {
        swap.replaceChildren(el('span', 'text-body-small content-muted', lt('Couldn’t load this trade. Try again in a moment.')));
        return;
      }
      const [yours, theirs] = String(d.participantBOffer.user && d.participantBOffer.user.id) === me() ? [d.participantBOffer, d.participantAOffer] : [d.participantAOffer, d.participantBOffer];
      const gave = detailItems(yours, map, then);
      const got = detailItems(theirs, map, then);
      swap.replaceChildren(itemsRow(gave, map), el('span', 'routility-tp-arrow content-muted', '→'), itemsRow(got, map));
      const sum = (list, key) => list.reduce((n, x) => n + (Number(x[key]) || 0), 0);
      nums.replaceChildren(signed(got.reduce((n, x) => n + thenOf(x), 0) - gave.reduce((n, x) => n + thenOf(x), 0), 'value', [...gave, ...got].some(x => !thenOf(x))));
      const usd = signed(sum(got, 'usd') - sum(gave, 'usd'), 'usd');
      usd.className = 'text-body-small content-muted routility-tp-usd';
      nums.appendChild(usd);
      fillImages(li);
    };
    return li;
  }


  async function openTrades(pid, name, start) {
    const own = pid === me();
    const body = modal(lt('{name}’s trades', { name }), '');
    const subs = { all: lt('Trades they completed with anyone, tracked by routility.io'), you: lt('What you gave and got in every trade between you two that Roblox still lists') };
    const bar = el('div', 'routility-tp-bar');
    const tabs = el('div', 'routility-tc-tabs routility-tp-tabs');
    tabs.setAttribute('role', 'tablist');
    const net = el('span', 'routility-tp-summary-net text-label-medium');
    bar.append(tabs, net);
    const panes = { all: el('div', 'routility-tp-pane'), you: el('div', 'routility-tp-pane') };
    const buttons = {};
    let fillYou = null;
    const show = (key) => {
      const h = body.offsetHeight;
      if (h) body.style.minHeight = Math.max(h, parseFloat(body.style.minHeight) || 0) + 'px';
      if (key === 'you' && fillYou) {
        fillYou();
        fillYou = null;
      }
      for (const k of Object.keys(panes)) {
        panes[k].hidden = k !== key;
        if (buttons[k]) {
          buttons[k].classList.toggle('routility-tc-tab-on', k === key);
          buttons[k].setAttribute('aria-selected', String(k === key));
        }
      }
      net.hidden = key !== 'all';
      body.sub.textContent = subs[key];
    };
    const tab = (key, label) => {
      const b = el('button', 'routility-tc-tab text-label-medium routility-tp-tab', label);
      b.count = el('span', 'routility-tp-count');
      b.appendChild(b.count);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => show(key));
      buttons[key] = b;
      tabs.appendChild(b);
    };
    tab('all', lt('All Trades'));
    if (!own) tab('you', lt('With You'));
    tabs.hidden = own;
    body.replaceChildren(bar, panes.all, panes.you);
    show(own ? 'all' : start || 'all');
    panes.all.appendChild(skeletonRows(6));
    if (!own) {
      panes.you.appendChild(skeletonRows(4));
      loadWithYou(pid).then((list) => {
        buttons.you.count.textContent = formatNumber(list.length);
        if (!list.length) return panes.you.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('You haven’t traded with them yet.')));
        const ul = el('ul', 'routility-clean-list routility-tp-list');
        const rows = list.map(withYouRow);
        ul.append(...rows);
        panes.you.replaceChildren(ul);
        const run = async () => {
          const done = list.filter(t => t.type === 'completed');
          const [map, tracked] = await Promise.all([catalogMap(), done.length ? trackedWithYou(pid, Math.min(...done.map(t => t.at))) : []]);
          let next = 0;
          const worker = async () => {
            while (next < rows.length) {
              const i = next++;
              rows[i].fill(await tradeDetail(list[i].id), map, list[i].type === 'completed' ? trackedItems(tracked, list[i].at) : null);
            }
          };
          await Promise.all([worker(), worker(), worker()]);
        };
        if (!panes.you.hidden) run();
        else fillYou = run;
      });
    }
    const map = await catalogMap();
    const first = await loadTheirs(pid, 1);
    if (!first) return panes.all.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('Couldn’t load their trades. Try again in a moment.')));
    const meta = first.meta || {};
    buttons.all.count.textContent = formatNumber(meta.total_all || first.trades.length);
    if (!first.trades.length) return panes.all.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('routility.io hasn’t tracked any trades for them yet.')));
    if (meta.net) net.replaceChildren(el('span', 'content-emphasis', lt('Net')), ...nets(Number(meta.net.value), Number(meta.net.price)));
    const ul = el('ul', 'routility-clean-list routility-tp-list');
    const more = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium padding-x-medium height-1000 bg-action-standard content-action-standard routility-tp-loadmore', lt('Load More'));
    more.type = 'button';
    const site = el('a', 'text-label-medium content-action-utility routility-tp-site', lt('See all on routility.io'));
    site.href = `${SITE}/player/${pid}/trades`;
    site.target = '_blank';
    site.rel = 'noopener';
    const foot = el('div', 'routility-tp-foot');
    foot.append(more, site);
    panes.all.replaceChildren(ul, foot);
    let page = 1;
    const add = (data) => {
      for (const t of data.trades) ul.appendChild(tradeRow(t, map, false));
      fillImages(ul);
      more.hidden = !(data.meta && data.meta.pages > page);
    };
    add(first);
    more.addEventListener('click', async () => {
      more.disabled = true;
      const next = await loadTheirs(pid, page + 1);
      more.disabled = false;
      if (!next) return;
      page++;
      add(next);
    });
  }

  function partnerName(h1) {
    const at = (h1.textContent || '').match(/@(\w+)/);
    return (at && at[1]) || lt('them');
  }

  async function ensure() {
    const h1 = document.querySelector('.trade-request-window h1.trades-header-nowrap');
    const have = document.querySelector('.routility-tp-row');
    if (!on || !h1) { have?.remove(); return; }
    const key = location.pathname;
    if (have && have.dataset.key === key && have.previousElementSibling === h1) return;
    if (busy) return;
    busy = true;
    let pid = null;
    try {
      pid = await partnerOf();
    } finally {
      busy = false;
    }
    if (!pid || pid === me() || location.pathname !== key || !h1.isConnected) return;
    document.querySelector('.routility-tp-row')?.remove();
    const row = el('div', 'routility-injected routility-tp-row');
    row.dataset.key = key;
    const you = pill(ICON_YOU, lt('Trading with you'));
    const them = pill(ICON_THEM, lt('Their trades'));
    you.addEventListener('click', () => openTrades(pid, partnerName(h1), 'you'));
    them.addEventListener('click', () => openTrades(pid, partnerName(h1), 'all'));
    row.append(you, them);
    h1.after(row);
    loadWithYou(pid).then(list => {
      const done = list.filter(t => t.type === 'completed').length;
      you.info.replaceChildren(document.createTextNode(list.length ? ltn(list.length, '{n} trade', '{n} trades', { n: formatNumber(list.length) }) + ', ' + ltn(done, '{n} went through', '{n} went through', { n: formatNumber(done) }) : lt('None yet')));
      you.more.textContent = list.length ? lt('See All') + ' ›' : '';
    });
    loadTheirs(pid, 1).then(async d => {
      if (!d) {
        them.info.replaceChildren(document.createTextNode(lt('Couldn’t load')));
        them.more.textContent = lt('Retry') + ' ›';
        return;
      }
      const total = (d.meta && d.meta.total_all) || 0;
      const parts = [document.createTextNode(total ? ltn(total, '{n} tracked', '{n} tracked', { n: formatNumber(total) }) : lt('None tracked'))];
      if (total && d.meta.net) for (const n of nets(Number(d.meta.net.value), Number(d.meta.net.price))) parts.push(document.createTextNode(parts.length === 1 ? ', ' : ' '), n);
      them.info.replaceChildren(...parts);
      them.more.textContent = total ? lt('Open') + ' ›' : '';
    });
  }

  function stat(label, value, onClick) {
    const b = el('button', 'routility-tp-stat');
    b.type = 'button';
    b.append(el('span', 'text-caption-medium content-muted', label), value);
    b.addEventListener('click', onClick);
    return b;
  }

  function spot() {
    const wear = document.querySelector('.routility-classic .routility-classic-wearing');
    const left = wear && wear.parentElement.querySelector(':scope > .routility-column-left');
    if (left) return { classic: true, parent: left, after: [...left.children].reverse().find(n => !n.classList.contains('routility-tp-section')) || null };
    if (wear) return { classic: true, parent: wear.parentElement, after: wear };
    const content = document.querySelector('#content .profile-content');
    if (!content) return null;
    return { classic: false, parent: content, after: content.querySelector(':scope > .profile-currently-wearing') };
  }

  let profileBusy = '';
  let profileEmpty = '';
  let profileRetry = null;
  async function ensureProfile() {
    const m = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/profile\/?$/i);
    const at = spot();
    const have = document.querySelector('.routility-tp-section');
    if (!on || !m || !at) {
      have?.remove();
      return;
    }
    const pid = m[1];
    if (have && have.dataset.pid === pid && have.parentElement === at.parent && have.classList.contains('routility-tp-classic') === at.classic) {
      if (at.after && at.after !== have && have.previousElementSibling !== at.after) at.after.after(have);
      return;
    }
    if (profileBusy === pid || (profileEmpty === pid && !have)) return;
    if (!have && profileRetry && profileRetry.pid === pid && Date.now() < profileRetry.at) return;
    profileBusy = pid;
    const own = pid === me();
    const nameOf = () => {
      const header = document.querySelector('.user-profile-header-info');
      const leaf = header && [...header.querySelectorAll('*')].find(e => !e.children.length && /^@\w+$/.test(e.textContent.trim()));
      return leaf ? leaf.textContent.trim().slice(1) : lt('them');
    };
    const youP = own ? Promise.resolve([]) : loadWithYou(pid);
    const [d, map] = await Promise.all([loadTheirs(pid, 1), catalogMap()]);
    const total = (d && d.meta && d.meta.total_all) || 0;
    const early = total ? null : await youP;
    profileBusy = '';
    const live = spot();
    if (!on || !live || !location.pathname.includes('/users/' + pid + '/')) return;
    document.querySelectorAll('.routility-tp-section').forEach(x => x.remove());
    if (!total && !early.length) {
      if (d) profileEmpty = pid;
      else {
        profileRetry = { pid, at: Date.now() + 15000 };
        setTimeout(ensureProfile, 15500);
      }
      return;
    }
    const open = (tab) => openTrades(pid, nameOf(), tab);
    const first = total ? 'all' : 'you';
    const sec = el('div', live.classic ? 'section routility-injected routility-tp-section routility-tp-classic' : 'routility-injected routility-tp-section');
    sec.dataset.pid = pid;
    let head;
    if (live.classic) {
      head = el('div', 'container-header');
      const all = el('button', 'btn-secondary-xs btn-more see-all-link-icon routility-see-all', lt('See All'));
      all.type = 'button';
      all.addEventListener('click', () => open(first));
      head.append(el('h3', null, lt('Trades')), all);
    } else {
      head = el('button', 'items-center inline-flex routility-tp-head');
      head.type = 'button';
      head.append(el('h2', 'content-emphasis text-heading-small padding-none inline-block', lt('Trades')), el('span', 'icon-chevron-heavy-right'));
      head.addEventListener('click', () => open(first));
    }
    const card = el('div', live.classic ? 'section-content routility-tp-card' : 'routility-tp-card');
    const stats = el('div', 'routility-tp-stats');
    if (total) stats.appendChild(stat(lt('Tracked'), el('span', 'text-heading-small content-emphasis', formatNumber(total)), () => open('all')));
    const n = total && d.meta.net;
    if (n && Number.isFinite(Number(n.value))) stats.appendChild(stat(lt('Net Value'), signed(Number(n.value), 'value'), () => open('all')));
    if (n && n.price != null && Number.isFinite(Number(n.price))) stats.appendChild(stat(lt('Net Cash'), signed(Number(n.price), 'usd'), () => open('all')));
    if (!own) {
      const count = el('span', 'text-heading-small content-emphasis');
      if (early) count.textContent = formatNumber(early.length);
      else {
        count.appendChild(el('span', 'routility-sk routility-tp-sk'));
        youP.then((list) => { count.textContent = formatNumber(list.length); });
      }
      stats.appendChild(stat(lt('With You'), count, () => open('you')));
    }
    card.appendChild(stats);
    const recent = ((d && d.trades) || []).slice(0, 3);
    if (recent.length) {
      const ul = el('ul', 'routility-clean-list routility-tp-list');
      for (const t of recent) ul.appendChild(tradeRow(t, map, true));
      card.appendChild(ul);
      fillImages(ul);
    }
    sec.append(head, card);
    if (live.after) live.after.after(sec);
    else live.parent.prepend(sec);
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; ensure(); ensureProfile(); });
  });

  if (location.hostname === 'www.roblox.com') {
    chrome.storage.local.get('routilitySettings', (st) => {
      on = (st.routilitySettings || {}).tradePartnerHistory !== false;
      observer.observe(document.documentElement, { childList: true, subtree: true });
      ensure();
      ensureProfile();
    });
    chrome.storage.onChanged.addListener((c, area) => {
      if (area !== 'local' || !c.routilitySettings) return;
      on = (c.routilitySettings.newValue || {}).tradePartnerHistory !== false;
      document.querySelectorAll('.routility-tp-section').forEach(x => x.remove());
      profileEmpty = '';
      ensure();
      ensureProfile();
    });
  }
})();
