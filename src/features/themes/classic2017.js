(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  const SEE_ALL = LT('See All');
  const PLAYING = LT('Playing');
  const CHAT = LT('Chat & Party');
  let on = false;

  function seeAll() {
    for (const head of document.querySelectorAll(':is(.games-list-container, .game-sort-carousel-wrapper):not(#routility-2017-classics) > .home-sort-header-container')) {
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
  const SEE_LESS = LT('See Less');
  let classicsOpen = false;
  const CLASSIC_YEARS = {
    2012: [47545, 65241, 1426962, 156639, 13058, 31874845, 31970568, 8813012, 16600266, 2471084, 29676957, 38625144, 19948360, 1320160, 69063922, 18836269, 26216381, 11261342, 17175612, 11421159, 18916212, 33636692, 31461016, 42070800, 1352529, 34070391, 5638739, 28021269, 17817870, 27171408, 5215344, 14587365, 39009637, 11421235, 11558645, 227435, 18591749, 10408969, 23856023, 806741, 39743440, 12139, 6575803, 12000135, 475192, 16082593, 3642433, 17218622, 26633203, 190302, 17096238, 3965964, 42046929, 29397111, 34736944, 24297055, 1586982, 11421140, 10876520, 19062512, 5320745, 93000, 26433395, 1280002, 18970751, 27891754, 32032556, 21852875, 24650543, 18970723, 19558208, 14241923, 612526, 16706304, 37533873, 9415832, 24480835, 41410617, 81141, 26023094],
    2013: [1426962, 63955796, 29676957, 47545, 65241, 156639, 31970568, 8813012, 16600266, 13058, 31874845, 37146255, 38625144, 1320160, 7015919, 22597888, 42070800, 69063922, 17175612, 26216381, 28021269, 61185766, 44888494, 18759812, 50099765, 19021072, 19948360, 21105665, 18836269, 17093327, 40157880, 1309725, 20514875, 35124873, 35638084, 60207740, 43761037, 77376870, 22882227, 5232719, 29542631, 39743440, 42488340, 226216, 55594919, 20145892, 17817870, 18061537, 8726258, 9594505, 7271105, 26938121, 18916212, 69222, 21767995, 5320745, 38221464, 24873974, 11925299, 11261342, 1376430, 35504083, 407735, 105442829, 568284, 12454828, 10876520, 14587365, 29161545],
    2014: [66654135, 73885730, 78351145, 83858907, 2471084, 63955796, 1426962, 47545, 65241, 84221715, 31970568, 28021269, 35124873, 38625144, 37146255, 1320160, 22597888, 30917830, 19948360, 16600266, 69063922, 23601173, 18836269, 65056853, 26146551, 72210371, 15267446, 29676957, 67873019, 56462256, 41379791, 18855652, 12092787, 44825551, 43744857, 539089, 52017673, 145638, 407735, 67622937, 54666857, 70622276, 8726258, 75587443, 7015919, 34444307, 67948213, 65868014, 57602933, 74374454, 20514875, 56031201, 72456211, 77518451, 39259969, 67172564, 21719340, 1309725, 67423948, 59192354, 19558208, 23856023, 14274179, 9594505, 48714546, 1586982, 5985329, 4632885, 48920327, 43565599, 24573633, 18759812, 44646666, 70891505, 75041435, 70014043, 34973565, 31984212, 361746, 69023684],
    2015: [113491250, 110181652, 93740418, 99361251, 66654135, 73885730, 2471084, 83858907, 65241, 47545, 31970568, 78351145, 23601173, 1426962, 88070565, 81052800, 63955796, 16371559, 98929893, 97335408, 63951305, 26216381, 8813012, 73754455, 75213856, 111535124, 69530376, 98839997, 9045238, 5215344, 115797356, 26494385, 28021269, 35124873, 38625144, 37146255, 1320160, 22597888, 30917830, 19948360, 16600266, 69063922, 18836269, 65056853, 26146551, 72210371, 15267446, 29676957, 67873019, 56462256, 41379791, 18855652, 12092787, 44825551, 43744857, 539089, 52017673],
    2016: [140239261, 2471084, 113491250, 66654135, 88070565, 31970568, 8813012, 16600266, 47545, 65241, 93740418, 142553158, 23601173, 1426962, 73885730, 78351145, 83858907, 171035019, 81052800, 156428258, 63955796, 220828728, 16371559, 110181652, 208121276, 99361251, 224422602, 228573408, 98929893, 97335408, 206989842, 210213771, 63951305, 26216381, 73754455, 210851291, 219122237, 180358774, 75213856, 111535124, 127956238, 69530376, 170247232, 152631806, 153537986, 98839997, 9045238, 5215344, 115797356, 158603116, 194666009, 192369306, 165169895, 26494385, 28021269, 35124873, 38625144, 37146255, 1320160, 22597888, 30917830, 19948360, 69063922, 18836269, 65056853, 26146551, 72210371, 15267446, 29676957],
    2017: [245662005, 383310974, 140239261, 47545, 65241, 66654135, 88070565, 321778215, 113491250, 2471084, 31970568, 372226183, 111958650, 110181652, 83858907, 93740418, 73885730, 78351145, 171035019, 331220105, 298544364, 326706417, 321279858, 341554009, 142553158, 81052800, 355283685, 156428258, 63955796, 306688346, 220828728, 16371559, 394602509, 208121276, 409248140, 99361251, 224422602, 212154879, 228573408, 98929893, 97335408, 206989842, 210213771, 411193926, 413266915, 63951305, 26216381, 8813012, 73754455, 210851291, 219122237, 180358774, 75213856, 258062131, 341654025, 408390722, 111535124, 127956238, 69530376, 462857331, 1426962, 170247232, 152631806, 153537986, 381185525, 23601173, 400783193, 98839997, 320060161, 9045238, 323675642, 5215344, 354554209, 287473316, 383244513, 425700643, 312161215],
    2018: [245662005, 383310974, 564406126, 321778215, 140239261, 892043755, 498490399, 66654135, 88070565, 142553158, 540856839, 372226183, 47545, 601130232, 210851291, 171035019, 31970568, 220828728, 113491250, 331220105, 619296292, 274816972, 63951305, 504035427, 63955796, 2471084, 93740418, 210213771, 302155579, 65241, 212154879, 321279858, 110181652, 99361251, 380704901, 532222553, 16371559, 781563604, 414394315, 156428258, 253455151, 8813012, 768498367, 115797356, 180358774, 228573408, 484677607, 411275487, 111535124, 492245779, 522419958, 224422602, 598852275, 767752328, 158603116, 194666009, 560106667, 511839821, 152631806, 206989842, 506112045, 83858907, 410307227, 383244513, 192369306, 98839997, 614452913, 667102667, 706391776, 669927589, 165169895, 490079915, 735803076, 480601110, 551812865, 26494385, 414986370, 557359475, 351946567],
    2019: [383310974, 245662005, 111958650, 892043755, 601130232, 848145103, 498490399, 703124385, 66654135, 321778215, 1335695570, 88070565, 140239261, 380704901, 47545, 31970568, 1091907805, 331220105, 169302362, 833423526, 590359607, 2471084, 564406126, 911750776, 985731078, 504035427, 113491250, 833209132, 707277559, 1087859240, 909523785, 180358774, 372226183, 210851291, 923621948, 1312971993, 994732206, 1127930805, 89007587, 1069201198, 682184692, 142553158, 1348402608, 210213771, 63955796, 1128795217, 110988953, 511839821, 1175494470, 156428258, 1247975681, 1428065141, 187796008, 1107239548, 354554209, 1157366952, 16600266, 1015292948, 220828728, 125773762, 903807016, 819564192, 1153781324, 1172665769, 1162997355, 110181652, 1301450989, 104598338, 1176784616, 767752328, 411275487, 969012033, 735803076, 211134933, 1058298434, 495693931, 321279858, 441580524, 946854700],
  };
  let classicYear = '2017';
  const classicGames = () => CLASSIC_YEARS[classicYear] || CLASSIC_YEARS[2017];
  const GAMES_PAGE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?charts\/?$/i;
  let classicsOn = true;
  let classicData = null;
  let classicLoading = false;
  let classicFailed = 0;
  let classicFresh = false;
  const classicKey = () => 'routility2017Classics3:' + classicYear;

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
    const parts = await Promise.all(window.RoUtilityUI.chunks(list, 50).map((part) => {
      const ids = part.join(',');
      return Promise.all([
        json(`https://games.roblox.com/v1/games?universeIds=${ids}`),
        json(`https://games.roblox.com/v1/games/votes?universeIds=${ids}`),
        json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&returnPolicy=PlaceHolder&size=256x256&format=Webp&isCircular=false`),
        json(`https://games.roblox.com/v1/games/multiget-playability-status?universeIds=${ids}`),
      ]).catch(() => []);
    }));
    classicLoading = false;
    const all = (i) => parts.flatMap(p => (p && p[i] && p[i].data) || []);
    if (!all(0).length) {
      classicFailed = Date.now();
      return;
    }
    const vote = new Map(all(1).map(v => [v.id, v]));
    const icon = new Map(all(2).map(i => [i.targetId, i.imageUrl]));
    const games = new Map(all(0).map(g => [g.id, g]));
    const blocked = new Set(parts.flatMap(p => (p && Array.isArray(p[3]) ? p[3] : [])).filter(x => x && x.isPlayable === false).map(x => x.universeId));
    for (const id of blocked) games.delete(id);
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
      const years = Object.keys(CLASSIC_YEARS);
      const pick = window.RoUtilityUI.dropdown(years.map(y => ({ value: y, label: y })), classicYear, (v) => {
        chrome.storage.local.get('routilitySettings', (st) => chrome.storage.local.set({ routilitySettings: { ...(st.routilitySettings || {}), classicYear: v } }));
      }, 'routility-classics-year');
      const toggle = el('button', 'routility-2017-more routility-classics-toggle', lt(classicsOpen ? SEE_LESS : SEE_ALL));
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        classicsOpen = row.classList.toggle('routility-classics-all');
        toggle.textContent = lt(classicsOpen ? SEE_LESS : SEE_ALL);
        if (!classicsOpen) {
          row.querySelector('.horizontally-scrollable').style.left = '0px';
          row.scrollIntoView({ block: 'nearest' });
        }
        row.routilitySync && row.routilitySync();
      });
      head.append(sec, pick, toggle);
      row.classList.toggle('routility-classics-all', classicsOpen);
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

  function plusLabel() {
    const span = document.querySelector('a[href*="/plus?referrals"] > span.text-truncate-end');
    if (!span) return;
    if (on && document.documentElement.classList.contains('routility-old-nav')) {
      if (!span.dataset.routilityText) span.dataset.routilityText = span.textContent;
      if (span.textContent !== 'Plus') span.textContent = 'Plus';
    } else if (span.dataset.routilityText) {
      span.textContent = span.dataset.routilityText;
      delete span.dataset.routilityText;
    }
  }

  let searchAt = 0;
  function run() {
    if (!searchLeft || Date.now() - searchAt > 1000) {
      searchAt = Date.now();
      placeSearch();
    }
    label();
    plusLabel();
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
