(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, formatNumber, formatUSD, request, json, valueTag } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const RANGES = [['7d', 'Past 7 Days'], ['30d', 'Past 30 Days'], ['all', 'All Time']];
  const PER_PAGE = 20;
  const counts = new Map();

  function fetchTrades(id, range, page, limit) {
    return request({ type: 'itemTrades', id: String(id), range, page, limit }, r => r && Array.isArray(r.trades));
  }

  function ago(ts) {
    const s = Math.max(0, Date.now() / 1000 - ts);
    const units = [
      [31536000, n => ltn(n, '{n} year ago', '{n} years ago')],
      [2592000, n => ltn(n, '{n} month ago', '{n} months ago')],
      [604800, n => ltn(n, '{n} week ago', '{n} weeks ago')],
      [86400, n => ltn(n, '{n} day ago', '{n} days ago')],
      [3600, n => ltn(n, '{n} hour ago', '{n} hours ago')],
      [60, n => ltn(n, '{n} minute ago', '{n} minutes ago')],
    ];
    for (const [size, text] of units) {
      const n = Math.floor(s / size);
      if (n >= 1) return text(n);
    }
    return lt('just now');
  }

  function svg(d) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '20');
    s.setAttribute('height', '20');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }

  async function count(id) {
    if (counts.has(id)) return counts.get(id);
    const job = Promise.all([fetchTrades(id, '7d', 1, 1), fetchTrades(id, '30d', 1, 1)]).then(([week, month]) => {
      if (!week || !month) return null;
      return { week: week.total || 0, month: month.total || 0, all: week.total_all || 0 };
    });
    counts.set(id, job);
    const out = await job;
    if (!out) counts.delete(id);
    return out;
  }

  async function fill(holder, row, item) {
    const id = String(item.id);
    const c = await count(id);
    if (!holder.isConnected) return;
    if (!c || !c.all) {
      row.remove();
      return;
    }
    const text = c.week ? ltn(c.week, '{n} trade in the past week', '{n} trades in the past week', { n: formatNumber(c.week) })
      : c.month ? ltn(c.month, '{n} trade in the past month', '{n} trades in the past month', { n: formatNumber(c.month) })
        : ltn(c.all, '{n} trade all time', '{n} trades all time', { n: formatNumber(c.all) });
    const link = el('a', 'text-link font-body routility-it-open', lt('See trades'));
    link.href = '#';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      open([item], c.week ? '7d' : c.month ? '30d' : 'all');
    });
    holder.replaceChildren(el('span', 'font-body text', text), el('span', 'font-body text routility-it-dot', '·'), link);
    placeSection(item, c.week ? '7d' : c.month ? '30d' : 'all');
  }

  function placeSection(item, startRange) {
    const assetId = String(item.id);
    let tries = 0;
    const attempt = () => {
      const chart = document.querySelector('#price-chart');
      const old = document.querySelector('.routility-it-section');
      if (old && old.dataset.asset === assetId && old.isConnected) return;
      old?.remove();
      if (!chart) {
        if (tries++ < 30) setTimeout(attempt, 500);
        return;
      }
      chart.after(section(item, startRange));
    };
    attempt();
  }

  function section(item, startRange) {
    const assetId = String(item.id);
    const box = el('div', 'tab-pane price-chart-section routility-injected routility-it-section');
    box.dataset.asset = assetId;
    const head = el('div', 'container-header routility-it-section-head');
    head.appendChild(el('h2', null, lt('Recent Trades')));
    const tabs = el('div', 'routility-it-tabs');
    head.appendChild(tabs);
    const list = el('ul', 'routility-it-list');
    const note = el('p', 'routility-modal-note routility-it-note', '');
    const all = el('button', 'btn-control-sm routility-it-more', lt('See all trades'));
    all.type = 'button';
    box.append(head, sideNote(), list, note, all);
    const heads = new Map();
    const s = { range: startRange, token: 0 };
    all.addEventListener('click', () => open([item], s.range));
    const load = async () => {
      const token = ++s.token;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('routility-it-tab-on', b.dataset.range === s.range));
      list.textContent = '';
      note.textContent = '';
      for (let i = 0; i < 2; i++) list.appendChild(el('li', 'routility-it-trade routility-it-skeleton'));
      const r = await fetchTrades(assetId, s.range, 1, 5);
      if (token !== s.token) return;
      list.textContent = '';
      if (!r) {
        note.textContent = lt('Couldn’t load trades. Try again in a moment.');
        all.hidden = true;
        return;
      }
      const ids = [...new Set(r.trades.flatMap(t => [t.side_a && t.side_a.id, t.side_b && t.side_b.id]).filter(Boolean).map(String))];
      await avatars(ids, heads);
      if (token !== s.token) return;
      for (const t of r.trades) list.appendChild(tradeCard(t, assetId, heads));
      note.textContent = r.trades.length ? '' : lt('No trades in this time.');
      all.hidden = (r.total || 0) <= r.trades.length;
    };
    for (const [value, label] of RANGES) {
      const b = el('button', 'routility-it-tab', lt(label));
      b.type = 'button';
      b.dataset.range = value;
      b.addEventListener('click', () => {
        s.range = value;
        load();
      });
      tabs.appendChild(b);
    }
    load();
    return box;
  }

  async function avatars(ids, into) {
    const need = ids.filter(i => i && !into.has(i));
    if (!need.length) return;
    const r = await json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${need.slice(0, 100).join(',')}&size=48x48&format=Webp&isCircular=true`).catch(() => null);
    for (const d of (r && r.data) || []) if (d.imageUrl) into.set(String(d.targetId), d.imageUrl);
  }

  function person(side, heads) {
    const a = el('a', 'routility-it-user');
    a.href = `https://www.roblox.com/users/${side.id}/profile`;
    const img = el('img', 'routility-it-head');
    img.alt = '';
    const src = heads.get(String(side.id));
    if (src) img.src = src;
    a.append(img, el('span', 'routility-it-name', side.name || lt('Hidden')));
    return a;
  }

  function sideNote() {
    const p = el('p', 'routility-it-warn');
    const parts = lt('Trades can include {extra} on the side, which we can’t see. The totals only count the items.').split('{extra}');
    p.append(parts[0] || '', el('strong', null, lt('Robux or USD')), parts.slice(1).join(''));
    return p;
  }

  function tileTip(it) {
    const lines = [(it.name || '') + (it.serial ? ' #' + formatNumber(Number(it.serial)) : '')];
    if (it.usd) lines.push(lt('Price') + ' ' + formatUSD(it.usd));
    if (it.value_then) lines.push(lt('Value') + ' ' + formatNumber(it.value_then));
    lines.push('RAP ' + formatNumber(it.rap || 0));
    return lines.join('\n');
  }

  function tile(it, assetId) {
    const a = el('a', 'routility-it-tile' + (String(it.asset_id) === assetId ? ' routility-it-this' : ''));
    a.href = `https://www.roblox.com/catalog/${it.asset_id}`;
    a.dataset.rtTip = tileTip(it);
    const img = el('img');
    img.alt = it.name || '';
    if (it.thumb) img.src = it.thumb;
    a.appendChild(img);
    return a;
  }

  function totals(items, usd) {
    const box = el('div', 'routility-it-totals');
    const value = (items || []).reduce((n, it) => n + (Number(it.value_then) || Number(it.rap) || 0), 0);
    const rap = (items || []).reduce((n, it) => n + (Number(it.rap) || 0), 0);
    if (usd) box.appendChild(el('span', 'routility-it-usd', formatUSD(usd)));
    if (value && (items || []).some(it => Number(it.value_then) > 0)) box.appendChild(valueTag(value, { short: true, className: 'routility-it-value' }));
    const r = el('span', 'routility-it-rap');
    const icon = el('span', 'icon icon-regular-robux routility-it-rap-icon');
    icon.setAttribute('aria-hidden', 'true');
    r.append(icon, el('span', null, formatNumber(rap)));
    r.dataset.rtTip = 'RAP ' + formatNumber(rap);
    box.appendChild(r);
    return box;
  }

  function sideBox(user, items, usd, assetId, heads) {
    const box = el('div', 'routility-it-side');
    const head = el('div', 'routility-it-side-head');
    head.append(person(user, heads), totals(items, usd));
    const tiles = el('div', 'routility-it-tiles');
    for (const it of items || []) tiles.appendChild(tile(it, assetId));
    if (!items || !items.length) tiles.appendChild(el('span', 'routility-it-none', lt('Nothing')));
    box.append(head, tiles);
    return box;
  }

  function tradeCard(t, assetId, heads) {
    const card = el('li', 'routility-it-trade');
    const mid = el('div', 'routility-it-mid');
    const swap = el('span', 'routility-it-swap');
    swap.appendChild(svg('M7 7h13l-4-4M17 17H4l4 4'));
    const when = el('span', 'routility-it-when', ago(t.ts_latest || t.ts));
    when.dataset.rtTip = new Date((t.ts_latest || t.ts) * 1000).toLocaleString();
    mid.append(swap, when);
    card.append(sideBox(t.side_a, t.side_a_items, t.total_usd_a, assetId, heads), mid, sideBox(t.side_b, t.side_b_items, t.total_usd_b, assetId, heads));
    return card;
  }

  function open(items, startRange, startIndex = 0) {
    items = (items || []).filter(i => i && /^\d+$/.test(String(i.id)));
    if (!items.length) return;
    document.querySelector('.routility-it-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-it-backdrop');
    const modal = el('div', 'routility-modal routility-it-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const title = el('h2', 'routility-modal-title', lt('Recent Trades'));
    const sub = el('span', 'routility-modal-count');
    title.appendChild(sub);
    const ext = el('a', 'routility-modal-icon');
    ext.target = '_blank';
    ext.rel = 'noopener';
    ext.dataset.rtTip = lt('Open on RoUtility');
    ext.appendChild(svg('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'));
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(svg('M6 6l12 12M18 6L6 18'));
    head.append(title, ext, close);
    const picker = el('div', 'routility-it-items-pick');
    const tabs = el('div', 'routility-it-tabs');
    const body = el('div', 'routility-modal-body');
    const list = el('ul', 'routility-it-list');
    const note = el('p', 'routility-modal-note routility-it-note', '');
    const more = el('button', 'btn-control-sm routility-it-more', lt('See More'));
    more.type = 'button';
    more.hidden = true;
    body.append(list, note, more);
    modal.append(head);
    if (items.length > 1) modal.append(picker);
    modal.append(tabs, sideNote(), body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');

    const heads = new Map();
    const s = { index: Math.min(startIndex, items.length - 1), range: startRange, page: 0, pages: 1, token: 0 };

    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') shut(); };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) shut(); });

    const load = async () => {
      const token = s.token;
      const assetId = String(items[s.index].id);
      more.disabled = true;
      note.textContent = '';
      if (!s.page) for (let i = 0; i < 3; i++) list.appendChild(el('li', 'routility-it-trade routility-it-skeleton'));
      const r = await fetchTrades(assetId, s.range, s.page + 1, PER_PAGE);
      if (token !== s.token || !backdrop.isConnected) return;
      list.querySelectorAll('.routility-it-skeleton').forEach(n => n.remove());
      more.disabled = false;
      if (!r) {
        note.textContent = lt('Couldn’t load trades. Try again in a moment.');
        return;
      }
      s.page = r.page || s.page + 1;
      s.pages = r.pages || 1;
      const ids = [...new Set(r.trades.flatMap(t => [t.side_a && t.side_a.id, t.side_b && t.side_b.id]).filter(Boolean).map(String))];
      await avatars(ids, heads);
      if (token !== s.token) return;
      for (const t of r.trades) list.appendChild(tradeCard(t, assetId, heads));
      note.textContent = list.children.length ? '' : lt('No trades in this time.');
      more.hidden = s.page >= s.pages;
    };

    const show = () => {
      const it = items[s.index];
      sub.textContent = it.name || '';
      ext.href = `https://routility.io/items/${it.id}`;
      s.page = 0;
      s.token++;
      list.textContent = '';
      body.scrollTop = 0;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('routility-it-tab-on', b.dataset.range === s.range));
      picker.querySelectorAll('button').forEach((b, i) => b.classList.toggle('routility-it-pick-on', i === s.index));
      load();
    };

    items.forEach((it, i) => {
      const b = el('button', 'routility-it-pick');
      b.type = 'button';
      if (it.thumb) {
        const img = el('img');
        img.src = it.thumb;
        img.alt = '';
        b.appendChild(img);
      }
      const name = el('span', 'routility-it-pick-name', it.name || '');
      const n = el('span', 'routility-it-pick-count', '');
      b.append(name, n);
      b.title = it.name || '';
      b.addEventListener('click', () => {
        s.index = i;
        show();
      });
      picker.appendChild(b);
      if (items.length > 1) count(String(it.id)).then((c) => {
        if (!c) return;
        n.textContent = c.week ? ltn(c.week, '{n} this week', '{n} this week', { n: formatNumber(c.week) }) : c.all ? '' : lt('No trades');
        if (!c.all) b.classList.add('routility-it-pick-none');
      });
    });
    for (const [value, label] of RANGES) {
      const b = el('button', 'routility-it-tab', lt(label));
      b.type = 'button';
      b.dataset.range = value;
      b.addEventListener('click', () => {
        s.range = value;
        show();
      });
      tabs.appendChild(b);
    }
    more.addEventListener('click', load);
    show();
  }

  window.RoUtilityItemTrades = { fill, open };
})();
