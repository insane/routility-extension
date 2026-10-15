importScripts('net.js');
const API_BASE = 'https://routility.io/api/public';
const FORUM_API = 'https://routility.io/api/forum';
const SITE_API = 'https://routility.io/api';
const FORUM_PATH = /^\/(forums|search|forums\/[a-z0-9-]{1,40}\/threads|threads\/\d{1,20}|users\/\d{1,20})$/;
const FORUM_WRITE = /^\/(threads|threads\/\d{1,20}\/posts|posts\/\d{1,20}\/report)$/;
const FORUM_AUTH_KEY = 'routilityForumAuth';
const REPORT_REASONS = ['spam', 'inappropriate', 'personal-info', 'other'];

function forumAuth() {
  return new Promise(resolve => chrome.storage.local.get(FORUM_AUTH_KEY, st => {
    const a = st[FORUM_AUTH_KEY];
    if (!a || typeof a.token !== 'string' || !a.token) return resolve(null);
    if (a.expiresAt && Date.parse(a.expiresAt) <= Date.now()) {
      chrome.storage.local.remove(FORUM_AUTH_KEY);
      return resolve(null);
    }
    resolve(a);
  }));
}

const ADMIN_KEY = 'routilityAdminCache';
const ADMIN_TTL = 7 * 24 * 60 * 60 * 1000;
const adminInFlight = new Map();

async function robloxAdmin(id) {
  if (adminInFlight.has(id)) return adminInFlight.get(id);
  const job = fetch(`https://accountinformation.roblox.com/v1/users/${id}/roblox-badges`, { credentials: 'omit' })
    .then(r => (r.ok ? r.json() : null))
    .then(list => (Array.isArray(list) ? list.some(b => b && b.id === 1) : null))
    .catch(() => null)
    .finally(() => adminInFlight.delete(id));
  adminInFlight.set(id, job);
  return job;
}

async function robloxAdmins(ids) {
  const store = await new Promise(r => chrome.storage.local.get(ADMIN_KEY, s => r(s[ADMIN_KEY] || {})));
  const now = Date.now();
  const todo = ids.filter(id => !store[id] || now - store[id][1] > ADMIN_TTL);
  for (let i = 0; i < todo.length; i += 4) {
    const chunk = todo.slice(i, i + 4);
    const res = await Promise.all(chunk.map(robloxAdmin));
    chunk.forEach((id, k) => { if (res[k] !== null) store[id] = [res[k] ? 1 : 0, now]; });
  }
  const keys = Object.keys(store);
  if (keys.length > 5000) keys.sort((a, b) => store[a][1] - store[b][1]).slice(0, keys.length - 5000).forEach(k => delete store[k]);
  await new Promise(r => chrome.storage.local.set({ [ADMIN_KEY]: store }, r));
  return ids.filter(id => store[id] && store[id][0] === 1);
}

const FORUM_ROLES = ['moderator', 'admin'];
const signInWindows = new Map();
let forumMeCheckedAt = 0;

function forumRole(r) {
  return FORUM_ROLES.includes(r) ? r : null;
}

function forumUser(a) {
  return a ? { userId: String(a.userId || ''), username: String(a.username || ''), displayName: String(a.displayName || a.username || ''), role: forumRole(a.role), expiresAt: a.expiresAt || null } : null;
}

async function forumMeFresh() {
  const a = await forumAuth();
  if (!a) return null;
  if (Date.now() - forumMeCheckedAt < 5 * 60 * 1000) return a;
  const res = await forumFetch('/auth/me', { headers: { authorization: 'Bearer ' + a.token } });
  if (res.status === 401) {
    await new Promise(r => chrome.storage.local.remove(FORUM_AUTH_KEY, r));
    return null;
  }
  if (res.status !== 200 || !res.data) return a;
  forumMeCheckedAt = Date.now();
  const d = res.data;
  const next = Object.assign({}, a, { username: String(d.username || a.username || ''), displayName: String(d.displayName || d.username || a.displayName || ''), role: forumRole(d.role) });
  if (next.username !== a.username || next.displayName !== a.displayName || next.role !== forumRole(a.role)) await new Promise(r => chrome.storage.local.set({ [FORUM_AUTH_KEY]: next }, r));
  return next;
}

async function forumFetch(path, opts) {
  try {
    const res = await fetch(FORUM_API + path, Object.assign({ credentials: 'omit', cache: 'no-store' }, opts));
    const data = await res.json().catch(() => null);
    const wait = Number(res.headers.get('Retry-After'));
    return { status: res.status, data, retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 0 };
  } catch {
    return { status: 0, data: null, retryAfter: 0 };
  }
}

async function siteFetch(path, opts) {
  try {
    const res = await fetch(SITE_API + path, Object.assign({ credentials: 'omit', cache: 'no-store' }, opts));
    const data = await res.json().catch(() => null);
    const wait = Number(res.headers.get('Retry-After'));
    return { status: res.status, data, retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 0 };
  } catch {
    return { status: 0, data: null, retryAfter: 0 };
  }
}

const AD_TAGS = ['any', 'adds', 'upgrade', 'downgrade', 'demand', 'rares', 'rap', 'wishlist', 'robux', 'projecteds'];

function adEntries(list, looking) {
  const out = [];
  let items = 0;
  let tags = 0;
  for (const e of Array.isArray(list) ? list : []) {
    if (!e || typeof e !== 'object' || out.length >= 16) continue;
    const id = String(e.asset_id || '');
    if (/^\d{1,20}$/.test(id) && items < 8) {
      out.push({ asset_id: id });
      items++;
    } else if (id.startsWith('robux-')) {
      const robux = Math.floor(Number(e.robux));
      if (robux > 0 && robux < 100000000) out.push({ asset_id: 'robux-1', robux });
    } else if (id.startsWith('usd-')) {
      const usd = Math.round(Number(e.usd) * 100) / 100;
      if (usd > 0 && usd < 10000000) out.push({ asset_id: 'usd-1', usd });
    } else if (looking && e.type === 'tag' && AD_TAGS.includes(e.tag) && tags < 4) {
      out.push({ type: 'tag', tag: e.tag });
      tags++;
    } else if (looking && e.type === 'text') {
      const text = String(e.text || '').trim().slice(0, 120);
      if (text) out.push({ type: 'text', text });
    }
  }
  return out;
}

function cleanAd(b) {
  const a = b && typeof b === 'object' ? b : {};
  const out = { offering: adEntries(a.offering, false), looking_for: adEntries(a.looking_for, true), note: String(a.note || '').slice(0, 400) };
  if (a.show_as === 'roblox' || a.show_as === 'discord') out.show_as = a.show_as;
  return out;
}

function cleanWriteBody(path, body) {
  const b = body && typeof body === 'object' ? body : {};
  if (path === '/threads') return { forumId: String(b.forumId || '').slice(0, 40), title: String(b.title || '').slice(0, 200), body: String(b.body || '').slice(0, 10000) };
  if (/\/posts$/.test(path)) return { body: String(b.body || '').slice(0, 10000) };
  return { reason: REPORT_REASONS.includes(b.reason) ? b.reason : 'other' };
}
const REFRESH_INTERVAL = 15 * 60 * 1000;
const RETRY_AFTER_FAILURE = 60 * 1000;

const inFlight = new Map();
const cooldownUntil = new Map();

function cooldownKey(url) {
  const u = new URL(url);
  return u.origin + u.pathname.split('/').slice(0, 4).join('/');
}

