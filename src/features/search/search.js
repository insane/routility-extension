(function () {
  'use strict';

  const { el } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const DEBOUNCE = 180;
  const cache = new Map();
  let enabled = false;
  let prefs = { people: true, friends: true, games: true, items: true, slash: true };

  function readPrefs(st) {
    const s = st || {};
    enabled = s.richSearch !== false;
    prefs = { people: s.searchPeople !== false, friends: s.searchFriends !== false, games: s.searchGames !== false, items: s.searchItems !== false, slash: s.searchSlash !== false, admin: s.adminBadge !== false, termed: s.searchTerminated !== false };
  }
  let timer = 0;
  let token = 0;
  let friendIds = null;
  let current = { query: '', rows: null };

  async function json(url, opts) {
    try {
      const res = await fetch(url, { credentials: 'include', ...opts });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function post(url, body) {
    return json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  const FRIENDS_KEY = 'routilitySearchFriends';
  const FRIENDS_TTL = 10 * 60 * 1000;

  async function loadFriends(me) {
    const stored = await new Promise(r => chrome.storage.local.get(FRIENDS_KEY, st => r(st[FRIENDS_KEY])));
    if (stored && stored.me === me && Date.now() - stored.at < FRIENDS_TTL) return stored.list;
    const all = await window.RoUtilityUI.friendIds(me);
    const res = !!all;
    const ids = (all || []).filter(id => id > 0);
    const list = [];
    let named = true;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = await post('https://users.roblox.com/v1/users', { userIds: ids.slice(i, i + 100), excludeBannedUsers: false });
      if (!batch) named = false;
      for (const u of (batch && batch.data) || []) list.push({ id: String(u.id), name: u.name, displayName: u.displayName, verified: !!u.hasVerifiedBadge });
    }
    if (res && named) chrome.storage.local.set({ [FRIENDS_KEY]: { me, at: Date.now(), list } });
    else list.partial = true;
    return list;
  }

  function myFriends() {
    if (friendIds) return friendIds;
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const job = (me ? loadFriends(me) : Promise.resolve([])).then((list) => {
      if (list.partial) setTimeout(() => { if (friendIds === job) friendIds = null; }, 30000);
      return list;
    });
    friendIds = job;
    return job;
  }

  function friendMatches(list, query) {
    const q = query.toLowerCase();
    const score = (f) => {
      const n = f.name.toLowerCase();
      const d = (f.displayName || '').toLowerCase();
      if (n === q || d === q) return 0;
      if (n.startsWith(q) || d.startsWith(q)) return 1;
      if (n.includes(q) || d.includes(q)) return 2;
      return 9;
    };
    return list.map(f => [score(f), f]).filter(([x]) => x < 9).sort((a, b) => a[0] - b[0]).map(([, f]) => ({ ...f, friend: true }));
  }

  async function thumbs(reqs) {
    if (!reqs.length) return new Map();
    const res = await post('https://thumbnails.roblox.com/v1/batch', reqs.map(r => ({ format: 'Webp', isCircular: false, size: '150x150', ...r })));
    const out = new Map();
    for (const t of (res && res.data) || []) {
      if (t.state === 'Completed' && t.imageUrl) out.set(t.requestId, t.imageUrl);
      else if (t.state === 'Blocked') out.set(t.requestId, window.RoUtilityUI.blockedThumb(t));
    }
    return out;
  }

  async function exactUser(name) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return null;
    const hit = await post('https://users.roblox.com/v1/usernames/users', { usernames: [name], excludeBannedUsers: !prefs.termed });
    const u = hit && hit.data && hit.data[0];
    if (!u || !u.id) return null;
    const asked = String(u.requestedUsername || name);
    const formerly = u.name && asked.toLowerCase() !== String(u.name).toLowerCase() ? asked : '';
    let banned = false;
    if (prefs.termed) {
      const full = await json(`https://users.roblox.com/v1/users/${u.id}`);
      banned = !!(full && full.isBanned);
    }
    if (!banned && !formerly) return null;
    return { id: String(u.id), name: u.name, displayName: u.displayName || u.name, verified: !!u.hasVerifiedBadge, friend: false, terminated: banned, formerly };
  }

  async function lookup(query) {
    const key = query + '|' + Object.values(prefs).map(Number).join('');
    if (cache.has(key)) return cache.get(key);
    const sid = crypto.randomUUID();
    const q = encodeURIComponent(query);
    const job = (async () => {
      const [people, all, items, friends, gone] = await Promise.all([
        prefs.people ? json(`https://apis.roblox.com/search-api/omni-search?verticalType=user&searchQuery=${q}&pageToken=&globalSessionId=${sid}&sessionId=${sid}`) : null,
        prefs.games ? json(`https://apis.roblox.com/search-api/omni-search?searchQuery=${q}&pageToken=&sessionId=${sid}&pageType=all`) : null,
        prefs.items ? window.RoUtilityUI.request({ type: 'searchItems', query, limit: 2 }) : [],
        prefs.friends || prefs.people ? myFriends() : [],
        prefs.people ? exactUser(query.trim()) : null,
      ]);
      const friendIdSet = new Set(friends.map(f => f.id));
      const users = (((people && people.searchResults) || []).find(g => g.contentGroupType === 'User')?.contents || [])
        .filter(u => u.contentId > 0)
        .map(u => ({ id: String(u.contentId), name: u.username, displayName: u.displayName, verified: !!u.hasVerifiedBadge, friend: friendIdSet.has(String(u.contentId)) }));
      const exact = users.filter(u => u.name.toLowerCase() === query.toLowerCase());
      if (gone) {
        const listed = users.find(u => u.id === gone.id);
        if (listed) {
          listed.formerly = gone.formerly;
          if (!exact.includes(listed)) exact.unshift(listed);
        } else {
          exact.unshift({ ...gone, friend: friendIdSet.has(gone.id) });
        }
      }
      const fromFriends = prefs.friends ? friendMatches(friends, query) : [];
      const seen = new Set();
      const ranked = [];
      for (const u of [...exact, ...fromFriends, ...users]) {
        if (seen.has(u.id) || ranked.length >= 4) continue;
        seen.add(u.id);
        ranked.push(u);
      }
      const game = (((all && all.searchResults) || []).find(g => g.contentGroupType === 'Game')?.contents || [])[0] || null;
      const limiteds = Array.isArray(items) ? items : [];
      const reqs = [
        ...ranked.map(u => ({ requestId: 'u' + u.id, targetId: Number(u.id), type: 'AvatarHeadShot' })),
        ...(game ? [{ requestId: 'g' + game.universeId, targetId: game.universeId, type: 'GameIcon' }] : []),
        ...limiteds.map(i => ({ requestId: 'i' + i.id, targetId: Number(i.id), type: 'Asset' })),
      ];
      const [pics, pres] = await Promise.all([
        thumbs(reqs),
        ranked.length ? post('https://presence.roblox.com/v1/presence/users', { userIds: ranked.map(u => Number(u.id)) }) : null,
      ]);
      const presence = new Map(((pres && pres.userPresences) || []).map(p => [String(p.userId), p]));
      const failed = (prefs.people && !people) || (prefs.games && !all);
      return { query, users: ranked, game, items: limiteds, pics, presence, failed };
    })();
    cache.set(key, job);
    job.then((r) => { if (!r || r.failed) cache.delete(key); }, () => cache.delete(key));
    return job;
  }

  function input() {
    return document.querySelector('#navbar-search-input');
  }

  function menu() {
    const box = input()?.closest('[data-testid="navigation-search-input"], .navbar-search');
    return box ? box.querySelector('ul.dropdown-menu') : null;
  }

  function row(href, thumbSrc, round, title, extras, sub) {
    const li = el('li', 'navbar-search-option rbx-clickable-li routility-injected routility-search-row');
    const a = el('a', 'routility-search-link');
    a.href = href;
    const pic = el('span', 'routility-search-thumb' + (round ? ' round' : ''));
    if (thumbSrc === 'blocked') pic.classList.add('icon-blocked');
    else if (thumbSrc) {
      const img = el('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('routility-loaded'));
      img.src = thumbSrc;
      pic.appendChild(img);
    }
    a.appendChild(pic);
    const text = el('span', 'routility-search-text');
    const line = el('span', 'routility-search-title');
    line.appendChild(el('span', 'routility-search-name', title));
    for (const x of extras) line.appendChild(x);
    text.appendChild(line);
    text.appendChild(sub);
    a.appendChild(text);
    li.appendChild(a);
    return li;
  }

  function skeletonRow(round) {
    const li = el('li', 'navbar-search-option routility-injected routility-search-row routility-search-loading');
    const a = el('span', 'routility-search-link');
    a.appendChild(el('span', 'routility-search-thumb routility-sk' + (round ? ' round' : '')));
    const text = el('span', 'routility-search-text');
    text.append(el('span', 'routility-sk routility-search-sk1'), el('span', 'routility-sk routility-search-sk2'));
    a.appendChild(text);
    li.appendChild(a);
    return li;
  }

  function short(n) {
    if (n >= 1e6) return (Math.floor(n / 1e5) / 10).toString().replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (Math.floor(n / 1e2) / 10).toString().replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function squash(text) {
    return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function gameFirst(r) {
    const q = squash(r.query);
    const g = squash(r.game && r.game.name);
    if (!q || !g) return false;
    if (g === q) return true;
    const raw = String(r.query || '').trim().toLowerCase();
    if (r.users.some(u => String(u.name || '').toLowerCase() === raw)) return false;
    if (/\s/.test(raw)) return true;
    return g === q || g.startsWith(q) || (q.length >= 4 && g.includes(q)) || (g.length >= 4 && q.startsWith(g));
  }

  function build(r) {
    const rows = [];
    for (const u of r.users) {
      const p = r.presence && r.presence.get(u.id);
      const playing = p && p.userPresenceType === 2;
      const where = playing ? (p.lastLocation ? lt('Playing {game}', { game: p.lastLocation }) : lt('In an experience')) : null;
      const sub = el('span', 'routility-search-sub' + (u.terminated ? ' routility-search-termed' : ''), (u.terminated ? lt('Terminated · @{name}', { name: u.name }) : u.formerly ? '@' + u.name : where || (u.friend ? lt('You are friends') : '@' + u.name)) + (u.formerly ? ' · ' + lt('formerly {name}', { name: u.formerly }) : ''));
      const tick = u.verified ? window.RoUtilityUI.verifiedBadge() : null;
      if (tick) delete tick.dataset.rtTip;
      const extras = tick ? [tick] : [];
      const li = row(u.terminated ? `/users/${u.id}/profile#routility-user=${u.id}` : `/users/${u.id}/profile`, r.pics.get('u' + u.id), true, u.displayName || u.name, extras, sub);
      li.dataset.userId = u.id;
      if (p && [1, 2, 3].includes(p.userPresenceType)) li.querySelector('.routility-search-thumb').appendChild(el('span', 'routility-search-dot routility-search-dot-' + (p.userPresenceType === 2 ? 'game' : p.userPresenceType === 3 ? 'studio' : 'online')));
      const place = playing && (p.placeId || p.rootPlaceId);
      if (place) {
        const join = el('a', 'routility-search-join');
        join.href = `https://www.roblox.com/games/start?placeId=${place}${p.gameId ? '&gameInstanceId=' + p.gameId : ''}`;
        join.setAttribute('aria-label', lt('Join {name}', { name: u.displayName || u.name }));
        join.dataset.rtTip = lt('Join their server');
        join.appendChild(el('span', 'routility-search-join-icon'));
        join.addEventListener('mousedown', e => e.stopPropagation());
        li.appendChild(join);
      }
      rows.push(li);
    }
    const userRows = rows.filter(li => li.dataset.userId);
    if (userRows.length && prefs.admin) {
      window.RoUtilityUI.request({ type: 'robloxAdmins', ids: userRows.map(li => li.dataset.userId) }, x => x && Array.isArray(x.admins)).then(res => {
        const yes = new Set(((res && res.admins) || []).map(String));
        for (const li of userRows) {
          const line = li.querySelector('.routility-search-title');
          if (yes.has(li.dataset.userId) && line && !line.querySelector('.routility-admin-badge')) line.appendChild(window.RoUtilityUI.adminBadge());
        }
      });
    }
    if (r.game) {
      const g = r.game;
      const votes = (g.totalUpVotes || 0) + (g.totalDownVotes || 0);
      const sub = el('span', 'routility-search-sub routility-search-stats game-card-info');
      if (votes) {
        sub.appendChild(el('span', 'info-label icon-votes-gray'));
        sub.appendChild(el('span', null, Math.round(g.totalUpVotes / votes * 100) + '%'));
      }
      sub.appendChild(el('span', 'info-label icon-playing-counts-gray'));
      sub.appendChild(el('span', null, short(g.playerCount || 0)));
      const gameRow = row(g.canonicalUrlPath || `/games/${g.rootPlaceId}`, r.pics.get('g' + g.universeId), false, g.name, [], sub);
      if (gameFirst(r)) rows.unshift(gameRow);
      else rows.push(gameRow);
    }
    for (const i of r.items) {
      const sub = el('span', 'routility-search-sub routility-search-value');
      const usd = el('span', 'routility-search-pill routility-search-pill-usd');
      const logo = el('img', 'routility-value-logo');
      logo.src = chrome.runtime.getURL('assets/icons/logo.png');
      logo.alt = '';
      usd.append(logo, el('span', null, window.RoUtilityUI.formatUSD(i.usd)));
      const ui = window.RoUtilityUI;
      const sh = ui.shows('Search');
      if (!sh.value && ui.itemValue(i)) usd.dataset.rtTip = ui.valueTip(i);
      if (sh.usd) sub.appendChild(usd);
      if (sh.value && ui.itemValue(i)) {
        const val = el('span', 'routility-search-pill routility-search-pill-val');
        val.appendChild(ui.valueTag(ui.itemValue(i), { tip: false }));
        sub.appendChild(val);
      }
      if (sh.rap && Number(i.rap) > 0) {
        const rap = el('span', 'routility-search-pill routility-search-pill-rap');
        rap.append(el('span', 'icon-robux-16x16 routility-rap-icon'), el('span', null, window.RoUtilityUI.formatNumber(i.rap)));
        sub.appendChild(rap);
      }
      rows.push(row(`/catalog/${i.id}`, r.pics.get('i' + i.id), false, i.name, [], sub));
    }
    return rows;
  }

  function place() {
    const m = menu();
    const q = (input()?.value || '').trim();
    if (!m) return;
    const ours = [...m.querySelectorAll(':scope > .routility-search-row')];
    if (!enabled || q.length < 2 || !current.rows || current.query !== q) {
      if (!current.rows || current.query !== q) ours.forEach(n => n.remove());
      return;
    }
    if (ours.length === current.rows.length && ours.every((n, i) => n === current.rows[i]) && m.firstElementChild === current.rows[0]) return;
    ours.forEach(n => { if (!current.rows.includes(n)) n.remove(); });
    const first = m.firstElementChild;
    for (const r of current.rows) m.insertBefore(r, first);
    m.classList.toggle('routility-search-menu', current.rows.length > 0);
    sel = ourRows().length ? 0 : -1;
    paint();
  }

  function onHover(e) {
    const m = menu();
    const li = e.target?.closest?.('li');
    if (!m || !li || li.parentElement !== m) return;
    const i = ourRows().indexOf(li);
    if (i === sel) return;
    sel = i;
    paint();
  }


  let sel = -1;

  function ourRows() {
    const m = menu();
    return m ? [...m.querySelectorAll(':scope > .routility-search-row:not(.routility-search-loading)')] : [];
  }

  function paint() {
    const m = menu();
    if (!m) return;
    const rows = ourRows();
    if (sel >= rows.length) sel = -1;
    rows.forEach((r, i) => r.classList.toggle('new-selected', i === sel));
    m.classList.toggle('routility-search-own-sel', sel >= 0);
    if (sel >= 0 && document.activeElement?.id === 'navbar-search-input') rows[sel].scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    if (e.target?.id !== 'navbar-search-input' || e.altKey || e.ctrlKey || e.metaKey) return;
    const m = menu();
    const rows = ourRows();
    if (!m || !rows.length || !m.offsetParent) { sel = -1; return; }
    const natives = [...m.children].filter(li => !li.classList.contains('routility-search-row'));
    const firstNativeSelected = !natives.length || natives[0].classList.contains('new-selected');
    if (e.key === 'ArrowUp') {
      if (sel > 0) sel--;
      else if (sel === 0) return stop(e);
      else if (firstNativeSelected) sel = rows.length - 1;
      else return;
      stop(e);
      paint();
    } else if (e.key === 'ArrowDown') {
      if (sel < 0) return;
      stop(e);
      sel = sel < rows.length - 1 ? sel + 1 : -1;
      paint();
    } else if (e.key === 'Enter' && sel >= 0) {
      const a = rows[sel].querySelector('a[href]');
      if (!a) return;
      stop(e);
      swallowEnter = true;
      sel = -1;
      paint();
      location.assign(a.href);
    }
  }

  let swallowEnter = false;

  function onEnterTail(e) {
    if (e.key !== 'Enter' || !swallowEnter) return;
    stop(e);
    if (e.type === 'keyup') setTimeout(() => { swallowEnter = false; }, 0);
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onSlash(e) {
    if (e.key !== '/' || !prefs.slash || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const box = input();
    if (!box || !box.offsetParent) return;
    e.preventDefault();
    box.focus();
    box.select();
  }

  function onInput() {
    clearTimeout(timer);
    const q = (input()?.value || '').trim();
    const my = ++token;
    if (!enabled || q.length < 2) {
      current = { query: q, rows: null };
      place();
      return;
    }
    if (!prefs.people && !prefs.friends && !prefs.games && !prefs.items) {
      current = { query: q, rows: null };
      place();
      return;
    }
    sel = -1;
    if (current.query !== q) {
      const sk = [];
      if (prefs.people || prefs.friends) sk.push(skeletonRow(true), skeletonRow(true));
      if (prefs.games || prefs.items) sk.push(skeletonRow(false));
      current = { query: q, rows: sk };
      requestAnimationFrame(place);
    }
    const run = async (tries) => {
      const r = await lookup(q).catch(() => null);
      if (my !== token) return;
      if ((!r || r.failed) && tries > 0) timer = setTimeout(() => run(tries - 1), 900);
      if (!r || (r.failed && tries > 0 && !r.users.length && !r.game && !r.items.length)) return;
      current = { query: q, rows: build(r) };
      place();
    };
    timer = setTimeout(() => run(2), DEBOUNCE);
  }

  let observer = null;

  function setup() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.routilitySettings) return;
      readPrefs(changes.routilitySettings.newValue);
      current = { query: '', rows: null };
      place();
    });
    chrome.storage.local.get('routilitySettings', (st) => {
      readPrefs(st.routilitySettings);
      if (observer) return;
      document.addEventListener('input', (e) => { if (e.target && e.target.id === 'navbar-search-input') onInput(); }, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('keypress', onEnterTail, true);
      document.addEventListener('keyup', onEnterTail, true);
      document.addEventListener('submit', (e) => { if (swallowEnter && e.target?.querySelector?.('#navbar-search-input')) stop(e); }, true);
      document.addEventListener('keydown', onSlash);
      document.addEventListener('mouseover', onHover, true);
      document.addEventListener('focusout', (e) => { if (e.target?.id === 'navbar-search-input') { sel = -1; paint(); } }, true);
      observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
      const target = input()?.closest('.navbar-search') || document.body;
      observer.observe(target, { childList: true, subtree: true });
    });
  }

  window.RoUtilitySearch = { setup, myFriends };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
