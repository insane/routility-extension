(function () {
  'use strict';

  const { el, onFrame, formatNumber, formatUSD, verifiedBadge, robuxRate } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const DAY = 86400000;
  const FG_KEY = 'routilityFriendGroups';
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const settings = { groupFriends: true, groupDetails: true, groupManage: true, groupAdmin: true, groupFind: true, groupHiddenGames: true, groupCreated: true, groupCount: true };
  let lastUrl = '';
  let page = null;
  let csrf = '';

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  async function getJson(url, tries = 4) {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.status === 429 || r.status >= 500) { await wait(1500 * 2 ** i); continue; }
        return r.ok ? await r.json() : null;
      } catch {
        await wait(1000);
      }
    }
    return null;
  }

  async function send(method, url, body) {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url, { method, credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: body ? JSON.stringify(body) : undefined });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { csrf = r.headers.get('x-csrf-token'); continue; }
        if (r.status === 429) { await wait(2000 * (i + 1)); continue; }
        return r;
      } catch {
        await wait(1000);
      }
    }
    return null;
  }

  function groupId() {
    const m = location.pathname.match(/^\/communities\/(\d+)/i);
    if (m) return m[1];
    const q = new URLSearchParams(location.search).get('id');
    return /^\d+$/.test(q || '') ? q : null;
  }

  function face(src, big) {
    const f = el('span', 'routility-mutual-face' + (big ? ' routility-mutual-face-lg' : ''));
    if (!big) f.style.width = f.style.height = '18px';
    if (src) {
      const img = el('img');
      img.alt = '';
      img.src = src;
      f.appendChild(img);
    }
    return f;
  }

  let friendGroupsJob = null;
  let fgProgress = 0;

  function paintFgProgress(p) {
    fgProgress = p;
    document.querySelectorAll('.routility-cm-sk-fill').forEach(f => { f.style.width = Math.round(p * 100) + '%'; });
  }

  function loadStore(key) {
    return new Promise(r => { try { chrome.storage.local.get(key, v => r(v[key] || null)); } catch { r(null); } });
  }

  function friendGroups(onProgress) {
    if (friendGroupsJob) return friendGroupsJob;
    friendGroupsJob = (async () => {
      const id = me();
      const stored = await loadStore(FG_KEY);
      if (stored && stored.me === id && Date.now() - stored.at < DAY && stored.map) return stored;
      const friends = await window.RoUtilitySearch.myFriends();
      const map = {};
      const info = {};
      let i = 0;
      let done = 0;
      let missed = friends.partial ? 1 : 0;
      const worker = async () => {
        while (i < friends.length) {
          const f = friends[i++];
          const r = await getJson(`https://groups.roblox.com/v2/users/${f.id}/groups/roles`);
          if (r && Array.isArray(r.data)) map[f.id] = r.data.map(g => g.group.id);
          else missed++;
          info[f.id] = { name: f.name, displayName: f.displayName, verified: !!f.verified };
          done++;
          if (onProgress) onProgress(done / friends.length);
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      const result = { me: id, at: missed ? Date.now() - DAY + 10 * 60000 : Date.now(), map, info };
      try { chrome.storage.local.set({ [FG_KEY]: result }); } catch {}
      return result;
    })().finally(() => setTimeout(() => { friendGroupsJob = null; }, 0));
    return friendGroupsJob;
  }

  function pillClass() {
    const native = document.querySelector('.profile-insights-container .profile-insight-pill-button');
    return native ? native.className : 'flex items-center bg-surface-300 radius-circle text-caption-medium padding-x-medium padding-y-xsmall cursor-pointer profile-insight-pill-button';
  }

  function closePop() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.routility-cm-friends, .routility-mutual-pop')) document.activeElement.blur();
    document.querySelector('.routility-cm-pop')?.remove();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEsc, true);
    if (page && page.untrack) { page.untrack(); page.untrack = null; }
  }

  function onOutside(e) { if (!e.target.closest?.('.routility-cm-pop, .routility-cm-friends')) closePop(); }
  function onEsc(e) { if (e.key === 'Escape') closePop(); }

  function openPop(s, anchor) {
    if (document.querySelector('.routility-cm-pop')) return closePop();
    const pop = el('div', 'routility-injected routility-mutual-pop routility-cm-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.appendChild(el('div', 'text-label content-default routility-mutual-pop-title', ltn(s.friends.length, '{n} friend is in this community', '{n} friends are in this community', { n: formatNumber(s.friends.length) })));
    const list = el('ul', 'routility-mutual-list');
    for (const f of s.friends) {
      const li = el('li');
      const a = el('a', 'routility-mutual-row relative clip group/interactable');
      a.href = `/users/${f.id}/profile`;
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      const text = el('span', 'routility-mutual-text');
      const name = el('span', 'routility-mutual-name');
      name.appendChild(el('span', 'text-overflow', f.displayName || f.name));
      if (f.verified) name.appendChild(verifiedBadge());
      text.append(name, el('span', 'routility-mutual-user text-overflow', '@' + f.name));
      a.append(layer, face(s.pics[f.id], true), text);
      li.appendChild(a);
      list.appendChild(li);
    }
    pop.appendChild(list);
    document.body.appendChild(pop);
    window.RoUtilityUI.keyNav(pop, '.routility-mutual-row', true);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left))) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
    };
    place();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onEsc, true);
    s.untrack = window.RoUtilityUI.trackPopover(pop, anchor, place, closePop);
  }

  function communityPage(gid) {
    const s = { gid, info: null, role: null, friends: null, pics: {}, funds: null, created: null, asked: false };
    s.run = () => {
      const row = document.querySelector('.profile-insights-container');
      if (!row) return;
      if (!s.asked) {
        s.asked = true;
        start(s);
      }
      if (settings.groupDetails && s.info) {
        const members = [...row.querySelectorAll('.profile-insight-pill-button')].find(b => /Members?$/.test(b.textContent.trim()) && !b.classList.contains('routility-injected'));
        const exact = ltn(s.info.memberCount, '{n} Member', '{n} Members', { n: formatNumber(s.info.memberCount) });
        if (members && members.textContent !== exact) members.textContent = exact;
        if (s.role && s.role.rank > 0) {
          const rank = [...row.querySelectorAll('.profile-insight-pill-button')].find(b => / Rank$/.test(b.textContent.trim()) && !b.dataset.rtRank);
          if (rank) {
            rank.dataset.rtRank = '1';
            rank.textContent = lt('{role} · Rank {rank}', { role: s.role.name, rank: s.role.rank });
          }
        }
      }
      if (settings.groupCreated && s.created && !row.querySelector('.routility-cm-created')) {
        const pill = el('span', pillClass().replace(/cursor-pointer/g, '') + ' routility-injected routility-cm-created', lt('Created {date}', { date: s.created }));
        row.insertBefore(pill, row.querySelector('.routility-cm-funds, .routility-cm-friends'));
      }
      if (settings.groupDetails && s.funds !== null && !row.querySelector('.routility-cm-funds')) {
        const pill = el('a', pillClass() + ' routility-injected routility-cm-funds');
        pill.href = `/communities/configure?id=${gid}#!/revenue`;
        pill.append(el('span', 'icon-robux-16x16 routility-cm-robux'), el('span', null, formatNumber(s.funds)), el('span', 'routility-cm-usd', '≈ ' + formatUSD(s.funds * robuxRate(settings))));
        row.appendChild(pill);
      }
      if (settings.groupFriends && !row.querySelector('.routility-cm-friends')) {
        if (s.friends === null) {
          const sk = el('span', pillClass() + ' routility-injected routility-cm-friends routility-cm-sk');
          const bar = el('span', 'routility-cm-sk-bar');
          const fill = el('span', 'routility-cm-sk-fill');
          fill.style.width = Math.round(fgProgress * 100) + '%';
          bar.appendChild(fill);
          sk.appendChild(bar);
          row.appendChild(sk);
        } else if (s.friends.length) {
          const pill = el('button', pillClass() + ' routility-injected routility-cm-friends');
          pill.type = 'button';
          const stack = el('span', 'routility-mutual-stack');
          for (const f of s.friends.slice(0, 3)) stack.appendChild(face(s.pics[f.id]));
          pill.append(stack, el('span', null, ltn(s.friends.length, '{n} Friend', '{n} Friends', { n: formatNumber(s.friends.length) })));
          pill.addEventListener('click', () => openPop(s, pill));
          row.appendChild(pill);
        }
      }
      if (s.friends !== null && (!s.friends.length || !settings.groupFriends)) row.querySelector('.routility-cm-friends.routility-cm-sk')?.remove();
      if (s.friends && s.friends.length) {
        const sk = row.querySelector('.routility-cm-friends.routility-cm-sk');
        if (sk) { sk.remove(); s.run(); }
      }
    };
    return s;
  }

  async function start(s) {
    const tasks = [];
    if (settings.groupCreated) {
      tasks.push(getJson(`https://groups.roblox.com/v2/groups?groupIds=${s.gid}`).then((d) => {
        const at = d && d.data && d.data[0] && new Date(d.data[0].created);
        if (!at || isNaN(at) || page !== s) return;
        try {
          s.created = at.toLocaleDateString(window.RoUtilityI18n.locale(), { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
          s.created = at.toDateString();
        }
        s.run();
      }));
    }
    if (settings.groupDetails) {
      tasks.push(getJson(`https://groups.roblox.com/v1/groups/${s.gid}`).then(d => { if (d && page === s) { s.info = d; s.run(); } }));
      tasks.push(getJson(`https://groups.roblox.com/v2/users/${me()}/groups/roles`).then(d => {
        const hit = d && (d.data || []).find(g => String(g.group.id) === s.gid);
        if (hit && page === s) { s.role = hit.role; s.run(); }
        if (!hit || page !== s) return null;
        return fetch(`https://economy.roblox.com/v1/groups/${s.gid}/currency`, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(f => {
          if (f && Number.isFinite(f.robux) && page === s) { s.funds = f.robux; s.run(); }
        }).catch(() => {});
      }));
    }
    if (settings.groupFriends && window.RoUtilitySearch?.myFriends) {
      tasks.push(friendGroups(paintFgProgress).then(async (fg) => {
        if (page !== s) return;
        const ids = Object.entries(fg.map).filter(([, gs]) => gs.includes(Number(s.gid))).map(([id]) => id);
        const friends = ids.map(id => ({ id, ...(fg.info[id] || { name: '', displayName: '' }) }))
          .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
        if (friends.length) {
          const pics = await window.RoUtilityUI.request({ type: 'getHeadshots', ids: friends.slice(0, 100).map(f => String(f.id)) }, r => r && typeof r === 'object');
          if (page !== s) return;
          s.pics = pics || {};
        }
        s.friends = friends;
        s.run();
      }));
    }
    await Promise.all(tasks);
  }

  let countJob = null;

  async function groupCount() {
    const head = document.querySelector('.groups-list-heading');
    if (!head || document.querySelector('.routility-cm-count')) return;
    if (!countJob) countJob = getJson('https://groups.roblox.com/v1/groups/metadata');
    const d = await countJob;
    if (!d || !(d.groupLimit > 0) || !Number.isFinite(d.currentGroupCount) || !head.isConnected || document.querySelector('.routility-cm-count')) return;
    const bar = head.parentElement;
    if (!bar || bar.parentElement.querySelector(':scope > .routility-cm-count')) return;
    bar.after(el('div', 'text-caption-medium content-muted routility-injected routility-cm-count', lt('{n} of {max} communities joined', { n: formatNumber(d.currentGroupCount), max: formatNumber(d.groupLimit) })));
  }

  function sidebar() {
    if (settings.groupCount) groupCount();
    if (!settings.groupManage) return;
    const head = document.querySelector('.groups-list-heading');
    const bar = head && head.parentElement;
    if (!bar || bar.querySelector('.routility-cm-manage')) return;
    const seeAll = bar.querySelector('a');
    const btn = el('button', (seeAll ? seeAll.className : 'text-label-medium') + ' routility-injected routility-cm-manage');
    btn.type = 'button';
    btn.textContent = lt('Manage');
    btn.addEventListener('click', openManager);
    const wrap = el('span', 'routility-injected routility-cm-headlinks');
    if (seeAll) {
      seeAll.before(wrap);
      wrap.append(btn, seeAll);
    } else {
      bar.appendChild(btn);
    }
  }

  async function openManager() {
    document.querySelector('.routility-cm-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-cm-titlebox');
    titleBox.append(el('h2', 'routility-modal-title', lt('My Communities')), el('span', 'text-body-medium content-muted routility-cm-count'));
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, close);

    const tools = el('div', 'routility-cm-tools');
    const search = el('input', 'form-control input-field routility-cm-search');
    search.type = 'search';
    search.placeholder = lt('Search Communities');
    const filters = el('div', 'routility-cm-filters');
    let filter = 'all';
    let sort = 'rank';
    const FILTERS = [['all', lt('All')], ['owned', lt('Owned')], ['staff', lt('Staff')], ['member', lt('Member')]];
    for (const [key, label] of FILTERS) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-cm-filter');
      b.type = 'button';
      b.dataset.key = key;
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', label));
      b.addEventListener('click', () => { filter = key; paint(); });
      filters.appendChild(b);
    }
    const sorter = window.RoUtilityUI.dropdown([
      { value: 'rank', label: lt('Highest Rank') },
      { value: 'size', label: lt('Most Members') },
      { value: 'small', label: lt('Fewest Members') },
      { value: 'name', label: lt('Name') },
    ], sort, v => { sort = v; paint(); }, 'routility-cm-sort');
    tools.append(search, filters, sorter);

    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-list');
    for (let i = 0; i < 8; i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
    body.appendChild(list);

    const foot = el('div', 'routility-cm-foot');
    const selInfo = el('span', 'text-body-medium content-muted');
    const leave = el('button', 'btn-alert-md btn-min-width routility-cm-leave', lt('Leave Selected'));
    leave.type = 'button';
    leave.disabled = true;
    foot.append(selInfo, leave);

    modal.append(head, tools, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    if (!document.hidden) modal.classList.add('routility-reveal');
    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const meId = me();
    const [roles, primary] = await Promise.all([
      getJson(`https://groups.roblox.com/v2/users/${meId}/groups/roles`),
      getJson(`https://groups.roblox.com/v1/users/${meId}/groups/primary/role`),
    ]);
    if (!backdrop.isConnected) return;
    const loadFailed = !roles;
    let groups = ((roles && roles.data) || []).map(g => ({ id: String(g.group.id), name: g.group.name, members: g.group.memberCount || 0, verified: !!g.group.hasVerifiedBadge, role: g.role.name, rank: g.role.rank, owned: g.role.rank === 255 }));
    const primaryId = primary && primary.group ? String(primary.group.id) : '';
    const icons = {};
    for (let i = 0; i < groups.length; i += 100) {
      const r = await getJson(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groups.slice(i, i + 100).map(g => g.id).join(',')}&size=150x150&format=Webp&isCircular=false`);
      for (const t of (r && r.data) || []) if (t.imageUrl) icons[String(t.targetId)] = t.imageUrl;
    }
    if (!backdrop.isConnected) return;
    const selected = new Set();
    let confirm = false;
    let confirmTimer = 0;
    let busy = false;
    let note = '';
    const failed = new Set();

    const paintFoot = () => {
      const n = selected.size;
      titleBox.querySelector('.routility-cm-count').textContent = lt('{n} of 100', { n: formatNumber(groups.length) });
      selInfo.textContent = note || (n ? lt('{n} selected', { n: formatNumber(n) }) : lt('Select communities to leave them'));
      selInfo.classList.toggle('routility-cm-note-bad', !!note && failed.size > 0);
      leave.disabled = !n || busy;
      leave.classList.toggle('routility-cm-confirm', confirm);
      if (!busy) leave.textContent = confirm ? ltn(n, 'Leave {n} Community?', 'Leave {n} Communities?', { n: formatNumber(n) }) : lt('Leave Selected');
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
      let rows = groups.filter(g => (filter === 'all' || (filter === 'owned' && g.owned) || (filter === 'staff' && !g.owned && g.rank >= 200) || (filter === 'member' && g.rank < 200)) && (!q || g.name.toLowerCase().includes(q) || g.role.toLowerCase().includes(q)));
      rows = rows.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.members - a.members : sort === 'small' ? a.members - b.members : b.rank - a.rank || b.members - a.members);
      list.textContent = '';
      if (loadFailed) {
        const li = el('li', 'routility-cm-empty text-body-medium content-muted', lt('Couldn’t load your communities right now.'));
        const again = el('button', 'btn-control-sm routility-ff-retry', lt('Try Again'));
        again.type = 'button';
        again.addEventListener('click', () => {
          shut();
          openManager();
        });
        li.appendChild(again);
        list.appendChild(li);
        return;
      }
      if (!rows.length) list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', lt('No communities match.')));
      for (const g of rows) {
        const li = el('li', 'routility-cm-row' + (selected.has(g.id) ? ' routility-cm-picked' : '') + (failed.has(g.id) ? ' routility-cm-failed' : ''));
        const box = el('input', 'routility-cm-check');
        box.type = 'checkbox';
        box.checked = selected.has(g.id);
        box.disabled = g.owned || busy;
        box.setAttribute('aria-label', g.owned ? lt('You own {name}', { name: g.name }) : lt('Select {name}', { name: g.name }));
        box.addEventListener('change', () => {
          if (box.checked) selected.add(g.id);
          else selected.delete(g.id);
          confirm = false;
          note = '';
          li.classList.toggle('routility-cm-picked', box.checked);
          paintFoot();
        });
        const icon = el('span', 'routility-cm-icon thumbnail-2d-container');
        if (icons[g.id]) {
          const img = el('img');
          img.alt = '';
          img.src = icons[g.id];
          icon.appendChild(img);
        }
        const text = el('a', 'routility-cm-text');
        text.href = `/communities/${g.id}`;
        const name = el('span', 'routility-cm-name text-title-medium');
        name.appendChild(el('span', 'text-truncate-end', g.name));
        if (g.verified) name.appendChild(verifiedBadge());
        const meta = el('span', 'routility-cm-meta text-body-small content-muted', ltn(g.members, '{n} member', '{n} members', { n: formatNumber(g.members) }));
        text.append(name, meta);
        const tags = el('span', 'routility-cm-tags');
        if (g.id === primaryId) tags.appendChild(el('span', 'routility-cm-tag', lt('Primary')));
        if (g.owned) tags.appendChild(el('span', 'routility-cm-tag routility-cm-tag-owned', lt('Owned')));
        const role = el('span', 'routility-cm-role text-body-small');
        role.append(el('span', 'text-truncate-end', g.role), el('span', 'routility-cm-rank', String(g.rank)));
        li.append(box, icon, text, tags, role);
        li.addEventListener('click', (e) => {
          if (e.target.closest('a, input') || box.disabled) return;
          box.checked = !box.checked;
          box.dispatchEvent(new Event('change'));
        });
        list.appendChild(li);
      }
      paintFoot();
    };

    search.addEventListener('input', paint);
    leave.addEventListener('click', async () => {
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
      let done = 0;
      const gone = [];
      paint();
      for (const id of queue) {
        leave.textContent = lt('Leaving {done} of {total}', { done: formatNumber(done + 1), total: formatNumber(queue.length) });
        const r = await send('DELETE', `https://groups.roblox.com/v1/groups/${id}/users/${meId}`);
        if (r && r.ok) gone.push(id);
        else failed.add(id);
        done++;
        await wait(350);
      }
      groups = groups.filter(g => !gone.includes(g.id));
      for (const id of gone) {
        selected.delete(id);
        document.querySelectorAll(`.groups-list-item[href*="/communities/${id}/"], .groups-list-item[href$="/communities/${id}"]`).forEach(n => n.classList.add('routility-cm-left'));
      }
      busy = false;
      note = failed.size ? lt('Left {n} \u00b7 {failed} didn\u2019t work. They\u2019re still selected, try again.', { n: formatNumber(gone.length), failed: formatNumber(failed.size) }) : ltn(gone.length, 'Left {n} community.', 'Left {n} communities.', { n: formatNumber(gone.length) });
      paint();
    });
    paint();
  }

  function configurePage(gid) {
    const s = { gid, exporting: false };
    s.run = () => {
      if (!settings.groupAdmin) return;
      for (const ic of document.querySelectorAll('.icon-robux-container .icon-robux-16x16, .icon-robux-container .icon-robux-gray-16x16')) {
        const holder = ic.parentElement;
        const num = ic.nextElementSibling;
        if (!holder || !num) continue;
        const n = Number(num.textContent.replace(/[^\d]/g, ''));
        const key = num.textContent;
        let tag = holder.querySelector(':scope > .routility-cm-usd');
        if (tag && tag.dataset.key === key) continue;
        tag?.remove();
        if (!(n > 0)) continue;
        tag = el('span', 'routility-injected routility-cm-usd', '≈ ' + formatUSD(n * robuxRate(settings)));
        tag.dataset.key = key;
        holder.appendChild(tag);
      }
      if (/auditLog/i.test(location.hash)) {
        const dd = document.querySelector('#audit-log-type-dropdown');
        if (dd && !document.querySelector('.routility-cm-export')) {
          const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center justify-center gap-small radius-medium height-1000 padding-x-medium text-label-medium bg-action-standard content-action-standard stroke-none routility-injected routility-cm-export');
          b.type = 'button';
          const layer = el('div', STATE_LAYER);
          layer.setAttribute('aria-hidden', 'true');
          b.append(layer, el('span', 'icon icon-regular-arrow-down-to-line routility-cm-dl'), el('span', 'text-no-wrap routility-cm-export-label', lt('Export CSV')));
          b.addEventListener('click', () => exportAudit(s, b));
          dd.after(b);
        }
      }
    };
    return s;
  }

  function csvCell(v) {
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  async function exportAudit(s, btn) {
    if (s.exporting) return;
    s.exporting = true;
    btn.disabled = true;
    const label = btn.querySelector('.routility-cm-export-label');
    const rows = [[lt('Date'), lt('User'), lt('User ID'), lt('Role'), lt('Action'), lt('Details')]];
    let cursor = '';
    let failed = false;
    let partial = false;
    for (let page = 0; page < 50; page++) {
      label.textContent = lt('Exporting {n}', { n: formatNumber(rows.length - 1) });
      const r = await getJson(`https://groups.roblox.com/v1/groups/${s.gid}/audit-log?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!r) {
        failed = page === 0;
        partial = page > 0;
        break;
      }
      for (const e of r.data || []) {
        const u = (e.actor && e.actor.user) || {};
        rows.push([e.created, u.username || '', u.userId || '', (e.actor && e.actor.role && e.actor.role.name) || '', e.actionType || '', e.description ? JSON.stringify(e.description) : '']);
      }
      cursor = r.nextPageCursor;
      if (!cursor) break;
    }
    if (!failed) {
      const name = document.querySelector('h1')?.textContent.replace(/^Configure\s+/, '').trim() || lt('community');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' }));
      a.download = lt('{name} audit log.csv', { name: name.replace(/[\\/:*?"<>|]+/g, '') });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    label.textContent = failed ? lt('Couldn’t Export') : partial ? lt('Exported {n} · Rest Didn’t Load', { n: formatNumber(rows.length - 1) }) : lt('Exported {n}', { n: formatNumber(rows.length - 1) });
    setTimeout(() => { label.textContent = lt('Export CSV'); }, failed || partial ? 4000 : 2500);
    btn.disabled = false;
    s.exporting = false;
  }

  async function findMember(gid, query) {
    const q = query.trim().replace(/^@/, '');
    let user = null;
    if (/^\d+$/.test(q)) {
      const d = await getJson(`https://users.roblox.com/v1/users/${q}`, 2);
      if (d && d.id) user = { id: d.id, name: d.name, displayName: d.displayName, verified: !!d.hasVerifiedBadge };
    }
    if (!user) {
      const r = await send('POST', 'https://users.roblox.com/v1/usernames/users', { usernames: [q], excludeBannedUsers: true });
      if (!r) return { error: true };
      const d = r.ok ? await r.json().catch(() => null) : null;
      if (!d) return { error: true };
      const hit = (d.data || [])[0];
      if (hit) user = { id: hit.id, name: hit.name, displayName: hit.displayName, verified: !!hit.hasVerifiedBadge };
    }
    if (!user) return { none: q };
    const roles = await getJson(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`);
    if (!roles) return { error: true };
    const hit = (roles.data || []).find(g => String(g.group.id) === String(gid));
    const pics = await window.RoUtilityUI.request({ type: 'getHeadshots', ids: [String(user.id)] }, r => r && typeof r === 'object');
    return { user, role: hit ? hit.role : null, pic: pics && pics[String(user.id)] };
  }

  function findRow(res) {
    const li = el('li', 'w-auto routility-cm-find-row');
    const a = el('a', 'user-item-clickable');
    a.href = `/users/${res.user.id}/profile`;
    const inner = el('div', 'flex items-center grow-1 self-stretch clip');
    const av = el('div', 'avatar-card-fullbody');
    const box = el('span', 'thumbnail-2d-container avatar-card-image');
    if (res.pic) {
      const img = el('img');
      img.alt = '';
      img.src = res.pic;
      box.appendChild(img);
    }
    av.appendChild(box);
    const names = el('div', 'grow-1 clip text-truncate-split text-no-wrap');
    const display = el('div', 'text-title-medium text-truncate-split text-no-wrap user-item-display-name-row', res.user.displayName || res.user.name);
    if (res.user.verified) display.appendChild(verifiedBadge());
    names.append(display, el('span', 'text-body-medium', '@' + res.user.name));
    const tag = el('span', 'text-label-medium shrink-0 margin-right-medium routility-cm-find-role' + (res.role ? '' : ' routility-cm-find-out'), res.role ? lt('{role} · Rank {rank}', { role: res.role.name, rank: res.role.rank }) : lt('Not a member'));
    inner.append(av, names, tag);
    a.appendChild(inner);
    li.appendChild(a);
    return li;
  }

  function findSkeleton() {
    const li = el('li', 'w-auto routility-cm-find-row');
    const inner = el('div', 'flex items-center grow-1 self-stretch clip routility-cm-find-sk');
    const lines = el('div', 'routility-cm-find-sk-lines');
    lines.append(el('span', 'routility-sk routility-cm-find-sk-name'), el('span', 'routility-sk routility-cm-find-sk-user'));
    inner.append(el('span', 'routility-sk routility-cm-find-sk-pic'), lines, el('span', 'routility-sk routility-cm-find-sk-tag'));
    li.appendChild(inner);
    return li;
  }

  function placeFinder(gid) {
    const modal = [...document.querySelectorAll('.user-list-modal-content')].find(m => m.querySelector('.user-list-modal-title-bar-title')?.textContent.trim() === 'Members');
    if (!modal) return;
    const filters = modal.querySelector('.filter-selector-container');
    if (!filters || modal.querySelector('.routility-cm-find')) return;
    const wrap = el('div', 'routility-injected routility-cm-find');
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-default focus-within:stroke-system-emphasis routility-cm-find-field');
    field.appendChild(el('div', STATE_LAYER));
    field.appendChild(el('span', 'icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-default shrink-0'));
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted text-body-medium placeholder:text-body-medium');
    input.type = 'search';
    input.placeholder = lt('Find a member by username');
    input.setAttribute('aria-label', lt('Find a member by username'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    field.appendChild(input);
    field.addEventListener('mousedown', (e) => { if (e.target !== input) { e.preventDefault(); input.focus(); } });
    const out = el('ul', 'vlist flex flex-col gap-medium routility-cm-find-out-list');
    out.hidden = true;
    wrap.append(field, out);
    filters.after(wrap);
    let token = 0;
    let timer = null;
    const run = async () => {
      clearTimeout(timer);
      const q = input.value.trim();
      const mine = ++token;
      out.textContent = '';
      if (q.replace(/^@/, '').length < 3) { out.hidden = true; return; }
      out.hidden = false;
      out.appendChild(findSkeleton());
      const res = await findMember(gid, q);
      if (mine !== token || !wrap.isConnected) return;
      out.textContent = '';
      if (res.user) out.appendChild(findRow(res));
      else out.appendChild(el('li', 'text-body-medium content-muted routility-cm-find-msg', res.none ? lt('No player is named {name}.', { name: res.none }) : lt('Couldn’t check right now. Try again in a moment.')));
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      if (!input.value.trim()) { token++; out.textContent = ''; out.hidden = true; return; }
      timer = setTimeout(run, 500);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  }

  const hiddenGames = new Map();

  async function allGames(gid, filter) {
    const out = [];
    let cursor = '';
    for (let i = 0; i < 10; i++) {
      const d = await getJson(`https://games.roblox.com/v2/groups/${gid}/games?accessFilter=${filter}&limit=50&sortOrder=Desc&cursor=${encodeURIComponent(cursor)}`);
      if (!d || !Array.isArray(d.data)) return i ? out : null;
      out.push(...d.data);
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  function loadHidden(gid) {
    if (!hiddenGames.has(gid)) {
      hiddenGames.set(gid, (async () => {
        const [all, pub] = await Promise.all([allGames(gid, 'All'), allGames(gid, 'Public')]);
        if (!all || !pub) { setTimeout(() => hiddenGames.delete(gid), 30000); return []; }
        const shown = new Set(pub.map(g => String(g.id)));
        const list = all.filter(g => !shown.has(String(g.id)) && g.rootPlace && g.rootPlace.id);
        if (!list.length) return [];
        const icons = {};
        for (let i = 0; i < list.length; i += 100) {
          const d = await getJson(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${list.slice(i, i + 100).map(g => g.id).join(',')}&size=150x150&format=Webp&isCircular=false&returnPolicy=PlaceHolder`);
          for (const t of (d && d.data) || []) if (t.imageUrl) icons[String(t.targetId)] = t.imageUrl;
        }
        return list.map(g => ({ id: String(g.id), place: String(g.rootPlace.id), name: g.name || lt('Untitled'), visits: Number(g.placeVisits) || 0, updated: g.updated, icon: icons[String(g.id)] || '' }));
      })());
    }
    return hiddenGames.get(gid);
  }

  function hiddenCard(g) {
    const li = el('li', 'list-item');
    const card = el('div', 'game-card game-tile');
    const box = el('div', 'game-card-container');
    const a = el('a', 'game-card-link');
    a.href = `https://www.roblox.com/games/${g.place}`;
    const thumb = el('span', 'game-card-thumb-container');
    const inner = el('span', 'thumbnail-2d-container');
    if (g.icon) {
      const img = el('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = g.icon;
      inner.appendChild(img);
    }
    thumb.appendChild(inner);
    const name = el('div', 'game-card-name game-name-title', g.name);
    const info = el('div', 'game-card-info');
    info.appendChild(el('span', 'info-label routility-hg-visits', ltn(g.visits, '{n} visit', '{n} visits', { n: formatNumber(g.visits) })));
    a.append(thumb, name, info);
    box.appendChild(a);
    card.appendChild(box);
    li.appendChild(card);
    return li;
  }

  async function placeHiddenGames(gid) {
    if (document.querySelector(`.routility-hg[data-gid="${gid}"]`)) return;
    if (document.querySelector('.routility-hg')?.dataset.gid !== String(gid)) document.querySelectorAll('.routility-hg').forEach(n => n.remove());
    const h = [...document.querySelectorAll('h2')].find(x => /^(Experiences|Games)$/.test(x.textContent.trim()));
    const anchor = h?.closest('.section');
    const announce = [...document.querySelectorAll('h2')].find(x => x.textContent.trim() === 'Announcements')?.closest('section, .section, [class*="section"]');
    if (!anchor && !announce) return;
    const list = await loadHidden(gid);
    if (!list.length || document.querySelector('.routility-hg') || groupId() !== String(gid)) return;
    const sec = el('div', 'section routility-injected routility-hg');
    sec.dataset.gid = gid;
    const head = el('div', 'container-header');
    const title = el('h2', null, lt('Hidden Experiences ({n})', { n: formatNumber(list.length) }));
    const info = el('span', 'icon-moreinfo routility-hg-info');
    info.dataset.rtTip = lt('Experiences this community owns that Roblox doesn’t list on this page, like test places, private games and old projects.');
    title.appendChild(info);
    head.appendChild(title);
    const body = el('div', 'group-games group-section-content-transparent');
    const ul = el('ul', 'hlist game-cards');
    list.forEach(g => ul.appendChild(hiddenCard(g)));
    body.appendChild(ul);
    body.appendChild(window.RoUtilityUI.pager(ul, 6));
    sec.append(head, body);
    const after = anchor ? (anchor.parentElement && anchor.parentElement.children.length === 1 ? anchor.parentElement : anchor) : announce;
    after.after(sec);
  }

  function route() {
    if (!/^\/communities/i.test(location.pathname)) {
      if (page) { closePop(); page = null; }
      lastUrl = location.pathname + location.search;
      return;
    }
    const key = location.pathname + location.search;
    if (key !== lastUrl) {
      lastUrl = key;
      closePop();
      document.querySelectorAll('.routility-cm-friends, .routility-cm-funds, .routility-cm-created').forEach(n => n.remove());
      const gid = groupId();
      if (/^\/communities\/configure/i.test(location.pathname) && gid) page = configurePage(gid);
      else if (gid && /^\/communities\/\d+/i.test(location.pathname)) page = communityPage(gid);
      else page = null;
    }
    sidebar();
    if (page) page.run();
    if (page && page.gid && settings.groupFind && !/^\/communities\/configure/i.test(location.pathname)) placeFinder(page.gid);
    if (page && page.gid && settings.groupHiddenGames && /^\/communities\/\d+/i.test(location.pathname)) placeHiddenGames(page.gid);
    else document.querySelectorAll('.routility-hg').forEach(n => n.remove());
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    if (!Object.values(settings).some(Boolean)) return;
    const tick = onFrame(route);
    new MutationObserver(tick).observe(document.body || document.documentElement, { childList: true, subtree: true });
    setInterval(() => { if (location.pathname + location.search !== lastUrl || /^\/communities/i.test(location.pathname)) tick(); }, 600);
    tick();
  });
})();
