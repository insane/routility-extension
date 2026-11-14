(function () {
  'use strict';

  const { lt } = window.RoUtilityI18n;
  const WEARABLE = new Set([2, 8, 11, 12, 17, 18, 19, 27, 28, 29, 30, 31, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 55, 56, 57, 58, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72, 76, 77, 78, 79]);
  const IN_GAME = new Set([2, 8, 11, 12, 17, 18, 27, 28, 29, 30, 31, 41, 42, 43, 44, 45, 46, 47, 57, 58, 64, 65, 66, 67, 68, 69, 70, 71, 72, 76, 77, 79]);
  const GAME_PLACE = '124649447209956';
  let st = null;

  function gameJoin(s) {
    return { placeId: GAME_PLACE, launchData: JSON.stringify(s.items ? { v: 1, b: [Number(s.itemId)] } : { v: 1, a: [Number(s.itemId)] }) };
  }

  function placeGame(box, model) {
    const s = st;
    if (!s.opts.game || box.querySelector('.routility-ig-btn') || !(s.items || IN_GAME.has(s.type))) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = (model ? model.className : 'btn-control btn-control-md') + ' routility-injected routility-ig-btn';
    b.textContent = lt('Try In-Game');
    b.dataset.rtTip = lt('Opens Avatar Sandbox with this on your avatar');
    b.addEventListener('click', () => window.RoUtilityTryOn.launch(gameJoin(s)));
    box.appendChild(b);
  }

  function place() {
    const s = st;
    if (!s || !(s.type || s.items)) return;
    const box = document.querySelector('.item-details-thumbnail-container .thumbnail-button-container');
    if (!box) return;
    const model = [...box.querySelectorAll('button')].find(x => !x.classList.contains('routility-injected'));
    placeGame(box, model);
    if (!s.opts.preview || s.noFile || box.querySelector('.routility-pv-btn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = (model ? model.className : 'btn-control btn-control-md') + ' routility-injected routility-pv-btn';
    b.textContent = lt('Preview');
    let warmed = false;
    b.addEventListener('pointerenter', () => {
      if (warmed) return;
      warmed = true;
      Promise.all([import(chrome.runtime.getURL('src/preview/ui.js')), import(chrome.runtime.getURL('src/preview/mesh.js'))])
        .then(([ui]) => ui.warm(s.items ? { items: s.items } : { id: s.itemId, type: s.type }))
        .catch(() => {});
    });
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      const slow = setTimeout(() => { b.textContent = lt('Loading…'); }, 250);
      try {
        const ui = await import(chrome.runtime.getURL('src/preview/ui.js'));
        await import(chrome.runtime.getURL('src/preview/mesh.js'));
        const host = document.querySelector('.item-details-thumbnail-container');
        const name = document.querySelector('.item-details-info-header h1, #item-container h1')?.textContent.trim() || '';
        if (host) ui.open(host, s.items ? { items: s.items, name } : { id: s.itemId, type: s.type, name });
        b.textContent = lt('Preview');
      } catch {
        b.textContent = lt('Preview Didn’t Load');
        setTimeout(() => { b.textContent = lt('Preview'); }, 2500);
      } finally {
        clearTimeout(slow);
        b.disabled = false;
      }
    });
    box.insertBefore(b, box.firstChild);
  }

  async function detailsType(id) {
    try {
      const r = await fetch(`https://economy.roblox.com/v2/assets/${id}/details`, { credentials: 'include' });
      const d = r.ok ? await r.json() : null;
      return Number(d && d.AssetTypeId) || 0;
    } catch {
      return 0;
    }
  }

  async function setup(itemId, opts = { preview: true, game: true }) {
    teardown();
    const s = st = { itemId: String(itemId), type: 0, opts };
    const key = 'routilityAssetType:' + s.itemId;
    let type = Number(sessionStorage.getItem(key)) || 0;
    if (!type) {
      const res = await window.RoUtilityUI.request({ type: 'assetFile', id: s.itemId }, r => r && typeof r.status === 'number');
      if (st !== s) return;
      if (res && res.status === 200) {
        type = res.assetTypeId;
        try { sessionStorage.setItem(key, String(type)); } catch {}
      } else if (opts.game) {
        type = await detailsType(s.itemId);
        if (st !== s) return;
        s.noFile = true;
      }
    }
    if (st !== s || !WEARABLE.has(type)) return;
    s.type = type;
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  async function setupBundle(bundleId, opts = { preview: true, game: true }) {
    teardown();
    const s = st = { itemId: String(bundleId), type: 0, opts };
    let d = null;
    try {
      const r = await fetch(`https://catalog.roblox.com/v1/bundles/${s.itemId}/details`, { credentials: 'include' });
      d = r.ok ? await r.json() : null;
    } catch {}
    if (st !== s || !d) return;
    const items = (d.items || [])
      .filter(i => i && i.type === 'Asset' && /^\d+$/.test(String(i.id)) && WEARABLE.has(Number(i.assetType)))
      .map(i => ({ id: String(i.id), type: Number(i.assetType), name: String(i.name || '') }));
    if (!items.length) return;
    s.items = items;
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!st) return;
    st.observer?.disconnect();
    st = null;
    document.querySelectorAll('.routility-pv-btn, .routility-pv, .routility-ig-btn').forEach(n => n.remove());
  }

  const keepAsked = new Set();
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-tryon-keep' || typeof e.data.id !== 'string' || keepAsked.has(e.data.id)) return;
    const id = e.data.id;
    keepAsked.add(id);
    const type = st && st.type ? st.type : 0;
    try {
      chrome.storage.local.get('routilitySettings', (s) => {
        window.postMessage({ type: 'routility-tryon-keep-done', id, on: ((s && s.routilitySettings) || {}).tryOnKeepWorn !== false, itemType: type }, location.origin);
      });
    } catch {
      window.postMessage({ type: 'routility-tryon-keep-done', id, on: false }, location.origin);
    }
  });

  window.RoUtilityTryOn = { setup, setupBundle, teardown, launch: (join) => window.postMessage({ type: 'routility-try-game', placeId: join.placeId, launchData: join.launchData }, location.origin) };
})();
