(() => {
  const G = globalThis;
  if (G.RoUtilityNet) return;
  const nativeFetch = G.fetch.bind(G);
  const ROBLOX = /^https:\/\/([a-z0-9-]+\.)*roblox\.com\//i;
  const READ_POST = /^https:\/\/(thumbnails\.roblox\.com\/v1\/batch|users\.roblox\.com\/v1\/(users|usernames\/users)|presence\.roblox\.com\/v1\/presence\/users|catalog\.roblox\.com\/v1\/catalog\/items\/details|apis\.roblox\.com\/marketplace-items\/v1\/items\/details)\/?(\?|$)/i;
  const BATCH_URL = 'https://thumbnails.roblox.com/v1/batch';
  const THUMBS = {
    'users/avatar-headshot': ['AvatarHeadShot', 'userIds'],
    'users/avatar-bust': ['AvatarBust', 'userIds'],
    'users/avatar': ['Avatar', 'userIds'],
    'games/icons': ['GameIcon', 'universeIds'],
    'assets': ['Asset', 'assetIds'],
    'groups/icons': ['GroupIcon', 'groupIds'],
    'badges/icons': ['BadgeIcon', 'badgeIds'],
    'bundles/thumbnails': ['BundleThumbnail', 'bundleIds'],
  };
  const BATCH_KEYS = new Set(['requestId', 'type', 'targetId', 'size', 'format', 'isCircular']);
  const AVATAR_TYPES = new Set(['AvatarHeadShot', 'AvatarBust', 'Avatar', 'Outfit']);
  const PER_HOST = 6;
  const BUDGET = 25000;
  const MAX_TRIES = 4;
  const DAY = 864e5;
  const CACHE_MAX = 6000;
  const stats = { requests: 0, limited: 0, retried: 0, deduped: 0, cached: 0, batched: 0, batches: 0 };
  const lanes = new Map();
  const cool = new Map();
  const inflight = new Map();
  const mem = new Map();
  const looked = new Set();
  const pend = new Map();
  let flushTimer = 0;
  let writes = [];
  let writeTimer = 0;
  let dbp = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const abortError = s => (s && s.reason) || new DOMException('The operation was aborted.', 'AbortError');

  function wait(ms, signal) {
    if (!(ms > 0)) return signal && signal.aborted ? Promise.reject(abortError(signal)) : Promise.resolve();
    return new Promise((resolve, reject) => {
      const stop = () => { clearTimeout(t); reject(abortError(signal)); };
      const t = setTimeout(() => { if (signal) signal.removeEventListener('abort', stop); resolve(); }, ms);
      if (signal) {
        if (signal.aborted) return stop();
        signal.addEventListener('abort', stop, { once: true });
      }
    });
  }

  function lane(host) {
    let l = lanes.get(host);
    if (!l) lanes.set(host, l = { active: 0, queue: [] });
    return l;
  }

  function take(host, signal) {
    const l = lane(host);
    if (l.active < PER_HOST) {
      l.active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const item = { resolve };
      l.queue.push(item);
      if (signal) {
        signal.addEventListener('abort', () => {
          const i = l.queue.indexOf(item);
          if (i < 0) return;
          l.queue.splice(i, 1);
          reject(abortError(signal));
        }, { once: true });
      }
    });
  }

  function give(host) {
    const l = lane(host);
    const next = l.queue.shift();
    if (next) next.resolve();
    else l.active = Math.max(0, l.active - 1);
  }

  function endpoint(u) {
    return (u.host + u.pathname.replace(/\/\d+(?=\/|$)/g, '/#')).toLowerCase();
  }

  function retryAfter(res) {
    const h = res.headers.get('retry-after');
    if (!h) return null;
    const n = Number(h);
    if (Number.isFinite(n)) return n * 1000;
    const d = Date.parse(h);
    return Number.isFinite(d) ? Math.max(0, d - Date.now()) : null;
  }

  async function managed(url, init, signal) {
    const u = new URL(url);
    const key = endpoint(u);
    const start = Date.now();
    let tries = 0;
    for (;;) {
      const left = (cool.get(key) || 0) - Date.now();
      if (left > 0) await wait(Math.min(left, BUDGET - (Date.now() - start)), signal);
      await take(u.host, signal);
      let res;
      try {
        stats.requests++;
        res = await nativeFetch(url, init);
      } finally {
        give(u.host);
      }
      if (res.status === 429) {
        stats.limited++;
        const ra = retryAfter(res);
        const pause = Math.min(ra != null ? ra : 1200 * 2 ** tries + Math.random() * 500, 60000);
        cool.set(key, Math.max(cool.get(key) || 0, Date.now() + pause));
        if (tries < MAX_TRIES - 1 && Date.now() - start + pause <= BUDGET) {
          tries++;
          stats.retried++;
          continue;
        }
        return res;
      }
      if (res.status >= 500 && tries === 0) {
        tries++;
        stats.retried++;
        await wait(500 + Math.random() * 500, signal);
        continue;
      }
      return res;
    }
  }

  function plainHeaders(h) {
    return !h || (typeof h === 'object' && !Array.isArray(h) && !(typeof Headers !== 'undefined' && h instanceof Headers));
  }

  function get(url, opts) {
    if (opts.signal || !plainHeaders(opts.headers)) return managed(url, opts, opts.signal || null);
    const key = [opts.method || 'GET', url, opts.credentials || '', opts.cache || '', opts.headers ? JSON.stringify(opts.headers) : ''].join('|');
    let p = inflight.get(key);
    if (p) stats.deduped++;
    else {
      p = managed(url, opts, null);
      inflight.set(key, p);
      const clear = () => { if (inflight.get(key) === p) inflight.delete(key); };
      p.then(clear, clear);
    }
    return p.then(r => r.clone());
  }

  function thumbGet(url) {
    const m = url.match(/^https:\/\/thumbnails\.roblox\.com\/v1\/([a-z/-]+?)\/?\?([^#]*)$/i);
    if (!m) return null;
    const def = THUMBS[m[1].toLowerCase()];
    if (!def) return null;
    let ids = null;
    let size = null;
    let format = 'Png';
    let isCircular = false;
    for (const [k, v] of new URLSearchParams(m[2])) {
      if (k === def[1]) ids = v;
      else if (k === 'size') size = v;
      else if (k === 'format') format = v;
      else if (k === 'isCircular') {
        if (v !== 'true' && v !== 'false') return null;
        isCircular = v === 'true';
      } else if (k === 'returnPolicy') {
        if (v !== 'PlaceHolder') return null;
      } else return null;
    }
    if (!ids || !size) return null;
    const list = ids.split(',');
    if (!list.length || list.length > 100 || !list.every(x => /^\d{1,16}$/.test(x))) return null;
    return list.map(id => ({ type: def[0], targetId: Number(id), size, format, isCircular }));
  }

  function thumbBatch(body) {
    let list;
    try { list = JSON.parse(body); } catch { return null; }
    if (!Array.isArray(list) || !list.length || list.length > 100) return null;
    const out = [];
    for (const r of list) {
      if (!r || typeof r !== 'object' || !Object.keys(r).every(k => BATCH_KEYS.has(k))) return null;
      if (typeof r.type !== 'string' || !/^[A-Za-z]+$/.test(r.type) || !/^\d{1,16}$/.test(String(r.targetId)) || typeof r.size !== 'string' || typeof r.format !== 'string') return null;
      out.push({ requestId: r.requestId, type: r.type, targetId: Number(r.targetId), size: r.size, format: r.format, isCircular: !!r.isCircular });
    }
    return out;
  }

  const thumbKey = e => `${e.type}|${e.targetId}|${e.size}|${String(e.format).toLowerCase()}|${e.isCircular ? 1 : 0}`;
  const freshFor = type => (AVATAR_TYPES.has(type) ? 5 * 60000 : 60 * 60000);

  function myId() {
    try { return G.document && G.document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid'); } catch { return null; }
  }

  function db() {
    if (!dbp) {
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open('routility-net', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('thumbs', { keyPath: 'k' }).createIndex('t', 't');
          req.onsuccess = () => {
            resolve(req.result);
            setTimeout(() => prune(req.result), 15000);
          };
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return dbp;
  }

  function prune(d) {
    try {
      const st = d.transaction('thumbs', 'readwrite').objectStore('thumbs');
      const c = st.count();
      c.onsuccess = () => {
        let extra = c.result - CACHE_MAX;
        if (extra <= 0) return;
        extra += Math.floor(CACHE_MAX / 5);
        st.index('t').openCursor().onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur || extra-- <= 0) return;
          cur.delete();
          cur.continue();
        };
      };
    } catch {}
  }

  async function recall(keys) {
    const miss = keys.filter(k => !mem.has(k) && !looked.has(k));
    if (!miss.length) return;
    const d = await Promise.race([db(), sleep(400).then(() => null)]);
    if (!d) return;
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
      try {
        const tx = d.transaction('thumbs', 'readonly');
        const st = tx.objectStore('thumbs');
        for (const k of miss) {
          looked.add(k);
          const r = st.get(k);
          r.onsuccess = () => {
            const v = r.result;
            if (v && (!mem.has(k) || mem.get(k).t < v.t)) mem.set(k, v);
          };
        }
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  function store(key, r) {
    const row = { k: key, u: r.imageUrl, s: r.state, v: r.version || null, t: Date.now() };
    mem.set(key, row);
    writes.push(row);
    if (!writeTimer) writeTimer = setTimeout(flushWrites, 1500);
  }

  async function flushWrites() {
    writeTimer = 0;
    const rows = writes;
    writes = [];
    const d = await db();
    if (!d || !rows.length) return;
    try {
      const st = d.transaction('thumbs', 'readwrite').objectStore('thumbs');
      for (const row of rows) st.put(row);
    } catch {}
  }

  function coolingLeft(url) {
    return (cool.get(endpoint(new URL(url))) || 0) - Date.now();
  }

  function queue(e, key, background) {
    let p = pend.get(key);
    if (!p) {
      if (background && coolingLeft(BATCH_URL) > 0) return null;
      p = { entry: e, waiters: [] };
      pend.set(key, p);
      if (pend.size >= 100) flush();
      else if (!flushTimer) flushTimer = setTimeout(flush, 25);
    }
    if (background) return null;
    return new Promise(resolve => p.waiters.push(resolve));
  }

  function flush() {
    clearTimeout(flushTimer);
    flushTimer = 0;
    const keys = [...pend.keys()];
    const items = [...pend.values()];
    pend.clear();
    for (let i = 0; i < items.length; i += 100) send(items.slice(i, i + 100), keys.slice(i, i + 100));
  }

  async function send(items, keys) {
    stats.batches++;
    stats.batched += items.length;
    const body = items.map((it, i) => ({ requestId: String(i), type: it.entry.type, targetId: it.entry.targetId, size: it.entry.size, format: it.entry.format, isCircular: it.entry.isCircular }));
    let res = null;
    let data = null;
    try {
      res = await managed(BATCH_URL, { method: 'POST', credentials: G.document ? 'include' : 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, null);
      if (res.ok) data = await res.json();
    } catch {}
    const rows = data && Array.isArray(data.data) ? data.data : null;
    const byId = new Map((rows || []).map(r => [String(r.requestId), r]));
    items.forEach((it, i) => {
      let out;
      const r = byId.get(String(i));
      if (!rows) out = { fail: res && !res.ok ? res.status : 'network' };
      else if (!r) out = { state: 'Error', imageUrl: null, version: null, errorCode: 1, errorMessage: '' };
      else {
        out = { state: r.state, imageUrl: r.imageUrl == null ? null : r.imageUrl, version: r.version == null ? null : r.version, errorCode: r.errorCode || 0, errorMessage: r.errorMessage || '' };
        if (!r.errorCode && (r.state === 'Completed' || r.state === 'Blocked') && r.imageUrl) store(keys[i], out);
      }
      for (const w of it.waiters) w(out);
    });
  }

  async function thumbs(entries, batch) {
    const keys = entries.map(thumbKey);
    await recall(keys);
    const me = myId();
    const now = Date.now();
    const results = await Promise.all(entries.map((e, i) => {
      const hit = mem.get(keys[i]);
      const own = me && AVATAR_TYPES.has(e.type) && String(e.targetId) === me;
      if (hit && !own && now - hit.t < DAY) {
        stats.cached++;
        if (now - hit.t > freshFor(e.type)) queue(e, keys[i], true);
        return { state: hit.s, imageUrl: hit.u, version: hit.v, errorCode: 0, errorMessage: '' };
      }
      return queue(e, keys[i], false);
    }));
    const failed = results.find(r => r && r.fail);
    if (failed) {
      if (failed.fail === 'network') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ errors: [{ code: 0, message: failed.fail === 429 ? 'Too many requests' : 'Request failed' }] }), { status: failed.fail, headers: { 'content-type': 'application/json' } });
    }
    const data = entries.map((e, i) => {
      const r = results[i];
      const row = { targetId: e.targetId, state: r.state, imageUrl: r.imageUrl, version: r.version };
      return batch ? { requestId: e.requestId, errorCode: r.errorCode, errorMessage: r.errorMessage, ...row } : row;
    });
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  function withSignal(p, signal) {
    if (!signal) return p;
    if (signal.aborted) return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
      const stop = () => reject(abortError(signal));
      signal.addEventListener('abort', stop, { once: true });
      p.then((v) => { signal.removeEventListener('abort', stop); resolve(v); }, (e) => { signal.removeEventListener('abort', stop); reject(e); });
    });
  }

  G.fetch = function (input, init) {
    if (typeof input !== 'string' && !(input instanceof URL)) return nativeFetch(input, init);
    const url = String(input);
    if (!ROBLOX.test(url)) return nativeFetch(input, init);
    const opts = init ? { ...init } : {};
    if (opts.mode === 'no-cors' || opts.keepalive) return nativeFetch(input, init);
    const method = String(opts.method || 'GET').toUpperCase();
    try {
      if (method === 'GET') {
        const t = thumbGet(url);
        if (t) return withSignal(thumbs(t, false), opts.signal);
        return get(url, opts);
      }
      if (method === 'HEAD') return get(url, opts);
      if (method === 'POST' && READ_POST.test(url) && (opts.body == null || typeof opts.body === 'string')) {
        const t = /^https:\/\/thumbnails\.roblox\.com\/v1\/batch/i.test(url) && plainHeaders(opts.headers) && thumbBatch(opts.body);
        if (t) return withSignal(thumbs(t, true), opts.signal);
        return managed(url, opts, opts.signal || null);
      }
    } catch {}
    return nativeFetch(input, init);
  };

  G.RoUtilityNet = { stats, nativeFetch, cooling: () => Object.fromEntries([...cool].filter(([, t]) => t > Date.now()).map(([k, t]) => [k, t - Date.now()])) };
})();
