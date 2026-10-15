(function () {
  'use strict';

  const { el, onFrame, dropdown, formatNumber, pause } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const FILTERS = [['all', LT('All')], ['common', LT('Common')], ['rare', LT('Rare')]];
  const RARITY = [[90, LT('Freebie')], [80, LT('Cake Walk')], [50, LT('Easy')], [30, LT('Moderate')], [20, LT('Challenging')], [10, LT('Hard')], [5, LT('Extreme')], [1, LT('Insane')], [0, LT('Impossible')]];
  const CHUNK = 150;

  let state = null;
  let csrf = '';


  function rarity(rate) {
    const pct = rate * 100;
    const name = (RARITY.find(([min]) => pct >= min) || RARITY[RARITY.length - 1])[1];
    const shown = pct >= 10 ? Math.round(pct) + '%' : pct >= 1 ? (Math.round(pct * 10) / 10) + '%' : pct > 0 ? (Math.round(pct * 100) / 100 || 0.01) + '%' : '0%';
    return `${lt(name)} · ${shown}`;
  }

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async function removeBadge(id) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`https://badges.roblox.com/v1/user/badges/${id}`, { method: 'DELETE', credentials: 'include', headers: csrf ? { 'x-csrf-token': csrf } : {} });
        if (r.status === 403 && r.headers.get('x-csrf-token')) {
          csrf = r.headers.get('x-csrf-token');
          continue;
        }
        if (r.status === 429) {
          await pause(3000 * (i + 1));
          continue;
        }
        return r.ok;
      } catch {
        await pause(1000);
      }
    }
    return false;
  }

  function toggle(label, checked, onChange) {
    const btn = el('button', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer grow-0 shrink-0 basis-auto flex items-center padding-xxsmall stroke-none radius-circle transition-colors width-1000 height-600 group/toggle data-[state=unchecked]:bg-action-standard data-[state=checked]:bg-system-contrast');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-label', label);
    const l = el('div', LAYER);
    l.setAttribute('aria-hidden', 'true');
    btn.appendChild(l);
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:size-0 group-data-[state=checked]/toggle:fill'));
    const knob = el('span', 'transition-colors radius-circle flex justify-center items-center size-500 data-[state=unchecked]:bg-[var(--color-content-emphasis)] data-[state=checked]:bg-[var(--inverse-content-emphasis)]');
    knob.appendChild(el('span', 'icon icon-filled-check transition-opacity size-500 group-data-[state=unchecked]/toggle:opacity-[0] group-data-[state=checked]/toggle:opacity-[1] group-data-[state=checked]/toggle:[transition-delay:50ms]'));
    btn.appendChild(knob);
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:fill group-data-[state=checked]/toggle:size-0'));
    const set = (on) => {
      const s = on ? 'checked' : 'unchecked';
      btn.setAttribute('aria-checked', String(on));
      btn.setAttribute('data-state', s);
      knob.setAttribute('data-state', s);
    };
    set(checked);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-checked') !== 'true';
      set(on);
      onChange(on);
    });
    return btn;
  }

  function ago(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return lt('just now');
    if (mins < 60) return ltn(mins, '{n} minute ago', '{n} minutes ago');
    const hours = Math.round(mins / 60);
    if (hours < 48) return ltn(hours, '{n} hour ago', '{n} hours ago');
    return ltn(Math.round(hours / 24), '{n} day ago', '{n} days ago');
  }

  function autoRow() {
    const row = el('div', 'routility-bm-auto');
    const text = el('div', 'routility-bm-auto-text');
    const note = el('span', 'text-body-small content-muted');
    text.append(el('span', 'text-title-medium content-emphasis', lt('Delete New Badges Automatically')), note);
    let on = false;
    const paintNote = (rec) => {
      const log = (rec && rec.log) || [];
      const base = on ? lt('On. Badges you earn from now on are removed within about 5 minutes while a Roblox tab is open. Badges you already have stay.') : lt('Removes badges you earn from now on, a few minutes after you get them. Badges you already have stay.');
      note.textContent = on && log.length ? `${base} ${lt('Last removed: {name} {ago}.', { name: log[0].name, ago: ago(Date.now() - log[0].at) })}` : base;
    };
    const sw = toggle(lt('Delete New Badges Automatically'), false, (v) => {
      on = v;
      chrome.storage.local.get('routilitySettings', (st) => {
        void chrome.runtime.lastError;
        chrome.storage.local.set({ routilitySettings: { ...(st.routilitySettings || {}), badgeAutoDelete: v } });
      });
      chrome.storage.local.get('routilityBadgeAuto', st => paintNote(st.routilityBadgeAuto));
    });
    row.append(text, sw);
    chrome.storage.local.get(['routilitySettings', 'routilityBadgeAuto'], (st) => {
      void chrome.runtime.lastError;
      on = (st.routilitySettings || {}).badgeAutoDelete === true;
      sw.setAttribute('aria-checked', String(on));
      sw.setAttribute('data-state', on ? 'checked' : 'unchecked');
      sw.querySelector('.size-500')?.setAttribute('data-state', on ? 'checked' : 'unchecked');
      paintNote(st.routilityBadgeAuto);
    });
    return row;
  }

  async function open() {
    const s = state;
    if (!s || s.modal) return;
    const me = s.me;
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop routility-bm-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-bm-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-cm-titlebox');
    const count = el('span', 'text-body-medium content-muted routility-cm-count');
    titleBox.append(el('h2', 'routility-modal-title', lt('My Badges')), count);
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, close);

    const tools = el('div', 'routility-cm-tools');
    const search = el('input', 'form-control input-field routility-cm-search');
    search.type = 'search';
    search.placeholder = lt('Search Badges');
    let game = '';
    const games = dropdown([{ value: '', label: lt('All Experiences') }], '', (v) => { game = v; paint(); }, 'routility-cm-sort routility-bm-game');
    const filters = el('div', 'routility-cm-filters');
    let filter = 'all';
    for (const [key, label] of FILTERS) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-cm-filter');
      b.type = 'button';
      b.dataset.key = key;
      const layer = el('div', LAYER);
      layer.setAttribute('aria-hidden', 'true');
      b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', lt(label)));
      if (key !== 'all') b.dataset.rtTip = key === 'common' ? lt('Earned by 20% or more of players') : lt('Earned by less than 1% of players');
      b.addEventListener('click', () => { filter = key; paint(); });
      filters.appendChild(b);
    }
    const pickAll = el('button', 'btn-control-sm routility-fm-all', lt('Select All'));
    pickAll.type = 'button';
    tools.append(search, games, filters, pickAll);

    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-list');
    for (let i = 0; i < 8; i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
    body.appendChild(list);

    const foot = el('div', 'routility-cm-foot');
    const selInfo = el('span', 'text-body-medium content-muted');
    const remove = el('button', 'btn-alert-md btn-min-width routility-cm-leave', lt('Delete Selected'));
    remove.type = 'button';
    remove.disabled = true;
    foot.append(selInfo, remove);

    modal.append(head, autoRow(), tools, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    s.modal = backdrop;

    let busy = false;
    let removedAny = false;
    const shut = () => {
      if (busy) return;
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
      s.modal = null;
      if (removedAny) location.reload();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modal.querySelector('.dropdown-menu[style*="block"]')) return;
      e.stopPropagation();
      shut();
    };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const badges = [];
    const places = new Map();
    const icons = new Map();
    const selected = new Set();
    const failed = new Set();
    let loading = true;
    let loadFailed = false;
    let confirm = false;
    let confirmTimer = 0;
    let note = '';
    let shown = [];
    let limit = CHUNK;
    let sentinel = null;
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return;
      limit += CHUNK;
      paint(true);
    }, { root: body, rootMargin: '400px' });

    const gameName = b => places.get(b.place) || '';
    const paintFoot = () => {
      const n = selected.size;
      count.textContent = loading ? '' : ltn(badges.length, '{n} badge', '{n} badges', { n: formatNumber(badges.length) });
      selInfo.textContent = note || (n ? lt('{n} selected', { n: formatNumber(n) }) : lt('Select badges to delete them'));
      selInfo.classList.toggle('routility-cm-note-bad', !!note && failed.size > 0);
      remove.disabled = !n || busy;
      remove.classList.toggle('routility-cm-confirm', confirm);
      if (!busy) remove.textContent = confirm ? ltn(n, 'Delete {n} Badge?', 'Delete {n} Badges?', { n: formatNumber(n) }) : lt('Delete Selected');
      pickAll.disabled = busy || !shown.length;
      pickAll.textContent = shown.length && shown.every(x => selected.has(x.id)) ? lt('Clear') : lt('Select All');
    };

    const paintGames = () => {
      const counts = new Map();
      for (const b of badges) counts.set(b.place, (counts.get(b.place) || 0) + 1);
      const opts = [...counts.entries()].sort((a, b) => b[1] - a[1] || (places.get(a[0]) || '').localeCompare(places.get(b[0]) || '')).map(([place, n]) => ({ value: place, label: `${places.get(place) || lt('Experience')} (${formatNumber(n)})` }));
      games.setOptions([{ value: '', label: lt('All Experiences') }, ...opts]);
      games.setValue(game);
    };

    const loadIcons = (ids) => {
      const want = ids.filter(id => !icons.has(id));
      for (const id of want) icons.set(id, null);
      for (let i = 0; i < want.length; i += 100) {
        getJson(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${want.slice(i, i + 100).join(',')}&size=150x150&format=Webp&isCircular=false`).then((d) => {
          for (const t of (d && d.data) || []) {
            if (t.state !== 'Completed' || !t.imageUrl) continue;
            const id = String(t.targetId);
            icons.set(id, t.imageUrl);
            const slot = list.querySelector(`.routility-bm-icon[data-id="${id}"]`);
            if (slot && !slot.firstChild) {
              const img = el('img');
              img.alt = '';
              img.src = t.imageUrl;
              slot.appendChild(img);
            }
          }
        });
      }
    };

    const row = (x) => {
      const li = el('li', 'routility-cm-row routility-bm-row' + (selected.has(x.id) ? ' routility-cm-picked' : '') + (failed.has(x.id) ? ' routility-cm-failed' : ''));
      const box = el('input', 'routility-cm-check');
      box.type = 'checkbox';
      box.checked = selected.has(x.id);
      box.disabled = busy;
      box.setAttribute('aria-label', lt('Select {name}', { name: x.name }));
      box.addEventListener('change', () => {
        if (box.checked) selected.add(x.id);
        else selected.delete(x.id);
        confirm = false;
        note = '';
        li.classList.toggle('routility-cm-picked', box.checked);
        paintFoot();
      });
      const icon = el('span', 'routility-cm-icon routility-bm-icon thumbnail-2d-container');
      icon.dataset.id = x.id;
      const src = icons.get(x.id);
      if (src) {
        const img = el('img');
        img.alt = '';
        img.src = src;
        icon.appendChild(img);
      }
      const text = el('a', 'routility-cm-text');
      text.href = `/badges/${x.id}`;
      text.target = '_blank';
      text.rel = 'noreferrer';
      const name = el('span', 'routility-cm-name text-title-medium');
      name.appendChild(el('span', 'text-truncate-end', x.name || String(x.id)));
      const where = gameName(x);
      text.append(name, el('span', 'routility-cm-meta text-body-small content-muted', (where ? where + ' · ' : '') + rarity(x.rate)));
      li.append(box, icon, text, el('span', 'routility-cm-tags'));
      li.addEventListener('click', (e) => {
        if (e.target.closest('a, input') || box.disabled) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change'));
      });
      return li;
    };

    let drawnSig = '';
    let drawn = 0;
    let version = 0;
    const drawnRows = new Map();
    const paintTail = () => {
      list.querySelectorAll(':scope > .routility-cm-row-sk, :scope > .routility-cm-empty').forEach(n => n.remove());
      sentinel = null;
      seen.disconnect();
      if (!shown.length && !loading) {
        const q = search.value.trim();
        list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', loadFailed && !badges.length ? lt('Couldn’t load your badges right now. Try again in a minute.') : !badges.length ? lt('You don’t have any badges yet.') : q ? lt('No badges match your search.') : lt('No badges match this filter.')));
      }
      if (shown.length > drawn) {
        sentinel = el('li', 'routility-cm-row routility-cm-row-sk');
        list.appendChild(sentinel);
        seen.observe(sentinel);
      } else if (loading) {
        for (let i = 0; i < (shown.length ? 3 : 8); i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
      }
    };
    const paint = (more) => {
      if (!more) limit = CHUNK;
      filters.querySelectorAll('.routility-cm-filter').forEach(b => {
        const on = b.dataset.key === filter;
        b.classList.toggle('bg-inverse-surface-0', on);
        b.classList.toggle('content-inverse-emphasis', on);
        b.classList.toggle('bg-shift-300', !on);
        b.classList.toggle('content-action-utility', !on);
      });
      const q = search.value.trim().toLowerCase();
      shown = badges.filter(x => (!game || x.place === game)
        && (filter === 'all' || (filter === 'common' && x.rate >= 0.2) || (filter === 'rare' && x.rate < 0.01))
        && (!q || `${x.name} ${gameName(x)}`.toLowerCase().includes(q)));
      const sig = [q, game, filter, version].join('|');
      if (!more || sig !== drawnSig) {
        drawnSig = sig;
        list.textContent = '';
        drawn = 0;
        drawnRows.clear();
      }
      const upto = Math.min(limit, shown.length);
      const add = shown.slice(drawn, upto);
      if (add.length) {
        list.querySelectorAll(':scope > .routility-cm-row-sk, :scope > .routility-cm-empty').forEach(n => n.remove());
        const frag = document.createDocumentFragment();
        for (const x of add) {
          const li = row(x);
          li.routilityBadge = x;
          drawnRows.set(x.id, li);
          frag.appendChild(li);
        }
        list.appendChild(frag);
        loadIcons(add.map(x => x.id));
      }
      drawn = upto;
      paintTail();
      paintFoot();
    };
    const refreshMeta = () => {
      for (const li of drawnRows.values()) {
        const x = li.routilityBadge;
        const meta = li.querySelector('.routility-cm-meta');
        const where = gameName(x);
        const text = (where ? where + ' · ' : '') + rarity(x.rate);
        if (meta && meta.textContent !== text) meta.textContent = text;
      }
    };
    const refreshChecks = () => {
      for (const [id, li] of drawnRows) {
        const box = li.querySelector('.routility-cm-check');
        const on = selected.has(id);
        if (box) {
          box.checked = on;
          box.disabled = busy;
        }
        li.classList.toggle('routility-cm-picked', on);
        li.classList.toggle('routility-cm-failed', failed.has(id));
      }
    };

    search.addEventListener('input', () => paint());
    pickAll.addEventListener('click', () => {
      const all = shown.length && shown.every(x => selected.has(x.id));
      for (const x of shown) all ? selected.delete(x.id) : selected.add(x.id);
      confirm = false;
      note = '';
      refreshChecks();
      paintFoot();
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
      const gone = new Set();
      refreshChecks();
      for (let i = 0; i < queue.length; i++) {
        remove.textContent = lt('Deleting {done} of {total}', { done: formatNumber(i + 1), total: formatNumber(queue.length) });
        if (await removeBadge(queue[i])) gone.add(queue[i]);
        else failed.add(queue[i]);
        await pause(350);
      }
      for (let i = badges.length - 1; i >= 0; i--) if (gone.has(badges[i].id)) badges.splice(i, 1);
      for (const id of gone) selected.delete(id);
      if (gone.size) removedAny = true;
      busy = false;
      note = failed.size ? lt('Deleted {n} · {failed} didn’t work. They’re still selected, try again.', { n: formatNumber(gone.size), failed: formatNumber(failed.size) }) : ltn(gone.size, 'Deleted {n} badge.', 'Deleted {n} badges.', { n: formatNumber(gone.size) });
      paintGames();
      const top = body.scrollTop;
      version++;
      paint();
      body.scrollTop = top;
    });
    paint();
    if (!document.hidden) modal.classList.add('routility-reveal');

    const nameQueue = [];
    let naming = false;
    const nameGames = async () => {
      if (naming) return;
      naming = true;
      while (nameQueue.length && backdrop.isConnected) {
        const ids = nameQueue.splice(0, 50);
        const d = await getJson('https://games.roblox.com/v1/games/multiget-place-details?' + ids.map(id => 'placeIds=' + id).join('&'));
        for (const p of Array.isArray(d) ? d : []) places.set(String(p.placeId), p.name || '');
        if (!backdrop.isConnected) break;
        paintGames();
        if (search.value.trim()) paint();
        else refreshMeta();
      }
      naming = false;
    };

    let cursor = '';
    for (let page = 0; page < 200 && backdrop.isConnected; page++) {
      const d = await getJson(`https://badges.roblox.com/v1/users/${me}/badges?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!d || !Array.isArray(d.data)) {
        loadFailed = true;
        break;
      }
      const fresh = new Set();
      for (const b of d.data) {
        const place = b.awarder && b.awarder.type === 'Place' ? String(b.awarder.id) : '';
        badges.push({ id: String(b.id), name: b.displayName || b.name || '', rate: Number(b.statistics && b.statistics.winRatePercentage) || 0, place });
        if (place && !places.has(place)) {
          places.set(place, '');
          fresh.add(place);
        }
      }
      nameQueue.push(...fresh);
      nameGames();
      if (page === 0 || page % 3 === 0) {
        paintGames();
        paint(true);
      }
      cursor = d.nextPageCursor || '';
      if (!cursor) break;
    }
    loading = false;
    if (!backdrop.isConnected) return;
    paintGames();
    paint(true);
  }

  function place() {
    const s = state;
    if (!s) return;
    const own = s.owner === s.me;
    const onBadges = own && /^#!\/badges(\/|\?|$)/i.test(location.hash);
    const bar = document.querySelector('#inventory-container .routility-inv-toolbar:not(.routility-bm-bar)');
    const fallback = document.querySelector('#inventory-container .routility-bm-bar');
    if (!onBadges) {
      document.querySelectorAll('.routility-bm-open, .routility-bm-bar').forEach(n => n.remove());
      return;
    }
    if (bar) {
      fallback?.remove();
      if (bar.querySelector(':scope > .routility-bm-open')) return;
      bar.appendChild(button());
      return;
    }
    if (fallback) return;
    const header = document.querySelector('#inventory-container assets-explorer .container-header');
    if (!header) return;
    const own2 = el('div', 'routility-injected routility-inv-toolbar routility-bm-bar');
    own2.appendChild(button());
    header.after(own2);
  }

  function button() {
    const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-small shrink-0 stroke-standard stroke-contrast-alpha bg-none height-1000 radius-medium padding-x-medium content-emphasis text-label-medium routility-injected routility-bm-open');
    b.type = 'button';
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', null, lt('Manage')));
    b.dataset.rtTip = lt('Delete badges you don’t want, or have new ones deleted automatically');
    b.addEventListener('click', open);
    return b;
  }

  function setup(owner) {
    teardown();
    const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    if (!me || String(owner) !== me) return;
    state = { owner: String(owner), me, modal: null };
    state.observer = new MutationObserver(onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    state.onHash = () => place();
    window.addEventListener('hashchange', state.onHash);
    place();
  }

  function teardown() {
    if (!state) return;
    state.observer.disconnect();
    window.removeEventListener('hashchange', state.onHash);
    state.modal?.remove();
    document.documentElement.classList.remove('routility-modal-open');
    state = null;
    document.querySelectorAll('.routility-bm-open, .routility-bm-bar').forEach(n => n.remove());
  }

  window.RoUtilityBadgeManage = { setup, teardown };
})();
