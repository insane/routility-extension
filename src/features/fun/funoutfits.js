(function () {
  'use strict';

  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const KEY = 'routilityFunOutfits';
  const FUN = 'routilityFun';
  const MAX = 50;
  const API = 'https://avatar.roblox.com/';
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ';
  const SMALL = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-small text-label-small height-600 padding-x-small bg-action-standard content-action-standard ';

  let state = null;
  let csrf = '';

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

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async function send(url, body) {
    for (let i = 0; i < 3; i++) {
      let r;
      try {
        r = await fetch(url, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
      } catch {
        return false;
      }
      if (r.status === 403 && r.headers.get('x-csrf-token')) {
        csrf = r.headers.get('x-csrf-token');
        continue;
      }
      if (!r.ok) return false;
      const data = await r.json().catch(() => null);
      return !(data && data.success === false);
    }
    return false;
  }

  const store = (get) => new Promise(r => chrome.storage.local.get(get, r));

  function cleanLook(o) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string') return null;
    const n = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const real = (Array.isArray(o.real) ? o.real : []).filter(a => a && n(a.id)).map(a => (a.meta && typeof a.meta === 'object' ? { id: n(a.id), meta: a.meta } : { id: n(a.id) })).slice(0, 60);
    const fake = (Array.isArray(o.fake) ? o.fake : []).map(n).filter(Boolean).slice(0, 50);
    const buy = (Array.isArray(o.buy) ? o.buy : []).filter(x => x && (x.kind === 'asset' || x.kind === 'bundle') && n(x.id)).map(x => ({ kind: x.kind, id: n(x.id), name: typeof x.name === 'string' ? x.name.slice(0, 200) : '', price: Number.isFinite(x.price) && x.price >= 0 ? Math.floor(x.price) : 0 })).slice(0, 50);
    return {
      id: o.id.slice(0, 40),
      name: typeof o.name === 'string' ? o.name.slice(0, 50) : '',
      at: n(o.at),
      thumb: typeof o.thumb === 'string' && /^https:\/\/[\w.-]+\.rbxcdn\.com\//.test(o.thumb) ? o.thumb : '',
      type: o.type === 'R6' ? 'R6' : 'R15',
      real,
      fake,
      buy,
    };
  }

  async function loadLooks() {
    const st = await store(KEY);
    return (Array.isArray(st[KEY]) ? st[KEY] : []).map(cleanLook).filter(Boolean);
  }

  function saveLooks(list) {
    return new Promise(r => chrome.storage.local.set({ [KEY]: list.slice(0, MAX) }, r));
  }

  async function avatarThumb(me) {
    for (let i = 0; i < 4; i++) {
      if (i) await new Promise(r => setTimeout(r, 1500));
      const d = await getJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${me}&size=150x150&format=Webp&isCircular=false`);
      const t = d && Array.isArray(d.data) && d.data[0];
      if (t && t.state === 'Completed' && t.imageUrl) return t.imageUrl;
      if (!t || t.state !== 'Pending') return '';
    }
    return '';
  }

  async function bundleOf(ids, bundles) {
    const out = new Map();
    const left = new Set(ids);
    for (const b of bundles) {
      if (!left.size) break;
      const d = await getJson(`https://catalog.roblox.com/v1/bundles/${b.id}/details`);
      for (const i of (d && d.items) || []) {
        const id = Number(i && i.id);
        if (left.has(id)) {
          out.set(id, b);
          left.delete(id);
        }
      }
    }
    return out;
  }

  async function capture() {
    const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    const [av, st] = await Promise.all([getJson(API + 'v2/avatar/avatar'), store(FUN)]);
    if (!me || !av || !Array.isArray(av.assets)) return null;
    const fun = st[FUN] && typeof st[FUN] === 'object' ? st[FUN] : {};
    const items = Array.isArray(fun.items) ? fun.items : [];
    const fake = (Array.isArray(fun.worn) ? fun.worn : []).filter(id => Number.isFinite(id));
    const fakeSet = new Set(fake);
    const real = av.assets.filter(a => !fakeSet.has(Number(a.id))).map(a => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id }));
    const buy = [];
    const seen = new Set();
    const loose = [];
    for (const id of fake) {
      const rec = items.find(x => x && x.kind === 'asset' && x.id === id);
      if (rec) {
        if (!seen.has('asset' + id)) buy.push({ kind: 'asset', id, name: rec.name || '', price: rec.price || 0 });
        seen.add('asset' + id);
      } else loose.push(id);
    }
    if (loose.length) {
      const owners = await bundleOf(loose, items.filter(x => x && x.kind === 'bundle'));
      for (const b of owners.values()) {
        if (seen.has('bundle' + b.id)) continue;
        seen.add('bundle' + b.id);
        buy.push({ kind: 'bundle', id: b.id, name: b.name || '', price: b.price || 0 });
      }
    }
    let thumb = '';
    if (fake.length && window.RoUtilityFun && window.RoUtilityFun.render) thumb = (await window.RoUtilityFun.render('150x150').catch(() => null)) || '';
    if (!thumb) thumb = await avatarThumb(me);
    return { real, fake, buy, thumb, type: av.playerAvatarType === 'R6' ? 'R6' : 'R15' };
  }

  async function wear(look) {
    const av = await getJson(API + 'v2/avatar/avatar');
    if (av && av.playerAvatarType && av.playerAvatarType !== look.type) await send(API + 'v1/avatar/set-player-avatar-type', { playerAvatarType: look.type });
    const ok = await send(API + 'v2/avatar/set-wearing-assets', { assets: look.real });
    const st = await store(FUN);
    const fun = st[FUN] && typeof st[FUN] === 'object' ? st[FUN] : null;
    if (fun) await new Promise(r => chrome.storage.local.set({ [FUN]: { ...fun, worn: look.fake.slice() } }, r));
    send(API + 'v1/avatar/redraw-thumbnail');
    return ok;
  }

  function close() {
    if (!state || !state.modal) return;
    state.modal.remove();
    document.removeEventListener('keydown', state.onKey, true);
    state.modal = null;
    state.trigger?.focus();
  }

  function itemThumbs(list, onThumb) {
    const assets = list.filter(x => x.kind === 'asset').map(x => x.id);
    const bundles = list.filter(x => x.kind === 'bundle').map(x => x.id);
    const take = (d, kind) => { for (const t of (d && d.data) || []) if (t.state === 'Completed' && t.imageUrl) onThumb(kind + t.targetId, t.imageUrl); };
    if (assets.length) getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assets.join(',')}&size=150x150&format=Webp&isCircular=false`).then(d => take(d, 'asset'));
    if (bundles.length) getJson(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundles.join(',')}&size=150x150&format=Webp&isCircular=false`).then(d => take(d, 'bundle'));
  }

  function robux(n) {
    const w = el('span', 'routility-fo-price text-label-medium content-emphasis');
    w.append(el('span', 'icon-robux-16x16'), el('span', null, formatNumber(n)));
    return w;
  }

  function open() {
    if (!state || state.modal) return;
    const s = state;
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal routility-fo-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-tc-dialog routility-rot-dialog routility-fo-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'routility-fo-title');
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
    const title = el('h2', 'text-heading-small routility-tc-title', lt('Fun Outfits'));
    title.id = 'routility-fo-title';
    const intro = el('p', 'text-body-medium content-muted routility-rot-intro', lt('Save looks with items you don’t own yet. Wear them again in Fun Mode, and see what you’d need to buy to wear them for real.'));

    const listHead = el('div', 'routility-rot-list-head');
    const count = el('span', 'text-label-medium content-default');
    const saveBtn = button(lt('Save Current Look'), 'bg-action-emphasis content-action-emphasis');
    listHead.append(count, saveBtn);
    const grid = el('ul', 'routility-rot-grid');
    grid.setAttribute('aria-label', lt('Fun Outfits'));
    const detail = el('div', 'routility-rot-controls routility-fo-detail');
    detail.hidden = true;

    const foot = el('div', 'routility-tc-foot');
    const status = el('p', 'text-body-small content-muted routility-rot-status');
    status.setAttribute('role', 'status');
    const done = button(lt('Done'), 'bg-action-standard content-action-standard');
    done.addEventListener('click', close);
    foot.append(status, done);

    dialog.append(closeBox, title, intro, listHead, grid, detail, foot);
    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    s.onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', s.onKey, true);
    document.body.appendChild(overlay);
    s.modal = overlay;
    dialog.focus();

    let looks = [];
    let picked = null;
    const live = () => state === s && s.modal === overlay;

    const showDetail = () => {
      detail.textContent = '';
      const look = looks.find(l => l.id === picked);
      detail.hidden = !look;
      if (!look) return;
      const top = el('div', 'routility-rot-row');
      const name = el('input', 'form-control input-field routility-fo-name');
      name.type = 'text';
      name.maxLength = 50;
      name.value = look.name;
      name.setAttribute('aria-label', lt('Look Name'));
      name.addEventListener('change', async () => {
        const v = name.value.trim().slice(0, 50) || look.name;
        name.value = v;
        if (v === look.name) return;
        look.name = v;
        await saveLooks(looks);
        if (live()) paint();
      });
      const actions = el('div', 'routility-fo-actions');
      const wearBtn = button(lt('Wear'), 'bg-action-emphasis content-action-emphasis');
      const del = button(lt('Delete'), 'bg-action-standard content-action-standard');
      wearBtn.addEventListener('click', async () => {
        wearBtn.disabled = true;
        del.disabled = true;
        wearBtn.label.textContent = lt('Wearing…');
        const ok = await wear(look);
        if (!live()) return;
        if (ok) {
          location.reload();
          return;
        }
        status.textContent = lt('Roblox didn’t put the whole look on. Some items may not be in your inventory anymore.');
        wearBtn.disabled = false;
        del.disabled = false;
        wearBtn.label.textContent = lt('Wear');
      });
      del.addEventListener('click', async () => {
        looks = looks.filter(l => l.id !== look.id);
        picked = null;
        await saveLooks(looks);
        if (live()) paint();
      });
      actions.append(wearBtn, del);
      top.append(name, actions);
      detail.appendChild(top);

      const body = el('div', 'routility-rot-row routility-fo-buy');
      if (!look.buy.length) {
        body.appendChild(el('span', 'text-body-small content-muted', lt('Everything in this look is already yours.')));
      } else {
        const head = el('div', 'routility-fo-buy-head');
        head.appendChild(el('span', 'text-label-medium content-default', ltn(look.buy.length, '{n} item to buy', '{n} items to buy')));
        const total = el('span', 'routility-fo-total text-body-small content-muted');
        total.append(document.createTextNode(lt('Total') + ' '), robux(look.buy.reduce((n, b) => n + b.price, 0)));
        head.appendChild(total);
        const list = el('ul', 'routility-fo-items');
        const thumbs = new Map();
        for (const b of look.buy) {
          const li = el('li', 'routility-fo-item');
          const a = el('a', 'routility-fo-link');
          a.href = b.kind === 'bundle' ? `/bundles/${b.id}` : `/catalog/${b.id}`;
          const frame = el('span', 'routility-fo-item-thumb');
          frame.appendChild(el('span', 'routility-sk routility-rot-thumb-sk'));
          thumbs.set(b.kind + b.id, frame);
          a.append(frame, el('span', 'routility-fo-item-name text-body-medium content-emphasis', b.name || String(b.id)));
          li.append(a, robux(b.price));
          list.appendChild(li);
        }
        body.classList.add('routility-fo-buy-list');
        body.append(head, list);
        itemThumbs(look.buy, (key, url) => {
          const frame = thumbs.get(key);
          if (!frame || !live()) return;
          const img = el('img', 'routility-rot-img');
          img.alt = '';
          img.addEventListener('load', () => {
            img.classList.add('routility-loaded');
            frame.querySelector('.routility-rot-thumb-sk')?.remove();
          }, { once: true });
          img.src = url;
          frame.prepend(img);
        });
      }
      detail.appendChild(body);
    };

    const paint = () => {
      count.textContent = ltn(looks.length, '{n} saved look', '{n} saved looks');
      saveBtn.disabled = looks.length >= MAX;
      grid.textContent = '';
      if (!looks.length) {
        grid.appendChild(el('li', 'text-body-medium content-muted routility-rot-empty', lt('No saved looks yet. Put on the items you like, then press Save Current Look.')));
      }
      for (const look of looks) {
        const li = el('li', 'routility-rot-tile' + (look.id === picked ? ' routility-rot-on' : ''));
        const btn = el('button', 'routility-rot-pick');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(look.id === picked));
        btn.setAttribute('aria-label', look.name);
        const frame = el('span', 'routility-rot-thumb');
        if (look.thumb) {
          const img = el('img', 'routility-rot-img');
          img.alt = '';
          img.decoding = 'async';
          img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
          img.src = look.thumb;
          frame.appendChild(img);
          if (img.complete && img.naturalWidth) img.classList.add('routility-loaded');
        }
        if (look.buy.length) frame.appendChild(el('span', 'routility-fo-badge text-label-small', ltn(look.buy.length, '{n} to buy', '{n} to buy')));
        btn.append(frame, el('span', 'routility-rot-name text-body-small content-default', look.name));
        btn.addEventListener('click', () => {
          picked = picked === look.id ? null : look.id;
          paint();
        });
        li.appendChild(btn);
        grid.appendChild(li);
      }
      showDetail();
    };

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.label.textContent = lt('Saving…');
      status.textContent = '';
      const got = await capture();
      if (!live()) return;
      saveBtn.label.textContent = lt('Save Current Look');
      if (!got) {
        status.textContent = lt('Couldn’t read your avatar right now. Try again.');
        saveBtn.disabled = false;
        return;
      }
      looks = await loadLooks();
      const used = new Set(looks.map(l => l.name));
      let n = looks.length + 1;
      while (used.has(lt('Look {n}', { n }))) n++;
      const look = cleanLook({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: lt('Look {n}', { n }), at: Date.now(), ...got });
      looks = [look].concat(looks).slice(0, MAX);
      picked = look.id;
      await saveLooks(looks);
      if (live()) paint();
    });

    for (let i = 0; i < 6; i++) {
      const li = el('li', 'routility-rot-tile');
      li.appendChild(el('span', 'routility-sk routility-rot-thumb'));
      li.appendChild(el('span', 'routility-sk routility-rot-sk-name'));
      grid.appendChild(li);
    }
    count.textContent = '';
    loadLooks().then((list) => {
      if (!live()) return;
      looks = list;
      paint();
    });
  }

  function place() {
    if (!state) return;
    const pane = document.querySelector('#avatar-web-app #costumes.tab-pane');
    const create = pane && pane.querySelector(':scope > div:first-child > .btn-float-right:not(.routility-rot-open):not(.routility-fo-open)');
    if (!create) return;
    if (create.parentElement.querySelector(':scope > .routility-fo-open')) return;
    const b = el('button', SMALL + 'btn-float-right routility-injected routility-fo-open');
    b.type = 'button';
    const l = el('div', LAYER);
    l.setAttribute('aria-hidden', 'true');
    const inner = el('span', 'flex items-center min-width-0 gap-xsmall');
    inner.appendChild(el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', lt('Fun Outfits')));
    b.append(l, inner);
    b.addEventListener('click', open);
    state.trigger = b;
    create.after(b);
  }

  function setup() {
    if (state) return;
    state = { modal: null, trigger: null, onKey: null };
    state.observer = new MutationObserver(onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!state) return;
    close();
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('.routility-fo-open, .routility-fo-modal').forEach(n => n.remove());
  }

  window.RoUtilityFunOutfits = { setup, teardown, open: () => { if (state) open(); } };
})();
