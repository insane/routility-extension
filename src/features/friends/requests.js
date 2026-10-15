(function () {
  'use strict';

  const { el, onFrame, formatNumber, chunks } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PAGE = 18;
  const DAY = 86400000;
  const STATS_KEY = 'routilityUserStats';
  const BADGES = [['verified', LT('Verified')], ['plus', LT('Roblox Plus')], ['premium', LT('Premium')], ['admin', LT('Admin')]];
  const RANGES = [['mutuals', LT('Mutual Friends')], ['friends', LT('Friends')], ['followers', LT('Followers')], ['following', LT('Following')]];
  const COUNT_PATH = { friends: 'friends/count', followers: 'followers/count', following: 'followings/count' };
  const MODES = [{ value: 'any', label: LT('Any') }, { value: 'yes', label: LT('Only') }, { value: 'no', label: LT('Hide') }];
  let rf = null;

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const F = () => window.RoUtilityFriends;

  function blank() {
    return {
      badges: { verified: 'any', plus: 'any', premium: 'any', admin: 'any' },
      ranges: { mutuals: ['', ''], friends: ['', ''], followers: ['', ''], following: ['', ''] },
      joined: ['', ''],
    };
  }

  function copy(f) {
    return JSON.parse(JSON.stringify(f));
  }

  function activeCount(f) {
    let n = 0;
    for (const v of Object.values(f.badges)) if (v !== 'any') n++;
    for (const [lo, hi] of Object.values(f.ranges)) if (lo !== '' || hi !== '') n++;
    if (f.joined[0] || f.joined[1]) n++;
    return n;
  }

  function onRequestsTab() {
    return /^#!\/friend-requests\b/.test(location.hash || '');
  }

  async function getJson(url, tries = 2) {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.status === 429 || r.status >= 500) { await wait(Math.min(15000, 1500 * 2 ** i)); continue; }
        return r.ok ? await r.json() : null;
      } catch {
        await wait(1500);
      }
    }
    return null;
  }

  function loadStats() {
    return new Promise(r => {
      try { chrome.storage.local.get(STATS_KEY, v => r(v[STATS_KEY] || {})); } catch { r({}); }
    });
  }

  function saveStats(s) {
    const now = Date.now();
    const keep = {};
    const entries = Object.entries(s.stats).filter(([, v]) => v && (v.created || Object.values(v).some(x => Array.isArray(x) && now - x[1] < DAY)));
    for (const [id, v] of entries.slice(-8000)) keep[id] = v;
    try { chrome.storage.local.set({ [STATS_KEY]: keep }); } catch {}
  }

  function statOf(s, id, kind) {
    const v = s.stats[id] && s.stats[id][kind];
    return Array.isArray(v) && Date.now() - v[1] < DAY ? v[0] : undefined;
  }

  function setStat(s, id, kind, value) {
    s.stats[id] = s.stats[id] || {};
    s.stats[id][kind] = [value, Date.now()];
  }

  async function chunkAt(s, i) {
    while (s.chunks.length <= i && !s.done) {
      if (!s.fetching) {
        s.fetching = (async () => {
          const r = await getJson(`https://friends.roblox.com/v1/my/friends/requests?limit=100${s.cursor ? '&cursor=' + encodeURIComponent(s.cursor) : ''}`, 8);
          if (!r) { s.done = true; s.partial = true; return; }
          const chunk = [];
          for (const d of r.data || []) {
            const id = Number(d.id || (d.friendRequest && d.friendRequest.senderId));
            if (id > 0 && !s.gone.has(id)) {
              const names = (d.mutualFriendsList || []).map(m => typeof m === 'string' ? m : m && (m.displayName || m.name || m.username)).filter(Boolean);
              const req = d.friendRequest || {};
              chunk.push({ id, mutuals: (d.mutualFriendsList || []).length, names, sentAt: req.sentAt || null, source: req.originSourceType || '' });
              if (req.sentAt) s.sent.set(id, { at: req.sentAt, source: req.originSourceType || '' });
            }
          }
          s.chunks.push(chunk);
          s.cursor = r.nextPageCursor || '';
          if (!s.cursor) s.done = true;
        })().finally(() => { s.fetching = null; });
      }
      await s.fetching;
    }
    return s.chunks[i] ? s.chunks[i].filter(r => !s.gone.has(r.id)) : null;
  }

  async function loadProfiles(s, ids) {
    const tryPost = async (url, body, times) => {
      let res = null;
      for (let tries = 0; tries < times && !res; tries++) {
        if (tries) await wait(1500 * 2 ** (tries - 1));
        res = await F().robloxPost(url, body);
      }
      return res;
    };
    const need = ids.filter(id => !s.users.has(id));
    const profiles = await Promise.all(chunks(need, 100).map(chunk => tryPost('https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles', { userIds: chunk, fields: ['names.combinedName', 'names.username', 'isVerified', 'isDeleted', 'hasRobloxSubscription'] }, 5)));
    if (rf !== s) return;
    for (const res of profiles) {
      for (const p of (res && res.profileDetails) || []) {
        const id = Number(p.userId);
        const n = p.names || {};
        if (p.isDeleted || !n.username) continue;
        s.users.set(id, { name: n.username, displayName: n.combinedName || n.username, hasVerifiedBadge: !!p.isVerified });
        if (p.hasRobloxSubscription) s.plus.add(id);
      }
    }
    const banned = ids.filter(id => !s.users.has(id));
    const gone = await Promise.all(chunks(banned, 100).map(chunk => tryPost('https://users.roblox.com/v1/users', { userIds: chunk, excludeBannedUsers: false }, 4)));
    if (rf !== s) return;
    for (const res of gone) for (const u of (res && res.data) || []) s.users.set(Number(u.id), { name: u.name || '', displayName: u.displayName || u.name || '', hasVerifiedBadge: !!u.hasVerifiedBadge, deleted: true });
  }

  function nameHit(u, q) {
    return !!u && `${u.name} ${u.displayName}`.toLowerCase().includes(q);
  }

  function keepBadge(mode, has) {
    if (mode === 'yes') return has === true;
    if (mode === 'no') return has !== true;
    return true;
  }

  function inRange(v, [lo, hi]) {
    if (lo === '' && hi === '') return true;
    if (!Number.isFinite(v)) return false;
    if (lo !== '' && v < Number(lo)) return false;
    if (hi !== '' && v > Number(hi)) return false;
    return true;
  }

  async function created(s, id) {
    const c = s.stats[id] && s.stats[id].created;
    if (c) return Date.parse(c);
    const u = await getJson(`https://users.roblox.com/v1/users/${id}`);
    if (!u || !u.created) return null;
    s.stats[id] = s.stats[id] || {};
    s.stats[id].created = u.created;
    return Date.parse(u.created);
  }

  async function atOrAfter(s, id, ts) {
    const b = s.bounds[ts] || (s.bounds[ts] = { below: 0, above: Infinity });
    if (id <= b.below) return false;
    if (id >= b.above) return true;
    const c = await created(s, id);
    if (c === null) return false;
    if (c >= ts) b.above = Math.min(b.above, id);
    else b.below = Math.max(b.below, id);
    return c >= ts;
  }

  async function splitAt(s, sorted, ts) {
    let a = 0;
    let b = sorted.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if (await atOrAfter(s, sorted[m].id, ts)) b = m;
      else a = m + 1;
    }
    return a;
  }

  async function joinedFilter(s, list, from, to) {
    const sorted = list.slice().sort((a, b) => a.id - b.id);
    const lo = from ? await splitAt(s, sorted, from) : 0;
    const hi = to ? await splitAt(s, sorted, to) : sorted.length;
    const keep = new Set(sorted.slice(lo, hi).map(r => r.id));
    return list.filter(r => keep.has(r.id));
  }

  async function fetchStat(id, kind) {
    if (kind === 'premium') {
      const v = await getJson(`https://premiumfeatures.roblox.com/v1/users/${id}/validate-membership`);
      return typeof v === 'boolean' ? v : null;
    }
    const v = await getJson(`https://friends.roblox.com/v1/users/${id}/${COUNT_PATH[kind]}`);
    return v && Number.isFinite(v.count) ? v.count : null;
  }

  async function perUser(s, job, list, kind) {
    const need = list.filter(r => statOf(s, r.id, kind) === undefined);
    let i = 0;
    const worker = async () => {
      while (i < need.length && s.job === job) {
        const r = need[i++];
        const v = await fetchStat(r.id, kind);
        if (v !== null) setStat(s, r.id, kind, v);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  async function run(s) {
    const job = {};
    s.job = job;
    s.matches = [];
    s.scanning = true;
    s.checked = 0;
    s.page = 0;
    s.confirm = false;
    s.note = '';
    render(s);
    const f = s.filters;
    const from = f.joined[0] ? Date.parse(f.joined[0]) : null;
    const to = f.joined[1] ? Date.parse(f.joined[1]) + DAY : null;
    const kinds = [];
    if (f.badges.premium !== 'any') kinds.push(['premium', null]);
    for (const kind of ['friends', 'followers', 'following']) {
      const range = f.ranges[kind];
      if (range[0] !== '' || range[1] !== '') kinds.push([kind, range]);
    }
    for (let i = 0; ; i++) {
      const chunk = await chunkAt(s, i);
      if (s.job !== job) return;
      if (!chunk) break;
      await loadProfiles(s, chunk.map(r => r.id));
      if (s.job !== job) return;
      const q = s.query;
      let list = chunk.filter(r => inRange(r.mutuals, f.ranges.mutuals)
        && (!q || nameHit(s.users.get(r.id), q))
        && keepBadge(f.badges.verified, (s.users.get(r.id) || {}).hasVerifiedBadge)
        && keepBadge(f.badges.plus, s.plus.has(r.id)));
      if (f.badges.admin !== 'any' && list.length) {
        const ids = list.map(r => r.id).filter(id => !s.adminChecked.has(id));
        if (ids.length) {
          const admins = await F().adminSet(ids);
          for (const id of ids) s.adminChecked.add(id);
          for (const id of admins) s.admins.add(id);
        }
        list = list.filter(r => keepBadge(f.badges.admin, s.admins.has(r.id)));
      }
      if ((from || to) && list.length) list = await joinedFilter(s, list, from, to);
      for (const [kind, range] of kinds) {
        if (s.job !== job || !list.length) break;
        await perUser(s, job, list, kind);
        list = list.filter(r => (range ? inRange(statOf(s, r.id, kind), range) : keepBadge(f.badges.premium, statOf(s, r.id, kind))));
      }
      if (s.job !== job) return;
      s.checked += chunk.length;
      if (list.length) {
        s.matches.push(...list);
        render(s, true);
      } else {
        paintCount(s);
      }
      if (i % 5 === 4) saveStats(s);
    }
    s.scanning = false;
    saveStats(s);
    render(s, true);
  }

  async function decline(s, id) {
    for (let tries = 0; tries < 5; tries++) {
      const res = await F().robloxPost(`https://friends.roblox.com/v1/users/${id}/decline-friend-request`, {});
      if (res) return true;
      await wait(1500 * 2 ** tries);
    }
    return false;
  }

  async function act(s, r, li, accept) {
    const buttons = li.querySelectorAll('.avatar-card-btns button');
    const pressed = li.querySelector(accept ? '.accept-friend' : '.ignore-friend');
    li.querySelector('.routility-rf-error')?.remove();
    buttons.forEach(b => { b.disabled = true; });
    pressed?.classList.add('routility-pending');
    const ok = accept ? !!(await F().robloxPost(`https://friends.roblox.com/v1/users/${r.id}/accept-friend-request`, {})) : await decline(s, r.id);
    pressed?.classList.remove('routility-pending');
    if (!ok) {
      buttons.forEach(b => { b.disabled = false; });
      const err = el('div', 'routility-injected routility-rf-error', accept ? lt('Couldn\u2019t accept. Try again.') : lt('Couldn\u2019t ignore. Try again.'));
      li.querySelector('.avatar-card-container')?.appendChild(err);
      setTimeout(() => err.remove(), 5000);
      return;
    }
    s.gone.add(r.id);
    s.matches = s.matches.filter(x => x.id !== r.id);
    li.classList.add('routility-rf-gone');
    setTimeout(() => render(s, true), 180);
  }

  async function ignoreMatches(s) {
    if (s.bulk || !s.matches.length) return;
    if (!s.confirm) {
      s.confirm = true;
      paintActions(s);
      clearTimeout(s.confirmTimer);
      s.confirmTimer = setTimeout(() => { s.confirm = false; paintActions(s); }, 4000);
      return;
    }
    clearTimeout(s.confirmTimer);
    s.confirm = false;
    const queue = s.matches.slice();
    s.bulk = { done: 0, total: queue.length };
    s.note = '';
    s.noteBad = false;
    paintActions(s);
    let i = 0;
    let ok = 0;
    let bad = 0;
    const worker = async () => {
      while (i < queue.length && rf === s) {
        const r = queue[i++];
        if (await decline(s, r.id)) {
          s.gone.add(r.id);
          s.matches = s.matches.filter(x => x.id !== r.id);
          ok++;
        } else bad++;
        s.bulk.done++;
        paintActions(s);
        if (s.bulk.done % 6 === 0) render(s, true);
      }
    };
    await Promise.all(Array.from({ length: 2 }, worker));
    if (rf !== s) return;
    s.bulk = null;
    s.note = bad ? lt('Ignored {n} \u00b7 {failed} didn’t work, try again', { n: formatNumber(ok), failed: formatNumber(bad) }) : ltn(ok, 'Ignored {n} request', 'Ignored {n} requests', { n: formatNumber(ok) });
    s.noteBad = bad > 0;
    paintActions(s);
    render(s, true);
    paintCount(s);
  }

  const CENTRAL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function centralOffset(ms) {
    const p = Object.fromEntries(CENTRAL.formatToParts(new Date(ms)).map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }

  function sentMs(iso) {
    const raw = new Date(iso).getTime();
    if (!Number.isFinite(raw)) return NaN;
    let fixed = raw - centralOffset(raw);
    fixed = raw - centralOffset(fixed);
    return fixed <= Date.now() + 120000 ? fixed : raw;
  }

  function since(iso) {
    const ms = Date.now() - sentMs(iso);
    if (!Number.isFinite(ms)) return '';
    const m = Math.floor(ms / 60000);
    if (m < 1) return lt('just now');
    if (m < 60) return ltn(m, '{n}m ago', '{n}m ago');
    const h = Math.floor(m / 60);
    if (h < 24) return ltn(h, '{n}h ago', '{n}h ago');
    const d = Math.floor(h / 24);
    if (d < 30) return ltn(d, '{n} day ago', '{n} days ago');
    const mo = Math.floor(d / 30.4);
    if (mo < 12) return ltn(mo, '{n} month ago', '{n} months ago');
    const y = Math.floor(d / 365);
    return ltn(y, '{n} year ago', '{n} years ago');
  }

  function sentLine(info) {
    const line = el('div', 'avatar-card-label routility-injected routility-req-sent', lt('Sent {time}', { time: since(info.at) }));
    const when = new Date(sentMs(info.at)).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
    const via = info.source ? info.source.replace(/([a-z])([A-Z])/g, '$1 $2') : '';
    line.dataset.rtTip = via ? `${when}\n${lt('via {source}', { source: via })}` : when;
    return line;
  }

  let sentBusy = false;

  async function markNative(s) {
    const cards = [...document.querySelectorAll('#friends-web-app .tab-pane.active li')].filter(li => !li.closest('.routility-rf-list') && li.querySelector('.avatar-card-caption') && !li.querySelector('.routility-req-sent'));
    if (!cards.length) return;
    const idOf = (li) => Number((li.querySelector('a[href*="/users/"]')?.getAttribute('href') || '').match(/\/users\/(\d+)/)?.[1]);
    let missing = cards.some(li => !s.sent.has(idOf(li)));
    if (missing && !sentBusy) {
      sentBusy = true;
      try {
        for (let i = s.chunks.length; i < 10 && missing && !s.done && rf === s; i++) {
          await chunkAt(s, i);
          missing = cards.some(li => !s.sent.has(idOf(li)));
        }
      } finally {
        sentBusy = false;
      }
    }
    if (rf !== s) return;
    for (const li of cards) {
      const info = s.sent.get(idOf(li));
      const label = li.querySelector('.avatar-card-caption .avatar-card-label');
      if (info && label && !li.querySelector('.routility-req-sent')) label.after(sentLine(info));
    }
  }

  function requestCard(s, r) {
    const u = s.users.get(r.id) || { name: '', displayName: '' };
    const li = el('li', 'list-item avatar-card routility-injected routility-rf-card');
    li.id = 'routility-rf-' + r.id;
    const container = el('div', 'avatar-card-container');
    const content = el('div', 'avatar-card-content');
    const avatar = el('div', 'avatar avatar-card-fullbody');
    const href = u.deleted ? `/users/${r.id}/profile#routility-user=${r.id}` : `/users/${r.id}/profile`;
    const link = el('a', 'avatar-card-link');
    link.href = href;
    const thumb = s.thumbs.get(r.id);
    const holder = el('span', 'thumbnail-2d-container avatar-card-image' + (thumb === 'blocked' ? ' icon-blocked' : ''));
    const img = el('img');
    img.alt = '';
    if (thumb && thumb !== 'blocked') img.src = thumb;
    holder.appendChild(img);
    link.appendChild(holder);
    avatar.append(link, el('div', 'avatar-status'));
    const caption = el('div', 'avatar-card-caption');
    const span = el('span');
    const names = el('div', 'avatar-name-container');
    const name = el('a', 'text-overflow avatar-name', u.displayName || u.name || String(r.id));
    name.href = href;
    names.appendChild(name);
    if (u.hasVerifiedBadge) names.appendChild(window.RoUtilityUI.verifiedBadge());
    if (s.plus.has(r.id)) names.appendChild(F().plusIcon());
    if (s.admins.has(r.id)) names.appendChild(window.RoUtilityUI.adminBadge());
    span.append(names, el('div', 'avatar-card-label', u.name ? '@' + u.name : String(r.id)));
    if (r.sentAt) span.appendChild(sentLine({ at: r.sentAt, source: r.source }));
    if (u.deleted) span.appendChild(el('div', 'avatar-card-label text-error routility-terminated-label', lt('Terminated')));
    caption.appendChild(span);
    if (r.mutuals) {
      const foot = el('div', 'avatar-card-footer avatar-card-label');
      const label = el('span', 'mutual-friends-tooltip-label', ltn(r.mutuals, '{n} mutual friend', '{n} mutual friends', { n: formatNumber(r.mutuals) }));
      if (r.names && r.names.length) label.dataset.rtTip = r.names.join('\n');
      foot.appendChild(label);
      caption.appendChild(foot);
    }
    content.append(avatar, caption);
    const btns = el('div', 'avatar-card-btns');
    const ignore = el('button', 'ignore-friend btn-secondary-md btn-min-width', lt('Ignore'));
    ignore.type = 'button';
    ignore.addEventListener('click', () => act(s, r, li, false));
    const accept = el('button', 'accept-friend btn-cta-md btn-min-width', lt('Accept'));
    accept.type = 'button';
    accept.addEventListener('click', () => act(s, r, li, true));
    btns.append(ignore, accept);
    container.append(content, btns);
    li.appendChild(container);
    return li;
  }

  function skeleton() {
    const li = el('li', 'list-item avatar-card routility-injected routility-rf-card routility-rf-sk');
    li.setAttribute('aria-hidden', 'true');
    const container = el('div', 'avatar-card-container');
    const content = el('div', 'avatar-card-content');
    const avatar = el('div', 'avatar avatar-card-fullbody');
    avatar.appendChild(el('span', 'thumbnail-2d-container avatar-card-image routility-rf-sk-fill'));
    const caption = el('div', 'avatar-card-caption');
    const span = el('span');
    const names = el('div', 'avatar-name-container');
    names.appendChild(el('span', 'routility-rf-sk-fill routility-rf-sk-name'));
    const handle = el('div', 'avatar-card-label');
    handle.appendChild(el('span', 'routility-rf-sk-fill routility-rf-sk-handle'));
    span.append(names, handle);
    caption.appendChild(span);
    content.append(avatar, caption);
    const btns = el('div', 'avatar-card-btns');
    for (const cls of ['btn-secondary-md', 'btn-cta-md']) {
      const b = el('button', cls + ' btn-min-width routility-rf-sk-btn', ' ');
      b.type = 'button';
      b.tabIndex = -1;
      b.disabled = true;
      btns.appendChild(b);
    }
    container.append(content, btns);
    li.appendChild(container);
    return li;
  }

  function retryThumbs(s, ids, attempt) {
    if (!ids.length || attempt > 4) return;
    setTimeout(async () => {
      if (rf !== s) return;
      const got = await F().headshots(ids);
      if (rf !== s) return;
      const still = [];
      for (const id of ids) {
        const url = got.get(id);
        if (!url) { still.push(id); continue; }
        s.thumbs.set(id, url);
        const holder = document.querySelector(`#routility-rf-${id} .avatar-card-image`);
        const img = holder && holder.querySelector('img');
        if (!img) continue;
        if (url === 'blocked') holder.classList.add('icon-blocked');
        else img.src = url;
      }
      retryThumbs(s, still, attempt + 1);
    }, 2500 * attempt);
  }

  function hosts() {
    const pane = document.querySelector('#friends-web-app .tab-pane.active');
    const content = pane && pane.querySelector('.friends-content');
    const native = content && content.querySelector('ul.hlist.avatar-cards:not(.routility-rf-list)');
    if (!content || !native) return null;
    let list = content.querySelector('.routility-rf-list');
    let pager = pane.querySelector('.routility-rf-pager');
    if (!list) {
      list = el('ul', 'hlist avatar-cards routility-injected routility-rf-list');
      native.after(list);
    }
    if (!pager) {
      pager = el('div', 'pager-holder routility-injected routility-rf-pager');
      const nativePager = pane.querySelector('.pager-holder:not(.routility-rf-pager)');
      if (nativePager) nativePager.after(pager);
      else content.after(pager);
    }
    return { list, pager };
  }

  async function render(s, keepPage) {
    if (rf !== s || !s.on) return;
    const h = hosts();
    if (!h) return;
    const { list, pager } = h;
    paintCount(s);
    paintActions(s);
    const pages = Math.max(1, Math.ceil(s.matches.length / PAGE));
    s.page = keepPage ? Math.min(s.page, pages - 1) : 0;
    const slice = s.matches.slice(s.page * PAGE, s.page * PAGE + PAGE);
    const short = s.scanning && slice.length < PAGE;
    const key = [s.page, slice.map(r => r.id).join(','), short ? 'more' : '', s.scanning || slice.length ? '' : 'empty'].join('|');
    paintPager(s, pager, pages, list);
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    if (!slice.length && !s.scanning) {
      list.textContent = '';
      const empty = el('li', 'routility-injected routility-rf-empty');
      const filtered = activeCount(s.filters) > 0;
      empty.appendChild(el('div', 'text-secondary', filtered ? lt('No requests match these filters.') : lt('No requests match your search.')));
      const reset = el('button', 'btn-control-xs btn-min-width routility-rf-action', filtered ? lt('Reset Filters') : lt('Clear Search'));
      reset.type = 'button';
      reset.addEventListener('click', () => { if (filtered) apply(s, blank()); else setQuery(s, ''); });
      empty.appendChild(reset);
      list.appendChild(empty);
      return;
    }
    const missing = slice.map(r => r.id).filter(id => !s.thumbs.has(id));
    if (missing.length) {
      const got = await F().headshots(missing);
      if (rf !== s || list.dataset.key !== key) return;
      for (const [id, url] of got) s.thumbs.set(id, url);
    }
    const fresh = !list.querySelector('.routility-rf-card:not(.routility-rf-sk)');
    list.textContent = '';
    for (const r of slice) list.appendChild(requestCard(s, r));
    if (short) for (let i = slice.length; i < PAGE; i++) list.appendChild(skeleton());
    retryThumbs(s, slice.map(r => r.id).filter(id => !s.thumbs.get(id)), 1);
    if (fresh && !document.hidden) {
      list.classList.remove('routility-reveal');
      void list.offsetWidth;
      list.classList.add('routility-reveal');
    }
  }

  function paintPager(s, pager, pages, list) {
    const key = pages > 1 ? `${s.page}/${pages}` : '';
    if (pager.dataset.key === key) return;
    pager.dataset.key = key;
    pager.textContent = '';
    if (pages <= 1) return;
    const go = (d) => { s.page += d; render(s, true); list.scrollIntoView({ block: 'nearest' }); };
    const ul = el('ul', 'pager');
    ul.appendChild(F().pagerButton('prev', s.page === 0, () => go(-1)));
    const cur = el('li', 'pager-cur');
    cur.appendChild(el('span', null, String(s.page + 1)));
    ul.appendChild(cur);
    ul.appendChild(F().pagerButton('next', s.page >= pages - 1, () => go(1)));
    pager.appendChild(ul);
  }

  function paintCount(s) {
    const head = document.querySelector('#friends-web-app .tab-pane.active .friends-subtitle');
    const header = head && head.parentElement;
    if (!head) return;
    let tag = head.querySelector('.routility-rf-count');
    let bar = header.querySelector('.routility-rf-scan');
    if (!s.on) {
      tag?.remove();
      bar?.remove();
      return;
    }
    if (!tag) {
      tag = el('span', 'text-secondary routility-injected routility-rf-count');
      head.appendChild(tag);
    }
    const n = s.matches.length;
    const vars = { n: formatNumber(n), checked: formatNumber(s.checked || 0) };
    const extra = [];
    if (!s.scanning && s.partial) extra.push(lt('Some requests didn’t load, reload to try again'));
    if (s.note) extra.push(s.note);
    tag.textContent = (s.scanning ? lt('{n}+ matches \u00b7 {checked} checked', vars) : ltn(n, '{n} match \u00b7 {checked} checked', '{n} matches \u00b7 {checked} checked', vars)) + extra.map(x => ' \u00b7 ' + x).join('');
    tag.classList.toggle('routility-rf-count-bad', !!(s.partial || s.noteBad));
    if (s.scanning && !bar) {
      bar = el('span', 'routility-injected routility-rf-scan');
      bar.appendChild(el('span', 'routility-rf-scan-fill'));
      header.appendChild(bar);
    } else if (!s.scanning) {
      bar?.remove();
    }
  }

  function setQuery(s, value) {
    const q = String(value || '').trim().toLowerCase();
    const input = document.querySelector('.routility-rf-search input');
    if (input && input.value.trim().toLowerCase() !== q) input.value = value;
    if (q === s.query) return;
    s.query = q;
    apply(s, s.filters);
  }

  function searchBox(s) {
    const box = el('div', 'friends-filter-searchbar-container form-control input-field routility-rf-search');
    box.appendChild(el('span', 'icon-search'));
    const input = el('input', 'friends-filter-searchbar-input');
    input.type = 'text';
    input.placeholder = lt('Search Requests');
    input.setAttribute('aria-label', lt('Search friend requests'));
    input.value = s.query;
    input.addEventListener('input', () => {
      clearTimeout(s.searchTimer);
      s.searchTimer = setTimeout(() => setQuery(s, input.value), 300);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); setQuery(s, ''); } });
    box.appendChild(input);
    return box;
  }

  function apply(s, filters) {
    s.filters = filters;
    s.on = activeCount(filters) > 0 || !!s.query;
    s.confirm = false;
    document.documentElement.classList.toggle('routility-rf-on', s.on);
    if (!s.on) {
      s.job = null;
      s.matches = [];
      s.scanning = false;
      document.querySelectorAll('.routility-rf-list, .routility-rf-pager, .routility-rf-count, .routility-rf-scan').forEach(n => n.remove());
      paintActions(s);
      return;
    }
    run(s);
  }

  function paintActions(s) {
    const btn = document.querySelector('.routility-rf-btn');
    if (btn) {
      const n = activeCount(s.filters);
      const label = n ? lt('Filter ({n})', { n }) : lt('Filter');
      if (btn.textContent !== label) btn.textContent = label;
      btn.classList.toggle('routility-rf-btn-on', n > 0);
    }
    const box = document.querySelector('.routility-rf-actions');
    const native = box && box.parentElement.querySelector('.ignore-button');
    if (box) {
      const w = !s.on && native ? native.offsetWidth : 0;
      const right = w ? w + 8 + 'px' : '0px';
      if (box.style.right !== right) box.style.right = right;
    }
    const bulk = document.querySelector('.routility-rf-ignore');
    if (!bulk) return;
    bulk.classList.toggle('routility-rf-danger', !!s.confirm);
    const text = s.bulk ? lt('Ignoring {done} of {total}', { done: formatNumber(s.bulk.done), total: formatNumber(s.bulk.total) }) : s.confirm ? lt('Ignore {n}?', { n: formatNumber(s.matches.length) }) : lt('Ignore Matches');
    if (bulk.textContent !== text) bulk.textContent = text;
    const off = !!s.bulk || !s.matches.length;
    if (bulk.disabled !== off) bulk.disabled = off;
  }

  function field(placeholder, value, onInput, type) {
    const input = el('input', 'form-control input-field routility-rf-input');
    input.type = type || 'number';
    if (input.type === 'number') {
      input.min = '0';
      input.inputMode = 'numeric';
    }
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('input', () => onInput(input.value.trim()));
    return input;
  }

  function badgeIcon(key) {
    if (key === 'verified') return window.RoUtilityUI.verifiedBadge();
    if (key === 'plus') return F().plusIcon();
    if (key === 'admin') return window.RoUtilityUI.adminBadge();
    const s = el('span', 'icon-premium-small routility-injected');
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function closePanel(s) {
    if (!s.panel) return;
    s.panel.stop();
    document.removeEventListener('mousedown', s.panel.outside, true);
    document.removeEventListener('keydown', s.panel.esc, true);
    s.panel.node.remove();
    s.panel = null;
    document.querySelector('.routility-rf-btn')?.setAttribute('aria-expanded', 'false');
  }

  function openPanel(s, anchor) {
    if (s.panel) return closePanel(s);
    const draft = copy(s.filters);
    const pop = el('div', 'routility-injected routility-rf-panel bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', lt('Filter friend requests'));

    const section = (title) => {
      const box = el('div', 'routility-rf-section');
      box.appendChild(el('div', 'text-title-medium content-emphasis routility-rf-title', title));
      pop.appendChild(box);
      return box;
    };

    const badges = section(lt('Badges'));
    const grid = el('div', 'routility-rf-badges');
    for (const [key, label] of BADGES) {
      const row = el('div', 'routility-rf-badge');
      const name = el('div', 'routility-rf-badge-name');
      name.append(badgeIcon(key), el('span', 'text-body-medium content-default', lt(label)));
      row.append(name, window.RoUtilityUI.dropdown(MODES.map(m => ({ ...m, label: lt(m.label) })), draft.badges[key], v => { draft.badges[key] = v; }, 'routility-rf-select'));
      grid.appendChild(row);
    }
    badges.appendChild(grid);

    const counts = section(lt('Counts'));
    const cgrid = el('div', 'routility-rf-ranges');
    for (const [key, label] of RANGES) {
      const row = el('div', 'routility-rf-range');
      row.appendChild(el('div', 'text-body-medium content-default', lt(label)));
      const pair = el('div', 'routility-rf-pair');
      pair.append(
        field(lt('Min'), draft.ranges[key][0], v => { draft.ranges[key][0] = /^\d+$/.test(v) ? v : ''; }),
        field(lt('Max'), draft.ranges[key][1], v => { draft.ranges[key][1] = /^\d+$/.test(v) ? v : ''; }),
      );
      row.appendChild(pair);
      cgrid.appendChild(row);
    }
    counts.appendChild(cgrid);

    const joined = section(lt('Joined Roblox'));
    const jgrid = el('div', 'routility-rf-ranges');
    const today = new Date().toISOString().slice(0, 10);
    for (const [i, label] of [[0, lt('From')], [1, lt('To')]]) {
      const row = el('div', 'routility-rf-range');
      row.appendChild(el('div', 'text-body-medium content-default', label));
      const input = field('', draft.joined[i], v => { draft.joined[i] = v; }, 'date');
      input.min = '2006-01-01';
      input.max = today;
      row.appendChild(input);
      jgrid.appendChild(row);
    }
    joined.appendChild(jgrid);

    const foot = el('div', 'routility-rf-foot');
    const reset = el('button', 'btn-secondary-md btn-min-width', lt('Reset'));
    reset.type = 'button';
    reset.addEventListener('click', () => { closePanel(s); apply(s, blank()); });
    const go = el('button', 'btn-cta-md btn-min-width', lt('Apply'));
    go.type = 'button';
    go.addEventListener('click', () => { closePanel(s); apply(s, draft); });
    foot.append(reset, go);
    pop.appendChild(foot);

    document.body.appendChild(pop);
    window.RoUtilityUI.keyNav(pop, '.input-dropdown-btn, .routility-rf-input, .routility-rf-foot button', true);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.right - w))) + 'px';
      pop.style.top = Math.round(r.bottom + 8) + 'px';
    };
    place();
    const outside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePanel(s); };
    const esc = (e) => { if (e.key === 'Escape') closePanel(s); };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', esc, true);
    s.panel = { node: pop, outside, esc, stop: window.RoUtilityUI.trackPopover(pop, anchor, place, () => closePanel(s)) };
    anchor.setAttribute('aria-expanded', 'true');
    if (!document.hidden) pop.classList.add('routility-reveal');
  }

  function removeAll() {
    document.documentElement.classList.remove('routility-rf-on');
    document.querySelectorAll('.routility-rf-actions, .routility-rf-list, .routility-rf-pager, .routility-rf-count, .routility-rf-scan').forEach(n => n.remove());
    document.querySelector('#friends-web-app .container-header.routility-rf-header')?.classList.remove('routility-rf-header');
  }

  function place() {
    const s = rf;
    if (!s) return;
    if (!onRequestsTab()) {
      closePanel(s);
      if (s.scanning) {
        s.job = null;
        s.scanning = false;
        s.resume = true;
      }
      removeAll();
      return;
    }
    if (s.resume && s.on) {
      s.resume = false;
      run(s);
    }
    document.documentElement.classList.toggle('routility-rf-on', s.on);
    const header = document.querySelector('#friends-web-app .tab-pane.active .container-header');
    if (header && !header.querySelector('.routility-rf-actions')) {
      header.classList.add('routility-rf-header');
      const box = el('div', 'routility-injected routility-rf-actions');
      const bulk = el('button', 'btn-control-xs btn-min-width routility-rf-action routility-rf-ignore', lt('Ignore Matches'));
      bulk.type = 'button';
      bulk.addEventListener('click', () => ignoreMatches(s));
      const btn = el('button', 'btn-control-xs btn-min-width routility-rf-action routility-rf-btn');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => openPanel(s, btn));
      box.append(searchBox(s), btn, bulk);
      header.appendChild(box);
    }
    paintActions(s);
    if (s.on) render(s, true);
    else markNative(s);
  }

  async function setup() {
    if (rf) return;
    const s = rf = {
      filters: blank(), on: false, chunks: [], cursor: '', done: false, fetching: null, gone: new Set(), matches: [], scanning: false,
      users: new Map(), thumbs: new Map(), plus: new Set(), admins: new Set(), adminChecked: new Set(), bounds: {}, stats: {},
      page: 0, job: null, panel: null, confirm: false, bulk: null, sent: new Map(), query: '', searchTimer: 0,
    };
    s.stats = await loadStats();
    if (rf !== s) return;
    s.observer = new MutationObserver(onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    s.onHash = () => place();
    window.addEventListener('hashchange', s.onHash);
    place();
  }

  function teardown() {
    const s = rf;
    if (!s) return;
    closePanel(s);
    clearTimeout(s.confirmTimer);
    clearTimeout(s.searchTimer);
    s.observer?.disconnect();
    window.removeEventListener('hashchange', s.onHash);
    rf = null;
    removeAll();
    document.querySelectorAll('.routility-req-sent').forEach(n => n.remove());
  }

  window.RoUtilityRequests = { setup, teardown };
})();
