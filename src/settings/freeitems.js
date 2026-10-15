(function () {
  'use strict';

  const SEARCH = 'https://catalog.roblox.com/v2/search/items/details?Category=1&CreatorName=Roblox&MaxPrice=0&SalesTypeFilter=1&Limit=120';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let csrf = '';

  function token() {
    if (!csrf) csrf = document.querySelector('meta[name="csrf-token"]')?.dataset.token || '';
    return csrf;
  }

  function me() {
    return Number(document.querySelector('meta[name="user-data"]')?.dataset.userid) || 0;
  }

  async function call(url, opts = {}, tries = 0) {
    const headers = { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.method === 'POST' ? { 'x-csrf-token': token() } : {}) };
    const res = await fetch(url, { credentials: 'include', ...opts, headers });
    if (res.status === 403 && res.headers.get('x-csrf-token') && tries < 2) {
      csrf = res.headers.get('x-csrf-token');
      return call(url, opts, tries + 1);
    }
    if (res.status === 429 && tries < 4) {
      const after = Number(res.headers.get('retry-after'));
      await wait((Number.isFinite(after) && after > 0 ? after : 15) * 1000);
      return call(url, opts, tries + 1);
    }
    return res;
  }

  async function json(url, opts) {
    const res = await call(url, opts);
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json();
  }

  const onWeb = (i) => !i.saleLocationType || /^Shop/.test(i.saleLocationType);

  async function scan(progress, signal) {
    const found = new Map();
    let cursor = '';
    for (let page = 0; page < 60; page++) {
      if (signal && signal.aborted) throw new Error('stopped');
      const data = await json(SEARCH + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
      for (const i of data.data || []) {
        if (i.creatorTargetId !== 1 || Number(i.price) !== 0 || i.priceStatus !== 'Free' || !i.collectibleItemId || i.isOffSale || !onWeb(i)) continue;
        found.set(i.itemType + ':' + i.id, { id: i.id, type: i.itemType, name: i.name || '', cid: i.collectibleItemId });
      }
      progress && progress({ phase: 'scan', count: found.size });
      cursor = data.nextPageCursor;
      if (!cursor) break;
      await wait(700);
    }
    const items = [...found.values()];
    const missing = [];
    for (let i = 0; i < items.length; i += 100) {
      if (signal && signal.aborted) throw new Error('stopped');
      const chunk = items.slice(i, i + 100);
      const details = await json('https://catalog.roblox.com/v1/catalog/items/details', { method: 'POST', body: JSON.stringify({ items: chunk.map(x => ({ itemType: x.type, id: x.id })) }) });
      const owned = new Set((details.data || []).filter(d => d.owned === true).map(d => d.itemType + ':' + d.id));
      const buyable = new Map((details.data || []).map(d => [d.itemType + ':' + d.id, d]));
      for (const x of chunk) {
        const d = buyable.get(x.type + ':' + x.id);
        if (!d || owned.has(x.type + ':' + x.id) || d.isPurchasable === false || Number(d.price || 0) !== 0) continue;
        missing.push(x);
      }
      progress && progress({ phase: 'owned', checked: Math.min(items.length, i + 100), total: items.length });
      await wait(400);
    }
    for (let i = 0; i < missing.length; i += 50) {
      const chunk = missing.slice(i, i + 50);
      const details = await json('https://apis.roblox.com/marketplace-items/v1/items/details', { method: 'POST', body: JSON.stringify({ itemIds: chunk.map(x => x.cid) }) });
      const byCid = new Map((Array.isArray(details) ? details : details.data || []).map(d => [String(d.collectibleItemId).toLowerCase(), d]));
      for (const x of chunk) {
        const d = byCid.get(String(x.cid).toLowerCase());
        if (d && d.collectibleProductId) x.product = d.collectibleProductId;
        if (d && d.creatorId) x.seller = d.creatorId;
      }
      await wait(400);
    }
    return { total: items.length, missing: missing.filter(x => x.product) };
  }

  async function buy(item) {
    const body = {
      collectibleItemId: item.cid,
      expectedCurrency: 1,
      expectedPrice: 0,
      expectedPurchaserId: me(),
      expectedPurchaserType: 'User',
      expectedSellerId: item.seller || 1,
      expectedSellerType: 'User',
      idempotencyKey: crypto.randomUUID(),
      collectibleProductId: item.product,
    };
    const res = await call(`https://apis.roblox.com/marketplace-sales/v1/item/${item.cid}/purchase-item`, { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 403 && (res.headers.get('rblx-challenge-id') || res.headers.get('rblx-challenge-type'))) return { stop: 'challenge' };
    if (res.status === 429) return { stop: 'slow' };
    let data = null;
    try { data = await res.json(); } catch {}
    if (res.ok && data && data.purchased) return { ok: true };
    return { ok: false, reason: (data && (data.errorMessage || data.purchaseResult)) || 'HTTP ' + res.status };
  }

  async function run(items, progress, signal) {
    const out = { got: [], failed: [], stopped: null };
    for (let i = 0; i < items.length; i++) {
      if (signal && signal.aborted) {
        out.stopped = 'user';
        break;
      }
      let r;
      try {
        r = await buy(items[i]);
      } catch (e) {
        r = { ok: false, reason: e.message };
      }
      if (r.stop) {
        out.stopped = r.stop;
        break;
      }
      (r.ok ? out.got : out.failed).push(r.ok ? items[i] : { ...items[i], reason: r.reason });
      progress && progress({ phase: 'buy', done: i + 1, total: items.length, got: out.got.length, failed: out.failed.length, last: items[i] });
      if (i < items.length - 1) await wait(1600 + Math.round(Math.random() * 900));
    }
    return out;
  }

  window.RoUtilityFreeItems = { scan, run };
})();
