(function () {
  'use strict';

  const { el, onFrame, formatNumber, formatUSD, dropdown } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const MODES = [['creators', LT('Creators'), LT('Creator')], ['games', LT('Experiences'), LT('Experience')], ['types', LT('Item Types'), LT('Item Type')], ['months', LT('Months'), LT('Month')]];
  const RANGES = [['all', LT('All Time')], ['year', LT('Past Year')], ['month', LT('Past 30 Days')], ['week', LT('Past 7 Days')]];
  const RANGE_DAYS = { year: 365, month: 30, week: 7 };
  const SORTS = { spent: LT('Most Spent'), count: LT('Most Purchases'), newest: LT('Newest First') };
  const TYPES = { DeveloperProduct: LT('In-Experience Purchases'), GamePass: LT('Passes'), Asset: LT('Marketplace Items'), Bundle: LT('Bundles'), RobloxProduct: LT('Roblox Fees'), PrivateServer: LT('Private Servers') };
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const PAGE = 10;
  const VIEW_KEY = 'routilitySpendView';
  const CHECK_KEY = 'routilitySpendCheck';
  const thumbs = new Map();
  let sp = null;
  let gs = null;

  const slug = name => String(name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'unnamed';
  const pad = n => String(n).padStart(2, '0');
  const me = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const spentOf = x => Math.abs(Number(x.currency && x.currency.amount) || 0);
  const tx = () => window.RoUtilityTransactions;

  function oldest(c) {
    const last = c.rows[c.rows.length - 1];
    const d = last && new Date(last.created);
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }

  function sortsFor(mode) {
    return mode === 'months' ? ['newest', 'spent'] : ['spent', 'count'];
  }

  function sortOptions(mode) {
    return sortsFor(mode).map(k => ({ value: k, label: lt(SORTS[k]) }));
  }

  function cutoff(range) {
    return RANGE_DAYS[range] ? Date.now() - RANGE_DAYS[range] * 86400000 : 0;
  }

  function groups(rows, mode) {
    const map = new Map();
    for (const x of rows) {
      let key = null;
      let make = null;
      if (mode === 'creators') {
        const a = x.agent || {};
        if (!a.id && !a.name) continue;
        const group = a.type === 'Group';
        key = (group ? 'g' : 'u') + (a.id || a.name);
        make = () => ({ name: a.name || '', thumb: a.id ? `${group ? 'GroupIcon' : 'AvatarHeadShot'}:${a.id}` : null, round: !group, href: a.id ? (group ? `https://www.roblox.com/communities/${a.id}/${slug(a.name)}` : `https://www.roblox.com/users/${a.id}/profile`) : null });
      } else if (mode === 'games') {
        const p = x.details && x.details.place;
        if (!p || !(p.universeId || p.placeId)) continue;
        key = String(p.universeId || 'p' + p.placeId);
        make = () => ({ name: p.name || '', thumb: p.universeId ? `GameIcon:${p.universeId}` : null, href: p.placeId ? `https://www.roblox.com/games/${p.placeId}/${slug(p.name)}` : null });
      } else if (mode === 'types') {
        const t = (x.details && x.details.type) || 'Other';
        key = t;
        make = () => ({ name: TYPES[t] ? lt(TYPES[t]) : t.replace(/([a-z])([A-Z])/g, '$1 $2') });
      } else {
        const d = new Date(x._t || x.created);
        if (Number.isNaN(d.getTime())) continue;
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        make = () => ({ name: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), at: new Date(d.getFullYear(), d.getMonth(), 1).getTime() });
      }
      let g = map.get(key);
      if (!g) {
        g = { key, spent: 0, count: 0, ...make() };
        map.set(key, g);
      }
      g.spent += spentOf(x);
      g.count++;
    }
    return [...map.values()];
  }

  function sorted(list, sort) {
    const by = sort === 'count' ? (a, b) => b.count - a.count || b.spent - a.spent
      : sort === 'newest' ? (a, b) => b.at - a.at
        : (a, b) => b.spent - a.spent || b.count - a.count;
    return list.sort(by);
  }

  function saveView(s) {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ mode: s.mode, range: s.range, sort: s.sort })); } catch {}
  }

  function loadView() {
    try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') || {}; } catch { return {}; }
  }

  function robux(n, s, cls) {
    const box = el('span', 'routility-spend-robux' + (cls ? ' ' + cls : ''));
    box.append(el('span', 'icon-robux-16x16'), el('span', null, formatNumber(n)));
    if (s.usd && n) box.appendChild(el('span', 'routility-spend-usd', '≈ ' + formatUSD(n * s.rate)));
    return box;
  }

  function stat(label) {
    const cell = el('div', 'routility-spend-stat');
    const value = el('div', 'text-heading-small routility-spend-stat-value');
    cell.append(el('span', 'text-caption-medium content-muted', label), value);
    return [cell, value];
  }

  function openModal(s) {
    if (s.modal) return;
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal routility-spend-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-tc-dialog routility-spend-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-spend-title');
    dialog.tabIndex = -1;
    const closeBox = el('div', 'absolute foundation-web-dialog-close-container');
    const x = el('button', 'foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus bg-over-media-100 padding-small radius-circle');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    const xl = el('div', LAYER);
    xl.setAttribute('aria-hidden', 'true');
    x.append(xl, el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]'));
    x.addEventListener('click', () => closeModal(s));
    closeBox.appendChild(x);
    const title = el('h2', 'text-heading-small routility-tc-title', lt('Spending'));
    title.id = 'routility-spend-title';

    const stats = el('div', 'routility-spend-stats');
    const [spentCell, spentValue] = stat(lt('Total Spent'));
    const [countCell, countValue] = stat(lt('Purchases'));
    const [topCell, topValue] = stat(lt('Most Spent On'));
    stats.append(spentCell, countCell, topCell);
    s.stats = { spent: spentValue, count: countValue, top: topValue };

    s.status = el('div', 'text-body-small content-muted routility-spend-status');
    s.status.setAttribute('role', 'status');

    const tabs = el('div', 'routility-tc-tabs routility-spend-tabs');
    tabs.setAttribute('role', 'tablist');
    s.tabs = MODES.map(([value, label]) => {
      const b = el('button', 'text-label-medium routility-tc-tab', lt(label));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.value = value;
      b.addEventListener('click', () => {
        if (s.mode === value) return;
        s.mode = value;
        s.sort = sortsFor(value)[0];
        s.sortDrop.setOptions(sortOptions(value));
        s.sortDrop.setValue(s.sort);
        s.shown = PAGE;
        saveView(s);
        render(s);
      });
      tabs.appendChild(b);
      return b;
    });
    const rangeDrop = dropdown(RANGES.map(([value, label]) => ({ value, label: lt(label) })), s.range, (v) => {
      s.range = v;
      s.shown = PAGE;
      saveView(s);
      render(s);
      kick(s);
    }, 'routility-spend-drop');
    s.sortDrop = dropdown(sortOptions(s.mode), s.sort, (v) => {
      s.sort = v;
      s.shown = PAGE;
      saveView(s);
      render(s);
    }, 'routility-spend-drop');
    const search = el('input', 'form-control input-field routility-spend-search');
    search.type = 'text';
    search.placeholder = lt('Search');
    search.setAttribute('aria-label', lt('Search'));
    search.value = s.query;
    search.addEventListener('input', () => {
      s.query = search.value.trim().toLowerCase();
      s.shown = PAGE;
      render(s);
    });
    const tools = el('div', 'routility-spend-tools');
    tools.append(tabs, el('span', 'routility-tc-spacer'), rangeDrop, s.sortDrop);

    const scroll = el('div', 'routility-spend-scroll');
    const table = el('table', 'routility-spend-table');
    s.head = el('thead');
    s.body = el('tbody');
    table.append(s.head, s.body);
    s.more = el('button', 'btn-control-md routility-spend-more', lt('Show More'));
    s.more.type = 'button';
    s.more.hidden = true;
    s.more.addEventListener('click', () => {
      s.shown += PAGE;
      render(s);
    });
    scroll.append(table, s.more);

    dialog.append(closeBox, title, stats, s.status, tools, search, scroll);
    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(s); });
    s.onKey = (e) => {
      if (e.key !== 'Escape' || !s.modal) return;
      e.preventDefault();
      closeModal(s);
    };
    document.addEventListener('keydown', s.onKey, true);
    document.body.appendChild(overlay);
    s.modal = overlay;
    s.stopped = false;
    dialog.focus({ preventScroll: true });
    render(s);
    s.cache.loaded.then(() => { if (sp === s && s.modal) kick(s); });
  }

  function closeModal(s) {
    if (!s.modal) return;
    s.modal.remove();
    s.modal = null;
    document.removeEventListener('keydown', s.onKey, true);
    s.button?.focus({ preventScroll: true });
  }

  function amountCell(n, s) {
    const td = el('td', 'routility-spend-amount');
    td.appendChild(robux(n, s));
    return td;
  }

  function nameCell(g, mode, max) {
    const td = el('td', 'routility-spend-name');
    const line = el('div', 'routility-spend-line');
    if (mode === 'creators' || mode === 'games') {
      const box = el('span', 'thumbnail-2d-container routility-spend-thumb' + (g.round ? ' routility-spend-round' : '') + (thumbs.get(g.thumb) ? '' : ' shimmer'));
      if (g.thumb) {
        box.dataset.rtThumb = g.thumb;
        if (thumbs.get(g.thumb)) box.appendChild(img(thumbs.get(g.thumb)));
      }
      line.appendChild(box);
    }
    const name = g.name || (mode === 'creators' ? lt('Unknown Creator') : lt('Unknown Experience'));
    if (g.href) {
      const a = el('a', 'text-overflow routility-spend-link', name);
      a.href = g.href;
      line.appendChild(a);
    } else line.appendChild(el('span', 'text-overflow', name));
    td.appendChild(line);
    if (mode === 'months') {
      const track = el('div', 'routility-spend-track');
      const fill = el('div', 'routility-spend-fill');
      fill.style.width = (max ? Math.max(1, Math.round(g.spent / max * 100)) : 0) + '%';
      track.appendChild(fill);
      td.appendChild(track);
    }
    return td;
  }

  function img(url) {
    const i = el('img');
    i.src = url;
    i.alt = '';
    return i;
  }

  function skeletonRow() {
    const tr = el('tr', 'routility-spend-skel');
    const bar = (w) => {
      const b = el('span', 'routility-sk routility-tx-sk');
      b.style.width = w;
      return b;
    };
    const name = el('td');
    const line = el('div', 'routility-tx-sk-line');
    line.append(el('span', 'routility-sk routility-tx-sk-pic'), bar('140px'));
    name.appendChild(line);
    const count = el('td');
    count.appendChild(bar('28px'));
    const amount = el('td');
    amount.appendChild(bar('64px'));
    tr.append(name, count, amount);
    return tr;
  }

  function render(s) {
    if (sp !== s || !s.modal) return;
    const c = s.cache;
    for (const b of s.tabs) {
      const on = b.dataset.value === s.mode;
      b.classList.toggle('routility-tc-tab-on', on);
      b.setAttribute('aria-selected', String(on));
    }
    const since = cutoff(s.range);
    const rows = since ? c.rows.filter(x => x._t >= since) : c.rows;
    const all = sorted(groups(rows, s.mode), s.sort);
    const list = s.query ? all.filter(g => String(g.name || '').toLowerCase().includes(s.query)) : all;
    const busy = !!c.busy && !s.stopped;
    const waiting = busy && !c.rows.length;
    const spent = rows.reduce((t, x) => t + spentOf(x), 0);
    s.stats.spent.replaceChildren(waiting ? el('span', 'routility-sk routility-spend-sk-stat') : robux(spent, s));
    s.stats.count.replaceChildren(waiting ? el('span', 'routility-sk routility-spend-sk-stat') : document.createTextNode(formatNumber(rows.length)));
    const top = sorted(groups(rows, 'games'), 'spent')[0] || sorted(groups(rows, 'creators'), 'spent')[0];
    s.stats.top.replaceChildren(waiting ? el('span', 'routility-sk routility-spend-sk-stat') : el('span', 'text-overflow', top ? top.name : '—'));
    if (top) s.stats.top.dataset.rtTip = lt('{name} • {robux} Robux', { name: top.name, robux: formatNumber(top.spent) });
    else delete s.stats.top.dataset.rtTip;

    const label = MODES.find(m => m[0] === s.mode);
    const head = el('tr');
    head.append(el('th', 'text-label-medium', lt(label[2])), el('th', 'text-label-medium routility-spend-count', lt('Purchases')), el('th', 'text-label-medium routility-spend-amount', lt('Amount')));
    s.head.replaceChildren(head);
    const frag = document.createDocumentFragment();
    const max = list.reduce((m, g) => Math.max(m, g.spent), 0);
    for (const g of list.slice(0, s.shown)) {
      const tr = el('tr');
      tr.append(nameCell(g, s.mode, max), el('td', 'routility-spend-count', formatNumber(g.count)), amountCell(g.spent, s));
      frag.appendChild(tr);
    }
    if (!list.length) {
      if (waiting) for (let i = 0; i < 5; i++) frag.appendChild(skeletonRow());
      else {
        const tr = el('tr');
        const td = el('td', 'text-body-medium content-muted routility-spend-empty', s.query ? lt('Nothing matches your search.') : lt('No purchases in this date range.'));
        td.colSpan = 3;
        tr.appendChild(td);
        frag.appendChild(tr);
      }
    }
    s.body.replaceChildren(frag);
    s.more.hidden = list.length <= s.shown;
    paintStatus(s);
    loadThumbs(s);
  }

  function covered(s) {
    const c = s.cache;
    if (c.done) return true;
    const since = cutoff(s.range);
    const last = c.rows[c.rows.length - 1];
    return !!(since && last && last._t < since);
  }

  function paintStatus(s) {
    const c = s.cache;
    const n = c.rows.length;
    const vars = { n: formatNumber(n), date: oldest(c) };
    const scanning = !!c.busy && !s.stopped;
    let text;
    let action = null;
    delete s.status.dataset.rtTip;
    const stop = [lt('Stop'), () => { s.stopped = true; render(s); }];
    if (scanning && c.waiting) {
      text = n ? ltn(n, 'Roblox asked RoUtility to slow down, carrying on in a moment. {n} purchase so far, back to {date}.', 'Roblox asked RoUtility to slow down, carrying on in a moment. {n} purchases so far, back to {date}.', vars) : lt('Roblox asked RoUtility to slow down, carrying on in a moment.');
      action = stop;
    } else if (scanning && c.phase === 'head' && c.hadSaved && !c.rescan) {
      text = lt('Checking for new purchases since your last visit…');
    } else if (scanning) {
      text = n ? ltn(n, 'Reading your purchases… {n} so far, back to {date}.', 'Reading your purchases… {n} so far, back to {date}.', vars) : lt('Reading your purchases…');
      s.status.dataset.rtTip = lt('Roblox only sends about 500 purchases a minute, so a long history takes a few minutes. Close this to pause, and it carries on from there next time.');
      action = stop;
    } else if (c.done) {
      text = ltn(n, 'Counted from your {n} purchase.', 'Counted from all {n} of your purchases.', vars);
    } else if (covered(s)) {
      text = lt('Every purchase in this date range is counted.');
    } else if (c.failed) {
      text = n ? ltn(n, 'Roblox stopped answering. Counted from your most recent purchase, back to {date}.', 'Roblox stopped answering. Counted from your {n} most recent purchases, back to {date}.', vars) : lt('Roblox stopped answering. Try again in a minute.');
      action = [lt('Try Again'), () => { c.failed = false; s.stopped = false; kick(s); }];
    } else {
      text = ltn(n, 'Counted from your most recent purchase, back to {date}.', 'Counted from your {n} most recent purchases, back to {date}.', vars);
      action = [lt('Read Older Purchases'), () => { s.stopped = false; kick(s); }];
    }
    s.status.textContent = '';
    if (scanning) s.status.appendChild(el('span', 'routility-tx-spin'));
    s.status.appendChild(el('span', null, text));
    if (action) {
      const b = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis underline cursor-pointer text-body-small routility-spend-action', action[0]);
      b.type = 'button';
      b.addEventListener('click', action[1]);
      s.status.appendChild(b);
    }
  }

  async function loadThumbs(s) {
    const boxes = [...s.body.querySelectorAll('[data-rt-thumb]')].filter(b => !b.querySelector('img'));
    for (const b of boxes) if (thumbs.get(b.dataset.rtThumb)) set(b, thumbs.get(b.dataset.rtThumb));
    const want = [...new Set(boxes.map(b => b.dataset.rtThumb))].filter(k => !thumbs.has(k)).slice(0, 100);
    if (!want.length) return;
    want.forEach(k => thumbs.set(k, null));
    const body = want.map((k, i) => {
      const [type, id] = k.split(':');
      return { requestId: String(i), type, targetId: Number(id), size: type === 'AvatarHeadShot' ? '48x48' : '150x150', format: 'webp' };
    });
    const res = await fetch('https://thumbnails.roblox.com/v1/batch', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null).catch(() => null);
    const retry = [];
    for (const d of (res && res.data) || []) {
      const k = want[Number(d.requestId)];
      if (d.state === 'Completed' && d.imageUrl) thumbs.set(k, d.imageUrl);
      else if (d.state === 'Pending') retry.push(k);
    }
    retry.forEach(k => thumbs.delete(k));
    if (!res) want.forEach(k => thumbs.delete(k));
    if (sp !== s || !s.modal) return;
    for (const b of s.body.querySelectorAll('[data-rt-thumb]')) if (thumbs.get(b.dataset.rtThumb)) set(b, thumbs.get(b.dataset.rtThumb));
    if (retry.length) setTimeout(() => { if (sp === s && s.modal) loadThumbs(s); }, 2000);
  }

  function set(box, url) {
    box.classList.remove('shimmer');
    if (!box.querySelector('img')) box.appendChild(img(url));
  }

  function kick(s) {
    const c = s.cache;
    const need = () => sp === s && !s.stopped && !!s.modal && !covered(s);
    if (c.headDone && (c.done || !need())) return render(s);
    let frame = 0;
    const onPage = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; render(s); });
    };
    tx().scan(c, s, need, onPage).then(() => render(s));
    render(s);
  }

  function placeButton(s) {
    const buy = document.querySelector('.user-transactions-container .balance-label > a.btn-more');
    if (!buy) return;
    if (s.button && s.button.isConnected && s.button.nextElementSibling === buy) return;
    s.button?.remove();
    const b = el('button', 'btn-control-md routility-injected routility-spend-open', lt('Spending'));
    b.type = 'button';
    b.dataset.rtTip = lt('What you’ve spent on each creator, experience, item type and month');
    b.addEventListener('click', () => openModal(s));
    buy.before(b);
    s.button = b;
  }

  function setup(settings) {
    teardown();
    if (!me() || !tx() || !tx().purchases) return;
    const view = loadView();
    const mode = MODES.some(m => m[0] === view.mode) ? view.mode : 'creators';
    const s = sp = {
      mode,
      range: RANGES.some(r => r[0] === view.range) ? view.range : 'all',
      sort: sortsFor(mode).includes(view.sort) ? view.sort : sortsFor(mode)[0],
      query: '',
      shown: PAGE,
      stopped: false,
      filter: null,
      modal: null,
      usd: (settings || {}).txUsd !== false,
      rate: window.RoUtilityUI.robuxRate(settings || {}),
      live: () => sp === s,
    };
    s.cache = tx().purchases();
    s.observer = new MutationObserver(onFrame(() => { if (sp === s) placeButton(s); }));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    placeButton(s);
  }

  function teardown() {
    if (!sp) return;
    sp.observer?.disconnect();
    closeModal(sp);
    sp.button?.remove();
    sp = null;
    document.querySelectorAll('.routility-spend-open, .routility-spend-modal').forEach(n => n.remove());
  }

  function placeGame(g) {
    const list = document.querySelector('.game-stat-container');
    if (!list || gs !== g) return;
    let total = 0;
    let count = 0;
    for (const x of g.cache.rows) {
      const p = x.details && x.details.place;
      if (p && String(p.universeId) === g.universeId) {
        total += spentOf(x);
        count++;
      }
    }
    let li = list.querySelector(':scope > .routility-spent-stat');
    if (!total) {
      li?.remove();
      return;
    }
    if (!li) {
      li = el('li', 'game-stat routility-injected routility-spent-stat');
      const lead = el('p', 'text-lead font-caption-body');
      lead.append(el('span', 'icon-robux-16x16'), el('span', 'routility-spent-num'));
      li.append(el('p', 'text-label text-overflow font-caption-header', lt('You’ve Spent')), lead);
      const pt = list.querySelector(':scope > .routility-pt-stat');
      if (pt) pt.after(li);
      else list.appendChild(li);
    }
    const num = li.querySelector('.routility-spent-num');
    const text = formatNumber(total);
    if (num.textContent !== text) num.textContent = text;
    const vars = { n: formatNumber(count), date: oldest(g.cache) };
    const tip = [ltn(count, '{n} purchase in this experience', '{n} purchases in this experience', vars), g.cache.done ? lt('Counted from all your purchases.') : lt('Counted from your purchases back to {date}. Spending on My Transactions can read older ones.', vars)].join(' • ');
    if (li.dataset.rtTip !== tip) li.dataset.rtTip = tip;
  }

  async function gameStat(universeId) {
    stopGame();
    const id = me();
    if (!id || !universeId || !tx() || !tx().purchases) return;
    const g = gs = { universeId: String(universeId), cache: tx().purchases(), stopped: false, filter: null, live: () => gs === g };
    g.observer = new MutationObserver(() => {
      if (gs === g && g.cache.rows.length && !document.querySelector('.game-stat-container > .routility-spent-stat')) placeGame(g);
    });
    g.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    await g.cache.loaded;
    if (gs !== g || !g.cache.rows.length) return;
    placeGame(g);
    chrome.storage.local.get(CHECK_KEY, (st) => {
      if (chrome.runtime.lastError || gs !== g) return;
      const seen = (st && st[CHECK_KEY]) || {};
      if (Date.now() - (seen[id] || 0) < 10 * 60000 || g.cache.headDone) return;
      chrome.storage.local.set({ [CHECK_KEY]: { ...seen, [id]: Date.now() } });
      tx().scan(g.cache, g, () => false, () => placeGame(g)).then(() => placeGame(g));
    });
  }

  function stopGame() {
    if (!gs) return;
    gs.observer?.disconnect();
    gs = null;
    document.querySelectorAll('.routility-spent-stat').forEach(n => n.remove());
  }

  window.RoUtilitySpending = { setup, teardown, gameStat, stopGame };
})();
