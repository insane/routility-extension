(function () {
  'use strict';

  const { el, formatNumber, verifiedBadge, request, json, presence } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const SKIP = '.routility-hovercard, #header, .rbx-header, #navigation, .rbx-left-col, .friends-carousel-container, .friend-carousel-container, .navbar-search, [role="dialog"], .modal, .routility-search-menu';
  const OPEN_DELAY = 450;
  const TTL = 2 * 60 * 1000;
  const cache = new Map();
  let on = true;
  let timer = null;
  let hideTimer = null;
  let pending = null;
  let card = null;
  let cardFor = null;

  chrome.storage.local.get('routilitySettings', (s) => { on = (s.routilitySettings || {}).profilePreviews !== false; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).profilePreviews !== false;
    if (!on) close();
  });

  let insightCsrf = '';

  async function friendsSince(id) {
    const url = 'https://apis.roblox.com/profile-insights-api/v1/multiProfileInsights';
    const body = JSON.stringify({ userIds: [Number(id)], rankingStrategy: 'tc_info_boost', count: 8 });
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, insightCsrf ? { 'x-csrf-token': insightCsrf } : {}), body });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { insightCsrf = r.headers.get('x-csrf-token'); continue; }
        if (!r.ok) return null;
        const d = await r.json();
        const u = (d.userInsights || []).find(x => String(x.targetUser) === String(id));
        const age = ((u && u.profileInsights) || []).map(p => p.friendshipAgeInsight).find(Boolean);
        const sec = Number(age && age.friendsSinceDateTime && age.friendsSinceDateTime.seconds);
        return sec > 0 ? new Date(sec * 1000).toISOString() : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function userId(a) {
    const m = (a.getAttribute('href') || '').match(/^(?:https:\/\/www\.roblox\.com)?\/users\/(\d+)\/profile/i);
    return m ? m[1] : null;
  }

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function load(id) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < TTL) return hit.job;
    const job = (async () => {
      const [user, heads, pres, friends, followers, mine] = await Promise.all([
        json(`https://users.roblox.com/v1/users/${id}`),
        request({ type: 'getHeadshots', ids: [id] }),
        presence([id]),
        json(`https://friends.roblox.com/v1/users/${id}/friends/count`),
        json(`https://friends.roblox.com/v1/users/${id}/followers/count`),
        window.RoUtilitySearch?.myFriends ? window.RoUtilitySearch.myFriends().catch(() => []) : [],
      ]);
      if (!user || !user.id) return null;
      const friend = (mine || []).some(f => String(f.id) === String(id));
      const since = friend ? await friendsSince(id) : null;
      return {
        since,
        user,
        head: (heads || {})[id] || '',
        presence: pres.get(String(id)) || null,
        friends: friends && typeof friends.count === 'number' ? friends.count : null,
        followers: followers && typeof followers.count === 'number' ? followers.count : null,
        friend: (mine || []).some(f => String(f.id) === String(id)),
      };
    })();
    cache.set(id, { at: Date.now(), job });
    job.then(d => { if (!d) cache.delete(id); });
    return job;
  }

  function age(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (!(days >= 0)) return '';
    if (days < 31) return ltn(days, '{n} day', '{n} days');
    const years = Math.floor(days / 365.25);
    if (years < 1) {
      const months = Math.floor(days / 30.44);
      return ltn(months, '{n} month', '{n} months');
    }
    return ltn(years, '{n} year', '{n} years');
  }

  function joined(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return lt('Joined {date} • {age}', { date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), age: age(iso) });
  }

  function status(p, banned) {
    if (banned) return { kind: 'banned', text: lt('Banned') };
    const type = p ? p.userPresenceType : 0;
    if (type === 2) return { kind: 'game', text: p.lastLocation ? lt('Playing {game}', { game: p.lastLocation }) : lt('In a game'), place: p.rootPlaceId || p.placeId };
    if (type === 3) return { kind: 'studio', text: p.lastLocation ? lt('In Studio • {game}', { game: p.lastLocation }) : lt('In Studio') };
    if (type === 1) return { kind: 'online', text: lt('Online') };
    return { kind: 'offline', text: lt('Offline') };
  }

  function skeleton() {
    const body = el('div', 'routility-hc-body');
    const top = el('div', 'routility-hc-top');
    top.appendChild(el('span', 'routility-sk routility-hc-sk-face'));
    const names = el('div', 'routility-hc-names');
    names.append(el('span', 'routility-sk routility-hc-sk-line'), el('span', 'routility-sk routility-hc-sk-line routility-hc-sk-short'));
    top.appendChild(names);
    body.append(top, el('span', 'routility-sk routility-hc-sk-line routility-hc-sk-wide'), el('span', 'routility-sk routility-hc-sk-line routility-hc-sk-mid'));
    return body;
  }

  function filled(id, d) {
    const u = d.user;
    const body = el('div', 'routility-hc-body routility-hc-in');
    const top = el('a', 'routility-hc-top');
    top.href = `https://www.roblox.com/users/${id}/profile`;
    const faceBox = el('span', 'routility-hc-face-box');
    const face = el('span', 'thumbnail-2d-container routility-hc-face');
    if (d.head) {
      const img = el('img');
      img.alt = '';
      img.src = d.head;
      face.appendChild(img);
    }
    faceBox.appendChild(face);
    const st = status(d.presence, u.isBanned);
    if (st.kind !== 'offline' && st.kind !== 'banned') faceBox.appendChild(el('span', `routility-hc-dot routility-hc-${st.kind}`));
    top.appendChild(faceBox);
    const names = el('div', 'routility-hc-names');
    const name = el('div', 'routility-hc-name');
    name.appendChild(el('span', 'text-truncate-end', u.displayName || u.name));
    if (u.hasVerifiedBadge) name.appendChild(verifiedBadge());
    names.appendChild(name);
    const handle = el('div', 'routility-hc-user');
    handle.appendChild(el('span', 'text-truncate-end', '@' + u.name));
    if (d.friend) handle.appendChild(el('span', 'routility-hc-tag', lt('Friend')));
    names.appendChild(handle);
    top.appendChild(names);
    body.appendChild(top);
    const line = st.place ? el('a', `routility-hc-status routility-hc-status-${st.kind}`) : el('div', `routility-hc-status routility-hc-status-${st.kind}`);
    if (st.place) line.href = `https://www.roblox.com/games/${st.place}`;
    line.textContent = st.text;
    body.appendChild(line);
    const counts = [];
    if (d.friends !== null) counts.push(ltn(d.friends, '{n} friend', '{n} friends', { n: formatNumber(d.friends) }));
    if (d.followers !== null) counts.push(ltn(d.followers, '{n} follower', '{n} followers', { n: formatNumber(d.followers) }));
    if (counts.length) body.appendChild(el('div', 'routility-hc-meta', counts.join(' • ')));
    const j = joined(u.created);
    if (j) body.appendChild(el('div', 'routility-hc-meta', j));
    if (d.since) {
      const when = new Date(d.since);
      const meta = el('div', 'routility-hc-meta routility-hc-since', lt('Friends since {date} • {age}', { date: when.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), age: age(d.since) }));
      body.appendChild(meta);
    }
    const bio = (u.description || '').trim();
    if (bio) body.appendChild(el('div', 'routility-hc-bio', bio));
    return body;
  }

  function place(anchor) {
    if (!card) return;
    const r = anchor.getBoundingClientRect();
    const w = card.offsetWidth;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    card.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, r.left))) + 'px';
    if (card.dataset.side === 'above' || (!card.dataset.side && vh - r.bottom < 260 && r.top > vh - r.bottom)) {
      card.dataset.side = 'above';
      card.style.top = '';
      card.style.bottom = Math.round(vh - r.top + 6) + 'px';
    } else {
      card.dataset.side = 'below';
      card.style.bottom = '';
      card.style.top = Math.round(r.bottom + 6) + 'px';
    }
  }

  async function open(anchor, id) {
    close();
    if (!anchor.isConnected) return;
    cardFor = anchor;
    card = el('div', 'routility-injected routility-hovercard bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    card.setAttribute('role', 'tooltip');
    const job = load(id);
    const current = card;
    let ready = null;
    job.then(d => { ready = d; });
    await Promise.resolve();
    if (card !== current) return;
    if (ready) current.appendChild(filled(id, ready));
    else current.appendChild(skeleton());
    document.body.appendChild(current);
    place(anchor);
    if (ready) return;
    const d = await job;
    if (card !== current) return;
    if (!d) return close();
    current.textContent = '';
    current.appendChild(filled(id, d));
    place(anchor);
  }

  function close() {
    clearTimeout(hideTimer);
    card?.remove();
    card = null;
    cardFor = null;
  }

  function scheduleClose() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(close, 180);
  }

  document.addEventListener('mouseover', (e) => {
    if (!on) return;
    const t = e.target;
    if (card && card.contains(t)) {
      clearTimeout(hideTimer);
      return;
    }
    const a = t.closest?.('a[href*="/users/"]');
    if (a && a === cardFor) {
      clearTimeout(hideTimer);
      return;
    }
    if (!a || a === pending) return;
    const id = userId(a);
    if (!id || id === me() || a.closest(SKIP)) return;
    const here = location.pathname.match(/^\/users\/(\d+)\/profile/i);
    if (here && here[1] === id && !a.closest('.routility-mutual-pop')) return;
    clearTimeout(timer);
    pending = a;
    const quick = !!card;
    if (quick) clearTimeout(hideTimer);
    timer = setTimeout(() => {
      pending = null;
      if (a.matches(':hover')) open(a, id);
      else if (quick) scheduleClose();
    }, quick ? 90 : OPEN_DELAY);
  });

  document.addEventListener('mouseout', (e) => {
    const from = e.target.closest?.('a[href*="/users/"], .routility-hovercard');
    if (!from) return;
    const to = e.relatedTarget;
    if (to && from.contains(to)) return;
    if (from === pending) {
      clearTimeout(timer);
      pending = null;
    }
    if (card && (from === cardFor || from === card) && !(to && (card.contains(to) || cardFor?.contains(to)))) scheduleClose();
  });

  document.addEventListener('mousedown', (e) => {
    if (card && !card.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', () => { if (card) close(); }, true);
  window.addEventListener('popstate', close);

  window.RoUtilityHoverCard = { close, age };
})();
