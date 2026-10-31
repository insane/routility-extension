(function () {
  'use strict';

  const { lt, LT } = window.RoUtilityI18n;
  const VALUE_WORDS = [LT('Raising'), LT('Lowering'), LT('Stable'), LT('Unstable'), LT('Fluctuating'), LT('None'), LT('Projected'), LT('Hyped'), LT('Rare')];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  let openDropdown = null;

  function dropdown(options, selected, onChange, extraClass) {
    const wrap = el('div', 'input-group-btn routility-dropdown routility-injected' + (extraClass ? ' ' + extraClass : ''));
    const btn = el('button', 'input-dropdown-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    const label = el('span', 'rbx-selection-label');
    btn.appendChild(label);
    btn.appendChild(el('span', 'icon-down-16x16'));
    const menu = el('ul', 'dropdown-menu');
    menu.setAttribute('role', 'menu');
    menu.style.display = 'none';

    let current = selected;
    let opts = options;
    let live = null;

    const items = () => [...menu.querySelectorAll('button')];
    const close = (refocus) => {
      if (menu.style.display === 'none') return;
      menu.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
      if (live) {
        document.removeEventListener('click', live.outside, true);
        document.removeEventListener('keydown', live.keys, true);
        live = null;
      }
      if (openDropdown === close) openDropdown = null;
      if (refocus) btn.focus({ preventScroll: true });
    };
    const open = () => {
      if (openDropdown && openDropdown !== close) openDropdown();
      wrap.classList.remove('routility-dropdown-up');
      menu.style.maxHeight = '';
      menu.style.overflowY = '';
      menu.style.display = 'block';
      btn.setAttribute('aria-expanded', 'true');
      const r = menu.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const below = window.innerHeight - r.top - 8;
      const above = w.top - 12;
      if (r.height > below) {
        const up = above > below;
        if (up) wrap.classList.add('routility-dropdown-up');
        if (r.height > (up ? above : below)) {
          menu.style.maxHeight = Math.max(120, Math.floor(up ? above : below)) + 'px';
          menu.style.overflowY = 'auto';
        }
      }
      const outside = (e) => { if (!wrap.contains(e.target)) close(); };
      const keys = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const list = items();
          if (!list.length) return;
          const i = list.indexOf(document.activeElement);
          const n = e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
          list[n].focus({ preventScroll: true });
        } else if (e.key === 'Tab') {
          close();
        }
      };
      document.addEventListener('click', outside, true);
      document.addEventListener('keydown', keys, true);
      live = { outside, keys };
      openDropdown = close;
      const pick = items().find(b => b.dataset.value === String(current)) || items()[0];
      if (pick) pick.focus({ preventScroll: true });
    };

    const render = () => {
      const sel = opts.find(o => o.value === current) || opts[0];
      label.textContent = sel ? sel.label : '';
      menu.textContent = '';
      for (const opt of opts) {
        const li = el('li');
        const ob = el('button', null, opt.label);
        ob.type = 'button';
        ob.setAttribute('role', 'menuitem');
        ob.dataset.value = String(opt.value);
        if (opt.value === current) ob.setAttribute('aria-current', 'true');
        ob.addEventListener('click', (e) => {
          e.stopPropagation();
          close(true);
          if (opt.value === current) return;
          current = opt.value;
          render();
          onChange(opt.value);
        });
        li.appendChild(ob);
        menu.appendChild(li);
      }
    };
    render();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.style.display === 'none') open();
      else close();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    wrap.setOptions = (next) => {
      opts = next;
      render();
    };
    wrap.setValue = (value) => {
      current = value;
      render();
    };
    wrap.close = () => close();
    return wrap;
  }

  const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const FIAT = {
    USD: ['$', LT('US Dollar')], EUR: ['€', LT('Euro')], GBP: ['£', LT('British Pound')], CAD: ['C$', LT('Canadian Dollar')],
    AUD: ['A$', LT('Australian Dollar')], JPY: ['¥', LT('Japanese Yen')], CNY: ['¥', LT('Chinese Yuan')], KRW: ['₩', LT('Korean Won')],
    INR: ['₹', LT('Indian Rupee')], BRL: ['R$', LT('Brazilian Real')], MXN: ['MX$', LT('Mexican Peso')], TRY: ['₺', LT('Turkish Lira')],
  };
  const FIAT_WHOLE = new Set(['JPY', 'KRW']);
  const FIAT_STALE = 12 * 3600e3;
  let fiat = { code: 'USD', symbol: '$', rate: 1, rates: null };
  let fiatAsked = false;

  function setFiat(s, store) {
    const rates = (store && store.rates) || null;
    const want = s && FIAT[s.currency] ? s.currency : 'USD';
    const rate = want === 'USD' ? 1 : Number(rates && rates[want]);
    const code = rate > 0 ? want : 'USD';
    fiat = { code, symbol: FIAT[code][0], rate: rate > 0 ? rate : 1, rates };
    document.documentElement.style.setProperty('--routility-cash-sign', JSON.stringify(fiat.symbol));
    document.documentElement.classList.toggle('routility-cash-text', fiat.symbol !== '$');
    const stale = !store || !(Date.now() - Number(store.ts) < FIAT_STALE);
    const need = want !== 'USD' || (s && s.calcRobux === 'custom' && s.calcRateCurrency && s.calcRateCurrency !== 'USD');
    if (need && stale && !fiatAsked) {
      fiatAsked = true;
      try { chrome.runtime.sendMessage({ type: 'fiatRates' }, () => void chrome.runtime.lastError); } catch {}
    }
  }

  try {
    const early = JSON.parse(localStorage.getItem('routilityEarly')) || {};
    setFiat(early.routilitySettings, early.routilityFiatRates);
  } catch {}

  const CASH_SIGN = /^(MX\$|R\$|C\$|A\$|\$|€|£|¥|₩|₹|₺)/;

  function bareCash() {
    document.documentElement.style.setProperty('--routility-cash-sign', JSON.stringify(fiat.symbol));
    for (const ic of document.querySelectorAll('.routility-usd-ic')) {
      let n = ic.nextSibling;
      while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.nextSibling;
      if (n && n.nodeType === 1) {
        const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
        n = w.nextNode();
        while (n && !n.nodeValue.trim()) n = w.nextNode();
      }
      if (!n || n.nodeType !== 3) continue;
      const lead = n.nodeValue.match(/^\s*/)[0];
      const rest = n.nodeValue.slice(lead.length);
      const pre = rest.match(/^[+\-−]/);
      const m = rest.slice(pre ? 1 : 0).match(CASH_SIGN);
      if (!m) continue;
      if (pre) {
        ic.dataset.rtPre = pre[0];
        continue;
      }
      delete ic.dataset.rtPre;
      n.nodeValue = lead + rest.slice(m[0].length);
    }
  }
  new MutationObserver(onFrame(bareCash)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  let fiatSettings = null;
  let fiatStore = null;
  chrome.storage.local.get(['routilitySettings', 'routilityFiatRates'], (st) => {
    fiatSettings = st.routilitySettings || {};
    fiatStore = st.routilityFiatRates || null;
    setFiat(fiatSettings, fiatStore);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.routilitySettings || changes.routilityFiatRates)) return;
    if (changes.routilitySettings) fiatSettings = changes.routilitySettings.newValue || {};
    if (changes.routilityFiatRates) fiatStore = changes.routilityFiatRates.newValue || null;
    setFiat(fiatSettings, fiatStore);
  });

  function fxOf(code) {
    if (!code || code === 'USD') return 1;
    return Number(fiat.rates && fiat.rates[code]) || 0;
  }

  function robuxRate(s) {
    const custom = Number(s && s.calcRate);
    if (!(s && s.calcRobux === 'custom' && custom > 0)) return 0.0038;
    const fx = fxOf(s.calcRateCurrency);
    return custom / (fx > 0 ? fx : 1) / 1000;
  }

  function cash() {
    return { code: fiat.code, symbol: fiat.symbol, rate: fiat.rate, name: lt(FIAT[fiat.code][1]) };
  }

  function toCash(usd) {
    return Number(usd) * fiat.rate;
  }

  function fromCash(amount) {
    return Number(amount) / fiat.rate;
  }

  function formatUSD(value) {
    const n = Number(value) * fiat.rate;
    if (!Number.isFinite(n) || n <= 0) return 'N/A';
    return fiat.symbol + (n < 100 && !FIAT_WHOLE.has(fiat.code) ? CENTS : WHOLE).format(n);
  }

  function formatCash(value) {
    return Number(value) > 0 ? formatUSD(value) : fiat.symbol + '0';
  }

  function shortUSD(value) {
    const n = Number(value) * fiat.rate;
    if (!(n > 0)) return fiat.symbol + '0';
    return n >= 1000 ? fiat.symbol + compactCash(n) : formatUSD(value);
  }

  let tipEl = null;
  let tipFor = null;

  function hideTip() {
    tipEl?.remove();
    tipEl = null;
    tipFor = null;
  }

  function exactTime(when) {
    return new Date(when).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'medium' });
  }

  let tipsOn = true;
  chrome.storage.local.get('routilitySettings', (s) => { tipsOn = (s.routilitySettings || {}).hoverTips !== false; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    tipsOn = (changes.routilitySettings.newValue || {}).hoverTips !== false;
    if (!tipsOn) hideTip();
  });

  function showTip(target) {
    const text = target.dataset.rtTip;
    if (!tipsOn || !text || tipFor === target) return;
    hideTip();
    tipFor = target;
    const above = target.dataset.rtTipPlace === 'top';
    tipEl = el('div', 'tooltip ' + (above ? 'top routility-tip-top' : 'bottom') + ' in routility-tip');
    tipEl.setAttribute('role', 'tooltip');
    const arrow = el('div', 'tooltip-arrow');
    const inner = el('div', 'tooltip-inner', text);
    if (text.length > 40) inner.classList.add('routility-tip-long');
    tipEl.append(arrow, inner);
    document.body.appendChild(tipEl);
    arrow.style[above ? 'borderTopColor' : 'borderBottomColor'] = getComputedStyle(inner).backgroundColor;
    const r = target.getBoundingClientRect();
    const w = tipEl.offsetWidth;
    const left = Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left + r.width / 2 - w / 2));
    tipEl.style.left = Math.round(left) + 'px';
    tipEl.style.top = Math.round(above ? r.top - tipEl.offsetHeight - 2 : r.bottom + 2) + 'px';
    arrow.style.left = Math.round(r.left + r.width / 2 - left - 5) + 'px';
  }

  const NAME_ROW = '#profile-header-title-container-name ~ *, .routility-name-badges';
  const BADGE_NAMES = [
    ['.icon-filled-verified-backplate, .icon-filled-verified-check', () => lt('Verified')],
    ['.icon-regular-roblox-plus', () => lt('Roblox Plus')],
    ['.icon-filled-premium, [class*="icon-premium"]', () => lt('Premium')],
    ['.icon-filled-tilt', () => lt('Roblox Admin')],
  ];

  function badgeName(node) {
    if (!node.closest?.(NAME_ROW)) return null;
    for (const [sel, name] of BADGE_NAMES) {
      const icon = node.closest(sel);
      if (!icon) continue;
      const host = icon.matches('.icon-filled-verified-check, .icon-filled-verified-backplate') ? icon.parentElement : icon;
      host.dataset.rtTip = name();
      return host;
    }
    return null;
  }

  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-rt-tip]') || badgeName(e.target);
    if (t) showTip(t);
    else if (tipFor) hideTip();
  }, true);
  document.addEventListener('focusin', (e) => { const t = e.target.closest?.('[data-rt-tip]'); if (t) showTip(t); }, true);
  document.addEventListener('focusout', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  document.addEventListener('mousedown', hideTip, true);

  const VISIBLE = Object.freeze({ usd: true, value: true, rap: true });
  const PLACE_KEYS = { Profile: { usd: 'profileUsd', value: 'profileValue', rap: 'profileRap' }, Trades: { usd: 'tradeUsd', value: 'tradeValue', rap: 'tradeRap' }, Market: { usd: 'marketUsd', value: 'marketValue', rap: 'marketRap' }, Cards: { usd: 'cardUsd', value: 'cardValue', rap: 'cardRap' } };

  function shows(place) {
    const pick = (k) => {
      const keys = PLACE_KEYS[typeof place === 'function' ? place() : place];
      const s = fiatSettings || {};
      if (k === 'value' && s.showValues === false) return false;
      return keys ? s[keys[k]] !== false : VISIBLE[k];
    };
    return { get usd() { return pick('usd'); }, get value() { return pick('value'); }, get rap() { return pick('rap'); } };
  }

  function valueTip(price) {
    const v = itemValue(price);
    return v ? lt('Value: {value}', { value: formatNumber(v) }) : '';
  }

  let tagsOn = true;
  chrome.storage.local.get('routilitySettings', (s) => { tagsOn = (s.routilitySettings || {}).itemTags !== false; });

  function cardTags(card, price) {
    const host = card.querySelector('.item-card-thumb-container');
    if (!host) return;
    const want = tagsOn && price ? (price.projected ? 'p' : '') + (price.rare ? 'r' : '') : '';
    let box = host.querySelector(':scope > .routility-card-tags');
    if ((box ? box.dataset.tags : '') === want) return;
    box?.remove();
    if (!want) return;
    box = el('span', 'routility-injected routility-card-tags');
    box.dataset.tags = want;
    if (price.projected) {
      const p = el('span', 'foundation-web-badge inline-flex items-center radius-circle padding-x-small bg-system-alert content-inverse-emphasis routility-card-tag');
      p.appendChild(el('span', 'text-no-wrap', lt('Projected')));
      p.dataset.rtTip = lt('Its RAP is pushed up by recent sales above its usual price');
      box.appendChild(p);
    }
    if (price.rare) {
      const r = el('span', 'foundation-web-badge inline-flex items-center radius-circle padding-x-small routility-card-tag routility-card-tag-rare');
      r.appendChild(el('span', 'text-no-wrap', lt('Rare')));
      r.dataset.rtTip = lt('Very few copies exist');
      box.appendChild(r);
    }
    host.appendChild(box);
  }

  function rememberProfileClick(e) {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const m = (a.getAttribute('href') || '').match(/\/users\/(\d+)\/profile/);
    if (!m) return;
    try { chrome.storage.local.set({ routilityLastProfile: { id: m[1], t: Date.now() } }); } catch {}
  }
  document.addEventListener('click', rememberProfileClick, true);
  document.addEventListener('auxclick', rememberProfileClick, true);

  function usdIcon(cls) {
    const icon = el('span', 'routility-usd-ic routility-usd-mark' + (cls ? ' ' + cls : ''));
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function verifiedBadge() {
    const wrap = el('span', 'relative flex items-center justify-center routility-injected routility-verified');
    const plate = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-backplate content-system-emphasis');
    plate.setAttribute('aria-hidden', 'true');
    const check = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-verified-check absolute');
    check.setAttribute('aria-hidden', 'true');
    check.style.color = 'white';
    wrap.append(plate, check);
    return wrap;
  }

  let blockedUrl = '';
  try { chrome.storage.local.get('routilityBlockedThumb', (st) => { if (/^https:\/\/tr\.rbxcdn\.com\//.test(st.routilityBlockedThumb || '')) blockedUrl = st.routilityBlockedThumb; }); } catch {}

  function blockedThumb(t) {
    if (t.imageUrl && /UnapprovedImage/.test(t.imageUrl) && t.imageUrl !== blockedUrl) {
      blockedUrl = t.imageUrl;
      try { chrome.storage.local.set({ routilityBlockedThumb: blockedUrl }); } catch {}
    }
    return t.imageUrl || blockedUrl || 'blocked';
  }

  const HIDDEN_TIP = LT('Roblox hides friend lists for some accounts, like accounts in the UK, so this list doesn\u2019t show on Roblox. RoUtility loads it from Roblox\u2019s official API.');

  function hiddenNote() {
    const note = el('span', 'routility-injected routility-hidden-source');
    const logo = el('img', 'routility-hidden-logo');
    logo.src = chrome.runtime.getURL('assets/icons/logo.png');
    logo.alt = '';
    note.appendChild(logo);
    note.appendChild(el('span', null, lt('Shown via RoUtility')));
    note.tabIndex = 0;
    note.dataset.rtTip = lt(HIDDEN_TIP);
    return note;
  }

  let rowGateState = null;

  function rowGate(fn) {
    if (!rowGateState || rowGateState.path !== location.pathname) rowGateState = { path: location.pathname, queue: [], open: false, timer: 0 };
    const g = rowGateState;
    if (g.open) return fn();
    g.queue.push(fn);
    if (!g.timer) {
      g.timer = setTimeout(() => {
        g.open = true;
        const q = g.queue;
        g.queue = [];
        requestAnimationFrame(() => {
          for (const f of q) {
            try { f(); } catch {}
          }
        });
      }, 350);
    }
  }

  function ownNode(n) {
    if (!n) return false;
    if (n.nodeType !== 1) n = n.parentElement;
    return !!(n && n.closest && n.closest('.routility-injected, [class*="routility-card"], [class*="routility-tag"], .routility-usd'));
  }

  function foreign(records) {
    for (const r of records) {
      if (!ownNode(r.target)) {
        if (r.type !== 'childList') return true;
        for (const n of r.addedNodes) if (!ownNode(n) && !(n.nodeType === 1 && /routility/.test(n.className || ''))) return true;
        for (const n of r.removedNodes) if (!(n.nodeType === 1 && /routility/.test(String(n.className || '')))) return true;
      }
    }
    return false;
  }

  function onFrame(fn) {
    let queued = false;
    const run = () => { queued = false; fn(); };
    return () => {
      if (queued) return;
      queued = true;
      if (document.visibilityState === 'visible') requestAnimationFrame(run);
      else setTimeout(run, 50);
    };
  }

  function formatNumber(value) {
    return WHOLE.format(Math.round(Number(value) || 0));
  }

  function compactCash(n) {
    const [d, u] = n >= 9995e5 ? [1e9, 'B'] : n >= 9995e2 ? [1e6, 'M'] : [1e3, 'K'];
    const v = n / d;
    const t = v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2);
    return (t.includes('.') ? t.replace(/\.?0+$/, '') : t) + u;
  }

  function itemValue(price) {
    const v = Number(price && price.value);
    return v > 0 ? v : 0;
  }

  function shortValue(n) {
    return n >= 10000 ? compactCash(n) : formatNumber(n);
  }

  function valueTag(value, opts = {}) {
    const v = Number(value) || 0;
    const tag = el('span', 'routility-val' + (opts.className ? ' ' + opts.className : ''));
    const icon = el('img', 'routility-val-logo');
    icon.src = chrome.runtime.getURL('assets/icons/logo.png');
    icon.alt = '';
    tag.append(icon, el('span', opts.textClass || null, (opts.sign || '') + (opts.short ? shortValue(v) : formatNumber(v))));
    if (opts.tip !== false) tag.dataset.rtTip = lt('Value: {value}', { value: formatNumber(v) });
    return tag;
  }

  async function getJsonStatus(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return { status: r.status, body: r.ok ? await r.json() : null };
    } catch {
      return { status: 0, body: null };
    }
  }

  const FRIENDS_TTL = 5 * 60 * 1000;
  const NET_EPOCH = 621355968000000000n;
  const friendJobs = new Map();

  async function friendsGet(url) {
    for (let tries = 0; ; tries++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch(url, { credentials: 'include', cache: 'no-store', signal: ctl.signal });
        if (r.status === 429 && tries < 5) {
          await new Promise(res => setTimeout(res, 1200 * (tries + 1)));
          continue;
        }
        return { status: r.status, body: r.ok ? await r.json() : null };
      } catch {
        if (tries >= 2) return { status: 0, body: null };
        await new Promise(res => setTimeout(res, 800));
      } finally {
        clearTimeout(timer);
      }
    }
  }

  function cursorTicks(cursor) {
    const m = /^\d+:(\d+)$/.exec(cursor || '');
    return m ? BigInt(m[1]) : null;
  }

  async function friendWalk(userId, cursor) {
    const out = [];
    for (let page = 0; page < 60; page++) {
      const r = await friendsGet(friendPage(userId, cursor));
      if (!r.body) return null;
      for (const x of r.body.PageItems || r.body.data || []) out.push(Number(x.id));
      cursor = r.body.NextCursor || r.body.nextPageCursor || '';
      if (!cursor) return out;
    }
    return null;
  }

  function friendPage(userId, cursor) {
    return `https://friends.roblox.com/v1/users/${userId}/friends/find?limit=50${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
  }

  async function friendSlices(userId, total) {
    const user = await friendsGet(`https://users.roblox.com/v1/users/${userId}`);
    const born = Date.parse(user.body && user.body.created);
    if (!Number.isFinite(born)) return null;
    const ticks = ms => BigInt(Math.round(ms)) * 10000n + NET_EPOCH;
    const now = Date.now() + 86400000;
    const lanes = 5;
    const budget = Math.ceil(total / 50) + 6;
    let spent = 0;
    const edge = i => (i >= lanes ? ticks(born - 86400000) : ticks(now - (now - born) * (i / lanes) ** 2));
    const ranges = Array.from({ length: lanes }, (_, i) => ({ cursor: i ? '1:' + edge(i) : '', at: edge(i), lo: edge(i + 1), per: 0n, ids: [], started: false, done: false }));
    let failed = false;
    const run = async (r) => {
      r.started = true;
      for (let page = 0; page < 60 && !failed; page++) {
        spent++;
        const res = await friendsGet(friendPage(userId, r.cursor));
        if (!res.body) break;
        for (const x of res.body.PageItems || []) r.ids.push(Number(x.id));
        const next = res.body.NextCursor || '';
        const t = cursorTicks(next);
        if (!next || (t !== null && t + 10000n < r.lo)) {
          r.done = true;
          return;
        }
        if (t === null) break;
        r.cursor = next;
        r.per = r.at - t;
        r.at = t;
      }
      failed = true;
    };
    const worker = async () => {
      while (!failed) {
        let r = ranges.find(x => !x.started);
        if (!r) {
          const left = x => Number(x.at - x.lo) / Number(x.per);
          const best = ranges.filter(x => x.started && !x.done && x.per > 0n && x.at - x.lo > 4n * x.per).sort((x, y) => left(y) - left(x))[0];
          if (!best || spent >= budget) return;
          const mid = (best.at + best.lo) / 2n;
          r = { cursor: '1:' + mid, at: mid, lo: best.lo, per: 0n, ids: [], started: false, done: false };
          best.lo = mid;
          ranges.splice(ranges.indexOf(best) + 1, 0, r);
        }
        await run(r);
      }
    };
    await Promise.all(Array.from({ length: lanes }, worker));
    if (failed) return null;
    const seen = new Set();
    const ids = [];
    let masked = 0;
    for (const r of ranges) {
      for (const x of r.ids) {
        if (!(x > 0)) masked++;
        else if (!seen.has(x)) {
          seen.add(x);
          ids.push(x);
        }
      }
    }
    const hidden = total - ids.length;
    if (hidden < 0 || hidden > masked) return null;
    return ids.concat(Array(hidden).fill(-1));
  }

  async function loadFriendIds(userId, ordered) {
    const base = `https://friends.roblox.com/v1/users/${userId}/friends`;
    const [count, all] = await Promise.all([friendsGet(base + '/count'), ordered ? null : friendsGet(base)]);
    if (all && all.status === 403) return null;
    const total = Number(count.body && count.body.count);
    const known = Number.isFinite(total);
    const list = all && all.body && Array.isArray(all.body.data) ? all.body.data.map(x => Number(x.id)) : null;
    if (list && (known ? list.length === total : list.length < 200)) return list;
    if (known && total > 200) {
      const sliced = await friendSlices(userId, total).catch(() => null);
      if (sliced) return sliced;
    }
    return friendWalk(userId, '');
  }

  function friendIds(userId, opts = {}) {
    const id = String(userId);
    const key = id + (opts.ordered ? ':ordered' : '');
    const hit = friendJobs.get(key);
    if (hit && !opts.fresh && Date.now() - hit.at < FRIENDS_TTL) return hit.job;
    const entry = { at: Date.now(), job: null };
    entry.job = loadFriendIds(id, !!opts.ordered).then((ids) => {
      if (!ids && friendJobs.get(key) === entry) friendJobs.delete(key);
      return ids;
    });
    friendJobs.set(key, entry);
    return entry.job;
  }

  async function collectibles(userId, opts = {}) {
    const pages = opts.pages || 50;
    const onProgress = opts.onProgress || (() => {});
    const out = [];
    let cursor = '';
    let page = 0;
    for (; page < pages; page++) {
      const r = await getJsonStatus(`https://trades.roblox.com/v2/users/${userId}/tradableItems?sortBy=CreationTime&sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!r.body || !Array.isArray(r.body.items)) break;
      for (const it of r.body.items) {
        const t = it.itemTarget || {};
        if (!t.targetId) continue;
        const bundle = t.itemType === 'Bundle';
        const copies = Array.isArray(it.instances) && it.instances.length ? it.instances : [it];
        for (const x of copies) {
          out.push({
            id: (bundle ? 'b' : '') + t.targetId,
            targetId: String(t.targetId),
            bundle,
            name: it.itemName || '',
            rap: Number(x.recentAveragePrice ?? it.recentAveragePrice) || 0,
            serial: x.serialNumber ?? null,
            onHold: !!x.isOnHold,
            key: x.collectibleItemInstanceId || (t.targetId + ':' + out.length),
          });
        }
      }
      onProgress(out.length);
      cursor = r.body.nextPageCursor || '';
      if (!cursor) return { status: 'ok', items: out, complete: true };
    }
    if (page > 0) return { status: 'ok', items: out, complete: false };
    cursor = '';
    for (page = 0; page < pages; page++) {
      const r = await getJsonStatus(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (r.status === 403) return { status: 'private', items: [] };
      if (r.status === 400) return { status: 'invalid', items: [] };
      if (!r.body || !Array.isArray(r.body.data)) return page ? { status: 'ok', items: out, complete: false } : { status: 'error', items: [] };
      for (const a of r.body.data) {
        out.push({ id: String(a.assetId), targetId: String(a.assetId), bundle: false, name: a.name || '', rap: Number(a.recentAveragePrice) || 0, serial: a.serialNumber ?? null, onHold: !!a.isOnHold, key: String(a.userAssetId || a.assetId + ':' + out.length) });
      }
      onProgress(out.length);
      cursor = r.body.nextPageCursor || '';
      if (!cursor) return { status: 'ok', items: out, complete: true };
    }
    return { status: 'ok', items: out, complete: false };
  }

  function catalogFor(list) {
    const byId = new Map();
    const byBundle = new Map();
    for (const i of list || []) {
      byId.set(String(i.id), i);
      if (i.bundleId) byBundle.set(String(i.bundleId), i);
    }
    return (entry) => (entry.bundle ? byBundle.get(entry.targetId) : byId.get(entry.targetId)) || null;
  }

  function cashTile(kind, amount) {
    const robux = kind === 'robux';
    const box = el('span', 'routility-calc-cash routility-calc-cash-' + (robux ? 'robux' : 'usd'));
    const art = el('img', 'routility-calc-cash-art');
    art.alt = '';
    art.src = chrome.runtime.getURL(`assets/icons/calc/cash-${robux ? 'robux' : 'usd'}.webp`);
    const label = el('span', 'routility-calc-cash-amt');
    const exact = robux ? formatNumber(amount) : formatCash(amount);
    if (robux) label.append(el('span', 'icon-robux-16x16 routility-calc-cash-robux-icon'), el('span', null, amount >= 100000 ? compactCash(amount) : exact));
    else label.textContent = toCash(amount) >= 100000 ? fiat.symbol + compactCash(toCash(amount)) : exact;
    box.dataset.rtTip = robux ? 'R$ ' + exact : exact;
    box.append(art, label);
    return box;
  }

  function adminBadge() {
    const icon = el('span', 'routility-injected routility-admin-badge grow-0 shrink-0 basis-auto icon icon-filled-tilt size-[var(--icon-size-small)] content-system-contrast');
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', lt('Roblox admin'));
    return icon;
  }

  function trackPopover(pop, anchor, place, close) {
    let queued = false;
    const update = () => {
      queued = false;
      if (!pop.isConnected) return stop();
      if (!anchor.isConnected) return close();
      const r = anchor.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || (r.width === 0 && r.height === 0)) return close();
      place();
    };
    const onScroll = (e) => {
      if (e && e.type === 'scroll' && e.target instanceof Node && pop.contains(e.target)) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    const stop = () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return stop;
  }

  const RETRY_DELAYS = [300, 1000, 2000];

  async function myHeadshot(res, msg) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const fun = window.RoUtilityFun;
    if (!res || typeof res !== 'object' || !me || !fun || !fun.headshot || !(msg.ids || []).map(String).includes(me)) return res;
    const url = await fun.headshot().catch(() => null);
    return url ? Object.assign({}, res, { [me]: url }) : res;
  }

  function funAdmins(res, msg) {
    const badges = window.RoUtilityFun && window.RoUtilityFun.badges && window.RoUtilityFun.badges();
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!badges || !me || !res || !Array.isArray(res.admins) || !(msg.ids || []).map(String).includes(me)) return res;
    const others = res.admins.filter(id => String(id) !== me);
    return Object.assign({}, res, { admins: badges.admin ? others.concat(typeof res.admins[0] === 'number' ? Number(me) : me) : others });
  }

  function request(msg, accept = (r) => r !== undefined) {
    if (msg && msg.type === 'getHeadshots') return send(msg, accept).then(res => myHeadshot(res, msg));
    if (msg && msg.type === 'robloxAdmins') return send(msg, accept).then(res => funAdmins(res, msg));
    return send(msg, accept);
  }

  function send(msg, accept) {
    return new Promise((resolve) => {
      let attempt = 0;
      const tryOnce = () => {
        if (!chrome.runtime?.id) return resolve(undefined);
        try {
          chrome.runtime.sendMessage(msg, (res) => {
            void chrome.runtime.lastError;
            if (accept(res) || attempt >= RETRY_DELAYS.length) return resolve(res);
            setTimeout(tryOnce, RETRY_DELAYS[attempt++]);
          });
        } catch {
          if (attempt >= RETRY_DELAYS.length) return resolve(undefined);
          setTimeout(tryOnce, RETRY_DELAYS[attempt++]);
        }
      };
      tryOnce();
    });
  }

  const priceCache = new Map();

  function cardKey(card) {
    for (const a of card.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      const asset = href.match(/\/catalog\/(\d+)/);
      if (asset) return 'id:' + asset[1];
      const bundle = href.match(/\/bundles\/(\d+)/);
      if (bundle) {
        const limited = card.closest('.trade-request-window-offer, .trade-list-detail-offer') ||
          card.querySelector('.icon-shop-limited, .icon-limited-unique-label:not(.ng-hide), .icon-limited-label:not(.ng-hide)');
        const name = limited ? (card.querySelector('.item-card-name, .item-name')?.textContent || a.textContent || '').trim().toLowerCase() : '';
        return 'bundle:' + bundle[1] + (name ? ':' + name : '');
      }
    }
    return null;
  }

  function priceTitle(price) {
    if (!price) return '';
    return [valueTip(price), price.demand && lt('Demand: {demand}', { demand: price.demand }), price.trend && lt('Trend: {trend}', { trend: price.trend })].filter(Boolean).join(' • ');
  }

  let priceWait = 0;
  let priceBackoff = 0;

  function loadPrices(keys) {
    const missing = [...new Set(keys.filter(k => k && !priceCache.has(k)))];
    if (!missing.length) return Promise.resolve();
    const left = priceWait - Date.now();
    if (left > 0) return new Promise(r => setTimeout(r, left));
    const ids = missing.filter(k => k.startsWith('id:')).map(k => k.slice(3));
    const names = missing.filter(k => k.startsWith('name:')).map(k => k.slice(5));
    const bundles = missing.filter(k => k.startsWith('bundle:')).map(k => k.slice(7));
    const pending = request({ type: 'getPrices', ids, names, bundles }, r => !!(r && r.ready)).then(result => {
      if (!result || !result.ready) {
        for (const k of missing) priceCache.delete(k);
        priceBackoff = Math.min(60000, priceBackoff ? priceBackoff * 2 : 3000);
        priceWait = Date.now() + priceBackoff;
        return;
      }
      priceBackoff = 0;
      for (const id of ids) priceCache.set('id:' + id, result.ids[id] || null);
      for (const n of names) priceCache.set('name:' + n, result.names[n] || null);
      for (const b of bundles) priceCache.set('bundle:' + b, (result.bundles || {})[b] || null);
    });
    for (const k of missing) priceCache.set(k, pending);
    return pending;
  }

  async function prices(keys) {
    await loadPrices(keys);
    await Promise.all(keys.map(k => priceCache.get(k)).filter(v => v instanceof Promise));
    return keys.map(k => {
      if (!k) return null;
      if (!priceCache.has(k)) return undefined;
      const v = priceCache.get(k);
      return v instanceof Promise ? undefined : v;
    });
  }

  function priceNow(key) {
    const v = priceCache.get(key);
    return v instanceof Promise ? undefined : v;
  }

  function mark(name) {
    const attr = 'data-rt-' + name;
    if (!document.documentElement.hasAttribute(attr)) document.documentElement.setAttribute(attr, String(Math.round(performance.now())));
  }

  function keyNav(container, selector, focusFirst) {
    const items = () => [...container.querySelectorAll(selector)].filter(n => !n.disabled && n.offsetParent !== null);
    container.addEventListener('keydown', (e) => {
      if (!/^(ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const list = items();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      let next = i;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = list.length - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i < 0 ? 0 : Math.min(list.length - 1, i + 1);
      else next = i < 0 ? 0 : Math.max(0, i - 1);
      e.preventDefault();
      list[next].focus();
    });
    if (focusFirst) requestAnimationFrame(() => { const first = items()[0]; if (first) first.focus({ preventScroll: true }); });
  }

  try {
    const osTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    chrome.storage.local.get('routilityOsTheme', (s) => { if (s.routilityOsTheme !== osTheme) chrome.storage.local.set({ routilityOsTheme: osTheme }); });
  } catch {}

  function pager(list, rows = 6) {
    let page = 0;
    const holder = el('div', 'pager-holder routility-injected routility-pager');
    const ul = el('ul', 'pager');
    const arrow = (cls, btnCls, icon, label) => {
      const li = el('li', cls);
      const b = el('button', btnCls);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.appendChild(el('span', icon));
      li.appendChild(b);
      return [li, b];
    };
    const [prevLi, prev] = arrow('pager-prev', 'btn-generic-left-sm', 'icon-left', lt('Previous page'));
    const mid = el('li');
    const label = el('span');
    mid.appendChild(label);
    const [nextLi, next] = arrow('pager-next', 'btn-generic-right-sm', 'icon-right', lt('Next page'));
    ul.append(prevLi, mid, nextLi);
    holder.appendChild(ul);
    [...list.children].forEach((x, i) => x.classList.toggle('routility-page-off', i >= rows * 6));
    const perPage = () => {
      const sample = [...list.children].slice(0, 30);
      sample.forEach(x => x.classList.remove('routility-page-off'));
      const top = sample.length ? sample[0].offsetTop : 0;
      return Math.max(1, sample.filter(x => x.offsetTop === top).length) * rows;
    };
    const paint = () => {
      if (!holder.isConnected) return;
      const all = [...list.children];
      const size = perPage();
      const pages = Math.max(1, Math.ceil(all.length / size));
      page = Math.max(0, Math.min(page, pages - 1));
      all.forEach((x, i) => x.classList.toggle('routility-page-off', i < page * size || i >= (page + 1) * size));
      label.textContent = lt('Page {page} of {pages}', { page: formatNumber(page + 1), pages: formatNumber(pages) });
      prev.disabled = page === 0;
      next.disabled = page >= pages - 1;
      holder.classList.toggle('routility-page-off', pages <= 1);
    };
    prev.addEventListener('click', () => { page--; paint(); });
    next.addEventListener('click', () => { page++; paint(); });
    let timer = 0;
    const onResize = () => {
      if (!holder.isConnected) {
        window.removeEventListener('resize', onResize);
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(paint, 150);
    };
    window.addEventListener('resize', onResize);
    requestAnimationFrame(paint);
    holder.repaint = paint;
    return holder;
  }

  function pageTitle(text) {
    document.documentElement.dataset.rtTitle = text;
    const count = document.title.match(/^\(\d+\)\s*/);
    document.title = (count ? count[0] : '') + text;
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const traps = new Map();

  function ourDialog(n) {
    if (!n || n.nodeType !== 1 || !/routility/.test(String(n.className || ''))) return null;
    if (n.getAttribute('role') === 'dialog') return n;
    return n.querySelector('[role="dialog"], .routility-modal');
  }

  function trapOpen(root, dialog) {
    const prev = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    requestAnimationFrame(() => {
      if (!root.isConnected || dialog.contains(document.activeElement)) return;
      const field = dialog.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled])');
      if (field) field.focus({ preventScroll: true });
      else {
        if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
        dialog.focus({ preventScroll: true });
      }
    });
    const onKey = (e) => {
      if (e.key !== 'Tab' || !root.isConnected) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    traps.set(root, { prev, onKey });
  }

  function trapClose(root) {
    const t = traps.get(root);
    if (!t) return;
    traps.delete(root);
    document.removeEventListener('keydown', t.onKey, true);
    if (t.prev && t.prev.isConnected && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) t.prev.focus({ preventScroll: true });
  }

  if (document.body) {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          const d = ourDialog(n);
          if (d && !traps.has(n)) trapOpen(n, d);
        }
        for (const n of r.removedNodes) if (traps.has(n)) trapClose(n);
      }
    }).observe(document.body, { childList: true });
  }

  const pause = ms => new Promise(r => setTimeout(r, ms));

  function chunks(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  async function json(url, init) {
    try {
      const res = await fetch(url, { credentials: 'include', ...init });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  const PRESENCE_TTL = 15000;
  const presenceSeen = new Map();
  const presenceLive = new Map();
  let presenceQueue = null;

  function presenceFlush() {
    const q = presenceQueue;
    presenceQueue = null;
    const ids = [...q.ids];
    for (const id of ids) presenceLive.set(id, q.wait);
    const parts = [];
    for (let i = 0; i < ids.length; i += 100) parts.push(ids.slice(i, i + 100));
    Promise.all(parts.map(part => json('https://presence.roblox.com/v1/presence/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userIds: part.map(Number) }) }))).then((all) => {
      const at = Date.now();
      for (const res of all) for (const p of (res && res.userPresences) || []) presenceSeen.set(String(p.userId), { at, p });
      if (presenceSeen.size > 3000) for (const [id, v] of presenceSeen) if (at - v.at > PRESENCE_TTL) presenceSeen.delete(id);
      for (const id of ids) if (presenceLive.get(id) === q.wait) presenceLive.delete(id);
      q.done();
    });
  }

  function presence(ids, fresh) {
    const want = [...new Set(ids.map(String))].filter(id => /^\d+$/.test(id));
    const now = Date.now();
    const since = fresh ? now : now - PRESENCE_TTL;
    const pick = () => new Map(want.filter(id => (presenceSeen.get(id)?.at || 0) >= since).map(id => [id, presenceSeen.get(id).p]));
    const waits = new Set();
    const missing = [];
    for (const id of want) {
      if (!fresh && now - (presenceSeen.get(id)?.at || 0) < PRESENCE_TTL) continue;
      if (!fresh && presenceLive.has(id)) waits.add(presenceLive.get(id));
      else missing.push(id);
    }
    if (missing.length) {
      if (!presenceQueue) {
        let done;
        presenceQueue = { ids: new Set(), wait: new Promise(r => { done = r; }), done };
        setTimeout(presenceFlush, 0);
      }
      for (const id of missing) presenceQueue.ids.add(id);
      waits.add(presenceQueue.wait);
    }
    return waits.size ? Promise.all(waits).then(pick) : Promise.resolve(pick());
  }

  function parseAmount(text, whole) {
    let s = String(text || '').replace(/[^\d.,]/g, '');
    if (whole) return Math.floor(Number(s.replace(/[.,]/g, '')) || 0);
    const dot = s.lastIndexOf('.');
    const comma = s.lastIndexOf(',');
    if (dot >= 0 && comma >= 0) s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
    else if (comma >= 0) s = /^\d*,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s) && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else s = s.replace(/(\..*)\./g, '$1');
    return Number(s) || 0;
  }

  window.RoUtilityUI = { json, parseAmount, pause, chunks, presence, rowGate, foreign, pageTitle, pager, keyNav, adminBadge, trackPopover, el, cardTags, dropdown, hiddenNote, verifiedBadge, usdIcon, blockedThumb, onFrame, robuxRate, formatUSD, formatCash, shortUSD, cash, toCash, fromCash, fxOf, currencies: FIAT, formatNumber, exactTime, itemValue, shortValue, valueTag, valueTip, shows, collectibles, catalogFor, friendIds, cashTile, cardKey, loadPrices, prices, priceNow, priceTitle, mark, request };
})();

(function () {
  'use strict';

  const { lt } = window.RoUtilityI18n;

  let toastTimer = 0;

  function copyToast(label, text) {
    document.querySelector('.routility-copy-toast')?.remove();
    const box = document.createElement('div');
    box.className = 'routility-injected routility-copy-toast';
    box.setAttribute('role', 'status');
    Object.assign(box.style, { position: 'fixed', left: '50%', bottom: '28px', transform: 'translate(-50%, 8px)', zIndex: '2147483600', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px 10px 12px', borderRadius: '12px', background: '#191b1d', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', font: '600 14px/1.2 "Builder Sans", system-ui, sans-serif', opacity: '0', transition: 'opacity 0.15s ease, transform 0.15s ease', pointerEvents: 'none' });
    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('assets/icons/logo.png');
    logo.alt = '';
    Object.assign(logo.style, { width: '20px', height: '20px', borderRadius: '5px' });
    const msg = document.createElement('span');
    msg.textContent = lt('Copied {label}', { label });
    const val = document.createElement('span');
    val.textContent = text;
    Object.assign(val.style, { color: '#a3a6ab', fontWeight: '500' });
    box.append(logo, msg, val);
    document.body.appendChild(box);
    requestAnimationFrame(() => { box.style.opacity = '1'; box.style.transform = 'translate(-50%, 0)'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 200); }, 1800);
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'routilityCopy') return;
    writeClipboard(String(msg.text)).then((ok) => {
      if (ok) copyToast(msg.label, msg.text);
      reply({ ok });
    });
    return true;
  });
})();