function getJson(url) {
  const bucket = cooldownKey(url);
  if (Date.now() < (cooldownUntil.get(bucket) || 0)) return Promise.resolve(null);
  if (inFlight.has(url)) return inFlight.get(url);
  const request = fetch(url, { credentials: 'omit' })
    .then(res => {
      if (res.status === 429) {
        const wait = Number(res.headers.get('Retry-After'));
        cooldownUntil.set(bucket, Date.now() + (Number.isFinite(wait) && wait > 0 ? wait * 1000 : 60000));
        return null;
      }
      return res.ok ? res.json() : null;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

let itemsMemo = null;
let itemsInFlight = null;
let lastFailure = 0;
let bgDb = null;

function bgStore() {
  if (!bgDb) {
    bgDb = new Promise((resolve) => {
      try {
        const req = indexedDB.open('routility-bg', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return bgDb;
}

async function kvGet(key) {
  const d = await bgStore();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const q = d.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function kvSet(key, value) {
  const d = await bgStore();
  if (!d) return false;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function downloadAllItems() {
  const allItems = [];
  let page = 0;
  let pages = 1;
  while (page < pages) {
    const data = await getJson(`${API_BASE}/items?limit=200&page=${page}&sort=usd&dir=desc`);
    if (!data || !Array.isArray(data.items)) throw new Error('items page ' + page);
    allItems.push(...data.items);
    pages = data.pages;
    page++;
  }
  const itemMap = {};
  for (const item of allItems) itemMap[item.id] = item;
  const meta = { routilityLastFetch: Date.now(), routilityItemCount: allItems.length };
  if (await kvSet('items', itemMap)) {
    await chrome.storage.local.set(meta);
    chrome.storage.local.remove('routilityItems');
  } else {
    await chrome.storage.local.set({ ...meta, routilityItems: itemMap });
  }
  itemsMemo = { ...meta, routilityItems: itemMap };
  return itemMap;
}

function fetchAllItems() {
  if (!itemsInFlight) {
    itemsInFlight = downloadAllItems()
      .catch(() => { lastFailure = Date.now(); return null; })
      .finally(() => { itemsInFlight = null; });
  }
  return itemsInFlight;
}

async function getItems() {
  if (!itemsMemo) {
    const meta = await chrome.storage.local.get(['routilityItems', 'routilityLastFetch', 'routilityItemCount']);
    let items = await kvGet('items');
    if (!items && meta.routilityItems) {
      items = meta.routilityItems;
      if (await kvSet('items', items)) chrome.storage.local.remove('routilityItems');
    }
    itemsMemo = { routilityItems: items || meta.routilityItems, routilityLastFetch: meta.routilityLastFetch, routilityItemCount: meta.routilityItemCount };
  }
  const fresh = itemsMemo.routilityItems && Date.now() - itemsMemo.routilityLastFetch < REFRESH_INTERVAL;
  if (fresh || Date.now() - lastFailure < RETRY_AFTER_FAILURE) return itemsMemo.routilityItems || {};
  const updated = await fetchAllItems();
  return updated || itemsMemo.routilityItems || {};
}

async function getHistory(id) {
  const key = 'history:' + id;
  const stored = (await chrome.storage.session.get(key))[key];
  if (stored && Date.now() - stored.fetchedAt < REFRESH_INTERVAL) return stored.points;
  const data = await getJson(`${API_BASE}/item-usd-history/${encodeURIComponent(id)}`);
  if (!data) return stored ? stored.points : null;
  const points = (data.datapoints || [])
    .filter(p => Number.isFinite(p.usd) && Number.isFinite(p.ts))
    .map(p => ({ ts: p.ts, usd: p.usd }));
  await chrome.storage.session.set({ [key]: { points, fetchedAt: Date.now() } });
  return points;
}

function brief(item) {
  return { usd: item.usd, rap: item.rap, value: Number(item.value) > 0 ? Number(item.value) : 0, demand: item.demand || '', trend: item.trend || '', projected: !!item.projected, rare: !!item.rare };
}

let nameIndexFor = null;
let nameIndexMap = null;
let bundleIndexFor = null;
let bundleIndexMap = null;

function bundleIndex(items) {
  if (bundleIndexFor === items) return bundleIndexMap;
  bundleIndexMap = new Map();
  for (const item of Object.values(items)) if (item.bundleId) bundleIndexMap.set(String(item.bundleId), item);
  bundleIndexFor = items;
  return bundleIndexMap;
}

function nameIndex(items) {
  if (nameIndexFor === items) return nameIndexMap;
  const counts = new Map();
  for (const item of Object.values(items)) {
    const key = String(item.name || '').trim().toLowerCase();
    if (!key) continue;
    counts.set(key, counts.has(key) ? null : item);
  }
  nameIndexMap = new Map([...counts].filter(([, item]) => item));
  nameIndexFor = items;
  return nameIndexMap;
}

const ownersCache = new Map();
const OWNERS_TTL = 5 * 60 * 1000;
const FILTERS = new Set(['premium', 'all', 'hoards']);

async function getOwners(id, filter, page) {
  if (!FILTERS.has(filter) || !Number.isInteger(page) || page < 0) return null;
  const url = `${API_BASE}/item-uaids/${encodeURIComponent(id)}?page=${page}&limit=10&filter=${filter}&sort=since&dir=desc`;
  const hit = ownersCache.get(url);
  if (hit && Date.now() - hit.at < OWNERS_TTL) return hit.data;
  const data = await getJson(url);
  if (!data || !Array.isArray(data.uaids)) return null;
  ownersCache.set(url, { data, at: Date.now() });
  return data;
}

let datacentersLoading = null;

function cleanDatacenters(data) {
  const list = Array.isArray(data) ? data : data && Array.isArray(data.datacenters) ? data.datacenters : [];
  return list.filter(d => d && Number.isFinite(Number(d.id)) && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lon)))
    .map(d => ({ id: Number(d.id), city: String(d.city || ''), region: String(d.region || ''), country: String(d.country || ''), lat: Number(d.lat), lon: Number(d.lon) }))
    .slice(0, 500);
}

function getDatacenters(force) {
  if (datacentersLoading) return datacentersLoading;
  datacentersLoading = (async () => {
    const stored = (await chrome.storage.local.get('routilityDatacentersV2')).routilityDatacentersV2;
    const maxAge = force ? 1800000 : stored && stored.list && stored.list.length ? 86400000 : 300000;
    const fresh = stored && Date.now() - (stored.at || 0) < maxAge;
    if (fresh) return { list: stored.list || [], attribution: stored.attribution || '' };
    const data = await getJson(`${API_BASE}/datacenters`);
    const list = cleanDatacenters(data);
    const attribution = data && typeof data.attribution === 'string' ? data.attribution.slice(0, 200) : '';
    if (!list.length && stored && stored.list && stored.list.length) return { list: stored.list, attribution: stored.attribution || '' };
    await chrome.storage.local.set({ routilityDatacentersV2: { list, attribution, at: Date.now() } });
    chrome.storage.local.remove('routilityDatacenters');
    return { list, attribution };
  })().finally(() => { datacentersLoading = null; });
  return datacentersLoading;
}

async function getHeadshots(ids) {
  const clean = [...new Set(ids.map(String))].filter(id => /^\d+$/.test(id)).slice(0, 100);
  if (!clean.length) return {};
  const data = await getJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${clean.join(',')}&size=150x150&format=Webp&isCircular=false`);
  const map = {};
  for (const t of (data && data.data) || []) if ((t.state === 'Completed' || t.state === 'Blocked') && t.imageUrl) map[String(t.targetId)] = t.imageUrl;
  return map;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details && details.reason === 'install') {
    chrome.storage.local.set({ routilityWelcome: true });
    chrome.tabs.create({ url: 'https://www.roblox.com/my/account#!/routility' });
  }
  chrome.storage.local.get(null, (all) => {
    const old = Object.keys(all).filter(k => k.startsWith('routilityHistory:'));
    if (old.length) chrome.storage.local.remove(old);
    const s = all.routilitySettings;
    if (s && s.calcRobux === 'none') chrome.storage.local.set({ routilitySettings: Object.assign({}, s, { calcRobux: 'devex', calcRobuxRap: false }) });
  });
  fetchAllItems();
});
chrome.runtime.onStartup.addListener(() => fetchAllItems());

const STATUS_URL = 'https://api.status.io/1.0/status/59db90dbcdeb2f04dadcf16d';
const STATUS_NAMES = { 200: LT('Planned Maintenance'), 300: LT('Degraded Performance'), 400: LT('Partial Disruption'), 500: LT('Service Disruption'), 600: LT('Security Event') };
let statusCache = null;

async function robloxStatus() {
  if (statusCache && Date.now() - statusCache.at < 120000) return statusCache.data;
  let data = null;
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store' });
    if (res.ok) {
      const r = (await res.json()).result || {};
      const code = Number(r.status_overall?.status_code) || 100;
      const hit = new Map();
      for (const group of r.status || []) for (const c of group.containers || []) {
        if (Number(c.status_code) > 100 && Number(c.status_code) > (hit.get(c.name) || 0)) hit.set(c.name, Number(c.status_code));
      }
      const incidents = (r.incidents || []).map(i => ({ id: String(i._id || i.id || i.name), name: String(i.name || '').trim() })).filter(i => i.name);
      const maintenance = (r.maintenance?.active || []).map(m => ({ id: String(m._id || m.id || m.name), name: String(m.name || '').trim() })).filter(m => m.name);
      const top = Math.max(code, ...hit.values(), incidents.length ? 300 : 100, maintenance.length ? 200 : 100);
      data = {
        code: top,
        label: STATUS_NAMES[top] || STATUS_NAMES[Math.floor(top / 100) * 100] || LT('Operational'),
        parts: [...hit.keys()],
        incident: incidents[0]?.name || maintenance[0]?.name || '',
        key: [top, ...incidents.map(i => i.id), ...maintenance.map(m => m.id)].join('|'),
      };
    }
  } catch {}
  statusCache = { at: Date.now(), data };
  return data;
}

let botFeatureMemo = null;
function botFeatures() {
  if (!botFeatureMemo) {
    botFeatureMemo = fetch(chrome.runtime.getURL('settings.js')).then(r => r.text()).then((src) => {
      const str = (s) => { try { return JSON.parse('"' + s.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'); } catch { return s; } };
      const defaults = {};
      const dm = src.match(/const DEFAULTS = \{([^}]*)\}/);
      if (dm) for (const m of dm[1].matchAll(/(\w+):\s*(true|false|'[^']*')/g)) defaults[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : m[2].slice(1, -1);
      const tabs = {};
      for (const m of src.matchAll(/\{ key: '(\w+)', hash: '([^']+)', label: (?:LT\()?'([^']+)'/g)) tabs[m[1]] = { hash: m[2], label: m[3] };
      const start = src.indexOf('const PAGES = {');
      const marks = [...src.slice(start).matchAll(/\r?\n {4}(\w+): \{\r?\n {6}intro:/g)].map(m => ({ at: start + m.index, tab: m[1] }));
      const out = [];
      for (const m of src.slice(start).matchAll(/\{ key: '(\w+)',(?: parent: '(\w+)',)? title: (?:LT\()?'((?:[^'\\]|\\.)*)'\)?, desc: (?:LT\()?'((?:[^'\\]|\\.)*)'/g)) {
        const at = start + m.index;
        const tab = [...marks].reverse().find(x => x.at < at)?.tab || 'general';
        if (typeof defaults[m[1]] !== 'boolean') continue;
        out.push({ key: m[1], parent: m[2] || '', title: str(m[3]), desc: str(m[4]), tab, tabLabel: tabs[tab]?.label || '', hash: tabs[tab]?.hash || '#!/routility', def: defaults[m[1]] });
      }
      const byKey = Object.fromEntries(out.map(f => [f.key, f]));
      for (const f of out) if (f.parent && byKey[f.parent]) f.parentTitle = byKey[f.parent].title, f.parentDesc = byKey[f.parent].desc;
      return out;
    }).catch(() => { botFeatureMemo = null; return []; });
  }
  return botFeatureMemo;
}

const PRESET_VALUES = new Set(['itemPrices', 'itemUsd', 'itemDemand', 'itemTrend', 'itemCopies', 'itemChange', 'itemOwnedRow', 'itemTags', 'usdChart', 'owners', 'resellerDeals', 'inventoryValues', 'tradeValues', 'tradeOwnership', 'tradeItemCard', 'marketplaceValues', 'robuxUsd', 'exactPrices', 'txUsd', 'tradeCalculator', 'calcNav', 'calcLinks', 'calcRemember', 'calcEven', 'calcPercents', 'calcRobuxRap', 'tradeWarning', 'tradeSendSummary', 'purchaseLock', 'buyBalance', 'menuLink', 'hoverTips']);
const PRESET_INERT = /^(streamer(?!Mode$)|classic(Games|Catalog|Develop|Groups|Packages)$|forumStat)/;
const PRESET_NEVER = new Set(['badgeAutoDelete', 'streamerMode', 'hideChat', 'customTheme', 'classicNames', 'classicLogo', 'studioStatus', 'fakeRobux', 'fakeBuy', 'fakeRequests', 'catalogRobloxOnly', 'skipR6Warning', 'keepR6', 'avoidFriends', 'notifyUgc']);
let defaultsMemo = null;

function settingsDefaults() {
  if (!defaultsMemo) {
    defaultsMemo = fetch(chrome.runtime.getURL('settings.js')).then(r => r.text()).then((src) => {
      const out = {};
      const dm = src.match(/const DEFAULTS = \{([^}]*)\}/);
      if (dm) for (const m of dm[1].matchAll(/(\w+):\s*(true|false)\b/g)) out[m[1]] = m[2] === 'true';
      return out;
    }).catch(() => { defaultsMemo = null; return {}; });
  }
  return defaultsMemo;
}

function presetMap(name, defs) {
  const out = {};
  for (const [k, def] of Object.entries(defs)) {
    if (name === 'recommended' || PRESET_INERT.test(k)) out[k] = def;
    else if (name === 'values') out[k] = PRESET_VALUES.has(k);
    else if (name === 'everything') out[k] = PRESET_NEVER.has(k) ? def : true;
  }
  return out;
}

async function presetState() {
  const defs = await settingsDefaults();
  const st = await chrome.storage.local.get(['routilitySettings', 'routilityPresetBackup', 'routilityWelcome']);
  const cur = st.routilitySettings || {};
  const effective = (k) => (typeof cur[k] === 'boolean' ? cur[k] : defs[k]);
  let current = null;
  for (const name of ['values', 'recommended', 'everything']) {
    const map = presetMap(name, defs);
    if (Object.keys(map).every(k => effective(k) === map[k])) { current = name; break; }
  }
  return { current, canUndo: !!st.routilityPresetBackup, welcome: !!st.routilityWelcome };
}

async function applyPreset(name) {
  if (!['values', 'recommended', 'everything'].includes(name)) return { ok: false };
  const defs = await settingsDefaults();
  if (!Object.keys(defs).length) return { ok: false };
  const st = await chrome.storage.local.get('routilitySettings');
  const cur = st.routilitySettings || {};
  await chrome.storage.local.set({ routilitySettings: { ...cur, ...presetMap(name, defs) }, routilityPresetBackup: cur, routilityWelcome: false });
  return { ok: true };
}

async function undoPreset() {
  const st = await chrome.storage.local.get('routilityPresetBackup');
  if (!st.routilityPresetBackup) return { ok: false };
  await chrome.storage.local.set({ routilitySettings: st.routilityPresetBackup });
  await chrome.storage.local.remove('routilityPresetBackup');
  return { ok: true };
}

let i18nDict = null;
let i18nRules = new Intl.PluralRules('en');

function LT(text) {
  return text;
}

function loadI18n() {
  return new Promise(done => chrome.storage.local.get('routilityI18nDict', (st) => {
    const c = st.routilityI18nDict;
    const s = c && c.data && c.lang ? c : null;
    i18nDict = s ? s.data : null;
    try { i18nRules = new Intl.PluralRules(s ? (s.lang === 'zh-cn' ? 'zh-CN' : s.lang === 'zh-tw' ? 'zh-TW' : s.lang) : 'en'); } catch { i18nRules = new Intl.PluralRules('en'); }
    done();
  }));
}

let i18nLoaded = loadI18n();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.routilityI18nDict || changes.routilitySettings)) i18nLoaded = loadI18n();
});

function i18nFill(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : text;
}

function lt(text, vars) {
  const v = i18nDict ? i18nDict[text] : null;
  return i18nFill(typeof v === 'string' && v ? v : v && typeof v === 'object' ? v.other || text : text, vars);
}

function ltn(n, one, other, vars) {
  const all = Object.assign({ n }, vars || {});
  const v = i18nDict ? i18nDict[other] : null;
  if (typeof v === 'string' && v) return i18nFill(v, all);
  if (v && typeof v === 'object') return i18nFill(v[i18nRules.select(Number(n))] || v.other || other, all);
  return i18nFill(Number(n) === 1 ? one : other, all);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'playtimeSyncState') {
    Promise.all([forumAuth(), chrome.storage.local.get(PLAY_SYNC_KEY)]).then(([auth, st]) => sendResponse({ signedIn: !!auth, userId: auth ? auth.userId : null, sync: st[PLAY_SYNC_KEY] || null }), () => sendResponse(null));
    return true;
  }
  if (msg.type === 'playtimeSyncNow') {
    playtimeSync('full').then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'rotatorState') {
    rotatorState().then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === 'rotatorSave') {
    rotatorSave(msg).then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === 'presetState') {
    presetState().then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === 'applyPreset') {
    applyPreset(String(msg.name || '')).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'undoPreset') {
    undoPreset().then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'dismissWelcome') {
    chrome.storage.local.set({ routilityWelcome: false });
    sendResponse(true);
    return false;
  }
  if (msg.type === 'i18nDict') {
    const lang = String(msg.lang || '');
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(lang)) {
      sendResponse(null);
      return false;
    }
    fetch(chrome.runtime.getURL(`locales/${lang}.json`)).then(r => (r.ok ? r.json() : null)).then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg.type === 'botFeatures') {
    botFeatures().then(sendResponse);
    return true;
  }


  if (msg.type === 'searchItems') {
    const q = String(msg.query || '').trim().toLowerCase().slice(0, 60);
    if (q.length < 2) { sendResponse([]); return; }
    getItems().then((items) => {
      const rank = (i) => {
        const name = (i.name || '').toLowerCase();
        const acr = (i.acr || '').toLowerCase();
        if (acr === q || name === q) return 0;
        if (name.startsWith(q)) return 1;
        if (name.split(/\s+/).some(w => w.startsWith(q))) return 2;
        if (name.includes(q)) return 3;
        return 9;
      };
      const hits = Object.values(items).map(i => [rank(i), i]).filter(([r]) => r < 9)
        .sort((a, b) => a[0] - b[0] || (b[1].usd || 0) - (a[1].usd || 0))
        .slice(0, Math.min(5, Number(msg.limit) || 2))
        .map(([, i]) => ({ id: i.id, name: i.name, usd: i.usd, rap: i.rap, value: Number(i.value) > 0 ? Number(i.value) : 0, demand: i.demand || '', thumb: i.thumb || '', bundleId: i.bundleId ? String(i.bundleId) : '' }));
      sendResponse(hits);
    });
    return true;
  }

  if (msg.type === 'calcItems') {
    getItems().then(items => {
      sendResponse(Object.values(items).map(i => ({ id: String(i.id), name: i.name || '', acr: i.acr || '', usd: Number.isFinite(i.usd) ? i.usd : 0, rap: i.rap || 0, value: Number(i.value) > 0 ? Number(i.value) : 0, bundleId: i.bundleId ? String(i.bundleId) : '', demand: i.demand || '', trend: i.trend || '', rare: !!i.rare, projected: !!i.projected, thumb: i.thumb || '' })));
    });
    return true;
  }

  if (msg.type === 'getItem') {
    getItems().then(items => {
      const item = msg.bundle ? bundleIndex(items).get(String(msg.bundle)) : items[msg.id];
      sendResponse({ item: item || null, ready: Object.keys(items).length > 0 });
    });
    return true;
  }

  if (msg.type === 'warm') {
    getItems().then(() => sendResponse(true));
    return true;
  }

  if (msg.type === 'getPrices') {
    getItems().then(items => {
      const ids = {};
      for (const id of (msg.ids || []).slice(0, 10000)) {
        const item = items[id];
        if (item && Number.isFinite(item.usd)) ids[id] = brief(item);
      }
      const names = {};
      if (msg.names && msg.names.length) {
        const index = nameIndex(items);
        for (const n of msg.names.slice(0, 1000)) {
          const match = index.get(String(n).toLowerCase());
          if (match && Number.isFinite(match.usd)) names[n] = brief(match);
        }
      }
      const bundles = {};
      if (msg.bundles && msg.bundles.length) {
        const byBundle = bundleIndex(items);
        const index = nameIndex(items);
        for (const b of msg.bundles.slice(0, 1000)) {
          const s = String(b);
          const cut = s.indexOf(':');
          const id = cut < 0 ? s : s.slice(0, cut);
          const name = cut < 0 ? '' : s.slice(cut + 1);
          const match = byBundle.get(id) || (name ? index.get(name) : null);
          if (match && Number.isFinite(match.usd)) bundles[s] = brief(match);
        }
      }
      sendResponse({ ids, names, bundles, ready: Object.keys(items).length > 0 });
    });
    return true;
  }

  if (msg.type === 'getOwners') {
    getOwners(msg.id, msg.filter, msg.page).then(sendResponse);
    return true;
  }

  if (msg.type === 'getAssetThumbs') {
    const all = [...new Set((msg.ids || []).map(String))];
    const ids = all.filter(id => /^\d+$/.test(id)).slice(0, 100);
    const bundles = all.filter(id => /^b\d+$/.test(id)).map(id => id.slice(1)).slice(0, 100);
    if (!ids.length && !bundles.length) { sendResponse({}); return; }
    const size = msg.size === '420x420' ? '420x420' : '150x150';
    const fill = (map, data, prefix) => {
      for (const t of (data && data.data) || []) if ((t.state === 'Completed' || t.state === 'Blocked') && t.imageUrl) map[prefix + String(t.targetId)] = t.imageUrl;
    };
    Promise.all([
      ids.length ? getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${ids.join(',')}&size=${size}&format=Webp&isCircular=false`) : null,
      bundles.length ? getJson(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundles.join(',')}&size=${size}&format=Webp&isCircular=false`) : null,
    ]).then(([a, b]) => {
      const map = {};
      fill(map, a, '');
      fill(map, b, 'b');
      sendResponse(map);
    });
    return true;
  }

  if (msg.type === 'serverRegions') {
    const placeId = String(msg.placeId || '');
    const ids = (Array.isArray(msg.ids) ? msg.ids : []).map(String).filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)).slice(0, 30);
    if (!/^\d{1,20}$/.test(placeId) || !ids.length) { sendResponse({ regions: {} }); return; }
    fetch(`${API_BASE}/servers/regions?placeId=${placeId}&ids=${ids.join(',')}`, { credentials: 'omit' })
      .then(async res => {
        if (res.status === 429) {
          const wait = Number(res.headers.get('Retry-After'));
          return { retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 30 };
        }
        const data = res.ok ? await res.json() : null;
        const regions = {};
        for (const [id, dc] of Object.entries((data && data.regions) || {})) regions[id] = Number.isFinite(dc) ? dc : null;
        const details = {};
        for (const [id, d] of Object.entries((data && data.details) || {})) {
          if (!d || typeof d !== 'object') continue;
          details[id] = { placeVersion: Number.isFinite(d.placeVersion) ? d.placeVersion : null, startedAt: typeof d.startedAt === 'string' ? d.startedAt : null };
        }
        return { regions, details };
      })
      .catch(() => null)
      .then(sendResponse);
    return true;
  }

  if (msg.type === 'serverCounts' || msg.type === 'serverRegionList') {
    const placeId = String(msg.placeId || '');
    if (!/^\d{1,20}$/.test(placeId)) { sendResponse(null); return; }
    let url = `${API_BASE}/servers/counts?placeId=${placeId}`;
    if (msg.type === 'serverRegionList') {
      const ids = (Array.isArray(msg.ids) ? msg.ids : []).map(Number).filter(n => Number.isFinite(n) && n > 0).slice(0, 20);
      if (!ids.length) { sendResponse(null); return; }
      url = `${API_BASE}/servers/region?placeId=${placeId}&datacenterIds=${ids.join(',')}${msg.cursor ? `&cursor=${encodeURIComponent(String(msg.cursor).slice(0, 500))}` : ''}`;
    }
    fetch(url, { credentials: 'omit' })
      .then(async res => {
        if (res.status === 429) {
          const wait = Number(res.headers.get('Retry-After'));
          return { retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 30 };
        }
        const data = await res.json().catch(() => null);
        if (res.status === 202 || (data && data.scanning)) {
          const wait = Number(res.headers.get('Retry-After'));
          return { scanning: true, listed: Number(data && data.listed) || 0, resolved: Number(data && data.resolved) || 0, retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 0 };
        }
        if (!res.ok || !data) return null;
        if (msg.type === 'serverCounts') {
          return {
            total: Number(data.total) || 0,
            located: Number(data.located) || 0,
            updatedAt: data.updatedAt || null,
            latestVersion: Number.isFinite(data.latestVersion) ? data.latestVersion : null,
            regions: (Array.isArray(data.regions) ? data.regions : []).map(r => ({ datacenterId: Number(r.datacenterId), servers: Number(r.servers) || 0, players: Number(r.players) || 0 })).filter(r => Number.isFinite(r.datacenterId)),
          };
        }
        return {
          servers: (Array.isArray(data.servers) ? data.servers : []).filter(sv => sv && typeof sv.id === 'string').map(sv => ({ id: sv.id, playing: Number(sv.playing) || 0, maxPlayers: Number(sv.maxPlayers) || 0, ping: Number.isFinite(sv.ping) ? sv.ping : null, fps: Number.isFinite(sv.fps) ? sv.fps : null, datacenterId: Number(sv.datacenterId), placeVersion: Number.isFinite(sv.placeVersion) ? sv.placeVersion : null, startedAt: typeof sv.startedAt === 'string' ? sv.startedAt : null, playerTokens: (Array.isArray(sv.playerTokens) ? sv.playerTokens : []).filter(t => typeof t === 'string').slice(0, 5) })),
          nextCursor: typeof data.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null,
        };
      })
      .catch(() => null)
      .then(sendResponse);
    return true;
  }

  if (msg.type === 'loadDraco') {
    if (!sender.tab) { sendResponse(false); return; }
    chrome.scripting.executeScript({ target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] }, files: ['lib/draco_wasm_wrapper.js'] })
      .then(() => sendResponse(true), () => sendResponse(false));
    return true;
  }

  if (msg.type === 'assetFile') {
    const id = String(msg.id || '');
    const format = ['avatar_meshpart_accessory', 'avatar_meshpart_head'].includes(msg.format) ? msg.format : '';
    if (!/^\d{1,20}$/.test(id)) { sendResponse({ status: 400 }); return; }
    const tryFetch = async (attempt) => {
      const res = await fetch(`https://assetdelivery.roblox.com/v2/asset/?id=${id}`, { credentials: 'include', headers: format ? { 'Roblox-AssetFormat': format } : {} });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await new Promise(r => setTimeout(r, 700 * Math.pow(2, attempt) + Math.random() * 300));
        return tryFetch(attempt + 1);
      }
      return res;
    };
    tryFetch(0)
      .then(async res => {
        const data = await res.json().catch(() => null);
        const loc = data && Array.isArray(data.locations) && data.locations[0] && data.locations[0].location;
        sendResponse(res.ok && typeof loc === 'string' && /^https:\/\/([a-z0-9.-]+\.rbxcdn\.com|contentdelivery\.roblox\.com)\//.test(loc) ? { status: 200, location: loc, assetTypeId: Number(data.assetTypeId) || 0 } : { status: res.status || 0 });
      })
      .catch(() => sendResponse({ status: 0 }));
    return true;
  }

  if (msg.type === 'robloxAdmins') {
    const ids = [...new Set((Array.isArray(msg.ids) ? msg.ids : []).map(String).filter(id => /^\d{1,20}$/.test(id)))].slice(0, 200);
    if (!ids.length) { sendResponse({ admins: [] }); return; }
    robloxAdmins(ids).then(admins => sendResponse({ admins }), () => sendResponse({ admins: [] }));
    return true;
  }

  if (msg.type === 'forumMe') {
    forumMeFresh().then(a => sendResponse({ user: forumUser(a) }));
    return true;
  }

  if (msg.type === 'forumSignInClose') {
    const w = signInWindows.get(String(msg.pairing || ''));
    signInWindows.delete(String(msg.pairing || ''));
    if (w && w.windowId != null) chrome.windows.remove(w.windowId).catch(() => {});
    if (w && w.tabId != null) {
      chrome.tabs.update(w.tabId, { active: true }).catch(() => {});
      if (w.openerWindow != null) chrome.windows.update(w.openerWindow, { focused: true }).catch(() => {});
    }
    sendResponse(true);
    return;
  }

  if (msg.type === 'forumSignIn') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const pairing = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    const url = `${FORUM_API}/auth/start?pairing=${pairing}`;
    fetch(url, { credentials: 'omit', cache: 'no-store', redirect: 'manual' })
      .then(async res => {
        if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
          const opener = sender.tab ? await chrome.windows.get(sender.tab.windowId).catch(() => null) : null;
          const width = Math.min(760, opener ? opener.width - 40 : 760);
          const height = Math.min(860, opener ? opener.height - 40 : 860);
          const left = opener ? Math.round(opener.left + (opener.width - width) / 2) : undefined;
          const top = opener ? Math.round(opener.top + (opener.height - height) / 2) : undefined;
          const win = await chrome.windows.create({ url, type: 'popup', width, height, left, top, focused: true }).catch(() => null);
          if (!win) await chrome.tabs.create({ url, active: true });
          signInWindows.set(pairing, { windowId: win ? win.id : null, tabId: sender.tab ? sender.tab.id : null, openerWindow: sender.tab ? sender.tab.windowId : null });
          return { pairing };
        }
        const data = await res.json().catch(() => null);
        return { status: res.status, message: data && typeof data.message === 'string' ? data.message : '' };
      })
      .catch(() => ({ status: 0, message: '' }))
      .then(sendResponse);
    return true;
  }

  if (msg.type === 'forumClaim') {
    const pairing = String(msg.pairing || '');
    if (!/^[0-9a-f]{32}$/.test(pairing)) { sendResponse({ status: 400 }); return; }
    forumFetch('/auth/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairing }) }).then(res => {
      const d = res.data;
      if (res.status === 200 && d && typeof d.token === 'string' && d.token && /^\d+$/.test(String(d.userId))) {
        const auth = { token: d.token, userId: String(d.userId), username: String(d.username || ''), displayName: String(d.displayName || d.username || ''), role: forumRole(d.role), expiresAt: d.expiresAt || null };
        forumMeCheckedAt = Date.now();
        chrome.storage.local.set({ [FORUM_AUTH_KEY]: auth }, () => {
          sendResponse({ status: 200, user: forumUser(auth) });
          playtimeSync('full').catch(() => {});
        });
        return;
      }
      sendResponse({ status: res.status, message: d && typeof d.message === 'string' ? d.message : '' });
    });
    return true;
  }

  if (msg.type === 'forumSignOut') {
    forumAuth().then(async a => {
      if (a) await forumFetch('/auth/logout', { method: 'POST', headers: { authorization: 'Bearer ' + a.token } });
      forumMeCheckedAt = 0;
      chrome.storage.local.remove(FORUM_AUTH_KEY, () => sendResponse({ ok: true }));
    });
    return true;
  }

  if (msg.type === 'forumWrite') {
    const path = String(msg.path || '');
    if (!FORUM_WRITE.test(path)) { sendResponse({ status: 400, data: null }); return; }
    forumAuth().then(async a => {
      if (!a) return sendResponse({ status: 401, data: { message: lt('Sign in to post.') } });
      const res = await forumFetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token }, body: JSON.stringify(cleanWriteBody(path, msg.body)) });
      if (res.status === 401) chrome.storage.local.remove(FORUM_AUTH_KEY);
      sendResponse(res);
    });
    return true;
  }

  if (msg.type === 'forumApi') {
    const path = String(msg.path || '');
    if (!FORUM_PATH.test(path)) { sendResponse({ status: 400, data: null }); return; }
    const p = msg.params && typeof msg.params === 'object' ? msg.params : {};
    const params = new URLSearchParams();
    if (path === '/search') params.set('q', String(p.q || '').trim().slice(0, 50));
    if (path === '/search' && /^[a-z0-9-]{1,40}$/.test(String(p.forumId || ''))) params.set('forumId', p.forumId);
    if (/\/threads$/.test(path) && [1, 3, 7, 14, 30, 90, 180, 360].includes(Number(p.days))) params.set('days', String(Number(p.days)));
    const page = Number(p.page);
    if (Number.isInteger(page) && page > 1 && page < 100000) params.set('page', String(page));
    const query = params.toString();
    fetch(FORUM_API + path + (query ? `?${query}` : ''), { credentials: 'omit', cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        const wait = Number(res.headers.get('Retry-After'));
        return { status: res.status, data, retryAfter: Number.isFinite(wait) && wait > 0 ? wait : 0 };
      })
      .catch(() => ({ status: 0, data: null }))
      .then(sendResponse);
    return true;
  }

  if (msg.type === 'tradeAdsList') {
    const p = msg.params && typeof msg.params === 'object' ? msg.params : {};
    if (p.mine) {
      siteFetch('/ads/mine', { credentials: 'include' }).then(sendResponse);
      return true;
    }
    const params = new URLSearchParams();
    const page = Number(p.page);
    params.set('page', String(Number.isInteger(page) && page > 0 && page < 100000 ? page : 0));
    if (['top', 'mid', 'low'].includes(p.tier)) params.set('tier', p.tier);
    if (['rap-desc', 'rap-asc'].includes(p.sort)) params.set('sort', p.sort);
    if (/^\d{1,20}$/.test(String(p.itemId || ''))) params.set('item_id', String(p.itemId));
    const q = String(p.q || '').trim().slice(0, 50);
    if (q) params.set('q', q);
    siteFetch('/ads/?' + params.toString()).then(sendResponse);
    return true;
  }

  if (msg.type === 'routilityMe') {
    siteFetch('/auth/me', { credentials: 'include' }).then(res => {
      const d = res.data;
      sendResponse({ status: res.status, user: res.status === 200 && d && d.roblox_id ? { robloxId: String(d.roblox_id), name: String(d.username || ''), discord: !!(d.discord && d.discord.id) } : null });
    });
    return true;
  }

  if (msg.type === 'tradeAdsWrite') {
    const id = String(msg.id || '');
    const json = { 'content-type': 'application/json' };
    if (msg.action === 'create') {
      siteFetch('/ads/', { method: 'POST', credentials: 'include', headers: json, body: JSON.stringify(cleanAd(msg.body)) }).then(sendResponse);
      return true;
    }
    if (!/^[\w-]{1,40}$/.test(id)) { sendResponse({ status: 400, data: null }); return; }
    if (msg.action === 'delete') {
      siteFetch('/ads/' + id, { method: 'DELETE', credentials: 'include' }).then(sendResponse);
      return true;
    }
    if (msg.action === 'report') {
      const reason = String(msg.reason || '').trim().slice(0, 200);
      if (!reason) { sendResponse({ status: 400, data: { error: lt('Pick a reason.') } }); return; }
      siteFetch('/ads/' + id + '/report', { method: 'POST', credentials: 'include', headers: json, body: JSON.stringify({ reason }) }).then(sendResponse);
      return true;
    }
    sendResponse({ status: 400, data: null });
    return;
  }

  if (msg.type === 'robloxStatus') {
    robloxStatus().then(sendResponse);
    return true;
  }

  if (msg.type === 'getDatacenters') {
    getDatacenters(!!msg.force).then(sendResponse);
    return true;
  }

  if (msg.type === 'getHeadshots') {
    getHeadshots(msg.ids || []).then(sendResponse);
    return true;
  }

  if (msg.type === 'getHistory') {
    getHistory(msg.id).then(points => sendResponse({ points }));
    return true;
  }

  if (msg.type === 'reloadRobloxTabs') {
    chrome.tabs.query({ url: ['https://www.roblox.com/*', 'https://create.roblox.com/*'] }, (tabs) => {
      let n = 0;
      for (const tab of tabs || []) {
        if (sender.tab && tab.id === sender.tab.id) continue;
        chrome.tabs.reload(tab.id);
        n++;
      }
      sendResponse({ n });
    });
    return true;
  }

  if (msg.type === 'playerLookup') {
    const ids = [...new Set((msg.ids || []).map(String).filter(id => /^\d+$/.test(id)))].slice(0, 100);
    if (!ids.length) { sendResponse({}); return; }
    getJson(`${API_BASE}/players/lookup?ids=${ids.join(',')}`).then(data => sendResponse(data && data.players && typeof data.players === 'object' ? data.players : null));
    return true;
  }

  if (msg.type === 'searchPlayers') {
    const q = String(msg.query || '').trim().slice(0, 50);
    if (q.length < 3) { sendResponse([]); return; }
    getJson(`${API_BASE}/players?q=${encodeURIComponent(q)}&limit=10`).then(data => sendResponse(data && Array.isArray(data.players) ? data.players : null));
    return true;
  }

  if (msg.type === 'getFriends') {
    const id = String(msg.userId || '');
    if (!/^\d{1,20}$/.test(id)) { sendResponse(null); return; }
    getJson(`${API_BASE}/friends/${id}`).then(data => sendResponse(data));
    return true;
  }

  if (msg.type === 'getCacheStatus') {
    chrome.storage.local.get(['routilityLastFetch', 'routilityItemCount']).then(stored => {
      sendResponse({
        lastFetch: stored.routilityLastFetch || null,
        itemCount: stored.routilityItemCount || 0,
      });
    });
    return true;
  }

  if (msg.type === 'refreshCache') {
    fetchAllItems().then(result => sendResponse({ ok: !!result }));
    return true;
  }
});

