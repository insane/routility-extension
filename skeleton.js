(function () {
  'use strict';

  const { lt, ltn, LT } = window.RoUtilityI18n;
  const CLASS = 'routility-skeleton';
  const root = document.documentElement;
  if (location.hostname === 'www.roblox.com') {
    root.classList.add('routility-nav-reserve');
    const settle = () => setTimeout(() => {
      if (!document.querySelector('#wrap.left-nav-new-width')) root.classList.remove('routility-nav-reserve');
    }, 3000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once: true });
    else settle();
  }
  const routed = location.pathname === '/charts' && location.search.match(/^\?routility=(\/(?:forum(?:\/[^&]*)?|trades\/calculator\/?|trade-ads\/?))&?(.*)$/);
  if (routed) {
    history.replaceState(history.state, '', routed[1] + (routed[2] ? '?' + routed[2] : '') + location.hash);
    const titleKey = /^\/forum/.test(routed[1]) ? LT('Forum - Roblox') : /^\/trades/.test(routed[1]) ? LT('Trade Calculator - Roblox') : LT('Trade Ads - Roblox');
    root.dataset.rtTitle = lt(titleKey);
    const fixTitle = () => {
      const want = root.dataset.rtTitle;
      const m = document.title.match(/^(\(\d+\)\s*)?([\s\S]*)$/);
      if (want && m[2] !== want) document.title = (m[1] || '') + want;
    };
    let parked = false;
    let titled = false;
    window.RoUtilityI18n.ready.then(() => {
      if (root.dataset.rtTitle !== titleKey) return;
      root.dataset.rtTitle = lt(titleKey);
      if (titled) fixTitle();
    });
    const park = new MutationObserver(() => {
      const app = !parked && (document.getElementById('game-carousel-web-app') || document.getElementById('games-carousel-page'));
      if (app) {
        app.remove();
        parked = true;
      }
      const title = !titled && document.querySelector('head > title');
      if (title) {
        titled = true;
        fixTitle();
        new MutationObserver(fixTitle).observe(title, { childList: true, characterData: true, subtree: true });
      }
      if (parked && titled) park.disconnect();
    });
    park.observe(root, { childList: true, subtree: true });
    window.addEventListener('load', () => park.disconnect(), { once: true });
  }
  const ownProfile = () => {
    const m = location.pathname.match(/^\/users\/(\d+)\/profile/i);
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    root.classList.toggle('routility-own-profile', !!m && !!me && m[1] === me);
  };
  if (/^\/users\/\d+\/profile/i.test(location.pathname)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ownProfile, { once: true });
    else ownProfile();
  }
  let revealOn = true;
  const apply = (settings) => {
    revealOn = (settings || {}).revealTerminated !== false;
    if (!revealOn) document.querySelectorAll('.routility-deleted-wait').forEach(n => n.classList.remove('routility-deleted-wait'));
    root.classList.toggle(CLASS, (settings || {}).skeletonLoading !== false);
    root.classList.toggle('routility-hide-makeup', (settings || {}).hideMakeup !== false);
    root.classList.toggle('routility-hide-sponsored', (settings || {}).hideSponsored !== false);
    root.classList.toggle('routility-av-rig-on', (settings || {}).avatarRig !== false);
    root.classList.toggle('routility-av-more', (settings || {}).avatarMoreAccessories !== false);
    root.classList.toggle('routility-keep-r6', (settings || {}).keepR6 === true);
    root.classList.toggle('routility-av-sticky', (settings || {}).avatarSticky !== false);
    root.classList.toggle('routility-font-builder', (settings || {}).siteFont === 'builder');
    root.classList.toggle('routility-font-system', (settings || {}).siteFont === 'system');
    root.classList.toggle('routility-hide-chat', !!(settings || {}).hideChat);
    root.classList.toggle('routility-classic-logo', !!(settings || {}).classicLogo);
    root.classList.toggle('routility-classic-premium', !!(settings || {}).classicPremium);
    root.classList.toggle('routility-exact-prices', (settings || {}).exactPrices !== false);
    root.classList.toggle('routility-badge-fix', (settings || {}).badgeSizeFix !== false);
    root.classList.toggle('routility-scrollbar-fix', (settings || {}).scrollbarFix !== false);
    root.classList.toggle('routility-scrollbar-floating', (settings || {}).scrollbarFix !== false && (settings || {}).scrollbarStyle !== 'default');
    root.classList.toggle('routility-full-desc', (settings || {}).groupFullDesc !== false);
    const greetWait = /^\/home\/?$/i.test(location.pathname) && (settings || {}).homeGreeting !== false;
    root.classList.toggle('routility-greeting-wait', greetWait);
    root.classList.toggle('routility-greeting-wait-pt', greetWait && (settings || {}).playtime !== false);
    const streamer = !!(settings || {}).streamerMode;
    if (calcPage) root.classList.toggle('routility-calc-page', (settings || {}).tradeCalculator !== false);
    if (forumPage) root.classList.toggle('routility-forum-page', (settings || {}).forum !== false);
    if (adsPage) root.classList.toggle('routility-ads-page', (settings || {}).tradeAds !== false);
    root.classList.toggle('routility-forum-topbar', (settings || {}).forum !== false && (settings || {}).forumTopLink !== false);
    root.classList.toggle('routility-streamer', streamer && (settings || {}).streamerRobux !== false);
    root.classList.toggle('routility-streamer-account', streamer && (settings || {}).streamerAccount !== false);
    root.classList.toggle('routility-streamer-payment', streamer && (settings || {}).streamerPayment !== false);
    root.classList.toggle('routility-streamer-name', streamer && !!(settings || {}).streamerName);
    root.classList.toggle('routility-streamer-avatar', streamer && !!(settings || {}).streamerAvatar);
    root.classList.toggle('routility-streamer-values', streamer && !!(settings || {}).streamerValues);
    if ((settings || {}).hideSponsored !== false) watchSponsored();
  };

  let sponsoredObserver = null;
  const SPONSORED_LIST = '.game-grid, .game-carousel, ul.hlist';
  function sweepSponsored() {
    if (!root.classList.contains('routility-hide-sponsored')) return;
    for (const list of document.querySelectorAll(SPONSORED_LIST)) {
      const items = list.querySelectorAll(':scope > li');
      if (!items.length) continue;
      const all = [...items].every(li => li.querySelector('.sponsored-ad-label'));
      const section = list.parentElement;
      if (section && section !== document.body) section.classList.toggle('routility-sponsored-section', all);
    }
  }
  function watchSponsored() {
    if (sponsoredObserver) return;
    let queued = false;
    sponsoredObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sweepSponsored(); });
    });
    sponsoredObserver.observe(root, { childList: true, subtree: true });
  }
  const calcPage = /^\/trades\/calculator\/?$/i.test(location.pathname);
  const forumPage = /^\/forum(\/|$)/i.test(location.pathname);
  if (calcPage) root.classList.add('routility-calc-page');
  if (forumPage) root.classList.add('routility-forum-page');
  const adsPage = /^\/trade-ads\/?$/i.test(location.pathname);
  if (adsPage) root.classList.add('routility-ads-page');
  const NAV = [
    ['promo', 'li:has(> a[href*="/plus?referrals"], > a[href="/plus"], > button > .icon-regular-roblox-plus)'],
    ['home', 'li:has(> a[href$="roblox.com/home"])'],
    ['profile', 'li:has(> a:is([href$="roblox.com/users/profile"], [data-rt-profile$="roblox.com/users/profile"]))'],
    ['plus', 'li:has(> a[href$="roblox.com/plus"])'],
    ['messages', 'li:has(> a[href*="/my/messages"])'],
    ['friends', 'li:has(> a[href*="/users/friends"])'],
    ['avatar', 'li:has(> a[href*="/my/avatar"])'],
    ['inventory', 'li:has(> a:is([href$="/users/inventory"], [data-rt-profile$="/users/inventory"]))'],
    ['trade', 'li:has(> a[href$="roblox.com/trades"])'],
    ['calc', 'li.routility-calc-nav'],
    ['ads', 'li.routility-ads-nav'],
    ['communities', 'li:has(> a[href$="/communities"])'],
    ['forum', 'li.routility-forum-nav'],
    ['newsroom', 'li:has(> a[href*="blog.roblox.com"])'],
    ['store', 'li:has(> button .icon-regular-building-store)'],
    ['giftcards', 'li:has(> a[href*="/giftcards"])'],
  ];
  const NAV_FOLLOW = { newsroom: ':is(li, div):has(a[href*="blog.roblox.com"]):not(:has(> a[href*="blog.roblox.com"]))' };
  let navStyle = null;
  const applyNav = (v) => {
    if (!v) v = { order: [], hidden: ['promo', 'store', 'newsroom', 'giftcards'] };
    const order = Array.isArray(v && v.order) ? v.order.map(String) : [];
    const hidden = Array.isArray(v && v.hidden) ? v.hidden.map(String) : [];
    const rules = new Map(NAV);
    let css = '';
    if (order.length) {
      css += '.left-nav nav ul > li { order: 90; } .left-nav nav ul > li:first-child { order: -1; }';
      order.forEach((k, i) => {
        if (rules.has(k)) css += `.left-nav nav ul > ${rules.get(k)} { order: ${i}; }`;
        if (NAV_FOLLOW[k]) css += `.left-nav nav ul > ${NAV_FOLLOW[k]} { order: ${i}; }`;
      });
    }
    for (const k of hidden) {
      if (rules.has(k)) css += `.left-nav nav ul > ${rules.get(k)} { display: none !important; }`;
      if (NAV_FOLLOW[k]) css += `.left-nav nav ul > ${NAV_FOLLOW[k]} { display: none !important; }`;
    }
    if (!navStyle) {
      navStyle = document.createElement('style');
      navStyle.id = 'routility-nav-layout';
      (document.head || root).appendChild(navStyle);
    }
    navStyle.textContent = css;
  };
  const THEME_VARS = {
    bg: ['--color-surface-0', '--color-common-navigation-bar'],
    nav: ['--color-navigation-background', '--dark-mode-navigation-background', '--light-mode-navigation-background'],
    card: ['--color-surface-100'],
    raised: ['--color-surface-200'],
    menu: ['--color-surface-300'],
    shimmer: ['--color-common-shimmer'],
    text: ['--color-content-emphasis', '--color-action-standard-foreground', '--color-action-link-foreground', '--color-action-utility-foreground', '--color-action-subtle-foreground'],
    body: ['--color-content-default'],
    muted: ['--color-content-muted', '--color-system-neutral'],
    link: ['--color-content-link'],
    accent: ['--color-system-emphasis'],
    play: ['--color-action-emphasis-background'],
  };
  const OVER_MEDIA = [['bg', 0], ['card', 100], ['raised', 200], ['menu', 300]];
  const FX = {
    glow: { glow: (c) => `radial-gradient(900px 520px at 12% -8%, color-mix(in srgb, ${c.accent} 36%, transparent), transparent 70%), radial-gradient(800px 600px at 100% 100%, color-mix(in srgb, ${c.accent} 20%, transparent), transparent 70%)` },
    grid: { glow: (c) => `radial-gradient(1000px 620px at 50% -12%, color-mix(in srgb, ${c.accent} 32%, transparent), transparent 70%)`, grid: true },
  };
  const fxCss = (name, colors) => {
    const fx = FX[name];
    if (!fx) return '';
    const c = { accent: safeColor(colors.accent) ? colors.accent : '#335fff' };
    let css = `html.routility-themed body::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: ${fx.glow(c)}; } html.routility-themed #footer-container { background: transparent !important; }`;
    if (fx.grid) css += ` html.routility-themed body::after { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background-image: radial-gradient(color-mix(in srgb, ${c.accent} 22%, transparent) 1px, transparent 1.3px); background-size: 28px 28px; mask-image: radial-gradient(1200px 800px at 50% 30%, #000 20%, transparent 80%); -webkit-mask-image: radial-gradient(1200px 800px at 50% 30%, #000 20%, transparent 80%); }`;
    return css;
  };
  let themeOn = false;
  let themeColors = {};
  let themeFx = '';
  let themeStyle = null;
  const safeColor = (v) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/i.test(v.trim());
  const lightColor = (v) => {
    const s = String(v || '').trim();
    let m = s.match(/^#([0-9a-f]{3,8})$/i);
    let rgb = null;
    if (m) {
      const h = m[1].length < 6 ? m[1].slice(0, 3).split('').map(x => x + x).join('') : m[1];
      rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    } else if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i))) rgb = [m[1], m[2], m[3]].map(Number);
    return !!rgb && (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.55;
  };
  const TILES = '.thumbnail-2d-container, .item-card-thumb-container, .game-card-thumb-container, .asset-thumb-container';
  const applyTheme = () => {
    let css = '';
    if (themeOn) {
      const decl = [];
      const pick = (id) => id === 'nav' && !safeColor(themeColors.nav) ? themeColors.bg : themeColors[id];
      const navColor = pick('nav');
      for (const [id, vars] of Object.entries(THEME_VARS)) {
        const c = pick(id);
        if (!safeColor(c)) continue;
        for (const v of vars) decl.push(`${v}: ${c} !important;`);
      }
      for (const [id, n] of OVER_MEDIA) if (safeColor(themeColors[id])) decl.push(`--color-over-media-${n}: color-mix(in srgb, ${themeColors[id]} 92%, transparent) !important;`);
      if (safeColor(navColor)) decl.push('--color-navigation-image: none !important; --dark-mode-navigation-image: none !important; --light-mode-navigation-image: none !important;');
      if (decl.length) {
        css = `:root, body, .dark-theme, .light-theme { ${decl.join(' ')} } body { background-color: var(--color-surface-0) !important; }`;
        if (safeColor(navColor)) css += ` #header.rbx-header, .rbx-header, .left-nav { background-image: none !important; background-color: ${navColor} !important; }`;
        css += fxCss(themeFx, themeColors);
        css += ` :is(${TILES}) { --color-common-shimmer: ${lightColor(themeColors.card || themeColors.bg) ? '#e4e5e9' : '#2b2d34'} !important; }`;
        css += ' .icon-filled-verified-backplate, .verified-badge-icon, [data-rblx-verified-badge-icon], .routility-verified, .routility-admin-badge, .icon-regular-roblox-plus, .icon-display-name-badge-plus, .routility-logo { --color-system-emphasis: #335fff !important; --color-system-contrast: #f7f7f8 !important; --color-content-emphasis: #f7f7f8 !important; }';
      }
    }
    if (!css && !themeStyle) return;
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'routility-theme';
    }
    themeStyle.textContent = css;
    if (!themeStyle.isConnected) (document.head || root).appendChild(themeStyle);
    root.classList.toggle('routility-themed', !!css);
  };
  let navCollapsed = false;
  let lastSettings = {};
  let onlyTimer = null;
  const robloxOnly = () => {
    if (!/^\/catalog\/?$/i.test(location.pathname) || (lastSettings || {}).catalogRobloxOnly !== true) return;
    const url = new URL(location.href);
    const keys = [...url.searchParams.keys()];
    const view = 'v:' + keys.filter(k => !/^(creatorname|creatortargetid|creatortype|cursor|pagenumber)$/i.test(k)).sort().map(k => k.toLowerCase() + '=' + url.searchParams.get(k).trim().toLowerCase()).join('&');
    const remember = () => { try { sessionStorage.setItem('routilityRobloxOnly', view); } catch {} };
    if (keys.some(k => /^creator(name|targetid)$/i.test(k))) return remember();
    let done = null;
    try { done = sessionStorage.getItem('routilityRobloxOnly'); } catch {}
    if (done === view) return;
    remember();
    url.searchParams.set('CreatorName', 'Roblox');
    location.replace(url.href);
  };
  const watchRobloxOnly = () => {
    const on = (lastSettings || {}).catalogRobloxOnly === true;
    if (on && !onlyTimer) onlyTimer = setInterval(robloxOnly, 400);
    if (!on && onlyTimer) {
      clearInterval(onlyTimer);
      onlyTimer = null;
    }
    robloxOnly();
  };
  const applyCollapse = () => root.classList.toggle('routility-nav-collapsed', navCollapsed && (lastSettings || {}).navCollapse !== false);
  chrome.storage.local.get(['routilitySettings', 'routilityNavLayout', 'routilityNavCollapsed', 'routilityTheme'], (s) => {
    lastSettings = s.routilitySettings || {};
    watchRobloxOnly();
    themeOn = !!lastSettings.customTheme;
    themeColors = (s.routilityTheme && s.routilityTheme.colors) || {};
    themeFx = (s.routilityTheme && typeof s.routilityTheme.fx === 'string') ? s.routilityTheme.fx : '';
    applyTheme();
    navCollapsed = !!s.routilityNavCollapsed;
    apply(s.routilitySettings);
    applyNav(s.routilityNavLayout);
    applyCollapse();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.routilitySettings) { lastSettings = changes.routilitySettings.newValue || {}; apply(changes.routilitySettings.newValue); applyCollapse(); watchRobloxOnly(); themeOn = !!lastSettings.customTheme; applyTheme(); }
    if (area === 'local' && changes.routilityTheme) { const t = changes.routilityTheme.newValue || {}; themeColors = t.colors || {}; themeFx = typeof t.fx === 'string' ? t.fx : ''; applyTheme(); }
    if (area === 'local' && changes.routilityNavLayout) applyNav(changes.routilityNavLayout.newValue);
    if (area === 'local' && changes.routilityNavCollapsed) { navCollapsed = !!changes.routilityNavCollapsed.newValue; applyCollapse(); }
  });

  if (!/^\/users\/(\d+\/)?friends/i.test(location.pathname)) return;

  const markDeleted = () => {
    if (!revealOn) return;
    for (const name of document.querySelectorAll('li.avatar-card:not([data-routility-revealed]):not(.routility-deleted-wait) .avatar-name')) {
      if (name.textContent.trim() !== 'Account Deleted') continue;
      const li = name.closest('li.avatar-card');
      li.classList.add('routility-deleted-wait');
      setTimeout(() => { if (li.dataset.routilityRevealed !== 'pending') li.classList.remove('routility-deleted-wait'); }, 8000);
    }
  };
  new MutationObserver(markDeleted).observe(root, { childList: true, subtree: true, characterData: true });

  const LIST = /friends\.roblox\.com\/v1\/(users\/\d+\/(friends|followers|followings)\b|my\/friends\/requests)/;
  const TITLE = /friends\.roblox\.com\/v1\/metadata\b/;
  const CARDS = '#friends-web-app .tab-pane.active li.avatar-card';
  const timers = { list: null, title: null, settle: null };
  let stale = new Set();
  let observer = null;

  try { performance.setResourceTimingBufferSize(5000); } catch {}

  const freshCards = () => [...document.querySelectorAll(CARDS)].some(li => !stale.has(li));
  const clearList = () => {
    clearTimeout(timers.list);
    clearTimeout(timers.settle);
    observer?.disconnect();
    observer = null;
    root.classList.remove('routility-sk-wait-list');
  };
  const clearTitle = () => {
    clearTimeout(timers.title);
    root.classList.remove('routility-sk-wait-title');
  };
  const waitList = () => {
    stale = new Set(document.querySelectorAll(CARDS));
    root.classList.add('routility-sk-wait-list');
    clearTimeout(timers.list);
    clearTimeout(timers.settle);
    timers.list = setTimeout(clearList, 6000);
    if (observer) return;
    let queued = false;
    observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (freshCards()) clearList();
      });
    });
    observer.observe(root, { childList: true, subtree: true });
  };
  const listLoaded = () => {
    if (!root.classList.contains('routility-sk-wait-list')) return;
    clearTimeout(timers.settle);
    timers.settle = setTimeout(clearList, freshCards() ? 0 : 1200);
  };

  waitList();
  root.classList.add('routility-sk-wait-title');
  timers.title = setTimeout(clearTitle, 6000);
  if (typeof PerformanceObserver === 'function') {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (LIST.test(entry.name)) listLoaded();
        else if (TITLE.test(entry.name)) clearTitle();
      }
    }).observe({ type: 'resource', buffered: true });
  }
  window.addEventListener('hashchange', waitList);
})();
