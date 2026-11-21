(function () {
  'use strict';

  const { el, formatNumber, request, valueTag, itemValue } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const SITE = 'https://routility.io';
  const STATE = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const ICON_YOU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/></svg>';
  const ICON_THEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>';

  const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  let on = true;
  let catalog = null;
  const withYou = new Map();
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
      if (!d || !Array.isArray(d.data)) break;
      out.push(...d.data);
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  function loadWithYou(pid) {
    if (!withYou.has(pid)) {
      withYou.set(pid, Promise.all(['inbound', 'outbound', 'completed', 'inactive'].map(type => listType(type).then(list => list
        .filter(t => String(t.user && t.user.id) === pid)
        .map(t => ({ id: String(t.id), at: Date.parse(t.created) || 0, type, status: String(t.status || '') }))))).then(parts => parts.flat().sort((a, b) => b.at - a.at)));
    }
    return withYou.get(pid);
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
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (v >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return formatNumber(Math.round(v));
  }

  function signed(n, kind) {
    const span = el('span', 'routility-tp-net ' + (n > 0 ? 'routility-tp-up' : n < 0 ? 'routility-tp-down' : 'content-muted'));
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    if (kind === 'usd') {
      span.textContent = sign + window.RoUtilityUI.formatCash(Math.abs(n));
      return span;
    }
    const logo = el('img', 'routility-val-logo routility-tp-logo');
    logo.alt = '';
    logo.src = chrome.runtime.getURL('assets/icons/logo.png');
    span.append(document.createTextNode(sign), logo, document.createTextNode(shortNum(n)));
    return span;
  }

  function nets(value, usdAmount) {
    const out = [];
    if (Number.isFinite(value)) out.push(signed(value, 'value'));
    if (Number.isFinite(usdAmount)) out.push(signed(usdAmount, 'usd'));
    return out;
  }

  function worthOf(x, map) {
    const item = map.get(String(x.asset_id));
    return (item && (itemValue(item) || item.rap)) || Number(x.value_then) || Number(x.rap) || 0;
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
    titles.append(el('h2', 'routility-modal-title', title), el('span', 'text-body-medium content-muted', sub));
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titles, close);
    const body = el('div', 'routility-modal-body routility-tp-body');
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

  async function openWithYou(pid, name) {
    const body = modal(lt('Your trades with {name}', { name }), lt('Every trade between you two that Roblox still lists'));
    body.replaceChildren(skeletonRows(4));
    const list = await loadWithYou(pid);
    if (!list.length) return body.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('You haven’t traded with them yet.')));
    const ul = el('ul', 'routility-clean-list routility-tp-list');
    for (const t of list) {
      const li = el('li', 'routility-clean-item');
      const left = el('span', 'routility-tp-cells');
      left.append(el('span', 'text-label-medium content-emphasis routility-tp-date', day(t.at)), el('span', 'text-body-small content-muted', ago(t.at)));
      li.append(left, el('span', 'text-label-medium ' + (t.type === 'completed' ? 'routility-tp-up' : 'content-muted'), statusText(t)));
      ul.appendChild(li);
    }
    body.replaceChildren(ul);
  }

  function thumbOf(x, map) {
    const item = map.get(String(x.asset_id));
    if (item && item.thumb) return item.thumb;
    const raw = String(x.thumb || '');
    if (!raw) return '';
    try {
      const inner = new URL(raw, SITE).searchParams.get('url');
      if (inner && /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//i.test(inner)) return inner;
    } catch {}
    return raw.startsWith('/') ? SITE + raw : raw;
  }

  function itemsBlock(label, list, map) {
    const col = el('div', 'routility-tp-side');
    col.appendChild(el('span', 'text-caption-medium content-muted', label));
    const row = el('div', 'routility-tp-items');
    for (const x of list) {
      const it = el('a', 'routility-tp-item');
      it.href = `https://www.roblox.com/catalog/${x.asset_id}`;
      it.target = '_blank';
      it.rel = 'noopener';
      it.dataset.rtTip = x.name + (x.serial ? ' #' + x.serial : '');
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = thumbOf(x, map);
      const w = worthOf(x, map);
      it.append(img, el('span', 'text-caption-medium content-muted', w ? shortNum(w) : '-'));
      row.appendChild(it);
    }
    col.appendChild(row);
    return col;
  }

  async function openTheirs(pid, name) {
    const body = modal(lt('{name}’s trades', { name }), lt('Trades they completed with anyone, tracked by routility.io'));
    body.replaceChildren(skeletonRows(6));
    const map = await catalogMap();
    const first = await loadTheirs(pid, 1);
    if (!first) return body.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('Couldn’t load their trades. Try again in a moment.')));
    const meta = first.meta || {};
    if (!first.trades.length) return body.replaceChildren(el('div', 'text-body-medium content-muted routility-tp-empty', lt('routility.io hasn’t tracked any trades for them yet.')));
    const summary = el('div', 'routility-tp-summary');
    summary.append(el('span', 'text-label-medium content-emphasis', ltn(meta.total_all || first.trades.length, '{n} tracked trade', '{n} tracked trades', { n: formatNumber(meta.total_all || first.trades.length) })));
    if (meta.net) {
      const net = el('span', 'routility-tp-summary-net text-label-medium');
      net.append(el('span', 'content-muted', lt('Net')), ...nets(Number(meta.net.value), Number(meta.net.price)));
      summary.appendChild(net);
    }
    const ul = el('ul', 'routility-clean-list routility-tp-list');
    const more = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium padding-x-medium height-1000 bg-action-standard content-action-standard routility-tp-loadmore', lt('Load More'));
    more.type = 'button';
    const site = el('a', 'text-label-medium content-action-utility routility-tp-site', lt('See all on routility.io'));
    site.href = `${SITE}/player/${pid}/trades`;
    site.target = '_blank';
    site.rel = 'noopener';
    const foot = el('div', 'routility-tp-foot');
    foot.append(more, site);
    body.replaceChildren(summary, ul, foot);
    let page = 1;
    const add = (data) => {
      for (const t of data.trades) {
        const net = (t.got || []).reduce((n, x) => n + worthOf(x, map), 0) - (t.gave || []).reduce((n, x) => n + worthOf(x, map), 0);
        const li = el('li', 'routility-tp-trade');
        const row = el('div', 'routility-clean-item routility-tp-traderow');
        const left = el('span', 'routility-tp-cells');
        const who = el('a', 'text-label-medium content-emphasis', lt('with {name}', { name: (t.partner && t.partner.name) || '?' }));
        if (t.partner && t.partner.id) {
          who.href = `https://www.roblox.com/users/${t.partner.id}/profile`;
          who.target = '_blank';
          who.rel = 'noopener';
        }
        left.append(el('span', 'text-label-medium content-muted routility-tp-date', day(t.ts * 1000)), who, el('span', 'text-body-small content-muted', ago(t.ts * 1000)), ...nets(net, Number(t.net_usd)));
        if (t.inferred) {
          const likely = el('span', 'text-caption-medium content-muted routility-tp-likely', lt('Likely'));
          likely.dataset.rtTip = lt('Matched from item movements, not confirmed');
          left.appendChild(likely);
        }
        const view = el('button', 'text-label-medium content-action-utility routility-tp-view');
        view.type = 'button';
        const chev = el('span', 'routility-tp-chev');
        chev.innerHTML = CHEVRON;
        view.append(el('span', null, lt('View Trade')), chev);
        view.setAttribute('aria-expanded', 'false');
        row.append(left, view);
        const detail = el('div', 'routility-tp-detail');
        detail.hidden = true;
        view.addEventListener('click', () => {
          if (!detail.childElementCount) detail.append(itemsBlock(lt('They gave'), t.gave || [], map), itemsBlock(lt('They got'), t.got || [], map));
          detail.hidden = !detail.hidden;
          view.setAttribute('aria-expanded', String(!detail.hidden));
          li.classList.toggle('routility-tp-open', !detail.hidden);
        });
        li.append(row, detail);
        ul.appendChild(li);
      }
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
    you.addEventListener('click', () => openWithYou(pid, partnerName(h1)));
    them.addEventListener('click', () => openTheirs(pid, partnerName(h1)));
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

  function statChip(icon, count, label, tip, onClick) {
    const li = el('li', 'routility-injected routility-pill-stat routility-tp-stat');
    const btn = el('button', 'text-name routility-mutual-count routility-tp-stat-btn');
    btn.type = 'button';
    const ic = el('span', 'routility-tp-stat-icon');
    ic.innerHTML = icon;
    btn.append(ic, el('span', null, formatNumber(count)));
    li.append(btn, el('div', 'text-label font-caption-header', label));
    if (tip) li.dataset.rtTip = tip;
    li.addEventListener('click', onClick);
    return li;
  }

  function netTip(value, usdAmount) {
    const parts = [];
    if (Number.isFinite(value)) parts.push((value > 0 ? '+' : value < 0 ? '−' : '') + formatNumber(Math.abs(Math.round(value))) + ' ' + lt('Value'));
    if (Number.isFinite(usdAmount)) parts.push((usdAmount > 0 ? '+' : usdAmount < 0 ? '−' : '') + window.RoUtilityUI.formatCash(Math.abs(usdAmount)));
    return parts.length ? lt('Net: {amounts}', { amounts: parts.join(', ') }) : '';
  }

  let profileBusy = '';
  async function ensureProfile() {
    const m = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/profile\/?$/i);
    const row = document.querySelector('.routility-value-row');
    if (!on || !m || !row) {
      if (!on) document.querySelectorAll('.routility-tp-stat').forEach(x => x.remove());
      return;
    }
    const pid = m[1];
    if (row.dataset.rtTp === pid || profileBusy === pid) return;
    profileBusy = pid;
    const own = pid === me();
    const header = document.querySelector('.user-profile-header-info') || row.parentElement;
    const nameOf = () => {
      const leaf = header && [...header.querySelectorAll('*')].find(e => !e.children.length && /^@\w+$/.test(e.textContent.trim()));
      return leaf ? leaf.textContent.trim().slice(1) : lt('them');
    };
    const [list, d] = await Promise.all([own ? Promise.resolve([]) : loadWithYou(pid), loadTheirs(pid, 1)]);
    profileBusy = '';
    const live = document.querySelector('.routility-value-row');
    if (!live || !location.pathname.includes('/users/' + pid + '/') || live.dataset.rtTp === pid) return;
    live.dataset.rtTp = pid;
    live.querySelectorAll('.routility-tp-stat').forEach(x => x.remove());
    if (list.length) {
      const done = list.filter(t => t.type === 'completed').length;
      live.appendChild(statChip(ICON_YOU, list.length, ltn(list.length, 'Trade With You', 'Trades With You'), ltn(done, '{n} went through', '{n} went through', { n: formatNumber(done) }), () => openWithYou(pid, nameOf())));
    }
    const total = (d && d.meta && d.meta.total_all) || 0;
    if (total) live.appendChild(statChip(ICON_THEM, total, ltn(total, 'Tracked Trade', 'Tracked Trades'), d.meta.net ? netTip(Number(d.meta.net.value), Number(d.meta.net.price)) : '', () => openTheirs(pid, nameOf())));
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
      document.querySelectorAll('.routility-value-row').forEach(r => { delete r.dataset.rtTp; });
      ensure();
      ensureProfile();
    });
  }
})();