const NOTIFY_ALARM = 'routilityNotify';
const NOTIFY_SEEN = 'routilityNotifySeen';
const NOTIFY_LINKS = 'routilityNotifyLinks';
const NOTIFY_DEFAULTS = { notifyInbound: true, notifyOutbound: true, notifyCompleted: true, notifyDeclined: true, notifyLimiteds: true, notifyUgc: false, priceAlerts: true };
const ALERTS_KEY = 'routilityPriceAlerts';
const TRADE_KINDS = [['inbound', 'notifyInbound'], ['outbound', 'notifyOutbound'], ['completed', 'notifyCompleted'], ['inactive', 'notifyDeclined']];
let notifyRunning = null;
let meCache = { id: null, at: 0 };

async function notifySettings() {
  const s = (await chrome.storage.local.get('routilitySettings')).routilitySettings || {};
  const out = {};
  for (const [k, d] of Object.entries(NOTIFY_DEFAULTS)) out[k] = s[k] === undefined ? d : s[k] !== false;
  return out;
}

async function syncNotifyAlarm() {
  const s = await notifySettings();
  const on = Object.values(s).some(Boolean);
  const existing = await chrome.alarms.get(NOTIFY_ALARM);
  if (on && !existing) chrome.alarms.create(NOTIFY_ALARM, { periodInMinutes: 1, delayInMinutes: 0.1 });
  if (!on && existing) chrome.alarms.clear(NOTIFY_ALARM);
}

