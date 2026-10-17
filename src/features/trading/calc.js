(function () {
  'use strict';

  const { el, pageTitle, formatUSD, formatCash, cash, fromCash, formatNumber, request, itemValue, valueTag, shows, chunks } = window.RoUtilityUI;
  const showing = shows('Calc');
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PATH = /^\/trades\/calculator\/?$/i;
  const PER_PAGE = 30;
  const MAX_SLOTS = 12;
  const LOGO = chrome.runtime.getURL('assets/icons/logo.png');
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const SORTS = [
    ['usd-desc', LT('Price (High)')], ['usd-asc', LT('Price (Low)')],
    ['rap-desc', LT('RAP (High)')], ['rap-asc', LT('RAP (Low)')],
    ['name-asc', LT('Name (A-Z)')],
  ];
  const DEMANDS = [LT('Amazing'), LT('High'), LT('Normal'), LT('Low'), LT('Terrible')];
  const SIDES = { give: LT('You give'), get: LT('You receive') };
  const LAST_KEY = 'routilityCalcLast';
  const HAS_TRADE = /(^#|&)(give|get)(Slots)?=/;

  let settings = {};
  let s = null;

  function layer() {
    const d = el('div', STATE_LAYER);
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  function fbutton(label, variant, onClick, extra, icon) {
    const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (variant || 'bg-action-standard content-action-standard') + (extra ? ' ' + extra : ''));
    btn.type = 'button';
    btn.appendChild(layer());
    const inner = el('span', 'flex items-center min-width-0 gap-small');
    if (icon) inner.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-' + icon + ' size-400 shrink-0'));
    const text = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    inner.appendChild(text);
    btn.appendChild(inner);
    btn.label = text;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  function iconButton(icon, label, onClick, extra) {
    const btn = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-standard ' + (extra || ''));
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.appendChild(layer());
    btn.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-' + icon + ' size-500 content-emphasis'));
    btn.addEventListener('click', onClick);
    return btn;
  }

  function finput(placeholder, opts = {}) {
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable focus-visible:outline-focus stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis ' + (opts.extra || ''));
    const l = layer();
    l.classList.add('pointer-events-none');
    field.appendChild(l);
    if (opts.lead) {
      const lead = el('div', 'flex shrink-0 items-center');
      lead.appendChild(opts.lead);
      field.appendChild(lead);
    }
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium routility-calc-input');
    input.type = opts.type || 'text';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (opts.inputmode) input.inputMode = opts.inputmode;
    field.appendChild(input);
    field.input = input;
    return field;
  }

  function badge(text) {
    const b = el('div', 'foundation-web-badge flex items-center select-none radius-circle height-600 width-[fit-content] padding-x-small bg-shift-300 content-emphasis stroke-none');
    const t = el('span', 'text-no-wrap text-label-small padding-y-xsmall padding-x-xxsmall', text);
    b.appendChild(t);
    b.text = t;
    return b;
  }

  function addTo(side) {
    return side === 'give' ? lt('Add to you give') : lt('Add to you receive');
  }

  function usdText(v) {
    return formatCash(v);
  }

  function entryUsd(e) {
    if (e.kind === 'item') return e.usd || 0;
    if (e.kind === 'robux') return e.amount * robuxRate();
    return e.amount;
  }

  function entryRap(e) {
    if (e.kind === 'item') return e.rap || 0;
    if (e.kind === 'robux') return e.amount;
    return 0;
  }

  function entryValue(e) {
    if (e.kind !== 'item') return 0;
    return itemValue(catalogItem(e.id) || e);
  }

  function filled(side) {
    return s.sides[side].entries.filter(Boolean);
  }

  function totals(side) {
    const list = filled(side);
    return { usd: list.reduce((n, e) => n + entryUsd(e), 0), rap: list.reduce((n, e) => n + entryRap(e), 0), value: list.reduce((n, e) => n + entryValue(e), 0), valued: list.filter(e => entryValue(e) > 0).length, count: list.length };
  }

  function catalogItem(id) {
    return s.byId.get(String(id)) || null;
  }

  function fromItem(item, serial) {
    return { kind: 'item', id: String(item.id), name: item.name, usd: item.usd || 0, rap: item.rap || 0, value: itemValue(item), thumb: item.thumb || '', serial: serial || null };
  }

  function openSlot(side) {
    const sd = s.sides[side];
    for (let i = 0; i < sd.slots; i++) if (!sd.entries[i]) return i;
    return -1;
  }

  function addEntry(side, entry, pick) {
    let target = side;
    let index = -1;
    const sel = pick && s.selected;
    if (sel && !s.sides[sel.side].entries[sel.index] && sel.index < s.sides[sel.side].slots) {
      target = sel.side;
      index = sel.index;
    } else {
      index = openSlot(side);
      if (index < 0 && pick) {
        const other = side === 'give' ? 'get' : 'give';
        const o = openSlot(other);
        if (o >= 0) {
          target = other;
          index = o;
        }
      }
      if (index < 0) {
        const sd = s.sides[side];
        if (sd.slots >= MAX_SLOTS) return false;
        target = side;
        index = sd.slots;
        sd.slots++;
      }
    }
    s.sides[target].entries[index] = entry;
    if (pick) {
      s.selected = null;
      if (s.adding !== target) {
        s.adding = target;
        renderToolbar();
      }
    }
    changed();
    return true;
  }

  function changed() {
    renderSides();
    renderSummary();
    writeHash();
  }

  function slotTile(side, entry, index) {
    const li = el('li', 'routility-calc-slot');
    if (!entry) {
      const btn = el('button', 'relative clip group/interactable cursor-pointer routility-calc-slot-empty');
      btn.type = 'button';
      btn.setAttribute('aria-label', addTo(side));
      btn.appendChild(layer());
      btn.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-plus size-600 content-muted'));
      const picked = s.selected && s.selected.side === side && s.selected.index === index;
      if (picked) {
        btn.classList.add('routility-calc-slot-selected');
        btn.lastChild.remove();
        btn.appendChild(el('span', 'text-label-small content-emphasis routility-calc-slot-pick', lt('Select')));
      }
      btn.setAttribute('aria-pressed', String(!!picked));
      btn.addEventListener('click', () => {
        s.selected = picked ? null : { side, index };
        if (s.adding !== side) setAdding(side);
        else renderSides();
      });
      li.appendChild(btn);
      return li;
    }
    const btn = el('button', 'relative clip group/interactable cursor-pointer routility-calc-slot-filled');
    btn.type = 'button';
    btn.setAttribute('aria-label', entry.kind === 'robux' ? lt('Remove {amount} Robux', { amount: formatNumber(entry.amount) }) : lt('Remove {item}', { item: entry.kind === 'item' ? entry.name : usdText(entry.amount) }));
    btn.appendChild(layer());
    if (entry.kind === 'item') {
      const thumb = el('span', 'thumbnail-2d-container routility-calc-slot-thumb');
      if (entry.thumb) {
        const img = el('img');
        img.alt = '';
        img.src = entry.thumb;
        thumb.appendChild(img);
      }
      btn.appendChild(thumb);
    } else {
      const box = window.RoUtilityUI.cashTile(entry.kind === 'robux' ? 'robux' : 'usd', entry.amount);
      btn.appendChild(box);
    }
    const remove = el('span', 'routility-calc-slot-remove');
    remove.setAttribute('aria-hidden', 'true');
    remove.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-close size-500'));
    btn.appendChild(remove);
    btn.addEventListener('click', () => {
      const sd = s.sides[side];
      sd.entries[index] = null;
      while (sd.entries.length && !sd.entries[sd.entries.length - 1]) sd.entries.pop();
      changed();
    });
    li.appendChild(btn);
    return li;
  }

  function currencyRow(side, kind) {
    const lead = kind === 'robux' ? el('span', 'icon-robux-16x16') : el('span', 'text-label-medium content-system-success routility-calc-dollar', cash().symbol);
    const field = finput(kind === 'robux' ? lt('Add Robux') : lt('Add {currency}', { currency: cash().code }), { lead, inputmode: 'decimal' });
    const row = el('div', 'flex items-center gap-small routility-calc-currency');
    const add = fbutton(lt('Add'), 'bg-action-standard content-action-standard', null, 'shrink-0');
    const go = () => {
      const amount = window.RoUtilityUI.parseAmount(field.input.value, kind === 'robux');
      const n = kind === 'robux' ? amount : Math.round(fromCash(amount) * 10000) / 10000;
      if (!(n > 0)) {
        if (!field.input.value.trim()) return;
        field.classList.add('stroke-system-alert', 'routility-calc-invalid');
        clearTimeout(field.badTimer);
        field.badTimer = setTimeout(() => field.classList.remove('stroke-system-alert', 'routility-calc-invalid'), 1200);
        return;
      }
      field.classList.remove('stroke-system-alert', 'routility-calc-invalid');
      if (addEntry(side, { kind, amount: n })) field.input.value = '';
    };
    add.addEventListener('click', go);
    field.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    row.append(field, add);
    return row;
  }

  function totalLine(label, value, cls) {
    const line = el('div', 'flex items-center justify-between routility-calc-total');
    line.appendChild(el('span', 'text-label-small content-muted', label));
    line.appendChild(el('span', 'text-title-large ' + (cls || 'content-emphasis'), value));
    return line;
  }

  function sidePanel(side) {
    const panel = el('section', 'routility-calc-side bg-surface-100 radius-large');
    panel.dataset.side = side;
    const head = el('div', 'flex items-center justify-between routility-calc-side-head');
    const title = el('h2', 'text-heading-small content-emphasis padding-none margin-none', lt(SIDES[side]));
    head.appendChild(title);
    const ctrl = el('div', 'flex items-center gap-small');
    const count = badge('0/4');
    count.classList.add('routility-calc-count');
    ctrl.appendChild(count);
    ctrl.appendChild(iconButton('minus', lt('Fewer slots'), () => {
      const sd = s.sides[side];
      if (sd.slots <= 1) return;
      if (sd.entries[sd.slots - 1]) {
        const packed = sd.entries.filter(Boolean);
        if (packed.length >= sd.slots) return;
        sd.entries = packed;
      }
      sd.slots--;
      sd.entries.length = Math.min(sd.entries.length, sd.slots);
      if (s.selected && s.selected.side === side && s.selected.index >= sd.slots) s.selected = null;
      changed();
    }));
    ctrl.appendChild(iconButton('plus', lt('More slots'), () => {
      const sd = s.sides[side];
      if (sd.slots < MAX_SLOTS) { sd.slots++; changed(); }
    }));
    head.appendChild(ctrl);
    panel.appendChild(head);
    panel.appendChild(el('ul', 'routility-calc-slots'));
    panel.appendChild(currencyRow(side, 'robux'));
    panel.appendChild(currencyRow(side, 'usd'));
    const sums = el('div', 'routility-calc-sums');
    panel.appendChild(sums);
    return panel;
  }

  function renderSides() {
    for (const side of ['give', 'get']) {
      const panel = s.root.querySelector(`.routility-calc-side[data-side="${side}"]`);
      const sd = s.sides[side];
      const list = panel.querySelector('.routility-calc-slots');
      list.textContent = '';
      for (let i = 0; i < sd.slots; i++) list.appendChild(slotTile(side, sd.entries[i], i));
      panel.querySelector('.routility-calc-count').text.textContent = `${filled(side).length}/${sd.slots}`;
      const t = totals(side);
      const sums = panel.querySelector('.routility-calc-sums');
      sums.textContent = '';
      sums.appendChild(totalLine(lt('Price est.'), usdText(t.usd), 'content-emphasis'));
      if (showing.value && totals('give').valued + totals('get').valued > 0) {
        const line = totalLine(lt('RoUtility Value'), '', 'content-emphasis');
        line.lastChild.replaceWith(t.valued ? valueTag(t.value, { className: 'text-title-large', tip: false }) : el('span', 'text-body-medium routility-val-none', lt('None valued')));
        line.dataset.rtTip = lt('Only items with a RoUtility value are counted');
        sums.appendChild(line);
      }
      sums.appendChild(totalLine(lt('Total RAP'), formatNumber(Math.round(t.rap)) + ' R$', 'content-emphasis'));
      panel.classList.toggle('routility-calc-adding', s.adding === side);
    }
  }

  function signed(v, fmt) {
    if (!v) return fmt(0);
    return (v > 0 ? '+' : '-') + fmt(Math.abs(v));
  }

  function robuxRate() {
    if (settings.calcRobuxRap === false || (settings.calcRobuxRap === undefined && settings.calcRobux === 'none')) return 0;
    return window.RoUtilityUI.robuxRate(settings);
  }

  function byRap() {
    return settings.calcVerdict === 'rap';
  }

  function verdictFor(give, get) {
    if (!give.count || !get.count) return { text: lt('Add items to both sides'), tone: 'content-muted' };
    const d = byRap() ? get.rap - give.rap : get.usd - give.usd;
    const unit = byRap() ? 'RAP' : cash().code;
    if (Math.abs(d) < (byRap() ? 0.5 : 0.005)) return { text: lt('Even trade'), tone: 'content-emphasis' };
    return d > 0 ? { text: lt('You gain {unit}', { unit }), tone: 'content-system-success' } : { text: lt('You lose {unit}', { unit }), tone: 'content-system-alert' };
  }

  function percentsOn() {
    return settings.calcPercents !== false;
  }

  function startSlots() {
    const n = Number(settings.calcSlots);
    return n === 8 || n === 12 ? n : 4;
  }

  function pct(diff, base) {
    if (!(base > 0)) return '';
    const v = Math.abs(diff / base * 100);
    const n = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    let shown = String(n);
    try { shown = n.toLocaleString(window.RoUtilityI18n.locale(), { maximumFractionDigits: 1 }); } catch {}
    return `${diff >= 0 ? '+' : '-'}${n > 999 ? '999+' : shown}%`;
  }

  function renderSummary() {
    const give = totals('give');
    const get = totals('get');
    const box = s.root.querySelector('.routility-calc-summary');
    box.textContent = '';
    const both = give.count && get.count;
    const dUsd = get.usd - give.usd;
    const dRap = get.rap - give.rap;
    const tone = (v) => (!both || Math.abs(v) < 0.005 ? 'content-emphasis' : v > 0 ? 'content-system-success' : 'content-system-alert');
    const cell = (label, value, toneClass, note) => {
      const c = el('div', 'flex flex-col gap-xsmall routility-calc-summary-cell');
      c.appendChild(el('span', 'text-label-small content-muted', label));
      const row = el('div', 'flex items-baseline gap-small');
      row.appendChild(el('span', 'text-heading-small ' + toneClass, value));
      if (note) row.appendChild(el('span', 'text-label-medium ' + toneClass + ' routility-calc-pct', note));
      c.appendChild(row);
      return c;
    };
    box.appendChild(cell(lt('RAP difference'), both ? signed(Math.round(dRap), formatNumber) + ' R$' : '—', tone(dRap), both && percentsOn() ? pct(dRap, give.rap) : ''));
    box.appendChild(cell(lt('Price difference'), both ? signed(dUsd, usdText) : '—', tone(dUsd), both && percentsOn() ? pct(dUsd, give.usd) : ''));
    const v = verdictFor(give, get);
    const vc = el('div', 'flex flex-col gap-xsmall routility-calc-summary-cell');
    vc.appendChild(el('span', 'text-label-small content-muted', lt('Verdict')));
    if (!both) {
      vc.appendChild(el('span', 'text-title-medium content-muted', v.text));
    } else {
      const line = el('div', 'flex items-center gap-small routility-calc-verdict-row');
      const tag = el('div', 'foundation-web-badge flex items-center select-none radius-circle height-600 width-[fit-content] padding-x-small stroke-none routility-calc-verdict ' + (v.tone === 'content-system-success' ? 'bg-system-success content-inverse-emphasis' : v.tone === 'content-system-alert' ? 'bg-system-alert content-inverse-emphasis' : 'bg-shift-300 content-emphasis'));
      tag.appendChild(el('span', 'text-label-small text-no-wrap', v.text));
      line.appendChild(tag);
      vc.appendChild(line);
      const dv = byRap() ? dRap : dUsd;
      const bv = byRap() ? give.rap : give.usd;
      const share = bv > 0 ? Math.round(Math.abs(dv) / bv * 100) : null;
      const more = { pct: share > 999 ? '999+' : formatNumber(share) };
      const sub = Math.abs(dv) < (byRap() ? 0.5 : 0.005) ? lt('Both sides are worth the same') : share === null || !percentsOn() ? ''
        : dv > 0 ? (byRap() ? lt('You get {pct}% more RAP', more) : lt('You get {pct}% more value', more))
          : (byRap() ? lt('You give {pct}% more RAP', more) : lt('You give {pct}% more value', more));
      if (sub) line.appendChild(el('span', 'text-body-small content-muted text-truncate-end', sub));
      if (showing.value && give.valued + get.valued > 0) {
        const dVal = get.value - give.value;
        const row = el('div', 'flex items-center gap-small routility-calc-valdiff');
        row.appendChild(el('span', 'text-body-small content-muted', lt('Value difference')));
        row.appendChild(valueTag(Math.abs(dVal), { className: 'text-label-medium', sign: dVal > 0 ? '+' : dVal < 0 ? '−' : '', tip: false }));
        row.dataset.rtTip = lt('Only items with a RoUtility value are counted');
        vc.appendChild(row);
      }
    }
    box.appendChild(vc);
    if (settings.calcEven === false) s.root.querySelector('.routility-calc-even')?.remove();
    else renderEven(give, get);
  }

  function renderEven(give, get) {
    let host = s.root.querySelector('.routility-calc-even');
    const both = give.count && get.count;
    const gap = get.usd - give.usd;
    const base = Math.max(give.usd, get.usd);
    if (!both || !s.items.length || !(base > 0) || Math.abs(gap) / base < 0.02 || Math.abs(gap) < 1) {
      host?.remove();
      return;
    }
    const target = Math.abs(gap);
    const side = gap > 0 ? 'give' : 'get';
    const used = new Set([...filled('give'), ...filled('get')].filter(e => e.kind === 'item').map(e => e.id));
    const picks = s.items
      .filter(i => i.usd > 0 && !used.has(i.id) && i.usd >= target * 0.75 && i.usd <= target * 1.25)
      .map(i => [Math.abs(i.usd - target) / target - (i.demand === 'Amazing' || i.demand === 'High' ? 0.05 : 0), i])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 6)
      .map(([, i]) => i);
    if (!picks.length) {
      host?.remove();
      return;
    }
    if (!host) {
      host = el('section', 'routility-calc-even bg-surface-100 radius-large');
      s.root.querySelector('.routility-calc-summary').after(host);
    }
    host.textContent = '';
    const head = el('div', 'flex items-baseline gap-small');
    head.appendChild(el('span', 'text-title-medium content-emphasis', lt('Even it out')));
    head.appendChild(el('span', 'text-body-small content-muted', side === 'give' ? lt('Items worth about {amount} for you give', { amount: usdText(target) }) : lt('Items worth about {amount} for you receive', { amount: usdText(target) })));
    host.appendChild(head);
    const list = el('div', 'routility-calc-even-list');
    for (const item of picks) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-small radius-medium padding-small routility-calc-even-item');
      b.type = 'button';
      b.appendChild(layer());
      const thumb = el('span', 'thumbnail-2d-container routility-calc-even-thumb');
      if (item.thumb) {
        const img = el('img');
        img.alt = '';
        img.src = item.thumb;
        thumb.appendChild(img);
      }
      b.appendChild(thumb);
      const text = el('span', 'flex flex-col min-width-0');
      text.appendChild(el('span', 'text-label-medium content-emphasis text-truncate-end', item.name));
      text.appendChild(el('span', 'text-body-small content-muted text-truncate-end', usdText(item.usd)));
      b.appendChild(text);
      b.dataset.rtTip = addTo(side);
      b.addEventListener('click', () => addEntry(side, fromItem(item)));
      list.appendChild(b);
    }
    host.appendChild(list);
  }

  function summaryText() {
    const line = (side) => {
      const list = filled(side).map(e => (e.kind === 'item' ? `${e.name}${e.serial ? ' #' + e.serial : ''} (${usdText(e.usd)})` : e.kind === 'robux' ? lt('{amount} Robux', { amount: formatNumber(e.amount) }) : `${usdText(e.amount)} ${cash().code}`));
      return lt('{side}: {items}', { side: lt(SIDES[side]), items: list.length ? list.join(', ') : lt('nothing') });
    };
    const give = totals('give');
    const get = totals('get');
    const dUsd = get.usd - give.usd;
    const dRap = get.rap - give.rap;
    const v = verdictFor(give, get);
    return [
      line('give'),
      line('get'),
      lt('Value: {give} vs {get} ({diff})', { give: usdText(give.usd), get: usdText(get.usd), diff: signed(dUsd, usdText) + (give.usd > 0 ? ', ' + pct(dUsd, give.usd) : '') }),
      lt('RAP: {give} vs {get} ({diff})', { give: formatNumber(Math.round(give.rap)), get: formatNumber(Math.round(get.rap)), diff: signed(Math.round(dRap), formatNumber) }),
      lt('Verdict: {verdict}', { verdict: v.text }),
    ].join('\n');
  }

  function setAdding(side) {
    s.adding = side;
    renderSides();
    renderToolbar();
    renderGrid();
  }

  function sortList(list) {
    const [key, dir] = s.sort.split('-');
    const mul = dir === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => {
      if (key === 'name') return a.name.localeCompare(b.name);
      return ((a[key] || 0) - (b[key] || 0)) * mul || a.name.localeCompare(b.name);
    });
  }

  function filtered() {
    const q = s.query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    const source = s.mode === 'player' ? (s.player.items || []) : s.items;
    let list = source.filter(i => {
      if (s.demand.size && !s.demand.has(i.demand || '')) return false;
      if (!words.length) return true;
      const hay = (i.name + ' ' + (i.acr || '') + ' ' + i.id).toLowerCase();
      return words.every(w => hay.includes(w));
    });
    return sortList(list);
  }

  function itemCard(item) {
    const li = el('li', 'list-item item-card routility-calc-card');
    const btn = el('button', 'item-card-container relative clip group/interactable cursor-pointer routility-calc-card-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', s.adding === 'give' ? lt('Add {item} to you give', { item: item.name }) : lt('Add {item} to you receive', { item: item.name }));
    const thumbBox = el('div', 'item-card-thumb-container');
    const thumb = el('span', 'thumbnail-2d-container item-card-thumb');
    if (item.thumb) {
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = item.thumb;
      thumb.appendChild(img);
    }
    thumbBox.appendChild(thumb);
    if (item.rare || item.projected) {
      const tags = el('span', 'routility-calc-tags');
      if (item.projected) {
        const t = badge(lt('Projected'));
        t.classList.add('routility-calc-rare', 'routility-calc-projected');
        t.dataset.rtTip = lt('Its RAP is pushed up by recent sales above its usual price');
        tags.appendChild(t);
      }
      if (item.rare) {
        const t = badge(lt('Rare'));
        t.classList.add('routility-calc-rare');
        tags.appendChild(t);
      }
      thumbBox.appendChild(tags);
    }
    if (item.serial) thumbBox.appendChild(el('span', 'routility-calc-serial text-label-small', '#' + formatNumber(item.serial)));
    btn.appendChild(thumbBox);
    const cap = el('div', 'item-card-caption');
    cap.appendChild(el('div', 'item-card-name text-overflow', item.name));
    const rap = el('div', 'text-overflow item-card-price routility-calc-price');
    rap.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', formatNumber(item.rap || 0)));
    cap.appendChild(rap);
    const usd = el('div', 'text-overflow item-card-price routility-calc-price');
    usd.append(window.RoUtilityUI.usdIcon('routility-logo'), el('span', 'text-robux-tile', item.usd ? usdText(item.usd) : lt('No price')));
    if (!showing.value && itemValue(item)) usd.dataset.rtTip = window.RoUtilityUI.valueTip(item);
    if (showing.value && itemValue(item)) {
      usd.classList.add('routility-card-usd');
      usd.appendChild(valueTag(itemValue(item), { short: true, className: 'routility-card-val text-robux-tile' }));
    }
    cap.appendChild(usd);
    btn.appendChild(cap);
    btn.addEventListener('click', () => {
      if (s.mode === 'player' && item.serial !== undefined) addEntry(s.adding, fromItem(item, item.serial), true);
      else addEntry(s.adding, fromItem(item), true);
    });
    li.appendChild(btn);
    return li;
  }

  function pager(pages) {
    const ul = el('ul', 'pager routility-calc-pager');
    const btn = (side, disabled, delta) => {
      const li = el('li', 'pager-' + side + (disabled ? ' disabled' : ''));
      const b = el('button', 'btn-generic-' + (side === 'prev' ? 'left' : 'right') + '-sm');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', side === 'prev' ? lt('Previous page') : lt('Next page'));
      b.appendChild(el('span', side === 'prev' ? 'icon-left' : 'icon-right'));
      b.addEventListener('click', () => {
        s.page += delta;
        renderGrid();
      });
      li.appendChild(b);
      return li;
    };
    ul.appendChild(btn('prev', s.page === 0, -1));
    const cur = el('li', 'pager-cur');
    cur.appendChild(el('span', null, lt('{page} of {pages}', { page: s.page + 1, pages })));
    ul.appendChild(cur);
    ul.appendChild(btn('next', s.page >= pages - 1, 1));
    return ul;
  }

  function gridCols(host) {
    const w = host.clientWidth || 0;
    return Math.max(1, Math.floor((w + 12) / (140 + 12)));
  }

  function renderGrid() {
    const host = s.browser.querySelector('.routility-calc-results');
    host.textContent = '';
    s.gridCols = gridCols(host);
    if (!s.gridObserver) {
      s.gridObserver = new ResizeObserver(() => {
        if (gridCols(host) !== s.gridCols) renderGrid();
      });
      s.gridObserver.observe(host);
    }
    const perPage = s.gridCols * Math.max(1, Math.round(PER_PAGE / s.gridCols));
    if (s.mode === 'player') {
      const p = s.player;
      if (!p.query) return host.appendChild(el('p', 'text-body-medium content-muted routility-calc-note', lt('Type a username (or paste a user ID) above to see their limiteds.')));
      if (p.loading) return host.appendChild(skeletonGrid());
      if (p.error) return host.appendChild(el('p', 'text-body-medium content-muted routility-calc-note', p.error));
    } else if (!s.items.length) {
      return host.appendChild(s.loadFailed ? el('p', 'text-body-medium content-muted routility-calc-note', lt('Couldn’t load items right now. Try again in a minute.')) : skeletonGrid());
    }
    const list = filtered();
    if (!list.length) return host.appendChild(el('p', 'text-body-medium content-muted routility-calc-note', s.query ? lt('No items match "{query}".', { query: s.query }) : lt('No items match these filters.')));
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    s.page = Math.min(Math.max(0, s.page), pages - 1);
    if (s.mode === 'player' && s.player.name) {
      const head = el('div', 'flex items-baseline gap-small routility-calc-results-head');
      head.appendChild(el('span', 'text-title-large content-emphasis', s.player.name));
      head.appendChild(el('span', 'text-body-medium content-muted', ltn(list.length, '{n} limited', '{n} limiteds', { n: formatNumber(list.length) })));
      host.appendChild(head);
    }
    const grid = el('ul', 'hlist item-cards item-cards-stackable routility-calc-grid');
    for (const item of list.slice(s.page * perPage, s.page * perPage + perPage)) grid.appendChild(itemCard(item));
    host.appendChild(grid);
    if (pages > 1) host.appendChild(pager(pages));
  }

  function skeletonGrid() {
    const grid = el('ul', 'hlist item-cards item-cards-stackable routility-calc-grid');
    for (let i = 0; i < 12; i++) {
      const li = el('li', 'list-item item-card routility-calc-card');
      const box = el('div', 'routility-calc-sk-card');
      box.append(el('span', 'routility-sk routility-calc-sk-thumb'), el('span', 'routility-sk routility-calc-sk-line'), el('span', 'routility-sk routility-calc-sk-line routility-calc-sk-short'));
      li.appendChild(box);
      grid.appendChild(li);
    }
    return grid;
  }

  function chip(label, on, onClick, demand) {
    const look = demand ? (on ? ' stroke-none' : ' stroke-standard stroke-contrast-alpha bg-none') : (on ? ' bg-system-contrast content-inverse-emphasis' : ' stroke-standard stroke-contrast-alpha bg-none content-emphasis');
    const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center radius-circle height-800 padding-x-medium text-label-small routility-calc-chip' + look);
    if (demand) b.dataset.demand = demand;
    b.type = 'button';
    b.setAttribute('aria-pressed', String(on));
    b.appendChild(layer());
    b.appendChild(el('span', null, label));
    b.addEventListener('click', onClick);
    return b;
  }

  function menuSelect(options, value, onPick) {
    const wrap = el('div', 'relative');
    const btn = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-small stroke-standard stroke-contrast-alpha bg-none height-800 radius-medium padding-x-medium content-emphasis text-label-small routility-calc-select');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.appendChild(layer());
    btn.appendChild(el('span', null, lt(options.find(o => o[0] === value)[1])));
    btn.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-chevron size-400 content-emphasis'));
    btn.addEventListener('click', () => {
      closeMenu();
      const pop = el('div', 'routility-injected routility-calc-pop');
      const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small');
      menu.setAttribute('role', 'menu');
      for (const [v, label] of options) {
        const item = el('button', 'relative clip group/interactable foundation-web-menu-item flex items-center content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small gap-x-medium radius-medium');
        item.type = 'button';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(v === value));
        item.appendChild(layer());
        item.appendChild(el('span', 'grow-1 content-emphasis', lt(label)));
        item.addEventListener('click', () => { closeMenu(); onPick(v); });
        menu.appendChild(item);
      }
      pop.appendChild(menu);
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      pop.style.left = Math.round(r.left) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
      s.menu = pop;
      s.onOutside = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
      document.addEventListener('mousedown', s.onOutside, true);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function closeMenu() {
    if (!s || !s.menu) return;
    s.menu.remove();
    s.menu = null;
    document.removeEventListener('mousedown', s.onOutside, true);
  }

  function renderOptions() {
    const box = s.browser.querySelector('.routility-calc-options');
    box.hidden = !s.showOptions;
    box.textContent = '';
    if (!s.showOptions) return;
    const row1 = el('div', 'flex items-center flex-wrap gap-medium');
    const group = (label, node) => {
      const g = el('div', 'flex items-center gap-small');
      g.appendChild(el('span', 'text-label-small content-muted', label));
      g.appendChild(node);
      return g;
    };
    row1.appendChild(group(lt('Sort'), menuSelect(SORTS, s.sort, (v) => { s.sort = v; s.page = 0; renderOptions(); renderGrid(); })));
    box.appendChild(row1);
    const row2 = el('div', 'flex items-center flex-wrap gap-small');
    row2.appendChild(el('span', 'text-label-small content-muted', lt('Demand')));
    for (const d of DEMANDS) {
      row2.appendChild(chip(lt(d), s.demand.has(d), () => {
        if (s.demand.has(d)) s.demand.delete(d);
        else s.demand.add(d);
        s.page = 0;
        renderOptions();
        renderGrid();
      }, d));
    }
    box.appendChild(row2);
  }

  function renderToolbar() {
    const bar = s.browser.querySelector('.routility-calc-toolbar');
    bar.textContent = '';
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-emphasis');
    const field = finput(s.mode === 'player' ? lt('Roblox username or user ID') : lt('Search items by name'), { lead: glass, extra: 'routility-calc-search' });
    field.input.value = s.mode === 'player' ? s.player.query : s.query;
    let timer = null;
    let token = 0;
    field.input.addEventListener('input', () => {
      clearTimeout(timer);
      const v = field.input.value;
      if (s.mode === 'player') {
        const q = v.trim();
        const mine = ++token;
        if (q.length < 2 || /^\d+$/.test(q)) return closeSuggest();
        timer = setTimeout(async () => {
          const list = await findPlayers(q);
          if (mine !== token || s.mode !== 'player' || document.activeElement !== field.input) return;
          showSuggest(field, list);
        }, 200);
        return;
      }
      timer = setTimeout(() => { s.query = v; s.page = 0; renderGrid(); }, 120);
    });
    field.input.addEventListener('blur', () => setTimeout(closeSuggest, 120));
    field.input.addEventListener('keydown', (e) => {
      const sg = s.suggest;
      if (s.mode === 'player' && sg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        sg.active = (sg.active + (e.key === 'ArrowDown' ? 1 : -1) + sg.list.length + 1) % (sg.list.length + 1);
        if (sg.active === sg.list.length) sg.active = -1;
        paintSuggest();
        return;
      }
      if (e.key === 'Enter' && s.mode === 'player') {
        token++;
        if (sg && sg.active >= 0) return pickPlayer(sg.list[sg.active], field.input);
        const exact = sg && sg.list.find(u => u.name.toLowerCase() === field.input.value.trim().toLowerCase());
        if (exact) return pickPlayer(exact, field.input);
        closeSuggest();
        loadPlayer(field.input.value.trim());
      }
      if (e.key === 'Escape') {
        if (sg) { closeSuggest(); return; }
        if (field.input.value) {
          field.input.value = '';
          if (s.mode !== 'player') { s.query = ''; s.page = 0; renderGrid(); }
        }
      }
    });
    const wrap = el('div', 'relative routility-calc-search-wrap');
    wrap.appendChild(field);
    bar.appendChild(wrap);
    const seg = el('div', 'flex items-center shrink-0 radius-medium stroke-standard stroke-contrast-alpha routility-calc-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', lt('Add items to'));
    for (const side of ['give', 'get']) {
      const on = s.adding === side;
      const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center radius-small padding-x-medium text-label-medium routility-calc-seg-btn' + (on ? ' bg-system-contrast content-inverse-emphasis' : ' bg-none content-emphasis'));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on));
      b.appendChild(layer());
      b.appendChild(el('span', null, lt(SIDES[side])));
      b.addEventListener('click', () => setAdding(side));
      seg.appendChild(b);
    }
    bar.appendChild(seg);
    if (s.mode === 'player') bar.appendChild(fbutton(lt('Search'), 'bg-action-emphasis content-action-emphasis', () => { closeSuggest(); loadPlayer(field.input.value.trim()); }, 'shrink-0'));
    const meta = document.querySelector('meta[name="user-data"]');
    if (s.mode === 'player' && meta?.dataset.userid) bar.appendChild(fbutton(lt('My inventory'), 'bg-action-standard content-action-standard', () => {
      closeSuggest();
      field.input.value = meta.dataset.name || '';
      loadPlayer(meta.dataset.userid, meta.dataset.name || lt('You'));
    }, 'shrink-0'));
    bar.appendChild(fbutton(s.mode === 'player' ? lt('Catalog') : lt('Player'), 'bg-action-standard content-action-standard', () => {
      closeSuggest();
      s.mode = s.mode === 'player' ? 'catalog' : 'player';
      s.page = 0;
      renderToolbar();
      renderGrid();
      s.browser.querySelector('.routility-calc-search input')?.focus({ preventScroll: true });
    }, 'shrink-0'));
    const opt = fbutton(lt('Options'), s.showOptions ? 'bg-system-contrast content-inverse-emphasis' : 'bg-action-standard content-action-standard', () => {
      s.showOptions = !s.showOptions;
      renderToolbar();
      renderOptions();
    }, 'shrink-0');
    opt.setAttribute('aria-expanded', String(!!s.showOptions));
    bar.appendChild(opt);
  }

  async function json(url, opts) {
    try {
      const res = await fetch(url, { credentials: 'include', ...opts });
      return { status: res.status, body: res.ok ? await res.json() : null };
    } catch {
      return { status: 0, body: null };
    }
  }

  const suggestCache = new Map();

  async function findPlayers(query) {
    const key = query.toLowerCase();
    if (suggestCache.has(key)) return suggestCache.get(key);
    const job = (async () => {
      const sid = crypto.randomUUID();
      const [people, friends] = await Promise.all([
        json(`https://apis.roblox.com/search-api/omni-search?verticalType=user&searchQuery=${encodeURIComponent(query)}&pageToken=&globalSessionId=${sid}&sessionId=${sid}`),
        window.RoUtilitySearch && window.RoUtilitySearch.myFriends ? window.RoUtilitySearch.myFriends().catch(() => []) : [],
      ]);
      const friendIds = new Set((friends || []).map(f => String(f.id)));
      const q = key;
      const fromSearch = (((people.body && people.body.searchResults) || []).find(g => g.contentGroupType === 'User')?.contents || [])
        .filter(u => u.contentId > 0)
        .map(u => ({ id: String(u.contentId), name: u.username, displayName: u.displayName, verified: !!u.hasVerifiedBadge }));
      const fromFriends = (friends || []).filter(f => (f.name || '').toLowerCase().includes(q) || (f.displayName || '').toLowerCase().includes(q))
        .map(f => ({ id: String(f.id), name: f.name, displayName: f.displayName || f.name, verified: !!f.hasVerifiedBadge }));
      const score = (u) => {
        const n = (u.name || '').toLowerCase();
        const d = (u.displayName || '').toLowerCase();
        if (n === q) return 0;
        if (friendIds.has(u.id) && (n.startsWith(q) || d.startsWith(q))) return 1;
        if (n.startsWith(q)) return 2;
        if (friendIds.has(u.id)) return 3;
        return 4;
      };
      const seen = new Set();
      const all = [...fromSearch, ...fromFriends].filter(u => !seen.has(u.id) && seen.add(u.id));
      const list = all.map((u, i) => [score(u), i, u]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 6).map(([, , u]) => ({ ...u, friend: friendIds.has(u.id) }));
      const heads = list.length ? (await request({ type: 'getHeadshots', ids: list.map(u => u.id) })) || {} : {};
      for (const u of list) u.head = heads[u.id] || '';
      return list;
    })();
    suggestCache.set(key, job);
    job.then(r => { if (!r.length) suggestCache.delete(key); });
    return job;
  }

  function closeSuggest() {
    if (!s || !s.suggest) return;
    s.suggest.box.remove();
    s.suggest = null;
  }

  function pickPlayer(u, input) {
    closeSuggest();
    input.value = u.name;
    loadPlayer(u.id, u.name);
  }

  function paintSuggest() {
    const sg = s.suggest;
    if (!sg) return;
    sg.box.querySelectorAll('.routility-calc-sugg-row').forEach((row, i) => row.classList.toggle('routility-calc-sugg-active', i === sg.active));
  }

  function showSuggest(field, list) {
    closeSuggest();
    if (!list.length) return;
    const box = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small routility-calc-sugg');
    box.setAttribute('role', 'listbox');
    list.forEach((u, i) => {
      const row = el('button', 'relative clip group/interactable flex items-center gap-medium width-full cursor-pointer stroke-none bg-none text-align-x-left padding-x-medium padding-y-small radius-medium routility-calc-sugg-row');
      row.type = 'button';
      row.setAttribute('role', 'option');
      row.appendChild(layer());
      const face = el('span', 'thumbnail-2d-container radius-circle routility-calc-sugg-face');
      if (u.head) {
        const img = el('img');
        img.alt = '';
        img.src = u.head;
        face.appendChild(img);
      }
      row.appendChild(face);
      const names = el('span', 'flex flex-col min-width-0 grow-1');
      const top = el('span', 'flex items-center gap-xsmall min-width-0');
      top.appendChild(el('span', 'text-title-medium content-emphasis text-truncate-end', u.displayName || u.name));
      if (u.verified) top.appendChild(window.RoUtilityUI.verifiedBadge());
      names.appendChild(top);
      names.appendChild(el('span', 'text-body-small content-muted text-truncate-end', '@' + u.name + (u.friend ? ' • ' + lt('Friend') : '')));
      row.appendChild(names);
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => pickPlayer(u, field.input));
      row.addEventListener('mouseenter', () => { if (s.suggest) { s.suggest.active = i; paintSuggest(); } });
      box.appendChild(row);
    });
    field.after(box);
    s.suggest = { box, list, active: -1 };
  }

  async function loadPlayer(text, knownName) {
    if (!text) return;
    const p = { query: text, loading: true, items: null, error: '', name: '' };
    s.player = p;
    s.page = 0;
    renderGrid();
    let id = /^\d+$/.test(text) ? text : null;
    let name = knownName || text;
    if (!id) {
      const r = await json('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernames: [text], excludeBannedUsers: false }) });
      const u = r.body && r.body.data && r.body.data[0];
      if (!u) {
        if (s.player === p) Object.assign(p, { loading: false, error: lt('No player named "{name}".', { name: text }) });
        return renderGrid();
      }
      id = String(u.id);
      name = u.name;
    } else if (!knownName) {
      const r = await json(`https://users.roblox.com/v1/users/${id}`);
      if (r.body && r.body.name) name = r.body.name;
    }
    const out = [];
    const inv = await window.RoUtilityUI.collectibles(id, { pages: 20 });
    if (s.player !== p) return;
    if (inv.status === 'private') {
      Object.assign(p, { loading: false, error: lt('{name}’s inventory is private.', { name }) });
      return renderGrid();
    }
    if (inv.status !== 'ok') {
      Object.assign(p, { loading: false, error: lt('Couldn’t load that inventory right now. Try again in a minute.') });
      return renderGrid();
    }
    const lookup = window.RoUtilityUI.catalogFor(s.items);
    for (const a of inv.items) {
      const item = lookup(a);
      out.push({
        id: item ? String(item.id) : a.id,
        name: (item && item.name) || a.name || '',
        usd: item ? item.usd || 0 : 0,
        rap: item ? item.rap || 0 : a.rap || 0,
        value: itemValue(item),
        demand: item ? item.demand || '' : '',
        trend: item ? item.trend || '' : '',
        rare: !!(item && item.rare),
        thumb: item ? item.thumb || '' : '',
        serial: a.serial || null,
      });
    }
    const missing = out.filter(i => !i.thumb).map(i => i.id);
    const maps = await Promise.all(chunks(missing, 100).map(part => request({ type: 'getAssetThumbs', ids: part, size: '420x420' })));
    for (const map of maps) for (const it of out) if (!it.thumb && map && map[it.id]) it.thumb = map[it.id];
    if (s.player !== p) return;
    Object.assign(p, { loading: false, items: out, name, error: out.length ? '' : lt('{name} has no limiteds.', { name }) });
    renderGrid();
  }

  function encodeSide(side) {
    return filled(side).map(e => (e.kind === 'item' ? 'i' + e.id + (e.serial ? '.' + e.serial : '') : (e.kind === 'robux' ? 'r' : 'u') + e.amount)).join(',');
  }

  function writeHash() {
    const parts = [];
    for (const side of ['give', 'get']) {
      const v = encodeSide(side);
      if (v) parts.push(`${side}=${v}`);
      if (s.sides[side].slots !== 4) parts.push(`${side}Slots=${s.sides[side].slots}`);
    }
    const hash = parts.length ? '#' + parts.join('&') : '';
    try {
      if (settings.calcRemember === false) localStorage.removeItem(LAST_KEY);
      else localStorage.setItem(LAST_KEY, hash);
    } catch {}
  }

  function cleanUrl() {
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  }

  function readHash(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    for (const side of ['give', 'get']) {
      const slots = Number(params.get(side + 'Slots'));
      const entries = [];
      for (const tok of (params.get(side) || '').split(',').filter(Boolean)) {
        const kind = tok[0];
        const rest = tok.slice(1);
        if (kind === 'i') {
          const [id, serial] = rest.split('.');
          const item = catalogItem(id);
          if (item) entries.push(fromItem(item, serial ? Number(serial) : null));
        } else if (kind === 'r' && Number(rest) > 0) entries.push({ kind: 'robux', amount: Math.floor(Number(rest)) });
        else if (kind === 'u' && Number(rest) > 0) entries.push({ kind: 'usd', amount: Math.round(Number(rest) * 100) / 100 });
      }
      s.selected = null;
      s.sides[side].entries = entries.slice(0, MAX_SLOTS);
      s.sides[side].slots = Math.min(MAX_SLOTS, Math.max(startSlots(), entries.length, Number.isFinite(slots) && slots > 0 ? slots : 4));
    }
  }

  function flash(btn, text) {
    const old = btn.dataset.label || btn.label.textContent;
    btn.dataset.label = old;
    btn.label.textContent = text;
    clearTimeout(btn.flashTimer);
    btn.flashTimer = setTimeout(() => { btn.label.textContent = old; }, 1600);
  }

  async function loadImage(url) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      return await createImageBitmap(await res.blob());
    } catch {
      return null;
    }
  }

  function themeColor(cls, prop, fallback) {
    const probe = el('span', cls);
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;';
    (s.root || document.body).appendChild(probe);
    const v = getComputedStyle(probe)[prop];
    probe.remove();
    return v && v !== 'rgba(0, 0, 0, 0)' ? v : fallback;
  }

  function withAlpha(color, a) {
    const m = String(color).match(/[\d.]+/g);
    return m ? `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})` : color;
  }

  async function renderShot() {
    const T = {
      bg: themeColor('bg-surface-0', 'backgroundColor', '#121215'),
      panel: themeColor('bg-surface-100', 'backgroundColor', '#191a1f'),
      tile: themeColor('bg-surface-200', 'backgroundColor', '#202227'),
      stroke: themeColor('stroke-default stroke-standard', 'borderTopColor', 'rgba(208, 217, 251, 0.12)'),
      line: themeColor('stroke-muted stroke-standard', 'borderTopColor', 'rgba(208, 217, 251, 0.08)'),
      text: themeColor('content-emphasis', 'color', '#f7f7f8'),
      body: themeColor('content-default', 'color', '#d5d7dd'),
      muted: themeColor('content-muted', 'color', '#bcbec8'),
      green: themeColor('content-system-success', 'color', '#39c582'),
      red: themeColor('content-system-alert', 'color', '#df281f'),
      blue: themeColor('content-link', 'color', '#335fff'),
    };
    const font = getComputedStyle(s.root).fontFamily || 'sans-serif';
    try { await document.fonts.ready; } catch {}
    const give = filled('give');
    const get = filled('get');
    const rows = Math.max(Math.ceil(Math.max(give.length, 1) / 4), Math.ceil(Math.max(get.length, 1) / 4));
    const f = 38 + (rows * 78 - 6) + 12 + 66 + 16;
    const H = 104 + f + 16 + 72 + 20 + 32 + 32;
    const W = 800;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createLinearGradient(0, 0, 0, 200);
    glow.addColorStop(0, withAlpha(T.blue, 0.05));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 200);
    ctx.fillStyle = withAlpha(T.text, 0.02);
    for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const type = (t, x, y, size, color, weight = 400, align = 'left') => {
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(t, x, y);
      ctx.textAlign = 'left';
      return ctx.measureText(t).width;
    };
    const measure = (t, size, weight) => {
      ctx.font = `${weight} ${size}px ${font}`;
      return ctx.measureText(t).width;
    };
    const box = (x, y, w, h, r, fill, stroke) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    const dollar = (x, y, size, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 24, size / 24);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2.1;
      ctx.stroke(new Path2D('M15.2 8.6c-.6-1-1.8-1.6-3.2-1.6-1.8 0-3.1.9-3.1 2.3 0 3.3 6.3 1.8 6.3 5 0 1.4-1.4 2.4-3.2 2.4-1.5 0-2.7-.6-3.3-1.7M12 5v14'));
      ctx.restore();
    };
    const robux = (x, y, size, color) => {
      const c = size / 2;
      const r = size * 0.46;
      ctx.save();
      ctx.translate(x + c, y + c);
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.12;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 2;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      const q = size * 0.17;
      ctx.beginPath();
      ctx.roundRect(-q, -q, q * 2, q * 2, size * 0.05);
      ctx.stroke();
      ctx.restore();
    };
    const fit = (t, max, size, weight) => {
      if (measure(t, size, weight) <= max) return t;
      let out = t;
      while (out.length > 1 && measure(out + '…', size, weight) > max) out = out.slice(0, -1);
      return out.trimEnd() + '…';
    };
    const logo = await loadImage(LOGO);
    const thumbs = new Map();
    await Promise.all([...give, ...get].filter(e => e.kind === 'item' && e.thumb && !thumbs.has(e.thumb)).map(async e => {
      thumbs.set(e.thumb, null);
      thumbs.set(e.thumb, await loadImage(e.thumb));
    }));
    let y = 32;
    if (logo) ctx.drawImage(logo, 32, y + 4, 28, 28);
    type(lt('Trade Calculator'), logo ? 68 : 32, y + 25, 20, T.text, 800);
    type(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - 32, y + 25, 11, T.muted, 500, 'right');
    y += 56;
    ctx.fillStyle = T.line;
    ctx.fillRect(32, y, W - 64, 1);
    y += 16;
    const panel = (x, label, accent, list, t) => {
      box(x, y, 360, f, 12, T.panel, withAlpha(accent, 0.22));
      const tint = ctx.createLinearGradient(x, y, x, y + 60);
      tint.addColorStop(0, withAlpha(accent, 0.06));
      tint.addColorStop(1, 'transparent');
      box(x, y, 360, 60, 12, tint);
      type(label.toUpperCase(), x + 14, y + 21, 10, accent, 800);
      type(ltn(list.length, '{n} item', '{n} items'), x + 346, y + 21, 9, T.muted, 500, 'right');
      for (let i = 0; i < Math.max(list.length, 4); i++) {
        const tx = x + 14 + (i % 4) * 78;
        const ty = y + 38 + Math.floor(i / 4) * 78;
        box(tx, ty, 72, 72, 8, T.tile, T.line);
        const e = list[i];
        if (!e) continue;
        if (e.kind === 'item') {
          const img = thumbs.get(e.thumb);
          if (img) {
            ctx.save();
            box(tx + 4, ty + 4, 64, 64, 6);
            ctx.clip();
            ctx.drawImage(img, tx + 4, ty + 4, 64, 64);
            ctx.restore();
          }
          if (e.serial) {
            const tag = '#' + formatNumber(e.serial);
            const w = measure(tag, 7, 700) + 8;
            box(tx + 4, ty + 4, w, 12, 4, withAlpha(T.bg, 0.8));
            type(tag, tx + 8, ty + 12.5, 7, T.text, 700);
          }
          type(fit(e.name, 70, 7.5, 600), tx + 36, ty + 72 + 10, 7.5, T.body, 600, 'center');
        } else if (e.kind === 'robux') {
          robux(tx + 27, ty + 18, 18, T.text);
          type(formatNumber(e.amount), tx + 36, ty + 54, 9, T.text, 700, 'center');
        } else {
          type(cash().symbol, tx + 36, ty + 32, 16, T.green, 800, 'center');
          type(usdText(e.amount), tx + 36, ty + 48, 9, T.green, 700, 'center');
        }
      }
      const m = y + f - 66 - 4;
      ctx.fillStyle = T.line;
      ctx.fillRect(x + 14, m - 4, 332, 1);
      type(lt('Total RAP'), x + 14, m + 16, 10, T.muted, 400);
      const rapText = formatNumber(Math.round(t.rap));
      const rw = type(rapText, x + 346, m + 16, 10, T.text, 700, 'right');
      robux(x + 346 - rw - 15, m + 7, 11, T.text);
      type(lt('Price Est.'), x + 14, m + 34, 10, T.muted, 400);
      const pw = type(usdText(t.usd), x + 346, m + 34, 10, T.text, 700, 'right');
      dollar(x + 346 - pw - 15, m + 25, 11, '#3fc679');
    };
    const tg = totals('give');
    const tr = totals('get');
    panel(32, lt(SIDES.give), T.blue, give, tg);
    panel(408, lt(SIDES.get), T.green, get, tr);
    ctx.save();
    ctx.translate(394, y + f / 2 - 8);
    ctx.strokeStyle = withAlpha(T.text, 0.2);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(1, 5); ctx.lineTo(11, 5); ctx.moveTo(8.5, 2.5); ctx.lineTo(11, 5); ctx.lineTo(8.5, 7.5);
    ctx.moveTo(11, 11); ctx.lineTo(1, 11); ctx.moveTo(3.5, 8.5); ctx.lineTo(1, 11); ctx.lineTo(3.5, 13.5);
    ctx.stroke();
    ctx.restore();
    y += f + 16;
    const v = verdictFor(tg, tr);
    const toneColor = v.tone === 'content-system-success' ? T.green : v.tone === 'content-system-alert' ? T.red : null;
    box(32, y, 736, 72, 12, T.panel, toneColor ? withAlpha(toneColor, 0.25) : T.line);
    if (toneColor) box(32, y, 736, 72, 12, withAlpha(toneColor, 0.04));
    const both = tg.count && tr.count;
    const dRap = Math.round(tr.rap - tg.rap);
    const dUsd = tr.usd - tg.usd;
    const tone = (d) => (!both ? withAlpha(T.text, 0.35) : d > 0 ? T.green : d < 0 ? T.red : T.muted);
    const cells = [
      [lt('RAP Diff.'), both ? signed(dRap, formatNumber) : '—', tone(dRap), both],
      [lt('Price Diff.'), both ? signed(dUsd, usdText) : '—', tone(dUsd), false],
      [lt('Verdict'), v.text, toneColor || T.muted, false],
    ];
    cells.forEach(([label, value, color, icon], i) => {
      const x = 32 + (736 / 3) * i + 16;
      type(label.toUpperCase(), x, y + 25, 9, T.muted, 400);
      if (icon) {
        robux(x, y + 37, 14, color);
        type(value, x + 19, y + 49, 15, color, 800);
      } else type(value, x, y + 49, 15, color, 800);
    });
    y += 92;
    if (logo) {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(logo, 32, y - 8, 16, 16);
      ctx.globalAlpha = 1;
    }
    type('RoUtility', 32 + (logo ? 21 : 0), y + 4, 11, withAlpha(T.text, 0.18), 700);
    type(new Date().toLocaleString(), W - 32, y + 4, 9, withAlpha(T.text, 0.14), 400, 'right');
    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }

  function closeShot() {
    const open = document.querySelector('.routility-shot-backdrop');
    if (!open) return;
    URL.revokeObjectURL(open.dataset.url || '');
    open.remove();
    document.removeEventListener('keydown', onShotKey, true);
  }

  function onShotKey(e) {
    if (e.key === 'Escape') closeShot();
  }

  function shotModal(blob) {
    closeShot();
    const url = URL.createObjectURL(blob);
    const backdrop = el('div', 'routility-injected routility-shot-backdrop');
    backdrop.dataset.url = url;
    const dialog = el('div', 'routility-shot-dialog bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high padding-large flex flex-col gap-medium');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', lt('Trade Screenshot'));
    const head = el('div', 'flex items-center justify-between gap-medium');
    const title = el('h2', 'text-heading-small content-emphasis margin-none flex items-center gap-small');
    title.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-camera size-500'));
    title.appendChild(document.createTextNode(lt('Trade Screenshot')));
    head.appendChild(title);
    head.appendChild(iconButton('close', lt('Close'), closeShot));
    dialog.appendChild(head);
    const img = el('img', 'routility-shot-preview radius-medium stroke-muted stroke-standard');
    img.src = url;
    img.alt = lt('Trade screenshot');
    dialog.appendChild(img);
    const actions = el('div', 'flex items-center gap-small');
    const download = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `routility-trade-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    const copy = fbutton(lt('Copy to Clipboard'), 'bg-action-emphasis content-action-emphasis', async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copy.label.textContent = lt('Copied!');
        copy.querySelector('.routility-calc-icon').classList.replace('routility-calc-icon-copy', 'routility-calc-icon-check');
        clearTimeout(copy.flashTimer);
        copy.flashTimer = setTimeout(() => {
          copy.label.textContent = lt('Copy to Clipboard');
          copy.querySelector('.routility-calc-icon')?.classList.replace('routility-calc-icon-check', 'routility-calc-icon-copy');
        }, 2000);
      } catch {
        download();
      }
    }, 'grow-1', 'copy');
    actions.appendChild(copy);
    actions.appendChild(fbutton(lt('Download'), 'bg-action-standard content-action-standard', download, 'grow-1', 'download'));
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeShot(); });
    document.addEventListener('keydown', onShotKey, true);
    document.body.appendChild(backdrop);
  }

  async function screenshot(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    const old = btn.label.textContent;
    btn.label.textContent = lt('Capturing…');
    let blob = null;
    try { blob = await renderShot(); } catch {}
    btn.disabled = false;
    btn.label.textContent = old;
    if (!blob) return flash(btn, lt('Couldn’t capture'));
    if (settings.calcShot === 'copy') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return flash(btn, lt('Image copied'));
      } catch {
        return shotModal(blob);
      }
    }
    shotModal(blob);
  }

  function build() {
    const root = el('div', 'routility-injected routility-calc');
    const head = el('div', 'flex items-center justify-between flex-wrap gap-medium routility-calc-head');
    const title = el('h1', 'text-heading-large content-emphasis margin-none flex items-center gap-small', lt('Trade Calculator'));
    head.appendChild(title);
    const actions = el('div', 'flex items-center gap-small');
    actions.appendChild(fbutton(lt('Clear All'), 'bg-action-standard content-action-standard', () => {
      for (const side of ['give', 'get']) s.sides[side] = { slots: startSlots(), entries: [] };
      s.selected = null;
      changed();
    }, '', 'trash'));
    const copyBtn = fbutton(lt('Copy text'), 'bg-action-standard content-action-standard', async () => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(summaryText());
        ok = true;
      } catch {}
      flash(copyBtn, ok ? lt('Copied') : lt('Couldn’t copy'));
    }, '', 'copy');
    actions.appendChild(copyBtn);
    const shotBtn = fbutton(lt('Screenshot'), 'bg-action-standard content-action-standard', () => screenshot(shotBtn), '', 'camera');
    actions.appendChild(shotBtn);
    head.appendChild(actions);
    root.appendChild(head);
    const sides = el('div', 'routility-calc-sides');
    sides.appendChild(sidePanel('give'));
    const swap = iconButton('swap', lt('Swap sides'), () => {
      const g = s.sides.give;
      s.sides.give = s.sides.get;
      s.sides.get = g;
      s.selected = null;
      changed();
    }, 'routility-calc-swap');
    sides.appendChild(swap);
    sides.appendChild(sidePanel('get'));
    root.appendChild(sides);
    root.appendChild(el('div', 'routility-calc-summary bg-surface-100 radius-large'));
    const browser = el('section', 'routility-calc-browser bg-surface-100 radius-large');
    browser.appendChild(el('div', 'flex items-center gap-small routility-calc-toolbar'));
    const opts = el('div', 'flex flex-col gap-medium routility-calc-options');
    opts.hidden = true;
    browser.appendChild(opts);
    browser.appendChild(el('div', 'routility-calc-results'));
    root.appendChild(browser);
    return root;
  }

  async function setup() {
    if (!PATH.test(location.pathname)) return;
    if (s) return;
    const content = document.querySelector('#content');
    if (!content) return;
    s = { items: [], byId: new Map(), sides: { give: { slots: startSlots(), entries: [] }, get: { slots: startSlots(), entries: [] } }, adding: 'give', selected: null, mode: 'catalog', query: '', sort: SORTS.some(x => x[0] === settings.calcSort) ? settings.calcSort : 'usd-desc', demand: new Set(), page: 0, player: { query: '' }, showOptions: false, loadFailed: false };
    pageTitle(lt('Trade Calculator - Roblox'));
    s.root = build();
    s.browser = s.root.querySelector('.routility-calc-browser');
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-calc-ready');
    renderToolbar();
    renderOptions();
    renderSides();
    renderSummary();
    renderGrid();
    const items = await request({ type: 'calcItems' }, r => Array.isArray(r));
    if (!s) return;
    if (!items || !items.length) {
      s.loadFailed = true;
      return renderGrid();
    }
    s.items = items;
    s.byId = new Map(items.map(i => [String(i.id), i]));
    const incoming = location.hash;
    let last = '';
    try { if (settings.calcRemember !== false) last = localStorage.getItem(LAST_KEY) || ''; } catch {}
    readHash(HAS_TRADE.test(incoming) ? incoming : last);
    cleanUrl();
    writeHash();
    const player = new URLSearchParams(incoming.replace(/^#/, '')).get('player');
    if (player && /^\d+$/.test(player)) {
      s.mode = 'player';
      s.player = { query: player };
      renderToolbar();
      loadPlayer(player);
    }
    renderSides();
    renderSummary();
    renderGrid();
    window.addEventListener('hashchange', () => {
      if (!s || !s.items.length) return;
      const incoming = location.hash;
      if (!incoming) return;
      cleanUrl();
      if (HAS_TRADE.test(incoming)) {
        readHash(incoming);
        writeHash();
        renderSides();
        renderSummary();
      }
      const player = new URLSearchParams(incoming.replace(/^#/, '')).get('player');
      if (player && /^\d+$/.test(player)) {
        s.mode = 'player';
        s.player = { query: player };
        renderToolbar();
        loadPlayer(player);
      }
    });
  }


  function ensureNav() {
    if (settings.tradeCalculator === false || settings.calcNav === false) {
      document.querySelectorAll('.routility-calc-nav').forEach(n => n.remove());
      return;
    }
    const trade = document.querySelector('.left-nav nav a[href$="/trades"]') || [...document.querySelectorAll('nav a[href$="/trades"]')].find(a => /Trade/.test(a.textContent));
    if (!trade) return;
    const li = trade.closest('li');
    if (!li || !li.parentElement) return;
    let mine = li.parentElement.querySelector(':scope > .routility-calc-nav');
    const here = PATH.test(location.pathname);
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-calc-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/trades/calculator';
      a.querySelectorAll('.foundation-web-badge').forEach(b => (b.closest('span.fill') || b).remove());
      const icon = a.querySelector('.icon');
      if (icon) {
        icon.className = 'grow-0 shrink-0 basis-auto icon routility-calc-nav-icon size-[var(--icon-size-large)]';
      }
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => sp.textContent.trim() === 'Trade');
      if (label) label.textContent = lt('Trade Calculator');
    }
    if (li.nextElementSibling !== mine) li.after(mine);
    const a = mine.querySelector('a');
    a.classList.toggle('bg-shift-200', here);
    if (here) trade.classList.remove('bg-shift-200');
  }

  let navObserver = null;

  function startNav() {
    if (navObserver || settings.tradeCalculator === false) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    ensureNav();
    if (settings.tradeCalculator === false) return;
    startNav();
    if (s && s.root && s.root.isConnected && s.items.length) {
      renderSides();
      renderSummary();
      writeHash();
    }
  });

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    if (settings.tradeCalculator === false) return;
    startNav();
    setup();
  });

  window.RoUtilityCalc = { setup };
})();
