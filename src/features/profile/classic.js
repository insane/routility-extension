(function () {
  'use strict';

  const { el, formatNumber, onFrame, pause, chunks } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const ON_CLASS = 'routility-classic-on';
  const PROXY_CLASS = 'routility-menu-proxy';
  const WEAR_PAGE = 8;
  const GRID_PAGE = 12;
  const PRESENCE_EVERY = 30000;
  const PRESENCE = { 1: ['online', 'icon-online'], 2: ['game', 'icon-game'], 3: ['studio', 'icon-studio'] };
  let state = null;

  let csrf = '';

  async function fetchRetry(url, opts, tries = 2) {
    let last = { status: 0, body: null };
    let renewed = false;
    for (let attempt = 0; attempt < tries; attempt++) {
      let res = null;
      const sent = opts && opts.method === 'POST' ? csrf : '';
      try {
        res = await fetch(url, { credentials: 'include', ...opts, headers: sent ? { ...opts.headers, 'x-csrf-token': sent } : opts && opts.headers });
      } catch {}
      const token = res && res.status === 403 && opts && opts.method === 'POST' && res.headers.get('x-csrf-token');
      if (token && !renewed) {
        renewed = true;
        csrf = token;
        attempt--;
        continue;
      }
      if (res && res.ok) {
        try {
          return { status: res.status, body: await res.json() };
        } catch {
          return { status: res.status, body: null };
        }
      }
      last = { status: res ? res.status : 0, body: null };
      if ((res && res.status !== 429 && res.status < 500) || attempt === tries - 1) return last;
      const after = res && Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 10000) : Math.min(700 * 2 ** attempt, 8000) + Math.random() * 400;
      await pause(delay);
    }
    return last;
  }

  async function jsonStatus(url, tries) {
    return fetchRetry(url, undefined, tries);
  }

  async function json(url, opts) {
    return (await fetchRetry(url, opts)).body;
  }

  async function quick(url) {
    return (await fetchRetry(url, undefined, 1)).body;
  }

  function post(url, body) {
    return json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  function catalogDetails(ids) {
    return post('https://catalog.roblox.com/v1/catalog/items/details', { items: ids.map(id => ({ itemType: 'Asset', id: Number(id) })) });
  }

  const itemMeta = new Map();

  async function wornInfo(ids) {
    const want = ids.filter(id => !itemMeta.has(String(id)));
    for (let i = 0; i < want.length; i += 100) {
      const res = await catalogDetails(want.slice(i, i + 100));
      for (const d of (res && res.data) || []) {
        const r = d.itemRestrictions || [];
        itemMeta.set(String(d.id), { name: d.name, limited: r.includes('Limited') || r.includes('Collectible'), unique: r.includes('LimitedUnique') });
      }
    }
    const missing = want.filter(id => !itemMeta.has(String(id)));
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(id => json(`https://economy.roblox.com/v2/assets/${id}/details`).then(d => {
        if (d && d.Name) itemMeta.set(String(id), { name: d.Name, limited: !!d.IsLimited || !!(d.CollectiblesItemDetails && d.CollectiblesItemDetails.IsLimited), unique: !!d.IsLimitedUnique });
      })));
    }
    return new Map(ids.filter(id => itemMeta.has(String(id))).map(id => [id, itemMeta.get(String(id))]));
  }

  async function thumbnails(requests) {
    const out = new Map();
    let pending = requests;
    for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1500));
      const retry = [];
      const parts = chunks(pending, 100);
      const batches = await Promise.all(parts.map(chunk => post('https://thumbnails.roblox.com/v1/batch', chunk.map(r => ({ format: 'Webp', isCircular: false, ...r })))));
      batches.forEach((res, k) => {
        for (const t of (res && res.data) || []) {
          if (t.state === 'Completed' && t.imageUrl) out.set(t.requestId, t.imageUrl);
          else if (t.state === 'Blocked') out.set(t.requestId, 'blocked');
          else if (t.state === 'Pending') retry.push(parts[k].find(r => r.requestId === t.requestId));
        }
      });
      pending = retry.filter(Boolean);
    }
    return out;
  }

  let renderToken = '';

  async function bannedAvatar(userId) {
    const av = await json(`https://avatar.roblox.com/v2/avatar/users/${userId}/avatar`);
    if (!av || !Array.isArray(av.assets)) return null;
    const bodyColors = {};
    for (const [k, v] of Object.entries(av.bodyColor3s || {})) bodyColors[k.replace(/3$/, '')] = String(v).toUpperCase();
    const avatarDefinition = { assets: av.assets.map(a => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id })), bodyColors, scales: av.scales, playerAvatarType: { playerAvatarType: av.playerAvatarType } };
    const body = JSON.stringify({ thumbnailConfig: { thumbnailId: av.assets[0] ? av.assets[0].id : 1, thumbnailType: '2dWebp', size: '420x420' }, avatarDefinition });
    const [flat, head] = await Promise.all([renderFlat(body), bannedHead(av)]);
    return { flat, head };
  }

  async function bannedHead(av) {
    try {
      const [ui] = await Promise.all([import(chrome.runtime.getURL('src/preview/ui.js')), import(chrome.runtime.getURL('src/preview/mesh.js'))]);
      return await ui.headshotImage([], { emote: 0, fov: 30, rot: 0, dist: -1 }, 150, false, av);
    } catch {
      return null;
    }
  }

  async function renderFlat(body) {
    if (!renderToken) renderToken = document.querySelector('meta[name="csrf-token"]')?.dataset.token || '';
    for (let i = 0; i < 20; i++) {
      let res;
      try {
        res = await fetch('https://avatar.roblox.com/v1/avatar/render', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': renderToken }, body });
      } catch {
        return null;
      }
      if (res.status === 403 && res.headers.get('x-csrf-token')) {
        renderToken = res.headers.get('x-csrf-token');
        continue;
      }
      const d = res.ok ? await res.json().catch(() => null) : null;
      if (!d) return null;
      if (d.state === 'Completed' && d.imageUrl) return d.imageUrl;
      if (d.state !== 'Pending') return null;
      await pause(1200);
    }
    return null;
  }

  function link(href, className, text) {
    const a = el('a', className, text);
    a.href = href;
    return a;
  }

  function blockedThumb() {
    return el('span', 'thumbnail-2d-container icon-blocked routility-blocked-thumb');
  }

  function setThumb(img, src) {
    if (src === 'blocked') {
      if (img.isConnected) img.replaceWith(blockedThumb());
      return;
    }
    if (src && img.getAttribute('src') !== src) img.src = src;
  }

  function image(src, className, key) {
    if (src === 'blocked') return blockedThumb();
    const img = el('img', (className ? className + ' ' : '') + 'routility-fade');
    if (key) img.dataset.thumb = key;
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('load', () => img.classList.add('routility-loaded'));
    if (src) img.src = src;
    return img;
  }

  function header(title, more) {
    const head = el('div', 'container-header');
    head.appendChild(el('h3', null, title));
    if (more) head.appendChild(more);
    return head;
  }

  function seeAll(href, text) {
    return link(href, 'btn-secondary-xs btn-more see-all-link-icon routility-see-all', text);
  }

  function joinDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function short(n) {
    if (n >= 1e6) return (Math.floor(n / 1e5) / 10).toString().replace(/\.0$/, '') + 'M+';
    if (n >= 1e4) return Math.floor(n / 1e3) + 'K+';
    return formatNumber(n);
  }

  function svg(paths, size) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      s.appendChild(p);
    }
    return s;
  }

  function nativeHeader() {
    return document.querySelector('#content > .profile-platform-container .user-profile-header-info');
  }

  function nativeMore() {
    return nativeHeader()?.querySelector('button[aria-label="Open contextual menu"]');
  }

  function nativeButtons() {
    const h = nativeHeader();
    return h ? [...h.querySelectorAll('button.foundation-web-button')].filter(b => b.textContent.trim() && !b.dataset.rtStale) : [];
  }

  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function openNativeMenu() {
    const more = nativeMore();
    if (!more) return null;
    if (more.getAttribute('aria-expanded') !== 'true') more.click();
    for (let i = 0; i < 40; i++) {
      const id = more.getAttribute('aria-controls');
      const dlg = id && document.getElementById(id);
      if (dlg && dlg.querySelector('button, a')) return { more, dlg };
      await wait(25);
    }
    return null;
  }

  async function readMenu() {
    document.documentElement.classList.add(PROXY_CLASS);
    const opened = await openNativeMenu();
    let items = [];
    if (opened) {
      items = [...opened.dlg.querySelectorAll('button, a')].map(n => ({ label: n.textContent.trim(), href: n.tagName === 'A' ? n.getAttribute('href') : null })).filter(i => i.label);
      opened.more.click();
    }
    await wait(50);
    document.documentElement.classList.remove(PROXY_CLASS);
    return items;
  }

  async function runMenuItem(label) {
    document.documentElement.classList.add(PROXY_CLASS);
    const opened = await openNativeMenu();
    const target = opened && [...opened.dlg.querySelectorAll('button, a')].find(n => n.textContent.trim() === label);
    target?.click();
    await wait(80);
    const more = nativeMore();
    if (more && more.getAttribute('aria-expanded') === 'true') more.click();
    await wait(50);
    document.documentElement.classList.remove(PROXY_CLASS);
  }

  function closeMenu() {
    document.querySelector('.routility-classic-menu')?.remove();
  }

  async function toggleMenu(button) {
    if (document.querySelector('.routility-classic-menu')) return closeMenu();
    const items = await readMenu();
    if (!items.length || !state) return;
    const menu = el('ul', 'dropdown-menu routility-classic-menu');
    menu.setAttribute('role', 'menu');
    for (const item of items) {
      const li = el('li');
      const b = el(item.href ? 'a' : 'button', null, item.label);
      if (item.href) b.href = item.href;
      else {
        b.type = 'button';
        b.addEventListener('click', () => { closeMenu(); runMenuItem(item.label); });
      }
      li.appendChild(b);
      menu.appendChild(li);
    }
    button.parentElement.appendChild(menu);
    if (menu.getBoundingClientRect().right > document.documentElement.clientWidth - 8) menu.classList.add('routility-menu-flip');
  }

  function syncBadges(s) {
    const host = s.root.querySelector('.routility-name-badges');
    const native = document.querySelector('#content > .profile-platform-container #profile-header-title-container-name')?.nextElementSibling;
    if (!host) return;
    const html = native ? native.innerHTML : '';
    if (host.dataset.src === html) return;
    host.dataset.src = html;
    host.textContent = '';
    if (native) for (const child of native.children) host.appendChild(child.cloneNode(true));
  }

  function syncActions() {
    const s = state;
    if (!s) return;
    syncBadges(s);
    const list = s.root.querySelector('.details-actions');
    if (!list) return;
    const natives = nativeButtons();
    const labels = natives.map(b => b.textContent.trim());
    const off = natives.map(nb => nb.disabled || nb.getAttribute('aria-disabled') === 'true' || /^pending\b/i.test(nb.textContent.trim()));
    const key = labels.map((l, i) => l + (off[i] ? ':off' : '')).join('|');
    if (list.dataset.labels === key) return;
    list.dataset.labels = key;
    list.textContent = '';
    natives.forEach((nb, i) => {
      const li = el('li');
      const join = /^join\b/i.test(labels[i]);
      const b = el('button', join ? 'btn-growth-md routility-join-game' : 'btn-control-md', join ? lt('Join Game') : labels[i]);
      b.type = 'button';
      if (off[i]) {
        b.classList.add('disabled');
        b.disabled = true;
      } else {
        b.addEventListener('click', () => {
          const live = nativeButtons().find(x => x.textContent.trim() === labels[i]) || nativeButtons()[i];
          live?.click();
        });
      }
      li.appendChild(b);
      list.appendChild(li);
    });
    s.root.querySelector('.routility-classic-more')?.toggleAttribute('hidden', !nativeMore());
  }

  function presence(ids) {
    return window.RoUtilityUI.presence(ids);
  }

  function statusIcon(host, p, extra) {
    host.querySelector(':scope > .avatar-status')?.remove();
    const kind = p && PRESENCE[p.userPresenceType];
    if (!kind) return;
    const place = p.userPresenceType === 2 ? p.rootPlaceId || p.placeId : null;
    const icon = el(place ? 'a' : 'span', `avatar-status ${kind[0]} ${kind[1]} ${extra}`);
    if (place) icon.href = `/games/${place}`;
    icon.dataset.rtTip = p.userPresenceType === 1 ? lt('Website') : p.lastLocation || (p.userPresenceType === 3 ? 'Studio' : lt('Playing'));
    host.appendChild(icon);
  }

  async function refreshPresence(s) {
    if (document.visibilityState !== 'visible' && s.presenceAt) return;
    s.presenceAt = Date.now();
    const ids = [s.userId, ...s.data.friends.map(f => f.id)].map(String);
    const map = await presence(ids);
    if (state !== s) return;
    const avatar = s.root.querySelector('.profile-avatar-image');
    if (avatar) statusIcon(avatar, map.get(String(s.userId)), 'profile-avatar-status');
    const line = s.root.querySelector('.routility-columns-presence');
    if (line) presenceLine(line, map.get(String(s.userId)));
    s.root.querySelectorAll('.routility-classic-people .friend').forEach((li, i) => {
      const f = s.data.friends[i];
      const box = li.querySelector('.avatar-container');
      if (f && box) statusIcon(box, map.get(String(f.id)), 'friend-status');
    });
  }

  function terminatedHref(id) {
    return `/users/${id}/profile#routility-user=${id}`;
  }

  function terminatedChip() {
    const chip = el('span', 'routility-terminated-chip');
    chip.append(el('span', 'routility-ban-icon'), el('span', null, lt('Banned')));
    chip.dataset.rtTip = lt('Roblox terminated this account. Shown via RoUtility.');
    return chip;
  }

  function bannedBadge(avatar) {
    avatar.classList.add('routility-banned-avatar');
    const badge = el('span', 'routility-banned-badge');
    badge.appendChild(el('span', 'routility-ban-icon'));
    avatar.appendChild(badge);
  }

  function compact(n) {
    if (n == null) return '';
    if (n >= 1e6) return (Math.floor(n / 1e5) / 10).toString().replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (Math.floor(n / 1e2) / 10).toString().replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function mSection(title, href, extraClass) {
    const sec = el('div', 'routility-modern-section ' + (extraClass || ''));
    const head = el('div', 'routility-modern-section-head');
    const h2 = el('h2', 'routility-modern-title', title);
    if (href) {
      const a = link(href, 'routility-modern-title-link');
      a.append(h2, el('span', 'icon-chevron-heavy-right'));
      head.appendChild(a);
    } else head.appendChild(h2);
    sec.appendChild(head);
    const row = el('div', 'routility-modern-row');
    sec.appendChild(row);
    return { sec, row };
  }

  function mItemTile(href, name, thumbKey, label) {
    const tile = el('div', 'item-card profile-item-card routility-modern-tile');
    const container = el('div', 'item-card-container');
    const a = link(href, 'item-card-link');
    const box = el('div', 'item-card-thumb-container routility-modern-thumb');
    box.appendChild(image(s_thumb(thumbKey), '', thumbKey));
    if (label) box.appendChild(el('span', 'restriction-icon ' + label));
    a.appendChild(box);
    const caption = el('div', 'item-card-caption');
    const nameEl = el('div', 'item-card-name routility-modern-tile-name', name || '');
    if (!name) nameEl.classList.add('routility-sk-text');
    caption.appendChild(nameEl);
    a.appendChild(caption);
    container.appendChild(a);
    tile.appendChild(container);
    return tile;
  }

  function s_thumb(key) {
    return state && key ? state.thumbs.get(key) : null;
  }

  function mGameTile(g) {
    const tile = el('div', 'grid-item-container game-card-container routility-modern-tile');
    const a = link(`/games/${g.placeId}`, 'game-card-link');
    const box = el('div', 'game-card-thumb-container routility-modern-thumb');
    box.appendChild(image(s_thumb('game:' + g.universeId), '', 'game:' + g.universeId));
    a.appendChild(box);
    a.appendChild(el('div', 'game-card-name game-name-title routility-modern-game-name', g.name));
    const info = el('div', 'game-card-info');
    fillGameInfo(info, g);
    a.appendChild(info);
    tile.appendChild(a);
    return tile;
  }

  function mFriendTile(f) {
    const tile = el('div', 'friends-carousel-tile routility-modern-friend');
    const box = el('div', 'avatar-container routility-modern-friend-avatar');
    const a = link(`/users/${f.id}/profile`, 'avatar-card-link');
    a.appendChild(image(s_thumb('head:' + f.id), '', 'head:' + f.id));
    box.appendChild(a);
    tile.appendChild(box);
    const label = link(`/users/${f.id}/profile`, 'friends-carousel-tile-labels routility-modern-friend-name');
    const row = el('span', 'routility-friend-name-row');
    const name = el('span', 'friends-carousel-display-name', f.displayName || f.name || '');
    if (!f.name) name.classList.add('routility-sk-text');
    row.appendChild(name);
    if (f.hasVerifiedBadge) row.appendChild(window.RoUtilityUI.verifiedBadge());
    label.appendChild(row);
    tile.appendChild(label);
    return tile;
  }

  function renderModern(s) {
    const d = s.data;
    const root = el('div', 'routility-modern routility-injected routility-classic-reveal');
    const head = el('div', 'routility-modern-header');
    const info = el('div', 'routility-modern-info');
    const avatar = el('div', 'routility-modern-avatar');
    avatar.appendChild(image(s.thumbs.get('headshot:' + s.userId), '', 'headshot:' + s.userId));
    const names = el('div', 'routility-modern-names');
    const nameRow = el('div', 'routility-modern-name-row');
    nameRow.appendChild(el('span', 'routility-modern-name', d.user.displayName || d.user.name));
    if (d.user.hasVerifiedBadge) nameRow.appendChild(window.RoUtilityUI.verifiedBadge());
    const handle = el('div', 'routility-modern-handle');
    handle.appendChild(el('div', 'routility-modern-username', '@' + d.user.name));
    if (d.user.isBanned) {
      handle.appendChild(terminatedChip());
      bannedBadge(avatar);
    }
    names.append(nameRow, handle);
    info.append(avatar, names);
    head.appendChild(info);
    const counts = el('div', 'routility-modern-counts');
    for (const [n, label, hash] of [[d.counts.friends, LT('{n} Friends'), 'friends'], [d.counts.followers, LT('{n} Followers'), 'followers'], [d.counts.followings, LT('{n} Following'), 'following']]) {
      if (n == null) continue;
      counts.appendChild(link(`/users/${s.userId}/friends#!/${hash}`, 'routility-modern-pill', lt(label, { n: compact(n) })));
    }
    head.appendChild(counts);
    if (!d.user.isBanned) head.appendChild(el('div', 'routility-classic-pill-slot'));
    if (d.user.description) {
      const wrap = el('div', 'routility-modern-desc-wrap');
      const pre = el('pre', 'routility-modern-desc');
      pre.appendChild(linkify(d.user.description));
      const more = el('button', 'routility-modern-more', lt('more'));
      more.type = 'button';
      more.hidden = true;
      more.addEventListener('click', () => { const open = pre.classList.toggle('routility-expanded'); more.textContent = open ? lt('less') : lt('more'); });
      wrap.append(pre, more);
      requestAnimationFrame(() => { more.hidden = pre.scrollHeight <= pre.clientHeight + 2; });
      head.appendChild(wrap);
    }
    root.appendChild(head);

    const tabs = el('ul', 'routility-modern-tabs');
    const content = el('div', 'routility-modern-panes');
    const panes = {};
    for (const [key, label] of [['about', LT('About')], ['creations', LT('Creations')]]) {
      const li = el('li');
      const a = el('a', 'routility-modern-tab' + (key === 'about' ? ' active' : ''), lt(label));
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.querySelectorAll('.routility-modern-tab').forEach(t => t.classList.toggle('active', t === a));
        Object.entries(panes).forEach(([k, p]) => { p.hidden = k !== key; });
      });
      li.appendChild(a);
      tabs.appendChild(li);
      const pane = el('div', 'routility-modern-pane');
      pane.hidden = key !== 'about';
      panes[key] = pane;
      content.appendChild(pane);
    }
    root.append(tabs, content);

    const about = panes.about;
    if (d.wearing.length) {
      const { sec, row } = mSection(lt('Currently Wearing'), null, 'routility-modern-wearing');
      for (const id of d.wearing.slice(0, 6)) row.appendChild(mItemTile(`/catalog/${id}`, '', 'asset:' + id));
      about.appendChild(sec);
    }
    if (d.favorites.length) {
      const { sec, row } = mSection(lt('Favorites'), `/users/${s.userId}/favorites#!/places`, 'routility-modern-favorites');
      for (const g of d.favorites.slice(0, 6)) row.appendChild(mGameTile(g));
      about.appendChild(sec);
    }
    if (d.friends.length) {
      const sec = el('div', 'routility-modern-section routility-modern-friends');
      const fh = el('div', 'routility-modern-section-head');
      const h2 = el('h2', 'routility-modern-title', lt('Friends'));
      h2.appendChild(el('span', 'routility-modern-count', `(${formatNumber(d.counts.friends || d.friends.length)})`));
      fh.appendChild(h2);
      fh.appendChild(seeAll(`/users/${s.userId}/friends#!/friends`, lt('See All')));
      sec.appendChild(fh);
      const row = el('div', 'routility-modern-row routility-modern-friend-row');
      for (const f of d.friends) row.appendChild(mFriendTile(f));
      sec.appendChild(row);
      about.appendChild(sec);
    }
    if (!d.user.isBanned) {
      const col = mSection(lt('Collections'), `/users/${s.userId}/inventory/`, 'routility-modern-collections');
      for (let i = 0; i < 6; i++) col.row.appendChild(el('div', 'routility-modern-tile routility-modern-sk-tile'));
      about.appendChild(col.sec);
    }
    if (d.badges.length) {
      const { sec, row } = mSection(lt('Badges'), `/users/${s.userId}/inventory/#!/badges`, 'routility-modern-badges');
      for (const b of d.badges.slice(0, 6)) {
        const tile = el('div', 'base-tile routility-modern-tile');
        const a = link(`/badges/${b.id}`, 'flex flex-col');
        const box = el('div', 'routility-modern-thumb');
        box.appendChild(image(s.thumbs.get('badge:' + b.id), '', 'badge:' + b.id));
        a.appendChild(box);
        a.appendChild(el('div', 'routility-modern-badge-title', b.displayName || b.name));
        tile.appendChild(a);
        row.appendChild(tile);
      }
      about.appendChild(sec);
    }
    const games = (d.games || []).map(x => ({ universeId: x.id, placeId: x.rootPlace?.id, name: x.name }));
    if (games.length) {
      const { sec, row } = mSection(lt('Experiences'), null, 'routility-modern-experiences');
      row.classList.add('routility-modern-grid');
      for (const g of games) row.appendChild(mGameTile(g));
      panes.creations.appendChild(sec);
      thumbnails(games.map(g => ({ requestId: 'game:' + g.universeId, targetId: g.universeId, type: 'GameIcon', size: '256x256' }))).then((t) => {
        if (state !== s) return;
        t.forEach((v, k) => s.thumbs.set(k, v));
        applyThumbs(s, panes.creations);
      });
    } else {
      panes.creations.appendChild(el('p', 'routility-classic-empty', lt('No creations yet.')));
    }
    return root;
  }

  function buildHeader(s) {
    const { user, counts, premium } = s.data;
    const sec = el('div', 'section profile-header');
    const card = el('div', 'section-content profile-header-content');
    const top = el('div', 'profile-header-top');
    const avatar = el('div', 'avatar avatar-headshot-lg card-plain profile-avatar-image');
    const holder = el('span', 'avatar-card-link avatar-image-link');
    holder.appendChild(el('span', 'thumbnail-2d-container routility-classic-headshot'));
    avatar.appendChild(holder);
    top.appendChild(avatar);
    const caption = el('div', 'header-caption');
    const names = el('div', 'header-names');
    const title = el('div', 'header-title');
    title.appendChild(el('h2', 'profile-name text-overflow', user.displayName || user.name));
    title.appendChild(el('span', 'routility-name-badges'));
    names.appendChild(title);
    const handle = el('div', 'routility-classic-handle');
    handle.appendChild(el('div', 'profile-display-name font-caption-body text text-overflow', '@' + user.name));
    if (user.isBanned) {
      handle.appendChild(terminatedChip());
      bannedBadge(avatar);
    }
    names.appendChild(handle);
    caption.appendChild(names);
    caption.appendChild(el('div', 'routility-classic-pill-slot'));
    const details = el('div', 'header-details');
    const info = el('ul', 'details-info');
    const stat = (n, label, href) => {
      const li = el('li');
      li.appendChild(link(href, 'text-name', n == null ? '' : short(n)));
      li.appendChild(el('div', 'text-label font-caption-header', label));
      return li;
    };
    info.appendChild(stat(counts.friends, lt('Friends'), `/users/${s.userId}/friends#!/friends`));
    info.appendChild(stat(counts.followers, lt('Followers'), `/users/${s.userId}/friends#!/followers`));
    info.appendChild(stat(counts.followings, lt('Following'), `/users/${s.userId}/friends#!/following`));
    details.appendChild(info);
    details.appendChild(el('ul', 'details-actions desktop-action'));
    caption.appendChild(details);
    top.appendChild(caption);
    const fitStats = () => {
      const actions = details.querySelector('.details-actions');
      if (!actions || !actions.children.length) return;
      const extras = [...info.querySelectorAll('.routility-mutual-li, .routility-groups-li')];
      if (!extras.length || info.getBoundingClientRect().right <= actions.getBoundingClientRect().left - 16) return;
      const values = caption.querySelector('.routility-value-row');
      if (values && values.dataset.state !== 'ready') return;
      let row = values;
      if (!row) {
        row = caption.querySelector('.routility-stat-row');
        if (!row) {
          row = el('div', 'flex-nowrap gap-small flex routility-classic-pills routility-injected routility-stat-row');
          names.after(row);
        }
      }
      for (const li of extras) {
        li.classList.add('routility-pill-stat');
        if (!li.dataset.rtPillClick) {
          li.dataset.rtPillClick = '1';
          li.addEventListener('click', (e) => {
            if (!li.classList.contains('routility-pill-stat') || e.target.closest('a')) return;
            li.querySelector('a')?.click();
          });
        }
        row.appendChild(li);
      }
    };
    new MutationObserver(onFrame(fitStats)).observe(top, { childList: true, subtree: true, characterData: true });
    const moreWrap = el('div', 'routility-classic-more-wrap');
    const more = el('button', 'routility-classic-more');
    more.type = 'button';
    more.setAttribute('aria-label', lt('More'));
    const ns = 'http://www.w3.org/2000/svg';
    const dots = document.createElementNS(ns, 'svg');
    dots.setAttribute('viewBox', '0 0 24 24');
    dots.setAttribute('width', '20');
    dots.setAttribute('height', '20');
    dots.setAttribute('aria-hidden', 'true');
    for (const cx of [5, 12, 19]) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', 12);
      c.setAttribute('r', 2);
      c.setAttribute('fill', 'currentColor');
      dots.appendChild(c);
    }
    more.appendChild(dots);
    more.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(more); });
    moreWrap.appendChild(more);
    top.appendChild(moreWrap);
    card.appendChild(top);
    sec.appendChild(card);
    return sec;
  }

  let aboutCsrf = '';

  async function saveDescription(text) {
    for (let i = 0; i < 3; i++) {
      let res;
      try {
        res = await fetch('https://users.roblox.com/v1/description', { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, aboutCsrf ? { 'x-csrf-token': aboutCsrf } : {}), body: JSON.stringify({ description: text }) });
      } catch {
        return { ok: false, message: lt('Couldn’t reach Roblox. Try again.') };
      }
      if (res.status === 403 && res.headers.get('x-csrf-token')) { aboutCsrf = res.headers.get('x-csrf-token'); continue; }
      let data = null;
      try { data = await res.json(); } catch {}
      if (res.ok) return { ok: true, description: data && typeof data.description === 'string' ? data.description : text };
      const err = data && data.errors && data.errors[0] && data.errors[0].message;
      return { ok: false, message: res.status === 429 ? lt('Roblox says to slow down. Try again in a minute.') : err || lt('Roblox didn’t save your About. Try again.') };
    }
    return { ok: false, message: lt('Roblox didn’t save your About. Try again.') };
  }

  function aboutContent(body, description) {
    body.textContent = '';
    if (!description) return;
    const content = el('div', 'profile-about-content');
    const pre = el('pre', 'text profile-about-text routility-classic-about');
    pre.appendChild(linkify(description));
    content.appendChild(pre);
    const toggle = el('span', 'toggle-content text-link cursor-pointer', lt('Read More'));
    toggle.hidden = true;
    toggle.addEventListener('click', () => {
      const open = pre.classList.toggle('routility-expanded');
      toggle.textContent = open ? lt('Show Less') : lt('Read More');
    });
    content.appendChild(toggle);
    new ResizeObserver(() => { toggle.hidden = !pre.classList.contains('routility-expanded') && pre.scrollHeight <= pre.clientHeight + 2; }).observe(pre);
    body.appendChild(content);
  }

  function aboutEditor(s, body, editBtn) {
    const user = s.data.user;
    body.textContent = '';
    editBtn.hidden = true;
    const form = el('div', 'routility-about-form');
    const area = el('textarea', 'form-control input-field routility-about-input');
    area.maxLength = 1000;
    area.rows = 5;
    area.placeholder = lt('Describe yourself (1000 character limit)');
    area.setAttribute('aria-label', lt('About'));
    area.value = user.description || '';
    const foot = el('div', 'routility-about-foot');
    const note = el('span', 'text-secondary font-caption-body routility-about-note', lt('Keep yourself safe, do not share personal details online.'));
    const count = el('span', 'text-secondary font-caption-body routility-about-count');
    const err = el('p', 'text-error font-caption-body routility-about-error');
    err.hidden = true;
    const btns = el('div', 'routility-about-btns');
    const cancel = el('button', 'btn-control-sm', lt('Cancel'));
    cancel.type = 'button';
    const save = el('button', 'btn-primary-sm', lt('Save'));
    save.type = 'button';
    btns.append(cancel, save);
    foot.append(note, count, btns);
    form.append(area, err, foot);
    body.appendChild(form);
    const paint = () => { count.textContent = `${formatNumber(area.value.length)}/1,000`; };
    area.addEventListener('input', paint);
    paint();
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
    const close = (key) => {
      aboutContent(body, s.data.user.description);
      if (s.columns) noDescription(s, body);
      editBtn.hidden = false;
      if (key) editBtn.focus();
    };
    cancel.addEventListener('click', (e) => close(e.detail === 0));
    area.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } });
    save.addEventListener('click', async () => {
      if (save.disabled) return;
      const text = area.value;
      if (text === (user.description || '')) return close(false);
      save.disabled = cancel.disabled = area.disabled = true;
      save.textContent = lt('Saving');
      err.hidden = true;
      const r = await saveDescription(text);
      if (state !== s) return;
      save.disabled = cancel.disabled = area.disabled = false;
      save.textContent = lt('Save');
      if (!r.ok) {
        err.textContent = r.message;
        err.hidden = false;
        area.focus();
        return;
      }
      s.data.user.description = r.description;
      close(false);
    });
  }

  function buildAbout(s) {
    const { user, history } = s.data;
    const sec = el('div', 'section profile-about');
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const mine = !!me && String(me) === String(s.userId) && !user.isBanned;
    const body = el('div', 'section-content remove-panel');
    const head = header(lt('About'), socialLinks(s.data.socials));
    if (mine) {
      const edit = el('button', 'btn-generic-edit-sm routility-about-edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', lt('Edit About'));
      edit.appendChild(el('span', 'icon-edit'));
      edit.addEventListener('click', () => aboutEditor(s, body, edit));
      const h3 = head.querySelector('h3');
      h3.classList.add('routility-about-title');
      h3.appendChild(edit);
    }
    sec.appendChild(head);
    aboutContent(body, user.description);
    sec.appendChild(body);
    const footer = el('div', 'section-content remove-panel');
    const bar = el('div', 'border-top profile-about-footer');
    const past = (history || []).map(h => h.name).reverse().filter(n => n && n.toLowerCase() !== user.name.toLowerCase());
    const unique = [...new Set(past)];
    if (unique.length) {
      const names = el('span', 'profile-name-history');
      const icon = el('span', 'routility-pastname-icon');
      icon.appendChild(svg(['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'], 16));
      names.appendChild(icon);
      names.appendChild(el('span', 'text-pastname', lt('Previous usernames')));
      names.tabIndex = 0;
      names.setAttribute('aria-label', lt('Previous usernames: {names}', { names: unique.join(', ') }));
      const show = () => {
        if (names.querySelector('.tooltip')) return;
        const tip = el('div', 'tooltip bottom in routility-pastnames-tip');
        tip.setAttribute('role', 'tooltip');
        const arrow = el('div', 'tooltip-arrow');
        const inner = el('div', 'tooltip-inner');
        unique.forEach((n, i) => {
          if (i) inner.appendChild(document.createTextNode(' '));
          inner.appendChild(el('span', 'routility-pastname', n + (i < unique.length - 1 ? ',' : '')));
        });
        tip.append(arrow, inner);
        names.appendChild(tip);
        arrow.style.borderBottomColor = getComputedStyle(inner).backgroundColor;
        const iconBox = icon.getBoundingClientRect();
        const hostBox = names.getBoundingClientRect();
        const center = iconBox.left + iconBox.width / 2 - hostBox.left;
        tip.style.left = Math.round(center - tip.offsetWidth / 2) + 'px';
        arrow.style.left = Math.round(tip.offsetWidth / 2 - 5) + 'px';
      };
      let pinned = false;
      const hide = () => names.querySelector('.tooltip')?.remove();
      names.addEventListener('mouseenter', show);
      names.addEventListener('mouseleave', () => { if (!pinned) hide(); });
      names.addEventListener('focus', show);
      names.addEventListener('blur', () => { pinned = false; hide(); });
      names.addEventListener('click', () => {
        pinned = !pinned;
        if (pinned) show();
        else hide();
      });
      bar.appendChild(names);
    } else {
      bar.appendChild(el('span'));
    }
    if (String(me) !== String(s.userId) && !user.isBanned) {
      const report = el('a', 'abuse-report-link');
      report.href = '#';
      report.setAttribute('role', 'button');
      report.appendChild(el('span', 'text-error', lt('Report Abuse')));
      report.addEventListener('click', (e) => { e.preventDefault(); runMenuItem('Report abuse'); });
      bar.appendChild(report);
    }
    footer.appendChild(bar);
    sec.appendChild(footer);
    return sec;
  }

  const SOCIALS = [['facebook', 'Facebook'], ['twitter', 'Twitter'], ['youtube', 'Youtube'], ['twitch', 'Twitch'], ['guilded', 'Guilded']];

  function socialLinks(socials) {
    const found = SOCIALS.filter(([key]) => socials && /^https:\/\//.test(socials[key] || ''));
    if (!found.length) return null;
    const ul = el('ul', 'profile-social-networks');
    for (const [key, cls] of found) {
      const li = el('li');
      const a = el('a', 'profile-social ' + cls);
      a.href = socials[key];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.rtTip = cls === 'Twitter' ? 'X' : cls === 'Youtube' ? 'YouTube' : cls;
      li.appendChild(a);
      ul.appendChild(li);
    }
    return ul;
  }

  function linkify(text) {
    const span = el('span', 'profile-about-content-text linkify');
    const re = /https?:\/\/(?:[a-z0-9-]+\.)?roblox\.com(?:\/[^\s<>"']*)?/gi;
    let last = 0;
    for (const m of text.matchAll(re)) {
      span.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = el('a', 'text-link', m[0]);
      a.href = m[0];
      span.appendChild(a);
      last = m.index + m[0].length;
    }
    span.appendChild(document.createTextNode(text.slice(last)));
    return span;
  }

  function viewButton(kind, active, onClick) {
    const b = el('button', 'profile-view-selector ' + (active ? 'btn-secondary-xs' : 'btn-control-xs') + ' btn-generic-' + kind + '-xs');
    b.type = 'button';
    b.dataset.rtTip = kind === 'grid' ? lt('Grid View') : lt('Slideshow View');
    b.appendChild(el('span', 'icon-' + kind + (active ? ' selected' : '')));
    b.addEventListener('click', onClick);
    return b;
  }

  function switcher(kind, items) {
    const sw = el('div', 'switcher slide-switcher ' + kind);
    const ul = el('ul', 'slide-items-container switcher-items hlist');
    items.forEach((it, i) => {
      const li = el('li', 'switcher-item slide-item-container' + (i === 0 ? ' active' : ''));
      const left = el('div', 'layer slide-item-container-left');
      const emblem = el('div', 'slide-item-emblem-container');
      const a = link(it.href, null);
      a.appendChild(image(null, 'slide-item-image', it.thumb));
      emblem.appendChild(a);
      left.appendChild(emblem);
      const right = el('div', 'section-content slide-item-container-right');
      const info = el('div', 'slide-item-info');
      const h2 = el('h2', 'text-overflow slide-item-name');
      h2.appendChild(link(it.href, 'text-name', it.name));
      info.appendChild(h2);
      info.appendChild(el('p', 'text-description para-overflow slide-item-description', it.description || ''));
      right.appendChild(info);
      const stats = el('div', 'slide-item-stats');
      const list = el('ul', 'hlist');
      for (const [label, value] of it.stats) {
        const stat = el('li', 'list-item');
        stat.appendChild(el('div', 'text-label slide-item-stat-title', label));
        stat.appendChild(el('div', 'text-lead text-overflow slide-item-members-count', value));
        list.appendChild(stat);
      }
      stats.appendChild(list);
      right.appendChild(stats);
      li.append(left, right);
      ul.appendChild(li);
    });
    sw.appendChild(ul);
    if (items.length > 1) {
      let index = 0;
      const go = (d) => {
        const slides = ul.children;
        slides[index].classList.remove('active');
        index = (index + d + slides.length) % slides.length;
        slides[index].classList.add('active');
      };
      for (const [side, d] of [['left', -1], ['right', 1]]) {
        const c = el('a', 'carousel-control ' + side);
        c.setAttribute('role', 'button');
        c.setAttribute('aria-label', d < 0 ? lt('Previous') : lt('Next'));
        c.appendChild(el('span', 'icon-carousel-' + side));
        c.addEventListener('click', () => go(d));
        sw.appendChild(c);
      }
    }
    return sw;
  }

  function showcase(s, { key, title, kind, items, gridItem, extraClass }) {
    const sec = el('div', 'section routility-classic-showcase ' + extraClass);
    const buttons = el('div', 'container-buttons');
    const body = el('div', 'profile-slide-container section-content remove-panel');
    const grid = el('ul', 'hlist game-cards group-list');
    const more = el('button', 'btn btn-control-xs load-more-button routility-load-more', lt('Load More'));
    more.type = 'button';
    let shown = 0;
    let pages = null;
    const showMore = () => {
      for (const it of items.slice(shown, s.columns ? items.length : shown + GRID_PAGE)) grid.appendChild(gridItem(it));
      shown = s.columns ? items.length : Math.min(items.length, shown + GRID_PAGE);
      if (s.columns && !pages) grid.after(pages = window.RoUtilityUI.pager(grid, 2));
      more.hidden = grid.hidden || shown >= items.length;
      applyThumbs(s, grid);
    };
    more.addEventListener('click', showMore);
    const sw = switcher(kind, items);
    body.append(sw, grid, more);
    const setView = (view) => {
      const isGrid = s.columns || view === 'grid';
      grid.hidden = !isGrid;
      sw.hidden = isGrid;
      if (isGrid && !shown) showMore();
      more.hidden = !isGrid || shown >= items.length;
      if (pages) pages.hidden = !isGrid;
      buttons.textContent = '';
      if (!s.columns) buttons.append(viewButton('slideshow', !isGrid, () => pick('slideshow')), viewButton('grid', isGrid, () => pick('grid')));
    };
    const pick = (view) => {
      setView(view);
      chrome.storage.local.get('routilityClassicViews', (st) => chrome.storage.local.set({ routilityClassicViews: { ...(st.routilityClassicViews || {}), [key]: view } }));
    };
    setView('slideshow');
    chrome.storage.local.get('routilityClassicViews', (st) => { const v = (st.routilityClassicViews || {})[key]; if (v) setView(v); });
    sec.appendChild(header(title, buttons));
    sec.appendChild(body);
    if (!items.length) sec.hidden = true;
    return sec;
  }

  function groupTile(g) {
    const li = el('li', 'list-item game-card game-tile routility-classic-game');
    const container = el('div', 'game-card-container');
    const a = link(g.href, 'game-card-link');
    const box = el('div', 'game-card-thumb-container');
    box.appendChild(image(null, 'game-card-thumb', g.thumb));
    if (g.owner) box.appendChild(el('span', 'routility-classic-owner text-label-small', lt('Owner')));
    a.appendChild(box);
    const name = el('div', 'game-card-name game-name-title routility-classic-group-name');
    name.appendChild(el('span', 'text-overflow', g.name));
    if (g.verified) name.appendChild(window.RoUtilityUI.verifiedBadge());
    a.appendChild(name);
    const info = el('div', 'game-card-info routility-classic-group-info');
    info.appendChild(el('span', 'info-label', lt('{count} Members', { count: g.stats[0][1] })));
    if (g.stats[1][1]) info.appendChild(el('span', 'info-label routility-classic-group-rank', g.stats[1][1]));
    a.appendChild(info);
    container.appendChild(a);
    li.appendChild(container);
    return li;
  }

  function buildGroups(s) {
    const items = s.data.groups.map(({ group, role, isPrimaryGroup }) => ({
      thumb: 'group:' + group.id,
      name: group.name,
      href: `/communities/${group.id}`,
      description: group.description || '',
      stats: [[lt('Members'), formatNumber(group.memberCount || 0)], [lt('Rank'), role?.name || '']],
      owner: Number(group.owner?.userId) === Number(s.userId),
      verified: !!group.hasVerifiedBadge,
      primary: !!isPrimaryGroup,
    })).sort((a, b) => (b.primary - a.primary) || (b.owner - a.owner));
    return showcase(s, { key: 'groups', title: lt('Groups'), kind: 'groups', items, gridItem: groupTile, extraClass: 'routility-classic-groups' });
  }

  function assetTile(item) {
    const li = el('li', 'list-item asset-item routility-classic-badge routility-classic-asset');
    const a = link(item.href, null);
    const box = el('span', 'border asset-thumb-container routility-classic-badge-thumb');
    box.appendChild(image(null, '', item.thumb));
    a.appendChild(box);
    a.appendChild(el('span', 'font-header-2 text-overflow item-name', item.name));
    li.appendChild(a);
    return li;
  }

  function assetSection(title, more, items, extraClass) {
    const sec = el('div', 'section ' + extraClass);
    sec.appendChild(header(title, more));
    const list = el('ul', 'hlist badge-list');
    for (const it of items.slice(0, 6)) list.appendChild(assetTile(it));
    const body = el('div', 'section-content remove-panel');
    body.appendChild(list);
    sec.appendChild(body);
    if (!items.length) sec.hidden = true;
    return sec;
  }

  function applyThumbs(s, scope) {
    for (const img of (scope || s.root).querySelectorAll('img[data-thumb]')) {
      setThumb(img, s.thumbs.get(img.dataset.thumb));
    }
  }

  function buildWearing(s) {
    const sec = el('div', 'section profile-avatar routility-classic-wearing');
    sec.appendChild(header(lt('Currently Wearing')));
    const row = el('div', 'routility-classic-wearing-row');
    const left = el('div', 'layer profile-avatar-left');
    left.appendChild(el('span', 'thumbnail-2d-container routility-classic-avatar'));
    const holder = el('div', 'thumbnail-holder routility-classic-3d');
    holder.hidden = true;
    holder.appendChild(el('div', 'avatar-thumbnail-container routility-3d-host'));
    left.appendChild(holder);
    const toggle = el('button', 'btn-control-sm routility-classic-3d-toggle', '3D');
    toggle.type = 'button';
    const set3d = (on) => {
      const host = holder.firstChild;
      holder.hidden = !on;
      left.querySelector('.routility-classic-avatar').hidden = on;
      toggle.textContent = on ? '2D' : '3D';
      if (on) host.setAttribute('data-routility-3d', String(s.userId));
      else host.removeAttribute('data-routility-3d');
      try { localStorage.setItem('routilityProfile3d', on ? '1' : '0'); } catch {}
    };
    toggle.addEventListener('click', () => set3d(holder.hidden));
    if (!s.terminated) left.appendChild(toggle);
    let start = false;
    try { start = !s.terminated && localStorage.getItem('routilityProfile3d') === '1'; } catch {}
    if (start) setTimeout(() => set3d(true), 0);
    const right = el('div', 'section-content profile-avatar-right');
    right.appendChild(el('ul', 'routility-classic-accoutrements'));
    right.appendChild(el('div', 'routility-classic-pages'));
    row.append(left, right);
    sec.appendChild(row);
    return sec;
  }

  function renderWearPage(s, page) {
    const list = s.root.querySelector('.routility-classic-accoutrements');
    const pages = s.root.querySelector('.routility-classic-pages');
    if (!list) return;
    const ids = s.data.wearing;
    const count = Math.max(1, Math.ceil(ids.length / WEAR_PAGE));
    s.wearPage = Math.min(page, count - 1);
    list.textContent = '';
    if (!ids.length) list.appendChild(el('li', 'text-secondary routility-classic-wear-empty', s.data.wearingFailed ? (s.recovering ? lt('Roblox is limiting requests right now. Trying again.') : lt('Couldn’t load what’s being worn.')) : lt('Nothing equipped.')));
    for (const id of ids.slice(s.wearPage * WEAR_PAGE, s.wearPage * WEAR_PAGE + WEAR_PAGE)) {
      const li = el('li', 'accoutrement-item routility-classic-accoutrement');
      const a = link(`/catalog/${id}`, 'routility-classic-thumb');
      a.appendChild(image(s.thumbs.get('asset:' + id), ''));
      const meta = s.assetInfo && s.assetInfo.get(id);
      if (meta) {
        a.dataset.rtTip = meta.name;
        if (meta.limited || meta.unique) {
          const label = el('div', 'asset-restriction-icon');
          label.appendChild(el('span', 'restriction-icon ' + (meta.unique ? 'icon-limited-unique-label' : 'icon-limited-label')));
          a.appendChild(label);
        }
      }
      li.appendChild(a);
      list.appendChild(li);
    }
    pages.textContent = '';
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const dot = el('button', 'profile-accoutrements-page routility-classic-dot' + (i === s.wearPage ? ' page-active active' : ''));
        dot.type = 'button';
        dot.setAttribute('aria-label', lt('Page {n}', { n: i + 1 }));
        dot.addEventListener('click', () => renderWearPage(s, i));
        pages.appendChild(dot);
      }
    }
  }

  function buildFriends(s) {
    const { counts, friends } = s.data;
    const sec = el('div', 'section home-friends routility-classic-friends');
    sec.appendChild(header(lt('Friends ({count})', { count: formatNumber(counts.friends || 0) }), s.data.friendsHidden ? null : seeAll(`/users/${s.userId}/friends#!/friends`, lt('See All'))));
    const body = el('div', 'section-content remove-panel people-list');
    const list = el('ul', 'hlist routility-classic-people');
    for (const f of friends) list.appendChild(friendTile(s, f));
    for (let i = 0; i < (s.data.friendsHidden ? 0 : s.data.hiddenSlots); i++) list.appendChild(friendSkeleton());
    body.appendChild(list);
    sec.appendChild(body);
    if (s.data.friendsHidden) {
      body.classList.add('routility-friends-hidden');
      sec.querySelector('.container-header h3')?.after(window.RoUtilityUI.hiddenNote());
      body.appendChild(hiddenFriends(s, list));
    } else if (!friends.length && !s.data.hiddenSlots) sec.hidden = true;
    return sec;
  }

  function friendSkeleton() {
    const li = el('li', 'list-item friend routility-friend-skeleton');
    const box = el('div', 'avatar-container');
    box.appendChild(el('span', 'routility-sk routility-sk-circle routility-sk-friend'));
    box.appendChild(el('span', 'routility-sk-text'));
    li.appendChild(box);
    return li;
  }

  async function fillHiddenFriends(s) {
    if (!s.data.hiddenSlots || s.data.friendsHidden) return;
    const clear = () => {
      s.root.querySelectorAll('.routility-classic-people .routility-friend-skeleton').forEach(n => n.remove());
      const sec = s.root.querySelector('.routility-classic-friends');
      if (sec && !sec.querySelector('.routility-classic-people .friend')) sec.hidden = true;
    };
    const st = await new Promise(r => chrome.storage.local.get('routilitySettings', r));
    if (state !== s) return;
    if ((st.routilitySettings || {}).hiddenFriends === false) return clear();
    const data = await window.RoUtilityFriends.missing(s.userId);
    if (state !== s) return;
    clear();
    if (!data || !data.friends.length) return;
    const extra = data.friends.slice(0, s.data.hiddenSlots);
    for (const f of extra) s.thumbs.set('head:' + f.id, data.thumbs.get(f.id));
    s.data.friends = s.data.friends.concat(extra);
    const list = s.root.querySelector('.routility-classic-people');
    if (list) {
      list.closest('.routility-classic-friends').hidden = false;
      for (const f of extra) {
        const li = friendTile(s, f);
        li.classList.add('routility-reveal');
        const box = li.querySelector('.avatar-container');
        box.appendChild(window.RoUtilityFriends.hiddenBadge());
        list.appendChild(li);
        statusIcon(box, data.live.get(f.id), 'friend-status');
      }
    }
    const row = s.root.querySelector('.routility-modern-friend-row');
    if (row) {
      for (const f of extra) {
        const tile = mFriendTile(f);
        tile.querySelector('.routility-modern-friend-avatar')?.appendChild(window.RoUtilityFriends.hiddenBadge());
        row.appendChild(tile);
      }
    }
  }

  function friendTile(s, f) {
    const li = el('li', 'list-item friend');
    const box = el('div', 'avatar-container');
    const a = link(`/users/${f.id}/profile`, 'text-link friend-link');
    const avatar = el('div', 'routility-classic-friend-avatar');
    avatar.appendChild(image(s.thumbs.get('head:' + f.id), ''));
    a.appendChild(avatar);
    const row = el('span', 'routility-friend-name-row');
    const name = el('span', 'text-overflow friend-name font-caption-header', f.displayName || f.name);
    if (!f.name) name.classList.add('routility-sk-text');
    row.appendChild(name);
    if (f.hasVerifiedBadge) row.appendChild(window.RoUtilityUI.verifiedBadge());
    a.appendChild(row);
    box.appendChild(a);
    li.appendChild(box);
    return li;
  }

  function hiddenFriends(s, list) {
    const wrap = el('div', 'routility-hidden-friends');
    const note = el('span', 'text-secondary routility-hidden-note', lt('Roblox hides this friends list.'));
    const btn = el('button', 'btn-control-sm routility-show-friends', lt('Show friends (via RoUtility)'));
    btn.type = 'button';
    const run = async () => {
      wrap.hidden = true;
      list.textContent = '';
      const n = Math.min(9, s.data.counts.friends || 9);
      for (let i = 0; i < n; i++) {
        const li = el('li', 'list-item friend routility-friend-skeleton');
        const box = el('div', 'avatar-container');
        box.appendChild(el('span', 'routility-sk routility-sk-circle routility-sk-friend'));
        box.appendChild(el('span', 'routility-sk-text'));
        li.appendChild(box);
        list.appendChild(li);
      }
      list.closest('.people-list')?.classList.remove('routility-friends-hidden');
      const all = await window.RoUtilityFriends.load(s.userId);
      if (state !== s) return;
      let friends = (all || []).slice(0, 9);
      if (!friends.length) {
        list.textContent = '';
        list.closest('.people-list')?.classList.add('routility-friends-hidden');
        btn.hidden = false;
        wrap.hidden = false;
        note.textContent = all ? lt('No friends to show.') : lt('Couldn’t load friends right now. Try again in a minute.');
        return;
      }
      const [thumbs, live] = await Promise.all([
        thumbnails(friends.map(f => ({ requestId: 'head:' + f.id, targetId: f.id, type: 'AvatarHeadShot', size: '150x150' }))),
        presence(friends.map(f => String(f.id))),
      ]);
      if (state !== s) return;
      thumbs.forEach((v, k) => s.thumbs.set(k, v));
      s.data.friends = friends;
      list.textContent = '';
      list.classList.add('routility-reveal');
      for (const f of friends) list.appendChild(friendTile(s, f));
      list.querySelectorAll('.friend').forEach((li, i) => statusIcon(li.querySelector('.avatar-container'), live.get(String(friends[i].id)), 'friend-status'));
      list.closest('.people-list')?.classList.remove('routility-friends-hidden');
      const head = list.closest('.routility-classic-friends')?.querySelector('.container-header');
      if (head && !head.querySelector('.routility-see-all')) head.appendChild(seeAll(`/users/${s.userId}/friends#!/friends`, lt('See All')));
      wrap.remove();
    };
    btn.addEventListener('click', run);
    wrap.append(note, btn);
    chrome.storage.local.get('routilitySettings', (st) => {
      if ((st.routilitySettings || {}).hiddenFriends === false) return;
      run();
    });
    return wrap;
  }

  function itemCard(item, thumb) {
    const li = el('li', 'list-item asset-item collections-item routility-classic-item');
    const a = link(`/catalog/${item.id}`, 'collections-link');
    const box = el('div', 'img-container');
    box.appendChild(image(thumb, 'asset-thumb-container'));
    if (item.limited) {
      const label = el('div', 'asset-restriction-icon');
      label.appendChild(el('span', 'restriction-icon ' + (item.unique ? 'icon-limited-unique-label' : 'icon-limited-label')));
      box.appendChild(label);
    }
    a.appendChild(box);
    a.appendChild(el('span', 'font-header-2 text-overflow item-name', item.name));
    li.appendChild(a);
    return li;
  }

  function buildCollections(s) {
    const sec = el('div', 'section layer profile-collections routility-classic-collections');
    sec.appendChild(header(lt('Collections'), seeAll(`/users/${s.userId}/inventory#!/accessories`, lt('Inventory'))));
    const body = el('div', 'section-content remove-panel');
    const list = el('ul', 'hlist collections-list item-list routility-classic-collection-list');
    for (let i = 0; i < 6; i++) {
      const li = el('li', 'list-item asset-item routility-classic-item routility-classic-item-loading');
      li.appendChild(el('span', 'routility-sk routility-sk-tile140'));
      li.appendChild(el('span', 'routility-sk routility-sk-name140'));
      list.appendChild(li);
    }
    body.appendChild(list);
    sec.appendChild(body);
    return sec;
  }

  function fillCollections(s, items) {
    if (s.modern) {
      const msec = s.root.querySelector('.routility-modern-collections');
      if (!msec) return;
      const row = msec.querySelector('.routility-modern-row');
      row.textContent = '';
      for (const item of items) row.appendChild(mItemTile(`/catalog/${item.id}`, item.name, 'asset:' + item.id, item.limited ? (item.unique ? 'icon-limited-unique-label' : 'icon-limited-label') : ''));
      applyThumbs(s, row);
      msec.hidden = !items.length;
      return;
    }
    const sec = s.root.querySelector('.routility-classic-collections');
    const list = sec?.querySelector('.routility-classic-collection-list');
    if (!list) return;
    list.textContent = '';
    for (const item of items) list.appendChild(itemCard(item, s.thumbs.get('asset:' + item.id)));
    sec.hidden = !items.length;
  }

  function gameCard(g, thumb) {
    const li = el('li', 'list-item game-card game-tile routility-classic-game');
    const container = el('div', 'game-card-container');
    const a = link(`/games/${g.placeId}`, 'game-card-link');
    const box = el('div', 'game-card-thumb-container');
    box.appendChild(image(thumb, 'game-card-thumb'));
    a.appendChild(box);
    a.appendChild(el('div', 'game-card-name game-name-title', g.name));
    const info = el('div', 'game-card-info');
    fillGameInfo(info, g);
    a.appendChild(info);
    container.appendChild(a);
    li.appendChild(container);
    return li;
  }

  function fillGameInfo(info, g) {
    info.textContent = '';
    if (g.rating != null) {
      info.appendChild(el('span', 'info-label icon-votes-gray'));
      info.appendChild(el('span', 'info-label vote-percentage-label', g.rating + '%'));
    }
    if (g.playing != null) {
      info.appendChild(el('span', 'info-label icon-playing-counts-gray'));
      info.appendChild(el('span', 'info-label playing-counts-label', short(g.playing)));
    }
  }

  function buildGames(title, more, games, thumbs, extraClass) {
    const sec = el('div', 'container-list ' + extraClass);
    sec.appendChild(header(title, more));
    const list = el('ul', 'hlist game-cards');
    for (const g of games) list.appendChild(gameCard(g, thumbs.get('game:' + g.universeId)));
    sec.appendChild(list);
    if (!games.length) sec.hidden = true;
    return sec;
  }

  function badgeTile(href, name, src) {
    const li = el('li', 'list-item asset-item routility-classic-badge');
    const a = link(href, null);
    const box = el('span', 'border asset-thumb-container routility-classic-badge-thumb');
    box.appendChild(image(src, ''));
    a.appendChild(box);
    a.appendChild(el('span', 'font-header-2 text-overflow item-name', name));
    li.appendChild(a);
    return li;
  }

  function buildRobloxBadges(s) {
    const sec = el('div', 'section routility-classic-roblox-badges');
    const badges = s.data.robloxBadges;
    const more = el('button', 'btn-fixed-width btn-secondary-xs btn-more see-all-link routility-see-more', lt('See More'));
    more.type = 'button';
    sec.appendChild(header(lt('Roblox Badges'), !s.columns && badges.length > 6 ? more : null));
    const list = el('ul', 'hlist badge-list');
    badges.forEach((b, i) => {
      const li = badgeTile('https://www.roblox.com/info/roblox-badges', b.name, b.imageUrl);
      if (!s.columns && i >= 6) li.hidden = true;
      list.appendChild(li);
    });
    more.addEventListener('click', () => {
      const open = more.textContent === lt('See More');
      [...list.children].forEach((li, i) => { if (i >= 6) li.hidden = !open; });
      more.textContent = open ? lt('See Less') : lt('See More');
    });
    const body = el('div', 'section-content remove-panel');
    body.appendChild(list);
    if (s.columns) body.appendChild(window.RoUtilityUI.pager(list, 2));
    sec.appendChild(body);
    if (!badges.length) sec.hidden = true;
    return sec;
  }

  function buildBadges(s) {
    const sec = el('div', 'section routility-classic-badges');
    sec.appendChild(header(lt('Badges'), seeAll(`/users/${s.userId}/inventory#!/badges`, lt('See All'))));
    const list = el('ul', 'hlist badge-list');
    for (const b of s.columns ? s.data.badges : s.data.badges.slice(0, 6)) list.appendChild(badgeTile(`/badges/${b.id}`, b.displayName || b.name, s.thumbs.get('badge:' + b.id)));
    const body = el('div', 'section-content remove-panel');
    body.appendChild(list);
    if (s.columns) body.appendChild(window.RoUtilityUI.pager(list, 2));
    sec.appendChild(body);
    if (!s.data.badges.length) sec.hidden = true;
    return sec;
  }

  function buildStats(s) {
    const sec = el('div', 'section profile-statistics');
    sec.appendChild(header(lt('Statistics')));
    const body = el('div', 'section-content');
    const list = el('ul', 'profile-stats-container');
    const stat = (label, value) => {
      const li = el('li', 'profile-stat');
      li.appendChild(el('p', 'text-label', label));
      li.appendChild(el('p', 'text-lead', value));
      return li;
    };
    list.appendChild(stat(lt('Join Date'), joinDate(s.data.user.created)));
    list.appendChild(stat(lt('Place Visits'), formatNumber(s.data.visits)));
    if (s.data.forumPosts != null) list.appendChild(stat(lt('Forum Posts'), formatNumber(s.data.forumPosts)));
    body.appendChild(list);
    sec.appendChild(body);
    return sec;
  }

  function buildTabs(s) {
    const wrap = el('div', 'rbx-tabs-horizontal');
    const nav = el('ul', 'nav nav-tabs');
    const content = el('div', 'tab-content rbx-tab-content');
    const panes = {};
    for (const [key, label] of [['about', LT('About')], ['creations', LT('Creations')]]) {
      const li = el('li', 'rbx-tab' + (key === 'about' ? ' active' : ''));
      const a = el('a', 'rbx-tab-heading');
      a.href = '#';
      a.appendChild(el('span', 'text-lead', lt(label)));
      a.addEventListener('click', (e) => {
        e.preventDefault();
        nav.querySelectorAll('.rbx-tab').forEach(t => t.classList.toggle('active', t === li));
        Object.entries(panes).forEach(([k, p]) => p.classList.toggle('active', k === key));
        if (key === 'creations') loadCreations(s);
      });
      li.appendChild(a);
      nav.appendChild(li);
      const pane = el('div', 'tab-pane' + (key === 'about' ? ' active' : ''));
      panes[key] = pane;
      content.appendChild(pane);
    }
    wrap.append(nav, content);
    return { wrap, panes };
  }

  function buildTabbed(s, root) {
    const data = s.data;
    const tabs = buildTabs(s);
    s.panes = tabs.panes;
    const about = tabs.panes.about;
    about.appendChild(buildAbout(s));
    about.appendChild(buildWearing(s));
    about.appendChild(buildFriends(s));
    if (!data.user.isBanned) about.appendChild(buildCollections(s));
    about.appendChild(buildGroups(s));
    about.appendChild(buildGames(lt('Favorites'), seeAll(`/users/${s.userId}/favorites`, lt('Favorites')), data.favorites, s.thumbs, 'favorite-games-container routility-classic-favorites'));
    about.appendChild(buildRobloxBadges(s));
    about.appendChild(buildBadges(s));
    about.appendChild(buildStats(s));
    root.appendChild(tabs.wrap);
  }

  function noDescription(s, body) {
    if (!s.data.user.description) body.appendChild(el('p', 'text-secondary routility-columns-nodesc', lt('This user has no description')));
  }

  function buildColumnsAbout(s) {
    const sec = buildAbout(s);
    sec.classList.add('routility-classic-wearing');
    const [body, footer] = sec.querySelectorAll(':scope > .section-content');
    const panel = el('div', 'section-content routility-columns-about');
    panel.appendChild(el('div', 'routility-columns-presence'));
    const row = buildWearing(s).querySelector('.routility-classic-wearing-row');
    const items = el('button', 'btn-control-sm routility-classic-items-toggle', lt('Show Items'));
    items.type = 'button';
    items.addEventListener('click', () => {
      const on = row.classList.toggle('routility-show-items');
      items.textContent = on ? lt('Show Avatar') : lt('Show Items');
    });
    row.appendChild(items);
    panel.appendChild(row);
    body.classList.remove('remove-panel');
    body.classList.add('routility-columns-desc');
    noDescription(s, body);
    panel.appendChild(body);
    panel.appendChild(buildStats(s).querySelector('.profile-stats-container'));
    panel.appendChild(footer.firstChild);
    footer.remove();
    sec.appendChild(panel);
    return sec;
  }

  function realGame(p) {
    const loc = p && String(p.lastLocation || '').trim();
    return loc && !/^(studio|website|online|offline)$/i.test(loc) ? loc : '';
  }

  function presenceLine(line, p) {
    line.textContent = '';
    const type = p ? p.userPresenceType : null;
    if (type == null) return;
    if (type === 2 && p.lastLocation) {
      const place = p.rootPlaceId || p.placeId;
      const a = el(place ? 'a' : 'span', 'routility-columns-presence-game', `[ ${p.lastLocation} ]`);
      if (place) a.href = `/games/${place}`;
      line.appendChild(a);
      return;
    }
    if (type === 3 && realGame(p)) {
      line.appendChild(el('span', 'routility-columns-presence-3', `[ ${lt('Editing {game}', { game: realGame(p) })} ]`));
      return;
    }
    const label = { 0: LT('Offline'), 1: LT('Online'), 2: LT('Playing'), 3: LT('In Studio') }[type];
    if (label) line.appendChild(el('span', `routility-columns-presence-${type}`, `[ ${lt(label)} ]`));
  }

  function buildColumns(s, root) {
    const data = s.data;
    root.classList.add('routility-classic-columns');
    const grid = el('div', 'routility-columns');
    const left = el('div', 'routility-column routility-column-left');
    const right = el('div', 'routility-column routility-column-right');
    s.panes = { creations: el('div', 'routility-column-creations') };
    left.append(buildRobloxBadges(s), buildBadges(s), buildGroups(s));
    const favorites = buildGames(lt('Favorites'), seeAll(`/users/${s.userId}/favorites`, lt('Favorites')), data.favorites, s.thumbs, 'section favorite-games-container routility-classic-favorites');
    const cards = favorites.querySelector('.game-cards');
    const panel = el('div', 'section-content');
    cards.replaceWith(panel);
    panel.appendChild(cards);
    panel.appendChild(window.RoUtilityUI.pager(cards, 2));
    if (!data.favorites.length) {
      favorites.hidden = false;
      favorites.classList.add('routility-classic-favorites-empty');
      panel.replaceChildren(el('p', 'text-secondary routility-classic-empty', lt('No favorites yet.')));
    }
    right.append(buildFriends(s), favorites);
    grid.append(buildColumnsAbout(s), s.panes.creations, left, right);
    root.appendChild(grid);
    if (!data.user.isBanned) root.appendChild(buildCollections(s));
    loadCreations(s);
  }

  async function gameDetails(list) {
    const ids = list.map(g => g.universeId);
    if (!ids.length) return list;
    const [votes, games] = await Promise.all([
      json(`https://games.roblox.com/v1/games/votes?universeIds=${ids.join(',')}`),
      json(`https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`),
    ]);
    const v = new Map(((votes && votes.data) || []).map(x => [x.id, x]));
    const g = new Map(((games && games.data) || []).map(x => [x.id, x]));
    return list.map(item => {
      const vote = v.get(item.universeId);
      const total = vote ? vote.upVotes + vote.downVotes : 0;
      return { ...item, rating: total ? Math.round(vote.upVotes / total * 100) : null, playing: g.get(item.universeId)?.playing ?? null };
    });
  }

  async function creatorModels(userId) {
    const found = await json(`https://apis.roblox.com/toolbox-service/v1/marketplace/10?creatorTargetId=${userId}&creatorType=1&limit=6`);
    const ids = ((found && found.data) || []).map(d => d.id).slice(0, 6);
    if (!ids.length) return [];
    const details = await json(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${ids.join(',')}`);
    return ((details && details.data) || []).filter(d => d.asset).map(d => ({ id: d.asset.id, name: d.asset.name, href: `https://create.roblox.com/store/asset/${d.asset.id}`, thumb: 'asset:' + d.asset.id }));
  }

  async function creatorItems(userId) {
    const res = await json(`https://catalog.roblox.com/v2/search/items/details?CreatorTargetId=${userId}&CreatorType=User&Limit=10&SortType=3`);
    return ((res && res.data) || []).filter(d => d.itemType === 'Asset').slice(0, 6).map(d => ({ id: d.id, name: d.name, href: `/catalog/${d.id}`, thumb: 'asset:' + d.id }));
  }

  async function loadCreations(s) {
    if (s.creationsLoaded) return;
    s.creationsLoaded = true;
    const pane = s.panes.creations;
    pane.appendChild(el('span', 'spinner spinner-default routility-classic-spinner'));
    const base = (s.data.games || []).map(x => ({ universeId: x.id, placeId: x.rootPlace?.id, name: x.name, description: x.description || '', visits: Number(x.placeVisits) || 0 }));
    const [games, models, items] = await Promise.all([gameDetails(base), s.columns ? [] : creatorModels(s.userId), s.columns ? [] : creatorItems(s.userId)]);
    const reqs = [];
    for (const g of games) {
      reqs.push({ requestId: 'gameicon:' + g.universeId, targetId: g.universeId, type: 'GameIcon', size: '512x512' });
      reqs.push({ requestId: 'game:' + g.universeId, targetId: g.universeId, type: 'GameIcon', size: '256x256' });
    }
    for (const m of [...models, ...items]) reqs.push({ requestId: m.thumb, targetId: m.id, type: 'Asset', size: '420x420' });
    const t = await thumbnails(reqs);
    if (state !== s) return;
    t.forEach((v, k) => s.thumbs.set(k, v));
    pane.textContent = '';
    const slides = games.map(g => ({
      thumb: 'gameicon:' + g.universeId,
      name: g.name,
      href: `/games/${g.placeId}`,
      description: g.description,
      stats: [[lt('Active'), g.playing == null ? '' : short(g.playing)], [lt('Visits'), short(g.visits)]],
      game: g,
    }));
    pane.appendChild(showcase(s, { key: 'games', title: lt('Experiences'), kind: 'games', items: slides, gridItem: it => gameCard(it.game, s.thumbs.get('game:' + it.game.universeId)), extraClass: 'profile-game routility-classic-creations' }));
    if (!s.columns) {
      pane.appendChild(assetSection(lt('Models'), seeAll(`https://create.roblox.com/store/models?keyword=${encodeURIComponent(s.data.user.name)}`, lt('See All')), models, 'routility-classic-models'));
      pane.appendChild(assetSection(lt('Clothing'), seeAll(`/catalog?CreatorName=${encodeURIComponent(s.data.user.name)}&CreatorType=User`, lt('See All')), items, 'routility-classic-clothing'));
    }
    if (s.columns && !games.length) {
      const empty = el('div', 'section routility-classic-creations-empty');
      const box = el('div', 'section-content');
      box.appendChild(el('p', 'text-secondary routility-classic-empty', lt('No experiences yet.')));
      empty.append(header(lt('Experiences')), box);
      pane.appendChild(empty);
    }
    if (s.columns) s.root.querySelector('.routility-columns')?.classList.add('routility-columns-games');
    else if (!games.length && !models.length && !items.length) pane.appendChild(el('p', 'section-content-off routility-classic-empty', lt('No creations yet.')));
    applyThumbs(s, pane);
  }

  async function forumPosts(userId) {
    const st = await new Promise(r => chrome.storage.local.get('routilitySettings', r));
    if ((st.routilitySettings || {}).forum === false) return null;
    const res = await Promise.race([window.RoUtilityUI.request({ type: 'forumApi', path: `/users/${userId}` }, r => r && 'status' in r), new Promise(r => setTimeout(r, 2500))]);
    const posts = res && res.status === 200 && res.data ? Number(res.data.posts) : NaN;
    return Number.isSafeInteger(posts) && posts >= 0 ? posts : null;
  }

  const PROFILE_CACHE = 'routilityProfileCache';
  const FRIENDS_AT = 'routilityFriendsAt';

  function cachedData(key, since) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(PROFILE_CACHE) || '{}')[key];
      return hit && Date.now() - hit.at < 120000 && hit.at > since ? hit.data : null;
    } catch {
      return null;
    }
  }

  function keepData(key, data) {
    try {
      const all = JSON.parse(sessionStorage.getItem(PROFILE_CACHE) || '{}');
      all[key] = { at: Date.now(), data };
      const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
      for (const k of keys.slice(3)) delete all[k];
      sessionStorage.setItem(PROFILE_CACHE, JSON.stringify(all));
    } catch {}
  }

  async function profileData(userId, columns) {
    const key = userId + (columns ? ':columns' : '');
    const changed = await new Promise(r => chrome.storage.local.get(FRIENDS_AT, st => r(((st && st[FRIENDS_AT]) || {}).at || 0)));
    const hit = cachedData(key, changed);
    if (hit) return hit;
    const data = await loadData(userId, columns);
    if (data) keepData(key, data);
    return data;
  }

  async function loadData(userId, columns) {
    const base = 'https://';
    const [forum, user, history, friendsCount, followers, followings, premium, wearing, robloxBadges, badges, favs, games, find, groups, socials] = await Promise.all([
      forumPosts(userId).catch(() => null),
      json(`${base}users.roblox.com/v1/users/${userId}`),
      quick(`${base}users.roblox.com/v1/users/${userId}/username-history?limit=50&sortOrder=Desc`),
      quick(`${base}friends.roblox.com/v1/users/${userId}/friends/count`),
      quick(`${base}friends.roblox.com/v1/users/${userId}/followers/count`),
      quick(`${base}friends.roblox.com/v1/users/${userId}/followings/count`),
      quick(`${base}premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`),
      quick(`${base}avatar.roblox.com/v1/users/${userId}/currently-wearing`),
      quick(`${base}accountinformation.roblox.com/v1/users/${userId}/roblox-badges`),
      quick(`${base}badges.roblox.com/v1/users/${userId}/badges?limit=${columns ? 50 : 10}&sortOrder=Desc`),
      quick(`${base}games.roblox.com/v2/users/${userId}/favorite/games?limit=${columns ? 50 : 10}&sortOrder=Desc`),
      quick(`${base}games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`),
      jsonStatus(`${base}friends.roblox.com/v1/users/${userId}/friends/find?limit=9`, 3),
      quick(`${base}groups.roblox.com/v1/users/${userId}/groups/roles?includeLocked=true`),
      quick(`${base}accountinformation.roblox.com/v1/users/${userId}/promotion-channels?alwaysReturnUrls=true`),
    ]);
    if (!user || !user.name) return null;
    const friendIds = ((find.body && find.body.PageItems) || []).map(f => Number(f.id)).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 9);
    const friendsHidden = find.status === 403 && (friendsCount?.count || 0) > 0;
    const hiddenSlots = Math.max(0, Math.min(9 - friendIds.length, ((find.body && find.body.PageItems) || []).filter(f => !(Number(f.id) > 0)).length));
    const favorites = ((favs && favs.data) || []).slice(0, columns ? 50 : 6).map(x => ({ universeId: x.id, placeId: x.rootPlace?.id, name: x.name }));
    return {
      user,
      history: (history && history.data) || [],
      premium: premium === true,
      counts: { friends: friendsCount?.count ?? null, followers: followers?.count ?? null, followings: followings?.count ?? null },
      wearing: (wearing && wearing.assetIds) || [],
      wearingFailed: !wearing,
      robloxBadges: Array.isArray(robloxBadges) ? robloxBadges : [],
      badges: (badges && badges.data) || [],
      favorites,
      games: (games && games.data) || [],
      visits: ((games && games.data) || []).reduce((sum, g) => sum + (Number(g.placeVisits) || 0), 0),
      friends: friendIds.map(id => ({ id, name: '', displayName: '' })),
      friendsHidden,
      hiddenSlots,
      groups: ((groups && groups.data) || []).filter(g => g.group).sort((a, b) => (!!b.isPrimaryGroup - !!a.isPrimaryGroup) || ((Number(b.group.owner?.userId) === Number(userId)) - (Number(a.group.owner?.userId) === Number(userId)))).slice(0, 100),
      socials: socials || {},
      forumPosts: forum,
    };
  }

  async function linkTerminatedFriends(s) {
    if (!s.reveal) return;
    const blocked = s.data.friends.filter(f => { const t = s.thumbs.get('head:' + f.id); return t === 'blocked' || /UnapprovedImage/.test(t || ''); });
    for (const f of blocked) {
      const u = await json(`https://users.roblox.com/v1/users/${f.id}`);
      if (state !== s || !u || !u.isBanned) continue;
      s.root.querySelectorAll(`a[href="/users/${f.id}/profile"]`).forEach((a) => { a.href = terminatedHref(f.id); });
    }
  }

  async function fillLater(s) {
    const ids = s.data.friends.map(f => f.id);
    const [named, favorites, profiles] = await Promise.all([
      ids.length ? post('https://users.roblox.com/v1/users', { userIds: ids, excludeBannedUsers: false }) : null,
      gameDetails(s.data.favorites),
      ids.length ? post('https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles', { userIds: ids, fields: ['names.combinedName'] }) : null,
    ]);
    if (state !== s) return;
    const byId = new Map(((named && named.data) || []).map(u => [u.id, u]));
    const shown = new Map(((profiles && profiles.profileDetails) || []).map(p => [p.userId, p.names && p.names.combinedName]));
    s.data.friends = s.data.friends.map((f) => {
      const u = byId.get(f.id) || f;
      return shown.get(u.id) ? { ...u, displayName: shown.get(u.id) } : u;
    });
    s.root.querySelectorAll('.routility-modern-friend').forEach((tile, i) => {
      const f = s.data.friends[i];
      const name = tile.querySelector('.friends-carousel-display-name');
      if (!f || !name) return;
      name.textContent = f.displayName || f.name || '';
      name.classList.remove('routility-sk-text');
      if (f.hasVerifiedBadge && !name.parentElement.querySelector('.routility-verified')) name.after(window.RoUtilityUI.verifiedBadge());
    });
    s.root.querySelectorAll('.routility-classic-people .friend').forEach((li, i) => {
      const f = s.data.friends[i];
      const name = li.querySelector('.friend-name');
      if (!f || !name) return;
      name.textContent = f.displayName || f.name || '';
      name.classList.remove('routility-sk-text');
      if (f.hasVerifiedBadge && !name.parentElement.querySelector('.routility-verified')) name.after(window.RoUtilityUI.verifiedBadge());
    });
    s.data.favorites = favorites;
    s.root.querySelectorAll('.routility-classic-favorites .game-card-info').forEach((info, i) => { if (favorites[i]) fillGameInfo(info, favorites[i]); });
    linkTerminatedFriends(s);
    const worn = s.data.wearing.slice(0, 40);
    for (const wait of [0, 5000, 15000]) {
      if (wait) await pause(wait);
      if (state !== s) return;
      const info = await wornInfo(worn);
      if (state !== s) return;
      s.assetInfo = info;
      paintWorn(s);
      if (info.size >= worn.length) break;
    }
  }

  function paintWorn(s) {
    if (!s.modern) {
      renderWearPage(s, s.wearPage);
      return;
    }
    s.root.querySelectorAll('.routility-modern-wearing .routility-modern-tile').forEach((tile, i) => {
      const id = s.data.wearing[i];
      const meta = s.assetInfo.get(id);
      const name = tile.querySelector('.item-card-name');
      if (!meta || !name) return;
      name.textContent = meta.name;
      name.classList.remove('routility-sk-text');
      if ((meta.limited || meta.unique) && !tile.querySelector('.restriction-icon')) tile.querySelector('.item-card-thumb-container').appendChild(el('span', 'restriction-icon ' + (meta.unique ? 'icon-limited-unique-label' : 'icon-limited-label')));
    });
  }

  function skeleton(modern, columns) {
    const early = document.querySelector('#content > .routility-classic-loading');
    if (early && early.classList.contains('routility-modern') === modern && early.classList.contains('routility-classic-columns') === columns) return early;
    early?.remove();
    if (modern) return window.RoUtilityModernSkeleton ? window.RoUtilityModernSkeleton() : el('div', 'routility-modern routility-injected routility-classic-loading');
    return window.RoUtilityClassicSkeleton ? window.RoUtilityClassicSkeleton(columns) : el('div', 'routility-classic routility-injected routility-classic-loading');
  }

  function mount(root) {
    const content = document.querySelector('#content');
    if (!content) return false;
    if (root.parentElement !== content) content.prepend(root);
    return true;
  }

  async function topCollectibles(s) {
    const list = await json(`https://apis.roblox.com/showcases-api/v1/users/profile/robloxcollections-json?userId=${s.userId}`);
    if (state !== s) return;
    const res = (Array.isArray(list) ? list : []).filter(i => i && Number.isFinite(i.id)).slice(0, 6).map((i) => {
      const tag = String((i.assetRestrictionIcon && i.assetRestrictionIcon.cssTag) || '');
      return { id: i.id, name: i.name || '', limited: /limited/.test(tag), unique: tag === 'limited-unique', thumb: i.thumbnail && i.thumbnail.final && i.thumbnail.url ? i.thumbnail.url : '' };
    });
    for (const i of res) if (i.thumb) s.thumbs.set('asset:' + i.id, i.thumb);
    if (!res.length) { fillCollections(s, []); return; }
    const missing = res.filter(i => !s.thumbs.has('asset:' + i.id));
    if (missing.length) {
      const t = await thumbnails(missing.map(i => ({ requestId: 'asset:' + i.id, targetId: i.id, type: 'Asset', size: '420x420' })));
      t.forEach((v, k) => s.thumbs.set(k, v));
    }
    if (state !== s) return;
    fillCollections(s, res);
  }

  async function render(s) {
    const data = s.data;
    if (s.modern) {
      const mroot = renderModern(s);
      s.root.replaceWith(mroot);
      s.root = mroot;
      window.RoUtilityUI.mark('classic');
      if (!data.user.isBanned) topCollectibles(s);
      fillLater(s);
      fillHiddenFriends(s);
      return;
    }
    const root = el('div', 'routility-classic routility-injected routility-classic-reveal');
    root.appendChild(buildHeader(s));
    if (s.columns) buildColumns(s, root);
    else buildTabbed(s, root);
    s.root.replaceWith(root);
    s.root = root;
    renderWearPage(s, 0);
    syncActions();
    window.RoUtilityUI.mark('classic');
    if (!data.user.isBanned) topCollectibles(s);
    fillLater(s);
    fillHiddenFriends(s);
    refreshPresence(s);
    s.presenceTimer = setInterval(() => refreshPresence(s), PRESENCE_EVERY);
    s.onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - s.presenceAt > PRESENCE_EVERY) refreshPresence(s); };
    document.addEventListener('visibilitychange', s.onVisible);
  }

  async function setup(userId, opts = {}) {
    if (state && state.userId === userId) return;
    teardown();
    const s = { userId, thumbs: new Map(), wearPage: 0, terminated: !!opts.terminated, modern: !!opts.modern, columns: !opts.modern && opts.layout === 'columns', reveal: opts.reveal !== false, root: skeleton(!!opts.modern, !opts.modern && opts.layout === 'columns') };
    state = s;
    document.documentElement.classList.add(ON_CLASS);
    const placeRoot = () => { if (state === s && !s.root.isConnected) mount(s.root); };
    s.observer = new MutationObserver(onFrame(() => { placeRoot(); syncActions(); }));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, characterData: true });
    placeRoot();
    s.onDoc = (e) => { if (!e.target.closest?.('.routility-classic-more-wrap')) closeMenu(); };
    document.addEventListener('click', s.onDoc);

    let data = null;
    for (let i = 0; i < 2 && !data && state === s; i++) {
      if (i) await pause(1500);
      try {
        data = await Promise.race([profileData(userId, s.columns), new Promise(r => setTimeout(() => r(null), i ? 15000 : 20000))]);
      } catch {
        data = null;
      }
    }
    if (state !== s) return;
    if (!data) {
      teardown();
      return;
    }
    s.data = data;
    const reqs = [{ requestId: 'avatar:' + userId, targetId: userId, type: 'Avatar', size: '420x420' }, { requestId: 'headshot:' + userId, targetId: userId, type: 'AvatarHeadShot', size: '150x150' }];
    for (const id of data.wearing) reqs.push({ requestId: 'asset:' + id, targetId: id, type: 'Asset', size: '420x420' });
    for (const f of data.friends) reqs.push({ requestId: 'head:' + f.id, targetId: f.id, type: 'AvatarHeadShot', size: '150x150' });
    for (const g of data.favorites) reqs.push({ requestId: 'game:' + g.universeId, targetId: g.universeId, type: 'GameIcon', size: '256x256' });
    for (const b of s.columns ? data.badges : data.badges.slice(0, 6)) {
      const img = Number(b.displayIconImageId || b.iconImageId);
      reqs.push(img > 0 ? { requestId: 'badge:' + b.id, targetId: img, type: 'Asset', size: '420x420' } : { requestId: 'badge:' + b.id, targetId: b.id, type: 'BadgeIcon', size: '150x150' });
    }
    for (const g of data.groups) reqs.push({ requestId: 'group:' + g.group.id, targetId: g.group.id, type: 'GroupIcon', size: '420x420' });
    const thumbsReady = Promise.all([thumbnails(reqs), s.terminated ? bannedAvatar(userId) : null]).then(([t, drawn]) => {
      t.forEach((v, k) => s.thumbs.set(k, v));
      if (!drawn) return;
      if (drawn.flat) s.thumbs.set('avatar:' + userId, drawn.flat);
      if (drawn.head) s.thumbs.set('headshot:' + userId, drawn.head);
      else if (drawn.flat) {
        s.thumbs.set('headshot:' + userId, drawn.flat);
        s.renderedHead = true;
      }
    });
    s.recovering = data.wearingFailed || Object.values(data.counts).some(n => n == null);
    render(s);
    await thumbsReady;
    if (state !== s) return;
    fillThumbs(s);
    if (s.recovering) recover(s);
  }

  async function recover(s) {
    const base = 'https://';
    const keys = { friends: 'friends/count', followers: 'followers/count', followings: 'followings/count' };
    for (const wait of [6000, 15000, 40000]) {
      await pause(wait);
      if (state !== s) return;
      const d = s.data;
      const missing = Object.keys(keys).filter(k => d.counts[k] == null);
      const [worn, ...counts] = await Promise.all([
        d.wearingFailed ? json(`${base}avatar.roblox.com/v1/users/${s.userId}/currently-wearing`) : null,
        ...missing.map(k => json(`${base}friends.roblox.com/v1/users/${s.userId}/${keys[k]}`)),
      ]);
      if (state !== s) return;
      missing.forEach((k, i) => { if (counts[i] && counts[i].count != null) d.counts[k] = counts[i].count; });
      paintCounts(s);
      if (worn && Array.isArray(worn.assetIds)) {
        d.wearing = worn.assetIds;
        d.wearingFailed = false;
        const t = await thumbnails(worn.assetIds.map(id => ({ requestId: 'asset:' + id, targetId: id, type: 'Asset', size: '420x420' })));
        if (state !== s) return;
        t.forEach((v, k) => s.thumbs.set(k, v));
        s.assetInfo = await wornInfo(worn.assetIds.slice(0, 40));
        if (state !== s) return;
        if (!s.modern) renderWearPage(s, 0);
      }
      if (!d.wearingFailed && !Object.values(d.counts).some(n => n == null)) break;
    }
    s.recovering = false;
    if (state === s && !s.modern && s.data.wearingFailed) renderWearPage(s, 0);
  }

  function paintCounts(s) {
    const c = s.data.counts;
    for (const [k, hash, label] of [['friends', 'friends', LT('{n} Friends')], ['followers', 'followers', LT('{n} Followers')], ['followings', 'following', LT('{n} Following')]]) {
      if (c[k] == null) continue;
      const href = `/users/${s.userId}/friends#!/${hash}`;
      const a = s.root.querySelector(`a[href="${href}"]`);
      if (s.modern) {
        if (a) continue;
        const box = s.root.querySelector('.routility-modern-counts');
        if (box) box.appendChild(link(href, 'routility-modern-pill', lt(label, { n: compact(c[k]) })));
      } else if (a && !a.textContent.trim()) a.textContent = short(c[k]);
    }
  }

  function fillThumbs(s) {
    const set = (sel, key, cls) => {
      const host = s.root.querySelector(sel);
      const src = s.thumbs.get(key);
      if (!host || !src) return;
      host.textContent = '';
      host.appendChild(image(src, cls || ''));
    };
    const head = s.renderedHead ? 'routility-render-head' : '';
    set('.routility-classic-headshot', 'headshot:' + s.userId, head);
    set('.routility-classic-avatar', 'avatar:' + s.userId);
    if (head) s.root.querySelectorAll(`img[data-thumb="headshot:${s.userId}"]`).forEach(img => img.classList.add(head));
    renderWearPage(s, s.wearPage);
    s.root.querySelectorAll('.routility-classic-people .friend').forEach((li, i) => { const f = s.data.friends[i]; const img = li.querySelector('.routility-classic-friend-avatar img'); if (f && img) setThumb(img, s.thumbs.get('head:' + f.id)); });
    s.root.querySelectorAll('.routility-classic-favorites .game-card-thumb').forEach((img, i) => { const g = s.data.favorites[i]; if (g) setThumb(img, s.thumbs.get('game:' + g.universeId)); });
    s.root.querySelectorAll('.routility-classic-badges .routility-classic-badge-thumb img').forEach((img, i) => { const b = s.data.badges[i]; if (b) setThumb(img, s.thumbs.get('badge:' + b.id)); });
    applyThumbs(s);
  }

  function teardown() {
    if (!state) return;
    state.observer?.disconnect();
    clearInterval(state.presenceTimer);
    document.removeEventListener('visibilitychange', state.onVisible);
    document.removeEventListener('click', state.onDoc);
    state.root?.remove();
    document.querySelectorAll('#content > .routility-classic, #content > .routility-modern').forEach(n => n.remove());
    closeMenu();
    state = null;
    document.documentElement.classList.remove(ON_CLASS, PROXY_CLASS);
  }

  async function refreshFriends(s) {
    if (s.refreshing) return;
    s.refreshing = true;
    s.friendsStale = false;
    try {
      const base = `https://friends.roblox.com/v1/users/${s.userId}/`;
      const [count, find] = await Promise.all([json(base + 'friends/count'), jsonStatus(base + 'friends/find?limit=9', 2)]);
      if (state !== s || !find.body) return;
      const ids = (find.body.PageItems || []).map(f => Number(f.id)).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 9);
      const total = count && count.count != null ? count.count : s.data.counts.friends;
      if (total === s.data.counts.friends && ids.join() === s.data.friends.map(f => f.id).join()) return;
      const known = new Map(s.data.friends.map(f => [f.id, f]));
      const fresh = ids.filter(id => !known.has(id));
      const [thumbs, named, profiles] = await Promise.all([
        fresh.length ? thumbnails(fresh.map(id => ({ requestId: 'head:' + id, targetId: id, type: 'AvatarHeadShot', size: '150x150' }))) : new Map(),
        fresh.length ? post('https://users.roblox.com/v1/users', { userIds: fresh, excludeBannedUsers: false }) : null,
        fresh.length ? post('https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles', { userIds: fresh, fields: ['names.combinedName'] }) : null,
      ]);
      if (state !== s) return;
      thumbs.forEach((v, k) => s.thumbs.set(k, v));
      const byId = new Map(((named && named.data) || []).map(u => [u.id, u]));
      const shown = new Map(((profiles && profiles.profileDetails) || []).map(p => [p.userId, p.names && p.names.combinedName]));
      for (const id of fresh) {
        const u = byId.get(id) || { id, name: '', displayName: '' };
        known.set(id, shown.get(id) ? { ...u, displayName: shown.get(id) } : u);
      }
      s.data.counts.friends = total;
      s.data.friends = ids.map(id => known.get(id));
      s.data.hiddenSlots = 0;
      const href = `/users/${s.userId}/friends#!/friends`;
      const stat = s.root.querySelector(`a.text-name[href="${href}"]`);
      if (stat && total != null) stat.textContent = short(total);
      const pill = s.root.querySelector(`.routility-modern-pill[href="${href}"]`);
      if (pill && total != null) pill.textContent = lt('{n} Friends', { n: compact(total) });
      if (!s.data.friendsHidden) {
        s.root.querySelector('.routility-classic-friends')?.replaceWith(buildFriends(s));
        const row = s.root.querySelector('.routility-modern-friend-row');
        if (row) {
          row.textContent = '';
          for (const f of s.data.friends) row.appendChild(mFriendTile(f));
        }
        const head = s.root.querySelector('.routility-modern-friends .routility-modern-count');
        if (head) head.textContent = `(${formatNumber(total || s.data.friends.length)})`;
      }
      keepData(s.userId + (s.columns ? ':columns' : ''), s.data);
      s.presenceAt = 0;
      refreshPresence(s);
    } finally {
      s.refreshing = false;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[FRIENDS_AT] || !state || !state.data) return;
    if (!((changes[FRIENDS_AT].newValue || {}).ids || []).includes(String(state.userId))) return;
    if (document.hidden) state.friendsStale = true;
    else refreshFriends(state);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state && state.data && state.friendsStale) refreshFriends(state);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings || !state || state.modern) return;
    const layout = (changes.routilitySettings.newValue || {}).classicLayout;
    if ((layout === 'columns') === !!state.columns) return;
    const { userId, terminated, reveal } = state;
    teardown();
    setup(userId, { terminated, reveal, layout });
  });

  window.RoUtilityClassic = { setup, teardown };
})();