let authCooldown = 0;

async function authJson(url) {
  if (Date.now() < authCooldown) return { status: 429, data: null };
  try {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After'));
      authCooldown = Date.now() + (Number.isFinite(wait) && wait > 0 ? wait * 1000 : 60000);
      return { status: 429, data: null };
    }
    if (!res.ok) return { status: res.status, data: null };
    return { status: 200, data: await res.json() };
  } catch {
    return { status: 0, data: null };
  }
}

async function signedInUser(fresh) {
  if (!fresh && meCache.id && Date.now() - meCache.at < 10 * 60 * 1000) return meCache.id;
  const r = await authJson('https://users.roblox.com/v1/users/authenticated');
  meCache = { id: r.data && r.data.id ? String(r.data.id) : null, at: Date.now() };
  return meCache.id;
}

async function dataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function thumbData(kind, id) {
  const url = kind === 'user'
    ? `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`
    : `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=150x150&format=Png&isCircular=false`;
  const r = await authJson(url);
  const img = r.data && r.data.data && r.data.data[0] && r.data.data[0].imageUrl;
  return (img && await dataUrl(img)) || chrome.runtime.getURL('icons/icon128.png');
}

function wholeUsd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

const serialJobs = new Map();

function serial(name, fn) {
  const prev = serialJobs.get(name) || Promise.resolve();
  const job = prev.then(fn, fn);
  serialJobs.set(name, job.catch(() => {}));
  return job;
}

