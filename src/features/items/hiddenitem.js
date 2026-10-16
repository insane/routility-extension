(function () {
  'use strict';

  const { el, formatNumber, verifiedBadge } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const root = document.documentElement;
  const TYPES = {
    1: LT('Image'), 2: LT('T-Shirt'), 3: LT('Audio'), 4: LT('Mesh'), 8: LT('Hat'), 9: LT('Place'), 10: LT('Model'), 11: LT('Shirt'), 12: LT('Pants'), 13: LT('Decal'),
    17: LT('Head'), 18: LT('Face'), 19: LT('Gear'), 21: LT('Badge'), 24: LT('Animation'), 27: LT('Body Part'), 28: LT('Body Part'), 29: LT('Body Part'), 30: LT('Body Part'), 31: LT('Body Part'),
    34: LT('Game Pass'), 41: LT('Hair'), 42: LT('Face Accessory'), 43: LT('Neck Accessory'), 44: LT('Shoulder Accessory'), 45: LT('Front Accessory'), 46: LT('Back Accessory'), 47: LT('Waist Accessory'),
    48: LT('Animation'), 49: LT('Animation'), 50: LT('Animation'), 51: LT('Animation'), 52: LT('Animation'), 53: LT('Animation'), 54: LT('Animation'), 55: LT('Animation'), 56: LT('Animation'),
    57: LT('Ear Accessory'), 58: LT('Eye Accessory'), 61: LT('Emote'), 62: LT('Video'), 64: LT('T-Shirt'), 65: LT('Shirt'), 66: LT('Pants'), 67: LT('Jacket'), 68: LT('Sweater'), 69: LT('Shorts'),
    70: LT('Left Shoe'), 71: LT('Right Shoe'), 72: LT('Dress Skirt'), 76: LT('Eyebrows'), 77: LT('Eyelashes'), 78: LT('Animation'), 79: LT('Head'),
  };
  const TYPE_IDS = { Image: 1, TShirt: 2, Audio: 3, Mesh: 4, Hat: 8, Place: 9, Model: 10, Shirt: 11, Pants: 12, Decal: 13, Head: 17, Face: 18, Gear: 19, Badge: 21, Animation: 24, Torso: 27, RightArm: 28, LeftArm: 29, LeftLeg: 30, RightLeg: 31, GamePass: 34, HairAccessory: 41, FaceAccessory: 42, NeckAccessory: 43, ShoulderAccessory: 44, FrontAccessory: 45, BackAccessory: 46, WaistAccessory: 47, ClimbAnimation: 48, DeathAnimation: 49, FallAnimation: 50, IdleAnimation: 51, JumpAnimation: 52, RunAnimation: 53, SwimAnimation: 54, WalkAnimation: 55, PoseAnimation: 56, EarAccessory: 57, EyeAccessory: 58, EmoteAnimation: 61, Video: 62, TShirtAccessory: 64, ShirtAccessory: 65, PantsAccessory: 66, JacketAccessory: 67, SweaterAccessory: 68, ShortsAccessory: 69, LeftShoeAccessory: 70, RightShoeAccessory: 71, DressSkirtAccessory: 72, EyebrowAccessory: 76, EyelashAccessory: 77, MoodAnimation: 78, DynamicHead: 79 };
  const CSS_BUNDLES = /^(ItemDetails\w*|FavoritesButton)$/;
  let started = false;
  let shown = null;
  let leaving = false;

  async function getJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function h(tag, cls, kids, attrs) {
    const n = el(tag, cls);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    for (const k of [].concat(kids == null ? [] : kids)) if (k != null) n.append(k);
    return n;
  }

  function slug(s) {
    return String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || '-';
  }

  function day(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(window.RoUtilityI18n.locale(), { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function itemCss() {
    let hrefs = null;
    try {
      const saved = JSON.parse(localStorage.getItem('routilityItemCss') || 'null');
      if (saved && Date.now() - saved.t < 86400000 && Array.isArray(saved.hrefs) && saved.hrefs.length) hrefs = saved.hrefs;
    } catch {}
    if (!hrefs) {
      try {
        const res = await fetch('/catalog/63690008', { credentials: 'include' });
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        hrefs = [...doc.querySelectorAll('link[rel="stylesheet"][data-bundlename]')]
          .filter(l => CSS_BUNDLES.test(l.dataset.bundlename) && /^https:\/\/css\.rbxcdn\.com\//.test(l.href))
          .map(l => l.href);
        if (hrefs.length) localStorage.setItem('routilityItemCss', JSON.stringify({ t: Date.now(), hrefs }));
      } catch {}
    }
    if (!hrefs || !hrefs.length) return false;
    const have = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href));
    await Promise.all(hrefs.filter(u => !have.has(u)).map(u => new Promise((done) => {
      const link = el('link', 'routility-injected');
      link.rel = 'stylesheet';
      link.href = u;
      link.onload = link.onerror = done;
      document.head.appendChild(link);
    })));
    return true;
  }

  async function thumb(id, bundle) {
    const url = bundle
      ? `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${id}&size=420x420&format=Png&isCircular=false`
      : `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`;
    for (let i = 0; i < 4; i++) {
      const d = await getJson(url);
      const t = d && d.data && d.data[0];
      if (t && t.state === 'Completed' && t.imageUrl) return t.imageUrl;
      if (!t || t.state !== 'Pending') return '';
      await new Promise(r => setTimeout(r, 1500));
    }
    return '';
  }

  function typeLabel(type) {
    const n = typeof type === 'number' ? type : TYPE_IDS[String(type || '').replace(/\s+/g, '')];
    return TYPES[n] ? lt(TYPES[n]) : '';
  }

  async function creatorOf(type, id) {
    if (!id) return null;
    const group = /group/i.test(String(type));
    const d = await getJson(group ? `https://groups.roblox.com/v1/groups/${id}` : `https://users.roblox.com/v1/users/${id}`);
    return { id, group, name: (d && d.name) || '', verified: !!(d && d.hasVerifiedBadge) };
  }

  async function fallback(id, img) {
    const dev = await getJson(`https://develop.roblox.com/v1/assets?assetIds=${id}`);
    const a = dev && dev.data && dev.data[0];
    if (a && a.name) {
      const c = a.creator || {};
      return {
        name: a.name,
        description: a.description || '',
        creator: await creatorOf(c.type, c.targetId),
        type: typeLabel(a.typeId || a.type),
        tradable: false,
        created: day(a.created),
        updated: day(a.updated),
      };
    }
    let name = '';
    try {
      const res = await fetch(`/catalog/${id}`, { credentials: 'omit' });
      const m = res.ok && (await res.text()).match(/<title>([\s\S]*?)<\/title>/i);
      if (m) name = new DOMParser().parseFromString(m[1], 'text/html').documentElement.textContent.replace(/\s+-\s+Roblox[\s\S]*$/, '').trim();
    } catch {}
    if (!name || name === 'Roblox') return null;
    const kind = (String(img || '').match(/\/\d+\/\d+\/([A-Za-z]+)\/Png\//) || [])[1];
    return { name, description: '', creator: null, type: typeLabel(kind), tradable: false };
  }

  async function load(id, bundle, img) {
    if (bundle) {
      const d = await getJson(`https://catalog.roblox.com/v1/bundles/${id}/details`);
      if (!d || !d.name) return null;
      const c = d.creator || {};
      return {
        name: d.name,
        description: d.description || '',
        creator: { id: c.id, name: c.name, group: c.type === 'Group', verified: !!c.hasVerifiedBadge },
        type: lt('Bundle'),
        tradable: !!(d.collectibleItemDetail && d.collectibleItemDetail.collectibleItemType === 'Limited'),
      };
    }
    const d = await getJson(`https://economy.roblox.com/v2/assets/${id}/details`);
    if (!d || !d.Name || !d.AssetId) return fallback(id, await img);
    const c = d.Creator || {};
    const collectible = d.CollectiblesItemDetails || {};
    return {
      name: d.Name,
      description: d.Description || '',
      creator: { id: c.CreatorTargetId || c.Id, name: c.Name, group: c.CreatorType === 'Group', verified: !!c.HasVerifiedBadge },
      type: TYPES[d.AssetTypeId] ? lt(TYPES[d.AssetTypeId]) : '',
      tradable: !!(d.IsLimited || d.IsLimitedUnique || collectible.IsLimited),
      created: day(d.Created),
      updated: day(d.Updated),
    };
  }

  function infoRow(label, value, cls) {
    return h('div', 'clearfix item-info-row-container' + (cls ? ' ' + cls : ''), [
      h('div', 'font-header-1 text-subheader text-label text-overflow row-label', label),
      h('span', 'font-body text', value),
    ]);
  }

  function banner() {
    const back = h('a', 'btn-control-md routility-hi-back', lt('Return to Marketplace'), { href: '/catalog' });
    return h('div', 'routility-injected routility-hi-banner', [
      h('span', 'routility-hi-banner-icon', h('span', 'icon icon-regular-circle-slash')),
      h('div', 'routility-hi-banner-text', [
        h('div', 'text-heading-small content-emphasis', lt('This item is hidden')),
        h('div', 'text-body-medium content-muted', lt('Roblox hides this item’s page, so RoUtility rebuilt it from what Roblox still shares. The creator may have archived it, or it isn’t out yet.')),
      ]),
      back,
    ]);
  }

  function page(id, bundle, it, img, owned, favs) {
    const c = it.creator && it.creator.id ? it.creator : null;
    const creatorHref = c ? (c.group ? `https://www.roblox.com/communities/${c.id}/${slug(c.name)}` : `https://www.roblox.com/users/${c.id}/profile`) : '';
    const creator = h('div', 'item-details-creator-container', [
      c ? h('span', 'text-label', [lt('By') + ' ', h('a', 'text-name', c.name || String(c.id), { href: creatorHref })]) : null,
      c && c.verified ? verifiedBadge() : null,
      owned ? h('span', 'item-owned', [h('div', 'label-checkmark', h('span', 'icon-checkmark-white-bold')), h('span', null, lt('Item Owned'))]) : null,
    ]);
    const header = h('div', 'item-details-info-header border-bottom item-name-container', [
      h('div', 'left', [h('div', 'item-details-name-row', h('h1', null, it.name)), creator]),
      h('div', 'right', h('div', 'item-details-header-actions')),
    ]);
    const details = h('div', 'item-details-section', [
      h('div', 'price-row-container', h('div', 'price-container-text', h('div', 'item-first-line', owned ? lt('This item is available in your inventory.') : lt('This item is not currently for sale.')))),
      infoRow(lt('Tradable'), it.tradable ? lt('Yes') : lt('No')),
      it.type ? infoRow(lt('Type'), it.type) : null,
      it.created ? infoRow(lt('Created'), it.created) : null,
      it.updated ? infoRow(lt('Updated'), it.updated) : null,
      it.description.trim() ? h('div', 'clearfix toggle-target item-info-row-container', [
        h('div', 'font-header-1 text-subheader text-label text-overflow row-label', lt('Description')),
        h('div', 'row-content', h('p', 'font-body text description-content', it.description.trim())),
      ]) : null,
    ], { id: 'item-details' });
    const pic = el('img');
    pic.alt = it.name;
    if (img) pic.src = img;
    const thumbBox = h('div', null, h('div', 'item-details-thumbnail-container', [
      h('div', 'thumbnail-holder', h('span', 'thumbnail-2d-container', img ? pic : null)),
      h('div', 'thumbnail-ui-container', h('div', 'bottom-align-container inner-thumbnail-ui-container', [h('div', 'left-align-container'), h('div', 'right-align-container', h('div', 'thumbnail-button-container'))])),
    ]), { id: 'item-thumbnail-container-frontend', 'data-target-id': id, 'data-is-bundle': String(bundle) });
    const info = h('div', null, h('div', 'shopping-cart item-details-info-content', [header, details]), { id: 'item-info-container-frontend', 'data-target-id': id, 'data-is-bundle': String(bundle) });
    const fav = favs == null ? null : h('div', null, h('div', 'favorites-button-container', h('li', 'favorite-button-container', h('div', 'tooltip-container', h('a', 'routility-hi-fav', [
      h('span', 'text-favorite favoriteCount', formatNumber(favs)),
      h('div', 'icon-favorite'),
    ])))), { id: 'favorites-button', 'data-asset-id': id, 'data-item-type': bundle ? 'Bundle' : 'Asset' });
    return h('div', 'routility-injected routility-hi', h('div', 'content', h('div', 'page-content menu-shown', [
      banner(),
      h('div', null, h('div', 'clearfix', [thumbBox, info, fav])),
    ])), { id: 'item-details-container' });
  }

  function skeleton() {
    const sk = (w, hgt) => h('span', 'routility-hi-sk', null, { style: `width: ${w}; height: ${hgt};` });
    return h('div', 'routility-injected routility-hi-loading', [
      sk('100%', '96px'),
      h('div', 'routility-hi-sk-main', [
        sk('420px', '420px'),
        h('div', 'routility-hi-sk-info', [sk('60%', '36px'), sk('30%', '18px'), sk('100%', '1px'), sk('55%', '18px'), sk('40%', '18px'), sk('45%', '18px'), sk('50%', '18px')]),
      ]),
    ]);
  }

  async function run(id, bundle, moved) {
    const content = document.getElementById('content');
    const native = content && content.querySelector(':scope > .request-error-page-content');
    if (!native) return false;
    const sk = skeleton();
    native.after(sk);
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const shot = thumb(id, bundle);
    const [it, styled, img, owned, favs] = await Promise.all([
      load(id, bundle, shot),
      itemCss(),
      shot,
      me ? getJson(`https://inventory.roblox.com/v1/users/${me}/items/${bundle ? 'Bundle' : 'Asset'}/${id}/is-owned`) : null,
      getJson(`https://catalog.roblox.com/v1/favorites/${bundle ? 'bundles' : 'assets'}/${id}/count`),
    ]);
    sk.remove();
    if (!it || !styled || !native.isConnected) return false;
    if (moved) {
      history.replaceState(history.state, '', `/${bundle ? 'bundles' : 'catalog'}/${id}/${slug(it.name)}`);
      shown = { kind: bundle ? 'bundles' : 'catalog', id };
    }
    native.after(page(id, bundle, it, img, owned === true, typeof favs === 'number' ? favs : null));
    native.remove();
    document.title = `${it.name} - Roblox`;
    return true;
  }

  const ITEM_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(catalog|bundles)\/(\d+)/i;

  function rememberItemClick(e) {
    const a = e.target.closest?.('a[href]');
    if (a) leaving = true;
    const m = a && (a.pathname || '').match(ITEM_PATH);
    if (!m || a.origin !== location.origin) return;
    try { localStorage.setItem('routilityLastItem', JSON.stringify({ kind: m[1].toLowerCase(), id: m[2], t: Date.now() })); } catch {}
  }
  document.addEventListener('click', rememberItemClick, true);
  document.addEventListener('auxclick', rememberItemClick, true);
  window.addEventListener('pagehide', () => {
    if (!shown || leaving) return;
    try { sessionStorage.setItem('routilityHiddenLeave', JSON.stringify({ ...shown, t: Date.now() })); } catch {}
  });

  if (location.pathname !== '/request-error') {
    setTimeout(() => {
      if (location.pathname === '/request-error') return;
      try { localStorage.removeItem('routilityLastItem'); } catch {}
      if (ITEM_PATH.test(location.pathname) && !shown) {
        try { chrome.runtime.sendMessage({ type: 'itemNav' }, () => void chrome.runtime.lastError); } catch {}
      }
    }, 5000);
  }

  async function redirectedItem() {
    if (location.pathname !== '/request-error' || /routility-user=/.test(location.hash)) return null;
    const now = Date.now();
    const picks = [];
    try {
      const c = JSON.parse(localStorage.getItem('routilityLastItem') || 'null');
      if (c && now - c.t < 20000) picks.push(c);
    } catch {}
    const nav = await new Promise((done) => {
      try {
        chrome.runtime.sendMessage({ type: 'itemNav' }, (res) => { void chrome.runtime.lastError; done(res || null); });
      } catch {
        done(null);
      }
    });
    if (nav && now - nav.t < 30000) picks.push(nav);
    try {
      const left = JSON.parse(sessionStorage.getItem('routilityHiddenLeave') || 'null');
      if (left && now - left.t < 15000) picks.push(left);
    } catch {}
    picks.sort((a, b) => b.t - a.t);
    try {
      localStorage.removeItem('routilityLastItem');
      sessionStorage.removeItem('routilityHiddenLeave');
    } catch {}
    if (!picks[0]) return null;
    const last = await new Promise(done => chrome.storage.local.get('routilityLastProfile', st => done(st.routilityLastProfile)));
    return last && last.t > picks[0].t ? null : picks[0];
  }

  function start(target) {
    if (started || !document.querySelector('#content > .request-error-page-content')) return started;
    started = true;
    const bundle = target.kind === 'bundles';
    const fail = () => root.classList.add('routility-hi-failed');
    const timer = setTimeout(fail, 20000);
    run(target.id, bundle, target.moved).then((ok) => { clearTimeout(timer); if (!ok) fail(); }, fail);
    return true;
  }

  chrome.storage.local.get('routilitySettings', async (st) => {
    if ((st.routilitySettings || {}).hiddenItems === false) {
      root.classList.add('routility-hi-off');
      return;
    }
    const m = location.pathname.match(ITEM_PATH);
    let target = m ? { kind: m[1].toLowerCase(), id: m[2] } : null;
    if (!target && location.pathname === '/request-error') {
      target = await redirectedItem();
      if (target && /^\d+$/.test(String(target.id))) {
        target = { kind: target.kind === 'bundles' ? 'bundles' : 'catalog', id: String(target.id), moved: true };
        root.classList.add('routility-hi-path');
      } else {
        target = null;
        root.classList.remove('routility-hi-path');
      }
    }
    if (!target || !root.classList.contains('routility-hi-path')) return;
    if (start(target)) return;
    const watch = new MutationObserver(() => { if (start(target)) watch.disconnect(); });
    watch.observe(document.documentElement, { childList: true, subtree: true });
    const stop = () => setTimeout(() => {
      watch.disconnect();
      if (!started) root.classList.remove('routility-hi-path');
    }, 1000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop, { once: true });
    else stop();
  });
})();
