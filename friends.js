(function () {
  'use strict';

  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const LABELS = { 0: LT('Offline'), 1: LT('Online'), 2: LT('In Experience'), 3: LT('In Studio'), 4: LT('Offline') };
  const ICONS = { 1: 'icon-online', 2: 'icon-game', 3: 'icon-studio' };
  const PAGE = 18;
  let state = null;

  async function post(url, body) {
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async function hidden(userId) {
    try {
      const [find, count] = await Promise.all([
        fetch(`https://friends.roblox.com/v1/users/${userId}/friends/find?limit=1`, { credentials: 'include' }),
        fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)),
      ]);
      return find.status === 403 && (count?.count || 0) > 0 ? count.count : 0;
    } catch {
      return 0;
    }
  }

  function parse(res) {
    const raw = Array.isArray(res) ? res : (res && (res.friends || res.data || res.items || res.users)) || [];
    return raw.map((f) => {
      const id = Number(typeof f === 'object' && f ? f.id ?? f.userId ?? f.user_id : f);
      if (!Number.isSafeInteger(id) || id <= 0) return null;
      const name = (f && typeof f === 'object' && (f.name || f.username)) || '';
      const displayName = (f && typeof f === 'object' && (f.displayName || f.display_name)) || name;
      return { id, name: String(name), displayName: String(displayName) };
    }).filter(Boolean);
  }

  async function localIds(userId, skipHidden) {
    const all = await window.RoUtilityUI.friendIds(userId, { ordered: true, fresh: true });
    if (!all) return null;
    if (!skipHidden && all.some(id => !(id > 0))) return null;
    return all.filter(id => id > 0);
  }

  async function usersBatch(userIds, excludeBannedUsers) {
    for (let tries = 0; tries < 5; tries++) {
      try {
        const res = await fetch('https://users.roblox.com/v1/users', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userIds, excludeBannedUsers }) });
        if (res.ok) return (await res.json()).data || [];
        if (res.status !== 429 && res.status < 500) return null;
        const after = Number(res.headers.get('retry-after')) || 0;
        await new Promise(r => setTimeout(r, Math.max(after * 1000, 1500 * 2 ** tries)));
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return null;
  }

  async function localList(userId) {
    const ids = await localIds(userId);
    if (!ids) return null;
    const byId = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const named = await usersBatch(ids.slice(i, i + 100), true);
      if (!named) return null;
      for (const u of named) byId.set(Number(u.id), { id: Number(u.id), name: u.name || '', displayName: u.displayName || u.name || '', hasVerifiedBadge: !!u.hasVerifiedBadge, deleted: false });
    }
    const banned = ids.filter(id => !byId.has(id));
    for (let i = 0; i < banned.length; i += 100) {
      const named = await usersBatch(banned.slice(i, i + 100), false);
      for (const u of named || []) byId.set(Number(u.id), { id: Number(u.id), name: u.name || '', displayName: u.displayName || u.name || '', hasVerifiedBadge: !!u.hasVerifiedBadge, deleted: true });
    }
    return ids.map(id => byId.get(id) || { id, name: '', displayName: '', hasVerifiedBadge: false, deleted: true });
  }

  async function load(userId) {
    const local = await localList(userId);
    if (local) return local;
    const res = await window.RoUtilityUI.request({ type: 'getFriends', userId: String(userId) });
    if (!res) return null;
    let friends = parse(res);
    const byId = new Map();
    const ids = friends.map(f => f.id);
    for (let i = 0; i < ids.length; i += 100) {
      const named = await post('https://users.roblox.com/v1/users', { userIds: ids.slice(i, i + 100), excludeBannedUsers: false });
      for (const u of (named && named.data) || []) byId.set(u.id, u);
    }
    const placeholder = (v) => !v || v === 'Account Deleted';
    friends = friends.map((f) => {
      const u = byId.get(f.id);
      if (!u) return f;
      const deleted = placeholder(f.name) || placeholder(f.displayName);
      return {
        ...f,
        name: placeholder(f.name) ? u.name : f.name,
        displayName: placeholder(f.displayName) ? u.displayName : f.displayName,
        hasVerifiedBadge: !!u.hasVerifiedBadge,
        deleted,
      };
    });
    return friends;
  }

  async function headshots(ids) {
    const out = new Map();
    let pending = ids;
    for (let attempt = 0; attempt < 4 && pending.length; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1200));
      const retry = [];
      for (let i = 0; i < pending.length; i += 100) {
        const res = await post('https://thumbnails.roblox.com/v1/batch', pending.slice(i, i + 100).map(id => ({ requestId: String(id), targetId: id, type: 'AvatarHeadShot', size: '150x150', format: 'Webp', isCircular: false })));
        for (const t of (res && res.data) || []) {
          if (t.state === 'Completed' && t.imageUrl) out.set(Number(t.requestId), t.imageUrl);
          else if (t.state === 'Blocked') out.set(Number(t.requestId), window.RoUtilityUI.blockedThumb(t));
          else retry.push(Number(t.requestId));
        }
      }
      pending = retry;
    }
    return out;
  }

  async function presence(ids) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const res = await post('https://presence.roblox.com/v1/presence/users', { userIds: ids.slice(i, i + 100) });
      for (const p of (res && res.userPresences) || []) out.set(Number(p.userId), p);
    }
    return out;
  }

  function card(f, thumb, p) {
    const li = el('li', 'list-item avatar-card routility-injected routility-friend-card');
    li.id = String(f.id);
    li.dataset.search = `${f.displayName} ${f.name}`.toLowerCase();
    const container = el('div', 'avatar-card-container');
    const content = el('div', 'avatar-card-content');
    const avatar = el('div', 'avatar avatar-card-fullbody');
    const link = el('a', 'avatar-card-link');
    link.href = f.deleted ? `/users/${f.id}/profile#routility-user=${f.id}` : `/users/${f.id}/profile`;
    const holder = el('span', 'thumbnail-2d-container avatar-card-image' + (thumb === 'blocked' ? ' icon-blocked' : ''));
    const img = el('img');
    img.alt = '';
    if (thumb && thumb !== 'blocked') img.src = thumb;
    holder.appendChild(img);
    link.appendChild(holder);
    avatar.appendChild(link);
    const status = el('div', 'avatar-status');
    const type = p ? p.userPresenceType : 0;
    if (ICONS[type]) {
      const icon = el('span', ICONS[type]);
      icon.dataset.rtTip = type === 2 ? (p.lastLocation || lt('In Experience')) : lt(LABELS[type]);
      status.appendChild(icon);
    }
    avatar.appendChild(status);
    const caption = el('div', 'avatar-card-caption');
    const span = el('span');
    const names = el('div', 'avatar-name-container');
    const name = el('a', 'text-overflow avatar-name', f.displayName || f.name);
    name.href = f.deleted ? `/users/${f.id}/profile#routility-user=${f.id}` : `/users/${f.id}/profile`;
    names.appendChild(name);
    if (f.hasVerifiedBadge) names.appendChild(window.RoUtilityUI.verifiedBadge());
    span.appendChild(names);
    span.appendChild(el('div', 'avatar-card-label', '@' + f.name));
    if (f.deleted) span.appendChild(el('div', 'avatar-card-label text-error routility-terminated-label', lt('Terminated')));
    else span.appendChild(el('div', 'avatar-card-label', type === 2 && p.lastLocation ? p.lastLocation : lt(LABELS[type] || 'Offline')));
    caption.appendChild(span);
    content.append(avatar, caption);
    container.appendChild(content);
    li.appendChild(container);
    return li;
  }

  function header(count, list) {
    const head = el('div', 'friends-subtitle routility-injected routility-friends-subtitle');
    head.appendChild(el('h2', null, lt('Friends ({n})', { n: count })));
    const filter = el('div', 'friends-filter');
    const box = el('div', 'friends-filter-searchbar-container form-control input-field');
    box.appendChild(el('span', 'icon-search'));
    const input = el('input', 'friends-filter-searchbar-input');
    input.type = 'text';
    input.placeholder = lt('Search Friends');
    input.addEventListener('input', () => search(input.value));
    box.appendChild(input);
    filter.appendChild(box);
    head.appendChild(filter);
    return head;
  }

  function matches(s) {
    const q = s.query;
    return q ? s.friends.filter(f => `${f.displayName} ${f.name}`.toLowerCase().includes(q)) : s.friends;
  }

  function pagerButton(side, disabled, onClick) {
    const li = el('li', 'pager-' + side + (disabled ? ' disabled' : ''));
    const b = el('button', 'btn-generic-' + (side === 'prev' ? 'left' : 'right') + '-sm');
    b.type = 'button';
    b.disabled = disabled;
    b.appendChild(el('span', side === 'prev' ? 'icon-left' : 'icon-right'));
    b.addEventListener('click', onClick);
    li.appendChild(b);
    return li;
  }

  function renderPage(s, list, holder) {
    const all = matches(s);
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    s.page = Math.min(Math.max(0, s.page), pages - 1);
    list.textContent = '';
    for (const f of all.slice(s.page * PAGE, s.page * PAGE + PAGE)) list.appendChild(card(f, s.thumbs.get(f.id), s.live.get(f.id)));
    holder.textContent = '';
    if (pages <= 1) return;
    const ul = el('ul', 'pager');
    ul.appendChild(pagerButton('prev', s.page === 0, () => { s.page--; renderPage(s, list, holder); list.scrollIntoView({ block: 'nearest' }); }));
    const cur = el('li', 'pager-cur');
    cur.appendChild(el('span', null, String(s.page + 1)));
    ul.appendChild(cur);
    ul.appendChild(pagerButton('next', s.page >= pages - 1, () => { s.page++; renderPage(s, list, holder); list.scrollIntoView({ block: 'nearest' }); }));
    holder.appendChild(ul);
  }

  function search(value) {
    const s = state;
    if (!s || !s.friends) return;
    s.query = String(value || '').trim().toLowerCase();
    s.page = 0;
    const list = document.querySelector('.routility-friend-list');
    const holder = document.querySelector('.routility-friend-pager');
    if (list && holder) renderPage(s, list, holder);
  }

  function skeletonCard() {
    const li = el('li', 'list-item avatar-card routility-injected routility-friend-card routility-friend-card-loading');
    const container = el('div', 'avatar-card-container');
    const content = el('div', 'avatar-card-content');
    const avatar = el('div', 'avatar avatar-card-fullbody');
    avatar.appendChild(el('span', 'routility-sk routility-sk-avatar96'));
    const caption = el('div', 'avatar-card-caption routility-sk-caption');
    caption.append(el('span', 'routility-sk routility-sk-line1'), el('span', 'routility-sk routility-sk-line2'), el('span', 'routility-sk routility-sk-line3'));
    content.append(avatar, caption);
    container.appendChild(content);
    li.appendChild(container);
    return li;
  }

  function ensure() {
    const s = state;
    if (!s || !s.count || !/^#!\/friends\b/.test(location.hash || '#!/friends')) return;
    const pane = document.querySelector('#friends-web-app .tab-pane.active .friends-content');
    if (!pane) return;
    const empty = pane.querySelector('.section-content-off');
    if (empty && empty.style.display !== 'none') empty.style.display = 'none';
    let list = pane.querySelector('.routility-friend-list');
    const want = s.friends ? 'ready' : 'loading';
    if (list && list.dataset.state !== want) {
      list.remove();
      list = null;
    }
    let holder = pane.querySelector('.routility-friend-pager');
    if (!list) {
      holder?.remove();
      list = el('ul', 'hlist avatar-cards routility-injected routility-friend-list' + (s.friends ? ' routility-reveal' : ''));
      list.dataset.state = want;
      holder = el('div', 'pager-holder routility-injected routility-friend-pager');
      pane.append(list, holder);
      if (s.friends) {
        renderPage(s, list, holder);
        window.RoUtilityUI.mark('hidden-friends');
      } else {
        for (let i = 0; i < Math.min(PAGE, s.count); i++) list.appendChild(skeletonCard());
      }
    }
    const shown = s.friends ? s.friends.length : s.count;
    const native = [...pane.querySelectorAll('.friends-subtitle:not(.routility-friends-subtitle)')][0];
    const ours = pane.querySelector('.routility-friends-subtitle');
    if (native) {
      ours?.remove();
      const h2 = native.querySelector('h2');
      const nodes = h2 ? [...h2.childNodes].filter(n => n.nodeType === 3) : [];
      const countNode = nodes.find(n => /\(\s*[\d,]*\s*\)/.test(n.nodeValue));
      const wanted = `(${shown})`;
      if (countNode) {
        const next = countNode.nodeValue.replace(/\(\s*[\d,]*\s*\)/, wanted);
        if (next !== countNode.nodeValue) countNode.nodeValue = next;
      } else if (h2 && !h2.textContent.includes(wanted)) {
        h2.insertBefore(document.createTextNode(' ' + wanted), h2.querySelector('.tooltip-container') || null);
      }
      if (!native.querySelector('.routility-hidden-source')) {
        const anchor = native.querySelector('.tooltip-container') || h2;
        anchor?.after(window.RoUtilityUI.hiddenNote());
      }
      const input = native.querySelector('.friends-filter-searchbar-input');
      if (input && !input.dataset.routility) {
        input.dataset.routility = '1';
        input.addEventListener('input', () => search(input.value));
      }
    } else if (!ours) {
      const top = pane.querySelector('.container-header');
      if (top) {
        const head = header(shown, list);
        head.querySelector('h2').after(window.RoUtilityUI.hiddenNote());
        top.appendChild(head);
      }
    }
  }

  async function setup(userId) {
    if (state && state.userId === userId) return;
    teardown();
    const s = { userId, friends: null, thumbs: new Map(), live: new Map(), page: 0, query: '' };
    state = s;
    const count = await hidden(userId);
    if (state !== s || !count) return;
    s.count = count;
    s.observer = new MutationObserver(onFrame(ensure));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    s.onHash = () => setTimeout(ensure, 50);
    window.addEventListener('hashchange', s.onHash);
    ensure();
    const friends = await load(userId);
    if (state !== s) return;
    if (!friends || !friends.length) {
      teardown();
      return;
    }
    const ids = friends.map(f => f.id);
    const [thumbs, live] = await Promise.all([headshots(ids), presence(ids)]);
    if (state !== s) return;
    Object.assign(s, { friends, thumbs, live });
    ensure();
  }

  let reveal = null;

  function cleanRevealed(c) {
    c.querySelectorAll('.routility-injected').forEach(n => n.remove());
    c.querySelectorAll('.routility-native-hidden-el').forEach(n => n.classList.remove('routility-native-hidden-el'));
    c.querySelector('.routility-revealed-card')?.classList.remove('routility-revealed-card');
    delete c.dataset.routilityRevealed;
    delete c.dataset.routilityFor;
  }

  const DELETED_KEY = 'routilityDeletedNames';
  let deletedNames = null;
  const deletedReady = new Promise(resolve => {
    try {
      chrome.storage.local.get(DELETED_KEY, (st) => { deletedNames = st[DELETED_KEY] || {}; resolve(); });
    } catch {
      deletedNames = {};
      resolve();
    }
  });

  function rememberDeleted(users) {
    const now = Date.now();
    for (const u of users) deletedNames[String(u.id)] = { id: u.id, name: u.name, displayName: u.displayName, hasVerifiedBadge: !!u.hasVerifiedBadge, t: now };
    const ids = Object.keys(deletedNames);
    if (ids.length > 2000) ids.sort((a, b) => deletedNames[a].t - deletedNames[b].t).slice(0, ids.length - 2000).forEach(id => delete deletedNames[id]);
    try { chrome.storage.local.set({ [DELETED_KEY]: deletedNames }); } catch {}
  }

  const goneIds = new Set();

  function hideGone(id) {
    goneIds.add(String(id));
    let style = document.getElementById('routility-gone-style');
    if (!style) {
      style = el('style', 'routility-injected');
      style.id = 'routility-gone-style';
      document.head.appendChild(style);
    }
    style.textContent = [...goneIds].map(x => `#friends-web-app li.avatar-card[id="${x}"]`).join(', ') + ' { display: none !important; }';
  }

  function clearGone() {
    goneIds.clear();
    document.getElementById('routility-gone-style')?.remove();
  }

  let menuWatch = false;
  let menuPin = null;
  let menuCard = null;

  function pinCardMenu() {
    const p = menuPin;
    if (!p) return;
    const pop = document.getElementById('avatar-card-dropdown-menu');
    if (!pop || pop !== p.pop || !p.btn.isConnected) {
      menuPin = null;
      return;
    }
    if (!pop.getClientRects().length) return;
    const b = p.btn.getBoundingClientRect();
    const r = pop.getBoundingClientRect();
    const dx = Math.round(b.left + b.width / 2 + p.dx - (r.left + r.width / 2));
    const dy = Math.round(b.bottom + p.dy - r.top);
    if (dx) pop.style.left = (parseFloat(pop.style.left) || 0) + dx + 'px';
    if (dy) pop.style.top = (parseFloat(pop.style.top) || 0) + dy + 'px';
  }

  function watchDeletedMenus() {
    if (menuWatch) return;
    menuWatch = true;
    const repin = onFrame(pinCardMenu);
    window.addEventListener('resize', repin);
    window.addEventListener('scroll', repin, true);
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest?.('#friends-web-app li.avatar-card .avatar-card-menu');
      if (!trigger) return;
      const card = trigger.closest('li.avatar-card');
      if (!card) return;
      const btn = trigger.querySelector('button') || trigger;
      const deleted = !!card.querySelector('.routility-revealed-card');
      const id = card.id;
      let tries = 0;
      const look = () => {
        const pop = document.getElementById('avatar-card-dropdown-menu');
        if (!pop || !pop.getClientRects().length) {
          if (tries++ < 40) setTimeout(look, 25);
          return;
        }
        const b = btn.getBoundingClientRect();
        const r = pop.getBoundingClientRect();
        menuPin = { pop, btn, dx: r.left + r.width / 2 - (b.left + b.width / 2), dy: r.top - b.bottom };
      };
      menuCard = deleted && /^\d+$/.test(id) ? { card, btn, id: Number(id) } : null;
      setTimeout(look, 30);
    }, true);
    document.addEventListener('click', async (e) => {
      const link = e.target.closest?.('#avatar-card-dropdown-menu a.friend-unfriend');
      if (!link || !menuCard || link.textContent.trim()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (link.dataset.rtState === 'busy') return;
      const { card, btn, id } = menuCard;
      link.dataset.rtState = 'busy';
      if (await unfriend(id)) {
        delete link.dataset.rtState;
        if (document.getElementById('avatar-card-dropdown-menu')?.getClientRects().length) btn.click();
        hideGone(id);
        if (ff && ff.friends) ff.friends = ff.friends.filter(x => x.id !== id);
        menuCard = null;
        return;
      }
      link.dataset.rtState = 'failed';
    }, true);
  }

  async function patchDeleted() {
    for (const c of document.querySelectorAll('#friends-web-app li.avatar-card[data-routility-revealed]')) {
      if (c.dataset.routilityFor !== c.id) cleanRevealed(c);
    }
    const cards = [...document.querySelectorAll('#friends-web-app li.avatar-card:not([data-routility-revealed])')].filter(c => /^Account Deleted$/.test(c.querySelector('.avatar-name')?.textContent.trim() || '') && /^\d+$/.test(c.id));
    if (!cards.length) return;
    cards.forEach(c => {
      c.dataset.routilityRevealed = 'pending';
      c.dataset.routilityFor = c.id;
    });
    if (!deletedNames) await deletedReady;
    const byId = new Map();
    const unknown = [];
    for (const c of cards) {
      const hit = deletedNames[c.id];
      if (hit) byId.set(c.id, hit);
      else unknown.push(c);
    }
    if (byId.size) revealCards(cards.filter(c => byId.has(c.id)), byId);
    if (!unknown.length) return;
    const named = await post('https://users.roblox.com/v1/users', { userIds: unknown.map(c => Number(c.id)), excludeBannedUsers: false });
    const fresh = (named && named.data) || [];
    rememberDeleted(fresh);
    revealCards(unknown, new Map(fresh.map(u => [String(u.id), u])));
  }

  function revealCards(cards, byId) {
    for (const c of cards) {
      const u = byId.get(c.id);
      if (!u || !c.isConnected || c.dataset.routilityFor !== c.id) {
        if (c.dataset.routilityFor === c.id) {
          c.dataset.routilityRevealed = 'none';
          c.classList.remove('routility-deleted-wait');
        }
        continue;
      }
      const href = `/users/${c.id}/profile#routility-user=${c.id}`;
      const container = c.querySelector('.avatar-card-container');
      container?.classList.add('routility-revealed-card');
      container?.classList.remove('disabled');
      const old = c.querySelector('.avatar-name');
      if (old) {
        old.classList.add('routility-native-hidden-el');
        const name = el('a', 'text-overflow avatar-name routility-injected', u.displayName || u.name);
        name.href = href;
        old.after(name);
        if (u.hasVerifiedBadge) name.after(window.RoUtilityUI.verifiedBadge());
      }
      const labels = c.querySelectorAll('.avatar-card-label');
      const swap = (node, text, extra) => {
        if (!node) return;
        node.classList.add('routility-native-hidden-el');
        node.after(el('div', 'avatar-card-label routility-injected' + (extra ? ' ' + extra : ''), text));
      };
      swap(labels[0], '@' + u.name);
      swap(labels[1], lt('Terminated'), 'text-error routility-terminated-label');
      const box = c.querySelector('.avatar-card-fullbody');
      if (box && !box.querySelector('.routility-card-overlay') && !box.querySelector('a.avatar-card-link')) {
        const a = el('a', 'routility-injected routility-card-overlay');
        a.href = href;
        a.setAttribute('aria-label', u.displayName || u.name);
        box.appendChild(a);
      }
      c.dataset.routilityRevealed = 'done';
      c.classList.remove('routility-deleted-wait');
    }
  }

  function revealDeleted() {
    if (reveal) return;
    watchDeletedMenus();
    reveal = new MutationObserver(onFrame(patchDeleted));
    reveal.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, characterData: true });
    patchDeleted();
  }

  const missingCache = new Map();

  async function hasFriend(userId, friendId) {
    const ids = await window.RoUtilityUI.friendIds(userId);
    if (!ids) return null;
    if (ids.includes(friendId)) return true;
    return ids.some(id => !(id > 0)) ? null : false;
  }

  async function dropStale(candidates, owner, extra) {
    const drop = new Set();
    const queue = candidates.slice();
    const deadline = Date.now() + 12000;
    const worker = async () => {
      while (queue.length && drop.size < extra && Date.now() < deadline) {
        const f = queue.shift();
        if ((await hasFriend(f.id, owner)) === false) drop.add(f.id);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return candidates.filter(f => !drop.has(f.id));
  }

  function missing(userId) {
    const key = String(userId);
    if (missingCache.has(key)) return missingCache.get(key);
    const job = (async () => {
      const order = (await window.RoUtilityUI.friendIds(key)) || [];
      const hiddenCount = order.filter(id => !(id > 0)).length;
      const visible = new Set(order.filter(id => id > 0));
      if (!hiddenCount) return { visible: visible.size, hidden: 0, friends: [] };
      const all = await load(key);
      const viewer = String(document.querySelector('meta[name="user-data"]')?.dataset.userid || '');
      const candidates = (all || []).filter(f => !visible.has(f.id) && String(f.id) !== viewer && String(f.id) !== key);
      const kept = candidates.length > hiddenCount ? await dropStale(candidates, Number(key), candidates.length - hiddenCount) : candidates;
      const friends = kept.slice(0, hiddenCount);
      if (!friends.length) return { visible: visible.size, hidden: hiddenCount, friends: [] };
      const ids = friends.map(f => f.id);
      const [thumbs, live] = await Promise.all([headshots(ids), presence(ids)]);
      return { visible: visible.size, hidden: hiddenCount, friends, thumbs, live };
    })();
    missingCache.set(key, job);
    job.then(r => { if (!r || !r.friends.length) missingCache.delete(key); });
    return job;
  }

  function hiddenBadge() {
    const badge = el('span', 'routility-injected routility-hidden-badge');
    const logo = el('img', 'routility-hidden-logo');
    logo.src = chrome.runtime.getURL('icons/logo.png');
    logo.alt = '';
    badge.appendChild(logo);
    badge.tabIndex = 0;
    badge.dataset.rtTip = lt('Roblox hides this friend, usually because their account is in the UK. Shown via RoUtility.');
    return badge;
  }

  let fill = null;

  function placeUnavailable() {
    const f = fill;
    if (!f || !f.data || !/^#!\/friends\b/.test(location.hash || '#!/friends')) return;
    const pane = document.querySelector('#friends-web-app .tab-pane.active .friends-content');
    if (!pane) return;
    for (const stale of pane.querySelectorAll('.routility-unhidden')) {
      const prev = stale.previousElementSibling;
      if (!prev || prev.id !== '-1' || !prev.classList.contains('routility-native-hidden')) stale.remove();
    }
    const cards = [...pane.querySelectorAll('li.avatar-card:not(.routility-injected)')];
    for (const c of cards) if (c.id !== '-1' && c.classList.contains('routility-native-hidden')) c.classList.remove('routility-native-hidden');
    if (!cards.some(c => c.id === '-1')) return;
    const scope = pane.closest('.tab-pane') || document;
    const page = Math.max(1, parseInt(scope.querySelector('.pager-cur span, .pager-cur')?.textContent || '1', 10) || 1);
    cards.forEach((c, i) => {
      if (c.id !== '-1') return;
      const slot = `${page}:${i}`;
      if (!f.assign.has(slot) && f.next < f.data.friends.length) f.assign.set(slot, f.next++);
      const friend = f.data.friends[f.assign.get(slot)];
      const next = c.nextElementSibling;
      if (!friend) {
        if (next && next.classList.contains('routility-unhidden')) next.remove();
        c.classList.remove('routility-native-hidden');
        return;
      }
      if (next && next.classList.contains('routility-unhidden') && next.id === String(friend.id)) return;
      if (next && next.classList.contains('routility-unhidden')) next.remove();
      c.classList.add('routility-native-hidden');
      const ours = card(friend, f.data.thumbs.get(friend.id), f.data.live.get(friend.id));
      ours.classList.add('routility-unhidden');
      ours.querySelector('.avatar-card-fullbody')?.appendChild(hiddenBadge());
      c.after(ours);
    });
  }

  async function fillUnavailable(userId) {
    if (fill && fill.userId === String(userId)) return;
    stopFill();
    const f = { userId: String(userId), data: null, assign: new Map(), next: 0 };
    fill = f;
    f.observer = new MutationObserver(onFrame(placeUnavailable));
    f.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    const data = await missing(userId);
    if (fill !== f) return;
    if (!data || !data.friends.length) return stopFill();
    f.data = data;
    placeUnavailable();
  }

  function stopFill() {
    if (!fill) return;
    fill.observer.disconnect();
    fill = null;
    document.querySelectorAll('.routility-unhidden').forEach(n => n.remove());
    document.querySelectorAll('.routility-native-hidden').forEach(n => n.classList.remove('routility-native-hidden'));
  }

  let sl = null;

  function linkSearchCards() {
    for (const card of document.querySelectorAll('#react-player-search-web-app article.player-search-card')) {
      const id = (card.dataset.testid || '').match(/^player-card-(\d+)$/)?.[1];
      const body = card.querySelector(':scope > .player-search-card-body');
      if (!id || !body) continue;
      const href = card.classList.contains('routility-termed-card') ? `/users/${id}/profile#routility-user=${id}` : `/users/${id}/profile`;
      let a = body.querySelector(':scope > .routility-search-card-link');
      if (a && a.getAttribute('href') === href) continue;
      if (!a) {
        a = el('a', 'routility-injected routility-search-card-link');
        a.tabIndex = -1;
        a.setAttribute('aria-hidden', 'true');
        body.appendChild(a);
      }
      a.href = href;
    }
  }

  function searchCardLinks() {
    if (sl) return;
    sl = new MutationObserver(onFrame(linkSearchCards));
    sl.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    linkSearchCards();
  }

  function stopSearchCardLinks() {
    if (!sl) return;
    sl.disconnect();
    sl = null;
    document.querySelectorAll('.routility-search-card-link').forEach(n => n.remove());
  }

  let ts = null;

  async function termedLookup(name) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return null;
    const hit = await post('https://users.roblox.com/v1/usernames/users', { usernames: [name], excludeBannedUsers: false });
    const u = hit && hit.data && hit.data[0];
    if (!u || !u.id) return null;
    try {
      const r = await fetch(`https://users.roblox.com/v1/users/${u.id}`);
      const full = r.ok ? await r.json() : null;
      if (!full || !full.isBanned) return null;
      return { id: full.id, name: full.name, displayName: full.displayName || full.name, hasVerifiedBadge: !!full.hasVerifiedBadge };
    } catch {
      return null;
    }
  }

  function termedCard(u) {
    const href = `/users/${u.id}/profile#routility-user=${u.id}`;
    const card = el('article', 'player-search-card relative flex width-full min-height-2000 flex-col bg-surface-100 radius-medium routility-injected routility-termed-card');
    card.dataset.testid = 'player-card-' + u.id;
    const body = el('div', 'player-search-card-body flex width-full grow cursor-pointer items-start gap-large padding-large');
    body.setAttribute('role', 'button');
    body.tabIndex = 0;
    const go = () => { location.href = href; };
    body.addEventListener('click', go);
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    const avatar = el('span', 'player-search-avatar shrink-0');
    const clip = el('span', 'player-search-avatar-clip');
    const thumb = el('span', 'thumbnail-2d-container height-full width-full');
    const img = el('img', 'height-full width-full object-cover routility-fade');
    img.alt = u.displayName;
    img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
    thumb.appendChild(img);
    clip.appendChild(thumb);
    avatar.appendChild(clip);
    headshots([u.id]).then((m) => { const src = m.get(u.id); if (src) img.src = src; });
    const caption = el('div', 'player-search-card-caption flex flex-col justify-start gap-xsmall');
    const row = el('div', 'flex min-width-0 items-center gap-small');
    const name = el('div', 'player-search-card-name flex items-center gap-xxsmall text-body-large content-emphasis');
    name.appendChild(el('span', 'min-width-0 text-truncate-end', u.displayName));
    if (u.hasVerifiedBadge) name.appendChild(window.RoUtilityUI.verifiedBadge());
    row.appendChild(name);
    caption.append(row, el('p', 'text-body-small content-muted', '@' + u.name), el('p', 'text-body-small content-system-alert routility-termed-label', lt('Terminated')));
    body.append(avatar, caption);
    const actions = el('div', 'player-search-actions padding-x-large padding-bottom-large');
    const view = el('a', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium bg-action-standard content-action-standard width-full');
    view.href = href;
    view.style.textDecoration = 'none';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none');
    layer.setAttribute('aria-hidden', 'true');
    const label = el('span', 'flex items-center min-width-0 gap-small');
    label.appendChild(el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', lt('View Profile')));
    view.append(layer, label);
    actions.appendChild(view);
    card.append(body, actions);
    return card;
  }

  function runTermed() {
    const s = ts;
    if (!s) return;
    const kw = (new URLSearchParams(location.search).get('keyword') || '').trim();
    const grid = document.querySelector('#react-player-search-web-app .player-search-results-grid');
    const ours = document.querySelectorAll('.routility-termed-card');
    if (s.key !== kw) {
      s.key = kw;
      s.user = null;
      ours.forEach(n => n.remove());
      termedLookup(kw).then((u) => {
        if (ts !== s || s.key !== kw) return;
        s.user = u;
        runTermed();
      });
      return;
    }
    const u = s.user;
    if (!grid || !u) {
      ours.forEach(n => n.remove());
      return;
    }
    if (grid.querySelector(`article[data-testid="player-card-${u.id}"]:not(.routility-termed-card)`)) {
      ours.forEach(n => n.remove());
      return;
    }
    const mine = grid.querySelector(':scope > .routility-termed-card');
    if (!mine || grid.firstElementChild !== mine) {
      ours.forEach(n => n.remove());
      grid.prepend(termedCard(u));
    }
    const none = [...document.querySelectorAll('#react-player-search-web-app .bg-surface-100.content-muted')].find(n => /^There are no matches/.test(n.textContent.trim()));
    if (none) none.classList.add('routility-native-hidden-el');
  }

  function termedSearch() {
    if (ts) return;
    ts = { key: null, user: null };
    ts.observer = new MutationObserver(onFrame(runTermed));
    ts.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    runTermed();
  }

  function stopTermedSearch() {
    if (!ts) return;
    ts.observer.disconnect();
    ts = null;
    document.querySelectorAll('.routility-termed-card').forEach(n => n.remove());
  }

  let cm = null;
  let blockCsrf = '';

  function friendsTab() {
    const h = location.hash.replace(/^#!?\/?/, '').split(/[/?]/)[0].toLowerCase();
    return h === '' || h === 'friends';
  }

  function closeCardMenu() {
    if (!cm || !cm.pop) return;
    cm.pop.remove();
    cm.btn?.setAttribute('aria-expanded', 'false');
    cm.pop = null;
    cm.btn = null;
  }

  function placeCardPop() {
    if (!cm || !cm.pop || !cm.btn) return;
    if (!cm.btn.isConnected) return closeCardMenu();
    const b = cm.btn.getBoundingClientRect();
    const w = cm.pop.offsetWidth;
    const left = Math.max(8 + scrollX, Math.min(b.left + scrollX + b.width / 2 - w / 2, scrollX + document.documentElement.clientWidth - w - 8));
    cm.pop.style.left = Math.round(left) + 'px';
    cm.pop.style.top = Math.round(b.bottom + scrollY) + 'px';
    const arrow = cm.pop.querySelector('.arrow');
    if (arrow) arrow.style.left = Math.round(b.left + scrollX + b.width / 2 - left) + 'px';
  }

  function cardName(card) {
    const names = [...card.querySelectorAll('.avatar-name')].filter(n => !n.classList.contains('routility-native-hidden-el'));
    return (names[0]?.textContent || '').trim() || lt('this user');
  }

  function forget(id) {
    hideGone(id);
    if (ff && ff.friends) ff.friends = ff.friends.filter(x => x.id !== id);
  }

  async function blockUser(id) {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`https://apis.roblox.com/user-blocking-api/v1/users/${id}/block-user`, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, blockCsrf ? { 'x-csrf-token': blockCsrf } : {}) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { blockCsrf = r.headers.get('x-csrf-token'); continue; }
        if (r.status === 429) { await pause(3000 * (i + 1)); continue; }
        if (r.ok) await byMe(id);
        return r.ok;
      } catch {
        await pause(1000);
      }
    }
    return false;
  }

  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

  function dialogButton(label, cls) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium grow basis-0 ' + cls);
    b.type = 'button';
    const layer = el('div', STATE_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    const text = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    b.append(layer, text);
    b.label = text;
    return b;
  }

  function confirmBlock(id, name) {
    document.querySelector('.routility-block-modal')?.remove();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-block-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-block-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-block-title');
    dialog.dataset.size = 'Small';
    const body = el('div', 'padding-x-xlarge padding-top-xlarge flex flex-col gap-medium');
    const title = el('h2', 'text-heading-small', lt('Block {name}?', { name }));
    title.id = 'routility-block-title';
    const text = el('p', 'text-body-medium content-default', lt('This also removes them from your friends. They won’t be able to chat with you or send you friend requests. You can unblock them in Settings, under Privacy.'));
    const err = el('p', 'text-body-small content-system-alert routility-block-error');
    err.hidden = true;
    body.append(title, text, err);
    const actions = el('div', 'padding-x-xlarge padding-y-xlarge flex gap-small');
    const cancel = dialogButton(lt('Cancel'), 'bg-action-standard content-action-standard');
    const go = dialogButton(lt('Block'), 'bg-system-alert content-inverse-emphasis');
    actions.append(cancel, go);
    dialog.append(body, actions);
    overlay.appendChild(dialog);
    let busy = false;
    const shut = () => {
      if (busy) return;
      overlay.remove();
      document.removeEventListener('keydown', esc, true);
    };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    cancel.addEventListener('click', shut);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(); });
    document.addEventListener('keydown', esc, true);
    go.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      go.disabled = cancel.disabled = true;
      go.label.textContent = lt('Blocking');
      err.hidden = true;
      if (await blockUser(id)) {
        busy = false;
        forget(id);
        shut();
        return;
      }
      busy = false;
      go.disabled = cancel.disabled = false;
      go.label.textContent = lt('Block');
      err.textContent = lt('Roblox didn’t block them. Try again in a moment.');
      err.hidden = false;
    });
    document.body.appendChild(overlay);
    cancel.focus();
  }

  function openCardMenu(btn, card) {
    const id = Number(card.id);
    if (cm.pop && cm.btn === btn) return closeCardMenu();
    closeCardMenu();
    const theme = document.body.classList.contains('light-theme') ? ' light-theme' : document.body.classList.contains('dark-theme') ? ' dark-theme' : '';
    const pop = el('div', 'popover bottom fade in routility-injected routility-card-pop' + theme);
    pop.setAttribute('role', 'tooltip');
    const list = el('ul', 'dropdown-menu');
    list.setAttribute('role', 'menu');
    const item = (label, cls, onPick) => {
      const li = el('li');
      li.setAttribute('role', 'presentation');
      const a = el('a', cls, label);
      a.setAttribute('role', 'menuitem');
      a.tabIndex = -1;
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(a);
      });
      li.appendChild(a);
      list.appendChild(li);
      return a;
    };
    item(lt('Unfriend'), 'friend-unfriend', async (a) => {
      if (a.dataset.rtState === 'busy') return;
      a.dataset.rtState = 'busy';
      a.textContent = lt('Unfriending');
      if (await unfriend(id)) {
        closeCardMenu();
        forget(id);
        return;
      }
      a.dataset.rtState = 'failed';
      a.textContent = lt('Didn’t work, try again');
    });
    item(lt('Block'), 'friend-block', () => {
      const name = cardName(card);
      closeCardMenu();
      confirmBlock(id, name);
    });
    const content = el('div', 'popover-content');
    content.appendChild(list);
    pop.append(el('div', 'arrow'), content);
    pop.style.position = 'absolute';
    document.body.appendChild(pop);
    cm.pop = pop;
    cm.btn = btn;
    btn.setAttribute('aria-expanded', 'true');
    placeCardPop();
    list.querySelector('a')?.focus();
  }

  function placeCardMenus() {
    if (!cm) return;
    const on = friendsTab();
    for (const card of document.querySelectorAll('#friends-web-app li.avatar-card')) {
      const mine = card.querySelector(':scope .routility-card-menu');
      if (!on || !/^\d+$/.test(card.id) || card.querySelector('.avatar-card-menu:not(.routility-card-menu)') || card.querySelector('.avatar-card-btns, .accept-friend, .ignore-friend')) {
        mine?.remove();
        continue;
      }
      if (mine) continue;
      const host = card.querySelector('.avatar-card-content');
      if (!host) continue;
      const wrap = el('div', 'avatar-card-menu routility-injected routility-card-menu');
      const btn = el('button', 'btn-generic-more-sm');
      btn.type = 'button';
      btn.setAttribute('aria-label', lt('More options'));
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(el('span', 'icon-more'));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCardMenu(btn, card);
      });
      wrap.appendChild(btn);
      host.appendChild(wrap);
    }
  }

  function cardMenus() {
    if (cm) return;
    cm = { pop: null, btn: null };
    const again = onFrame(placeCardMenus);
    cm.observer = new MutationObserver(again);
    cm.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    cm.onHash = () => { closeCardMenu(); again(); };
    cm.onDown = (e) => { if (cm.pop && !cm.pop.contains(e.target) && !cm.btn?.contains(e.target)) closeCardMenu(); };
    cm.onKey = (e) => { if (e.key === 'Escape' && cm.pop) { const b = cm.btn; closeCardMenu(); b?.focus(); } };
    cm.onResize = onFrame(placeCardPop);
    window.addEventListener('hashchange', cm.onHash);
    document.addEventListener('mousedown', cm.onDown, true);
    document.addEventListener('keydown', cm.onKey);
    window.addEventListener('resize', cm.onResize);
    placeCardMenus();
  }

  function stopCardMenus() {
    if (!cm) return;
    closeCardMenu();
    cm.observer.disconnect();
    window.removeEventListener('hashchange', cm.onHash);
    document.removeEventListener('mousedown', cm.onDown, true);
    document.removeEventListener('keydown', cm.onKey);
    window.removeEventListener('resize', cm.onResize);
    cm = null;
    document.querySelectorAll('.routility-card-menu, .routility-card-pop, .routility-block-modal').forEach(n => n.remove());
  }

  function teardown() {
    stopFill();
    stopCardMenus();
    stopTermedSearch();
    stopSearchCardLinks();
    clearGone();
    reveal?.disconnect();
    reveal = null;
    if (!state) return;
    state.observer?.disconnect();
    if (state.onHash) window.removeEventListener('hashchange', state.onHash);
    document.querySelectorAll('.routility-friend-list, .routility-friend-pager, .routility-friends-subtitle, #friends-web-app .routility-hidden-source').forEach(n => n.remove());
    document.querySelectorAll('#friends-web-app .section-content-off').forEach(n => { n.style.display = ''; });
    state = null;
  }

  const adminKnown = new Map();
  let adminObserver = null;
  let adminQueued = null;
  let adminRetryAt = 0;

  const adminMark = () => window.RoUtilityUI.adminBadge();

  function cardUserId(li) {
    const own = li.id && /^\d+$/.test(li.id) ? li.id : '';
    if (own) return own;
    const test = (li.dataset.testid || '').match(/^player-card-(\d+)$/);
    if (test) return test[1];
    const a = li.querySelector('a[href*="/users/"]');
    const m = a && a.getAttribute('href').match(/\/users\/(\d+)\//);
    return m ? m[1] : '';
  }

  const ADMIN_SPOTS = [
    { card: '#friends-web-app li.avatar-card, .routility-friends-grid li.avatar-card', box: '.avatar-name-container' },
    { card: '.friends-carousel-tile', box: '.friends-carousel-tile-name' },
    { card: 'article.player-search-card', box: '.player-search-card-name' },
  ];

  function placeAdmins() {
    const cards = ADMIN_SPOTS.flatMap(spot => [...document.querySelectorAll(spot.card)].map(li => [li, spot.box]));
    const ask = [];
    for (const [li, boxSel] of cards) {
      const id = cardUserId(li);
      if (!id) continue;
      const known = adminKnown.get(id);
      const box = li.querySelector(boxSel);
      if (known === undefined) { ask.push(id); continue; }
      if (!box) continue;
      const mark = box.querySelector(':scope > .routility-admin-badge');
      if (known && !mark) box.appendChild(adminMark());
      else if (known && mark && mark !== box.lastElementChild) box.appendChild(mark);
      else if (!known && mark) mark.remove();
    }
    if (!ask.length || adminQueued || Date.now() < adminRetryAt) return;
    const ids = [...new Set(ask)];
    ids.forEach(id => adminKnown.set(id, false));
    adminQueued = window.RoUtilityUI.request({ type: 'robloxAdmins', ids }, r => r && Array.isArray(r.admins)).then(r => {
      adminQueued = null;
      if (!r || !Array.isArray(r.admins)) { ids.forEach(id => adminKnown.delete(id)); adminRetryAt = Date.now() + 30000; return; }
      const yes = new Set(r.admins.map(String));
      ids.forEach(id => adminKnown.set(id, yes.has(id)));
      placeAdmins();
    });
  }

  function adminBadges() {
    if (adminObserver) return;
    adminObserver = new MutationObserver(window.RoUtilityUI.onFrame(placeAdmins));
    adminObserver.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    placeAdmins();
  }

  function stopAdminBadges() {
    adminObserver?.disconnect();
    adminObserver = null;
    document.querySelectorAll('.routility-admin-badge').forEach(n => n.remove());
  }

  const FILTERS = [['verified', LT('Verified')], ['plus', LT('Roblox Plus')], ['admin', LT('Admin')], ['online', LT('Online')]];
  const CHIP_ON = ['bg-inverse-surface-0', 'content-inverse-emphasis'];
  const CHIP_OFF = ['bg-shift-300', 'content-action-utility'];
  let ff = null;

  async function robloxPost(url, body) {
    const send = (token) => fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-csrf-token': token } : {}), body: JSON.stringify(body) });
    try {
      let res = await send(ff && ff.csrf);
      if (res.status === 403 && res.headers.get('x-csrf-token')) {
        if (ff) ff.csrf = res.headers.get('x-csrf-token');
        res = await send(res.headers.get('x-csrf-token'));
      }
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async function plusSet(ids) {
    const out = new Set();
    for (let i = 0; i < ids.length; i += 100) {
      const res = await robloxPost('https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles', { userIds: ids.slice(i, i + 100), fields: ['hasRobloxSubscription'] });
      for (const p of (res && res.profileDetails) || []) if (p.hasRobloxSubscription) out.add(Number(p.userId));
    }
    return out;
  }

  async function adminSet(ids) {
    const out = new Set();
    for (let i = 0; i < ids.length; i += 200) {
      const res = await window.RoUtilityUI.request({ type: 'robloxAdmins', ids: ids.slice(i, i + 200).map(String) }, r => r && Array.isArray(r.admins));
      for (const id of (res && res.admins) || []) out.add(Number(id));
    }
    return out;
  }

  function myId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function chipClasses(btn, on) {
    btn.classList.remove(...CHIP_ON, ...CHIP_OFF);
    btn.classList.add(...(on ? CHIP_ON : CHIP_OFF));
    btn.setAttribute('aria-pressed', String(on));
  }

  function ffMatches() {
    const f = ff;
    let list = f.friends || [];
    if (f.active === 'verified') list = list.filter(x => x.hasVerifiedBadge);
    else if (f.active === 'plus') list = f.plus ? list.filter(x => f.plus.has(x.id)) : [];
    else if (f.active === 'admin') list = f.admin ? list.filter(x => f.admin.has(x.id)) : [];
    else if (f.active === 'online') list = list.filter(x => [1, 2, 3].includes((f.live.get(x.id) || {}).userPresenceType));
    const q = f.query;
    return q ? list.filter(x => `${x.displayName} ${x.name}`.toLowerCase().includes(q)) : list;
  }

  function ffReady() {
    const f = ff;
    if (!f.friends) return false;
    if (f.active === 'plus') return !!f.plus;
    if (f.active === 'admin') return !!f.admin;
    return true;
  }

  function plusIcon() {
    const s = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus size-[var(--icon-size-small)] icon-display-name-badge-plus routility-injected');
    s.setAttribute('aria-label', lt('Roblox Plus subscriber'));
    return s;
  }

  function ffRender() {
    const f = ff;
    if (!f || !f.active) return;
    const pane = document.querySelector('#friends-web-app .tab-pane.active .friends-content');
    if (!pane) return;
    let list = pane.querySelector('.routility-ff-list');
    let holder = pane.querySelector('.routility-ff-pager');
    if (!list) {
      list = el('ul', 'hlist avatar-cards routility-injected routility-ff-list routility-friends-grid');
      holder = el('div', 'pager-holder routility-injected routility-ff-pager');
      pane.append(list, holder);
    }
    const key = [f.active, f.query, f.page, ffReady(), !!f.loadFailed].join('|');
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.textContent = '';
    holder.textContent = '';
    if (f.loadFailed && !f.friends) {
      const li = el('li', 'routility-injected routility-ff-empty text-secondary', lt('Couldn’t load your friends right now.'));
      const again = el('button', 'btn-control-sm routility-ff-retry', lt('Try Again'));
      again.type = 'button';
      again.addEventListener('click', () => {
        again.disabled = true;
        ffLoad(f.active);
      });
      li.appendChild(again);
      list.appendChild(li);
      return;
    }
    if (!ffReady()) {
      for (let i = 0; i < PAGE; i++) list.appendChild(skeletonCard());
      return;
    }
    const all = ffMatches();
    if (!all.length) {
      const empty = el('li', 'routility-injected routility-ff-empty text-secondary', f.query ? lt('No friends match your search.') : lt('None of your friends match this filter.'));
      list.appendChild(empty);
      return;
    }
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    f.page = Math.min(Math.max(0, f.page), pages - 1);
    for (const fr of all.slice(f.page * PAGE, f.page * PAGE + PAGE)) {
      const li = card(fr, f.thumbs.get(fr.id), f.live.get(fr.id));
      if (f.plus && f.plus.has(fr.id)) li.querySelector('.avatar-name-container').appendChild(plusIcon());
      list.appendChild(li);
    }
    if (!document.hidden) list.classList.add('routility-reveal');
    if (pages <= 1) return;
    const go = (d) => { f.page += d; ffRender(); list.scrollIntoView({ block: 'nearest' }); };
    const ul = el('ul', 'pager');
    ul.appendChild(pagerButton('prev', f.page === 0, () => go(-1)));
    const cur = el('li', 'pager-cur');
    cur.appendChild(el('span', null, String(f.page + 1)));
    ul.appendChild(cur);
    ul.appendChild(pagerButton('next', f.page >= pages - 1, () => go(1)));
    holder.appendChild(ul);
  }

  function ensureFriends(f) {
    if (!f.friendsJob) {
      f.friendsJob = (async () => {
        const friends = await load(f.userId);
        if (!friends) f.friendsJob = null;
        if (ff !== f || !friends) return;
        const ids = friends.map(x => x.id);
        const [thumbs, live] = await Promise.all([headshots(ids), presence(ids)]);
        if (ff !== f) return;
        Object.assign(f, { friends, thumbs, live });
      })();
    }
    return f.friendsJob;
  }

  async function ffLoad(key) {
    const f = ff;
    f.loadFailed = false;
    await ensureFriends(f);
    if (ff !== f) return;
    if (!f.friends) {
      f.loadFailed = true;
      ffRender();
      return;
    }
    const ids = f.friends.map(x => x.id);
    if (key === 'plus' && !f.plusJob) f.plusJob = plusSet(ids).then(s => { if (ff === f) f.plus = s; });
    if (key === 'admin' && !f.adminJob) f.adminJob = adminSet(ids).then(s => { if (ff === f) f.admin = s; });
    if (key === 'plus') await f.plusJob;
    if (key === 'admin') await f.adminJob;
    if (ff === f) ffRender();
  }

  function ffActivate(key) {
    const f = ff;
    if (!f) return;
    f.active = key;
    f.page = 0;
    document.documentElement.classList.toggle('routility-ff-on', !!key);
    const box = document.querySelector('#friends-web-app .chip-filters-container');
    box?.querySelectorAll('.routility-ff-chip').forEach(b => chipClasses(b, b.dataset.filter === key));
    const natives = [...(box?.querySelectorAll('button:not(.routility-ff-chip)') || [])];
    if (key && natives[0] && natives.some((b, i) => i > 0 && b.getAttribute('aria-pressed') === 'true')) {
      f.resetting = true;
      natives[0].click();
      f.resetting = false;
    }
    if (!key) {
      document.querySelectorAll('.routility-ff-list, .routility-ff-pager').forEach(n => n.remove());
      return;
    }
    const input = document.querySelector('#friends-web-app .friends-filter-searchbar-input');
    f.query = (input && input.value || '').trim().toLowerCase();
    ffRender();
    ffLoad(key);
  }

  function ffPlace() {
    const f = ff;
    if (!f) return;
    if (!/^#!\/friends\b/.test(location.hash || '#!/friends')) {
      if (f.active) ffActivate(null);
      document.querySelector('.routility-uf-banner')?.remove();
      return;
    }
    const box = document.querySelector('#friends-web-app .chip-filters-container');
    if (!box) return;
    if (f.filters && !box.querySelector('.routility-ff-chip')) {
      const model = box.querySelector('button');
      if (!model) return;
      for (const [key, label] of FILTERS) {
        const b = model.cloneNode(true);
        b.classList.add('routility-injected', 'routility-ff-chip');
        b.dataset.filter = key;
        b.querySelector('span').textContent = lt(label);
        chipClasses(b, f.active === key);
        b.addEventListener('click', () => ffActivate(f.active === key ? null : key));
        box.appendChild(b);
      }
    }
    if (f.manage && !box.querySelector('.routility-fm-open')) {
      const model = box.querySelector('button:not(.routility-ff-chip)');
      if (model) {
        const b = model.cloneNode(true);
        b.classList.add('routility-injected', 'routility-fm-open');
        b.removeAttribute('data-rtff');
        b.querySelector('span').textContent = lt('Manage');
        chipClasses(b, false);
        b.removeAttribute('aria-pressed');
        b.addEventListener('click', (e) => { e.stopPropagation(); fmOpen(); });
        box.appendChild(b);
      }
    }
    for (const nb of box.querySelectorAll('button:not(.routility-ff-chip):not(.routility-fm-open)')) {
      if (nb.dataset.rtff) continue;
      nb.dataset.rtff = '1';
      nb.addEventListener('click', () => { if (ff && ff.active && !ff.resetting) ffActivate(null); });
    }
    const input = document.querySelector('#friends-web-app .friends-filter-searchbar-input');
    if (input && !input.dataset.rtff) {
      input.dataset.rtff = '1';
      input.addEventListener('input', () => {
        if (!ff || !ff.active) return;
        ff.query = input.value.trim().toLowerCase();
        ff.page = 0;
        ffRender();
      });
    }
    if (f.gone && !document.querySelector('.routility-uf-banner')) ufPlace();
    if (f.active) ffRender();
  }

  let fmCsrf = '';
  const pause = ms => new Promise(r => setTimeout(r, ms));

  async function byMe(id) {
    try {
      const st = await chrome.storage.local.get('routilityUnfriendedByMe');
      const list = (st.routilityUnfriendedByMe || []).filter(x => x !== String(id));
      list.unshift(String(id));
      await chrome.storage.local.set({ routilityUnfriendedByMe: list.slice(0, 2000) });
    } catch {}
  }

  async function unfriend(id) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`https://friends.roblox.com/v1/users/${id}/unfriend`, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, fmCsrf ? { 'x-csrf-token': fmCsrf } : {}) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { fmCsrf = r.headers.get('x-csrf-token'); continue; }
        if (r.status === 429) { await pause(3000 * (i + 1)); continue; }
        if (r.ok) await byMe(id);
        return r.ok;
      } catch {
        await pause(1000);
      }
    }
    return false;
  }

  const FM_FILTERS = [['all', LT('All')], ['online', LT('Online')], ['offline', LT('Offline')], ['verified', LT('Verified')], ['admin', LT('Admins')], ['deleted', LT('Terminated')]];

  async function fmOpen() {
    const f = ff;
    if (!f) return;
    document.querySelector('.routility-fm-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop routility-fm-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-fm-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-cm-titlebox');
    const count = el('span', 'text-body-medium content-muted routility-cm-count');
    titleBox.append(el('h2', 'routility-modal-title', lt('My Friends')), count);
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, close);

    const tools = el('div', 'routility-cm-tools');
    const search = el('input', 'form-control input-field routility-cm-search');
    search.type = 'search';
    search.placeholder = lt('Search Friends');
    const filters = el('div', 'routility-cm-filters');
    let filter = 'all';
    for (const [key, label] of FM_FILTERS) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-cm-filter');
      b.type = 'button';
      b.dataset.key = key;
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', lt(label)));
      b.addEventListener('click', () => {
        filter = key;
        paint();
        if (key === 'admin' && !f.admin) ffLoad('admin').then(() => { if (backdrop.isConnected && filter === 'admin') paint(); });
      });
      filters.appendChild(b);
    }
    const pickAll = el('button', 'btn-control-sm routility-fm-all', lt('Select All'));
    pickAll.type = 'button';
    tools.append(search, filters, pickAll);

    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-list');
    for (let i = 0; i < 8; i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
    body.appendChild(list);

    const foot = el('div', 'routility-cm-foot');
    const selInfo = el('span', 'text-body-medium content-muted');
    const remove = el('button', 'btn-alert-md btn-min-width routility-cm-leave', lt('Unfriend Selected'));
    remove.type = 'button';
    remove.disabled = true;
    foot.append(selInfo, remove);

    modal.append(head, tools, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    if (!document.hidden) modal.classList.add('routility-reveal');
    let busy = false;
    const shut = () => {
      if (busy) return;
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    await ensureFriends(f);
    if (!backdrop.isConnected || ff !== f) return;
    const selected = new Set();
    const failed = new Set();
    let confirm = false;
    let confirmTimer = 0;
    let note = '';
    let shown = [];
    const online = (x) => [1, 2, 3].includes((f.live.get(x.id) || {}).userPresenceType);

    const paintFoot = () => {
      const n = selected.size;
      count.textContent = ltn((f.friends || []).length, '{n} friend', '{n} friends', { n: formatNumber((f.friends || []).length) });
      selInfo.textContent = note || (n ? lt('{n} selected', { n: formatNumber(n) }) : lt('Select friends to unfriend them'));
      selInfo.classList.toggle('routility-cm-note-bad', !!note && failed.size > 0);
      remove.disabled = !n || busy;
      remove.classList.toggle('routility-cm-confirm', confirm);
      if (!busy) remove.textContent = confirm ? ltn(n, 'Unfriend {n} Friend?', 'Unfriend {n} Friends?', { n: formatNumber(n) }) : lt('Unfriend Selected');
      pickAll.disabled = busy || !shown.length;
      pickAll.textContent = shown.length && shown.every(x => selected.has(x.id)) ? lt('Clear') : lt('Select All');
    };

    const paint = () => {
      filters.querySelectorAll('.routility-cm-filter').forEach(b => {
        const on = b.dataset.key === filter;
        b.classList.toggle('bg-inverse-surface-0', on);
        b.classList.toggle('content-inverse-emphasis', on);
        b.classList.toggle('bg-shift-300', !on);
        b.classList.toggle('content-action-utility', !on);
      });
      const q = search.value.trim().toLowerCase();
      const waiting = filter === 'admin' && !f.admin;
      shown = waiting ? [] : (f.friends || []).filter(x => (filter === 'all' || (filter === 'online' && online(x)) || (filter === 'offline' && !online(x)) || (filter === 'verified' && x.hasVerifiedBadge) || (filter === 'admin' && f.admin.has(x.id)) || (filter === 'deleted' && x.deleted))
        && (!q || `${x.displayName} ${x.name}`.toLowerCase().includes(q)))
        .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));
      list.textContent = '';
      if (waiting) {
        for (let i = 0; i < 8; i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
        paintFoot();
        return;
      }
      if (!f.friends) {
        const li = el('li', 'routility-cm-empty text-body-medium content-muted', lt('Couldn’t load your friends right now.'));
        const again = el('button', 'btn-control-sm routility-ff-retry', lt('Try Again'));
        again.type = 'button';
        again.addEventListener('click', async () => {
          again.disabled = true;
          again.textContent = lt('Loading…');
          await ensureFriends(f);
          if (backdrop.isConnected) paint();
        });
        li.appendChild(again);
        list.appendChild(li);
        paintFoot();
        return;
      }
      if (!shown.length) list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', q ? lt('No friends match your search.') : lt('No friends match this filter.')));
      for (const x of shown) {
        const li = el('li', 'routility-cm-row' + (selected.has(x.id) ? ' routility-cm-picked' : '') + (failed.has(x.id) ? ' routility-cm-failed' : ''));
        const box = el('input', 'routility-cm-check');
        box.type = 'checkbox';
        box.checked = selected.has(x.id);
        box.disabled = busy;
        box.setAttribute('aria-label', lt('Select {name}', { name: x.displayName || x.name }));
        box.addEventListener('change', () => {
          if (box.checked) selected.add(x.id);
          else selected.delete(x.id);
          confirm = false;
          note = '';
          li.classList.toggle('routility-cm-picked', box.checked);
          paintFoot();
        });
        const icon = el('span', 'routility-cm-icon routility-fm-face thumbnail-2d-container');
        const src = f.thumbs.get(x.id);
        if (src) {
          const img = el('img');
          img.alt = '';
          img.src = src;
          icon.appendChild(img);
        }
        const text = el('a', 'routility-cm-text');
        text.href = `/users/${x.id}/profile`;
        const name = el('span', 'routility-cm-name text-title-medium');
        name.appendChild(el('span', 'text-truncate-end', x.displayName || x.name || String(x.id)));
        if (x.hasVerifiedBadge) name.appendChild(window.RoUtilityUI.verifiedBadge());
        if (f.admin && f.admin.has(x.id)) name.appendChild(window.RoUtilityUI.adminBadge());
        const p = f.live.get(x.id);
        const where = online(x) ? ' · ' + lt(LABELS[p.userPresenceType] || 'Online') : '';
        text.append(name, el('span', 'routility-cm-meta text-body-small content-muted', (x.name ? '@' + x.name : '') + where));
        const tags = el('span', 'routility-cm-tags');
        if (x.deleted) tags.appendChild(el('span', 'routility-cm-tag routility-fm-tag-bad', lt('Terminated')));
        li.append(box, icon, text, tags);
        li.addEventListener('click', (e) => {
          if (e.target.closest('a, input') || box.disabled) return;
          box.checked = !box.checked;
          box.dispatchEvent(new Event('change'));
        });
        list.appendChild(li);
      }
      paintFoot();
    };

    let typing = 0;
    search.addEventListener('input', () => {
      clearTimeout(typing);
      typing = setTimeout(paint, 120);
    });
    pickAll.addEventListener('click', () => {
      const all = shown.length && shown.every(x => selected.has(x.id));
      for (const x of shown) all ? selected.delete(x.id) : selected.add(x.id);
      confirm = false;
      note = '';
      paint();
    });
    remove.addEventListener('click', async () => {
      if (!selected.size || busy) return;
      if (!confirm) {
        confirm = true;
        paintFoot();
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { confirm = false; paintFoot(); }, 4000);
        return;
      }
      clearTimeout(confirmTimer);
      confirm = false;
      busy = true;
      note = '';
      failed.clear();
      const queue = [...selected];
      const gone = [];
      paint();
      for (let i = 0; i < queue.length; i++) {
        remove.textContent = lt('Unfriending {done} of {total}', { done: formatNumber(i + 1), total: formatNumber(queue.length) });
        if (await unfriend(queue[i])) gone.push(queue[i]);
        else failed.add(queue[i]);
        await pause(400);
      }
      const goneSet = new Set(gone);
      f.friends = (f.friends || []).filter(x => !goneSet.has(x.id));
      for (const id of gone) {
        selected.delete(id);
        hideGone(id);
      }
      document.querySelector('.routility-ff-list')?.removeAttribute('data-key');
      ffRender();
      busy = false;
      note = failed.size ? lt('Unfriended {n} · {failed} didn’t work. They’re still selected, try again.', { n: formatNumber(gone.length), failed: formatNumber(failed.size) }) : ltn(gone.length, 'Unfriended {n} friend.', 'Unfriended {n} friends.', { n: formatNumber(gone.length) });
      paint();
    });
    paint();
  }

  const SNAP_KEY = (me) => 'routilityFriendSnap:' + me;
  const GONE_KEY = (me) => 'routilityUnfriended:' + me;
  const BY_ME_KEY = 'routilityUnfriendedByMe';

  async function stillFriends(me, ids) {
    const out = new Set();
    try {
      for (let i = 0; i < ids.length; i += 50) {
        const res = await fetch(`https://friends.roblox.com/v1/users/${me}/friends/statuses?userIds=${ids.slice(i, i + 50).join(',')}`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return null;
        for (const x of (await res.json()).data || []) if (x.status === 'Friends') out.add(String(x.id));
      }
    } catch {
      return null;
    }
    return out;
  }

  let scanJob = Promise.resolve();

  function ufScan(me, known) {
    return ufQueue(() => ufScanNow(me, known));
  }

  function ufQueue(fn) {
    const job = scanJob.then(fn).catch(() => null);
    scanJob = job;
    return job;
  }

  async function ufScanNow(me, known) {
    const live = (await localIds(me, true))?.map(String);
    if (!live) return null;
    const st = await chrome.storage.local.get([SNAP_KEY(me), GONE_KEY(me), BY_ME_KEY]);
    const prev = st[SNAP_KEY(me)];
    const now = new Set(live);
    const byMeList = (st[BY_ME_KEY] || []).map(String);
    const byMeKept = byMeList.filter(id => !now.has(id));
    if (byMeKept.length !== byMeList.length) await chrome.storage.local.set({ [BY_ME_KEY]: byMeKept });
    const byMe = new Set(byMeKept);
    let gone = (st[GONE_KEY(me)] || []).filter(g => !now.has(g.id));
    const trusted = prev && Array.isArray(prev.ids) && live.length >= prev.ids.filter(id => !byMe.has(id)).length * 0.6;
    const names = Object.assign({}, (prev && prev.names) || {});
    for (const x of known || []) names[String(x.id)] = { name: x.name, displayName: x.displayName };
    let fresh = [];
    let lagging = [];
    if (trusted) {
      fresh = prev.ids.filter(id => !now.has(id) && !byMe.has(id));
      if (fresh.length) {
        const still = await stillFriends(me, fresh);
        if (still) {
          lagging = fresh.filter(id => still.has(id));
          fresh = fresh.filter(id => !still.has(id));
        }
      }
      const unnamed = fresh.filter(id => !(names[id] && names[id].name)).map(Number);
      for (let i = 0; i < unnamed.length; i += 100) {
        const res = await post('https://users.roblox.com/v1/users', { userIds: unnamed.slice(i, i + 100), excludeBannedUsers: false });
        for (const u of (res && res.data) || []) names[String(u.id)] = { name: u.name, displayName: u.displayName };
      }
      const at = Date.now();
      const again = new Set(fresh);
      gone = gone.filter(g => !again.has(g.id));
      gone = [...fresh.map(id => ({ id, name: (names[id] || {}).name || '', displayName: (names[id] || {}).displayName || (names[id] || {}).name || '', at, seen: false })), ...gone].slice(0, 200);
    }
    if (trusted || !prev) {
      const keep = {};
      const ids = [...live, ...lagging];
      for (const id of ids) if (names[id]) keep[id] = names[id];
      await chrome.storage.local.set({ [SNAP_KEY(me)]: { ids, names: keep, at: Date.now() }, [GONE_KEY(me)]: gone });
    }
    return { gone, fresh, count: live.length };
  }

  async function ufCheck(f) {
    const r = await ufScan(f.userId, f.friends);
    const key = 'routilityUfTick:' + f.userId;
    const t = Date.now();
    await chrome.storage.local.set({ [key]: r ? { at: t, full: t, count: r.count } : { at: t, full: t } });
    if (ff !== f || !r) return;
    f.gone = r.gone;
    ufPlace();
    if (!f.friends) ensureFriends(f).then(() => ufNames(f));
  }

  let ufWatch = null;

  async function ufTick(force) {
    const w = ufWatch;
    if (!w || document.hidden || w.busy) return;
    w.busy = true;
    try {
      const key = 'routilityUfTick:' + w.me;
      const st = (await chrome.storage.local.get(key))[key] || {};
      const now = Date.now();
      if (force ? now - (st.full || 0) < 60000 : now - (st.at || 0) < 55000) return;
      await chrome.storage.local.set({ [key]: { ...st, at: now } });
      let count = null;
      try {
        const res = await fetch(`https://friends.roblox.com/v1/users/${w.me}/friends/count`, { credentials: 'include', cache: 'no-store' });
        if (res.ok) count = Number((await res.json()).count);
      } catch {}
      if (!force && count !== null && count === st.count && now - (st.full || 0) < 180000) return;
      const r = await ufScan(w.me, ff && ff.friends);
      await chrome.storage.local.set({ [key]: { at: now, full: now, count: r ? (count !== null ? count : r.count) : st.count } });
      if (!r || ufWatch !== w) return;
      if (ff && ff.userId === w.me) {
        ff.gone = r.gone;
        if (!r.fresh.length) ufPlace();
      }
      if (r.fresh.length) ufOpen({ userId: w.me, gone: r.gone });
    } finally {
      w.busy = false;
    }
  }

  function startUnfriendWatch() {
    const me = myId();
    if (!me || ufWatch || window.top !== window) return;
    ufWatch = { me, busy: false };
    setTimeout(() => ufTick(true), 2500);
    ufWatch.timer = setInterval(() => ufTick(false), 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => ufTick(false), 1500); });
  }

  function ufNames(f) {
    if (ff !== f || !f.friends) return;
    const friends = f.friends;
    return ufQueue(async () => {
      const key = SNAP_KEY(f.userId);
      const snap = (await chrome.storage.local.get(key))[key];
      if (!snap || !Array.isArray(snap.ids)) return;
      const ids = new Set(snap.ids);
      const names = Object.assign({}, snap.names || {});
      for (const x of friends) if (ids.has(String(x.id))) names[String(x.id)] = { name: x.name, displayName: x.displayName };
      await chrome.storage.local.set({ [key]: { ...snap, names } });
    });
  }

  function ufSave(f) {
    const cleared = !(f.gone || []).length;
    const seen = new Set((f.gone || []).filter(g => g.seen).map(g => g.id));
    return ufQueue(async () => {
      const key = GONE_KEY(f.userId);
      if (cleared) return chrome.storage.local.set({ [key]: [] });
      const stored = (await chrome.storage.local.get(key))[key] || [];
      await chrome.storage.local.set({ [key]: stored.map(g => (seen.has(g.id) ? { ...g, seen: true } : g)) });
    });
  }

  function ufPlace() {
    const f = ff;
    if (!f || !f.unfriends || !f.gone) return;
    document.querySelector('.routility-uf-banner')?.remove();
    const unseen = f.gone.filter(g => !g.seen);
    if (!unseen.length) return;
    const box = document.querySelector('#friends-web-app .chip-filters-container');
    if (!box || !/^#!\/friends\b/.test(location.hash || '#!/friends')) return;
    const bar = el('div', 'routility-injected routility-uf-banner');
    const text = el('span', 'text-body-medium content-default', ltn(unseen.length, '{n} person is no longer your friend', '{n} people are no longer your friends', { n: formatNumber(unseen.length) }));
    const view = el('button', 'btn-control-xs routility-uf-view', lt('View'));
    view.type = 'button';
    view.addEventListener('click', () => ufOpen());
    const close = el('button', 'routility-uf-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Dismiss'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    close.addEventListener('click', () => {
      for (const g of f.gone) g.seen = true;
      ufSave(f);
      bar.remove();
    });
    bar.append(el('span', 'routility-uf-dot'), text, view, close);
    box.before(bar);
  }

  async function ufOpen(ctx) {
    const f = ctx || ff;
    if (!f || !f.gone) return;
    const sync = () => { if (ff && ff !== f && ff.userId === f.userId) ff.gone = f.gone; };
    document.querySelector('.routility-uf-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop routility-uf-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-uf-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-cm-titlebox');
    titleBox.append(el('h2', 'routility-modal-title', lt('No Longer Friends')), el('span', 'text-body-medium content-muted routility-cm-count', formatNumber(f.gone.length)));
    const closeBtn = el('button', 'routility-modal-icon routility-modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', lt('Close'));
    closeBtn.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, closeBtn);
    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-list');
    body.appendChild(list);
    const foot = el('div', 'routility-cm-foot');
    const note = el('span', 'text-body-small content-muted', lt('Includes people who unfriended you, people you removed on Roblox, and deleted accounts.'));
    const clear = el('button', 'btn-secondary-md btn-min-width', lt('Clear List'));
    clear.type = 'button';
    foot.append(note, clear);
    modal.append(head, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    const shut = () => {
    if (!document.hidden) modal.classList.add('routility-reveal');
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });
    clear.addEventListener('click', () => {
      f.gone = [];
      sync();
      ufSave(f);
      shut();
      ufPlace();
    });
    for (const g of f.gone) g.seen = true;
    sync();
    ufSave(f);
    document.querySelector('.routility-uf-banner')?.remove();
    const paint = (pics) => {
      list.textContent = '';
      if (!f.gone.length) list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', lt('Nobody yet.')));
      for (const g of f.gone) {
        const li = el('li', 'routility-cm-row');
        const icon = el('span', 'routility-cm-icon routility-fm-face thumbnail-2d-container');
        const src = pics && pics.get(Number(g.id));
        if (src) {
          const img = el('img');
          img.alt = '';
          img.src = src;
          icon.appendChild(img);
        }
        const text = el('a', 'routility-cm-text');
        text.href = `/users/${g.id}/profile`;
        const name = el('span', 'routility-cm-name text-title-medium');
        name.appendChild(el('span', 'text-truncate-end', g.displayName || g.name || g.id));
        text.append(name, el('span', 'routility-cm-meta text-body-small content-muted', g.name ? '@' + g.name : ''));
        const when = new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        li.append(icon, text, el('span', 'routility-cm-role text-body-small', lt('Noticed {date}', { date: when })));
        list.appendChild(li);
      }
    };
    paint(null);
    if (f.gone.length) headshots(f.gone.map(g => Number(g.id))).then(pics => { if (backdrop.isConnected) paint(pics); });
  }

  function friendFilters(userId, opts) {
    const id = myId();
    if (!id || (userId && userId !== id) || (ff && ff.userId === id)) return;
    stopFriendFilters();
    ff = { userId: id, active: null, friends: null, thumbs: new Map(), live: new Map(), plus: null, admin: null, page: 0, query: '', filters: !opts || opts.filters !== false, manage: !!(opts && opts.manage), unfriends: !!(opts && opts.unfriends), gone: null };
    ff.observer = new MutationObserver(onFrame(ffPlace));
    ff.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    ffPlace();
    if (ff.unfriends) ufCheck(ff);
  }

  function stopFriendFilters() {
    if (!ff) return;
    ff.observer?.disconnect();
    ff = null;
    document.documentElement.classList.remove('routility-ff-on');
    clearGone();
    document.querySelectorAll('.routility-ff-chip, .routility-ff-list, .routility-ff-pager, .routility-fm-open, .routility-fm-backdrop, .routility-uf-banner, .routility-uf-backdrop').forEach(n => n.remove());
  }

  let reqCsrf = '';

  async function friendStatus(target) {
    const me = myId();
    try {
      const res = await fetch(`https://friends.roblox.com/v1/users/${me}/friends/statuses?userIds=${target}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      const d = (await res.json()).data || [];
      return d[0] ? d[0].status : null;
    } catch {
      return null;
    }
  }

  async function cancelRequest(target) {
    if (!reqCsrf) reqCsrf = document.querySelector('meta[name="csrf-token"]')?.dataset.token || '';
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`https://friends.roblox.com/v1/users/${target}/unfriend`, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, reqCsrf ? { 'x-csrf-token': reqCsrf } : {}) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { reqCsrf = r.headers.get('x-csrf-token'); continue; }
        if (!r.ok) return false;
        break;
      } catch {
        return false;
      }
    }
    return (await friendStatus(target)) === 'NotFriends';
  }

  let reqWatch = null;

  function startCancelRequests() {
    const m = location.pathname.match(/^\/users\/(\d+)\/profile\/?$/i);
    if (!m || reqWatch || m[1] === myId()) return;
    const target = m[1];
    reqWatch = { target, status: undefined, done: false };
    friendStatus(target).then(st => { reqWatch.status = st; placeCancel(); });
    new MutationObserver(onFrame(placeCancel)).observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, characterData: true });
  }

  function placeCancel() {
    const w = reqWatch;
    if (!w || w.status !== 'RequestSent') return;
    const head = document.querySelector('#content > .profile-platform-container .user-profile-header-info') || document.querySelector('#content .user-profile-header-info');
    if (!head) return;
    const pending = [...head.querySelectorAll('button.foundation-web-button:not(.routility-cancel-req)')].find(b => /^pending\b/i.test(b.textContent.trim()));
    let btn = head.querySelector('.routility-cancel-req');
    if (!pending) {
      if (btn && !w.done) btn.remove();
      return;
    }
    if (btn && btn.previousElementSibling === pending) return;
    if (!btn) {
      btn = pending.cloneNode(true);
      btn.classList.add('routility-injected', 'routility-cancel-req');
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('id');
      const label = [...btn.querySelectorAll('span')].reverse().find(sp => sp.textContent.trim()) || btn;
      const set = (text, disabled) => {
        label.textContent = text;
        btn.disabled = !!disabled;
        btn.toggleAttribute('aria-disabled', !!disabled);
      };
      set(w.done ? lt('Request Cancelled') : lt('Cancel Request'), w.done);
      btn.dataset.rtTip = lt('Withdraw the friend request you sent');
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled || w.done) return;
        if (!btn.armed) {
          btn.armed = true;
          set(lt('Confirm Cancel'));
          btn.timer = setTimeout(() => { btn.armed = false; if (!w.done) set(lt('Cancel Request')); }, 4000);
          return;
        }
        clearTimeout(btn.timer);
        btn.armed = false;
        set(lt('Cancelling'), true);
        if (await cancelRequest(w.target)) {
          w.done = true;
          const stale = btn.previousElementSibling;
          if (stale && /^pending\b/i.test(stale.textContent.trim())) {
            stale.dataset.rtStale = '1';
            stale.hidden = true;
          }
          set(lt('Request Cancelled'), true);
          btn.dataset.rtTip = lt('Request withdrawn. Refresh to add them again.');
          return;
        }
        set(lt('Couldn’t Cancel, Try Again'));
      });
    }
    pending.after(btn);
    pending.dataset.rtStale = '1';
    pending.hidden = true;
  }

  if (location.hostname === 'www.roblox.com') {
    chrome.storage.local.get('routilitySettings', (st) => {
      const settings = st.routilitySettings || {};
      if (settings.unfriendDetector !== false) startUnfriendWatch();
      if (settings.cancelRequests !== false) startCancelRequests();
    });
  }

  window.RoUtilityFriends = { cardMenus, termedSearch, searchCardLinks, friendFilters, stopFriendFilters, adminBadges, stopAdminBadges, setup, teardown, load, hidden, revealDeleted, missing, hiddenBadge, fillUnavailable, headshots, plusSet, adminSet, robloxPost, plusIcon, skeletonCard, pagerButton };
})();
