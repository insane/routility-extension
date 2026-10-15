(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LINE_COLOR = '#02b757';
  const HEIGHT = 130;
  const PAD = { left: 50, right: 10, top: 10, bottom: 37 };
  const AXIS_LABEL_STYLE = 'color:#666666;cursor:default;font-size:11px;fill:#666666;';
  const TOOLTIP_GAP = 16;
  const TOOLTIP_ANIM_MS = 250;

  let state = null;

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  const el = window.RoUtilityUI.el;
  const { lt } = window.RoUtilityI18n;

  function axisUSD(v) {
    const sym = window.RoUtilityUI.cash().symbol;
    if (v === 0) return sym + '0';
    if (v >= 1_000_000) return sym + +(v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return sym + +(v / 1_000).toFixed(1) + 'k';
    return sym + +v.toFixed(2);
  }


  function niceStep(raw) {
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) {
      if (raw <= m * mag) return m * mag;
    }
    return 10 * mag;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function xTicks(minT, maxT, days) {
    const ticks = [];
    const d = new Date(minT * 1000);
    if (days <= 30) {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      while (d.getTime() / 1000 <= maxT) {
        ticks.push(d.getTime() / 1000);
        d.setDate(d.getDate() + 7);
      }
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      while (d.getTime() / 1000 <= maxT) {
        ticks.push(d.getTime() / 1000);
        d.setMonth(d.getMonth() + 1);
      }
    }
    return ticks;
  }

  function currentRangeDays() {
    const label = document.querySelector('#price-chart .price-chart-range-dropdown .rbx-selection-label');
    const days = label ? parseInt(label.textContent, 10) : 180;
    return Number.isFinite(days) ? days : 180;
  }

  function draw() {
    if (!state || !state.host.isConnected) return;
    const host = state.host;
    host.textContent = '';
    const width = host.clientWidth || 916;
    const days = currentRangeDays();
    const last = state.points[state.points.length - 1].ts;
    const minT = last - days * 86400;
    let pts = state.points.filter(p => p.ts >= minT);
    if (pts.length < 2) pts = state.points.slice(-2);

    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const k = window.RoUtilityUI.toCash(1);
    const maxUsd = Math.max(...pts.map(p => p.usd * k)) || 1;
    const step = niceStep(maxUsd / 3);
    const yMax = step * 3;
    const t0 = Math.min(minT, pts[0].ts);
    const x = t => PAD.left + ((t - t0) / (last - t0 || 1)) * plotW;
    const yc = v => PAD.top + plotH - (v / yMax) * plotH;
    const y = v => yc(v * k);

    const frame = el('div', 'highcharts-container');
    frame.style.cssText = `position: relative; overflow: hidden; width: ${width}px; height: ${HEIGHT}px; text-align: left; line-height: normal; z-index: 0;`;
    host.appendChild(frame);

    const root = svg('svg', {
      version: '1.1',
      class: 'highcharts-root routility-chart-svg',
      style: 'font-family:"Lucida Grande", "Lucida Sans Unicode", Arial, Helvetica, sans-serif;font-size:12px;',
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
    }, frame);

    const grid = svg('g', { class: 'highcharts-grid highcharts-yaxis-grid' }, root);
    const yLabels = svg('g', { class: 'highcharts-axis-labels highcharts-yaxis-labels' });
    for (let i = 0; i <= 3; i++) {
      const gy = Math.round(yc(step * i)) + 0.5;
      svg('path', { fill: 'none', stroke: '#e6e6e6', 'stroke-width': 1, class: 'highcharts-grid-line', d: `M ${PAD.left} ${gy} L ${width - PAD.right} ${gy}` }, grid);
      const label = svg('text', { x: 35, y: Math.round(gy + 3.5), 'text-anchor': 'end', style: AXIS_LABEL_STYLE }, yLabels);
      svg('tspan', {}, label).textContent = axisUSD(step * i);
    }
    const xAxis = svg('g', { class: 'highcharts-axis highcharts-xaxis' }, root);
    const baseY = Math.round(y(0)) + 0.5;
    svg('path', { fill: 'none', class: 'highcharts-axis-line', stroke: '#ccd6eb', 'stroke-width': 1, d: `M ${PAD.left} ${baseY} L ${width - PAD.right} ${baseY}` }, xAxis);

    const series = svg('g', { class: 'highcharts-series-group' }, root);
    const linePath = pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.ts).toFixed(2)} ${y(p.usd).toFixed(2)}`).join(' ');
    svg('path', { fill: 'none', d: linePath, class: 'highcharts-graph', stroke: LINE_COLOR, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, series);

    const markers = svg('g', { class: 'highcharts-markers' }, series);
    const marker = svg('circle', { r: 6, fill: LINE_COLOR, stroke: '#ffffff', 'stroke-width': 1, visibility: 'hidden' }, markers);
    const halo = svg('circle', { r: 10, fill: LINE_COLOR, 'fill-opacity': 0.25, class: 'highcharts-halo', visibility: 'hidden' }, markers);

    root.appendChild(yLabels);
    const xLabels = svg('g', { class: 'highcharts-axis-labels highcharts-xaxis-labels' }, root);
    for (const t of xTicks(t0, last, days)) {
      const d = new Date(t * 1000);
      const label = svg('text', { x: x(t), y: 112, 'text-anchor': 'middle', style: AXIS_LABEL_STYLE }, xLabels);
      svg('tspan', {}, label).textContent = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    }

    const tip = svg('g', {
      class: 'highcharts-label highcharts-tooltip',
      style: 'cursor:default;pointer-events:none;white-space:nowrap;',
      visibility: 'hidden',
    }, root);
    const shadows = [[5, 0.05], [3, 0.1], [1, 0.15]].map(([w, o]) =>
      svg('path', { fill: 'none', class: 'highcharts-label-box highcharts-tooltip-box', stroke: '#000000', 'stroke-opacity': o, 'stroke-width': w, transform: 'translate(1, 1)' }, tip));
    const tipBox = svg('path', { fill: '#757575', class: 'highcharts-label-box highcharts-tooltip-box', stroke: '#757575', 'stroke-width': 1 }, tip);
    const tipText = svg('text', { x: 8, y: 20, style: 'font-size:12px;color:#333333;fill:#333333;' }, tip);
    const tipSpan = svg('tspan', { style: 'fill:#fff' }, tipText);

    const overlay = svg('rect', { x: PAD.left, y: PAD.top, width: plotW, height: plotH, fill: 'transparent' }, root);
    let shown = false;
    let tipPos = null;
    let anim = 0;

    function moveTip(tx, ty) {
      cancelAnimationFrame(anim);
      if (!tipPos) {
        tipPos = { x: tx, y: ty };
        tip.setAttribute('transform', `translate(${tx},${ty})`);
        return;
      }
      const from = { ...tipPos };
      const start = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - start) / TOOLTIP_ANIM_MS);
        const e = 1 - Math.pow(1 - k, 2);
        tipPos = { x: from.x + (tx - from.x) * e, y: from.y + (ty - from.y) * e };
        tip.setAttribute('transform', `translate(${Math.round(tipPos.x)},${Math.round(tipPos.y)})`);
        if (k < 1) anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
    }

    overlay.addEventListener('mousemove', (e) => {
      const rect = root.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let best = pts[0];
      for (const p of pts) {
        if (Math.abs(x(p.ts) - mx) < Math.abs(x(best.ts) - mx)) best = p;
      }
      if (shown === best) return;
      shown = best;

      const px = x(best.ts);
      const py = y(best.usd);
      for (const c of [halo, marker]) {
        c.setAttribute('cx', px);
        c.setAttribute('cy', py);
        c.setAttribute('visibility', 'visible');
      }

      tipSpan.textContent = window.RoUtilityUI.formatUSD(best.usd);
      tip.setAttribute('visibility', 'visible');
      const w = Math.round(tipText.getComputedTextLength()) + 17;
      const r = w - 0.5;
      const above = py - TOOLTIP_GAP - 35 >= 0;
      const tx = Math.round(Math.max(0, Math.min(px - w / 2, width - w)));
      const ty = Math.round(above ? py - TOOLTIP_GAP - 35 : py + TOOLTIP_GAP);
      const ax = Math.max(9.5, Math.min(Math.round(px - tx) + 0.5, r - 9));
      const d = above
        ? `M 3.5 0.5 L ${r - 3} 0.5 C ${r} 0.5 ${r} 0.5 ${r} 3.5 L ${r} 31.5 C ${r} 34.5 ${r} 34.5 ${r - 3} 34.5 L ${ax + 6} 34.5 ${ax} 40.5 ${ax - 6} 34.5 3.5 34.5 C 0.5 34.5 0.5 34.5 0.5 31.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5`
        : `M 3.5 0.5 L ${ax - 6} 0.5 ${ax} -5.5 ${ax + 6} 0.5 ${r - 3} 0.5 C ${r} 0.5 ${r} 0.5 ${r} 3.5 L ${r} 31.5 C ${r} 34.5 ${r} 34.5 ${r - 3} 34.5 L 3.5 34.5 C 0.5 34.5 0.5 34.5 0.5 31.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5`;
      for (const p of [...shadows, tipBox]) p.setAttribute('d', d);
      moveTip(tx, ty);
    });

    let hideTimer = 0;
    const fadeParts = [tip, marker, halo];
    overlay.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      for (const n of fadeParts) n.style.opacity = '';
    });
    overlay.addEventListener('mouseleave', () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        for (const n of fadeParts) n.style.opacity = '0';
        hideTimer = setTimeout(() => {
          cancelAnimationFrame(anim);
          shown = false;
          tipPos = null;
          for (const n of fadeParts) {
            n.setAttribute('visibility', 'hidden');
            n.style.opacity = '';
          }
        }, 250);
      }, 500);
    });
  }

  function applyMode() {
    if (!state) return;
    const usd = state.mode === 'usd';
    state.container.classList.toggle('routility-usd-mode', usd);
    if (usd) draw();
  }

  function ensureInjected() {
    if (!state) return;
    const container = document.querySelector('#price-chart .price-volume-charts-container');
    if (!container) return;
    if (container === state.container && container.querySelector('.routility-currency-dropdown')) {
      if (container.classList.contains('routility-usd-mode') !== (state.mode === 'usd')) applyMode();
      return;
    }

    state.container = container;
    const range = container.querySelector('.price-chart-range-dropdown');

    const dropdown = window.RoUtilityUI.dropdown(
      [{ value: 'robux', label: 'Robux' }, { value: 'usd', label: window.RoUtilityUI.cash().code }],
      state.mode,
      (mode) => {
        state.mode = mode;
        try { chrome.storage.local.set({ routilityChartMode: mode }); } catch {}
        applyMode();
      },
      'routility-currency-dropdown'
    );
    if (range) {
      range.after(dropdown);
      const cr = container.getBoundingClientRect();
      const rr = range.getBoundingClientRect();
      if (rr.width && cr.width) {
        dropdown.classList.add('routility-currency-pinned');
        dropdown.style.top = Math.round(rr.top - cr.top) + 'px';
        dropdown.style.right = Math.round(cr.right - rr.left + 8) + 'px';
      }
    } else container.prepend(dropdown);

    const legend = el('div', 'price-chart-legend routility-legend routility-injected');
    legend.appendChild(el('div', 'line'));
    legend.appendChild(el('div', 'text-pastname legend-text', lt('RoUtility {currency} Price', { currency: window.RoUtilityUI.cash().code })));
    const nativeLegend = container.querySelector('.price-chart-legend:not(.routility-legend)');
    if (nativeLegend) nativeLegend.after(legend);
    else dropdown.after(legend);

    state.host = el('div', 'routility-chart routility-injected');
    window.RoUtilityUI.mark('chart');
    legend.after(state.host);

    state.resize?.disconnect();
    state.resize = new ResizeObserver(() => { if (state.mode === 'usd') draw(); });
    state.resize.observe(state.host);

    const rangeLabel = range?.querySelector('.rbx-selection-label');
    state.rangeObs?.disconnect();
    if (rangeLabel) {
      state.rangeObs = new MutationObserver(() => { if (state.mode === 'usd') draw(); });
      state.rangeObs.observe(rangeLabel, { childList: true, characterData: true, subtree: true });
    }

    applyMode();
  }

  function teardown() {
    if (!state) return;
    state.resize?.disconnect();
    state.rangeObs?.disconnect();
    state.pageObs?.disconnect();
    state.container?.classList.remove('routility-usd-mode');
    state = null;
  }

  function setup(itemId) {
    teardown();
    const startPath = location.pathname;
    window.RoUtilityUI.request({ type: 'getHistory', id: itemId }).then((response) => {
      const points = response && response.points;
      if (!points || points.length < 2) return;
      if (location.pathname !== startPath) return;
      chrome.storage.local.get('routilityChartMode', (stored) => {
        if (location.pathname !== startPath) return;
        teardown();
        state = {
          itemId,
          points: points.slice().sort((a, b) => a.ts - b.ts),
          mode: stored.routilityChartMode === 'usd' ? 'usd' : 'robux',
          container: null,
          host: null,
        };
        const section = document.querySelector('#item-details-container') || document.body;
        state.pageObs = new MutationObserver(window.RoUtilityUI.onFrame(ensureInjected));
        state.pageObs.observe(section, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        ensureInjected();
      });
    });
  }

  window.RoUtilityChart = { setup, teardown };
})();
