(function () {
  'use strict';

  const { el, onFrame, formatUSD, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const COLUMNS = ['Date', 'Time', 'Type', 'Pending', 'Source', 'Source Type', 'Source ID', 'Item', 'Item Type', 'Item ID', 'Experience', 'Place ID', 'Robux', 'USD'];
  const VERBS = { Sale: LT('Sold {item}'), Purchase: LT('Purchased {item}') };
  const THUMB_TYPES = { User: 'AvatarHeadShot', Group: 'GroupIcon', Asset: 'Asset', GamePass: 'GamePass', DeveloperProduct: 'DeveloperProduct', Bundle: 'BundleThumbnail' };
  const STATUSES = [['any', LT('All')], ['pending', LT('Pending')], ['completed', LT('Completed')]];
  const caches = new Map();
  const thumbs = new Map();
  let st = null;

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const slug = name => String(name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'unnamed';
  const pad = n => String(n).padStart(2, '0');

  function robuxRate(settings) {
    const custom = Number(settings.calcRate);
    if (settings.calcRobux === 'custom' && custom > 0) return custom / 1000;
    return 0.0038;
  }

  function amountOf(td) {
    const display = td && td.querySelector('.amount-display');
    if (!display || !display.lastElementChild) return null;
    const digits = display.lastElementChild.textContent.replace(/[^\d]/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return /[-−]/.test(display.firstElementChild ? display.firstElementChild.textContent : '') ? -n : n;
  }

  function paintUsd(s, td) {
    const n = amountOf(td);
    let tag = td.querySelector(':scope > .routility-tx-usd');
    const text = n ? '≈ ' + formatUSD(Math.abs(n) * s.rate) : '';
    if (!text) {
      tag?.remove();
      return;
    }
    if (!tag) {
      tag = el('span', 'routility-injected routility-tx-usd');
      td.appendChild(tag);
    }
    if (tag.textContent !== text) tag.textContent = text;
  }

  function paintNet(s) {
    const table = document.querySelector('.user-transactions-container .table.summary');
    if (!table) return;
    const old = table.querySelector('.routility-tx-net');
    const totals = [...table.querySelectorAll('tr')].filter(tr => !tr.classList.contains('routility-tx-net') && tr.querySelector('td.summary-transaction-label.font-bold'));
    if (totals.length < 2) {
      old?.remove();
      return;
    }
    const incoming = amountOf(totals[0].querySelector('td.amount'));
    const outgoing = amountOf(totals[1].querySelector('td.amount'));
    if (incoming == null || outgoing == null) return;
    const net = incoming + outgoing;
    if (old && old.dataset.net === String(net) && old.previousElementSibling === totals[1]) return;
    old?.remove();
    const row = totals[1].cloneNode(true);
    row.classList.add('routility-injected', 'routility-tx-net');
    row.dataset.net = String(net);
    row.querySelectorAll('.routility-tx-usd').forEach(n => n.remove());
    const label = row.querySelector('td.summary-transaction-label');
    label.textContent = lt('Net');
    label.dataset.rtTip = lt('Incoming total minus outgoing total for this date range. Pending Robux isn’t counted.');
    const display = row.querySelector('.amount-display');
    if (display && display.firstElementChild) display.firstElementChild.textContent = net < 0 ? '-' : net > 0 ? '+' : '';
    if (display && display.lastElementChild) display.lastElementChild.textContent = formatNumber(Math.abs(net));
    totals[1].after(row);
    paintUsd(s, row.querySelector('td.amount'));
  }

  function currentKey() {
    const base = document.documentElement.dataset.routilityTxUrl;
    if (!base) return null;
    const u = new URL(base);
    return { base, key: `${u.searchParams.get('transactionType')}|${u.searchParams.get('itemPricingType')}`, type: u.searchParams.get('transactionType') || 'transactions' };
  }

  function db() {
    if (!db.p) {
      db.p = new Promise((resolve) => {
        const req = indexedDB.open('routility', 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('tx')) req.result.createObjectStore('tx'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    }
    return db.p;
  }

  async function dbGet(key) {
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      try {
        const req = d.transaction('tx').objectStore('tx').get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async function dbPut(key, value) {
    const d = await db();
    if (!d) return;
    try { d.transaction('tx', 'readwrite').objectStore('tx').put(value, key); } catch {}
  }

  function slim(x) {
    const out = { idHash: x.idHash || '', created: x.created, _t: Date.parse(x.created) || 0, isPending: !!x.isPending, transactionType: x.transactionType, agent: x.agent || {}, details: x.details || {}, currency: { amount: x.currency ? Number(x.currency.amount) || 0 : 0 } };
    out.uid = out.idHash || `${out.created}|${out.currency.amount}|${out.agent.id || ''}|${out.details.id || ''}`;
    return out;
  }

  function cacheFor(info) {
    if (caches.has(info.key)) return caches.get(info.key);
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
    const c = { base: info.base, dbKey: `${me}|${info.key}`, rows: [], ids: new Map(), headCursor: '', headDone: false, tail: '', done: false, failed: false, busy: null, phase: null, hadSaved: false, rescan: false, saveTimer: null };
    c.loaded = dbGet(c.dbKey).then((saved) => {
      if (!saved || !Array.isArray(saved.rows) || !saved.rows.length) return;
      c.rows = saved.rows;
      for (const x of c.rows) c.ids.set(x.uid, x);
      c.tail = saved.tail || '';
      c.done = !!saved.done;
      c.hadSaved = true;
    });
    caches.set(info.key, c);
    return c;
  }

  function saveSoon(c) {
    clearTimeout(c.saveTimer);
    c.saveTimer = setTimeout(() => dbPut(c.dbKey, { rows: c.rows, tail: c.tail, done: c.done, at: Date.now() }), 2500);
  }

  function merge(c, list) {
    let completedHit = null;
    let known = false;
    let added = false;
    for (const raw of list) {
      const x = slim(raw);
      const old = c.ids.get(x.uid);
      if (old) {
        known = true;
        if (!old.isPending && (!completedHit || old._t > completedHit)) completedHit = old._t;
        old.isPending = x.isPending;
        continue;
      }
      c.ids.set(x.uid, x);
      c.rows.push(x);
      added = true;
    }
    if (added) c.rows.sort((a, b) => b._t - a._t);
    return { completedHit, known };
  }

  function pump(c, s, need, onPage) {
    if (c.busy) return c.busy.then(() => (st === s && !c.failed && (!c.headDone || (!c.done && need())) ? pump(c, s, need, onPage) : null));
    c.busy = (async () => {
      await c.loaded;
      const url = new URL(c.base);
      url.searchParams.set('limit', '100');
      while (st === s && !c.failed && !s.stopped) {
        const fresh = !c.hadSaved || c.rescan;
        let phase = null;
        if (!c.headDone && (!fresh || need())) phase = 'head';
        else if (c.headDone && !c.done && c.tail && need()) phase = 'deep';
        if (!phase) break;
        c.phase = phase;
        onPage && onPage();
        url.searchParams.set('cursor', phase === 'head' ? c.headCursor : c.tail);
        let data = null;
        let status = 0;
        for (let tries = 0, limited = 0; st === s; tries++) {
          const res = await fetch(url.href, { credentials: 'include' }).catch(() => null);
          status = res ? res.status : 0;
          if (res && res.ok) {
            data = await res.json().catch(() => null);
            if (data) break;
          }
          if (status === 400 || (status !== 429 && tries >= 4)) break;
          if (status === 429) {
            limited++;
            if (!c.waiting) {
              c.waiting = true;
              onPage && onPage();
            }
          }
          await wait(status === 429 ? Math.min(20000, 3000 * 2 ** Math.min(limited - 1, 3)) : 1500);
          if (s.stopped && phase === 'deep') break;
        }
        if (c.waiting) {
          c.waiting = false;
          onPage && onPage();
        }
        if (st !== s) break;
        if (phase === 'deep' && status === 400) {
          c.rescan = true;
          c.headDone = false;
          c.headCursor = '';
          continue;
        }
        if (!data || !Array.isArray(data.data)) {
          c.failed = true;
          break;
        }
        const next = data.nextPageCursor || '';
        const { completedHit, known } = merge(c, data.data);
        const wantStatus = !!(s.filter && s.filter.status !== 'any');
        if (phase === 'head') {
          c.headCursor = next;
          if (fresh) c.tail = next;
          if (completedHit) {
            for (const x of c.rows) if (x.isPending && x._t < completedHit) x.isPending = false;
            c.statusSynced = true;
          }
          if (!next) {
            c.headDone = true;
            c.done = true;
            c.statusSynced = true;
          } else if (!fresh && (wantStatus ? completedHit : known)) {
            c.headDone = true;
          }
        } else {
          c.tail = next;
          if (!next) c.done = true;
        }
        saveSoon(c);
        onPage && onPage();
      }
      c.phase = null;
    })().finally(() => { c.busy = null; });
    return c.busy;
  }

  function oldestText(c) {
    const last = c.rows[c.rows.length - 1];
    const d = last && new Date(last.created);
    if (!d || Number.isNaN(d.getTime())) return '';
    if (d.toDateString() === new Date().toDateString()) return lt('{time} today', { time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function matches(f, x) {
    const amount = Math.abs(x.currency && Number(x.currency.amount) || 0);
    if (f.min != null && amount < f.min) return false;
    if (f.max != null && amount > f.max) return false;
    if (f.status === 'pending' && !x.isPending) return false;
    if (f.status === 'completed' && x.isPending) return false;
    if (f.source) {
      const agent = x.agent || {};
      const hay = `${agent.name || ''} ${agent.id || ''}`.toLowerCase();
      if (!hay.includes(f.source)) return false;
    }
    if (f.item) {
      const details = x.details || {};
      const place = details.place || {};
      const hay = `${details.name || ''} ${details.id || ''} ${place.name || ''} ${place.placeId || ''}`.toLowerCase();
      if (!hay.includes(f.item)) return false;
    }
    return true;
  }

  function cell(value) {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCsv(rows, rate) {
    const lines = [COLUMNS.join(',')];
    for (const x of rows) {
      const d = new Date(x.created);
      const ok = !Number.isNaN(d.getTime());
      const agent = x.agent || {};
      const details = x.details || {};
      const place = details.place || {};
      const robux = x.currency && Number.isFinite(x.currency.amount) ? x.currency.amount : null;
      lines.push([
        ok ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '',
        ok ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '',
        cell(x.transactionType),
        x.isPending ? 'Yes' : 'No',
        cell(agent.name),
        cell(agent.type),
        agent.id || '',
        cell(details.name),
        cell(details.type),
        details.id || '',
        cell(place.name),
        place.placeId || '',
        robux == null ? '' : robux,
        robux == null ? '' : (robux * rate).toFixed(2),
      ].join(','));
    }
    return '﻿' + lines.join('\r\n');
  }

  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportAll(s, btn, note) {
    const info = currentKey();
    if (!info || s.exporting) return;
    const c = cacheFor(info);
    c.failed = false;
    s.exporting = true;
    btn.disabled = true;
    btn.classList.add('routility-pending');
    note.classList.remove('text-error');
    const filter = s.filter && s.filter.key === info.key ? s.filter : null;
    const progress = () => {
      if (st === s) note.textContent = ltn(c.rows.length, '{n} rows · back to {date}', '{n} rows · back to {date}', { n: formatNumber(c.rows.length), date: oldestText(c) });
    };
    const wasStopped = s.stopped;
    s.stopped = false;
    await c.loaded;
    progress();
    await pump(c, s, () => true, progress);
    s.stopped = wasStopped;
    if (st !== s) return;
    const rows = filter ? c.rows.filter(x => matches(filter, x)) : c.rows;
    if (rows.length) {
      const day = new Date();
      download(toCsv(rows, s.rate), `roblox-${info.type.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${filter ? '-filtered' : ''}-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.csv`);
    }
    note.textContent = !c.rows.length
      ? lt('Couldn’t export right now. Try again in a minute.')
      : c.failed
        ? ltn(c.rows.length, 'Roblox stopped answering at {n} row. The file has those.', 'Roblox stopped answering at {n} rows. The file has those.', { n: formatNumber(c.rows.length) })
        : filter ? ltn(rows.length, '{n} row matching exported', '{n} rows matching exported', { n: formatNumber(rows.length) }) : ltn(rows.length, '{n} row exported', '{n} rows exported', { n: formatNumber(rows.length) });
    note.classList.toggle('text-error', !c.rows.length || c.failed);
    btn.classList.remove('routility-pending');
    btn.disabled = false;
    s.exporting = false;
  }

  function placeExport(s, bar) {
    let wrap = bar.querySelector('.routility-tx-export-wrap');
    if (wrap) return;
    wrap = el('div', 'routility-injected routility-tx-export-wrap');
    const note = el('span', 'text-secondary routility-tx-note');
    const btn = el('button', 'btn-secondary-md routility-tx-export', lt('Export CSV'));
    btn.type = 'button';
    btn.dataset.rtTip = lt('Downloads every transaction of this type as a spreadsheet, not just this page. With filters on, only the matches.');
    btn.addEventListener('click', () => exportAll(s, btn, note));
    wrap.append(note, btn);
    bar.appendChild(wrap);
  }

  function field(label, control, cls) {
    const box = el('div', 'dropdown-btn routility-tx-field' + (cls ? ' ' + cls : ''));
    const lab = el('label', 'font-caption-header text', label);
    box.append(lab, control);
    return box;
  }

  function input(placeholder, numeric) {
    const i = el('input', 'form-control input-field routility-tx-input');
    i.type = 'text';
    i.placeholder = placeholder;
    if (numeric) i.inputMode = 'numeric';
    return i;
  }

  function statusDropdown(s) {
    const group = el('div', 'input-group-btn dropdown btn-group');
    const btn = el('button', 'input-dropdown-btn dropdown-toggle btn btn-default');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    const label = el('span', 'rbx-selection-label', lt('All'));
    btn.append(label, el('span', 'icon-down-16x16'));
    const menu = el('ul', 'dropdown-menu');
    menu.setAttribute('role', 'menu');
    const close = () => {
      group.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };
    for (const [value, text] of STATUSES) {
      const li = el('li', value === 'any' ? 'active' : '');
      li.setAttribute('role', 'presentation');
      const a = el('a', null, lt(text));
      a.href = '#';
      a.setAttribute('role', 'menuitem');
      a.tabIndex = -1;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        s.status = value;
        label.textContent = lt(text);
        menu.querySelectorAll('li').forEach(n => n.classList.toggle('active', n === li));
        close();
      });
      li.appendChild(a);
      menu.appendChild(li);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !group.classList.contains('open');
      document.querySelectorAll('.routility-tx-filters .btn-group.open').forEach(g => g.classList.remove('open'));
      group.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    s.closeMenus = close;
    group.append(btn, menu);
    s.statusLabel = label;
    s.statusMenu = menu;
    return group;
  }

  function placeFilters(s, bar) {
    if (s.filterBar && s.filterBar.isConnected) return;
    const row = el('div', 'dropdown-container container-header routility-injected routility-tx-filters');
    const min = input(lt('Min'), true);
    const max = input(lt('Max'), true);
    const range = el('div', 'routility-tx-range');
    range.append(min, el('span', 'text-secondary routility-tx-dash', '–'), max);
    const source = input(lt('Any community or user'));
    const item = input(lt('Any item or experience'));
    const apply = el('button', 'btn-primary-md routility-tx-apply', lt('Apply'));
    apply.type = 'button';
    const clear = el('button', 'btn-secondary-md routility-tx-clear', lt('Clear Filters'));
    clear.type = 'button';
    clear.disabled = true;
    const actions = el('div', 'routility-tx-actions');
    actions.append(apply, clear);
    row.append(field(lt('Amount (R$)'), range), field(lt('Source'), source, 'routility-tx-source'), field(lt('Item'), item, 'routility-tx-source'), field(lt('Status'), statusDropdown(s)), actions);
    const status = el('div', 'routility-tx-status routility-injected');
    status.hidden = true;
    s.statusLine?.remove();
    bar.after(row);
    row.after(status);
    s.filterBar = row;
    s.statusLine = status;
    s.inputs = { min, max, source, item, clear };
    if (s.filter) {
      min.value = s.filter.min != null ? formatNumber(s.filter.min) : '';
      max.value = s.filter.max != null ? formatNumber(s.filter.max) : '';
      source.value = s.filter.source || '';
      item.value = s.filter.item || '';
      clear.disabled = false;
    }
    const chosen = STATUSES.find(x => x[0] === s.status) || STATUSES[0];
    s.statusLabel.textContent = lt(chosen[1]);
    s.statusMenu.querySelectorAll('li').forEach((n, i) => n.classList.toggle('active', STATUSES[i][0] === chosen[0]));
    const num = (i) => {
      const t = i.value.replace(/[^\d]/g, '');
      return t ? Number(t) : null;
    };
    const run = () => {
      const f = { min: num(min), max: num(max), source: source.value.trim().toLowerCase(), item: item.value.trim().toLowerCase(), status: s.status || 'any' };
      if (f.min != null && f.max != null && f.min > f.max) [f.min, f.max] = [f.max, f.min];
      const empty = f.min == null && f.max == null && !f.source && !f.item && f.status === 'any';
      if (empty) clearFilter(s);
      else startFilter(s, f);
    };
    apply.addEventListener('click', run);
    for (const i of [min, max, source, item]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    for (const i of [min, max]) i.addEventListener('input', () => {
      const v = i.value.replace(/[^\d]/g, '');
      const formatted = v ? formatNumber(Number(v)) : '';
      if (i.value !== formatted) i.value = formatted;
    });
    clear.addEventListener('click', () => {
      min.value = '';
      max.value = '';
      source.value = '';
      item.value = '';
      s.status = 'any';
      s.statusLabel.textContent = lt('All');
      s.statusMenu.querySelectorAll('li').forEach((n, i) => n.classList.toggle('active', i === 0));
      clearFilter(s);
    });
  }

  function perPage() {
    const t = document.querySelector('.transaction-num-items-dropdown .rbx-selection-label');
    const n = t ? Number(t.textContent.replace(/[^\d]/g, '')) : 10;
    return n > 0 ? n : 10;
  }

  function table() {
    return document.querySelector('.user-transactions-container .transactions-container table');
  }

  function clearFilter(s) {
    s.filter = null;
    s.run = (s.run || 0) + 1;
    if (s.inputs) s.inputs.clear.disabled = true;
    if (s.statusLine) s.statusLine.hidden = true;
    document.querySelectorAll('.routility-tx-row, .routility-tx-pager').forEach(n => n.remove());
    document.querySelectorAll('.routility-tx-filtered').forEach(n => n.classList.remove('routility-tx-filtered'));
  }

  function startFilter(s, f) {
    const info = currentKey();
    if (!info) return;
    s.filter = { ...f, key: info.key };
    s.page = 0;
    s.stopped = false;
    s.run = (s.run || 0) + 1;
    s.inputs.clear.disabled = false;
    const c = cacheFor(info);
    c.failed = false;
    s.cache = c;
    s.found = [];
    c.loaded.then(() => {
      if (s.cache !== c || !s.filter) return;
      if (s.filter.status !== 'any' && c.hadSaved && !c.statusSynced && c.headDone && !c.busy) {
        c.headDone = false;
        c.headCursor = '';
      }
      fill(s);
    });
  }

  function fill(s) {
    const c = s.cache;
    const run = s.run;
    const need = () => !s.stopped && s.found.length < (s.page + 1) * perPage() + 1;
    const onPage = () => {
      if (s.run !== run) return;
      s.found = c.rows.filter(x => matches(s.filter, x));
      render(s);
    };
    onPage();
    if (!c.headDone || (!c.done && need())) pump(c, s, () => s.run === run && need(), onPage).then(() => { if (s.run === run) render(s); });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return ['', ''];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return [`${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)}`, `${h}:${pad(d.getMinutes())} ${ampm}`];
  }

  function thumbBox(type, id) {
    const box = el('span', 'thumbnail-2d-container shimmer');
    const key = THUMB_TYPES[type] && id ? `${THUMB_TYPES[type]}:${id}` : null;
    if (key) {
      box.dataset.rtThumb = key;
      if (thumbs.get(key)) setThumb(box, thumbs.get(key));
    }
    return box;
  }

  function setThumb(box, url) {
    box.classList.remove('shimmer');
    if (box.querySelector('img')) return;
    const img = el('img');
    img.src = url;
    img.alt = '';
    box.appendChild(img);
  }

  async function loadThumbs(s) {
    const boxes = [...document.querySelectorAll('.routility-tx-row [data-rt-thumb]')].filter(b => !b.querySelector('img'));
    const want = [...new Set(boxes.map(b => b.dataset.rtThumb))].filter(k => !thumbs.has(k));
    for (const b of boxes) if (thumbs.get(b.dataset.rtThumb)) setThumb(b, thumbs.get(b.dataset.rtThumb));
    if (!want.length) return;
    want.forEach(k => thumbs.set(k, null));
    const body = want.slice(0, 100).map((k, i) => {
      const [type, id] = k.split(':');
      return { requestId: String(i), type, targetId: Number(id), size: type === 'GroupIcon' ? '150x150' : type === 'AvatarHeadShot' ? '48x48' : '150x150', format: 'webp' };
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
    if (st !== s) return;
    for (const b of document.querySelectorAll('.routility-tx-row [data-rt-thumb]')) if (thumbs.get(b.dataset.rtThumb)) setThumb(b, thumbs.get(b.dataset.rtThumb));
    if (retry.length) setTimeout(() => { if (st === s) loadThumbs(s); }, 2000);
  }

  function rowFor(x) {
    const tr = el('tr', 'routility-injected routility-tx-row' + (x.isPending ? ' pending' : ''));
    const [day, time] = formatDate(x.created);
    const date = el('td', 'date');
    date.append(el('div', null, day), el('div', null, time));
    const agent = x.agent || {};
    const group = agent.type === 'Group';
    const href = group ? `https://www.roblox.com/groups/${agent.id}/${slug(agent.name)}#!/about` : `https://www.roblox.com/users/${agent.id}/profile`;
    const user = el('td', 'user');
    const card = el('div', 'avatar-card');
    const av = el('div', 'avatar avatar-headshot-xs ' + (group ? 'group-icon' : 'avatar-headshot'));
    const avLink = el('a', 'avatar-card-link');
    avLink.href = href;
    avLink.appendChild(thumbBox(agent.type, agent.id));
    av.appendChild(avLink);
    const cap = el('div', 'avatar-card-caption');
    const name = el('a', 'avatar-card-name text-name text-overflow', agent.name || '');
    name.href = href;
    cap.appendChild(name);
    card.append(av, cap);
    user.appendChild(card);

    const details = x.details || {};
    const item = el('td', 'item');
    const fmt = el('div', 'item-format' + (details.id ? ' item-sale-format' : ''));
    if (details.id) {
      const pic = el('span', 'item-card-image');
      pic.appendChild(thumbBox(details.type, details.id));
      fmt.appendChild(pic);
    }
    const desc = el('div', 'item-description');
    const line = el('div');
    const span = el('span');
    if (details.name) {
      const verb = VERBS[x.transactionType];
      const [pre, post] = verb ? lt(verb).split('{item}') : [];
      if (pre) span.append(pre);
      const link = details.type === 'Asset' ? `https://www.roblox.com/catalog/${details.id}/${slug(details.name)}`
        : details.type === 'GamePass' ? `https://www.roblox.com/game-pass/${details.id}/${slug(details.name)}`
          : details.type === 'Bundle' ? `https://www.roblox.com/bundles/${details.id}/${slug(details.name)}` : null;
      if (link) {
        const a = el('a', 'text-link text-overflow', details.name);
        a.href = link;
        span.appendChild(a);
      } else span.appendChild(el('span', 'text-overflow', details.name));
      if (post) span.append(post);
    } else span.textContent = /Group Revenue Payout/i.test(x.transactionType) ? lt('Community Payout') : x.transactionType || '';
    line.appendChild(span);
    const sub = el('div', 'routility-tx-sub');
    if (details.place && details.place.placeId) {
      const a = el('a', 'item-card-label text-link text-overflow', details.place.name || '');
      a.href = `https://www.roblox.com/games/${details.place.placeId}/${slug(details.place.name)}`;
      sub.appendChild(a);
    }
    desc.append(line, sub);
    fmt.appendChild(desc);
    item.appendChild(fmt);

    const amount = el('td', 'amount icon-robux-container');
    const n = x.currency ? Number(x.currency.amount) || 0 : 0;
    const display = el('span', 'amount-display');
    display.append(el('span', null, n < 0 ? '-' : ''), el('span', 'icon-robux-16x16'), el('span', '', formatNumber(Math.abs(n))));
    amount.appendChild(display);
    if (x.isPending) {
      const tip = el('span', 'tooltip-container');
      tip.appendChild(el('span', 'icon-clock'));
      amount.appendChild(tip);
    }
    tr.append(date, user, item, amount);
    return tr;
  }

  function skeletonRow() {
    const tr = el('tr', 'routility-injected routility-tx-row routility-tx-skel');
    const bar = (w) => {
      const b = el('span', 'routility-sk routility-tx-sk');
      b.style.width = w;
      return b;
    };
    const date = el('td', 'date');
    date.append(bar('64px'), bar('52px'));
    const user = el('td', 'user');
    const u = el('div', 'routility-tx-sk-line');
    u.append(el('span', 'routility-sk routility-tx-sk-pic'), bar('110px'));
    user.appendChild(u);
    const item = el('td', 'item');
    item.appendChild(bar('180px'));
    const amount = el('td', 'amount');
    amount.appendChild(bar('56px'));
    tr.append(date, user, item, amount);
    return tr;
  }

  function pager(s, total, more) {
    const holder = el('div', 'pager-holder routility-injected routility-tx-pager');
    const ul = el('ul', 'pager');
    const mk = (cls, icon, disabled, go) => {
      const li = el('li', cls);
      const b = el('button', icon === 'left' ? 'btn-generic-left-sm' : 'btn-generic-right-sm');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', icon === 'left' ? lt('Previous page') : lt('Next page'));
      b.appendChild(el('span', 'icon-' + icon));
      b.addEventListener('click', go);
      li.appendChild(b);
      return li;
    };
    const per = perPage();
    const last = Math.max(0, Math.ceil(total / per) - 1);
    ul.append(
      mk('pager-prev', 'left', s.page === 0, () => { s.page--; render(s); }),
      (() => { const li = el('li', 'pager-cur'); li.appendChild(el('span', null, String(s.page + 1))); return li; })(),
      mk('pager-next', 'right', !(s.page < last || more), () => { s.page++; fill(s); }),
    );
    holder.appendChild(ul);
    return holder;
  }

  function render(s) {
    const t = table();
    if (!t || !s.filter) return;
    const body = t.tBodies[0] || t;
    t.classList.add('routility-tx-filtered');
    const wrapper = t.closest('.transactions-container') || t.parentElement;
    wrapper.classList.add('routility-tx-filtered');
    body.querySelectorAll('.routility-tx-row').forEach(n => n.remove());
    const per = perPage();
    const c = s.cache;
    const busy = !!c.busy && !c.failed && !s.stopped;
    const slice = s.found.slice(s.page * per, (s.page + 1) * per);
    const frag = document.createDocumentFragment();
    for (const x of slice) frag.appendChild(rowFor(x));
    if (busy && slice.length < per) for (let i = slice.length; i < Math.min(per, slice.length + 3); i++) frag.appendChild(skeletonRow());
    if (!busy && !s.found.length) {
      const tr = el('tr', 'routility-injected routility-tx-row');
      const td = el('td', 'text-secondary routility-tx-empty', c.failed && !c.rows.length ? lt('Couldn’t load transactions right now. Try again in a minute.') : lt('No transactions match these filters.'));
      td.colSpan = 4;
      tr.appendChild(td);
      frag.appendChild(tr);
    }
    body.appendChild(frag);
    wrapper.querySelectorAll('.routility-tx-pager').forEach(n => n.remove());
    if (s.found.length > per || s.page > 0) wrapper.appendChild(pager(s, s.found.length, busy));
    paintStatus(s);
    loadThumbs(s);
  }

  function paintStatus(s) {
    const line = s.statusLine;
    const c = s.cache;
    if (!line || !c) return;
    const n = s.found.length;
    const back = oldestText(c);
    const typeName = (document.querySelector('.transaction-type-dropdown .rbx-selection-label')?.textContent || lt('transactions')).trim();
    const vars = { found: ltn(n, '{n} found', '{n} found', { n: formatNumber(n) }), total: formatNumber(c.rows.length), type: typeName, date: back };
    const searching = !!c.busy && !s.stopped;
    let text;
    let action = null;
    const saved = c.hadSaved && !c.rescan;
    if (searching && c.phase === 'head' && saved) {
      text = s.filter && s.filter.status !== 'any'
        ? lt('{found} in your saved {type} (back to {date}). Checking which pending ones have completed…', vars)
        : lt('{found} in your saved {type} (back to {date}). Checking for new ones since your last visit…', vars);
      action = [lt('Stop'), () => { s.stopped = true; render(s); }];
    } else if (c.done && !c.busy) text = lt('{found} in all {total} {type}.', vars);
    else if (c.failed) {
      text = back ? lt('Roblox stopped answering. {found} in the {total} most recent (back to {date}).', vars) : lt('Roblox stopped answering. {found} in the {total} most recent.', vars);
      action = [lt('Try Again'), () => { c.failed = false; s.stopped = false; fill(s); }];
    } else if (s.stopped) {
      text = back ? lt('Stopped. {found} in the {total} most recent (back to {date}).', vars) : lt('Stopped. {found} in the {total} most recent.', vars);
      action = [lt('Keep Searching'), () => { s.stopped = false; fill(s); }];
    } else if (searching && c.waiting) {
      text = back ? lt('Roblox asked RoUtility to slow down, carrying on in a moment. {found} so far in the {total} most recent (back to {date}).', vars) : lt('Roblox asked RoUtility to slow down, carrying on in a moment. {found} so far in the {total} most recent.', vars);
      action = [lt('Stop'), () => { s.stopped = true; render(s); }];
    } else if (searching) {
      text = back ? lt('Searching… {found} so far in the {total} most recent (back to {date}). Roblox only sends about 500 a minute, so older ones take a while.', vars) : lt('Searching… {found} so far in the {total} most recent. Roblox only sends about 500 a minute, so older ones take a while.', vars);
      action = [lt('Stop'), () => { s.stopped = true; render(s); }];
    } else if (c.done) text = lt('{found} in all {total} {type}.', vars);
    else text = back ? lt('{found} in the {total} most recent (back to {date}). The next page searches further back.', vars) : lt('{found} in the {total} most recent. The next page searches further back.', vars);
    line.textContent = '';
    line.hidden = false;
    if (searching) line.appendChild(el('span', 'routility-tx-spin'));
    line.appendChild(el('span', null, text));
    if (n) {
      const sum = s.found.reduce((t, x) => t + Math.abs(x.currency && Number(x.currency.amount) || 0), 0);
      const total = el('span', 'routility-tx-total');
      total.append(el('span', 'icon-robux-16x16'), el('span', null, formatNumber(sum)));
      if (s.usd) total.appendChild(el('span', 'routility-tx-total-usd', '≈ ' + formatUSD(sum * s.rate)));
      total.dataset.rtTip = lt('Total Robux of every match found so far. Pending Robux is included.');
      line.appendChild(total);
    }
    if (action) {
      const b = el('button', 'btn-link routility-tx-status-btn', action[0]);
      b.type = 'button';
      b.addEventListener('click', action[1]);
      line.appendChild(b);
    }
  }

  function tick(s) {
    if (st !== s) return;
    if (s.usd) {
      document.querySelectorAll('.user-transactions-container td.amount.icon-robux-container').forEach(td => paintUsd(s, td));
      paintNet(s);
    }
    const bar = document.querySelector('.user-transactions-container .dropdown-container.container-header:not(.routility-tx-filters)');
    const summary = !!document.querySelector('.user-transactions-container .table.summary');
    if (summary) {
      if (!s.exporting) document.querySelectorAll('.routility-tx-export-wrap').forEach(n => n.remove());
      if (s.filterBar) {
        clearFilter(s);
        s.filterBar.remove();
        s.statusLine.remove();
        s.filterBar = null;
      }
      return;
    }
    if (!bar || !table()) return;
    if (s.exportOn) placeExport(s, bar);
    if (s.filtersOn) {
      const fresh = !(s.filterBar && s.filterBar.isConnected);
      placeFilters(s, bar);
      if (fresh && s.filter) render(s);
    }
    const info = currentKey();
    if (s.filter && info && info.key !== s.filter.key) startFilter(s, s.filter);
    if (s.filter && table() && !table().querySelector('.routility-tx-row')) render(s);
  }

  function setup(settings) {
    teardown();
    const s = st = { usd: settings.txUsd !== false, exportOn: settings.txExport !== false, filtersOn: settings.txFilters !== false, rate: robuxRate(settings), exporting: false, status: 'any' };
    if (!s.usd && !s.exportOn && !s.filtersOn) return;
    s.observer = new MutationObserver(onFrame(() => tick(s)));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, characterData: true });
    s.outside = (e) => { if (!e.target.closest || !e.target.closest('.routility-tx-filters .btn-group')) s.closeMenus && s.closeMenus(); };
    document.addEventListener('click', s.outside);
    tick(s);
  }

  function teardown() {
    if (!st) return;
    st.observer?.disconnect();
    document.removeEventListener('click', st.outside);
    st = null;
    document.querySelectorAll('.routility-tx-usd, .routility-tx-net, .routility-tx-export-wrap, .routility-tx-filters, .routility-tx-status, .routility-tx-row, .routility-tx-pager').forEach(n => n.remove());
    document.querySelectorAll('.routility-tx-filtered').forEach(n => n.classList.remove('routility-tx-filtered'));
  }

  window.RoUtilityTransactions = { setup, teardown };
})();
