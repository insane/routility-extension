(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, dropdown } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const KEY = 'routilitySandbox';
  const AVATAR = /^\/my\/avatar/i;
  const MODES = [['all', LT('All Items')], ['limited', LT('Limiteds')], ['classic', LT('Classic Limiteds')]];
  const SORTS = [['relevance', LT('Relevance')], ['favorites', LT('Most Favorited')], ['bestselling', LT('Bestselling')], ['updated', LT('Recently Updated')], ['high', LT('Price High to Low')], ['low', LT('Price Low to High')]];
  const FIELD_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

  let settings = {};
  let state = null;
  let banner = null;
  let lastPick = null;
  let searchTimer = 0;
  let chipsFor = true;
  let snapSeq = 0;
  const FITS = 'routilitySandboxFits';
  const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></svg>';
  const DOWNLOAD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>';

  const PAGE = /^\/my\/avatar\/?$/i.test(location.pathname) && new URLSearchParams(location.search).has('sandbox');
  const sandboxOn = () => PAGE;
  const filter = () => (state && state.filter) || (() => { try { return (JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}).filter; } catch { return null; } })() || { mode: 'classic', q: '', sort: 'high' };
  const send = (action, extra) => window.postMessage(Object.assign({ type: 'routility-sandbox', action }, extra || {}), location.origin);

  function exitSandbox() {
    try { sessionStorage.removeItem(KEY); } catch {}
    send('exit');
    location.href = 'https://www.roblox.com/my/avatar';
  }

  function chip(label, on, onClick) {
    const b = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center select-none radius-circle text-label-medium height-800 padding-x-medium routility-sb-chip' + (on ? ' routility-sb-chip-on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    b.addEventListener('click', onClick);
    return b;
  }

  function button(label, primary) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    return b;
  }

  const fire = (node) => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) node.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  };
  const items = () => [...document.querySelectorAll('#avatar-web-app .tab-horizontal-submenu li')];

  function refreshList() {
    if (!lastPick) return;
    const heading = document.getElementById(lastPick.heading);
    if (!heading) return;
    const open = () => heading.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    const close = () => heading.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));
    open();
    setTimeout(() => {
      const list = items();
      const target = list.find(li => li.textContent.trim() === lastPick.label);
      const other = list.find(li => li !== target && li.textContent.trim());
      if (!target) return close();
      if (other) fire(other);
      setTimeout(() => {
        open();
        setTimeout(() => {
          const again = items().find(li => li.textContent.trim() === lastPick.label);
          if (again) fire(again);
          close();
        }, 150);
      }, 200);
    }, 150);
  }

  function openDefault(tries = 0) {
    const heading = document.getElementById('heading.accessories-dropdown');
    if (!heading) {
      if (tries < 40) setTimeout(() => openDefault(tries + 1), 250);
      return;
    }
    const active = document.querySelector('#avatar-web-app .rbx-tab-heading.active, #avatar-web-app .rbx-tab.active .rbx-tab-heading, #avatar-web-app [aria-selected="true"].rbx-tab-heading');
    if (active && !/recent|avatars/i.test(active.id || '')) return;
    heading.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    setTimeout(() => {
      const first = items()[0];
      if (first) {
        lastPick = { heading: heading.id, label: first.textContent.trim() };
        fire(first);
      }
      heading.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));
    }, 200);
  }

  function setFilter(next) {
    const f = Object.assign({}, filter(), next);
    state = Object.assign({}, state || {}, { filter: f });
    send('filter', { filter: f });
    paint();
    refreshList();
  }

  function build() {
    const root = el('section', 'routility-injected routility-sb bg-surface-100 radius-large');
    const icon = el('span', 'routility-sb-icon');
    icon.setAttribute('aria-hidden', 'true');
    const text = el('div', 'routility-sb-text');
    text.append(el('h2', 'text-title-medium content-emphasis margin-none text-no-wrap', lt('Sandbox Mode')), el('p', 'text-body-small content-muted margin-none routility-sb-note', lt('Try on anything from the Marketplace, limiteds included. Nothing you change here touches your real avatar.')));
    const small = (label, fn) => {
      const b = button(label);
      b.classList.replace('height-1000', 'height-800');
      b.addEventListener('click', fn);
      return b;
    };
    const undo = small(lt('Undo'), () => {
      undo.disabled = true;
      send('undo');
    });
    undo.classList.add('routility-sb-undo');
    undo.disabled = true;
    const fits = small(lt('Saved Fits'), openFits);
    const save = small(lt('Save Fit'), () => saveFit(save));
    const exit = small(lt('Exit Sandbox'), exitSandbox);
    root.append(icon, text, undo, fits, save, exit);
    const chips = el('div', 'routility-injected routility-sb-chips');
    const sort = dropdown(SORTS.map(([value, label]) => ({ value, label: lt(label) })), filter().sort || 'high', (v) => setFilter({ sort: v }), 'routility-sb-sort');
    sort.classList.add('routility-injected');
    const empty = el('div', 'routility-injected routility-sb-empty');
    empty.hidden = true;
    const showAll = el('button', 'text-link routility-sb-showall', lt('Show All Items'));
    showAll.type = 'button';
    showAll.addEventListener('click', () => setFilter({ mode: 'all' }));
    empty.append(el('span', 'text-body-small content-muted', lt('Nothing in this category matches your filter.')), showAll);
    root.parts = { chips, sort, empty, undo };
    return root;
  }

  function placeTools() {
    const p = banner.parts;
    const bar = document.querySelector('#avatar-web-app .routility-av-toolbar');
    const crumb = document.querySelector('#avatar-web-app .routility-av-crumb-row');
    if (bar && bar.lastElementChild !== p.sort) bar.appendChild(p.sort);
    if (bar && bar.nextElementSibling !== p.empty) bar.after(p.empty);
    if (crumb && crumb.lastElementChild !== p.chips) crumb.appendChild(p.chips);
    if (p.chips.hidden !== !chipsFor) p.chips.hidden = !chipsFor;
  }

  function syncSearch(input) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = input.value.trim().slice(0, 50);
      if (q !== (filter().q || '')) setFilter({ q });
    }, 450);
  }

  function paint() {
    if (!banner) return;
    banner.parts.undo.disabled = !(state && state.undo);
    const f = filter();
    banner.parts.chips.replaceChildren(...MODES.map(([mode, label]) => chip(lt(label), f.mode === mode, () => setFilter({ mode }))));
  }

  let renderSeq = 0;

  function renderUrl(size) {
    const id = ++renderSeq;
    return new Promise((resolve) => {
      const done = (url) => {
        window.removeEventListener('message', on);
        clearTimeout(timer);
        resolve(url || null);
      };
      const on = (e) => {
        if (e.source === window && e.data && e.data.type === 'routility-sandbox-render' && e.data.id === id) done(e.data.url);
      };
      const timer = setTimeout(() => done(null), 30000);
      window.addEventListener('message', on);
      send('render', { id, size });
    });
  }

  function snapshot() {
    const id = ++snapSeq;
    return new Promise((resolve) => {
      const done = (fit) => {
        window.removeEventListener('message', on);
        clearTimeout(timer);
        resolve(fit || null);
      };
      const on = (e) => {
        if (e.source === window && e.data && e.data.type === 'routility-sandbox-snapshot' && e.data.id === id) done(e.data.fit);
      };
      const timer = setTimeout(() => done(null), 10000);
      window.addEventListener('message', on);
      send('snapshot', { id });
    });
  }

  const loadFits = () => new Promise(r => chrome.storage.local.get(FITS, d => r(Array.isArray(d[FITS]) ? d[FITS] : [])));
  const storeFits = (list) => new Promise(r => chrome.storage.local.set({ [FITS]: list.slice(0, 50) }, r));

  function modal(title, cls) {
    document.querySelector('.routility-sb-modal')?.remove();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-sb-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-sb-dialog ' + (cls || ''));
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', title);
    const head = el('div', 'routility-sb-dialog-head');
    const close = el('button', 'routility-modal-icon');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(el('h2', 'text-heading-small margin-none', title), close);
    const body = el('div', 'routility-sb-dialog-body');
    dialog.append(head, body);
    overlay.appendChild(dialog);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shut();
    };
    const shut = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    };
    close.addEventListener('click', shut);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    return { body, dialog, shut };
  }

  function actionButton(label, primary) {
    const b = button(label, primary);
    b.classList.add('grow', 'basis-0');
    return b;
  }

  async function saveFit(trigger) {
    const [fit, list] = await Promise.all([snapshot(), loadFits()]);
    if (!fit) return;
    const fallback = lt('Fit {n}', { n: list.length + 1 });
    const m = modal(lt('Save Fit'), 'routility-sb-save-dialog');
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium stroke-contrast-alpha focus-within:stroke-system-emphasis');
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted text-body-medium placeholder:text-body-medium');
    input.maxLength = 40;
    input.value = fallback;
    input.setAttribute('aria-label', lt('Name'));
    input.spellcheck = false;
    field.appendChild(input);
    const note = el('p', 'text-body-small content-muted margin-none', ltn(fit.assets.length, 'Saves the {n} item you’re trying on so you can wear it again later. It stays on this computer.', 'Saves the {n} items you’re trying on so you can wear them again later. They stay on this computer.', { n: fit.assets.length }));
    const actions = el('div', 'flex gap-small routility-sb-dialog-actions');
    const cancel = actionButton(lt('Cancel'));
    const ok = actionButton(lt('Save'), true);
    actions.append(cancel, ok);
    m.body.append(field, note, actions);
    requestAnimationFrame(() => { input.focus(); input.select(); });
    cancel.addEventListener('click', m.shut);
    const submit = async () => {
      if (ok.disabled) return;
      ok.disabled = true;
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: input.value.trim() || fallback, at: Date.now(), thumb: '', fit };
      await storeFits([entry].concat(await loadFits()));
      m.shut();
      const label = trigger.querySelector('span');
      label.textContent = lt('Saved');
      setTimeout(() => { label.textContent = lt('Save Fit'); }, 1600);
      const url = await renderUrl('150x150');
      if (!url) return;
      const now = await loadFits();
      const hit = now.find(f => f.id === entry.id);
      if (!hit) return;
      hit.thumb = url;
      storeFits(now);
    };
    ok.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function fitThumb(f) {
    const box = el('div', 'routility-sb-fit-thumb');
    const blank = () => {
      box.textContent = '';
      const ic = el('span', 'routility-sb-icon');
      ic.setAttribute('aria-hidden', 'true');
      box.appendChild(ic);
    };
    if (!f.thumb) {
      blank();
      return box;
    }
    const img = el('img', 'routility-fade');
    img.alt = '';
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', blank);
    img.src = f.thumb;
    box.appendChild(img);
    return box;
  }

  async function openFits() {
    const m = modal(lt('Saved Fits'), 'routility-sb-fits-dialog');
    const draw = async () => {
      const list = await loadFits();
      m.body.textContent = '';
      if (!list.length) {
        m.body.appendChild(el('p', 'text-body-medium content-muted margin-none routility-sb-fits-empty', lt('No saved fits yet. Use Save Fit to keep the outfit you’re trying on.')));
        return;
      }
      const grid = el('ul', 'routility-sb-fits');
      for (const f of list) {
        const li = el('li', 'routility-sb-fit');
        const meta = el('div', 'routility-sb-fit-meta');
        meta.append(el('span', 'text-label-medium content-emphasis text-truncate-end routility-sb-fit-name', f.name), el('span', 'text-body-small content-muted', ltn(f.fit.assets.length, '{n} item', '{n} items', { n: f.fit.assets.length })));
        const row = el('div', 'routility-sb-fit-actions');
        const wearBtn = button(lt('Wear'), true);
        wearBtn.classList.replace('height-1000', 'height-800');
        wearBtn.classList.add('grow');
        wearBtn.addEventListener('click', () => {
          wearBtn.disabled = true;
          send('load', { fit: f.fit });
        });
        const del = el('button', 'routility-modal-icon routility-sb-fit-delete');
        del.type = 'button';
        del.setAttribute('aria-label', lt('Delete'));
        del.dataset.rtTip = lt('Delete');
        del.innerHTML = TRASH_SVG;
        del.addEventListener('click', async () => {
          await storeFits((await loadFits()).filter(x => x.id !== f.id));
          draw();
        });
        row.append(wearBtn, del);
        li.append(fitThumb(f), meta, row);
        grid.appendChild(li);
      }
      m.body.appendChild(grid);
    };
    draw();
  }

  async function downloadShot(img, btn) {
    btn.disabled = true;
    try {
      const blob = await (await fetch(img.src)).blob();
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      const png = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(png);
      a.download = 'RoUtility Sandbox.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {}
    btn.disabled = false;
  }

  let grow = null;
  const EASE = '0.4s cubic-bezier(0.2, 0, 0, 1)';

  function bigHeight(row) {
    return Math.round(Math.max(380, Math.min(row.getBoundingClientRect().width * 0.62, window.innerHeight - 160)));
  }

  function setBox(box, x, y, w, h) {
    box.style.setProperty('left', Math.round(x) + 'px', 'important');
    box.style.setProperty('top', Math.round(y) + 'px', 'important');
    box.style.setProperty('width', Math.round(w) + 'px', 'important');
    box.style.setProperty('height', Math.round(h) + 'px', 'important');
  }

  function release(g) {
    for (const k of ['left', 'top', 'width', 'height']) g.box.style.removeProperty(k);
    delete g.box.dataset.routilityBig;
    for (const [n, props] of g.touched) for (const k of props) n.style.removeProperty(k);
    g.save.remove();
    g.extras.forEach(n => n.remove());
    g.watch?.disconnect();
    g.watch2d?.disconnect();
    g.sharp.remove();
    g.box.querySelectorAll('.routility-sb-sharp').forEach(n => n.remove());
    delete g.box.dataset.routilitySharp;
    window.dispatchEvent(new Event('resize'));
  }

  function shrink() {
    const g = grow;
    if (!g) return;
    grow = null;
    document.removeEventListener('keydown', g.onKey, true);
    window.removeEventListener('message', g.onRender);
    window.removeEventListener('resize', g.onResize);
    const zb = document.querySelector('.routility-sb-enlarge');
    zb?.classList.remove('routility-sb-enlarged');
    if (zb) zb.dataset.rtTip = lt('Enlarge');
    if (!g.box.isConnected) return release(g);
    delete g.box.dataset.routilityBigOn;
    setBox(g.box, 0, 0, g.size.width, g.size.height);
    g.col.style.setProperty('margin-top', g.size.height + 'px', 'important');
    g.panel.style.setProperty('margin-top', '0px', 'important');
    setTimeout(() => release(g), 420);
  }

  function fillShow(show) {
    const worth = document.querySelector('.routility-av-wearing .routility-av-worth');
    const tiles = [...document.querySelectorAll('.routility-av-wearing .routility-av-wearing-grid img')].filter(i => i.src).slice(0, 12);
    const key = (worth ? worth.textContent : '') + '|' + tiles.map(i => i.src).join(',');
    if (show.dataset.key === key) return;
    show.dataset.key = key;
    show.textContent = '';
    const left = el('div', 'routility-sb-show-worth');
    if (worth) {
      left.appendChild(el('span', 'routility-sb-show-label', lt('Outfit Worth')));
      const big = worth.querySelector('.routility-av-worth-big');
      if (big) left.appendChild(big.cloneNode(true));
      const row = worth.querySelector('.routility-av-worth-row');
      if (row) left.appendChild(row.cloneNode(true));
    }
    const strip = el('div', 'routility-sb-show-items');
    for (const t of tiles) {
      const cell = el('span', 'routility-sb-show-item');
      const img = el('img');
      img.src = t.src.replace('/150/150/', '/420/420/');
      img.alt = t.alt || '';
      cell.appendChild(img);
      strip.appendChild(cell);
    }
    show.append(left, strip);
  }

  function enlarge() {
    if (grow) return shrink();
    const box = document.querySelector('#avatar-web-app .avatar-back');
    const col = document.querySelector('#avatar-web-app .left-wrapper-placeholder');
    const row = col && col.parentElement;
    const panel = row && row.querySelector(':scope > .right-panel');
    if (!box || !panel) return;
    const r = box.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const touched = [];
    const set = (n, k, v) => {
      n.style.setProperty(k, v, 'important');
      const t = touched.find(x => x[0] === n);
      if (t) t[1].add(k);
      else touched.push([n, new Set([k])]);
    };
    set(row, 'position', 'relative');
    for (let n = box.parentElement; n && n !== row; n = n.parentElement) set(n, 'position', 'static');
    set(col, 'margin-top', r.height + 'px');
    set(col, 'transition', 'margin-top ' + EASE);
    set(panel, 'margin-top', '0px');
    set(panel, 'transition', 'margin-top ' + EASE);
    const zb = document.querySelector('.routility-sb-enlarge');
    const base = zb ? zb.className.replace(/\broutility-\S+|\btoggle-three-dee\b/g, '').trim() : 'foundation-web-button relative clip group/interactable cursor-pointer flex items-center justify-center stroke-none select-none radius-medium bg-action-standard content-action-standard';
    const save = el('button', base + ' routility-injected routility-sb-big-save');
    save.type = 'button';
    save.setAttribute('aria-label', lt('Download'));
    save.dataset.rtTip = lt('Download');
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    save.appendChild(layer);
    save.insertAdjacentHTML('beforeend', DOWNLOAD_SVG);
    const alignSave = () => {
      if (!zb || !zb.isConnected) return;
      const br = box.getBoundingClientRect();
      const zr = zb.getBoundingClientRect();
      save.style.setProperty('right', Math.round(br.right - zr.left + 8) + 'px', 'important');
    };
    alignSave();
    const img = box.querySelector('.thumbnail-holder > .thumbnail-2d-container img');
    const native3d = () => box.querySelector('.avatar-thumbnail > .thumbnail-holder > button');
    const nb = native3d();
    const mode = el('button', (nb ? nb.className.replace(/\broutility-\S+|\btoggle-three-dee\b/g, '').trim() : base) + ' routility-injected routility-sb-big-mode');
    mode.type = 'button';
    const modeLayer = el('div', FIELD_LAYER);
    modeLayer.setAttribute('aria-hidden', 'true');
    const modeText = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', nb ? nb.textContent.trim() : '3D');
    mode.append(modeLayer, modeText);
    mode.addEventListener('click', () => native3d()?.click());
    const sharp = el('img', 'routility-injected routility-sb-sharp');
    sharp.alt = '';
    box.querySelector('.avatar-thumbnail')?.prepend(sharp);
    const g = grow = { box, col, panel, row, save, sharp, touched, native: img ? img.src : '', hi: '', id: 0, size: { width: r.width, height: r.height } };
    save.addEventListener('click', () => {
      const shot = new Image();
      shot.src = g.hi || g.native || '';
      if (shot.src) downloadShot(shot, save);
    });
    box.dataset.routilityBig = '';
    set(box, '--routility-dpr', String(Math.min(2, Math.max(1, window.devicePixelRatio || 1))));
    setBox(box, r.left - rr.left, r.top - rr.top, r.width, r.height);
    const glow = el('div', 'routility-injected routility-sb-glow');
    const shade = el('div', 'routility-injected routility-sb-shade');
    const show = el('div', 'routility-injected routility-sb-show');
    g.extras = [glow, shade, show, mode];
    box.prepend(glow);
    box.append(shade, show, save, mode);
    fillShow(show);
    const wearing = document.querySelector('.routility-av-wearing');
    if (wearing) {
      let queued = false;
      g.watch = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; if (grow === g) fillShow(show); });
      });
      g.watch.observe(wearing, { childList: true, subtree: true, characterData: true });
    }
    box.getBoundingClientRect();
    const request = () => {
      const want = g.native;
      const rid = g.id = ++renderSeq;
      window.removeEventListener('message', g.onRender);
      g.onRender = (e) => {
        if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-render' || e.data.id !== rid) return;
        window.removeEventListener('message', g.onRender);
        if (!e.data.url) return;
        const big = e.data.url.replace(/\/720\/720\//, '/1024/1024/');
        const load = (url, fallback) => {
          const pic = new Image();
          pic.onload = () => {
            if (grow !== g || g.native !== want) return;
            g.hi = url;
            sharp.src = url;
            box.dataset.routilitySharp = '';
          };
          pic.onerror = () => { if (fallback) load(fallback); };
          pic.src = url;
        };
        load(big, big !== e.data.url ? e.data.url : '');
      };
      window.addEventListener('message', g.onRender);
      send('render', { id: rid, size: '720x720' });
    };
    const watch2d = () => {
      if (grow !== g) return;
      if (!sharp.isConnected) box.querySelector('.avatar-thumbnail')?.prepend(sharp);
      const label = native3d()?.textContent.trim();
      if (label && modeText.textContent !== label) modeText.textContent = label;
      const now = box.querySelector('.thumbnail-holder > .thumbnail-2d-container img');
      if (!now || !now.src || now.src === g.native) return;
      g.native = now.src;
      g.hi = '';
      delete box.dataset.routilitySharp;
      request();
    };
    g.watch2d = new MutationObserver(watch2d);
    g.watch2d.observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    g.onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shrink();
    };
    g.onResize = () => {
      if (grow !== g) return;
      const h = bigHeight(row);
      setBox(box, 0, 0, row.getBoundingClientRect().width, h);
      col.style.setProperty('margin-top', h + 'px', 'important');
      panel.style.setProperty('margin-top', h + 16 + 'px', 'important');
    };
    window.addEventListener('resize', g.onResize);
    document.addEventListener('keydown', g.onKey, true);
    zb?.classList.add('routility-sb-enlarged');
    if (zb) zb.dataset.rtTip = lt('Close');
    requestAnimationFrame(() => {
      box.dataset.routilityBigOn = '';
      g.onResize();
      if (rr.top < 64) window.scrollBy({ top: rr.top - 72, behavior: 'smooth' });
      setTimeout(() => {
        if (grow !== g) return;
        window.dispatchEvent(new Event('resize'));
        alignZoom();
        alignSave();
      }, 440);
    });
    request();
  }

  function zoomButton() {
    const thumb = document.querySelector('#avatar-web-app .avatar-thumbnail');
    if (!thumb || thumb.querySelector(':scope > .routility-sb-enlarge')) return;
    const native = [...thumb.querySelectorAll('button')].find(x => /^(2D|3D)$/.test(x.textContent.trim()));
    const b = el('button', (native ? native.className : 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium height-1000 bg-action-standard content-action-standard') + ' routility-injected routility-sb-enlarge');
    b.type = 'button';
    b.setAttribute('aria-label', lt('Enlarge'));
    b.dataset.rtTip = lt('Enlarge');
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'routility-sb-enlarge-icon'));
    b.addEventListener('click', enlarge);
    thumb.appendChild(b);
    alignZoom();
  }

  function alignZoom() {
    const b = document.querySelector('#avatar-web-app .avatar-thumbnail > .routility-sb-enlarge');
    const native = b && (document.querySelector('#avatar-web-app .avatar-back .routility-sb-big-mode') || [...b.parentElement.querySelectorAll('button')].find(x => x !== b && /^(2D|3D)$/.test(x.textContent.trim())));
    if (!b || !native) return;
    const box = b.parentElement.getBoundingClientRect();
    const r = native.getBoundingClientRect();
    if (!r.width) return;
    b.style.setProperty('right', Math.round(box.right - r.right) + 'px', 'important');
  }

  function place() {
    const on = settings.avatarSandbox !== false && AVATAR.test(location.pathname) && sandboxOn();
    document.documentElement.classList.toggle('routility-sandbox', on);
    if (!on) {
      if (grow) shrink();
      banner?.remove();
      banner = null;
      document.querySelectorAll('.routility-sb-enlarge, .routility-sb-chips, .routility-sb-sort, .routility-sb-empty').forEach(n => n.remove());
      return;
    }
    zoomButton();
    alignZoom();
    const app = document.querySelector('#avatar-web-app');
    const host = app && app.querySelector(':scope > #avatar-react-container');
    if (!host) return;
    if (!banner) {
      banner = build();
      if (filter().q) {
        state = Object.assign({}, state || {}, { filter: Object.assign({}, filter(), { q: '' }) });
        send('filter', { filter: state.filter });
      }
      paint();
      openDefault();
    }
    if (banner.nextElementSibling !== host) host.before(banner);
    placeTools();
  }

  function tradeButtons() {
    if (!/^\/trades/i.test(location.pathname)) return;
    for (const head of document.querySelectorAll('.trade-list-detail-offer-header')) {
      if (head.querySelector('.routility-sb-try')) continue;
      const b = button(lt('Try On'));
      b.classList.replace('height-1000', 'height-800');
      b.classList.add('routility-injected', 'routility-sb-try');
      b.dataset.rtTip = lt('Try these items on in Sandbox');
      b.addEventListener('click', () => {
        const list = head.parentElement.querySelector(':scope > .item-cards, :scope > ul');
        const ids = [...new Set([...(list ? list.querySelectorAll('a[href*="/catalog/"]') : [])].map(a => (a.getAttribute('href').match(/\/catalog\/(\d+)/) || [])[1]).filter(Boolean))];
        if (ids.length) window.open('https://www.roblox.com/my/avatar?sandbox&wear=' + ids.slice(0, 20).join(','), '_blank');
      });
      head.classList.add('routility-sb-try-head');
      head.appendChild(b);
    }
  }

  function profileButtons() {
    const m = location.pathname.match(/^\/users\/(\d+)\/profile/i);
    if (!m || m[1] === document.querySelector('meta[name="user-data"]')?.dataset.userid) return;
    const heads = new Set(document.querySelectorAll('.routility-classic-wearing > .container-header, .routility-modern-wearing .routility-modern-section-head'));
    const names = new Set([lt('Currently Wearing').toLowerCase(), 'currently wearing']);
    for (const h of document.querySelectorAll('#content h2, #content h3')) {
      if (names.has(h.textContent.trim().toLowerCase()) && !h.closest('.routility-injected')) heads.add(h.parentElement);
    }
    for (const head of heads) {
      if (!head || head.querySelector('.routility-sb-fit-link')) continue;
      const a = el('a', 'btn-secondary-xs btn-more routility-injected routility-sb-fit-link', lt('Try Their Fit'));
      a.href = 'https://www.roblox.com/my/avatar?sandbox&user=' + m[1];
      a.dataset.rtTip = lt('Try this outfit on in Sandbox');
      head.classList.add('routility-sb-fit-head');
      head.appendChild(a);
    }
  }

  function ensureNav() {
    const off = settings.avatarSandbox === false;
    const avatar = document.querySelector('.left-nav nav a[href*="/my/avatar"]:not(.routility-sb-nav-link)');
    const li = avatar && avatar.closest('li');
    let mine = document.querySelector('.left-nav li.routility-sb-nav');
    if (off) {
      mine?.remove();
      return;
    }
    if (!li || !li.parentElement) return;
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-sb-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/my/avatar?sandbox';
      a.classList.add('routility-sb-nav-link');
      a.removeAttribute('id');
      a.classList.remove('bg-shift-200');
      a.querySelectorAll('.foundation-web-badge').forEach(n => n.remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-sb-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => !sp.children.length && sp.textContent.trim());
      if (label) label.textContent = lt('Sandbox');
    }
    if (!mine.isConnected || mine.previousElementSibling !== li) li.after(mine);
    const here = AVATAR.test(location.pathname) && sandboxOn();
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) avatar.classList.remove('bg-shift-200');
  }

  document.addEventListener('pointerdown', (e) => {
    const li = e.isTrusted && e.target.closest?.('#avatar-web-app .tab-horizontal-submenu li');
    if (li && lastHeading) {
      lastPick = { heading: lastHeading, label: li.textContent.trim() };
    }
  }, true);
  let lastHeading = '';
  document.addEventListener('mouseover', (e) => {
    const h = e.isTrusted && e.target.closest?.('#avatar-web-app [id^="heading."]');
    if (h) lastHeading = h.id;
  }, true);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-result' || !banner) return;
    chipsFor = !!e.data.filtered;
    banner.parts.chips.hidden = !chipsFor;
    banner.parts.empty.hidden = !(e.data.count === 0 && e.data.filtered && filter().mode !== 'all');
  });

  document.addEventListener('input', (e) => {
    const input = PAGE && e.target.closest?.('#avatar-web-app .routility-av-search-input');
    if (input) syncSearch(input);
  }, true);
  document.addEventListener('click', (e) => {
    const clear = PAGE && e.target.closest?.('#avatar-web-app .routility-av-search-clear');
    const input = clear && clear.closest('.routility-av-search')?.querySelector('input');
    if (input) setTimeout(() => syncSearch(input), 0);
  }, true);
  document.addEventListener('keydown', (e) => {
    const input = PAGE && e.key === 'Escape' && e.target.closest?.('#avatar-web-app .routility-av-search-input');
    if (input) setTimeout(() => syncSearch(input), 0);
  }, true);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-state') return;
    state = e.data.state || null;
    paint();
  });

  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.type === 'routility-sandbox-applied' && PAGE) location.reload();
  });

  let queued = false;
  const tick = () => {
    queued = false;
    ensureNav();
    place();
    if (settings.avatarSandbox === false) {
      document.querySelectorAll('.routility-sb-try, .routility-sb-fit-link').forEach(n => n.remove());
      return;
    }
    tradeButtons();
    profileButtons();
  };
  const observer = new MutationObserver((records) => {
    if (queued || records.every(r => r.target.closest?.('.routility-sb, .routility-sb-chips, .routility-sb-sort, .routility-sb-try, .routility-sb-fit-link'))) return;
    queued = true;
    requestAnimationFrame(tick);
  });

  function start() {
    if (settings.avatarSandbox === false && sandboxOn()) {
      try { sessionStorage.removeItem(KEY); } catch {}
      location.replace('https://www.roblox.com/my/avatar');
      return;
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    tick();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    tick();
  });
})();
