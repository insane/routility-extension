(function () {
  'use strict';

  const { el, formatNumber } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const KEY = 'routilityPriceWar';
  const MODES = [['off', LT('Off')], ['under', LT('Undercut')], ['match', LT('Match cheapest')]];
  let st = null;

  const getWars = () => new Promise(r => chrome.storage.local.get(KEY, s => r(s[KEY] || {})));
  const setWars = (all) => new Promise(r => chrome.storage.local.set({ [KEY]: all }, r));
  const me = () => String(document.querySelector('meta[name="user-data"]')?.dataset.userid || '');

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  function itemName() {
    return document.querySelector('.item-details-info-header h1, #item-container h1, .item-name-container h1')?.textContent.trim() || '';
  }

  function takeHome(price, p) {
    return price - Math.max(p.minFee, Math.floor(price * p.fee / 100));
  }

  function ago(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return lt('just now');
    if (mins < 60) return lt('{n}m ago', { n: mins });
    return lt('{n}h ago', { n: Math.round(mins / 60) });
  }

  function statusText(w) {
    const l = w && w.last;
    if (!l) return w && w.mode !== 'off' ? lt('Checks every 5 minutes while Chrome is open.') : '';
    const when = ago(Date.now() - l.at);
    if (l.kind === 'lowered') return lt('{when}: lowered from R$ {from} to R$ {price}, someone listed at R$ {next}.', { when, from: formatNumber(l.from), price: formatNumber(l.price), next: formatNumber(l.next) });
    if (l.kind === 'cheapest') return lt('{when}: yours is already the cheapest at R$ {price}.', { when, price: formatNumber(l.price) });
    if (l.kind === 'floor') return lt('{when}: someone listed at R$ {next}, but that’s under your lowest price, so it stayed at R$ {price}.', { when, next: formatNumber(l.next), price: formatNumber(l.price) });
    if (l.kind === 'alone') return lt('{when}: no one else is selling, so it stayed at R$ {price}.', { when, price: formatNumber(l.price) });
    if (l.kind === 'verify') return lt('Paused: Roblox asked you to verify. Change the price once yourself, then turn Price War back on.');
    return lt('{when}: couldn’t change the price. It tries again in 5 minutes.', { when });
  }

  async function load(s) {
    if (!s.cid) {
      const cat = await getJson(`https://catalog.roblox.com/v1/catalog/items/${s.itemId}/details?itemType=Asset`);
      s.cid = cat && cat.collectibleItemId ? cat.collectibleItemId : '';
      s.limited = !!(cat && (cat.itemRestrictions || []).some(r => /^(Limited|LimitedUnique|Collectible)$/.test(r)));
    }
    if (!s.cid || !s.limited || !me()) return null;
    const [mine, sellers, params] = await Promise.all([
      getJson(`https://apis.roblox.com/marketplace-sales/v1/item/${s.cid}/resellable-instances?ownerType=User&ownerId=${me()}&limit=500`),
      getJson(`https://apis.roblox.com/marketplace-sales/v1/item/${s.cid}/resellers?limit=30`),
      getJson(`https://apis.roblox.com/marketplace-sales/v1/item/${s.cid}/get-resale-parameters`),
    ]);
    if (!mine) return null;
    const copies = (mine.itemInstances || []).filter(i => i && !i.isHeld);
    const others = ((sellers && sellers.data) || []).filter(x => String(x.seller && x.seller.sellerId) !== me()).map(x => Number(x.price)).filter(n => n > 0).sort((a, b) => a - b);
    const p = { fee: Number.isFinite(Number(params && params.resalePercentageFee)) ? Number(params.resalePercentageFee) : 30, minFee: Number(params && params.minimumFee) || 1, floor: Number(params && params.priceFloor) || 0 };
    return { copies, onSale: copies.filter(i => i.saleState === 'OnSale'), cheapest: others[0] || 0, params: p };
  }

  function closePop() {
    if (!st || !st.pop) return;
    st.pop.remove();
    st.untrack?.();
    document.removeEventListener('mousedown', st.outside, true);
    document.removeEventListener('keydown', st.esc, true);
    st.pop = null;
    st.link?.focus({ preventScroll: true });
  }

  function button(label, primary, onClick) {
    const b = el('button', 'foundation-web-button relative clip group/interactable cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-800 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    b.addEventListener('click', onClick);
    return b;
  }

  function numberInput(value, placeholder, label) {
    const field = el('label', 'routility-alert-field routility-war-field');
    field.appendChild(el('span', 'icon-robux-16x16'));
    const input = el('input', 'routility-alert-input text-body-medium content-emphasis');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = placeholder;
    input.value = value ? formatNumber(value) : '';
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      const v = input.value.replace(/[^\d]/g, '');
      const f = v ? formatNumber(Number(v)) : '';
      if (input.value !== f) input.value = f;
      input.closest('.routility-war-pop')?.querySelector('.routility-alert-error')?.setAttribute('hidden', '');
    });
    field.appendChild(input);
    field.read = () => Number(input.value.replace(/[^\d]/g, '')) || 0;
    field.input = input;
    return field;
  }

  async function openPop(s) {
    if (s.pop) return closePop();
    if (s.opening) return;
    s.opening = true;
    let data;
    let wars;
    try {
      [data, wars] = await Promise.all([load(s), getWars()]);
    } finally {
      s.opening = false;
    }
    if (st !== s || s.pop) return;
    const pop = el('div', 'routility-injected routility-alert-pop routility-war-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', lt('Price War'));
    pop.appendChild(el('div', 'text-title-medium content-emphasis', lt('Price War')));
    pop.appendChild(el('div', 'text-body-small content-muted routility-alert-sub', lt('Keeps your copy the cheapest. Every 5 minutes it lowers your price when someone lists under you, and never goes under your lowest price.')));
    const rows = [];
    if (!data) {
      pop.appendChild(el('div', 'text-body-small content-muted', lt('Couldn’t load your copies right now. Try again in a minute.')));
    } else if (!data.onSale.length) {
      pop.appendChild(el('div', 'text-body-small content-muted', lt('None of your copies are on sale. Put one on sale first, then set up Price War.')));
    } else {
      pop.appendChild(el('div', 'text-body-small content-muted', data.cheapest ? lt('Cheapest other seller: R$ {price}', { price: formatNumber(data.cheapest) }) : lt('No one else is selling right now.')));
      data.onSale.forEach((inst, i) => {
        const w = wars[inst.collectibleInstanceId];
        const box = el('div', 'routility-war-copy');
        const head = el('div', 'routility-war-head');
        head.append(el('span', 'text-label-medium content-emphasis', inst.serialNumber ? lt('Serial #{n}', { n: formatNumber(inst.serialNumber) }) : data.onSale.length > 1 ? lt('Copy {n}', { n: i + 1 }) : lt('Your copy')), el('span', 'text-body-small content-muted', lt('Listed at R$ {price}', { price: formatNumber(inst.price) })));
        box.appendChild(head);
        let mode = w ? w.mode : 'off';
        const by = numberInput(w ? w.by : 1, '1', lt('Undercut by'));
        const floor = numberInput(w ? w.floor : 0, data.params.floor ? formatNumber(data.params.floor) : lt('Lowest price'), lt('Lowest price'));
        const gets = el('div', 'text-body-small content-muted routility-war-gets');
        const paintGets = () => {
          const f = floor.read();
          gets.textContent = f ? lt('At your lowest price you get R$ {n} after Roblox’s cut.', { n: formatNumber(takeHome(f, data.params)) }) : '';
        };
        floor.input.addEventListener('input', paintGets);
        const byRow = el('div', 'routility-war-row');
        byRow.append(el('span', 'text-body-small content-default', lt('Undercut by')), by);
        const floorRow = el('div', 'routility-war-row');
        floorRow.append(el('span', 'text-body-small content-default', lt('Lowest price')), floor);
        const opts = el('div', 'routility-war-opts');
        opts.append(byRow, floorRow, gets);
        const modes = el('div', 'routility-alert-chips routility-war-modes');
        const paintMode = () => {
          modes.querySelectorAll('button').forEach(b => {
            const on = b.dataset.mode === mode;
            b.classList.toggle('bg-inverse-surface-0', on);
            b.classList.toggle('content-inverse-emphasis', on);
            b.classList.toggle('bg-shift-300', !on);
            b.classList.toggle('content-action-utility', !on);
          });
          opts.hidden = mode === 'off';
          byRow.hidden = mode !== 'under';
        };
        for (const [key, label] of MODES) {
          const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-small padding-right-small height-600 text-label-small routility-alert-chip');
          b.type = 'button';
          b.dataset.mode = key;
          const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
          layer.setAttribute('aria-hidden', 'true');
          b.append(layer, el('span', 'text-no-wrap', lt(label)));
          b.addEventListener('click', () => { mode = key; error.hidden = true; paintMode(); });
          modes.appendChild(b);
        }
        const status = el('div', 'text-body-small content-muted routility-war-status', w ? statusText(w) : '');
        status.classList.toggle('content-system-alert', !!(w && w.last && w.last.kind === 'verify'));
        box.append(modes, opts, status);
        paintMode();
        paintGets();
        pop.appendChild(box);
        rows.push({ inst, w, get: () => ({ mode, by: by.read(), floor: floor.read() }), floor });
      });
    }
    const error = el('div', 'text-body-small content-system-alert routility-alert-error');
    error.hidden = true;
    pop.appendChild(error);
    const actions = el('div', 'routility-alert-actions');
    if (rows.length) {
      actions.appendChild(button(lt('Save'), true, async () => {
        const next = await getWars();
        for (const r of rows) {
          const v = r.get();
          const id = r.inst.collectibleInstanceId;
          if (v.mode === 'off') {
            delete next[id];
            continue;
          }
          const min = Math.max(1, data.params.floor);
          if (!(v.floor >= min)) {
            error.textContent = data.params.floor ? lt('Set a lowest price of at least R$ {n}.', { n: formatNumber(min) }) : lt('Set a lowest price so Price War knows where to stop.');
            error.hidden = false;
            r.floor.input.focus();
            return;
          }
          if (v.floor > Number(r.inst.price)) {
            error.textContent = lt('Your lowest price is above what it’s listed at now.');
            error.hidden = false;
            r.floor.input.focus();
            return;
          }
          const keep = next[id] && next[id].mode === v.mode && next[id].floor === v.floor && next[id].by === Math.max(1, v.by) ? next[id].last : null;
          next[id] = { cid: s.cid, itemId: s.itemId, name: itemName() || lt('Item {id}', { id: s.itemId }), seller: me(), mode: v.mode, by: Math.max(1, v.by || 1), floor: v.floor, at: Date.now(), last: keep && keep.kind !== 'verify' ? keep : null };
        }
        await setWars(next);
        chrome.runtime.sendMessage({ type: 'priceWarNow' }, () => void chrome.runtime.lastError);
        closePop();
        paint(s);
      }));
    } else {
      actions.appendChild(button(lt('Close'), false, () => closePop()));
    }
    pop.appendChild(actions);
    document.body.appendChild(pop);
    s.pop = pop;
    const place = () => {
      const r = s.link.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left))) + 'px';
      pop.style.top = Math.round(r.bottom + window.scrollY + 8) + 'px';
    };
    place();
    s.untrack = window.RoUtilityUI.trackPopover(pop, s.link, place, () => closePop());
    s.outside = (e) => { if (!e.target.closest?.('.routility-war-pop, .routility-war-link') && !e.target.closest?.('.dropdown-menu')) closePop(); };
    s.esc = (e) => { if (e.key === 'Escape') closePop(); };
    document.addEventListener('mousedown', s.outside, true);
    document.addEventListener('keydown', s.esc, true);
  }

  async function paint(s) {
    const all = await getWars();
    if (st !== s || !s.link) return;
    const on = Object.values(all).filter(w => w && w.itemId === s.itemId && w.mode !== 'off' && w.seller === me()).length;
    s.link.textContent = on ? lt('Price War on') : lt('Price War');
  }

  async function place(s) {
    if (s.link && s.link.isConnected) return;
    if (s.placing) return;
    const caption = [...document.querySelectorAll('.price-container-text .price-info .font-caption-body')].find(n => n.querySelector('a[href="#resellers"]'));
    if (!caption) return;
    s.placing = true;
    try {
      if (s.owned === undefined) {
        const data = await load(s);
        s.owned = !!(data && data.copies.length);
      }
    } finally {
      s.placing = false;
    }
    if (st !== s || !s.owned || !caption.isConnected || caption.querySelector('.routility-war-link')) return;
    const sep = el('span', 'routility-injected routility-war-sep', ', ');
    const link = el('a', 'text-link routility-injected routility-war-link', lt('Price War'));
    link.href = '#';
    link.setAttribute('role', 'button');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openPop(s);
    });
    caption.append(sep, link);
    s.link = link;
    paint(s);
  }

  function setup(itemId) {
    teardown();
    const s = st = { itemId: String(itemId), link: null, pop: null };
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(() => { if (st === s) place(s); }));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    s.onStorage = (changes, area) => { if (area === 'local' && changes[KEY] && st === s) paint(s); };
    chrome.storage.onChanged.addListener(s.onStorage);
    place(s);
  }

  function teardown() {
    if (!st) return;
    closePop();
    st.observer.disconnect();
    chrome.storage.onChanged.removeListener(st.onStorage);
    st = null;
    document.querySelectorAll('.routility-war-sep, .routility-war-link, .routility-war-pop').forEach(n => n.remove());
  }

  window.RoUtilityPriceWar = { setup, teardown };
})();