async function showNotification(id, title, message, iconUrl, link, context, extra) {
  await serial('notifyLinks', async () => {
    const links = (await chrome.storage.session.get(NOTIFY_LINKS))[NOTIFY_LINKS] || {};
    links[id] = { open: link, buttons: (extra && extra.buttons || []).map(b => b.url) };
    const keys = Object.keys(links);
    if (keys.length > 50) delete links[keys[0]];
    await chrome.storage.session.set({ [NOTIFY_LINKS]: links });
  });
  const opts = { type: extra && extra.imageUrl ? 'image' : 'basic', iconUrl, title, message, priority: 1 };
  if (context) opts.contextMessage = context;
  if (extra && extra.imageUrl) opts.imageUrl = extra.imageUrl;
  if (extra && extra.buttons && extra.buttons.length) opts.buttons = extra.buttons.slice(0, 2).map(b => ({ title: b.title }));
  await new Promise(resolve => chrome.notifications.create(id, opts, () => { void chrome.runtime.lastError; resolve(); }));
}

async function tradeSides(tradeId, partnerId) {
  const r = await authJson(`https://trades.roblox.com/v2/trades/${tradeId}`);
  const d = r.data;
  if (!d || !d.participantAOffer || !d.participantBOffer) return null;
  const theirs = String(d.participantAOffer.user && d.participantAOffer.user.id) === String(partnerId) ? d.participantAOffer : d.participantBOffer;
  const mine = theirs === d.participantAOffer ? d.participantBOffer : d.participantAOffer;
  const items = await getItems();
  const side = (offer) => {
    let usd = 0;
    let rap = 0;
    let priced = true;
    const ids = [];
    const names = [];
    for (const it of offer.items || []) {
      const target = String(it.itemTarget && it.itemTarget.targetId || '');
      const bundle = it.itemTarget && it.itemTarget.itemType === 'Bundle';
      if (target) ids.push((bundle ? 'b' : '') + target);
      if (it.itemName) names.push(it.itemName);
      const v = bundle ? bundleIndex(items).get(target) : items[target];
      if (v && v.usd > 0) usd += v.usd;
      else priced = false;
      rap += Number(it.recentAveragePrice) || 0;
    }
    return { usd, rap, priced, ids, names, robux: Number(offer.robux) || 0 };
  };
  const give = side(mine);
  const get = side(theirs);
  if (!give.ids.length && !get.ids.length) return null;
  const useUsd = give.priced && get.priced && (give.usd > 0 || get.usd > 0);
  return { give, get, useUsd };
}

function sideTotal(side, useUsd) {
  return useUsd ? wholeUsd(side.usd) : `R$ ${side.rap.toLocaleString('en-US')}`;
}

function diffLine(t) {
  const a = t.useUsd ? t.give.usd : t.give.rap;
  const b = t.useUsd ? t.get.usd : t.get.rap;
  const diff = b - a;
  const amount = t.useUsd ? wholeUsd(Math.abs(diff)) : `R$ ${Math.abs(diff).toLocaleString('en-US')}`;
  const pct = a > 0 ? Math.round(Math.abs(diff) / a * 100) : 0;
  if (diff === 0) return t.useUsd ? lt('Even trade') : lt('Even trade RAP');
  const vars = { amount: `${diff > 0 ? '+' : '−'}${amount}`, pct: pct ? ` (${diff > 0 ? '+' : '−'}${pct}%)` : '' };
  if (t.useUsd) return diff > 0 ? lt('{amount}{pct} in your favor', vars) : lt('{amount}{pct} against you', vars);
  return diff > 0 ? lt('{amount}{pct} RAP in your favor', vars) : lt('{amount}{pct} RAP against you', vars);
}

function itemsLine(t) {
  const part = (side) => {
    const list = side.names.slice(0, 2).join(', ') + (side.names.length > 2 ? ` +${side.names.length - 2}` : '');
    const robux = side.robux ? `R$ ${side.robux.toLocaleString('en-US')}` : '';
    return [list, robux].filter(Boolean).join(' + ') || lt('nothing');
  };
  const line = `${part(t.give)} → ${part(t.get)}`;
  return line.length > 90 ? line.slice(0, 89) + '…' : line;
}

async function assetBitmaps(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const unique = [...new Set(ids)];
  const assets = unique.filter(id => !id.startsWith('b')).slice(0, 30);
  const bundles = unique.filter(id => id.startsWith('b')).map(id => id.slice(1)).slice(0, 30);
  const [a, b] = await Promise.all([
    assets.length ? authJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assets.join(',')}&size=150x150&format=Png&isCircular=false`) : null,
    bundles.length ? authJson(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundles.join(',')}&size=150x150&format=Png&isCircular=false`) : null,
  ]);
  const load = (r, prefix) => ((r && r.data && r.data.data) || []).map(async (x) => {
    if (!x.imageUrl) return;
    try {
      const res = await fetch(x.imageUrl);
      if (res.ok) out.set(prefix + String(x.targetId), await createImageBitmap(await res.blob()));
    } catch {}
  });
  await Promise.all([...load(a, ''), ...load(b, 'b')]);
  return out;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

async function tradeCard(t) {
  try {
    const bitmaps = await assetBitmaps([...t.give.ids, ...t.get.ids]);
    const dark = ((await chrome.storage.local.get('routilityOsTheme')).routilityOsTheme || 'dark') !== 'light';
    const ink = dark ? (a) => `rgba(255, 255, 255, ${a})` : (a) => `rgba(18, 18, 21, ${a})`;
    const W = 728;
    const H = 364;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext('2d');
    const font = (w, s) => `${w} ${s}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const column = (side, cx, label) => {
      g.fillStyle = ink(0.6);
      g.font = font(600, 19);
      g.letterSpacing = '2px';
      g.fillText(label, cx, 46);
      g.letterSpacing = '0px';
      const size = 100;
      const gap = 12;
      const shown = side.ids.length > 3 ? 2 : Math.min(3, side.ids.length);
      const tiles = shown + (side.ids.length > 3 ? 1 : 0);
      const width = tiles * size + (tiles - 1) * gap;
      let x = cx - width / 2;
      const y = 68;
      for (let i = 0; i < tiles; i++) {
        g.fillStyle = ink(dark ? 0.07 : 0.06);
        roundRect(g, x, y, size, size, 18);
        g.fill();
        if (i < shown) {
          const bmp = bitmaps.get(side.ids[i]);
          if (bmp) g.drawImage(bmp, x + 8, y + 8, size - 16, size - 16);
        } else {
          g.fillStyle = ink(0.8);
          g.font = font(700, 30);
          g.fillText(`+${side.ids.length - shown}`, x + size / 2, y + size / 2 + 11);
        }
        x += size + gap;
      }
      if (!tiles) {
        g.fillStyle = ink(dark ? 0.07 : 0.06);
        roundRect(g, cx - size / 2, y, size, size, 18);
        g.fill();
      }
      g.fillStyle = ink(dark ? 1 : 0.92);
      g.font = font(700, 36);
      g.fillText(side.ids.length ? sideTotal(side, t.useUsd) : '—', cx, 222);
      if (side.robux) {
        g.fillStyle = ink(0.6);
        g.font = font(600, 20);
        g.fillText(`+ R$ ${side.robux.toLocaleString('en-US')}`, cx, 252);
      }
    };
    column(t.give, W * 0.25, lt('YOU GIVE'));
    column(t.get, W * 0.75, lt('YOU GET'));
    const mx = W / 2;
    const my = 118;
    g.fillStyle = ink(0.08);
    g.beginPath();
    g.arc(mx, my, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ink(0.75);
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(mx - 10, my - 5); g.lineTo(mx + 10, my - 5); g.moveTo(mx + 5, my - 10); g.lineTo(mx + 10, my - 5); g.lineTo(mx + 5, my);
    g.moveTo(mx + 10, my + 6); g.lineTo(mx - 10, my + 6); g.moveTo(mx - 5, my + 1); g.lineTo(mx - 10, my + 6); g.lineTo(mx - 5, my + 11);
    g.stroke();
    const a = t.useUsd ? t.give.usd : t.give.rap;
    const b = t.useUsd ? t.get.usd : t.get.rap;
    const tone = b > a
      ? ['rgba(0, 176, 111, 0.18)', dark ? '#3ddc97' : '#007a4d']
      : b < a ? ['rgba(229, 72, 77, 0.18)', dark ? '#ff7b80' : '#c4282e'] : [ink(0.08), ink(0.8)];
    const text = diffLine(t);
    g.font = font(700, 24);
    const tw = g.measureText(text).width;
    const pw = tw + 48;
    g.fillStyle = tone[0];
    roundRect(g, mx - pw / 2, 290, pw, 48, 24);
    g.fill();
    g.fillStyle = tone[1];
    g.fillText(text, mx, 322);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:image/png;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const TRADE_TEXT = {
  inbound: [() => lt('Trade Received'), (n) => lt('From {name}', { name: n })],
  outbound: [() => lt('Trade Sent'), (n) => lt('To {name}', { name: n })],
  completed: [() => lt('Trade Completed'), (n) => lt('With {name}', { name: n })],
  inactive: [() => lt('Trade Declined'), (n) => lt('{name} declined your trade', { name: n })],
};

async function checkTrades(s, seen, me) {
  const stamps = seen._at && typeof seen._at === 'object' ? seen._at : (seen._at = {});
  for (const [kind, key] of TRADE_KINDS) {
    if (!s[key]) continue;
    const r = await authJson(`https://trades.roblox.com/v1/trades/${kind}?limit=10&sortOrder=Desc`);
    if (r.status === 401) return;
    if (!r.data || !Array.isArray(r.data.data)) continue;
    const list = r.data.data;
    const ids = list.map(t => String(t.id));
    const slot = `${me}:${kind}`;
    const prev = seen[slot];
    const stale = !stamps[slot] || Date.now() - stamps[slot] > 30 * 60 * 1000;
    seen[slot] = [...new Set([...ids, ...(prev || [])])].slice(0, 60);
    stamps[slot] = Date.now();
    if (!prev || stale) continue;
    const fresh = list.filter(t => !prev.includes(String(t.id)) && (kind !== 'inactive' || t.status === 'Declined')).slice(0, 3);
    for (const t of fresh) {
      const user = t.user || {};
      const name = user.displayName && user.displayName !== user.name ? `${user.displayName} (@${user.name})` : (user.name || lt('someone'));
      const [sides, icon] = await Promise.all([tradeSides(t.id, user.id), thumbData('user', user.id)]);
      const [title, line] = TRADE_TEXT[kind];
      const card = sides ? await tradeCard(sides) : null;
      const body = sides ? `${line(name)}\n${itemsLine(sides)}` : line(name);
      await showNotification(`trade:${kind}:${t.id}`, title(), body, icon, 'https://www.roblox.com/trades', null, {
        imageUrl: card,
        buttons: [{ title: lt('View Trades'), url: 'https://www.roblox.com/trades' }, { title: lt('View Profile'), url: `https://www.roblox.com/users/${user.id}/profile` }],
      });
    }
  }
}

