(function () {
  'use strict';

  const { el, pageTitle, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PATH = /^\/friend-history\/?$/i;
  const PAGE = 20;
  const SEEN_KEY = (me) => 'routilityFriendLogSeen:' + me;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const COLUMNS = [
    { type: 'added', title: LT('Added You'), empty: LT('No new friends yet.'), sign: '+' },
    { type: 'removed', title: LT('Removed You'), empty: LT('Nobody has been removed yet.'), sign: '−' },
  ];

  let settings = {};
  let s = null;

  function myId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function ago(ms) {
    const sec = Math.max(0, (Date.now() - ms) / 1000);
    if (sec < 60) return lt('just now');
    if (sec < 3600) return ltn(Math.floor(sec / 60), '{n}m ago', '{n}m ago');
    if (sec < 86400) return ltn(Math.floor(sec / 3600), '{n}h ago', '{n}h ago');
    if (sec < 30 * 86400) return ltn(Math.floor(sec / 86400), '{n}d ago', '{n}d ago');
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function face(icon, src) {
    if (!src || icon.firstChild) return;
    const img = el('img');
    img.alt = '';
    img.src = src;
    icon.appendChild(img);
  }

  function row(e) {
    const li = el('li', 'routility-cm-row routility-fh-row');
    li.dataset.id = e.id;
    const icon = el('span', 'routility-cm-icon routility-fm-face thumbnail-2d-container');
    face(icon, s.pics.get(Number(e.id)));
    const text = el('a', 'routility-cm-text');
    text.href = `/users/${encodeURIComponent(e.id)}/profile`;
    const name = el('span', 'routility-cm-name text-title-medium');
    name.appendChild(el('span', 'text-truncate-end', e.displayName || e.name || String(e.id)));
    text.append(name, el('span', 'routility-cm-meta text-body-small content-muted', e.name ? '@' + e.name : ''));
    const when = el('span', 'routility-cm-role text-body-small', ago(e.at));
    when.title = new Date(e.at).toLocaleString();
    li.append(icon, text, when);
    return li;
  }

  function skeleton() {
    return Array.from({ length: 3 }, () => el('li', 'routility-cm-row-sk'));
  }

  function match(e, q) {
    return !q || [e.displayName, e.name, e.id].some(v => String(v || '').toLowerCase().includes(q));
  }

  function fetchFaces(ids) {
    const need = ids.filter(id => !s.pics.has(Number(id)) && !s.asked.has(id));
    if (!need.length) return;
    need.forEach(id => s.asked.add(id));
    const mine = s;
    window.RoUtilityFriends.headshots(need.map(Number)).then((pics) => {
      if (s !== mine) return;
      for (const [id, url] of pics) s.pics.set(Number(id), url);
      for (const li of s.root.querySelectorAll('.routility-fh-row')) face(li.firstChild, s.pics.get(Number(li.dataset.id)));
    });
  }

  function paintChecked() {
    if (!s || !s.checked) return;
    const sec = Math.max(0, Math.floor((Date.now() - s.at) / 1000));
    let text = lt('Not checked yet');
    if (s.at && sec < 60) text = lt('Last checked {n}s ago', { n: sec });
    else if (s.at && sec < 3600) text = lt('Last checked {m}m {s}s ago', { m: Math.floor(sec / 60), s: sec % 60 });
    else if (s.at) text = lt('Last checked {time}', { time: ago(s.at) });
    if (s.checked.textContent !== text) s.checked.textContent = text;
    s.checked.title = s.at ? new Date(s.at).toLocaleString() : '';
  }

  function render() {
    if (!s || !s.log) return;
    paintChecked();
    const q = s.q.trim().toLowerCase();
    for (const c of COLUMNS) {
      const col = s.cols[c.type];
      const all = s.log.filter(e => e.type === c.type);
      const rows = all.filter(e => match(e, q));
      const shown = rows.slice(0, s.shown[c.type]);
      col.count.textContent = formatNumber(all.length);
      if (shown.length) col.list.replaceChildren(...shown.map(row));
      else col.list.replaceChildren(el('li', 'routility-cm-empty text-body-medium content-muted', q ? lt('No results for “{query}”', { query: s.q.trim() }) : lt(c.empty)));
      col.more.hidden = shown.length >= rows.length;
      fetchFaces(shown.map(e => e.id));
    }
  }

  function build() {
    const root = el('div', 'routility-injected routility-fh');
    const top = el('div', 'routility-fh-top');
    const titles = el('div', 'routility-fh-titles');
    s.checked = el('p', 'text-body-small content-muted margin-none routility-fh-checked');
    titles.append(el('h1', 'text-heading-large content-emphasis margin-none', lt('Friend History')), el('p', 'text-body-medium content-muted margin-none', lt('While Roblox is open, RoUtility checks your friends list and records who was added and who was removed. Stored only on this device.')), s.checked);
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-fh-search');
    const layer = el('div', STATE_LAYER + ' pointer-events-none');
    layer.setAttribute('aria-hidden', 'true');
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
    glass.setAttribute('aria-hidden', 'true');
    const search = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium');
    search.type = 'text';
    search.placeholder = lt('Search friend history');
    search.setAttribute('aria-label', lt('Search friend history'));
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.addEventListener('input', () => {
      s.q = search.value;
      s.shown = { added: PAGE, removed: PAGE };
      render();
    });
    field.append(layer, glass, search);
    top.append(titles, field);
    const grid = el('div', 'routility-fh-grid');
    s.cols = {};
    for (const c of COLUMNS) {
      const card = el('section', 'routility-fh-col bg-surface-100 radius-large');
      const sign = el('span', 'routility-fh-sign routility-fh-sign-' + c.type, c.sign);
      sign.setAttribute('aria-hidden', 'true');
      const count = el('span', 'text-body-medium content-muted routility-fh-count');
      const head = el('div', 'routility-fh-head');
      head.append(sign, el('h2', 'text-title-large content-emphasis margin-none', lt(c.title)), count);
      const list = el('ul', 'routility-cm-list routility-fh-list');
      list.replaceChildren(...skeleton());
      const more = el('button', 'btn-control-sm routility-fh-more', lt('Load More'));
      more.type = 'button';
      more.hidden = true;
      more.addEventListener('click', () => {
        s.shown[c.type] += PAGE;
        render();
      });
      card.append(head, list, more);
      grid.appendChild(card);
      s.cols[c.type] = { list, count, more };
    }
    root.append(top, grid);
    return root;
  }

  async function load() {
    const mine = s;
    let log = [];
    let at = 0;
    if (mine.me) {
      const key = window.RoUtilityFriends.friendLogKey(mine.me);
      const snap = window.RoUtilityFriends.friendSnapKey(mine.me);
      const st = await chrome.storage.local.get([key, snap]);
      if (Array.isArray(st[key])) log = st[key];
      at = Number(st[snap] && st[snap].at) || 0;
    }
    if (s !== mine) return;
    s.log = log;
    s.at = at;
    render();
    setInterval(paintChecked, 1000);
  }

  function setup() {
    if (!PATH.test(location.pathname) || s || settings.friendHistory === false) return;
    const content = document.querySelector('#content');
    if (!content) return;
    s = { me: myId(), log: null, at: 0, q: '', shown: { added: PAGE, removed: PAGE }, pics: new Map(), asked: new Set(), cols: null, root: null, checked: null };
    pageTitle(lt('Friend History') + ' - Roblox');
    s.root = build();
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-fh-ready');
    load();
  }

  function ensureNav() {
    if (settings.friendHistory === false || settings.friendHistoryNav === false) {
      document.querySelectorAll('.routility-fh-nav').forEach(n => n.remove());
      return;
    }
    const friends = document.querySelector('.left-nav nav a[href*="/users/friends"]');
    const li = friends && friends.closest('li');
    if (!li || !li.parentElement) return paintBadges();
    let mine = li.parentElement.querySelector(':scope > .routility-fh-nav');
    const here = PATH.test(location.pathname);
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-fh-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/friend-history';
      a.removeAttribute('id');
      a.classList.remove('bg-shift-200');
      a.querySelectorAll('.foundation-web-badge').forEach(b => badgeBox(b, a).remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-fh-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => !sp.children.length && sp.textContent.trim());
      if (label) label.textContent = lt('Friend History');
    }
    if (li.nextElementSibling !== mine) li.after(mine);
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) friends.classList.remove('bg-shift-200');
    paintBadges();
  }

  let unseen = 0;
  let unseenFor = '';

  async function countUnseen() {
    const me = myId();
    if (!me || settings.friendHistory === false) return;
    unseenFor = me;
    const key = window.RoUtilityFriends.friendLogKey(me);
    const st = await chrome.storage.local.get([key, SEEN_KEY(me)]);
    const seen = Number(st[SEEN_KEY(me)]) || 0;
    const log = Array.isArray(st[key]) ? st[key] : [];
    let n = log.filter(e => e.at > seen).length;
    if (!seen || (n && PATH.test(location.pathname))) {
      n = 0;
      await chrome.storage.local.set({ [SEEN_KEY(me)]: Date.now() });
    }
    unseen = n;
    paintBadges();
  }

  function badgeText(b, n) {
    let t = b.matches('.foundation-web-badge, .notification-blue') ? b : b.querySelector('.foundation-web-badge, .notification-blue') || b;
    while (t.firstElementChild) t = t.firstElementChild;
    const text = n > 99 ? '99+' : formatNumber(n);
    if (t.textContent !== text) t.textContent = text;
    const title = ltn(n, '{n} change since you last looked', '{n} changes since you last looked');
    if (b.title !== title) b.title = title;
  }

  function badgeBox(badge, a) {
    let box = badge;
    while (box.parentElement && box.parentElement !== a && box.parentElement.children.length === 1) box = box.parentElement;
    return box;
  }

  function cleanClone(node) {
    const b = node.cloneNode(true);
    for (const x of [b, ...b.querySelectorAll('*')]) {
      x.removeAttribute('id');
      x.removeAttribute('hidden');
      x.classList.remove('hide', 'hidden', 'ng-hide');
    }
    b.classList.add('routility-fh-badge');
    return b;
  }

  function paintBadges() {
    const modern = document.querySelector('.left-nav li.routility-fh-nav > a');
    const old = document.querySelector('ul.left-col-list > li[data-rt-nav="history"] > a');
    for (const a of [modern, old]) {
      if (!a) continue;
      let b = a.querySelector('.routility-fh-badge');
      if (!unseen) {
        if (b) b.remove();
        continue;
      }
      if (!b) {
        if (a === modern) {
          const tpl = document.querySelector('.left-nav nav li:not(.routility-fh-nav) > a .foundation-web-badge');
          b = tpl ? cleanClone(badgeBox(tpl, tpl.closest('a'))) : el('span', 'routility-fh-badge routility-fh-badge-own foundation-web-badge inline-flex items-center radius-circle height-600 padding-x-small bg-system-alert content-inverse-emphasis text-label-small');
        } else {
          const tpl = document.querySelector('ul.left-col-list > li:not([data-rt-nav]) > a .notification-blue');
          b = tpl ? cleanClone(tpl.closest('.dynamic-width-item') || tpl) : el('span', 'routility-fh-badge notification-blue notification');
        }
        a.appendChild(b);
      }
      badgeText(b, unseen);
    }
  }

  let navObserver = null;

  function startNav() {
    if (navObserver || settings.friendHistory === false) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
        if (PATH.test(location.pathname) && !s) setup();
        if (unseenFor !== myId()) countUnseen();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
    countUnseen();
  }

  if (location.hostname === 'www.roblox.com') {
    chrome.storage.local.get('routilitySettings', (st) => {
      settings = st.routilitySettings || {};
      if (settings.friendHistory === false) return;
      startNav();
      setup();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.routilitySettings) {
        settings = changes.routilitySettings.newValue || {};
        ensureNav();
        if (settings.friendHistory !== false) startNav();
      }
      const me = myId();
      if (me && settings.friendHistory !== false && (changes[window.RoUtilityFriends.friendLogKey(me)] || changes[SEEN_KEY(me)])) countUnseen();
      const key = s && s.me && window.RoUtilityFriends.friendLogKey(s.me);
      if (key && changes[key]) {
        s.log = Array.isArray(changes[key].newValue) ? changes[key].newValue : [];
        render();
      }
      const snap = s && s.me && window.RoUtilityFriends.friendSnapKey(s.me);
      if (snap && changes[snap]) {
        s.at = Number(changes[snap].newValue && changes[snap].newValue.at) || s.at;
        paintChecked();
      }
    });
  }
})();
