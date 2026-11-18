(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, request } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const KEY = 'routilityQuickTrade';
  const MAX = 6;
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6 1.4 0 2.7.5 3.7 1.3"/><path d="M15 18h6M18.5 15.5 21 18l-2.5 2.5"/></svg>';
  const STATUS = {
    ReceiverPrivacyTooStrict: LT('Not accepting trades from you. Their trade settings may only allow friends or people they follow.'),
    ReceiverCannotTrade: LT('This account can’t trade.'),
    SenderPrivacyTooStrict: LT('Your “Who can trade with me?” setting doesn’t include this person.'),
    SenderCannotTrade: LT('Your account can’t trade right now.'),
  };

  let on = true;
  let s = null;

  const me = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';

  function button(label, cls) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium ' + cls);
    b.type = 'button';
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label));
    return b;
  }

  function parse(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;
    let m = v.match(/roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)/i);
    if (m) return { id: m[1] };
    m = v.match(/roblox\.com\/share(?:-links)?\?[^\s]*\bcode=([\w-]+)/i);
    if (m && /type=Profile/i.test(v)) return { share: m[1] };
    if (/^\d{1,19}$/.test(v)) return { id: v, name: v };
    const name = v.replace(/^@/, '');
    if (/^[A-Za-z0-9_]{3,20}$/.test(name)) return { name };
    return null;
  }

  async function shareUser(code) {
    const res = await fetchCsrf('https://apis.roblox.com/sharelinks/v1/resolve-link', { linkId: code, linkType: 'Profile' });
    const id = res && (res.profileLinkResolutionResponseData?.userId || res.profileLinkResolutionResponseData?.profileId);
    return id ? String(id) : null;
  }

  let csrf = '';
  async function fetchCsrf(url, body) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) });
        const t = r.headers.get('x-csrf-token');
        if (r.status === 403 && t && t !== csrf) { csrf = t; continue; }
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function byId(id) {
    const d = await json(`https://users.roblox.com/v1/users/${id}`);
    return d && d.id ? { id: String(d.id), name: d.name, display: d.displayName || d.name, banned: !!d.isBanned } : null;
  }

  async function byName(name) {
    const d = await json('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernames: [name], excludeBannedUsers: false }) });
    const u = d && d.data && d.data[0];
    return u ? { id: String(u.id), name: u.name, display: u.displayName || u.name } : null;
  }

  async function resolve(q) {
    if (q.share) {
      const id = await shareUser(q.share);
      return id ? byId(id) : null;
    }
    if (q.id) {
      const u = q.name ? (await byName(q.name)) : null;
      return u || byId(q.id);
    }
    return byName(q.name);
  }

  async function tradeStatus(id) {
    const d = await json(`https://trades.roblox.com/v1/users/${id}/can-trade-with`);
    return d && d.status ? d.status : null;
  }

  function loadRecent() {
    return new Promise(r => chrome.storage.local.get(KEY, st => r(st[KEY] && Array.isArray(st[KEY].list) ? st[KEY] : null)));
  }

  function saveRecent(list) {
    chrome.storage.local.set({ [KEY]: { list: list.slice(0, MAX), seeded: true } });
  }

  async function remember(u) {
    const st = await loadRecent();
    const list = ((st && st.list) || []).filter(x => x.id !== u.id);
    list.unshift({ id: u.id, name: u.name, display: u.display });
    saveRecent(list);
  }

  async function seed() {
    const out = [];
    const seen = new Set([me()]);
    for (const type of ['inbound', 'outbound', 'completed']) {
      const d = await json(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=10`);
      for (const t of (d && d.data) || []) {
        const u = t.user;
        if (!u || !u.id || seen.has(String(u.id))) continue;
        seen.add(String(u.id));
        out.push({ id: String(u.id), name: u.name, display: u.displayName || u.name, at: Date.parse(t.created) || 0 });
      }
    }
    out.sort((a, b) => b.at - a.at);
    const list = out.slice(0, MAX).map(({ id, name, display }) => ({ id, name, display }));
    saveRecent(list);
    return list;
  }

  async function recent() {
    const st = await loadRecent();
    if (st && st.seeded) return st.list;
    return seed();
  }

  function close() {
    if (!s) return;
    s.overlay.remove();
    document.removeEventListener('keydown', s.onKey, true);
    s = null;
  }

  function setError(msg) {
    if (!s) return;
    s.error.textContent = msg || '';
    s.error.hidden = !msg;
    s.field.classList.toggle('routility-qt-bad', !!msg);
  }

  function busy(b) {
    if (!s) return;
    s.busy = b;
    s.go.disabled = b;
    s.input.disabled = b;
    s.go.lastChild.textContent = b ? lt('Opening…') : lt('Open');
  }

  async function submit(target) {
    if (!s || s.busy) return;
    let u = target || null;
    if (!u) {
      const q = parse(s.input.value);
      if (!q) {
        setError(s.input.value.trim() ? lt('Enter a username, user ID or profile link.') : '');
        s.input.focus();
        return;
      }
      busy(true);
      setError('');
      u = await resolve(q);
      if (!s) return;
      if (!u) {
        busy(false);
        setError(lt('No one goes by that name.'));
        s.input.focus();
        return;
      }
    } else {
      busy(true);
      setError('');
    }
    if (u.id === me()) {
      busy(false);
      setError(lt('That’s you.'));
      return;
    }
    if (u.banned) {
      busy(false);
      setError(lt('This account is banned.'));
      return;
    }
    const status = await tradeStatus(u.id);
    if (!s) return;
    if (status && status !== 'CanTrade') {
      busy(false);
      setError(STATUS[status] ? lt(STATUS[status]) : lt('You can’t trade with {name}.', { name: u.name }));
      return;
    }
    await remember(u);
    location.href = `/users/${u.id}/trade`;
  }

  function chip(u, face) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center stroke-none select-none radius-circle text-label-medium bg-action-standard content-action-standard height-800 gap-xsmall routility-qt-chip');
    b.type = 'button';
    b.title = '@' + u.name;
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    const img = el('img', 'routility-qt-face');
    img.alt = '';
    if (face) img.src = face;
    b.append(layer, img, el('span', 'text-truncate-end text-no-wrap', u.display || u.name));
    b.addEventListener('click', () => submit(u));
    return b;
  }

  async function fillRecent() {
    const list = await recent().catch(() => []);
    if (!s || !list.length) return;
    const faces = (await request({ type: 'getHeadshots', ids: list.map(u => u.id) }).catch(() => null)) || {};
    if (!s) return;
    s.chips.replaceChildren(...list.map(u => chip(u, faces[u.id])));
    s.recent.hidden = false;
  }

  function open(prefill) {
    if (!on) return;
    if (s) return s.input.focus();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-qt-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-qt-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-qt-title');
    const head = el('div', 'flex items-center gap-small padding-x-xlarge padding-top-large');
    const titles = el('div', 'flex flex-col grow-1 min-width-0');
    const title = el('h2', 'text-heading-small margin-none', lt('Quick Trade'));
    title.id = 'routility-qt-title';
    titles.append(title, el('p', 'text-body-medium content-muted margin-none', lt('Type a username or paste a profile link to open a trade.')));
    const x = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none bg-none radius-circle size-1000');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    x.append(el('div', LAYER), el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-large)] content-emphasis'));
    head.append(titles, x);
    const body = el('div', 'flex flex-col gap-small padding-x-xlarge padding-top-medium padding-bottom-xlarge');
    const row = el('div', 'flex items-center gap-small');
    const field = el('div', 'foundation-web-input flex items-center relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis grow-1 min-width-0 routility-qt-field');
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium');
    input.type = 'text';
    input.placeholder = lt('Username, user ID or profile link');
    input.setAttribute('aria-label', lt('Username, user ID or profile link'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (typeof prefill === 'string') input.value = prefill;
    field.append(input);
    const go = button(lt('Open'), 'bg-action-emphasis content-action-emphasis height-1000 padding-x-large routility-qt-go');
    row.append(field, go);
    const error = el('p', 'text-body-small content-system-alert margin-none routility-qt-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const recentBox = el('div', 'flex flex-col gap-xsmall padding-top-small');
    recentBox.hidden = true;
    const chips = el('div', 'flex flex-wrap gap-xsmall');
    recentBox.append(el('span', 'text-label-medium content-muted', lt('Recent')), chips);
    body.append(row, error, recentBox);
    dialog.append(head, body);
    overlay.appendChild(dialog);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', () => setError(''));
    go.addEventListener('click', () => submit());
    x.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    s = { overlay, input, field, go, error, recent: recentBox, chips, onKey, busy: false };
    document.body.appendChild(overlay);
    input.focus();
    fillRecent();
  }

  function ensureButton() {
    const actions = document.querySelector('.trades-header .trades-header-actions');
    const has = actions && actions.querySelector('.routility-qt-btn');
    if (!on || !actions) { has?.remove(); return; }
    if (has) return;
    const b = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center padding-none stroke-none select-none size-1000 radius-medium bg-action-link routility-injected routility-qt-btn');
    b.type = 'button';
    b.setAttribute('aria-label', lt('Quick Trade'));
    b.title = lt('Quick Trade');
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    const icon = el('span', 'size-600 content-emphasis routility-qt-icon');
    icon.innerHTML = ICON;
    b.append(layer, icon);
    b.addEventListener('click', () => open());
    actions.prepend(b);
  }

  let observer = null;
  function watch() {
    const trades = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?trades\/?$/i.test(location.pathname);
    if (!trades || observer) return;
    let queued = false;
    observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; ensureButton(); });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ensureButton();
  }

  window.addEventListener('routility-quick-trade', (e) => open(e.detail && e.detail.prefill));

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).quickTrade !== false;
    watch();
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local' || !c.routilitySettings) return;
    on = (c.routilitySettings.newValue || {}).quickTrade !== false;
    if (!on) close();
    ensureButton();
  });
})();