const LIVE_URL = 'wss://routility.io/api/public/limiteds/live';
const LIMITED_STATE = 'routilityLimitedState';
let live = null;
let livePing = null;
let liveRetry = null;
let liveBackoff = 1000;

function eventTime(ev) {
  const n = Number(ev.at);
  return Number.isFinite(n) && n > 0 ? n : Date.parse(ev.at || ev.createdAt) || Date.now();
}

function limitedWanted(s, ev) {
  if (ev.isRoblox) return s.notifyLimiteds;
  if (!s.notifyUgc) return false;
  return (Number(ev.price) || 0) > 0 && (Number(ev.totalQuantity) || 0) > 5;
}

function handleLimitedEvents(events, s) {
  if (!events.length) return Promise.resolve();
  return serial('limited', () => handleLimitedNow(events, s));
}

async function handleLimitedNow(events, s) {
  const st = (await chrome.storage.local.get(LIMITED_STATE))[LIMITED_STATE] || { last: 0, seen: [] };
  const seen = new Set(st.seen);
  let last = st.last || 0;
  const fresh = [];
  for (const ev of events.slice().sort((a, b) => eventTime(a) - eventTime(b))) {
    const key = `${ev.type}:${ev.id}`;
    last = Math.max(last, eventTime(ev));
    if (seen.has(key)) continue;
    seen.add(key);
    if (limitedWanted(s, ev)) fresh.push(ev);
  }
  await chrome.storage.local.set({ [LIMITED_STATE]: { last, seen: [...seen].slice(-400) } });
  for (const ev of fresh.slice(-4)) {
    const price = Number(ev.price) || 0;
    const qty = Number(ev.totalQuantity) || 0;
    const parts = [price ? `R$ ${price.toLocaleString('en-US')}` : lt('Free'), qty ? ltn(qty, '{n} copy', '{n} copies', { n: qty.toLocaleString('en-US') }) : '', ev.creatorName && !ev.isRoblox ? lt('by {creator}', { creator: ev.creatorName }) : ''].filter(Boolean);
    const title = ev.type === 'became_limited' ? lt('Now Limited') : ev.isRoblox ? lt('New Limited') : lt('New UGC Limited');
    const icon = await thumbData('asset', ev.id);
    await showNotification(`limited:${ev.type}:${ev.id}`, title, `${ev.name || lt('Unnamed item')}\n${parts.join(' · ')}`, icon, `https://www.roblox.com/catalog/${ev.id}`, null, {
      buttons: [{ title: lt('View Item'), url: `https://www.roblox.com/catalog/${ev.id}` }],
    });
  }
}

async function catchUpLimiteds(s) {
  const st = (await chrome.storage.local.get(LIMITED_STATE))[LIMITED_STATE];
  if (!st || !st.last) {
    await chrome.storage.local.set({ [LIMITED_STATE]: { last: Date.now(), seen: [] } });
    return;
  }
  const since = Math.max(st.last - 1000, Date.now() - 6 * 3600 * 1000);
  const data = await getJson(`${API_BASE}/limiteds/events?since=${since}&limit=50`);
  if (data && Array.isArray(data.events)) await handleLimitedEvents(data.events, s);
}

function closeLive() {
  clearInterval(livePing);
  clearTimeout(liveRetry);
  livePing = null;
  liveRetry = null;
  if (live) {
    live.onclose = null;
    try { live.close(); } catch {}
  }
  live = null;
}

function retryLive() {
  clearTimeout(liveRetry);
  liveRetry = setTimeout(() => ensureLive(), liveBackoff);
  liveBackoff = Math.min(60000, liveBackoff * 2);
}

function ensureLive() {
  return serial('live', ensureLiveNow);
}

async function ensureLiveNow() {
  const s = await notifySettings();
  if (!s.notifyLimiteds && !s.notifyUgc) {
    closeLive();
    return;
  }
  if (live && (live.readyState === WebSocket.CONNECTING || live.readyState === WebSocket.OPEN)) return;
  let ws;
  try {
    ws = new WebSocket(LIVE_URL);
  } catch {
    retryLive();
    return;
  }
  live = ws;
  ws.onopen = () => {
    liveBackoff = 1000;
    clearInterval(livePing);
    livePing = setInterval(() => { try { ws.send('ping'); } catch {} }, 20000);
    notifySettings().then(catchUpLimiteds);
  };
  ws.onmessage = (e) => {
    const text = String(e.data || '');
    if (text === 'pong') return;
    let ev;
    try { ev = JSON.parse(text); } catch { return; }
    if (!ev || ev.type === 'pong' || !ev.id) return;
    notifySettings().then(s2 => handleLimitedEvents([ev], s2));
  };
  ws.onclose = () => {
    clearInterval(livePing);
    livePing = null;
    if (live === ws) live = null;
    retryLive();
  };
  ws.onerror = () => {};
}

async function checkPriceAlerts() {
  const all = (await chrome.storage.local.get(ALERTS_KEY))[ALERTS_KEY] || {};
  const ids = Object.keys(all).slice(0, 25);
  if (!ids.length) return;
  let changed = false;
  for (const id of ids) {
    const a = all[id];
    if (!a.cid) {
      const d = await authJson(`https://economy.roblox.com/v2/assets/${id}/details`);
      if (!d.data || !d.data.CollectibleItemId) continue;
      a.cid = d.data.CollectibleItemId;
      changed = true;
    }
    const r = await authJson(`https://apis.roblox.com/marketplace-sales/v1/item/${a.cid}/resellers?limit=1`);
    const top = r.data && Array.isArray(r.data.data) ? r.data.data[0] : null;
    if (!top || !(top.price > 0)) continue;
    if (top.price > a.target) {
      if (a.lastListing) {
        a.lastListing = '';
        changed = true;
      }
      continue;
    }
    const listing = String(top.collectibleProductId || top.collectibleItemInstanceId || top.price);
    if (a.lastListing === listing) continue;
    a.lastListing = listing;
    changed = true;
    const icon = await thumbData('asset', id);
    const seller = top.seller && top.seller.name ? ` · ${lt('by {creator}', { creator: top.seller.name })}` : '';
    const serial = top.serialNumber ? ` · #${Number(top.serialNumber).toLocaleString('en-US')}` : '';
    await showNotification(`alert:${id}:${listing}`, lt('Price Alert'), `${a.name}\n${lt('R$ {price} (your alert: R$ {target})', { price: Number(top.price).toLocaleString('en-US'), target: Number(a.target).toLocaleString('en-US') })}${serial}${seller}`, icon, `https://www.roblox.com/catalog/${id}#resellers`, null, {
      buttons: [{ title: lt('View Resellers'), url: `https://www.roblox.com/catalog/${id}#resellers` }],
    });
  }
  if (changed) {
    const latest = (await chrome.storage.local.get(ALERTS_KEY))[ALERTS_KEY] || {};
    for (const id of ids) if (latest[id] && all[id]) latest[id] = { ...latest[id], cid: all[id].cid, lastListing: all[id].lastListing };
    await chrome.storage.local.set({ [ALERTS_KEY]: latest });
  }
}

function runNotifyCheck() {
  if (notifyRunning) return notifyRunning;
  notifyRunning = (async () => {
    const s = await notifySettings();
    if (!Object.values(s).some(Boolean)) return;
    const seen = (await chrome.storage.local.get(NOTIFY_SEEN))[NOTIFY_SEEN] || {};
    const me = await signedInUser(true);
    if (me && (s.notifyInbound || s.notifyOutbound || s.notifyCompleted || s.notifyDeclined)) await checkTrades(s, seen, me);
    if (s.notifyLimiteds || s.notifyUgc) {
      if (!live || live.readyState !== WebSocket.OPEN) await catchUpLimiteds(s);
      ensureLive();
    }
    if (s.priceAlerts) await checkPriceAlerts();
    await chrome.storage.local.set({ [NOTIFY_SEEN]: seen });
  })().catch(() => {}).finally(() => { notifyRunning = null; });
  return notifyRunning;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === NOTIFY_ALARM) runNotifyCheck();
  if (alarm.name === PLAY_ALARM) playtimeTick();
  if (alarm.name === ROT_ALARM) rotatorTick();
  if (alarm.name === BADGE_ALARM) badgeAutoTick();
});

const BADGE_ALARM = 'routility-badge-auto';
const BADGE_KEY = 'routilityBadgeAuto';
const BADGE_GRACE = 60000;
let badgeRunning = null;

async function syncBadgeAuto() {
  const st = await chrome.storage.local.get(['routilitySettings', BADGE_KEY]);
  const on = (st.routilitySettings || {}).badgeAutoDelete === true;
  const rec = st[BADGE_KEY] || {};
  if (on && !rec.since) await chrome.storage.local.set({ [BADGE_KEY]: { ...rec, since: Date.now() } });
  if (!on && rec.since) await chrome.storage.local.set({ [BADGE_KEY]: { ...rec, since: 0 } });
  const existing = await chrome.alarms.get(BADGE_ALARM);
  if (on && !existing) await chrome.alarms.create(BADGE_ALARM, { delayInMinutes: 1, periodInMinutes: 5 });
  if (!on && existing) await chrome.alarms.clear(BADGE_ALARM);
}

async function deleteNewBadgesInTab(tabId, since) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (after) => {
      const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
      if (!me) return { ok: false, removed: [] };
      const get = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        return res.ok ? res.json() : null;
      };
      let token = '';
      const drop = async (id) => {
        for (let i = 0; i < 4; i++) {
          const res = await fetch(`https://badges.roblox.com/v1/user/badges/${id}`, { method: 'DELETE', credentials: 'include', headers: token ? { 'x-csrf-token': token } : {} });
          if (res.status === 403 && res.headers.get('x-csrf-token')) {
            token = res.headers.get('x-csrf-token');
            continue;
          }
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 3000 * (i + 1)));
            continue;
          }
          return res.ok;
        }
        return false;
      };
      try {
        const fresh = [];
        let cursor = '';
        for (let page = 0; page < 4; page++) {
          const d = await get(`https://badges.roblox.com/v1/users/${me}/badges?limit=${page ? 100 : 25}&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
          if (!d || !Array.isArray(d.data) || !d.data.length) break;
          const dates = await get(`https://badges.roblox.com/v1/users/${me}/badges/awarded-dates?badgeIds=${d.data.map(b => b.id).join(',')}`);
          if (!dates || !Array.isArray(dates.data)) return { ok: false, removed: [] };
          const at = new Map(dates.data.map(x => [x.badgeId, Date.parse(x.awardedDate)]));
          let older = false;
          for (const b of d.data) {
            const t = at.get(b.id);
            if (t > after) fresh.push({ id: b.id, name: b.displayName || b.name || '' });
            else if (Number.isFinite(t)) older = true;
          }
          if (older || !d.nextPageCursor) break;
          cursor = d.nextPageCursor;
        }
        const removed = [];
        for (const b of fresh) {
          if (await drop(b.id)) removed.push(b);
          await new Promise(r => setTimeout(r, 350));
        }
        return { ok: true, removed };
      } catch {
        return { ok: false, removed: [] };
      }
    },
    args: [since],
  });
  return (r && r.result) || { ok: false, removed: [] };
}

