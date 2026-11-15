(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  const SEE_ALL = LT('See All');
  const PLAYING = LT('Playing');
  const CHAT = LT('Chat & Party');
  let on = false;

  function seeAll() {
    for (const head of document.querySelectorAll(':is(.games-list-container, .game-sort-carousel-wrapper) > .home-sort-header-container')) {
      const link = head.querySelector('a[data-testid="section-header-title-subtitle-container"][href]');
      let more = head.querySelector(':scope > .routility-2017-more');
      if (!link) {
        more?.remove();
        continue;
      }
      if (!more) {
        more = document.createElement('a');
        more.className = 'routility-2017-more';
        more.textContent = lt(SEE_ALL);
        head.append(more);
      }
      if (more.getAttribute('href') !== link.getAttribute('href')) more.setAttribute('href', link.getAttribute('href'));
    }
  }

  const CLASSICS = LT('Classics');
  const CLASSIC_YEARS = {
    2012: [47545, 65241, 1426962, 156639, 13058, 31874845, 31970568, 8813012, 16600266, 2471084],
    2013: [1426962, 63955796, 29676957, 47545, 65241, 156639, 31970568, 8813012, 16600266, 13058, 31874845],
    2014: [66654135, 73885730, 78351145, 83858907, 2471084, 63955796, 1426962, 47545, 65241, 84221715, 31970568],
    2015: [113491250, 110181652, 93740418, 99361251, 66654135, 73885730, 2471084, 83858907, 65241, 47545, 31970568, 78351145],
    2016: [140239261, 2471084, 113491250, 66654135, 88070565, 31970568, 8813012, 16600266, 47545, 65241, 93740418, 142553158],
    2017: [245662005, 383310974, 140239261, 47545, 65241, 66654135, 88070565, 321778215, 113491250, 2471084, 31970568, 372226183, 111958650, 110181652, 83858907, 93740418, 73885730, 78351145],
    2018: [245662005, 383310974, 564406126, 321778215, 140239261, 892043755, 498490399, 66654135, 88070565, 142553158, 540856839, 372226183],
    2019: [383310974, 245662005, 111958650, 892043755, 601130232, 848145103, 498490399, 703124385, 66654135, 321778215, 1335695570, 88070565],
  };
  let classicYear = '2017';
  const classicGames = () => CLASSIC_YEARS[classicYear] || CLASSIC_YEARS[2017];
  const GAMES_PAGE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?charts\/?$/i;
  let classicsOn = true;
  let classicData = null;
  let classicLoading = false;
  let classicFailed = 0;
  let classicFresh = false;
  const classicKey = () => 'routility2017Classics' + classicYear;

  let classicAsked = false;

  function cachedClassics() {
    if (classicAsked) return;
    classicAsked = true;
    const key = classicKey();
    chrome.storage.local.get(key, (st) => {
      const c = st[key];
      if (!classicData && c && Array.isArray(c.games) && c.games.length) {
        classicData = c.games;
        tick();
      }
      if (!c || Date.now() - (c.at || 0) > 600000) loadClassics();
      else classicFresh = true;
    });
  }

  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  async function loadClassics() {
    if (classicLoading || classicFresh || Date.now() - classicFailed < 30000) return;
    classicLoading = true;
    const { json } = window.RoUtilityUI;
    const list = classicGames();
    const year = classicYear;
    const ids = list.join(',');
    const [info, votes, icons] = await Promise.all([
      json(`https://games.roblox.com/v1/games?universeIds=${ids}`),
      json(`https://games.roblox.com/v1/games/votes?universeIds=${ids}`),
      json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&returnPolicy=PlaceHolder&size=256x256&format=Webp&isCircular=false`),
    ]).catch(() => []);
    classicLoading = false;
    if (!info || !info.data) {
      classicFailed = Date.now();
      return;
    }
    const vote = new Map((votes?.data || []).map(v => [v.id, v]));
    const icon = new Map((icons?.data || []).map(i => [i.targetId, i.imageUrl]));
    const games = new Map(info.data.map(g => [g.id, g]));
    if (year !== classicYear) return;
    classicData = list.map(id => games.get(id)).filter(Boolean).map(g => {
      const v = vote.get(g.id);
      const total = v ? v.upVotes + v.downVotes : 0;
      return { name: g.name, placeId: g.rootPlaceId, playing: g.playing || 0, rating: total ? Math.round(v.upVotes / total * 100) : null, icon: icon.get(g.id) || '' };
    });
    classicFresh = true;
    chrome.storage.local.set({ [classicKey()]: { at: Date.now(), games: classicData } });
    document.getElementById('routility-2017-classics')?.remove();
    tick();
  }

  function classicTile(g) {
    const { el } = window.RoUtilityUI;
    const li = el('li', 'list-item game-card game-tile');
    const box = el('div', 'game-card-container');
    const a = el('a', 'game-card-link');
    a.href = `https://www.roblox.com/games/${g.placeId}`;
    const thumb = el('div', 'game-card-thumb-container');
    const span = el('span', 'thumbnail-2d-container game-card-thumb');
    const img = el('img');
    img.src = g.icon;
    img.alt = g.name;
    span.appendChild(img);
    thumb.appendChild(span);
    const name = el('div', 'game-card-name game-name-title', g.name);
    name.title = g.name;
    const info = el('div', 'game-card-info');
    if (g.rating != null) info.append(el('span', 'info-label icon-votes-gray'), el('span', 'info-label vote-percentage-label', g.rating + '%'));
    info.append(el('span', 'info-label icon-playing-counts-gray'), el('span', 'info-label playing-counts-label', compact(g.playing)));
    a.append(thumb, name, info);
    box.appendChild(a);
    li.appendChild(box);
    return li;
  }

  function classicArrows(row) {
    const scroller = row.querySelector('.horizontal-scroller');
    const inner = row.querySelector('.horizontally-scrollable');
    const win = row.querySelector('.horizontal-scroll-window');
    const step = () => {
      const li = inner.querySelector('li');
      const w = li ? li.getBoundingClientRect().width : 164;
      return Math.max(1, Math.floor(win.clientWidth / w)) * w;
    };
    const max = () => Math.max(0, inner.scrollWidth - win.clientWidth);
    const sync = () => {
      const left = -parseFloat(inner.style.left || '0');
      for (const [cls, show] of [['prev', left > 0], ['next', left < max() - 1]]) {
        let b = scroller.querySelector(`:scope > .scroller-new.${cls}`);
        if (show && !b) {
          b = document.createElement('div');
          b.className = 'scroller-new ' + cls;
          b.setAttribute('role', 'button');
          b.tabIndex = 0;
          b.appendChild(document.createElement('span'));
          b.addEventListener('click', () => {
            const cur = -parseFloat(inner.style.left || '0');
            const next = cls === 'next' ? Math.min(max(), cur + step()) : Math.max(0, cur - step());
            inner.style.left = -next + 'px';
            sync();
          });
          scroller.appendChild(b);
        } else if (!show && b) b.remove();
      }
    };
    return sync;
  }

  function classics() {
    const existing = document.getElementById('routility-2017-classics');
    if (!on || !classicsOn || !GAMES_PAGE.test(location.pathname)) {
      existing?.remove();
      return;
    }
    const first = document.querySelector('.games-list-container:not(#routility-2017-classics)');
    if (!first) return;
    if (!classicData) {
      cachedClassics();
      return;
    }
    if (existing && existing.nextElementSibling === first) return;
    const { el } = window.RoUtilityUI;
    const row = existing || el('div', 'games-list-container routility-injected');
    if (!existing) {
      row.id = 'routility-2017-classics';
      row.style.order = '0';
      const head = el('div', 'home-sort-header-container');
      const sec = el('div');
      sec.dataset.testid = 'section-header';
      const title = el('span', null, lt(CLASSICS));
      title.dataset.testid = 'text-icon-row-text';
      sec.appendChild(title);
      head.appendChild(sec);
      const scroller = el('div', 'horizontal-scroller games-list');
      const win = el('div', 'clearfix horizontal-scroll-window');
      const inner = el('div', 'horizontally-scrollable');
      inner.style.left = '0px';
      const ul = el('ul', 'hlist games game-cards game-tile-list games-page-carousel');
      classicData.forEach(g => ul.appendChild(classicTile(g)));
      inner.appendChild(ul);
      win.appendChild(inner);
      scroller.appendChild(win);
      row.append(head, scroller);
      row.routilitySync = classicArrows(row);
    }
    first.before(row);
    requestAnimationFrame(() => row.routilitySync && row.routilitySync());
  }

  const BY = LT('By');
  const BADGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'%3E%3Crect x='5.88818' width='22.89' height='22.89' transform='rotate(15 5.88818 0)' fill='%230066FF'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M20.543 8.7508L20.549 8.7568C21.15 9.3578 21.15 10.3318 20.549 10.9328L11.817 19.6648L7.45 15.2968C6.85 14.6958 6.85 13.7218 7.45 13.1218L7.457 13.1148C8.058 12.5138 9.031 12.5138 9.633 13.1148L11.817 15.2998L18.367 8.7508C18.968 8.1498 19.942 8.1498 20.543 8.7508Z' fill='white'/%3E%3C/svg%3E";

  function byRoblox() {
    for (const cap of document.querySelectorAll('.catalog-item-container .item-card-caption')) {
      if (cap.querySelector('.item-card-creator')) continue;
      const line = document.createElement('div');
      line.className = 'text-overflow item-card-creator routility-injected routility-2017-by';
      const span = document.createElement('span');
      span.className = 'text-overflow';
      const a = document.createElement('a');
      a.className = 'creator-name text-link';
      a.href = 'https://www.roblox.com/users/1/profile';
      a.textContent = 'Roblox';
      span.append(lt(BY) + ' ', a);
      const badge = document.createElement('img');
      badge.src = BADGE;
      badge.alt = '';
      line.append(span, badge);
      const name = cap.querySelector('.item-card-name-link');
      if (name) name.after(line);
      else cap.prepend(line);
    }
  }

  let searchLeft = '';
  function placeSearch() {
    const root = document.documentElement;
    const input = document.getElementById('navbar-search-input');
    if (!on || !input) {
      if (searchLeft) {
        root.style.removeProperty('--c17-search-left');
        searchLeft = '';
      }
      return;
    }
    const r = input.closest('.navbar-search')?.getBoundingClientRect() || input.getBoundingClientRect();
    if (!r.width) return;
    const vw = root.clientWidth;
    const w = Math.min(800, vw - 24);
    const left = Math.round(Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12))) + 'px';
    if (left === searchLeft) return;
    searchLeft = left;
    root.style.setProperty('--c17-search-left', left);
  }

  function label() {
    const root = document.documentElement;
    for (const [name, text] of [['--c17-playing', ' ' + lt(PLAYING)], ['--c17-chat', lt(CHAT)]]) {
      const want = on ? JSON.stringify(text) : '';
      if (root.style.getPropertyValue(name) === want) continue;
      if (want) root.style.setProperty(name, want);
      else root.style.removeProperty(name);
    }
  }

  function run() {
    placeSearch();
    label();
    if (!on) {
      document.querySelectorAll('.routility-2017-more, .routility-2017-by, #routility-2017-classics').forEach(n => n.remove());
      return;
    }
    seeAll();
    byRoblox();
    classics();
  }

  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  window.addEventListener('resize', placeSearch);
  document.addEventListener('focusin', (e) => { if (e.target?.id === 'navbar-search-input') placeSearch(); });

  document.addEventListener('click', (e) => {
    if (!on) return;
    const opt = e.target.closest?.(':is(.filters-container, .catalog-search-options-top-bar) .filters-modal-container .filter-option');
    if (!opt) return;
    const modal = opt.closest('.filters-modal-container');
    if (modal.querySelector('input')) return;
    setTimeout(() => modal.querySelector('.apply-button')?.click(), 0);
  }, true);

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).classicSite === true;
    classicsOn = (st.routilitySettings || {}).classicFrontPage !== false;
    classicYear = String((st.routilitySettings || {}).classicYear || '2017');
    if (on && classicsOn && GAMES_PAGE.test(location.pathname)) cachedClassics();
    new MutationObserver(() => { if (on) tick(); }).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).classicSite === true;
    classicsOn = (changes.routilitySettings.newValue || {}).classicFrontPage !== false;
    const year = String((changes.routilitySettings.newValue || {}).classicYear || '2017');
    if (year !== classicYear) {
      classicYear = year;
      classicData = null;
      classicFresh = false;
      classicAsked = false;
      classicFailed = 0;
      document.getElementById('routility-2017-classics')?.remove();
    }
    if (on && classicsOn && !classicData) cachedClassics();
    tick();
  });
})();
