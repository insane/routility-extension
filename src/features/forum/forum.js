(function () {
  'use strict';

  const { el, pageTitle, formatNumber, request } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const ROOT = /^\/forum(\/|$)/i;
  const LOGO = chrome.runtime.getURL('assets/icons/logo.png');
  const SECTIONS = [
    {
      title: 'Roblox',
      forums: [
        { id: 'all-things-roblox', name: LT('All Things Roblox'), desc: LT('Talk about Roblox itself: new features, updates, events and the games everyone is playing.') },
      ],
    },
    {
      title: LT('Club Houses'),
      forums: [
        { id: 'lets-make-a-deal', name: LT('Let’s Make a Deal'), desc: LT('Limited trading and sales: post what you have, what you want, and talk values and the Roblox economy.') },
        { id: 'off-topic', name: LT('Off Topic'), desc: LT('Anything that doesn’t fit the other forums. Keep it friendly.') },
      ],
    },
    {
      title: LT('Game Creation'),
      forums: [
        { id: 'scripters', name: LT('Scripters'), desc: LT('Luau, Studio and building games: share what you made, ask how something works, help each other out.') },
      ],
    },
  ];
  const FORUMS = new Map(SECTIONS.flatMap(sec => sec.forums.map(f => [f.id, Object.assign({ section: sec.title }, f)])));
  const DAYS = [[0, LT('All Days')], [1, LT('Today')], [3, LT('Past 3 Days')], [7, LT('Past Week')], [14, LT('Past 2 Weeks')], [30, LT('Past Month')], [90, LT('Past 3 Months')], [180, LT('Past 6 Months')], [360, LT('Past Year')]];
  const POSTS_PER_PAGE = 20;
  const POPULAR = 30;
  const READ_KEY = 'routilityForumRead';
  const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const CLOCK = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
  const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const FULL = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const DMY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const LONG_DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const PRESENCE = { 1: ['online', 'Online'], 2: ['game', 'In game'], 3: ['studio', 'In Studio'] };
  const groupCache = new Map();
  const plusCache = new Map();
  const userCache = new Map();
  const headCache = new Map();
  const ROLES = { admin: LT('Forum Admin'), moderator: LT('Forum Moderator') };
  const REASONS = [['spam', LT('Spam')], ['inappropriate', LT('Inappropriate')], ['personal-info', LT('Personal info')], ['other', LT('Something else')]];
  const TITLE_MIN = 3;
  const TITLE_MAX = 80;
  const BODY_MAX = 4000;
  const AUTH_KEY = 'routilityForumAuth';
  const MOD_URL = 'https://routility.io/staff/forum';
  const BADGE_VERSION = '2';
  const HIDDEN_POST = { reports: LT('This post was hidden after reports'), moderator: LT('This post was hidden by a moderator') };
  const HIDDEN_THREAD = { reports: LT('This thread was hidden after reports'), moderator: LT('This thread was hidden by a moderator') };
  const DRAFT_KEY = 'routilityForumDraft:';

  let s = null;
  let settings = {};
  const PREFS = { forumStyle: 'modern', forumDensity: 'comfortable', forumAvatars: 'full', forumStatJoined: true, forumStatPosts: true, forumStatRap: true, forumStatValue: true, forumStatGroup: true };
  const STATS = [['forumStatJoined', LT('Joined'), 'joined'], ['forumStatPosts', LT('Total Posts'), 'posts'], ['forumStatRap', 'RAP', 'rap'], ['forumStatValue', LT('Value'), 'value'], ['forumStatGroup', LT('Community'), 'group']];

  function pref(key) {
    return settings[key] === undefined ? PREFS[key] : settings[key];
  }

  function applyPrefs() {
    if (!s || !s.root) return;
    const c = s.root.classList;
    c.toggle('routility-forum-classic', pref('forumStyle') === 'classic');
    c.toggle('routility-forum-compact', pref('forumDensity') === 'compact');
    c.toggle('routility-forum-avatars-off', pref('forumAvatars') === 'off');
    c.toggle('routility-forum-avatars-headshot', pref('forumAvatars') === 'headshot');
    for (const [key, , cls] of STATS) c.toggle('routility-forum-hide-' + cls, pref(key) === false);
  }

  function savePref(key, value) {
    chrome.storage.local.get('routilitySettings', (st) => {
      const next = Object.assign({}, st.routilitySettings || {}, { [key]: value });
      chrome.storage.local.set({ routilitySettings: next });
    });
  }

  function api(path, params) {
    return request({ type: 'forumApi', path, params: params || {} }, r => r && r.status !== 0);
  }

  function errorText(res, fallback) {
    const msg = res && res.data && typeof res.data.message === 'string' ? res.data.message.trim() : '';
    if (msg) return msg;
    if (res && res.status === 429) return lt('Too many requests. Try again in a moment.');
    return fallback;
  }

  function when(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return null;
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === d.toDateString();
    const day = sameDay ? lt('Today') : yesterday ? lt('Yesterday') : d.getFullYear() === now.getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
    const clock = CLOCK.format(d);
    return { day, clock, label: sameDay ? clock : yesterday ? day + ', ' + clock : day, full: FULL.format(d) };
  }

  function readState() {
    try {
      const v = JSON.parse(localStorage.getItem(READ_KEY) || '{}');
      return { t: v && typeof v.t === 'object' && v.t ? v.t : {}, f: v && typeof v.f === 'object' && v.f ? v.f : {} };
    } catch {
      return { t: {}, f: {} };
    }
  }

  function saveRead(st) {
    const ids = Object.keys(st.t);
    if (ids.length > 1000) ids.sort((a, b) => st.t[a] - st.t[b]).slice(0, ids.length - 1000).forEach(id => delete st.t[id]);
    try { localStorage.setItem(READ_KEY, JSON.stringify(st)); } catch {}
  }

  function isUnread(thread, forumId, st) {
    const at = Date.parse((thread.lastPost && thread.lastPost.at) || thread.createdAt);
    if (!Number.isFinite(at)) return false;
    return at > Math.max(Number(st.t[thread.id]) || 0, Number(st.f[forumId]) || 0);
  }

  function markThreadRead(id) {
    const st = readState();
    st.t[id] = Date.now();
    saveRead(st);
  }

  function markForumRead(forumId) {
    const st = readState();
    st.f[forumId] = Date.now();
    saveRead(st);
  }

  function route() {
    const parts = location.pathname.replace(/\/+$/, '').split('/').slice(2).map(p => decodeURIComponent(p));
    const params = new URLSearchParams(location.search);
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    const days = DAYS.some(d => String(d[0]) === params.get('days')) ? Number(params.get('days')) : 0;
    if (!parts.length) return { view: 'index' };
    if (parts[0] === 'search' && parts.length === 1) {
      const forum = FORUMS.has(params.get('forum')) ? params.get('forum') : '';
      return { view: 'search', q: (params.get('q') || '').trim().slice(0, 50), forum, page };
    }
    if (parts[0] === 'thread' && /^\d{1,20}$/.test(parts[1] || '') && parts.length === 2) return { view: 'thread', id: parts[1], page };
    if (parts[0] === 'post' && parts.length === 1) {
      const thread = /^\d{1,20}$/.test(params.get('thread') || '') ? params.get('thread') : '';
      const forum = FORUMS.has(params.get('forum')) ? params.get('forum') : '';
      if (thread || forum) return { view: 'compose', thread, forum };
    }
    if (FORUMS.has(parts[0]) && parts.length === 1) return { view: 'forum', id: parts[0], page, days };
    return { view: 'missing' };
  }

  function forumHref(path) {
    return 'https://www.roblox.com/forum' + (path ? '/' + path : '');
  }

  function withQuery(path, params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== '' && v != null && v !== 0 && !(k === 'page' && v === 1)) q.set(k, String(v));
    const str = q.toString();
    return path + (str ? '?' + str : '');
  }

  function link(text, path, className) {
    const a = el('a', className || 'content-link', text);
    a.href = forumHref(path);
    a.dataset.forumLink = '';
    return a;
  }

  function profileLink(userId, username, className) {
    const a = el('a', className || 'content-emphasis', username);
    a.href = /^\d+$/.test(String(userId)) ? `https://www.roblox.com/users/${userId}/profile` : 'https://www.roblox.com/users/profile?username=' + encodeURIComponent(username);
    return a;
  }

  async function robloxJson(url, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 800 * 2 ** attempt + Math.random() * 300));
      try {
        const res = await fetch(url, body ? { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { credentials: 'include' });
        if (res.ok) return await res.json();
        if (res.status !== 429 && res.status < 500) return null;
      } catch {}
    }
    return null;
  }

  async function avatars(ids) {
    const out = new Map();
    let pending = ids;
    for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1500));
      const head = pref('forumAvatars') === 'headshot';
      const res = await robloxJson('https://thumbnails.roblox.com/v1/batch', pending.map(id => ({ requestId: id, targetId: Number(id), type: head ? 'AvatarHeadShot' : 'Avatar', size: head ? '150x150' : '100x100', format: 'Webp', isCircular: false })));
      const retry = [];
      for (const item of (res && res.data) || []) {
        if (item.state === 'Completed' && item.imageUrl) out.set(String(item.requestId), item.imageUrl);
        else if (item.state === 'Pending') retry.push(String(item.requestId));
      }
      pending = retry;
    }
    return out;
  }

  function presences(ids) {
    return window.RoUtilityUI.presence(ids);
  }

  function primaryGroup(id) {
    if (!groupCache.has(id)) groupCache.set(id, robloxJson(`https://groups.roblox.com/v1/users/${id}/groups/primary/role`).then(r => (r && r.group && r.group.id ? { id: r.group.id, name: String(r.group.name || '') } : null)));
    return groupCache.get(id);
  }

  function headshot(id) {
    if (!headCache.has(id)) {
      const job = (async () => {
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt) await new Promise(r => setTimeout(r, 1500));
          const r = await robloxJson('https://thumbnails.roblox.com/v1/batch', [{ requestId: id, targetId: Number(id), type: 'AvatarHeadShot', size: '48x48', format: 'Webp', isCircular: true }]);
          const d = r && r.data && r.data[0];
          if (d && d.state === 'Completed' && d.imageUrl) return d.imageUrl;
          if (d && d.state === 'Blocked') return window.RoUtilityUI.blockedThumb(d);
          if (d && d.state !== 'Pending') break;
        }
        headCache.delete(id);
        return '';
      })();
      headCache.set(id, job);
    }
    return headCache.get(id);
  }

  function myRobloxId() {
    const u = s && s.user;
    for (const v of [u && u.userId, u && u.id]) if (/^\d+$/.test(String(v))) return String(v);
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function headshotEl(id, size) {
    const box = el('span', 'routility-forum-head');
    box.style.width = box.style.height = size + 'px';
    if (!/^\d+$/.test(String(id))) return box;
    headshot(String(id)).then(src => {
      if (!src) return;
      const img = el('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = src;
      box.appendChild(img);
    });
    return box;
  }

  function robloxUser(id) {
    if (!userCache.has(id)) {
      userCache.set(id, robloxJson(`https://users.roblox.com/v1/users/${id}`).then(u => (u && String(u.id) === id ? { created: u.created || null, verified: !!u.hasVerifiedBadge } : null)));
    }
    return userCache.get(id);
  }

  function hasPlus(id) {
    if (!plusCache.has(id)) plusCache.set(id, robloxJson(`https://premiumfeatures.roblox.com/v1/users/${id}/validate-membership`).then(v => v === true));
    return plusCache.get(id);
  }

  function rankImage(file, w, h, label) {
    const box = el('div', 'routility-forum-rank');
    const img = el('img');
    img.src = chrome.runtime.getURL('assets/icons/forum/' + file) + '?v=' + BADGE_VERSION;
    img.width = w;
    img.height = h;
    img.alt = label;
    box.appendChild(img);
    return box;
  }

  function verifiedMark() {
    const wrap = el('span', 'relative inline-flex items-center justify-center shrink-0 verified-badge routility-forum-badge');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', lt('Verified Badge Icon'));
    const plate = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-backplate size-[var(--icon-size-small)] content-system-emphasis');
    plate.setAttribute('aria-hidden', 'true');
    const check = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-check size-[var(--icon-size-small)] absolute content-[white]');
    check.setAttribute('aria-hidden', 'true');
    wrap.append(plate, check);
    return wrap;
  }

  function plusMark() {
    const icon = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus size-[var(--icon-size-small)] routility-forum-badge');
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', 'Roblox Plus');
    return icon;
  }

  function placeBadge(box, kind, node) {
    if (box.querySelector(`[data-badge="${kind}"]`)) return;
    node.dataset.badge = kind;
    const order = ['verified', 'plus', 'admin'];
    const after = [...box.children].find(c => order.indexOf(c.dataset.badge) > order.indexOf(kind));
    box.insertBefore(node, after || null);
  }

  function dmy(iso) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? DMY.format(d) : '';
  }

  function sk(width, height) {
    const span = el('span', 'routility-forum-sk');
    span.style.width = width + 'px';
    span.style.height = (height || 12) + 'px';
    return span;
  }

  function fill(cell, text) {
    const wrap = el('div', document.hidden ? null : 'routility-reveal', text);
    wrap.addEventListener('animationend', () => wrap.classList.remove('routility-reveal'), { once: true });
    cell.textContent = '';
    cell.appendChild(wrap);
    return wrap;
  }

  function header() {
    const head = el('div', 'routility-forum-top');
    const where = el('nav', 'routility-forum-where');
    where.setAttribute('aria-label', lt('Forum navigation'));
    const brand = el('a', 'routility-forum-brand content-emphasis');
    brand.href = forumHref('');
    brand.dataset.forumLink = '';
    const logo = el('img', 'routility-forum-logo');
    logo.src = LOGO;
    logo.alt = '';
    brand.appendChild(logo);
    brand.appendChild(el('span', null, 'RoUtility Forum'));
    where.appendChild(brand);
    where.appendChild(el('span', 'routility-forum-crumbs'));
    head.appendChild(where);
    const nav = el('div', 'routility-forum-nav-links');
    nav.appendChild(navButton(lt('Home'), 'regular-house', forumHref('')));
    const custom = navButton(lt('Customize'), 'regular-paint-brush', '#', () => openCustomize(custom));
    custom.classList.add('routility-forum-customize');
    custom.setAttribute('aria-haspopup', 'dialog');
    nav.appendChild(custom);
    head.appendChild(nav);
    return head;
  }

  function swapAvatars() {
    if (!s || !s.root) return;
    const nodes = [...s.root.querySelectorAll('.routility-forum-avatar')].filter(a => a.dataset.userId);
    const ids = [...new Set(nodes.map(a => a.dataset.userId))];
    if (!ids.length) return;
    avatars(ids).then(map => {
      for (const a of nodes) {
        const src = map.get(a.dataset.userId);
        if (!src || !a.isConnected) continue;
        let img = a.querySelector('.routility-forum-avatar-img');
        if (!img) {
          img = el('img', 'routility-forum-avatar-img routility-loaded');
          img.alt = '';
          a.appendChild(img);
        }
        img.src = src;
      }
    });
  }

  function closeCustomize() {
    if (!s || !s.custom) return;
    s.custom.stop();
    document.removeEventListener('mousedown', s.custom.outside, true);
    document.removeEventListener('keydown', s.custom.esc, true);
    s.custom.node.remove();
    s.custom = null;
  }

  function choiceRow(key, options) {
    const row = el('div', 'routility-forum-choices');
    for (const [value, label] of options) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-forum-choice');
      b.type = 'button';
      b.dataset.value = String(value);
      b.appendChild(layer());
      b.appendChild(el('span', 'padding-y-xsmall text-no-wrap', label));
      b.addEventListener('click', () => {
        if (typeof value === 'boolean') savePref(key, pref(key) === false);
        else savePref(key, value);
      });
      row.appendChild(b);
    }
    return row;
  }

  function paintCustomize() {
    if (!s || !s.custom) return;
    s.custom.node.querySelectorAll('.routility-forum-choice').forEach(b => {
      const key = b.closest('[data-key]').dataset.key;
      const on = b.dataset.value === 'true' ? pref(key) !== false : String(pref(key)) === b.dataset.value;
      b.classList.toggle('bg-inverse-surface-0', on);
      b.classList.toggle('content-inverse-emphasis', on);
      b.classList.toggle('bg-shift-300', !on);
      b.classList.toggle('content-action-utility', !on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function openCustomize(anchor) {
    if (s.custom) return closeCustomize();
    const pop = el('div', 'routility-injected routility-forum-custom bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', lt('Customize the forum'));
    const section = (title, key, row) => {
      const box = el('div', 'routility-forum-custom-section');
      box.dataset.key = key;
      box.appendChild(el('div', 'text-label-medium content-emphasis routility-forum-custom-title', title));
      box.appendChild(row);
      pop.appendChild(box);
    };
    section(lt('Style'), 'forumStyle', choiceRow('forumStyle', [['modern', lt('Modern')], ['classic', lt('Classic 2017')]]));
    section(lt('Density'), 'forumDensity', choiceRow('forumDensity', [['comfortable', lt('Comfortable')], ['compact', lt('Compact')]]));
    section(lt('Avatars'), 'forumAvatars', choiceRow('forumAvatars', [['full', lt('Full Body')], ['headshot', lt('Headshot')], ['off', lt('Off')]]));
    const stats = el('div', 'routility-forum-custom-section');
    stats.appendChild(el('div', 'text-label-medium content-emphasis routility-forum-custom-title', lt('Poster Stats')));
    const statRow = el('div', 'routility-forum-choices');
    for (const [key, label] of STATS) {
      const holder = el('span');
      holder.dataset.key = key;
      holder.appendChild(choiceRow(key, [[true, lt(label)]]).firstChild);
      statRow.appendChild(holder);
    }
    stats.appendChild(statRow);
    pop.appendChild(stats);
    document.body.appendChild(pop);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.right - w))) + 'px';
      pop.style.top = Math.round(r.bottom + 8) + 'px';
    };
    place();
    const outside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closeCustomize(); };
    const esc = (e) => { if (e.key === 'Escape') closeCustomize(); };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', esc, true);
    s.custom = { node: pop, outside, esc, stop: window.RoUtilityUI.trackPopover(pop, anchor, place, closeCustomize) };
    paintCustomize();
    window.RoUtilityUI.keyNav(pop, '.routility-forum-choice', true);
    if (!document.hidden) pop.classList.add('routility-reveal');
  }

  function ficon(name, extra) {
    const i = el('span', 'grow-0 shrink-0 basis-auto icon icon-' + name + ' routility-forum-ficon' + (extra ? ' ' + extra : ''));
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function navButton(label, iconName, href, onClick) {
    const a = el('a', 'routility-forum-navbtn relative clip group/interactable focus-visible:outline-focus content-default');
    a.href = href || '#';
    if (href && !onClick) a.dataset.forumLink = '';
    a.appendChild(layer());
    if (iconName) a.appendChild(ficon(iconName));
    a.appendChild(el('span', 'text-no-wrap routility-forum-navbtn-text', label));
    if (onClick) a.addEventListener('click', (e) => { e.preventDefault(); onClick(); });
    return a;
  }

  function fbutton(label, emphasis, onClick, iconName, size) {
    const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center gap-small stroke-none padding-y-none select-none radius-medium text-label-medium ' + (size === 'large' ? 'height-1000 padding-x-large routility-forum-btn-large ' : 'height-800 padding-x-medium ') + (emphasis ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    btn.type = 'button';
    btn.appendChild(layer());
    if (iconName) btn.appendChild(ficon(iconName));
    const text = el('span', 'padding-y-xsmall text-no-wrap', label);
    btn.appendChild(text);
    btn.label = text;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  function userChanged() {
    renderAccount();
    s.root.dispatchEvent(new CustomEvent('routility-forum-user'));
  }

  function renderAccount() {
    const nav = s.root.querySelector('.routility-forum-nav-links');
    nav.querySelectorAll('.routility-forum-account').forEach(n => n.remove());
    if (s.user === undefined) return;
    if (s.user) {
      const me = navButton(s.user.username || s.user.displayName, '', /^\d+$/.test(s.user.userId) ? `https://www.roblox.com/users/${s.user.userId}/profile` : '#');
      delete me.dataset.forumLink;
      me.insertBefore(headshotEl(myRobloxId(), 20), me.querySelector('.routility-forum-navbtn-text'));
      me.classList.add('routility-forum-account');
      const out = navButton(lt('Sign Out'), '', '#', signOut);
      out.classList.add('routility-forum-account');
      if (s.user.role === 'moderator' || s.user.role === 'admin') {
        const mod = navButton(lt('Moderate'), '', MOD_URL);
        delete mod.dataset.forumLink;
        mod.target = '_blank';
        mod.rel = 'noopener';
        mod.prepend(el('span', 'routility-forum-gavel'));
        mod.classList.add('routility-forum-account', 'routility-forum-navbtn-mod');
        nav.appendChild(mod);
      }
      nav.append(me, out);
    } else {
      const inBtn = navButton(s.signin ? lt('Signing In…') : lt('Sign In'), '', '#', signIn);
      inBtn.classList.add('routility-forum-account', 'routility-forum-navbtn-primary');
      nav.appendChild(inBtn);
    }
  }

  function notice(text, kind, extra) {
    const box = s.root.querySelector('.routility-forum-notice');
    clearTimeout(s.noticeTimer);
    box.textContent = '';
    box.hidden = !text;
    box.className = 'routility-forum-notice' + (kind ? ' routility-forum-notice-' + kind : '');
    if (!text) return;
    box.appendChild(el('span', 'routility-forum-notice-icon'));
    box.appendChild(el('span', 'routility-forum-notice-text', text));
    if (extra) box.appendChild(extra);
    if (kind === 'success') s.noticeTimer = setTimeout(() => notice(''), 5000);
  }

  function loadMe() {
    return request({ type: 'forumMe' }, r => r && 'user' in r).then(r => {
      if (!s) return;
      s.user = (r && r.user) || null;
      userChanged();
    });
  }

  function stopSignIn() {
    if (!s.signin) return;
    clearTimeout(s.signin.timer);
    s.signin = null;
    userChanged();
  }

  async function signIn() {
    if (!s || s.signin || s.user) return;
    s.signin = { timer: 0 };
    userChanged();
    notice(lt('Opening Roblox sign-in…'), 'info');
    const res = await request({ type: 'forumSignIn' }, r => r && (r.pairing || r.status !== 0));
    if (!s || !s.signin) return;
    if (!res || !res.pairing) {
      stopSignIn();
      return notice(res && res.message ? res.message : lt('Couldn’t start signing in. Try again in a moment.'), 'alert');
    }
    const cancel = el('a', 'content-link routility-forum-strong', lt('Cancel'));
    cancel.href = '#';
    cancel.addEventListener('click', (e) => { e.preventDefault(); request({ type: 'forumSignInClose', pairing: res.pairing }, x => x === true); stopSignIn(); notice(''); });
    notice(lt('Finish signing in with Roblox in the popup. This page updates by itself.'), 'info', cancel);
    const until = Date.now() + 180000;
    const poll = async () => {
      if (!s || !s.signin) return;
      const r = await request({ type: 'forumClaim', pairing: res.pairing }, x => x && x.status !== 0);
      if (!s || !s.signin) return;
      if (r && r.status === 200 && r.user) {
        request({ type: 'forumSignInClose', pairing: res.pairing }, x => x === true);
        s.user = r.user;
        stopSignIn();
        return notice(lt('Signed in as {name}.', { name: r.user.username || r.user.displayName }), 'success');
      }
      if (r && r.status !== 404) {
        stopSignIn();
        return notice(r.message || lt('Signing in didn’t work. Try again.'), 'alert');
      }
      if (Date.now() > until) {
        stopSignIn();
        return notice(lt('Signing in timed out. Try again.'), 'alert');
      }
      s.signin.timer = setTimeout(poll, 1000);
    };
    s.signin.timer = setTimeout(poll, 1000);
  }

  let signingOut = false;

  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    document.querySelectorAll('.routility-forum-account').forEach(n => n.classList.add('routility-forum-busy'));
    try {
      await request({ type: 'forumSignOut' }, r => r && r.ok);
    } finally {
      signingOut = false;
      document.querySelectorAll('.routility-forum-busy').forEach(n => n.classList.remove('routility-forum-busy'));
    }
    if (!s) return;
    s.user = null;
    userChanged();
    notice(lt('Signed out of the forum.'), 'success');
  }

  function write(path, payload) {
    return request({ type: 'forumWrite', path, body: payload }, r => r && r.status !== 0).then(res => {
      if (res && res.status === 401 && s) {
        s.user = null;
        userChanged();
      }
      return res;
    });
  }

  function writeError(res, fallback) {
    if (res && res.status === 429 && !(res.data && res.data.message)) return ltn(res.retryAfter || 20, 'You’re posting too fast. Try again in {n} second.', 'You’re posting too fast. Try again in {n} seconds.');
    if (res && res.status === 401) return (res.data && res.data.message) || lt('Sign in to post.');
    return errorText(res, fallback);
  }

  function crumbTrail(trail, className, leading = true) {
    const box = el('span', className || 'routility-forum-crumbs');
    for (const [i, c] of trail.entries()) {
      if (i || leading) box.appendChild(ficon('filled-chevron-large-right', 'routility-forum-sep'));
      const last = i === trail.length - 1;
      const crumb = c.path != null && !last ? link(c.text, c.path, 'routility-forum-crumb content-default') : el('span', 'routility-forum-crumb routility-forum-crumb-current content-emphasis', c.text);
      box.appendChild(crumb);
    }
    return box;
  }

  function setCrumbs(trail) {
    s.root.querySelector('.routility-forum-crumbs').replaceWith(crumbTrail(trail));
  }

  function searchBox(placeholder, onSearch, value) {
    const form = el('form', 'routility-forum-search');
    form.setAttribute('role', 'search');
    const field = el('div', 'foundation-web-input flex items-center relative clip stroke-standard height-1000 radius-medium padding-x-medium gap-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-forum-q');
    field.appendChild(ficon('regular-magnifying-glass', 'routility-forum-q-icon'));
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis text-body-medium [appearance:none]');
    input.id = 'routility-forum-q';
    input.type = 'search';
    input.maxLength = 50;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.enterKeyHint = 'search';
    input.value = value || '';
    field.appendChild(input);
    const clear = el('button', 'routility-forum-q-clear relative clip group/interactable');
    clear.type = 'button';
    clear.setAttribute('aria-label', lt('Clear search'));
    clear.appendChild(layer());
    clear.appendChild(ficon('regular-x'));
    const sync = () => { clear.hidden = !input.value; };
    clear.addEventListener('click', () => { input.value = ''; sync(); input.focus(); });
    input.addEventListener('input', sync);
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; sync(); } });
    sync();
    field.appendChild(clear);
    form.appendChild(field);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return input.focus();
      onSearch(q);
    });
    return form;
  }

  function layer() {
    const d = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  function closeMenu() {
    if (!s || !s.menu) return;
    s.menu.pop.remove();
    s.menu.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', s.menu.outside, true);
    document.removeEventListener('keydown', s.menu.key, true);
    if (s.menu.untrack) s.menu.untrack();
    s.menu = null;
  }

  function openMenu(anchor, options, value, onPick, check) {
    const open = s.menu && s.menu.btn === anchor;
    closeMenu();
    if (open) return;
    const pop = el('div', 'routility-injected routility-forum-pop');
    const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small');
    menu.setAttribute('role', 'menu');
    for (const [v, label] of options) {
      const item = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small gap-x-medium radius-medium');
      item.type = 'button';
      item.setAttribute('role', check ? 'menuitemradio' : 'menuitem');
      if (check) item.setAttribute('aria-checked', String(v === value));
      item.appendChild(layer());
      item.appendChild(el('span', 'grow-1 content-emphasis text-no-wrap', lt(label)));
      if (check) item.appendChild(el('span', 'icon routility-forum-check size-400 content-emphasis' + (v === value ? '' : ' routility-forum-check-off')));
      item.addEventListener('click', () => {
        closeMenu();
        if (v !== value) onPick(v);
      });
      menu.appendChild(item);
    }
    pop.appendChild(menu);
    document.body.appendChild(pop);
    window.RoUtilityUI.keyNav(menu, '.foundation-web-menu-item', true);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      pop.style.top = Math.round(r.bottom + 6) + 'px';
      pop.style.left = Math.round(Math.max(8, r.right - pop.offsetWidth)) + 'px';
    };
    place();
    anchor.setAttribute('aria-expanded', 'true');
    s.menu = {
      pop,
      btn: anchor,
      outside: (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closeMenu(); },
      key: (e) => { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } },
    };
    document.addEventListener('mousedown', s.menu.outside, true);
    document.addEventListener('keydown', s.menu.key, true);
    s.menu.untrack = window.RoUtilityUI.trackPopover(pop, anchor, place, closeMenu);
    return menu;
  }

  function menuSelect(options, value, onPick) {
    const btn = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center gap-small stroke-standard stroke-contrast-alpha bg-none height-800 radius-medium padding-x-medium content-emphasis text-label-medium routility-forum-select');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(layer());
    btn.appendChild(el('span', null, lt((options.find(o => o[0] === value) || options[0])[1])));
    btn.appendChild(el('span', 'icon routility-forum-chevron size-400 content-emphasis'));
    btn.addEventListener('click', (e) => {
      const menu = openMenu(btn, options, value, onPick, true);
      const current = menu && menu.querySelector('[aria-checked="true"]');
      if (current && e.detail === 0) current.focus({ preventScroll: true });
    });
    return btn;
  }

  function bar(left, right) {
    const row = el('div', 'routility-forum-bar');
    row.appendChild(left || el('div'));
    row.appendChild(right || el('div'));
    return row;
  }

  function clockText() {
    const now = new Date();
    return DAY.format(now) + ', ' + TIME.format(now);
  }

  function tickClock() {
    const c = s && s.root.querySelector('.routility-forum-clock');
    if (c) c.textContent = clockText();
  }

  function body() {
    const b = s.root.querySelector('.routility-forum-body');
    b.textContent = '';
    return b;
  }

  function lastPostCell(cell, last) {
    if (!last) {
      cell.appendChild(el('span', 'content-muted', lt('No posts')));
      return;
    }
    const w = when(last.at);
    const box = last.threadId ? link('', 'thread/' + encodeURIComponent(last.threadId), 'routility-forum-lastlink content-emphasis') : el('div', 'routility-forum-lastlink');
    box.appendChild(el('div', 'routility-forum-strong', w ? w.label : ''));
    if (last.username) box.appendChild(el('div', 'routility-forum-user', String(last.username)));
    cell.appendChild(box);
  }

  function renderIndex() {
    pageTitle(lt('Forum') + ' - Roblox');
    setCrumbs([]);
    const b = body();
    const clock = el('div', 'routility-forum-time content-muted');
    clock.appendChild(ficon('regular-clock'));
    clock.appendChild(el('span', 'routility-forum-clock', clockText()));
    b.appendChild(bar(clock, searchBox(lt('Search the forum'), q => navigate(withQuery('/forum/search', { q })))));
    const note = el('div', 'routility-forum-note content-system-alert');
    note.hidden = true;
    b.appendChild(note);
    const cards = el('div', 'routility-forum-cards');
    const cells = new Map();
    for (const sec of SECTIONS) {
      const table = el('table', 'routility-forum-table routility-forum-index');
      const thead = el('thead');
      const hr = el('tr', 'routility-forum-cat');
      hr.appendChild(el('th', 'routility-forum-cat-name', lt(sec.title)));
      for (const label of [lt('Threads'), lt('Posts'), lt('Last Post')]) hr.appendChild(el('th', 'routility-forum-num', label));
      thead.appendChild(hr);
      table.appendChild(thead);
      const tb = el('tbody');
      for (const f of sec.forums) {
        const tr = el('tr', 'routility-forum-row');
        const name = el('td', 'routility-forum-main');
        const summary = link('', encodeURIComponent(f.id), 'routility-forum-summary content-emphasis');
        summary.appendChild(el('div', 'routility-forum-title', lt(f.name)));
        summary.appendChild(el('div', 'routility-forum-desc', lt(f.desc)));
        name.appendChild(summary);
        tr.appendChild(name);
        const threads = el('td', 'routility-forum-num content-emphasis');
        const posts = el('td', 'routility-forum-num content-emphasis');
        const last = el('td', 'routility-forum-num routility-forum-last content-emphasis');
        threads.appendChild(sk(52));
        posts.appendChild(sk(60));
        last.appendChild(sk(64));
        last.appendChild(sk(88));
        tr.append(threads, posts, last);
        tb.appendChild(tr);
        cells.set(f.id, { threads, posts, last });
      }
      table.appendChild(tb);
      cards.appendChild(table);
    }
    b.appendChild(cards);
    const token = s.token;
    api('/forums').then(res => {
      if (!s || s.token !== token) return;
      const list = res && res.status === 200 && res.data && Array.isArray(res.data.forums) ? res.data.forums : null;
      if (!list) {
        note.textContent = errorText(res, lt('Couldn’t load the forum stats. Refresh to try again.'));
        note.hidden = false;
      }
      const byId = new Map((list || []).map(f => [f.id, f]));
      for (const [id, c] of cells) {
        const f = byId.get(id);
        fill(c.threads, f ? formatNumber(f.threads) : '—');
        fill(c.posts, f ? formatNumber(f.posts) : '—');
        const wrap = fill(c.last, f ? null : '—');
        if (f) lastPostCell(wrap, f.lastPost);
      }
    });
  }

  function threadIcon(t, unread) {
    const kind = t.locked ? 'locked' : t.pinned ? 'pinned' : (Number(t.replies) || 0) >= POPULAR ? 'popular' : 'thread';
    const icon = el('span', 'routility-forum-icon routility-forum-icon-' + kind + (unread ? ' routility-forum-unread' : ''));
    const names = { locked: lt('Locked thread'), pinned: lt('Pinned thread'), popular: lt('Popular thread'), thread: lt('Thread') };
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', names[kind] + ' ' + (unread ? lt('(new posts)') : lt('(no new posts)')));
    return icon;
  }

  function threadPages(t) {
    return Math.max(1, Math.ceil(((Number(t.replies) || 0) + 1) / POSTS_PER_PAGE));
  }

  function miniPager(t) {
    const pages = threadPages(t);
    const box = el('div', 'routility-forum-mini');
    if (pages < 2) return box;
    const list = pages <= 4 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3, 0, pages];
    for (const p of list) {
      if (!p) box.appendChild(el('span', 'routility-forum-mini-gap content-muted', '…'));
      else {
        const chip = link(formatNumber(p), withQuery('thread/' + encodeURIComponent(t.id), { page: p }), 'routility-forum-mini-chip relative clip group/interactable content-default');
        chip.prepend(layer());
        chip.setAttribute('aria-label', lt('Page {n}', { n: p }));
        box.appendChild(chip);
      }
    }
    return box;
  }

  function threadHead(views) {
    const tr = el('tr', 'routility-forum-cat');
    const subject = el('th', 'routility-forum-subject-head', lt('Subject'));
    subject.colSpan = 3;
    tr.appendChild(subject);
    tr.appendChild(el('th', 'routility-forum-author-head', lt('Author')));
    tr.appendChild(el('th', 'routility-forum-num', lt('Replies')));
    if (views) tr.appendChild(el('th', 'routility-forum-num', lt('Views')));
    tr.appendChild(el('th', 'routility-forum-num', lt('Last Post')));
    return tr;
  }

  function threadRow(t, opts, st) {
    const tr = el('tr', 'routility-forum-row routility-forum-thread');
    const forumId = t.forumId || opts.forumId;
    const iconCell = el('td', 'routility-forum-icon-cell');
    iconCell.appendChild(threadIcon(t, isUnread(t, forumId, st)));
    tr.appendChild(iconCell);
    const subject = el('td', 'routility-forum-subject');
    subject.appendChild(link(String(t.title || ''), 'thread/' + encodeURIComponent(t.id), 'routility-forum-subject-link content-emphasis'));
    if (opts.showForum && FORUMS.has(forumId)) subject.appendChild(link(lt(FORUMS.get(forumId).name), encodeURIComponent(forumId), 'routility-forum-in content-muted'));
    tr.appendChild(subject);
    const pagesCell = el('td', 'routility-forum-pages');
    pagesCell.appendChild(miniPager(t));
    tr.appendChild(pagesCell);
    const author = el('td', 'routility-forum-author');
    if (t.username) author.appendChild(/^\d+$/.test(String(t.userId)) ? profileLink(t.userId, String(t.username), 'content-emphasis routility-forum-author-link') : el('span', 'content-emphasis routility-forum-author-link', String(t.username)));
    tr.appendChild(author);
    const replies = Number(t.replies) || 0;
    tr.appendChild(el('td', 'routility-forum-num content-emphasis', replies ? formatNumber(replies) : '-'));
    if (opts.views) tr.appendChild(el('td', 'routility-forum-num content-emphasis', Number.isFinite(t.views) ? formatNumber(t.views) : '-'));
    const last = el('td', 'routility-forum-num routility-forum-last content-emphasis');
    const pages = threadPages(t);
    const box = link('', withQuery('thread/' + encodeURIComponent(t.id), { page: pages }), 'routility-forum-lastlink content-emphasis');
    const w = t.lastPost ? when(t.lastPost.at) : null;
    if (t.pinned) {
      box.appendChild(el('div', 'routility-forum-strong', lt('Pinned Post')));
      if (t.username) box.appendChild(el('div', 'routility-forum-user', String(t.username)));
    } else {
      box.appendChild(el('div', 'routility-forum-strong', w ? w.label : ''));
      const who = (t.lastPost && t.lastPost.username) || t.username;
      if (who) box.appendChild(el('div', 'routility-forum-user', String(who)));
    }
    last.appendChild(box);
    tr.appendChild(last);
    return tr;
  }

  function skeletonRows(tbody, cols) {
    for (let i = 0; i < 10; i++) {
      const tr = el('tr', 'routility-forum-row routility-forum-thread');
      const icon = el('td', 'routility-forum-icon-cell');
      icon.appendChild(sk(18, 18));
      const subject = el('td', 'routility-forum-subject');
      subject.colSpan = 2;
      const bar1 = sk(140 + ((i * 53) % 160), 14);
      bar1.style.margin = '3px 0';
      subject.appendChild(bar1);
      const author = el('td', 'routility-forum-author');
      const bar2 = sk(70 + ((i * 37) % 40));
      bar2.style.margin = '3px 0';
      author.appendChild(bar2);
      tr.append(icon, subject, author);
      for (let c = 0; c < cols - 1; c++) {
        const td = el('td', 'routility-forum-num');
        td.appendChild(sk(20));
        tr.appendChild(td);
      }
      const last = el('td', 'routility-forum-num routility-forum-last');
      last.append(sk(56), sk(84));
      tr.appendChild(last);
      tbody.appendChild(tr);
    }
  }

  function emptyState(o) {
    const box = el('div', 'routility-forum-state');
    const badge = el('div', 'routility-forum-state-icon bg-shift-200');
    badge.appendChild(ficon(o.icon || 'regular-speech-bubble-align-center'));
    box.appendChild(badge);
    box.appendChild(el('div', 'text-title-large content-emphasis routility-forum-state-title', o.title));
    if (o.text) box.appendChild(el('div', 'text-body-medium content-default routility-forum-state-text', o.text));
    if (o.actions && o.actions.length) {
      const row = el('div', 'routility-forum-state-actions');
      row.append(...o.actions);
      box.appendChild(row);
    }
    return box;
  }

  function emptyCard(o) {
    const card = el('div', 'routility-forum-state-card');
    card.appendChild(emptyState(o));
    return card;
  }

  function homeButton() {
    return fbutton(lt('Back to the forum'), false, () => navigate('/forum'), 'regular-house');
  }

  function messageRow(tbody, cols, o) {
    const tr = el('tr', 'routility-forum-row routility-forum-state-row');
    const td = el('td', 'routility-forum-message');
    td.colSpan = cols;
    td.appendChild(emptyState(typeof o === 'string' ? { icon: 'regular-x', title: o } : o));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function pageList(page, pages) {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const want = new Set([1, 2, 3, pages - 1, pages, page - 1, page, page + 1]);
    const sorted = [...want].filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
      if (i && p - sorted[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  }

  function pageButton(label, href, extra, aria) {
    const a = link(label, href, 'routility-forum-pg relative clip group/interactable focus-visible:outline-focus content-emphasis ' + (extra || ''));
    a.prepend(layer());
    if (aria) a.setAttribute('aria-label', aria);
    return a;
  }

  function pager(page, pages, hrefFor) {
    const row = el('div', 'routility-forum-pager');
    row.appendChild(el('span', 'routility-forum-pager-label content-muted', lt('Page {page} of {pages}', { page: formatNumber(page), pages: formatNumber(pages) })));
    const right = el('nav', 'routility-forum-pager-links');
    right.setAttribute('aria-label', lt('Pages'));
    if (pages > 1) {
      const prev = page > 1 ? pageButton('', hrefFor(page - 1), 'routility-forum-pg-arrow', lt('Previous page')) : el('span', 'routility-forum-pg routility-forum-pg-arrow routility-forum-pg-off');
      prev.appendChild(el('span', 'icon routility-forum-chevron routility-forum-chevron-left'));
      right.appendChild(prev);
      for (const p of pageList(page, pages)) {
        if (!p) right.appendChild(el('span', 'routility-forum-pg-gap content-muted', '…'));
        else if (p === page) {
          const cur = el('span', 'routility-forum-pg routility-forum-pg-current', formatNumber(p));
          cur.setAttribute('aria-current', 'page');
          right.appendChild(cur);
        } else right.appendChild(pageButton(formatNumber(p), hrefFor(p)));
      }
      const next = page < pages ? pageButton('', hrefFor(page + 1), 'routility-forum-pg-arrow', lt('Next page')) : el('span', 'routility-forum-pg routility-forum-pg-arrow routility-forum-pg-off');
      next.appendChild(el('span', 'icon routility-forum-chevron routility-forum-chevron-right'));
      right.appendChild(next);
    }
    row.appendChild(right);
    return row;
  }

  function threadTable(b, opts) {
    const table = el('table', 'routility-forum-table routility-forum-threads');
    const head = el('thead');
    head.appendChild(threadHead(false));
    table.appendChild(head);
    const tbody = el('tbody');
    skeletonRows(tbody, 2);
    table.appendChild(tbody);
    const foot = el('tfoot');
    const ftr = el('tr', 'routility-forum-cat routility-forum-footer');
    const ftd = el('td');
    ftd.colSpan = 6;
    ftr.appendChild(ftd);
    foot.appendChild(ftr);
    table.appendChild(foot);
    b.appendChild(table);
    const pagerSlot = el('div', 'routility-forum-pager-slot');
    b.appendChild(pagerSlot);
    return {
      table,
      done(threads, page, pages, emptyText) {
        const views = threads.some(t => Number.isFinite(t.views));
        const cols = views ? 7 : 6;
        head.replaceChildren(threadHead(views));
        ftd.colSpan = cols;
        tbody.textContent = '';
        const st = readState();
        if (!threads.length) {
          if (page > pages) messageRow(tbody, cols, { icon: 'regular-speech-bubble-align-center', title: lt('Nothing on this page'), text: lt('This list doesn’t go that far.'), actions: [fbutton(lt('Go to page 1'), false, () => navigate(forumHref(opts.hrefFor(1))))] });
          else messageRow(tbody, cols, emptyText);
          pagerSlot.textContent = '';
          return;
        }
        for (const t of threads) tbody.appendChild(threadRow(t, Object.assign({ views }, opts), st));
        if (!document.hidden) tbody.classList.add('routility-reveal');
        pagerSlot.replaceChildren(pager(Math.min(page, Math.max(pages, 1)), Math.max(pages, 1), opts.hrefFor));
      },
      fail(text) {
        tbody.textContent = '';
        messageRow(tbody, 6, { icon: 'regular-x', title: lt('Something went wrong'), text, actions: [fbutton(lt('Try again'), false, () => render())] });
        pagerSlot.textContent = '';
      },
    };
  }

  function cleanThreads(data) {
    return (data && Array.isArray(data.threads) ? data.threads : []).filter(t => t && t.id != null).map(t => Object.assign({}, t, { id: String(t.id) }));
  }

  function renderForum(r) {
    const f = FORUMS.get(r.id);
    pageTitle(lt(f.name) + ' - Roblox');
    const trail = [{ text: lt(f.section), path: '' }, { text: lt(f.name), path: encodeURIComponent(f.id) }];
    setCrumbs(trail);
    const b = body();
    const actions = el('div', 'routility-forum-actions');
    actions.appendChild(fbutton(lt('New Thread'), true, () => navigate(withQuery('/forum/post', { forum: f.id })), 'filled-plus-large', 'large'));
    b.appendChild(bar(actions, searchBox(lt('Search {forum}', { forum: lt(f.name) }), q => navigate(withQuery('/forum/search', { q, forum: f.id })))));
    const hrefFor = (p) => withQuery(encodeURIComponent(f.id), { page: p, days: r.days });
    const list = threadTable(b, { forumId: f.id, hrefFor });
    const bottom = el('div', 'routility-forum-bottom');
    bottom.appendChild(crumbTrail([{ text: 'RoUtility Forum', path: '' }].concat(trail), 'routility-forum-crumbs-bottom', false));
    const tools = el('div', 'routility-forum-tools');
    const show = el('div', 'routility-forum-days');
    show.appendChild(el('span', 'routility-forum-tools-label content-muted', lt('Show threads from')));
    show.appendChild(menuSelect(DAYS, r.days, (value) => navigate(withQuery('/forum/' + encodeURIComponent(f.id), { days: value }))));
    tools.appendChild(show);
    const mark = fbutton(lt('Mark all as read'), false, () => {
      markForumRead(f.id);
      mark.label.textContent = lt('All caught up');
      mark.disabled = true;
      list.table.querySelectorAll('.routility-forum-icon.routility-forum-unread').forEach(icon => {
        icon.classList.remove('routility-forum-unread');
        icon.setAttribute('aria-label', (icon.getAttribute('aria-label') || '').replace(lt('(new posts)'), lt('(no new posts)')));
      });
    }, 'regular-circle-check');
    tools.appendChild(mark);
    bottom.appendChild(tools);
    b.appendChild(bottom);
    const token = s.token;
    const params = { page: r.page };
    if (r.days) params.days = r.days;
    api('/forums/' + f.id + '/threads', params).then(res => {
      if (!s || s.token !== token) return;
      if (!res || res.status !== 200 || !res.data) return list.fail(errorText(res, lt('Couldn’t load the threads. Refresh to try again.')));
      list.done(cleanThreads(res.data), Number(res.data.page) || r.page, Number(res.data.pages) || 1, r.days
        ? { icon: 'regular-clock', title: lt('Nothing in this time range'), text: lt('No one has posted here lately. Try a longer range.'), actions: [fbutton(lt('Show all threads'), false, () => navigate(forumHref(encodeURIComponent(f.id))))] }
        : { icon: 'regular-speech-bubble-align-center', title: lt('No threads yet'), text: lt('Be the first to start a conversation in {forum}.', { forum: lt(f.name) }) });
    });
  }

  function renderSearch(r) {
    const f = FORUMS.get(r.forum);
    pageTitle((r.q ? r.q + ' - ' : '') + lt('Forum Search') + ' - Roblox');
    setCrumbs(f ? [{ text: lt(f.section), path: '' }, { text: lt(f.name), path: encodeURIComponent(f.id) }, { text: lt('Search') }] : [{ text: lt('Search') }]);
    const b = body();
    const label = f ? lt('Search {forum}', { forum: lt(f.name) }) : lt('Search the forum');
    const left = el('div', 'routility-forum-results content-muted');
    if (r.q) {
      const [before, after] = (f ? lt('Results for {query} in {forum}', { forum: lt(f.name) }) : lt('Results for {query}')).split('{query}');
      if (before) left.appendChild(document.createTextNode(before));
      left.appendChild(el('span', 'content-emphasis routility-forum-strong', '“' + r.q + '”'));
      if (after) left.appendChild(document.createTextNode(after));
    }
    b.appendChild(bar(left, searchBox(label, q => navigate(withQuery('/forum/search', { q, forum: r.forum })), r.q)));
    if (!r.q) {
      b.appendChild(emptyCard({ icon: 'regular-magnifying-glass', title: lt('Search the forum'), text: lt('Type a word or phrase in the search box to find threads and posts.') }));
      return;
    }
    const hrefFor = (p) => withQuery('search', { q: r.q, forum: r.forum, page: p });
    const list = threadTable(b, { showForum: !f, forumId: r.forum, hrefFor });
    const token = s.token;
    const params = { q: r.q, page: r.page };
    if (f) params.forumId = f.id;
    api('/search', params).then(res => {
      if (!s || s.token !== token) return;
      if (!res || res.status !== 200 || !res.data) return list.fail(errorText(res, lt('Couldn’t search right now. Try again in a moment.')));
      const actions = [];
      if (f) actions.push(fbutton(lt('Search every forum'), false, () => navigate(withQuery('/forum/search', { q: r.q }))));
      actions.push(homeButton());
      list.done(cleanThreads(res.data), Number(res.data.page) || r.page, Number(res.data.pages) || 1, { icon: 'regular-magnifying-glass', title: lt('No results for “{query}”', { query: r.q }), text: f ? lt('Nothing in {forum} matches. Try other words, or search every forum.', { forum: lt(f.name) }) : lt('Try other words, or check the spelling.'), actions });
    });
  }

  function threadBar(nav) {
    const tr = el('tr', 'routility-forum-cat routility-forum-postbar');
    const td = el('td');
    td.colSpan = 2;
    const right = el('div', 'routility-forum-prevnext');
    if (nav && (nav.prev || nav.next)) {
      const make = (id, label, dir) => {
        const node = id ? pageButton('', 'thread/' + encodeURIComponent(id), 'routility-forum-threadnav') : el('span', 'routility-forum-pg routility-forum-threadnav routility-forum-pg-off');
        const icon = el('span', 'icon routility-forum-chevron routility-forum-chevron-' + dir);
        const text = el('span', null, label);
        if (dir === 'left') node.append(icon, text);
        else node.append(text, icon);
        return node;
      };
      right.append(make(nav.prev, lt('Previous Thread'), 'left'), make(nav.next, lt('Next Thread'), 'right'));
    }
    td.appendChild(right);
    tr.appendChild(td);
    return tr;
  }

  function postSkeleton(tbody) {
    for (let i = 0; i < 3; i++) {
      const tr = el('tr', 'routility-forum-post');
      const left = el('td', 'routility-forum-author-col');
      const name = sk(90, 14);
      name.style.margin = '3px 0 6px';
      left.appendChild(name);
      const av = sk(100, 100);
      av.style.margin = '0';
      left.appendChild(av);
      for (const w of [96, 84]) {
        const line = sk(w, 12);
        line.style.margin = '8px 0 0';
        left.appendChild(line);
      }
      const right = el('td', 'routility-forum-post-col');
      const date = sk(120, 12);
      date.style.margin = '3px 0 10px';
      right.appendChild(date);
      for (const w of [420, 360, 200]) {
        const line = sk(w, 14);
        line.style.margin = '0 0 8px';
        right.appendChild(line);
      }
      tr.append(left, right);
      tbody.appendChild(tr);
      tbody.appendChild(spacerRow());
    }
  }

  function spacerRow() {
    const tr = el('tr', 'routility-forum-post-spacer');
    const td = el('td');
    td.colSpan = 2;
    tr.appendChild(td);
    return tr;
  }

  function postRow(post) {
    const tr = el('tr', 'routility-forum-post');
    tr.id = 'post-' + post.id;
    const left = el('td', 'routility-forum-author-col');
    const userId = /^\d+$/.test(String(post.userId)) ? String(post.userId) : '';
    const shown = String(post.username || post.displayName || '');
    const nameLine = el('div', 'routility-forum-poster');
    if (userId) {
      const dot = el('span', 'routility-forum-presence');
      dot.dataset.userId = userId;
      nameLine.appendChild(dot);
      nameLine.appendChild(profileLink(userId, shown, 'content-link routility-forum-poster-name'));
    } else {
      nameLine.appendChild(el('span', 'content-emphasis routility-forum-poster-name', shown));
    }
    const badges = el('span', 'routility-forum-badges');
    badges.dataset.userId = userId;
    nameLine.appendChild(badges);
    left.appendChild(nameLine);
    const av = userId ? profileLink(userId, '', 'routility-forum-avatar') : el('span', 'routility-forum-avatar routility-forum-avatar-system');
    av.setAttribute('aria-label', shown);
    av.dataset.userId = userId;
    if (userId) {
      av.appendChild(el('span', 'routility-forum-avatar-sk'));
    } else {
      const logo = el('img', 'routility-forum-avatar-img routility-loaded');
      logo.alt = '';
      logo.src = chrome.runtime.getURL('assets/icons/logo.png');
      av.appendChild(logo);
    }
    left.appendChild(av);
    const author = post.author || {};
    const roleKey = String(author.role || '').toLowerCase();
    if (ROLES[roleKey]) left.appendChild(rankImage('moderator.png', 77, 15, lt(ROLES[roleKey])));
    const rank = Number(author.topRank);
    const top = rank >= 1 ? [25, 50, 100].find(n => rank <= n) : 0;
    if (top) left.appendChild(rankImage('top' + top + '.png', top === 100 ? 82 : 76, 12, lt('Top {n} Poster', { n: top })));
    const joined = el('div', 'routility-forum-meta content-emphasis routility-forum-stat-joined');
    joined.appendChild(el('b', null, lt('Joined:') + ' '));
    const joinedValue = el('span', 'routility-forum-joined');
    joinedValue.dataset.userId = userId;
    if (userId) joinedValue.appendChild(sk(78, 11));
    else joinedValue.textContent = '-';
    joined.appendChild(joinedValue);
    left.appendChild(joined);
    const total = el('div', 'routility-forum-meta content-emphasis routility-forum-stat-posts');
    total.appendChild(el('b', null, lt('Total Posts:') + ' '));
    total.appendChild(document.createTextNode(Number.isFinite(author.posts) ? formatNumber(author.posts) : '-'));
    left.appendChild(total);
    if (userId) {
      const pills = el('div', 'routility-forum-pills');
      pills.dataset.userId = userId;
      pills.dataset.name = shown;
      pills.append(el('span', 'routility-forum-pill-sk routility-forum-stat-value'), el('span', 'routility-forum-pill-sk routility-forum-pill-sk-rap routility-forum-stat-rap'));
      left.appendChild(pills);
    }
    const group = el('div', 'routility-forum-meta routility-forum-group routility-forum-stat-group');
    group.dataset.userId = userId;
    left.appendChild(group);
    tr.appendChild(left);

    const right = el('td', 'routility-forum-post-col');
    const w = when(post.createdAt);
    const date = el('div', 'routility-forum-post-date content-emphasis', w ? dmy(post.createdAt) + ' ' + w.clock : '');
    right.appendChild(date);
    const content = el('div', 'routility-forum-post-body content-emphasis');
    if (post.hidden || post.body == null) {
      content.classList.add('routility-forum-post-hidden');
      content.appendChild(el('span', 'routility-forum-hidden-icon'));
      content.appendChild(el('span', 'content-muted', lt(HIDDEN_POST[post.hiddenReason] || HIDDEN_POST.reports)));
    } else {
      content.textContent = String(post.body);
    }
    right.appendChild(content);
    const actions = el('div', 'routility-forum-post-actions');
    if (!post.hidden && post.body != null && !(s.user && String(s.user.userId) === String(post.userId))) actions.appendChild(reportLink(post));
    right.appendChild(actions);
    tr.appendChild(right);
    return tr;
  }

  function reportLink(post) {
    const a = el('a', 'routility-forum-report');
    a.href = '#';
    a.setAttribute('aria-haspopup', 'menu');
    a.classList.add('relative', 'clip', 'group/interactable', 'focus-visible:outline-focus');
    a.appendChild(layer());
    a.appendChild(ficon('regular-flag'));
    a.appendChild(el('span', null, lt('Report')));
    a.setAttribute('aria-label', lt('Report abuse'));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (!s.user) {
        notice(lt('Sign in to report posts.'), 'info', signInLink());
        return;
      }
      if (String(post.userId) === String(s.user.userId)) return notice(lt('You can’t report your own post.'), 'info');
      openMenu(a, REASONS, null, async (reason) => {
        a.classList.add('routility-forum-report-busy');
        const res = await write('/posts/' + post.id + '/report', { reason });
        if (!s) return;
        a.classList.remove('routility-forum-report-busy');
        if (res && res.status === 200) {
          const done = el('span', 'routility-forum-reported content-muted', lt('Reported. Thanks!'));
          a.replaceWith(done);
          return;
        }
        notice(writeError(res, lt('Couldn’t send the report. Try again.')), 'alert', res && res.status === 401 ? signInLink() : null);
      });
    });
    return a;
  }

  function signInCard() {
    const card = el('div', 'routility-forum-signin');
    const marks = el('div', 'routility-forum-signin-marks');
    const ours = el('span', 'routility-forum-signin-tile');
    const logo = el('img');
    logo.src = LOGO;
    logo.alt = 'RoUtility';
    ours.appendChild(logo);
    const roblox = el('span', 'routility-forum-signin-tile');
    roblox.appendChild(el('span', 'icon-logo-r routility-forum-rlogo'));
    roblox.setAttribute('aria-label', 'Roblox');
    marks.append(ours, el('span', 'routility-forum-signin-link'), roblox);
    card.appendChild(marks);
    card.appendChild(el('div', 'routility-forum-signin-title content-emphasis', lt('Sign in to post')));
    card.appendChild(el('div', 'routility-forum-signin-text content-muted', lt('Use your Roblox account. The forum only receives your user ID, username and display name, and shows them on your posts.')));
    const btn = el('button', 'routility-forum-signin-btn relative clip group/interactable focus-visible:outline-focus');
    btn.type = 'button';
    btn.appendChild(layer());
    const mark = el('span', 'icon-logo-r routility-forum-rlogo routility-forum-rlogo-small');
    btn.appendChild(mark);
    requestAnimationFrame(() => {
      const bg = mark.isConnected ? getComputedStyle(mark).backgroundImage : 'none';
      if (!bg || bg === 'none') return;
      mark.style.webkitMaskImage = bg;
      mark.style.maskImage = bg;
      mark.classList.add('routility-forum-rlogo-tinted');
    });
    btn.appendChild(el('span', null, s.signin ? lt('Waiting for Roblox…') : lt('Continue with Roblox')));
    btn.disabled = !!s.signin;
    btn.addEventListener('click', () => signIn());
    card.appendChild(btn);
    return card;
  }

  function signInLink() {
    const a = el('a', 'content-link routility-forum-strong', lt('Sign In'));
    a.href = '#';
    a.addEventListener('click', (e) => { e.preventDefault(); signIn(); });
    return a;
  }

  function fillAuthors(table, posts, token) {
    const ids = [...new Set(posts.map(p => String(p.userId)).filter(id => /^\d+$/.test(id)))];
    if (!ids.length) return;
    avatars(ids).then(map => {
      if (!s || s.token !== token) return;
      table.querySelectorAll('.routility-forum-avatar').forEach(a => {
        const src = map.get(a.dataset.userId);
        if (!src) return;
        const img = el('img', 'routility-forum-avatar-img');
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
        img.src = src;
        a.appendChild(img);
      });
    });
    for (const id of ids) {
      robloxUser(id).then(u => {
        if (!s || s.token !== token) return;
        table.querySelectorAll(`.routility-forum-joined[data-user-id="${id}"]`).forEach(box => {
          const d = u && u.created ? new Date(u.created) : null;
          box.textContent = d && Number.isFinite(d.getTime()) ? dmy(u.created) : '-';
        });
        if (u && u.verified) table.querySelectorAll(`.routility-forum-badges[data-user-id="${id}"]`).forEach(box => placeBadge(box, 'verified', verifiedMark()));
      });
    }
    for (const id of ids) {
      hasPlus(id).then(plus => {
        if (!plus || !s || s.token !== token) return;
        table.querySelectorAll(`.routility-forum-badges[data-user-id="${id}"]`).forEach(box => placeBadge(box, 'plus', plusMark()));
      });
    }
    if (settings.adminBadge !== false) {
      request({ type: 'robloxAdmins', ids }, r => r && Array.isArray(r.admins)).then(r => {
        if (!s || s.token !== token) return;
        for (const id of (r && r.admins) || []) {
          table.querySelectorAll(`.routility-forum-badges[data-user-id="${id}"]`).forEach(box => placeBadge(box, 'admin', window.RoUtilityUI.adminBadge()));
        }
      });
    }
    presences(ids).then(map => {
      if (!s || s.token !== token) return;
      table.querySelectorAll('.routility-forum-presence').forEach(dot => {
        const p = map.get(dot.dataset.userId);
        const kind = p && PRESENCE[p.userPresenceType];
        dot.classList.add(kind ? 'routility-forum-presence-on' : 'routility-forum-presence-off');
      });
    });
    if (window.RoUtilityProfile && window.RoUtilityProfile.summarize) {
      const fromServer = (p) => p.inventoryPrivate ? { private: true } : { private: false, usd: Number(p.usd) || 0, rap: Number(p.value) || 0, rapTotal: Number(p.rap) || 0, count: Number(p.limiteds) || 0, complete: true };
      const queue = [];
      const known = new Map();
      const worker = async () => {
        while (queue.length) {
          const id = queue.shift();
          let sum = known.get(id) || null;
          if (!sum) {
            try { sum = await window.RoUtilityProfile.summarize(id); } catch {}
          }
          if (!s || s.token !== token) return;
          table.querySelectorAll(`.routility-forum-pills[data-user-id="${id}"]`).forEach(box => {
            box.textContent = '';
            if (!sum || sum.invalid || !window.RoUtilityProfile.valuePills) return;
            const made = window.RoUtilityProfile.valuePills(id, sum, box.dataset.name || '');
            for (const [node, kind] of [[made.value, 'value'], [made.rap, 'rap']]) {
              if (!node) continue;
              delete node.dataset.rtTip;
              node.classList.add('routility-forum-stat-' + kind);
              box.appendChild(node);
            }
            if (!document.hidden) box.classList.add('routility-reveal');
          });
        }
      };
      request({ type: 'playerLookup', ids }, r => r !== undefined).then((players) => {
        if (!s || s.token !== token) return;
        for (const id of ids) {
          const p = players && players[id];
          if (p) known.set(id, fromServer(p));
          queue.push(id);
        }
        queue.sort((a, b) => (known.has(b) ? 1 : 0) - (known.has(a) ? 1 : 0));
        Promise.all([worker(), worker()]);
      });
    }
    for (const id of ids) {
      primaryGroup(id).then(g => {
        if (!g || !s || s.token !== token) return;
        table.querySelectorAll(`.routility-forum-group[data-user-id="${id}"]`).forEach(box => {
          const a = el('a', 'content-link', g.name);
          a.href = `https://www.roblox.com/communities/${g.id}`;
          box.replaceChildren(a);
        });
      });
    }
  }

  function renderThread(r) {
    pageTitle(lt('Forum') + ' - Roblox');
    setCrumbs([]);
    const b = body();
    const titleBox = el('div', 'routility-forum-thread-head');
    const titleSk = sk(360, 30);
    titleSk.style.margin = '5px 0';
    titleBox.appendChild(titleSk);
    b.appendChild(titleBox);
    const actions = el('div', 'routility-forum-actions routility-forum-thread-actions');
    b.appendChild(actions);
    const table = el('table', 'routility-forum-table routility-forum-posts');
    const cols = el('colgroup');
    cols.append(el('col', 'routility-forum-col-author'), el('col'));
    table.appendChild(cols);
    const tbody = el('tbody');
    tbody.appendChild(threadBar(null));
    postSkeleton(tbody);
    tbody.appendChild(threadBar(null));
    table.appendChild(tbody);
    b.appendChild(table);
    const pagerSlot = el('div', 'routility-forum-pager-slot');
    b.appendChild(pagerSlot);
    const bottom = el('div', 'routility-forum-bottom');
    b.appendChild(bottom);
    const token = s.token;
    const fail = (text) => {
      titleBox.replaceChildren();
      titleBox.hidden = true;
      pagerSlot.textContent = '';
      bottom.textContent = '';
      table.replaceWith(emptyCard({ icon: 'regular-speech-bubble-align-center', title: lt('Thread not available'), text, actions: [homeButton()] }));
    };
    api('/threads/' + encodeURIComponent(r.id), { page: r.page }).then(res => {
      if (!s || s.token !== token) return;
      if (!res || res.status !== 200 || !res.data || !res.data.thread) return fail(errorText(res, res && res.status === 404 ? lt('This thread doesn’t exist.') : lt('Couldn’t load this thread. Refresh to try again.')));
      const th = res.data.thread;
      const posts = (Array.isArray(res.data.posts) ? res.data.posts : []).filter(p => p && p.id != null).map(p => Object.assign({}, p, { id: String(p.id) }));
      const page = Number(res.data.page) || r.page;
      const pages = Math.max(1, Number(res.data.pages) || 1);
      const f = FORUMS.get(th.forumId);
      const hiddenTitle = th.hidden || th.title == null;
      const hiddenWhy = th.hiddenReason || (posts[0] && posts[0].hiddenReason);
      const title = hiddenTitle ? lt(HIDDEN_THREAD[hiddenWhy] || HIDDEN_THREAD.reports) : String(th.title);
      pageTitle((hiddenTitle ? lt('Hidden thread') : title) + ' - Roblox');
      if (f) {
        setCrumbs([{ text: lt(f.section), path: '' }, { text: lt(f.name), path: encodeURIComponent(f.id) }]);
        bottom.replaceChildren(crumbTrail([{ text: 'RoUtility Forum', path: '' }, { text: lt(f.section), path: '' }, { text: lt(f.name), path: encodeURIComponent(f.id) }], 'routility-forum-crumbs-bottom', false));
      }
      const h2 = el('h2', 'routility-forum-thread-title content-emphasis' + (hiddenTitle ? ' routility-forum-title-hidden' : ''), title);
      const head = [h2];
      if (th.locked) {
        const lock = el('div', 'routility-forum-locked content-muted');
        lock.appendChild(el('span', 'routility-forum-icon routility-forum-icon-locked'));
        lock.appendChild(el('span', null, lt('This thread is locked. New replies are turned off.')));
        head.push(lock);
      }
      titleBox.replaceChildren(...head);
      if (!th.locked && !hiddenTitle) actions.appendChild(fbutton(lt('Reply'), true, () => navigate(withQuery('/forum/post', { thread: r.id }), { title, forumId: th.forumId }), 'regular-speech-bubble-align-center', 'large'));
      const nav = { prev: th.prevId != null ? String(th.prevId) : '', next: th.nextId != null ? String(th.nextId) : '' };
      tbody.replaceChildren(threadBar(nav));
      if (!posts.length) {
        const tr = el('tr', 'routility-forum-row');
        const td = el('td', 'routility-forum-message content-emphasis');
        td.colSpan = 2;
        td.appendChild(el('div', null, page > pages ? lt('There’s nothing on this page.') : lt('No posts in this thread.')));
        if (page > pages) td.appendChild(link(lt('Go to page 1'), 'thread/' + encodeURIComponent(r.id), 'content-link'));
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      posts.forEach((p, i) => {
        if (i) tbody.appendChild(spacerRow());
        tbody.appendChild(postRow(p));
      });
      tbody.appendChild(threadBar(nav));
      if (!document.hidden) tbody.classList.add('routility-reveal');
      pagerSlot.replaceChildren(pager(Math.min(page, pages), pages, (pg) => withQuery('thread/' + encodeURIComponent(r.id), { page: pg })));
      markThreadRead(String(th.id != null ? th.id : r.id));
      fillAuthors(table, posts, token);
      const target = location.hash && document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.classList.add('routility-forum-post-new');
      }
    });
  }

  function draftKey(r) {
    return DRAFT_KEY + (r.thread ? 'thread:' + r.thread : 'forum:' + r.forum);
  }

  function readDraft(r) {
    try { return JSON.parse(sessionStorage.getItem(draftKey(r)) || '{}') || {}; } catch { return {}; }
  }

  function saveDraft(r, d) {
    try {
      if (!d.title && !d.body) sessionStorage.removeItem(draftKey(r));
      else sessionStorage.setItem(draftKey(r), JSON.stringify(d));
    } catch {}
  }

  function field(label, control, counter) {
    const tr = el('tr', 'routility-forum-post routility-forum-form-row');
    const th = el('td', 'routility-forum-author-col routility-forum-form-label content-emphasis');
    th.appendChild(el('label', 'routility-forum-strong', label));
    tr.appendChild(th);
    const td = el('td', 'routility-forum-post-col routility-forum-form-field');
    td.appendChild(control);
    if (counter) td.appendChild(counter);
    tr.appendChild(td);
    return tr;
  }

  function composeBar(text) {
    const tr = el('tr', 'routility-forum-cat routility-forum-postbar');
    const td = el('td', 'routility-forum-compose-head');
    td.colSpan = 2;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  function renderCompose(r) {
    const isReply = !!r.thread;
    const f = FORUMS.get(r.forum);
    pageTitle((isReply ? lt('Reply') : lt('New Thread')) + ' - Roblox');
    const b = body();
    const head = el('div', 'routility-forum-thread-head');
    const h2 = el('h2', 'routility-forum-thread-title content-emphasis', isReply ? lt('Post a Reply') : lt('Post a New Thread'));
    head.appendChild(h2);
    b.appendChild(head);
    const table = el('table', 'routility-forum-table routility-forum-posts routility-forum-compose');
    const cols = el('colgroup');
    cols.append(el('col', 'routility-forum-col-author'), el('col'));
    table.appendChild(cols);
    const tbody = el('tbody');
    table.appendChild(tbody);
    b.appendChild(table);
    const token = s.token;
    const ctx = { title: '', forumId: r.forum };
    const st = history.state && history.state.compose;
    if (isReply && st && String(st.thread) === r.thread) Object.assign(ctx, { title: st.title || '', forumId: st.forumId || '' });

    const setTrail = () => {
      const ff = FORUMS.get(ctx.forumId);
      const trail = ff ? [{ text: lt(ff.section), path: '' }, { text: lt(ff.name), path: encodeURIComponent(ff.id) }] : [];
      if (isReply && ctx.title) trail.push({ text: ctx.title, path: 'thread/' + r.thread });
      trail.push({ text: isReply ? lt('Reply') : lt('New Thread') });
      setCrumbs(trail);
    };
    setTrail();

    const draw = () => {
      if (!s || s.token !== token) return;
      tbody.textContent = '';
      tbody.appendChild(composeBar(isReply ? (ctx.title ? lt('Re: {title}', { title: ctx.title }) : lt('Reply')) : f ? lt('New Thread in {forum}', { forum: lt(f.name) }) : lt('New Thread in the forum')));
      if (!s.user) {
        const tr = el('tr', 'routility-forum-row routility-forum-signin-row');
        const td = el('td', 'routility-forum-signin-cell');
        td.colSpan = 2;
        td.appendChild(signInCard());
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      const draft = readDraft(r);
      const who = el('div', 'routility-forum-poster routility-forum-compose-who');
      who.appendChild(headshotEl(myRobloxId(), 24));
      who.appendChild(profileLink(s.user.userId, s.user.username || s.user.displayName, 'content-link routility-forum-poster-name'));
      tbody.appendChild(field(lt('Author:'), who));
      let title = null;
      const titleCount = el('div', 'routility-forum-count content-muted');
      if (!isReply) {
        const wrap = el('div', 'foundation-web-input flex items-center width-full relative clip stroke-standard bg-none height-1000 radius-medium padding-x-medium stroke-contrast-alpha focus-within:stroke-system-emphasis');
        title = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis text-body-medium [appearance:none]');
        title.type = 'text';
        title.maxLength = TITLE_MAX;
        title.autocomplete = 'off';
        title.placeholder = lt('What’s your thread about?');
        title.setAttribute('aria-label', lt('Subject'));
        title.value = draft.title || '';
        wrap.appendChild(title);
        tbody.appendChild(field(lt('Subject:'), wrap, titleCount));
      }
      const msg = el('textarea', 'routility-forum-textarea content-emphasis text-body-medium');
      msg.maxLength = BODY_MAX;
      msg.rows = 12;
      msg.placeholder = isReply ? lt('Write your reply…') : lt('Write your post…');
      msg.setAttribute('aria-label', lt('Message'));
      msg.value = draft.body || '';
      const bodyCount = el('div', 'routility-forum-count content-muted');
      tbody.appendChild(field(lt('Message:'), msg, bodyCount));
      const errRow = el('tr', 'routility-forum-post routility-forum-form-row');
      errRow.appendChild(el('td', 'routility-forum-author-col'));
      const errTd = el('td', 'routility-forum-post-col');
      const err = el('div', 'routility-forum-form-error content-system-alert');
      errTd.appendChild(err);
      const buttons = el('div', 'routility-forum-form-buttons');
      const cancel = fbutton(lt('Cancel'), false, () => navigate(isReply ? '/forum/thread/' + r.thread : '/forum/' + encodeURIComponent(r.forum)));
      const post = fbutton(isReply ? lt('Post Reply') : lt('Post Thread'), true);
      buttons.append(cancel, post);
      errTd.appendChild(buttons);
      errRow.appendChild(errTd);
      tbody.appendChild(errRow);
      tbody.appendChild(composeBar(''));

      const update = () => {
        const tl = title ? title.value.trim().length : TITLE_MIN;
        const bl = msg.value.trim().length;
        if (title) titleCount.textContent = formatNumber(title.value.length) + ' / ' + formatNumber(TITLE_MAX);
        bodyCount.textContent = formatNumber(msg.value.length) + ' / ' + formatNumber(BODY_MAX);
        post.disabled = s.sending || tl < TITLE_MIN || tl > TITLE_MAX || bl < 1 || bl > BODY_MAX;
        saveDraft(r, { title: title ? title.value : '', body: msg.value });
      };
      if (title) title.addEventListener('input', update);
      msg.addEventListener('input', update);
      update();
      (title && !title.value ? title : msg).focus({ preventScroll: true });

      post.addEventListener('click', async () => {
        if (post.disabled) return;
        s.sending = true;
        err.textContent = '';
        post.label.textContent = lt('Posting…');
        update();
        const res = isReply
          ? await write('/threads/' + r.thread + '/posts', { body: msg.value.trim() })
          : await write('/threads', { forumId: r.forum, title: title.value.trim(), body: msg.value.trim() });
        s.sending = false;
        if (!s || s.token !== token) return;
        if (res && res.status === 200 && res.data) {
          saveDraft(r, {});
          if (isReply && res.data.post && res.data.post.id != null) return navigate(withQuery('/forum/thread/' + r.thread, { page: Number(res.data.page) || 1 }) + '#post-' + res.data.post.id);
          if (!isReply && res.data.thread && res.data.thread.id != null) return navigate('/forum/thread/' + res.data.thread.id);
          return navigate(isReply ? '/forum/thread/' + r.thread : '/forum/' + encodeURIComponent(r.forum));
        }
        post.label.textContent = isReply ? lt('Post Reply') : lt('Post Thread');
        update();
        if (res && res.status === 401) return notice(lt('Your forum sign-in ran out. Sign in again to post. Your text is saved.'), 'alert', signInLink());
        err.textContent = writeError(res, lt('Couldn’t post that. Try again in a moment.'));
      });
    };

    s.root.addEventListener('routility-forum-user', function onUser() {
      if (!s || s.token !== token) return s && s.root.removeEventListener('routility-forum-user', onUser);
      draw();
    });

    const start = () => s.meReady.then(() => { if (s && s.token === token) draw(); });
    tbody.appendChild(composeBar(''));
    const loadingRow = el('tr', 'routility-forum-row');
    const loadingCell = el('td', 'routility-forum-message');
    loadingCell.colSpan = 2;
    loadingCell.appendChild(sk(260, 14));
    loadingRow.appendChild(loadingCell);
    tbody.appendChild(loadingRow);
    if (isReply && !ctx.title) {
      api('/threads/' + r.thread, {}).then(res => {
        if (!s || s.token !== token) return;
        const th = res && res.status === 200 && res.data && res.data.thread;
        if (!th) {
          tbody.textContent = '';
          tbody.appendChild(composeBar(lt('Reply')));
          const row = el('tr', 'routility-forum-row routility-forum-state-row');
          const cell = el('td', 'routility-forum-message');
          cell.colSpan = 2;
          cell.appendChild(emptyState({ icon: 'regular-speech-bubble-align-center', title: lt('Thread not available'), text: errorText(res, lt('Couldn’t load this thread.')), actions: [homeButton()] }));
          row.appendChild(cell);
          tbody.appendChild(row);
          return;
        }
        if (th.locked) {
          tbody.textContent = '';
          tbody.appendChild(composeBar(lt('Reply')));
          const row = el('tr', 'routility-forum-row routility-forum-state-row');
          const cell = el('td', 'routility-forum-message');
          cell.colSpan = 2;
          cell.appendChild(emptyState({ icon: 'regular-x', title: lt('This thread is locked'), text: lt('New replies are turned off.'), actions: [fbutton(lt('Back to the thread'), false, () => navigate(forumHref('thread/' + r.thread)))] }));
          row.appendChild(cell);
          tbody.appendChild(row);
          return;
        }
        ctx.title = th.title == null ? lt('Hidden thread') : String(th.title);
        ctx.forumId = th.forumId;
        setTrail();
        start();
      });
    } else {
      start();
    }
  }

  function renderMissing() {
    pageTitle(lt('Forum') + ' - Roblox');
    setCrumbs([{ text: lt('Not found') }]);
    body().appendChild(emptyCard({ icon: 'regular-x', title: lt('This page doesn’t exist'), text: lt('The link may be old or mistyped.'), actions: [homeButton()] }));
  }

  function render() {
    if (!s) return;
    closeMenu();
    if (!s.signin) notice('');
    s.token = {};
    const r = route();
    if (r.view === 'index') renderIndex();
    else if (r.view === 'forum') renderForum(r);
    else if (r.view === 'search') renderSearch(r);
    else if (r.view === 'thread') renderThread(r);
    else if (r.view === 'compose') renderCompose(r);
    else renderMissing();
    ensureNav();
  }

  function navigate(href, compose) {
    const url = new URL(href, location.origin + '/forum/');
    const state = { routilityForum: true };
    if (compose) state.compose = Object.assign({ thread: url.searchParams.get('thread') }, compose);
    if (url.href !== location.href) history.pushState(state, '', url.pathname + url.search + url.hash);
    window.scrollTo(0, 0);
    render();
  }

  function onClick(e) {
    const a = e.target.closest && e.target.closest('a[data-forum-link]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href);
    if (!ROOT.test(url.pathname)) return;
    e.preventDefault();
    navigate(url.href);
  }

  function setup() {
    if (!ROOT.test(location.pathname) || s) return;
    const content = document.querySelector('#content');
    if (!content) return;
    s = { token: null, user: undefined, signin: null, sending: false };
    s.root = el('div', 'routility-injected routility-forum');
    s.root.appendChild(header());
    const box = el('div', 'routility-forum-notice');
    box.hidden = true;
    box.setAttribute('role', 'status');
    s.root.appendChild(box);
    s.root.appendChild(el('div', 'routility-forum-body'));
    s.root.appendChild(el('div', 'routility-forum-foot content-muted', lt('The RoUtility Forum is run by RoUtility and isn’t affiliated with Roblox.')));
    s.root.addEventListener('click', onClick);
    applyPrefs();
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-forum-ready');
    setInterval(tickClock, 15000);
    window.addEventListener('popstate', () => {
      if (ROOT.test(location.pathname)) render();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[AUTH_KEY] && s && !s.signin) loadMe();
    });
    s.meReady = loadMe();
    render();
  }

  function ensureTopLink() {
    const on = settings.forum !== false && settings.forumTopLink !== false;
    document.documentElement.classList.toggle('routility-forum-topbar', on);
    let mine = document.querySelector('.routility-forum-toplink');
    if (!on) {
      if (mine) mine.remove();
      return;
    }
    const robux = document.getElementById('navigation-robux-container');
    if (!robux) return;
    if (!mine) {
      mine = el('li', 'routility-injected routility-forum-toplink');
      const a = el('a', 'font-header-2 nav-menu-title text-header', lt('Forum'));
      a.href = 'https://www.roblox.com/forum';
      mine.appendChild(a);
    }
    const a = mine.querySelector('a');
    if (a && a.textContent !== lt('Forum')) a.textContent = lt('Forum');
    if (robux.nextElementSibling !== mine) robux.after(mine);
  }

  function ensureNav() {
    ensureTopLink();
    if (settings.forum === false || settings.forumNav === false) {
      document.querySelectorAll('.routility-forum-nav').forEach(n => n.remove());
      return;
    }
    const communities = document.querySelector('.left-nav nav a[href$="/communities"]') || [...document.querySelectorAll('nav a[href$="/communities"]')].find(a => /Communities|Groups/.test(a.textContent));
    if (!communities) return;
    const li = communities.closest('li');
    let mine = li.parentElement.querySelector(':scope > .routility-forum-nav');
    const here = ROOT.test(location.pathname);
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-forum-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/forum';
      a.querySelectorAll('.foundation-web-badge').forEach(b => (b.closest('span.fill') || b).remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-forum-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => /^(Communities|Groups)$/.test(sp.textContent.trim()));
      if (label) label.textContent = lt('Forum');
    }
    if (li.nextElementSibling !== mine) li.after(mine);
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
  }

  let navObserver = null;

  function startNav() {
    if (navObserver) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    startNav();
    if (settings.forum !== false) setup();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    const was = settings.forum !== false;
    const before = s ? pref('forumAvatars') : null;
    settings = changes.routilitySettings.newValue || {};
    const now = settings.forum !== false;
    ensureNav();
    applyPrefs();
    paintCustomize();
    if (s && before !== null && before !== pref('forumAvatars') && pref('forumAvatars') !== 'off') swapAvatars();
    if (was !== now && ROOT.test(location.pathname)) {
      if (now) setup();
      else location.reload();
    }
  });

  window.RoUtilityForum = { setup };
})();
