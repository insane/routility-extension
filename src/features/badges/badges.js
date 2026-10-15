(function () {
  'use strict';

  const { el, onFrame, formatNumber, dropdown, json, chunks } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const TTL = 10 * 60 * 1000;
  const PAGE = 25;
  const SORTS = [
    { value: 'default', label: LT('Default Order') },
    { value: 'rarest', label: LT('Rarest First') },
    { value: 'common', label: LT('Most Common First') },
    { value: 'yesterday', label: LT('Most Won Yesterday') },
    { value: 'newest', label: LT('Newest First') },
    { value: 'oldest', label: LT('Oldest First') },
  ];
  const SHOWS = [
    { value: 'all', label: LT('All Badges') },
    { value: 'missing', label: LT('Not Owned') },
    { value: 'owned', label: LT('Owned') },
  ];
  const DIFFICULTY = [[90, LT('Freebie')], [80, LT('Cakewalk')], [50, LT('Easy')], [30, LT('Moderate')], [20, LT('Challenging')], [10, LT('Hard')], [5, LT('Extreme')], [1, LT('Insane')], [0, LT('Impossible')]];
  let state = null;

  function cacheKey(universeId, me) {
    return `routilityBadges2:${me}:${universeId}`;
  }

  async function load(universeId, me) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(cacheKey(universeId, me)) || 'null');
      if (hit && Date.now() - hit.at < TTL) return hit;
    } catch {}
    const ids = [];
    const list = [];
    let cursor = '';
    for (let page = 0; page < 10; page++) {
      const data = await json(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=100&sortOrder=Asc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!data) return null;
      for (const b of data.data || []) {
        if (b.enabled === false) continue;
        ids.push(String(b.id));
        const stats = b.statistics || {};
        list.push({ id: String(b.id), name: b.displayName || b.name || '', description: b.displayDescription || b.description || '', created: b.created || '', day: Number(stats.pastDayAwardedCount) || 0, ever: Number(stats.awardedCount) || 0, rate: Number(stats.winRatePercentage) || 0 });
      }
      cursor = data.nextPageCursor;
      if (!cursor) break;
    }
    const earned = {};
    const pages = await Promise.all(chunks(ids, 100).map(part => json(`https://badges.roblox.com/v1/users/${me}/badges/awarded-dates?badgeIds=${part.join(',')}`)));
    if (pages.some(data => !data)) return null;
    for (const data of pages) for (const a of data.data || []) earned[String(a.badgeId)] = a.awardedDate;
    const result = { at: Date.now(), total: ids.length, earned, list };
    try { sessionStorage.setItem(cacheKey(universeId, me), JSON.stringify(result)); } catch {}
    return result;
  }

  function date(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function rarity(rate) {
    const pct = rate * 100;
    const label = (DIFFICULTY.find(([min]) => pct >= min) || DIFFICULTY[DIFFICULTY.length - 1])[1];
    return lt('{pct}% ({label})', { pct: pct.toFixed(1), label: lt(label) });
  }

  function slug(name) {
    return String(name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'badge';
  }

  async function loadIcons(s) {
    if (s.icons) return;
    s.icons = {};
    const ids = s.data.list.map(b => b.id);
    for (let i = 0; i < ids.length; i += 100) {
      const data = await json(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${ids.slice(i, i + 100).join(',')}&size=150x150&format=Webp`);
      for (const t of (data && data.data) || []) if (t.imageUrl) s.icons[String(t.targetId)] = t.imageUrl;
      if (state !== s) return;
      for (const img of document.querySelectorAll('.routility-badge-row img[data-rt-badge]:not([src])')) {
        const url = s.icons[img.dataset.rtBadge];
        if (!url) continue;
        img.src = url;
        img.closest('.thumbnail-2d-container')?.classList.remove('shimmer');
      }
    }
  }

  function ownedPill(when) {
    const pill = el('span', 'routility-injected routility-badge-owned');
    pill.appendChild(el('span', 'routility-badge-check'));
    pill.appendChild(el('span', null, lt('Owned')));
    const d = date(when);
    if (d) pill.dataset.rtTip = lt('Earned {date}', { date: d });
    return pill;
  }

  function badgeRow(s, b) {
    const href = `https://www.roblox.com/badges/${b.id}/${slug(b.name)}`;
    const li = el('li', 'stack-row badge-row routility-injected routility-badge-row');
    li.dataset.routilityBadge = b.id;
    const pic = el('div', 'badge-image');
    const a = el('a');
    a.href = href;
    const icon = s.icons && s.icons[b.id];
    const box = el('span', 'thumbnail-2d-container badge-image-container' + (icon ? '' : ' shimmer'));
    const img = el('img');
    img.alt = '';
    img.dataset.rtBadge = b.id;
    if (icon) img.src = icon;
    box.appendChild(img);
    a.appendChild(box);
    pic.appendChild(a);
    const content = el('div', 'badge-content');
    const info = el('div', 'badge-data-container');
    const name = el('div', 'font-header-2 badge-name');
    const link = el('a', 'routility-badge-link', b.name);
    link.href = href;
    name.appendChild(link);
    const when = s.data.earned[b.id];
    if (when && s.progress) {
      li.classList.add('routility-badge-owned-row');
      name.appendChild(ownedPill(when));
    }
    info.append(name, el('p', 'para-overflow', b.description));
    const stats = el('ul', 'badge-stats-container');
    for (const [label, value] of [[lt('Rarity'), rarity(b.rate)], [lt('Won Yesterday'), formatNumber(b.day)], [lt('Won Ever'), formatNumber(b.ever)]]) {
      const item = el('li');
      item.append(el('div', 'text-label', label), el('div', 'font-header-2 badge-stats-info', value));
      stats.appendChild(item);
    }
    content.append(info, stats);
    li.append(pic, content);
    return li;
  }

  function view(s) {
    const q = s.query.trim().toLowerCase();
    let list = s.data.list.filter(b => {
      if (s.show === 'owned' && !s.data.earned[b.id]) return false;
      if (s.show === 'missing' && s.data.earned[b.id]) return false;
      return !q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
    });
    const time = b => new Date(b.created).getTime() || 0;
    const by = {
      rarest: (a, b) => a.rate - b.rate || a.ever - b.ever,
      common: (a, b) => b.rate - a.rate || b.ever - a.ever,
      yesterday: (a, b) => b.day - a.day,
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
    }[s.sort];
    if (by) list = [...list].sort(by);
    return list;
  }

  function renderCustom(s) {
    const box = document.querySelector('.game-badges-list');
    const ul = box && box.querySelector('ul.stack-list');
    if (!ul) return;
    const active = !!(s.query.trim() || s.sort !== 'default' || s.show !== 'all');
    box.classList.toggle('routility-badge-custom', active);
    ul.querySelectorAll('.routility-badge-row, .routility-badge-empty').forEach(n => n.remove());
    box.querySelectorAll('.routility-badge-more').forEach(n => n.remove());
    if (!active) return;
    const list = view(s);
    const frag = document.createDocumentFragment();
    for (const b of list.slice(0, s.shown)) frag.appendChild(badgeRow(s, b));
    if (!list.length) frag.appendChild(el('li', 'routility-injected routility-badge-empty text-secondary', lt('No badges match.')));
    ul.prepend(frag);
    if (list.length > s.shown) {
      const more = el('button', 'btn-control-md btn-full-width routility-injected routility-badge-more', lt('See More'));
      more.type = 'button';
      more.addEventListener('click', () => {
        s.shown += PAGE;
        renderCustom(s);
      });
      ul.after(more);
    }
    loadIcons(s);
  }

  function placeTools(s, box) {
    if (!s.tools || box.querySelector('.routility-badge-tools') || s.data.total < 2) return;
    const head = box.querySelector('.container-header');
    if (!head) return;
    const bar = el('div', 'routility-injected routility-badge-tools');
    const search = el('input', 'form-control input-field routility-badge-search');
    search.type = 'search';
    search.placeholder = lt('Search badges');
    search.value = s.query;
    search.addEventListener('input', () => {
      s.query = search.value;
      s.shown = PAGE;
      renderCustom(s);
    });
    const sort = dropdown(SORTS.map(o => ({ ...o, label: lt(o.label) })), s.sort, (v) => { s.sort = v; s.shown = PAGE; renderCustom(s); }, 'routility-badge-select');
    const show = dropdown(SHOWS.map(o => ({ ...o, label: lt(o.label) })), s.show, (v) => { s.show = v; s.shown = PAGE; renderCustom(s); }, 'routility-badge-select');
    bar.append(search, sort, show);
    head.after(bar);
    renderCustom(s);
  }

  function apply() {
    const s = state;
    if (!s || !s.data) return;
    const box = document.querySelector('.game-badges-list');
    if (!box) return;
    placeTools(s, box);
    if (box.classList.contains('routility-badge-custom') && !box.querySelector('.routility-badge-row, .routility-badge-empty')) renderCustom(s);
    if (!s.progress) return;
    const head = box.querySelector('.container-header');
    const owned = Object.keys(s.data.earned).length;
    if (head && !head.querySelector('.routility-badge-progress')) {
      head.classList.add('routility-badge-head');
      const wrap = el('div', 'routility-injected routility-badge-progress');
      wrap.appendChild(el('span', 'text-secondary routility-badge-progress-text', lt('{owned} of {total} owned', { owned: formatNumber(owned), total: formatNumber(s.data.total) })));
      const bar = el('span', 'routility-badge-bar');
      const fill = el('span', 'routility-badge-bar-fill');
      fill.style.width = (s.data.total ? Math.round(owned / s.data.total * 1000) / 10 : 0) + '%';
      bar.appendChild(fill);
      wrap.appendChild(bar);
      head.appendChild(wrap);
    }
    for (const stat of box.querySelectorAll('.badge-stats-info')) {
      const raw = stat.textContent.trim();
      if (/^\d{4,}$/.test(raw)) stat.textContent = formatNumber(Number(raw));
    }
    for (const row of box.querySelectorAll('li.badge-row:not([data-routility-badge]):not(.routility-badge-row)')) {
      const id = ((row.querySelector('a[href*="/badges/"]')?.getAttribute('href') || '').match(/\/badges\/(\d+)/) || [])[1];
      if (!id) continue;
      row.dataset.routilityBadge = id;
      const when = s.data.earned[id];
      if (!when) continue;
      row.classList.add('routility-badge-owned-row');
      const name = row.querySelector('.badge-name');
      if (!name) continue;
      name.appendChild(ownedPill(when));
    }
  }

  async function setup(universeId, opts = {}) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me || !universeId) return;
    if (state && state.universeId === String(universeId)) return;
    teardown();
    const s = { universeId: String(universeId), data: null, progress: opts.progress !== false, tools: opts.tools !== false, query: '', sort: 'default', show: 'all', shown: PAGE };
    state = s;
    s.observer = new MutationObserver(onFrame(apply));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    const data = await load(s.universeId, me);
    if (state !== s || !data || !data.total) return;
    s.data = data;
    apply();
  }

  function teardown() {
    pageObserver?.disconnect();
    pageObserver = null;
    document.querySelectorAll('.routility-badge-earned').forEach(n => n.remove());
    if (!state) return;
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-badge-progress, .routility-badge-owned, .routility-badge-earned, .routility-badge-tools, .routility-badge-row, .routility-badge-empty, .routility-badge-more').forEach(n => n.remove());
    document.querySelectorAll('.routility-badge-custom').forEach(n => n.classList.remove('routility-badge-custom'));
    document.querySelectorAll('[data-routility-badge]').forEach(n => {
      delete n.dataset.routilityBadge;
      n.classList.remove('routility-badge-owned-row');
    });
  }

  let pageObserver = null;

  async function setupBadgePage(badgeId) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me || !badgeId) return;
    const data = await json(`https://badges.roblox.com/v1/users/${me}/badges/awarded-dates?badgeIds=${badgeId}`);
    const when = data && (data.data || [])[0]?.awardedDate;
    if (!when) return;
    const d = date(when);
    if (!d) return;
    const tip = lt('Earned {date}', { date: new Date(when).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
    const place = () => {
      const details = document.querySelector('#item-container #item-details');
      if (!details || details.querySelector('.routility-badge-earned')) return;
      const fields = [...details.querySelectorAll(':scope > .item-field-container')];
      const after = fields.find(n => n.querySelector('.field-label')?.textContent.trim() === 'Updated') || fields.find(n => n.querySelector('.field-label')?.textContent.trim() === 'Type');
      if (!after) return;
      const row = el('div', 'clearfix item-field-container routility-injected routility-badge-earned');
      row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow field-label', lt('Earned')));
      const content = el('div', 'field-content');
      const value = el('span', 'font-body text', d);
      value.dataset.rtTip = tip;
      content.appendChild(value);
      row.appendChild(content);
      after.after(row);
    };
    pageObserver?.disconnect();
    pageObserver = new MutationObserver(window.RoUtilityUI.onFrame(place));
    pageObserver.observe(document.querySelector('#item-container') || document.body, { childList: true, subtree: true });
    place();
  }

  window.RoUtilityBadges = { setup, setupBadgePage, teardown };
})();