function badgeAutoTick() {
  if (badgeRunning) return badgeRunning;
  badgeRunning = (async () => {
    const st = await chrome.storage.local.get(['routilitySettings', BADGE_KEY]);
    const rec = st[BADGE_KEY] || {};
    if ((st.routilitySettings || {}).badgeAutoDelete !== true || !rec.since) return syncBadgeAuto();
    const tabs = await chrome.tabs.query({ url: 'https://www.roblox.com/*', discarded: false }).catch(() => []);
    tabs.sort((x, y) => (y.active ? 1 : 0) - (x.active ? 1 : 0) || (y.lastAccessed || 0) - (x.lastAccessed || 0));
    for (const tab of tabs.slice(0, 2)) {
      let res;
      try {
        res = await deleteNewBadgesInTab(tab.id, rec.since + BADGE_GRACE);
      } catch {
        continue;
      }
      if (!res.ok) continue;
      if (res.removed.length) {
        const now = Date.now();
        const cur = (await chrome.storage.local.get(BADGE_KEY))[BADGE_KEY] || {};
        const log = [...res.removed.map(b => ({ id: String(b.id), name: b.name, at: now })), ...(cur.log || [])].slice(0, 50);
        await chrome.storage.local.set({ [BADGE_KEY]: { ...cur, log, count: (Number(cur.count) || 0) + res.removed.length } });
      }
      return;
    }
  })().catch(() => {}).finally(() => { badgeRunning = null; });
  return badgeRunning;
}

const ROT_ALARM = 'routility-rotator';
const ROT_KEY = 'routilityRotator';
const rotEvery = (v) => {
  const sec = String(v).match(/^(\d+)s$/);
  if (sec) {
    const s = Number(sec[1]);
    if (s < 30 || s > 604800) return null;
    return s % 60 === 0 ? String(s / 60) : s + 's';
  }
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 10080 ? String(n) : null;
};
const rotMinutes = (every) => {
  const sec = String(every).match(/^(\d+)s$/);
  return sec ? Number(sec[1]) / 60 : Number(every);
};
let rotRunning = null;

async function rotatorConfig() {
  const st = await chrome.storage.local.get([ROT_KEY, 'routilitySettings']);
  const s = st.routilitySettings || {};
  const r = st[ROT_KEY] || {};
  return { enabled: s.outfitRotator !== false, on: !!r.on, ids: Array.isArray(r.ids) ? r.ids.map(String) : [], every: rotEvery(r.every) || '15', order: r.order === 'shuffle' ? 'shuffle' : 'order', index: Number(r.index) || 0, lastId: r.lastId || null, lastName: r.lastName || '', last: Number(r.last) || 0, error: r.error || null, raw: r };
}

async function syncRotatorAlarm(reset) {
  const c = await rotatorConfig();
  const existing = await chrome.alarms.get(ROT_ALARM);
  if (!c.enabled || !c.on || c.ids.length < 2) {
    if (existing) await chrome.alarms.clear(ROT_ALARM);
    return;
  }
  const mins = rotMinutes(c.every);
  if (reset || !existing || Math.abs(existing.periodInMinutes - mins) > 1e-9) await chrome.alarms.create(ROT_ALARM, { delayInMinutes: mins, periodInMinutes: mins });
}

async function rotatorState() {
  const c = await rotatorConfig();
  const alarm = await chrome.alarms.get(ROT_ALARM);
  return { on: c.on, ids: c.ids, every: c.every, order: c.order, next: alarm ? alarm.scheduledTime : null, last: c.last, lastName: c.lastName, error: c.error };
}

async function rotatorSave(msg) {
  const before = await rotatorConfig();
  const ids = Array.isArray(msg.ids) ? [...new Set(msg.ids.map(String).filter(x => /^\d+$/.test(x)))].slice(0, 200) : before.ids;
  const every = rotEvery(msg.every) || before.every;
  const next = { ...before.raw, on: !!msg.on, ids, every, order: msg.order === 'shuffle' ? 'shuffle' : 'order', error: null };
  if (!ids.includes(String(next.lastId))) next.index = 0;
  await chrome.storage.local.set({ [ROT_KEY]: next });
  await syncRotatorAlarm(every !== before.every || next.on !== before.on);
  return rotatorState();
}

async function wearOutfitInTab(tabId, outfitId) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (id) => {
      let token = '';
      const post = async (path, body) => {
        for (let i = 0; i < 3; i++) {
          const res = await fetch('https://avatar.roblox.com/' + path, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-csrf-token': token } : {}), body: JSON.stringify(body) });
          if (res.status === 403 && res.headers.get('x-csrf-token')) {
            token = res.headers.get('x-csrf-token');
            continue;
          }
          return res.ok;
        }
        return false;
      };
      try {
        const d = await fetch(`https://avatar.roblox.com/v4/outfits/${id}/details`, { credentials: 'include', cache: 'no-store' });
        if (d.status === 400 || d.status === 404) return { status: 'gone' };
        if (!d.ok) return { status: 'fail' };
        const m = (await d.json()).outfitModel;
        if (!m || !Array.isArray(m.assets)) return { status: 'fail' };
        if (m.playerAvatarType && !await post('v1/avatar/set-player-avatar-type', { playerAvatarType: m.playerAvatarType })) return { status: 'fail' };
        if (m.scale && !await post('v1/avatar/set-scales', m.scale)) return { status: 'fail' };
        const c = m.bodyColors || {};
        const colors = {};
        for (const part of ['head', 'torso', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) if (c[part + 'Color']) colors[part + 'Color3'] = c[part + 'Color'];
        if (Object.keys(colors).length && !await post('v2/avatar/set-body-colors', colors)) return { status: 'fail' };
        const assets = m.assets.map(a => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id }));
        if (!await post('v2/avatar/set-wearing-assets', { assets })) return { status: 'fail' };
        return { status: 'ok', name: m.name || '' };
      } catch {
        return { status: 'fail' };
      }
    },
    args: [String(outfitId)],
  });
  return (r && r.result) || { status: 'fail' };
}

function rotatorTick() {
  if (rotRunning) return rotRunning;
  rotRunning = (async () => {
    const c = await rotatorConfig();
    if (!c.enabled || !c.on || c.ids.length < 2) return syncRotatorAlarm();
    const tabs = await chrome.tabs.query({ url: 'https://www.roblox.com/*', discarded: false }).catch(() => []);
    if (!tabs.length || tabs.some(t => /^https:\/\/www\.roblox\.com\/my\/avatar/i.test(t.url || ''))) return;
    tabs.sort((x, y) => (y.active ? 1 : 0) - (x.active ? 1 : 0) || (y.lastAccessed || 0) - (x.lastAccessed || 0));
    let index = c.index % c.ids.length;
    if (c.order === 'shuffle') {
      const pool = c.ids.map((_, i) => i).filter(i => c.ids[i] !== String(c.lastId));
      index = pool[Math.floor(Math.random() * pool.length)] ?? 0;
    } else if (c.lastId && c.ids[index] === String(c.lastId)) {
      index = (index + 1) % c.ids.length;
    }
    const id = c.ids[index];
    let result = { status: 'fail' };
    for (const tab of tabs.slice(0, 2)) {
      try {
        result = await wearOutfitInTab(tab.id, id);
      } catch {
        result = { status: 'fail' };
      }
      if (result.status !== 'fail') break;
    }
    const cur = await rotatorConfig();
    const raw = { ...cur.raw };
    if (result.status === 'gone') {
      raw.ids = cur.ids.filter(x => x !== id);
      raw.error = null;
    } else if (result.status === 'ok') {
      raw.index = (index + 1) % cur.ids.length;
      raw.lastId = id;
      raw.lastName = result.name;
      raw.last = Date.now();
      raw.error = null;
    } else {
      raw.error = Date.now();
    }
    await chrome.storage.local.set({ [ROT_KEY]: raw });
    if (result.status === 'gone') await syncRotatorAlarm();
  })().catch(() => {}).finally(() => { rotRunning = null; });
  return rotRunning;
}

const PLAY_ALARM = 'routility-playtime';
const PLAY_KEEP_DAYS = 400;
let playRunning = null;

function playDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function syncPlayAlarm() {
  const s = (await chrome.storage.local.get('routilitySettings')).routilitySettings || {};
  const on = s.playtime !== false;
  const existing = await chrome.alarms.get(PLAY_ALARM);
  if (on && !existing) chrome.alarms.create(PLAY_ALARM, { periodInMinutes: 1, delayInMinutes: 0.2 });
  if (!on && existing) chrome.alarms.clear(PLAY_ALARM);
}

function addPlaytime(me, presence, now) {
  return serial('playtime', async () => {
    const key = 'routilityPlaytime:' + me;
    const data = (await chrome.storage.local.get(key))[key] || { days: {}, place: {}, last: 0 };
    if (now - (data.last || 0) < 45000) return data;
    const uni = String(presence.universeId);
    const day = playDay(now);
    data.days[day] = data.days[day] || {};
    data.days[day][uni] = (data.days[day][uni] || 0) + 1;
    if (presence.placeId || presence.rootPlaceId) data.place[uni] = Number(presence.rootPlaceId || presence.placeId);
    data.last = now;
    const cut = playDay(now - PLAY_KEEP_DAYS * 86400000);
    for (const d of Object.keys(data.days)) if (d < cut) delete data.days[d];
    await chrome.storage.local.set({ [key]: data });
    return data;
  });
}

async function presenceViaTab(userId) {
  const tabs = await chrome.tabs.query({ url: 'https://www.roblox.com/*', discarded: false }).catch(() => []);
  tabs.sort((x, y) => (y.active ? 1 : 0) - (x.active ? 1 : 0) || (y.lastAccessed || 0) - (x.lastAccessed || 0));
  for (const tab of tabs.slice(0, 3)) {
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (id) => {
          try {
            const res = await fetch('https://presence.roblox.com/v1/presence/users', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userIds: [id] }) });
            return res.ok ? await res.json() : null;
          } catch {
            return null;
          }
        },
        args: [userId],
      });
      if (r && r.result) return r.result;
    } catch {}
  }
  return null;
}

function playtimeTick() {
  if (playRunning) return playRunning;
  playRunning = (async () => {
    const me = await signedInUser();
    if (!me) return;
    const d = await presenceViaTab(Number(me));
    const p = d && d.userPresences && d.userPresences[0];
    const playing = !!(p && p.userPresenceType === 2 && p.universeId);
    if (playing) await addPlaytime(me, p, Date.now());
    playtimeSync('auto', playing).catch(() => {});
  })().catch(() => {}).finally(() => { playRunning = null; });
  return playRunning;
}

const PLAY_SYNC_KEY = 'routilityPlaytimeSync';
const PLAY_API = SITE_API + '/playtime';
const PLAY_PULL_EVERY = 6 * 3600 * 1000;
let playSyncing = null;

function mergePlayData(local, remote) {
  const base = local || { days: {}, place: {}, last: 0 };
  const days = { ...(base.days || {}) };
  for (const [d, games] of Object.entries((remote && remote.days) || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !games || typeof games !== 'object') continue;
    const cur = { ...(days[d] || {}) };
    for (const [u, m] of Object.entries(games)) {
      const n = Number(m);
      if (/^\d+$/.test(u) && Number.isFinite(n) && n > 0) cur[u] = Math.max(cur[u] || 0, Math.min(1440, Math.round(n)));
    }
    days[d] = cur;
  }
  const place = { ...(base.place || {}) };
  for (const [u, id] of Object.entries((remote && remote.place) || {})) if (/^\d+$/.test(u) && Number(id) > 0 && !place[u]) place[u] = Number(id);
  return { ...base, days, place };
}

