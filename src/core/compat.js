(function () {
  'use strict';

  const KEY = 'routilityOtherExts';
  const BRANDS = [
    ['RoPro', /^ropro/i],
    ['BTRoblox', /^(btr-|btroblox)/i],
    ['RoGold', /^rogold/i],
    ['RoValra', /^rovalra/i],
    ['RoSeal', /^roseal/i],
    ['Roblox+', /^(rplus|robloxplus|roblox-plus|rbxplus)/i],
    ['Rolimon’s', /^rolimons?/i],
  ];
  const WEEK = 7 * 86400000;
  const own = chrome.runtime.id;
  const kind = (location.pathname.split('/')[1] || 'home').toLowerCase().replace(/^\d+$/, 'id');

  const EXT_URL = /^chrome-extension:\/\/([a-p]{32})\/[^\s"')]*/;

  function extUrl(n) {
    const m = (n.getAttribute('src') || n.getAttribute('href') || '').match(EXT_URL);
    return m && m[1] !== own ? m : null;
  }

  function scan() {
    const found = new Set();
    const ids = new Map();
    const owners = {};
    for (const n of document.querySelectorAll('[class], [id]')) {
      const tokens = (typeof n.className === 'string' ? n.className.split(/\s+/) : []).concat(n.id ? [n.id] : []);
      for (const t of tokens) {
        if (!t || t.length < 4) continue;
        for (const [name, re] of BRANDS) {
          if (!re.test(t)) continue;
          found.add(name);
          const set = owners[name] || (owners[name] = new Set());
          if (set.size < 4) for (const x of [n, ...n.querySelectorAll('[src^="chrome-extension://"], [href^="chrome-extension://"]')].slice(0, 6)) {
            const m = extUrl(x);
            if (m) set.add(m[1]);
          }
        }
      }
    }
    for (const n of document.querySelectorAll('[src^="chrome-extension://"], [href^="chrome-extension://"]')) {
      const m = extUrl(n);
      if (m && !ids.has(m[1])) ids.set(m[1], m[0]);
    }
    return { found: [...found], ids: [...ids.keys()], urls: Object.fromEntries(ids), owners: Object.fromEntries(Object.entries(owners).map(([k, v]) => [k, [...v]])) };
  }

  function entry(v) {
    if (v && typeof v === 'object' && v.pages) return { ...v, at: Number(v.at) || 0, pages: { ...v.pages } };
    return { at: Number(v) || 0, pages: {} };
  }

  function update(map, present, now, extra, final) {
    const out = {};
    for (const [k, v] of Object.entries(map || {})) out[k] = entry(v);
    for (const k of present) {
      const e = out[k] || { at: 0, pages: {} };
      e.at = now;
      e.pages[kind] = now;
      if (extra) extra(k, e);
      out[k] = e;
    }
    for (const [k, e] of Object.entries(out)) {
      if (!final || present.includes(k)) continue;
      if (e.pages[kind] || now - e.at > WEEK) delete out[k];
    }
    return out;
  }

  let last = null;

  function save(final) {
    if (document.visibilityState !== 'visible') return;
    const r = scan();
    if (!final && !r.found.length && !r.ids.length) return;
    chrome.storage.local.get(KEY, (st) => {
      const prev = st[KEY] || { brands: {}, ids: {} };
      const now = Date.now();
      const next = {
        brands: update(prev.brands, r.found, now, (k, e) => {
          if (r.owners[k] && r.owners[k].length) e.ids = [...new Set([...(e.ids || []), ...r.owners[k]])].slice(-4);
        }, final),
        ids: update(prev.ids, r.ids, now, (k, e) => { e.url = r.urls[k]; }, final),
        at: now,
      };
      const sig = JSON.stringify([Object.keys(next.brands).sort(), Object.keys(next.ids).sort(), Object.values(next.brands).map(e => Object.keys(e.pages).sort())]);
      if (sig === last && now - (prev.at || 0) < 3600000) return;
      last = sig;
      chrome.storage.local.set({ [KEY]: next });
    });
  }

  setTimeout(() => save(false), 6000);
  setTimeout(() => save(true), 20000);
})();
