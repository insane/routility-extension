(function () {
  'use strict';

  const { el, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const KEY = 'routilityPriceAlerts';
  let st = null;

  const getAlerts = () => new Promise(r => chrome.storage.local.get(KEY, s => r(s[KEY] || {})));
  const setAlerts = (all) => new Promise(r => chrome.storage.local.set({ [KEY]: all }, r));

  function bestPrice() {
    const text = document.querySelector('.price-container-text .price-info .text-robux-lg')?.textContent || '';
    const n = Number(text.replace(/[^\d]/g, ''));
    return n > 0 ? n : 0;
  }

  function itemName() {
    return document.querySelector('.item-details-info-header h1, #item-container h1, .item-name-container h1')?.textContent.trim() || '';
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

  function chip(label, onClick) {
    const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-small padding-right-small height-600 text-label-small bg-shift-300 content-action-utility routility-alert-chip');
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    b.addEventListener('click', onClick);
    return b;
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

  async function openPop(s) {
    if (s.pop) return closePop();
    if (s.opening) return;
    s.opening = true;
    let all;
    try {
      all = await getAlerts();
    } finally {
      s.opening = false;
    }
    if (st !== s || s.pop) return;
    const current = all[s.itemId];
    const best = bestPrice();
    const pop = el('div', 'routility-injected routility-alert-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', lt('Price Alert'));
    pop.appendChild(el('div', 'text-title-medium content-emphasis', lt('Price Alert')));
    pop.appendChild(el('div', 'text-body-small content-muted routility-alert-sub', lt('Get a notification when someone lists this item at or below your price.')));
    const field = el('label', 'routility-alert-field');
    field.appendChild(el('span', 'icon-robux-16x16'));
    const input = el('input', 'routility-alert-input text-body-medium content-emphasis');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = best ? formatNumber(Math.floor(best * 0.9)) : lt('Price');
    input.value = current ? formatNumber(current.target) : '';
    input.setAttribute('aria-label', lt('Alert price in Robux'));
    input.addEventListener('input', () => {
      const v = input.value.replace(/[^\d]/g, '');
      const f = v ? formatNumber(Number(v)) : '';
      if (input.value !== f) input.value = f;
      error.hidden = true;
    });
    field.appendChild(input);
    pop.appendChild(field);
    if (best) {
      const chips = el('div', 'routility-alert-chips');
      for (const pct of [5, 10, 20]) chips.appendChild(chip(`−${pct}%`, () => { input.value = formatNumber(Math.floor(best * (1 - pct / 100))); input.focus(); }));
      pop.appendChild(chips);
      pop.appendChild(el('div', 'text-body-small content-muted', lt('Best price now: R$ {price}', { price: formatNumber(best) })));
    }
    const error = el('div', 'text-body-small content-system-alert routility-alert-error', lt('Enter a price in Robux.'));
    error.hidden = true;
    pop.appendChild(error);
    const actions = el('div', 'routility-alert-actions');
    const save = async () => {
      const target = Number(input.value.replace(/[^\d]/g, ''));
      if (!(target > 0)) {
        error.hidden = false;
        input.focus();
        return;
      }
      const next = await getAlerts();
      next[s.itemId] = { name: itemName() || (current && current.name) || lt('Item {id}', { id: s.itemId }), target, cid: (current && current.cid) || '', at: Date.now(), lastListing: '' };
      await setAlerts(next);
      closePop();
      paint(s);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    if (current) actions.appendChild(button(lt('Remove'), false, async () => {
      const next = await getAlerts();
      delete next[s.itemId];
      await setAlerts(next);
      closePop();
      paint(s);
    }));
    actions.appendChild(button(current ? lt('Update Alert') : lt('Save Alert'), true, save));
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
    s.outside = (e) => { if (!e.target.closest?.('.routility-alert-pop, .routility-alert-link')) closePop(); };
    s.esc = (e) => { if (e.key === 'Escape') closePop(); };
    document.addEventListener('mousedown', s.outside, true);
    document.addEventListener('keydown', s.esc, true);
    input.focus();
  }

  async function paint(s) {
    const all = await getAlerts();
    if (st !== s) return;
    const a = all[s.itemId];
    if (s.link) s.link.textContent = a ? lt('Alert at R$ {price}', { price: formatNumber(a.target) }) : lt('Price Alert');
  }

  function place(s) {
    if (s.link && s.link.isConnected) return;
    const caption = [...document.querySelectorAll('.price-container-text .price-info .font-caption-body')].find(n => n.querySelector('a[href="#resellers"]'));
    if (!caption) return;
    const sep = el('span', 'routility-injected routility-alert-sep', ' · ');
    const link = el('a', 'text-link routility-injected routility-alert-link', lt('Price Alert'));
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
    document.querySelectorAll('.routility-alert-sep, .routility-alert-link, .routility-alert-pop').forEach(n => n.remove());
  }

  window.RoUtilityPriceAlert = { setup, teardown };
})();
