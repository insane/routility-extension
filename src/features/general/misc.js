(function () {
  'use strict';

  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  let settings = {};
  let navObserver = null;
  let page = null;

  const ROBUX_TEXT = '.text-robux, .text-robux-lg, .text-robux-tile, .text-robux-sm';

  function robuxRate() {
    const rate = window.RoUtilityUI.robuxRate(settings);
    return { rate, custom: settings.calcRobux === 'custom' && Number(settings.calcRate) > 0 };
  }

  function robuxTip(e) {
    if (settings.robuxUsd === false) return;
    const node = e.target.closest?.(ROBUX_TEXT);
    if (!node) return;
    const mine = node.dataset.routilityRobux !== undefined;
    if (node.dataset.rtTip && !mine) return;
    if (node.classList.contains('routility-injected') || node.parentElement?.closest('[data-rt-tip], .routility-injected, #navbar-robux, .trade-request-window, .trades-list-detail')) return;
    const card = node.closest('.item-card, .list-item, .catalog-item-container');
    if (card && card.querySelector('.routility-card-usd')) return;
    const text = node.textContent.trim();
    if (mine && node.dataset.routilityRobux === text) return;
    if (!/^\d[\d,]*$/.test(text)) {
      if (mine) {
        delete node.dataset.rtTip;
        delete node.dataset.routilityRobux;
      }
      return;
    }
    const robux = Number(text.replace(/,/g, ''));
    if (!(robux > 0)) return;
    const { rate, custom } = robuxRate();
    const usd = window.RoUtilityUI.formatUSD(robux * rate);
    node.dataset.rtTip = custom ? lt('≈ {usd} at your rate ({rate}/1k)', { usd, rate: window.RoUtilityUI.formatUSD(rate * 1000) }) : lt('≈ {usd} at the DevEx rate', { usd });
    node.dataset.routilityRobux = text;
  }

  function exactRobux() {
    const node = document.querySelector('#nav-robux-amount');
    const btn = node && node.closest('button[aria-label]');
    if (!node || !btn) return;
    const digits = (btn.getAttribute('aria-label') || '').replace(/[^\d]/g, '');
    if (!digits) return;
    const full = formatNumber(Number(digits));
    if (node.textContent !== full) node.textContent = full;
    btn.classList.add('routility-exact-robux');
  }

  let menuObserver = null;

  function addMenuItem() {
    const menu = document.querySelector('[role="dialog"][aria-label="Settings"] .nav-foundation-menu');
    if (!menu || menu.querySelector('.routility-menu-link')) return;
    const settingsItem = [...menu.querySelectorAll('a[role="menuitem"]')].find(a => /\/my\/account\/?$/.test(a.getAttribute('href') || ''));
    if (!settingsItem) return;
    const item = settingsItem.cloneNode(true);
    item.classList.add('routility-injected', 'routility-menu-link');
    item.href = 'https://www.roblox.com/my/account#!/routility';
    item.removeAttribute('data-radix-collection-item');
    item.tabIndex = -1;
    const title = item.querySelector('.foundation-web-menu-item-title');
    if (title) {
      title.textContent = 'RoUtility';
      const logo = el('img', 'routility-menu-logo');
      logo.src = chrome.runtime.getURL('assets/icons/icon48.png');
      logo.alt = '';
      title.prepend(logo);
    }
    settingsItem.before(item);
  }

  function startMenu() {
    if (menuObserver || settings.menuLink === false) return;
    menuObserver = new MutationObserver(() => requestAnimationFrame(addMenuItem));
    menuObserver.observe(document.body, { childList: true });
  }

  let meVerified = null;
  let badgeObserver = null;
  let nameWatch = null;
  let watchedName = null;

  let watchedWidth = 1;

  function syncNameBadge(entries) {
    if (entries && entries.length) watchedWidth = entries[entries.length - 1].contentRect.width;
    const box = watchedName && watchedName.nextElementSibling;
    if (box && box.classList.contains('routility-nav-verified')) box.classList.toggle('routility-nav-verified-off', !watchedWidth);
  }

  function watchName(name) {
    if (watchedName !== name) {
      if (!nameWatch) nameWatch = new ResizeObserver(syncNameBadge);
      if (watchedName) nameWatch.unobserve(watchedName);
      watchedName = name;
      nameWatch.observe(name);
    }
    syncNameBadge();
  }

  function verifiedIcon() {
    const wrap = el('span', 'relative inline-flex items-center justify-center shrink-0 verified-badge routility-injected routility-nav-verified');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', lt('Verified Badge Icon'));
    const plate = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-backplate size-[var(--icon-size-small)] content-system-emphasis');
    plate.setAttribute('aria-hidden', 'true');
    const check = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-check size-[var(--icon-size-small)] absolute content-[white]');
    check.setAttribute('aria-hidden', 'true');
    wrap.append(plate, check);
    return wrap;
  }

  function placeBadges() {
    const on = settings.navVerified !== false && meVerified === true;
    const top = document.querySelector('.age-bracket-label-username');
    const side = document.querySelector('nav a:is([href="/users/profile"], [data-rt-profile="/users/profile"]) .text-truncate-end');
    for (const name of [top, side]) {
      if (!name) continue;
      const next = name.nextElementSibling;
      const has = next && next.classList.contains('routility-nav-verified');
      if (on && !has) {
        const badge = verifiedIcon();
        if (name === top) {
          const box = el('span', 'items-center gap-xxsmall inline-flex shrink-0 [--icon-size-small:1em] routility-injected routility-nav-verified');
          box.appendChild(badge);
          badge.classList.remove('routility-nav-verified', 'routility-injected');
          name.after(box);
        } else {
          name.after(badge);
        }
      } else if (!on && has) {
        next.remove();
      }
      if (on && name === top) watchName(top);
    }
  }

  function startBadges() {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me || badgeObserver) return;
    chrome.storage.local.get('routilityMe', (st) => {
      const cached = st.routilityMe;
      if (cached && cached.id === me) meVerified = !!cached.verified;
      placeBadges();
      if (!cached || cached.id !== me || Date.now() - (cached.at || 0) > 86400000) {
        fetch(`https://users.roblox.com/v1/users/${me}`, { credentials: 'include' })
          .then(r => (r.ok ? r.json() : null))
          .then(u => {
            if (!u || String(u.id) !== me) return;
            meVerified = !!u.hasVerifiedBadge;
            chrome.storage.local.set({ routilityMe: { id: me, verified: meVerified, at: Date.now() } });
            placeBadges();
          })
          .catch(() => {});
      }
    });
    badgeObserver = new MutationObserver(onFrame(placeBadges));
    badgeObserver.observe(document.body, { subtree: true, childList: true });
  }

  let collapseObserver = null;

  function toggleCollapse() {
    const next = !document.documentElement.classList.contains('routility-nav-collapsed');
    document.documentElement.classList.toggle('routility-nav-collapsed', next);
    chrome.storage.local.set({ routilityNavCollapsed: next });
    placeCollapse();
  }

  function oldCollapseItem() {
    const li = el('li', 'routility-injected routility-nav-collapse');
    const b = el('button', 'dynamic-overflow-container text-nav routility-nav-collapse-btn');
    b.type = 'button';
    const holder = el('div');
    const icon = el('span', 'routility-nav-collapse-icon');
    icon.setAttribute('aria-hidden', 'true');
    holder.appendChild(icon);
    b.append(holder, el('span', 'font-header-2 dynamic-ellipsis-item routility-nav-collapse-text'));
    b.addEventListener('click', toggleCollapse);
    li.appendChild(b);
    return li;
  }

  function placeCollapse() {
    const fresh = document.querySelector('.left-nav nav > ul');
    const old = !fresh && document.querySelector('ul.left-col-list');
    const list = fresh || old;
    if (!list) return;
    const collapsed = document.documentElement.classList.contains('routility-nav-collapsed');
    let li = list.querySelector(':scope > li.routility-nav-collapse');
    if (!li && old) li = oldCollapseItem();
    if (!li) {
      const model = list.querySelector(':scope > li > a[href$="/home"]') || [...list.querySelectorAll(':scope > li > a')].find(a => a.querySelector(':scope > span > .icon'));
      if (!model) return;
      li = el('li', 'routility-injected routility-nav-collapse');
      const b = el('button', 'bg-none width-full stroke-none ' + model.className.split(/\s+/).filter(c => c && c !== 'bg-shift-200').join(' ') + ' routility-nav-collapse-btn');
      b.type = 'button';
      const box = el('span', (model.querySelector(':scope > span:has(> .icon)') || {}).className || 'size-1000 grow-0 shrink-0 basis-auto flex justify-center items-center');
      const icon = el('span', 'grow-0 shrink-0 basis-auto routility-nav-collapse-icon');
      icon.setAttribute('aria-hidden', 'true');
      box.appendChild(icon);
      b.append(box, el('span', 'min-width-0 text-truncate-end text-no-wrap routility-nav-collapse-text'));
      b.addEventListener('click', toggleCollapse);
      li.appendChild(b);
    }
    if (old) {
      const last = [...list.children].reverse().find(n => n !== li);
      const before = last && last.classList.contains('rbx-upgrade-now') ? last : null;
      if (before ? li.nextElementSibling !== before : list.lastElementChild !== li) list.insertBefore(li, before);
    } else if (list.lastElementChild !== li) list.appendChild(li);
    const b = li.firstElementChild;
    const label = collapsed ? lt('Expand Menu') : lt('Collapse Menu');
    if (b.getAttribute('aria-label') !== label) {
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-expanded', String(!collapsed));
      li.querySelector('.routility-nav-collapse-text').textContent = lt('Collapse');
      li.querySelector('.routility-nav-collapse-icon').classList.toggle('routility-nav-collapse-flip', collapsed);
    }
    for (const a of list.querySelectorAll(':scope > li > a, :scope > li > button:not(.routility-nav-collapse-btn)')) {
      const name = (a.querySelector('.text-truncate-end, .text-title-large span:last-child, .dynamic-ellipsis-item') || a).textContent.trim().split(/\r?\n/)[0];
      if (collapsed && name) { if (a.dataset.rtTip !== name) { a.dataset.rtTip = name; a.dataset.routilityNavTip = '1'; } }
      else if (a.dataset.routilityNavTip) { delete a.dataset.rtTip; delete a.dataset.routilityNavTip; }
    }
  }

  function stopCollapse() {
    collapseObserver?.disconnect();
    collapseObserver = null;
    document.querySelectorAll('.left-nav li.routility-nav-collapse, .left-col-list li.routility-nav-collapse').forEach(n => n.remove());
    document.querySelectorAll('.left-nav [data-routility-nav-tip], .left-col-list [data-routility-nav-tip]').forEach(a => { delete a.dataset.rtTip; delete a.dataset.routilityNavTip; });
  }

  function startCollapse() {
    if (settings.navCollapse === false) return stopCollapse();
    if (collapseObserver) return;
    const run = onFrame(placeCollapse);
    const obs = collapseObserver = new MutationObserver(run);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const watch = () => {
      if (collapseObserver !== obs) return;
      const nav = document.querySelector('.left-nav') || document.querySelector('ul.left-col-list');
      if (!nav) { setTimeout(watch, 500); return; }
      obs.observe(nav, { childList: true, subtree: true });
      run();
    };
    watch();
  }

  function startNav() {
    if (navObserver || settings.exactRobux !== true) return;
    const run = onFrame(exactRobux);
    navObserver = new MutationObserver(run);
    navObserver.observe(document.querySelector('#header, #navigation-container, .rbx-header') || document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
    run();
  }

  const RARITY = [[90, LT('Freebie')], [80, LT('Cake Walk')], [50, LT('Easy')], [30, LT('Moderate')], [20, LT('Challenging')], [10, LT('Hard')], [5, LT('Extreme')], [1, LT('Insane')], [0, LT('Impossible')]];

  function rarityName(pct) {
    for (const [min, name] of RARITY) if (pct >= min) return lt(name);
    return lt('Impossible');
  }

  function percent(p) {
    if (p >= 10) return Math.round(p) + '%';
    if (p >= 1) return (Math.round(p * 10) / 10) + '%';
    if (p > 0) return (Math.round(p * 100) / 100 || 0.01) + '%';
    return '0%';
  }

  function fieldRow(label, value) {
    const row = el('div', 'clearfix item-field-container routility-injected routility-badge-field');
    row.appendChild(el('div', 'font-header-1 text-subheader text-label text-overflow field-label', label));
    const content = el('div', 'field-content');
    content.appendChild(el('span', 'font-body text', value));
    row.appendChild(content);
    return row;
  }

  async function badgeStats(id) {
    const s = page;
    let data = null;
    try {
      const res = await fetch(`https://badges.roblox.com/v1/badges/${id}`, { credentials: 'include' });
      data = res.ok ? await res.json() : null;
    } catch {}
    const stats = data && data.statistics;
    if (!stats || page !== s) return;
    const place = () => {
      if (page !== s) return;
      const details = document.querySelector('#item-container #item-details');
      if (!details || details.querySelector('.routility-badge-field')) return;
      const anchor = [...details.querySelectorAll(':scope > .item-field-container')].find(n => n.querySelector('.field-label')?.textContent.trim() === 'Description') || null;
      const live = data.enabled !== false && (stats.winRatePercentage > 0 || stats.pastDayAwardedCount > 0);
      const rows = [
        live && fieldRow(lt('Rarity'), `${percent(stats.winRatePercentage * 100)} (${rarityName(stats.winRatePercentage * 100)})`),
        fieldRow(lt('Won Yesterday'), formatNumber(stats.pastDayAwardedCount || 0)),
        fieldRow(lt('Won Ever'), formatNumber(stats.awardedCount || 0)),
      ].filter(Boolean);
      for (const r of rows) details.insertBefore(r, anchor);
    };
    s.observer = new MutationObserver(onFrame(place));
    s.observer.observe(document.querySelector('#item-container') || document.body, { childList: true, subtree: true });
    place();
  }

  let roll = null;

  function endRoll() {
    if (!roll) return;
    clearTimeout(roll.timer);
    roll.layer.remove();
    roll.btn?.classList.remove('routility-rolling');
    document.removeEventListener('keydown', roll.key, true);
    window.removeEventListener('scroll', roll.follow, true);
    window.removeEventListener('resize', roll.follow);
    roll = null;
  }

  let audio = null;

  function sfx(kind, step = 0) {
    if (settings.rollSounds === false) return;
    try {
      audio = audio || new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const tone = (freq, start, length, peak, type) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
        osc.connect(gain).connect(audio.destination);
        osc.start(now + start);
        osc.stop(now + start + length + 0.02);
      };
      if (kind === 'tick') tone(1500 + (step % 3) * 120, 0, 0.035, 0.035, 'triangle');
      else {
        tone(1046.5, 0, 0.35, 0.07, 'sine');
        tone(1568, 0.09, 0.55, 0.06, 'sine');
      }
    } catch {}
  }

  let rollPool = null;

  function chartsPool() {
    if (rollPool) return rollPool;
    rollPool = (async () => {
      const sid = crypto.randomUUID();
      const games = new Map();
      let token = '';
      let hidden = [];
      try { hidden = ((await chrome.storage.local.get('routilityHiddenGames')).routilityHiddenGames || []).map(String); } catch {}
      for (let page = 0; page < 8; page++) {
        let data = null;
        try {
          const res = await fetch(`https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sid}${token ? `&sortsPageToken=${encodeURIComponent(token)}` : ''}`, { credentials: 'include' });
          data = res.ok ? await res.json() : null;
        } catch {}
        if (!data) break;
        for (const sort of data.sorts || []) {
          for (const g of sort.games || []) {
            const id = String(g.universeId || '');
            if (!id || !g.rootPlaceId || g.isSponsored || hidden.includes(id) || games.has(id)) continue;
            const votes = (g.totalUpVotes || 0) + (g.totalDownVotes || 0);
            if ((g.playerCount || 0) < 25 || (votes >= 50 && g.totalUpVotes / votes < 0.6)) continue;
            games.set(id, { id, placeId: g.rootPlaceId, name: g.name || '', players: g.playerCount || 0, up: g.totalUpVotes || 0, down: g.totalDownVotes || 0, from: sort.sortDisplayName || '' });
          }
        }
        token = data.nextSortsPageToken;
        if (!token) break;
      }
      return [...games.values()];
    })();
    return rollPool;
  }

  function compact(n) {
    if (n >= 1e6) return (Math.round(n / 1e5) / 10) + 'M';
    if (n >= 1e3) return (Math.round(n / 100) / 10) + 'K';
    return String(n);
  }

  function rollTiles() {
    const all = [...document.querySelectorAll('#content li.game-card, #content li.hover-game-tile')]
      .filter(li => li.offsetParent && /\/games\/\d+/.test(li.querySelector('a.game-card-link')?.href || ''));
    const vh = document.documentElement.clientHeight;
    const vw = document.documentElement.clientWidth;
    const seen = all.filter(li => {
      const r = li.getBoundingClientRect();
      return r.width > 40 && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;
    });
    return seen.length >= 4 ? seen : all;
  }

  function rollButton(text, emphasis, onClick) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-large ' + (emphasis ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const l = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    l.setAttribute('aria-hidden', 'true');
    b.appendChild(l);
    b.appendChild(el('span', 'text-no-wrap', text));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function startRoll(btn) {
    endRoll();
    const tiles = rollTiles();
    if (!tiles.length) return;
    let target = tiles[Math.floor(Math.random() * tiles.length)];
    const poolReady = Promise.race([chartsPool(), new Promise(r => setTimeout(() => r(null), 4000))]);
    const layer = el('div', 'routility-injected routility-roll');
    const spot = el('div', 'routility-roll-spot');
    layer.appendChild(spot);
    document.body.appendChild(layer);
    btn.classList.add('routility-rolling');
    let current = null;
    const fit = () => {
      if (!current) return;
      const r = current.getBoundingClientRect();
      spot.style.left = Math.round(r.left - 6) + 'px';
      spot.style.top = Math.round(r.top - 6) + 'px';
      spot.style.width = Math.round(r.width + 12) + 'px';
      spot.style.height = Math.round(r.height + 12) + 'px';
      const card = layer.querySelector('.routility-roll-card');
      if (card) {
        const vh = document.documentElement.clientHeight;
        const below = r.bottom + 14 + card.offsetHeight < vh;
        card.style.left = Math.round(Math.max(12, Math.min(document.documentElement.clientWidth - card.offsetWidth - 12, r.left + r.width / 2 - card.offsetWidth / 2))) + 'px';
        card.style.top = Math.round(below ? r.bottom + 14 : Math.max(12, r.top - card.offsetHeight - 14)) + 'px';
      }
    };
    const key = (e) => { if (e.key === 'Escape') endRoll(); };
    roll = { layer, btn, timer: null, key, follow: fit };
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', fit, true);
    window.addEventListener('resize', fit);
    layer.addEventListener('click', endRoll);

    const card0 = () => {
      const card = el('div', 'routility-roll-card bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
      card.addEventListener('click', (e) => e.stopPropagation());
      const top = el('div', 'flex items-center gap-small');
      top.appendChild(el('span', 'icon routility-calc-icon routility-dice-icon size-500 content-emphasis'));
      top.appendChild(el('span', 'text-label-medium content-muted', lt('You rolled')));
      card.appendChild(top);
      return card;
    };

    const landCenter = async (g) => {
      current = null;
      spot.classList.add('routility-roll-center');
      const card = card0();
      card.classList.add('routility-roll-big');
      const thumb = el('span', 'thumbnail-2d-container routility-roll-thumb');
      card.appendChild(thumb);
      card.appendChild(el('div', 'text-title-large content-emphasis routility-roll-name', g.name));
      const stats = el('div', 'flex items-center gap-medium text-body-small content-muted');
      const votes = g.up + g.down;
      if (votes) stats.appendChild(el('span', null, lt('{pct}% rating', { pct: Math.round(g.up / votes * 100) })));
      if (g.players) stats.appendChild(el('span', null, ltn(g.players, '{count} playing', '{count} playing', { count: compact(g.players) })));
      if (g.from) stats.appendChild(el('span', null, lt('From {sort}', { sort: g.from })));
      card.appendChild(stats);
      const acts = el('div', 'flex items-center gap-small');
      acts.appendChild(rollButton(lt('Open'), true, () => { location.href = `https://www.roblox.com/games/${g.placeId}`; }));
      acts.appendChild(rollButton(lt('Roll again'), false, () => startRoll(btn)));
      card.appendChild(acts);
      layer.appendChild(card);
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      card.style.left = Math.round(vw / 2 - card.offsetWidth / 2) + 'px';
      card.style.top = Math.round(vh / 2 - card.offsetHeight / 2) + 'px';
      const r = card.getBoundingClientRect();
      spot.style.left = Math.round(r.left - 6) + 'px';
      spot.style.top = Math.round(r.top - 6) + 'px';
      spot.style.width = Math.round(r.width + 12) + 'px';
      spot.style.height = Math.round(r.height + 12) + 'px';
      spot.classList.add('routility-roll-landed');
      sfx('land');
      btn.classList.remove('routility-rolling');
      card.querySelector('button').focus({ preventScroll: true });
      try {
        const res = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${g.id}&returnPolicy=PlaceHolder&size=512x512&format=Webp&isCircular=false`, { credentials: 'include' });
        const d = res.ok ? await res.json() : null;
        const url = d && d.data && d.data[0] && d.data[0].imageUrl;
        if (url && roll && roll.layer === layer) {
          const img = el('img');
          img.alt = '';
          img.src = url;
          thumb.appendChild(img);
        }
      } catch {}
    };

    const pickWinner = async () => {
      const pool = await poolReady;
      if (!roll || roll.layer !== layer) return;
      if (!pool || !pool.length) return land();
      const g = pool[Math.floor(Math.random() * pool.length)];
      const tile = tiles.find(li => li.querySelector('a.game-card-link')?.id === g.id || (li.querySelector('a.game-card-link')?.href || '').includes(`universeId=${g.id}`));
      if (tile) {
        target = tile;
        return land();
      }
      landCenter(g);
    };

    const land = () => {
      current = target;
      const r0 = target.getBoundingClientRect();
      const vh = document.documentElement.clientHeight;
      if (r0.top < 0 || r0.bottom > vh) target.scrollIntoView({ block: 'center' });
      fit();
      spot.classList.add('routility-roll-landed');
      sfx('land');
      const name = target.querySelector('.game-card-name')?.textContent.trim() || lt('this experience');
      const href = target.querySelector('a.game-card-link').href;
      const card = el('div', 'routility-roll-card bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
      card.addEventListener('click', (e) => e.stopPropagation());
      const top = el('div', 'flex items-center gap-small');
      top.appendChild(el('span', 'icon routility-calc-icon routility-dice-icon size-500 content-emphasis'));
      top.appendChild(el('span', 'text-label-medium content-muted', lt('You rolled')));
      card.appendChild(top);
      card.appendChild(el('div', 'text-title-large content-emphasis routility-roll-name', name));
      const acts = el('div', 'flex items-center gap-small');
      acts.appendChild(rollButton(lt('Open'), true, () => { location.href = href; }));
      acts.appendChild(rollButton(lt('Roll again'), false, () => startRoll(btn)));
      card.appendChild(acts);
      layer.appendChild(card);
      btn.classList.remove('routility-rolling');
      requestAnimationFrame(fit);
      card.querySelector('button').focus({ preventScroll: true });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || tiles.length < 2) {
      pickWinner();
      return;
    }
    let delay = 45;
    let hops = 0;
    const total = 20 + Math.floor(Math.random() * 6);
    const hop = () => {
      if (!roll || roll.layer !== layer) return;
      hops++;
      if (hops >= total) {
        pickWinner();
        return;
      }
      let next = tiles[Math.floor(Math.random() * tiles.length)];
      if (next === current && tiles.length > 1) next = tiles[(tiles.indexOf(next) + 1) % tiles.length];
      current = next;
      fit();
      sfx('tick', hops);
      delay = Math.min(420, delay * 1.13);
      roll.timer = setTimeout(hop, delay);
    };
    hop();
  }

  function randomGame() {
    const s = page;
    const place = () => {
      if (page !== s) return;
      const header = document.querySelector('.games-list-header');
      if (!header || header.querySelector('.routility-random-game')) return;
      header.classList.add('routility-games-header');
      const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium bg-action-standard content-action-standard routility-injected routility-random-game');
      btn.type = 'button';
      const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
      layer.setAttribute('aria-hidden', 'true');
      btn.appendChild(layer);
      const inner = el('span', 'flex items-center gap-small');
      inner.appendChild(el('span', 'icon routility-calc-icon routility-dice-icon size-500'));
      inner.appendChild(el('span', 'padding-y-xsmall text-no-wrap', lt('Random Experience')));
      btn.appendChild(inner);
      btn.dataset.rtTip = lt('Rolls a random experience from every chart');
      btn.addEventListener('click', () => startRoll(btn));
      header.appendChild(btn);
    };
    s.observer = new MutationObserver(onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  const PS_KEY = 'routilyPrivateServersHidden';

  function psHidden() {
    try { return localStorage.getItem(PS_KEY) === '1'; } catch { return false; }
  }

  function privateServers() {
    const s = page;
    const place = () => {
      if (page !== s) return;
      const h3 = [...document.querySelectorAll('#running-game-instances-container h3')].find(h => h.textContent.trim() === 'Your private servers');
      if (!h3) return;
      const head = h3.parentElement;
      const section = head.parentElement;
      if (!section) return;
      const body = [...section.children].filter(c => c !== head);
      const hidden = psHidden();
      for (const b of body) b.classList.toggle('routility-ps-collapsed', hidden);
      let btn = head.querySelector('.routility-ps-toggle');
      if (!btn) {
        head.classList.add('routility-ps-head');
        btn = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis no-underline hover:underline cursor-pointer text-label-medium routility-injected routility-ps-toggle');
        btn.type = 'button';
        btn.addEventListener('click', () => {
          try { localStorage.setItem(PS_KEY, psHidden() ? '0' : '1'); } catch {}
          place();
        });
        head.appendChild(btn);
      }
      const label = hidden ? lt('Show') : lt('Hide');
      if (btn.textContent !== label) btn.textContent = label;
      btn.setAttribute('aria-expanded', String(!hidden));
    };
    s.observer = new MutationObserver(onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  let ready = null;

  function loadSettings() {
    if (!ready) ready = new Promise(r => chrome.storage.local.get('routilitySettings', (s) => {
      settings = s.routilitySettings || {};
      r();
    }));
    return ready;
  }

  loadSettings();
  window.addEventListener('mouseover', robuxTip, true);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    const before = settings;
    settings = changes.routilitySettings.newValue || {};
    if (QS_KEYS.some(k => before[k] !== settings[k])) qsRefresh(QS_ROWS.some(([, , k]) => before[k] !== settings[k]) || before.quickSettings !== settings.quickSettings || before.qsStyle !== settings.qsStyle);
    if (location.hostname === 'www.roblox.com') startStudioStatus();
    if (location.hostname === 'www.roblox.com' && before.navCollapse !== settings.navCollapse) startCollapse();
    placeBadges();
    checkStatus();
    document.querySelectorAll('[data-routility-robux]').forEach(n => {
      delete n.dataset.rtTip;
      delete n.dataset.routilityRobux;
    });
  });

  let statusTimer = null;

  function statusText(st) {
    const parts = st.parts.slice(0, 3);
    const label = lt(st.label);
    const list = parts.length > 1 ? lt('{items} and {last}', { items: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] }) : parts[0];
    const head = parts.length ? lt('{status} on {parts}', { status: label, parts: list }) : label;
    return `${head}${st.incident ? ` · ${st.incident}` : ''}`;
  }

  function showStatus(st) {
    const old = document.querySelector('.routility-status-banner');
    let dismissed = '';
    try { dismissed = sessionStorage.getItem('routilityStatusDismissed') || ''; } catch {}
    if (settings.statusBanner === false || !st || st.code <= 100 || dismissed === st.key) {
      old?.remove();
      return;
    }
    const host = document.querySelector('#container-main > .alert-container');
    if (!host) return;
    const text = statusText(st);
    if (old && old.dataset.key === st.key && old.dataset.text === text) return;
    old?.remove();
    const bar = el('div', `${st.code >= 400 ? 'alert-warning' : 'alert-info'} routility-status-banner routility-injected`);
    bar.setAttribute('role', 'status');
    const content = el('span', 'alert-content');
    content.appendChild(el('span', 'routility-status-title', lt('Roblox Status')));
    content.appendChild(el('span', 'routility-status-text', text));
    const link = el('a', 'text-link routility-status-link', lt('Details'));
    link.href = 'https://status.roblox.com/';
    link.target = '_blank';
    link.rel = 'noopener';
    content.appendChild(link);
    const close = el('button', 'routility-status-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Dismiss'));
    close.appendChild(el('span', 'icon-close'));
    close.addEventListener('click', () => {
      try { sessionStorage.setItem('routilityStatusDismissed', st.key); } catch {}
      bar.remove();
    });
    bar.append(content, close);
    bar.dataset.key = st.key;
    bar.dataset.text = text;
    host.prepend(bar);
  }

  function checkStatus() {
    if (settings.statusBanner === false) {
      document.querySelector('.routility-status-banner')?.remove();
      return;
    }
    chrome.runtime.sendMessage({ type: 'robloxStatus' }, (st) => {
      if (chrome.runtime.lastError) return;
      showStatus(st);
    });
  }

  function startStatus() {
    checkStatus();
    if (statusTimer) return;
    statusTimer = setInterval(() => { if (!document.hidden) checkStatus(); }, 300000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkStatus(); });
  }

  async function setup() {
    await loadSettings();
    teardown();
    const path = location.pathname;
    startNav();
    startBadges();
    const badge = path.match(/^\/badges\/(\d+)/i);
    if (badge && settings.badgeStats !== false) {
      page = { kind: 'badge' };
      badgeStats(badge[1]);
      return;
    }
    if (/^\/(charts|discover)(\/|$)/i.test(path) && settings.randomGame !== false) {
      page = { kind: 'charts' };
      randomGame();
      return;
    }
    if (/^\/games\/\d+/i.test(path) && settings.privateServerToggle !== false) {
      page = { kind: 'game' };
      privateServers();
      return;
    }
  }

  function teardown() {
    if (!page) return;
    page.observer?.disconnect();
    page = null;
    endRoll();
    rollPool = null;
    document.querySelectorAll('.routility-badge-field, .routility-ps-toggle, .routility-random-game').forEach(n => n.remove());
    document.querySelectorAll('.routility-ps-collapsed').forEach(n => n.classList.remove('routility-ps-collapsed'));
  }

  const QS_URL = 'https://apis.roblox.com/user-settings-api/v1/user-settings';
  const QS_ROWS = [['whoCanJoinMeInExperiences', LT('Joins'), 'qsJoins'], ['whoCanSeeMyOnlineStatus', LT('Online Status'), 'qsOnline']];
  const QS_KEYS = ['quickSettings', 'qsJoins', 'qsOnline', 'qsRotator', 'qsStreamer', 'outfitRotator', 'streamerMode', 'qsStyle'];
  const QS_ICONS = { whoCanJoinMeInExperiences: 'person-plus', whoCanSeeMyOnlineStatus: 'two-people' };
  let qsTried = false;
  const QS_LABELS = { All: LT('Everyone'), AllUsers: LT('Everyone'), Followers: LT('Followers'), Following: LT('People I Follow'), Friends: LT('Friends'), TrustedFriends: LT('Trusted Friends'), FriendsAndFollowing: LT('Friends & Following'), FriendsFollowingAndFollowers: LT('Friends & Follows'), NoOne: LT('No One') };
  const QS_JOIN_FOR = { AllUsers: 'All', FriendsFollowingAndFollowers: 'Followers', FriendsAndFollowing: 'Following', Friends: 'Friends', TrustedFriends: 'TrustedFriends', NoOne: 'NoOne' };
  const QS_ONLINE_RANK = ['AllUsers', 'FriendsFollowingAndFollowers', 'FriendsAndFollowing', 'Friends', 'TrustedFriends', 'NoOne'];
  const QS_JOIN_RANK = ['All', 'Followers', 'Following', 'Friends', 'TrustedFriends', 'NoOne'];
  let qsCsrf = '';
  let qsData = null;
  let qsLoading = null;
  let qsObserver = null;

  let qsToastTimer = 0;

  function qsToast(text, bad) {
    document.querySelector('.routility-quick-toast')?.remove();
    clearTimeout(qsToastTimer);
    const box = el('div', 'routility-injected routility-toast routility-quick-toast flex items-center gap-large bg-system-contrast content-inverse-emphasis radius-medium padding-x-large padding-y-medium shadow-transient-high text-body-medium' + (bad ? ' routility-toast-bad' : ''));
    box.setAttribute('role', bad ? 'alert' : 'status');
    box.appendChild(el('span', null, text));
    document.body.appendChild(box);
    qsToastTimer = setTimeout(() => box.remove(), 5000);
  }

  function qsIcon(name) {
    return el('span', 'icon icon-regular-' + name + ' routility-quick-icon');
  }

  function qsLabel(v) {
    return QS_LABELS[v] ? lt(QS_LABELS[v]) : String(v).replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  function qsLoad() {
    if (!qsLoading) {
      qsLoading = fetch(QS_URL + '/settings-and-options', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { qsData = d; })
        .catch(() => {})
        .finally(() => { qsLoading = null; });
    }
    return qsLoading;
  }

  async function qsSave(key, value) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(QS_URL, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, qsCsrf ? { 'x-csrf-token': qsCsrf } : {}), body: JSON.stringify({ [key]: value }) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { qsCsrf = r.headers.get('x-csrf-token'); continue; }
        return r.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  function qsOpen() {
    try { return localStorage.getItem('routilityQuickOpen') !== '0'; } catch { return true; }
  }

  function qsPlace() {
    if (settings.quickSettings === false) return;
    const nav = [...document.querySelectorAll('.left-nav nav')].find(n => n.querySelector('a[href$="/my/avatar"]'));
    const host = nav ? nav.parentElement : document.querySelector('ul.left-col-list')?.parentElement;
    if (!host || host.querySelector('.routility-quick')) return;
    const wantPrivacy = QS_ROWS.some(([, , k]) => settings[k] !== false);
    if (wantPrivacy && !qsData && !qsTried) {
      if (!qsLoading) qsLoad().then(() => { qsTried = true; qsPlace(); });
      return;
    }
    const rows = QS_ROWS.filter(([, , k]) => settings[k] !== false).map(([key, label]) => [key, label, qsData && qsData[key]]).filter(([, , d]) => d && d.currentValue);
    const compact = settings.qsStyle === 'compact';
    const box = el('div', 'routility-injected routility-quick' + (compact ? ' routility-quick-compact' : settings.qsStyle === 'tiles' ? ' routility-quick-tiles' : ''));
    box.hidden = true;
    const top = el('div', 'routility-quick-top');
    const head = el('button', 'routility-quick-head text-label-medium content-muted');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(qsOpen()));
    head.append(el('span', null, lt('Quick Settings')), el('span', 'routility-quick-chev'));
    const gear = el('a', 'routility-quick-gear content-muted');
    gear.href = '/my/account#!/routility/menu';
    gear.setAttribute('aria-label', lt('Choose what shows here'));
    gear.dataset.rtTip = lt('Choose what shows here');
    gear.appendChild(el('span', 'icon icon-regular-gear size-[var(--icon-size-small)]'));
    top.append(head, gear);
    const body = el('div', 'routility-quick-body');
    body.hidden = !compact && !qsOpen();
    head.addEventListener('click', () => {
      if (compact) return;
      body.hidden = !body.hidden;
      head.setAttribute('aria-expanded', String(!body.hidden));
      try { localStorage.setItem('routilityQuickOpen', body.hidden ? '0' : '1'); } catch {}
    });
    const optionsFor = (d) => {
      const allowed = (d.options || []).filter(o => !o.requirement || o.requirement === 'SelfUpdateSetting' || o.requirement === 'Inherited').map(o => o.option.optionValue);
      if (!allowed.includes(d.currentValue)) allowed.unshift(d.currentValue);
      return allowed.map(v => ({ value: v, label: qsLabel(v) }));
    };
    const controls = [];
    const sum = el('button', 'routility-quick-sum');
    sum.type = 'button';
    sum.setAttribute('aria-expanded', 'false');
    const dot = el('span', 'routility-quick-dot');
    const sumText = el('span', 'routility-quick-sum-text');
    const sumSub = el('span', 'routility-quick-sum-sub');
    const sumTitle = el('span', 'routility-quick-sum-title', lt('Quick Settings'));
    sumText.append(sumTitle, sumSub);
    sum.append(dot, sumText, el('span', 'routility-quick-chev'));
    const showPop = (on) => {
      box.classList.toggle('routility-quick-open', on);
      sum.setAttribute('aria-expanded', String(on));
    };
    sum.addEventListener('click', () => showPop(!box.classList.contains('routility-quick-open')));
    if (compact) {
      document.addEventListener('mousedown', (e) => {
        if (box.isConnected && !box.contains(e.target)) showPop(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && box.isConnected) showPop(false);
      });
    }
    const paintSum = () => {
      const online = controls.find(c => c.key === 'whoCanSeeMyOnlineStatus');
      const joins = controls.find(c => c.key === 'whoCanJoinMeInExperiences');
      sumTitle.textContent = online ? lt('Online: {value}', { value: qsLabel(online.saved) }) : lt('Quick Settings');
      sumSub.textContent = joins ? lt('Joins: {value}', { value: qsLabel(joins.saved) }) : '';
      dot.classList.toggle('routility-quick-dot-off', !!online && online.saved === 'NoOne');
    };
    const resync = async () => {
      const fresh = await fetch(QS_URL + '/settings-and-options', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (!fresh) return;
      qsData = fresh;
      for (const c of controls) {
        const d = fresh[c.key];
        if (!d || !d.currentValue) continue;
        c.saved = d.currentValue;
        c.dd.setOptions(optionsFor(d));
        c.dd.setValue(d.currentValue);
      }
      paintSum();
    };
    for (const [key, label, d] of rows) {
      const row = el('div', 'routility-quick-row');
      const control = { key, saved: d.currentValue, dd: null };
      const dd = window.RoUtilityUI.dropdown(optionsFor(d), control.saved, async (value) => {
        row.classList.remove('routility-quick-bad');
        row.classList.add('routility-quick-busy');
        let ok = true;
        const online = controls.find(c => c.key === 'whoCanSeeMyOnlineStatus');
        if (key === 'whoCanJoinMeInExperiences' && online) {
          const need = QS_ONLINE_RANK[QS_JOIN_RANK.indexOf(value)];
          const have = QS_ONLINE_RANK.indexOf(online.saved);
          if (need && have > QS_ONLINE_RANK.indexOf(need)) {
            const orow = online.dd.closest('.routility-quick-row');
            orow?.classList.add('routility-quick-busy');
            ok = await qsSave('whoCanSeeMyOnlineStatus', need);
            if (ok) {
              online.saved = need;
              qsToast(lt('Also changed Online Status to {value} so those people can join you.', { value: qsLabel(need) }));
            }
            orow?.classList.remove('routility-quick-busy');
          }
        }
        if (ok) ok = await qsSave(key, value);
        if (ok) {
          control.saved = value;
          const join = key === 'whoCanSeeMyOnlineStatus' && QS_JOIN_FOR[value];
          const joins = controls.find(c => c.key === 'whoCanJoinMeInExperiences');
          if (join && joins && joins.saved !== join) {
            joins.dd.closest('.routility-quick-row')?.classList.add('routility-quick-busy');
            if (await qsSave('whoCanJoinMeInExperiences', join)) {
              joins.saved = join;
              qsToast(lt('Also changed Joins to {value} to match who can see you online.', { value: qsLabel(join) }));
            } else qsToast(lt('Couldn’t update Joins to match. Try changing it again.'), true);
            joins.dd.closest('.routility-quick-row')?.classList.remove('routility-quick-busy');
          }
          await resync();
        } else {
          dd.setValue(control.saved);
          row.classList.add('routility-quick-bad');
          qsToast(lt('Couldn’t save {setting}. Roblox didn’t accept the change, try again.', { setting: lt(label) }), true);
        }
        row.classList.remove('routility-quick-busy');
        paintSum();
      }, 'routility-quick-dd');
      control.dd = dd;
      controls.push(control);
      dd.querySelector('.input-dropdown-btn').classList.add('bg-shift-300', 'content-emphasis', 'text-label-small');
      row.append(qsIcon(QS_ICONS[key]), el('span', 'text-body-medium content-emphasis routility-quick-label', lt(label)), dd);
      body.appendChild(row);
    }
    paintSum();
    if (compact) {
      const pop = el('div', 'routility-quick-pop');
      pop.append(top, body);
      box.append(sum, pop);
    } else {
      box.append(top, body);
    }
    host.appendChild(box);
    qsFit(body);
    qsRotator(body);
    qsStreamer(body);
  }

  function qsFit(body) {
    const box = body && body.closest('.routility-quick');
    if (box) box.hidden = !body.querySelector('.routility-quick-row');
  }

  function qsStreamer(body) {
    if (!body || !body.isConnected) return;
    let row = body.querySelector('.routility-quick-streamer');
    if (settings.qsStreamer !== true) {
      row?.remove();
      qsFit(body);
      return;
    }
    if (!row) {
      row = el('div', 'routility-quick-row routility-quick-streamer');
      const dd = window.RoUtilityUI.dropdown([{ value: 'on', label: lt('On') }, { value: 'off', label: lt('Off') }], settings.streamerMode ? 'on' : 'off', (value) => {
        chrome.storage.local.get('routilitySettings', (st) => {
          if (chrome.runtime.lastError) return;
          chrome.storage.local.set({ routilitySettings: { ...(st.routilitySettings || {}), streamerMode: value === 'on' } });
        });
      }, 'routility-quick-dd');
      dd.querySelector('.input-dropdown-btn').classList.add('bg-shift-300', 'content-emphasis', 'text-label-small');
      row.dd = dd;
      row.append(qsIcon('lock-closed'), el('span', 'text-body-medium content-emphasis routility-quick-label', lt('Streamer Mode')), dd);
      const rot = body.querySelector('.routility-quick-rot');
      if (rot) rot.before(row);
      else body.appendChild(row);
    }
    row.dd.setValue(settings.streamerMode ? 'on' : 'off');
    qsFit(body);
  }

  function qsRotator(body) {
    if (!body || !body.isConnected || !chrome.runtime?.id) return;
    chrome.storage.local.get('routilityRotator', (st) => {
      if (chrome.runtime.lastError || !body.isConnected) return;
      const r = st.routilityRotator || {};
      const live = settings.outfitRotator !== false && !!r.on && (r.ids || []).length >= 2;
      let row = body.querySelector('.routility-quick-rot');
      if (settings.qsRotator === false || (!live && !(row && row.dataset.kept))) {
        row?.remove();
        qsFit(body);
        return;
      }
      if (!row) {
        row = el('div', 'routility-quick-row routility-quick-rot');
        const dd = window.RoUtilityUI.dropdown([{ value: 'on', label: lt('On') }, { value: 'off', label: lt('Off') }, { value: 'manage', label: lt('Manage') }], live ? 'on' : 'off', async (value) => {
          const cur = ((await chrome.storage.local.get('routilityRotator')).routilityRotator) || {};
          if (value === 'manage') {
            dd.setValue(cur.on ? 'on' : 'off');
            if (/^\/my\/avatar\/?$/i.test(location.pathname) && window.RoUtilityRotator) window.RoUtilityRotator.open();
            else {
              try { sessionStorage.setItem('routilityOpenRotator', '1'); } catch {}
              location.href = '/my/avatar';
            }
            return;
          }
          row.dataset.kept = '1';
          row.classList.remove('routility-quick-bad');
          row.classList.add('routility-quick-busy');
          const res = await new Promise(res2 => chrome.runtime.sendMessage({ type: 'rotatorSave', on: value === 'on', ids: cur.ids || [], every: cur.every, order: cur.order }, (x) => { void chrome.runtime.lastError; res2(x); }));
          row.classList.remove('routility-quick-busy');
          if (!res) {
            dd.setValue(cur.on ? 'on' : 'off');
            row.classList.add('routility-quick-bad');
            qsToast(lt('Couldn’t change the Outfit Rotator. Try again.'), true);
          } else qsToast(value === 'on' ? lt('Outfit Rotator is on again.') : lt('Outfit Rotator stopped. Turn it back on here or in the avatar editor.'));
        }, 'routility-quick-dd');
        dd.querySelector('.input-dropdown-btn').classList.add('bg-shift-300', 'content-emphasis', 'text-label-small');
        row.dd = dd;
        row.append(qsIcon('clock'), el('span', 'text-body-medium content-emphasis routility-quick-label', lt('Outfit Rotator')), dd);
        body.appendChild(row);
      }
      row.dd.setValue(live ? 'on' : 'off');
      qsFit(body);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilityRotator) return;
    qsRotator(document.querySelector('.routility-quick .routility-quick-body'));
  });

  function qsRefresh(rebuild) {
    const body = document.querySelector('.routility-quick .routility-quick-body');
    if (rebuild || settings.quickSettings === false) {
      if (!qsData) qsTried = false;
      document.querySelector('.routility-quick')?.remove();
      if (settings.quickSettings === false) return;
      startQuick();
      qsPlace();
      return;
    }
    qsStreamer(body);
    qsRotator(body);
  }

  function startQuick() {
    if (qsObserver || settings.quickSettings === false) return;
    qsObserver = new MutationObserver(onFrame(qsPlace));
    qsObserver.observe(document.body, { childList: true, subtree: true });
    qsPlace();
  }

  const PM = 'https://privatemessages.roblox.com/v1/messages';
  let pmCsrf = '';
  let pmBusy = false;
  let pmObserver = null;

  async function pmGet(url) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.status === 429) { await new Promise(res => setTimeout(res, 1500 * (i + 1))); continue; }
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function pmPost(path, ids) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(PM + path, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, pmCsrf ? { 'x-csrf-token': pmCsrf } : {}), body: JSON.stringify({ messageIds: ids }) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { pmCsrf = r.headers.get('x-csrf-token'); continue; }
        if (r.status === 429) { await new Promise(res => setTimeout(res, 2000 * (i + 1))); continue; }
        return r.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  async function pmCollect(want, limit, onPage) {
    const ids = [];
    const first = await pmGet(`${PM}?messageTab=Inbox&pageNumber=0&pageSize=20`);
    if (!first) return null;
    const pages = first.totalPages || 1;
    for (let p = 0; p < pages && ids.length < limit; p++) {
      const page = p === 0 ? first : await pmGet(`${PM}?messageTab=Inbox&pageNumber=${p}&pageSize=20`);
      if (!page || !(page.collection || []).length) break;
      for (const m of page.collection || []) if (want(m)) ids.push(m.id);
      onPage(p + 1, pages);
      if (p) await new Promise(res => setTimeout(res, 300));
    }
    return ids;
  }

  async function pmApply(path, ids, progress, btn) {
    let done = 0;
    for (let i = 0; i < ids.length; i += 20) {
      if (!(await pmPost(path, ids.slice(i, i + 20)))) return done;
      done += Math.min(20, ids.length - i);
      btn.querySelector('.routility-pm-label').textContent = progress(formatNumber(done), formatNumber(ids.length));
      await new Promise(res => setTimeout(res, 250));
    }
    return done;
  }

  function pmButton(model, text) {
    const b = el('button', model.className + ' routility-injected routility-pm-btn');
    b.type = 'button';
    b.appendChild(el('span', 'routility-pm-label', text));
    return b;
  }

  async function pmUnread() {
    const d = await pmGet(`${PM}/unread/count`);
    return d && typeof d.count === 'number' ? d.count : null;
  }

  async function pmPaintCount() {
    const h1 = document.querySelector('.private-message-page > h1');
    if (!h1) return;
    let n = await pmUnread();
    if (n === null) return;
    let justRead = 0;
    try { justRead = Number(sessionStorage.getItem('routilityPmAllRead')) || 0; } catch {}
    if (justRead && Date.now() - justRead < 20000 && n > 0) {
      n = 0;
      setTimeout(pmPaintCount, 2500);
    } else if (justRead) {
      try { sessionStorage.removeItem('routilityPmAllRead'); } catch {}
    }
    let tag = h1.querySelector('.routility-pm-unread');
    if (!tag) {
      tag = el('span', 'routility-injected routility-pm-unread text-body-large content-muted');
      h1.appendChild(tag);
    }
    tag.textContent = n ? ltn(n, '{n} unread', '{n} unread', { n: formatNumber(n) }) : '';
    const mark = document.querySelector('.routility-pm-read');
    if (mark && !pmBusy) {
      mark.disabled = !n;
      mark.querySelector('.routility-pm-label').textContent = n ? lt('Mark All as Read') : lt('All Read');
    }
  }

  function pmPlace() {
    if (settings.messageTools === false || !location.pathname.startsWith('/my/messages')) return;
    const bar = document.querySelector('.private-message-action-buttons');
    if (!bar || bar.querySelector('.routility-pm-btn')) return;
    const model = bar.querySelector('button.foundation-web-button');
    if (!model) return;
    const read = pmButton(model, lt('Mark All as Read'));
    read.classList.add('routility-pm-read');
    const archive = pmButton(model, lt('Archive All Read'));
    archive.classList.add('routility-pm-archive');
    let confirmTimer = 0;
    read.addEventListener('click', async () => {
      if (pmBusy) return;
      pmBusy = true;
      read.disabled = archive.disabled = true;
      const label = read.querySelector('.routility-pm-label');
      const unread = await pmUnread();
      if (unread === null) {
        pmBusy = false;
        read.disabled = archive.disabled = false;
        label.textContent = lt('Couldn’t Reach Roblox');
        setTimeout(() => { label.textContent = lt('Mark All as Read'); }, 3000);
        return;
      }
      const ids = unread ? await pmCollect(m => !m.isRead, unread, (p, n) => { label.textContent = lt('Finding unread {page} / {pages}', { page: p, pages: n }); }) : [];
      const done = ids && ids.length ? await pmApply('/mark-read', ids, (done, total) => lt('Reading {done} of {total}', { done, total }), read) : 0;
      pmBusy = false;
      archive.disabled = false;
      const all = ids && done === ids.length;
      label.textContent = all ? lt('All Read') : lt('Some Didn’t Work');
      read.disabled = all;
      if (all) { try { sessionStorage.setItem('routilityPmAllRead', String(Date.now())); } catch {} }
      setTimeout(() => location.reload(), 900);
    });
    archive.addEventListener('click', async () => {
      if (pmBusy) return;
      const label = archive.querySelector('.routility-pm-label');
      if (!archive.classList.contains('routility-pm-confirm')) {
        archive.classList.add('routility-pm-confirm');
        label.textContent = lt('Archive Every Read Message?');
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { archive.classList.remove('routility-pm-confirm'); label.textContent = lt('Archive All Read'); }, 4000);
        return;
      }
      clearTimeout(confirmTimer);
      archive.classList.remove('routility-pm-confirm');
      pmBusy = true;
      read.disabled = archive.disabled = true;
      const seen = new Set();
      let total = 0;
      let ok = true;
      let lost = false;
      for (let pass = 0; pass < 40 && ok; pass++) {
        const ids = await pmCollect(m => m.isRead && !seen.has(m.id), Infinity, (p) => { label.textContent = total ? lt('Finding read messages · {archived} archived ({page})', { archived: formatNumber(total), page: p }) : lt('Finding read messages ({page})', { page: p }); });
        if (!ids) {
          ok = false;
          lost = true;
          break;
        }
        if (!ids.length) break;
        ids.forEach(x => seen.add(x));
        const done = await pmApply('/archive', ids, (d, t) => (total ? lt('Archiving ({archived} done) {done} of {total}', { archived: formatNumber(total), done: d, total: t }) : lt('Archiving {done} of {total}', { done: d, total: t })), archive);
        total += done;
        ok = done === ids.length;
      }
      pmBusy = false;
      if (lost && !total) {
        label.textContent = lt('Couldn’t Load Messages · Try Again');
        read.disabled = archive.disabled = false;
        return;
      }
      label.textContent = ok ? lt('Archived {n}', { n: formatNumber(total) }) : lt('Archived {n} · Some Didn’t Work', { n: formatNumber(total) });
      setTimeout(() => location.reload(), ok ? 900 : 2500);
    });
    bar.append(read, archive);
    pmPaintCount();
  }

  function startMessages() {
    if (pmObserver || settings.messageTools === false || !location.pathname.startsWith('/my/messages')) return;
    pmObserver = new MutationObserver(onFrame(pmPlace));
    pmObserver.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    let timers = [];
    const refresh = () => {
      timers.forEach(clearTimeout);
      timers = [setTimeout(pmPaintCount, 700), setTimeout(pmPaintCount, 2000)];
    };
    document.addEventListener('click', (e) => {
      if (pmBusy || !e.target.closest || e.target.closest('.routility-pm-btn') || !e.target.closest('.private-message-page')) return;
      refresh();
    }, true);
    setInterval(() => { if (!pmBusy && document.visibilityState === 'visible' && document.querySelector('.routility-pm-read')) pmPaintCount(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !pmBusy) pmPaintCount(); });
    pmPlace();
  }

  function tagDevices() {
    if (location.pathname !== '/my/account' || document.querySelector('.routility-devices-list')) return;
    const head = [...document.querySelectorAll('.text-title-large')].find(n => /^Devices where you/.test(n.textContent.trim()));
    head?.closest('ul')?.classList.add('routility-devices-list');
  }

  function startDevices() {
    if (location.pathname !== '/my/account') return;
    new MutationObserver(onFrame(tagDevices)).observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    tagDevices();
  }

  let r6At = 0;

  function startR6Skip() {
    if (startR6Skip.on) return;
    startR6Skip.on = true;
    document.addEventListener('click', (e) => {
      if (settings.skipR6Warning !== true || !/^\/my\/avatar/i.test(location.pathname)) return;
      if (e.target.closest?.('.avatar-type-toggle-scale, .routility-av-rig')) r6At = Date.now();
    }, true);
    new MutationObserver(() => {
      if (!r6At || Date.now() - r6At > 3000) return;
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        const buttons = dialog.querySelectorAll('button');
        if (buttons.length < 2 || buttons.length > 3 || !/R6(?!\d)/.test(dialog.textContent)) continue;
        const go = [...buttons].find(b => b.classList.contains('bg-action-emphasis'));
        if (!go) continue;
        r6At = 0;
        go.click();
        return;
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  const PULSE_URL = 'https://apis.roblox.com/user-heartbeats-api/pulse?_routility=1';
  let pulseTimer = null;
  let pulseCsrf = '';

  async function studioPulse() {
    if (!chrome.runtime?.id || settings.studioStatus !== true) return;
    const now = Date.now();
    const last = (await chrome.storage.local.get('routilityStudioPulse')).routilityStudioPulse || 0;
    if (now - last < 25000) return;
    await chrome.storage.local.set({ routilityStudioPulse: now });
    const session = (/sessionid=([a-f0-9-]{36})/.exec(document.cookie) || [])[1] || crypto.randomUUID();
    const body = JSON.stringify({ clientSideTimestampEpochMs: now, sessionInfo: { sessionId: session }, locationInfo: { studioLocationInfo: { placeId: 0 } } });
    const send = () => fetch(PULSE_URL, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', ...(pulseCsrf ? { 'x-csrf-token': pulseCsrf } : {}) }, body });
    try {
      const res = await send();
      if (res.status === 403 && res.headers.get('x-csrf-token')) {
        pulseCsrf = res.headers.get('x-csrf-token');
        await send();
      }
    } catch {}
  }

  function startStudioStatus() {
    if (settings.studioStatus !== true) {
      clearInterval(pulseTimer);
      pulseTimer = null;
      return;
    }
    if (pulseTimer) return;
    studioPulse();
    pulseTimer = setInterval(studioPulse, 30000);
  }

  const OWN_LINK = /^((?:https:\/\/www\.roblox\.com)?\/users)\/(profile|inventory)\/?$/;

  function ownLinks() {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!/^\d+$/.test(me || '')) return;
    for (const a of document.querySelectorAll('a[href$="/users/profile"], a[href$="/users/inventory"]')) {
      const href = a.getAttribute('href');
      const m = href.match(OWN_LINK);
      if (!m) continue;
      a.dataset.rtProfile = href;
      a.setAttribute('href', `${m[1]}/${me}/${m[2]}`);
    }
  }

  function startOwnLinks() {
    new MutationObserver(onFrame(ownLinks)).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    ownLinks();
  }

  loadSettings().then(() => {
    startNav();
    if (location.hostname === 'www.roblox.com') startOwnLinks();
    startMenu();
    if (location.hostname === 'www.roblox.com') startStatus();
    if (location.hostname === 'www.roblox.com') startDevices();
    if (location.hostname === 'www.roblox.com') startQuick();
    if (location.hostname === 'www.roblox.com') startMessages();
    if (location.hostname === 'www.roblox.com') startCollapse();
    if (location.hostname === 'www.roblox.com') startStudioStatus();
    if (location.hostname === 'www.roblox.com') startR6Skip();
  });

  window.RoUtilityMisc = { setup, teardown };
})();
