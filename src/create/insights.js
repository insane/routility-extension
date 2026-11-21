(function () {
  'use strict';

  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const settings = { createIds: true, createTier: true, createO18: true, createBenchmark: true, createLaunches: true, createFees: true, createHolds: true };
  const cache = new Map();
  let lastUrl = '';

  function get(url) {
    if (!cache.has(url)) cache.set(url, fetch(url, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null));
    return cache.get(url);
  }

  function me() {
    return get('https://users.roblox.com/v1/users/authenticated').then(d => (d && d.id ? String(d.id) : null));
  }

  const O18_RATE = 0.0054;

  function o18Line(universeId) {
    if (document.querySelector('.routility-ci-o18')) return;
    const native = [...document.querySelectorAll('[class*="subtitleContainer"]:not(.routility-injected)')];
    if (!native.length) return;
    const holder = native[native.length - 1].parentElement;
    const mark = el('span', 'routility-injected routility-ci-o18 routility-ci-hold');
    holder.appendChild(mark);
    get(`https://apis.roblox.com/creator-devex/v1/universe/${universeId}/o18-eligibility`).then((d) => {
      if (!d || !d.o18Eligibility || !mark.isConnected) { mark.remove(); return; }
      const row = native[native.length - 1].cloneNode(true);
      row.classList.add('routility-injected', 'routility-ci-o18');
      const text = row.firstElementChild;
      const ok = /_ELIGIBLE$/.test(d.o18Eligibility) && !/INELIGIBLE/.test(d.o18Eligibility);
      text.textContent = lt('18+ DevEx rate: ');
      const value = el('span', 'routility-ci-o18-value ' + (ok ? 'routility-ci-good' : 'routility-ci-muted'), ok ? lt('Eligible at ${rate}', { rate: O18_RATE }) : lt('Not eligible'));
      text.appendChild(value);
      const c = d.eligibilityCriteria || {};
      const fixes = [];
      if (c.universeR15Enabled === false) fixes.push(lt('Turn on R15 avatars'));
      if (c.universeAnimationSettingsR15Enabled === false) fixes.push(lt('Use R15 animations'));
      if (c.hasR6AvatarLoaded === true) fixes.push(lt('Stop loading R6 avatars'));
      if (!ok && fixes.length) text.appendChild(el('span', 'routility-ci-muted routility-ci-o18-fix', '(' + fixes.join(', ') + ')'));
      row.dataset.rtTip = lt('Robux earned from players 18 and over in this experience can cash out at ${rate} instead of the usual rate.', { rate: O18_RATE });
      mark.replaceWith(row);
    });
  }

  const METRICS = [
    ['L7AverageForwardD1Retention', LT('Day 1 retention'), 'pct'],
    ['L7AverageForwardD7Retention', LT('Day 7 retention'), 'pct'],
    ['L7AveragePlayTimeMinutesPerDAU', LT('Playtime per player'), 'min'],
    ['L7AverageRFYPlayThroughRate', LT('Home page play rate'), 'pct'],
    ['L7AveragePayingUsersCVR', LT('Players who pay'), 'pct'],
    ['L7AverageRevenuePerPayingUser', LT('Robux per paying player'), 'robux'],
  ];

  function fmt(v, kind) {
    const n = Number(v) || 0;
    if (kind === 'pct') return (n * 100).toFixed(n * 100 < 10 ? 1 : 0).replace(/\.0$/, '') + '%';
    if (kind === 'min') return lt('{n} min', { n: n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n) });
    return formatNumber(Math.round(n));
  }

  function standing(v, mid, high) {
    if (v >= high) return [lt('Top 10%'), 'good'];
    if (v >= mid) return [lt('Above average'), 'good'];
    if (v >= mid * 0.6) return [lt('Below average'), 'warn'];
    return [lt('Well below average'), 'bad'];
  }

  function benchmarkCard(universeId) {
    if (document.querySelector('.routility-ci-bench')) return;
    const title = [...document.querySelectorAll('span')].find(n => n.children.length === 0 && n.textContent.trim() === 'Realtime');
    const head = title && title.closest('[class*="sectionHeader"]');
    if (!head) return;
    const card = el('section', 'routility-injected routility-ci-bench');
    card.dataset.pending = '1';
    head.before(card);
    Promise.all(METRICS.map(([m]) => get(`https://apis.roblox.com/universe-analytics-insights/v2/universes/${universeId}/insights/benchmark-scorecard?metric=${m}`))).then((all) => {
      if (!card.isConnected) return;
      const rows = METRICS.map((m, i) => [m, all[i]]).filter(([, d]) => d && d.percentileMap && d.percentileMap['50'] !== undefined);
      if (!rows.length) { card.remove(); return; }
      delete card.dataset.pending;
      const genre = rows.map(([, d]) => d.availableBenchmarks && d.availableBenchmarks[0] && d.availableBenchmarks[0].genre).find(Boolean);
      const top = el('div', 'routility-ci-bench-head');
      top.appendChild(el('h2', 'routility-ci-bench-title', lt('Compared to similar experiences')));
      if (genre) top.appendChild(el('span', 'routility-ci-muted', lt('{genre} experiences, last 7 days', { genre: genre.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })));
      const grid = el('div', 'routility-ci-bench-grid');
      for (const [[, label, kind], d] of rows) {
        const v = Number(d.currentValue) || 0;
        const mid = Number(d.percentileMap['50']) || 0;
        const high = Number(d.percentileMap['90']) || mid;
        const [tag, tone] = standing(v, mid, high);
        const scale = Math.max(v, high) * 1.15 || 1;
        const tile = el('div', 'routility-ci-bench-tile');
        const line = el('div', 'routility-ci-bench-label', lt(label));
        const val = el('div', 'routility-ci-bench-line');
        val.append(el('span', 'routility-ci-bench-value', fmt(d.currentValue, kind)), el('span', 'routility-ci-chip routility-ci-chip-' + tone, tag));
        const bar = el('div', 'routility-ci-bench-bar');
        const fill = el('span', 'routility-ci-bench-fill routility-ci-fill-' + tone);
        fill.style.width = Math.max(2, v / scale * 100) + '%';
        bar.appendChild(fill);
        for (const at of [mid, high]) {
          const tick = el('span', 'routility-ci-bench-mark');
          tick.style.left = (at / scale * 100) + '%';
          bar.appendChild(tick);
        }
        const legend = el('div', 'routility-ci-bench-legend');
        legend.append(el('span', null, lt('Average {value}', { value: fmt(d.percentileMap['50'], kind) })), el('span', null, lt('Top 10% {value}', { value: fmt(d.percentileMap['90'], kind) })));
        tile.append(line, val, bar, legend);
        grid.appendChild(tile);
      }
      card.append(top, grid);
    });
  }

  function launchesChip() {
    if (document.querySelector('.routility-ci-launch')) return;
    const create = [...document.querySelectorAll('a, button')].find(n => /^Create Experience/.test(n.textContent.trim()));
    const link = document.querySelector('a[href*="/dashboard/creations/experiences/"]');
    if (!create || !link) return;
    const id = (link.getAttribute('href').match(/experiences\/(\d+)/) || [])[1];
    if (!id) return;
    const tier = document.querySelector('.routility-cr-tier');
    if (!tier && settings.createTier !== false) return;
    const part = el('span', 'routility-injected routility-ci-launch routility-ci-hold');
    if (tier) tier.appendChild(part);
    else create.after(part);
    get(`https://develop.roblox.com/v1/universes/${id}/activation-eligibility`).then((d) => {
      const n = d && Number(d.remainingPublicPublishCount);
      if (!part.isConnected || !Number.isFinite(n) || n < 0) { part.remove(); return; }
      part.classList.remove('routility-ci-hold');
      const text = n === 1 ? lt('1 public launch left') : lt('{n} public launches left', { n: formatNumber(n) });
      if (tier) {
        part.classList.add('routility-ci-launch-part');
        part.append(el('span', 'routility-ci-launch-sep'), el('span', n > 0 ? null : 'routility-ci-launch-none', text));
      } else {
        part.classList.add('routility-ci-pill');
        part.append(el('span', 'routility-ci-pill-dot' + (n > 0 ? '' : ' routility-ci-pill-dot-bad')), el('span', null, text));
      }
      part.dataset.rtTip = lt('How many more experiences Roblox lets you make public right now.');
    });
  }

  function feesStrip() {
    if (document.querySelector('.routility-ci-fees')) return;
    const label = [...document.querySelectorAll('span')].find(n => n.children.length === 0 && n.textContent.trim() === 'Folder');
    const host = label && (label.closest('[class*="gridContainer"]') || label.closest('[class*="width:50%"]')?.parentElement);
    if (!host) return;
    const strip = el('div', 'routility-injected routility-ci-fees routility-ci-hold');
    host.before(strip);
    Promise.all([get('https://itemconfiguration.roblox.com/v1/collectibles/commission-rates'), get('https://itemconfiguration.roblox.com/v1/collectibles/metadata')]).then(([r, m]) => {
      if (!strip.isConnected || !r) { strip.remove(); return; }
      strip.classList.remove('routility-ci-hold');
      strip.appendChild(el('span', 'routility-ci-fees-title', lt('When your Limited resells')));
      const parts = [[lt('Seller'), r.sellerFeesPercentage], [lt('You'), r.creatorFeesPercentage], ['Roblox', r.marketplaceFeesPercentage]];
      const bar = el('div', 'routility-ci-fees-bar');
      const keys = el('div', 'routility-ci-fees-keys');
      parts.forEach(([name, pct], i) => {
        const seg = el('span', 'routility-ci-fees-seg routility-ci-fees-seg-' + i);
        seg.style.flex = String(Number(pct) || 0);
        bar.appendChild(seg);
        const k = el('span', 'routility-ci-fees-key');
        k.append(el('span', 'routility-ci-fees-swatch routility-ci-fees-seg-' + i), el('span', null, name), el('strong', null, (Number(pct) || 0) + '%'));
        keys.appendChild(k);
      });
      strip.append(bar, keys);
      const notes = [];
      if (m && m.LimitedMaxQuantity) notes.push(lt('Up to {n} copies per Limited', { n: formatNumber(m.LimitedMaxQuantity) }));
      if (m && Number(m.restockResaleLockDurationSeconds) > 0) notes.push(lt('Restocked copies can be resold after {n} days', { n: Math.round(m.restockResaleLockDurationSeconds / 86400) }));
      if (notes.length) strip.appendChild(el('div', 'routility-ci-muted routility-ci-fees-notes', notes.join('. ') + '.'));
    });
  }

  function robuxIcon() {
    const icon = el('span', 'grow-0 shrink-0 basis-auto icon icon-filled-robux size-[var(--icon-size-medium)] routility-ci-robux');
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function holdsCard() {
    if (document.querySelector('.routility-ci-holds')) return;
    const wrap = document.querySelector('[data-testid="virtual-transactions-id"]');
    const date = wrap && [...wrap.querySelectorAll('button')].find(x => /\d+\/\d+\/\d{4}\s*-/.test(x.textContent));
    const row = date && date.parentElement;
    if (!row) return;
    const card = el('div', 'routility-injected routility-ci-holds routility-ci-hold');
    row.prepend(card);
    me().then(async (id) => {
      if (!id || !card.isConnected) { card.remove(); return; }
      const end = Date.now();
      const start = end - 45 * 86400000;
      let robux = 0;
      let count = 0;
      let cursor = '';
      for (let i = 0; i < 10; i++) {
        const d = await get(`https://apis.roblox.com/transaction-records-api/v2/users/${id}/transactions?ledgerReason=SaleOfGood&limit=100&startTimeMillis=${start}&endTimeMillis=${end}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (!d || !Array.isArray(d.transactions)) break;
        for (const t of d.transactions) {
          if (t.holdStatus !== 'Active') continue;
          robux += Number(t.amount) || 0;
          count++;
        }
        cursor = d.hasMore ? d.nextCursor || '' : '';
        if (!cursor) break;
      }
      if (!card.isConnected) return;
      if (!count) { card.remove(); return; }
      card.classList.remove('routility-ci-hold');
      const left = el('div', 'routility-ci-holds-main');
      const top = el('div', 'routility-ci-holds-top');
      top.appendChild(el('span', 'routility-ci-holds-label', lt('Pending from sales')));
      const amount = el('span', 'routility-ci-holds-amount');
      amount.append(robuxIcon(), document.createTextNode(formatNumber(robux)));
      top.appendChild(amount);
      left.appendChild(top);
      left.appendChild(el('span', 'routility-ci-muted', count === 1 ? lt('From 1 sale that’s still pending') : lt('From {n} sales that are still pending', { n: formatNumber(count) })));
      card.appendChild(left);
    });
  }

  function placeMenu(universeId, placeId) {
    for (const list of document.querySelectorAll('ul.MuiMenu-list[role="menu"]')) {
      if (list.querySelector('.routility-ci-pm')) continue;
      const items = [...list.children];
      const studio = items.find(n => n.textContent.trim() === 'Edit in Studio');
      if (!studio || items.length !== 1) continue;
      const close = () => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const make = (label, run, href) => {
        const n = href ? el('a', studio.className) : el('li', studio.className);
        n.classList.add('routility-injected', 'routility-ci-pm');
        n.setAttribute('role', 'menuitem');
        n.tabIndex = -1;
        n.appendChild(document.createTextNode(label));
        if (href) {
          const wrap = studio.querySelector('.MuiListItemIcon-root');
          if (wrap) {
            const box = wrap.cloneNode(false);
            const NS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NS, 'svg');
            const like = wrap.querySelector('svg');
            svg.setAttribute('class', like ? like.getAttribute('class') || '' : 'MuiSvgIcon-root MuiSvgIcon-fontSizeMedium');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('data-testid', 'LaunchIcon');
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z');
            svg.appendChild(path);
            box.appendChild(svg);
            n.prepend(box);
          }
          n.href = href;
          n.target = '_blank';
          n.rel = 'noopener';
          n.addEventListener('click', () => setTimeout(close, 0));
        } else {
          n.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(run); } catch {}
            close();
          });
        }
        return n;
      };
      const game = `https://www.roblox.com/games/${placeId}`;
      list.insertBefore(make(lt('Copy Universe ID'), universeId), studio);
      list.insertBefore(make(lt('Copy Place ID'), placeId), studio);
      list.insertBefore(make(lt('Copy URL'), game), studio);
      list.insertBefore(make(lt('View on Roblox'), null, game), studio);
    }
  }

  function clear() {
    document.querySelectorAll('.routility-ci-o18, .routility-ci-bench, .routility-ci-launch, .routility-ci-fees, .routility-ci-holds').forEach(n => n.remove());
  }

  function route() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clear();
    }
    const path = location.pathname;
    const exp = path.match(/^\/dashboard\/creations\/experiences\/(\d+)\/overview/);
    if (exp) {
      if (settings.createO18) o18Line(exp[1]);
      if (settings.createBenchmark) benchmarkCard(exp[1]);
    }
    const tab = new URLSearchParams(location.search).get('activeTab') || '';
    if (/^\/dashboard\/creations\/?$/.test(path)) {
      if (settings.createLaunches && (!tab || tab === 'Experiences')) launchesChip();
      if (settings.createFees && tab === 'AvatarItems') feesStrip();
    }
    if (settings.createHolds && /^\/dashboard\/transactions\/?$/.test(path)) holdsCard();
    const place = path.match(/^\/dashboard\/creations\/experiences\/(\d+)\/places\/(\d+)/);
    if (place && settings.createIds !== false) placeMenu(place[1], place[2]);
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    const tick = onFrame(route);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(() => { if (location.href !== lastUrl) tick(); }, 400);
    tick();
  });
})();
