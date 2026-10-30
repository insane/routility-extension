(function () {
  'use strict';

  const { lt, ltn, LT } = window.RoUtilityI18n;
  const CLASS = 'routility-skeleton';
  const root = document.documentElement;
  if (location.hostname === 'www.roblox.com' && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:catalog|bundles)\/\d+/i.test(location.pathname)) root.classList.add('routility-hi-path');
  if (location.hostname === 'www.roblox.com' && location.pathname === '/request-error' && !/routility-user=/.test(location.hash)) {
    try {
      const c = JSON.parse(localStorage.getItem('routilityLastItem') || 'null');
      const left = JSON.parse(sessionStorage.getItem('routilityHiddenLeave') || 'null');
      if ((c && Date.now() - c.t < 20000) || (left && Date.now() - left.t < 15000)) root.classList.add('routility-hi-path');
    } catch {}
    if (!root.classList.contains('routility-hi-path')) {
      root.classList.add('routility-hi-maybe');
      setTimeout(() => root.classList.remove('routility-hi-maybe'), 4000);
    }
  }
  function hiSkeleton() {
    const mk = (tag, cls, kids) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      for (const k of kids || []) n.appendChild(k);
      return n;
    };
    const sk = (w, h) => {
      const n = mk('span', 'routility-hi-sk');
      n.style.width = w;
      n.style.height = h;
      return n;
    };
    const row = w => mk('div', 'clearfix item-info-row-container', [mk('div', 'font-header-1 text-subheader text-label text-overflow row-label', [sk('70px', '14px')]), mk('span', 'font-body text', [sk(w, '14px')])]);
    const banner = mk('div', 'routility-hi-banner', [mk('span', 'routility-hi-banner-icon'), mk('div', 'routility-hi-banner-text', [sk('180px', '20px'), sk('90%', '14px'), sk('55%', '14px')]), sk('170px', '36px')]);
    const thumb = mk('div', null, [mk('div', 'item-details-thumbnail-container', [mk('div', 'thumbnail-holder', [sk('100%', '100%')])])]);
    const header = mk('div', 'item-details-info-header border-bottom item-name-container', [mk('div', 'left', [mk('div', 'item-details-name-row', [mk('h1', null, [sk('55%', '34px')])]), mk('div', 'item-details-creator-container', [sk('110px', '16px')])])]);
    const details = mk('div', 'item-details-section', [mk('div', 'price-row-container', [mk('div', 'price-container-text', [sk('50%', '16px')])]), row('40px'), row('90px'), row('100px'), row('100px')]);
    const info = mk('div', null, [mk('div', 'shopping-cart item-details-info-content', [header, details])]);
    const fav = mk('div', 'routility-hi-sk-fav', [sk('76px', '28px')]);
    return mk('div', 'routility-injected routility-hi-loading', [mk('div', 'content', [mk('div', 'page-content menu-shown', [banner, mk('div', null, [mk('div', 'clearfix', [thumb, info, fav])])])])]);
  }
  function hiCss() {
    try {
      const saved = JSON.parse(localStorage.getItem('routilityItemCss') || 'null');
      for (const u of (saved && Array.isArray(saved.hrefs) ? saved.hrefs : [])) {
        if (!/^https:\/\/css\.rbxcdn\.com\//.test(u) || [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === u)) continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = u;
        link.className = 'routility-injected';
        (document.head || root).appendChild(link);
      }
    } catch {}
  }
  function hiPlace() {
    if (!root.classList.contains('routility-hi-path')) return false;
    const err = document.querySelector('#content > .request-error-page-content');
    if (!err) return false;
    if (!document.querySelector('#content > .routility-hi-loading')) {
      hiCss();
      err.before(hiSkeleton());
    }
    return true;
  }
  window.RoUtilityHiddenSkeleton = hiPlace;
  if (location.hostname === 'www.roblox.com' && root.classList.contains('routility-hi-path') && !hiPlace()) {
    const hiWatch = new MutationObserver(() => { if (hiPlace()) hiWatch.disconnect(); });
    hiWatch.observe(root, { childList: true, subtree: true });
    const hiStop = () => setTimeout(() => hiWatch.disconnect(), 1000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hiStop, { once: true });
    else hiStop();
  }
  if (location.hostname === 'www.roblox.com') {
    const pushKey = 'routilityNavPush:' + ((location.pathname.split('/')[1] || 'home').toLowerCase().replace(/^\d+$/, 'id')) + ':' + Math.round(window.innerWidth / 100);
    let pushed = null;
    try { pushed = localStorage.getItem(pushKey); } catch {}
    if (pushed !== '0') root.classList.add('routility-nav-reserve');
    else if (/^\/users\/\d+\/profile/i.test(location.pathname)) root.classList.add('routility-nav-hold');
    const settle = () => setTimeout(() => {
      const push = !!document.querySelector('#wrap.left-nav-new-width');
      try { localStorage.setItem(pushKey, push ? '1' : '0'); } catch {}
      root.classList.remove('routility-nav-hold');
      if (!push) root.classList.remove('routility-nav-reserve');
    }, 3000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once: true });
    else settle();
  }
  const routed = location.pathname === '/charts' && location.search.match(/^\?routility=(\/(?:forum(?:\/[^&]*)?|trades\/calculator\/?|trade-ads\/?|friend-history\/?))&?(.*)$/);
  if (routed) {
    history.replaceState(history.state, '', routed[1] + (routed[2] ? '?' + routed[2] : '') + location.hash);
    const titleKey = /^\/forum/.test(routed[1]) ? LT('Forum - Roblox') : /^\/trades/.test(routed[1]) ? LT('Trade Calculator - Roblox') : /^\/friend-history/.test(routed[1]) ? LT('Friend History - Roblox') : LT('Trade Ads - Roblox');
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
  const FONT = /^data:font\/(ttf|otf|woff2?);base64,[A-Za-z0-9+/=]+$/;
  let fontStyle = null;
  let fontAsked = false;
  let fontWanted = false;
  const useFont = (f) => {
    const ok = !!f && FONT.test(f.data || '');
    if (!fontStyle) {
      fontStyle = document.createElement('style');
      fontStyle.id = 'routility-font';
    }
    fontStyle.textContent = ok ? `@font-face { font-family: "RoUtility Custom"; src: url("${f.data}"); font-display: swap; }` : '';
    if (!fontStyle.isConnected) (document.head || root).appendChild(fontStyle);
    root.classList.toggle('routility-font-custom', ok && fontWanted);
  };
  const needFont = (settings) => {
    fontWanted = (settings || {}).siteFont === 'custom';
    if (!fontWanted) return root.classList.remove('routility-font-custom');
    if (fontAsked) return root.classList.toggle('routility-font-custom', !!(fontStyle && fontStyle.textContent));
    fontAsked = true;
    chrome.storage.local.get('routilityFont', (st) => useFont(st.routilityFont));
  };
  let classicLink = null;
  let bodyWatch = null;
  let bodyWait = null;
  let swapped = false;
  const lightMode = (on) => {
    const body = document.body;
    if (!body) {
      if (on && !bodyWait) {
        bodyWait = new MutationObserver(() => {
          if (!document.body) return;
          bodyWait.disconnect();
          bodyWait = null;
          sync2017();
        });
        bodyWait.observe(root, { childList: true });
      }
      return;
    }
    const flip = () => {
      if (body.classList.contains('dark-theme')) {
        body.classList.replace('dark-theme', 'light-theme');
        swapped = true;
      }
      if (body.classList.contains('color-mode-dark')) {
        body.classList.replace('color-mode-dark', 'color-mode-light');
        swapped = true;
      }
    };
    if (on) {
      flip();
      if (!bodyWatch) {
        bodyWatch = new MutationObserver(() => sync2017());
        bodyWatch.observe(body, { attributes: true, attributeFilter: ['class'] });
      }
      return;
    }
    bodyWatch?.disconnect();
    bodyWatch = null;
    if (swapped) {
      body.classList.replace('light-theme', 'dark-theme');
      body.classList.replace('color-mode-light', 'color-mode-dark');
      swapped = false;
    }
  };
  const classicSite = () => {
    const on = !!(lastSettings || {}).classicSite;
    root.classList.toggle('routility-2017', on);
    if (on && !classicLink) {
      classicLink = document.createElement('link');
      classicLink.rel = 'stylesheet';
      classicLink.href = chrome.runtime.getURL('styles/classic2017.css');
      classicLink.className = 'routility-2017-css';
      (document.head || root).appendChild(classicLink);
    } else if (!on && classicLink) {
      classicLink.remove();
      classicLink = null;
    }
    sync2017();
  };
  const themed2017 = () => {
    const s = lastSettings || {};
    if (s.customTheme || PLUS_THEMES.includes(s.plusTheme)) return true;
    const b = document.body;
    return !!b && PLUS_THEMES.some(k => b.classList.contains('theme-' + k));
  };
  const sync2017 = () => {
    const on = !!(lastSettings || {}).classicSite;
    const themed = on && themed2017();
    root.classList.toggle('routility-2017-themed', themed);
    lightMode(on && !themed);
  };
  let revealOn = true;
  const apply = (settings) => {
    needFont(settings);
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
    root.classList.toggle('routility-classic-verified', !!(settings || {}).classicVerified);
    root.classList.toggle('routility-classic-admin', !!(settings || {}).classicAdmin);
    root.classList.toggle('routility-exact-prices', (settings || {}).exactPrices !== false);
    root.classList.toggle('routility-scrollbar-fix', (settings || {}).scrollbarFix !== false);
    root.classList.toggle('routility-scrollbar-floating', (settings || {}).scrollbarFix !== false && (settings || {}).scrollbarStyle !== 'default');
    root.classList.toggle('routility-menu-bar', (settings || {}).menuHighlight === 'bar');
    root.classList.toggle('routility-full-desc', (settings || {}).groupFullDesc !== false);
    const greetWait = /^\/home\/?$/i.test(location.pathname) && (settings || {}).homeGreeting !== false;
    root.classList.toggle('routility-greeting-wait', greetWait);
    root.classList.toggle('routility-greeting-wait-pt', greetWait && (settings || {}).playtime !== false);
    const streamer = !!(settings || {}).streamerMode;
    if (calcPage) root.classList.toggle('routility-calc-page', (settings || {}).tradeCalculator !== false);
    if (forumPage) root.classList.toggle('routility-forum-page', (settings || {}).forum !== false);
    if (adsPage) root.classList.toggle('routility-ads-page', (settings || {}).tradeAds !== false);
    if (historyPage) root.classList.toggle('routility-fh-page', (settings || {}).friendHistory !== false);
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
  const historyPage = /^\/friend-history\/?$/i.test(location.pathname);
  if (historyPage) root.classList.add('routility-fh-page');
  const NAV = [
    ['promo', 'li:has(> a[href*="/plus?referrals"], > a[href="/plus"], > button > .icon-regular-roblox-plus)'],
    ['home', 'li:has(> a[href$="roblox.com/home"])'],
    ['profile', 'li:has(> a:is([href$="roblox.com/users/profile"], [data-rt-profile$="roblox.com/users/profile"]))'],
    ['plus', 'li:has(> a[href$="roblox.com/plus"])'],
    ['messages', 'li:has(> a[href*="/my/messages"])'],
    ['friends', 'li:has(> a[href*="/users/friends"])'],
    ['history', 'li.routility-fh-nav'],
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
  const NAV_FLAGS = { calc: ['tradeCalculator', 'calcNav'], ads: ['tradeAds', 'tradeAdsNav'], forum: ['forum', 'forumNav'], history: ['friendHistory', 'friendHistoryNav'] };
  let navStyle = null;
  let navLayout = null;
  const applyNav = (v) => {
    navLayout = v;
    if (!v) v = { order: [], hidden: ['promo', 'store', 'newsroom', 'giftcards'] };
    const order = Array.isArray(v && v.order) ? v.order.map(String) : [];
    const hidden = Array.isArray(v && v.hidden) ? v.hidden.map(String) : [];
    for (const [k, keys] of Object.entries(NAV_FLAGS)) if (keys.some(f => (lastSettings || {})[f] === false)) hidden.push(k);
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
    if ((lastSettings || {}).navCollapse === false) css += '.left-nav nav ul > li.routility-nav-collapse { display: none !important; }';
    if (!navStyle) {
      navStyle = document.createElement('style');
      navStyle.id = 'routility-nav-layout';
      (document.head || root).appendChild(navStyle);
    }
    if (navStyle.textContent !== css) navStyle.textContent = css;
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
    playText: ['--color-action-emphasis-foreground'],
    button: ['--color-action-standard-background'],
    border: ['--color-stroke-default', '--color-stroke-muted', '--color-stroke-emphasis'],
    success: ['--color-system-success'],
    alert: ['--color-system-alert'],
  };
  const OVER_MEDIA = [['bg', 0], ['card', 100], ['raised', 200], ['menu', 300]];
  const SHIFT = [['--color-shift-100', 4], ['--color-shift-200', 8], ['--color-shift-300', 12], ['--color-shift-400', 16], ['--color-state-hover', 8], ['--color-state-press', 12]];
  const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const PATTERNS = {
    flowers: (a, b) => `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><g fill='${a}' fill-opacity='.4'><circle cx='24' cy='17' r='6'/><circle cx='31' cy='22' r='6'/><circle cx='28.5' cy='30.5' r='6'/><circle cx='19.5' cy='30.5' r='6'/><circle cx='17' cy='22' r='6'/></g><circle cx='24' cy='25' r='4' fill='${b}' fill-opacity='.65'/><g fill='${b}' fill-opacity='.32'><circle cx='72' cy='66' r='4'/><circle cx='76.5' cy='69.5' r='4'/><circle cx='75' cy='75' r='4'/><circle cx='69' cy='75' r='4'/><circle cx='67.5' cy='69.5' r='4'/></g><circle cx='72' cy='71' r='2.6' fill='${a}' fill-opacity='.6'/></svg>`,
  };
  const FX = {
    glow: (c, k) => `radial-gradient(${900 * k}px ${520 * k}px at 12% -8%, color-mix(in srgb, ${c.accent} 36%, transparent), transparent 70%), radial-gradient(${800 * k}px ${600 * k}px at 100% 100%, color-mix(in srgb, ${c.accent} 20%, transparent), transparent 70%)`,
    aurora: (c, k) => `radial-gradient(${900 * k}px ${600 * k}px at 0% 0%, color-mix(in srgb, ${c.accent} 34%, transparent), transparent 70%), radial-gradient(${800 * k}px ${560 * k}px at 100% 10%, color-mix(in srgb, ${c.link} 26%, transparent), transparent 70%), radial-gradient(${1000 * k}px ${700 * k}px at 50% 110%, color-mix(in srgb, ${c.play} 24%, transparent), transparent 70%)`,
    grid: (c, k) => `radial-gradient(${1000 * k}px ${620 * k}px at 50% -12%, color-mix(in srgb, ${c.accent} 32%, transparent), transparent 70%)`,
    dots: (c, k) => `radial-gradient(color-mix(in srgb, ${c.accent} 30%, transparent) ${1.2 * Math.max(k, 0.6)}px, transparent ${1.6 * Math.max(k, 0.6)}px) 0 0 / ${22 * Math.max(k, 0.5)}px ${22 * Math.max(k, 0.5)}px`,
  };
  for (const [name, draw] of Object.entries(PATTERNS)) FX[name] = (c, k) => `${svgUrl(draw(c.accent, c.link))} 0 0 / ${120 * Math.max(k, 0.4)}px auto repeat`;
  const palette = (colors) => {
    const c = { accent: safeColor(colors.accent) ? colors.accent : '#335fff' };
    c.link = safeColor(colors.link) ? colors.link : c.accent;
    c.play = safeColor(colors.play) ? colors.play : c.accent;
    c.bg = safeColor(colors.bg) ? colors.bg : '#000000';
    return c;
  };
  const IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  let themeImage = '';
  const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  const bgCss = (colors, look) => {
    const c = palette(colors);
    let layer = '';
    if (themeFx === 'image') {
      if (!themeImage) return '';
      const tint = clamp(look.tint, 0, 95, 70);
      layer = `linear-gradient(color-mix(in srgb, ${c.bg} ${tint}%, transparent), color-mix(in srgb, ${c.bg} ${tint}%, transparent)), url("${themeImage}") center / cover no-repeat`;
    } else if (FX[themeFx]) layer = FX[themeFx](c, 1);
    else return '';
    const blur = clamp(look.blur, 0, 20, 2);
    let css = `html.routility-themed body::before { content: ''; position: fixed; inset: ${blur ? -blur * 2 : 0}px; z-index: -1; pointer-events: none; background: ${layer};${blur ? ` filter: blur(${blur}px);` : ''} } html.routility-themed #footer-container { background: transparent !important; }`;
    if (themeFx === 'grid') css += ` html.routility-themed body::after { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background-image: radial-gradient(color-mix(in srgb, ${c.accent} 22%, transparent) 1px, transparent 1.3px); background-size: 28px 28px; mask-image: radial-gradient(1200px 800px at 50% 30%, #000 20%, transparent 80%); -webkit-mask-image: radial-gradient(1200px 800px at 50% 30%, #000 20%, transparent 80%); }`;
    return css;
  };
  window.RoUtilityBackgrounds = {
    preview: (name, colors) => (FX[name] ? FX[name](palette(colors || {}), 0.16) : ''),
  };
  let imageAsked = false;
  const needImage = () => {
    if (!themeOn || themeFx !== 'image' || imageAsked) return;
    imageAsked = true;
    chrome.storage.local.get('routilityThemeImage', (st) => {
      themeImage = IMAGE.test(st.routilityThemeImage) ? st.routilityThemeImage : '';
      if (themeImage) applyTheme();
    });
  };
  let themeOn = false;
  let themeColors = {};
  let themeFx = '';
  let themeLook = {};
  let themeStyle = null;
  let themeBgStyle = null;
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
      const see = themeFx ? clamp(themeLook.see, 0, 60, 0) : 0;
      if (see) for (const [id, v, k] of [['card', '--color-surface-100', 1], ['raised', '--color-surface-200', 0.75]]) if (safeColor(themeColors[id])) decl.push(`${v}: color-mix(in srgb, ${themeColors[id]} ${Math.round(100 - see * k)}%, transparent) !important;`);
      const shape = Math.round(clamp(themeLook.round, 0, 2, 0));
      const round = [[4, 8, 12, 20], [6, 12, 18, 28], [0, 0, 0, 0]][shape];
      decl.push(`--radius-xsmall: ${round[0]}px !important; --radius-small: ${round[1]}px !important; --radius-medium: ${round[2]}px !important; --radius-large: ${round[3]}px !important; --routility-round: ${[1, 1.5, 0][shape]};`);
      if (safeColor(themeColors.text)) for (const [v, a] of SHIFT) decl.push(`${v}: color-mix(in srgb, ${themeColors.text} ${a}%, transparent) !important;`);
      for (const [id, n] of OVER_MEDIA) if (safeColor(themeColors[id])) decl.push(`--color-over-media-${n}: color-mix(in srgb, ${themeColors[id]} 92%, transparent) !important;`);
      if (safeColor(navColor)) decl.push('--color-navigation-image: none !important; --dark-mode-navigation-image: none !important; --light-mode-navigation-image: none !important;');
      if (decl.length) {
        css = `:root, body, .dark-theme, .light-theme { ${decl.join(' ')} } body { background-color: var(--color-surface-0) !important; }`;
        if (safeColor(navColor)) css += ` #header.rbx-header, .rbx-header, .left-nav { background-image: none !important; background-color: ${navColor} !important; }`;
        if (safeColor(navColor)) css += ` html.routility-2017, html.routility-2017 :is(body, .light-theme, .dark-theme) { --c17-header: ${navColor} !important; --c17-on-header: ${lightColor(navColor) ? '#191919' : '#ffffff'} !important; --c17-header-icons: ${lightColor(navColor) ? 'brightness(0.2)' : 'none'} !important; }`;
        if (safeColor(navColor)) css += ` html:not(.routility-classic-logo) ${lightColor(navColor) ? '.dark-theme' : '.light-theme'} #header .navbar-brand :is(.icon-logo, .icon-logo-r) { filter: ${lightColor(navColor) ? 'brightness(0.2)' : 'brightness(0) invert(1)'} !important; }`;
        css += ` .section-content:not(.remove-panel) { border-radius: var(--radius-large) !important; }`;
        css += ' [data-testid="text-icon-row-text"] { color: var(--color-content-emphasis) !important; }';
        if (safeColor(themeColors.bg)) {
          const light = lightColor(themeColors.bg);
          const mode = light ? '.dark-theme' : '.light-theme';
          css += ` ${mode} [data-testid="text-icon-row"] .sdui-icon { filter: ${light ? 'brightness(0.2)' : 'brightness(0) invert(1)'} !important; }`;
          css += ` ${mode} :is(.icon-votes-gray, .icon-playing-counts-gray) { filter: ${light ? 'brightness(0.45)' : 'brightness(0) invert(0.7)'} !important; }`;
        }
        css += ` :is(${TILES}) { --color-common-shimmer: ${lightColor(themeColors.card || themeColors.bg) ? '#e4e5e9' : '#2b2d34'} !important; }`;
        css += ' .icon-filled-verified-backplate, .verified-badge-icon, [data-rblx-verified-badge-icon], .routility-verified, .routility-admin-badge, .icon-regular-roblox-plus, .icon-display-name-badge-plus, .routility-logo { --color-system-emphasis: #335fff !important; --color-system-contrast: #f7f7f8 !important; --color-content-emphasis: #f7f7f8 !important; }';
        css += ' :is(.icon-display-name-badge-plus, .routility-name-badges .icon-regular-roblox-plus, .avatar-name-container .icon-regular-roblox-plus, :is(.text-truncate-end, .text-no-wrap, .text-overflow) ~ .icon-regular-roblox-plus, span.inline-flex.shrink-0.gap-xxsmall > .icon-regular-roblox-plus) { color: var(--color-content-default) !important; }';
      }
    }
    if (!css && !themeStyle) return;
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'routility-theme';
    }
    if (themeStyle.textContent !== css) themeStyle.textContent = css;
    if (!themeStyle.isConnected) (document.head || root).appendChild(themeStyle);
    root.classList.toggle('routility-themed', !!css);
    const bg = css ? bgCss(themeColors, themeLook) : '';
    if (!themeBgStyle) {
      if (!bg) return;
      themeBgStyle = document.createElement('style');
      themeBgStyle.id = 'routility-theme-bg';
    }
    if (themeBgStyle.textContent !== bg) themeBgStyle.textContent = bg;
    if (!themeBgStyle.isConnected) themeStyle.after(themeBgStyle);
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
  let forumWatch = null;
  const forumLink = () => {
    if (location.hostname !== 'www.roblox.com' || !root.classList.contains('routility-forum-topbar')) return;
    const place = () => {
      if (document.querySelector('.routility-forum-toplink')) return true;
      const robux = document.getElementById('navigation-robux-container');
      if (!robux) return false;
      const li = document.createElement('li');
      li.className = 'routility-injected routility-forum-toplink';
      const a = document.createElement('a');
      a.className = 'font-header-2 nav-menu-title text-header';
      a.href = 'https://www.roblox.com/forum';
      a.textContent = lt('Forum');
      li.appendChild(a);
      robux.after(li);
      return true;
    };
    if (place() || forumWatch) return;
    forumWatch = new MutationObserver(() => {
      if (!place()) return;
      forumWatch.disconnect();
      forumWatch = null;
    });
    forumWatch.observe(root, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { forumWatch?.disconnect(); forumWatch = null; }, { once: true });
  };
  const applyCollapse = () => root.classList.toggle('routility-nav-collapsed', navCollapsed && (lastSettings || {}).navCollapse !== false);
  const EARLY = 'routilityEarly';
  const EARLY_KEYS = ['routilitySettings', 'routilityNavLayout', 'routilityNavCollapsed', 'routilityTheme', 'routilityFiatRates'];
  let early = null;
  try { early = JSON.parse(localStorage.getItem(EARLY)); } catch {}
  const remember = (patch) => {
    early = Object.assign({}, early, patch);
    try { localStorage.setItem(EARLY, JSON.stringify(early)); } catch {}
  };
  const oldNav = () => {
    const on = (lastSettings || {}).oldLeftNav === true || (lastSettings || {}).classicSite === true;
    root.classList.toggle('routility-old-nav', on);
    try {
      const flipped = localStorage.getItem('routilityNavFlipped') === '1';
      if (!on && !flipped) return;
      const cache = JSON.parse(localStorage.getItem('new-left-nav') || 'null');
      if (!cache || !cache.data || typeof cache.data !== 'object') return;
      let changed = false;
      for (const id of Object.keys(cache.data)) {
        if (cache.data[id] === !on) continue;
        cache.data[id] = !on;
        changed = true;
      }
      if (changed) localStorage.setItem('new-left-nav', JSON.stringify(cache));
      if (on && changed) localStorage.setItem('routilityNavFlipped', '1');
      if (!on) localStorage.removeItem('routilityNavFlipped');
    } catch {}
  };
  const PLUS_THEMES = ['nebula-drift', 'nitro-frost', 'circuit-rush', 'kinetic-energy', 'inferno-blast', 'hyper-plum', 'quantum-pulse', 'cosmic-dust', 'polar-freeze', 'super-charge', 'electric-lime', 'lava-glow', 'star-burst', 'pixel-pop', 'classic'];
  let plusMine = '';
  let plusTheirs = '';
  let plusWatch = null;
  const plusTheme = () => {
    const s = lastSettings || {};
    const want = !s.customTheme && PLUS_THEMES.includes(s.plusTheme) ? s.plusTheme : '';
    const body = document.body;
    if (!body) {
      if (want && !plusWatch) {
        plusWatch = new MutationObserver(() => { if (document.body) { plusWatch.disconnect(); plusWatch = null; plusTheme(); } });
        plusWatch.observe(document.documentElement, { childList: true });
      }
      return;
    }
    if (!want && !plusMine) return;
    const cls = body.classList;
    if (plusMine && plusMine !== want) cls.remove('theme-' + plusMine, plusMine + '-theme');
    if (want) {
      for (const k of PLUS_THEMES) if (k !== want && cls.contains('theme-' + k)) {
        if (k !== plusMine) plusTheirs = k;
        cls.remove('theme-' + k, k + '-theme');
      }
      if (!cls.contains('theme-' + want)) cls.add('theme-' + want, want + '-theme');
    } else if (plusTheirs) {
      cls.add('theme-' + plusTheirs, plusTheirs + '-theme');
      plusTheirs = '';
    }
    plusMine = want;
    if (want && !body.routilityPlusWatch) {
      body.routilityPlusWatch = true;
      new MutationObserver(() => { if (plusMine && (!body.classList.contains('theme-' + plusMine) || PLUS_THEMES.some(k => k !== plusMine && body.classList.contains('theme-' + k)))) plusTheme(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
    }
  };
  const boot = (s) => {
    lastSettings = s.routilitySettings || {};
    classicSite();
    oldNav();
    plusTheme();
    watchRobloxOnly();
    themeOn = !!lastSettings.customTheme;
    themeColors = (s.routilityTheme && s.routilityTheme.colors) || {};
    themeFx = (s.routilityTheme && typeof s.routilityTheme.fx === 'string') ? s.routilityTheme.fx : '';
    themeLook = s.routilityTheme || {};
    needImage();
    applyTheme();
    navCollapsed = !!s.routilityNavCollapsed;
    apply(s.routilitySettings);
    applyNav(s.routilityNavLayout);
    applyCollapse();
    forumLink();
  };
  if (early && typeof early === 'object') boot(early);
  chrome.storage.local.get(EARLY_KEYS, (s) => {
    remember(Object.fromEntries(EARLY_KEYS.map(k => [k, s[k]])));
    boot(s);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && EARLY_KEYS.some(k => changes[k])) remember(Object.fromEntries(EARLY_KEYS.filter(k => changes[k]).map(k => [k, changes[k].newValue])));
    if (area === 'local' && changes.routilitySettings) { lastSettings = changes.routilitySettings.newValue || {}; classicSite(); oldNav(); plusTheme(); apply(changes.routilitySettings.newValue); applyNav(navLayout); applyCollapse(); watchRobloxOnly(); themeOn = !!lastSettings.customTheme; needImage(); applyTheme(); }
    if (area === 'local' && changes.routilityTheme) { const t = changes.routilityTheme.newValue || {}; themeColors = t.colors || {}; themeFx = typeof t.fx === 'string' ? t.fx : ''; themeLook = t; needImage(); applyTheme(); }
    if (area === 'local' && changes.routilityFont) { fontAsked = true; useFont(changes.routilityFont.newValue); }
    if (area === 'local' && changes.routilityThemeImage) { themeImage = IMAGE.test(changes.routilityThemeImage.newValue) ? changes.routilityThemeImage.newValue : ''; imageAsked = true; applyTheme(); }
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
