(function () {
  'use strict';

  const { el, json } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const HIDDEN_KEY = 'routilityHiddenGames';
  const HIDDEN_NAMES = 'routilityHiddenNames';
  let hiddenNames = {};
  const TILE = 'li.game-card, li.hover-game-tile, li.game-tile';
  const TILE_TODO = 'li.game-card:not([data-rt-tile]), li.hover-game-tile:not([data-rt-tile]), li.game-tile:not([data-rt-tile])';
  let settings = {};
  let hidden = [];
  let page = null;
  let toastTimer = null;
  let ready = false;
  let wantSetup = false;
  const PAGE_KEYS = ['friendsPlaying', 'recentlyUpdated', 'genreFilters', 'notInterested', 'homeGreeting', 'playtime'];

  chrome.storage.local.get(['routilitySettings', HIDDEN_KEY, HIDDEN_NAMES], (st) => {
    settings = st.routilitySettings || {};
    hiddenNames = st[HIDDEN_NAMES] || {};
    hidden = Array.isArray(st[HIDDEN_KEY]) ? st[HIDDEN_KEY].map(String) : [];
    ready = true;
    paintHidden();
    if (wantSetup) {
      wantSetup = false;
      setup();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const before = settings;
    if (changes.routilitySettings) settings = changes.routilitySettings.newValue || {};
    if (changes.routilitySettings && page && PAGE_KEYS.some(k => before[k] !== settings[k])) setup();
    if (changes[HIDDEN_KEY]) {
      hidden = (changes[HIDDEN_KEY].newValue || []).map(String);
      if (page && page.playing) page.render();
      if (page && page.renderRU) page.renderRU();
    }
    if (changes.routilitySettings || changes[HIDDEN_KEY]) paintHidden();
    if (changes.routilitySettings && page) {
      applyLayout();
      greeting();
    }
    if (changes[HIDDEN_NAMES]) hiddenNames = changes[HIDDEN_NAMES].newValue || {};
  });

  function paintHidden() {
    let style = document.getElementById('routility-hidden-games');
    const on = settings.notInterested !== false && hidden.length;
    if (!on) {
      style?.remove();
      return;
    }
    if (!style) {
      style = el('style');
      style.id = 'routility-hidden-games';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = hidden.map(id => `li[id="${id}"], li:has(a.game-card-link[id="${id}"]), li:has(a.game-card-link[href*="universeId=${id}&"]), li:has(a.game-card-link[href$="universeId=${id}"])`).join(',\n') + ' { display: none !important; }';
  }

  function universeOf(li) {
    const a = li.querySelector('a.game-card-link');
    if (a && /^\d+$/.test(a.id)) return a.id;
    if (/^\d+$/.test(li.id)) return li.id;
    const m = a && (a.getAttribute('href') || '').match(/[?&]universeId=(\d+)/);
    return m ? m[1] : null;
  }

  function saveHidden(list) {
    hidden = list;
    paintHidden();
    chrome.storage.local.set({ [HIDDEN_KEY]: list });
  }

  function toast(text, undo) {
    document.querySelector('.routility-toast')?.remove();
    clearTimeout(toastTimer);
    const box = el('div', 'routility-injected routility-toast flex items-center gap-large bg-system-contrast content-inverse-emphasis radius-medium padding-x-large padding-y-medium shadow-transient-high text-body-medium');
    box.setAttribute('role', 'status');
    box.appendChild(el('span', null, text));
    if (undo) {
      const btn = el('button', 'routility-toast-undo text-label-medium content-inverse-emphasis', lt('Undo'));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        undo();
        box.remove();
      });
      box.appendChild(btn);
    }
    document.body.appendChild(box);
    toastTimer = setTimeout(() => box.remove(), 5000);
  }

  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  let tileMenu = null;

  function closeTileMenu() {
    if (!tileMenu) return;
    tileMenu.pop.remove();
    tileMenu.btn.setAttribute('aria-expanded', 'false');
    tileMenu.btn.dataset.state = 'closed';
    document.removeEventListener('mousedown', tileMenu.outside, true);
    document.removeEventListener('keydown', tileMenu.key, true);
    if (tileMenu.untrack) tileMenu.untrack();
    tileMenu = null;
  }

  function hideGame(li, id) {
    const name = li.querySelector('.game-card-name')?.textContent.trim() || lt('This experience');
    const before = hidden.slice();
    if (!hidden.includes(id)) {
      hiddenNames = { ...hiddenNames, [id]: name };
      chrome.storage.local.set({ [HIDDEN_NAMES]: hiddenNames });
      saveHidden([...hidden, id]);
    }
    toast(lt('{name} is hidden from Home and Charts.', { name }), () => saveHidden(before));
  }

  function openTileMenu(btn, li, id) {
    if (tileMenu && tileMenu.btn === btn) return closeTileMenu();
    closeTileMenu();
    const pop = el('div', 'foundation-web-portal-zindex routility-injected routility-tile-menu');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', lt('Tile Menu'));
    pop.dataset.state = 'open';
    const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large');
    menu.setAttribute('role', 'menu');
    const group = el('div', 'padding-small');
    group.setAttribute('role', 'group');
    const item = el('button', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none foundation-web-menu-item flex items-center content-default text-truncate-split focus-visible:hover:outline-none cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small gap-x-medium radius-medium');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    item.appendChild(layer);
    const icon = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-circle-slash size-[var(--icon-size-medium)]');
    icon.setAttribute('aria-hidden', 'true');
    item.appendChild(icon);
    const text = el('div', 'grow-1 text-truncate-split flex flex-col gap-y-xsmall');
    text.appendChild(el('span', 'foundation-web-menu-item-title text-no-wrap text-truncate-split content-emphasis', lt('Not interested')));
    item.appendChild(text);
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeTileMenu();
      hideGame(li, id);
    });
    group.appendChild(item);
    menu.appendChild(group);
    pop.appendChild(menu);
    document.body.appendChild(pop);
    const place = () => {
      const r = btn.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.right - w))) + 'px';
      pop.style.top = Math.round(r.bottom + 4) + 'px';
    };
    place();
    btn.setAttribute('aria-expanded', 'true');
    btn.dataset.state = 'open';
    const outside = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeTileMenu(); };
    const key = (e) => { if (e.key === 'Escape') closeTileMenu(); };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', key, true);
    tileMenu = { pop, btn, outside, key };
    tileMenu.untrack = window.RoUtilityUI.trackPopover(pop, btn, place, closeTileMenu);
    item.focus({ preventScroll: true });
  }

  function personalRow(li) {
    const section = li.closest('.game-sort-carousel-wrapper, .games-list-container');
    const title = section?.querySelector('.home-sort-header-container [data-testid="text-icon-row-text"]')?.textContent.trim() || '';
    return /^(Continue|Favorites|Friends Playing)$/i.test(title);
  }

  function addHideButtons(root) {
    document.querySelectorAll('li > .routility-tile-more').forEach(btn => { if (personalRow(btn.parentElement)) btn.remove(); });
    if (settings.notInterested === false) return;
    for (const li of root.querySelectorAll(TILE_TODO)) {
      if (li.matches('.hover-game-tile') || li.querySelector(':scope > .routility-tile-more') || li.closest('#routility-friends-playing')) {
        li.dataset.rtTile = '1';
        continue;
      }
      const section = li.closest('.game-sort-carousel-wrapper, .games-list-container');
      const titled = !section || !!section.querySelector('.home-sort-header-container [data-testid="text-icon-row-text"]');
      if (personalRow(li)) {
        if (titled) li.dataset.rtTile = '1';
        continue;
      }
      const id = universeOf(li);
      if (!id) continue;
      li.dataset.rtTile = '1';
      const btn = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-over-media-0 routility-injected routility-tile-more');
      btn.type = 'button';
      btn.setAttribute('aria-label', lt('Open Tile Menu'));
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.dataset.state = 'closed';
      const layer = el('div', LAYER);
      layer.setAttribute('aria-hidden', 'true');
      btn.appendChild(layer);
      btn.appendChild(el('span', 'icon icon-filled-three-dots-horizontal size-500 content-emphasis'));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTileMenu(btn, li, id);
      });
      li.appendChild(btn);
    }
  }

  function closeNativeOnBackdrop(e) {
    const overlay = e.target;
    if (!overlay.classList?.contains('foundation-web-dialog-overlay') || overlay.classList.contains('routility-fp-modal')) return;
    if (!overlay.querySelector('[data-testid="game-players-player-interaction-modal"]')) return;
    overlay.querySelector('.modal-header .close')?.click();
  }
  document.addEventListener('mousedown', closeNativeOnBackdrop, true);

  function carousel(scroller) {
    scroller.classList.add('new-scroll-arrows');
    const win = scroller.querySelector('.horizontal-scroll-window');
    const inner = win && win.querySelector('.horizontally-scrollable');
    if (!inner) return;
    win.classList.remove('routility-fp-window');
    inner.style.left = '0px';
    const arrow = (dir) => {
      const d = el('div', `scroller-new ${dir}`);
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      d.setAttribute('aria-label', dir === 'next' ? lt('Next') : lt('Previous'));
      d.appendChild(el('span', dir === 'next' ? 'icon-chevron-heavy-right' : 'icon-chevron-heavy-left'));
      return d;
    };
    const prev = arrow('prev');
    const next = arrow('next');
    win.append(prev, next);
    let x = 0;
    const metrics = () => {
      const items = inner.querySelectorAll('ul > li');
      if (!items.length) return null;
      const a = items[0].getBoundingClientRect();
      const gap = items.length > 1 ? items[1].getBoundingClientRect().left - a.right : 0;
      const tile = a.width + gap;
      const view = win.clientWidth;
      const per = Math.max(1, Math.floor((view + gap) / tile));
      return { step: per * tile, max: Math.max(0, items.length * tile - gap - view) };
    };
    const update = () => {
      const m = metrics();
      if (!m) return;
      x = Math.min(Math.max(0, x), m.max);
      inner.style.left = `${-x}px`;
      prev.hidden = x <= 0;
      next.hidden = x >= m.max - 1;
      prev.setAttribute('aria-disabled', String(prev.hidden));
      next.setAttribute('aria-disabled', String(next.hidden));
    };
    const go = (dir) => {
      const m = metrics();
      if (!m) return;
      x += dir * m.step;
      update();
    };
    for (const [btn, dir] of [[prev, -1], [next, 1]]) {
      btn.addEventListener('click', () => go(dir));
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        go(dir);
      });
    }
    scroller.routilityUpdate = update;
    const ro = new ResizeObserver(() => update());
    ro.observe(win);
    const list = inner.querySelector('ul');
    if (list) ro.observe(list);
  }

  const ROWS_KEY = 'routilityHomeRows';

  function lastRows() {
    try { return JSON.parse(localStorage.getItem(ROWS_KEY) || '{}') || {}; } catch { return {}; }
  }

  function saveRows(kind, n) {
    try {
      const cur = lastRows();
      if (cur[kind] === n) return;
      cur[kind] = n;
      localStorage.setItem(ROWS_KEY, JSON.stringify(cur));
    } catch {}
  }

  function skeletonTile() {
    const li = el('li', 'list-item game-card game-tile routility-row-sk');
    const box = el('div', 'game-card-container');
    const a = el('div', 'game-card-link');
    const tb = el('div', 'game-card-thumb-container');
    tb.appendChild(el('span', 'thumbnail-2d-container game-tile-thumb routility-sk'));
    a.append(tb, el('div', 'game-card-name game-name-title routility-sk routility-row-sk-line', ' '), el('div', 'game-card-info routility-sk routility-row-sk-line routility-row-sk-short', ' '));
    box.appendChild(a);
    li.appendChild(box);
    return li;
  }

  function friendsPlaying(p) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me) return;
    const icons = new Map();
    const heads = new Map();
    let games = [];
    let row = null;
    let loaded = false;
    const expect = Math.min(6, Number(lastRows().fp) || 0);

    const load = async () => {
      if (document.visibilityState !== 'visible' && games.length) return;
      const data = await json(`https://friends.roblox.com/v1/users/${me}/friends/online`);
      if (p !== page) return;
      if (!data) {
        if (!loaded) {
          loaded = true;
          render();
        }
        return;
      }
      const by = new Map();
      for (const f of data.data || []) {
        const pr = f.userPresence || {};
        if (pr.UserPresenceType !== 'InGame' || !pr.universeId || !pr.rootPlaceId) continue;
        const key = String(pr.universeId);
        if (!by.has(key)) by.set(key, { universeId: key, placeId: pr.rootPlaceId, name: pr.lastLocation || '', friends: [], joins: {} });
        by.get(key).friends.push(String(f.id));
        by.get(key).joins[String(f.id)] = { placeId: pr.placeId || pr.rootPlaceId, instance: pr.gameInstanceId || '' };
      }
      games = [...by.values()].sort((a, b) => b.friends.length - a.friends.length || a.name.localeCompare(b.name));
      const needIcons = games.map(g => g.universeId).filter(id => !icons.has(id));
      const needHeads = [...new Set(games.flatMap(g => g.friends))].filter(id => !heads.has(id));
      await Promise.all([
        needIcons.length && json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${needIcons.slice(0, 100).join(',')}&returnPolicy=PlaceHolder&size=256x256&format=Webp&isCircular=false`).then(r => {
          for (const t of (r && r.data) || []) if (t.imageUrl) icons.set(String(t.targetId), t.imageUrl);
        }),
        needHeads.length && json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${needHeads.slice(0, 100).join(',')}&size=48x48&format=Webp&isCircular=false`).then(r => {
          for (const t of (r && r.data) || []) if (t.imageUrl) heads.set(String(t.targetId), t.imageUrl);
        }),
      ]);
      if (p !== page) return;
      loaded = true;
      render();
      setTimeout(() => {
        if (p !== page) return;
        const missing = [...new Set(games.flatMap(g => g.friends))].filter(id => !friendName(id));
        if (missing.length) fetchNames(missing);
      }, 1500);
    };

    const names = new Map();
    let nameJob = null;
    const fetchNames = (ids) => {
      const want = ids.filter(id => !names.has(id));
      if (!want.length) return nameJob || Promise.resolve();
      nameJob = json('https://users.roblox.com/v1/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: want.slice(0, 100).map(Number), excludeBannedUsers: false }) })
        .then((r) => { for (const u of (r && r.data) || []) names.set(String(u.id), u.displayName || u.name || ''); });
      return nameJob;
    };
    const friendName = (id) => names.get(id) || document.querySelector(`.friend-carousel-container a[href*="/users/${id}/profile"] .friends-carousel-display-name`)?.textContent.trim() || '';

    const closeModal = () => {
      document.querySelector('.routility-fp-modal')?.remove();
      document.removeEventListener('keydown', onModalKey, true);
    };
    const onModalKey = (e) => { if (e.key === 'Escape') closeModal(); };

    let opening = 0;
    const openModal = async (g) => {
      closeModal();
      const my = ++opening;
      const missing = g.friends.filter(id => !friendName(id));
      if (missing.length) await fetchNames(missing);
      if (my !== opening || p !== page) return;
      const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-fp-modal');
      overlay.dataset.state = 'open';
      const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high modal-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', lt('Experience'));
      dialog.dataset.state = 'open';
      dialog.dataset.size = 'Large';
      dialog.tabIndex = -1;
      const content = el('div', 'modal-content');
      const wrap = el('div');
      const head = el('div', 'modal-header');
      const close = el('button', 'close');
      close.type = 'button';
      close.setAttribute('aria-label', lt('Close'));
      close.appendChild(el('span', 'icon-close'));
      close.addEventListener('click', closeModal);
      head.append(close, el('h4', 'modal-title', lt('Experience')));
      const game = el('div', 'border-bottom player-interaction-container');
      const iconBox = el('span', 'cursor-pointer game-icon');
      const iconLink = el('a', 'game-card-link');
      iconLink.href = `https://www.roblox.com/games/${g.placeId}`;
      const thumb = el('span', 'thumbnail-2d-container');
      if (icons.has(g.universeId)) {
        const img = el('img', 'game-card-thumb');
        img.src = icons.get(g.universeId);
        img.alt = '';
        thumb.appendChild(img);
      }
      iconLink.appendChild(thumb);
      iconBox.appendChild(iconLink);
      const info = el('span', 'game-info-container');
      const nameLink = el('a', 'game-name', g.name);
      nameLink.href = `https://www.roblox.com/games/${g.placeId}`;
      info.appendChild(nameLink);
      game.append(iconBox, info);
      const people = el('div', 'interaction-container');
      const ul = el('ul', 'interaction-list');
      for (const id of g.friends) {
        const li = el('li', 'interaction-item');
        const av = el('span', 'avatar avatar-headshot avatar-headshot-sm player-avatar');
        const avLink = el('a', 'avatar-card-link');
        avLink.href = `https://www.roblox.com/users/${id}/profile`;
        const avThumb = el('span', 'thumbnail-2d-container');
        const avImg = el('img', 'avatar-card-image');
        avImg.alt = friendName(id);
        if (heads.has(id)) avImg.src = heads.get(id);
        avThumb.appendChild(avImg);
        avLink.appendChild(avThumb);
        av.appendChild(avLink);
        const row = el('div', 'border-bottom player-info');
        const who = el('a', 'player-name', friendName(id) || lt('Friend'));
        who.href = `https://www.roblox.com/users/${id}/profile`;
        row.appendChild(who);
        const j = g.joins[id] || {};
        const join = el('a', 'cursor-pointer btn-primary-sm player-action btn-primary-md btn-min-width', lt('Join'));
        join.href = `https://www.roblox.com/games/start?placeId=${j.placeId || g.placeId}${j.instance ? `&gameInstanceId=${j.instance}` : ''}`;
        join.addEventListener('click', () => setTimeout(closeModal, 0));
        row.appendChild(join);
        li.append(av, row);
        ul.appendChild(li);
      }
      people.appendChild(ul);
      wrap.append(head, game, people);
      content.appendChild(wrap);
      dialog.appendChild(content);
      overlay.appendChild(dialog);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
      document.addEventListener('keydown', onModalKey, true);
      document.body.appendChild(overlay);
      dialog.focus({ preventScroll: true });
    };

    const tile = (g) => {
      const li = el('li', 'list-item game-card game-tile');
      const box = el('div', 'game-card-container');
      box.dataset.testid = 'game-tile';
      const a = el('a', 'game-card-link');
      a.href = `https://www.roblox.com/games/${g.placeId}`;
      a.id = g.universeId;
      const thumbBox = el('div', 'game-card-thumb-container');
      const thumb = el('span', 'thumbnail-2d-container game-tile-thumb');
      if (icons.has(g.universeId)) {
        const img = el('img');
        img.src = icons.get(g.universeId);
        img.alt = g.name;
        thumb.appendChild(img);
      }
      thumbBox.appendChild(thumb);
      a.appendChild(thumbBox);
      a.appendChild(el('div', 'game-card-name game-name-title', g.name));
      const info = el('div', 'game-card-friend-info game-card-info');
      const avatars = el('div', 'info-avatar');
      const shown = g.friends.slice(0, 3);
      avatars.style.width = `${24 + 30 * (shown.length - 1)}px`;
      for (const id of shown) {
        const card = el('div', 'avatar-card');
        const span = el('span', 'thumbnail-2d-container avatar avatar-headshot avatar-headshot-xs');
        const img = el('img', 'avatar-card-image');
        img.alt = friendName(id);
        if (heads.has(id)) img.src = heads.get(id);
        span.appendChild(img);
        card.appendChild(span);
        avatars.appendChild(card);
      }
      info.appendChild(avatars);
      info.setAttribute('role', 'button');
      info.tabIndex = 0;
      info.setAttribute('aria-label', lt('See who’s playing {game}', { game: g.name }));
      const open = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal(g);
      };
      info.addEventListener('click', open);
      info.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
      if (g.friends.length > 3) info.appendChild(el('span', 'text-label-small content-muted routility-fp-more', `+${g.friends.length - 3}`));
      a.appendChild(info);
      box.appendChild(a);
      li.appendChild(box);
      return li;
    };

    const header = () => {
      const model = document.querySelector('.game-sort-carousel-wrapper .home-sort-header-container');
      const head = model ? model.cloneNode(true) : el('div', 'home-sort-header-container');
      const link = head.querySelector('a');
      if (link) {
        link.href = 'https://www.roblox.com/users/friends#!/friends';
        link.setAttribute('aria-label', lt('Friends Playing'));
        link.querySelector('[aria-label]')?.setAttribute('aria-label', lt('Friends Playing'));
      }
      const text = head.querySelector('[data-testid="text-icon-row-text"]') || head.querySelector('span');
      if (text) text.textContent = lt('Friends Playing');
      else head.appendChild(el('h2', null, lt('Friends Playing')));
      return head;
    };

    const render = () => {
      const list = games.filter(g => settings.notInterested === false || !hidden.includes(g.universeId));
      const friendsRow = document.querySelector('.game-home-page-container .friend-carousel-container');
      if (loaded) saveRows('fp', list.length);
      if ((loaded ? !list.length : !expect) || !friendsRow) {
        row?.remove();
        row = null;
        return;
      }
      if (!row) {
        row = el('div', 'game-sort-carousel-wrapper routility-injected routility-reveal');
        row.id = 'routility-friends-playing';
        row.appendChild(header());
        const scroller = el('div', 'horizontal-scroller games-list home-page-games-list dynamic-layout-sizing');
        const win = el('div', 'clearfix horizontal-scroll-window routility-fp-window');
        const inner = el('div', 'horizontally-scrollable');
        const ul = el('ul', 'hlist games game-cards game-tile-list home-page-carousel');
        const live = document.querySelector('.home-page-carousel');
        const per = live && live.style.getPropertyValue('--items-per-row');
        if (per) ul.style.setProperty('--items-per-row', per);
        inner.appendChild(ul);
        win.appendChild(inner);
        scroller.appendChild(win);
        row.appendChild(scroller);
        carousel(scroller);
      }
      const ul = row.querySelector('ul');
      const sig = loaded ? list.map(g => g.universeId + ':' + g.friends.join('.') + (icons.has(g.universeId) ? 'i' : '') + g.friends.filter(id => heads.has(id)).length).join('|') : 'sk';
      if (ul.dataset.sig !== sig) {
        ul.dataset.sig = sig;
        ul.textContent = '';
        if (!loaded) for (let i = 0; i < expect; i++) ul.appendChild(skeletonTile());
        else for (const g of list) ul.appendChild(tile(g));
      }
      if (row.previousElementSibling !== friendsRow) {
        friendsRow.after(row);
        if (document.documentElement.classList.contains('routility-layout-on')) applyLayout();
      }
    };

    p.render = render;
    p.place = () => {
      if (!games.length && (loaded || !expect)) return;
      const friendsRow = document.querySelector('.game-home-page-container .friend-carousel-container');
      if (friendsRow && (!row || !row.isConnected || row.previousElementSibling !== friendsRow)) render();
    };
    p.playing = true;
    load();
    p.timer = setInterval(load, 60000);
  }

  const GAME_SEEN = 'routilityGameSeen';
  const RU_CACHE = 'routilityRecentUpdates';
  const RU_DAYS = 14;

  function ago(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return lt('just now');
    if (s < 3600) return ltn(Math.floor(s / 60), '{n}m ago', '{n}m ago');
    if (s < 86400) return ltn(Math.floor(s / 3600), '{n}h ago', '{n}h ago');
    return ltn(Math.floor(s / 86400), '{n}d ago', '{n}d ago');
  }

  function markSeen(universeId) {
    if (!universeId) return;
    chrome.storage.local.get(GAME_SEEN, (st) => {
      const seen = st[GAME_SEEN] || {};
      seen[String(universeId)] = Date.now();
      const keys = Object.keys(seen);
      if (keys.length > 600) keys.sort((a, b) => seen[a] - seen[b]).slice(0, keys.length - 600).forEach(k => delete seen[k]);
      chrome.storage.local.set({ [GAME_SEEN]: seen });
    });
  }

  function recentlyUpdated(p) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me) return;
    const icons = new Map();
    let games = [];
    let seen = {};
    let row = null;
    let loaded = false;
    const expect = Math.min(6, Number(lastRows().ru) || 0);

    const continueIds = () => {
      const sec = pageSections().list.find(s => /^Continue$/i.test(s.title));
      if (!sec) return [];
      return [...sec.node.querySelectorAll('a.game-card-link[id]')].map(a => a.id).filter(id => /^\d+$/.test(id));
    };

    const load = async () => {
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(RU_CACHE) || 'null'); } catch {}
      if (!cached || cached.me !== me || Date.now() - cached.at > 10 * 60 * 1000) {
        const fav = await json(`https://games.roblox.com/v2/users/${me}/favorite/games?accessFilter=2&limit=100&sortOrder=Desc`);
        if (p !== page) return;
        const ids = [...new Set([...((fav && fav.data) || []).map(g => String(g.id)), ...continueIds()])].slice(0, 150);
        const list = [];
        for (let i = 0; i < ids.length; i += 50) {
          const d = await json(`https://games.roblox.com/v1/games?universeIds=${ids.slice(i, i + 50).join(',')}`);
          for (const g of (d && d.data) || []) {
            const at = Date.parse(g.updated);
            if (at) list.push({ universeId: String(g.id), placeId: String(g.rootPlaceId), name: g.name || '', updated: at });
          }
        }
        if (p !== page) return;
        cached = { at: Date.now(), me, games: list };
        try { sessionStorage.setItem(RU_CACHE, JSON.stringify(cached)); } catch {}
      }
      if (!chrome.runtime?.id) return;
      seen = await new Promise(r => chrome.storage.local.get(GAME_SEEN, st => r(st[GAME_SEEN] || {})));
      const cutoff = Date.now() - RU_DAYS * 86400000;
      games = cached.games.filter(g => g.updated >= cutoff).sort((a, b) => b.updated - a.updated).slice(0, 30);
      const need = games.map(g => g.universeId).filter(id => !icons.has(id));
      if (need.length) {
        const r = await json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${need.join(',')}&returnPolicy=PlaceHolder&size=256x256&format=Webp&isCircular=false`);
        for (const t of (r && r.data) || []) if (t.imageUrl) icons.set(String(t.targetId), t.imageUrl);
      }
      if (p !== page) return;
      loaded = true;
      render();
    };

    const tile = (g) => {
      const li = el('li', 'list-item game-card game-tile');
      const box = el('div', 'game-card-container');
      box.dataset.testid = 'game-tile';
      const a = el('a', 'game-card-link');
      a.href = `https://www.roblox.com/games/${g.placeId}`;
      a.id = g.universeId;
      a.addEventListener('click', () => markSeen(g.universeId));
      const thumbBox = el('div', 'game-card-thumb-container');
      const thumb = el('span', 'thumbnail-2d-container game-tile-thumb');
      if (icons.has(g.universeId)) {
        const img = el('img');
        img.src = icons.get(g.universeId);
        img.alt = g.name;
        thumb.appendChild(img);
      }
      thumbBox.appendChild(thumb);
      a.appendChild(thumbBox);
      a.appendChild(el('div', 'game-card-name game-name-title', g.name));
      const info = el('div', 'game-card-info routility-ru-info');
      const fresh = seen[g.universeId] && g.updated > seen[g.universeId];
      if (fresh) {
        const dot = el('span', 'routility-ru-dot');
        info.appendChild(dot);
        info.dataset.rtTip = lt('Updated since you last opened it');
      }
      info.appendChild(el('span', 'info-label' + (fresh ? ' routility-ru-fresh' : ''), lt('Updated {time}', { time: ago(g.updated) })));
      a.appendChild(info);
      box.appendChild(a);
      li.appendChild(box);
      return li;
    };

    const header = () => {
      const model = document.querySelector('.game-sort-carousel-wrapper .home-sort-header-container');
      const head = model ? model.cloneNode(true) : el('div', 'home-sort-header-container');
      head.querySelectorAll('.routility-home-tools').forEach(n => n.remove());
      const link = head.querySelector('a');
      if (link) {
        link.href = `https://www.roblox.com/users/${me}/favorites#!/places`;
        link.setAttribute('aria-label', lt('Recently Updated'));
        link.querySelector('[aria-label]')?.setAttribute('aria-label', lt('Recently Updated'));
      }
      const text = head.querySelector('[data-testid="text-icon-row-text"]') || head.querySelector('span');
      if (text) text.textContent = lt('Recently Updated');
      else head.appendChild(el('h2', null, lt('Recently Updated')));
      return head;
    };

    const anchor = () => document.getElementById('routility-friends-playing') || document.querySelector('.game-home-page-container .friend-carousel-container');

    const render = () => {
      const list = games.filter(g => settings.notInterested === false || !hidden.includes(g.universeId));
      const after = anchor();
      if (loaded) saveRows('ru', list.length);
      if ((loaded ? !list.length : !expect) || !after) {
        row?.remove();
        row = null;
        return;
      }
      if (!row) {
        row = el('div', 'game-sort-carousel-wrapper routility-injected routility-reveal');
        row.id = 'routility-recently-updated';
        row.appendChild(header());
        const scroller = el('div', 'horizontal-scroller games-list home-page-games-list dynamic-layout-sizing');
        const win = el('div', 'clearfix horizontal-scroll-window routility-fp-window');
        const inner = el('div', 'horizontally-scrollable');
        const ul = el('ul', 'hlist games game-cards game-tile-list home-page-carousel');
        const live = document.querySelector('.home-page-carousel');
        const per = live && live.style.getPropertyValue('--items-per-row');
        if (per) ul.style.setProperty('--items-per-row', per);
        inner.appendChild(ul);
        win.appendChild(inner);
        scroller.appendChild(win);
        row.appendChild(scroller);
        carousel(scroller);
      }
      const ul = row.querySelector('ul');
      const sig = loaded ? list.map(g => g.universeId + (icons.has(g.universeId) ? 'i' : '') + (seen[g.universeId] || 0)).join('|') : 'sk';
      if (ul.dataset.sig !== sig) {
        ul.dataset.sig = sig;
        ul.textContent = '';
        if (!loaded) for (let i = 0; i < expect; i++) ul.appendChild(skeletonTile());
        else for (const g of list) ul.appendChild(tile(g));
      }
      if (!row.isConnected) {
        after.after(row);
        if (document.documentElement.classList.contains('routility-layout-on')) applyLayout();
      }
    };

    p.renderRU = render;
    p.placeRU = () => {
      if (!games.length && (loaded || !expect)) return;
      if (!row || !row.isConnected) render();
    };
    setTimeout(() => { if (p === page) load(); }, 1500);
  }

  const GENRE_KEY = 'routilityGenres';
  const GENRE_TTL = 7 * 86400000;
  const CHIP_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]';

  function genreChip(label, on, onClick) {
    const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-genre-chip ' + (on ? 'bg-inverse-surface-0 content-inverse-emphasis' : 'bg-shift-300 content-action-utility'));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(on));
    const layer = el('div', CHIP_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', label));
    b.addEventListener('click', onClick);
    return b;
  }

  function genreFilters(p) {
    let known = {};
    let pick = { l1: '', l2: '' };
    try { pick = { l1: '', l2: '', ...JSON.parse(sessionStorage.getItem('routilityGenrePick') || '{}') }; } catch {}
    let loading = false;
    let saveTimer = null;
    let bar = null;
    let drops = [];
    let open = '';
    let lastKey = '';
    const ready = new Promise(r => chrome.storage.local.get(GENRE_KEY, (st) => {
      const all = st[GENRE_KEY] || {};
      const now = Date.now();
      for (const [id, v] of Object.entries(all)) if (Array.isArray(v) && now - v[2] < GENRE_TTL) known[id] = v;
      r();
    }));

    const tiles = () => [...document.querySelectorAll('#content a.game-card-link[id]')].filter(a => /^\d+$/.test(a.id));

    const fetchMissing = async () => {
      if (loading) return;
      const need = [...new Set(tiles().map(a => a.id))].filter(id => !known[id]);
      if (!need.length) return;
      loading = true;
      for (let i = 0; i < need.length && p === page; i += 50) {
        const d = await json(`https://games.roblox.com/v1/games?universeIds=${need.slice(i, i + 50).join(',')}`);
        const now = Date.now();
        for (const g of (d && d.data) || []) known[String(g.id)] = [g.genre_l1 || '', g.genre_l2 || '', now];
        for (const id of need.slice(i, i + 50)) if (!known[id]) known[id] = ['', '', now];
        apply();
      }
      loading = false;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const keys = Object.keys(known);
        const trimmed = keys.length > 4000 ? Object.fromEntries(keys.sort((a, b) => known[b][2] - known[a][2]).slice(0, 4000).map(k => [k, known[k]])) : known;
        chrome.storage.local.set({ [GENRE_KEY]: trimmed });
      }, 1500);
      if (p === page && tiles().some(a => !known[a.id])) fetchMissing();
    };

    const choose = (next) => {
      pick = next;
      try { sessionStorage.setItem('routilityGenrePick', JSON.stringify(pick)); } catch {}
      lastKey = '';
      apply();
    };

    const counts = (level, within) => {
      const seen = new Set();
      const map = new Map();
      for (const a of tiles()) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        const g = known[a.id];
        if (!g || !g[level]) continue;
        if (within && g[0] !== within) continue;
        map.set(g[level], (map.get(g[level]) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]);
    };

    const closeDrop = (e) => {
      if (!open || (e && e.type === 'mousedown' && drops.some(d => d.contains(e.target)))) return;
      if (e && e.type === 'keydown' && e.key !== 'Escape') return;
      open = '';
      lastKey = '';
      paintBar();
    };
    document.addEventListener('mousedown', closeDrop, true);
    document.addEventListener('keydown', closeDrop, true);
    p.genreStop = () => {
      document.removeEventListener('mousedown', closeDrop, true);
      document.removeEventListener('keydown', closeDrop, true);
    };

    const dropdown = (kind, title, label, options, selected, onPick) => {
      const wrap = el('div', 'routility-injected routility-genre-filter');
      const on = !!selected;
      const btn = el('button', 'filter-select btn-min-width ' + (on ? 'btn-primary-md' : 'btn-secondary-md'));
      btn.type = 'button';
      btn.setAttribute('aria-expanded', String(open === kind));
      btn.append(el('span', 'filter-display-text', label), el('span', on ? 'icon-expand-arrow-selected' : 'icon-expand-arrow'));
      btn.addEventListener('click', () => {
        open = open === kind ? '' : kind;
        lastKey = '';
        paintBar();
      });
      wrap.appendChild(btn);
      if (open !== kind) return wrap;
      const modal = el('div', 'filters-modal-container');
      const head = el('div', 'header-container');
      head.appendChild(el('h3', null, title));
      const x = el('button', 'header-close-button');
      x.type = 'button';
      x.setAttribute('aria-label', lt('Close'));
      x.appendChild(el('span', 'icon-close'));
      x.addEventListener('click', () => closeDrop());
      const xBox = el('div');
      xBox.appendChild(x);
      head.appendChild(xBox);
      const list = el('div', 'filter-options-container');
      options.forEach(([value, text], i) => {
        const chosen = value === selected;
        const o = el('button', 'filter-option' + (chosen ? ' selected-option' : ''));
        o.type = 'button';
        o.setAttribute('aria-label', chosen ? lt('{name} selected', { name: text }) : lt('{name} not selected', { name: text }));
        const right = el('span', 'flex gap-small');
        right.appendChild(el('span', chosen ? 'icon-radio-check-circle-filled' : 'icon-radio-check-circle'));
        o.append(el('span', 'filter-option-name', text), right);
        o.addEventListener('click', () => {
          open = '';
          onPick(value);
        });
        list.appendChild(o);
        if (i === 0) list.appendChild(el('div', 'filter-option-divider'));
      });
      modal.append(head, list);
      wrap.appendChild(modal);
      return wrap;
    };

    const paintDrops = (host, l1, l2) => {
      bar?.remove();
      const key = JSON.stringify([l1, l2, pick, open]);
      if (drops.length && drops.every(d => d.parentElement === host) && key === lastKey) return;
      lastKey = key;
      drops.forEach(d => d.remove());
      drops = [];
      if (!l1.length) return;
      drops.push(dropdown('l1', lt('Genre'), pick.l1 || lt('All Genres'), [['', lt('All Genres')], ...l1.map(g => [g, g])], pick.l1, (v) => choose({ l1: v, l2: '' })));
      if (pick.l1 && l2.length > 1) drops.push(dropdown('l2', pick.l1, pick.l2 || lt('All {genre}', { genre: pick.l1 }), [['', lt('All {genre}', { genre: pick.l1 })], ...l2.map(g => [g, g])], pick.l2, (v) => choose({ l1: pick.l1, l2: v })));
      host.append(...drops);
    };

    const paintBar = () => {
      const l1 = counts(0);
      const l2 = pick.l1 ? counts(1, pick.l1) : [];
      const host = document.querySelector('#content .filters-container .filter-items-container');
      if (host) return paintDrops(host, l1, l2);
      const head = document.querySelector('#content .games-list-header');
      if (!head) return;
      const key = JSON.stringify([l1, l2, pick]);
      if (bar && bar.isConnected && key === lastKey) return;
      lastKey = key;
      if (!l1.length) {
        bar?.remove();
        return;
      }
      if (!bar) bar = el('div', 'routility-injected routility-genre-bar');
      bar.textContent = '';
      const top = el('div', 'routility-genre-row');
      top.appendChild(genreChip(lt('All Genres'), !pick.l1, () => choose({ l1: '', l2: '' })));
      for (const g of l1) top.appendChild(genreChip(g, pick.l1 === g, () => choose(pick.l1 === g ? { l1: '', l2: '' } : { l1: g, l2: '' })));
      bar.appendChild(top);
      if (pick.l1 && l2.length > 1) {
        const sub = el('div', 'routility-genre-row routility-genre-sub');
        sub.appendChild(genreChip(lt('All {genre}', { genre: pick.l1 }), !pick.l2, () => choose({ l1: pick.l1, l2: '' })));
        for (const g of l2) sub.appendChild(genreChip(g, pick.l2 === g, () => choose({ l1: pick.l1, l2: pick.l2 === g ? '' : g })));
        bar.appendChild(sub);
      }
      if (head.nextElementSibling !== bar) head.after(bar);
    };

    const apply = () => {
      if (p !== page) return;
      paintBar();
      const active = !!pick.l1;
      document.documentElement.classList.toggle('routility-genre-on', active);
      for (const a of tiles()) {
        const li = a.closest('li') || a.closest('.grid-item-container');
        if (!li) continue;
        const g = known[a.id];
        const off = active && (!g || g[0] !== pick.l1 || (pick.l2 && g[1] !== pick.l2));
        li.classList.toggle('routility-genre-off', off);
      }
      for (const head of document.querySelectorAll('#content .home-sort-header-container')) {
        const sec = head.closest('.game-sort-carousel-wrapper, .games-list-container') || head.parentElement;
        if (!sec || sec.contains(bar)) continue;
        const all = sec.querySelectorAll('a.game-card-link[id]');
        const empty = active && all.length > 0 && ![...all].some(a => !(a.closest('li') || a.closest('.grid-item-container'))?.classList.contains('routility-genre-off'));
        sec.classList.toggle('routility-genre-empty', empty);
      }
    };

    p.genre = () => {
      apply();
      fetchMissing();
    };
    ready.then(() => { if (p === page) p.genre(); });
  }

  const LAYOUT_KEY = 'routilityLayouts';
  const SEEN_KEY = 'routilityLayoutSeen';
  const CHARTS_CLASSIC = ['Top Playing Now', 'Most Popular', 'Top Earning', 'Top Rated', 'Up-and-Coming', 'Fun with Friends', 'Top Paid Access', 'Learn & Explore', 'Top Trending', 'Top Revisited'];
  const HOME_DEFAULT = ['Continue#1', 'Friends Playing#1', 'Recently Updated#1', 'Recommended For You#1', 'Standout Games#1', 'Recommended For You#2', 'Favorites#1', 'Recommended For You#3'];
  let layouts = { home: { order: [...HOME_DEFAULT], hidden: [] }, charts: { order: [], hidden: [] } };
  let seenSaved = {};
  let editing = false;

  const cleanLayout = (v) => ({ order: Array.isArray(v && v.order) ? v.order.map(String) : [], hidden: Array.isArray(v && v.hidden) ? v.hidden.map(String) : [] });

  chrome.storage.local.get([LAYOUT_KEY, SEEN_KEY, 'routilityHomeLayout'], (st) => {
    const v = st[LAYOUT_KEY];
    if (v) layouts = { home: cleanLayout(v.home), charts: cleanLayout(v.charts) };
    else if (st.routilityHomeLayout) {
      layouts.home = cleanLayout(st.routilityHomeLayout);
      chrome.storage.local.set({ [LAYOUT_KEY]: layouts });
      chrome.storage.local.remove('routilityHomeLayout');
    }
    seenSaved = st[SEEN_KEY] || {};
    applyLayout();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[LAYOUT_KEY]) return;
    const v = changes[LAYOUT_KEY].newValue || { home: { order: HOME_DEFAULT } };
    layouts = { home: cleanLayout(v.home), charts: cleanLayout(v.charts) };
    applyLayout();
  });

  function layoutKind() {
    if (settings.homeLayout === false) return null;
    if (/^\/home\/?$/i.test(location.pathname)) return 'home';
    if (/^\/charts\/?$/i.test(location.pathname)) return 'charts';
    return null;
  }

  function sectionHost() {
    const heads = [...document.querySelectorAll('#content .home-sort-header-container')];
    if (!heads.length) return null;
    let host = heads[0].parentElement;
    while (host && host !== document.body && !heads.every(h => host.contains(h))) host = host.parentElement;
    if (!host || host === document.body) return null;
    if (host.matches('.home-sort-header-container, .games-list-container, .game-sort-carousel-wrapper')) host = host.parentElement;
    return host;
  }

  function pageSections() {
    const host = sectionHost();
    if (!host) return { host: null, list: [] };
    const seen = new Map();
    const list = [];
    for (const child of host.children) {
      const head = child.matches('.home-sort-header-container') ? child : child.querySelector('.home-sort-header-container');
      if (!head || child.matches('.friend-carousel-container')) continue;
      const title = (head.querySelector('[data-testid="text-icon-row-text"]') || head).textContent.trim();
      if (!title) continue;
      const own = child.id === 'routility-friends-playing' || child.querySelector(':scope #routility-friends-playing') ? 'Friends Playing' : child.id === 'routility-recently-updated' || child.querySelector(':scope #routility-recently-updated') ? 'Recently Updated' : '';
      const base = own || title;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      list.push({ node: child, title, key: `${base}#${n}` });
    }
    return { host, list };
  }

  function arranged(list, lay) {
    return list.map((s, i) => {
      const at = lay.order.indexOf(s.key);
      return { ...s, rank: at >= 0 ? at : 1000 + i };
    }).sort((a, b) => a.rank - b.rank);
  }

  let seenWrite = null;

  function sectionThumbs(node) {
    return [...node.querySelectorAll('.game-card-thumb-container img[src], .featured-game-container img[src]')]
      .filter(img => !img.closest('.game-card-friend-info, .info-avatar') && /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//.test(img.src))
      .map(img => img.src).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
  }

  let seenAt = 0;

  function rememberSeen(kind, list) {
    if (Date.now() - seenAt < 4000) return;
    seenAt = Date.now();
    const old = seenSaved[kind] || [];
    const next = list.map(s => {
      const prev = old.find(x => x.key === s.key) || {};
      const thumbs = sectionThumbs(s.node);
      return { key: s.key, title: s.title, grid: !!s.node.querySelector('.game-grid, .hover-game-tile'), thumbs: thumbs.length >= 3 || !prev.thumbs ? thumbs : prev.thumbs };
    });
    const merged = [...next, ...old.filter(x => !next.some(y => y.key === x.key))].slice(0, 60);
    const patch = { ...seenSaved, [kind]: merged };
    if (kind === 'home') {
      const friends = [...document.querySelectorAll('.friend-carousel-container .avatar-card-image img[src]')].map(i => i.src).filter(src => /rbxcdn\.com\//.test(src)).slice(0, 12);
      if (friends.length) patch.homeFriends = friends;
    }
    if (JSON.stringify(patch) === JSON.stringify(seenSaved)) return;
    seenSaved = patch;
    clearTimeout(seenWrite);
    seenWrite = setTimeout(() => {
      if (!chrome.runtime?.id) return;
      chrome.storage.local.set({ [SEEN_KEY]: seenSaved }).catch(() => {});
    }, 2000);
  }

  function applyLayout() {
    const kind = layoutKind();
    const root = document.documentElement;
    root.classList.toggle('routility-layout-on', !!kind);
    root.classList.toggle('routility-layout-editing', !!kind && editing);
    if (!kind) {
      editButton(null);
      return;
    }
    const lay = layouts[kind];
    const { host, list } = pageSections();
    if (host && host.dataset.routilityArrange !== kind) host.dataset.routilityArrange = kind;
    const sorted = arranged(list, lay);
    const sig = sorted.map(s => s.key + (lay.hidden.includes(s.key) ? '-' : '')).join('|') + (editing ? 'e' : '');
    if (sig !== layoutSig) {
      layoutSig = sig;
      anchorMemo = null;
    }
    sorted.forEach((s, i) => {
      const order = String(i + 1);
      if (s.node.style.order !== order) s.node.style.order = order;
      if (s.node.dataset.routilitySection !== s.key) s.node.dataset.routilitySection = s.key;
      if (lay.hidden.includes(s.key)) s.node.dataset.routilityHidden = '1';
      else if (s.node.dataset.routilityHidden) delete s.node.dataset.routilityHidden;
      tools(kind, s, i, sorted.length, editing);
    });
    if (list.length) rememberSeen(kind, list);
    editButton(kind);
  }

  function saveLayout(kind, next) {
    layouts = { ...layouts, [kind]: next };
    chrome.storage.local.set({ [LAYOUT_KEY]: layouts });
    applyLayout();
  }

  function move(kind, key, dir) {
    const keys = arranged(pageSections().list, layouts[kind]).map(s => s.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    saveLayout(kind, { ...layouts[kind], order: keys });
  }

  function smallButton(label, onClick, emphasis) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-small height-800 padding-x-medium ' + (emphasis ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const l = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none');
    l.setAttribute('aria-hidden', 'true');
    b.appendChild(l);
    b.appendChild(el('span', 'text-no-wrap', label));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function arrowButton(label, up, disabled, onClick) {
    const b = el('button', 'foundation-web-icon-button relative clip group/interactable cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard disabled:opacity-[0.5] routility-home-arrow');
    b.type = 'button';
    b.disabled = disabled;
    b.setAttribute('aria-label', label);
    b.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis' + (up ? ' routility-home-up' : '')));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  let dragging = null;

  function dropLine() {
    let line = document.querySelector('.routility-drop-line');
    if (!line) {
      line = el('div', 'routility-injected routility-drop-line');
      line.setAttribute('aria-hidden', 'true');
      document.body.appendChild(line);
    }
    return line;
  }

  function dragTarget(y) {
    const list = dragging.list;
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const r = list[i].node.getBoundingClientRect();
      if (!r.height) continue;
      if (y < r.top + r.height / 2) return { index: i, rect: r, before: true };
      best = { index: i, rect: r, before: false };
    }
    return best;
  }

  function dragMove(e) {
    if (!dragging) return;
    dragging.y = e.clientY;
    const t = dragTarget(e.clientY);
    const line = dropLine();
    if (!t) {
      line.style.display = 'none';
      return;
    }
    dragging.target = t;
    const host = dragging.list[0].node.parentElement.getBoundingClientRect();
    line.style.display = 'block';
    line.style.left = Math.round(host.left) + 'px';
    line.style.width = Math.round(host.width) + 'px';
    line.style.top = Math.round((t.before ? t.rect.top - 8 : t.rect.bottom + 6)) + 'px';
  }

  function dragScroll() {
    if (!dragging) return;
    const y = dragging.y;
    const edge = 90;
    if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 6));
    else if (y > innerHeight - edge) window.scrollBy(0, Math.ceil((y - (innerHeight - edge)) / 6));
    if (dragging.y != null) dragMove({ clientY: dragging.y });
    dragging.raf = requestAnimationFrame(dragScroll);
  }

  function dragEnd() {
    if (!dragging) return;
    const d = dragging;
    dragging = null;
    cancelAnimationFrame(d.raf);
    document.removeEventListener('pointermove', dragMove, true);
    document.removeEventListener('pointerup', dragEnd, true);
    document.removeEventListener('pointercancel', dragEnd, true);
    document.documentElement.classList.remove('routility-layout-dragging');
    delete d.node.dataset.routilityDragging;
    document.querySelector('.routility-drop-line')?.remove();
    if (!d.target) return;
    const keys = d.list.map(x => x.key);
    const from = keys.indexOf(d.key);
    let to = d.target.index + (d.target.before ? 0 : 1);
    if (from < to) to--;
    if (from === to || from < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, d.key);
    saveLayout(d.kind, { ...layouts[d.kind], order: keys });
  }

  function dragStart(kind, s, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = { kind, key: s.key, node: s.node, list: arranged(pageSections().list, layouts[kind]), y: e.clientY, target: null, raf: 0 };
    s.node.dataset.routilityDragging = '1';
    document.documentElement.classList.add('routility-layout-dragging');
    document.addEventListener('pointermove', dragMove, true);
    document.addEventListener('pointerup', dragEnd, true);
    document.addEventListener('pointercancel', dragEnd, true);
    dragMove(e);
    dragging.raf = requestAnimationFrame(dragScroll);
  }

  function tools(kind, s, index, count, show) {
    let box = s.node.querySelector('.routility-home-tools');
    if (!show) {
      box?.remove();
      return;
    }
    const isHidden = layouts[kind].hidden.includes(s.key);
    const state = `${index}/${count}/${isHidden ? 1 : 0}`;
    if (box && box.dataset.state === state && box.isConnected) return;
    box?.remove();
    box = el('div', 'routility-injected routility-home-tools flex items-center gap-small');
    box.dataset.state = state;
    const grip = el('button', 'foundation-web-icon-button relative clip flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard routility-home-grip');
    grip.type = 'button';
    grip.setAttribute('aria-label', lt('Drag {section} to move it', { section: s.title }));
    grip.dataset.rtTip = lt('Drag to move');
    grip.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-grip size-400 content-emphasis'));
    grip.addEventListener('pointerdown', (e) => dragStart(kind, s, e));
    grip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    box.appendChild(grip);
    box.appendChild(arrowButton(lt('Move {section} up', { section: s.title }), true, index === 0, () => move(kind, s.key, -1)));
    box.appendChild(arrowButton(lt('Move {section} down', { section: s.title }), false, index === count - 1, () => move(kind, s.key, 1)));
    box.appendChild(smallButton(isHidden ? lt('Show') : lt('Hide'), () => {
      const lay = layouts[kind];
      const hiddenKeys = isHidden ? lay.hidden.filter(k => k !== s.key) : [...lay.hidden, s.key];
      saveLayout(kind, { order: arranged(pageSections().list, lay).map(x => x.key), hidden: hiddenKeys });
    }));
    if (isHidden) box.appendChild(el('span', 'text-label-small content-muted', lt('Hidden')));
    const title = s.node.querySelector('[data-testid="section-header"] > [data-testid="section-header-title-subtitle-container"], .home-sort-header-container [data-testid="section-header-title-subtitle-container"]');
    if (title) title.after(box);
    else {
      box.classList.add('routility-home-tools-corner');
      s.node.appendChild(box);
    }
  }

  let anchorMemo = null;
  let layoutSig = '';

  function homeEditAnchor() {
    if (anchorMemo && anchorMemo.isConnected) return anchorMemo;
    anchorMemo = homeEditAnchorFind();
    return anchorMemo;
  }

  function homeEditAnchorFind() {
    const heads = [...document.querySelectorAll('#HomeContainer [data-testid="section-header"], .home-container [data-testid="section-header"]')]
      .filter(h => !h.closest('.friend-carousel-container, .friends-carousel-container'));
    let best = null;
    let top = Infinity;
    heads.forEach((h, i) => {
      const sec = h.closest('[data-routility-section]');
      if (sec && sec.dataset.routilityHidden && !editing) return;
      const rank = (sec && Number(sec.style.order) ? Number(sec.style.order) * 1000 : 900000) + i;
      if (rank < top) {
        top = rank;
        best = h;
      }
    });
    return best;
  }

  function editButton(kind) {
    const head = kind === 'home'
      ? homeEditAnchor()
      : kind === 'charts' ? document.querySelector('#content .games-list-header:has(> h1)') : null;
    const bars = [...document.querySelectorAll('.routility-home-edit')];
    let bar = bars.find(b => b.parentElement === head) || bars[0] || null;
    for (const extra of bars) if (extra !== bar) extra.remove();
    if (!kind || !head) {
      bar?.remove();
      if (!kind) editing = false;
      return;
    }
    const state = (editing ? 'edit' : 'view') + kind;
    const random = kind === 'charts' ? head.querySelector(':scope > .routility-random-game') : null;
    if (bar && bar.dataset.state === state && bar.parentElement === head && (!random || bar.nextElementSibling === random)) return;
    bar?.remove();
    bar = el('div', 'routility-injected routility-home-edit flex items-center gap-small');
    bar.dataset.state = state;
    if (editing) {
      if (kind === 'home') {
        bar.appendChild(smallButton(lt('Classic Order'), () => {
          const keys = pageSections().list.map(s => s.key);
          const cont = keys.find(k => /^Continue#/.test(k));
          saveLayout('home', { order: cont ? [cont, ...keys.filter(k => k !== cont)] : keys, hidden: layouts.home.hidden });
        }));
      } else {
        bar.appendChild(smallButton(lt('Classic Order'), () => {
          const keys = pageSections().list.map(s => s.key);
          const rank = (k) => {
            const i = CHARTS_CLASSIC.indexOf(k.replace(/#\d+$/, ''));
            return i < 0 ? CHARTS_CLASSIC.length : i;
          };
          saveLayout('charts', { order: keys.map((k, i) => [k, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]), hidden: layouts.charts.hidden });
        }));
      }
      bar.appendChild(smallButton(lt('Reset'), () => saveLayout(kind, { order: kind === 'home' ? [...HOME_DEFAULT] : [], hidden: [] })));
      bar.appendChild(smallButton(lt('Done'), () => {
        editing = false;
        applyLayout();
      }, true));
    } else {
      bar.appendChild(smallButton(lt('Customize'), () => {
        editing = true;
        applyLayout();
      }));
    }
    if (kind === 'charts') {
      bar.querySelectorAll('.foundation-web-button').forEach(btn => {
        btn.classList.replace('height-800', 'height-1000');
        btn.classList.replace('text-label-small', 'text-label-medium');
      });
    }
    if (random) random.before(bar);
    else head.appendChild(bar);
  }

  const GREET_KEY = 'routilityGreeting';

  function greetingCache() {
    try { return JSON.parse(sessionStorage.getItem(GREET_KEY) || 'null'); } catch { return null; }
  }

  async function greetingExtras(id) {
    const fun = window.RoUtilityFun;
    if (fun && fun.ready) await fun.ready;
    const wearing = !!(fun && fun.worn && fun.worn().length);
    const cached = wearing ? null : greetingCache();
    if (cached && cached.id === id && Date.now() - cached.at < 3600000) return cached;
    const get = (u) => fetch(u, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const thumb = await get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Webp&isCircular=true`);
    const d = thumb && thumb.data && thumb.data[0];
    const out = { id, at: Date.now(), head: d && d.state === 'Completed' ? d.imageUrl : '' };
    try { if (wearing) sessionStorage.removeItem(GREET_KEY); else sessionStorage.setItem(GREET_KEY, JSON.stringify(out)); } catch {}
    return out;
  }

  const PT_RANGES = [['day', LT('Today'), 1], ['week', LT('Past 7 Days'), 7], ['month', LT('Past 30 Days'), 30], ['all', LT('All Time'), 0]];
  const PT_INFO = 'routilityPlayInfo';
  let ptListen = null;

  function ptDay(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function ptTime(min) {
    if (min < 60) return ltn(min, '{n}m', '{n}m');
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h >= 100 || !m ? ltn(h, '{n}h', '{n}h', { n: h.toLocaleString() }) : lt('{h}h {m}m', { h, m });
  }

  function ptTotals(data, range) {
    const days = (data && data.days) || {};
    const span = (PT_RANGES.find(r => r[0] === range) || PT_RANGES[3])[2];
    const from = span ? ptDay(Date.now() - (span - 1) * 86400000) : '';
    const out = new Map();
    for (const [day, games] of Object.entries(days)) {
      if (from && day < from) continue;
      for (const [uni, min] of Object.entries(games)) out.set(uni, (out.get(uni) || 0) + min);
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
  }

  async function ptInfo(ids) {
    let cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(PT_INFO) || '{}'); } catch {}
    const need = ids.filter(id => !cache[id]);
    if (need.length) {
      const get = (u) => fetch(u, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const [games, icons] = await Promise.all([
        get(`https://games.roblox.com/v1/games?universeIds=${need.join(',')}`),
        get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${need.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Webp&isCircular=false`),
      ]);
      const icon = new Map(((icons && icons.data) || []).map(x => [String(x.targetId), x.state === 'Completed' ? x.imageUrl : '']));
      for (const g of (games && games.data) || []) cache[String(g.id)] = { name: g.name, place: g.rootPlaceId, icon: icon.get(String(g.id)) || '' };
      try { sessionStorage.setItem(PT_INFO, JSON.stringify(cache)); } catch {}
    }
    return cache;
  }

  function ptRange() {
    try { return localStorage.getItem('routilityPlayRange') || 'week'; } catch { return 'week'; }
  }

  const askBg = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; resolve(res || null); });
    } catch {
      resolve(null);
    }
  });

  function backupButton(id) {
    const btn = el('button', 'routility-pt-backup text-label-small');
    btn.type = 'button';
    btn.hidden = true;
    const icon = el('span', 'icon icon-filled-circle-check routility-pt-backup-icon');
    icon.setAttribute('aria-hidden', 'true');
    const label = el('span');
    btn.append(icon, label);
    let mode = 'off';
    let pairing = null;
    let pollTimer = 0;
    const set = (next, text, tip) => {
      mode = next;
      btn.hidden = next === 'off';
      btn.classList.toggle('routility-pt-backup-done', next === 'done');
      btn.classList.toggle('routility-pt-backup-busy', next === 'busy');
      label.textContent = text || '';
      if (tip) btn.dataset.rtTip = tip;
      else delete btn.dataset.rtTip;
    };
    const paint = async () => {
      if (pairing) return;
      const st = await askBg({ type: 'playtimeSyncState' });
      if (!btn.isConnected && mode !== 'off') return;
      if (!st) return set('off');
      if (!st.signedIn) return set('in', lt('Back Up'), lt('Keep your playtime if you reinstall or switch computers. Signs in with Roblox in a popup, the same as the RoUtility Forum.'));
      if (String(st.userId) !== String(id)) return set('off');
      const synced = st.sync && st.sync.syncedAt ? Date.parse(st.sync.syncedAt) : 0;
      set('done', lt('Backed Up'), synced ? lt('Backed up to your RoUtility account. Last synced {ago}. Click to sync now.', { ago: ago(synced) }) : lt('Backed up to your RoUtility account. It syncs every few minutes while you play. Click to sync now.'));
    };
    const stop = () => {
      clearTimeout(pollTimer);
      if (pairing) askBg({ type: 'forumSignInClose', pairing });
      pairing = null;
    };
    const fail = (text) => {
      stop();
      set('in', text, lt('Try again. If the popup didn’t open, allow popups for roblox.com.'));
      setTimeout(paint, 3500);
    };
    btn.addEventListener('click', async () => {
      if (mode === 'busy') {
        stop();
        return paint();
      }
      if (mode === 'done') {
        set('busy', lt('Syncing…'));
        await askBg({ type: 'playtimeSyncNow' });
        return paint();
      }
      set('busy', lt('Waiting for Roblox…'), lt('Finish signing in with Roblox in the popup. Click here to cancel.'));
      const res = await askBg({ type: 'forumSignIn' });
      if (!res || !res.pairing) return fail(lt('Couldn’t Start, Try Again'));
      pairing = res.pairing;
      const until = Date.now() + 180000;
      const poll = async () => {
        if (!pairing) return;
        const r = await askBg({ type: 'forumClaim', pairing });
        if (!pairing) return;
        if (r && r.status === 200) {
          const done = pairing;
          pairing = null;
          askBg({ type: 'forumSignInClose', pairing: done });
          set('busy', lt('Backing Up…'));
          await askBg({ type: 'playtimeSyncNow' });
          return paint();
        }
        if (r && r.status && r.status !== 404) return fail(lt('Didn’t Work, Try Again'));
        if (Date.now() > until) return fail(lt('Timed Out, Try Again'));
        pollTimer = setTimeout(poll, 1000);
      };
      pollTimer = setTimeout(poll, 1000);
    });
    const onStore = (changes, area) => {
      if (!btn.isConnected) {
        chrome.storage.onChanged.removeListener(onStore);
        return;
      }
      if (area === 'local' && (changes.routilityForumAuth || changes.routilityPlaytimeSync)) paint();
    };
    chrome.storage.onChanged.addListener(onStore);
    paint();
    return btn;
  }

  function playtimePanel(box, id) {
    const panel = el('div', 'routility-injected routility-playtime');
    const head = el('div', 'routility-pt-head');
    head.appendChild(el('span', 'text-title-medium content-emphasis', lt('Your Most Played')));
    const key = 'routilityPlaytime:' + id;
    let range = ptRange();
    let token = 0;
    const picker = window.RoUtilityUI.dropdown(PT_RANGES.map(([value, label]) => ({ value, label: lt(label) })), range, (v) => {
      range = v;
      try { localStorage.setItem('routilityPlayRange', v); } catch {}
      render();
    }, 'routility-pt-range');
    const tools = el('div', 'routility-pt-tools');
    tools.append(backupButton(id), picker);
    head.appendChild(tools);
    const row = el('div', 'routility-pt-row');
    const arrow = (side) => {
      const b = el('button', 'routility-pt-arrow routility-pt-' + side);
      b.type = 'button';
      b.setAttribute('aria-label', side === 'prev' ? lt('Scroll left') : lt('Scroll right'));
      b.appendChild(el('span', 'icon icon-regular-chevron-large-' + (side === 'prev' ? 'left' : 'right')));
      b.addEventListener('click', () => list.scrollBy({ left: (side === 'prev' ? -1 : 1) * Math.max(90, list.clientWidth - 90), behavior: 'smooth' }));
      return b;
    };
    const prev = arrow('prev');
    const next = arrow('next');
    const list = el('div', 'routility-pt-list');
    row.append(prev, list, next);
    panel.append(head, row);
    box.appendChild(panel);
    const arrows = () => {
      const max = list.scrollWidth - list.clientWidth;
      const scrollable = max > 2;
      prev.hidden = !scrollable;
      next.hidden = !scrollable;
      prev.disabled = list.scrollLeft <= 2;
      next.disabled = list.scrollLeft >= max - 2;
    };
    list.addEventListener('scroll', arrows, { passive: true });
    const skeleton = (n) => {
      list.textContent = '';
      for (let i = 0; i < n; i++) {
        const item = el('div', 'routility-pt-item');
        item.append(el('span', 'routility-sk routility-pt-icon'), el('span', 'routility-sk routility-pt-sk1'), el('span', 'routility-sk routility-pt-sk2'));
        list.appendChild(item);
      }
      arrows();
    };
    const render = async () => {
      const my = ++token;
      if (!chrome.runtime?.id) return;
      const data = (await chrome.storage.local.get(key).then(st => st[key], () => null)) || null;
      if (my !== token || !panel.isConnected) return;
      const top = ptTotals(data, range).slice(0, 12);
      if (!top.length) {
        list.textContent = '';
        const any = data && data.days && Object.keys(data.days).length;
        const none = { day: lt('Nothing played today.'), week: lt('Nothing played in the past 7 days.'), month: lt('Nothing played in the past 30 days.') }[range] || lt('Nothing played yet.');
        list.appendChild(el('div', 'routility-pt-empty text-body-small content-muted', any ? none : lt('Play any experience with a Roblox tab open in Chrome and your time shows up here.')));
        arrows();
        return;
      }
      if (!list.querySelector('a.routility-pt-item')) skeleton(Math.min(top.length, 5));
      const info = await ptInfo(top.map(t => t[0]));
      if (my !== token || !panel.isConnected) return;
      const keep = list.scrollLeft;
      list.textContent = '';
      for (const [uni, min] of top) {
        const g = info[uni] || {};
        const place = g.place || (data.place && data.place[uni]);
        const item = el('a', 'routility-pt-item');
        if (place) item.href = `https://www.roblox.com/games/${place}`;
        item.dataset.rtTip = g.name || lt('Experience');
        const icon = el('span', 'routility-pt-icon');
        if (g.icon) {
          const img = el('img');
          img.alt = '';
          img.decoding = 'async';
          img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
          img.src = g.icon;
          icon.appendChild(img);
        }
        const time = el('span', 'routility-pt-time text-body-small content-muted');
        time.append(el('span', 'routility-pt-clock'), el('span', null, ptTime(min)));
        item.append(icon, el('span', 'routility-pt-name text-label-medium content-emphasis', g.name || lt('Experience')), time);
        list.appendChild(item);
      }
      list.scrollLeft = keep;
      arrows();
    };
    skeleton(5);
    render();
    if (ptListen) chrome.storage.onChanged.removeListener(ptListen);
    ptListen = (changes, area) => {
      if (area !== 'local' || !changes[key]) return;
      if (!panel.isConnected) {
        chrome.storage.onChanged.removeListener(ptListen);
        ptListen = null;
        return;
      }
      render();
    };
    chrome.storage.onChanged.addListener(ptListen);
  }

  function greeting() {
    const root = document.documentElement;
    const head = document.querySelector('#HomeContainer .container-header:has(> h1), .home-container .container-header:has(> h1)');
    let box = document.querySelector('.routility-home-greeting');
    const meta = document.querySelector('meta[name="user-data"]');
    const on = settings.homeGreeting !== false && /^\/home\/?$/i.test(location.pathname) && head && meta && /^\d+$/.test(meta.dataset.userid || '');
    if (!on) {
      box?.remove();
      root.classList.remove('routility-greeting-on');
      if (head || settings.homeGreeting === false) root.classList.remove('routility-greeting-wait', 'routility-greeting-wait-pt');
      return;
    }
    const h1 = head.querySelector(':scope > h1');
    if (box && box.parentElement === head && box.nextElementSibling === h1 && !box.querySelector('.routility-playtime') === (settings.playtime === false)) return;
    box?.remove();
    const id = meta.dataset.userid;
    const name = meta.dataset.name || '';
    const display = meta.dataset.displayname || name;
    box = el('div', 'routility-injected routility-home-greeting');
    const avatar = el('a', 'routility-greet-avatar');
    avatar.href = `https://www.roblox.com/users/${id}/profile`;
    avatar.setAttribute('aria-label', display);
    box.appendChild(avatar);
    const text = el('div', 'routility-greet-text');
    const title = el('div', 'routility-greet-title content-emphasis');
    const parts = lt('Hello, {name}!').split('{name}');
    title.append(parts[0] || '', el('span', 'routility-greet-name', display), parts.slice(1).join(display));
    title.setAttribute('role', 'heading');
    title.setAttribute('aria-level', '1');
    text.appendChild(title);
    box.appendChild(text);
    if (settings.playtime !== false) playtimePanel(box, id);
    h1.before(box);
    root.classList.add('routility-greeting-on');
    const paint = (x) => {
      if (!box.isConnected || !x) return;
      if (!x.head) return;
      const old = avatar.querySelector('img');
      if (old && old.getAttribute('src') === x.head) return;
      const img = el('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        img.classList.add('routility-loaded');
        if (old && old.isConnected) old.remove();
      }, { once: true });
      img.src = x.head;
      avatar.appendChild(img);
    };
    const cached = greetingCache();
    if (cached && cached.id === id) paint(cached);
    greetingExtras(id).then(paint);
  }

  function setup() {
    teardown();
    if (!ready) {
      wantSetup = true;
      return;
    }
    const path = location.pathname;
    const home = /^\/home\/?$/i.test(path);
    const lists = home || /^\/(charts|discover)(\/|$)/i.test(path);
    if (!lists) return;
    const p = { timer: null, observer: null, render: null, place: null, playing: false };
    page = p;
    if (home && settings.friendsPlaying !== false) friendsPlaying(p);
    if (home && settings.recentlyUpdated !== false) recentlyUpdated(p);
    if (!home && settings.genreFilters !== false) genreFilters(p);
    let queued = false;
    const tick = () => {
      queued = false;
      if (p !== page) return;
      addHideButtons(document);
      p.place?.();
      p.placeRU?.();
      p.genre?.();
      applyLayout();
      if (home) greeting();
    };
    let lastTick = 0;
    const run = () => {
      if (document.hidden) {
        document.addEventListener('visibilitychange', run, { once: true });
        return;
      }
      lastTick = Date.now();
      tick();
    };
    const ours = (n) => n && n.nodeType === 1 && (n.classList.contains('routility-injected') || !!n.closest('.routility-injected'));
    p.observer = new MutationObserver((records) => {
      if (queued) return;
      if (records.every(r => ours(r.target) || ([...r.addedNodes].every(ours) && [...r.removedNodes].every(ours) && (r.addedNodes.length || r.removedNodes.length)))) return;
      queued = true;
      setTimeout(run, Math.max(60, 150 - (Date.now() - lastTick)));
    });
    p.observer.observe(document.body, { childList: true, subtree: true });
    tick();
  }

  function teardown() {
    wantSetup = false;
    if (!page) return;
    clearInterval(page.timer);
    page.observer?.disconnect();
    document.getElementById('routility-friends-playing')?.remove();
    document.getElementById('routility-recently-updated')?.remove();
    page.genreStop?.();
    document.querySelectorAll('.routility-genre-bar, .routility-genre-filter').forEach(n => n.remove());
    document.querySelectorAll('.routility-genre-off, .routility-genre-empty').forEach(n => n.classList.remove('routility-genre-off', 'routility-genre-empty'));
    document.documentElement.classList.remove('routility-genre-on');
    document.querySelector('.routility-fp-modal')?.remove();
    closeTileMenu();
    editing = false;
    document.documentElement.classList.remove('routility-layout-editing', 'routility-layout-on');
    document.querySelectorAll('.routility-home-edit, .routility-home-tools, .routility-drop-line, .routility-home-greeting').forEach(n => n.remove());
    document.documentElement.classList.remove('routility-greeting-on');
    page = null;
  }

  window.RoUtilityHome = { setup, teardown, markSeen };
})();
