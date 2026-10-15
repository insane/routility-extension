(function () {
  'use strict';

  const { el, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const BTN = '[data-testid="purchase-confirm-button"]';
  const HOLD_MS = 1200;
  let settings = {};
  let hold = null;
  let armed = false;

  chrome.storage.local.get('routilitySettings', s => { settings = s.routilitySettings || {}; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.routilitySettings) settings = changes.routilitySettings.newValue || {};
  });

  const robux = (n) => Number((n?.textContent || '').replace(/[^\d]/g, '')) || 0;

  function total(dialog) {
    const label = [...dialog.querySelectorAll('span')].find(s => s.childElementCount === 0 && s.textContent.trim() === 'Total');
    const row = label?.parentElement;
    if (row && row.querySelector('.text-robux')) return robux([...row.querySelectorAll('.text-robux')].pop());
    let best = 0;
    let seen = 0;
    for (const n of dialog.querySelectorAll('.text-robux')) {
      if (n.closest('#rbx-unified-purchase-heading, .foundation-web-accordion, .routility-injected')) continue;
      if (n.closest('[style*="line-through"]')) continue;
      seen++;
      best = Math.max(best, robux(n));
    }
    if (!seen && !/\bFree\b/i.test(dialog.textContent || '')) return -1;
    return best;
  }

  function threshold() {
    const n = Number(settings.purchaseLockAt);
    return Number.isFinite(n) && n >= 0 ? n : 1000;
  }

  function lockedButton(target) {
    if (settings.purchaseLock === false) return null;
    const btn = target?.closest?.(BTN);
    if (!btn || btn.disabled) return null;
    const dialog = btn.closest('[role="dialog"]');
    if (!dialog) return null;
    if (/need more robux/i.test(btn.getAttribute('aria-label') || '') || /buy robux/i.test(btn.textContent || '') || /you need more robux/i.test(dialog.textContent || '')) return null;
    const price = total(dialog);
    if (price === -1) {
      mark(btn, dialog, null);
      return btn;
    }
    if (!(price > 0) || price < threshold()) return null;
    mark(btn, dialog, price);
    return btn;
  }

  function mark(btn, dialog, price) {
    btn.dataset.routilityLock = '';
    const col = btn.parentElement?.parentElement;
    if (!col || col.querySelector('.routility-lock-hint')) return;
    const hint = el('div', 'routility-lock-hint routility-injected text-caption-medium content-muted');
    if (price == null) hint.append(el('span', null, lt('Safety Lock: hold Buy to confirm')));
    else hint.append(el('span', null, lt('Safety Lock: hold Buy to spend')), el('span', 'icon-robux-16x16'), el('span', 'text-robux', formatNumber(price)));
    col.appendChild(hint);
  }

  function balanceAfter(btn) {
    const dialog = btn.closest('[role="dialog"]');
    const col = btn.parentElement?.parentElement;
    if (!dialog || !col) return;
    let row = col.querySelector(':scope > .routility-buy-after');
    const have = robux(dialog.querySelector('#rbx-unified-purchase-heading .text-robux'));
    const price = total(dialog);
    if (settings.buyBalance === false || !(have > 0) || !(price > 0) || have < price || /you need more robux/i.test(dialog.textContent || '')) {
      row?.remove();
      return;
    }
    const value = formatNumber(have - price);
    if (row && row.dataset.value === value) return;
    if (!row) {
      row = el('div', 'flex flex-row items-center justify-between content-default text-body-medium routility-injected routility-buy-after');
      const amount = el('span', 'flex flex-row items-center');
      amount.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux'));
      row.append(el('span', 'content-muted', lt('Balance after purchase')), amount);
      col.prepend(row);
    }
    row.dataset.value = value;
    row.querySelector('.text-robux').textContent = value;
  }

  function scan() {
    for (const btn of document.querySelectorAll(BTN)) {
      balanceAfter(btn);
      if (settings.purchaseLock !== false) lockedButton(btn);
    }
  }

  function cancel() {
    if (!hold) return;
    clearTimeout(hold.timer);
    delete hold.btn.dataset.routilityHolding;
    hold = null;
  }

  function start(btn) {
    if (hold) return;
    btn.dataset.routilityHolding = '';
    hold = {
      btn,
      timer: setTimeout(() => {
        const b = hold.btn;
        cancel();
        b.dataset.routilityDone = '';
        armed = true;
        try { b.click(); } finally { armed = false; }
        setTimeout(() => delete b.dataset.routilityDone, 600);
      }, HOLD_MS),
    };
  }

  function nudge(btn) {
    const hint = btn.parentElement?.parentElement?.querySelector('.routility-lock-hint');
    if (!hint) return;
    hint.classList.remove('routility-lock-nudge');
    void hint.offsetWidth;
    hint.classList.add('routility-lock-nudge');
  }

  window.addEventListener('click', (e) => {
    if (armed) return;
    const btn = lockedButton(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!hold) nudge(btn);
  }, true);

  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const btn = lockedButton(e.target);
    if (btn) start(btn);
  }, true);

  for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, cancel, true);
  window.addEventListener('pointerout', (e) => { if (hold && e.target.closest?.(BTN) === hold.btn && !hold.btn.contains(e.relatedTarget)) cancel(); }, true);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = lockedButton(e.target);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) start(btn);
  }, true);

  window.addEventListener('keyup', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && hold) {
      e.preventDefault();
      cancel();
    }
  }, true);

  let lockQueued = false;
  new MutationObserver(() => {
    if (lockQueued) return;
    lockQueued = true;
    requestAnimationFrame(() => {
      lockQueued = false;
      if (document.querySelector(BTN)) scan();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
