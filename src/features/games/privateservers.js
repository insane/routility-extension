(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, pageTitle, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PATH = /^\/private-servers\/?$/i;
  const TABS = [{ key: 'mine', tab: 0, label: LT('Yours') }, { key: 'invited', tab: 1, label: LT('Invited') }];
  const DAY = 86400000;

  let settings = {};
  let s = null;
  let navObserver = null;

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  function status(sv) {
    const end = new Date(sv.expirationDate).getTime();
    const days = Math.ceil((end - Date.now()) / DAY);
    if (!sv.active) return { text: lt('Inactive'), tone: 'off' };
    if (!Number.isFinite(end) || end - Date.now() > 3650 * DAY) return { text: lt('Active'), tone: 'on' };
    if (sv.willRenew) return { text: days <= 1 ? lt('Renews today') : ltn(days, 'Renews in {n} day', 'Renews in {n} days', { n: days }), tip: fmtDate(sv.expirationDate), tone: days <= 3 ? 'soon' : 'on' };
    return { text: days <= 1 ? lt('Ends today') : ltn(days, 'Ends in {n} day', 'Ends in {n} days', { n: days }), tip: fmtDate(sv.expirationDate), tone: 'soon' };
  }

  async function loadTab(tab) {
    const out = [];
    let cursor = '';
    for (let i = 0; i < 5; i++) {
      const d = await json(`https://games.roblox.com/v1/private-servers/my-private-servers?privateServersTab=${tab}&itemsPerPage=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!d || !Array.isArray(d.data)) return i ? out : null;
      out.push(...d.data);
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  async function loadIcons(list) {
    const need = [...new Set(list.map(x => String(x.universeId)))].filter(id => !s.icons.has(id));
    for (let i = 0; i < need.length; i += 100) {
      const r = await json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${need.slice(i, i + 100).join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Webp&isCircular=false`);
      for (const t of (r && r.data) || []) s.icons.set(String(t.targetId), t.imageUrl || '');
    }
  }

  async function liveFor(placeId) {
    if (s.live.has(placeId)) return s.live.get(placeId);
    const job = json(`https://games.roblox.com/v1/games/${placeId}/private-servers?limit=100`).then((d) => {
      const map = new Map();
      for (const x of (d && d.data) || []) map.set(String(x.vipServerId), x);
      return map;
    });
    s.live.set(placeId, job);
    return job;
  }

  function joinButton(sv, code) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium bg-action-emphasis content-action-emphasis routility-ps-join');
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', lt('Join')));
    b.addEventListener('click', () => window.postMessage({ type: 'routility-private-join', placeId: Number(sv.placeId), accessCode: code }, location.origin));
    return b;
  }

  function openButton(sv) {
    const a = el('a', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium bg-action-standard content-action-standard routility-ps-join');
    a.href = `/games/${sv.placeId}#!/game-instances`;
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    a.append(layer, el('span', 'text-no-wrap', lt('Open')));
    return a;
  }

  function row(sv) {
    const li = el('li', 'routility-ps-row bg-surface-100 radius-large');
    const icon = el('a', 'routility-ps-icon');
    icon.href = `/games/${sv.placeId}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.tabIndex = -1;
    const src = s.icons.get(String(sv.universeId));
    if (src) {
      const img = el('img');
      img.alt = '';
      img.src = src;
      icon.appendChild(img);
    }
    const text = el('div', 'routility-ps-text');
    text.appendChild(el('span', 'text-title-medium content-emphasis text-truncate-end', sv.name || lt('Private Server')));
    const game = el('a', 'text-body-medium content-default text-truncate-end routility-ps-game', sv.universeName || lt('Experience'));
    game.href = `/games/${sv.placeId}`;
    text.appendChild(game);
    const meta = el('div', 'routility-ps-meta text-body-small');
    const st = status(sv);
    const pill = el('span', 'routility-ps-status routility-ps-' + st.tone, st.text);
    if (st.tip) pill.dataset.rtTip = st.tip;
    meta.appendChild(pill);
    if (s.tab === 'invited' && sv.ownerName) meta.appendChild(el('span', 'content-muted', lt('Owned by @{name}', { name: sv.ownerName })));
    else if (sv.priceInRobux > 0) meta.appendChild(el('span', 'content-muted', lt('{n} Robux a month', { n: formatNumber(sv.priceInRobux) })));
    else if (sv.active) meta.appendChild(el('span', 'content-muted', lt('Free')));
    const players = el('span', 'content-muted routility-ps-players');
    meta.appendChild(players);
    text.appendChild(meta);
    const side = el('div', 'routility-ps-side');
    li.append(icon, text, side);
    if (sv.active) {
      side.appendChild(el('span', 'routility-sk routility-ps-join-sk'));
      liveFor(String(sv.placeId)).then((map) => {
        if (!li.isConnected) return;
        const live = map.get(String(sv.privateServerId));
        side.replaceChildren(live && live.accessCode ? joinButton(sv, live.accessCode) : openButton(sv));
        if (live && live.playing > 0) {
          const names = (live.players || []).map(p => p.displayName || p.name).filter(Boolean);
          players.textContent = ltn(live.playing, '{n} playing', '{n} playing', { n: formatNumber(live.playing) });
          if (names.length) players.dataset.rtTip = names.slice(0, 10).join(', ');
        }
      });
    } else {
      side.appendChild(openButton(sv));
    }
    return li;
  }

  function sortList(list) {
    return list.slice().sort((a, b) => (b.active - a.active) || (new Date(a.expirationDate) - new Date(b.expirationDate)));
  }

  function render() {
    if (!s) return;
    for (const t of TABS) s.tabs[t.key].classList.toggle('active', s.tab === t.key);
    const data = s.data[s.tab];
    if (data === undefined) {
      s.list.replaceChildren(...Array.from({ length: 4 }, () => el('li', 'routility-sk routility-ps-row-sk')));
      return;
    }
    if (data === null) {
      s.list.replaceChildren(el('li', 'text-body-medium content-muted routility-ps-empty', lt('Couldn’t load your private servers. Try again in a moment.')));
      return;
    }
    const q = s.q.trim().toLowerCase();
    const list = sortList(data).filter(x => !q || [x.name, x.universeName, x.ownerName].some(v => String(v || '').toLowerCase().includes(q)));
    s.count.textContent = formatNumber(data.filter(x => x.active).length) + ' ' + lt('active');
    if (!list.length) {
      s.list.replaceChildren(el('li', 'text-body-medium content-muted routility-ps-empty', q ? lt('No results for “{query}”', { query: s.q.trim() }) : s.tab === 'mine' ? lt('You don’t have any private servers yet.') : lt('Nobody has invited you to a private server yet.')));
      return;
    }
    s.list.replaceChildren(...list.map(row));
  }

  async function load(key) {
    if (s.data[key] !== undefined || s.loading.has(key)) return;
    s.loading.add(key);
    const mine = s;
    const tab = TABS.find(t => t.key === key).tab;
    const list = await loadTab(tab);
    if (s !== mine) return;
    if (list) await loadIcons(list);
    if (s !== mine) return;
    s.data[key] = list;
    s.loading.delete(key);
    render();
  }

  function build() {
    const root = el('div', 'routility-injected routility-ps');
    const top = el('div', 'routility-ps-top');
    const titles = el('div', 'routility-ps-titles');
    titles.append(el('h1', 'text-heading-large content-emphasis margin-none', lt('Private Servers')), el('p', 'text-body-medium content-muted margin-none', lt('Every private server you own or were invited to, when it renews and who is playing.')));
    top.appendChild(titles);
    const bar = el('div', 'routility-ps-bar');
    const tabs = el('ul', 'nav nav-tabs rbx-tabs-horizontal routility-ps-tabs');
    tabs.setAttribute('role', 'tablist');
    s.tabs = {};
    for (const t of TABS) {
      const li = el('li', 'rbx-tab');
      const a = el('a', 'rbx-tab-heading');
      a.href = '#';
      a.setAttribute('role', 'tab');
      a.appendChild(el('span', 'text-lead', lt(t.label)));
      a.addEventListener('click', (e) => {
        e.preventDefault();
        s.tab = t.key;
        render();
        load(t.key);
      });
      li.appendChild(a);
      tabs.appendChild(li);
      s.tabs[t.key] = li;
    }
    const search = el('input', 'form-control input-field routility-ps-search');
    search.type = 'text';
    search.placeholder = lt('Search private servers');
    search.setAttribute('aria-label', lt('Search private servers'));
    search.addEventListener('input', () => {
      s.q = search.value;
      render();
    });
    s.count = el('span', 'text-body-small content-muted routility-ps-count');
    bar.append(tabs, s.count, search);
    s.list = el('ul', 'routility-ps-list');
    root.append(top, bar, s.list);
    return root;
  }

  function setup() {
    if (!PATH.test(location.pathname) || s || settings.privateServers === false) return;
    const content = document.querySelector('#content');
    if (!content) return;
    s = { tab: 'mine', data: {}, loading: new Set(), icons: new Map(), live: new Map(), q: '' };
    pageTitle(lt('Private Servers') + ' - Roblox');
    s.root = build();
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-ps-ready');
    render();
    load('mine');
  }

  function ensureNav() {
    if (settings.privateServers === false) {
      document.querySelectorAll('.routility-ps-nav').forEach(n => n.remove());
      return;
    }
    const inv = document.querySelector('.left-nav nav a[href*="/inventory"]');
    const li = inv && inv.closest('li');
    if (!li || !li.parentElement) return;
    let mine = li.parentElement.querySelector(':scope > .routility-ps-nav');
    const here = PATH.test(location.pathname);
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-ps-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/private-servers';
      a.removeAttribute('id');
      a.removeAttribute('data-rt-profile');
      a.classList.remove('bg-shift-200');
      a.querySelectorAll('.foundation-web-badge').forEach(b => b.remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-ps-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => !sp.children.length && sp.textContent.trim());
      if (label) label.textContent = lt('Private Servers');
    }
    if (li.nextElementSibling !== mine && !document.documentElement.classList.contains('routility-nav-custom')) li.after(mine);
    else if (!mine.isConnected) li.after(mine);
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) inv.classList.remove('bg-shift-200');
  }

  function start() {
    if (navObserver || settings.privateServers === false) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
        if (PATH.test(location.pathname) && !s) setup();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
    setup();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    ensureNav();
    start();
  });
})();
