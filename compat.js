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

  function scan() {
    const found = new Set();
    const ids = new Set();
    for (const n of document.querySelectorAll('[class], [id]')) {
      const tokens = (typeof n.className === 'string' ? n.className.split(/\s+/) : []).concat(n.id ? [n.id] : []);
      for (const t of tokens) {
        if (!t || t.length < 4) continue;
        for (const [name, re] of BRANDS) if (re.test(t)) found.add(name);
      }
    }
    for (const n of document.querySelectorAll('[src^="chrome-extension://"], [href^="chrome-extension://"]')) {
      const m = (n.getAttribute('src') || n.getAttribute('href') || '').match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m && m[1] !== own) ids.add(m[1]);
    }
    return { found: [...found], ids: [...ids] };
  }

  function entry(v) {
    if (v && typeof v === 'object' && v.pages) return { at: Number(v.at) || 0, pages: { ...v.pages } };
    return { at: Number(v) || 0, pages: {} };
  }

  function update(map, present, now) {
    const out = {};
    for (const [k, v] of Object.entries(map || {})) out[k] = entry(v);
    for (const k of present) {
      const e = out[k] || { at: 0, pages: {} };
      e.at = now;
      e.pages[kind] = now;
      out[k] = e;
    }
    for (const [k, e] of Object.entries(out)) {
      if (present.includes(k)) continue;
      if (e.pages[kind]) delete e.pages[kind];
      if (!Object.keys(e.pages).length || now - e.at > WEEK) delete out[k];
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
      const next = { brands: update(prev.brands, r.found, now), ids: update(prev.ids, r.ids, now), at: now };
      const sig = JSON.stringify([Object.keys(next.brands).sort(), Object.keys(next.ids).sort(), Object.values(next.brands).map(e => Object.keys(e.pages).sort())]);
      if (sig === last && now - (prev.at || 0) < 3600000) return;
      last = sig;
      chrome.storage.local.set({ [KEY]: next });
    });
  }

  setTimeout(() => save(false), 6000);
  setTimeout(() => save(true), 20000);
})();
