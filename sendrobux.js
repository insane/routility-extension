(function () {
  'use strict';

  const { el, formatNumber, blockedThumb } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const ORIGIN = location.origin;
  const API = 'https://apis.roblox.com/transfer/v1/robux-transfer/';
  const ORIGINS = [1, 0];
  const PRESETS = [25, 50, 100, 200];
  const BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium';
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const settings = { sendRobux: false };
  let csrf = '';
  let s = null;
  let dropModal = null;

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  async function post(url, body) {
    for (let i = 0; i < 2; i++) {
      try {
        const res = await fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: JSON.stringify(body) });
        if (res.status === 403 && res.headers.get('x-csrf-token') && !res.headers.get('rblx-challenge-id')) {
          csrf = res.headers.get('x-csrf-token');
          continue;
        }
        let data = null;
        try { data = await res.json(); } catch {}
        return { ok: res.ok, status: res.status, data, challenge: !!res.headers.get('rblx-challenge-id') };
      } catch {
        return { ok: false, status: 0, data: null };
      }
    }
    return { ok: false, status: 403, data: null };
  }

  function apiError(r) {
    const d = r && r.data;
    if (d && Array.isArray(d.ampRecourseActions) && d.ampRecourseActions.includes('ParentConsentRecourse')) return lt('This needs a parent’s permission. Send it from the Roblox app to ask them.');
    if (r && r.challenge) return lt('Roblox wants to check it’s you first. Send this one from the Roblox app.');
    const m = d && ((d.errors && d.errors[0] && (d.errors[0].userFacingMessage || d.errors[0].message)) || d.errorMessage || d.message);
    if (typeof m === 'string' && /blocked from initiating/i.test(m)) return lt('Your account can’t send Robux yet. It needs an age check or a parent’s permission first, which you can do in the Roblox app.');
    return typeof m === 'string' && m.trim() ? m.trim() : '';
  }

  async function initiate(recipientId) {
    let last = null;
    for (const origin of ORIGINS) {
      last = await post(API + 'initiate-transfer', { recipientId, transferOrigin: origin });
      if (last.ok && last.data && last.data.transferRequestId) return last;
      if (!(last.status >= 500)) break;
    }
    return last;
  }

  function button(text, kind, extra) {
    const b = el('button', BTN + (kind === 'primary' ? ' bg-action-emphasis content-action-emphasis' : ' bg-action-standard content-action-standard') + ' ' + (extra || ''));
    b.type = 'button';
    b.appendChild(el('div', LAYER));
    const label = el('span', 'flex items-center min-width-0 gap-xsmall');
    if (text instanceof Node) label.appendChild(text);
    else label.appendChild(el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', text));
    b.appendChild(label);
    return b;
  }

  function robux(n, size) {
    const w = el('span', 'flex items-center gap-xsmall');
    w.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-' + (size || 'small') + ')]'), el('span', null, formatNumber(n)));
    return w;
  }

  function avatar(size) {
    const box = el('span', 'routility-gift-avatar radius-circle clip bg-shift-300');
    box.style.width = box.style.height = size + 'px';
    const img = el('img');
    img.alt = '';
    img.src = s.thumb || s.who.thumb || '';
    if (!img.src) img.hidden = true;
    box.appendChild(img);
    return box;
  }

  function sheetOf() {
    return [...document.querySelectorAll('[role="dialog"]')].find(d => d.querySelector('[data-testid="send-robux-search-row"]')) || null;
  }

  function limits() {
    const d = s.init && s.init.ok ? s.init.data : null;
    return {
      ready: !!(d && d.transferRequestId),
      balance: d && Number.isFinite(Number(d.senderRobuxBalance)) ? Number(d.senderRobuxBalance) : null,
      min: d && Number(d.minimumTransferAmount) > 0 ? Number(d.minimumTransferAmount) : 1,
      max: d && Number(d.maximumTransferAmount) >= 0 ? Number(d.maximumTransferAmount) : null,
    };
  }

  function problem() {
    const a = s.amount;
    if (s.init && !s.init.ok) return apiError(s.init) || lt('Roblox won’t let you send Robux to this person right now.');
    if (!(a > 0)) return '';
    const l = limits();
    if (!l.ready) return '';
    if (l.balance != null && a > l.balance) return lt('You only have {n} Robux', { n: formatNumber(l.balance) });
    if (l.max != null && a > l.max) return lt('You can send up to {n} Robux right now', { n: formatNumber(l.max) });
    if (a < l.min) return lt('The minimum is {n} Robux', { n: formatNumber(l.min) });
    return '';
  }

  function since(d) {
    if (!d || !(d.year > 0)) return '';
    const start = new Date(d.year, Math.max(0, (d.month || 1) - 1), d.day || 1);
    const days = Math.floor((Date.now() - start.getTime()) / 86400000);
    if (!(days >= 0)) return '';
    if (days < 31) return ltn(days, 'Connected {n} day', 'Connected {n} days', { n: days });
    const months = Math.floor(days / 30.44);
    if (months < 12) return ltn(months, 'Connected {n} month', 'Connected {n} months', { n: months });
    const years = Math.floor(months / 12);
    return ltn(years, 'Connected {n} year', 'Connected {n} years', { n: years });
  }

  function amountStep(panel) {
    if (s.back) {
      const back = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none bg-none radius-circle size-1000 routility-gift-back');
      back.type = 'button';
      back.setAttribute('aria-label', lt('Back'));
      back.append(el('div', LAYER), el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-chevron-large-left size-[var(--icon-size-large)] content-emphasis'));
      back.addEventListener('click', () => s.back());
      panel.appendChild(back);
    }
    panel.appendChild(avatar(64));
    panel.appendChild(el('span', 'text-title-medium content-emphasis text-truncate-end routility-gift-name', s.who.name));
    const row = el('label', 'flex items-center justify-center gap-small routility-gift-amount');
    const input = el('input', 'content-emphasis');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', lt('Amount of Robux'));
    input.placeholder = '0';
    input.value = String(s.amount || 0);
    const fit = () => { input.style.width = Math.max(1, (input.value || '0').length) + 'ch'; };
    fit();
    row.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux routility-gift-icon'), input);
    panel.appendChild(row);
    const err = el('span', 'text-body-small content-system-alert text-align-x-center routility-gift-error');
    panel.appendChild(err);
    const chips = el('div', 'flex wrap justify-center gap-small');
    for (const n of PRESETS) {
      const chip = button(robux(n), 'standard', 'text-label-medium height-1000 padding-x-medium');
      chip.addEventListener('click', () => {
        s.amount = n;
        input.value = String(n);
        fit();
        check();
      });
      chips.appendChild(chip);
    }
    panel.appendChild(chips);
    const next = button(lt('Next'), 'primary', 'text-label-large height-1200 padding-x-large width-full margin-top-small');
    next.addEventListener('click', () => {
      if (next.disabled) return;
      s.step = 'confirm';
      render();
    });
    panel.appendChild(next);
    panel.appendChild(el('span', 'text-caption-medium content-default text-align-x-center', lt('Robux are sent instantly with no fees')));
    function check() {
      const p = problem();
      err.textContent = p;
      err.hidden = !p;
      next.disabled = !!p || !(s.amount > 0) || !limits().ready;
      next.classList.toggle('opacity-[0.5]', next.disabled);
    }
    input.addEventListener('input', () => {
      const digits = input.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
      if (digits !== input.value) input.value = digits;
      s.amount = Number(digits) || 0;
      fit();
      check();
    });
    input.addEventListener('focus', () => { if (input.value === '0') input.select(); });
    input.addEventListener('blur', () => { if (!input.value) input.value = '0'; fit(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next.click(); });
    s.recheck = check;
    check();
    if (!s.amount) setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  function confirmStep(panel) {
    const rel = (s.init && s.init.data && s.init.data.userRelationshipDetail) || {};
    const card = el('div', 'radius-large bg-shift-200 padding-large flex flex-col items-center gap-xsmall width-full');
    card.appendChild(avatar(64));
    card.appendChild(el('span', 'text-title-large content-emphasis text-truncate-end routility-gift-name', s.who.name));
    if (s.username) card.appendChild(el('span', 'text-body-medium content-default', '@' + s.username));
    const meta = el('div', 'flex wrap justify-center gap-x-large gap-y-xsmall text-body-medium content-default margin-top-small');
    const item = (icon, text) => {
      const w = el('span', 'flex items-center gap-xsmall');
      w.append(el('span', 'grow-0 shrink-0 basis-auto icon ' + icon + ' size-[var(--icon-size-small)]'), el('span', null, text));
      meta.appendChild(w);
    };
    const connected = rel.areFriends ? since(rel.friendSinceDate || (rel.friendSinceYear ? { year: rel.friendSinceYear } : null)) : '';
    if (connected) item('icon-filled-calendar', connected);
    else if (rel.areFriends === false) item('icon-regular-person', lt('Not connected'));
    if (Number.isFinite(Number(rel.mutualFriendsCount))) item('icon-regular-two-people', ltn(Number(rel.mutualFriendsCount), '{n} mutual friend', '{n} mutual friends', { n: formatNumber(Number(rel.mutualFriendsCount)) }));
    if (Number(rel.userAccountSinceYear) > 2000) item('icon-regular-circle-i', lt('Joined in {year}', { year: rel.userAccountSinceYear }));
    if (meta.children.length) card.appendChild(meta);
    panel.appendChild(card);
    const money = el('div', 'radius-large bg-shift-200 padding-large flex flex-col items-center gap-xsmall width-full');
    const big = el('div', 'flex items-center gap-small routility-gift-amount');
    big.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux routility-gift-icon'), el('span', 'content-emphasis', formatNumber(s.amount)));
    money.append(big, el('span', 'text-body-small content-default', lt('The recipient will get {n} Robux.', { n: formatNumber(s.amount) })));
    panel.appendChild(money);
    const err = el('span', 'text-body-small content-system-alert text-align-x-center routility-gift-error');
    err.hidden = true;
    panel.appendChild(err);
    const row = el('div', 'flex gap-small width-full');
    const send = button(lt('Send'), 'primary', 'text-label-large height-1200 padding-x-large grow-1 basis-0');
    const edit = button(lt('Edit'), 'standard', 'text-label-large height-1200 padding-x-large grow-1 basis-0');
    row.append(send, edit);
    panel.appendChild(row);
    panel.appendChild(el('span', 'text-caption-medium content-default width-full', lt('You need an age check or parental consent to send Robux. Once you send, you cannot cancel.')));
    edit.addEventListener('click', () => {
      if (s.busy) return;
      s.step = 'amount';
      render();
    });
    send.addEventListener('click', async () => {
      if (s.busy) return;
      s.busy = true;
      send.disabled = edit.disabled = true;
      send.classList.add('opacity-[0.5]');
      edit.classList.add('opacity-[0.5]');
      send.setAttribute('aria-busy', 'true');
      err.hidden = true;
      const mine = s;
      mine.init = await initiate(mine.who.id);
      const transferId = mine.init && mine.init.ok && mine.init.data ? String(mine.init.data.transferRequestId || '') : '';
      const res = /^[\w-]{1,80}$/.test(transferId) ? await post(API + 'process-transfer/' + encodeURIComponent(transferId), { robuxAmount: mine.amount }) : mine.init;
      if (s !== mine) return;
      s.busy = false;
      if (res && res.ok && !(res.data && res.data.success === false)) {
        s.step = 'done';
        render();
        window.dispatchEvent(new CustomEvent('navigation-update-user-currency'));
        return;
      }
      err.textContent = apiError(res) || (res && res.status === 0 ? lt('Roblox didn’t answer. Check your balance before you try again.') : lt('Roblox couldn’t send it. Check your balance before you try again.'));
      err.hidden = false;
      send.removeAttribute('aria-busy');
      if (!res || res.status === 0 || res.status >= 500) return;
      send.disabled = edit.disabled = false;
      send.classList.remove('opacity-[0.5]');
      edit.classList.remove('opacity-[0.5]');
    });
  }

  function showBalance(n) {
    const box = document.querySelector('.routility-gift-modal .routility-gift-balance');
    if (!box || !Number.isFinite(n)) return;
    box.replaceChildren(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-medium)]'), el('span', null, formatNumber(Math.max(0, n))));
    box.hidden = false;
  }

  function doneStep(panel) {
    panel.appendChild(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-circle-check size-[var(--icon-size-xlarge)] content-emphasis margin-top-small'));
    panel.appendChild(el('span', 'text-body-large content-emphasis text-align-x-center', lt('You sent {n} Robux', { n: formatNumber(s.amount) })));
    const ok = button(lt('OK'), 'primary', 'text-label-large height-1200 padding-x-large width-full margin-top-small');
    ok.addEventListener('click', () => s.close());
    panel.appendChild(ok);
    const l = limits();
    if (l.balance != null) showBalance(l.balance - s.amount);
    setTimeout(() => ok.focus({ preventScroll: true }), 50);
  }

  function render() {
    if (!s) return;
    const panel = s.panel();
    if (!panel) return;
    panel.replaceChildren();
    panel.dataset.step = s.step;
    if (s.step === 'confirm') confirmStep(panel);
    else if (s.step === 'done') doneStep(panel);
    else amountStep(panel);
  }

  function inSheet(sheet) {
    return {
      sheet,
      panel() {
        if (!sheet.isConnected) return null;
        let panel = sheet.querySelector('.routility-gift');
        if (!panel) {
          panel = el('div', 'routility-injected routility-gift flex flex-col items-center gap-medium padding-x-xlarge padding-bottom-xlarge');
          sheet.querySelector('[data-testid="send-robux-search-row"]').after(panel);
        }
        return panel;
      },
      close() {
        sheet.querySelector('.fui-sheet-close-affordance-container button')?.click();
      },
      back() {
        if (s && s.busy) return;
        sheet.querySelector('.routility-gift')?.remove();
        s = null;
      },
    };
  }

  function inWindow() {
    if (dropModal) dropModal();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-gift-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-gift-sheet');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-gift-title');
    const head = el('div', 'flex items-center gap-small padding-x-xlarge padding-top-large padding-bottom-small');
    const title = el('div', 'flex flex-row items-center gap-xsmall grow-1 min-width-0');
    title.append(el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus size-[var(--icon-size-large)]'), el('h2', 'text-heading-small margin-none text-truncate-end', lt('Send Robux')));
    title.lastChild.id = 'routility-gift-title';
    const balance = el('span', 'flex items-center gap-xsmall text-label-large content-emphasis routility-gift-balance');
    balance.hidden = true;
    const x = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none bg-none radius-circle size-1000');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    x.append(el('div', LAYER), el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-large)] content-emphasis'));
    head.append(title, balance, x);
    const panel = el('div', 'routility-gift flex flex-col items-center gap-medium padding-x-xlarge padding-top-small padding-bottom-xlarge');
    dialog.append(head, panel);
    overlay.appendChild(dialog);
    const host = {
      sheet: null,
      panel: () => (overlay.isConnected ? panel : null),
      close() {
        if (s && s.busy) return;
        drop();
      },
    };
    const drop = () => {
      overlay.remove();
      document.removeEventListener('keydown', esc, true);
      if (dropModal === drop) dropModal = null;
    };
    dropModal = drop;
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); host.close(); } };
    x.addEventListener('click', () => host.close());
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) host.close(); });
    document.addEventListener('keydown', esc, true);
    document.body.appendChild(overlay);
    return host;
  }

  async function open(who, host) {
    s = Object.assign({ who, amount: 0, step: 'amount', init: null, busy: false, thumb: '', username: '' }, host);
    const mine = s;
    render();
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${who.id}&size=150x150&format=Png&isCircular=false`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then((d) => {
        const t = d && d.data && d.data[0];
        const url = t ? blockedThumb(t) : '';
        if (!url || url === 'blocked' || s !== mine) return;
        s.thumb = url;
        document.querySelectorAll('.routility-gift-avatar img').forEach((img) => { img.src = url; img.hidden = false; });
      }).catch(() => {});
    fetch(`https://users.roblox.com/v1/users/${who.id}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then((d) => {
        if (!d || s !== mine) return;
        s.username = d.name || '';
        if (d.displayName) s.who.name = d.displayName;
        document.querySelectorAll('.routility-gift-name').forEach((n) => { n.textContent = s.who.name; });
      }).catch(() => {});
    const res = await initiate(who.id);
    if (s !== mine) return;
    s.init = res;
    const l = limits();
    if (l.balance != null) showBalance(l.balance);
    if (s.recheck && s.step === 'amount') s.recheck();
  }

  function profileItem(target) {
    const item = target && target.closest && target.closest('button, a, [role="menuitem"]');
    if (!item || item.textContent.trim().length > 40 || !/robux/i.test(item.textContent)) return null;
    const header = document.querySelector('#content > .profile-platform-container .user-profile-header-info');
    if (header && header.contains(item)) return item;
    const more = header && header.querySelector('button[aria-controls]');
    const menu = more && document.getElementById(more.getAttribute('aria-controls'));
    return menu && menu.contains(item) ? item : null;
  }

  function profileClick(e) {
    if (settings.sendRobux === false) return;
    const m = location.pathname.match(/^\/users\/(\d+)\/profile/i);
    if (!m || m[1] === me() || !profileItem(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    open({ id: Number(m[1]), name: (document.querySelector('#profile-header-title-container-name, .header-names .profile-name')?.textContent || '').trim(), thumb: '' }, inWindow());
  }

  function tell() {
    window.postMessage({ type: 'routility-send-on', on: settings.sendRobux !== false }, ORIGIN);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.type === 'routility-send-hello') return tell();
    if (e.data.type !== 'routility-send-pick' || settings.sendRobux === false) return;
    const id = Number(e.data.id);
    const sheet = sheetOf();
    if (!(id > 0) || !sheet) return;
    open({ id, name: String(e.data.name || ''), thumb: /^https:\/\/([\w-]+\.)*rbxcdn\.com\//.test(e.data.thumb) ? e.data.thumb : '' }, inSheet(sheet));
  });
  document.addEventListener('click', profileClick, true);

  chrome.storage.local.get('routilitySettings', (st) => {
    settings.sendRobux = (st.routilitySettings || {}).sendRobux !== false;
    tell();
  });
})();
