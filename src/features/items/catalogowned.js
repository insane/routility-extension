(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const FULL_EVERY = 6 * 3600000;
  const QUICK_EVERY = 60000;
  const API = 'https://avatar.roblox.com/v1/avatar-inventory?sortOption=recentAdded&pageLimit=100';
  let on = false;
  let owned = null;
  let loading = null;
  let observer = null;

  const myId = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const onCatalog = () => /^\/catalog\/?$/i.test(location.pathname);
  const keyOf = (it) => (it.itemCategory && it.itemCategory.itemType === 2 ? 'b' : 'a') + it.itemId;

  async function pages(stopAt) {
    const ids = [];
    let token = '';
    for (let n = 0; n < 150; n++) {
      let data = null;
      try {
        const res = await fetch(API + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { credentials: 'include' });
        data = res.ok ? await res.json() : null;
      } catch {}
      if (!data) return null;
      for (const it of data.avatarInventoryItems || []) {
        const key = keyOf(it);
        if (stopAt && stopAt.has(key)) return ids;
        ids.push(key);
      }
      token = data.nextPageToken;
      if (!token) break;
    }
    return ids;
  }

  async function load() {
    const me = myId();
    if (!me) return null;
    const KEY = 'routilityOwned:' + me;
    const saved = (await chrome.storage.local.get(KEY))[KEY];
    const now = Date.now();
    if (saved && Array.isArray(saved.ids) && now - (saved.full || 0) < FULL_EVERY) {
      const set = new Set(saved.ids);
      if (now - (saved.at || 0) > QUICK_EVERY) {
        const fresh = await pages(set);
        if (fresh) {
          fresh.forEach(k => set.add(k));
          chrome.storage.local.set({ [KEY]: { ...saved, ids: [...set], at: now } });
        }
      }
      return set;
    }
    const all = await pages(null);
    if (!all) return saved && Array.isArray(saved.ids) ? new Set(saved.ids) : null;
    chrome.storage.local.set({ [KEY]: { ids: all, at: now, full: now } });
    return new Set(all);
  }

  function isOwned(kind, id) {
    if (owned && owned.has((kind === 'bundles' ? 'b' : 'a') + id)) return true;
    return !!(window.RoUtilityFun && window.RoUtilityFun.owned(kind === 'bundles' ? 'bundle' : 'asset', Number(id)));
  }

  function mark() {
    if (!on || !onCatalog()) {
      document.querySelectorAll('.routility-card-owned').forEach(n => n.remove());
      return;
    }
    if (!owned) {
      if (!loading) loading = load().then((set) => { owned = set || new Set(); }).finally(() => { loading = null; mark(); });
      return;
    }
    for (const card of document.querySelectorAll('.catalog-item-container')) {
      const host = card.querySelector('.item-card-thumb-container');
      const m = (card.querySelector('a[href*="/catalog/"], a[href*="/bundles/"]')?.getAttribute('href') || '').match(/\/(catalog|bundles)\/(\d+)/);
      if (!host || !m) continue;
      const tag = host.querySelector(':scope > .routility-card-owned');
      const want = isOwned(m[1], m[2]);
      if (want && !tag) {
        const box = el('span', 'routility-injected routility-card-owned');
        const badge = el('span', 'foundation-web-badge inline-flex items-center radius-circle padding-x-small routility-card-tag routility-card-tag-owned');
        badge.appendChild(el('span', 'text-no-wrap', lt('Owned')));
        box.appendChild(badge);
        host.appendChild(box);
      } else if (!want && tag) tag.remove();
    }
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame(mark));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    mark();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).catalogOwned !== false;
    if (on) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).catalogOwned !== false;
    if (on) start();
    mark();
  });
})();
