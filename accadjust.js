(function () {
  'use strict';

  const { el, onFrame } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const API = 'https://avatar.roblox.com/';
  const TABS = [['position', LT('Move')], ['rotation', LT('Rotate')], ['scale', LT('Scale')]];
  const AXES = ['X', 'Y', 'Z'];
  const DEFAULT = { position: { X: 0, Y: 0, Z: 0 }, rotation: { X: 0, Y: 0, Z: 0 }, scale: { X: 1, Y: 1, Z: 1 } };
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ';

  let state = null;
  let csrf = '';

  async function send(url, body) {
    for (let i = 0; i < 3; i++) {
      let r;
      try {
        r = await fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
      } catch {
        return { ok: false, status: 0, data: null };
      }
      if (r.status === 403 && r.headers.get('x-csrf-token')) {
        csrf = r.headers.get('x-csrf-token');
        continue;
      }
      let data = null;
      try { data = await r.json(); } catch {}
      return { ok: r.ok, status: r.status, data };
    }
    return { ok: false, status: 403, data: null };
  }

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  function saveError(r, items) {
    const raw = String((r.data && r.data.errors && r.data.errors[0] && r.data.errors[0].message) || '');
    const id = Number((raw.match(/"FieldData"\s*:\s*"?(\d+)/) || [])[1]);
    const item = id ? items.find(a => a.id === id) : null;
    if (/refinement/i.test(raw)) return item ? lt('Roblox wouldn’t save the adjustment to {name}. Try a smaller change.', { name: item.name }) : lt('Roblox wouldn’t save that adjustment. Try a smaller change.');
    if (raw && !/[{}"]/.test(raw) && raw.length <= 140) return raw;
    if (r.status === 429) return lt('Roblox says to slow down. Try again in a minute.');
    return lt('Roblox didn’t save it. Try again.');
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

  const copy = (v) => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function fromMeta(meta) {
    const out = copy(DEFAULT);
    for (const [key] of TABS) for (const x of AXES) if (meta && meta[key] && Number.isFinite(Number(meta[key][x]))) out[key][x] = Number(meta[key][x]);
    return out;
  }

  function withAdjust(meta, adj) {
    const base = { ...(meta || {}) };
    delete base.position;
    delete base.rotation;
    delete base.scale;
    if (adj && !same(adj, DEFAULT)) Object.assign(base, copy(adj));
    if (!Object.keys(base).length) return null;
    if (base.version == null) base.version = 1;
    return base;
  }

  function bounds(rules, typeName) {
    const lo = rules && rules.accessoryRefinementLowerBounds && rules.accessoryRefinementLowerBounds[typeName];
    const hi = rules && rules.accessoryRefinementUpperBounds && rules.accessoryRefinementUpperBounds[typeName];
    if (!lo || !hi) return null;
    const pick = (b) => ({
      position: { X: b.position.xPosition, Y: b.position.yPosition, Z: b.position.zPosition },
      rotation: { X: b.rotation.xRotation, Y: b.rotation.yRotation, Z: b.rotation.zRotation },
      scale: { X: b.scale.xScale, Y: b.scale.yScale, Z: b.scale.zScale },
    });
    return { lo: pick(lo), hi: pick(hi) };
  }

  function close() {
    if (!state || !state.modal) return;
    const saved = state.saved;
    state.modal.remove();
    document.removeEventListener('keydown', state.onKey, true);
    state.modal = null;
    state.preview?.dispose();
    state.preview = null;
    state.trigger?.focus();
    if (saved) location.reload();
  }

  function open() {
    if (!state || state.modal) return;
    const s = state;
    s.saved = false;
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal routility-aa-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-tc-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-aa-title');
    const closeBox = el('div', 'absolute foundation-web-dialog-close-container');
    const x = el('button', 'foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus bg-over-media-100 padding-small radius-circle');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    const xl = el('div', LAYER);
    xl.setAttribute('aria-hidden', 'true');
    x.append(xl, el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]'));
    closeBox.appendChild(x);
    const title = el('h2', 'text-heading-small routility-tc-title', lt('Adjust Accessories'));
    title.id = 'routility-aa-title';
    const body = el('div', 'routility-tc-body');
    const left = el('div', 'routility-tc-left');
    const frame = el('div', 'routility-tc-frame routility-tc-wait routility-aa-frame');
    const canvas = el('canvas', 'routility-aa-canvas');
    const shade = el('div', 'routility-sk routility-tc-shade');
    frame.append(canvas, shade);
    const status = el('p', 'text-body-small content-muted routility-tc-status');
    status.setAttribute('role', 'status');
    left.append(frame, status);
    const right = el('div', 'routility-tc-right');
    const pickHead = el('div', 'routility-tc-slider-head');
    pickHead.append(el('span', 'text-label-medium content-default', lt('Accessory')), el('span', 'text-body-medium content-muted routility-tc-value routility-aa-name'));
    const picker = el('ul', 'routility-tc-emotes routility-aa-picker');
    picker.setAttribute('role', 'listbox');
    picker.setAttribute('aria-label', lt('Accessory'));
    for (let i = 0; i < 5; i++) picker.appendChild(el('li', 'routility-tc-emote routility-sk'));
    const tabs = el('div', 'routility-tc-tabs routility-aa-tabs');
    tabs.setAttribute('role', 'tablist');
    const sliders = el('div', 'routility-aa-sliders');
    const note = el('p', 'text-body-small content-muted routility-aa-note');
    right.append(pickHead, picker, tabs, sliders, note);
    body.append(left, right);
    const foot = el('div', 'routility-tc-foot');
    const reset = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis underline cursor-pointer text-body-medium routility-tc-reset', lt('Reset Accessory'));
    reset.type = 'button';
    const spacer = el('span', 'routility-tc-spacer');
    const cancel = button(lt('Cancel'), 'bg-action-standard content-action-standard');
    const apply = button(lt('Apply'), 'bg-action-emphasis content-action-emphasis');
    foot.append(reset, spacer, cancel, apply);
    dialog.append(closeBox, title, body, foot);
    overlay.appendChild(dialog);

    let rules = null;
    let items = [];
    let sel = null;
    let tab = 'position';
    let busy = false;
    const edits = new Map();
    const original = new Map();

    const setStatus = (text, bad) => {
      status.textContent = text || lt('Drag to turn your avatar. Scroll to zoom in or out.');
      status.classList.toggle('routility-tc-bad', !!bad);
    };
    setStatus('');
    const changed = () => items.filter(a => !same(edits.get(a.id), original.get(a.id)));
    const sync = () => {
      apply.disabled = busy || !changed().length;
      reset.disabled = busy || !sel || same(edits.get(sel.id), DEFAULT);
      cancel.disabled = busy;
    };

    const paintSliders = () => {
      sliders.textContent = '';
      if (!sel) return;
      const adj = edits.get(sel.id);
      const lim = sel.bounds;
      for (const axis of AXES) {
        const lo = lim.lo[tab][axis];
        const hi = lim.hi[tab][axis];
        const row = el('div', 'routility-tc-slider');
        const head = el('div', 'routility-tc-slider-head');
        const name = el('label', 'text-label-medium content-default routility-aa-axis');
        name.append(el('span', 'routility-aa-dot routility-aa-dot-' + axis.toLowerCase(), axis));
        const value = el('span', 'text-body-medium content-muted routility-tc-value');
        head.append(name, value);
        const input = el('input', 'routility-tc-range');
        input.type = 'range';
        input.min = String(lo);
        input.max = String(hi);
        input.step = tab === 'rotation' ? '0.5' : '0.01';
        input.id = `routility-aa-${tab}-${axis}`;
        name.htmlFor = input.id;
        input.value = String(adj[tab][axis]);
        const fmt = (v) => (tab === 'rotation' ? `${v.toFixed(1).replace(/\.0$/, '')}°` : tab === 'scale' ? `${Math.round(v * 100)}%` : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);
        const paint = () => {
          const v = Number(input.value);
          input.style.setProperty('--rt-fill', ((v - lo) / (hi - lo) * 100) + '%');
          value.textContent = fmt(v);
        };
        input.addEventListener('input', () => {
          const v = Math.max(lo, Math.min(hi, Number(input.value)));
          adj[tab][axis] = Math.round(v * 1000) / 1000;
          paint();
          s.preview?.set(sel.id, adj);
          sync();
        });
        paint();
        row.append(head, input);
        sliders.appendChild(row);
      }
    };

    const paintTabs = () => {
      tabs.textContent = '';
      for (const [key, label] of TABS) {
        const b = el('button', 'routility-tc-tab text-label-medium' + (key === tab ? ' routility-tc-tab-on' : ''), lt(label));
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(key === tab));
        b.disabled = !sel;
        b.addEventListener('click', () => {
          tab = key;
          paintTabs();
          paintSliders();
        });
        tabs.appendChild(b);
      }
    };

    const choose = (item) => {
      sel = item;
      for (const li of picker.children) {
        const on = li.dataset.id === String(item.id);
        li.classList.toggle('routility-tc-on', on);
        li.setAttribute('aria-selected', String(on));
      }
      overlay.querySelector('.routility-aa-name').textContent = item.name;
      paintTabs();
      paintSliders();
      sync();
    };

    const paintPicker = (thumbs) => {
      picker.textContent = '';
      for (const item of items) {
        const li = el('li', 'routility-tc-emote routility-tc-wait');
        li.dataset.id = String(item.id);
        li.dataset.rtTip = item.name;
        li.setAttribute('role', 'option');
        li.tabIndex = 0;
        const src = thumbs && thumbs[item.id];
        if (src) {
          const im = el('img', 'routility-fade');
          im.alt = '';
          im.addEventListener('load', () => {
            im.classList.add('routility-loaded');
            li.classList.remove('routility-tc-wait');
          }, { once: true });
          im.src = src;
          li.appendChild(im);
        }
        li.addEventListener('click', () => choose(item));
        li.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            choose(item);
          }
        });
        picker.appendChild(li);
      }
      if (sel) choose(sel);
    };

    const commit = async () => {
      if (busy) return;
      const list = changed();
      if (!list.length) return;
      busy = true;
      sync();
      apply.label.textContent = lt('Saving');
      setStatus('');
      const fresh = await getJson(API + 'v2/avatar/avatar');
      let failed = '';
      if (!fresh || !Array.isArray(fresh.assets)) failed = lt('Couldn’t read your avatar. Try again.');
      if (!failed) {
        const assets = fresh.assets.map((a) => {
          const adj = edits.has(a.id) ? edits.get(a.id) : null;
          const meta = adj ? withAdjust(a.meta, adj) : a.meta;
          return meta ? { id: a.id, meta } : { id: a.id };
        });
        const r = await send(API + 'v2/avatar/set-wearing-assets', { assets });
        if (!r.ok || (r.data && r.data.success === false)) failed = saveError(r, items);
      }
      if (!failed) {
        const check = await getJson(API + 'v2/avatar/avatar');
        const lost = check && Array.isArray(check.assets) && list.find((item) => {
          const now = check.assets.find(a => a.id === item.id);
          const got = fromMeta(now && now.meta);
          const want = edits.get(item.id);
          return TABS.some(([k]) => AXES.some(axis => Math.abs(got[k][axis] - want[k][axis]) > 0.011));
        });
        if (lost) failed = lt('Roblox didn’t keep the change to {name}.', { name: lost.name });
        else {
          for (const item of list) original.set(item.id, copy(edits.get(item.id)));
          s.saved = true;
          send(API + 'v1/avatar/redraw-thumbnail');
        }
      }
      busy = false;
      apply.label.textContent = lt('Apply');
      sync();
      setStatus(failed || lt('Saved. The editor reloads when you close this so it keeps your changes.'), !!failed);
    };

    apply.addEventListener('click', commit);
    reset.addEventListener('click', () => {
      if (!sel || busy) return;
      edits.set(sel.id, copy(DEFAULT));
      s.preview?.set(sel.id, DEFAULT);
      paintSliders();
      sync();
    });
    const shut = () => { if (!busy) close(); };
    cancel.addEventListener('click', shut);
    x.addEventListener('click', shut);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(); });
    s.onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        shut();
      }
    };
    document.addEventListener('keydown', s.onKey, true);
    s.modal = overlay;
    document.body.appendChild(overlay);
    paintTabs();
    sync();
    dialog.tabIndex = -1;
    dialog.focus();

    (async () => {
      const [ui, rulesRes] = await Promise.all([
        Promise.all([import(chrome.runtime.getURL('preview/ui.js')), import(chrome.runtime.getURL('mesh.js'))]).then(([m]) => m),
        getJson(API + 'v1/avatar-rules'),
      ]);
      if (state !== s || s.modal !== overlay) return;
      rules = rulesRes;
      let preview = null;
      try {
        preview = await ui.adjustPreview(canvas);
      } catch {}
      if (state !== s || s.modal !== overlay) {
        preview?.dispose();
        return;
      }
      frame.classList.remove('routility-tc-wait');
      if (!preview || !rules) {
        picker.textContent = '';
        setStatus(lt('Couldn’t load your avatar right now. Try again in a minute.'), true);
        return;
      }
      s.preview = preview;
      const types = new Set(rules.accessoryRefinementTypes || []);
      items = (preview.data.assets || []).filter(a => a.assetType && types.has(a.assetType.id)).map(a => ({ id: a.id, name: a.name || lt('Accessory'), meta: a.meta, bounds: bounds(rules, a.assetType.name) })).filter(a => a.bounds);
      for (const a of items) {
        edits.set(a.id, fromMeta(a.meta));
        original.set(a.id, fromMeta(a.meta));
      }
      if (!items.length) {
        picker.textContent = '';
        note.textContent = lt('You aren’t wearing anything that can be adjusted. Hats, face, neck, shoulder, front and back accessories can be.');
        return;
      }
      note.textContent = lt('Drag the preview to look around. Hair and waist accessories can’t be adjusted.');
      sel = items[0];
      paintPicker(null);
      const thumbs = await new Promise(r => chrome.runtime.sendMessage({ type: 'getAssetThumbs', ids: items.map(a => String(a.id)) }, (res) => { void chrome.runtime.lastError; r(res || {}); }));
      if (state === s && s.modal === overlay) paintPicker(thumbs);
    })();
  }

  function place() {
    if (!state) return;
    const redraw = document.querySelector('#avatar-web-app .left-wrapper .redraw-avatar');
    if (!redraw) return;
    if (redraw.parentElement.querySelector(':scope > .routility-aa-open')) return;
    const b = button(lt('Adjust Accessories'), 'bg-action-standard content-action-standard routility-injected routility-aa-open');
    b.addEventListener('click', open);
    state.trigger = b;
    const after = redraw.parentElement.querySelector(':scope > .routility-tc-open') || redraw;
    after.after(b);
  }

  function setup() {
    if (state) return;
    state = { modal: null, trigger: null, preview: null, saved: false };
    state.observer = new MutationObserver(onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!state) return;
    state.saved = false;
    close();
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-aa-open, .routility-aa-modal').forEach(n => n.remove());
  }

  window.RoUtilityAccAdjust = { setup, teardown };
})();
