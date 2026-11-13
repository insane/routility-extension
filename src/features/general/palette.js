(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, request } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const FRIENDS_KEY = 'routilityPaletteFriends';
  const FRIENDS_TTL = 30 * 60000;
  const LIMIT = 8;
  const FIELD_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const PAGES = [
    { label: LT('Home'), href: '/home', icon: 'icon-regular-house', words: 'start main' },
    { label: LT('Profile'), href: (me) => `/users/${me}/profile`, icon: 'icon-regular-person', words: 'me account' },
    { label: LT('Messages'), href: '/my/messages/#!/inbox', icon: 'icon-regular-speech-bubble-align-center', words: 'inbox chat' },
    { label: LT('Friends'), href: '/users/friends#!/friends', icon: 'icon-regular-two-people', words: 'people' },
    { label: LT('Friend Requests'), href: '/users/friends#!/friend-requests', icon: 'icon-regular-two-people', words: 'requests add' },
    { label: LT('Avatar'), href: '/my/avatar', icon: 'icon-regular-person-standing', words: 'outfit character' },
    { label: LT('Sandbox'), href: '/my/avatar?sandbox', icon: 'routility-sb-nav-icon', words: 'try on limiteds dominus', flag: 'avatarSandbox' },
    { label: LT('Inventory'), href: (me) => `/users/${me}/inventory`, icon: 'icon-regular-backpack', words: 'items' },
    { label: LT('Trades'), href: '/trades', icon: 'icon-regular-hand-two-arrows-horizontal', words: 'trading inbound outbound' },
    { label: LT('Trade Calculator'), href: '/trades/calculator', icon: 'routility-calc-nav-icon', words: 'value calc', flag: 'tradeCalculator' },
    { label: LT('Trade Ads'), href: '/trade-ads', icon: 'routility-ads-nav-icon', words: 'trading', flag: 'tradeAds' },
    { label: LT('Friend History'), href: '/friend-history', icon: 'routility-fh-nav-icon', words: 'unfriended removed added', flag: 'friendHistory' },
    { label: LT('Private Servers'), href: '/private-servers', icon: 'routility-ps-nav-icon', words: 'vip servers', flag: 'privateServers' },
    { label: LT('Forum'), href: '/forum', icon: 'icon-regular-speech-bubble-align-center', words: 'posts', flag: 'forum' },
    { label: LT('Communities'), href: '/communities', icon: 'icon-regular-three-people', words: 'groups' },
    { label: LT('Charts'), href: '/charts', icon: 'icon-regular-circle-play', words: 'games discover experiences' },
    { label: LT('Marketplace'), href: '/catalog', icon: 'icon-regular-shopping-basket', words: 'catalog avatar shop items' },
    { label: LT('Transactions'), href: '/transactions', icon: 'icon-regular-robux', words: 'robux spending purchases sales' },
    { label: LT('Buy Robux'), href: '/upgrades/robux', icon: 'icon-regular-robux', words: 'robux' },
    { label: LT('Account Settings'), href: '/my/account', icon: 'icon-regular-gear', words: 'settings privacy security' },
    { label: LT('RoUtility Settings'), href: '/my/account#!/routility', icon: 'icon-regular-gear', words: 'routility options extension' },
    { label: LT('Create'), href: 'https://create.roblox.com/dashboard/creations', icon: 'icon-regular-circle-play', words: 'studio develop creator hub' },
  ];

  let settings = {};
  let s = null;
  let features = null;
  let friends = null;
  let friendsJob = null;
  const faces = new Map();

  const me = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const norm = (v) => String(v || '').toLowerCase();

  function score(text, q) {
    const t = norm(text);
    if (!q || !t) return 0;
    if (t === q) return 5;
    if (t.startsWith(q)) return 4;
    if (t.split(/[\s@._-]+/).some(w => w.startsWith(q))) return 3;
    if (t.includes(q)) return 2;
    return 0;
  }

  async function loadFeatures() {
    if (features) return features;
    const list = (await request({ type: 'botFeatures' }).catch(() => null)) || [];
    features = Array.isArray(list) ? list : [];
    return features;
  }

  async function loadFriends() {
    if (friends) return friends;
    if (friendsJob) return friendsJob;
    friendsJob = (async () => {
      const id = me();
      if (!id) return [];
      try {
        const cached = JSON.parse(sessionStorage.getItem(FRIENDS_KEY) || 'null');
        if (cached && cached.me === id && Date.now() - cached.at < FRIENDS_TTL) return (friends = cached.list);
      } catch {}
      const ids = (await window.RoUtilityUI.friendIds(id).catch(() => null)) || [];
      const list = [];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await json('https://users.roblox.com/v1/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userIds: ids.slice(i, i + 100).map(Number), excludeBannedUsers: false }) });
        for (const u of (r && r.data) || []) list.push({ id: String(u.id), name: u.name || '', display: u.displayName || u.name || '' });
      }
      try { sessionStorage.setItem(FRIENDS_KEY, JSON.stringify({ me: id, at: Date.now(), list })); } catch {}
      return (friends = list);
    })().finally(() => { friendsJob = null; });
    return friendsJob;
  }

  function pageHref(p) {
    return typeof p.href === 'function' ? p.href(me()) : p.href;
  }

  function results(query) {
    const q = norm(query).trim();
    const out = [];
    for (const p of PAGES) {
      if (p.flag && settings[p.flag] === false) continue;
      const label = lt(p.label);
      const sc = q ? Math.max(score(label, q), score(p.label, q), score(p.words, q) - 1) : 1;
      if (sc > 0) out.push({ kind: 'page', sc: sc + 0.3, label, icon: p.icon, href: pageHref(p) });
    }
    if (q) {
      for (const f of friends || []) {
        const sc = Math.max(score(f.display, q), score(f.name, q));
        if (sc > 0) out.push({ kind: 'friend', sc: sc + 0.2, label: f.display, sub: '@' + f.name, id: f.id, href: `/users/${f.id}/profile` });
      }
      for (const f of features || []) {
        const title = lt(f.title);
        const sc = Math.max(score(title, q), score(f.title, q), score(lt(f.tabLabel || ''), q) - 1, norm(lt(f.desc)).includes(q) && q.length > 2 ? 1 : 0);
        if (sc > 0) out.push({ kind: 'setting', sc, label: title, sub: lt(f.tabLabel || ''), key: f.key, def: f.def, hash: f.hash });
      }
    }
    out.sort((a, b) => b.sc - a.sc || a.label.localeCompare(b.label));
    const top = out.slice(0, q ? LIMIT : PAGES.length);
    if (q) {
      const raw = query.trim();
      top.push(
        { kind: 'search', label: lt('Search Experiences for “{query}”', { query: raw }), icon: 'icon-regular-magnifying-glass', href: '/discover/?keyword=' + encodeURIComponent(raw) },
        { kind: 'search', label: lt('Search People for “{query}”', { query: raw }), icon: 'icon-regular-magnifying-glass', href: '/search/users?keyword=' + encodeURIComponent(raw) },
        { kind: 'search', label: lt('Search Marketplace for “{query}”', { query: raw }), icon: 'icon-regular-magnifying-glass', href: '/catalog?CatalogContext=1&keyword=' + encodeURIComponent(raw) },
      );
    }
    return top;
  }

  function settingOn(r) {
    return settings[r.key] === undefined ? r.def !== false : settings[r.key] !== false;
  }

  function kindLabel(r) {
    if (r.kind === 'page') return lt('Page');
    if (r.kind === 'friend') return lt('Friend');
    if (r.kind === 'setting') return settingOn(r) ? lt('On') : lt('Off');
    return '';
  }

  function face(span, id) {
    const url = faces.get(id);
    if (!url || span.firstChild) return;
    const img = el('img');
    img.alt = '';
    img.src = url;
    span.appendChild(img);
  }

  function loadFaces(ids) {
    const need = ids.filter(id => !faces.has(id));
    if (!need.length) return;
    need.forEach(id => faces.set(id, ''));
    json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${need.join(',')}&size=48x48&format=Webp&isCircular=true`).then((r) => {
      for (const t of (r && r.data) || []) if (t.imageUrl) faces.set(String(t.targetId), t.imageUrl);
      if (!s) return;
      for (const span of s.list.querySelectorAll('.routility-palette-face[data-id]')) face(span, span.dataset.id);
    });
  }

  function row(r, i) {
    const li = el('li', 'routility-palette-row' + (i === s.at ? ' routility-palette-on' : ''));
    li.setAttribute('role', 'option');
    li.id = 'routility-palette-opt-' + i;
    li.setAttribute('aria-selected', i === s.at ? 'true' : 'false');
    let lead;
    if (r.kind === 'friend') {
      lead = el('span', 'routility-palette-face thumbnail-2d-container');
      lead.dataset.id = r.id;
      face(lead, r.id);
    } else if (r.kind === 'setting') {
      lead = el('span', 'routility-palette-lead');
      lead.appendChild(el('span', 'icon icon-regular-gear size-[var(--icon-size-medium)]'));
    } else {
      lead = el('span', 'routility-palette-lead');
      lead.appendChild(el('span', 'icon ' + (r.icon || 'icon-regular-circle-play') + ' size-[var(--icon-size-medium)]'));
    }
    const text = el('span', 'routility-palette-text');
    text.appendChild(el('span', 'text-body-medium content-emphasis text-truncate-end', r.label));
    if (r.sub) text.appendChild(el('span', 'text-body-small content-muted text-truncate-end', r.sub));
    li.append(lead, text);
    const kind = kindLabel(r);
    if (kind) li.appendChild(el('span', 'text-label-small routility-palette-kind' + (r.kind === 'setting' ? (settingOn(r) ? ' routility-palette-kind-on' : ' routility-palette-kind-off') : ''), kind));
    li.addEventListener('mousemove', () => {
      if (s.at === i) return;
      s.at = i;
      mark();
    });
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('click', (e) => run(r, e.ctrlKey || e.metaKey || e.button === 1));
    li.addEventListener('auxclick', (e) => { if (e.button === 1) run(r, true); });
    return li;
  }

  function mark() {
    s.list.querySelectorAll('.routility-palette-row').forEach((li, i) => {
      li.classList.toggle('routility-palette-on', i === s.at);
      li.setAttribute('aria-selected', i === s.at ? 'true' : 'false');
    });
    s.input.setAttribute('aria-activedescendant', 'routility-palette-opt-' + s.at);
    s.list.children[s.at]?.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    if (!s) return;
    s.rows = results(s.input.value);
    if (s.at >= s.rows.length) s.at = Math.max(0, s.rows.length - 1);
    s.list.replaceChildren(...s.rows.map(row));
    if (!s.rows.length) s.list.appendChild(el('li', 'routility-palette-empty text-body-medium content-muted', lt('No results for “{query}”', { query: s.input.value.trim() })));
    mark();
    loadFaces(s.rows.filter(r => r.kind === 'friend').map(r => r.id));
  }

  function go(href, newTab) {
    const url = new URL(href, location.origin).href;
    if (newTab) window.open(url, '_blank', 'noopener');
    else location.href = url;
  }

  async function run(r, newTab) {
    if (!r) return;
    if (r.kind === 'setting') {
      const st = await chrome.storage.local.get('routilitySettings');
      const next = Object.assign({}, st.routilitySettings || {});
      next[r.key] = !settingOn(r);
      settings = next;
      await chrome.storage.local.set({ routilitySettings: next });
      render();
      return;
    }
    close();
    go(r.href, newTab);
  }

  function close() {
    if (!s) return;
    s.overlay.remove();
    document.removeEventListener('keydown', s.onKey, true);
    if (s.back && s.back.isConnected) s.back.focus({ preventScroll: true });
    s = null;
  }

  function open(prefill) {
    if (s && typeof prefill !== 'string') return close();
    if (s) close();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-palette');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-palette-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', lt('Command Palette'));
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1200 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-palette-field');
    const layer = el('div', FIELD_LAYER + ' pointer-events-none');
    layer.setAttribute('aria-hidden', 'true');
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
    glass.setAttribute('aria-hidden', 'true');
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-large placeholder:text-body-large');
    input.type = 'text';
    input.placeholder = lt('Search pages, friends and settings');
    input.setAttribute('aria-label', lt('Search pages, friends and settings'));
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'routility-palette-list');
    input.autocomplete = 'off';
    input.spellcheck = false;
    const keys = el('span', 'text-label-small content-muted routility-palette-keys', /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K');
    field.append(layer, glass, input, keys);
    const list = el('ul', 'routility-palette-list');
    list.id = 'routility-palette-list';
    list.setAttribute('role', 'listbox');
    const foot = el('p', 'text-body-small content-muted margin-none routility-palette-foot', lt('Arrow keys to move, Enter to open, Ctrl Enter for a new tab, Esc to close'));
    dialog.append(field, list, foot);
    overlay.appendChild(dialog);
    const onKey = (e) => {
      if (!s) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!s.rows.length) return;
        s.at = (s.at + (e.key === 'ArrowDown' ? 1 : -1) + s.rows.length) % s.rows.length;
        mark();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        run(s.rows[s.at], e.ctrlKey || e.metaKey);
      }
    };
    s = { overlay, input, list, rows: [], at: 0, onKey, back: document.activeElement };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('input', () => {
      if (!s) return;
      s.at = 0;
      render();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    if (typeof prefill === 'string' && prefill.trim()) input.value = prefill.trim();
    input.focus();
    render();
    Promise.all([loadFeatures(), loadFriends()]).then(() => { if (s && s.input.value.trim()) render(); });
  }

  function onShortcut(e) {
    if (settings.commandPalette === false) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || norm(e.key) !== 'k') return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }

  chrome.storage.local.get('routilitySettings', (st) => { settings = st.routilitySettings || {}; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    if (settings.commandPalette === false) close();
    else if (s) render();
  });
  window.addEventListener('keydown', onShortcut, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button[data-testid="navigation-search-input-search-button"]');
    if (!btn || settings.commandPalette === false) return;
    e.preventDefault();
    e.stopPropagation();
    const field = document.querySelector('#navbar-search-input');
    const text = field ? field.value : '';
    field?.blur();
    open(text);
  }, true);
  document.addEventListener('pointerover', (e) => {
    const btn = e.target.closest?.('button[data-testid="navigation-search-input-search-button"]');
    if (!btn) return;
    if (settings.commandPalette === false) delete btn.dataset.rtTip;
    else if (!btn.dataset.rtTip) btn.dataset.rtTip = lt('Search pages, friends and settings') + ' (' + (/Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K') + ')';
  }, true);
  window.RoUtilityPalette = { open, close };
})();
