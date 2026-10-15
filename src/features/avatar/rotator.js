(function () {
  'use strict';

  const { el, onFrame, dropdown } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ';
  const SMALL = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-small text-label-small height-600 padding-x-small bg-action-standard content-action-standard ';
  const EVERY = [['1', LT('Every Minute')], ['5', LT('Every 5 Minutes')], ['15', LT('Every 15 Minutes')], ['30', LT('Every 30 Minutes')], ['60', LT('Every Hour')], ['180', LT('Every 3 Hours')], ['360', LT('Every 6 Hours')], ['720', LT('Every 12 Hours')], ['1440', LT('Every Day')]];
  const ORDER = [['order', LT('In Order')], ['shuffle', LT('Shuffle')]];
  const UNITS = [['s', LT('Seconds')], ['1', LT('Minutes')], ['60', LT('Hours')], ['1440', LT('Days')]];
  const MAX_MINUTES = 10080;

  let state = null;
  let toastTimer = 0;

  function toast(text) {
    document.querySelector('.routility-toast')?.remove();
    clearTimeout(toastTimer);
    const box = el('div', 'routility-injected routility-toast flex items-center gap-large bg-system-contrast content-inverse-emphasis radius-medium padding-x-large padding-y-medium shadow-transient-high text-body-medium');
    box.setAttribute('role', 'status');
    box.appendChild(el('span', null, text));
    document.body.appendChild(box);
    toastTimer = setTimeout(() => box.remove(), 5000);
  }

  function button(label, cls) {
    const b = el('button', BTN + cls);
    b.type = 'button';
    const l = el('div', LAYER);
    l.setAttribute('aria-hidden', 'true');
    const t = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    b.append(l, t);
    b.label = t;
    return b;
  }

  function toggle(label, checked, onChange) {
    const btn = el('button', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer grow-0 shrink-0 basis-auto flex items-center padding-xxsmall stroke-none radius-circle transition-colors width-1000 height-600 group/toggle data-[state=unchecked]:bg-action-standard data-[state=checked]:bg-system-contrast');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-label', label);
    const l = el('div', LAYER);
    l.setAttribute('aria-hidden', 'true');
    btn.appendChild(l);
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:size-0 group-data-[state=checked]/toggle:fill'));
    const knob = el('span', 'transition-colors radius-circle flex justify-center items-center size-500 data-[state=unchecked]:bg-[var(--color-content-emphasis)] data-[state=checked]:bg-[var(--inverse-content-emphasis)]');
    knob.appendChild(el('span', 'icon icon-filled-check transition-opacity size-500 group-data-[state=unchecked]/toggle:opacity-[0] group-data-[state=checked]/toggle:opacity-[1] group-data-[state=checked]/toggle:[transition-delay:50ms]'));
    btn.appendChild(knob);
    btn.appendChild(el('span', 'motion-safe:transition-[flex-grow] ease-standard-out duration-300 group-data-[state=unchecked]/toggle:fill group-data-[state=checked]/toggle:size-0'));
    const set = (on) => {
      const s = on ? 'checked' : 'unchecked';
      btn.setAttribute('aria-checked', String(on));
      btn.setAttribute('data-state', s);
      knob.setAttribute('data-state', s);
    };
    set(checked);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-checked') !== 'true';
      set(on);
      onChange(on);
    });
    btn.set = set;
    return btn;
  }

  const ask = msg => new Promise(r => chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; r(res || null); }));

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async function loadOutfits(me) {
    const out = [];
    let token = '';
    for (let page = 1; page <= 6; page++) {
      const d = await getJson(`https://avatar.roblox.com/v2/avatar/users/${me}/outfits?outfitType=Avatar&page=${page}&itemsPerPage=50&isEditable=true${token ? '&paginationToken=' + encodeURIComponent(token) : ''}`);
      if (!d || !Array.isArray(d.data)) return out.length ? out : null;
      for (const o of d.data) out.push({ id: String(o.id), name: o.name || '' });
      token = d.paginationToken || '';
      if (!token || d.data.length < 50) break;
    }
    return out;
  }

  async function loadThumbs(ids, onThumb) {
    let want = ids.slice();
    for (let round = 0; round < 4 && want.length; round++) {
      if (round) await new Promise(r => setTimeout(r, 2000));
      const pending = [];
      for (let i = 0; i < want.length; i += 50) {
        const d = await getJson(`https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${want.slice(i, i + 50).join(',')}&size=150x150&format=Webp&isCircular=false`);
        for (const t of (d && d.data) || []) {
          if (t.state === 'Completed' && t.imageUrl) onThumb(String(t.targetId), t.imageUrl);
          else if (t.state === 'Pending') pending.push(String(t.targetId));
        }
      }
      want = pending;
    }
  }

  function when(ms) {
    if (ms < 60000) return ltn(Math.max(1, Math.round(ms / 1000)), 'in {n} second', 'in {n} seconds');
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return ltn(mins, 'in {n} minute', 'in {n} minutes');
    const hours = Math.round(mins / 60);
    return ltn(hours, 'in about {n} hour', 'in about {n} hours');
  }

  function ago(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return lt('just now');
    if (mins < 60) return ltn(mins, '{n} minute ago', '{n} minutes ago');
    const hours = Math.round(mins / 60);
    if (hours < 48) return ltn(hours, '{n} hour ago', '{n} hours ago');
    return ltn(Math.round(hours / 24), '{n} day ago', '{n} days ago');
  }

  function close() {
    if (!state || !state.modal) return;
    state.modal.remove();
    document.removeEventListener('keydown', state.onKey, true);
    state.modal = null;
    state.trigger?.focus();
  }

  async function open() {
    if (!state || state.modal || state.opening) return;
    const s = state;
    s.opening = true;
    try {
      await openNow(s);
    } finally {
      s.opening = false;
    }
  }

  async function openNow(s) {
    const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal routility-rot-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-tc-dialog routility-rot-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-rot-title');
    dialog.tabIndex = -1;
    const closeBox = el('div', 'absolute foundation-web-dialog-close-container');
    const x = el('button', 'foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus bg-over-media-100 padding-small radius-circle');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    const xl = el('div', LAYER);
    xl.setAttribute('aria-hidden', 'true');
    x.append(xl, el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]'));
    x.addEventListener('click', close);
    closeBox.appendChild(x);
    const title = el('h2', 'text-heading-small routility-tc-title', lt('Outfit Rotator'));
    title.id = 'routility-rot-title';
    const intro = el('p', 'text-body-medium content-muted routility-rot-intro', lt('Switches your avatar between the characters you pick, on a timer. It runs while a Roblox tab is open in Chrome and waits while the avatar editor is open, so it never fights your edits.'));

    const saved = (await (s.savedJob || ask({ type: 'rotatorState' }))) || { on: false, ids: [], every: '15', order: 'order' };
    if (state !== s) return;
    const draft = { on: !!saved.on, ids: (saved.ids || []).map(String), every: saved.every || '15', order: saved.order || 'order' };

    const controls = el('div', 'routility-rot-controls');
    const onRow = el('div', 'routility-rot-row');
    const onText = el('div', 'routility-rot-row-text');
    onText.append(el('span', 'text-title-medium content-emphasis', lt('Rotate Outfits')), el('span', 'text-body-small content-muted', lt('Turn this on, pick at least 2 characters and save.')));
    const sw = toggle(lt('Rotate Outfits'), draft.on, (on) => { draft.on = on; draft.switched = true; sync(); });
    onRow.append(onText, sw);
    const pickRow = el('div', 'routility-rot-row routility-rot-pickers');
    const everyWrap = el('div', 'routility-rot-field');
    everyWrap.appendChild(el('span', 'text-label-medium content-default', lt('Change')));
    const preset = EVERY.some(([v]) => v === draft.every);
    const startSec = /^\d+s$/.test(draft.every) ? Number(draft.every.slice(0, -1)) : 0;
    const startMins = startSec ? 0 : Number(draft.every) || 15;
    const startUnit = startSec ? 's' : startMins % 1440 === 0 ? '1440' : startMins % 60 === 0 ? '60' : '1';
    let unit = startUnit;
    const customBox = el('div', 'routility-rot-custom');
    customBox.hidden = preset;
    const amount = el('input', 'form-control input-field routility-rot-amount');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.inputMode = 'numeric';
    amount.value = String(startSec || startMins / Number(startUnit));
    amount.setAttribute('aria-label', lt('How many'));
    const applyCustom = () => {
      const n = Number(amount.value);
      if (unit === 's') {
        draft.every = Number.isInteger(n) && n >= 30 && n <= MAX_MINUTES * 60 ? (n % 60 === 0 ? String(n / 60) : n + 's') : null;
      } else {
        const mins = Number.isInteger(n) ? n * Number(unit) : NaN;
        draft.every = mins >= 1 && mins <= MAX_MINUTES ? String(mins) : null;
      }
      amount.classList.toggle('routility-rot-bad', !draft.every);
      sync();
    };
    amount.addEventListener('input', applyCustom);
    const unitDrop = dropdown(UNITS.map(([value, label]) => ({ value, label: lt(label) })), unit, (v) => { unit = v; applyCustom(); }, 'routility-rot-unit');
    customBox.append(amount, unitDrop);
    everyWrap.appendChild(dropdown([...EVERY, ['custom', LT('Custom')]].map(([value, label]) => ({ value, label: lt(label) })), preset ? draft.every : 'custom', (v) => {
      customBox.hidden = v !== 'custom';
      if (v === 'custom') {
        applyCustom();
        amount.focus();
        amount.select();
      } else {
        draft.every = v;
        amount.classList.remove('routility-rot-bad');
        sync();
      }
    }, 'routility-rot-every'));
    everyWrap.appendChild(customBox);
    const orderWrap = el('div', 'routility-rot-field');
    orderWrap.appendChild(el('span', 'text-label-medium content-default', lt('Order')));
    orderWrap.appendChild(dropdown(ORDER.map(([value, label]) => ({ value, label: lt(label) })), draft.order, (v) => { draft.order = v; sync(); }, 'routility-rot-order'));
    pickRow.append(everyWrap, orderWrap);
    controls.append(onRow, pickRow);

    const listHead = el('div', 'routility-rot-list-head');
    const count = el('span', 'text-label-medium content-default');
    const all = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis underline cursor-pointer text-body-medium', lt('Select All'));
    all.type = 'button';
    listHead.append(count, all);
    const grid = el('ul', 'routility-rot-grid');
    grid.setAttribute('aria-label', lt('Characters'));
    for (let i = 0; i < 12; i++) {
      const li = el('li', 'routility-rot-tile');
      li.appendChild(el('span', 'routility-sk routility-rot-thumb'));
      li.appendChild(el('span', 'routility-sk routility-rot-sk-name'));
      grid.appendChild(li);
    }

    const foot = el('div', 'routility-tc-foot');
    const status = el('p', 'text-body-small content-muted routility-rot-status');
    status.setAttribute('role', 'status');
    const spacer = el('span', 'routility-tc-spacer');
    const cancel = button(lt('Cancel'), 'bg-action-standard content-action-standard');
    const save = button(lt('Save'), 'bg-action-emphasis content-action-emphasis');
    cancel.addEventListener('click', close);
    foot.append(status, spacer, cancel, save);

    dialog.append(closeBox, title, intro, controls, listHead, grid, foot);
    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    s.onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.routility-rot-modal .dropdown-menu[style*="block"]')) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', s.onKey, true);
    document.body.appendChild(overlay);
    s.modal = overlay;
    dialog.focus();

    let outfits = null;
    let current = saved;
    const tiles = new Map();
    const thumbs = new Map();

    const changed = () => draft.on !== !!current.on || draft.every !== (current.every || '15') || draft.order !== (current.order || 'order') || draft.ids.join() !== (current.ids || []).join();
    const paintStatus = () => {
      const parts = [];
      if (!draft.every) parts.push(lt('Pick a time between 30 seconds and 7 days.'));
      else if (changed()) parts.push(draft.on && draft.ids.length < 2 ? lt('Pick at least 2 characters to rotate.') : lt('Save to apply your changes.'));
      else if (!current.on) parts.push(lt('Rotation is off.'));
      else if ((current.ids || []).length < 2) parts.push(lt('Pick at least 2 characters to rotate.'));
      else if (current.next) parts.push(lt('Next change {when}, once you leave the avatar editor.', { when: when(current.next - Date.now()) }));
      if (!changed() && current.last && current.lastName) parts.push(lt('Last changed to {name} {ago}.', { name: current.lastName, ago: ago(Date.now() - current.last) }));
      else if (!changed() && current.error) parts.push(lt('The last change didn’t go through. It will try again next time.'));
      status.textContent = parts.join(' ');
    };
    const sync = () => {
      const known = outfits ? draft.ids.filter(id => outfits.some(o => o.id === id)) : draft.ids;
      count.textContent = ltn(known.length, '{n} character selected', '{n} characters selected');
      all.textContent = outfits && outfits.length && known.length === outfits.length ? lt('Clear') : lt('Select All');
      all.hidden = !outfits || !outfits.length;
      for (const [id, tile] of tiles) {
        const n = draft.ids.indexOf(id);
        tile.btn.setAttribute('aria-pressed', String(n >= 0));
        tile.li.classList.toggle('routility-rot-on', n >= 0);
        tile.num.textContent = n >= 0 && draft.order === 'order' ? String(n + 1) : '';
        tile.num.hidden = n < 0;
      }
      save.disabled = !draft.every || !changed() || (draft.on && draft.ids.length < 2);
      paintStatus();
    };
    all.addEventListener('click', () => {
      if (!outfits) return;
      draft.ids = draft.ids.length >= outfits.length ? [] : outfits.map(o => o.id);
      sync();
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      save.label.textContent = lt('Saving…');
      const res = await ask({ type: 'rotatorSave', on: draft.on, ids: draft.ids, every: draft.every, order: draft.order });
      if (state !== s || s.modal !== overlay) return;
      save.label.textContent = lt('Save');
      if (!res) {
        status.textContent = lt('Couldn’t save right now. Try again.');
        save.disabled = false;
        return;
      }
      current = res;
      s.savedJob = Promise.resolve(res);
      draft.ids = (res.ids || []).map(String);
      sync();
      close();
      if (!res.on) toast(lt('Outfit Rotator saved. Rotation is off.'));
      else if ((res.ids || []).length < 2) toast(lt('Outfit Rotator saved. Pick at least 2 characters to start rotating.'));
      else toast(lt('Outfit Rotator is on. Next change {when}, once you leave the avatar editor.', { when: res.next ? when(res.next - Date.now()) : '' }));
    });
    sync();

    outfits = me ? await loadOutfits(me) : null;
    if (state !== s || s.modal !== overlay) return;
    grid.textContent = '';
    if (!outfits) {
      grid.appendChild(el('li', 'text-body-medium content-muted routility-rot-empty', lt('Couldn’t load your characters right now. Try again in a minute.')));
      sync();
      return;
    }
    if (!outfits.length) {
      grid.appendChild(el('li', 'text-body-medium content-muted routility-rot-empty', lt('You don’t have any characters yet. Use Create New Character to save your current look, then pick it here.')));
      sync();
      return;
    }
    for (const o of outfits) {
      const li = el('li', 'routility-rot-tile');
      const btn = el('button', 'routility-rot-pick');
      btn.type = 'button';
      btn.setAttribute('aria-label', o.name);
      const frame = el('span', 'routility-rot-thumb');
      frame.appendChild(el('span', 'routility-sk routility-rot-thumb-sk'));
      const num = el('span', 'routility-rot-num text-label-small');
      num.hidden = true;
      const check = el('span', 'routility-rot-check icon icon-filled-circle-check');
      check.setAttribute('aria-hidden', 'true');
      frame.append(num, check);
      btn.append(frame, el('span', 'routility-rot-name text-body-small content-default', o.name));
      btn.addEventListener('click', () => {
        const i = draft.ids.indexOf(o.id);
        if (i >= 0) draft.ids.splice(i, 1);
        else draft.ids.push(o.id);
        if (draft.ids.length >= 2 && !current.on && !draft.on && !draft.switched) {
          draft.on = true;
          sw.set(true);
        }
        sync();
      });
      li.appendChild(btn);
      grid.appendChild(li);
      tiles.set(o.id, { li, btn, num, frame });
    }
    draft.ids = draft.ids.filter(id => tiles.has(id)).concat(draft.ids.filter(id => !tiles.has(id)));
    sync();
    loadThumbs(outfits.map(o => o.id), (id, url) => {
      const t = tiles.get(id);
      if (!t || thumbs.has(id)) return;
      thumbs.set(id, url);
      const img = el('img', 'routility-rot-img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        img.classList.add('routility-loaded');
        t.frame.querySelector('.routility-rot-thumb-sk')?.remove();
      }, { once: true });
      img.src = url;
      t.frame.prepend(img);
    });
  }

  function place() {
    if (!state) return;
    const pane = document.querySelector('#avatar-web-app #costumes.tab-pane');
    const create = pane && pane.querySelector(':scope > div:first-child > .btn-float-right:not(.routility-rot-open)');
    if (!create) return;
    if (create.parentElement.querySelector(':scope > .routility-rot-open')) return;
    const b = el('button', SMALL + 'btn-float-right routility-injected routility-rot-open');
    b.type = 'button';
    const l = el('div', LAYER);
    l.setAttribute('aria-hidden', 'true');
    const inner = el('span', 'flex items-center min-width-0 gap-xsmall');
    inner.appendChild(el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', lt('Outfit Rotator')));
    b.append(l, inner);
    b.addEventListener('click', open);
    state.trigger = b;
    create.after(b);
  }

  function setup() {
    if (state) return;
    state = { modal: null, trigger: null, onKey: null };
    state.savedJob = ask({ type: 'rotatorState' });
    state.onStore = (changes, area) => {
      if (area === 'local' && changes.routilityRotator && state) state.savedJob = ask({ type: 'rotatorState' });
    };
    chrome.storage.onChanged.addListener(state.onStore);
    state.observer = new MutationObserver(onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
    let wanted = false;
    try {
      wanted = sessionStorage.getItem('routilityOpenRotator') === '1';
      sessionStorage.removeItem('routilityOpenRotator');
    } catch {}
    if (wanted) setTimeout(open, 1200);
  }

  function teardown() {
    if (!state) return;
    close();
    chrome.storage.onChanged.removeListener(state.onStore);
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-rot-open, .routility-rot-modal').forEach(n => n.remove());
  }

  window.RoUtilityRotator = { setup, teardown, open: () => { if (state) open(); } };
})();
