(function () {
  'use strict';

  const { el } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const API = 'https://avatar.roblox.com/v1/avatar/';
  const TYPES = [
    { id: 2, key: 'body', label: LT('Full Body'), thumb: 'avatar', distance: false },
    { id: 1, key: 'head', label: LT('Headshot'), thumb: 'avatar-headshot', distance: true },
  ];
  const DEFAULT = { emote: 0, fov: 30, rot: 0, dist: -1 };
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ';

  let state = null;
  let csrf = '';

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  async function send(url, body) {
    for (let i = 0; i < 3; i++) {
      let r;
      try {
        r = await fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
      } catch {
        return { ok: false, status: 0, data: null };
      }
      if (r.status === 403 && r.headers.get('x-csrf-token')) { csrf = r.headers.get('x-csrf-token'); continue; }
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

  async function loadCurrent() {
    const res = await getJson(API + 'thumbnail-customizations');
    const out = {};
    for (const t of TYPES) out[t.id] = { ...DEFAULT };
    for (const c of (res && res.avatarThumbnailCustomizations) || []) {
      if (!out[c.thumbnailType]) continue;
      out[c.thumbnailType] = { emote: Number(c.emoteAssetId) || 0, fov: Number(c.camera?.fieldOfViewDeg) || 30, rot: Number(c.camera?.yRotDeg) || 0, dist: Number(c.camera?.distanceScale) || -1 };
    }
    return out;
  }

  async function loadEmotes() {
    const id = me();
    if (!id) return [];
    const list = [];
    let cursor = '';
    for (let i = 0; i < 5; i++) {
      const res = await getJson(`https://inventory.roblox.com/v2/users/${id}/inventory/61?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!res) break;
      for (const a of res.data || []) list.push({ id: Number(a.assetId), name: a.assetName || lt('Emote') });
      cursor = res.nextPageCursor;
      if (!cursor) break;
    }
    const seen = new Set();
    return list.filter(e => e.id && !seen.has(e.id) && seen.add(e.id));
  }

  async function assetThumbs(ids) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const res = await getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.slice(i, i + 100).join(',')}&size=150x150&format=Webp`);
      for (const t of (res && res.data) || []) if (t.state === 'Completed' && t.imageUrl) out.set(t.targetId, t.imageUrl);
    }
    return out;
  }

  async function avatarThumb(type) {
    const id = me();
    const res = await getJson(`https://thumbnails.roblox.com/v1/users/${type.thumb}?userIds=${id}&size=420x420&format=Png&_=${Date.now()}`);
    const t = res && res.data && res.data[0];
    return t ? { state: t.state, url: t.imageUrl || '' } : null;
  }

  function slider(label, min, max, step, fmt) {
    const row = el('div', 'routility-tc-slider');
    const head = el('div', 'routility-tc-slider-head');
    const name = el('label', 'text-label-medium content-default', lt(label));
    const value = el('span', 'text-body-medium content-muted routility-tc-value');
    head.append(name, value);
    const input = el('input', 'routility-tc-range');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.id = 'routility-tc-' + label.toLowerCase().replace(/\W+/g, '-');
    name.htmlFor = input.id;
    const paint = () => {
      const pct = (Number(input.value) - min) / (max - min) * 100;
      input.style.setProperty('--rt-fill', pct + '%');
      value.textContent = fmt(Number(input.value), input);
    };
    input.addEventListener('input', paint);
    row.append(head, input);
    return { row, input, paint };
  }

  function close() {
    if (!state || !state.modal) return;
    state.modal.remove();
    document.removeEventListener('keydown', state.onKey, true);
    state.modal = null;
    state.live?.dispose();
    state.live = null;
    state.trigger?.focus();
  }

  function open() {
    if (!state || state.modal) return;
    const s = state;
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-tc-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-tc-title');
    const closeBox = el('div', 'absolute foundation-web-dialog-close-container');
    const x = el('button', 'foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus bg-over-media-100 padding-small radius-circle');
    x.type = 'button';
    x.setAttribute('aria-label', lt('Close'));
    const xl = el('div', LAYER);
    xl.setAttribute('aria-hidden', 'true');
    x.append(xl, el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]'));
    closeBox.appendChild(x);
    const title = el('h2', 'text-heading-small routility-tc-title', lt('Customize Thumbnail'));
    title.id = 'routility-tc-title';
    const tabs = el('div', 'routility-tc-tabs');
    tabs.setAttribute('role', 'tablist');
    const body = el('div', 'routility-tc-body');
    const left = el('div', 'routility-tc-left');
    const frame = el('div', 'routility-tc-frame');
    const img = el('img', 'routility-tc-img');
    img.alt = '';
    const shade = el('div', 'routility-sk routility-tc-shade');
    const liveCanvas = el('canvas', 'routility-tc-live');
    const liveTag = el('span', 'routility-tc-live-tag text-label-small', lt('Preview'));
    liveTag.dataset.rtTip = lt('How it will roughly look. Save to get Roblox’s real thumbnail.');
    frame.append(img, liveCanvas, liveTag, shade);
    const status = el('p', 'text-body-small content-muted routility-tc-status');
    status.setAttribute('role', 'status');
    left.append(frame, status);
    const right = el('div', 'routility-tc-right');
    const poseHead = el('div', 'routility-tc-slider-head');
    poseHead.append(el('span', 'text-label-medium content-default', lt('Pose')), el('span', 'text-body-medium content-muted routility-tc-value routility-tc-pose-name'));
    const search = el('div', 'foundation-web-input flex items-center width-full stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-tc-search');
    const sIcon = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
    sIcon.setAttribute('aria-hidden', 'true');
    const sInput = el('input', 'width-full padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted text-body-medium');
    sInput.type = 'text';
    sInput.placeholder = lt('Search your emotes');
    sInput.setAttribute('aria-label', lt('Search your emotes'));
    search.append(sIcon, sInput);
    const grid = el('ul', 'routility-tc-emotes');
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', lt('Pose'));
    const fov = slider(LT('Field of View'), 15, 45, 0.5, v => v.toFixed(1).replace(/\.0$/, '') + '°');
    const rot = slider(LT('Rotation'), -60, 60, 0.5, v => v.toFixed(1).replace(/\.0$/, '') + '°');
    const dist = slider(LT('Distance'), 0.5, 4, 0.05, (v, i) => i.dataset.auto === '1' ? lt('Auto') : Math.round(v * 100) + '%');
    dist.input.addEventListener('input', () => { dist.input.dataset.auto = '0'; dist.paint(); });
    const poseNote = el('p', 'text-body-small content-muted routility-tc-pose-note', lt('Poses need an R15 avatar. Switch to R15 in the editor to use one.'));
    poseNote.hidden = true;
    const poseBox = el('div', 'routility-tc-pose');
    poseBox.append(search, grid);
    right.append(poseHead, poseNote, poseBox, fov.row, rot.row, dist.row);
    getJson('https://avatar.roblox.com/v2/avatar/avatar').then((av) => {
      const r6 = !!av && av.playerAvatarType !== 'R15';
      poseNote.hidden = !r6;
      poseBox.classList.toggle('routility-tc-pose-off', r6);
      sInput.disabled = r6;
    });
    body.append(left, right);
    const foot = el('div', 'routility-tc-foot');
    const reset = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis underline cursor-pointer text-body-medium routility-tc-reset', lt('Reset to Default'));
    reset.type = 'button';
    const spacer = el('span', 'routility-tc-spacer');
    const cancel = button(lt('Cancel'), 'bg-action-standard content-action-standard');
    const save = button(lt('Save'), 'bg-action-emphasis content-action-emphasis');
    foot.append(reset, spacer, cancel, save);
    dialog.append(closeBox, title, tabs, body, foot);
    overlay.appendChild(dialog);

    const edits = {};
    let tab = TYPES[0];
    let busy = false;
    let emotes = null;
    let pics = new Map();

    const cur = () => edits[tab.id];
    const setStatus = (text, bad) => {
      status.textContent = text || '';
      status.classList.toggle('routility-tc-bad', !!bad);
    };
    const dirty = (t) => {
      const a = edits[t.id];
      const b = s.current[t.id];
      return a && b && (a.emote !== b.emote || a.fov !== b.fov || a.rot !== b.rot || a.dist !== b.dist);
    };
    const syncSave = () => {
      save.disabled = busy || !TYPES.some(dirty);
      reset.disabled = busy;
      cancel.disabled = busy;
      refreshLive();
    };

    let liveP = null;
    let liveTimer = null;
    const ensureLive = () => liveP || (liveP = Promise.all([import(chrome.runtime.getURL('src/preview/ui.js')), import(chrome.runtime.getURL('src/preview/mesh.js'))])
      .then(async ([ui]) => {
        const ctl = await ui.thumbPreview(liveCanvas);
        if (state !== s || s.modal !== overlay) {
          ctl.dispose();
          return null;
        }
        s.live = ctl;
        return ctl;
      })
      .catch(() => null));
    const refreshLive = () => {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(async () => {
        const t = tab;
        const on = !!(s.current && dirty(t));
        frame.classList.toggle('routility-tc-live-on', on);
        if (!on) return;
        const first = !liveP;
        if (first) frame.classList.add('routility-tc-loading');
        const ctl = await ensureLive();
        if (first) frame.classList.remove('routility-tc-loading');
        if (!ctl || tab !== t || state !== s || s.modal !== overlay) {
          if (!ctl) frame.classList.remove('routility-tc-live-on');
          return;
        }
        const e = edits[t.id];
        await ctl.set({ head: t.id === 1, emote: e.emote, fov: e.fov, rot: e.rot, dist: e.dist });
      }, 60);
    };

    let retried = 0;
    let shown = 0;
    const setImg = (url) => {
      const n = ++shown;
      frame.classList.add('routility-tc-wait');
      img.classList.remove('routility-tc-ready');
      if (!url) return;
      const probe = new Image();
      probe.onload = () => {
        if (n !== shown) return;
        retried = 0;
        img.src = url;
        img.classList.add('routility-tc-ready');
        frame.classList.remove('routility-tc-wait');
      };
      probe.onerror = () => {
        if (n !== shown || retried >= 3) return;
        retried++;
        const t = tab;
        delete s.thumbs[t.id];
        setTimeout(() => { if (tab === t && state === s && s.modal === overlay) showThumb(t, false); }, 1500);
      };
      probe.src = url;
    };

    const showThumb = async (t, wantChange) => {
      const before = s.thumbs[t.id];
      frame.classList.add('routility-tc-loading');
      for (let i = 0; i < (wantChange ? 20 : 8); i++) {
        const r = await avatarThumb(t);
        if (r && r.state === 'Completed' && r.url && (!wantChange || r.url !== before)) {
          s.thumbs[t.id] = r.url;
          if (tab === t) setImg(r.url);
          if (t.id === 2) {
            const page = document.querySelector('#UserAvatar .thumbnail-2d-container img');
            if (page) page.src = r.url.replace('/420/420/', '/352/352/');
          }
          if (tab === t) frame.classList.remove('routility-tc-loading');
          return true;
        }
        await new Promise(res => setTimeout(res, 1500));
      }
      if (tab === t) {
        frame.classList.remove('routility-tc-loading');
        if (before) setImg(before);
      }
      return false;
    };

    const paintEmotes = () => {
      grid.textContent = '';
      const q = sInput.value.trim().toLowerCase();
      const e = cur();
      const tile = (id, name, src) => {
        const li = el('li', 'routility-tc-emote' + (e.emote === id ? ' routility-tc-on' : ''));
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(e.emote === id));
        li.tabIndex = 0;
        li.dataset.rtTip = name;
        if (id === 0) li.appendChild(el('span', 'text-label-small content-default routility-tc-none', lt('None')));
        else {
          const im = el('img', 'routility-fade');
          im.alt = '';
          li.classList.add('routility-tc-wait');
          im.addEventListener('load', () => {
            im.classList.add('routility-loaded');
            li.classList.remove('routility-tc-wait');
          }, { once: true });
          if (src) im.src = src;
          li.appendChild(im);
        }
        const pick = () => {
          if (busy) return;
          e.emote = id;
          for (const x of grid.children) {
            x.classList.toggle('routility-tc-on', x === li);
            if (x.hasAttribute('aria-selected')) x.setAttribute('aria-selected', String(x === li));
          }
          poseName();
          syncSave();
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
        return li;
      };
      if (!emotes) {
        for (let i = 0; i < 12; i++) grid.appendChild(el('li', 'routility-tc-emote routility-sk'));
        return;
      }
      grid.appendChild(tile(0, lt('No pose')));
      const known = emotes.some(x => x.id === e.emote);
      const list = e.emote && !known ? [{ id: e.emote, name: lt('Current pose') }, ...emotes] : emotes;
      for (const m of list) if (!q || m.name.toLowerCase().includes(q)) grid.appendChild(tile(m.id, m.name, pics.get(m.id)));
      if (!emotes.length) grid.appendChild(el('li', 'text-body-small content-muted routility-tc-empty', lt('You don’t own any emotes yet.')));
    };

    const poseName = () => {
      const e = cur();
      const hit = emotes && emotes.find(m => m.id === e.emote);
      overlay.querySelector('.routility-tc-pose-name').textContent = e.emote ? (hit ? hit.name : lt('Asset {id}', { id: e.emote })) : lt('None');
    };

    const paintControls = () => {
      const e = cur();
      fov.input.value = String(e.fov);
      rot.input.value = String(e.rot);
      dist.row.hidden = !tab.distance;
      dist.input.dataset.auto = e.dist < 0 ? '1' : '0';
      dist.input.value = String(e.dist < 0 ? 1 : e.dist);
      fov.paint();
      rot.paint();
      dist.paint();
      poseName();
      paintEmotes();
      syncSave();
    };

    fov.input.addEventListener('input', () => { cur().fov = Number(fov.input.value); syncSave(); });
    rot.input.addEventListener('input', () => { cur().rot = Number(rot.input.value); syncSave(); });
    dist.input.addEventListener('input', () => { cur().dist = Number(dist.input.value); syncSave(); });
    sInput.addEventListener('input', paintEmotes);

    const tabButtons = TYPES.map((t) => {
      const b = el('button', 'routility-tc-tab text-label-medium', lt(t.label));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => {
        if (tab === t) return;
        tab = t;
        tabButtons.forEach((x, i) => { x.setAttribute('aria-selected', String(TYPES[i] === t)); x.classList.toggle('routility-tc-tab-on', TYPES[i] === t); });
        frame.classList.toggle('routility-tc-head', t.id === 1);
        setImg(s.thumbs[t.id] || '');
        if (!s.thumbs[t.id]) showThumb(t, false);
        setStatus('');
        paintControls();
      });
      tabs.appendChild(b);
      return b;
    });
    tabButtons[0].setAttribute('aria-selected', 'true');
    tabButtons[0].classList.add('routility-tc-tab-on');

    const body0 = (t, e) => ({ thumbnailType: t.id, emoteAssetId: e.emote, camera: { fieldOfViewDeg: e.fov, yRotDeg: e.rot, distanceScale: t.distance ? e.dist : -1 } });

    const commit = async (list) => {
      busy = true;
      syncSave();
      save.label.textContent = lt('Saving');
      setStatus('');
      let failed = '';
      for (const t of list) {
        const r = await send(API + 'thumbnail-customization', body0(t, edits[t.id]));
        if (!r.ok) {
          failed = (r.data && r.data.errors && r.data.errors[0] && r.data.errors[0].message) || (r.status === 429 ? lt('Roblox says to slow down. Try again in a minute.') : lt('Roblox didn’t save it. Try again.'));
          break;
        }
        s.current[t.id] = { ...edits[t.id] };
      }
      if (!failed && list.some(t => edits[t.id].emote)) {
        const kept = await loadCurrent();
        const lost = list.find(t => edits[t.id].emote && kept[t.id].emote !== edits[t.id].emote);
        if (lost) {
          failed = lt('Roblox didn’t keep the pose. Poses only work on an R15 avatar, with an emote you own.');
          for (const t of list) s.current[t.id] = { ...kept[t.id] };
        }
      }
      if (!failed) await send(API + 'redraw-thumbnail');
      busy = false;
      save.label.textContent = lt('Save');
      syncSave();
      if (failed) {
        setStatus(failed, true);
        return;
      }
      setStatus(lt('Saved. Roblox is drawing your new thumbnail.'));
      for (const t of list) showThumb(t, true).then((done) => {
        if (tab === t && state === s) setStatus(done ? lt('Saved.') : lt('Saved. Your new thumbnail can take a minute to show up.'));
      });
    };

    save.addEventListener('click', () => {
      if (busy) return;
      const list = TYPES.filter(dirty);
      if (list.length) commit(list);
    });
    reset.addEventListener('click', () => {
      if (busy) return;
      edits[tab.id] = { ...DEFAULT };
      paintControls();
      commit([tab]);
    });
    const shut = () => { if (!busy) close(); };
    cancel.addEventListener('click', shut);
    x.addEventListener('click', shut);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(); });
    s.onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', s.onKey, true);

    s.modal = overlay;
    document.body.appendChild(overlay);
    frame.classList.add('routility-tc-loading');
    for (const t of TYPES) edits[t.id] = { ...DEFAULT };
    paintControls();
    save.disabled = true;
    fov.input.disabled = rot.input.disabled = dist.input.disabled = true;
    dialog.tabIndex = -1;
    dialog.focus();

    loadCurrent().then((current) => {
      if (state !== s || s.modal !== overlay) return;
      s.current = current;
      for (const t of TYPES) edits[t.id] = { ...current[t.id] };
      fov.input.disabled = rot.input.disabled = dist.input.disabled = false;
      paintControls();
    });
    showThumb(tab, false);
    loadEmotes().then(async (list) => {
      if (state !== s || s.modal !== overlay) return;
      emotes = list;
      paintEmotes();
      poseName();
      pics = await assetThumbs(list.map(m => m.id));
      if (state === s && s.modal === overlay) paintEmotes();
    });
  }

  function place() {
    if (!state) return;
    const redraw = document.querySelector('#avatar-web-app .left-wrapper .redraw-avatar');
    if (!redraw) return;
    if (redraw.parentElement.querySelector(':scope > .routility-tc-open')) return;
    const b = button(lt('Customize Thumbnail'), 'bg-action-standard content-action-standard routility-injected routility-tc-open');
    b.addEventListener('click', open);
    state.trigger = b;
    redraw.after(b);
  }

  function setup() {
    if (state) return;
    state = { modal: null, current: {}, thumbs: {}, trigger: null };
    for (const t of TYPES) state.current[t.id] = { ...DEFAULT };
    state.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!state) return;
    close();
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-tc-open, .routility-tc-modal').forEach(n => n.remove());
  }

  window.RoUtilityThumbCam = { setup, teardown };
})();