function playtimeSync(mode, playing) {
  if (playSyncing) return playSyncing;
  playSyncing = (async () => {
    const auth = await forumAuth();
    if (!auth) return { ok: false, reason: 'signedOut' };
    const me = await signedInUser();
    if (!me || String(me) !== String(auth.userId)) return { ok: false, reason: 'otherAccount' };
    const key = 'routilityPlaytime:' + me;
    const stored = (await chrome.storage.local.get(PLAY_SYNC_KEY))[PLAY_SYNC_KEY];
    let sync = stored && stored.userId === me ? stored : { userId: me };
    const now = Date.now();
    if (sync.wait && now < sync.wait) return { ok: false, reason: 'wait' };
    const saveSync = (patch) => {
      sync = { ...sync, ...patch };
      return chrome.storage.local.set({ [PLAY_SYNC_KEY]: sync });
    };
    const call = async (method, body) => {
      const res = await fetch(PLAY_API, { method, credentials: 'omit', cache: 'no-store', headers: Object.assign({ authorization: 'Bearer ' + auth.token }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
      if (res.status === 401) {
        await saveSync({ error: 'auth', errorAt: Date.now() });
        return null;
      }
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after'));
        await saveSync({ wait: Date.now() + (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60000) });
        return null;
      }
      if (!res.ok) {
        await saveSync({ error: 'http', errorAt: Date.now() });
        return null;
      }
      return res.json();
    };
    const absorb = (remote) => serial('playtime', async () => {
      const cur = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({ [key]: mergePlayData(cur, remote) });
    });
    if (mode === 'full' || !sync.pulledAt || now - sync.pulledAt > PLAY_PULL_EVERY) {
      const remote = await call('GET');
      if (!remote) return { ok: false, reason: sync.error || 'wait' };
      await absorb(remote);
      await saveSync({ pulledAt: Date.now(), error: null });
    }
    const local = (await chrome.storage.local.get(key))[key];
    if (!local || !local.days) return { ok: true };
    const fresh = (local.last || 0) > (sync.pushedLast || 0);
    const gap = playing ? 5 * 60000 : 60000;
    const due = mode === 'full' || !sync.pushedAll || (fresh && now - (sync.pushedAt || 0) >= gap);
    if (!due || now - (sync.pushedAt || 0) < 60000) return { ok: true };
    const recent = playDay(now - 3 * 86400000);
    const days = {};
    for (const [d, games] of Object.entries(local.days)) if (!sync.pushedAll || d >= recent) days[d] = games;
    const merged = await call('PUT', { days, place: local.place || {} });
    if (!merged) return { ok: false, reason: sync.error || 'wait' };
    await absorb(merged);
    await saveSync({ pushedAt: Date.now(), pushedAll: true, pushedLast: local.last || 0, syncedAt: merged.updatedAt || new Date().toISOString(), error: null });
    return { ok: true };
  })().catch(() => ({ ok: false, reason: 'error' })).finally(() => { playSyncing = null; });
  return playSyncing;
}

chrome.notifications.onClicked.addListener(async (id) => {
  const links = (await chrome.storage.session.get(NOTIFY_LINKS))[NOTIFY_LINKS] || {};
  chrome.notifications.clear(id);
  const l = links[id];
  const url = l && (typeof l === 'string' ? l : l.open);
  if (url) chrome.tabs.create({ url });
});

chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  const links = (await chrome.storage.session.get(NOTIFY_LINKS))[NOTIFY_LINKS] || {};
  chrome.notifications.clear(id);
  const l = links[id];
  const url = l && l.buttons && l.buttons[index];
  if (url) chrome.tabs.create({ url });
});

const PAGE_RULES = { forum: 1, tradeCalculator: 2, tradeAds: 3 };

function syncRulesets(s) {
  const want = { studio: !!(s && s.studioStatus === true), fun: !!(s && s.fakeBuy === true) };
  const enableRulesetIds = Object.keys(want).filter(k => want[k]);
  const disableRulesetIds = Object.keys(want).filter(k => !want[k]);
  chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds, disableRulesetIds }).catch(() => {});
  const pages = Object.entries(PAGE_RULES);
  chrome.declarativeNetRequest.updateStaticRules({ rulesetId: 'pages', enableRuleIds: pages.filter(([k]) => !s || s[k] !== false).map(([, id]) => id), disableRuleIds: pages.filter(([k]) => s && s[k] === false).map(([, id]) => id) }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => { syncNotifyAlarm(); syncPlayAlarm(); syncRotatorAlarm(); syncBadgeAuto(); });
chrome.runtime.onStartup.addListener(() => { syncNotifyAlarm(); syncPlayAlarm(); syncRotatorAlarm(); syncBadgeAuto(); setTimeout(() => playtimeSync('auto').catch(() => {}), 15000); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.routilitySettings) {
    syncNotifyAlarm();
    syncPlayAlarm();
    syncRotatorAlarm();
    syncBadgeAuto();
    ensureLive();
    syncRulesets(changes.routilitySettings.newValue);
  }
});
syncNotifyAlarm();
syncPlayAlarm();
syncRotatorAlarm();
syncBadgeAuto();
ensureLive();
chrome.storage.local.get('routilitySettings', (st) => syncRulesets(st.routilitySettings));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'notifyTest') {
    (async () => {
      const level = await new Promise(r => chrome.notifications.getPermissionLevel(r)).catch(() => 'granted');
      if (level === 'denied') return 'denied';
      const items = await getItems();
      const usd = id => (items[id] && items[id].usd) || 0;
      const sides = {
        give: { ids: ['48545806'], names: ['Dominus Frigidus'], usd: usd('48545806'), rap: 0, priced: true, robux: 0 },
        get: { ids: ['21070012'], names: ['Dominus Empyreus'], usd: usd('21070012'), rap: 0, priced: true, robux: 0 },
        useUsd: true,
      };
      const [icon, card] = await Promise.all([thumbData('user', 156), tradeCard(sides)]);
      await showNotification(`test:${Date.now()}`, lt('Trade Received'), `${lt('From {name}', { name: 'Builderman (@builderman)' })}\n${itemsLine(sides)}`, icon, 'https://www.roblox.com/trades', null, {
        imageUrl: card,
        buttons: [{ title: lt('View Trades'), url: 'https://www.roblox.com/trades' }, { title: lt('View Profile'), url: 'https://www.roblox.com/users/156/profile' }],
      });
      return msg.returnCard ? card : true;
    })().then((r) => sendResponse(r), () => sendResponse(false));
    return true;
  }
  if (msg.type === 'notifyLimitedTest') {
    const ev = { type: `test${Date.now()}`, id: 21070012, name: 'Dominus Empyreus', isRoblox: true, price: 0, totalQuantity: 26, creatorName: 'Roblox', at: Date.now() };
    notifySettings().then(s => handleLimitedEvents([ev], { ...s, notifyLimiteds: true })).then(() => sendResponse(true));
    return true;
  }
  if (msg.type === 'notifyLive') {
    sendResponse({ state: live ? live.readyState : -1 });
    return;
  }
  if (msg.type === 'notifyCheck') {
    runNotifyCheck().then(() => chrome.notifications.getAll((all) => sendResponse(Object.keys(all || {}))));
    return true;
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://www.roblox.com/my/account#!/routility' });
});

const COPY_KINDS = [
  { key: 'user', label: LT('User ID'), re: /roblox\.com\/users\/(\d+)/, pats: ['*://www.roblox.com/users/*', '*://web.roblox.com/users/*'] },
  { key: 'asset', label: LT('Asset ID'), re: /roblox\.com\/(?:catalog|library)\/(\d+)|create\.roblox\.com\/store\/asset\/(\d+)|create\.roblox\.com\/marketplace\/asset\/(\d+)/, pats: ['*://www.roblox.com/catalog/*', '*://www.roblox.com/library/*', '*://create.roblox.com/store/asset/*', '*://create.roblox.com/marketplace/asset/*'] },
  { key: 'bundle', label: LT('Bundle ID'), re: /roblox\.com\/bundles\/(\d+)/, pats: ['*://www.roblox.com/bundles/*'] },
  { key: 'place', label: LT('Place ID'), re: /roblox\.com\/games\/(\d+)/, pats: ['*://www.roblox.com/games/*'] },
  { key: 'group', label: LT('Community ID'), re: /roblox\.com\/(?:communities|groups)\/(\d+)/, pats: ['*://www.roblox.com/communities/*', '*://www.roblox.com/groups/*'] },
  { key: 'badge', label: LT('Badge ID'), re: /roblox\.com\/badges\/(\d+)/, pats: ['*://www.roblox.com/badges/*'] },
];

async function syncCopyMenus() {
  if (!chrome.contextMenus) return;
  await i18nLoaded;
  const s = (await chrome.storage.local.get('routilitySettings')).routilitySettings || {};
  await chrome.contextMenus.removeAll();
  if (s.contextCopy === false) return;
  for (const k of COPY_KINDS) {
    const title = lt('Copy {label}', { label: lt(k.label) });
    chrome.contextMenus.create({ id: 'rt-copy-link-' + k.key, title, contexts: ['link'], targetUrlPatterns: k.pats }, () => void chrome.runtime.lastError);
    chrome.contextMenus.create({ id: 'rt-copy-page-' + k.key, title, contexts: ['page'], documentUrlPatterns: k.pats }, () => void chrome.runtime.lastError);
  }
}

chrome.runtime.onInstalled.addListener(() => syncCopyMenus());
chrome.runtime.onStartup.addListener(() => syncCopyMenus());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.routilityI18nDict) {
    syncCopyMenus();
    return;
  }
  if (!changes.routilitySettings) return;
  const was = (changes.routilitySettings.oldValue || {}).contextCopy;
  const now = (changes.routilitySettings.newValue || {}).contextCopy;
  if (was !== now) syncCopyMenus();
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  const m = String(info.menuItemId).match(/^rt-copy-(link|page)-(\w+)$/);
  if (!m || !tab || tab.id < 0) return;
  const kind = COPY_KINDS.find(k => k.key === m[2]);
  const url = m[1] === 'link' ? info.linkUrl : info.pageUrl;
  const hit = kind && String(url || '').match(kind.re);
  const id = hit && hit.slice(1).find(Boolean);
  if (!id) return;
  const fallback = () => chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [info.frameId || 0] }, func: (text) => navigator.clipboard.writeText(text), args: [id] }).catch(() => {});
  chrome.tabs.sendMessage(tab.id, { type: 'routilityCopy', text: id, label: lt(kind.label) }, { frameId: info.frameId || 0 }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) fallback();
  });
});

const RUN_ORDER = { document_start: 0, document_end: 1, document_idle: 2 };

function patternMatches(pattern, url) {
  return new RegExp('^' + pattern.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(url);
}

async function rearmTab(tab, entries) {
  const ping = chrome.tabs.sendMessage(tab.id, { type: 'routilityPing' }, { frameId: 0 }).then(r => r === true, () => false);
  const alive = await Promise.race([ping, new Promise(r => setTimeout(() => r(null), 1500))]);
  if (alive !== false) return;
  const target = { tabId: tab.id };
  await chrome.scripting.executeScript({ target, files: ['life.js'] });
  await new Promise(r => setTimeout(r, 1100));
  await chrome.scripting.executeScript({ target, func: () => window.RoUtilityLife && window.RoUtilityLife.sweep() });
  for (const cs of entries) {
    if (!cs.matches.some(p => patternMatches(p, tab.url))) continue;
    if (cs.css && cs.css.length) await chrome.scripting.insertCSS({ target, files: cs.css });
    const js = (cs.js || []).filter(f => f !== 'life.js');
    if (js.length) await chrome.scripting.executeScript({ target, files: js });
  }
}

async function rearm() {
  const st = await chrome.storage.session.get('routilityArmed').catch(() => null);
  if (!st || st.routilityArmed) return;
  await chrome.storage.session.set({ routilityArmed: true });
  const entries = (chrome.runtime.getManifest().content_scripts || [])
    .map((cs, i) => ({ ...cs, i }))
    .filter(cs => cs.world !== 'MAIN')
    .sort((a, b) => (RUN_ORDER[a.run_at || 'document_idle'] - RUN_ORDER[b.run_at || 'document_idle']) || a.i - b.i);
  const tabs = await chrome.tabs.query({ url: ['https://www.roblox.com/*', 'https://create.roblox.com/*'] }).catch(() => []);
  await Promise.all(tabs.filter(t => t.id && t.url && !t.discarded && t.status === 'complete').map(t => rearmTab(t, entries).catch(() => {})));
}

rearm();
