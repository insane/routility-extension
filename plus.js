(function () {
  'use strict';

  const { el, onFrame, formatNumber, formatUSD, robuxRate } = window.RoUtilityUI;
  const { lt, ltn, locale } = window.RoUtilityI18n;
  const settings = { plusDetails: true, transferLimits: true };
  const API = 'https://apis.roblox.com';
  let subJob = null;
  let benefitsJob = null;
  let transferJob = null;
  let lastUrl = '';

  async function getJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function userId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || null;
  }

  function day(ms) {
    try {
      return new Date(ms).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return new Date(ms).toDateString();
    }
  }

  function money(price) {
    if (!price) return '';
    const n = (Number(price.units) || 0) + (Number(price.nanos) || 0) / 1e9;
    if (!(n > 0)) return '';
    try {
      return new Intl.NumberFormat(locale(), { style: 'currency', currency: price.currencyCode || 'USD' }).format(n);
    } catch {
      return formatUSD(n);
    }
  }

  function addPeriods(ms, type, count) {
    const d = new Date(ms);
    if (type === 'Year') d.setFullYear(d.getFullYear() + count);
    else if (type === 'Week') d.setDate(d.getDate() + 7 * count);
    else d.setMonth(d.getMonth() + count);
    return d.getTime();
  }

  function store(sub) {
    const p = String(sub.paymentProvider || '') + ' ' + String(sub.purchasePlatform || '');
    if (/apple/i.test(p)) return 'App Store';
    if (/google|android/i.test(p)) return 'Google Play';
    if (/amazon/i.test(p)) return 'Amazon';
    if (/xbox|microsoft/i.test(p)) return 'Microsoft Store';
    if (/playstation|sony/i.test(p)) return 'PlayStation Store';
    return '';
  }

  function subscription() {
    if (!subJob) {
      subJob = getJson(`${API}/subscriptions/v2/user/subscriptions?ProductType=Blackbird&ExpirationTimestampMsStart=${Date.now()}&ResultsPerPage=1`)
        .then(d => (d && Array.isArray(d.subscriptions) && d.subscriptions[0]) || null);
    }
    return subJob;
  }

  function benefits() {
    if (!benefitsJob) benefitsJob = getJson(`${API}/roblox-subscriptions/v1/roblox-plus/benefits`);
    return benefitsJob;
  }

  function renewLine(sub) {
    const parts = [];
    if (sub.nextRenewalTimestampMs) parts.push(lt('Renews {date}', { date: day(sub.nextRenewalTimestampMs) }));
    else if (sub.expirationTimestampMs) parts.push(lt('Ends {date}', { date: day(sub.expirationTimestampMs) }));
    const price = money(sub.displayPrice || sub.productInfo?.localizedPrice);
    const per = sub.periodType || sub.productInfo?.periodType;
    if (price && sub.nextRenewalTimestampMs) parts.push(per === 'Year' ? lt('{price} a year', { price }) : per === 'Week' ? lt('{price} a week', { price }) : lt('{price} a month', { price }));
    const where = store(sub);
    if (where) parts.push(lt('Billed through {store}', { store: where }));
    return parts.join(' · ');
  }

  function unlocks(sub) {
    const cfg = sub.productInfo?.productTypeDetails?.robloxSubscriptionProductDetails?.featureConfig;
    const feat = sub.productTypeMembershipDetails?.robloxSubscriptionMembershipDetails?.features;
    const start = Number(sub.paidTenureStartTimestampMs || sub.activationTimestampMs);
    const per = sub.periodType || sub.productInfo?.periodType;
    if (!cfg || !feat || !(start > 0)) return [];
    const out = [];
    const tiers = (cfg.virtualTransactionDiscounts || []).slice().sort((a, b) => a.periodIndex - b.periodIndex);
    const now = tiers.find(t => t.tierId === feat.virtualTransactionDiscountTierId);
    const next = tiers.find(t => t.periodIndex > (now ? now.periodIndex : -1));
    if (next) out.push(lt('{percent}% off unlocks {date}', { percent: next.discountPercent, date: day(addPeriods(start, per, next.periodIndex)) }));
    const pub = cfg.coreContentPublishingConfig?.minimumPeriodIndex;
    if (!feat.isCoreContentPublishingEnabled && pub > 0) out.push(lt('Publishing unlocks {date}', { date: day(addPeriods(start, per, pub)) }));
    return out;
  }

  function paidSoFar(sub) {
    const start = Number(sub.paidTenureStartTimestampMs);
    const per = sub.periodType || sub.productInfo?.periodType;
    const price = sub.displayPrice || sub.productInfo?.localizedPrice;
    if (!(start > 0) || !price) return null;
    const each = (Number(price.units) || 0) + (Number(price.nanos) || 0) / 1e9;
    if (!(each > 0)) return null;
    let n = 0;
    while (n < 600 && addPeriods(start, per, n) <= Date.now()) n++;
    if (!n) return null;
    return { amount: each * n, currency: price.currencyCode || 'USD', periods: n };
  }

  function statCard(title, value, tip) {
    const card = el('div', 'radius-medium bg-shift-200 padding-large gap-y-small min-width-0 grow-1 flex basis-0 flex-col');
    card.append(el('span', 'text-title-medium content-default', title), el('span', 'text-heading-large content-emphasis', value));
    if (tip) card.dataset.rtTip = tip;
    return card;
  }

  async function plusPage() {
    const root = document.querySelector('#roblox-subscription-container');
    if (!root || !settings.plusDetails) return;
    const icon = root.querySelector('h1')?.parentElement?.querySelector('.icon-regular-roblox-plus');
    const head = icon?.parentElement?.parentElement;
    const since = head?.children[1];
    const saved = [...root.querySelectorAll('.text-heading-small')].find(n => n.querySelector('.icon-regular-robux'));
    if (!head || !since) return;
    const sub = await subscription();
    if (!sub || !root.isConnected) return;
    if (!head.querySelector('.routility-plus-renew')) {
      const text = renewLine(sub);
      if (text) since.after(el('span', 'text-body-medium content-default routility-injected routility-plus-renew', text));
    }
    const card = [...head.children].find(n => n.classList.contains('bg-shift-200'));
    const col = card?.firstElementChild;
    if (col && !col.querySelector('.routility-plus-unlock')) {
      for (const line of unlocks(sub)) col.appendChild(el('span', 'text-body-medium content-default routility-injected routility-plus-unlock', line));
    }
    const stats = saved?.nextElementSibling;
    if (!stats || stats.querySelector('.routility-plus-money')) return;
    const b = await benefits();
    if (!b || !stats.isConnected || stats.querySelector('.routility-plus-money')) return;
    const robux = Number(b.robuxSavedWithPlus) || 0;
    const rate = robuxRate(settings);
    const usd = robux * rate;
    const paid = paidSoFar(sub);
    const custom = settings.calcRobux === 'custom' && Number(settings.calcRate) > 0;
    let tip = custom ? lt('{robux} Robux at your rate (${rate}/1k)', { robux: formatNumber(robux), rate: Number(settings.calcRate) }) : lt('{robux} Robux at the DevEx rate', { robux: formatNumber(robux) });
    if (paid && paid.currency === 'USD' && usd > paid.amount) tip += ' · ' + lt('About {x}× what Plus has cost you', { x: formatNumber(Math.floor(usd / paid.amount)) });
    const row = el('div', 'gap-x-small flex routility-injected routility-plus-money');
    row.appendChild(statCard(lt('Saved, in dollars'), usd > 0 ? '≈ ' + formatUSD(usd) : '$0', tip));
    if (paid) {
      const shown = money({ units: Math.floor(paid.amount), nanos: Math.round((paid.amount % 1) * 1e9), currencyCode: paid.currency });
      row.appendChild(statCard(lt('Paid for Plus so far'), '≈ ' + shown, ltn(paid.periods, '{n} payment of {price}', '{n} payments of {price}', { n: paid.periods, price: money(sub.displayPrice || sub.productInfo?.localizedPrice) })));
    }
    const caption = stats.querySelector(':scope > .text-caption-medium');
    if (caption) caption.before(row);
    else stats.appendChild(row);
  }

  function transfers() {
    if (!transferJob) {
      const me = userId();
      transferJob = Promise.all([
        getJson(`${API}/transfer/v1/robux-transfer/user-transfer-limit`),
        me ? getJson(`https://economy.roblox.com/v2/users/${me}/transaction-totals?timeFrame=Day&transactionType=summary`) : null,
        me ? getJson(`https://economy.roblox.com/v2/users/${me}/transaction-totals?timeFrame=Month&transactionType=summary`) : null,
      ]).then(([limit, dayT, monthT]) => {
        if (!limit) return null;
        const sent = t => (t && Number.isFinite(Number(t.outgoingRobuxTransferTotal)) ? Math.abs(Number(t.outgoingRobuxTransferTotal)) : null);
        return { limit, day: sent(dayT), month: sent(monthT) };
      });
    }
    return transferJob;
  }

  function robuxText(template, n) {
    const wrap = el('span', 'flex items-center gap-xxsmall');
    const [before, after] = template.split('{n}');
    if (before) wrap.appendChild(el('span', null, before.trim()));
    const num = el('span', 'flex items-center gap-xxsmall content-emphasis');
    num.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-small)]'), el('span', null, formatNumber(n)));
    wrap.appendChild(num);
    if (after) wrap.appendChild(el('span', null, after.trim()));
    return wrap;
  }

  function sentLine(sent, left, limit, past) {
    const box = el('div', 'flex flex-col gap-xsmall routility-injected routility-transfer-left');
    const bar = el('div', 'routility-transfer-bar');
    const fill = el('div', 'routility-transfer-fill' + (left <= 0 ? ' routility-transfer-out' : ''));
    fill.style.width = Math.min(100, Math.max(0, (1 - left / limit) * 100)) + '%';
    bar.appendChild(fill);
    const line = el('div', 'flex items-center wrap gap-x-small text-body-small content-muted');
    line.append(robuxText(lt('{n} left'), left), el('span', null, '·'), robuxText(past === 'day' ? lt('{n} sent in the past day') : lt('{n} sent in the past month'), sent));
    box.append(bar, line);
    return box;
  }

  async function robuxPage() {
    if (!settings.transferLimits || !/^#!\/robux/.test(location.hash)) return;
    const box = [...document.querySelectorAll('.tab-pane.active .setting-section > .radius-large.clip')].find(n => n.querySelectorAll(':scope > div > div > .icon-regular-robux').length >= 2);
    if (!box || box.dataset.rtTransfer) return;
    box.dataset.rtTransfer = '1';
    const t = await transfers();
    if (!t || !box.isConnected) {
      delete box.dataset.rtTransfer;
      return;
    }
    const blocks = [...box.children].filter(n => n.querySelector(':scope > div > .icon-regular-robux'));
    const value = b => Number(b.querySelector(':scope > div > .text-body-medium')?.textContent.replace(/[^\d]/g, ''));
    const daily = blocks.find(b => value(b) === Number(t.limit.dailyLimit));
    const monthly = blocks.find(b => b !== daily && value(b) === Number(t.limit.monthlyLimit));
    const monthLeft = t.month == null ? null : Math.max(0, Number(t.limit.monthlyLimit) - t.month);
    if (monthly && monthLeft != null) monthly.appendChild(sentLine(t.month, monthLeft, Number(t.limit.monthlyLimit), 'month'));
    if (daily && t.day != null) {
      let left = Math.max(0, Number(t.limit.dailyLimit) - t.day);
      if (monthLeft != null) left = Math.min(left, monthLeft);
      daily.appendChild(sentLine(t.day, left, Number(t.limit.dailyLimit), 'day'));
    }
    const per = Number(t.limit.perTransferLimit);
    if (per > 0 && blocks.length && !box.querySelector('.routility-transfer-per')) {
      const last = blocks[blocks.length - 1];
      last.classList.add('padding-bottom-small');
      const block = el('div', 'padding-large padding-top-small flex flex-col gap-xsmall routility-injected routility-transfer-per');
      const amount = el('div', 'flex items-center gap-xsmall');
      amount.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-small)]'), el('span', 'text-body-medium', formatNumber(per)));
      block.append(el('span', 'text-title-medium', lt('Per transfer limit')), amount);
      box.append(el('div', 'rbx-divider margin-none routility-injected routility-transfer-per'), block);
    }
  }

  function route() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      transferJob = null;
    }
    if (location.pathname === '/plus' || location.pathname.startsWith('/plus/')) plusPage();
    else if (location.pathname.startsWith('/my/account')) robuxPage();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    if (!settings.plusDetails && !settings.transferLimits) return;
    const tick = onFrame(route);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
})();
