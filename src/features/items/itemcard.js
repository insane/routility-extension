(function () {
  'use strict';

  const { el, formatUSD, formatNumber, request, cardKey, itemValue, valueTag, shows } = window.RoUtilityUI;
  const showing = shows('Cards');
  const { lt } = window.RoUtilityI18n;
  const LOGO = chrome.runtime.getURL('assets/icons/logo.png');
  const CARDS = '.trade-list-detail-offer .trade-item-card, .trade-request-window-offer .trade-request-item, .trade-request-window-offer .trade-item-card';
  const DELAY = 400;
  const cache = new Map();
  let on = true;
  let timer = null;
  let pending = null;
  let pop = null;
  let popFor = null;

  chrome.storage.local.get('routilitySettings', (s) => { on = (s.routilitySettings || {}).tradeItemCard !== false; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).tradeItemCard !== false;
    if (!on) close();
  });

  function load(id) {
    if (cache.has(id)) return cache.get(id);
    const job = Promise.all([
      request({ type: 'getItem', id }, r => !!(r && r.ready)),
      request({ type: 'getHistory', id }, r => r !== undefined),
    ]).then(([item, hist]) => ({ item: item && item.item, points: (hist && hist.points) || [] }));
    cache.set(id, job);
    job.then(d => { if (!d.item) cache.delete(id); });
    return job;
  }

  function spark(points) {
    const cutoff = Date.now() - 30 * 86400000;
    const recent = points.filter(p => p.ts * (p.ts < 1e12 ? 1000 : 1) >= cutoff);
    const list = recent.length >= 2 ? recent : points.slice(-30);
    if (list.length < 2) return null;
    const vals = list.map(p => p.usd);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const W = 240;
    const H = 48;
    const span = max - min || 1;
    const flat = max === min;
    const d = list.map((p, i) => `${i ? 'L' : 'M'}${(i / (list.length - 1) * W).toFixed(1)} ${(flat ? H / 2 : H - 4 - (p.usd - min) / span * (H - 8)).toFixed(1)}`).join(' ');
    const first = vals[0];
    const last = vals[vals.length - 1];
    const up = last >= first;
    const wrap = el('div', 'routility-ic-chart ' + (flat ? 'content-muted' : up ? 'content-system-success' : 'content-system-alert'));
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    const change = first > 0 ? (last - first) / first * 100 : 0;
    return { node: wrap, change, up, diff: last - first };
  }

  function row(label, value, cls) {
    const r = el('div', 'flex items-center justify-between gap-medium');
    r.appendChild(el('span', 'text-body-small content-muted', label));
    r.appendChild(el('span', 'text-label-medium ' + (cls || 'content-emphasis'), value));
    return r;
  }

  function render(data, card) {
    const item = data.item;
    const body = el('div', 'flex flex-col gap-small');
    const head = el('div', 'flex items-center gap-small');
    const thumbSrc = card.querySelector('.item-card-thumb-container img, img')?.src || item.thumb;
    if (thumbSrc) {
      const img = el('img', 'routility-ic-thumb');
      img.alt = '';
      img.src = thumbSrc;
      head.appendChild(img);
    }
    const names = el('div', 'flex flex-col min-width-0');
    names.appendChild(el('span', 'text-title-medium content-emphasis text-truncate-end', item.name));
    const tags = el('span', 'flex items-center gap-xsmall');
    if (item.projected) {
      const t = el('span', 'foundation-web-badge inline-flex items-center radius-circle padding-x-small bg-system-alert content-inverse-emphasis routility-ic-tag');
      t.appendChild(el('span', null, lt('Projected')));
      tags.appendChild(t);
    }
    if (item.rare) {
      const t = el('span', 'foundation-web-badge inline-flex items-center radius-circle padding-x-small bg-shift-300 content-emphasis routility-ic-tag');
      t.appendChild(el('span', null, lt('Rare')));
      tags.appendChild(t);
    }
    if (tags.children.length) names.appendChild(tags);
    head.appendChild(names);
    body.appendChild(head);
    const usdRow = el('div', 'flex items-center gap-small flex-wrap routility-ic-prices');
    const logo = el('img', 'routility-ic-logo');
    logo.src = LOGO;
    logo.alt = '';
    if (showing.usd || !(showing.value && itemValue(item))) usdRow.append(logo, el('span', 'text-heading-small content-emphasis', Number.isFinite(item.usd) && item.usd > 0 ? formatUSD(item.usd) : lt('No price')));
    if (!showing.value && itemValue(item)) usdRow.dataset.rtTip = window.RoUtilityUI.valueTip(item);
    if (showing.value && itemValue(item)) usdRow.appendChild(valueTag(itemValue(item), { className: 'text-heading-small routility-ic-val', tip: false }));
    body.appendChild(usdRow);
    const chart = spark(data.points);
    if (chart) {
      body.appendChild(chart.node);
      const sign = chart.diff > 0 ? '+' : '-';
      const text = Math.abs(chart.diff) < 0.005 ? lt('No change') : `${sign}${formatUSD(Math.abs(chart.diff))} (${Math.round(Math.abs(chart.change))}%)`;
      body.appendChild(row(lt('30-day change'), text, chart.diff > 0.005 ? 'content-system-success' : chart.diff < -0.005 ? 'content-system-alert' : 'content-emphasis'));
    }
    if (showing.rap) body.appendChild(row('RAP', formatNumber(item.rap || 0) + ' R$'));
    if (item.demand) body.appendChild(row(lt('Demand'), lt(item.demand)));
    if (item.trend) body.appendChild(row(lt('Trend'), lt(item.trend)));
    if (item.copies != null) body.appendChild(row(lt('Copies'), formatNumber(item.copies)));
    return body;
  }

  function place(card) {
    if (!pop) return;
    const r = card.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left = r.right + 10;
    if (left + w > vw - 8) left = r.left - w - 10;
    if (left < 8) left = Math.max(8, Math.min(vw - w - 8, r.left));
    let top = r.top;
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  async function open(card) {
    const key = cardKey(card);
    if (!key || !key.startsWith('id:')) return;
    const id = key.slice(3);
    close();
    popFor = card;
    const current = el('div', 'routility-injected routility-item-card bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    current.setAttribute('role', 'tooltip');
    pop = current;
    const sk = el('div', 'flex flex-col gap-small');
    const skHead = el('div', 'flex items-center gap-small');
    skHead.append(el('span', 'routility-sk routility-ic-sk-thumb'), el('span', 'routility-sk routility-ic-sk-line'));
    sk.append(skHead, el('span', 'routility-sk routility-ic-sk-chart'), el('span', 'routility-sk routility-ic-sk-line'), el('span', 'routility-sk routility-ic-sk-line'));
    current.appendChild(sk);
    document.body.appendChild(current);
    place(card);
    const data = await load(id);
    if (pop !== current) return;
    if (!data.item) return close();
    current.textContent = '';
    current.appendChild(render(data, card));
    place(card);
  }

  function close() {
    pop?.remove();
    pop = null;
    popFor = null;
  }

  let everywhere = true;
  chrome.storage.local.get('routilitySettings', (st) => { everywhere = (st.routilitySettings || {}).itemCardEverywhere !== false; });

  function cardFrom(target) {
    const trade = target.closest?.(CARDS);
    if (trade) return trade;
    if (!everywhere) return null;
    const other = target.closest?.('.list-item.item-card, .catalog-item-container');
    return other && other.querySelector('.routility-card-usd') && !other.closest('#avatar-web-app') ? other : null;
  }

  document.addEventListener('mouseover', (e) => {
    if (!on) return;
    const card = cardFrom(e.target);
    if (!card) return;
    if (card === popFor || card === pending) return;
    clearTimeout(timer);
    pending = card;
    timer = setTimeout(() => {
      pending = null;
      if (card.matches(':hover')) open(card);
    }, pop || Date.now() - lastClose < 400 ? 80 : DELAY);
  });

  let lastClose = 0;

  document.addEventListener('mouseout', (e) => {
    const card = cardFrom(e.target);
    if (!card) return;
    const to = e.relatedTarget;
    if (to && card.contains(to)) return;
    if (card === pending) {
      clearTimeout(timer);
      pending = null;
    }
    if (card === popFor) {
      lastClose = Date.now();
      close();
    }
  });

  window.addEventListener('scroll', () => { if (pop) close(); }, true);
  document.addEventListener('mousedown', () => { if (pop) close(); }, true);

  window.RoUtilityItemCard = { close };
})();
