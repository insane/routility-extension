(function () {
  'use strict';

  const SOURCES = [
    /^https:\/\/games\.roblox\.com\/v2\/users\/(\d+)\/favorite\/games\?/i,
    /^https:\/\/badges\.roblox\.com\/v1\/users\/(\d+)\/badges\?/i,
    /^https:\/\/apis\.roblox\.com\/toolbox-service\/v1\/favorites\/user\/(\d+)\//i,
    /^https:\/\/inventory\.roblox\.com\/v2\/users\/(\d+)\/inventory\//i,
    /^https:\/\/catalog\.roblox\.com\/v1\/favorites\/users\/(\d+)\//i,
  ];
  const HREF = /\/(?:games|badges|catalog|library|bundles|game-pass)\/(\d+)/i;
  let state = null;

  const idOf = (x) => x && (x.rootPlace?.id ?? x.asset?.id ?? x.assetId ?? x.id);

  const latest = new Map();
  const note = (name) => {
    for (const re of SOURCES) {
      const m = re.exec(name);
      if (m) latest.set(m[1], name);
    }
  };
  try {
    new PerformanceObserver(list => list.getEntries().forEach(e => note(e.name))).observe({ type: 'resource', buffered: true });
  } catch {}

  function source(owner) {
    if (latest.has(owner)) return latest.get(owner);
    const list = performance.getEntriesByType('resource');
    for (let i = list.length - 1; i >= 0; i--) {
      const name = list[i].name;
      if (SOURCES.some(re => re.exec(name)?.[1] === owner)) return name;
    }
    return null;
  }

  function order(s, url) {
    if (!s.cache.has(url)) {
      s.cache.set(url, fetch(url, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => (d && Array.isArray(d.data) ? d.data.map(idOf).filter(v => v != null).map(String) : null))
        .catch(() => null));
    }
    return s.cache.get(url);
  }

  function cards(ul) {
    return [...ul.children].filter(li => li.tagName === 'LI' && li.querySelector('a.item-card-link'));
  }

  async function fix(s) {
    if (state !== s || s.busy) return;
    const ul = [...document.querySelectorAll('ul.item-cards:not(.routility-inv-grid):not(.routility-inv-sk)')].find(n => n.offsetParent);
    if (!ul || cards(ul).length < 2) return;
    const url = source(s.owner);
    if (!url) return;
    s.busy = true;
    try {
      const ids = await order(s, url);
      if (state !== s || !ids) return;
      const rank = new Map(ids.map((id, i) => [id, i]));
      const now = cards(ul);
      const pos = (li) => {
        const id = (li.querySelector('a.item-card-link')?.getAttribute('href') || '').match(HREF)?.[1];
        return rank.has(id) ? rank.get(id) : Infinity;
      };
      const known = now.filter(li => pos(li) !== Infinity);
      if (known.length < 2) return;
      const ranked = known.slice().sort((a, b) => pos(a) - pos(b));
      const sorted = now.map(li => (pos(li) === Infinity ? li : ranked.shift()));
      ul.classList.add('routility-list-ordered');
      sorted.forEach((li, i) => { if (li.style.order !== String(i)) li.style.order = String(i); });
    } finally {
      s.busy = false;
    }
  }

  function setup(owner) {
    if (state) return;
    const s = state = { owner: String(owner), cache: new Map(), busy: false, timer: 0 };
    const run = () => {
      fix(s);
      clearTimeout(s.timer);
      s.timer = setTimeout(() => fix(s), 120);
    };
    s.observer = new MutationObserver(run);
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    run();
  }

  function teardown() {
    const s = state;
    if (!s) return;
    clearTimeout(s.timer);
    s.observer?.disconnect();
    state = null;
  }

  window.RoUtilityListOrder = { setup, teardown };
})();
