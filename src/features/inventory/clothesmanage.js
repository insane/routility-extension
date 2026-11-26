(function () {
  'use strict';

  const { el, onFrame, formatNumber, pause } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const TYPES = [['all', LT('All'), 0], ['tshirts', LT('T-Shirts'), 2], ['shirts', LT('Shirts'), 11], ['pants', LT('Pants'), 12]];
  const HASH_TYPE = { 'classic-t-shirts': 'tshirts', 'classic-shirts': 'shirts', 'classic-pants': 'pants' };
  const CHUNK = 150;

  let state = null;
  let csrf = '';

  async function getJson(url) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.status === 429) {
          await pause(2000 * (i + 1));
          continue;
        }
        return r.ok ? await r.json() : null;
      } catch {
        await pause(1000);
      }
    }
    return null;
  }

  async function details(ids) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch('https://catalog.roblox.com/v1/catalog/items/details', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
          body: JSON.stringify({ items: ids.map(id => ({ itemType: 'Asset', id: Number(id) })) }),
        });
        if (r.status === 403 && r.headers.get('x-csrf-token')) {
          csrf = r.headers.get('x-csrf-token');
          continue;
        }
        if (r.status === 429 || r.status >= 500) {
          await pause(1500 * (i + 1));
          continue;
        }
        return r.ok ? ((await r.json()).data || []) : null;
      } catch {
        await pause(1000);
      }
    }
    return null;
  }

  async function removeItem(id) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`https://inventory.roblox.com/v2/inventory/asset/${id}`, { method: 'DELETE', credentials: 'include', headers: csrf ? { 'x-csrf-token': csrf } : {} });
        if (r.ok) return 'ok';
        const body = await r.json().catch(() => null);
        const code = body && body.errors && body.errors[0] ? body.errors[0].code : -1;
        if (r.status === 403 && r.headers.get('x-csrf-token') && code === 0) {
          csrf = r.headers.get('x-csrf-token');
          continue;
        }
        if (r.status === 403 && code === 2) return 'gone';
        if (r.status === 404) return 'gone';
        if (r.status === 403 && code === 3) return 'locked';
        if (r.status === 429) {
          await pause(3000 * (i + 1));
          continue;
        }
        return 'fail';
      } catch {
        await pause(1000);
      }
    }
    return 'fail';
  }

  function locked(d) {
    if (!d) return false;
    const limited = (d.itemRestrictions || []).some(r => /limited|collectible/i.test(r));
    return limited || (d.creatorType === 'User' && Number(d.creatorTargetId) === 1);
  }

  async function open() {
    const s = state;
    if (!s || s.modal) return;
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop routility-bm-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-bm-modal routility-clm-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const titleBox = el('div', 'routility-cm-titlebox');
    const count = el('span', 'text-body-medium content-muted routility-cm-count');
    titleBox.append(el('h2', 'routility-modal-title', lt('My Classic Clothing')), count);
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    head.append(titleBox, close);

    const tools = el('div', 'routility-cm-tools');
    const search = el('input', 'form-control input-field routility-cm-search');
    search.type = 'search';
    search.placeholder = lt('Search Clothing');
    const filters = el('div', 'routility-cm-filters');
    let filter = HASH_TYPE[(location.hash.match(/^#!\/classic-clothing\/([\w-]+)/i) || [])[1]] || 'all';
    for (const [key, label] of TYPES) {
      const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium routility-cm-filter');
      b.type = 'button';
      b.dataset.key = key;
      const layer = el('div', LAYER);
      layer.setAttribute('aria-hidden', 'true');
      b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', lt(label)));
      b.addEventListener('click', () => { filter = key; paint(); });
      filters.appendChild(b);
    }
    const pickAll = el('button', 'btn-control-sm routility-fm-all', lt('Select All'));
    pickAll.type = 'button';
    tools.append(search, filters, pickAll);

    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-list');
    for (let i = 0; i < 8; i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
    body.appendChild(list);

    const foot = el('div', 'routility-cm-foot');
    const selInfo = el('span', 'text-body-medium content-muted');
    const remove = el('button', 'btn-alert-md btn-min-width routility-cm-leave', lt('Delete Selected'));
    remove.type = 'button';
    remove.disabled = true;
    foot.append(selInfo, remove);

    modal.append(head, el('div', 'text-body-small content-muted routility-clm-note', lt('Deleted clothing is gone from your inventory for good. Roblox doesn’t let you delete clothing made by Roblox or limiteds.')), tools, body, foot);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    s.modal = backdrop;

    let busy = false;
    let removedAny = false;
    const shut = () => {
      if (busy) return;
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
      s.modal = null;
      if (removedAny) location.reload();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shut();
    };
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const items = [];
    const info = new Map();
    const icons = new Map();
    const selected = new Set();
    const failed = new Set();
    const refused = new Set();
    let loading = true;
    let loadFailed = false;
    let confirm = false;
    let confirmTimer = 0;
    let note = '';
    let shown = [];
    let limit = CHUNK;
    let sentinel = null;
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return;
      limit += CHUNK;
      paint(true);
    }, { root: body, rootMargin: '400px' });

    const canDelete = x => info.has(x.id) && !locked(info.get(x.id)) && !refused.has(x.id);
    const typeName = x => lt((TYPES.find(t => t[2] === x.type) || TYPES[0])[1]);
    const metaText = (x) => {
      const d = info.get(x.id);
      const by = d && d.creatorName ? lt('By {name}', { name: d.creatorName }) : '';
      return [typeName(x), by].filter(Boolean).join(', ');
    };

    const paintFoot = () => {
      const n = selected.size;
      count.textContent = loading ? '' : ltn(items.length, '{n} item', '{n} items', { n: formatNumber(items.length) });
      selInfo.textContent = note || (n ? lt('{n} selected', { n: formatNumber(n) }) : lt('Select clothing to delete it'));
      selInfo.classList.toggle('routility-cm-note-bad', !!note && (failed.size > 0 || refused.size > 0));
      remove.disabled = !n || busy;
      remove.classList.toggle('routility-cm-confirm', confirm);
      if (!busy) remove.textContent = confirm ? ltn(n, 'Delete {n} Item?', 'Delete {n} Items?', { n: formatNumber(n) }) : lt('Delete Selected');
      const pickable = shown.filter(canDelete);
      pickAll.disabled = busy || !pickable.length;
      pickAll.textContent = pickable.length && pickable.every(x => selected.has(x.id)) ? lt('Clear') : lt('Select All');
    };

    const loadIcons = (ids) => {
      const want = ids.filter(id => !icons.has(id));
      for (const id of want) icons.set(id, null);
      for (let i = 0; i < want.length; i += 100) {
        getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${want.slice(i, i + 100).join(',')}&size=150x150&format=Webp&isCircular=false`).then((d) => {
          for (const t of (d && d.data) || []) {
            if (t.state !== 'Completed' || !t.imageUrl) continue;
            const id = String(t.targetId);
            icons.set(id, t.imageUrl);
            const slot = list.querySelector(`.routility-clm-icon[data-id="${id}"]`);
            if (slot && !slot.firstChild) {
              const img = el('img');
              img.alt = '';
              img.src = t.imageUrl;
              slot.appendChild(img);
            }
          }
        });
      }
    };

    const tagFor = (x) => {
      if (refused.has(x.id) || locked(info.get(x.id))) {
        const tag = el('span', 'routility-cm-tag', lt('Can’t Delete'));
        tag.dataset.rtTip = lt('Roblox doesn’t let you delete clothing made by Roblox or limiteds.');
        return tag;
      }
      return null;
    };

    const row = (x) => {
      const ok = canDelete(x);
      const li = el('li', 'routility-cm-row routility-clm-row' + (selected.has(x.id) ? ' routility-cm-picked' : '') + (failed.has(x.id) ? ' routility-cm-failed' : '') + (ok ? '' : ' routility-clm-off'));
      const box = el('input', 'routility-cm-check');
      box.type = 'checkbox';
      box.checked = selected.has(x.id);
      box.disabled = busy || !ok;
      box.setAttribute('aria-label', lt('Select {name}', { name: x.name }));
      box.addEventListener('change', () => {
        if (box.checked) selected.add(x.id);
        else selected.delete(x.id);
        confirm = false;
        note = '';
        li.classList.toggle('routility-cm-picked', box.checked);
        paintFoot();
      });
      const icon = el('span', 'routility-cm-icon routility-clm-icon thumbnail-2d-container');
      icon.dataset.id = x.id;
      const src = icons.get(x.id);
      if (src) {
        const img = el('img');
        img.alt = '';
        img.src = src;
        icon.appendChild(img);
      }
      const text = el('a', 'routility-cm-text');
      text.href = `/catalog/${x.id}`;
      text.target = '_blank';
      text.rel = 'noreferrer';
      const name = el('span', 'routility-cm-name text-title-medium');
      name.appendChild(el('span', 'text-truncate-end', x.name || String(x.id)));
      text.append(name, el('span', 'routility-cm-meta text-body-small content-muted', metaText(x)));
      const tags = el('span', 'routility-cm-tags');
      const tag = tagFor(x);
      if (tag) tags.appendChild(tag);
      li.append(box, icon, text, tags);
      li.addEventListener('click', (e) => {
        if (e.target.closest('a, input') || box.disabled) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change'));
      });
      return li;
    };

    let drawnSig = '';
    let drawn = 0;
    let version = 0;
    const drawnRows = new Map();
    const paintTail = () => {
      list.querySelectorAll(':scope > .routility-cm-row-sk, :scope > .routility-cm-empty').forEach(n => n.remove());
      sentinel = null;
      seen.disconnect();
      if (!shown.length && !loading) {
        const q = search.value.trim();
        list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', loadFailed && !items.length ? lt('Couldn’t load your clothing right now. Try again in a minute.') : !items.length ? lt('You don’t have any classic clothing.') : q ? lt('No clothing matches your search.') : lt('No clothing of this type.')));
      }
      if (shown.length > drawn) {
        sentinel = el('li', 'routility-cm-row routility-cm-row-sk');
        list.appendChild(sentinel);
        seen.observe(sentinel);
      } else if (loading) {
        for (let i = 0; i < (shown.length ? 3 : 8); i++) list.appendChild(el('li', 'routility-cm-row routility-cm-row-sk'));
      }
    };
    const paint = (more) => {
      if (!more) limit = CHUNK;
      filters.querySelectorAll('.routility-cm-filter').forEach(b => {
        const on = b.dataset.key === filter;
        b.classList.toggle('bg-inverse-surface-0', on);
        b.classList.toggle('content-inverse-emphasis', on);
        b.classList.toggle('bg-shift-300', !on);
        b.classList.toggle('content-action-utility', !on);
      });
      const want = (TYPES.find(t => t[0] === filter) || TYPES[0])[2];
      const q = search.value.trim().toLowerCase();
      shown = items.filter(x => (!want || x.type === want) && (!q || `${x.name} ${(info.get(x.id) || {}).creatorName || ''} ${x.id}`.toLowerCase().includes(q)));
      const sig = [q, filter, version].join('|');
      if (!more || sig !== drawnSig) {
        drawnSig = sig;
        list.textContent = '';
        drawn = 0;
        drawnRows.clear();
      }
      const upto = Math.min(limit, shown.length);
      const add = shown.slice(drawn, upto);
      if (add.length) {
        list.querySelectorAll(':scope > .routility-cm-row-sk, :scope > .routility-cm-empty').forEach(n => n.remove());
        const frag = document.createDocumentFragment();
        for (const x of add) {
          const li = row(x);
          drawnRows.set(x.id, li);
          frag.appendChild(li);
        }
        list.appendChild(frag);
        loadIcons(add.map(x => x.id));
      }
      drawn = upto;
      paintTail();
      paintFoot();
    };
    const redrawKeepScroll = () => {
      const top = body.scrollTop;
      version++;
      paint();
      body.scrollTop = top;
    };

    search.addEventListener('input', () => paint());
    pickAll.addEventListener('click', () => {
      const pickable = shown.filter(canDelete);
      const all = pickable.length && pickable.every(x => selected.has(x.id));
      for (const x of pickable) all ? selected.delete(x.id) : selected.add(x.id);
      confirm = false;
      note = '';
      for (const [id, li] of drawnRows) {
        const box = li.querySelector('.routility-cm-check');
        if (box) box.checked = selected.has(id);
        li.classList.toggle('routility-cm-picked', selected.has(id));
      }
      paintFoot();
    });
    remove.addEventListener('click', async () => {
      if (!selected.size || busy) return;
      if (!confirm) {
        confirm = true;
        paintFoot();
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { confirm = false; paintFoot(); }, 4000);
        return;
      }
      clearTimeout(confirmTimer);
      confirm = false;
      busy = true;
      note = '';
      failed.clear();
      const queue = [...selected];
      const gone = new Set();
      let blocked = 0;
      for (const li of drawnRows.values()) li.querySelector('.routility-cm-check')?.setAttribute('disabled', '');
      for (let i = 0; i < queue.length; i++) {
        remove.textContent = lt('Deleting {done} of {total}', { done: formatNumber(i + 1), total: formatNumber(queue.length) });
        const res = await removeItem(queue[i]);
        if (res === 'ok' || res === 'gone') gone.add(queue[i]);
        else if (res === 'locked') {
          refused.add(queue[i]);
          selected.delete(queue[i]);
          blocked++;
        } else failed.add(queue[i]);
        await pause(400);
      }
      for (let i = items.length - 1; i >= 0; i--) if (gone.has(items[i].id)) items.splice(i, 1);
      for (const id of gone) selected.delete(id);
      if (gone.size) removedAny = true;
      busy = false;
      const parts = [ltn(gone.size, 'Deleted {n} item.', 'Deleted {n} items.', { n: formatNumber(gone.size) })];
      if (blocked) parts.push(ltn(blocked, 'Roblox didn’t allow {n} of them.', 'Roblox didn’t allow {n} of them.', { n: formatNumber(blocked) }));
      if (failed.size) parts.push(lt('{failed} didn’t work. They’re still selected, try again.', { failed: formatNumber(failed.size) }));
      note = parts.join(' ');
      redrawKeepScroll();
    });
    paint();
    if (!document.hidden) modal.classList.add('routility-reveal');

    const describe = async (ids) => {
      for (let i = 0; i < ids.length && backdrop.isConnected; i += 100) {
        const d = await details(ids.slice(i, i + 100));
        for (const x of d || []) info.set(String(x.id), x);
        for (const id of ids.slice(i, i + 100)) if (!info.has(id)) info.set(id, null);
      }
    };

    for (const [, , type] of TYPES.slice(1)) {
      let cursor = '';
      for (let page = 0; page < 100 && backdrop.isConnected; page++) {
        const d = await getJson(`https://inventory.roblox.com/v2/users/${s.me}/inventory/${type}?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (!d || !Array.isArray(d.data)) {
          loadFailed = true;
          break;
        }
        const fresh = [];
        for (const a of d.data) {
          const id = String(a.assetId);
          if (items.some(x => x.id === id)) continue;
          items.push({ id, name: a.assetName || '', type, at: Date.parse(a.created) || 0 });
          fresh.push(id);
        }
        await describe(fresh);
        if (!backdrop.isConnected) return;
        paint(true);
        cursor = d.nextPageCursor || '';
        if (!cursor) break;
      }
    }
    items.sort((a, b) => b.at - a.at);
    loading = false;
    if (!backdrop.isConnected) return;
    redrawKeepScroll();
  }

  function place() {
    const s = state;
    if (!s) return;
    const onClothes = /^#!\/classic-clothing(\/|\?|$)/i.test(location.hash);
    const bar = document.querySelector('#inventory-container .routility-inv-toolbar:not(.routility-clm-bar)');
    const fallback = document.querySelector('#inventory-container .routility-clm-bar');
    if (!onClothes) {
      document.querySelectorAll('.routility-clm-open, .routility-clm-bar').forEach(n => n.remove());
      return;
    }
    if (bar) {
      fallback?.remove();
      if (bar.querySelector(':scope > .routility-clm-open')) return;
      bar.appendChild(button());
      return;
    }
    if (fallback) return;
    const header = document.querySelector('#inventory-container :is(assets-explorer, .rbx-tab-content) .container-header');
    if (!header) return;
    const own = el('div', 'routility-injected routility-inv-toolbar routility-clm-bar');
    own.appendChild(button());
    header.after(own);
  }

  function button() {
    const b = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-small shrink-0 stroke-standard stroke-contrast-alpha bg-none height-1000 radius-medium padding-x-medium content-emphasis text-label-medium routility-injected routility-clm-open');
    b.type = 'button';
    const layer = el('div', LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', null, lt('Manage')));
    b.dataset.rtTip = lt('Delete T-Shirts, Shirts and Pants you don’t want');
    b.addEventListener('click', open);
    return b;
  }

  function setup(owner) {
    teardown();
    const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    if (!me || String(owner) !== me) return;
    state = { owner: String(owner), me, modal: null };
    state.observer = new MutationObserver(onFrame(place));
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    state.onHash = () => place();
    window.addEventListener('hashchange', state.onHash);
    place();
  }

  function teardown() {
    if (!state) return;
    state.observer.disconnect();
    window.removeEventListener('hashchange', state.onHash);
    state.modal?.remove();
    document.documentElement.classList.remove('routility-modal-open');
    state = null;
    document.querySelectorAll('.routility-clm-open, .routility-clm-bar').forEach(n => n.remove());
  }

  window.RoUtilityClothesManage = { setup, teardown };
})();
