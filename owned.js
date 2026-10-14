(function () {
  'use strict';

  const { el, onFrame } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const DAY = 24 * 60 * 60 * 1000;
  const BUNDLE_PARTS = { BodyParts: [27, 28, 29, 30, 31, 17], DynamicHead: [79], AvatarAnimations: [51, 55, 53, 52, 50, 48, 54], Shoes: [70, 71] };
  let st = null;

  async function getJson(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async function assetDates(type) {
    if (st.typesLoaded.has(type)) return st.typesLoaded.get(type);
    const s = st;
    const job = (async () => {
      let cursor = '';
      for (let page = 0; page < 10; page++) {
        const d = await getJson(`https://inventory.roblox.com/v2/users/${s.userId}/inventory/${type}?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (!d || st !== s) return;
        for (const a of d.data || []) {
          const id = String(a.assetId);
          const prev = s.assetDates.get(id);
          if (!prev || Date.parse(a.created) < Date.parse(prev)) s.assetDates.set(id, a.created);
        }
        cursor = d.nextPageCursor;
        if (!cursor) return;
      }
    })();
    s.typesLoaded.set(type, job);
    return job;
  }

  async function loadBundles(ids) {
    const s = st;
    for (let i = 0; i < ids.length; i += 50) {
      const d = await getJson(`https://catalog.roblox.com/v1/bundles/details?bundleIds=${ids.slice(i, i + 50).join(',')}`);
      if (st !== s) return;
      for (const b of Array.isArray(d) ? d : []) s.bundleParts.set(Number(b.id), { kind: b.bundleType, assets: (b.items || []).filter(x => x.type === 'Asset').map(x => String(x.id)) });
    }
    const resolve = () => {
      for (const id of ids) {
        const parts = s.bundleParts.get(id);
        if (!parts || s.bundles.get(id)) continue;
        const dates = parts.assets.map(a => s.assetDates.get(a)).filter(Boolean).sort((x, y) => Date.parse(x) - Date.parse(y));
        if (dates.length) s.bundles.set(id, dates[0]);
      }
    };
    const kinds = new Set(ids.map(id => (s.bundleParts.get(id) || {}).kind).filter(Boolean));
    for (const kind of kinds) {
      for (const type of BUNDLE_PARTS[kind] || []) {
        if (ids.every(id => s.bundles.get(id) || (s.bundleParts.get(id) || {}).kind !== kind)) break;
        await assetDates(type);
        if (st !== s) return;
        resolve();
      }
    }
    for (const id of ids) if (!s.bundles.has(id)) s.bundles.set(id, null);
    s.schedule();
  }

  function take(items) {
    for (const x of items) {
      const id = Number(x.assetId);
      if (!Number.isFinite(id)) continue;
      const list = st.items.get(id) || [];
      if (list.some(y => y.userAssetId === x.userAssetId)) continue;
      list.push(x);
      list.sort((a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0));
      st.items.set(id, list);
    }
    st.schedule();
  }

  function onMessage(e) {
    if (!st || e.source !== window || !e.data || e.data.type !== 'routility-inventory' || !Array.isArray(e.data.items)) return;
    const m = String(e.data.url || '').match(/\/v2\/users\/(\d+)\/inventory\//);
    if (!m || m[1] !== st.userId) return;
    take(e.data.items);
  }

  function feed(userId, raw) {
    if (!st || String(userId) !== st.userId || !Array.isArray(raw)) return;
    take(raw.map(x => ({
      assetId: Number(x.assetId),
      userAssetId: Number(x.userAssetId) || 0,
      created: typeof x.created === 'string' ? x.created : '',
      updated: typeof x.updated === 'string' ? x.updated : '',
      tradable: !!(x.collectibleItemId || x.serialNumber),
    })));
  }

  function age(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const days = Math.max(0, Math.floor((Date.now() - t) / DAY));
    if (days < 1) return 'today';
    if (days < 30) return ltn(days, '{n}d', '{n}d');
    if (days < 365) return ltn(Math.max(1, Math.floor(days / 30.44)), '{n}mo', '{n}mo');
    return ltn(Math.floor(days / 365.25), '{n}y', '{n}y');
  }

  function longDate(iso) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  }

  function shortDate(iso) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  }

  function line(card) {
    const host = card.querySelector('.item-card-label');
    if (!host) return null;
    let n = host.querySelector(':scope > .routility-owned-inline');
    if (!n) {
      n = el('span', 'routility-injected routility-owned-inline');
      n.hidden = true;
      host.appendChild(n);
    }
    return n;
  }

  function setLine(n, text, tip) {
    if (!n || n.dataset.text === text) return;
    n.dataset.text = text;
    n.textContent = text ? ' · ' + text : '';
    n.hidden = !text;
    if (tip) n.dataset.rtTip = tip;
    else delete n.dataset.rtTip;
  }

  function itemText(entry) {
    const when = entry.tradable ? entry.updated || entry.created : entry.created;
    const a = age(when);
    if (!a) return null;
    const text = a === 'today' ? lt('Today') : a;
    let tip = lt('Owned since {date}', { date: shortDate(when) });
    if (entry.tradable && entry.created && Math.abs(Date.parse(entry.updated) - Date.parse(entry.created)) > DAY) tip = lt('Owned since {date} · first bought {first}', { date: shortDate(when), first: shortDate(entry.created) });
    return { text, tip };
  }

  function earnedTip(iso) {
    return lt('Earned {date}', { date: new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
  }

  function earned(slot, when) {
    if (!slot) return;
    const text = when ? lt('Earned {date}', { date: shortDate(when) }) : '';
    if (slot.node.dataset.text === text) return;
    slot.node.dataset.text = text;
    slot.text.textContent = text || ' ';
    if (when) slot.node.dataset.rtTip = earnedTip(when);
    else delete slot.node.dataset.rtTip;
    if (slot.host) slot.host.classList.toggle('routility-earned-on', !!text);
    if (text && !document.hidden) slot.node.classList.add('routility-reveal');
  }

  function badgeSlot(card) {
    const host = card.querySelector('.item-card-price');
    if (!host) return null;
    let node = host.querySelector(':scope > .routility-badge-earned');
    if (!node) {
      node = el('span', 'text-label routility-injected routility-badge-earned');
      node.appendChild(el('span', 'text-overflow font-caption-body', ' '));
      host.appendChild(node);
    }
    return { node, text: node.firstChild, host };
  }

  function classicSlot(a) {
    let node = a.querySelector(':scope > .routility-badge-earned');
    if (!node) {
      node = el('span', 'text-label font-caption-body text-overflow routility-injected routility-badge-earned routility-badge-earned-line', ' ');
      a.appendChild(node);
    }
    return { node, text: node };
  }

  function tileSlot(a) {
    let node = a.querySelector(':scope > .routility-badge-earned');
    if (!node) {
      node = el('div', 'base-tile-metadata content-muted text-body-medium text-truncate-end text-no-wrap routility-injected routility-badge-earned', ' ');
      a.appendChild(node);
    }
    return { node, text: node };
  }

  async function loadBadges(ids) {
    const s = st;
    if (!s) return;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      chunk.forEach(id => s.badgeAsked.add(id));
      let res = null;
      try {
        const r = await fetch(`https://badges.roblox.com/v1/users/${s.userId}/badges/awarded-dates?badgeIds=${chunk.join(',')}`, { credentials: 'include' });
        res = r.ok ? await r.json() : null;
      } catch {}
      if (st !== s) return;
      if (!res) {
        chunk.forEach(id => s.badgeAsked.delete(id));
        setTimeout(() => { if (st === s) s.schedule(); }, 15000);
        continue;
      }
      for (const b of res.data || []) if (b && b.awardedDate) s.badges.set(Number(b.badgeId), b.awardedDate);
      chunk.forEach(id => { if (!s.badges.has(id)) s.badges.set(id, null); });
    }
    s.schedule();
  }

  function scan() {
    if (!st) return;
    const seen = new Map();
    const askBadges = [];
    const askBundles = [];
    for (const card of document.querySelectorAll('#content .list-item.item-card')) {
      const a = card.querySelector('a.item-card-link, a[href]');
      const href = a ? a.getAttribute('href') || '' : '';
      const item = st.opts.items && href.match(/\/(?:catalog|library|store\/asset)\/(\d+)/);
      const badge = st.opts.badges && href.match(/\/badges\/(\d+)/);
      const bundle = st.opts.items && href.match(/\/bundles\/(\d+)/);
      if (bundle) {
        const id = Number(bundle[1]);
        if (!st.bundles.has(id) && !st.bundleAsked.has(id)) askBundles.push(id);
        const mine = String(st.userId) === String(document.querySelector('meta[name="user-data"]')?.dataset.userid || '');
        const fake = mine && window.RoUtilityFun && window.RoUtilityFun.owned('bundle', id);
        const when = fake ? new Date(fake.at).toISOString() : st.bundles.get(id);
        const a = when ? age(when) : '';
        setLine(line(card), a ? (a === 'today' ? lt('Today') : a) : '', a ? lt('Owned since {date}', { date: shortDate(when) }) : '');
      } else if (item) {
        const id = Number(item[1]);
        const nth = seen.get(id) || 0;
        seen.set(id, nth + 1);
        const list = st.items.get(id);
        const entry = list && (list[nth] || list[list.length - 1]);
        const n = line(card);
        const out = entry && itemText(entry);
        setLine(n, out ? out.text : '', out && out.tip);
      } else if (badge) {
        const id = Number(badge[1]);
        if (!st.badges.has(id) && !st.badgeAsked.has(id)) askBadges.push(id);
        earned(badgeSlot(card), st.badges.get(id));
      }
    }
    if (st.opts.badges) {
      for (const a of document.querySelectorAll('.routility-classic-badge > a[href*="/badges/"], .base-tile > a[href*="/badges/"]')) {
        const m = (a.getAttribute('href') || '').match(/\/badges\/(\d+)/);
        if (!m) continue;
        const id = Number(m[1]);
        if (!st.badges.has(id) && !st.badgeAsked.has(id)) askBadges.push(id);
        earned(a.closest('.routility-classic-badge') ? classicSlot(a) : tileSlot(a), st.badges.get(id));
      }
    }
    if (askBadges.length) loadBadges([...new Set(askBadges)]);
    if (askBundles.length) {
      const ids = [...new Set(askBundles)];
      ids.forEach(id => st.bundleAsked.add(id));
      loadBundles(ids);
    }
  }

  function setup(userId, opts) {
    if (st && st.userId === String(userId)) return;
    teardown();
    st = { userId: String(userId), opts: opts || { items: true, badges: true }, items: new Map(), badges: new Map(), badgeAsked: new Set(), bundles: new Map(), bundleAsked: new Set(), bundleParts: new Map(), assetDates: new Map(), typesLoaded: new Map() };
    st.schedule = onFrame(scan);
    st.observer = new MutationObserver(st.schedule);
    st.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'routility-inventory-replay' }, location.origin);
    st.schedule();
  }

  function teardown() {
    if (!st) return;
    st.observer.disconnect();
    window.removeEventListener('message', onMessage);
    st = null;
    document.querySelectorAll('.routility-owned-inline, .routility-badge-earned').forEach(n => n.remove());
    document.querySelectorAll('.routility-earned-on').forEach(n => n.classList.remove('routility-earned-on'));
  }

  window.RoUtilityOwned = { setup, teardown, feed };
})();
