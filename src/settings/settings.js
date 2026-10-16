(function () {
  'use strict';

  if (location.pathname !== '/my/account') return;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  let langReady = false;

  const DEFAULTS = { contextCopy: true, skinWheel: true, buyBalance: true, messageTools: true, quickSettings: true, qsJoins: true, qsOnline: true, qsRotator: true, qsStreamer: false, keepR6: false, itemPrices: true, usdChart: true, owners: true, inventoryValues: true, tradeValues: true, marketplaceValues: true, resellerDeals: true, classicProfile: true, classicLayout: 'tabs', hiddenFriends: true, revealTerminated: true, friendCardMenu: true, searchTerminated: true, mutualFriends: true, inventorySearch: true, listOrder: true, richSearch: true, searchPeople: true, searchFriends: true, searchGames: true, searchItems: true, searchSlash: true, skeletonLoading: true, hoverTips: true, hideSponsored: true, avatarSearch: true, avatarWearing: true, avatarWearingValues: true, avatarMoreAccessories: true, hideMakeup: true, badgeProgress: true, gameStats: true, profilePreviews: true, avatarRig: true, thumbCustomize: true, avatarSticky: true, tradeOwnership: true, tradeAge: true, exactRobux: false, badgeStats: true, privateServerToggle: true, streamerMode: false, streamerRobux: true, streamerAccount: true, streamerPayment: true, streamerName: false, streamerAvatar: false, streamerValues: false, menuLink: true, avatarRemember: true, tradeCalculator: true, itemHoardStats: true, itemTags: true, calcLinks: true, tradeFilter: true, tradeSort: true, tradeCleanup: true, tradeKeys: true, randomGame: true, tradeItemCard: true, itemCardEverywhere: true, itemSimilar: true, tradePreview: true, tradeProof: true, tradeWarning: true, tradeWarnAt: '15', tradeSendSummary: true, calcNav: true, tradeAds: true, tradeAdsNav: true, calcRemember: true, calcEven: true, calcPercents: true, calcVerdict: 'usd', calcRobux: 'devex', calcRobuxRap: true, plusDetails: true, transferLimits: true, sessionIps: true, backupCodeDate: true, voiceStatus: true, groupCreated: true, groupJoined: true, groupCount: true, gameAvatarType: true, createSafety: true, gameUnavailable: true, oldLeftNav: false, calcRate: '3.80', currency: 'USD', robuxUsd: true, friendsPlaying: true, notInterested: true, homeLayout: true, siteFont: 'default', navVerified: true, rollSounds: true, serverStats: true, serverRegions: true, preferredRegion: '', launchDetails: true, storeTotal: true, exactCounts: true, mutualGroups: true, hideChat: false, calcSort: 'usd-desc', calcSlots: '4', calcShot: 'preview', forum: true, forumTopLink: true, forumNav: true, homeGreeting: true, playtime: true, language: 'auto', adminBadge: true, friendFilters: true, friendManage: true, unfriendDetector: true, cancelRequests: true, ownedSince: true, badgeDates: true, itemAcquired: true, friendsOwn: true, itemExplorer: true, gearFix: true, avatarPreview: true, tryOnKeepWorn: true, funOutfits: true, requestFilters: true, createScanner: true, createIds: true, createDevItems: true, createUsd: true, groupFriends: true, groupDetails: true, groupManage: true, groupAdmin: true, forumStyle: 'modern', forumDensity: 'comfortable', forumAvatars: 'full', forumStatJoined: true, forumStatPosts: true, forumStatRap: true, forumStatValue: true, forumStatGroup: true, txUsd: true, txExport: true, txFilters: true, badgeTools: true, badgeManage: true, badgeAutoDelete: false, exactPrices: true, recentlyUpdated: true, genreFilters: true, stopTrailers: true, placeVisits: true, avoidFriends: false, notifyInbound: true, notifyOutbound: true, notifyCompleted: true, notifyDeclined: true, notifyLimiteds: true, notifyUgc: false, priceAlerts: true, statusBanner: true, purchaseLock: true, purchaseLockAt: '1000', groupFullDesc: true, groupFind: true, chatBot: true, chatResize: true, navCollapse: true, badgeSizeFix: true, scrollbarFix: true, scrollbarStyle: 'floating', customTheme: false, plusTheme: '', groupHiddenGames: true, userOutfits: true, creatorItems: true, classicFaceThumbs: true, itemSize: true, lastOnSale: true, classicNames: false, classicGames: true, classicCatalog: true, classicDevelop: true, classicGroups: true, classicPackages: true, devProducts: true, playRegionTag: true, studioStatus: false, catalogRobloxOnly: false, skipR6Warning: false, accessoryAdjust: true, outfitRotator: true, classicLogo: false, classicPremium: false, classicVerified: false, fakeRobux: false, fakeRobuxAmount: '1000000', fakeRobuxMode: 'amount', fakeBuy: false, itemUsd: true, itemDemand: true, itemTrend: true, itemCopies: true, itemChange: true, itemOwnedRow: true, friendsSince: true, fakeRequests: false, fakeRequestsAdd: 'amount', fakeRequestsAmount: '500', sendRobux: true, menuHighlight: 'fill' };
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

  const TABS = [
    { key: 'info', hash: '#!/routility', label: LT('About'), title: 'RoUtility' },
    { key: 'whatsnew', hash: '#!/routility/whatsnew', label: LT('What’s New'), title: LT('What’s New') },
    { key: 'browsing', hash: '#!/routility/browsing', label: LT('General'), title: LT('General'), section: LT('Browsing') },
    { key: 'search', hash: '#!/routility/search', label: LT('Search'), title: LT('Search'), section: LT('Browsing') },
    { key: 'notifications', hash: '#!/routility/notifications', label: LT('Notifications'), title: LT('Notifications'), section: LT('Browsing') },
    { key: 'chat', hash: '#!/routility/chat', label: LT('Chat & Messages'), title: LT('Chat & Messages'), section: LT('Browsing') },
    { key: 'streamer', hash: '#!/routility/streamer', label: LT('Streamer Mode'), title: LT('Streamer Mode'), section: LT('Browsing') },
    { key: 'themes', hash: '#!/routility/themes', label: LT('Themes'), title: LT('Themes'), section: LT('Appearance') },
    { key: 'classic', hash: '#!/routility/classic', label: LT('Classic Roblox'), title: LT('Classic Roblox'), section: LT('Appearance') },
    { key: 'menu', hash: '#!/routility/menu', label: LT('Sidebar'), title: LT('Sidebar'), section: LT('Appearance') },
    { key: 'fun', hash: '#!/routility/fun', label: LT('Fun'), title: LT('Fun'), section: LT('Appearance') },
    { key: 'profiles', hash: '#!/routility/profiles', label: LT('Profiles'), title: LT('Profiles'), section: LT('Social') },
    { key: 'friends', hash: '#!/routility/friends', label: LT('Friends'), title: LT('Friends'), section: LT('Social') },
    { key: 'communities', hash: '#!/routility/communities', label: LT('Communities'), title: LT('Communities'), section: LT('Social') },
    { key: 'forum', hash: '#!/routility/forum', label: LT('Forum'), title: LT('Forum'), section: LT('Social') },
    { key: 'home', hash: '#!/routility/home', label: LT('Home & Charts'), title: LT('Home & Charts'), section: LT('Games') },
    { key: 'games', hash: '#!/routility/games', label: LT('Games & Servers'), title: LT('Games & Servers'), section: LT('Games') },
    { key: 'badges', hash: '#!/routility/badges', label: LT('Badges'), title: LT('Badges'), section: LT('Games') },
    { key: 'create', hash: '#!/routility/create', label: LT('Creator Hub'), title: LT('Creator Hub'), section: LT('Games') },
    { key: 'items', hash: '#!/routility/items', label: LT('Items'), title: LT('Items'), section: LT('Marketplace') },
    { key: 'inventory', hash: '#!/routility/inventory', label: LT('Inventory'), title: LT('Inventory'), section: LT('Marketplace') },
    { key: 'avatar', hash: '#!/routility/avatar', label: LT('Avatar Editor'), title: LT('Avatar Editor'), section: LT('Marketplace') },
    { key: 'trading', hash: '#!/routility/trading', label: LT('Trading'), title: LT('Trading'), section: LT('Marketplace') },
    { key: 'calculator', hash: '#!/routility/calculator', label: LT('Trade Calculator'), title: LT('Trade Calculator'), section: LT('Marketplace') },
    { key: 'account', hash: '#!/routility/account', label: LT('Account & Security'), title: LT('Account & Security'), section: LT('Account') },
    { key: 'robux', hash: '#!/routility/robux', label: LT('Robux & Transactions'), title: LT('Robux & Transactions'), section: LT('Account') },
  ];
  const isOurs = (hash) => TABS.some(t => t.hash === hash);
  let open = isOurs(location.hash) ? location.hash : null;
  let lastNativeHash = !open && location.hash.startsWith('#!/') ? location.hash : '#!/info';
  let pane = null;
  let booting = open;
  let settleTimer = 0;
  let userNav = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stateLayer() {
    const d = el('div', STATE_LAYER);
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return lt('just now');
    const m = Math.round(s / 60);
    if (m < 60) return ltn(m, '{n} minute ago', '{n} minutes ago');
    const h = Math.round(m / 60);
    return ltn(h, '{n} hour ago', '{n} hours ago');
  }

  function row(title, description, control, compact) {
    const section = el('section', 'flex items-center gap-large');
    const text = el('div', 'routility-set-text fill basis-0 flex flex-col gap-xsmall');
    text.appendChild(el('h3', 'text-title-large content-emphasis padding-none', title));
    const p = el('p', 'text-body-small content-muted margin-none', description);
    text.appendChild(p);
    const side = el('div', compact ? 'flex shrink-0' : 'flex flex-col gap-small fill basis-0');
    side.appendChild(control);
    section.appendChild(text);
    section.appendChild(side);
    section.description = p;
    return section;
  }

  function toggle(label, checked, onChange) {
    const wrap = el('label', 'foundation-web-toggle flex items-start gap-medium cursor-pointer flex-row-reverse');
    const btn = el('button', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer grow-0 shrink-0 basis-auto flex items-center padding-xxsmall stroke-none radius-circle transition-colors width-1000 height-600 group/toggle data-[state=unchecked]:bg-action-standard data-[state=checked]:bg-system-contrast');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('data-slot', 'toggle');
    btn.setAttribute('aria-label', label);
    btn.appendChild(stateLayer());
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:size-0 group-data-[state=checked]/toggle:fill'));
    const knob = el('span', 'transition-colors radius-circle flex justify-center items-center size-500 data-[state=unchecked]:bg-[var(--color-content-emphasis)] data-[state=checked]:bg-[var(--inverse-content-emphasis)]');
    knob.appendChild(el('span', 'icon icon-filled-check transition-opacity size-500 group-data-[state=unchecked]/toggle:opacity-[0] group-data-[state=checked]/toggle:opacity-[1] group-data-[state=checked]/toggle:[transition-delay:50ms]'));
    btn.appendChild(knob);
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:fill group-data-[state=checked]/toggle:size-0'));

    const set = (on) => {
      const s = on ? 'checked' : 'unchecked';
      btn.setAttribute('aria-checked', String(on));
      btn.setAttribute('data-state', s);
      btn.value = on ? 'on' : 'off';
      knob.setAttribute('data-state', s);
    };
    set(checked);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const on = btn.getAttribute('aria-checked') !== 'true';
      set(on);
      onChange(on);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function select(label, options, value, onChange) {
    const wrap = el('div', 'relative');
    const btn = el('button', 'relative clip group/interactable outline-none foundation-web-input flex items-center justify-between width-full cursor-pointer bg-none stroke-standard radius-medium height-1200 padding-x-large text-body-large stroke-contrast-alpha focus-within:stroke-system-emphasis content-default');
    btn.type = 'button';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', label);
    btn.appendChild(stateLayer());
    const textWrap = el('div', 'grow-1 text-truncate-split text-align-x-left');
    const inner = el('span');
    inner.style.pointerEvents = 'none';
    const current = el('span', 'foundation-web-menu-item-title text-no-wrap text-truncate-split content-emphasis');
    inner.appendChild(current);
    textWrap.appendChild(inner);
    btn.appendChild(textWrap);
    const chevron = el('span', 'size-600 icon icon-regular-chevron-large-down content-default');
    chevron.setAttribute('aria-hidden', 'true');
    btn.appendChild(chevron);
    wrap.appendChild(btn);

    let selected = value;
    let popover = null;
    const flagImg = (src) => {
      const img = el('img', 'routility-flag');
      img.src = src;
      img.alt = '';
      return img;
    };
    const show = () => {
      const opt = options.find(o => o.value === selected);
      current.textContent = opt.label;
      inner.querySelector('.routility-flag')?.remove();
      if (opt.icon) inner.prepend(flagImg(opt.icon));
    };
    inner.classList.add('routility-select-current');
    show();

    const close = () => {
      if (!popover) return;
      popover.remove();
      popover = null;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', esc, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
    const place = () => {
      if (!popover) return;
      const r = btn.getBoundingClientRect();
      popover.style.cssText = `position: fixed; left: ${r.left}px; top: ${r.bottom + 4}px; width: ${r.width}px; z-index: 1050;`;
    };
    const outside = (e) => { if (!popover.contains(e.target) && !btn.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = (e) => {
      if (!popover || (e.target instanceof Node && popover.contains(e.target))) return;
      const r = btn.getBoundingClientRect();
      if (!btn.isConnected || r.bottom < 0 || r.top > innerHeight) return close();
      place();
    };

    btn.addEventListener('click', () => {
      if (popover) return close();
      popover = el('div', 'routility-popover');
      place();
      const list = el('div', 'padding-y-small foundation-web-portal-zindex');
      list.setAttribute('role', 'listbox');
      const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large' + (options.length > 8 ? ' routility-select-long' : ''));
      const group = el('div', 'padding-small');
      group.setAttribute('role', 'group');
      for (const opt of options) {
        const item = el('button', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none foundation-web-menu-item flex items-center content-default text-truncate-split focus-visible:hover:outline-none cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-large padding-x-large padding-y-medium gap-x-large radius-medium');
        item.type = 'button';
        item.setAttribute('aria-selected', String(opt.value === selected));
        item.setAttribute('data-state', opt.value === selected ? 'checked' : 'unchecked');
        item.appendChild(stateLayer());
        if (opt.icon) item.appendChild(flagImg(opt.icon));
        const t = el('div', 'grow-1 text-truncate-split flex flex-col gap-y-xsmall');
        t.appendChild(el('span', 'foundation-web-menu-item-title text-no-wrap text-truncate-split content-emphasis', opt.label));
        item.appendChild(t);
        item.addEventListener('click', () => {
          selected = opt.value;
          show();
          close();
          onChange(opt.value);
        });
        group.appendChild(item);
      }
      menu.appendChild(group);
      list.appendChild(menu);
      popover.appendChild(list);
      document.body.appendChild(popover);
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', place);
    });
    return wrap;
  }

  function button(label, onClick) {
    const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium bg-action-standard content-action-standard');
    btn.type = 'button';
    btn.appendChild(stateLayer());
    const outer = el('span', 'flex items-center min-width-0 gap-small');
    const text = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    outer.appendChild(text);
    btn.appendChild(outer);
    btn.addEventListener('click', () => onClick(btn, text));
    return btn;
  }

  function twin(btn, other) {
    const outer = btn.querySelector(':scope > span.flex');
    if (!outer) return btn;
    const ghost = el('span', 'padding-y-xsmall text-no-wrap routility-twin-ghost', other);
    ghost.setAttribute('aria-hidden', 'true');
    outer.classList.add('routility-twin');
    outer.appendChild(ghost);
    return btn;
  }

  function header(text, intro) {
    const head = el('div', 'settings-v2-header routility-set-head');
    head.appendChild(el('h2', 'text-heading-medium content-emphasis margin-none', text));
    if (intro) head.appendChild(el('p', 'text-body-medium content-muted margin-none routility-set-intro', intro));
    return head;
  }

  function h(tag, cls, kids, style) {
    const n = el(tag, cls);
    if (typeof kids === 'string') n.textContent = kids;
    else if (kids) for (const k of kids) if (k) n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    if (style) Object.assign(n.style, style);
    return n;
  }

  const around = (str, key, node) => {
    const [a, b] = str.split(key);
    return [a, node, b || ''];
  };

  const SVG = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="M9 3.5v17M12.5 9h5M12.5 13h5"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.9-4 3.8-6 7.5-6s6.6 2 7.5 6"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14.5c2 .4 3.4 2 4 4.5"/></svg>',
    avatar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="2.5" width="8" height="7" rx="1.5"/><path d="M6 11.5h12v6H6zM8 17.5v4M16 17.5v4"/></svg>',
    game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1" fill="currentColor"/><circle cx="17.5" cy="13.5" r="1" fill="currentColor"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/></svg>',
    forum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M17 8h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-4a2 2 0 0 1-2-2v-1"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    create: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5l4 4"/><path d="M4 20l9.5-9.5"/><path d="M12.5 3.5l3-1 6 6-1 3-3 1-6-6z"/><path d="M3 21l2-2"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 4.5Q11 12 18.5 13Q11 14 10 21.5Q9 14 1.5 13Q9 12 10 4.5Z"/><path d="M18.5 2.5Q19 5 21.5 5.5Q19 6 18.5 8.5Q18 6 15.5 5.5Q18 5 18.5 2.5Z"/></svg>',
  };

  const CAT_SVG = {
    themes: '<svg viewBox="0 0 24 24"><path d="M12 2.8c-5.2 0-9.4 3.9-9.4 8.9 0 4.6 3.7 8.7 8.2 8.7 1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.9-1.8h2.2c2.9 0 5.3-2.3 5.3-5.2 0-3.9-4-6.1-9.2-6.1z" fill="currentColor"/><circle cx="7.4" cy="11.2" r="1.5" fill="var(--rt-cat-cut)"/><circle cx="10.2" cy="7.2" r="1.5" fill="var(--rt-cat-cut)"/><circle cx="14.8" cy="7.2" r="1.5" fill="var(--rt-cat-cut)"/><circle cx="17.6" cy="11" r="1.5" fill="var(--rt-cat-cut)"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M5.2 3.6h13.6c1.5 0 2.6 1.1 2.6 2.6v8.4c0 1.5-1.1 2.6-2.6 2.6h-6.6l-4.6 3.6c-.6.5-1.4 0-1.4-.7v-2.9h-1c-1.5 0-2.6-1.1-2.6-2.6V6.2c0-1.5 1.1-2.6 2.6-2.6z" fill="currentColor"/><circle cx="8.2" cy="10.4" r="1.4" fill="var(--rt-cat-cut)"/><circle cx="12" cy="10.4" r="1.4" fill="var(--rt-cat-cut)"/><circle cx="15.8" cy="10.4" r="1.4" fill="var(--rt-cat-cut)"/></svg>',
    streamer: '<svg viewBox="0 0 24 24"><path d="M12 5.2c-5 0-8.6 4.2-9.8 6-.3.5-.3 1.1 0 1.6 1.2 1.8 4.8 6 9.8 6s8.6-4.2 9.8-6c.3-.5.3-1.1 0-1.6-1.2-1.8-4.8-6-9.8-6z" fill="currentColor"/><circle cx="12" cy="12" r="3.6" fill="var(--rt-cat-cut)"/><path d="M4 20.4 20.4 4" stroke="var(--rt-cat-cut)" stroke-width="4.4" stroke-linecap="round"/><path d="M4 20.4 20.4 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    robux: '<svg viewBox="0 0 23.5 24"><path d="M19.78 4.897A4.369 4.369 0 0122 8.69v6.62a4.37 4.37 0 01-2.22 3.792l-5.812 3.311a4.487 4.487 0 01-4.437 0l-5.813-3.31A4.37 4.37 0 011.5 15.31V8.69c0-1.565.846-3.011 2.218-3.793l5.813-3.31a4.487 4.487 0 014.437 0l5.813 3.31zM10.31 3.09L4.648 6.313a2.836 2.836 0 00-1.44 2.463v6.448c0 1.015.548 1.954 1.44 2.463l5.66 3.223c.892.508 1.99.508 2.882 0l5.66-3.223a2.838 2.838 0 001.442-2.463V8.776c0-1.017-.55-1.955-1.441-2.463L13.19 3.09a2.914 2.914 0 00-2.882 0zm2.624 1.801l4.466 2.543a2.33 2.33 0 011.184 2.024v5.087a2.33 2.33 0 01-1.184 2.023l-4.466 2.544a2.394 2.394 0 01-2.367 0L6.1 16.568a2.33 2.33 0 01-1.183-2.023V9.458c0-.835.451-1.606 1.183-2.024l4.466-2.543a2.394 2.394 0 012.367 0zM9.188 14.53h5.124V9.473H9.189v5.057z" fill="currentColor" fill-rule="evenodd"/></svg>',
    badges: '<svg viewBox="0 0 24 24"><path d="M7.4 13.6 5 21.2c-.2.6.4 1.1 1 .9l3-1.2 1.8 2.6c.4.5 1.2.4 1.4-.2l1.2-4z" fill="currentColor" opacity="0.6"/><path d="M16.6 13.6l2.4 7.6c.2.6-.4 1.1-1 .9l-3-1.2-1.8 2.6c-.4.5-1.2.4-1.4-.2l-1.2-4z" fill="currentColor" opacity="0.6"/><circle cx="12" cy="9.4" r="7" fill="currentColor"/><path d="M12 5.6l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="var(--rt-cat-cut)"/></svg>',
    classic: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4zM11 7v5.6l4.2 2.5 1-1.6-3.2-1.9V7z" fill="currentColor"/></svg>',
    account: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2.4 4.6 5.3c-.6.2-1 .8-1 1.4v4.7c0 4.6 3.2 8.6 7.8 9.9.4.1.8.1 1.2 0 4.6-1.3 7.8-5.3 7.8-9.9V6.7c0-.6-.4-1.2-1-1.4zm-1.1 12.4-3-3 1.4-1.4 1.6 1.6 4.2-4.2 1.4 1.4z" fill="currentColor"/></svg>',
    inventory: '<svg viewBox="0 0 24 24"><path d="M9 6.8V5.2c0-1 .8-1.8 1.8-1.8h2.4c1 0 1.8.8 1.8 1.8v1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill-rule="evenodd" d="M7 6.8h10a3.4 3.4 0 0 1 3.4 3.4v8.4c0 1.3-1.1 2.4-2.4 2.4H6c-1.3 0-2.4-1.1-2.4-2.4v-8.4A3.4 3.4 0 0 1 7 6.8zm2 6.2v1.8h6V13z" fill="currentColor"/></svg>',
    browsing: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6.2" width="17" height="4" rx="2" fill="currentColor" opacity="0.55"/><circle cx="15.5" cy="8.2" r="3.3" fill="currentColor"/><rect x="3.5" y="13.8" width="17" height="4" rx="2" fill="currentColor" opacity="0.55"/><circle cx="8.5" cy="15.8" r="3.3" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 15l4.6 4.6" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3.2" fill="currentColor"/><rect x="10" y="7" width="8" height="2.2" rx="1.1" fill="var(--rt-cat-cut)"/><rect x="10" y="11" width="8" height="2.2" rx="1.1" fill="var(--rt-cat-cut)"/><rect x="10" y="15" width="5.5" height="2.2" rx="1.1" fill="var(--rt-cat-cut)"/><rect x="5.6" y="6.6" width="2.2" height="10.8" rx="1.1" fill="var(--rt-cat-cut)"/></svg>',
    notifications: '<svg viewBox="0 0 24 24"><path d="M12 3.2c-3.6 0-6 2.7-6 6.2v3.6L4.4 16c-.4.8.1 1.6 1 1.6h13.2c.9 0 1.4-.8 1-1.6L18 13V9.4c0-3.5-2.4-6.2-6-6.2z" fill="currentColor"/><path d="M9.4 19.2a2.7 2.7 0 0 0 5.2 0z" fill="currentColor"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M12 3.4 3 10.6c-.6.5-.2 1.4.5 1.4H5v7.2c0 .7.5 1.2 1.2 1.2h11.6c.7 0 1.2-.5 1.2-1.2V12h1.5c.7 0 1.1-.9.5-1.4z" fill="currentColor"/><rect x="10" y="14" width="4" height="6.4" rx="1" fill="var(--rt-cat-cut)"/></svg>',
    profiles: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="4.3" fill="currentColor"/><path d="M4 20.2c0-4.2 3.6-6.8 8-6.8s8 2.6 8 6.8z" fill="currentColor"/></svg>',
    friends: '<svg viewBox="0 0 24 24"><circle cx="15.6" cy="8.4" r="3.4" fill="currentColor" opacity="0.6"/><path d="M12.6 19.8c.4-3.4 1.6-5.6 4.4-5.6 2.6 0 4.6 2 4.6 5.6z" fill="currentColor" opacity="0.6"/><circle cx="8.8" cy="8" r="3.9" fill="currentColor"/><path d="M2.4 20.2c0-3.9 2.9-6.2 6.4-6.2s6.4 2.3 6.4 6.2z" fill="currentColor"/></svg>',
    games: '<svg viewBox="0 0 24 24"><path d="M7.6 6.6h8.8c2.6 0 4.1 1.6 4.6 4l.9 5.1c.5 2.6-2.3 4-4 2l-1.8-2H7.9l-1.8 2c-1.7 2-4.5.6-4-2l.9-5.1c.5-2.4 2-4 4.6-4z" fill="currentColor"/><path d="M7.8 9.4v4.2M5.7 11.5h4.2" stroke="var(--rt-cat-cut)" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="10.3" r="1.2" fill="var(--rt-cat-cut)"/><circle cx="18" cy="12.5" r="1.2" fill="var(--rt-cat-cut)"/></svg>',
    avatar: '<svg viewBox="0 0 24 24"><rect x="8.6" y="2.6" width="6.8" height="5.8" rx="1.4" fill="currentColor"/><rect x="7.6" y="9.2" width="8.8" height="6.4" rx="1" fill="currentColor"/><rect x="3.8" y="9.2" width="3.2" height="6.4" rx="1" fill="currentColor" opacity="0.7"/><rect x="17" y="9.2" width="3.2" height="6.4" rx="1" fill="currentColor" opacity="0.7"/><rect x="7.6" y="16.2" width="4.1" height="5.2" rx="1" fill="currentColor" opacity="0.85"/><rect x="12.3" y="16.2" width="4.1" height="5.2" rx="1" fill="currentColor" opacity="0.85"/></svg>',
    items: '<svg viewBox="0 0 24 24"><path d="M7.4 5.2c0-.8.6-1.4 1.4-1.4h6.4c.8 0 1.4.6 1.4 1.4v9.8H7.4z" fill="currentColor"/><rect x="7.4" y="12" width="9.2" height="2.6" fill="var(--rt-cat-cut)"/><path d="M2.6 16.4c0-.8.7-1.4 1.6-1.4h15.6c.9 0 1.6.6 1.6 1.4 0 2-3.6 3.6-9.4 3.6S2.6 18.4 2.6 16.4z" fill="currentColor"/></svg>',
    trading: '<svg viewBox="0 0 24 24"><path d="M4 8.5h13.5M14 4.6l3.9 3.9L14 12.4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 15.5H6.5M10 11.6l-3.9 3.9 3.9 3.9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg>',
    calculator: '<svg viewBox="0 0 24 24"><rect x="4.6" y="2.6" width="14.8" height="18.8" rx="3" fill="currentColor"/><rect x="7.2" y="5.2" width="9.6" height="3.8" rx="1" fill="var(--rt-cat-cut)"/><g fill="var(--rt-cat-cut)"><circle cx="8.4" cy="12.4" r="1.25"/><circle cx="12" cy="12.4" r="1.25"/><circle cx="15.6" cy="12.4" r="1.25"/><circle cx="8.4" cy="16.4" r="1.25"/><circle cx="12" cy="16.4" r="1.25"/><circle cx="15.6" cy="16.4" r="1.25"/></g></svg>',
    communities: '<svg viewBox="0 0 24 24"><circle cx="5.6" cy="9.4" r="2.6" fill="currentColor" opacity="0.6"/><circle cx="18.4" cy="9.4" r="2.6" fill="currentColor" opacity="0.6"/><path d="M1.6 18.6c.2-2.8 1.7-4.4 4-4.4 1.4 0 2.4.5 3 1.4M22.4 18.6c-.2-2.8-1.7-4.4-4-4.4-1.4 0-2.4.5-3 1.4" fill="currentColor" opacity="0.6"/><circle cx="12" cy="8" r="3.6" fill="currentColor"/><path d="M5.8 20.2c0-3.8 2.7-6.2 6.2-6.2s6.2 2.4 6.2 6.2z" fill="currentColor"/></svg>',
    forum: '<svg viewBox="0 0 24 24"><path d="M9.6 9.8h9.6c1.2 0 2.2 1 2.2 2.2v5c0 1.2-1 2.2-2.2 2.2h-.8v2.4l-3-2.4H9.6c-1.2 0-2.2-1-2.2-2.2v-5c0-1.2 1-2.2 2.2-2.2z" fill="currentColor" opacity="0.6"/><path d="M4.8 3.2h10c1.3 0 2.4 1.1 2.4 2.4v5.4c0 1.3-1.1 2.4-2.4 2.4H8.6l-3.4 2.7v-2.7h-.4c-1.3 0-2.4-1.1-2.4-2.4V5.6c0-1.3 1.1-2.4 2.4-2.4z" fill="currentColor"/><rect x="5.6" y="6.6" width="8.4" height="1.8" rx="0.9" fill="var(--rt-cat-cut)"/><rect x="5.6" y="9.6" width="5.4" height="1.8" rx="0.9" fill="var(--rt-cat-cut)"/></svg>',
    create: '<svg viewBox="0 0 24 24"><path d="M12 2.8 20.4 7.4 12 12 3.6 7.4z" fill="currentColor"/><path d="M3.6 8.6 11.4 12.9v8.6L3.6 17.1z" fill="currentColor" opacity="0.72"/><path d="M20.4 8.6 12.6 12.9v8.6l7.8-4.4z" fill="currentColor" opacity="0.48"/></svg>',
    fun: '<svg viewBox="0 0 24 24"><path d="M10 4.2Q11.2 11.8 18.8 13Q11.2 14.2 10 21.8Q8.8 14.2 1.2 13Q8.8 11.8 10 4.2Z" fill="currentColor"/><path d="M18.6 1.8Q19.2 4.8 22.2 5.4Q19.2 6 18.6 9Q18 6 15 5.4Q18 4.8 18.6 1.8Z" fill="currentColor" opacity="0.6"/><circle cx="4.6" cy="5" r="1.4" fill="currentColor" opacity="0.6"/></svg>',
  };

  const GROUP_ICONS = { Browsing: 'magnifying-glass', Appearance: 'paint-brush', Social: 'two-people', Games: 'controller', Marketplace: 'building-store', Account: 'shield-check' };

  function icon(name, cls) {
    const s = el('span', 'routility-set-svg ' + (cls || ''));
    s.innerHTML = SVG[name];
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  const LOGO = chrome.runtime.getURL('assets/icons/logo.png');
  const BOT_PIC = chrome.runtime.getURL('assets/icons/bot.png');
  const botFace = () => { const i = el('img', 'rt-m-botface'); i.src = BOT_PIC; i.alt = ''; return i; };
  const line = (w, cls) => h('span', 'rt-m-line' + (cls ? ' ' + cls : ''), null, { width: w + 'px' });
  const logoImg = () => {
    const i = el('img', 'rt-m-logo');
    i.src = LOGO;
    i.alt = '';
    return i;
  };
  const usd = (t, cls) => h('span', 'rt-m-usd' + (cls ? ' ' + cls : ''), [logoImg(), t]);
  const rb = (t, cls) => h('span', 'rt-m-rb' + (cls ? ' ' + cls : ''), [el('span', 'icon-robux-16x16 rt-m-robux'), t]);
  const pill = (t, kind) => h('span', 'rt-m-pill' + (kind ? ' rt-m-' + kind : ''), t);
  const circle = (size, cls) => h('span', 'rt-m-circle' + (cls ? ' ' + cls : ''), null, { width: size + 'px', height: size + 'px' });
  const tile = (size, kids, cls) => h('span', 'rt-m-tile' + (cls ? ' ' + cls : ''), kids, { width: size + 'px', height: size + 'px' });
  const r = (kids, cls) => h('div', 'rt-m-row' + (cls ? ' ' + cls : ''), kids);
  const c = (kids, cls) => h('div', 'rt-m-col' + (cls ? ' ' + cls : ''), kids);
  const strong = (t) => h('span', 'rt-m-strong', t);
  const muted = (t) => h('span', 'rt-m-muted', t);
  const field = (t, focus) => h('div', 'rt-m-field' + (focus ? ' rt-m-focus' : ''), [icon('search', 'rt-m-glass'), h('span', null, t)]);
  const verified = () => icon('check', 'rt-m-verified');
  const U = { roblox: '1', cv: '73072929', linkmon: '2207291', builderman: '156', shedletsky: '261', luke: '80254', telamon: '13645', merely: '13416513' };
  const G = { adoptMe: '383310974', brookhaven: '1686885941', bloxFruits: '994732206', tds: '1176784616', mm2: '66654135', jailbreak: '245662005', pizza: '47545', nds: '65241' };
  const GR = { roblox: '1200769', interns: '2868472', videoStars: '4199740' };
  const A = { empyreus: '21070012', frigidus: '48545806', fedora: '1285307', valk: '1365767', stv: '1180433861', v3000: '74214775' };
  const KNOWN = {
    [A.empyreus]: { usd: 700000, rap: 13577229 },
    [A.frigidus]: { usd: 500000, rap: 28059680 },
    [A.fedora]: { usd: 8300, rap: 3242116, demand: 'High', trend: 'Raising' },
    [A.valk]: { usd: 864, rap: 254169 },
    [A.stv]: { usd: 25000, rap: 2580879 },
    [A.v3000]: { usd: 32.2, rap: 13417 },
  };

  const FIAT_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', BRL: 'R$', MXN: 'MX$', TRY: '₺' };
  const fiat = { settings: null, rates: null };
  try {
    const early = JSON.parse(localStorage.getItem('routilityEarly')) || {};
    fiat.settings = early.routilitySettings || null;
    fiat.rates = (early.routilityFiatRates || {}).rates || null;
  } catch {}

  function fxOf(code) {
    return !code || code === 'USD' ? 1 : Number(fiat.rates && fiat.rates[code]) || 0;
  }

  function cashNow() {
    const want = fiat.settings && FIAT_SYMBOLS[fiat.settings.currency] ? fiat.settings.currency : 'USD';
    const rate = fxOf(want);
    return rate > 0 ? { code: want, symbol: FIAT_SYMBOLS[want], rate } : { code: 'USD', symbol: '$', rate: 1 };
  }

  function money(v) {
    const c = cashNow();
    const n = Number(v) * c.rate;
    if (!(n > 0)) return c.symbol + '0';
    const cents = n < 100 && c.code !== 'JPY' && c.code !== 'KRW';
    return c.symbol + n.toLocaleString('en-US', cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
  }

  const sumOf = (ids, field, data) => ids.split(',').reduce((n, id) => n + ((data[id] || KNOWN[id] || {})[field] || 0), 0);
  const poster = (focus) => {
    const stat = {
      joined: () => h('div', null, [h('b', null, lt('Joined:') + ' '), '06 May 2022']),
      posts: () => h('div', null, [h('b', null, lt('Total Posts:') + ' '), '1,284']),
      value: () => h('span', 'rt-m-poster-pill rt-m-poster-usd', [logoImg(), money(12400)]),
      rap: () => h('span', 'rt-m-poster-pill rt-m-poster-rap', [el('span', 'icon-robux-16x16 rt-m-robux'), '30,749,100']),
      group: () => h('div', 'rt-m-poster-link', 'Limited Traders'),
    }[focus]();
    const who = h('div', 'rt-m-poster-who', [h('span', 'rt-m-poster-online'), h('span', 'rt-m-poster-name', 'Builderman')]);
    return h('div', 'rt-m-poster', [who, stat]);
  };

  const face = (id, size) => {
    const n = circle(size);
    n.dataset.rtUser = id;
    return n;
  };
  const thumb = (id, size, kids, cls) => {
    const n = tile(size, kids, cls);
    n.dataset.rtAsset = id;
    return n;
  };
  const game = (id, size, kids, cls) => {
    const n = tile(size, kids, cls);
    n.dataset.rtGame = id;
    return n;
  };
  const communityIcon = (id, size) => {
    const n = tile(size, null, 'rt-m-group');
    n.dataset.rtGroup = id;
    return n;
  };
  const liveUsd = (ids, cls) => {
    const t = h('span', null, money(sumOf(ids, 'usd', {})));
    t.dataset.rtUsd = ids;
    return h('span', 'rt-m-usd' + (cls ? ' ' + cls : ''), [logoImg(), t]);
  };
  const liveRap = (ids, cls) => {
    const t = h('span', null, sumOf(ids, 'rap', {}).toLocaleString('en-US'));
    t.dataset.rtRap = ids;
    return h('span', 'rt-m-rb' + (cls ? ' ' + cls : ''), [el('span', 'icon-robux-16x16 rt-m-robux'), t]);
  };
  const notice = (title, line, pic) => h('div', 'rt-m-card', [r([h('span', 'rt-m-tiny rt-m-strong', 'RoUtility'), muted(lt('now'))], 'rt-m-spread'), strong(title), r([pic, muted(line)])]);
  const g = (kids, cols, cls) => h('div', 'rt-m-grid' + (cls ? ' ' + cls : ''), kids, { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` });
  const cell = (kids) => h('div', 'rt-m-cell', kids);
  const person = (id, name, handle, extra) => r([face(id, 28), c([r([strong(name), extra]), muted(handle)])]);
  const flag = (code) => {
    const i = el('img', 'rt-m-flag');
    i.src = chrome.runtime.getURL(`assets/flags/${code}.svg`);
    i.alt = '';
    return i;
  };
  const stat = (value, label) => h('div', 'rt-m-stat', [strong(value), h('span', 'rt-m-tiny rt-m-muted', label)]);
  const fontCell = (family, label) => c([h('span', 'rt-m-big rt-m-font', 'Aa', { fontFamily: family }), h('span', 'rt-m-tiny rt-m-muted', label)], 'rt-m-center');

  const MOCKS = {
    itemPrices: () => r([thumb(A.fedora, 46), c([strong('Sparkle Time Fedora'), r([liveRap(A.fedora), liveUsd(A.fedora)]), r([pill(lt('High demand'), 'up'), pill(lt('Raising'))])])]),
    marketplaceValues: () => g([A.empyreus, A.fedora, A.valk].map(id => cell([thumb(id, 36), liveUsd(id, 'rt-m-tiny')])), 3, 'rt-m-full'),
    usdChart: () => {
      const box = c([r([pill('Robux'), pill(cashNow().code, 'active')])]);
      const chart = h('span', 'rt-m-chart');
      chart.innerHTML = '<svg viewBox="0 0 180 34" preserveAspectRatio="none"><path d="M0 28 L20 24 L40 26 L60 18 L80 20 L100 12 L120 15 L140 8 L160 10 L180 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      box.appendChild(chart);
      return box;
    },
    resellerDeals: () => c([r([face(U.cv, 18), rb('224,000'), pill(lt('{pct} under RAP', { pct: '12%' }), 'up')]), r([face(U.linkmon, 18), rb('274,500'), pill(lt('{pct} over RAP', { pct: '8%' }), 'down')])]),
    owners: () => c([r([pill(lt('Resellers')), pill(lt('Owners'), 'active')]), r([face(U.linkmon, 18), face(U.cv, 18), face(U.roblox, 18), pill(lt('Hoards'))])]),
    tradeValues: () => {
      const give = `${A.valk},${A.v3000}`;
      const get = A.stv;
      const diff = h('span', 'rt-m-pill rt-m-up');
      diff.dataset.rtDiff = `${give}|${get}`;
      diff.textContent = '+' + money(sumOf(get, 'usd', {}) - sumOf(give, 'usd', {}));
      return r([c([r([thumb(A.valk, 26), thumb(A.v3000, 26)]), liveUsd(give, 'rt-m-tiny')]), h('span', 'rt-m-arrow', '⇄'), c([r([thumb(A.stv, 26)]), liveUsd(get, 'rt-m-tiny')]), diff], 'rt-m-spread');
    },
    randomGame: () => c([r([strong(lt('Charts')), h('span', 'rt-m-pill', lt('Random Experience'))], 'rt-m-spread'), r([game(G.adoptMe, 34), game(G.bloxFruits, 34, null, 'rt-m-pick'), game(G.mm2, 34), game(G.brookhaven, 34)])], 'rt-m-w190'),
    privateServerToggle: () => c([r([strong(lt('Your private servers')), h('span', 'rt-m-pill', lt('Show'))], 'rt-m-spread'), r([strong(lt('Other Servers'))], 'rt-m-spread'), r([h('span', 'rt-m-stack', [face(U.builderman, 22), face(U.shedletsky, 22), face(U.telamon, 22)]), muted(lt('{n} of {max}', { n: 3, max: 12 })), pill(lt('Join'))], 'rt-m-spread')], 'rt-m-w190'),
    badgeStats: () => c([r([muted(lt('Rarity')), strong(lt('{pct} (Insane)', { pct: '0.3%' }))], 'rt-m-spread'), r([muted(lt('Won Yesterday')), strong('1,204')], 'rt-m-spread'), r([muted(lt('Won Ever')), strong('2,481,930')], 'rt-m-spread')], 'rt-m-w190'),
    messageTools: () => c([r([strong(lt('Messages')), muted(ltn(12, '{n} unread', '{n} unread'))]), r([pill(lt('Mark All as Read'), 'active'), pill(lt('Archive All Read'))])], 'rt-m-w190 rt-m-gap2'),
    catalogRobloxOnly: () => r([h('span', 'rt-m-pill', lt('By Roblox')), muted(lt('on every search'))]),
    studioStatus: () => r([h('span', 'rt-m-pill', lt('In Studio')), muted(lt('instead of Online'))]),
    playRegionTag: () => r([h('span', 'rt-m-pill', lt('Roblox picks')), muted(lt('under Play'))]),
    quickSettings: () => c([muted(lt('Quick Settings')), r([h('span', 'rt-m-tiny rt-m-strong', lt('Joins')), pill(lt('Friends'), 'active')], 'rt-m-spread'), r([h('span', 'rt-m-tiny rt-m-strong', lt('Online Status')), pill(lt('No One'))], 'rt-m-spread')], 'rt-m-w190 rt-m-gap2'),
    contextCopy: () => c([h('span', 'rt-m-pill', lt('Open link in new tab')), r([h('img', 'rt-m-logo-sm', null, { width: '14px', height: '14px' }), strong(lt('Copy User ID'))]), h('span', 'rt-m-tiny rt-m-muted', lt('Copied User ID {id}', { id: 156 }))], 'rt-m-w190 rt-m-gap2'),
    menuLink: () => h('div', 'rt-m-card', [strong(lt('Settings')), h('span', 'rt-m-strong rt-m-hl', 'RoUtility'), muted(lt('Quick Sign In')), muted(lt('Help & Safety'))]),
    streamerMode: () => r([rb('122,369', 'rt-m-big rt-m-blur'), h('span', 'rt-m-big rt-m-blur', money(38.54))]),
    exactPrices: () => r([thumb(A.empyreus, 40), c([h('span', 'rt-m-strike', '13M+'), r([h('span', 'rt-m-arrow', '\u2192'), rb('13,577,229', 'rt-m-strong')])])]),
    placeVisits: () => r([c([muted(lt('Followers')), strong('16,734,201')]), c([muted(lt('Place Visits')), strong('2,481,930,117')])], 'rt-m-spread rt-m-w190'),
    stopTrailers: () => c([game(G.adoptMe, 40, [h('span', 'rt-m-playbtn')], 'rt-m-video'), muted(lt('Paused until you press play'))], 'rt-m-center'),
    avatarPreview: () => r([face(U.linkmon, 46), c([r([pill(lt('Try On')), pill(lt('Preview'), 'active')]), r([pill('R6'), pill('R15', 'active')])])]),
    exactRobux: () => r([h('span', 'rt-m-strike', '122K+'), h('span', 'rt-m-arrow', '→'), rb('122,369', 'rt-m-big')]),
    tradeCalculator: () => c([r([c([muted(lt('You give')), r([thumb(A.valk, 24), thumb(A.v3000, 24)])]), h('span', 'rt-m-arrow', '⇄'), c([muted(lt('You receive')), r([thumb(A.stv, 24)])])], 'rt-m-spread'), r([muted(lt('Verdict')), h('span', 'rt-m-strong rt-m-green', lt('You gain USD'))], 'rt-m-spread')], 'rt-m-w190'),
    itemSimilar: () => c([strong(lt('Similar Price')), r([A.fedora, A.stv, A.empyreus, A.frigidus].map(id => thumb(id, 36)))], 'rt-m-w190'),
    itemHoardStats: () => c([r([muted(lt('Premium Copies')), strong('482')], 'rt-m-spread'), r([muted(lt('Hoarded')), strong(lt('{pct} of copies', { pct: '61%' }))], 'rt-m-spread')], 'rt-m-w190'),
    itemTags: () => r([thumb(A.fedora, 40), c([strong('Sparkle Time Fedora'), r([h('span', 'rt-m-pill rt-m-down', lt('Projected')), pill(lt('Rare'))])])]),
    calcLinks: () => c([r([muted(lt('Trade')), h('span', 'rt-m-strong rt-m-blue-text', lt('Value it in the Trade Calculator'))], 'rt-m-spread')], 'rt-m-w190'),
    tradeItemCard: () => { const box = h('div', 'rt-m-card', [r([thumb(A.valk, 22), c([strong('Valkyrie Helm'), liveUsd(A.valk, 'rt-m-tiny')])]), h('span', 'rt-m-chart rt-m-chart-sm')]); box.querySelector('.rt-m-chart').innerHTML = '<svg viewBox="0 0 180 34" preserveAspectRatio="none"><path d="M0 26 L30 24 L60 27 L90 18 L120 20 L150 10 L180 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; return box; },
    tradePreview: () => h('div', 'rt-m-card', [r([c([muted(lt('You give')), r([thumb(A.valk, 22), thumb(A.v3000, 22)]), strong(money(896))]), c([muted(lt('You receive')), r([thumb(A.stv, 22)]), strong(money(25000))])], 'rt-m-spread')]),
    tradeSendSummary: () => c([r([h('div', 'rt-m-send-side', [muted(lt('You give')), liveUsd(A.stv, 'rt-m-tiny')]), h('div', 'rt-m-send-side', [muted(lt('You receive')), liveUsd(A.v3000, 'rt-m-tiny')])]), h('div', 'rt-m-alert', [h('span', 'rt-m-alert-dot'), lt('You’re giving more')]), r([h('span', 'rt-m-check'), h('span', 'rt-m-tiny rt-m-strong', lt('I’ve reviewed this trade'))])], 'rt-m-w190 rt-m-gap2'),
    tradeWarning: () => h('div', 'rt-m-alert', [h('span', 'rt-m-alert-dot'), lt('You’re giving {pct} more value', { pct: '45%' })]),
    tradeFilter: () => c([field('dominus', true), r([face(U.linkmon, 20), strong('Linkmon99'), muted('• ' + ltn(2, '{n} day ago', '{n} days ago'))]), muted(ltn(3, '{n} trade with "{query}"', '{n} trades with "{query}"', { query: 'dominus' }))], 'rt-m-w190'),
    tradeKeys: () => r([h('span', 'rt-m-key', '↑'), h('span', 'rt-m-key', '↓'), c([r([face(U.cv, 18), strong('CV10K')]), r([face(U.linkmon, 18), muted('Linkmon99')])])]),
    tradeAge: () => r([face(U.cv, 28), c([strong('CV10K'), muted(lt('Inbound')), h('span', 'rt-m-tiny rt-m-muted', ltn(2, '{n} day ago', '{n} days ago'))]), h('span', 'rt-m-tip', ltn(3, 'Expires in {n} day', 'Expires in {n} days'))]),
    tradeOwnership: () => c([h('div', 'rt-m-alert', [h('span', 'rt-m-alert-dot'), lt('They no longer own: {item}', { item: 'Valkyrie Helm' })]), r([thumb(A.stv, 28), h('span', 'rt-m-dim', [thumb(A.valk, 28)])])], 'rt-m-w190'),
    classicProfile: () => r([face(U.linkmon, 48), c([strong('Linkmon99'), muted('@Linkmon99'), r([pill(lt('About'), 'active'), pill(lt('Creations'))])])]),
    friendsSince: () => c([strong('Linkmon99'), muted('@Linkmon99'), muted(lt('Friends since {date}', { date: new Date(2021, 2, 4).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }))]),
    mutualFriends: () => c([r([muted(ltn(168, '{n} Friend', '{n} Friends')), muted(lt('{n} Following', { n: 42 }))]), h('span', 'rt-m-chip', [h('span', 'rt-m-stack', [face(U.roblox, 16), face(U.cv, 16), face(U.linkmon, 16)]), lt('{n} Mutual', { n: 13 })])]),
    hiddenFriends: () => c([strong(lt('Friends ({n})', { n: 24 })), r([U.builderman, U.shedletsky, U.luke, U.telamon, U.merely, U.cv].map(id => face(id, 24)))]),
    friendCardMenu: () => r([face(U.cv, 28), c([strong('CV10K'), muted(lt('Online'))]), h('div', 'rt-m-cardmenu', [h('span', 'rt-m-cardmenu-dots', '•••'), h('div', 'rt-m-cardmenu-list', [h('span', null, lt('Unfriend')), h('span', null, lt('Block'))])])]),
    searchTerminated: () => r([circle(28), c([strong('ava_builds'), muted('@ava_builds'), h('span', 'rt-m-tiny rt-m-alert-text', lt('Terminated'))])]),
    revealTerminated: () => r([circle(28), c([h('span', 'rt-m-strike', lt('Account Deleted')), r([strong('ava_builds'), muted('• ' + lt('Banned'))])])]),
    inventoryValues: () => g([A.frigidus, A.stv, A.v3000].map(id => cell([thumb(id, 36), liveUsd(id, 'rt-m-tiny')])), 3, 'rt-m-full'),
    purchaseLock: () => c([h('span', 'rt-m-pill rt-m-hold', lt('Buy')), muted(lt('Hold to confirm'))]),
    buyBalance: () => c([r([muted(lt('Balance after purchase')), r([h('span', 'icon-robux-16x16'), strong('166,237')])], 'rt-m-spread')], 'rt-m-w190'),
    groupFullDesc: () => c([h('span', 'rt-m-line', null, { width: '150px' }), h('span', 'rt-m-line', null, { width: '130px' }), h('span', 'rt-m-line', null, { width: '160px' }), h('span', 'rt-m-line', null, { width: '90px' })]),
    classicFaceThumbs: () => r([thumb('494291269', 56), c([strong('Super Super Happy Face'), muted(lt('Face, like it used to look'))])]),
    itemSize: () => r([muted(lt('Size')), strong(lt('{size} studs', { size: '1.6 × 0.6 × 1.6' }))], 'rt-m-spread rt-m-w190'),
    itemUsd: () => r([rb('254,169'), usd(money(864), 'rt-m-strong')]),
    itemDemand: () => r([muted(lt('Demand')), strong(lt('High'))], 'rt-m-spread rt-m-w190'),
    itemTrend: () => r([muted(lt('Trend')), strong(lt('Raising'))], 'rt-m-spread rt-m-w190'),
    itemCopies: () => r([muted(lt('Copies')), strong('10,647')], 'rt-m-spread rt-m-w190'),
    itemChange: () => r([muted(lt('Price Change')), h('span', 'rt-m-green', '+' + money(120) + ' (8%)')], 'rt-m-spread rt-m-w190'),
    itemOwnedRow: () => r([muted(lt('You own')), strong(ltn(2, '{n} copy • {serials}', '{n} copies • {serials}', { serials: '#48, #1,204' }))], 'rt-m-spread rt-m-w190'),
    lastOnSale: () => r([muted(lt('Last On Sale')), h('span', null, [strong(lt('{date} for', { date: 'Jun 05, 2024' }) + ' '), rb('250')])], 'rt-m-spread rt-m-w190'),
    itemAcquired: () => c([r([muted(lt('Created')), strong('Jan 3, 2013')], 'rt-m-spread'), r([muted(lt('Acquired')), h('span', null, [strong('Oct 1, 2026'), muted(' · ' + ltn(9, '{n} day ago', '{n} days ago'))])], 'rt-m-spread')], 'rt-m-w190'),
    friendsOwn: () => r([h('span', 'rt-m-pill', [h('span', null, [face(U.builderman, 14), face(U.linkmon, 14)], { display: 'inline-flex', marginRight: '4px' }), ltn(114, '{n} Friend owns', '{n} Friends own')], { display: 'inline-flex', alignItems: 'center', padding: '3px 8px' })]),
    itemExplorer: () => h('div', 'rt-m-card rt-m-rx', [h('span', 'rt-m-rx-row', [h('span', 'rt-m-rx-dot', null, { background: '#f2b134' }), 'Accessory']), h('span', 'rt-m-rx-row rt-m-rx-sel', [h('span', 'rt-m-rx-dot', null, { background: '#5aa7ff' }), 'Handle'], { paddingLeft: '18px' }), h('span', 'rt-m-rx-row', [h('span', 'rt-m-rx-dot', null, { background: '#ff8a5b' }), 'HatAttachment'], { paddingLeft: '34px' })]),
    gearFix: () => r([thumb(A.valk, 34), h('span', 'rt-m-card', [thumb('27494652', 34)], { padding: '4px', outline: '1px dashed var(--rt-m-blue)' })]),
    ownedSince: () => g([[A.valk, ltn(9, '{n}y', '{n}y')], [A.fedora, ltn(12, '{n}d', '{n}d')]].map(([id, t]) => c([thumb(id, 40), h('span', 'rt-m-tiny', [h('span', 'rt-m-muted', lt('By') + ' '), h('span', 'rt-m-strong', 'Roblox'), h('span', 'rt-m-muted', ' · ' + t)])], 'rt-m-center')), 2),
    badgeDates: () => r([game(G.tds, 34), c([strong('Beat Wave 40'), muted(lt('Earned {date}', { date: 'Mar 3, 2021' }))])]),
    listOrder: () => r([muted(lt('Newest')), thumb(A.valk, 26), thumb(A.stv, 26), thumb(A.v3000, 26), muted(lt('Oldest'))]),
    inventorySearch: () => c([field(lt('Search {query}', { query: 'valkyrie' })), g([thumb(A.valk, 26), thumb(A.stv, 26), thumb(A.v3000, 26, [h('span', 'rt-m-badge', '×2')]), tile(26, null, 'rt-m-ghost'), tile(26, null, 'rt-m-ghost')], 5)]),
    richSearch: () => c([field('linkmon', true), h('div', 'rt-m-menu', [r([face(U.linkmon, 16), strong('Linkmon99')]), r([thumb(A.empyreus, 16), liveUsd(A.empyreus, 'rt-m-tiny')])])]),
    searchPeople: () => person(U.roblox, 'Roblox', '@Roblox', verified()),
    searchFriends: () => person(U.cv, 'CV10K', '@CV10K', pill(lt('Friend'))),
    searchGames: () => r([game(G.tds, 30), c([strong('Tower Defense Simulator'), muted(lt('{rating} • {n} playing', { rating: '94%', n: '26,687' }))])]),
    searchItems: () => r([thumb(A.empyreus, 36), c([strong('Dominus Empyreus'), r([liveUsd(A.empyreus, 'rt-m-tiny'), h('span', 'rt-m-tiny rt-m-muted', [liveRap(A.empyreus)])])])]),
    searchSlash: () => r([h('span', 'rt-m-key', '/'), h('span', 'rt-m-arrow', '→'), field(lt('Search'), true)]),
    avatarRemember: () => c([r([pill(lt('Recent')), pill(lt('Accessories'), 'active'), pill(lt('Body'))]), r([muted(lt('Accessories')), h('span', 'rt-m-arrow', '›'), strong(lt('Head'))]), r([A.valk, A.stv, A.fedora, A.empyreus].map(id => thumb(id, 24)))], 'rt-m-w190'),
    avatarSearch: () => c([field(lt('Search head accessories')), g([A.valk, A.stv, A.fedora, A.empyreus, A.frigidus].map(id => thumb(id, 28)), 5)]),
    avatarSticky: () => r([c([face(U.linkmon, 44), muted('Linkmon99')], 'rt-m-gap2'), c([[A.valk, A.stv, A.fedora, A.v3000], [A.empyreus, A.frigidus, A.valk, A.fedora], [A.stv, A.v3000, A.empyreus, A.frigidus]].map(row => r(row.map(id => thumb(id, 22)))), 'rt-m-scrolling')]),
    skinWheel: () => r([h('span', 'rt-m-wheel'), c([strong(lt('Hex Color')), r([h('span', 'rt-m-wheel-swatch'), muted('#3A7BD5')])])]),
    accessoryAdjust: () => r([h('span', 'rt-m-tc-frame', [thumb(A.valk, 44)]), c([r([h('span', 'rt-m-pill rt-m-active', lt('Move')), pill(lt('Rotate')), pill(lt('Scale'))]), r([muted('Y'), strong('+0.12')])])]),
    outfitRotator: () => c([r([strong(lt('Outfit Rotator')), pill(lt('Every 15 Minutes'), 'active')], 'rt-m-spread'), r([thumb(A.valk, 26), thumb(A.fedora, 26), thumb(A.empyreus, 26), thumb(A.stv, 26)])], 'rt-m-w190'),
    thumbCustomize: () => r([h('span', 'rt-m-tc-frame', [thumb(A.valk, 44)]), c([r([muted(lt('Field of View')), strong('25°')], 'rt-m-spread'), h('span', 'rt-m-bar rt-m-bar-blue', [h('span', null, null, { width: '33%' })]), r([muted(lt('Rotation')), strong('25.5°')], 'rt-m-spread'), h('span', 'rt-m-bar rt-m-bar-blue', [h('span', null, null, { width: '71%' })])], 'rt-m-tc-ctrls')]),
    avatarRig: () => c([r([strong(lt('Avatar type')), r([muted('R6'), h('span', 'rt-m-switch', [h('span')]), strong('R15')])], 'rt-m-spread'), r([muted(lt('Body Type')), muted('100%')], 'rt-m-spread'), h('span', 'rt-m-bar rt-m-bar-blue', [h('span', null, null, { width: '100%' })])], 'rt-m-w190'),
    hideMakeup: () => r([pill(lt('Clothing')), h('span', 'rt-m-pill rt-m-gone', lt('Makeup')), pill(lt('Body'))]),
    avatarWearing: () => c([r([strong(lt('Wearing')), liveUsd(`${A.fedora},${A.valk},${A.stv},${A.v3000},${A.frigidus}`, 'rt-m-tiny')], 'rt-m-spread'), muted(lt('{n} items • {worn}/{max} accessories', { n: 5, worn: 5, max: 10 })), g([A.fedora, A.valk, A.stv, A.v3000, A.frigidus].map(id => thumb(id, 24)), 5)], 'rt-m-w190'),
    avoidFriends: () => c([r([pill(lt('Play'), 'active')]), r([face(U.cv, 18), face(U.linkmon, 18), muted(lt('not in that server'))])]),
    notifyInbound: () => notice(lt('Trade Received'), lt('From {user}', { user: '@Builderman' }), face(U.builderman, 16)),
    notifyOutbound: () => notice(lt('Trade Sent'), lt('To {user}', { user: '@Shedletsky' }), face(U.shedletsky, 16)),
    notifyCompleted: () => notice(lt('Trade Completed'), lt('With {user}', { user: '@Telamon' }), face(U.telamon, 16)),
    notifyDeclined: () => notice(lt('Trade Declined'), lt('{user} declined it', { user: '@Merely' }), face(U.merely, 16)),
    notifyLimiteds: () => notice(lt('New Roblox Limited'), lt('R$ {price} · {copies} copies', { price: '1,000', copies: '5,000' }), thumb(A.fedora, 18)),
    notifyUgc: () => notice(lt('New UGC Limited'), lt('R$ {price} · {copies} copies', { price: '250', copies: '100' }), thumb(A.stv, 18)),
    priceAlerts: () => c([r([thumb(A.valk, 24), c([strong('Valkyrie Helm'), muted(lt('Alert at R$ {price}', { price: '250,000' }))])]), r([h('span', 'rt-m-tiny rt-m-strong rt-m-hl', lt('Price Alert'))])], 'rt-m-w190'),
    forumStatJoined: () => poster('joined'),
    forumStatPosts: () => poster('posts'),
    forumStatValue: () => poster('value'),
    forumStatRap: () => poster('rap'),
    forumStatGroup: () => poster('group'),
    fakeRequests: () => r([strong(lt('Friends')), h('span', 'rt-m-pill rt-m-badge', '500+')]),
    fakeRobux: () => r([h('span', 'rt-m-strike', '1,250'), h('span', 'rt-m-arrow', '→'), rb('1,000,000', 'rt-m-big')]),
    fakeBuy: () => h('div', 'rt-m-card rt-m-buy', [
      r([h('span', 'rt-m-tiny rt-m-strong', lt('Purchase Completed')), rb('998,800', 'rt-m-tiny')], 'rt-m-spread'),
      r([h('span', 'rt-m-buy-check', [icon('check')]), h('span', 'rt-m-tiny rt-m-buy-text', around(lt('You have successfully bought {item}'), '{item}', h('span', 'rt-m-strong', 'Valkyrie Helm')))]),
    ]),
    skipR6Warning: () => c([h('span', 'rt-m-tiny rt-m-strike', lt('R6 characters have limitations…')), r([pill('R6', 'active'), muted(lt('switches right away'))])]),
    classicGames: () => r([h('span', 'rt-m-tiny rt-m-strike', lt('Charts')), strong(lt('Games'))]),
    classicCatalog: () => r([h('span', 'rt-m-tiny rt-m-strike', lt('Marketplace')), strong(lt('Catalog'))]),
    classicDevelop: () => r([h('span', 'rt-m-tiny rt-m-strike', lt('Create')), strong(lt('Develop'))]),
    classicGroups: () => r([h('span', 'rt-m-tiny rt-m-strike', lt('Communities')), strong(lt('Groups'))]),
    classicPackages: () => r([h('span', 'rt-m-tiny rt-m-strike', lt('Bundles')), strong(lt('Packages'))]),
    keepR6: () => r([face(U.linkmon, 46), c([r([pill('R6', 'active'), pill('R15')]), muted(lt('Dynamic head on, still R6'))])]),
    avatarMoreAccessories: () => c([muted(lt('{worn}/{max} accessories', { worn: 5, max: 10 })), g([A.empyreus, A.frigidus, A.fedora, A.valk, A.stv].map(id => thumb(id, 28)).concat([tile(28, [h('span', 'rt-m-plus', '+')], 'rt-m-dash')]), 6)], 'rt-m-w190'),
    gameStats: () => r([c([muted(lt('Visits')), strong('44,988,572,987')]), c([muted(lt('Updated')), strong(ltn(1, '{n} hour ago', '{n} hours ago'))])], 'rt-m-spread'),
    badgeTools: () => r([pill(lt('Rarest First'), 'active'), pill(lt('Not Owned'))]),
    badgeManage: () => r([pill(lt('All'), 'active'), pill(lt('Common')), pill(lt('Rare'))]),
    badgeAutoDelete: () => r([strong(lt('Delete New Badges Automatically'))]),
    badgeProgress: () => c([r([strong(lt('Badges')), muted(lt('{n} of {total} owned', { n: 8, total: 144 }))]), h('span', 'rt-m-bar', [h('span', null, null, { width: '30%' })]), r([game(G.tds, 20), strong('Beat Wave 40'), pill(lt('Owned'), 'up')])]),
    skeletonLoading: () => r([h('span', 'rt-m-sk', null, { width: '40px', height: '40px', borderRadius: '8px' }), c([h('span', 'rt-m-sk', null, { width: '110px', height: '8px' }), h('span', 'rt-m-sk', null, { width: '70px', height: '8px' })])]),
    hideSponsored: () => r([game(G.adoptMe, 38), c([game(G.pizza, 38, null, 'rt-m-gone'), h('span', 'rt-m-tiny rt-m-strike', lt('Sponsored'))], 'rt-m-gap2'), game(G.mm2, 38), game(G.bloxFruits, 38)], 'rt-m-top'),
    hoverTips: () => c([h('span', 'rt-m-tip', lt('Demand: {level}', { level: lt('High') })), pill(lt('High'))], 'rt-m-center'),
    itemCardEverywhere: () => r([g([A.frigidus, A.fedora].map(id => thumb(id, 34)), 2), h('div', 'rt-m-card', [r([thumb(A.frigidus, 18), strong('Frigidus')]), liveUsd(A.frigidus, 'rt-m-tiny'), muted(lt('Marketplace'))])]),
    tradeAds: () => c([r([face(U.builderman, 22), strong('builderman'), muted(ltn(2, '{n}m ago', '{n}m ago'))]), r([pill(lt('Offering {n}', { n: 2 })), h('span', 'rt-m-arrow', '⇄'), pill(lt('Rares')), pill(lt('Upgrade'))])]),
    tradeAdsNav: () => h('div', 'rt-m-card', [muted(lt('Trade Calculator')), h('span', 'rt-m-strong rt-m-hl', lt('Trade Ads')), muted(lt('Communities'))]),
    calcNav: () => h('div', 'rt-m-card', [muted(lt('Trade')), h('span', 'rt-m-strong rt-m-hl', lt('Trade Calculator')), muted(lt('Communities'))]),
    groupFriends: () => r([pill(ltn(570247, '{n} Member', '{n} Members', { n: '570,247' })), h('span', 'rt-m-pill', [face(U.builderman, 14), document.createTextNode(' ' + ltn(4, '{n} Friend', '{n} Friends'))])]),
    groupDetails: () => c([r([muted('570.2K+'), h('span', 'rt-m-arrow', '\u2192'), strong(ltn(570247, '{n} Member', '{n} Members', { n: '570,247' }))]), r([pill(lt('Founder · Rank {rank}', { rank: 255 })), pill([rb('144'), '\u00a0\u2248 $0.55'])])]),
    friendManage: () => c([r([strong(lt('My Friends')), muted(ltn(248, '{n} friend', '{n} friends'))]), r([pill(lt('Offline')), pill(lt('Terminated')), h('span', 'rt-m-pill rt-m-down', lt('Unfriend {n}', { n: 6 }))])]),
    cancelRequests: () => r([pill(lt('Pending')), h('span', 'rt-m-pill rt-m-down', lt('Cancel Request'))]),
    unfriendDetector: () => c([r([h('span', 'rt-m-pill rt-m-down', '2'), strong(lt('No Longer Friends'))]), r([face(U.shedletsky, 22), muted('Shedletsky'), pill(lt('Noticed {date}', { date: 'Oct 12' }))])]),
    groupManage: () => c([r([strong(lt('My Communities')), muted(lt('{n} of {max}', { n: 80, max: 100 }))]), r([pill(lt('Owned')), pill(lt('Highest Rank')), h('span', 'rt-m-pill rt-m-down', lt('Leave {n}', { n: 5 }))])]),
    groupAdmin: () => r([strong(lt('Audit Log')), pill(lt('Export CSV'))]),
    chatBot: () => c([
      r([h('span', 'rt-m-bub rt-m-bub-out', 'dom emp for 2 frigidus')], 'rt-m-end'),
      r([botFace(), h('div', 'rt-m-bub rt-m-bub-in', [r([thumb(A.empyreus, 24), h('span', 'rt-m-arrow', '→'), thumb(A.frigidus, 24), thumb(A.frigidus, 24)]), pill(lt('Win {pct}', { pct: '+42.9%' }), 'up')])], 'rt-m-top'),
    ], 'rt-m-chat'),
    tradeCleanup: () => c([r([h('span', 'rt-m-pill rt-m-down', lt('Decline Overpays')), muted(lt('{n} of {max}', { n: 3, max: 12 }))]), r([h('span', 'rt-m-pill', lt('Cancel Unowned Items')), muted(lt('{n} of {max}', { n: 1, max: 4 }))])]),
    groupHiddenGames: () => r([tile(34, null, 'rt-m-dash'), c([strong('Building Testing'), muted(lt('Not on the community page'))])]),
    userOutfits: () => r([tile(34), tile(34), tile(34), c([strong(ltn(3, '{n} Outfit', '{n} Outfits')), muted(lt('Saved by this player'))])]),
    badgeSizeFix: () => r([strong('Roblox'), verified(), muted(lt('Sized to the name'))]),
    navCollapse: () => r([h('span', 'rt-m-rail', [icon('home'), icon('person'), icon('people'), icon('game')]), c([strong(lt('Collapse')), muted(lt('Icons only, more room'))])]),
    chatResize: () => r([h('div', 'rt-m-win', [h('span', 'rt-m-grip'), r([botFace(), line(46)]), line(70, 'rt-m-dark'), line(54, 'rt-m-dark')]), c([strong('400 × 520'), muted(lt('Drag the corner'))])]),
    groupFind: () => c([r([pill(lt('Find: {query}', { query: 'builderman' }))]), r([face(U.builderman, 22), strong('builderman'), pill(lt('Admin · Rank {rank}', { rank: 254 }))])]),
    createScanner: () => c([r([strong(lt('Scripts')), h('span', 'rt-m-pill rt-m-down', lt('{n} High Risk', { n: 1 }))]), r([muted('require(4815162342)'), pill(lt('Line {n}', { n: 12 }))])]),
    createIds: () => c([r([muted(lt('Universe ID')), strong('10032450273'), pill(lt('Copy'))]), r([muted(lt('Place ID')), strong('9539954854'), pill(lt('Copy'))])]),
    createDevItems: () => r([strong('78680392428952'), pill(lt('Copy')), pill(lt('Download'))]),
    createUsd: () => r([rb('5,000', 'rt-m-strong'), muted('\u2248 ' + money(19))]),
    friendFilters: () => c([r([pill(lt('All')), pill(lt('Trusted')), pill(lt('Verified'))]), r([pill('Roblox Plus', 'active'), pill(lt('Admin')), pill(lt('Online'))])]),
    requestFilters: () => c([r([strong(lt('Requests')), pill(lt('Filter ({n})', { n: 2 }), 'active')]), r([pill(lt('Verified: Only')), pill(lt('Mutual Friends: {n}+', { n: 1 }))])]),
    adminBadge: () => r([face(U.builderman, 28), strong('Builderman'), verified(), h('span', 'icon icon-filled-tilt rt-m-admin')]),
    homeGreeting: () => r([h('span', 'rt-m-greet-avatar', [face(U.builderman, 40)]), h('span', 'rt-m-greet-text', lt('Hello, {name}!', { name: 'Builderman' }))]),
    playtime: () => c([r([strong(lt('Most Played')), pill(lt('7 Days'), 'active')], 'rt-m-spread'), r([muted('Adopt Me!'), muted(lt('{h}h {m}m', { h: 12, m: 40 }))], 'rt-m-spread'), r([muted('Jailbreak'), muted(lt('{h}h {m}m', { h: 3, m: 5 }))], 'rt-m-spread')], 'rt-m-w190'),
    forum: () => {
      const badge = el('img', 'rt-m-fpost-badge');
      badge.src = chrome.runtime.getURL('assets/icons/forum/moderator.png?v=2');
      badge.alt = lt('moderator');
      const author = c([r([h('span', 'rt-m-fpost-dot'), h('span', 'rt-m-fpost-name', 'InceptionTime')], 'rt-m-fpost-who'), face('7733466', 32), badge], 'rt-m-fpost-author');
      const post = c([h('span', 'rt-m-fpost-heading', 'Rules for all Forums'), h('span', 'rt-m-fpost-text', 'The rules below apply to ALL the ROBLOX forums.')], 'rt-m-fpost-body');
      return h('div', 'rt-m-fpost', [h('div', 'rt-m-fpost-bar'), r([author, post], 'rt-m-fpost-row')]);
    },
    forumTopLink: () => r([muted(lt('Charts')), muted(lt('Marketplace')), muted(lt('Create')), h('span', 'rt-m-strong rt-m-hl', lt('Forum'))]),
    forumNav: () => h('div', 'rt-m-card', [muted(lt('Communities')), h('span', 'rt-m-strong rt-m-hl', lt('Forum')), muted(lt('Newsroom'))]),
    calcRemember: () => r([pill(lt('Last trade'), 'active'), thumb(A.valk, 26), h('span', 'rt-m-arrow', '⇄'), thumb(A.stv, 26)]),
    calcPercents: () => r([h('span', 'rt-m-strong rt-m-green', '+' + money(24104)), pill('+2,690%', 'up')]),
    calcEven: () => c([muted(lt('Add to even it out')), r([thumb(A.v3000, 26, [h('span', 'rt-m-badge', '+')]), thumb(A.valk, 26, [h('span', 'rt-m-badge', '+')]), tile(26, null, 'rt-m-ghost')])]),
    exactCounts: () => c([muted(lt('Followers')), r([h('span', 'rt-m-strike', '16.7M'), h('span', 'rt-m-arrow', '→'), h('span', 'rt-m-strong rt-m-big', '16,734,201')])]),
    mutualGroups: () => c([r([muted(ltn(168, '{n} Friend', '{n} Friends')), muted(lt('{n} Following', { n: 42 }))]), h('span', 'rt-m-chip', [h('span', 'rt-m-stack', [communityIcon(GR.roblox, 16), communityIcon(GR.interns, 16), communityIcon(GR.videoStars, 16)]), ltn(3, '{n} Mutual community', '{n} Mutual communities')])]),
    genreFilters: () => r([pill(lt('All Genres')), pill(lt('Obby & Platformer'), 'active'), pill(lt('Action'))], 'rt-m-chips'),
    recentlyUpdated: () => c([strong(lt('Recently Updated')), r([game(G.adoptMe, 46, [h('span', 'rt-m-tiny rt-m-muted', '• ' + ltn(2, '{n}h ago', '{n}h ago'))]), game(G.tds, 46, [h('span', 'rt-m-tiny rt-m-muted', ltn(3, '{n}d ago', '{n}d ago'))])])], 'rt-m-w190'),
    friendsPlaying: () => c([strong(lt('Friends Playing')), r([[G.adoptMe, [U.cv, U.builderman]], [G.tds, [U.linkmon]], [G.jailbreak, [U.roblox]]].map(([gid, ids]) => game(gid, 46, [h('span', 'rt-m-tile-faces', ids.map(id => face(id, 16)))])))], 'rt-m-w190'),
    notInterested: () => r([game(G.brookhaven, 46, [h('span', 'rt-m-dots', '⋯')]), h('div', 'rt-m-card', [h('span', 'rt-m-strong rt-m-hl', lt('Not interested')), muted(lt('Report'))])]),
    rollSounds: () => r([h('span', 'rt-m-key', '♪'), muted(lt('tick • tick • tick • chime'))]),
    creatorItems: () => c([r([strong(lt('Avatar Items')), h('span', 'rt-m-tiny rt-m-muted', lt('By {creator}', { creator: 'Uplift Games' }))], 'rt-m-spread'), r([A.fedora, A.frigidus, A.v3000].map(id => thumb(id, 36)))], 'rt-m-w190'),
    devProducts: () => c([r([strong(lt('Developer Products')), h('span', 'rt-m-tiny rt-m-muted', '48')], 'rt-m-spread'), r([rb('24'), rb('48'), rb('96')])], 'rt-m-w190'),
    storeTotal: () => c([r([strong(lt('Passes')), h('span', 'rt-m-tiny rt-m-muted', lt('All {n} passes', { n: 12 }))], 'rt-m-spread'), r([rb('4,350', 'rt-m-big'), muted('• ' + lt('You own {n}', { n: 3 }))])], 'rt-m-w190'),
    serverStats: () => c([strong(lt('{n} of {max} people max', { n: 3, max: 5 })), h('span', 'rt-m-bar', [h('span', null, null, { width: '60%' })]), r([pill('100%'), pill(lt('{n} ms', { n: 38 }), 'up'), pill(lt('Join')), pill(lt('Invite'))])], 'rt-m-w190'),
    serverRegions: () => c([['us', 'Ashburn, Virginia', ltn(42, '{n} server', '{n} servers'), true], ['de', 'Frankfurt, Germany', ltn(18, '{n} server', '{n} servers')], ['sg', 'Singapore', ltn(9, '{n} server', '{n} servers')]].map(([code, city, count, top]) => r([flag(code), top ? strong(city) : muted(city), pill(count, top ? 'active' : '')], 'rt-m-spread rt-m-region')), 'rt-m-w190'),
    launchDetails: () => r([h('span', 'rt-m-launch-logo', [h('span', 'routility-roblox-mark routility-spin rt-m-mark')]), c([strong('Minesweeper'), h('span', 'rt-m-tiny rt-m-muted', lt('Joining server…')), r([pill('3/5'), pill(lt('{n} ms', { n: 38 }), 'up'), pill(lt('{h}h {m}m', { h: 3, m: 44 }))], 'rt-m-launch-pills')], 'rt-m-launch-info')], 'rt-m-launch'),
    siteFont: () => r([fontCell('', 'Roblox'), fontCell('"Builder Sans", sans-serif', 'Builder'), fontCell('system-ui, sans-serif', lt('System'))], 'rt-m-spread'),
    statusBanner: () => r([h('span', 'rt-m-pill', lt('Game Join')), muted(lt('Partial Disruption'))]),
    menuHighlight: () => c([h('span', 'rt-m-tab rt-m-tab-on', lt('General')), h('span', 'rt-m-tab', lt('Search'))], 'rt-m-tabs'),
    scrollbarFix: () => r([c([line(120, 'rt-m-dark'), line(150), line(130), line(90)]), h('span', 'rt-m-scroll', [h('span')])], 'rt-m-top'),
    hideChat: () => r([muted(lt('Bottom right')), h('span', 'rt-m-pill rt-m-gone', lt('Chat'))]),
    classicLogo: () => {
      const logo = el('img', 'rt-m-classic-logo');
      logo.src = 'https://images.rbxcdn.com/b48b9cc9bf67813b.svg';
      logo.alt = '';
      return r([logo]);
    },
    classicPremium: () => r([strong('Linkmon99'), h('span', 'icon rt-m-premium')]),
    classicVerified: () => r([strong('builderman'), h('span', 'rt-m-classic-verified')]),
    classicNames: () => r([strong(lt('Games')), strong(lt('Catalog')), strong(lt('Develop')), strong(lt('Groups'))], 'rt-m-spread'),
    navVerified: () => r([face(U.roblox, 24), strong('Roblox'), verified()]),
    robuxUsd: () => r([rb('400', 'rt-m-big'), h('span', 'rt-m-tip', '≈ ' + money(1.52))]),
    txUsd: () => c([r([muted(lt('Purchases')), rb('8,000'), muted('≈ ' + money(30.40))], 'rt-m-spread'), r([strong(lt('Net')), rb('+1,250'), muted('≈ ' + money(4.75))], 'rt-m-spread')], 'rt-m-w190'),
    txFilters: () => r([pill(lt('Item: {name}', { name: 'Dominus' })), pill(lt('Pending')), pill(lt('Apply'), 'active')]),
    txExport: () => r([pill(lt('Export CSV')), muted(ltn(1240, '{n} row exported', '{n} rows exported', { n: '1,240' }))]),
    streamerRobux: () => r([rb('122,369', 'rt-m-blur'), h('span', 'rt-m-blur', money(38.54))]),
    streamerAccount: () => c([muted(lt('Email')), h('span', 'rt-m-strong rt-m-blur', 'name@example.com')]),
    streamerPayment: () => c([muted(lt('Saved Payment Method')), h('span', 'rt-m-strong rt-m-blur', 'Visa •••• 4242  Exp 08/29')]),
    streamerName: () => r([face(U.roblox, 22), h('span', 'rt-m-strong rt-m-blur', 'masonbuilds')]),
    streamerAvatar: () => r([h('span', 'rt-m-blur rt-m-blur-strong', [face(U.roblox, 30)]), strong('masonbuilds')]),
    streamerValues: () => r([thumb(A.valk, 26), h('span', 'rt-m-blur', [liveUsd(A.valk)])]),
    profilePreviews: () => h('div', 'rt-m-card', [r([h('span', 'rt-m-face', [face(U.linkmon, 26), h('span', 'rt-m-dot')]), c([strong('Linkmon99'), muted('@Linkmon99')])]), h('span', 'rt-m-tiny rt-m-green', lt('Playing {game}', { game: 'Tower Defense' }))]),
  };

  function ask(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          void chrome.runtime.lastError;
          resolve(res);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function putImg(host, src) {
    if (!src || host.querySelector('img')) return;
    const img = el('img', 'rt-m-img');
    img.alt = '';
    img.addEventListener('load', () => img.classList.add('rt-m-img-in'), { once: true });
    img.src = src;
    host.appendChild(img);
  }

  async function fillMocks(root) {
    const games = [...new Set([...root.querySelectorAll('[data-rt-game]')].map(n => n.dataset.rtGame))];
    const groups = [...new Set([...root.querySelectorAll('[data-rt-group]')].map(n => n.dataset.rtGroup))];
    const iconsOf = (url) => fetch(url, { credentials: 'include' }).then(res => (res.ok ? res.json() : null)).then(j => Object.fromEntries(((j && j.data) || []).filter(d => d.state === 'Completed').map(d => [String(d.targetId), d.imageUrl]))).catch(() => ({}));
    Promise.all([
      games.length ? iconsOf('https://thumbnails.roblox.com/v1/games/icons?universeIds=' + games.join(',') + '&size=150x150&format=Webp&isCircular=false') : {},
      groups.length ? iconsOf('https://thumbnails.roblox.com/v1/groups/icons?groupIds=' + groups.join(',') + '&size=150x150&format=Webp&isCircular=false') : {},
    ]).then(([gi, gr]) => {
      for (const n of root.querySelectorAll('[data-rt-game]')) putImg(n, gi[n.dataset.rtGame]);
      for (const n of root.querySelectorAll('[data-rt-group]')) putImg(n, gr[n.dataset.rtGroup]);
    });
    const users = [...new Set([...root.querySelectorAll('[data-rt-user]')].map(n => n.dataset.rtUser))];
    const assets = [...new Set([...root.querySelectorAll('[data-rt-asset]')].map(n => n.dataset.rtAsset))];
    const priced = [...new Set([...root.querySelectorAll('[data-rt-usd], [data-rt-rap], [data-rt-diff]')].flatMap(n => (n.dataset.rtUsd || n.dataset.rtRap || n.dataset.rtDiff).split(/[,|]/)))];
    const [heads, thumbs, prices] = await Promise.all([
      users.length ? ask({ type: 'getHeadshots', ids: users }) : null,
      assets.length ? ask({ type: 'getAssetThumbs', ids: assets }) : null,
      priced.length ? ask({ type: 'getPrices', ids: priced, names: [] }) : null,
    ]);
    for (const n of root.querySelectorAll('[data-rt-user]')) putImg(n, (heads || {})[n.dataset.rtUser]);
    for (const n of root.querySelectorAll('[data-rt-asset]')) putImg(n, (thumbs || {})[n.dataset.rtAsset]);
    const data = (prices && prices.ready && prices.ids) || {};
    for (const n of root.querySelectorAll('[data-rt-usd]')) n.textContent = money(sumOf(n.dataset.rtUsd, 'usd', data));
    for (const n of root.querySelectorAll('[data-rt-rap]')) n.textContent = sumOf(n.dataset.rtRap, 'rap', data).toLocaleString('en-US');
    for (const n of root.querySelectorAll('[data-rt-diff]')) {
      const [give, get] = n.dataset.rtDiff.split('|');
      const d = sumOf(get, 'usd', data) - sumOf(give, 'usd', data);
      n.textContent = (d >= 0 ? '+' : '−') + money(Math.abs(d));
      n.classList.toggle('rt-m-up', d >= 0);
      n.classList.toggle('rt-m-down', d < 0);
    }
  }

  const PAGES = {
    browsing: {
      intro: LT('Changes that apply everywhere on Roblox.'),
      groups: [
        { title: LT('Loading & Hints'), rows: [
          { key: 'skeletonLoading', title: LT('Skeleton Loading'), desc: LT('Clean placeholders while Roblox pages load, instead of spinners and loading stripes.') },
          { key: 'statusBanner', title: LT('Roblox Status Banner'), desc: LT('A banner at the top of Roblox when something is down or slow, like game joins or the avatar shop, straight from Roblox’s status page. Dismiss it and it stays hidden until the status changes.') },
          { key: 'hoverTips', title: LT('Hover Hints'), desc: LT('Short explanations when you hover RoUtility pills, labels and badges.') },
        ] },
        { title: LT('Name Badges'), rows: [
          { key: 'navVerified', title: LT('Verified Badge on Your Name'), desc: LT('If your account is verified, the blue check next to your name in the top bar and the side menu, before Roblox Plus like on your profile.') },
          { key: 'adminBadge', title: LT('Admin Badge'), desc: LT('Roblox’s admin logo next to friends and players in search who are Roblox admins, after the verified and Plus badges, like on their profile.') },
          { key: 'badgeSizeFix', title: LT('Fix Verified Badge Size'), desc: LT('Roblox shows the verified badge too big next to names in player search. This shrinks it to match the name, like everywhere else.') },
        ] },
        { title: LT('Your Status'), rows: [
          { key: 'studioStatus', title: LT('Appear In Studio'), desc: LT('Everyone sees your status as In Studio instead of Online or the game you’re in, while a Roblox tab is open. When you turn it off, your normal status comes back within a minute or two.') },
        ] },
        { title: LT('Shortcuts'), rows: [
          { key: 'menuLink', title: LT('Settings Menu Link'), desc: LT('A RoUtility item above Settings in the gear menu at the top right, straight to this page.') },
          { key: 'contextCopy', title: LT('Copy IDs on Right-Click'), desc: LT('Right-click a profile, item, model, bundle, experience, community or badge (or an empty spot on its page) for Copy User ID, Copy Asset ID and so on, with a quick confirmation.') },
        ] },
      ],
    },
    themes: {
      intro: LT('Make Roblox look the way you like: every Roblox Plus theme for free, your own colors, another font and a scrollbar that matches.'),
      groups: [
        { title: LT('Theme'), rows: [
          { key: 'customTheme', title: LT('Custom Theme'), desc: LT('Pick your own colors for Roblox: backgrounds, cards, text, links and the Play button. Start from a preset or set each color yourself.') },
          { custom: 'themeEditor', parent: 'customTheme', title: LT('Theme Editor'), desc: LT('Your colors, the theme presets and your saved themes.'), keywords: 'theme themes color colors colour palette preset presets background dark light' },
        ] },
        { title: LT('Roblox Plus Themes'), rows: [
          { custom: 'plusThemes', title: LT('Roblox Plus Themes'), desc: LT('Every app theme from Roblox Plus, free for everyone.'), keywords: 'plus premium theme themes color colour calm dynamic classic nebula nitro circuit kinetic inferno plum quantum cosmic polar charge lime lava star pixel free' },
        ] },
        { title: LT('Font'), rows: [
          { key: 'siteFont', title: LT('Website Font'), desc: LT('Roblox’s current font, Builder Sans (the one Roblox used before), your computer’s own font, or a font file you pick. Your font is saved in this browser only.'), options: [['default', LT('Roblox default')], ['builder', 'Builder Sans'], ['system', LT('System font')], ['custom', LT('Your Own Font')]], fontInput: 'custom' },
        ] },
        { title: LT('Scrollbar'), rows: [
          { key: 'scrollbarFix', title: LT('Match Scrollbar to Theme'), desc: LT('Roblox’s scrollbar follows your computer’s light or dark mode instead of Roblox’s theme. This makes it match the theme, with a see-through track.') },
          { key: 'scrollbarStyle', parent: 'scrollbarFix', title: LT('Scrollbar Style'), desc: LT('Floating hides the scrollbar until you scroll, then shows a slim bar over the page that fades out when you stop. Pick Roblox default to keep the normal scrollbar.'), options: [['floating', LT('Floating')], ['default', LT('Roblox default')]] },
        ] },
        { title: LT('Settings Menu'), rows: [
          { key: 'menuHighlight', title: LT('Selected Tab'), desc: LT('How the open tab looks in the Settings menu: a highlight with a colored bar on the left like Roblox, or just the highlight.'), options: [['fill', LT('Highlight only')], ['bar', LT('Bar and highlight')]] },
        ] },
      ],
    },
    classic: {
      intro: LT('Bring back the old Roblox look: the old logo and icons, the old names and classic faces.'),
      groups: [
        { title: LT('Logo & Icons'), rows: [
          { key: 'classicLogo', title: LT('Classic Roblox Logo'), desc: LT('The old red and white ROBLOX logo in the top left corner instead of today’s logo.') },
          { key: 'classicPremium', title: LT('Classic Premium Icon'), desc: LT('The old Premium icon next to names instead of the Roblox Plus icon.') },
          { key: 'classicVerified', title: LT('Classic Verified Badge'), desc: LT('The original verified badge next to names, with sharp corners and the brighter blue.') },
          { key: 'classicFaceThumbs', title: LT('Classic Face Thumbnails'), desc: LT('Classic faces show their flat face image on item pages again, instead of the head render Roblox uses now.') },
        ] },
        { title: LT('Old Names'), rows: [
          { key: 'classicNames', title: LT('Classic Names'), desc: LT('The old Roblox names in the menus, headings and tab titles. Pick which ones below.') },
          { key: 'classicGames', parent: 'classicNames', title: LT('Games'), desc: LT('Charts and Experiences are called Games.') },
          { key: 'classicCatalog', parent: 'classicNames', title: LT('Catalog'), desc: LT('The Marketplace is called the Catalog.') },
          { key: 'classicDevelop', parent: 'classicNames', title: LT('Develop'), desc: LT('Create in the top bar is called Develop.') },
          { key: 'classicGroups', parent: 'classicNames', title: LT('Groups'), desc: LT('Communities are called Groups.') },
          { key: 'classicPackages', parent: 'classicNames', title: LT('Packages'), desc: LT('Bundles are called Packages.') },
        ] },
      ],
    },
    chat: {
      intro: LT('The Chat in the bottom right corner and your Messages inbox.'),
      groups: [
        { title: LT('Chat'), rows: [
          { key: 'chatBot', title: LT('RoUtility Bot'), desc: LT('A RoUtility chat at the top of your Chat list. Ask it what a limited is worth, paste a trade to see if it’s a win, or ask how to do something and it finds the right feature. Only you can see it.') },
          { key: 'chatResize', title: LT('Resizable Chat'), desc: LT('Drag the top left corner of a chat window to make it bigger. Every chat window, the RoUtility Bot included, uses the same size. Double-click the corner to reset.') },
          { key: 'hideChat', title: LT('Hide Chat'), desc: LT('Removes the Chat bar from the bottom right corner of the website.') },
        ] },
        { title: LT('Messages'), rows: [
          { key: 'messageTools', title: LT('Message Tools'), desc: LT('Mark All as Read and Archive All Read on your Messages page, for every page of your inbox at once, plus your unread count next to the title. Archived messages stay in the Archive tab.') },
        ] },
      ],
    },
    streamer: {
      intro: LT('Hide private details while you stream or share your screen.'),
      groups: [
        { title: LT('Streamer Mode'), rows: [
          { key: 'streamerMode', title: LT('Streamer Mode'), desc: LT('Blurs private details while you stream or share your screen. Hover over anything blurred to peek.') },
          { key: 'streamerRobux', parent: 'streamerMode', title: LT('Robux & Credit'), desc: LT('Your Robux balance and credit in the top bar.') },
          { key: 'streamerAccount', parent: 'streamerMode', title: LT('Account Info'), desc: LT('Email, phone, birthday, location, names, previous usernames, social links and the locations of your logged-in devices in Settings.') },
          { key: 'streamerPayment', parent: 'streamerMode', title: LT('Payment Info'), desc: LT('Saved cards, PayPal, billing email and address, Roblox Credit and gift card details on the Payments page.') },
          { key: 'streamerName', parent: 'streamerMode', title: LT('Your Name'), desc: LT('Your name in the top bar, the side menu and the Home greeting.') },
          { key: 'streamerAvatar', parent: 'streamerMode', title: LT('Your Avatar'), desc: LT('Your headshot in the top bar, the side menu and the Home greeting, and your avatar on your own profile and in the avatar editor.') },
          { key: 'streamerValues', parent: 'streamerMode', title: LT('Item Values'), desc: LT('RoUtility values of your avatar in the editor and the value pills on profiles.') },
        ] },
      ],
    },
    search: {
      intro: LT('Extra results in the Roblox search box at the top of every page and on the people search page.'),
      groups: [
        { title: LT('Search Box'), rows: [
          { key: 'richSearch', title: LT('Rich Search Results'), desc: LT('Extra results at the top of the Roblox search box.') },
          { key: 'searchSlash', title: LT('Press / to Search'), desc: LT('Jump to the search box from anywhere on Roblox. Use the arrow keys to move through results.') },
        ] },
        { title: LT('What Shows Up'), note: LT('Needs Rich Search Results'), rows: [
          { key: 'searchPeople', parent: 'richSearch', title: LT('People'), desc: LT('Matching players with their avatar and verified badge.') },
          { key: 'searchFriends', parent: 'richSearch', title: LT('Friends First'), desc: LT('Friends whose name contains what you type, shown first.') },
          { key: 'searchGames', parent: 'richSearch', title: LT('Top Game'), desc: LT('The best matching experience with its rating and players.') },
          { key: 'searchItems', parent: 'richSearch', title: LT('RoUtility Limiteds'), desc: LT('Matching limiteds with their price and RAP.') },
        ] },
        { title: LT('People Search'), rows: [
          { key: 'searchTerminated', title: LT('Terminated Players'), desc: LT('Roblox leaves banned accounts out of search. When the name you search belongs to a terminated account, it shows first with a Terminated label, on the people search page and in the search box, and opens their profile.') },
        ] },
      ],
    },
    menu: {
      intro: LT('The sidebar on the left: put its links in the order you like and hide the ones you don’t use, bring back the old one, collapse it and add Quick Settings under it.'),
      groups: [
        { title: LT('Layout'), rows: [
          { key: 'oldLeftNav', title: LT('Old Sidebar'), desc: LT('Roblox is moving accounts to a new left menu. This brings back the old one, with Trade Calculator, Trade Ads, Forum, the Collapse button, Quick Settings and your arranged order below. Menu sizes only work on the new menu.') },
          { custom: 'navLayout', title: LT('Arrange the Sidebar'), desc: LT('Reorder or hide Home, Messages, Newsroom, Official Store, Trade Calculator, Forum and the rest.') },
          { key: 'navCollapse', title: LT('Collapse Button'), desc: LT('A Collapse button at the bottom of the menu that shrinks it to just its icons, giving pages more room. Hover an icon for its name. Click it again to expand.') },
        ] },
        { title: LT('Under the Menu'), rows: [
          { key: 'quickSettings', title: LT('Quick Settings'), desc: LT('Who can join you and who can see you online, right under the menu on the left. Changes save to your Roblox privacy settings straight away.') },
          { key: 'qsJoins', parent: 'quickSettings', title: LT('Show Joins'), desc: LT('Who can join you in experiences.') },
          { key: 'qsOnline', parent: 'quickSettings', title: LT('Show Online Status'), desc: LT('Who can see when you’re online.') },
          { key: 'qsRotator', parent: 'quickSettings', title: LT('Show Outfit Rotator'), desc: LT('Shows while the Outfit Rotator is on, so you can stop it or open it from any page.') },
          { key: 'qsStreamer', parent: 'quickSettings', title: LT('Show Streamer Mode'), desc: LT('Turn Streamer Mode on or off from any page.') },
        ] },
      ],
    },
    home: {
      intro: LT('The Home page and Charts: what shows up and in what order.'),
      groups: [
        { title: LT('Home'), rows: [
          { key: 'homeGreeting', title: LT('Classic Greeting'), desc: LT('“Hello, your name!” with your avatar at the top of Home, the way Roblox used to welcome you back.') },
          { key: 'playtime', parent: 'homeGreeting', title: LT('Playtime Tracker'), desc: LT('Your most played experiences next to the greeting, for today, 7 days, 30 days or all time, and your playtime on each experience’s page. Counts a minute whenever you’re in an experience while a Roblox tab is open in Chrome. Click Back Up to save it to your RoUtility account, so it comes back if you reinstall.') },
          { key: 'friendsPlaying', title: LT('Friends Playing'), desc: LT('A row on Home with the experiences your friends are in right now, most friends first, with their avatars on each tile. Updates every minute.') },
          { key: 'recentlyUpdated', title: LT('Recently Updated'), desc: LT('A Home row with your favorite and recently played experiences, newest update first. A dot marks the ones that changed since you last opened them.') },
          { key: 'genreFilters', title: LT('Genre Filters'), desc: LT('Genre chips under the Charts title. Pick one, like Obby & Platformer, to only see those experiences in every chart, then narrow it down with its subgenres.') },
          { key: 'notInterested', title: LT('Not Interested'), desc: LT('Roblox’s ⋯ tile menu with “Not interested” on every experience in Home and Charts, not just the big tiles. Undo right after, or bring them back below.') },
          { key: 'hideSponsored', title: LT('Hide Sponsored'), desc: LT('Hides sponsored experiences on Home and in game lists.') },
        ] },
        { title: LT('Charts'), rows: [
          { key: 'randomGame', title: LT('Random Experience'), desc: LT('A button on Charts that opens a random experience from the page, for when you can’t decide.') },
          { key: 'rollSounds', parent: 'randomGame', title: LT('Roll Sounds'), desc: LT('A soft tick for each hop and a little chime when it lands.') },
        ] },
        { title: LT('Layout'), rows: [
          { key: 'homeLayout', title: LT('Arrange Home & Charts'), desc: LT('A Customize button on Home and Charts: move sections like Continue, Recommended For You or Top Trending up or down, or hide them. You can also do it right here.') },
          { custom: 'layoutPreview' },
        ] },
      ],
    },
    profiles: {
      intro: LT('Extras on player profiles, and previews when you hover a player anywhere.'),
      groups: [
        { title: LT('Profile Page'), rows: [
          { key: 'classicProfile', title: LT('Classic Profile Layout'), desc: LT('The 2022 profile layout, in your current theme.') },
          { key: 'classicLayout', parent: 'classicProfile', title: LT('Layout'), desc: LT('Tabs keeps About and Creations in two tabs. Two Columns shows About, badges and communities on the left, and experiences, friends and favorites on the right.'), options: [['tabs', LT('Tabs')], ['columns', LT('Two Columns')]] },
          { key: 'exactCounts', title: LT('Exact Follower Counts'), desc: LT('Full follower and following numbers on profiles, like 16,734,201 instead of 16.7M.') },
          { key: 'gearFix', title: LT('Gear in Currently Wearing'), desc: LT('Roblox leaves equipped gear out of Currently Wearing when the player’s inventory is public. RoUtility adds it back. The classic layout already shows it.') },
          { key: 'mutualFriends', title: LT('Mutual Friends'), desc: LT('Friends you have in common, next to the friend counts on profiles. Click it for the list.') },
          { key: 'placeVisits', title: LT('Place Visits'), desc: LT('Total visits across someone’s public experiences, next to their followers on profiles.') },
          { key: 'mutualGroups', title: LT('Mutual Communities'), desc: LT('Communities you’re both in, next to mutual friends on profiles. Click it for the list.') },
          { key: 'userOutfits', title: LT('Saved Outfits'), desc: LT('The outfits a player has saved, in a section under Currently Wearing. Click one to see everything in it.') },
        ] },
        { title: LT('Everywhere'), rows: [
          { key: 'profilePreviews', title: LT('Profile Previews'), desc: LT('Hover over a player’s name or avatar anywhere on Roblox to see their status, friends, followers, join date, how long you’ve been friends and bio.') },
        ] },
      ],
    },
    friends: {
      intro: LT('Your friends list, other players’ friend lists and friend requests.'),
      groups: [
        { title: LT('Friends List'), rows: [
          { key: 'friendFilters', title: LT('Friend Filters'), desc: LT('More chips next to All and Trusted on your friends list: Verified, Roblox Plus, Admin and Online, across all your friends, not just one page.') },
          { key: 'friendManage', title: LT('Manage Friends'), desc: LT('A Manage button on your friends list: search, filter by Online, Offline, Verified or Terminated, and unfriend several at once with a confirm step. Requests go one at a time.') },
          { key: 'hiddenFriends', title: LT('Hidden Friend Lists'), desc: LT('When Roblox hides someone’s friends, load them from RoUtility. Sends that profile’s ID to RoUtility.') },
          { key: 'revealTerminated', title: LT('Reveal Terminated Accounts'), desc: LT('Show the real name behind Account Deleted friends and open their profile.') },
          { key: 'friendsSince', title: LT('Friends Since'), desc: LT('The date under every card on any Friends list, yours or someone else’s, showing when those two became friends. Hover it to see how long ago that was. Roblox doesn’t keep a date for follows, so there isn’t one for those.') },
          { key: 'friendCardMenu', title: LT('Friend Card Menu'), desc: LT('The three-dot menu Roblox only shows on terminated friends, on every card on your friends list, with Unfriend and Block. Block asks first.') },
        ] },
        { title: LT('Requests'), rows: [
          { key: 'requestFilters', title: LT('Friend Request Filters'), desc: LT('A Filter button on Requests: badges (Verified, Roblox Plus, Premium, Admin), mutual friends, friend and follower counts and join date, across all your requests. Matches show as they are found, and Ignore Matches declines only the filtered ones.') },
          { key: 'cancelRequests', title: LT('Cancel Sent Requests'), desc: LT('A Cancel Request button next to Pending on the profile of someone you sent a friend request to. Click it twice to withdraw the request.') },
        ] },
        { title: LT('Alerts'), rows: [
          { key: 'unfriendDetector', title: LT('Unfriend Detector'), desc: LT('While Roblox is open, checks your friends list about once a minute and pops up a list when someone is no longer on it, with who and when it was noticed. Your friends page shows a banner too. People you remove through RoUtility are left out. Stored only on this device.') },
        ] },
      ],
    },
    games: {
      intro: LT('Experience pages, the Servers tab and joining games.'),
      groups: [
        { title: LT('Game Pages'), rows: [
          { key: 'gameStats', title: LT('Exact Live Stats'), desc: LT('Full visit counts instead of 44.9B+, live player and visit counts that update every 30 seconds, and how long ago the game was updated.') },
          { key: 'gameUnavailable', title: LT('Unavailable Game Details'), desc: LT('When Roblox says an experience is not accessible, like a private or taken down game, RoUtility shows what it can still find: name, creator, why it’s unavailable, favorites, likes, description, badges and passes.') },
          { key: 'gameAvatarType', title: LT('Avatar Type'), desc: LT('An Avatar Type row next to Server Size: whether the game makes everyone R6, R15, or lets players pick. Roblox doesn’t show it on the page.') },
          { key: 'stopTrailers', title: LT('Stop Trailer Autoplay'), desc: LT('Game trailers at the top of experience pages stay paused until you press play.') },
          { key: 'storeTotal', title: LT('Store Total'), desc: LT('What every pass in a game’s Store costs together, next to Passes.') },
          { key: 'devProducts', title: LT('Developer Products'), desc: LT('A Developer Products row in a game’s Store with everything it sells inside the experience, like coins and boosts, and their prices.') },
          { key: 'creatorItems', title: LT('Creator’s Avatar Items'), desc: LT('An Avatar Items row in a game’s Store with clothing and accessories made by the game’s creator.') },
        ] },
        { title: LT('Servers'), rows: [
          { custom: 'serverLayout', title: LT('Arrange the Servers Tab'), desc: LT('Reorder or hide Your Private Servers, Server Regions, Servers My Friends Are In and Other Servers.') },
          { key: 'serverStats', title: LT('Server Ping & Invite Links'), desc: LT('Each server in the Servers tab shows its ping, performance and a button that copies an invite to that exact server.') },
          { key: 'serverRegions', parent: 'serverStats', title: LT('Server Regions'), desc: LT('Where each server is, a world map of every server in the game, and lists of servers per region. Sends the game and the server ids on screen to RoUtility to look them up, and the server you join when you press Play so the launch window can show its region. No account details are sent.') },
          { custom: 'preferredRegion', parent: 'serverRegions' },
          { key: 'playRegionTag', parent: 'serverRegions', title: LT('Region Under Play'), desc: LT('A small button under the Play button that shows where Play takes you, a region or Roblox picks. Click it to change.') },
          { key: 'avoidFriends', parent: 'serverStats', title: LT('Avoid Friends’ Servers'), desc: LT('When you press Play, join a server none of your online friends are in. Also in the menu under the Play button.') },
          { key: 'privateServerToggle', title: LT('Collapse Private Servers'), desc: LT('A Hide / Show link on “Your private servers” in the Servers tab, so the public servers come first. Remembers your choice.') },
        ] },
        { title: LT('Joining'), rows: [
          { key: 'launchDetails', title: LT('RoUtility Launch Window'), desc: LT('Use RoUtility’s launch window instead of Roblox’s when you press Play or Join: the spinning Roblox logo, and the server’s region, players, ping, uptime and version whenever we know which server you’re joining. Off keeps Roblox’s own window.') },
        ] },
      ],
    },
    badges: {
      intro: LT('Badge pages, your progress on a game’s badges and when badges were earned.'),
      groups: [
        { title: LT('Badges'), rows: [
          { key: 'badgeStats', title: LT('Badge Stats'), desc: LT('Rarity with its difficulty, how many people won it yesterday and in total, back on every badge page.') },
          { key: 'badgeProgress', title: LT('Badge Progress'), desc: LT('How many of a game’s badges you own, with an Owned tag and earned date on each badge.') },
          { key: 'badgeTools', title: LT('Badge Search & Sort'), desc: LT('Search a game’s badges and sort them by rarity, newest or most won yesterday, or show only the ones you don’t own yet. Lists every badge, not just the first few.') },
          { key: 'badgeDates', title: LT('Badge Earned Dates'), desc: LT('When each badge was earned, under it on anyone’s profile and in their inventory’s Badges tab. Hover it for the time.') },
          { key: 'badgeManage', title: LT('Manage Badges'), desc: LT('A Manage button on your Badges in your inventory: search, filter by experience or rarity, and delete the badges you pick, with a confirm step.'), keywords: 'badge badges delete remove clean manage' },
          { key: 'badgeAutoDelete', parent: 'badgeManage', title: LT('Delete New Badges Automatically'), desc: LT('Removes badges you earn from now on, a few minutes after you get them, while a Roblox tab is open. Badges you already have stay.'), keywords: 'badge badges delete remove auto automatic new' },
        ] },
      ],
    },
    avatar: {
      intro: LT('Tools for the avatar editor.'),
      groups: [
        { title: LT('Finding Items'), rows: [
          { key: 'avatarRemember', title: LT('Remember Last Section'), desc: LT('Opens the editor where you left off, like Accessories > Head, instead of Recent every time.') },
          { key: 'avatarSearch', title: LT('Item Search'), desc: LT('A search box above your items, by name or asset ID. Its label follows the section you’re in.') },
          { key: 'hideMakeup', title: LT('Hide Makeup Tab'), desc: LT('Removes the Makeup tab so the other tabs fit without scrolling.') },
        ] },
        { title: LT('Preview'), rows: [
          { key: 'avatarSticky', title: LT('Keep Avatar in View'), desc: LT('Your avatar, its settings and the Wearing panel stay on screen while you scroll through items.') },
          { key: 'avatarRig', title: LT('R6 / R15 Switch'), desc: LT('Switch between R6 and R15 right under your avatar, without opening Body > Scale. Also stops the switch flickering while the editor loads.') },
          { key: 'skipR6Warning', title: LT('Skip R6 Warning'), desc: LT('Switching to R6 skips Roblox’s “R6 characters have limitations” warning and switches right away. Items R6 can’t wear still come off.') },
          { key: 'keepR6', title: LT('Keep R6 With Dynamic Heads'), desc: LT('Equip dynamic heads and faces without the editor switching you to R15, and keep R6 in Avatar Preview. Off by default: some experiences show dynamic heads differently on R6.') },
        ] },
        { title: LT('Customize'), rows: [
          { key: 'accessoryAdjust', title: LT('Adjust Accessories'), desc: LT('An Adjust Accessories button under your avatar to move, rotate and resize hats and other accessories like in the Roblox app, with a 3D preview you can spin around. Saves to your avatar, within Roblox’s limits.') },
          { key: 'outfitRotator', title: LT('Outfit Rotator'), desc: LT('An Outfit Rotator button next to Create New Character that switches your avatar between characters you pick, every few minutes up to once a day, in order or shuffled. Runs while a Roblox tab is open and waits while the avatar editor is open.'), keywords: 'outfit rotate rotator cycle switch avatar characters costumes' },
          { key: 'thumbCustomize', title: LT('Customize Thumbnail'), desc: LT('A Customize Thumbnail button under your avatar. Pose your full body and headshot thumbnails with one of your emotes and set the field of view, rotation and headshot distance. Roblox’s app has this, the website doesn’t. Changes show on your profile once Roblox redraws them.') },
          { key: 'skinWheel', title: LT('Skin Tone Color Wheel'), desc: LT('A color wheel, a brightness slider and Pick From Screen under Hex Color in Body > Skin Tone > Advanced, so you can pick any skin color, even one from your screen.') },
        ] },
        { title: LT('What You’re Wearing'), rows: [
          { key: 'avatarWearing', title: LT('Wearing Panel'), desc: LT('What your avatar has on, under the preview, with the price and R$ value of worn limiteds. Click an item to take it off.') },
          { key: 'avatarWearingValues', parent: 'avatarWearing', title: LT('Price and R$ Value'), desc: LT('The Price and R$ value of the limiteds you’re wearing, above your items. Off, the panel only shows what you have on.') },
          { key: 'avatarMoreAccessories', title: LT('Wear Up to 10 Accessories'), desc: LT('Wear up to 10 accessories, like 4 hats or 2 face accessories, with a normal click instead of Roblox swapping one out.') },
        ] },
        { title: LT('Free Items'), rows: [
          { custom: 'freeItems', title: LT('Get Every Free Roblox Item'), desc: LT('Adds every free item Roblox made in the Marketplace to your inventory, like classic faces, hats, clothes, bundles and emotes. Skips what you already own and never spends Robux. It goes one item every couple of seconds, so keep this tab open while it runs.') },
        ] },
      ],
    },
    account: {
      intro: LT('Extra details on your Roblox Settings pages: your devices, backup codes and voice chat.'),
      groups: [
        { title: LT('Security'), rows: [
          { key: 'sessionIps', title: LT('Device IP Addresses'), desc: LT('Under each device on Settings > Security, the IP address it last used, so a login you don’t recognize is easier to spot. Streamer Mode blurs it with the rest of the list.') },
          { key: 'backupCodeDate', title: LT('Backup Code Date'), desc: LT('When your 2-Step Verification backup codes were made, next to how many you have left.') },
        ] },
        { title: LT('Voice Chat'), rows: [
          { key: 'voiceStatus', title: LT('Voice Chat Suspension'), desc: LT('If your voice chat is suspended, Settings > Privacy says so and until when, instead of you finding out in a game.') },
        ] },
      ],
    },
    robux: {
      intro: LT('Your currency and Robux rate, your Robux balance, safer buying and your Transactions page.'),
      groups: [
        { title: LT('Money'), rows: [
          { key: 'currency', title: LT('Currency'), desc: LT('Show every price and dollar amount RoUtility adds in this currency, like on routility.io. Prices are still in USD underneath and convert at today’s exchange rate.'), options: [['USD', LT('US Dollar')], ['EUR', LT('Euro')], ['GBP', LT('British Pound')], ['CAD', LT('Canadian Dollar')], ['AUD', LT('Australian Dollar')], ['JPY', LT('Japanese Yen')], ['CNY', LT('Chinese Yuan')], ['KRW', LT('Korean Won')], ['INR', LT('Indian Rupee')], ['BRL', LT('Brazilian Real')], ['MXN', LT('Mexican Peso')], ['TRY', LT('Turkish Lira')]] },
          { key: 'calcRobux', title: LT('Your Robux Rate'), desc: LT('What 1,000 Robux are worth to you everywhere RoUtility turns Robux into money: price hovers, Transactions, Community Funds, the Creator Hub, trades and the Trade Calculator. Use the DevEx rate ($3.80 per 1,000) or your own, like the rate you sell Robux at.'), options: [['devex', LT('DevEx rate')], ['custom', LT('Custom rate')]], rateInput: 'custom' },
          { key: 'robuxUsd', title: LT('Robux in Your Currency'), desc: LT('Hover a Robux price, like a game pass or a catalog item, to see about what it’s worth in your currency. Uses your Robux rate.') },
        ] },
        { title: LT('Exact Numbers'), rows: [
          { key: 'exactRobux', title: LT('Exact Robux Balance'), desc: LT('Your full Robux balance in the top bar, like 122,369 instead of 122K+.') },
          { key: 'exactPrices', title: LT('Exact Robux Prices'), desc: LT('Full prices on inventory items, like 3,333,333 instead of 3M+.') },
        ] },
        { title: LT('Buying'), rows: [
          { key: 'purchaseLock', title: LT('Purchase Safety Lock'), desc: LT('Big purchases need you to hold the Buy button for a second, so a misclick can’t spend your Robux.') },
          { key: 'purchaseLockAt', parent: 'purchaseLock', title: LT('Lock Purchases From'), desc: LT('Purchases at or above this price need the hold.'), options: [['0', LT('Every purchase')], ['100', LT('100 Robux')], ['1000', LT('1,000 Robux')], ['10000', LT('10,000 Robux')], ['100000', LT('100,000 Robux')]] },
          { key: 'buyBalance', title: LT('Balance After Purchase'), desc: LT('Roblox’s Buy window shows how many Robux you’ll have left after the purchase, right above the Buy button.') },
        ] },
        { title: LT('Sending Robux'), rows: [
          { key: 'sendRobux', title: LT('Send Robux in the Browser'), desc: LT('Send Robux to a friend from their profile, or from the friends list on the Buy Robux page, without opening the Roblox app. Pick an amount, check who it’s going to, then send. Roblox still decides who you can send to and how much.') },
          { key: 'transferLimits', title: LT('Transfer Limits Left'), desc: LT('On Settings > Robux, how many Robux you’ve sent in the past day and month and how many you can still send, plus the limit for a single transfer.') },
        ] },
        { title: LT('Roblox Plus'), rows: [
          { key: 'plusDetails', title: LT('Plus Details'), desc: LT('On the Roblox Plus page: when Plus renews, the price and where you’re billed, when your next discount unlocks, what your Plus savings are worth in your currency and what Plus has cost you so far.') },
        ] },
        { title: LT('Transactions'), rows: [
          { key: 'txUsd', title: LT('Money Amounts'), desc: LT('About what every amount on My Transactions is worth in your currency, plus a Net line under the summary showing what you made or spent overall. Uses your Robux rate.') },
          { key: 'txFilters', title: LT('Transaction Filters'), desc: LT('Filter any transaction list by amount, community or user, item or experience, and pending or completed, with the Robux total of the matches. Pick Sales and an item to see what it’s earned. Roblox only hands out 100 transactions at a time, so matches show up as RoUtility checks further back.') },
          { key: 'txExport', title: LT('Export to CSV'), desc: LT('A button on any transaction list that downloads every row of that type, not just the page you’re on, as a spreadsheet.') },
        ] },
      ],
    },
    items: {
      intro: LT('Prices, tags, charts, resellers and owners on limited items.'),
      groups: [
        { title: LT('Marketplace Search'), rows: [
          { key: 'catalogRobloxOnly', title: LT('Only Roblox Items'), desc: LT('Every Marketplace search starts with the Creator filter set to Roblox, so you see Roblox’s own items and none of the UGC. Switch the filter to All Creators to see everything for that search.') },
        ] },
        { title: LT('Item Page Values'), rows: [
          { key: 'itemPrices', title: LT('Limited Values'), desc: LT('Values from routility.io on limited item pages. Pick the lines you want below.') },
          { key: 'itemUsd', parent: 'itemPrices', title: LT('RoUtility Price'), desc: LT('What the item is worth in your currency, next to its Robux price. Hover it for the RoUtility Value when the item has one.') },
          { key: 'itemDemand', parent: 'itemPrices', title: LT('Demand'), desc: LT('How much traders want it, like High or Terrible.') },
          { key: 'itemTrend', parent: 'itemPrices', title: LT('Trend'), desc: LT('Whether its value is Raising, Stable or Lowering.') },
          { key: 'itemCopies', parent: 'itemPrices', title: LT('Copies'), desc: LT('How many copies of it exist.') },
          { key: 'itemHoardStats', parent: 'itemPrices', title: LT('Premium Copies & Hoarded'), desc: LT('How many copies Premium members hold, and how much of the item is hoarded.') },
          { key: 'itemChange', parent: 'itemPrices', title: LT('Price Change'), desc: LT('How much its RoUtility price moved in the last 30 days, like +$120 (8%) in 30 days.') },
          { key: 'itemOwnedRow', parent: 'itemPrices', title: LT('You Own'), desc: LT('How many copies you own, with their serial numbers.') },
        ] },
        { title: LT('Item Page Extras'), rows: [
          { key: 'itemSize', title: LT('Size'), desc: LT('A Size line on accessory pages with how big the accessory really is in studs, like 1.6 × 0.6 × 1.6 studs, so you can spot oversized ones before you buy.') },
          { key: 'lastOnSale', title: LT('Last On Sale'), desc: LT('A Last On Sale line on off-sale items: the last price Roblox sold it for and when its listing last changed, like Jun 5, 2024 for R$ 250.') },
          { key: 'itemAcquired', title: LT('Acquired'), desc: LT('An Acquired line on item pages for things you own, like Oct 1, 2026 · 9 days ago.') },
          { key: 'friendsOwn', title: LT('Friends Who Own It'), desc: LT('A chip on item pages with how many of your friends own the item. Click it for the list.') },
        ] },
        { title: LT('Prices & Chart'), rows: [
          { key: 'marketplaceValues', title: LT('Marketplace Prices'), desc: LT('The RoUtility price under the Robux price on limited items in the Marketplace.') },
          { key: 'usdChart', title: LT('Price Chart in Your Currency'), desc: LT('A switch between Robux and your currency on the Price Chart.') },
          { key: 'itemTags', title: LT('Rare & Projected Tags'), desc: LT('Flags rare items and items whose RAP is pushed up by recent sales, on item pages, trades, the Marketplace and the calculator.') },
          { key: 'itemSimilar', title: LT('Similar Price'), desc: LT('A row of limiteds worth about the same, above Recommendations on item pages.') },
        ] },
        { title: LT('Try On & Explore'), rows: [
          { key: 'avatarPreview', title: LT('Avatar Preview'), desc: LT('A Preview button next to Try On that shows the item on your avatar in 3D. Drag to turn it, switch R6 / R15, and take your worn items on or off.') },
          { key: 'tryOnKeepWorn', title: LT('Keep Your Hats on Try On'), desc: LT('Roblox’s Try On on item pages keeps the hats and accessories you’re wearing instead of taking them all off, up to 10 accessories.') },
          { key: 'itemExplorer', title: LT('Explorer'), desc: LT('A button on item pages that opens the item like Roblox Studio would: its Explorer tree and every property, with links to its meshes and textures, and a download of the model file.') },
        ] },
        { title: LT('Resellers & Owners'), rows: [
          { key: 'resellerDeals', title: LT('Reseller Deals'), desc: LT('How far each reseller listing is under or over RAP.') },
          { key: 'owners', title: LT('Owners List'), desc: LT('Owners view next to Resellers, with Plus/Premium, All and Hoards filters.') },
        ] },
      ],
    },
    inventory: {
      intro: LT('Values, search and the real order in inventories, favorites and badges.'),
      groups: [
        { title: LT('Values'), rows: [
          { key: 'inventoryValues', title: LT('Inventory Values'), desc: LT('RoUtility prices on inventory and profile items, and a value pill on profiles.') },
          { key: 'ownedSince', title: LT('How Long They’ve Owned It'), desc: LT('How long each item has been in anyone’s inventory, next to its creator, like By Roblox · 3y. Hover it for the exact date.') },
        ] },
        { title: LT('Finding Things'), rows: [
          { key: 'inventorySearch', title: LT('Inventory Search'), desc: LT('Search a whole inventory category by name or asset ID, not just the current page.') },
          { key: 'listOrder', title: LT('Fix Shuffled Order'), desc: LT('Puts favorites and badges on other people’s pages back in their real order. Roblox currently shows them shuffled.') },
        ] },
      ],
    },
    trading: {
      intro: LT('Values, previews and safety checks for every trade you send or receive, plus trade ads from routility.io.'),
      groups: [
        { title: LT('Values'), rows: [
          { key: 'tradeValues', title: LT('Trade Values'), desc: LT('Prices on trade items, totals for each side, the RAP and value difference pills between the two sides, and RAP and price pills on the trade list.') },
          { key: 'tradeOwnership', title: LT('Ownership Check'), desc: LT('Warns when someone in a trade no longer owns an item they put in it, and marks that item.') },
          { key: 'tradeItemCard', title: LT('Item Cards'), desc: LT('Hover over an item in a trade to see its value, a 30-day chart, RAP, demand, trend and copies.') },
          { key: 'itemCardEverywhere', parent: 'tradeItemCard', title: LT('Item Cards Everywhere'), desc: LT('The same hover card on limited items in the Marketplace, inventories and profiles, not just trades.') },
        ] },
        { title: LT('Trade List'), rows: [
          { key: 'tradePreview', title: LT('Trade Previews'), desc: LT('Pause on a trade in the list to see both sides’ items, their value and the difference without opening it.') },
          { key: 'tradeProof', title: LT('Proof Button'), desc: LT('A Proof button on trades: a clean picture of the trade plus the text for a value request on the RoUtility Discord, filled in and ready to copy. Hide prices or RAP in the picture if you want.') },
          { key: 'tradeFilter', title: LT('Search Trades by Item'), desc: LT('A search box above the trade list that finds every trade with the item you type, loading older trades as it goes.') },
          { key: 'tradeAge', title: LT('Trade Age'), desc: LT('How long ago each trade was sent on the trade list. Hover it for the exact time and when it expires.') },
          { key: 'tradeKeys', title: LT('Arrow Keys'), desc: LT('Press ↑ and ↓ to move between trades in the list.') },
          { key: 'tradeCleanup', title: LT('Clean Up Trades'), desc: LT('A button next to Trades that declines or cancels a batch of trades at once: the ones you overpay in, the ones with items someone no longer owns, or all of them. It shows the list and asks before doing anything.') },
        ] },
        { title: LT('Before You Send'), rows: [
          { key: 'tradeSort', title: LT('Sort Trade Inventories by Price'), desc: LT('When you make or counter a trade, both inventories open with the most valuable items first, so the best items are always on page one. Big inventories take a few extra seconds to load.') },
          { key: 'tradeSendSummary', title: LT('Send Offer Summary'), desc: LT('When you press Make Offer, the confirm window shows what each side is worth (value and RAP) and the difference. If you’d overpay past your warning level, you tick “I’ve reviewed this trade” before Send works.') },
          { key: 'tradeWarning', title: LT('Overpay Warning'), desc: LT('A warning while you build or counter a trade where you give a lot more value than you get.') },
          { key: 'tradeWarnAt', parent: 'tradeWarning', title: LT('Warn When I Give'), desc: LT('How much more than the other side your offer has to be worth before the warning shows.'), options: [['10', LT('10% more')], ['15', LT('15% more')], ['25', LT('25% more')], ['50', LT('50% more')]] },
        ] },
        { title: LT('Trade Ads'), rows: [
          { key: 'tradeAds', title: LT('Trade Ads'), desc: LT('A Trade Ads page at roblox.com/trade-ads: see what people are offering and asking for, with values, and send them a trade in one click. Post your own ad from your limiteds after signing in with Roblox.') },
          { key: 'tradeAdsNav', parent: 'tradeAds', title: LT('Trade Ads in the Menu'), desc: LT('A Trade Ads link in the left menu, under Trade.') },
        ] },
      ],
    },
    calculator: {
      intro: LT('A Trade Calculator page to build and compare any trade, plus how it works.'),
      groups: [
        { title: LT('Calculator'), rows: [
          { key: 'tradeCalculator', title: LT('Trade Calculator'), desc: LT('A Trade Calculator page: build both sides from every limited or a player’s inventory, add Robux or cash, and compare RAP, price and the verdict.') },
          { key: 'calcLinks', parent: 'tradeCalculator', title: LT('Item Page Link'), desc: LT('A “Value it in the Trade Calculator” link on limited item pages.') },
          { key: 'calcRemember', parent: 'tradeCalculator', title: LT('Remember Last Trade'), desc: LT('Your last trade is still there when you come back. Off, the calculator starts empty every time.') },
        ] },
        { title: LT('Values'), note: LT('Needs Trade Calculator'), rows: [
          { key: 'calcVerdict', parent: 'tradeCalculator', title: LT('Verdict Based On'), desc: LT('Whether the verdict compares the price estimate or RAP.'), options: [['usd', LT('Price est.')], ['rap', 'RAP']] },
          { key: 'calcRobuxRap', parent: 'tradeCalculator', title: LT('Robux in the Price'), desc: LT('Robux you add to a side count toward the price estimate at your Robux rate, which you can change under Robux. Off, Robux only count toward RAP.') },
          { key: 'calcPercents', parent: 'tradeCalculator', title: LT('Percentages'), desc: LT('How much more one side is worth, in %, next to the differences and the verdict.') },
          { key: 'calcEven', parent: 'tradeCalculator', title: LT('Even It Out'), desc: LT('Suggests items that would close the gap when one side is worth more.') },
        ] },
        { title: LT('Layout'), note: LT('Needs Trade Calculator'), rows: [
          { key: 'calcSort', parent: 'tradeCalculator', title: LT('Sort Items By'), desc: LT('How the item browser is sorted when you open the calculator.'), options: [['usd-desc', LT('Price (High)')], ['usd-asc', LT('Price (Low)')], ['rap-desc', LT('RAP (High)')], ['rap-asc', LT('RAP (Low)')], ['name-asc', LT('Name (A-Z)')]] },
          { key: 'calcSlots', parent: 'tradeCalculator', title: LT('Starting Slots'), desc: LT('How many slots each side starts with. You can still add or remove slots.'), options: [['4', LT('4 slots')], ['8', LT('8 slots')], ['12', LT('12 slots')]] },
          { key: 'calcShot', parent: 'tradeCalculator', title: LT('Screenshot Button'), desc: LT('Show a preview with Copy and Download, or copy the image straight away.'), options: [['preview', LT('Show preview')], ['copy', LT('Copy straight away')]] },
        ] },
      ],
    },
    forum: {
      intro: LT('Roblox shut its forums down in 2017. RoUtility brings them back: threads, replies, Top Posters and moderators, right on roblox.com.'),
      groups: [
        { title: LT('Forum'), rows: [
          { key: 'forum', title: LT('RoUtility Forum'), desc: LT('The good old days are back. The classic Roblox forum lives again at roblox.com/forum, the way it used to be: Off Topic, Let’s Make a Deal, Scripters and more.') },
          { key: 'forumTopLink', parent: 'forum', title: LT('Forum in the Top Bar'), desc: LT('Forum back in the top bar where it belongs, taking Robux’s spot.') },
        ] },
        { title: LT('Look'), rows: [
          { key: 'forumStyle', parent: 'forum', title: LT('Style'), desc: LT('Modern, or Classic 2017: the old forum’s blue header bars, big light titles and Source Sans, in your Roblox theme’s colors. Also under Customize on the forum.'), options: [['modern', LT('Modern')], ['classic', LT('Classic 2017')]] },
          { key: 'forumDensity', parent: 'forum', title: LT('Density'), desc: LT('How much room rows and posts get.'), options: [['comfortable', LT('Comfortable')], ['compact', LT('Compact')]] },
          { key: 'forumAvatars', parent: 'forum', title: LT('Avatars'), desc: LT('Full-body avatars like the old forum, round headshots, or none.'), options: [['full', LT('Full Body')], ['headshot', LT('Headshot')], ['off', LT('Off')]] },
        ] },
        { title: LT('Poster Stats'), rows: [
          { key: 'forumStatJoined', parent: 'forum', title: LT('Joined'), desc: LT('When the poster made their Roblox account.') },
          { key: 'forumStatPosts', parent: 'forum', title: LT('Total Posts'), desc: LT('How many posts they’ve made on the forum.') },
          { key: 'forumStatValue', parent: 'forum', title: LT('Value'), desc: LT('Their limiteds’ price, the same blue pill as on profiles.') },
          { key: 'forumStatRap', parent: 'forum', title: LT('RAP'), desc: LT('Their limiteds’ total RAP, the same green pill as on profiles.') },
          { key: 'forumStatGroup', parent: 'forum', title: LT('Community'), desc: LT('Their primary community under their stats.') },
        ] },
      ],
    },
    communities: {
      intro: LT('Community pages, your list of communities and the Configure pages of the ones you run.'),
      groups: [
        { title: LT('Community Pages'), rows: [
          { key: 'groupFriends', title: LT('Friends in Community'), desc: LT('A Friends pill next to the member count with your friends who are in it. Your friends\u2019 communities are checked once and saved for a day, so it\u2019s instant after the first time.') },
          { key: 'groupDetails', title: LT('Exact Numbers'), desc: LT('The exact member count instead of 570.2K+, your rank number on your role, and on communities you run, Community Funds with what they’re worth in your currency.') },
          { key: 'groupFind', title: LT('Find a Member'), desc: LT('A search box in the Members list. Type a username to see if they’re in the community and what their role is, even in communities with millions of members.') },
          { key: 'groupCreated', title: LT('Created Date'), desc: LT('When the community was made, as a pill under its name. Handy for spotting brand new copycat or scam communities.') },
          { key: 'groupJoined', title: LT('Joined Date'), desc: LT('When you joined the community, as a pill under its name. To read it, RoUtility makes an API key named RoUtility on your Roblox account, with no permissions, used only from your browser.') },
          { key: 'groupHiddenGames', title: LT('Hidden Experiences'), desc: LT('Experiences a community owns that aren’t listed on its page, like test places and old games, in their own section under Experiences.') },
          { key: 'groupFullDesc', title: LT('Full Descriptions'), desc: LT('Shows a community’s whole description on its page, instead of three lines and a More button.') },
        ] },
        { title: LT('Your Communities'), rows: [
          { key: 'groupManage', title: LT('Manage My Communities'), desc: LT('A Manage link next to See All: search, sort by rank or size, filter Owned or Staff, and leave several at once with a confirm step.') },
          { key: 'groupCount', title: LT('Community Count'), desc: LT('How many communities you’re in out of how many you can join, under Communities in the side list.') },
          { key: 'groupAdmin', title: LT('Admin Tools'), desc: LT('On Configure: what Community Funds and Revenue are worth in your currency, and Export CSV on the Audit Log.') },
        ] },
      ],
    },
    notifications: {
      intro: LT('Desktop notifications from Chrome, even when Roblox isn’t open. New limiteds arrive live from RoUtility; trades are checked once a minute. Chrome has to be running.'),
      groups: [
        { title: LT('Trades'), rows: [
          { key: 'notifyInbound', title: LT('Trade Received'), desc: LT('Someone sent you a trade. Shows who and what each side is worth.') },
          { key: 'notifyOutbound', title: LT('Trade Sent'), desc: LT('A trade you sent, including ones sent from your phone.') },
          { key: 'notifyCompleted', title: LT('Trade Completed'), desc: LT('A trade went through.') },
          { key: 'notifyDeclined', title: LT('Trade Declined'), desc: LT('Someone declined a trade you sent.') },
        ] },
        { title: LT('Limiteds'), rows: [
          { key: 'notifyLimiteds', title: LT('New Roblox Limiteds'), desc: LT('The moment RoUtility spots a new Roblox limited, or a Roblox item that just went limited. Shows its price and how many copies there are.') },
          { key: 'notifyUgc', title: LT('New UGC Limiteds'), desc: LT('New UGC limiteds and UGC items that went limited. Free ones and ones with 5 copies or fewer are skipped, but there are still a lot, so it’s off by default.') },
        ] },
        { title: LT('Price Alerts'), rows: [
          { key: 'priceAlerts', title: LT('Price Alerts'), desc: LT('A Price Alert link under Best Price on limited items. Set a Robux price and get a notification when someone lists it at or below that. RoUtility never buys anything.') },
          { custom: 'priceAlertList', title: LT('Your Alerts'), desc: LT('Items you’re watching.') },
        ] },
        { title: LT('Check'), rows: [
          { custom: 'notifyTest', title: LT('Test Notification'), desc: LT('Sends a sample notification. If nothing shows up, notifications for Chrome are turned off in your computer’s settings.') },
        ] },
      ],
    },
    create: {
      intro: LT('Upgrades for create.roblox.com: the Creator Store, your experiences, your development items and your money.'),
      groups: [
        { title: LT('Creator Store'), rows: [
          { key: 'createScanner', title: LT('Script Scanner'), desc: LT('On model and plugin pages, RoUtility opens the file and checks every script for backdoor signs: require() by asset id, loadstring, getfenv, hidden text, web requests. The result shows in Roblox’s “contains scripts” bar as High Risk or to Review, and the Explorer button shows every script with the risky lines marked.') },
        ] },
        { title: LT('Dashboard'), rows: [
          { key: 'createIds', title: LT('Experience IDs'), desc: LT('Universe ID and Place ID with one-click copy on every experience overview, plus a Servers button.') },
          { key: 'createSafety', title: LT('Restriction Tags'), desc: LT('Tags on your experiences in Creations when Roblox restricts them, like Hidden from discovery or Updates blocked, so you know why a game isn’t showing up.') },
          { key: 'createDevItems', title: LT('Development Item Tools'), desc: LT('Hover a row in Development items to copy its rbxassetid://, open it in the Explorer, download the file or open it in the Store.') },
          { key: 'createUsd', title: LT('Robux in Your Currency'), desc: LT('About what Robux amounts are worth in your currency, at your Robux rate, like in Transactions.') },
        ] },
      ],
    },
    fun: {
      intro: LT('Just for fun. These only change what you see on your own screen: nobody else sees them, and nothing on your account changes.'),
      groups: [
        { title: LT('Robux'), rows: [
          { key: 'fakeRobux', title: LT('Fake Robux'), desc: LT('Show any Robux balance you want everywhere on Roblox: the top bar, the Robux menu and every purchase window, which uses it to work out what you can afford. Turn on Fake Purchases too if you want buying to be fake.') },
          { key: 'fakeRobuxMode', parent: 'fakeRobux', title: LT('Balance'), desc: LT('Pick any amount, or multiply the Robux you really have so it still moves with your real balance.'), options: [['amount', LT('Pick an amount')], ['10', LT('Your Robux × 10')], ['100', LT('Your Robux × 100')], ['1000', LT('Your Robux × 1,000')], ['10000', LT('Your Robux × 10,000')], ['100000', LT('Your Robux × 100,000')], ['1000000', LT('Your Robux × 1,000,000')]], robuxInput: 'amount', amountKey: 'fakeRobuxAmount' },
        ] },
        { title: LT('Purchases'), rows: [
          { key: 'fakeBuy', title: LT('Fake Purchases'), desc: LT('Buy items, bundles, game passes and developer products like normal, through Roblox’s own purchase window and Purchase Completed screen. Your balance goes down and the item shows as owned, in your inventory too, but no Robux are spent and nothing is added to your account. Hats and other accessories also show up in the Avatar editor, and you can put them on there. Only you see them on your avatar. Real item purchases are blocked while this is on.') },
          { custom: 'funItems', parent: 'fakeBuy', title: LT('Your Fake Items'), desc: LT('Everything you’ve fake bought. Remove one to get its Robux back.') },
          { key: 'funOutfits', parent: 'fakeBuy', title: LT('Fun Outfits'), desc: LT('A Fun Outfits button in the avatar editor’s Creations: save looks with items you don’t own yet, wear them again in Fun Mode, and see what they’d cost to buy for real.') },
        ] },
        { title: LT('Friends'), rows: [
          { key: 'fakeRequests', title: LT('Fake Friend Requests'), desc: LT('More friend requests on the Friends badge in the menu and the Add Friends tile on Home. Your real requests are added on top, so a new one still counts up by one. Like Roblox, the menu shows 500+ and Home shows 99+ once you go past them.') },
          { key: 'fakeRequestsAdd', parent: 'fakeRequests', title: LT('Extra Requests'), desc: LT('How many requests to add to your real ones.'), options: [['amount', LT('Pick an amount')], ['10', '+10'], ['50', '+50'], ['99', '+99'], ['500', '+500']], robuxInput: 'amount', amountKey: 'fakeRequestsAmount', amountLabel: LT('Extra Requests') },
        ] },
      ],
    },
  };

  const BLURBS = {
    items: LT('Prices, charts, resellers, owners'),
    inventory: LT('Values, search and the real order'),
    trading: LT('Trade values, previews, warnings, trade ads'),
    calculator: LT('Build and compare any trade'),
    forum: LT('The classic Roblox forum, back'),
    create: LT('Script scanner, IDs, downloads, Robux in your currency'),
    notifications: LT('Trades and new limiteds, on your desktop'),
    communities: LT('Friends inside, exact members, hidden experiences, admin tools'),
    profiles: LT('Classic layout, mutuals, saved outfits, previews'),
    friends: LT('Filters, admin badge, hidden lists'),
    avatar: LT('Item search, wearing panel, 10 accessories'),
    home: LT('Friends Playing, layout, random experience'),
    games: LT('Live stats, servers and regions, launch window'),
    search: LT('Players, games and limiteds in search'),
    menu: LT('Reorder or hide its links'),
    browsing: LT('Loading, status banner, name badges, right-click copy'),
    themes: LT('Your colors, presets and font'),
    classic: LT('Old logo, old names, classic faces'),
    account: LT('Device IPs, backup codes, voice chat'),
    chat: LT('RoUtility Bot, resizable chat, message tools'),
    streamer: LT('Blur your Robux, name and values on stream'),
    badges: LT('Badge stats, progress and earned dates'),
    robux: LT('Currency, exact Robux, safer buying, transactions'),
    fun: LT('Fake Robux and fake purchases'),
  };
  const ICONS = { notifications: 'bell', items: 'tag', trading: 'swap', calculator: 'calc', forum: 'forum', create: 'create', communities: 'people', profiles: 'person', friends: 'people', avatar: 'avatar', home: 'home', games: 'game', search: 'search', menu: 'menu', browsing: 'globe', themes: 'sparkle', chat: 'forum', streamer: 'person', badges: 'game', robux: 'tag', account: 'person', classic: 'sparkle', inventory: 'tag', fun: 'sparkle' };

  function keysOf(page) {
    return page.groups.flatMap(g => g.rows).filter(x => x.key && !x.options).map(x => x.key);
  }

  const OVERLAP = {
    RoPro: ['tradeValues', 'tradePreview', 'serverStats', 'serverRegions', 'mutualFriends', 'inventoryValues', 'itemPrices'],
    BTRoblox: ['itemExplorer', 'avatarPreview', 'exactCounts', 'classicProfile', 'avatarMoreAccessories', 'gameStats'],
    RoGold: ['serverStats', 'serverRegions', 'exactCounts', 'inventoryValues', 'profilePreviews', 'gameStats'],
    RoValra: ['serverRegions', 'groupHiddenGames', 'userOutfits', 'hiddenFriends'],
    RoSeal: ['profilePreviews', 'exactCounts', 'mutualFriends'],
    'Roblox+': ['notifyInbound', 'notifyOutbound', 'notifyCompleted', 'notifyLimiteds'],
    'Rolimon’s': ['itemPrices', 'tradeValues', 'inventoryValues', 'marketplaceValues'],
  };

  function group(title, note) {
    const wrap = el('div', 'routility-set-group');
    const head = el('div', 'routility-set-group-head');
    head.appendChild(el('span', 'text-title-medium content-emphasis', title));
    if (note) head.appendChild(el('span', 'text-body-small content-muted', note));
    wrap.appendChild(head);
    const card = el('div', 'routility-set-card');
    wrap.appendChild(card);
    wrap.card = card;
    return wrap;
  }

  let titleMemo = null;
  let parentMemo = null;

  function titleOf(key) {
    if (!titleMemo) {
      titleMemo = {};
      parentMemo = {};
      for (const pg of Object.values(PAGES)) for (const g of pg.groups) for (const r of g.rows) if (r.key) {
        titleMemo[r.key] = r.title;
        if (r.parent) parentMemo[r.key] = r.parent;
      }
    }
    return titleMemo[key] || '';
  }

  function offParent(def, settings) {
    titleOf('');
    const seen = new Set();
    let off = '';
    for (let k = def.parent; k && !seen.has(k); k = parentMemo[k]) {
      seen.add(k);
      if (!settings[k]) off = k;
    }
    return off;
  }

  function paint(rows, settings) {
    for (const { def, section } of rows) {
      const needs = def.parent ? offParent(def, settings) : '';
      const blocked = !!needs;
      section.classList.toggle('routility-set-off', !def.options && !settings[def.key]);
      section.classList.toggle('routility-set-blocked', blocked);
      let note = section.querySelector('.routility-set-needs');
      if (blocked && titleOf(needs)) {
        const text = section.querySelector('.routility-set-text');
        const words = lt('Turn on {name} to use this.', { name: lt(titleOf(needs)) });
        if (!note && text) {
          note = el('p', 'text-body-small margin-none routility-set-needs', words);
          text.appendChild(note);
        } else if (note && note.textContent !== words) note.textContent = words;
      }
      if (note) note.hidden = !blocked;
    }
  }

  function rateField(settings, save) {
    const field = el('label', 'foundation-web-input flex items-center relative clip stroke-standard bg-none height-1200 radius-medium padding-x-large gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-set-rate');
    const cash = cashNow();
    const fx = cash.rate;
    field.appendChild(el('span', 'text-body-large content-muted', cash.symbol));
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis text-body-large');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', lt('{currency} per 1,000 Robux', { currency: cash.code }));
    const valid = (v, max) => {
      const n = Number(String(v).replace(/[^0-9.]/g, ''));
      return n > 0 && n <= max ? n : null;
    };
    const shown = (n) => (Math.abs(Math.round(n * 100) - n * 100) < 1e-9 ? n.toFixed(2) : String(n));
    const current = () => {
      const from = fxOf(settings.calcRateCurrency || 'USD');
      const n = valid(settings.calcRate, 1000 * (from || 1));
      if (!n) return Math.round(3.8 * fx * 100) / 100;
      return (settings.calcRateCurrency || 'USD') === cash.code || !from ? n : Math.round(n / from * fx * 100) / 100;
    };
    input.value = shown(current());
    input.addEventListener('input', () => {
      const clean = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      if (clean !== input.value) input.value = clean;
      const n = valid(clean, 1000 * fx);
      field.classList.toggle('stroke-system-alert', !n && clean !== '');
      if (n) save({ calcRate: String(n), calcRateCurrency: cash.code }, true);
    });
    input.addEventListener('blur', () => {
      field.classList.remove('stroke-system-alert');
      input.value = shown(current());
    });
    field.appendChild(input);
    field.appendChild(el('span', 'text-body-small content-muted text-no-wrap', lt('per 1k')));
    field.input = input;
    return field;
  }

  function fontField() {
    const field = el('div', 'flex items-center gap-small wrap routility-set-font');
    const pickFile = el('input');
    pickFile.type = 'file';
    pickFile.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
    pickFile.hidden = true;
    const status = el('span', 'text-body-small content-muted');
    const choose = button(lt('Choose Font File'), () => pickFile.click());
    const show = () => chrome.storage.local.get('routilityFont', (st) => {
      const f = st.routilityFont;
      status.textContent = f && f.name ? f.name : lt('No font yet');
    });
    pickFile.addEventListener('change', () => {
      const file = pickFile.files && pickFile.files[0];
      pickFile.value = '';
      if (!file) return;
      const type = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[(file.name.split('.').pop() || '').toLowerCase()];
      if (!type) {
        status.textContent = lt('Pick a .ttf, .otf, .woff or .woff2 file.');
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        status.textContent = lt('That font is over 3 MB. Pick a smaller one.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result || '').replace(/^data:[^;,]*/, 'data:' + type);
        chrome.storage.local.set({ routilityFont: { name: file.name.slice(0, 80), data } }, show);
      };
      reader.readAsDataURL(file);
    });
    field.append(choose, status, pickFile);
    field.input = choose;
    show();
    return field;
  }

  function robuxField(settings, save, key, label) {
    const field = el('label', 'foundation-web-input flex items-center relative clip stroke-standard bg-none height-1200 radius-medium padding-x-large gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-set-rate routility-set-robux');
    if (!label) field.appendChild(el('span', 'icon-robux-16x16'));
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis text-body-large');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', label ? lt(label) : lt('Robux balance'));
    const read = (v) => {
      const digits = String(v == null ? '' : v).replace(/[^0-9]/g, '');
      return digits ? Math.min(Number(digits), 1e12) : null;
    };
    const current = () => {
      const n = read(settings[key]);
      return n == null ? read(DEFAULTS[key]) : n;
    };
    input.value = current().toLocaleString('en-US');
    input.addEventListener('input', () => {
      const caret = input.selectionStart || 0;
      const before = input.value.slice(0, caret).replace(/[^0-9]/g, '').length;
      const n = read(input.value);
      input.value = n == null ? '' : n.toLocaleString('en-US');
      let pos = 0;
      for (let seen = 0; pos < input.value.length && seen < before; pos++) if (/[0-9]/.test(input.value[pos])) seen++;
      input.setSelectionRange(pos, pos);
      if (n != null) save({ [key]: String(n) }, true);
    });
    input.addEventListener('blur', () => { input.value = current().toLocaleString('en-US'); });
    field.appendChild(input);
    field.input = input;
    return field;
  }

  const FUN_TYPES = { 2: LT('T-Shirt'), 8: LT('Hat'), 11: LT('Shirt'), 12: LT('Pants'), 17: LT('Head'), 18: LT('Face'), 19: LT('Gear'), 24: LT('Animation'), 41: LT('Hair'), 42: LT('Face Accessory'), 43: LT('Neck Accessory'), 44: LT('Shoulder Accessory'), 45: LT('Front Accessory'), 46: LT('Back Accessory'), 47: LT('Waist Accessory'), 61: LT('Emote'), 64: LT('T-Shirt'), 65: LT('Shirt'), 66: LT('Pants'), 67: LT('Jacket'), 68: LT('Sweater'), 69: LT('Shorts'), 70: LT('Left Shoe'), 71: LT('Right Shoe'), 72: LT('Dress Skirt'), 79: LT('Head') };
  const FUN_KINDS = { asset: LT('Item'), bundle: LT('Bundle'), pass: LT('Game Pass'), product: LT('Developer Product'), other: LT('Purchase') };
  const FUN_LINKS = { asset: 'catalog', bundle: 'bundles', pass: 'game-pass' };
  const FUN_THUMBS = {
    asset: (ids) => `https://thumbnails.roblox.com/v1/assets?assetIds=${ids}&size=150x150&format=Png&isCircular=false`,
    bundle: (ids) => `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${ids}&size=150x150&format=Png&isCircular=false`,
    pass: (ids) => `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${ids}&size=150x150&format=Png&isCircular=false`,
    product: (ids) => `https://thumbnails.roblox.com/v1/developer-products/icons?developerProductIds=${ids}&size=150x150&format=Png&isCircular=false`,
  };

  function freeItems(def) {
    const box = el('section', 'routility-set-row routility-free');
    box.dataset.key = 'freeItems';
    const head = el('div', 'routility-fun-head');
    const text = el('div', 'routility-set-text');
    text.appendChild(el('h3', 'text-title-medium content-emphasis padding-none', lt(def.title)));
    text.appendChild(el('p', 'text-body-small content-muted margin-none', lt(def.desc)));
    head.appendChild(text);
    const actions = el('div', 'routility-free-actions');
    head.appendChild(actions);
    const status = el('p', 'text-body-small content-default margin-none routility-free-status');
    const bar = el('div', 'routility-free-bar');
    const fill = el('span');
    bar.appendChild(fill);
    box.append(head, status, bar);
    let job = null;
    let pending = null;
    const say = (msg, pct) => {
      status.textContent = msg || '';
      status.hidden = !msg;
      bar.hidden = pct == null;
      fill.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    };
    const primary = (btn) => {
      btn.classList.remove('bg-action-standard', 'content-action-standard');
      btn.classList.add('bg-action-emphasis', 'content-action-emphasis');
      return btn;
    };
    const n = (x) => Number(x).toLocaleString('en-US');
    const show = (...btns) => actions.replaceChildren(...btns);
    const idle = () => show(button(lt('Get Free Items'), start));
    const stopper = () => button(lt('Stop'), () => job && job.abort());
    async function start() {
      const st = await chrome.storage.local.get('routilitySettings');
      if ((st.routilitySettings || {}).fakeBuy === true) {
        say(lt('Turn off Fake Purchases first. It blocks real purchases, so nothing would be added.'));
        return;
      }
      if (!window.RoUtilityFreeItems || !document.querySelector('meta[name="user-data"]')) {
        say(lt('Sign in to Roblox first.'));
        return;
      }
      job = new AbortController();
      show(stopper());
      say(lt('Looking through the Marketplace…'), 0);
      try {
        const res = await window.RoUtilityFreeItems.scan((p) => {
          if (p.phase === 'scan') say(ltn(p.count, 'Looking through the Marketplace… {n} free item so far', 'Looking through the Marketplace… {n} free items so far', { n: n(p.count) }), 0);
          else say(lt('Checking what you already own… {done} of {total}', { done: n(p.checked), total: n(p.total) }), p.checked / p.total * 100);
        }, job.signal);
        job = null;
        if (!res.missing.length) {
          say(lt('You already own all {n} free Roblox items.', { n: n(res.total) }));
          idle();
          return;
        }
        pending = res.missing;
        say(lt('{missing} of the {total} free Roblox items aren’t in your inventory yet.', { missing: n(res.missing.length), total: n(res.total) }));
        show(button(lt('Cancel'), () => { pending = null; say(''); idle(); }), primary(button(ltn(res.missing.length, 'Get {n} Item', 'Get {n} Items', { n: n(res.missing.length) }), buy)));
      } catch (e) {
        job = null;
        say(e.message === 'stopped' ? '' : lt('Couldn’t load the Marketplace. Try again in a minute.'));
        idle();
      }
    }
    async function buy() {
      const items = pending;
      pending = null;
      if (!items) return;
      job = new AbortController();
      show(stopper());
      say(lt('Getting items… {done} of {total}', { done: 0, total: n(items.length) }), 0);
      const out = await window.RoUtilityFreeItems.run(items, (p) => {
        say(lt('Getting items… {done} of {total}', { done: n(p.done), total: n(p.total) }) + (p.last && p.last.name ? ' · ' + p.last.name : ''), p.done / p.total * 100);
      }, job.signal);
      job = null;
      const got = ltn(out.got.length, '{n} item', '{n} items', { n: n(out.got.length) });
      const failed = out.failed.length ? ' ' + lt('{n} couldn’t be added.', { n: n(out.failed.length) }) : '';
      if (out.stopped === 'challenge') say(lt('Added {items}. Roblox wants you to verify first: get one free item by hand, then try again.', { items: got }) + failed);
      else if (out.stopped === 'slow') say(lt('Added {items}. Roblox asked to slow down, so try again in a few minutes.', { items: got }) + failed);
      else if (out.stopped === 'user') say(lt('Stopped. Added {items}.', { items: got }) + failed);
      else say(lt('Done. Added {items} to your inventory.', { items: got }) + failed);
      idle();
    }
    say('');
    idle();
    return box;
  }

  function funItems(def) {
    const box = el('section', 'routility-set-row routility-set-child routility-fun-list');
    box.dataset.key = 'funItems';
    const head = el('div', 'routility-fun-head');
    const text = el('div', 'routility-set-text');
    text.appendChild(el('h3', 'text-title-medium content-emphasis padding-none', lt(def.title)));
    const sub = el('p', 'text-body-small content-muted margin-none', lt(def.desc));
    text.appendChild(sub);
    head.appendChild(text);
    const refill = button(lt('Refill Robux'), () => chrome.storage.local.get('routilityFun', (st) => chrome.storage.local.set({ routilityFun: Object.assign({}, st.routilityFun || {}, { spent: 0 }) })));
    refill.dataset.rtTip = lt('Puts your fake balance back to full and keeps everything you bought.');
    const reset = button(lt('Reset All'), () => chrome.storage.local.set({ routilityFun: { spent: 0, items: [], worn: [] } }));
    head.append(refill, reset);
    const list = el('div', 'routility-fun-items');
    box.append(head, list);
    const refund = (it) => chrome.storage.local.get('routilityFun', (st) => {
      const fun = st.routilityFun || {};
      const items = Array.isArray(fun.items) ? fun.items.slice() : [];
      const i = items.findIndex(x => x.at === it.at && x.id === it.id && x.kind === it.kind);
      if (i < 0) return;
      const spent = Math.max(0, (Number(fun.spent) || 0) - (Number(items[i].price) || 0));
      items.splice(i, 1);
      const worn = (Array.isArray(fun.worn) ? fun.worn : []).filter(id => items.some(x => x.kind === 'asset' && x.id === id));
      chrome.storage.local.set({ routilityFun: { spent, items, worn } });
    });
    const draw = () => chrome.storage.local.get('routilityFun', (st) => {
      const fun = st.routilityFun || {};
      const items = (Array.isArray(fun.items) ? fun.items : []).slice().sort((a, b) => b.at - a.at);
      const spent = Number(fun.spent) || 0;
      sub.textContent = items.length ? ltn(items.length, '{n} purchase · {spent} Robux spent', '{n} purchases · {spent} Robux spent', { n: items.length.toLocaleString('en-US'), spent: spent.toLocaleString('en-US') }) : lt(def.desc);
      reset.hidden = !items.length;
      refill.hidden = !(spent > 0);
      list.textContent = '';
      if (!items.length) {
        list.appendChild(el('div', 'text-body-small content-muted routility-alert-empty', lt('Nothing yet. Turn on Fake Purchases and buy something.')));
        return;
      }
      const hosts = {};
      for (const it of items) {
        const row = el('div', 'routility-alert-row routility-fun-row');
        const pic = el('span', 'routility-alert-thumb');
        if (FUN_THUMBS[it.kind] && it.id) (hosts[it.kind] = hosts[it.kind] || {})[it.id] = [...((hosts[it.kind] || {})[it.id] || []), pic];
        const info = el('div', 'routility-alert-info');
        const label = it.name || lt(FUN_KINDS[it.kind] || FUN_KINDS.other);
        let name;
        if (FUN_LINKS[it.kind] && it.id) {
          name = el('a', 'text-body-medium content-emphasis text-overflow routility-alert-name routility-alert-link', label);
          name.href = `https://www.roblox.com/${FUN_LINKS[it.kind]}/${it.id}`;
        } else {
          name = el('span', 'text-body-medium content-emphasis text-overflow routility-alert-name', label);
        }
        const kind = lt(it.kind === 'asset' ? FUN_TYPES[it.type] || FUN_KINDS.asset : FUN_KINDS[it.kind] || FUN_KINDS.other);
        const when = new Date(it.at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        info.append(name, el('span', 'text-body-small content-muted', `${kind} · ${when}`));
        const price = el('span', 'routility-fun-price');
        price.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux', it.price ? Number(it.price).toLocaleString('en-US') : lt('Free')));
        row.append(pic, info, price, button(lt('Remove'), () => refund(it)));
        list.appendChild(row);
      }
      for (const kind of Object.keys(hosts)) {
        const ids = Object.keys(hosts[kind]);
        for (let i = 0; i < ids.length; i += 50) {
          fetch(FUN_THUMBS[kind](ids.slice(i, i + 50).join(',')), { credentials: 'include' })
            .then(res => (res.ok ? res.json() : null))
            .then((j) => {
              for (const d of (j && j.data) || []) {
                if (d.state !== 'Completed' || !d.imageUrl) continue;
                for (const pic of hosts[kind][String(d.targetId)] || []) putImg(pic, d.imageUrl);
              }
            })
            .catch(() => {});
        }
      }
    });
    draw();
    let onFunSeen = false;
    const onFun = (changes, area) => {
      if (!box.isConnected) {
        if (onFunSeen) chrome.storage.onChanged.removeListener(onFun);
        return;
      }
      onFunSeen = true;
      if (area === 'local' && changes.routilityFun) draw();
    };
    chrome.storage.onChanged.addListener(onFun);
    return box;
  }

  const NAV_DEFAULT = { order: [], hidden: ['promo', 'store', 'newsroom', 'giftcards'] };
  const HOME_DEFAULT = ['Continue#1', 'Friends Playing#1', 'Recently Updated#1', 'Recommended For You#1', 'Standout Games#1', 'Recommended For You#2', 'Favorites#1', 'Recommended For You#3'];

  const THEME_ROWS = [
    ['bg', LT('Page Background'), ['--color-surface-0']],
    ['nav', LT('Sidebar & Top Bar'), ['--color-navigation-background']],
    ['card', LT('Cards'), ['--color-surface-100']],
    ['raised', LT('Raised Cards'), ['--color-surface-200']],
    ['menu', LT('Menus & Popups'), ['--color-surface-300']],
    ['shimmer', LT('Loading Shimmer'), ['--color-common-shimmer']],
    ['text', LT('Headings'), ['--color-content-emphasis']],
    ['body', LT('Normal Text'), ['--color-content-default']],
    ['muted', LT('Faded Text'), ['--color-content-muted']],
    ['link', LT('Links'), ['--color-content-link']],
    ['accent', LT('Accent'), ['--color-system-emphasis']],
    ['play', LT('Play Button'), ['--color-action-emphasis-background']],
    ['playText', LT('Play Button Text'), ['--color-action-emphasis-foreground']],
    ['button', LT('Buttons'), ['--color-action-standard-background']],
    ['border', LT('Borders'), ['--color-stroke-default']],
    ['success', LT('Success'), ['--color-system-success']],
    ['alert', LT('Warnings'), ['--color-system-alert']],
  ];
  const THEME_GROUPS = { bg: LT('Page'), text: LT('Text'), accent: LT('Buttons & Accents') };
  const THEME_PRESETS = [
    ['RoUtility', { fx: 'grid', nav: '#0b0e12', bg: '#0b0e12', card: '#121821', raised: '#18202b', menu: '#1f2935', shimmer: 'rgba(15, 159, 255, 0.12)', text: '#f2f7fc', body: '#d3dce6', muted: '#8a94a0', link: '#4fb6ff', accent: '#0f9fff', play: '#0f8fe6' }],
    [LT('Midnight Purple'), { fx: 'glow', nav: '#140a2a', bg: '#100821', card: '#170d2c', raised: '#1f1338', menu: '#2c1b4f', shimmer: 'rgba(169, 133, 255, 0.14)', text: '#ffffff', body: '#e4dcff', muted: '#a98fe0', link: '#b18cff', accent: '#8b5cf6', play: '#6d3fd6' }],
    [LT('Ocean'), { fx: 'glow', nav: '#06111c', bg: '#07131f', card: '#0c1c2b', raised: '#122536', menu: '#1a3247', shimmer: 'rgba(120, 190, 255, 0.12)', text: '#f2f8ff', body: '#cfe0f0', muted: '#8fb0cc', link: '#5cc0ff', accent: '#0f9fff', play: '#0f8fd6' }],
    [LT('Pure Black'), { nav: '#000000', bg: '#000000', card: '#0b0b0d', raised: '#121215', menu: '#1b1c20', shimmer: 'rgba(255, 255, 255, 0.08)', text: '#ffffff', body: '#d6d6d6', muted: '#a0a0a0', link: '#6aa0ff', accent: '#3d6bff', play: '#137f1f' }],
    [LT('Crimson'), { fx: 'glow', nav: '#12050a', bg: '#140608', card: '#1e0a0e', raised: '#281015', menu: '#36161d', shimmer: 'rgba(255, 140, 150, 0.12)', text: '#fff5f5', body: '#f0d4d6', muted: '#c49499', link: '#ff7a85', accent: '#e5383b', play: '#c1121f' }],
    [LT('Sakura'), { fx: 'aurora', nav: '#ffc9df', bg: '#ffe8f1', card: '#fffafc', raised: '#ffe4ef', menu: '#ffffff', shimmer: 'rgba(214, 61, 134, 0.16)', text: '#3d1230', body: '#562d47', muted: '#8f5878', link: '#d63d86', accent: '#f0529b', play: '#e8468f', playText: '#ffffff', button: '#ffc6dd', border: '#f3c0d6' }],
  ];

  function parseColor(v) {
    const s = String(v || '').trim();
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a };
    }
    m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
    if (m) {
      const c = (x) => Math.max(0, Math.min(255, Math.round(Number(x))));
      return { r: c(m[1]), g: c(m[2]), b: c(m[3]), a: m[4] == null ? 1 : Math.max(0, Math.min(1, Number(m[4]))) };
    }
    return null;
  }

  function colorText(c) {
    const a = Math.round(c.a * 100) / 100;
    return a >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  }

  function colorHex(c) {
    return '#' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  const PLUS_THEMES = [
    [LT('Calm'), [['nebula-drift', LT('Nebula Drift'), '#ddcffe', '#480b98'], ['nitro-frost', LT('Nitro Frost'), '#98e3f4', '#043b5d'], ['circuit-rush', LT('Circuit Rush'), '#ade7b1', '#043e32'], ['kinetic-energy', LT('Kinetic Energy'), '#cae388', '#2e3c02'], ['inferno-blast', LT('Inferno Blast'), '#fecec8', '#6b0f0b'], ['hyper-plum', LT('Hyper Plum'), '#fbc9d8', '#710437'], ['quantum-pulse', LT('Quantum Pulse'), '#fbc8f8', '#5d0e5d']]],
    [LT('Dynamic'), [['cosmic-dust', LT('Cosmic Dust'), '#cbb7fd', '#6625d0'], ['polar-freeze', LT('Polar Freeze'), '#6cd1ed', '#065684'], ['super-charge', LT('Super Charge'), '#81d887', '#045d4a'], ['electric-lime', LT('Electric Lime'), '#b4d159', '#455903'], ['lava-glow', LT('Lava Glow'), '#fbb2a9', '#a71811'], ['star-burst', LT('Star Burst'), '#fbadc6', '#a5094f'], ['pixel-pop', LT('Pixel Pop'), '#f7acf4', '#8e1f8e']]],
    [LT('Special'), [['classic', LT('Classic'), '#e42727', '#e42727']]],
  ];

  function plusThemes(settings, save) {
    const section = el('section', 'routility-set-row routility-plus-row');
    section.dataset.key = 'plusTheme';
    const text = el('div', 'routility-set-text flex flex-col gap-xsmall');
    const title = el('h3', 'text-title-large content-emphasis padding-none', lt('Roblox Plus Themes'));
    title.appendChild(el('span', 'routility-set-chip routility-plus-free', lt('Free')));
    text.appendChild(title);
    text.appendChild(el('p', 'text-body-small content-muted margin-none', lt('Every app theme from Roblox Plus, free for everyone. They’re Roblox’s own themes, so every page changes color just like it does for Plus members, in light and dark mode.')));
    section.appendChild(text);
    if (settings.customTheme) section.appendChild(el('p', 'text-body-small content-muted margin-none routility-plus-paused', lt('Custom Theme is on, so it’s used instead. Picking a theme here turns Custom Theme off.')));
    const dark = () => !document.body.classList.contains('light-theme');
    const cards = [];
    const card = (key, label, light, darkHex) => {
      const on = (settings.plusTheme || '') === key;
      const b = el('button', 'routility-plus-card flex items-center gap-small width-full padding-medium radius-medium text-align-x-start stroke-standard cursor-pointer ' + (on ? 'bg-shift-200 routility-plus-on' : 'bg-none stroke-emphasis'));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      const dot = el('span', 'routility-plus-swatch grow-0 shrink-0 basis-auto size-800 radius-circle clip stroke-standard');
      dot.setAttribute('aria-hidden', 'true');
      const fill = el('span', 'block size-full');
      if (light) fill.style.backgroundColor = dark() ? darkHex : light;
      else fill.classList.add('routility-plus-default');
      dot.appendChild(fill);
      b.append(dot, el('span', 'fill basis-0 min-width-0 text-no-wrap text-truncate-end text-body-medium content-default', label));
      b.addEventListener('click', () => {
        if ((settings.plusTheme || '') === key && !settings.customTheme) return;
        const patch = { plusTheme: key };
        if (key && settings.customTheme) patch.customTheme = false;
        save(patch);
        if (patch.customTheme === false) {
          setTimeout(() => location.reload(), 150);
          return;
        }
        settings.plusTheme = key;
        for (const c of cards) {
          const mine = c.dataset.key === key;
          c.classList.toggle('bg-shift-200', mine);
          c.classList.toggle('routility-plus-on', mine);
          c.classList.toggle('bg-none', !mine);
          c.classList.toggle('stroke-emphasis', !mine);
          c.setAttribute('aria-pressed', String(mine));
        }
      });
      b.dataset.key = key;
      cards.push(b);
      return b;
    };
    const fold = el('button', 'text-label-medium content-emphasis routility-theme-group routility-plus-fold');
    fold.type = 'button';
    fold.setAttribute('aria-expanded', 'false');
    const now = el('span', 'routility-theme-group-name');
    fold.append(now, el('span', 'routility-theme-group-chev'));
    const body = el('div', 'routility-plus-body');
    body.hidden = true;
    fold.addEventListener('click', () => {
      const open = fold.getAttribute('aria-expanded') !== 'true';
      fold.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
    });
    const showNow = () => {
      const pick = PLUS_THEMES.flatMap(g => g[1]).find(t => t[0] === (settings.plusTheme || ''));
      now.textContent = '';
      const dot = el('span', 'routility-plus-mini');
      if (pick) dot.style.backgroundColor = dark() ? pick[3] : pick[2];
      else dot.classList.add('routility-plus-default');
      now.append(dot, el('span', null, pick ? lt(pick[1]) : lt('Roblox Default')));
    };
    const first = el('div', 'routility-plus-grid');
    first.appendChild(card('', lt('Roblox Default')));
    body.appendChild(first);
    for (const [group, list] of PLUS_THEMES) {
      body.appendChild(el('span', 'text-label-medium content-muted routility-plus-group', lt(group)));
      const grid = el('div', 'routility-plus-grid');
      for (const [key, label, light, darkHex] of list) grid.appendChild(card(key, lt(label), light, darkHex));
      body.appendChild(grid);
    }
    for (const c of cards) c.addEventListener('click', showNow);
    showNow();
    section.append(fold, body);
    return section;
  }

  function themeEditor(settings) {
    const section = el('section', 'routility-set-row routility-set-child routility-theme-editor');
    section.dataset.key = 'themeEditor';
    let colors = {};
    let fx = '';
    let look = {};
    let writeTimer = 0;
    const live = () => {
      const probe = getComputedStyle(document.body);
      const out = {};
      const st = document.getElementById('routility-theme');
      const was = st ? st.textContent : '';
      if (st) st.textContent = '';
      for (const [id, , vars] of THEME_ROWS) out[id] = parseColor(probe.getPropertyValue(vars[0]).trim()) || { r: 128, g: 128, b: 128, a: 1 };
      if (st) st.textContent = was;
      return out;
    };
    let roblox = null;
    const write = () => {
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => chrome.storage.local.set({ routilityTheme: { colors, fx, ...look } }), 120);
    };
    const set = (id, c) => {
      if (c) colors = { ...colors, [id]: colorText(c) };
      else {
        colors = { ...colors };
        delete colors[id];
      }
      write();
    };
    const presetBar = el('div', 'routility-theme-presets');
    const FX_OPTIONS = [['', LT('None')], ['glow', LT('Glow')], ['aurora', LT('Aurora')], ['grid', LT('RoUtility Grid')], ['dots', LT('Dots')], ['flowers', LT('Flowers')], ['image', LT('Your Image')]];
    const fxRow = el('div', 'routility-theme-fx');
    let photo = null;
    const withPhoto = (cb) => {
      if (photo !== null) return cb(photo);
      chrome.storage.local.get('routilityThemeImage', (st) => {
        photo = /^data:image\/(png|jpeg|webp|gif);base64,/.test(st.routilityThemeImage) ? st.routilityThemeImage : '';
        cb(photo);
      });
    };
    const imageTools = () => {
      const wrap = el('div', 'flex items-center gap-small wrap routility-theme-image');
      const pickFile = el('input');
      pickFile.type = 'file';
      pickFile.accept = 'image/png,image/jpeg,image/webp,image/gif';
      pickFile.hidden = true;
      const status = el('span', 'text-body-small content-muted');
      const choose = button(lt('Choose Image'), () => pickFile.click());
      const clear = button(lt('Remove'), () => chrome.storage.local.remove('routilityThemeImage', () => { photo = null; show(); paintFx(); }));
      const show = () => withPhoto((p) => {
        const has = !!p;
        status.textContent = has ? lt('Image saved in this browser') : lt('No image yet');
        clear.style.display = has ? '' : 'none';
      });
      pickFile.addEventListener('change', () => {
        const file = pickFile.files && pickFile.files[0];
        pickFile.value = '';
        if (!file) return;
        status.textContent = lt('Loading…');
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          chrome.storage.local.set({ routilityThemeImage: canvas.toDataURL('image/jpeg', 0.85) }, () => { photo = null; show(); paintFx(); });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          status.textContent = lt('That file isn’t an image RoUtility can use.');
        };
        img.src = url;
      });
      wrap.append(choose, clear, status, pickFile);
      show();
      return wrap;
    };
    const slider = (label, key, max, def, unit) => {
      const row = el('div', 'routility-theme-look');
      const input = el('input', 'routility-theme-alpha');
      input.type = 'range';
      input.min = '0';
      input.max = String(max);
      input.value = String(Number.isFinite(Number(look[key])) ? Number(look[key]) : def);
      input.setAttribute('aria-label', label);
      const val = el('span', 'text-body-small content-muted routility-theme-pct', input.value + unit);
      input.addEventListener('input', () => {
        look = { ...look, [key]: Number(input.value) };
        val.textContent = input.value + unit;
        write();
      });
      row.append(el('span', 'text-label-medium content-emphasis routility-theme-look-name', label), input, val);
      return row;
    };
    const choices = (label, key, options, def) => {
      const cur = look[key] == null ? def : Number(look[key]);
      const row = el('div', 'routility-theme-look');
      const wrap = el('div', 'flex gap-small wrap');
      for (const [value, text] of options) {
        const b = el('button', 'routility-theme-preset routility-theme-choice relative clip group/interactable cursor-pointer radius-medium text-label-medium content-emphasis' + (cur === value ? ' routility-theme-bg-on' : ''));
        b.type = 'button';
        b.appendChild(stateLayer());
        b.appendChild(el('span', null, lt(text)));
        b.addEventListener('click', () => {
          look = { ...look, [key]: value };
          write();
          paintFx();
        });
        wrap.appendChild(b);
      }
      row.append(el('span', 'text-label-medium content-emphasis routility-theme-look-name', label), wrap);
      return row;
    };
    const paintFx = () => {
      fxRow.textContent = '';
      fxRow.appendChild(el('span', 'text-label-medium content-emphasis', lt('Background')));
      const pal = { ...Object.fromEntries(Object.entries(roblox || {}).map(([k, v]) => [k, colorText(v)])), ...colors };
      const grid = el('div', 'routility-theme-bgs');
      for (const [value, label] of FX_OPTIONS) {
        const tile = el('button', 'routility-theme-bg relative clip group/interactable cursor-pointer radius-medium' + (fx === value ? ' routility-theme-bg-on' : ''));
        tile.type = 'button';
        tile.setAttribute('aria-pressed', String(fx === value));
        const view = el('span', 'routility-theme-bg-view radius-small');
        const layer = value && value !== 'image' && window.RoUtilityBackgrounds ? window.RoUtilityBackgrounds.preview(value, pal) : '';
        view.style.background = (layer ? layer + ', ' : '') + (pal.bg || '#000');
        if (value === 'image') {
          view.classList.add('routility-theme-bg-photo');
          withPhoto((p) => {
            if (p) view.style.backgroundImage = `url("${p}")`;
          });
        }
        tile.append(stateLayer(), view, el('span', 'text-label-small content-emphasis', lt(label)));
        tile.addEventListener('click', () => {
          fx = value;
          write();
          paintFx();
        });
        grid.appendChild(tile);
      }
      fxRow.appendChild(grid);
      if (fx === 'image') fxRow.appendChild(imageTools());
      if (fx) fxRow.appendChild(slider(lt('Blur'), 'blur', 20, 2, 'px'));
      if (fx === 'image') fxRow.appendChild(slider(lt('Tint'), 'tint', 95, 70, '%'));
      if (fx) fxRow.appendChild(slider(lt('Card Transparency'), 'see', 60, 0, '%'));
      fxRow.appendChild(choices(lt('Roundness'), 'round', [[2, LT('Flat')], [0, LT('Default')], [1, LT('Rounder')]], 0));
    };
    const list = el('div', 'routility-theme-list');
    const foot = el('div', 'routility-theme-foot');
    const note = el('p', 'text-body-small content-muted margin-none routility-theme-note', lt('Turn on Custom Theme above to use these colors.'));
    section.append(note, presetBar, fxRow, list, foot);

    const rowsById = new Map();
    const dotsById = new Map();
    const paintRow = (id) => {
      const r = rowsById.get(id);
      const c = parseColor(colors[id]) || roblox[id];
      if (dotsById.has(id)) dotsById.get(id).style.background = colorText(c);
      r.swatch.value = colorHex(c);
      if (document.activeElement !== r.text) r.text.value = colorText(c);
      r.alpha.value = String(Math.round(c.a * 100));
      r.pct.textContent = `${Math.round(c.a * 100)}%`;
      r.alpha.style.setProperty('--rt-fill', `${Math.round(c.a * 100)}%`);
      r.reset.disabled = !(id in colors);
      r.reset.hidden = !(id in colors);
      r.box.classList.toggle('routility-theme-row-set', id in colors);
    };
    const paintAll = () => { for (const [id] of THEME_ROWS) paintRow(id); };

    let group = [];
    let groupDots = null;
    for (const [id, key] of THEME_ROWS) {
      if (THEME_GROUPS[id]) {
        const head = el('button', 'text-label-medium content-emphasis routility-theme-group');
        head.type = 'button';
        head.setAttribute('aria-expanded', 'false');
        const name = el('span', 'routility-theme-group-name');
        groupDots = el('span', 'routility-theme-dots');
        name.append(el('span', null, lt(THEME_GROUPS[id])), groupDots);
        head.append(name, el('span', 'routility-theme-group-chev'));
        const rows = [];
        head.addEventListener('click', () => {
          const open = head.getAttribute('aria-expanded') !== 'true';
          head.setAttribute('aria-expanded', String(open));
          for (const r of rows) r.hidden = !open;
        });
        list.appendChild(head);
        group = rows;
      }
      const label = lt(key);
      const box = el('div', 'routility-theme-row');
      const swatch = el('input', 'routility-theme-swatch');
      swatch.type = 'color';
      swatch.setAttribute('aria-label', lt('{name} color', { name: label }));
      const name = el('span', 'text-label-medium content-emphasis routility-theme-name', label);
      const text = el('input', 'routility-theme-text text-body-small content-default radius-medium');
      text.type = 'text';
      text.spellcheck = false;
      text.setAttribute('aria-label', lt('{name} value', { name: label }));
      const alpha = el('input', 'routility-theme-alpha');
      alpha.type = 'range';
      alpha.min = '0';
      alpha.max = '100';
      alpha.setAttribute('aria-label', lt('{name} opacity', { name: label }));
      const pct = el('span', 'text-body-small content-muted routility-theme-pct');
      const reset = el('button', 'routility-theme-reset radius-circle');
      reset.type = 'button';
      reset.setAttribute('aria-label', lt('Reset {name}', { name: label }));
      reset.dataset.rtTip = lt('Back to Roblox’s color');
      reset.appendChild(el('span', 'routility-theme-reset-icon'));
      reset.addEventListener('click', () => { set(id, null); paintRow(id); });
      const current = () => parseColor(colors[id]) || roblox[id];
      swatch.addEventListener('input', () => {
        const c = parseColor(swatch.value);
        c.a = current().a;
        set(id, c);
        paintRow(id);
      });
      text.addEventListener('change', () => {
        const c = parseColor(text.value);
        if (!c) { text.value = colorText(current()); return; }
        set(id, c);
        paintRow(id);
      });
      alpha.addEventListener('input', () => {
        set(id, { ...current(), a: Number(alpha.value) / 100 });
        paintRow(id);
      });
      const op = el('div', 'routility-theme-op');
      op.append(alpha, pct);
      box.append(swatch, name, text, op, reset);
      box.hidden = true;
      group.push(box);
      if (groupDots && groupDots.childElementCount < 5) {
        const dot = el('span', 'routility-theme-dot');
        groupDots.appendChild(dot);
        dotsById.set(id, dot);
      }
      list.appendChild(box);
      rowsById.set(id, { box, swatch, text, alpha, pct, reset });
    }

    const presetChip = (label, pal, onClick) => {
      const b = el('button', 'routility-theme-preset relative clip group/interactable cursor-pointer radius-medium text-label-medium content-emphasis');
      b.type = 'button';
      b.appendChild(stateLayer());
      const dots = el('span', 'routility-theme-dots');
      for (const k of ['nav', 'bg', 'card', 'accent', 'text']) {
        const d = el('span', 'routility-theme-dot');
        d.style.background = (pal && pal[k]) || (roblox && roblox[k] ? colorText(roblox[k]) : '#777');
        dots.appendChild(d);
      }
      b.append(dots, el('span', null, label));
      b.addEventListener('click', onClick);
      return b;
    };
    const paintPresets = () => {
      presetBar.textContent = '';
      const main = el('div', 'routility-theme-preset-row');
      const usePreset = (pal) => {
        const { fx: f, blur, tint, see, round, ...rest } = pal || {};
        colors = { ...rest };
        fx = f || '';
        look = { blur, tint, see, round };
        write();
        paintAll();
        paintFx();
      };
      main.appendChild(presetChip(lt('Roblox Default'), null, () => usePreset(null)));
      for (const [label, pal] of THEME_PRESETS) main.appendChild(presetChip(lt(label), pal, () => usePreset(pal)));
      const mine = el('div', 'routility-theme-preset-row routility-theme-slots');
      mine.appendChild(el('span', 'text-label-medium content-emphasis routility-theme-slots-label', lt('Your Slots')));
      const saveSlots = (next) => {
        slots = next;
        chrome.storage.local.set({ routilityThemeSlots: slots });
        paintPresets();
      };
      for (let i = 0; i < SLOT_COUNT; i++) {
        const slot = slots[i];
        const name = lt('Slot {n}', { n: i + 1 });
        if (!slot) {
          const empty = el('button', 'routility-theme-preset routility-theme-slot-empty relative clip group/interactable cursor-pointer radius-medium text-label-medium content-muted');
          empty.type = 'button';
          empty.appendChild(stateLayer());
          empty.appendChild(el('span', null, lt('Save to {slot}', { slot: name })));
          empty.dataset.rtTip = lt('Saves your current colors and background here');
          empty.addEventListener('click', () => saveSlots(Object.assign([...slots], { [i]: { colors: { ...colors }, fx, ...look, at: Date.now() } })));
          mine.appendChild(empty);
          continue;
        }
        const wrap = el('span', 'routility-theme-slot');
        const chip = presetChip(name, { ...slot.colors }, () => usePreset({ ...slot.colors, fx: slot.fx || '', blur: slot.blur, tint: slot.tint, see: slot.see, round: slot.round }));
        chip.dataset.rtTip = lt('Use this theme');
        const tool = (icon, tip, onClick) => {
          const b = el('button', 'routility-theme-slot-tool relative clip group/interactable cursor-pointer radius-circle');
          b.type = 'button';
          b.setAttribute('aria-label', `${tip} (${name})`);
          b.dataset.rtTip = tip;
          b.appendChild(stateLayer());
          b.appendChild(el('span', 'icon routility-calc-icon ' + icon));
          b.addEventListener('click', onClick);
          return b;
        };
        wrap.append(chip, tool('routility-calc-icon-download', lt('Save current theme here'), () => saveSlots(Object.assign([...slots], { [i]: { colors: { ...colors }, fx, ...look, at: Date.now() } }))), tool('routility-calc-icon-close', lt('Clear this slot'), () => saveSlots(Object.assign([...slots], { [i]: null }))));
        mine.appendChild(wrap);
      }
      presetBar.append(el('span', 'text-label-medium content-emphasis', lt('Presets')), main, mine);
    };

    const SLOT_COUNT = 5;
    let slots = Array(SLOT_COUNT).fill(null);
    const syncOn = (s) => section.classList.toggle('routility-theme-off', !(s || {}).customTheme);
    syncOn(settings);
    chrome.storage.local.get(['routilityTheme', 'routilityThemeSlots'], (st) => {
      slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
        const v = Array.isArray(st.routilityThemeSlots) ? st.routilityThemeSlots[i] : null;
        return v && typeof v === 'object' && v.colors && typeof v.colors === 'object' ? v : null;
      });
      colors = { ...((st.routilityTheme && st.routilityTheme.colors) || {}) };
      fx = (st.routilityTheme && typeof st.routilityTheme.fx === 'string') ? st.routilityTheme.fx : '';
      if (!FX_OPTIONS.some(([v]) => v === fx)) fx = '';
      const t = st.routilityTheme || {};
      look = { blur: t.blur === undefined ? look.blur : t.blur, tint: t.tint === undefined ? look.tint : t.tint, see: t.see, round: t.round === undefined ? look.round : t.round };
      roblox = live();
      paintPresets();
      paintFx();
      paintAll();
    });
    let onSettingsSeen = false;
    const onSettings = (ch, area) => {
      if (!section.isConnected) {
        if (onSettingsSeen) chrome.storage.onChanged.removeListener(onSettings);
        return;
      }
      onSettingsSeen = true;
      if (area === 'local' && ch.routilitySettings) syncOn(ch.routilitySettings.newValue);
    };
    chrome.storage.onChanged.addListener(onSettings);
    return section;
  }

  function navVisualizer(stored, settings, save) {
    const ENTRIES = [['promo', lt('Plus Promo Banner')], ['home', lt('Home')], ['profile', lt('Profile')], ['plus', 'Roblox Plus'], ['messages', lt('Messages')], ['friends', lt('Friends')], ['avatar', lt('Avatar')], ['inventory', lt('Inventory')], ['trade', lt('Trade')], ['calc', lt('Trade Calculator')], ['ads', lt('Trade Ads')], ['communities', lt('Communities')], ['forum', lt('Forum')], ['newsroom', lt('Newsroom')], ['store', lt('Official Store')], ['giftcards', lt('Buy Gift Cards')]];
    const RULES = [
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
    const rules = new Map(RULES);
    const clean = (v) => ({ order: Array.isArray(v && v.order) ? v.order.map(String) : [], hidden: Array.isArray(v && v.hidden) ? v.hidden.map(String) : [] });
    let lay = clean(stored.routilityNavLayout || NAV_DEFAULT);
    const section = el('section', 'routility-set-row routility-viz routility-nav-viz');
    section.dataset.key = 'navLayout';
    let drag = null;

    const store = (next) => {
      lay = next;
      chrome.storage.local.set({ routilityNavLayout: lay });
      render();
    };

    const arranged = () => ENTRIES.filter(([key]) => !(key === 'plus' && settings.oldLeftNav === true)).map(([key, name], i) => {
      const at = lay.order.indexOf(key);
      return { key, name, rank: at >= 0 ? at : 1000 + i };
    }).sort((a, b) => a.rank - b.rank);

    const owner = (key) => ({ calc: 'tradeCalculator', ads: 'tradeAds', forum: 'forum' })[key] || null;
    const flag = (key) => ({ calc: 'calcNav', ads: 'tradeAdsNav', forum: 'forumNav' })[key] || null;
    const isHidden = (key) => flag(key) ? settings[flag(key)] === false : lay.hidden.includes(key);
    const blocked = (key) => !!owner(key) && settings[owner(key)] === false;

    const OWN_ICONS = { calc: 'routility-calc-nav-icon', ads: 'routility-ads-nav-icon', forum: 'routility-forum-nav-icon' };
    const OLD_ICONS = { home: 'icon-nav-home', profile: 'icon-nav-profile', messages: 'icon-nav-message', friends: 'icon-nav-friends', avatar: 'icon-nav-charactercustomizer', inventory: 'icon-nav-inventory', trade: 'icon-nav-trade', communities: 'icon-nav-group', newsroom: 'icon-nav-blog', store: 'icon-nav-shop', giftcards: 'icon-nav-giftcards' };
    const fillIcon = (box) => {
      if (box.firstChild) return true;
      const li = document.querySelector(`.left-nav nav ul > ${rules.get(box.dataset.nav)}`);
      const src = li && li.querySelector(':scope > a > span, :scope > button > span');
      if (src) box.appendChild(src.cloneNode(true));
      else if ((box.dataset.nav === 'promo' || box.dataset.nav === 'plus') && document.querySelector('ul.left-col-list')) {
        const wrap = el('span', 'size-1000 grow-0 shrink-0 basis-auto flex justify-center items-center');
        wrap.appendChild(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus size-[var(--icon-size-large)]'));
        box.appendChild(wrap);
      } else if (!OWN_ICONS[box.dataset.nav] && OLD_ICONS[box.dataset.nav] && document.querySelector('ul.left-col-list')) {
        const wrap = el('span', 'size-1000 grow-0 shrink-0 basis-auto flex justify-center items-center routility-nav-old-icon');
        wrap.appendChild(el('span', OLD_ICONS[box.dataset.nav]));
        box.appendChild(wrap);
      } else if (OWN_ICONS[box.dataset.nav]) {
        const wrap = el('span', 'size-1000 grow-0 shrink-0 basis-auto flex justify-center items-center');
        wrap.appendChild(el('span', `grow-0 shrink-0 basis-auto icon ${OWN_ICONS[box.dataset.nav]} size-[var(--icon-size-large)]`));
        box.appendChild(wrap);
      }
      return !!box.firstChild;
    };
    let iconWatch = null;
    const watchIcons = () => {
      if (iconWatch) return;
      const started = Date.now();
      let queued = false;
      const stop = () => {
        iconWatch?.disconnect();
        iconWatch = null;
      };
      iconWatch = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          const left = [...section.querySelectorAll('.routility-nav-icon')].filter(b => !fillIcon(b));
          if (!left.length || Date.now() - started > 20000) stop();
        });
      });
      iconWatch.observe(document.body, { childList: true, subtree: true });
      setTimeout(stop, 20000);
    };
    const iconOf = (key) => {
      const box = el('span', 'routility-nav-icon');
      box.setAttribute('aria-hidden', 'true');
      box.dataset.nav = key;
      if (!fillIcon(box)) watchIcons();
      return box;
    };

    const iconButton = (name, up, disabled, onClick) => {
      const b = el('button', 'foundation-web-icon-button relative clip group/interactable cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard disabled:opacity-[0.5]');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', name);
      b.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis' + (up ? ' routility-home-up' : '')));
      b.addEventListener('click', onClick);
      return b;
    };

    const mini = (text, onClick) => {
      const b = button(text, onClick);
      b.classList.remove('height-1000', 'text-label-medium');
      b.classList.add('height-800', 'text-label-small');
      return b;
    };

    const reorder = (list, from, to) => {
      if (from === to) return;
      const keys = list.map(x => x.key);
      const [k] = keys.splice(from, 1);
      keys.splice(to, 0, k);
      store({ ...lay, order: keys });
    };

    const toggle = (key) => {
      if (flag(key)) {
        save({ [flag(key)]: isHidden(key) });
        render();
        return;
      }
      store({ ...lay, hidden: isHidden(key) ? lay.hidden.filter(k => k !== key) : [...lay.hidden, key] });
    };

    function render() {
      section.textContent = '';
      const card = el('div', 'routility-viz-panel');
      const head = el('div', 'routility-viz-head');
      head.appendChild(el('span', 'text-body-small content-muted', lt('Drag a row, or use the arrows. Your name always stays at the top.')));
      const reset = mini(lt('Reset'), () => {
        if (settings.calcNav === false) save({ calcNav: true });
        if (settings.forumNav === false) save({ forumNav: true });
        if (settings.tradeAdsNav === false) save({ tradeAdsNav: true });
        store(clean(NAV_DEFAULT));
      });
      reset.disabled = JSON.stringify(lay) === JSON.stringify(clean(NAV_DEFAULT)) && settings.calcNav !== false && settings.forumNav !== false && settings.tradeAdsNav !== false;
      head.appendChild(reset);
      card.appendChild(head);
      const ul = el('ol', 'routility-viz-list');
      const me = el('li', 'routility-viz-row routility-viz-fixed');
      const meBody = el('div', 'routility-viz-body');
      meBody.appendChild(el('span', 'routility-viz-name text-title-small content-emphasis', lt('Your name')));
      me.appendChild(meBody);
      ul.appendChild(me);
      const list = arranged();
      list.forEach((s, i) => {
        const off = isHidden(s.key);
        const stuck = blocked(s.key);
        const li = el('li', 'routility-viz-row' + (off || stuck ? ' routility-viz-off' : ''));
        const grip = el('span', 'routility-viz-grip');
        grip.setAttribute('aria-hidden', 'true');
        grip.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-grip size-400'));
        grip.addEventListener('pointerdown', () => { li.draggable = true; });
        li.appendChild(grip);
        const body = el('div', 'routility-viz-body');
        body.appendChild(iconOf(s.key));
        body.appendChild(el('span', 'routility-viz-name text-title-small content-emphasis', s.name));
        if (stuck) body.appendChild(el('span', 'text-label-small content-muted', ({ calc: lt('Trade Calculator is off'), ads: lt('Trade Ads is off'), forum: lt('Forum is off') })[s.key]));
        else if (off) body.appendChild(el('span', 'text-label-small content-muted', lt('Hidden')));
        li.appendChild(body);
        const ctl = el('div', 'routility-viz-ctl flex items-center gap-small');
        ctl.appendChild(iconButton(lt('Move {name} up', { name: s.name }), true, i === 0, () => reorder(list, i, i - 1)));
        ctl.appendChild(iconButton(lt('Move {name} down', { name: s.name }), false, i === list.length - 1, () => reorder(list, i, i + 1)));
        const vis = twin(mini(off ? lt('Show') : lt('Hide'), () => toggle(s.key)), off ? lt('Hide') : lt('Show'));
        vis.disabled = stuck;
        ctl.appendChild(vis);
        li.appendChild(ctl);
        li.addEventListener('dragstart', (e) => {
          drag = { from: i };
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', s.key);
          requestAnimationFrame(() => li.classList.add('routility-viz-dragging'));
        });
        li.addEventListener('dragend', () => {
          li.draggable = false;
          li.classList.remove('routility-viz-dragging');
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n.classList.remove('routility-viz-before', 'routility-viz-after'));
          drag = null;
        });
        li.addEventListener('dragover', (e) => {
          if (!drag) return;
          e.preventDefault();
          const r = li.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n !== li && n.classList.remove('routility-viz-before', 'routility-viz-after'));
          li.classList.toggle('routility-viz-after', after);
          li.classList.toggle('routility-viz-before', !after);
        });
        li.addEventListener('drop', (e) => {
          if (!drag) return;
          e.preventDefault();
          let to = i + (li.classList.contains('routility-viz-after') ? 1 : 0);
          if (drag.from < to) to--;
          reorder(list, drag.from, to);
        });
        ul.appendChild(li);
      });
      card.appendChild(ul);
      section.appendChild(card);
    }

    render();
    return section;
  }

  const SERVER_DEFAULT = { order: ['private', 'regions', 'friends', 'other'], hidden: [] };

  function serverVisualizer(stored, settings) {
    const ENTRIES = [['private', lt('Your Private Servers')], ['regions', lt('Server Regions')], ['friends', lt('Servers My Friends Are In')], ['other', lt('Other Servers')]];
    const clean = (v) => ({ order: Array.isArray(v && v.order) ? v.order.map(String) : [], hidden: Array.isArray(v && v.hidden) ? v.hidden.map(String) : [] });
    let lay = clean(stored.routilityServerLayout || SERVER_DEFAULT);
    const section = el('section', 'routility-set-row routility-viz routility-nav-viz');
    section.dataset.key = 'serverLayout';
    let drag = null;

    const store = (next) => {
      lay = next;
      chrome.storage.local.set({ routilityServerLayout: lay });
      render();
    };
    const arranged = () => ENTRIES.map(([key, name], i) => {
      const at = lay.order.indexOf(key);
      return { key, name, rank: at >= 0 ? at : 1000 + i };
    }).sort((a, b) => a.rank - b.rank);
    const blocked = (key) => key === 'regions' && (settings.serverRegions === false || settings.serverStats === false);
    const iconButton = (name, up, disabled, onClick) => {
      const b = el('button', 'foundation-web-icon-button relative clip group/interactable cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard disabled:opacity-[0.5]');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', name);
      b.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis' + (up ? ' routility-home-up' : '')));
      b.addEventListener('click', onClick);
      return b;
    };
    const mini = (text, onClick) => {
      const b = button(text, onClick);
      b.classList.remove('height-1000', 'text-label-medium');
      b.classList.add('height-800', 'text-label-small');
      return b;
    };
    const reorder = (list, from, to) => {
      if (from === to) return;
      const keys = list.map(x => x.key);
      const [k] = keys.splice(from, 1);
      keys.splice(to, 0, k);
      store({ ...lay, order: keys });
    };

    function render() {
      section.textContent = '';
      const card = el('div', 'routility-viz-panel');
      const head = el('div', 'routility-viz-head');
      head.appendChild(el('span', 'text-body-small content-muted', lt('Drag a row, or use the arrows. The Servers tab on every game changes to match.')));
      const reset = mini(lt('Reset'), () => store(clean(SERVER_DEFAULT)));
      reset.disabled = JSON.stringify(lay) === JSON.stringify(clean(SERVER_DEFAULT));
      head.appendChild(reset);
      card.appendChild(head);
      const ul = el('ol', 'routility-viz-list');
      const list = arranged();
      list.forEach((s, i) => {
        const off = lay.hidden.includes(s.key);
        const stuck = blocked(s.key);
        const li = el('li', 'routility-viz-row' + (off || stuck ? ' routility-viz-off' : ''));
        const grip = el('span', 'routility-viz-grip');
        grip.setAttribute('aria-hidden', 'true');
        grip.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-grip size-400'));
        grip.addEventListener('pointerdown', () => { li.draggable = true; });
        li.appendChild(grip);
        const body = el('div', 'routility-viz-body');
        body.appendChild(el('span', 'routility-viz-name text-title-small content-emphasis', s.name));
        if (stuck) body.appendChild(el('span', 'text-label-small content-muted', lt('Server Regions is off')));
        else if (off) body.appendChild(el('span', 'text-label-small content-muted', lt('Hidden')));
        li.appendChild(body);
        const ctl = el('div', 'routility-viz-ctl flex items-center gap-small');
        ctl.appendChild(iconButton(lt('Move {name} up', { name: s.name }), true, i === 0, () => reorder(list, i, i - 1)));
        ctl.appendChild(iconButton(lt('Move {name} down', { name: s.name }), false, i === list.length - 1, () => reorder(list, i, i + 1)));
        const vis = twin(mini(off ? lt('Show') : lt('Hide'), () => store({ ...lay, hidden: off ? lay.hidden.filter(k => k !== s.key) : [...lay.hidden, s.key] })), off ? lt('Hide') : lt('Show'));
        vis.disabled = stuck;
        ctl.appendChild(vis);
        li.appendChild(ctl);
        li.addEventListener('dragstart', (e) => {
          drag = { from: i };
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', s.key);
          requestAnimationFrame(() => li.classList.add('routility-viz-dragging'));
        });
        li.addEventListener('dragend', () => {
          li.draggable = false;
          li.classList.remove('routility-viz-dragging');
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n.classList.remove('routility-viz-before', 'routility-viz-after'));
          drag = null;
        });
        li.addEventListener('dragover', (e) => {
          if (!drag) return;
          e.preventDefault();
          const r = li.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n !== li && n.classList.remove('routility-viz-before', 'routility-viz-after'));
          li.classList.toggle('routility-viz-after', after);
          li.classList.toggle('routility-viz-before', !after);
        });
        li.addEventListener('drop', (e) => {
          if (!drag) return;
          e.preventDefault();
          let to = i + (li.classList.contains('routility-viz-after') ? 1 : 0);
          if (drag.from < to) to--;
          reorder(list, drag.from, to);
        });
        ul.appendChild(li);
      });
      card.appendChild(ul);
      section.appendChild(card);
    }

    render();
    return section;
  }

  const CHARTS_CLASSIC = ['Top Playing Now', 'Most Popular', 'Top Earning', 'Top Rated', 'Up-and-Coming', 'Fun with Friends', 'Top Paid Access', 'Learn & Explore', 'Top Trending', 'Top Revisited'];

  function layoutVisualizer(stored) {
    const clean = (v) => ({ order: Array.isArray(v && v.order) ? v.order.map(String) : [], hidden: Array.isArray(v && v.hidden) ? v.hidden.map(String) : [] });
    const saved = stored.routilityLayouts || {};
    let layouts = { home: clean(saved.home || stored.routilityHomeLayout || { order: HOME_DEFAULT }), charts: clean(saved.charts) };
    const seen = stored.routilityLayoutSeen || {};
    let hiddenIds = (stored.routilityHiddenGames || []).map(String);
    const names = stored.routilityHiddenNames || {};
    const icons = new Map();
    const safe = (src) => typeof src === 'string' && /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//.test(src);
    const section = el('section', 'routility-set-row routility-viz');
    const cols = el('div', 'routility-viz-cols');
    section.appendChild(cols);
    let drag = null;

    const save = (kind, next) => {
      layouts = { ...layouts, [kind]: next };
      chrome.storage.local.set({ routilityLayouts: layouts });
      render();
    };

    const arranged = (kind) => {
      const lay = layouts[kind];
      return (seen[kind] || []).map((s, i) => {
        const at = lay.order.indexOf(s.key);
        return { ...s, rank: at >= 0 ? at : 1000 + i };
      }).sort((a, b) => a.rank - b.rank);
    };

    const label = (s, list) => {
      const base = s.key.replace(/#\d+$/, '');
      const n = Number(s.key.match(/#(\d+)$/)?.[1] || 1);
      return list.filter(x => x.key.replace(/#\d+$/, '') === base).length > 1 ? `${base} (${n})` : base;
    };

    const iconButton = (name, up, disabled, onClick) => {
      const b = el('button', 'foundation-web-icon-button relative clip group/interactable cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard disabled:opacity-[0.5]');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', name);
      b.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis' + (up ? ' routility-home-up' : '')));
      b.addEventListener('click', onClick);
      return b;
    };

    const mini = (text, onClick) => {
      const b = button(text, onClick);
      b.classList.remove('height-1000', 'text-label-medium');
      b.classList.add('height-800', 'text-label-small');
      return b;
    };

    const strip = (s) => {
      const t = el('span', 'routility-viz-strip' + (s.grid ? ' routility-viz-strip-grid' : ''));
      t.setAttribute('aria-hidden', 'true');
      const thumbs = (s.thumbs || []).filter(safe).slice(0, s.grid ? 6 : 10);
      const count = thumbs.length || (s.grid ? 6 : 10);
      for (let i = 0; i < count; i++) {
        const tile = el('span', 'routility-viz-thumb');
        if (thumbs[i]) {
          const img = el('img');
          img.src = thumbs[i];
          img.alt = '';
          img.loading = 'lazy';
          tile.appendChild(img);
        }
        t.appendChild(tile);
      }
      return t;
    };

    const reorder = (kind, list, from, to) => {
      if (from === to) return;
      const keys = list.map(x => x.key);
      const [k] = keys.splice(from, 1);
      keys.splice(to, 0, k);
      save(kind, { ...layouts[kind], order: keys });
    };

    const panel = (kind, title) => {
      const card = el('div', 'routility-viz-panel');
      const head = el('div', 'routility-viz-head');
      head.appendChild(el('h4', 'text-title-medium content-emphasis margin-none', title));
      const acts = el('div', 'flex items-center gap-small');
      const list = arranged(kind);
      if (kind === 'home' && list.length) {
        acts.appendChild(mini(lt('Classic Order'), () => {
          const keys = (seen.home || []).map(s => s.key);
          const cont = keys.find(k => /^Continue#/.test(k));
          save('home', { order: cont ? [cont, ...keys.filter(k => k !== cont)] : keys, hidden: layouts.home.hidden });
        }));
      }
      if (kind === 'charts' && list.length) {
        acts.appendChild(mini(lt('Classic Order'), () => {
          const keys = (seen.charts || []).map(s => s.key);
          const rank = (k) => {
            const i = CHARTS_CLASSIC.indexOf(k.replace(/#\d+$/, ''));
            return i < 0 ? CHARTS_CLASSIC.length : i;
          };
          const order = keys.map((k, i) => [k, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]);
          save('charts', { order, hidden: layouts.charts.hidden });
        }));
      }
      const reset = mini(lt('Reset'), () => save(kind, { order: kind === 'home' ? [...HOME_DEFAULT] : [], hidden: [] }));
      reset.disabled = !layouts[kind].order.length && !layouts[kind].hidden.length;
      acts.appendChild(reset);
      head.appendChild(acts);
      card.appendChild(head);
      const ul = el('ol', 'routility-viz-list');
      if (kind === 'home') {
        const li = el('li', 'routility-viz-row routility-viz-fixed');
        const body = el('div', 'routility-viz-body');
        const top = el('div', 'routility-viz-top');
        top.appendChild(el('span', 'routility-viz-name text-title-small content-emphasis', lt('Friends')));
        top.appendChild(el('span', 'text-label-small content-muted', lt('Always first')));
        body.appendChild(top);
        const faces = el('span', 'routility-viz-faces');
        faces.setAttribute('aria-hidden', 'true');
        const pics = (seen.homeFriends || []).filter(safe);
        for (let i = 0; i < (pics.length || 8); i++) {
          const f = el('span', 'routility-viz-face');
          if (pics[i]) {
            const img = el('img');
            img.src = pics[i];
            img.alt = '';
            f.appendChild(img);
          }
          faces.appendChild(f);
        }
        body.appendChild(faces);
        li.appendChild(body);
        ul.appendChild(li);
      }
      if (!list.length) {
        card.appendChild(ul);
        card.appendChild(el('p', 'text-body-small content-muted margin-none routility-viz-empty', lt('Open {page} once and its sections show up here.', { page: title })));
        return card;
      }
      list.forEach((s, i) => {
        const isHidden = layouts[kind].hidden.includes(s.key);
        const li = el('li', 'routility-viz-row' + (isHidden ? ' routility-viz-off' : ''));
        li.dataset.index = String(i);
        const grip = el('span', 'routility-viz-grip');
        grip.setAttribute('aria-hidden', 'true');
        grip.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-grip size-400'));
        grip.addEventListener('pointerdown', () => { li.draggable = true; });
        li.appendChild(grip);
        const body = el('div', 'routility-viz-body');
        const top = el('div', 'routility-viz-top');
        top.appendChild(el('span', 'routility-viz-name text-title-small content-emphasis', label(s, list)));
        if (isHidden) top.appendChild(el('span', 'text-label-small content-muted', lt('Hidden')));
        body.appendChild(top);
        body.appendChild(strip(s));
        li.appendChild(body);
        const ctl = el('div', 'routility-viz-ctl flex items-center gap-small');
        ctl.appendChild(iconButton(lt('Move {name} up', { name: s.title }), true, i === 0, () => reorder(kind, list, i, i - 1)));
        ctl.appendChild(iconButton(lt('Move {name} down', { name: s.title }), false, i === list.length - 1, () => reorder(kind, list, i, i + 1)));
        ctl.appendChild(twin(mini(isHidden ? lt('Show') : lt('Hide'), () => {
          const hiddenKeys = isHidden ? layouts[kind].hidden.filter(k => k !== s.key) : [...layouts[kind].hidden, s.key];
          save(kind, { order: list.map(x => x.key), hidden: hiddenKeys });
        }), isHidden ? lt('Hide') : lt('Show')));
        li.appendChild(ctl);
        li.addEventListener('dragstart', (e) => {
          drag = { kind, from: i };
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', s.key);
          requestAnimationFrame(() => li.classList.add('routility-viz-dragging'));
        });
        li.addEventListener('dragend', () => {
          li.draggable = false;
          li.classList.remove('routility-viz-dragging');
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n.classList.remove('routility-viz-before', 'routility-viz-after'));
          drag = null;
        });
        li.addEventListener('dragover', (e) => {
          if (!drag || drag.kind !== kind) return;
          e.preventDefault();
          const r = li.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          ul.querySelectorAll('.routility-viz-before, .routility-viz-after').forEach(n => n !== li && n.classList.remove('routility-viz-before', 'routility-viz-after'));
          li.classList.toggle('routility-viz-after', after);
          li.classList.toggle('routility-viz-before', !after);
        });
        li.addEventListener('drop', (e) => {
          if (!drag || drag.kind !== kind) return;
          e.preventDefault();
          const after = li.classList.contains('routility-viz-after');
          let to = i + (after ? 1 : 0);
          if (drag.from < to) to--;
          reorder(kind, list, drag.from, to);
        });
        ul.appendChild(li);
      });
      card.appendChild(ul);
      return card;
    };

    const hiddenPanel = () => {
      const card = el('div', 'routility-viz-panel routility-viz-hidden');
      const head = el('div', 'routility-viz-head');
      head.appendChild(el('h4', 'text-title-medium content-emphasis margin-none', lt('Hidden Experiences')));
      if (hiddenIds.length) {
        head.appendChild(mini(lt('Show all'), () => {
          hiddenIds = [];
          chrome.storage.local.set({ routilityHiddenGames: [] });
          render();
        }));
      }
      card.appendChild(head);
      if (!hiddenIds.length) {
        card.appendChild(el('p', 'text-body-small content-muted margin-none routility-viz-empty', lt('Nothing hidden. Use the × on an experience in Home or Charts.')));
        return card;
      }
      const grid = el('ul', 'routility-viz-games');
      for (const id of hiddenIds) {
        const li = el('li', 'routility-viz-game');
        const thumb = el('span', 'thumbnail-2d-container routility-viz-game-thumb');
        if (icons.get(id)) {
          const img = el('img');
          img.src = icons.get(id);
          img.alt = '';
          thumb.appendChild(img);
        }
        li.appendChild(thumb);
        li.appendChild(el('span', 'text-label-small content-emphasis routility-viz-game-name', names[id] || lt('Experience')));
        li.appendChild(mini(lt('Show'), () => {
          hiddenIds = hiddenIds.filter(x => x !== id);
          chrome.storage.local.set({ routilityHiddenGames: hiddenIds });
          render();
        }));
        grid.appendChild(li);
      }
      card.appendChild(grid);
      return card;
    };

    function render() {
      cols.textContent = '';
      cols.appendChild(panel('home', lt('Home')));
      cols.appendChild(panel('charts', lt('Charts')));
      cols.appendChild(hiddenPanel());
    }

    const need = hiddenIds.filter(id => /^\d+$/.test(id)).slice(0, 100);
    if (need.length) {
      fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${need.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Webp&isCircular=false`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          for (const t of (d && d.data) || []) if (t.imageUrl) icons.set(String(t.targetId), t.imageUrl);
          render();
        })
        .catch(() => {});
    }
    render();
    return section;
  }

  function featureRow(def, settings, save, rows, nested) {
    const section = el('section', 'routility-set-row' + (nested ? ' routility-set-child' : ''));
    section.dataset.key = def.key;
    const text = el('div', 'routility-set-text');
    text.appendChild(el('h3', (nested ? 'text-title-medium' : 'text-title-large') + ' content-emphasis padding-none', lt(def.title)));
    text.appendChild(el('p', 'text-body-small content-muted margin-none', lt(def.desc)));
    section.appendChild(text);
    if (MOCKS[def.key]) {
      const mock = el('div', 'routility-set-mock');
      mock.setAttribute('aria-hidden', 'true');
      mock.appendChild(MOCKS[def.key]());
      section.appendChild(mock);
    }
    const side = el('div', 'routility-set-control');
    let below = null;
    if (def.options) {
      const opts = def.options.map(([value, label]) => ({ value, label: def.key === 'language' && value !== 'auto' ? label : def.key === 'currency' ? value + ' · ' + lt(label) : lt(label) }));
      const current = opts.some(o => o.value === settings[def.key]) ? settings[def.key] : DEFAULTS[def.key];
      const extraFor = def.rateInput || def.robuxInput || def.fontInput;
      const rate = def.rateInput ? rateField(settings, save) : def.robuxInput ? robuxField(settings, save, def.amountKey, def.amountLabel) : def.fontInput ? fontField() : null;
      if (rate) {
        rate.hidden = current !== extraFor;
        if (def.fontInput) below = rate;
        else side.appendChild(rate);
      }
      side.appendChild(select(lt(def.title), opts, current, (v) => {
        save({ [def.key]: v });
        if (rate) {
          rate.hidden = v !== extraFor;
          if (!rate.hidden) rate.input.focus({ preventScroll: true });
        }
      }));
      section.classList.add('routility-set-row-select');
    } else {
      side.appendChild(toggle(lt(def.title), settings[def.key], (on) => {
        save({ [def.key]: on });
        paint(rows, settings);
      }));
    }
    section.appendChild(side);
    if (below) section.appendChild(below);
    rows.push({ def, section });
    return section;
  }

  const PRESETS = [
    { key: 'values', title: LT('Just Values'), desc: LT('Prices and RAP on items, inventories, profiles and trades, plus the price chart and the trade calculator. Everything else stays off.') },
    { key: 'recommended', title: LT('Recommended'), desc: LT('The default setup: values plus the most useful upgrades all over Roblox.') },
    { key: 'everything', title: LT('Everything'), desc: LT('Every feature on, except Fun Mode, Streamer Mode, themes and the other things you only turn on on purpose.') },
  ];

  const LANGUAGE_ROW = { key: 'language', title: LT('Language'), desc: LT('The language RoUtility uses. Same as Roblox follows the language picked in your Roblox settings.'), options: [['auto', LT('Same as Roblox')], ['en', 'English'], ['es', 'Español'], ['pt', 'Português (Brasil)'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ja', '日本語'], ['ko', '한국어'], ['zh-cn', '简体中文'], ['zh-tw', '繁體中文'], ['id', 'Bahasa Indonesia'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['tr', 'Türkçe'], ['ru', 'Русский'], ['pl', 'Polski']] };

  const LOG_MARK = { new: '+', improved: '~', fixed: '−' };
  const LOG_NAME = { new: LT('New'), improved: LT('Improved'), fixed: LT('Fixed') };

  function logDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    try {
      return d.toLocaleDateString(window.RoUtilityI18n.locale(), { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d.toDateString();
    }
  }

  function logPeople(names, people, prefix) {
    const line = el('span', 'text-body-small content-muted routility-log-credit');
    line.appendChild(document.createTextNode(prefix + ' '));
    names.forEach((name, i) => {
      if (i) line.appendChild(document.createTextNode(', '));
      const gh = people[name] && people[name].github;
      if (gh) {
        const a = el('a', 'text-link', '@' + name);
        a.href = 'https://github.com/' + encodeURIComponent(gh);
        a.target = '_blank';
        a.rel = 'noreferrer';
        line.appendChild(a);
      } else {
        line.appendChild(el('span', 'content-default', name));
      }
    });
    return line;
  }

  function whatsNewPane(section) {
    const intro = el('p', 'text-body-medium content-default margin-none', lt('Every update, what changed and who helped make it.'));
    section.appendChild(intro);
    const holder = el('div', 'flex flex-col gap-xlarge');
    section.appendChild(holder);
    chrome.runtime.sendMessage({ type: 'changelog' }, (log) => {
      void chrome.runtime.lastError;
      if (!log || !Array.isArray(log.releases) || !holder.isConnected) {
        holder.appendChild(el('p', 'text-body-medium content-muted margin-none', lt('Couldn’t load the update log.')));
        return;
      }
      const people = log.contributors || {};
      const builders = new Set();
      const reporters = new Set();
      for (const r of log.releases) for (const c of r.changes || []) {
        (c.by || []).forEach(n => builders.add(n));
        (c.thanks || []).forEach(n => reporters.add(n));
      }
      if (builders.size || reporters.size) {
        const thanks = group(lt('Everyone Who Helped'));
        const body = el('div', 'routility-log-people');
        if (builders.size) body.appendChild(logPeople([...builders], people, lt('Code:')));
        if (reporters.size) body.appendChild(logPeople([...reporters], people, lt('Bug reports and ideas:')));
        thanks.card.appendChild(body);
        holder.appendChild(thanks);
      }
      const current = chrome.runtime.getManifest().version;
      for (const r of log.releases) {
        const wrap = group(lt('Version {version}', { version: r.version }), logDate(r.date));
        wrap.classList.add('routility-log-group');
        if (r.version === current) wrap.querySelector('.routility-set-group-head').appendChild(el('span', 'routility-set-chip routility-log-current', lt('Installed')));
        const card = wrap.card;
        card.classList.add('routility-log-card');
        if (r.summary) card.appendChild(el('p', 'text-body-medium content-emphasis margin-none routility-log-summary', r.summary));
        for (const type of ['new', 'improved', 'fixed']) {
          const items = (r.changes || []).filter(c => c.type === type);
          if (!items.length) continue;
          const list = el('ul', 'routility-log-list');
          list.dataset.type = type;
          list.appendChild(el('li', 'text-label-medium content-muted routility-log-kind', lt(LOG_NAME[type])));
          for (const c of items) {
            const li = el('li', 'routility-log-row');
            li.appendChild(el('span', 'routility-log-mark routility-log-' + type, LOG_MARK[type]));
            const text = el('div', 'flex flex-col gap-xxsmall routility-log-text');
            text.appendChild(el('span', 'text-body-medium content-default', c.text));
            if (c.by && c.by.length) text.appendChild(logPeople(c.by, people, lt('By')));
            if (c.thanks && c.thanks.length) text.appendChild(logPeople(c.thanks, people, lt('Thanks to')));
            li.appendChild(text);
            list.appendChild(li);
          }
          card.appendChild(list);
        }
        holder.appendChild(wrap);
      }
    });
  }

  function infoPane(section, cache, settings, stored) {
    const total = Object.values(PAGES).reduce((n, p) => n + keysOf(p).length, 0);
    const on = Object.values(PAGES).reduce((n, p) => n + keysOf(p).filter(k => settings[k]).length, 0);
    const hero = el('div', 'routility-set-hero');
    const logo = el('img', 'routility-set-hero-logo');
    logo.src = chrome.runtime.getURL('assets/icons/icon128.png');
    logo.alt = '';
    hero.appendChild(logo);
    const words = el('div', 'routility-set-hero-text');
    const about = el('p', 'text-body-large content-default margin-none');
    const link = el('a', 'text-link', 'routility.io');
    link.href = 'https://routility.io';
    link.target = '_blank';
    link.rel = 'noreferrer';
    about.append(...around(lt('USD prices, demand, trends, owners and trade values from {site}, plus a lot of small upgrades to Roblox itself.'), '{site}', link));
    words.appendChild(about);
    const chips = el('div', 'routility-set-hero-chips');
    chips.appendChild(el('span', 'routility-set-chip', lt('{on} of {total} features on', { on, total })));
    const version = el('a', 'routility-set-chip routility-set-chip-link', lt('Version {version}', { version: chrome.runtime.getManifest().version }));
    version.href = '#!/routility/whatsnew';
    version.dataset.rtTip = lt('See what’s new');
    chips.appendChild(version);
    const source = el('a', 'routility-set-chip routility-set-chip-link', lt('Open Source on GitHub'));
    source.href = 'https://github.com/insane/routility-extension';
    source.target = '_blank';
    source.rel = 'noreferrer';
    source.dataset.rtTip = lt('Read every line of RoUtility’s code');
    chips.appendChild(source);
    words.appendChild(chips);
    hero.appendChild(words);
    section.appendChild(hero);

    const setup = group(lt('Quick Setup'), lt('Pick how much RoUtility you want. You can still change any single setting afterwards.'));
    setup.classList.add('routility-set-presets-group');
    setup.card.classList.add('routility-set-card-plain');
    section.appendChild(setup);
    chrome.runtime.sendMessage({ type: 'presetState' }, (state) => {
      void chrome.runtime.lastError;
      if (!state || !setup.isConnected) return;
      if (state.welcome) {
        const head = setup.querySelector('.routility-set-group-head > span');
        if (head) head.textContent = lt('Welcome! How much RoUtility do you want?');
        setup.classList.add('routility-set-presets-welcome');
      }
      const grid = el('div', 'routility-set-presets');
      for (const p of PRESETS) {
        const on = state.current === p.key;
        const card = el('div', 'routility-set-preset' + (on ? ' routility-set-preset-on' : ''));
        const top = el('div', 'routility-set-preset-top');
        top.appendChild(el('h3', 'text-title-large content-emphasis margin-none', lt(p.title)));
        if (on) top.appendChild(el('span', 'routility-set-chip routility-set-preset-current', lt('Current')));
        card.appendChild(top);
        card.appendChild(el('p', 'text-body-small content-muted margin-none', lt(p.desc)));
        if (!on) {
          card.appendChild(button(lt('Use This'), (btn, text) => {
            btn.disabled = true;
            text.textContent = lt('Applying…');
            chrome.runtime.sendMessage({ type: 'applyPreset', name: p.key }, (res) => {
              void chrome.runtime.lastError;
              if (res && res.ok) location.reload();
              else {
                text.textContent = lt('Didn’t Apply, Try Again');
                setTimeout(() => {
                  btn.disabled = false;
                  text.textContent = lt('Use This');
                }, 2500);
              }
            });
          }));
        }
        grid.appendChild(card);
      }
      setup.card.appendChild(grid);
      const values = el('div', 'routility-set-presets-foot');
      values.appendChild(el('span', 'text-body-small content-muted', state.valuesOff ? lt('Prices and values are off. Turn them back on to see prices, RAP and values on items, inventories, trades and the Wearing panel again.') : lt('Don’t want prices or values? Turn off every price, RAP and value RoUtility adds, and keep everything else how it is.')));
      values.appendChild(button(state.valuesOff ? lt('Turn Values Back On') : lt('Turn Off Values'), (btn, text) => {
        btn.disabled = true;
        text.textContent = lt('Applying…');
        chrome.runtime.sendMessage({ type: 'setValues', on: !!state.valuesOff }, (res) => {
          void chrome.runtime.lastError;
          if (res && res.ok) location.reload();
          else {
            text.textContent = lt('Didn’t Apply, Try Again');
            setTimeout(() => {
              btn.disabled = false;
              text.textContent = state.valuesOff ? lt('Turn Values Back On') : lt('Turn Off Values');
            }, 2500);
          }
        });
      }));
      setup.card.appendChild(values);
      if (state.canUndo || state.welcome) {
        const foot = el('div', 'routility-set-presets-foot');
        if (state.canUndo) {
          foot.appendChild(el('span', 'text-body-small content-muted', lt('Changed your mind? Undo brings back your settings from before the last preset.')));
          foot.appendChild(button(lt('Undo'), (btn) => {
            btn.disabled = true;
            chrome.runtime.sendMessage({ type: 'undoPreset' }, () => { void chrome.runtime.lastError; location.reload(); });
          }));
        } else {
          foot.appendChild(el('span', 'text-body-small content-muted', lt('Not sure? Recommended is already on, so you can close this and start using Roblox.')));
          foot.appendChild(button(lt('Keep Recommended'), () => {
            chrome.runtime.sendMessage({ type: 'dismissWelcome' }, () => { void chrome.runtime.lastError; location.reload(); });
          }));
        }
        setup.card.appendChild(foot);
      }
    });

    const discord = el('div', 'routility-set-discord');
    const bot = el('img', 'routility-set-discord-bot');
    bot.src = chrome.runtime.getURL('assets/icons/bot.png');
    bot.alt = '';
    discord.appendChild(bot);
    const dText = el('div', 'routility-set-discord-text');
    dText.appendChild(el('h2', 'text-heading-small content-emphasis margin-none', lt('Join the RoUtility Discord')));
    dText.appendChild(el('p', 'text-body-medium content-default margin-none', lt('RoUtility is free for everyone. Joining is the best way to support it, and it would mean the world to us.')));
    const perks = el('div', 'routility-set-hero-chips');
    for (const perk of [LT('First look at updates'), LT('Talk trades & values'), LT('Help shape RoUtility')]) perks.appendChild(el('span', 'routility-set-chip', lt(perk)));
    dText.appendChild(perks);
    discord.appendChild(dText);
    const join = el('a', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-large height-1200 padding-x-large bg-action-emphasis content-action-emphasis routility-set-discord-join');
    join.href = 'https://discord.gg/util';
    join.target = '_blank';
    join.rel = 'noreferrer';
    join.appendChild(stateLayer());
    join.appendChild(el('span', 'text-no-wrap', lt('Join the Discord')));
    discord.appendChild(join);
    section.appendChild(discord);

    const language = group(lt('Language'));
    const saveLanguage = (patch) => chrome.storage.local.get('routilitySettings', (st) => {
      chrome.storage.local.set({ routilitySettings: { ...(st.routilitySettings || {}), ...patch } }, () => location.reload());
    });
    language.card.appendChild(featureRow(LANGUAGE_ROW, settings, saveLanguage, [], false));
    section.appendChild(language);

    for (const name of [...new Set(TABS.filter(t => PAGES[t.key]).map(t => t.section))]) {
      const cats = group(lt(name));
      cats.card.classList.add('routility-set-card-plain');
      const grid = el('div', 'routility-set-cats');
      for (const tab of TABS.filter(t => PAGES[t.key] && t.section === name)) {
        const keys = keysOf(PAGES[tab.key]);
        const count = keys.filter(k => settings[k]).length;
        const card = el('a', 'routility-set-cat');
        card.href = tab.hash;
        card.addEventListener('click', (e) => {
          e.preventDefault();
          goTo(tab.hash);
        });
        const catIcon = el('span', 'routility-set-svg routility-set-cat-icon');
        catIcon.innerHTML = CAT_SVG[tab.key] || SVG[ICONS[tab.key]];
        catIcon.setAttribute('aria-hidden', 'true');
        card.appendChild(catIcon);
        const t = el('div', 'routility-set-cat-text');
        t.appendChild(el('span', 'text-title-medium content-emphasis', lt(tab.label)));
        t.appendChild(el('span', 'text-body-small content-muted', lt(BLURBS[tab.key])));
        card.appendChild(t);
        if (tab.key === 'menu') {
          const navHidden = (Array.isArray(stored.routilityNavLayout && stored.routilityNavLayout.hidden) ? stored.routilityNavLayout.hidden.length : 0) + (settings.calcNav === false ? 1 : 0) + (settings.forumNav === false ? 1 : 0) + (settings.tradeAdsNav === false ? 1 : 0);
          card.appendChild(el('span', 'routility-set-cat-count', navHidden ? ltn(navHidden, '{n} hidden', '{n} hidden') : lt('All shown')));
        } else {
          card.appendChild(el('span', 'routility-set-cat-count' + (count ? '' : ' routility-set-cat-none'), lt('{on}/{total} on', { on: count, total: keys.length })));
        }
        grid.appendChild(card);
      }
      cats.card.appendChild(grid);
      section.appendChild(cats);
    }

    const others = group(lt('Other Extensions'), lt('Seen on Roblox pages recently'));
    others.hidden = true;
    section.appendChild(others);
    const installed = (url) => fetch(url, { mode: 'no-cors', cache: 'no-store' }).then(() => true, () => false);
    chrome.storage.local.get('routilityOtherExts', async (st) => {
      const seen = st.routilityOtherExts || {};
      const ids = Object.entries(seen.ids || {});
      const live = new Map(await Promise.all(ids.map(async ([id, e]) => [id, !(e && e.url) || await installed(e.url)])));
      const gone = ids.filter(([id]) => !live.get(id)).map(([id]) => id);
      if (gone.length) {
        const keep = (map, test) => Object.fromEntries(Object.entries(map || {}).filter(test));
        seen.ids = keep(seen.ids, ([id]) => live.get(id));
        seen.brands = keep(seen.brands, ([, e]) => !(e && Array.isArray(e.ids) && e.ids.length && e.ids.every(id => gone.includes(id))));
        chrome.storage.local.set({ routilityOtherExts: seen });
      }
      if (!others.isConnected) return;
      const brands = Object.keys(seen.brands || {}).sort();
      const unknown = Math.max(0, Object.keys(seen.ids || {}).length - brands.length);
      if (!brands.length && !unknown) return;
      others.hidden = false;
      const both = (a, b) => lt('{a} and {b}', { a, b });
      const names = brands.length > 1 ? both(brands.slice(0, -1).join(', '), brands[brands.length - 1]) : brands.join('');
      const rest = unknown ? ltn(unknown, '{n} other extension', '{n} other extensions') : '';
      const who = names && rest ? both(names, rest) : names || rest;
      const lead = row(lt('Works Alongside'), brands.length + unknown === 1 ? lt('{names} is also changing Roblox pages. RoUtility works next to it, but when two extensions add the same thing you can see it twice. Turn off the copy you like less, in either extension.', { names: who }) : lt('{names} are also changing Roblox pages. RoUtility works next to them, but when two extensions add the same thing you can see it twice. Turn off the copy you like less, in either extension.', { names: who }), el('span'), true);
      lead.classList.add('routility-set-row');
      others.card.appendChild(lead);
      const keys = [...new Set(brands.flatMap(b => OVERLAP[b] || []))];
      const titles = {};
      for (const pg of Object.values(PAGES)) for (const g of pg.groups) for (const r of g.rows) if (r.key) titles[r.key] = r.title;
      for (const k of keys) {
        if (!titles[k] || !settings[k]) continue;
        const by = brands.filter(b => (OVERLAP[b] || []).includes(k)).join(', ');
        const r = row(lt(titles[k]), lt('Also in {names}.', { names: by }), button(lt('Turn Off'), (btn, text) => {
          chrome.storage.local.get('routilitySettings', (x) => {
            const next = { ...(x.routilitySettings || {}), [k]: false };
            chrome.storage.local.set({ routilitySettings: next }, () => {
              settings[k] = false;
              text.textContent = lt('Turned Off');
              btn.disabled = true;
            });
          });
        }), true);
        r.classList.add('routility-set-row');
        others.card.appendChild(r);
      }
    });

    const data = group(lt('Data & Privacy'));
    const statusText = (x) => x.itemCount
      ? ltn(x.itemCount, '{n} item • updated {time}', '{n} items • updated {time}', { n: x.itemCount.toLocaleString('en-US'), time: timeAgo(x.lastFetch) })
      : lt('Not downloaded yet.');
    const dataRow = row(lt('Price Data'), statusText(cache), button(lt('Refresh'), (btn, text) => {
      btn.disabled = true;
      text.textContent = lt('Refreshing…');
      chrome.runtime.sendMessage({ type: 'refreshCache' }, (result) => {
        chrome.runtime.sendMessage({ type: 'getCacheStatus' }, (x) => {
          dataRow.description.textContent = result && result.ok
            ? statusText(x || {})
            : lt('Couldn’t refresh right now. Try again in a minute.');
          text.textContent = lt('Refresh');
          btn.disabled = false;
        });
      });
    }), true);
    const privacy = row(lt('Privacy'), lt('Your Roblox cookie and password are never sent to RoUtility, and private inventories stay private. RoUtility only receives public ids it needs to answer: the item or game you’re viewing, the server ids on a game’s Servers tab and the server you join, forum posters, player searches, and profiles whose friends Roblox hides. Forum sign-in is optional and uses Roblox’s official sign-in. While you’re signed in, your playtime history (which experiences and for how many minutes per day) is backed up to your account.'), el('span'), true);
    for (const x of [dataRow, privacy]) {
      x.classList.add('routility-set-row');
      data.card.appendChild(x);
    }
    section.appendChild(data);

    const backup = group(lt('Backup'));
    const buttons = el('div', 'flex items-center gap-small');
    const status = row(lt('Your Settings'), lt('Save them to a file, load them on another browser, or start over. The file also holds your left menu and home layouts, chat size, price alerts, hidden games and playtime history.'), buttons, true);
    const say = (text) => { status.description.textContent = text; };
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const shortText = (v) => typeof v === 'string' && v.length <= 40;
    const PREFS = {
      routilityNavLayout: (v) => isObj(v) && (!v.order || Array.isArray(v.order)) && (!v.hidden || Array.isArray(v.hidden)),
      routilityServerLayout: (v) => isObj(v) && (!v.order || Array.isArray(v.order)) && (!v.hidden || Array.isArray(v.hidden)),
      routilityThemeSlots: (v) => Array.isArray(v) && v.length <= 5 && v.every(x => x === null || (isObj(x) && isObj(x.colors) && Object.values(x.colors).every(c => typeof c === 'string' && c.length <= 40) && (x.fx === undefined || (typeof x.fx === 'string' && x.fx.length <= 20)) && ['blur', 'tint', 'see', 'round'].every(k => x[k] === undefined || Number.isFinite(x[k])))),
      routilityNavCollapsed: (v) => typeof v === 'boolean',
      routilityLayouts: isObj,
      routilityHomeLayout: (v) => isObj(v) || Array.isArray(v),
      routilityHiddenGames: Array.isArray,
      routilityHiddenNames: isObj,
      routilityChatSize: (v) => v === null || (isObj(v) && Number.isFinite(v.w) && Number.isFinite(v.h)),
      routilityPriceAlerts: isObj,
      routilityChartMode: shortText,
      routilityModalSort: shortText,
      routilityClassicViews: isObj,
      routilityTheme: (v) => isObj(v) && isObj(v.colors) && Object.values(v.colors).every(c => typeof c === 'string' && c.length <= 40) && (v.fx === undefined || (typeof v.fx === 'string' && v.fx.length <= 20)) && ['blur', 'tint', 'see', 'round'].every(k => v[k] === undefined || Number.isFinite(v[k])),
      routilityFun: (v) => isObj(v) && (v.spent === undefined || Number.isFinite(v.spent)) && (v.items === undefined || (Array.isArray(v.items) && v.items.length <= 500 && v.items.every(x => isObj(x) && typeof x.kind === 'string' && Number.isFinite(x.id) && Number.isFinite(x.price) && Number.isFinite(x.at)))) && (v.worn === undefined || (Array.isArray(v.worn) && v.worn.length <= 50 && v.worn.every(Number.isFinite))),
    };
    const myId = () => document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid') || '';
    const validPlay = (v) => isObj(v) && isObj(v.days) && Object.keys(v.days).length <= 1000 && Object.entries(v.days).every(([d, games]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && isObj(games) && Object.entries(games).every(([u, m]) => /^\d+$/.test(u) && Number.isFinite(m) && m >= 0 && m <= 1440)) && (v.place === undefined || isObj(v.place));
    const mergePlay = (a, b) => {
      const days = { ...((a && a.days) || {}) };
      for (const [d, games] of Object.entries(b.days)) {
        days[d] = { ...(days[d] || {}) };
        for (const [u, m] of Object.entries(games)) days[d][u] = Math.max(days[d][u] || 0, Math.round(m));
      }
      const place = { ...((a && a.place) || {}) };
      for (const [u, id] of Object.entries(b.place || {})) if (/^\d+$/.test(u) && Number.isFinite(Number(id)) && !place[u]) place[u] = Number(id);
      return { days, place, last: (a && a.last) || 0 };
    };
    const RESET_PREFS = ['routilityTheme', 'routilityThemeImage', 'routilityFont', 'routilityServerLayout', 'routilityNavLayout', 'routilityNavCollapsed', 'routilityLayouts', 'routilityHomeLayout', 'routilityChatSize', 'routilityChartMode', 'routilityModalSort', 'routilityClassicViews', 'routilityFun'];
    buttons.appendChild(button(lt('Export'), () => {
      const me = myId();
      const playKey = me ? 'routilityPlaytime:' + me : null;
      chrome.storage.local.get(['routilitySettings', ...Object.keys(PREFS), ...(playKey ? [playKey] : [])], (st) => {
        const prefs = {};
        for (const k of Object.keys(PREFS)) if (st[k] !== undefined) prefs[k] = st[k];
        const mine = st.routilitySettings || {};
        const settings = {};
        for (const k of Object.keys(DEFAULTS)) settings[k] = k in mine && typeof mine[k] === typeof DEFAULTS[k] ? mine[k] : DEFAULTS[k];
        const out = { routility: 2, settings, prefs };
        if (playKey && st[playKey] && isObj(st[playKey].days)) out.playtime = { userId: me, days: st[playKey].days, place: st[playKey].place || {} };
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
        const a = el('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'routility-settings.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        say(lt('Saved {file}.', { file: 'routility-settings.json' }));
      });
    }));
    const file = el('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      let parsed = null;
      try { parsed = JSON.parse(await f.text()); } catch {}
      const incoming = parsed && typeof parsed === 'object' ? (parsed.settings || parsed) : null;
      if (!incoming || typeof incoming !== 'object') return say(lt('That file isn’t a RoUtility settings file.'));
      const clean = {};
      for (const [k, v] of Object.entries(incoming)) if (k in DEFAULTS && typeof v === typeof DEFAULTS[k]) clean[k] = v;
      const prefs = {};
      const given = parsed && isObj(parsed.prefs) ? parsed.prefs : {};
      for (const [k, test] of Object.entries(PREFS)) {
        if (!(k in given)) continue;
        const v = given[k];
        if (test(v) && JSON.stringify(v).length <= 200000) prefs[k] = v;
      }
      const play = parsed && isObj(parsed.playtime) && /^\d+$/.test(String(parsed.playtime.userId)) && validPlay(parsed.playtime) ? parsed.playtime : null;
      if (!Object.keys(clean).length && !Object.keys(prefs).length && !play) return say(lt('That file isn’t a RoUtility settings file.'));
      const playKey = play ? 'routilityPlaytime:' + play.userId : null;
      chrome.storage.local.get(['routilitySettings', ...(playKey ? [playKey] : [])], (st) => {
        const extra = playKey ? { [playKey]: mergePlay(st[playKey], play) } : {};
        chrome.storage.local.set({ routilitySettings: { ...(st.routilitySettings || {}), ...clean }, ...prefs, ...extra }, () => {
          if (chrome.runtime.lastError) return say(lt('Couldn’t load that file. Chrome didn’t save it, try again.'));
          const count = Object.keys(clean).length;
          const base = Object.keys(prefs).length ? ltn(count, 'Loaded {n} setting, plus your layouts and saved lists.', 'Loaded {n} settings, plus your layouts and saved lists.') : ltn(count, 'Loaded {n} setting.', 'Loaded {n} settings.');
          say(play ? `${base} ${lt('Your playtime history was added too.')}` : base);
        });
      });
    });
    buttons.appendChild(file);
    buttons.appendChild(button(lt('Import'), () => file.click()));
    buttons.appendChild(button(lt('Reset'), (btn, text) => {
      if (text.textContent !== lt('Sure?')) {
        text.textContent = lt('Sure?');
        setTimeout(() => { text.textContent = lt('Reset'); }, 3000);
        return;
      }
      text.textContent = lt('Reset');
      chrome.storage.local.remove(RESET_PREFS, () => {
        chrome.storage.local.set({ routilitySettings: { ...DEFAULTS } }, () => say(lt('Everything is back to the defaults. Your price alerts and hidden games are kept.')));
      });
    }));
    status.classList.add('routility-set-row');
    backup.card.appendChild(status);
    section.appendChild(backup);
  }

  function settingsSearch(settings, save, stored, cache) {
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-set-search');
    field.appendChild(stateLayer());
    field.appendChild(icon('search', 'routility-set-search-icon'));
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted text-body-medium placeholder:text-body-medium');
    input.type = 'search';
    input.placeholder = lt('Search settings');
    input.setAttribute('aria-label', lt('Search RoUtility settings'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    field.appendChild(input);
    field.addEventListener('mousedown', (e) => { if (e.target !== input) { e.preventDefault(); input.focus(); } });
    const results = el('div', 'flex flex-col gap-xlarge routility-set-results');
    results.hidden = true;
    const hidden = [];
    const render = () => {
      const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      results.textContent = '';
      results.hidden = !words.length;
      for (const n of hidden) n.hidden = !!words.length;
      if (!words.length) return;
      const rows = [];
      let found = 0;
      for (const tab of TABS) {
        const page = PAGES[tab.key];
        if (!page) continue;
        for (const g of page.groups) {
          const hits = g.rows.filter(def => {
            const parent = def.parent && g.rows.find(x => x.key === def.parent);
            const hay = [def.title, def.desc, g.title, tab.label, parent && parent.title, parent && parent.desc].filter(Boolean).flatMap(s => [s, lt(s)]).concat(def.keywords || '').join(' ').toLowerCase();
            return def.title && words.every(w => hay.includes(w) || (w.length > 3 && /s$/.test(w) && hay.includes(w.slice(0, -1))));
          });
          if (!hits.length) continue;
          const wrap = group(lt(g.title) === lt(tab.label) ? lt(tab.label) : `${lt(tab.label)} • ${lt(g.title)}`);
          for (const def of hits) {
            found++;
            if (def.custom) {
              const go = button(lt('Open'), () => {
                goTo(tab.hash);
                const wait = setInterval(() => {
                  const target = document.querySelector(`.routility-pane[data-tab="${tab.hash}"] [data-key="${def.custom}"]`);
                  if (!target) return;
                  clearInterval(wait);
                  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 100);
                setTimeout(() => clearInterval(wait), 4000);
              });
              const r = row(lt(def.title), lt(def.desc), go, true);
              r.classList.add('routility-set-row');
              wrap.card.appendChild(r);
            } else {
              wrap.card.appendChild(featureRow(def, settings, save, rows));
            }
          }
          results.appendChild(wrap);
        }
      }
      if (!found) results.appendChild(el('p', 'text-body-medium content-muted margin-none routility-set-empty', lt('No settings match “{query}”.', { query: input.value.trim() })));
      paint(rows, settings);
      fillMocks(results);
    };
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        render();
      }
    });
    return {
      field,
      results,
      hideWhileSearching: (n) => hidden.push(n),
      search: (query) => {
        input.value = query;
        render();
      },
    };
  }

  function buildPane(tab, stored, cache) {
    const settings = { ...DEFAULTS, ...(stored.routilitySettings || {}) };
    fiat.settings = settings;
    if (stored.routilityFiatRates) fiat.rates = stored.routilityFiatRates.rates || null;
    let applied = null;
    const showApplied = () => {
      if (applied && applied.isConnected) return;
      applied = el('div', 'routility-injected routility-set-applied');
      applied.appendChild(el('span', 'text-body-medium', lt('Saved. Roblox pages you already have open pick this up when they reload.')));
      const btn = el('button', 'btn-secondary-md btn-min-width routility-set-reload', lt('Reload Other Tabs'));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        window.RoUtilityUI.request({ type: 'reloadRobloxTabs' }, r => r && typeof r.n === 'number').then((r) => {
          applied.firstChild.textContent = r ? ltn(r.n, 'Reloaded {n} tab.', 'Reloaded {n} tabs.') : lt('Couldn’t reload the other tabs.');
          btn.remove();
        });
      });
      applied.appendChild(btn);
      const head = section.firstElementChild;
      if (head) head.after(applied);
      else section.prepend(applied);
    };
    let typed = null;
    let typedTimer = 0;
    const write = (patch) => chrome.storage.local.get('routilitySettings', (st) => {
      if (chrome.runtime.lastError) return;
      chrome.storage.local.set({ routilitySettings: { ...settings, ...(st.routilitySettings || {}), ...patch } }, () => {
        if ('oldLeftNav' in patch) location.reload();
        if ('currency' in patch) chrome.runtime.sendMessage({ type: 'fiatRates' }, () => { void chrome.runtime.lastError; location.reload(); });
      });
    });
    const save = (patch, typing) => {
      Object.assign(settings, patch);
      clearTimeout(typedTimer);
      if (typing) {
        typed = { ...typed, ...patch };
        typedTimer = setTimeout(() => { const p = typed; typed = null; write(p); }, 300);
      } else {
        write({ ...typed, ...patch });
        typed = null;
      }
      if ('oldLeftNav' in patch || 'currency' in patch) return;
      if (Object.keys(patch).some(k => !/^forum(Style|Density|Avatars|Stat)/.test(k))) showApplied();
    };

    const root = el('div', 'tab-pane active routility-pane routility-injected');
    root.dataset.tab = tab.hash;
    const section = el('section', 'settings-container-v2 flex flex-col gap-xlarge padding-bottom-large routility-set');
    const page = PAGES[tab.key];
    section.appendChild(header(lt(tab.title), page && page.intro && lt(page.intro)));


    if (tab.key === 'info') {
      const finder = settingsSearch(settings, save, stored, cache);
      section.appendChild(finder.results);
      liveFinder = finder;
      const before = section.children.length;
      infoPane(section, cache, settings, stored || {});
      [...section.children].slice(before).forEach(n => finder.hideWhileSearching(n));
      if (searchQuery) finder.search(searchQuery);
    }

    if (tab.key === 'whatsnew') whatsNewPane(section);

    if (page) {
      const rows = [];
      for (const g of page.groups) {
        const wrap = group(lt(g.title), g.note && lt(g.note));
        const byKey = new Map(g.rows.filter(x => x.key).map(x => [x.key, x]));
        const subs = new Map();
        const topOf = (def) => {
          let d = def;
          while (d.parent && byKey.has(d.parent)) d = byKey.get(d.parent);
          return d === def ? null : d.key;
        };
        const place = (def, node) => {
          const top = topOf(def);
          if (!top) return wrap.card.appendChild(node);
          let box = subs.get(top);
          if (!box) {
            box = el('div', 'routility-set-subs');
            subs.set(top, box);
            wrap.card.appendChild(box);
          }
          box.appendChild(node);
        };
        for (const def of g.rows) {
          if (def.custom === 'preferredRegion') {
            const FLAG_SET = new Set('us ca mx br ar cl co pe gb ie fr de nl be lu ch at it es pt pl cz se no dk fi ee lv lt ro hu bg gr tr ua il ae sa in sg hk jp kr tw cn th my id ph vn au nz za eg ng ke'.split(' '));
            const codes = new Map();
            try {
              const dn = new Intl.DisplayNames(['en'], { type: 'region' });
              for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
                const code = String.fromCharCode(a, b);
                const nm = dn.of(code);
                if (!nm || nm === code) continue;
                const prev = codes.get(nm.toLowerCase());
                if (!prev || (!FLAG_SET.has(prev) && FLAG_SET.has(code.toLowerCase()))) codes.set(nm.toLowerCase(), code.toLowerCase());
              }
            } catch {}
            codes.set('france', 'fr');
            codes.set('united states', 'us');
            codes.set('united kingdom', 'gb');
            codes.set('hong kong', 'hk');
            const flagFor = (country) => {
              const cc = codes.get(String(country || '').toLowerCase());
              return cc && FLAG_SET.has(cc) ? chrome.runtime.getURL(`assets/flags/${cc}.svg`) : '';
            };
            const holder = el('div', 'routility-region-select');
            const prRow = row(lt('Preferred Region'), lt('When you press Play, join a server in this region and see its details. Closest to me estimates your region from your time zone (it never leaves your browser). Off lets Roblox pick inside the app, so there are no server details.'), holder, true);
            prRow.classList.add('routility-set-row', 'routility-set-row-select', 'routility-set-child');
            prRow.dataset.key = 'preferredRegion';
            prRow.querySelector('h3')?.classList.replace('text-title-large', 'text-title-medium');
            place(def, prRow);
            const fill = (list) => {
              const names = new Map();
              for (const dc of list || []) {
                const name = [...new Set([dc.city, dc.country].filter(Boolean))].join(', ');
                if (name && !names.has(name)) names.set(name, dc.country || '');
              }
              const sorted = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
              const current = typeof settings.preferredRegion === 'string' ? settings.preferredRegion : '';
              if (current && current !== 'auto' && !names.has(current)) sorted.unshift([current, '']);
              const short = (n) => n.replace(/, United States$/, ', USA').replace(/, United Kingdom$/, ', UK').replace(/, United Arab Emirates$/, ', UAE');
              const opts = [{ value: '', label: lt('Off (Roblox picks)') }, { value: 'auto', label: lt('Closest to me') }, ...sorted.map(([n, country]) => ({ value: n, label: short(n), icon: flagFor(country) }))];
              holder.textContent = '';
              holder.appendChild(select(lt('Preferred Region'), opts, current, (v) => save({ preferredRegion: v })));
            };
            holder.appendChild(el('span', 'text-body-small content-muted', lt('Loading regions…')));
            chrome.runtime.sendMessage({ type: 'getDatacenters' }, (res) => { void chrome.runtime.lastError; fill(res && res.list); });
            continue;
          }
          if (def.custom === 'layoutPreview') {
            wrap.card.appendChild(layoutVisualizer(stored));
            continue;
          }
          if (def.custom === 'plusThemes') {
            place(def, plusThemes(settings, save));
            continue;
          }
          if (def.custom === 'themeEditor') {
            place(def, themeEditor(settings));
            continue;
          }
          if (def.custom === 'navLayout') {
            wrap.card.appendChild(navVisualizer(stored, settings, save));
            continue;
          }
          if (def.custom === 'serverLayout') {
            wrap.card.appendChild(serverVisualizer(stored, settings));
            continue;
          }
          if (def.custom === 'priceAlertList') {
            const box = el('div', 'routility-set-row routility-alert-list');
            box.dataset.key = 'priceAlertList';
            const draw = () => chrome.storage.local.get('routilityPriceAlerts', (st) => {
              const all = st.routilityPriceAlerts || {};
              const ids = Object.keys(all);
              box.textContent = '';
              if (!ids.length) {
                box.appendChild(el('div', 'text-body-small content-muted routility-alert-empty', lt('No alerts yet. Open a limited and press Price Alert under Best Price.')));
                return;
              }
              chrome.runtime.sendMessage({ type: 'getAssetThumbs', ids }, (thumbs) => {
                void chrome.runtime.lastError;
                for (const id of ids) {
                  const a = all[id];
                  const r = el('div', 'routility-alert-row');
                  const pic = el('span', 'routility-alert-thumb');
                  if (thumbs && thumbs[id]) {
                    const img = el('img');
                    img.src = thumbs[id];
                    img.alt = '';
                    pic.appendChild(img);
                  }
                  const name = el('a', 'text-body-medium content-emphasis text-overflow routility-alert-name', a.name);
                  name.href = `https://www.roblox.com/catalog/${id}`;
                  const target = el('span', 'text-body-small content-muted routility-alert-target', lt('At or below R$ {price}', { price: Number(a.target).toLocaleString('en-US') }));
                  const info = el('div', 'routility-alert-info');
                  info.append(name, target);
                  r.append(pic, info, button(lt('Remove'), () => chrome.storage.local.get('routilityPriceAlerts', (s2) => {
                    const next = { ...(s2.routilityPriceAlerts || {}) };
                    delete next[id];
                    chrome.storage.local.set({ routilityPriceAlerts: next });
                  })));
                  box.appendChild(r);
                }
              });
            });
            draw();
            let onAlertsSeen = false;
            const onAlerts = (changes, area) => {
              if (!box.isConnected) {
                if (onAlertsSeen) chrome.storage.onChanged.removeListener(onAlerts);
                return;
              }
              onAlertsSeen = true;
              if (area === 'local' && changes.routilityPriceAlerts) draw();
            };
            chrome.storage.onChanged.addListener(onAlerts);
            wrap.card.appendChild(box);
            continue;
          }
          if (def.custom === 'notifyTest') {
            const testRow = row(lt(def.title), lt(def.desc), button(lt('Send Test'), (btn, text) => {
              btn.disabled = true;
              text.textContent = lt('Sending…');
              chrome.runtime.sendMessage({ type: 'notifyTest' }, (res) => {
                void chrome.runtime.lastError;
                text.textContent = res === 'denied' ? lt('Notifications Are Blocked') : res ? lt('Sent') : lt('Didn’t Send, Try Again');
                if (res === 'denied') btn.dataset.rtTip = lt('Chrome or your computer is blocking notifications. Allow them for Chrome in your system settings.');
                setTimeout(() => { text.textContent = lt('Send Test'); btn.disabled = false; }, res ? 2000 : 4000);
              });
            }), true);
            testRow.classList.add('routility-set-row');
            testRow.dataset.key = 'notifyTest';
            wrap.card.appendChild(testRow);
            continue;
          }
          if (def.custom === 'funItems') {
            place(def, funItems(def));
            continue;
          }
          if (def.custom === 'freeItems') {
            place(def, freeItems(def));
            continue;
          }
          if (def.custom === 'chartMode') {
            const chartRow = row(
              lt('Price Chart Opens In'),
              lt('Which chart item pages show first.'),
              select(lt('Price Chart Opens In'), [{ value: 'robux', label: 'Robux' }, { value: 'usd', label: 'USD' }],
                stored.routilityChartMode === 'usd' ? 'usd' : 'robux',
                (mode) => chrome.storage.local.set({ routilityChartMode: mode }))
            );
            chartRow.classList.add('routility-set-row', 'routility-set-row-select');
            chartRow.dataset.key = 'chartMode';
            wrap.card.appendChild(chartRow);
            continue;
          }
          place(def, featureRow(def, settings, save, rows, !!topOf(def)));
        }
        section.appendChild(wrap);
      }
      paint(rows, settings);
      fillMocks(section);
    }

    root.appendChild(section);
    return root;
  }

  function restoreNativeActive(menu) {
    if (menu.querySelector('.menu-option-content.active')) return;
    const a = [...menu.querySelectorAll('.menu-option-content')].find(x => x.getAttribute('href') === location.hash);
    if (a) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  }

  function goTo(hash) {
    if (location.hash !== hash) history.pushState(history.state, '', location.pathname + location.search + hash);
    setOpen(hash);
  }

  function menuLink(className, text, href, onClick) {
    const li = el('li', 'menu-option routility-injected ' + className);
    li.setAttribute('role', 'tab');
    const a = el('a', 'menu-option-content');
    a.href = href;
    a.appendChild(el('span', 'font-caption-header', text));
    a.appendChild(el('span', 'rbx-tab-subtitle'));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!chrome.runtime?.id) {
        history.replaceState(null, '', location.pathname + location.search + href);
        location.reload();
        return;
      }
      onClick();
    });
    li.appendChild(a);
    return li;
  }

  function ensureTitle() {
    const native = document.querySelector('#react-user-account-base > h1:not(.routility-settings-title)');
    if (!native || native.nextElementSibling?.classList.contains('routility-settings-title')) return;
    document.querySelectorAll('.routility-settings-title').forEach(n => n.remove());
    const h1 = el('h1', 'routility-injected routility-settings-title', lt('RoUtility Settings'));
    const logo = el('img', 'routility-settings-logo');
    logo.src = chrome.runtime.getURL('assets/icons/logo.png');
    logo.alt = '';
    h1.prepend(logo);
    native.after(h1);
  }

  function ensureMenu(menu) {
    if (menu.querySelector('.routility-menu-item')) return;
    const split = el('li', 'routility-injected routility-menu-split');
    split.setAttribute('role', 'separator');
    const entry = menuLink('routility-menu-entry', 'RoUtility', TABS[0].hash, () => goTo(TABS[0].hash));
    const logo = el('img', 'routility-menu-entry-logo');
    logo.src = chrome.runtime.getURL('assets/icons/logo.png');
    logo.alt = '';
    entry.querySelector('.font-caption-header').before(logo);
    menu.append(split, entry);
    menu.appendChild(menuSearch(menu));
    let lastSection = null;
    for (const tab of TABS) {
      if (tab.section && tab.section !== lastSection) {
        lastSection = tab.section;
        const many = TABS.filter(t => t.section === tab.section).length > 1;
        const line = el('li', 'routility-injected routility-sub routility-menu-divider' + (many ? ' routility-menu-group' : ''));
        line.setAttribute('role', 'separator');
        line.dataset.section = tab.section;
        if (many) {
          if (GROUP_ICONS[tab.section]) line.appendChild(el('span', 'icon icon-regular-' + GROUP_ICONS[tab.section] + ' routility-menu-group-icon'));
          line.appendChild(el('span', 'routility-menu-group-name', lt(tab.section)));
        }
        menu.appendChild(line);
      }
      const li = menuLink('routility-sub routility-menu-item', lt(tab.label), tab.hash, () => goTo(tab.hash));
      li.id = 'routility-' + tab.key;
      li.dataset.section = tab.section || '';
      menu.appendChild(li);
    }
    const foot = el('li', 'routility-injected routility-sub routility-menu-foot');
    foot.setAttribute('role', 'separator');
    const back = menuLink('routility-sub routility-menu-entry routility-menu-back', lt('Roblox Settings'), lastNativeHash, () => {
      location.hash = lastNativeHash;
      window.scrollTo({ top: 0 });
    });
    back.querySelector('.font-caption-header').before(el('span', 'icon-logo-r routility-menu-entry-logo routility-menu-back-logo'));
    menu.append(foot, back);
  }

  function tabText(tab) {
    const page = PAGES[tab.key];
    const parts = [tab.label, tab.title];
    for (const g of (page && page.groups) || []) {
      parts.push(g.title);
      for (const def of g.rows) parts.push(def.title, def.desc, def.keywords);
    }
    return parts.filter(Boolean).map(s => (typeof s === 'string' ? s + ' ' + lt(s) : '')).join(' ').toLowerCase();
  }

  function rowsFor(tab) {
    const page = PAGES[tab.key];
    const out = [];
    for (const g of (page && page.groups) || []) for (const def of g.rows) if (def.title) out.push({ def, text: [def.title, def.desc, def.keywords, g.title].filter(Boolean).map(s => s + ' ' + lt(s)).join(' ').toLowerCase() });
    return out;
  }

  function menuSearch(menu) {
    const li = el('li', 'routility-injected routility-sub routility-menu-search');
    const box = el('label', 'routility-menu-search-box');
    box.appendChild(icon('search', 'routility-menu-search-icon'));
    const input = el('input');
    input.type = 'search';
    input.placeholder = lt('Search settings');
    input.setAttribute('aria-label', lt('Search RoUtility settings'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    box.appendChild(input);
    li.appendChild(box);
    let index = null;
    const words = () => input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (text, list) => list.every(w => text.includes(w) || (w.length > 3 && /s$/.test(w) && text.includes(w.slice(0, -1))));
    const filter = () => {
      const list = words();
      if (!index) index = TABS.map(tab => ({ tab, text: tabText(tab), rows: rowsFor(tab) }));
      const shown = new Set();
      for (const { tab, text, rows } of index) {
        const item = menu.querySelector('#routility-' + tab.key);
        if (!item) continue;
        const hits = list.length ? rows.filter(r => matches(r.text, list)).length : 0;
        const on = !list.length || hits > 0 || matches(tab.label.toLowerCase() + ' ' + lt(tab.label).toLowerCase(), list);
        item.classList.toggle('routility-menu-off', !on);
        item.querySelector('.routility-menu-count')?.remove();
        if (list.length && hits) item.querySelector('.menu-option-content').appendChild(el('span', 'routility-menu-count', String(hits)));
        if (on) shown.add(tab.section || '');
      }
      for (const line of menu.querySelectorAll('.routility-menu-divider')) line.classList.toggle('routility-menu-off', !!list.length && !shown.has(line.dataset.section));
      menu.classList.toggle('routility-menu-searching', !!list.length);
      searchQuery = input.value.trim();
      if (searchQuery && open !== TABS[0].hash) goTo(TABS[0].hash);
      else liveFinder?.search(searchQuery);
    };
    const reveal = (tries = 0) => {
      const list = words();
      if (!list.length) return;
      const pane = document.querySelector(`.routility-pane[data-tab="${CSS.escape(open || '')}"]`);
      if (!pane) {
        if (tries < 12) setTimeout(() => reveal(tries + 1), 150);
        return;
      }
      const target = [...pane.querySelectorAll('.routility-set-row')].find(r => matches(r.textContent.toLowerCase(), list));
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.remove('routility-set-flash');
      void target.offsetWidth;
      target.classList.add('routility-set-flash');
    };
    let typing = 0;
    input.addEventListener('input', () => {
      clearTimeout(typing);
      typing = setTimeout(filter, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        clearTimeout(typing);
        input.value = '';
        filter();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        menu.querySelector('.routility-menu-item:not(.routility-menu-off) .menu-option-content')?.click();
      }
    });
    menu.addEventListener('click', (e) => {
      if (words().length && e.target.closest('.routility-menu-item')) setTimeout(reveal, 200);
    }, true);
    return li;
  }

  function apply() {
    if (!langReady) return;
    const menu = document.querySelector('.settings-left-navigation .menu-vertical');
    const content = document.querySelector('.settings-left-navigation .tab-content');
    if (!menu || !content) return;
    ensureMenu(menu);
    ensureTitle();
    const modeOn = !!open;
    if (document.documentElement.classList.contains('routility-settings-mode') !== modeOn) {
      document.documentElement.classList.toggle('routility-settings-mode', modeOn);
    }
    const ours = [...menu.querySelectorAll('.routility-menu-item > .menu-option-content')];
    for (const stale of document.querySelectorAll('.routility-pane')) if (stale !== pane && stale !== leaving) stale.remove();

    if (open) {
      for (const a of menu.querySelectorAll('.menu-option-content')) {
        const want = a.getAttribute('href') === open && ours.includes(a);
        if (want && !a.classList.contains('active')) {
          a.classList.add('active');
          a.setAttribute('aria-current', 'page');
        } else if (!want && a.classList.contains('active')) {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        }
      }
      if ((pane || leaving) && !content.classList.contains('routility-open')) content.classList.add('routility-open');
      if (pane && pane.parentElement !== content) content.appendChild(pane);
    } else {
      for (const a of ours) {
        if (a.classList.contains('active')) {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        }
      }
      if (content.classList.contains('routility-open')) content.classList.remove('routility-open');
      restoreNativeActive(menu);
    }
  }

  let building = null;
  let leaving = null;
  let liveFinder = null;
  let searchQuery = '';

  function setOpen(hash) {
    const next = isOurs(hash) ? hash : null;
    if (next === open && (!next || (pane && pane.dataset.tab === next) || building === next)) return apply();
    open = next;
    if (pane) {
      if (next && !leaving) leaving = pane;
      else pane.remove();
      pane = null;
    }
    if (!next && leaving) {
      leaving.remove();
      leaving = null;
    }
    building = next;
    if (next) {
      const tab = TABS.find(t => t.hash === next);
      window.RoUtilityI18n.ready.then(() => chrome.storage.local.get(['routilitySettings', 'routilityFiatRates', 'routilityChartMode', 'routilityHiddenGames', 'routilityHiddenNames', 'routilityLayouts', 'routilityLayoutSeen', 'routilityHomeLayout', 'routilityNavLayout', 'routilityServerLayout'], (stored) => {
        chrome.runtime.sendMessage({ type: 'getCacheStatus' }, (cache) => {
          void chrome.runtime.lastError;
          if (open !== next || building !== next) return;
          building = null;
          pane?.remove();
          pane = buildPane(tab, stored, cache || {});
          pane.classList.add('routility-pane-in');
          leaving?.remove();
          leaving = null;
          apply();
        });
      }));
      window.scrollTo({ top: 0 });
    }
    apply();
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('.settings-left-navigation .menu-option-content');
    if (!a || a.parentElement.classList.contains('routility-injected')) return;
    userNav = true;
    booting = false;
    clearTimeout(settleTimer);
  }, true);

  function keepOurHash() {
    if (open && location.hash !== open) history.replaceState(history.state, '', location.pathname + location.search + open);
  }

  function settleSoon() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      booting = false;
      keepOurHash();
    }, 1200);
  }

  window.addEventListener('popstate', (e) => {
    if (!isOurs(location.hash)) return;
    e.stopImmediatePropagation();
    setOpen(location.hash);
  }, true);

  window.addEventListener('hashchange', (e) => {
    const to = new URL(e.newURL).hash;
    if (isOurs(to)) {
      e.stopImmediatePropagation();
      if (location.hash === to) setOpen(to);
      return;
    }
    if (booting && !userNav) {
      settleSoon();
      return;
    }
    userNav = false;
    if (to.startsWith('#!/')) lastNativeHash = to;
    setOpen(null);
  }, true);

  function start() {
    const root = document.querySelector('#user-account') || document.body;
    let queued = false;
    const watcher = new MutationObserver(() => {
      if (!chrome.runtime?.id) {
        watcher.disconnect();
        return;
      }
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    });
    watcher.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (open) {
      const target = open;
      open = null;
      setOpen(target);
    } else {
      apply();
    }
  }

  if (booting) setTimeout(() => { if (booting) settleSoon(); }, 8000);
  const boot = () => window.RoUtilityI18n.ready.then(() => {
    langReady = true;
    start();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
