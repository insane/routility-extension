(function () {
  'use strict';

  const { el, formatNumber, verifiedBadge, json } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  let settings = {};
  let page = null;

  chrome.storage.local.get('routilitySettings', (st) => { settings = st.routilitySettings || {}; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.routilitySettings) settings = changes.routilitySettings.newValue || {};
  });

  const SERVER_DEFAULT = { order: ['private', 'regions', 'friends', 'other'], hidden: [] };
  let serverStyle = null;

  function applyServerLayout(v) {
    const lay = v && Array.isArray(v.order) ? v : SERVER_DEFAULT;
    const keys = ['private', 'regions', 'friends', 'other'];
    const rank = (k) => {
      const i = lay.order.indexOf(k);
      return i < 0 ? 10 + keys.indexOf(k) : i + 1;
    };
    let css = keys.map(k => `#running-game-instances-container [data-routility-sv="${k}"] { order: ${rank(k)}; }`).join(' ') + ` #running-game-instances-container [data-routility-sv="recent"] { order: ${rank('friends')}; }`;
    for (const k of Array.isArray(lay.hidden) ? lay.hidden : []) if (keys.includes(k)) css += ` #running-game-instances-container [data-routility-sv="${k}"] { display: none !important; }`;
    if (!serverStyle) {
      serverStyle = document.createElement('style');
      serverStyle.id = 'routility-server-layout';
      (document.head || document.documentElement).appendChild(serverStyle);
    }
    serverStyle.textContent = css;
  }

  chrome.storage.local.get('routilityServerLayout', (st) => applyServerLayout(st.routilityServerLayout));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.routilityServerLayout) applyServerLayout(changes.routilityServerLayout.newValue);
  });

  function tagServerSections() {
    const friends = document.querySelector('#rbx-friends-running-games');
    const host = friends ? friends.parentElement : document.querySelector('#running-game-instances-container > div');
    if (!host) return;
    for (const child of host.children) {
      let kind = '';
      if (child.id === 'rbx-friends-running-games') kind = 'friends';
      else if (child.id === 'rbx-public-running-games') kind = 'other';
      else if (child.classList.contains('routility-server-regions')) kind = 'regions';
      else if (child.classList.contains('routility-recent-servers')) kind = 'recent';
      else if (!child.classList.contains('sg-system-feedback') && child.textContent.trim() && (!friends || child.compareDocumentPosition(friends) & Node.DOCUMENT_POSITION_FOLLOWING)) kind = 'private';
      if (kind && child.dataset.routilitySv !== kind) child.dataset.routilitySv = kind;
    }
  }

  const MAP_MASK = 'AAAADPv//gAwCAAYAAAAAAAICcf//ABQAAACAAAAAAACA4B/+AAAAQB/gAAAAAAfm+A/+AAABh///nwAD//8l5gf4AB/hd//////7////xo+DgDvf///////B///+IQcAAPf////////A8f/8DoAAAPP//////9AAAD//j4AACGf/////8DAAAB//7+AAFP///////CAAAB///8AAC////////AAAAAf//xAAB///////9AAAAAf//oAAA98f////5AAAAAf//AAAHi5P////gAAAAAf/+AAAHAX////4gAAAAAP/+AAAB8A////8uAAAAAH/4AAAH+Q////8QAAAAAB8IAAAH//9///+AAAAAAC8AAAAf/++f//8AAAAAAA4AAAAf//fx//4AAAAAAAciAAAf//fw+fAAAAAAAAPgAAAf//vA8fCAAAAAAABwAAA///8AYHCAAAAAAAAQAAAf//yAYDAAAAAAAAAL8AAP//+AAAAAAAAAAAAD/AAHP/8AAEEAAAAAAAAD/gAAH/4AACYAAAAAAAAH/wAAH/wAAG4AAAAAAAAH/+AAD/gAACKfAAAAAAAH//AAD/gAABADgAAAAAAD//AAD/gAAABARAAAAAAD/+AAD/yAAAANAAAAAAAB/+AAD/iAAAB5AAAAAAAAf+AAD/EAAAB/gAAAAAAAf8AAB/MAAAP/wAAAAAAA/wAAB/EAAAP/4AAAAAAA/wAAB+AAAAP/4AAAAAAA/gAAA8AAAAP/4AAAAAAA/AAAA4AAAAOHwAAAAAAA+AAAAAAAAAABwAAAAAAA4AAAAAAAAAAAACAAAAAB4AAAAAAAAAAAgEAAAAABwAAAAAAAAAAAAIAAAAABwAAAAAAAAAAAAAAAAAABiAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const MAP_W = 120;
  const MAP_H = 48;
  const MAP_TOP = 82;
  const MAP_BOTTOM = -62;
  let landDots = null;

  function mapDots() {
    if (landDots) return landDots;
    const bytes = atob(MAP_MASK);
    landDots = [];
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      if ((bytes.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) landDots.push([i % MAP_W, Math.floor(i / MAP_W)]);
    }
    return landDots;
  }

  function project(lat, lon) {
    return [(lon + 180) / 360 * MAP_W, (MAP_TOP - Math.max(MAP_BOTTOM, Math.min(MAP_TOP, lat))) / (MAP_TOP - MAP_BOTTOM) * MAP_H];
  }

  function placeName(dc, full) {
    const parts = full ? [dc.city, dc.region && dc.region !== dc.city ? dc.region : '', dc.country] : [dc.city, dc.country];
    return [...new Set(parts.filter(Boolean))].join(', ') || lt('Datacenter {id}', { id: dc.id });
  }

  let countryCodes = null;

  function countryCode(name) {
    if (!name) return '';
    if (!countryCodes) {
      countryCodes = new Map();
      try {
        const names = new Intl.DisplayNames(['en'], { type: 'region' });
        for (let a = 65; a <= 90; a++) {
          for (let b = 65; b <= 90; b++) {
            const code = String.fromCharCode(a, b);
            const n = names.of(code);
            if (!n || n === code) continue;
            const key = n.toLowerCase();
            const prev = countryCodes.get(key);
            if (!prev || (!FLAGS.has(prev.toLowerCase()) && FLAGS.has(code.toLowerCase()))) countryCodes.set(key, code);
          }
        }
      } catch {}
      countryCodes.set('france', 'FR');
      countryCodes.set('united states', 'US');
      countryCodes.set('united kingdom', 'GB');
      countryCodes.set('hong kong', 'HK');
    }
    return countryCodes.get(String(name).toLowerCase()) || '';
  }

  const FLAGS = new Set('us ca mx br ar cl co pe gb ie fr de nl be lu ch at it es pt pl cz se no dk fi ee lv lt ro hu bg gr tr ua il ae sa in sg hk jp kr tw cn th my id ph vn au nz za eg ng ke'.split(' '));

  function flagIcon(code) {
    const cc = code.toLowerCase();
    if (!FLAGS.has(cc)) return el('span', 'routility-cc', code);
    const img = el('img', 'routility-flag');
    img.src = chrome.runtime.getURL(`assets/flags/${cc}.svg`);
    img.alt = code;
    img.width = 16;
    img.height = 12;
    return img;
  }

  function shortPlace(dc) {
    const code = countryCode(dc.country);
    if (code === 'US' && dc.region) return dc.region;
    return dc.city || dc.region || dc.country || lt('Datacenter {id}', { id: dc.id });
  }

  function regionLabel(dc) {
    const city = dc.city || dc.region || '';
    const second = countryCode(dc.country) === 'US' && dc.region ? dc.region : dc.country;
    const label = [...new Set([city, second].filter(Boolean))].join(', ');
    if (!label) return lt('Datacenter {id}', { id: dc.id });
    return label.length > 26 ? shortPlace(dc) : label;
  }

  const TREND_UP = 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z';
  const TREND_DOWN = 'M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z';

  function pill(cls) {
    return el('span', 'routility-pill text-label-small ' + (cls || ''));
  }

  function perfPill(fps) {
    const pct = Math.max(0, Math.min(100, Math.round(fps / 60 * 100)));
    const box = pill('routility-pill-perf');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pct >= 80 ? TREND_UP : TREND_DOWN);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    box.appendChild(svg);
    box.appendChild(document.createTextNode(`${pct}%`));
    box.dataset.rtTip = lt('Server performance: {fps} FPS', { fps: Math.round(fps) });
    return box;
  }

  function pingPill(ping) {
    const box = pill('routility-pill-ping');
    box.appendChild(el('span', `routility-server-dot routility-server-${ping < 100 ? 'good' : ping < 200 ? 'ok' : 'bad'}`));
    box.appendChild(document.createTextNode(lt('{n} ms', { n: Math.round(ping) })));
    box.dataset.rtTip = lt('Average ping of the players in this server');
    return box;
  }

  function uptimeText(startedAt) {
    const t = Date.parse(startedAt);
    if (!Number.isFinite(t)) return '';
    const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
    if (mins < 60) return ltn(mins, '{n}m', '{n}m');
    const h = Math.floor(mins / 60);
    if (h < 24) return lt('{h}h {m}m', { h, m: mins % 60 });
    return lt('{d}d {h}h', { d: Math.floor(h / 24), h: h % 24 });
  }

  function metaLine(d, latest) {
    if (!d || (!d.startedAt && !Number.isFinite(d.placeVersion))) return null;
    const box = el('div', 'routility-server-meta text-label-small');
    const up = d.startedAt ? uptimeText(d.startedAt) : '';
    if (up) {
      const item = el('span', 'routility-meta-item');
      item.appendChild(el('span', 'icon routility-calc-icon routility-clock-icon'));
      item.appendChild(document.createTextNode(lt('Up {time}', { time: up })));
      item.dataset.rtTip = lt('Running since {date}', { date: new Date(d.startedAt).toLocaleString() });
      box.appendChild(item);
    }
    if (Number.isFinite(d.placeVersion)) {
      const item = el('span', 'routility-meta-item');
      item.appendChild(document.createTextNode(`v${d.placeVersion}`));
      if (Number.isFinite(latest)) {
        const isLatest = d.placeVersion >= latest;
        item.appendChild(el('span', 'routility-meta-tag ' + (isLatest ? 'routility-meta-latest' : 'routility-meta-old'), isLatest ? lt('Latest') : lt('Older')));
        item.dataset.rtTip = isLatest ? lt('Running the newest version of the game') : lt('Running an older version (newest is v{version})', { version: latest });
      }
      box.appendChild(item);
    }
    box.dataset.key = `${up}|${d.placeVersion}|${latest}`;
    return box;
  }

  function regionPill(state) {
    const box = el('div', 'routility-injected routility-server-region-line routility-pill-region text-label-small');
    box.dataset.state = state.key;
    if (state.dc) {
      const code = countryCode(state.dc.country);
      if (code) box.appendChild(flagIcon(code));
      box.appendChild(el('span', 'text-overflow', regionLabel(state.dc)));
      box.dataset.rtTip = placeName(state.dc, true);
    } else {
      box.appendChild(el('span', 'icon routility-calc-icon routility-pin-icon'));
      box.appendChild(el('span', 'text-overflow', state.text));
      if (state.tip) box.dataset.rtTip = state.tip;
    }
    return box;
  }

  function shareButton(link) {
    const btn = el('button', 'btn-control-xs routility-injected routility-server-share');
    btn.type = 'button';
    btn.setAttribute('aria-label', lt('Copy invite link'));
    btn.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-link'));
    btn.dataset.rtTip = lt('Copy invite link to this server');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      let ok = false;
      try {
        await navigator.clipboard.writeText(link);
        ok = true;
      } catch {}
      btn.classList.toggle('routility-server-share-done', ok);
      btn.dataset.rtTip = ok ? lt('Invite link copied') : lt('Couldn’t copy');
      clearTimeout(btn.flash);
      btn.flash = setTimeout(() => {
        btn.classList.remove('routility-server-share-done');
        btn.dataset.rtTip = lt('Copy invite link to this server');
      }, 1600);
    });
    return btn;
  }

  function serverMap(points, selected, onPick, credit, checked, emptyNote, opts = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const card = el('div', 'routility-injected routility-server-map bg-surface-100 radius-large');
    const head = el('div', 'routility-server-map-head');
    head.appendChild(el('span', 'text-title-medium content-emphasis', lt('Server regions')));
    const total = points.reduce((n, p) => n + p.servers, 0);
    const regionsText = ltn(points.length, '{n} region', '{n} regions', { n: formatNumber(points.length) });
    const headText = opts.headText || (checked > total ? lt('{located} of {checked} servers located • {regions}', { located: formatNumber(total), checked: formatNumber(checked), regions: regionsText }) : ltn(total, '{n} server • {regions}', '{n} servers • {regions}', { n: formatNumber(total), regions: regionsText }));
    head.appendChild(el('span', 'text-body-small content-muted', headText));
    card.dataset.headText = headText;
    if (!opts.bare) card.appendChild(head);
    if (opts.note) card.appendChild(el('div', 'text-body-small content-muted routility-server-map-empty', opts.note));
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
    svg.setAttribute('class', 'routility-server-map-svg');
    svg.setAttribute('aria-hidden', 'true');
    const land = document.createElementNS(NS, 'g');
    land.setAttribute('class', 'routility-map-land');
    for (const [x, y] of mapDots()) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x + 0.5);
      c.setAttribute('cy', y + 0.5);
      c.setAttribute('r', 0.3);
      land.appendChild(c);
    }
    svg.appendChild(land);
    const max = Math.max(1, ...points.map(p => p.servers));
    for (const p of points) {
      const [x, y] = project(p.dc.lat, p.dc.lon);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'routility-map-pin' + (selected === p.key ? ' routility-map-pin-on' : ''));
      const r = 0.9 + 1.1 * Math.sqrt(p.servers / max);
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('class', 'routility-map-ring');
      ring.setAttribute('cx', x);
      ring.setAttribute('cy', y);
      ring.setAttribute('r', r);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'routility-map-dot');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', r);
      g.append(ring, dot);
      svg.appendChild(g);
    }
    card.appendChild(svg);
    const chips = el('div', 'routility-server-map-chips');
    for (const p of points) {
      const on = selected === p.key;
      const chip = el('button', 'relative clip group/interactable cursor-pointer flex items-center gap-xsmall radius-circle height-800 padding-x-medium text-label-small ' + (on ? 'bg-system-contrast content-inverse-emphasis' : 'stroke-standard stroke-contrast-alpha bg-none content-emphasis'));
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(on));
      const code = countryCode(p.dc.country);
      chip.appendChild(code ? flagIcon(code) : el('span', 'routility-map-chip-dot'));
      chip.appendChild(el('span', 'text-no-wrap', placeName(p.dc)));
      chip.appendChild(el('span', 'text-no-wrap routility-map-chip-count', formatNumber(p.servers)));
      chip.dataset.rtTip = ltn(p.servers, '{place} • {n} server • {players} playing', '{place} • {n} servers • {players} playing', { place: placeName(p.dc, true), n: formatNumber(p.servers), players: formatNumber(p.players) });
      chip.addEventListener('click', () => onPick(on ? null : p.key));
      chips.appendChild(chip);
    }
    card.appendChild(chips);
    if (opts.extra) card.appendChild(opts.extra);
    if (emptyNote) {
      const sel = points.find(x => x.key === selected);
      card.appendChild(el('div', 'text-body-small content-muted routility-server-map-empty', lt('None of the servers loaded below are in {region} yet. Press Load More to find some, or click the region again to show all.', { region: sel ? placeName(sel.dc) : lt('this region') })));
    }
    if (credit) {
      const note = el('div', 'text-label-small content-muted routility-server-map-credit');
      const m = credit.match(/^(.*?)\b(db-ip\.com)\b(.*)$/i);
      if (m) {
        note.appendChild(document.createTextNode(m[1]));
        const a = el('a', 'text-link', m[2]);
        a.href = 'https://db-ip.com';
        a.target = '_blank';
        a.rel = 'noopener';
        note.appendChild(a);
        note.appendChild(document.createTextNode(m[3]));
      } else {
        note.textContent = credit;
      }
      card.appendChild(note);
    }
    return card;
  }

  function serverStats(p, placeId) {
    const servers = new Map();
    p.hasServer = (id) => {
      const parts = String(id).split('-');
      return servers.has(`${parts[1]}-${parts[2]}`);
    };
    const centers = new Map();
    p.centers = centers;
    const regionOf = new Map();
    const detailsOf = new Map();
    let selected = null;
    let mapKey = '';
    let attribution = '';
    let refreshedCenters = false;
    let counts = null;
    let countsTries = 0;
    let countsTimer = null;
    const lists = new Map();
    const loadCounts = async () => {
      clearTimeout(countsTimer);
      if (p !== page || settings.serverRegions === false) return;
      const res = await window.RoUtilityUI.request({ type: 'serverCounts', placeId }, r => r !== undefined);
      if (p !== page) return;
      if (res && Array.isArray(res.regions) && res.regions.length) {
        counts = res;
        p.regionCounts = res;
        p.latestVersion = Number.isFinite(res.latestVersion) ? res.latestVersion : null;
        countsTimer = setTimeout(loadCounts, 300000);
      } else {
        if (res && res.scanning && !(counts && Array.isArray(counts.regions))) counts = { scanning: true, listed: res.listed || 0, resolved: res.resolved || 0 };
        if (countsTries++ < 120) countsTimer = setTimeout(loadCounts, res && res.retryAfter ? res.retryAfter * 1000 : res && Array.isArray(res.regions) ? 60000 : 15000);
      }
      mapKey = '';
      p.tick();
    };
    const loadRegionList = async (key, ids) => {
      let st = lists.get(key);
      if (!st) {
        st = { servers: [], cursor: '', done: false, loading: false, error: '', scanning: false };
        lists.set(key, st);
      }
      if (st.loading || st.done) return;
      st.loading = true;
      mapKey = '';
      p.tick();
      const res = await window.RoUtilityUI.request({ type: 'serverRegionList', placeId, ids, cursor: st.cursor }, r => r !== undefined);
      if (p !== page) return;
      st.loading = false;
      if (res && Array.isArray(res.servers)) {
        const have = new Set(st.servers.map(x => x.id));
        st.servers.push(...res.servers.filter(x => !have.has(x.id) && have.add(x.id)));
        st.cursor = res.nextCursor || '';
        st.done = !res.nextCursor;
        st.scanning = false;
        st.error = '';
      } else if (res && res.scanning) {
        st.scanning = true;
        setTimeout(() => { if (p === page && selected === key) loadRegionList(key, ids); }, 15000);
      } else {
        st.error = res && res.retryAfter ? lt('RoUtility is busy, try again in a moment.') : lt('Couldn’t load servers for this region.');
      }
      mapKey = '';
      p.tick();
    };
    const sample = new Map();
    let sampled = false;
    const loadSample = async () => {
      if (sampled) return;
      sampled = true;
      const d = await json(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&excludeFullGames=true&limit=100`);
      if (p !== page || !d) return;
      for (const sv of d.data || []) if (sv && typeof sv.id === 'string') sample.set(sv.id, sv);
      p.tick();
    };
    const loadCenters = (tries, force) => {
      if (p !== page || settings.serverRegions === false) return;
      window.RoUtilityUI.request({ type: 'getDatacenters', force: !!force }, r => r && Array.isArray(r.list)).then(res => {
        if (p !== page) return;
        if (!res || !Array.isArray(res.list) || !res.list.length) {
          if (tries < 6) setTimeout(() => loadCenters(tries + 1), 20000);
          return;
        }
        for (const dc of res.list) centers.set(dc.id, dc);
        attribution = res.attribution || '';
        loadSample();
        loadCounts();
        p.tick();
      });
    };
    loadCenters(0);
    const askedAt = new Map();
    const retries = new Map();
    const waiting = new Set();
    const urgent = new Set();
    const regionBusy = { soon: false, rest: false };
    let regionTimer = null;
    let recheckTimer = null;
    let regionPauseUntil = 0;
    const askRegions = () => {
      clearTimeout(regionTimer);
      regionTimer = setTimeout(async () => {
        if (p !== page || !waiting.size || settings.serverRegions === false) return;
        const wait = regionPauseUntil - Date.now();
        if (wait > 0) {
          regionTimer = setTimeout(askRegions, wait);
          return;
        }
        for (const id of urgent) if (!waiting.has(id)) urgent.delete(id);
        const lane = urgent.size && !regionBusy.soon ? 'soon' : !regionBusy.rest && waiting.size > urgent.size ? 'rest' : null;
        if (!lane) return;
        const ids = (lane === 'soon' ? [...urgent] : [...waiting].filter(id => !urgent.has(id))).slice(0, 30);
        ids.forEach(id => { waiting.delete(id); urgent.delete(id); });
        regionBusy[lane] = true;
        if (waiting.size) askRegions();
        const res = await window.RoUtilityUI.request({ type: 'serverRegions', placeId, ids }, r => r !== undefined);
        regionBusy[lane] = false;
        if (p !== page) return;
        if (!res || res.retryAfter) {
          regionPauseUntil = Date.now() + (res && res.retryAfter ? res.retryAfter * 1000 : 30000);
          ids.forEach(id => { askedAt.delete(id); waiting.add(id); });
        } else {
          for (const id of ids) {
            const dc = res.regions ? res.regions[id] : null;
            regionOf.set(id, Number.isFinite(dc) ? { dc, why: '' } : { dc: null, why: '' });
            if (res.details && res.details[id]) detailsOf.set(id, res.details[id]);
          }
          if (ids.some(id => regionOf.get(id).dc == null)) {
            clearTimeout(recheckTimer);
            recheckTimer = setTimeout(() => { if (p === page) p.tick(); }, 31000);
          }
        }
        p.tick();
        if (waiting.size) askRegions();
      }, 250);
    };
    let cursor = '';
    let pages = 0;
    let busy = false;
    let last = 0;
    let retry = null;
    let fails = 0;
    const more = async () => {
      if (busy || pages >= 5 || cursor === null) return;
      const wait = 3000 - (Date.now() - last);
      if (wait > 0) {
        clearTimeout(retry);
        retry = setTimeout(() => { if (p === page) more(); }, wait);
        return;
      }
      busy = true;
      last = Date.now();
      const d = await json(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      busy = false;
      if (p !== page) return;
      if (!d) {
        fails++;
        if (fails >= 3) {
          cursor = null;
          return;
        }
        clearTimeout(retry);
        retry = setTimeout(() => { if (p === page) more(); }, 4000 * fails);
        return;
      }
      pages++;
      for (const s of d.data || []) {
        const parts = String(s.id || '').split('-');
        if (parts.length >= 3) servers.set(`${parts[1]}-${parts[2]}`, s);
      }
      cursor = d.nextPageCursor || null;
      p.tick();
      if (cursor === null || pages >= 5) setTimeout(p.tick, 0);
    };
    const fromPage = (e) => {
      if (e.source !== window || !e.data || e.data.type !== 'routility-servers' || !Array.isArray(e.data.servers)) return;
      if (p !== page) return window.removeEventListener('message', fromPage);
      let added = false;
      for (const s of e.data.servers) {
        const parts = String(s.id || '').split('-');
        if (parts.length < 3) continue;
        servers.set(`${parts[1]}-${parts[2]}`, s);
        added = true;
      }
      if (added) p.tick();
    };
    window.addEventListener('message', fromPage);
    const onJoinClick = (e) => {
      const btn = e.target.closest?.('.game-server-join-btn');
      if (!btn || p !== page) return;
      const li = btn.closest('li.rbx-public-game-server-item');
      if (!li) return;
      if (li.classList.contains('routility-region-item')) {
        const id = li.dataset.serverId;
        const sv = li.__routilityServer;
        if (!id || !sv) return;
        e.preventDefault();
        e.stopPropagation();
        launchServer(placeId, sv, li.__routilityJoin || {});
        return;
      }
      const short = li.querySelector('.server-id-text')?.textContent.replace(/^ID:\s*/, '').trim();
      const sv = short && servers.get(short);
      if (!sv) return;
      const r = regionOf.get(sv.id);
      pendingJoin = { at: Date.now(), server: sv, dc: r && r.dc != null ? centers.get(r.dc) : null, details: detailsOf.get(sv.id), latest: p.latestVersion };
    };
    document.addEventListener('click', onJoinClick, true);
    const prevStop = p.stopJoins;
    p.stopJoins = () => { document.removeEventListener('click', onJoinClick, true); prevStop?.(); };
    p.findServer = (id) => sample.get(id) || [...servers.values()].find(x => x.id === id) || null;
    p.servers = () => {
      if (settings.serverStats === false) return;
      let missing = false;
      for (const li of document.querySelectorAll('li.rbx-public-game-server-item:not(.routility-region-item)')) {
        const short = li.querySelector('.server-id-text')?.textContent.replace(/^ID:\s*/, '').trim();
        if (!short) continue;
        const s = servers.get(short);
        const done = cursor === null || pages >= 5;
        let row = li.querySelector('.routility-server-pills');
        const key = s ? `${short}/${s.ping}/${Math.round(s.fps)}` : `${short}/${done ? 'none' : 'wait'}`;
        if (!s && !done) missing = true;
        if (!row || row.dataset.key !== key) {
          row?.remove();
          row = el('div', 'routility-injected routility-server-pills');
          row.dataset.key = key;
          if (s) {
            if (Number.isFinite(s.fps)) row.appendChild(perfPill(s.fps));
            if (Number.isFinite(s.ping)) row.appendChild(pingPill(s.ping));
          } else {
            row.appendChild(pill('routility-pill-muted')).textContent = done ? lt('No ping info') : '—';
          }
          const gauge = li.querySelector('.server-player-count-gauge');
          if (gauge) gauge.after(row);
          else li.querySelector('.rbx-public-game-server-status')?.after(row);
        }
        if (s && !li.querySelector('.routility-server-share')) {
          const join = li.querySelector('.game-server-join-btn');
          if (join) join.after(shareButton(`https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${s.id}`));
        }
      }
      if (missing) more();
      regions();
    };

    const regions = () => {
      const on = settings.serverRegions !== false && centers.size > 0;
      const tiles = [...document.querySelectorAll('li.rbx-public-game-server-item:not(.routility-region-item)')];
      if (!on) {
        document.querySelectorAll('.routility-pill-region, .routility-server-map, .routility-server-regions').forEach(n => n.remove());
        tiles.forEach(li => delete li.dataset.routilityRegionHidden);
        return;
      }
      const groups = new Map();
      const seen = new Map();
      let shownMatches = 0;
      const ask = (sv, soon) => {
        const prev = regionOf.get(sv.id);
        const full = sv.maxPlayers > 0 && sv.playing >= sv.maxPlayers;
        const tries = retries.get(sv.id) || 0;
        const stale = prev && prev.dc == null && Date.now() - (askedAt.get(sv.id) || 0) > (!full && tries < 10 ? 30000 : 300000);
        if ((!askedAt.has(sv.id) || stale) && !waiting.has(sv.id)) {
          if (prev) retries.set(sv.id, tries + 1);
          askedAt.set(sv.id, Date.now());
          waiting.add(sv.id);
          askRegions();
        }
        if (soon && waiting.has(sv.id)) urgent.add(sv.id);
      };
      for (const li of tiles) {
        const short = li.querySelector('.server-id-text')?.textContent.replace(/^ID:\s*/, '').trim();
        const s = short && servers.get(short);
        if (!s) continue;
        seen.set(s.id, s);
        ask(s, true);
        const known = regionOf.has(s.id);
        const res = known ? regionOf.get(s.id) : null;
        const dc = res && res.dc != null ? centers.get(res.dc) : null;
        if (res && res.dc != null && !dc && !refreshedCenters) {
          refreshedCenters = true;
          loadCenters(6, true);
        }
        const full = s.maxPlayers > 0 && s.playing >= s.maxPlayers;
        const text = !known ? '—' : dc ? placeName(dc, true) : res.dc != null ? lt('Unknown region') : full ? lt('Region unavailable (full)') : lt('Region unavailable');
        const tip = !known || dc ? '' : res.dc != null ? lt('Datacenter {id} isn’t in RoUtility’s list yet', { id: res.dc }) : full ? lt('Roblox hides where full servers are until a slot opens') : lt('RoUtility doesn’t know this server’s region yet');
        const latest = counts && Number.isFinite(counts.latestVersion) ? counts.latestVersion : null;
        const d = detailsOf.get(s.id);
        const meta = metaLine(d, latest);
        const oldMeta = li.querySelector('.routility-server-meta');
        if (meta && (!oldMeta || oldMeta.dataset.key !== meta.dataset.key)) {
          meta.classList.add('routility-injected');
          if (oldMeta) oldMeta.replaceWith(meta);
          else li.querySelector('.rbx-public-game-server-status')?.after(meta);
        } else if (!meta && oldMeta) oldMeta.remove();
        const stateKey = `${text}|${tip}`;
        const pills = li.querySelector('.routility-server-pills');
        if (pills) {
          const cur = li.querySelector('.routility-server-region-line');
          if (!cur || cur.dataset.state !== stateKey) {
            const next = regionPill({ key: stateKey, dc, text, tip });
            if (cur) cur.replaceWith(next);
            else pills.after(next);
          } else if (cur.previousElementSibling !== pills) pills.after(cur);
        }
        const place = dc ? placeName(dc) : null;
        const hide = selected != null && place !== selected;
        if (selected != null && !hide) shownMatches++;
        if (hide) li.dataset.routilityRegionHidden = '1';
        else delete li.dataset.routilityRegionHidden;
      }
      for (const sv of sample.values()) {
        if (seen.has(sv.id)) continue;
        seen.set(sv.id, sv);
        ask(sv);
      }
      let located = 0;
      for (const sv of seen.values()) {
        const r = regionOf.get(sv.id);
        const dc = r && r.dc != null ? centers.get(r.dc) : null;
        if (!dc) continue;
        located++;
        const place = placeName(dc);
        const g = groups.get(place) || { dc, key: place, servers: 0, players: 0 };
        g.servers++;
        g.players += sv.playing || 0;
        groups.set(place, g);
      }
      const full = counts && Array.isArray(counts.regions);
      let points;
      let headText = '';
      let note = '';
      if (full) {
        const byPlace = new Map();
        let unknown = 0;
        for (const r of counts.regions) {
          const dc = centers.get(Number(r.datacenterId));
          if (!dc) {
            unknown += Number(r.servers) || 0;
            continue;
          }
          const place = placeName(dc);
          const g = byPlace.get(place) || { dc, key: place, servers: 0, players: 0, ids: [] };
          g.servers += Number(r.servers) || 0;
          g.players += Number(r.players) || 0;
          g.ids.push(dc.id);
          byPlace.set(place, g);
        }
        points = [...byPlace.values()].sort((x, y) => y.servers - x.servers || x.dc.city.localeCompare(y.dc.city));
        const total = Number(counts.total) || points.reduce((n, x) => n + x.servers, 0) + unknown;
        const located = points.reduce((n, x) => n + x.servers, 0);
        headText = `${ltn(total, '{n} server', '{n} servers', { n: formatNumber(total) })}${located < total ? ` • ${lt('{n} located', { n: formatNumber(located) })}` : ''} • ${ltn(points.length, '{n} region', '{n} regions', { n: formatNumber(points.length) })}${Number.isFinite(counts.latestVersion) ? ` • ${lt('latest v{version}', { version: counts.latestVersion })}` : ''}`;
        tiles.forEach(li => delete li.dataset.routilityRegionHidden);
      } else {
        points = [...groups.values()].sort((x, y) => y.servers - x.servers || x.dc.city.localeCompare(y.dc.city));
        if (counts && counts.scanning) note = counts.listed ? lt('RoUtility is scanning every server of this game ({located} of {listed} located so far). The full map shows up here when it’s done; for now this is a sample.', { located: formatNumber(counts.resolved), listed: formatNumber(counts.listed) }) : lt('RoUtility is scanning every server of this game, the full map shows up here when it’s done. For now this is a sample.');
      }
      if (selected != null && !points.some(x => x.key === selected)) selected = null;
      const list = document.querySelector('#rbx-public-game-server-item-container') || tiles[0]?.parentElement;
      const emptyNote = !full && selected != null && !shownMatches;
      const sel = full && selected != null ? points.find(x => x.key === selected) : null;
      const st = sel ? lists.get(selected) : null;
      const key = JSON.stringify([points.map(x => [x.key, x.servers, x.players]), selected, seen.size, emptyNote, headText, note, st ? [st.servers.length, st.loading, st.done, st.error, st.scanning] : null]);
      let card = document.querySelector('.routility-server-map');
      if (!points.length || !list) {
        card?.remove();
        document.querySelector('.routility-server-regions')?.remove();
        mapKey = '';
        return;
      }
      const anchor = document.querySelector('#rbx-public-running-games');
      let sec = document.querySelector('.routility-server-regions');
      if (anchor) {
        if (!sec) {
          sec = el('div', 'routility-injected stack server-list-section routility-server-regions');
          const ch = el('div', 'container-header');
          const row = el('div', 'server-list-container-header');
          row.appendChild(el('h2', 'server-list-header', lt('Server Regions')));
          row.appendChild(el('span', 'text-body-small content-muted routility-server-regions-count'));
          ch.appendChild(row);
          sec.appendChild(ch);
        }
        if (sec.nextElementSibling !== anchor) anchor.before(sec);
      }
      const placed = anchor ? card && card.parentElement === sec : card && card.nextElementSibling === list;
      if (card && card.isConnected && mapKey === key && placed) return;
      const keepScroll = card ? card.querySelector('.routility-region-list-wrap')?.scrollTop : 0;
      card?.remove();
      mapKey = key;
      const tokensFor = (id) => {
        const local = sample.get(id) || [...servers.values()].find(x => x.id === id);
        return local && Array.isArray(local.playerTokens) ? local.playerTokens : [];
      };
      const extra = sel ? regionPanel(sel, st, placeId, () => loadRegionList(sel.key, sel.ids), tokensFor, counts && Number.isFinite(counts.latestVersion) ? counts.latestVersion : null) : null;
      card = serverMap(points, selected, (id) => {
        selected = id;
        mapKey = '';
        if (full && id != null) {
          const g = points.find(x => x.key === id);
          if (g && !lists.has(id)) loadRegionList(id, g.ids);
        }
        regions();
      }, attribution, seen.size, emptyNote, { headText, note, extra, bare: !!anchor });
      if (anchor) {
        sec.appendChild(card);
        sec.querySelector('.routility-server-regions-count').textContent = card.dataset.headText || '';
      } else list.before(card);
      if (keepScroll) {
        const w = card.querySelector('.routility-region-list-wrap');
        if (w) w.scrollTop = keepScroll;
      }
    };
  }

  const headshotByToken = new Map();
  let headshotQueue = [];
  let headshotTimer = null;

  function loadHeadshots() {
    clearTimeout(headshotTimer);
    headshotTimer = setTimeout(async () => {
      const batch = headshotQueue.splice(0, 100);
      if (!batch.length) return;
      const body = batch.map(({ token }, i) => ({ requestId: `${i}:${token}`, token, type: 'AvatarHeadShot', size: '150x150', format: 'webp', isCircular: false }));
      const d = await json('https://thumbnails.roblox.com/v1/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const byToken = new Map();
      for (const r of (d && d.data) || []) {
        const token = String(r.requestId || '').split(':').slice(1).join(':');
        if (token && r.imageUrl && (r.state === 'Completed' || r.state === 'Blocked')) byToken.set(token, r.imageUrl);
      }
      const retry = [];
      for (const item of batch) {
        const url = byToken.get(item.token);
        if (url) {
          headshotByToken.set(item.token, url);
          if (item.img.isConnected) item.img.src = url;
        } else if ((item.tries || 0) < 3 && item.img.isConnected) {
          retry.push({ ...item, tries: (item.tries || 0) + 1 });
        }
      }
      if (retry.length) setTimeout(() => { headshotQueue.push(...retry); loadHeadshots(); }, 2500);
      if (headshotQueue.length) loadHeadshots();
    }, 50);
  }

  function serverFaces(sv) {
    const tokens = sv.playerTokens || [];
    if (!tokens.length) return null;
    const box = el('div', 'player-thumbnails-container routility-region-faces');
    const shown = tokens.slice(0, 5);
    for (const token of shown) {
      const av = el('span', 'avatar avatar-headshot-md player-avatar');
      const thumb = el('span', 'thumbnail-2d-container avatar-card-image');
      const img = el('img');
      img.alt = '';
      if (headshotByToken.has(token)) img.src = headshotByToken.get(token);
      else {
        headshotQueue.push({ token, img });
        loadHeadshots();
      }
      thumb.appendChild(img);
      av.appendChild(thumb);
      box.appendChild(av);
    }
    const rest = (Number(sv.playing) || 0) - shown.length;
    if (rest > 0) box.appendChild(el('span', 'avatar avatar-headshot-md player-avatar hidden-players-placeholder', `+${formatNumber(rest)}`));
    return box;
  }

  function regionPanel(g, st, placeId, more, tokensFor, latest) {
    const box = el('div', 'routility-region-panel');
    const head = el('div', 'routility-server-map-head');
    head.appendChild(el('span', 'text-title-small content-emphasis', lt('Servers in {place}', { place: placeName(g.dc) })));
    head.appendChild(el('span', 'text-body-small content-muted', ltn(g.servers, '{n} server • {players} playing', '{n} servers • {players} playing', { n: formatNumber(g.servers), players: formatNumber(g.players) })));
    box.appendChild(head);
    if (!st || (!st.servers.length && (st.loading || st.scanning))) {
      box.appendChild(el('div', 'text-body-small content-muted', st && st.scanning ? lt('RoUtility is still scanning this game, the list shows up in a moment.') : lt('Loading servers…')));
      return box;
    }
    if (!st.servers.length) {
      box.appendChild(el('div', 'text-body-small content-muted', st.error || lt('No open servers in this region right now.')));
      return box;
    }
    const wrap = el('div', 'routility-region-list-wrap');
    const ul = el('ul', 'card-list rbx-public-game-server-item-container routility-region-list');
    for (const sv of st.servers) {
      const li = el('li', 'rbx-public-game-server-item routility-region-item');
      li.dataset.serverId = sv.id;
      li.__routilityServer = sv;
      li.__routilityJoin = { dc: g.dc, details: { placeVersion: sv.placeVersion, startedAt: sv.startedAt }, latest };
      const card = el('div', 'card-item card-item-public-server');
      const faces = serverFaces(sv.playerTokens && sv.playerTokens.length ? sv : { ...sv, playerTokens: tokensFor ? tokensFor(sv.id) : [] });
      if (faces) card.appendChild(faces);
      const details = el('div', 'rbx-public-game-server-details game-server-details');
      const max = Number(sv.maxPlayers) || 0;
      const playing = Number(sv.playing) || 0;
      details.appendChild(el('div', 'text-info rbx-game-status rbx-public-game-server-status text-overflow', lt('{playing} of {max} people max', { playing: formatNumber(playing), max: formatNumber(max) })));
      const meta = metaLine({ placeVersion: sv.placeVersion, startedAt: sv.startedAt }, latest);
      if (meta) details.appendChild(meta);
      const gauge = el('div', 'server-player-count-gauge border');
      const bar = el('div', 'gauge-inner-bar border');
      bar.style.width = `${max ? Math.round(playing / max * 100) : 0}%`;
      gauge.appendChild(bar);
      details.appendChild(gauge);
      const pills = el('div', 'routility-server-pills');
      if (Number.isFinite(sv.fps)) pills.appendChild(perfPill(sv.fps));
      if (Number.isFinite(sv.ping)) pills.appendChild(pingPill(sv.ping));
      details.appendChild(pills);
      details.appendChild(regionPill({ key: 'region', dc: g.dc }));
      const link = `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${sv.id}`;
      const actions = el('span', 'routility-region-actions');
      const join = el('a', 'btn-full-width btn-control-xs rbx-public-game-server-join game-server-join-btn btn-primary-md btn-min-width', lt('Join'));
      join.href = link;
      actions.append(join, shareButton(link));
      details.appendChild(actions);
      const parts = String(sv.id).split('-');
      details.appendChild(el('div', 'server-id-text text-info xsmall', lt('ID: {id}', { id: `${parts[1] || ''}-${parts[2] || ''}` })));
      card.appendChild(details);
      li.appendChild(card);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    box.appendChild(wrap);
    if (!st.done || st.loading) {
      const btn = el('button', 'btn-control-sm btn-full-width routility-region-more', st.loading ? lt('Loading…') : lt('Load More'));
      btn.type = 'button';
      btn.disabled = st.loading;
      btn.addEventListener('click', more);
      box.appendChild(btn);
    }
    if (st.error) box.appendChild(el('div', 'text-body-small content-muted', st.error));
    return box;
  }

  let pendingJoin = null;

  function agoText(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    const steps = [[60, 'second', 1], [3600, 'minute', 60], [86400, 'hour', 3600], [604800, 'day', 86400], [Infinity, 'week', 604800]];
    const [, unit, div] = steps.find(([lim]) => s < lim);
    try {
      return new Intl.RelativeTimeFormat(window.RoUtilityI18n.locale(), { numeric: 'auto' }).format(-Math.max(0, Math.floor(s / div)), unit);
    } catch {
      return '';
    }
  }

  function recentServers(p, placeId) {
    const st = { list: null, alive: new Map(), universe: '' };
    const load = () => {
      const universeId = document.querySelector('#game-detail-meta-data')?.dataset.universeId;
      if (!universeId) return setTimeout(() => { if (p === page) load(); }, 500);
      st.universe = universeId;
      window.RoUtilityUI.request({ type: 'recentServers', universeId }, r => Array.isArray(r)).then((list) => {
        if (p !== page) return;
        st.list = (list || []).slice(0, 6);
        p.tick();
      });
    };
    load();
    p.recent = () => {
      const anchor = document.querySelector('#rbx-friends-running-games') || document.querySelector('#rbx-public-running-games');
      let sec = document.querySelector('.routility-recent-servers');
      if (!anchor || !st.list || !st.list.length || settings.recentServers === false) {
        sec?.remove();
        return;
      }
      for (const s of st.list) if (p.hasServer && p.hasServer(s.id)) st.alive.set(s.id, 'open');
      const key = st.list.map(s => s.id + ':' + (st.alive.get(s.id) || '')).join('|');
      if (sec && sec.dataset.key === key && sec.nextElementSibling === anchor) return;
      if (!sec) sec = el('div', 'routility-injected stack server-list-section routility-recent-servers');
      sec.textContent = '';
      sec.dataset.key = key;
      const ch = el('div', 'container-header');
      const row = el('div', 'server-list-container-header');
      row.appendChild(el('h2', 'server-list-header', lt('Recent Servers')));
      row.appendChild(el('span', 'text-body-small content-muted routility-recent-note', lt('Servers you played in lately. Join one again while it’s still running.')));
      ch.appendChild(row);
      sec.appendChild(ch);
      const ul = el('ul', 'card-list rbx-public-game-server-item-container routility-recent-list');
      for (const s of st.list) {
        const state = st.alive.get(s.id) || 'maybe';
        const li = el('li', 'rbx-public-game-server-item routility-region-item routility-recent-item');
        li.dataset.serverId = s.id;
        li.__routilityServer = { id: s.id };
        li.__routilityJoin = {};
        const card = el('div', 'card-item card-item-public-server routility-recent-card');
        const details = el('div', 'rbx-public-game-server-details game-server-details routility-recent-details');
        const head = el('div', 'routility-recent-head');
        const when = agoText(s.last);
        head.appendChild(el('span', 'text-title-small content-emphasis text-overflow', when.charAt(0).toLocaleUpperCase() + when.slice(1)));
        const pill = el('span', 'routility-recent-pill routility-recent-' + state);
        pill.append(el('span', 'routility-recent-dot'), el('span', null, state === 'open' ? lt('Running') : lt('May have ended')));
        if (state !== 'open') pill.dataset.rtTip = lt('Servers close when everyone leaves. If it’s gone, Roblox tells you when you press Join.');
        head.appendChild(pill);
        details.appendChild(head);
        const mins = Math.max(1, Math.round((s.last - s.first) / 60000) + 1);
        details.appendChild(el('div', 'text-body-small content-muted routility-recent-sub', ltn(mins, 'You played here for about {n} minute', 'You played here for about {n} minutes', { n: formatNumber(mins) })));
        const link = `https://www.roblox.com/games/start?placeId=${s.root || placeId}&gameInstanceId=${s.id}`;
        const actions = el('span', 'routility-region-actions');
        const join = el('a', 'btn-full-width btn-control-xs rbx-public-game-server-join game-server-join-btn btn-primary-md btn-min-width routility-recent-join', lt('Join'));
        join.href = link;
        const forget = el('button', 'btn-control-xs routility-injected routility-server-share routility-recent-forget');
        forget.type = 'button';
        forget.setAttribute('aria-label', lt('Remove from Recent Servers'));
        forget.dataset.rtTip = lt('Remove from Recent Servers');
        forget.appendChild(el('span', 'icon icon-regular-x'));
        forget.addEventListener('click', () => {
          st.list = st.list.filter(x => x.id !== s.id);
          window.RoUtilityUI.request({ type: 'forgetServer', universeId: st.universe, gameId: s.id });
          p.tick();
        });
        actions.append(join, shareButton(link), forget);
        details.appendChild(actions);
        const parts = String(s.id).split('-');
        details.appendChild(el('div', 'server-id-text text-info xsmall', lt('ID: {id}', { id: `${parts[1] || ''}-${parts[2] || ''}` })));
        card.appendChild(details);
        li.appendChild(card);
        ul.appendChild(li);
      }
      sec.appendChild(ul);
      if (sec.nextElementSibling !== anchor) anchor.before(sec);
    };
  }

  function launchServer(placeId, server, extra) {
    pendingJoin = { at: Date.now(), server, ...(extra || {}) };
    window.postMessage({ type: 'routility-join', placeId: String(placeId), gameId: server.id }, location.origin);
  }

  let gameIconCache = null;

  function gameIcon(universeId) {
    if (!universeId) return Promise.resolve(null);
    if (gameIconCache && gameIconCache.id === universeId) return gameIconCache.promise;
    const promise = json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Webp&isCircular=false`)
      .then(d => (d && d.data && d.data[0] && d.data[0].imageUrl) || null);
    gameIconCache = { id: universeId, promise };
    return promise;
  }

  function miniMap(dc) {
    const NS = 'http://www.w3.org/2000/svg';
    const box = el('div', 'routility-launch-map');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
    svg.setAttribute('aria-hidden', 'true');
    const land = document.createElementNS(NS, 'g');
    land.setAttribute('class', 'routility-map-land');
    for (const [x, y] of mapDots()) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x + 0.5);
      c.setAttribute('cy', y + 0.5);
      c.setAttribute('r', 0.32);
      land.appendChild(c);
    }
    svg.appendChild(land);
    if (dc) {
      const [x, y] = project(dc.lat, dc.lon);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'routility-map-pin routility-map-pin-on');
      for (const cls of ['routility-map-ring', 'routility-map-dot']) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', cls);
        c.setAttribute('cx', x);
        c.setAttribute('cy', y);
        c.setAttribute('r', 1.6);
        g.appendChild(c);
      }
      svg.appendChild(g);
    }
    box.appendChild(svg);
    const where = el('div', 'routility-launch-where text-label-medium');
    if (dc) {
      const code = countryCode(dc.country);
      if (code) where.appendChild(flagIcon(code));
      where.appendChild(el('span', 'text-overflow', placeName(dc, true)));
    } else {
      where.appendChild(el('span', 'icon routility-calc-icon routility-pin-icon'));
      where.appendChild(el('span', null, lt('Region unknown')));
    }
    box.appendChild(where);
    return box;
  }

  const clientWatches = new WeakMap();

  function watchClient(dialog) {
    if (clientWatches.has(dialog)) return;
    const w = { misses: 0, tries: 0, done: false, started: Date.now(), baseline: myPresence() };
    clientWatches.set(dialog, w);
    const universe = String(document.querySelector('#game-detail-meta-data')?.dataset.universeId || '');
    const set = (state) => {
      if (dialog.dataset.routilityClient === state) return;
      dialog.dataset.routilityClient = state;
      dialog.dispatchEvent(new CustomEvent('routility-client'));
    };
    const finish = () => {
      if (w.done) return;
      w.done = true;
      window.removeEventListener('message', onLaunch);
      set('in-game');
      setTimeout(() => closeLaunch(dialog), 3500);
    };
    const onLaunch = (e) => {
      if (e.source === window && e.data && e.data.type === 'routility-launch-success' && dialog.isConnected && !w.done) set('open');
    };
    window.addEventListener('message', onLaunch);
    const joined = async () => {
      const [before, now] = await Promise.all([w.baseline, myPresence()]);
      if (!now || now.userPresenceType !== 2) return false;
      if (universe && String(now.universeId) === universe) return !before || before.userPresenceType !== 2 || String(before.universeId) !== universe || String(before.gameId) !== String(now.gameId) || Date.now() - w.started > 20000;
      return !!before && String(before.gameId || '') !== String(now.gameId || '');
    };
    const poll = async () => {
      if (!dialog.isConnected || w.done) {
        window.removeEventListener('message', onLaunch);
        return;
      }
      if (w.tries++ > 45) {
        w.done = true;
        window.removeEventListener('message', onLaunch);
        if (dialog.dataset.routilityClient !== 'missing') closeLaunch(dialog);
        return;
      }
      let state = '';
      try {
        const res = await fetch('https://apis.roblox.com/matchmaking-api/v1/client-status', { credentials: 'include', cache: 'no-store' });
        const d = res.ok ? await res.json() : null;
        state = d && typeof d.status === 'string' ? d.status : '';
      } catch {}
      if (!dialog.isConnected || w.done) return;
      if (/^ingame$/i.test(state) || (w.tries % 2 === 0 && await joined())) {
        finish();
        return;
      }
      if (state && !/^unknown$/i.test(state)) {
        w.misses = 0;
        set('open');
      } else if (state && ++w.misses >= 4 && dialog.dataset.routilityClient !== 'open') {
        set('missing');
      }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 1200);
  }

  function closeLaunch(dialog) {
    if (dialog.isConnected) dialog.querySelector('.foundation-web-close-affordance')?.click();
  }

  function launchStatus(dialog, source) {
    const state = dialog.dataset.routilityClient || '';
    if (state === 'in-game') return { text: lt('You’re in the game. Have fun!'), spin: false };
    if (state === 'open') return { text: lt('Roblox is open, joining the server…'), spin: true };
    const h2 = source && source.querySelector('h2');
    const roblox = h2 ? h2.textContent.replace(/\s+/g, ' ').trim() : '';
    if (state === 'missing' && roblox) return { text: roblox, spin: false };
    return { text: roblox && !/download/i.test(roblox) ? roblox : lt('Starting Roblox…'), spin: true };
  }

  function followLaunch(dialog, source, root, apply) {
    watchClient(dialog);
    let shown = false;
    const sync = () => {
      if (root.isConnected) shown = true;
      else if (shown) return stop();
      apply(launchStatus(dialog, source));
    };
    const watch = new MutationObserver(sync);
    if (source) watch.observe(source, { childList: true, subtree: true, characterData: true });
    dialog.addEventListener('routility-client', sync);
    function stop() {
      watch.disconnect();
      dialog.removeEventListener('routility-client', sync);
    }
    sync();
  }

  function launchPanel(j, dialog) {
    const sv = j.server || {};
    const root = el('div', 'routility-injected routility-launch');
    const head = el('div', 'routility-launch-head');
    const icon = el('span', 'thumbnail-2d-container routility-launch-icon');
    head.appendChild(icon);
    const text = el('div', 'routility-launch-text');
    const name = j.name || document.querySelector('.game-calls-to-action .game-name, h1.game-name')?.textContent.trim() || 'Roblox';
    text.appendChild(el('div', 'text-heading-small content-emphasis text-overflow', name));
    const status = el('div', 'text-body-small content-muted routility-launch-status');
    text.appendChild(status);
    head.appendChild(text);
    root.appendChild(head);
    const universeId = j.universeId || document.querySelector('#game-detail-meta-data')?.dataset.universeId;
    gameIcon(universeId).then(url => {
      if (!url || !icon.isConnected) return;
      const img = el('img');
      img.src = url;
      img.alt = '';
      icon.appendChild(img);
    });
    root.appendChild(miniMap(j.dc));
    const tiles = el('div', 'routility-launch-tiles');
    const tile = (label, value, extra) => {
      const t = el('div', 'routility-launch-tile');
      const v = el('div', 'text-title-medium content-emphasis routility-launch-value');
      if (extra) v.appendChild(extra);
      v.appendChild(document.createTextNode(value));
      t.appendChild(v);
      t.appendChild(el('div', 'text-label-small content-muted', label));
      tiles.appendChild(t);
    };
    if (sv.maxPlayers) tile(lt('Players'), `${formatNumber(sv.playing || 0)}/${formatNumber(sv.maxPlayers)}`);
    if (Number.isFinite(sv.ping)) tile(lt('Ping'), lt('{n} ms', { n: Math.round(sv.ping) }), el('span', `routility-server-dot routility-server-${sv.ping < 100 ? 'good' : sv.ping < 200 ? 'ok' : 'bad'}`));
    if (Number.isFinite(sv.fps)) tile(lt('Performance'), `${Math.max(0, Math.min(100, Math.round(sv.fps / 60 * 100)))}%`);
    const d = j.details || {};
    if (d.startedAt) tile(lt('Uptime'), uptimeText(d.startedAt));
    if (tiles.children.length) {
      tiles.style.gridTemplateColumns = `repeat(${tiles.children.length}, minmax(0, 1fr))`;
      root.appendChild(tiles);
    }
    const foot = el('div', 'routility-launch-foot text-label-small content-muted');
    const parts = String(sv.id || '').split('-');
    if (parts.length >= 3) foot.appendChild(el('span', null, lt('Server {id}', { id: `${parts[1]}-${parts[2]}` })));
    if (Number.isFinite(d.placeVersion)) {
      const v = el('span', 'routility-launch-version');
      v.appendChild(document.createTextNode(`v${d.placeVersion}`));
      if (Number.isFinite(j.latest)) {
        const isLatest = d.placeVersion >= j.latest;
        v.appendChild(el('span', 'routility-meta-tag ' + (isLatest ? 'routility-meta-latest' : 'routility-meta-old'), isLatest ? lt('Latest') : lt('Older')));
      }
      foot.appendChild(v);
    }
    root.appendChild(foot);
    const source = dialog.querySelector(':scope > .flex.flex-col.items-center, :scope > div.items-center');
    followLaunch(dialog, source, root, ({ text }) => {
      if (status.textContent !== text) status.textContent = text;
    });
    return root;
  }

  let hbaPair = null;

  function hbaKeys() {
    if (hbaPair) return hbaPair;
    hbaPair = (async () => {
      const meta = document.querySelector('meta[name="hardware-backed-authentication-data"]');
      const name = meta?.getAttribute('data-hba-indexed-db-name');
      const store = meta?.getAttribute('data-hba-indexed-db-obj-store-name');
      const key = meta?.getAttribute('data-hba-indexed-db-key-name');
      if (!name || !store || !key || !indexedDB.databases) return null;
      const found = (await indexedDB.databases()).find(d => d.name === name);
      if (!found) return null;
      return new Promise((resolve) => {
        const open = indexedDB.open(name, found.version);
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          try {
            const tx = open.result.transaction(store, 'readonly');
            const get = tx.objectStore(store).get(key);
            get.onsuccess = () => resolve(get.result && get.result.privateKey ? get.result : null);
            get.onerror = () => resolve(null);
            tx.oncomplete = () => open.result.close();
          } catch {
            resolve(null);
          }
        };
      });
    })().catch(() => null);
    hbaPair.then(pair => { if (!pair) hbaPair = null; });
    return hbaPair;
  }

  function base64(buf) {
    let s = '';
    for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
    return btoa(s);
  }

  async function boundToken(url, method, body) {
    const pair = await hbaKeys();
    if (!pair) return null;
    const algo = { name: 'ECDSA', hash: { name: 'SHA-256' } };
    const time = Math.floor(Date.now() / 1000).toString();
    const hash = base64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body || '')));
    const sign = async (text) => base64(await crypto.subtle.sign(algo, pair.privateKey, new TextEncoder().encode(text)));
    const [a, b] = await Promise.all([sign([hash, time, url, method].join('|')), sign(['', time, url, method].join('|'))]);
    return ['v1', hash, time, a, b].join('|');
  }

  const PEEK_URL = 'https://gamejoin.roblox.com/v1/join-game?_routility=1';
  let peekCsrf = '';
  let peekRun = null;

  async function askMatchmaker(placeId) {
    const body = JSON.stringify({ placeId: Number(placeId), gameJoinAttemptId: crypto.randomUUID() });
    const send = async () => {
      const headers = { 'Content-Type': 'application/json' };
      if (peekCsrf) headers['x-csrf-token'] = peekCsrf;
      const token = await boundToken(PEEK_URL, 'POST', body).catch(() => null);
      if (token) headers['x-bound-auth-token'] = token;
      return fetch(PEEK_URL, { method: 'POST', credentials: 'include', headers, body });
    };
    try {
      let res = await send();
      if (res.status === 403 && res.headers.get('x-csrf-token')) {
        peekCsrf = res.headers.get('x-csrf-token');
        res = await send();
      }
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async function peekJoin(dialog) {
    const placeId = (location.pathname.match(/^\/games\/(\d+)/) || [])[1];
    if (!placeId || settings.serverRegions === false) return;
    const run = {};
    peekRun = run;
    const live = () => peekRun === run && dialog.isConnected;
    const plain = dialog.querySelector('.routility-launch-plain');
    const note = el('div', 'text-body-small content-muted routility-launch-note', lt('Finding which server Roblox is putting you in…'));
    plain?.appendChild(note);
    let js = null;
    for (let i = 0; i < 5 && !js; i++) {
      if (i) await new Promise(r => setTimeout(r, 2000));
      if (!live()) return;
      const d = await askMatchmaker(placeId);
      if (d && d.joinScript && d.joinScript.GameId) js = d.joinScript;
      else if (d && d.status === 12) break;
    }
    if (!live()) return;
    if (!js) {
      note.remove();
      return;
    }
    if (joinWatch) {
      clearTimeout(joinWatch.timer);
      joinWatch = null;
    }
    const id = String(js.GameId);
    const [reg, dcs] = await Promise.all([
      window.RoUtilityUI.request({ type: 'serverRegions', placeId, ids: [id] }, r => r !== undefined),
      window.RoUtilityUI.request({ type: 'getDatacenters' }, r => r && Array.isArray(r.list)),
    ]);
    if (!live()) return;
    const list = (dcs && dcs.list) || [];
    const dcId = reg && reg.regions && Number.isFinite(reg.regions[id]) ? reg.regions[id] : Number(js.DataCenterId);
    const dc = list.find(x => x.id === dcId) || null;
    const details = { ...((reg && reg.details && reg.details[id]) || {}) };
    if (!Number.isFinite(details.placeVersion) && Number.isFinite(js.PlaceVersion)) details.placeVersion = js.PlaceVersion;
    const local = page && page.findServer ? page.findServer(id) : null;
    const j = { server: { ...(local || {}), id }, dc, details, latest: page && page.latestVersion };
    const now = dialog.querySelector('.routility-launch-plain');
    if (!now) return;
    let panel = launchPanel(j, dialog);
    now.replaceWith(panel);
    if ((local && local.maxPlayers) || !dc) return;
    const ids = list.filter(x => placeName(x) === placeName(dc)).map(x => x.id).slice(0, 20);
    let cursor = '';
    for (let i = 0; i < 3; i++) {
      const res = await window.RoUtilityUI.request({ type: 'serverRegionList', placeId, ids, cursor }, r => r !== undefined);
      if (!live() || !panel.isConnected) return;
      const hit = res && Array.isArray(res.servers) ? res.servers.find(x => x.id === id) : null;
      if (hit) {
        const next = launchPanel({ ...j, server: { ...hit, id } }, dialog);
        panel.replaceWith(next);
        panel = next;
        return;
      }
      if (!res || !res.nextCursor) return;
      cursor = res.nextCursor;
    }
  }

  let joinWatch = null;

  async function myPresence(me) {
    const id = String(me || document.querySelector('meta[name="user-data"]')?.dataset.userid || '');
    return id ? (await window.RoUtilityUI.presence([id], true)).get(id) || null : null;
  }

  async function followJoin(dialog, target) {
    if (settings.serverRegions === false) return;
    const run = {};
    peekRun = run;
    const live = () => peekRun === run && dialog.isConnected;
    const pr = await myPresence(target);
    if (!live() || !pr || pr.userPresenceType !== 2 || !pr.gameId || !pr.placeId) return;
    if (joinWatch) {
      clearTimeout(joinWatch.timer);
      joinWatch = null;
    }
    const placeId = String(pr.placeId);
    const id = String(pr.gameId);
    const friendServer = async () => {
      try {
        const res = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Friend?limit=100`, { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        return ((data && data.data) || []).find(x => x && x.id === id) || null;
      } catch {
        return null;
      }
    };
    const [reg, dcs, seen] = await Promise.all([
      window.RoUtilityUI.request({ type: 'serverRegions', placeId, ids: [id] }, r => r !== undefined),
      window.RoUtilityUI.request({ type: 'getDatacenters' }, r => r && Array.isArray(r.list)),
      friendServer(),
    ]);
    if (!live()) return;
    const list = (dcs && dcs.list) || [];
    const dcId = reg && reg.regions ? reg.regions[id] : null;
    const dc = Number.isFinite(dcId) ? list.find(x => x.id === dcId) || null : null;
    const details = { ...((reg && reg.details && reg.details[id]) || {}) };
    const j = { server: seen ? { ...seen, id } : { id }, dc, details, name: pr.lastLocation || '', universeId: pr.universeId ? String(pr.universeId) : '' };
    const now = dialog.querySelector('.routility-launch-plain');
    if (!now) return;
    let panel = launchPanel(j, dialog);
    now.replaceWith(panel);
    if (!dc || seen) return;
    const ids = list.filter(x => placeName(x) === placeName(dc)).map(x => x.id).slice(0, 20);
    let cursor = '';
    for (let i = 0; i < 3; i++) {
      const res = await window.RoUtilityUI.request({ type: 'serverRegionList', placeId, ids, cursor }, r => r !== undefined);
      if (!live() || !panel.isConnected) return;
      const hit = res && Array.isArray(res.servers) ? res.servers.find(x => x.id === id) : null;
      if (hit) {
        const next = launchPanel({ ...j, server: { ...hit, id } }, dialog);
        panel.replaceWith(next);
        panel = next;
        return;
      }
      if (!res || !res.nextCursor) return;
      cursor = res.nextCursor;
    }
  }

  function joinedCard(j) {
    document.querySelector('.routility-joined-card')?.remove();
    const card = el('div', 'routility-injected routility-joined-card bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    const close = el('button', 'routility-joined-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-close'));
    close.addEventListener('click', () => card.remove());
    card.appendChild(close);
    const head = el('div', 'routility-joined-head');
    if (j.dc) {
      const code = countryCode(j.dc.country);
      if (code) head.appendChild(flagIcon(code));
    }
    const text = el('div', 'routility-joined-text');
    text.appendChild(el('div', 'text-label-small content-muted', lt('You’re in')));
    text.appendChild(el('div', 'text-title-small content-emphasis text-overflow', j.dc ? placeName(j.dc, true) : lt('a server we couldn’t place yet')));
    head.appendChild(text);
    card.appendChild(head);
    const d = j.details || {};
    const bits = el('div', 'routility-server-pills routility-joined-stats');
    const up = d.startedAt ? uptimeText(d.startedAt) : '';
    if (up) {
      const it = pill();
      it.append(el('span', 'icon routility-calc-icon routility-clock-icon'), document.createTextNode(lt('Up {time}', { time: up })));
      bits.appendChild(it);
    }
    if (Number.isFinite(d.placeVersion)) {
      const it = pill();
      it.appendChild(document.createTextNode(`v${d.placeVersion}`));
      if (Number.isFinite(j.latest)) it.appendChild(el('span', 'routility-meta-tag ' + (d.placeVersion >= j.latest ? 'routility-meta-latest' : 'routility-meta-old'), d.placeVersion >= j.latest ? lt('Latest') : lt('Older')));
      bits.appendChild(it);
    }
    const parts = String((j.server && j.server.id) || '').split('-');
    if (parts.length >= 3) bits.appendChild(pill()).textContent = lt('Server {id}', { id: `${parts[1]}-${parts[2]}` });
    if (bits.childNodes.length) card.appendChild(bits);
    document.body.appendChild(card);
    setTimeout(() => card.remove(), 15000);
  }

  function watchJoinedServer(dialog) {
    if (joinWatch) clearTimeout(joinWatch.timer);
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    const placeId = (location.pathname.match(/^\/games\/(\d+)/) || [])[1];
    if (!me || !placeId || settings.serverRegions === false) return;
    const watch = { timer: null, tries: 0 };
    joinWatch = watch;
    const tick = async () => {
      if (joinWatch !== watch || watch.tries++ > 25) return;
      const pr = await myPresence(me);
      if (joinWatch !== watch) return;
      const inGame = pr && pr.userPresenceType === 2 && pr.gameId && (String(pr.placeId) === placeId || String(pr.rootPlaceId) === placeId);
      if (!inGame) {
        if (pr && pr.userPresenceType === 3 && watch.tries > 4 && !watch.studioNote) {
          watch.studioNote = true;
          const status = dialog && dialog.isConnected && dialog.querySelector('.routility-launch-plain .routility-launch-status');
          const note = el('div', 'text-body-small content-muted routility-launch-note', lt('Roblox Studio is open, so Roblox shows you as “in Studio” and we can’t see which server you joined. Close Studio to see it next time.'));
          if (status) status.after(note);
        }
        watch.timer = setTimeout(tick, 3000);
        return;
      }
      joinWatch = null;
      const [reg, dcs] = await Promise.all([
        window.RoUtilityUI.request({ type: 'serverRegions', placeId, ids: [pr.gameId] }, r => r !== undefined),
        window.RoUtilityUI.request({ type: 'getDatacenters' }, r => r && Array.isArray(r.list)),
      ]);
      const dcId = reg && reg.regions ? reg.regions[pr.gameId] : null;
      const dc = Number.isFinite(dcId) ? ((dcs && dcs.list) || []).find(x => x.id === dcId) : null;
      const j = { server: { id: pr.gameId }, dc, details: reg && reg.details ? reg.details[pr.gameId] : null, latest: page && page.latestVersion };
      const plain = dialog && dialog.isConnected && dialog.querySelector('.routility-launch-plain');
      if (plain) plain.replaceWith(launchPanel(j, dialog));
      else joinedCard(j);
    };
    watch.timer = setTimeout(tick, 4000);
  }

  function plainLaunch(dialog, top) {
    const root = el('div', 'routility-injected routility-launch routility-launch-plain');
    const mark = el('div', 'routility-roblox-mark routility-spin');
    mark.setAttribute('aria-hidden', 'true');
    root.appendChild(mark);
    const name = document.querySelector('.game-calls-to-action .game-name, h1.game-name')?.textContent.trim();
    if (name) root.appendChild(el('div', 'text-heading-small content-emphasis text-overflow routility-launch-plain-name', name));
    const status = el('div', 'text-body-medium content-muted routility-launch-status');
    root.appendChild(status);
    followLaunch(dialog, top, root, ({ text, spin }) => {
      if (status.textContent !== text) status.textContent = text;
      mark.classList.toggle('routility-spin', spin);
    });
    return root;
  }

  function watchLaunchDialog() {
    if (watchLaunchDialog.on) return;
    watchLaunchDialog.on = true;
    const check = () => {
      if (settings.launchDetails === false) return;
      if (pendingJoin && Date.now() - pendingJoin.at > 20000) pendingJoin = null;
      if (!pendingJoin) {
        const plainDialog = document.querySelector('.download-dialog');
        if (!plainDialog || plainDialog.dataset.routilitySpinning || plainDialog.querySelector('.routility-launch')) return;
        const plainTop = plainDialog.querySelector(':scope > .flex.flex-col.items-center, :scope > div.items-center');
        if (!plainTop) return;
        plainDialog.dataset.routilityLauncher = '1';
        plainTop.after(plainLaunch(plainDialog, plainTop));
        const target = (location.pathname.match(/^\/users\/(\d+)\/profile/i) || [])[1];
        if (target) {
          followJoin(plainDialog, target);
          return;
        }
        watchJoinedServer(plainDialog);
        peekJoin(plainDialog);
        return;
      }
      const dialog = document.querySelector('.download-dialog');
      if (!dialog || dialog.querySelector('.routility-launch') || dialog.dataset.routilitySpinning) return;
      const top = dialog.querySelector(':scope > .flex.flex-col.items-center, :scope > div.items-center');
      if (!top) return;
      const join = pendingJoin;
      dialog.dataset.routilitySpinning = '1';
      const icon = top.querySelector('.app-icon-bluebg');
      const mark = el('div', 'routility-injected routility-roblox-mark routility-spin');
      mark.setAttribute('aria-hidden', 'true');
      if (icon) icon.after(mark);
      else top.prepend(mark);
      setTimeout(() => {
        if (!dialog.isConnected) return;
        mark.remove();
        dialog.dataset.routilityLauncher = '1';
        top.after(launchPanel(join, dialog));
      }, 1200);
    };
    new MutationObserver(window.RoUtilityUI.onFrame(check)).observe(document.body, { childList: true, subtree: true });
  }

  function playToast(text) {
    document.querySelector('.routility-play-toast')?.remove();
    const box = el('div', 'routility-injected routility-toast routility-play-toast flex items-center gap-large bg-system-contrast content-inverse-emphasis radius-medium padding-x-large padding-y-medium shadow-transient-high text-body-medium');
    box.setAttribute('role', 'status');
    box.textContent = text;
    document.body.appendChild(box);
    clearTimeout(playToast.timer);
    playToast.timer = setTimeout(() => box.remove(), 4000);
  }

  const SPINNER_PATH = 'M10 2.75C8.56609 2.75 7.16438 3.1752 5.97212 3.97185C4.77986 4.76849 3.85061 5.90078 3.30188 7.22554C2.75314 8.55031 2.60957 10.008 2.88931 11.4144C3.16905 12.8208 3.85955 14.1126 4.87348 15.1265C5.88741 16.1405 7.17924 16.831 8.5856 17.1107C9.99196 17.3904 11.4497 17.2469 12.7745 16.6981C14.0992 16.1494 15.2315 15.2201 16.0282 14.0279C16.8248 12.8356 17.25 11.4339 17.25 10C17.25 9.58579 17.5858 9.25 18 9.25C18.4142 9.25 18.75 9.58579 18.75 10C18.75 11.7306 18.2368 13.4223 17.2754 14.8612C16.3139 16.3002 14.9473 17.4217 13.3485 18.0839C11.7496 18.7462 9.9903 18.9195 8.29296 18.5819C6.59563 18.2443 5.03653 17.4109 3.81282 16.1872C2.58911 14.9635 1.75575 13.4044 1.41813 11.707C1.08051 10.0097 1.25379 8.25037 1.91606 6.65152C2.57832 5.05267 3.69983 3.6861 5.13876 2.72464C6.57769 1.76318 8.26942 1.25 10 1.25C10.4142 1.25 10.75 1.58579 10.75 2C10.75 2.41421 10.4142 2.75 10 2.75Z';
  const LAYER_CLS = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

  function launchModal(onCancel) {
    document.querySelector('.routility-launch-modal')?.remove();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-launch-modal');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-launch-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.dataset.size = 'Medium';
    const closeBox = el('div', 'absolute foundation-web-dialog-close-container');
    const close = el('button', 'foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus bg-over-media-100 padding-small radius-circle');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    const cl = el('div', LAYER_CLS);
    cl.setAttribute('aria-hidden', 'true');
    close.append(cl, el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]'));
    closeBox.appendChild(close);
    dialog.appendChild(closeBox);
    const top = el('div', 'padding-x-xlarge padding-top-xlarge padding-bottom-xlarge flex flex-col items-center gap-xlarge');
    const logo = el('div', 'routility-roblox-mark routility-spin');
    logo.setAttribute('role', 'img');
    logo.setAttribute('aria-label', 'Roblox');
    const title = el('h2', 'text-heading-small padding-x-xxlarge padding-y-none text-align-x-center routility-launch-title');
    top.append(logo, title);
    dialog.appendChild(top);
    const actions = el('div', 'padding-x-xlarge padding-bottom-xlarge flex flex-col gap-small');
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    let open = true;
    const shut = (cancelled) => {
      if (!open) return;
      open = false;
      overlay.remove();
      document.removeEventListener('keydown', esc, true);
      if (cancelled && onCancel) onCancel();
    };
    const esc = (e) => { if (e.key === 'Escape') shut(true); };
    close.addEventListener('click', () => shut(true));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(true); });
    document.addEventListener('keydown', esc, true);
    const button = (label, emphasis, onClick) => {
      const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium grow ' + (emphasis ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
      b.type = 'button';
      const l = el('div', LAYER_CLS);
      l.setAttribute('aria-hidden', 'true');
      b.appendChild(l);
      if (label === null) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'foundation-web-loading-spinner');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 20 20');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('clip-rule', 'evenodd');
        path.setAttribute('fill', 'currentColor');
        path.setAttribute('d', SPINNER_PATH);
        svg.appendChild(path);
        b.appendChild(svg);
        b.disabled = true;
      } else {
        const inner = el('span', 'flex items-center min-width-0 gap-small');
        inner.appendChild(el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label));
        b.appendChild(inner);
        b.addEventListener('click', () => onClick && onClick());
      }
      return b;
    };
    const api = {
      get open() { return open; },
      status(text) { if (title.textContent !== text) title.textContent = text; },
      loading() {
        logo.classList.add('routility-spin');
        actions.textContent = '';
        actions.appendChild(button(null, true));
      },
      choices(list) {
        logo.classList.remove('routility-spin');
        actions.textContent = '';
        for (const c of list) actions.appendChild(button(c.label, c.emphasis, c.onClick));
      },
      close: () => shut(false),
    };
    api.loading();
    document.body.appendChild(overlay);
    return api;
  }

  function toastModal() {
    let last = '';
    return {
      open: true,
      status(text) {
        if (text === last) return;
        last = text;
        playToast(text);
      },
      loading() {},
      choices(list) {
        const first = list.find(c => c.emphasis) || list[0];
        if (first) setTimeout(first.onClick, 600);
      },
      close() { document.querySelector('.routility-play-toast')?.remove(); },
    };
  }

  function niceName(name) {
    const text = String(name || '');
    if (text.length <= 28) return text;
    const parts = text.split(',').map(x => x.trim()).filter(Boolean);
    return parts[parts.length - 1] || text;
  }

  function guessHome() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    const lon = Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 60 * 15));
    const city = tz.split('/').pop() || '';
    const known = {
      Sao_Paulo: [-23.5, -46.6], Buenos_Aires: [-34.6, -58.4], Santiago: [-33.4, -70.6], Bogota: [4.7, -74.1], Lima: [-12, -77], Mexico_City: [19.4, -99.1],
      London: [51.5, -0.1], Dublin: [53.3, -6.3], Paris: [48.9, 2.4], Berlin: [52.5, 13.4], Madrid: [40.4, -3.7], Amsterdam: [52.4, 4.9], Moscow: [55.8, 37.6], Istanbul: [41, 29],
      Dubai: [25.2, 55.3], Kolkata: [22.6, 88.4], Calcutta: [22.6, 88.4], Singapore: [1.35, 103.8], Hong_Kong: [22.3, 114.2], Shanghai: [31.2, 121.5], Tokyo: [35.7, 139.7], Seoul: [37.6, 127],
      Manila: [14.6, 121], Jakarta: [-6.2, 106.8], Bangkok: [13.8, 100.5], Sydney: [-33.9, 151.2], Melbourne: [-37.8, 145], Brisbane: [-27.5, 153], Perth: [-31.9, 115.9], Auckland: [-36.8, 174.8],
      New_York: [40.7, -74], Chicago: [41.9, -87.6], Denver: [39.7, -105], Los_Angeles: [34, -118.2], Phoenix: [33.4, -112], Toronto: [43.7, -79.4], Vancouver: [49.3, -123.1],
    };
    if (known[city]) return { lat: known[city][0], lon: known[city][1] };
    const area = tz.split('/')[0];
    const lat = { America: 38, Europe: 50, Asia: 25, Australia: -30, Pacific: -20, Africa: 5, Atlantic: 30, Indian: -10 }[area];
    return { lat: Number.isFinite(lat) ? lat : 30, lon };
  }

  function distanceKm(a, b) {
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  function preferredPlay(p, placeId) {
    let busy = false;
    const wanted = () => settings.serverRegions !== false && settings.serverStats !== false && typeof settings.preferredRegion === 'string' && settings.preferredRegion;
    const avoiding = () => settings.serverStats !== false && settings.avoidFriends === true;
    const saveAvoid = (value) => {
      chrome.storage.local.get('routilitySettings', (st) => {
        const next = { ...(st.routilitySettings || {}), avoidFriends: value };
        settings = next;
        chrome.storage.local.set({ routilitySettings: next }, () => label());
      });
    };
    const shortName = (n) => String(n || '').replace(/, United States$/, ', USA').replace(/, United Kingdom$/, ', UK').replace(/, United Arab Emirates$/, ', UAE');
    const regionGroups = () => {
      const dcs = [...(p.centers ? p.centers.values() : [])];
      const groups = new Map();
      for (const r of (p.regionCounts && p.regionCounts.regions) || []) {
        const dc = dcs.find(d => d.id === r.datacenterId);
        if (!dc || !r.servers) continue;
        const name = placeName(dc);
        const g = groups.get(name) || { name, dc, servers: 0 };
        g.servers += r.servers;
        groups.set(name, g);
      }
      return groups;
    };
    const saveRegion = (value) => {
      chrome.storage.local.get('routilitySettings', (st) => {
        const next = { ...(st.routilitySettings || {}), preferredRegion: value };
        settings = next;
        chrome.storage.local.set({ routilitySettings: next }, () => label());
      });
    };
    let closeMenu = null;
    const openMenu = (anchor) => {
      if (closeMenu) return closeMenu();
      const menu = el('div', 'routility-injected routility-region-menu bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
      menu.setAttribute('role', 'menu');
      const groups = [...regionGroups().values()].sort((a, b) => b.servers - a.servers);
      const current = wanted();
      let shut = () => {};
      const item = (iconNode, text, sub, value) => {
        const b = el('button', 'routility-region-item relative clip group/interactable' + (value === current ? ' routility-region-on' : ''));
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)]');
        layer.setAttribute('aria-hidden', 'true');
        b.append(layer, iconNode, el('span', 'routility-region-name text-body-medium content-emphasis text-overflow', text));
        if (sub) b.appendChild(el('span', 'text-body-small content-muted', sub));
        b.addEventListener('click', () => { shut(); saveRegion(value); });
        menu.appendChild(b);
      };
      item(el('span', 'icon routility-calc-icon routility-pin-icon'), lt('Closest to me'), '', 'auto');
      for (const g of groups) {
        const code = countryCode(g.dc.country);
        item(code ? flagIcon(code) : el('span', 'icon routility-calc-icon routility-pin-icon'), shortName(g.name), ltn(g.servers, '{n} server', '{n} servers', { n: formatNumber(g.servers) }), g.name);
      }
      if (!groups.length) menu.appendChild(el('div', 'text-body-small content-muted routility-region-empty', lt('Server regions for this game are still being scanned.')));
      const avoid = el('button', 'routility-region-item routility-region-avoid relative clip group/interactable' + (avoiding() ? ' routility-region-on' : ''));
      avoid.type = 'button';
      avoid.setAttribute('role', 'menuitemcheckbox');
      avoid.setAttribute('aria-checked', String(avoiding()));
      const avoidLayer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)]');
      avoidLayer.setAttribute('aria-hidden', 'true');
      avoid.append(avoidLayer, el('span', 'icon routility-calc-icon routility-avoid-icon'), el('span', 'routility-region-name text-body-medium content-emphasis text-overflow', lt('Avoid Friends’ Servers')), el('span', 'text-body-small content-muted', avoiding() ? lt('On') : lt('Off')));
      avoid.addEventListener('click', () => { shut(); saveAvoid(!avoiding()); });
      menu.prepend(avoid, el('div', 'routility-region-divider'));
      if (current) {
        const off = el('button', 'routility-region-item routility-region-off relative clip group/interactable');
        off.type = 'button';
        off.append(el('span', 'text-body-medium content-default', lt('Turn off region (Roblox picks)')));
        off.addEventListener('click', () => { shut(); saveRegion(''); });
        menu.appendChild(off);
      }
      document.body.appendChild(menu);
      window.RoUtilityUI.keyNav(menu, '.routility-region-item', true);
      const place = () => {
        const r = anchor.getBoundingClientRect();
        const w = menu.offsetWidth;
        menu.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left + r.width / 2 - w / 2))) + 'px';
        menu.style.top = Math.round(r.bottom + 6) + 'px';
      };
      place();
      const outside = (e) => { if (!e.target.closest?.('.routility-region-menu, .routility-play-region')) shut(); };
      const esc = (e) => { if (e.key === 'Escape') shut(); };
      let untrack = null;
      shut = () => {
        menu.remove();
        if (untrack) untrack();
        document.removeEventListener('mousedown', outside, true);
        document.removeEventListener('keydown', esc, true);
        closeMenu = null;
      };
      untrack = window.RoUtilityUI.trackPopover(menu, anchor, place, () => shut());
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc, true);
      closeMenu = shut;
    };
    const label = () => {
      const btn = document.querySelector('[data-testid="play-button"]');
      const host = btn?.parentElement;
      let tag = document.querySelector('.routility-play-region');
      const want = wanted();
      const avoid = avoiding();
      const signedIn = !!document.querySelector('meta[name="user-data"]')?.dataset.userid;
      if (settings.playRegionTag === false || !signedIn || (!want && !avoid && (settings.serverRegions === false || settings.serverStats === false)) || !host) {
        tag?.remove();
        return;
      }
      const groups = regionGroups();
      const g = !want || want === 'auto' ? null : groups.get(want);
      const key = [want, avoid ? 1 : 0, p.centers && p.centers.size ? 1 : 0, g ? g.servers : -1].join('|');
      if (tag && tag.dataset.key === key && tag.isConnected) return;
      tag?.remove();
      tag = el('button', 'routility-injected routility-play-region relative clip group/interactable flex items-center radius-circle stroke-none bg-shift-300 content-action-utility text-label-small');
      tag.type = 'button';
      tag.dataset.key = key;
      const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
      layer.setAttribute('aria-hidden', 'true');
      tag.appendChild(layer);
      const dcs = [...(p.centers ? p.centers.values() : [])];
      const match = !want || want === 'auto' ? null : dcs.find(dc => placeName(dc) === want);
      const code = match ? countryCode(match.country) : '';
      if (!want && !avoid) {
        tag.appendChild(el('span', 'icon routility-calc-icon routility-pin-icon'));
        tag.appendChild(el('span', 'routility-play-region-name', lt('Roblox picks')));
      } else if (want) {
        tag.appendChild(code ? flagIcon(code) : el('span', 'icon routility-calc-icon routility-pin-icon'));
        tag.appendChild(el('span', 'routility-play-region-name', want === 'auto' ? lt('Closest region') : shortName(want)));
        if (g && !avoid) tag.appendChild(el('span', 'routility-play-region-count', ltn(g.servers, '{n} server', '{n} servers', { n: formatNumber(g.servers) })));
        if (avoid) tag.appendChild(el('span', 'routility-play-region-count', lt('No friends')));
      } else {
        tag.appendChild(el('span', 'icon routility-calc-icon routility-avoid-icon'));
        tag.appendChild(el('span', 'routility-play-region-name', lt('Avoid friends')));
      }
      const caret = el('span', 'icon routility-calc-icon routility-calc-icon-chevron routility-play-region-caret');
      caret.setAttribute('aria-hidden', 'true');
      tag.appendChild(caret);
      tag.setAttribute('aria-label', lt('Server region for Play'));
      tag.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openMenu(tag); });
      host.after(tag);
    };
    p.playLabel = label;
    const onClick = async (e) => {
      const btn = e.target.closest?.('[data-testid="play-button"]');
      if (!btn || btn.dataset.routilityBypass === '1' || (!wanted() && !avoiding()) || p !== page) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (busy) return;
      busy = true;
      let want = wanted();
      const auto = want === 'auto';
      let wantLabel = auto ? lt('your region') : niceName(want);
      let cancelled = false;
      const modal = settings.launchDetails === false ? toastModal() : launchModal(() => { cancelled = true; busy = false; });
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const normal = () => {
        modal.close();
        btn.dataset.routilityBypass = '1';
        btn.click();
        setTimeout(() => { delete btn.dataset.routilityBypass; }, 0);
      };
      const anyChoice = { label: lt('Join any server'), emphasis: false, onClick: normal };
      const joinAny = (text) => {
        modal.status(text);
        modal.loading();
        setTimeout(() => { if (!cancelled) normal(); }, 1100);
      };
      const go = (pick, dc) => {
        modal.status(lt('Starting Roblox…'));
        setTimeout(() => {
          modal.close();
          launchServer(placeId, pick, { dc, details: { placeVersion: pick.placeVersion, startedAt: pick.startedAt }, latest: p.latestVersion });
        }, 350);
      };
      const free = (sv) => (Number(sv.maxPlayers) || 0) - (Number(sv.playing) || 0);
      if (p.maxPlayers == null) {
        const uni = document.querySelector('#game-detail-meta-data')?.dataset.universeId;
        const g = uni ? (await json(`https://games.roblox.com/v1/games?universeIds=${uni}`))?.data?.[0] : null;
        p.maxPlayers = g ? Number(g.maxPlayers) || 0 : 0;
        if (cancelled) return;
      }
      if (p.maxPlayers === 1) {
        busy = false;
        return joinAny(lt('This game has 1-player servers. Starting a new one…'));
      }
      const friendServers = new Set();
      if (avoiding()) {
        modal.status(lt('Checking where your friends are…'));
        const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
        const online = me ? await json(`https://friends.roblox.com/v1/users/${me}/friends/online`) : null;
        for (const f of (online && online.data) || []) {
          const pr = f.userPresence || {};
          if (pr.gameInstanceId && (String(pr.placeId) === String(placeId) || String(pr.rootPlaceId) === String(placeId))) friendServers.add(String(pr.gameInstanceId));
        }
        if (cancelled) return;
      }
      const bestOpen = (list) => list
        .filter(sv => sv.maxPlayers > 0 && free(sv) >= 1 && !friendServers.has(String(sv.id)))
        .sort((a, b) => (free(a) >= 2 ? 0 : 1) - (free(b) >= 2 ? 0 : 1) || (Number.isFinite(a.ping) ? a.ping : 999) - (Number.isFinite(b.ping) ? b.ping : 999) || b.playing - a.playing)[0];
      let live = null;
      const liveServers = async () => {
        if (live) return live;
        live = new Map();
        let cursor = '';
        for (let i = 0; i < 5 && !cancelled; i++) {
          const d = await json(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&excludeFullGames=true&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
          for (const sv of (d && d.data) || []) if (sv && typeof sv.id === 'string') live.set(sv.id, sv);
          cursor = d && d.nextPageCursor;
          if (!cursor) break;
        }
        return live;
      };
      const openNow = async (list) => {
        if (!list || !list.length) return [];
        const now = await liveServers();
        return list.filter(sv => now.has(sv.id)).map(sv => {
          const l = now.get(sv.id);
          return { ...sv, playing: Number(l.playing) || 0, maxPlayers: Number(l.maxPlayers) || sv.maxPlayers, ping: Number.isFinite(l.ping) ? l.ping : sv.ping };
        });
      };
      let quickPool = null;
      const quickList = async (ids, label) => {
        if (!quickPool) {
          modal.status(lt('Checking open servers for {region}…', { region: label }));
          const d = await json(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&excludeFullGames=true&limit=100`);
          const servers = ((d && d.data) || []).filter(sv => sv && typeof sv.id === 'string');
          quickPool = { servers, dc: new Map() };
          for (let i = 0; i < servers.length && !cancelled; i += 30) {
            const chunk = servers.slice(i, i + 30);
            const r = await window.RoUtilityUI.request({ type: 'serverRegions', placeId, ids: chunk.map(x => x.id) }, x => x !== undefined);
            for (const sv of chunk) {
              const dcId = r && r.regions ? r.regions[sv.id] : null;
              if (Number.isFinite(dcId)) quickPool.dc.set(sv.id, dcId);
              const det = r && r.details && r.details[sv.id];
              if (det) Object.assign(sv, det);
            }
            modal.status(lt('Checked {done} of {total} servers…', { done: formatNumber(Math.min(i + 30, servers.length)), total: formatNumber(servers.length) }));
            if (servers.some(sv => ids.includes(quickPool.dc.get(sv.id)) && sv.maxPlayers - sv.playing >= 1)) break;
          }
        }
        return quickPool.servers.filter(sv => ids.includes(quickPool.dc.get(sv.id))).map(sv => ({ ...sv, datacenterId: quickPool.dc.get(sv.id) }));
      };
      const regionList = async (ids, label) => {
        if (cancelled) return null;
        const res = await window.RoUtilityUI.request({ type: 'serverRegionList', placeId, ids, cursor: '' }, r => r !== undefined);
        if (cancelled) return null;
        if (res && Array.isArray(res.servers)) return res.servers;
        if (!res || !res.scanning) return null;
        return quickList(ids, label);
      };
      try {
        if (!want) {
          modal.status(friendServers.size ? ltn(friendServers.size, 'Finding a server without your friend…', 'Finding a server without your friends…') : lt('Finding an open server…'));
          const pick = bestOpen([...(await liveServers()).values()]);
          if (cancelled) return;
          if (pick) return go(pick, null);
          modal.status(lt('Every open server has a friend in it'));
          return modal.choices([anyChoice]);
        }
        modal.status(lt('Finding a server in {region}…', { region: wantLabel }));
        const dcs = await window.RoUtilityUI.request({ type: 'getDatacenters' }, r => r && Array.isArray(r.list));
        if (cancelled) return;
        const all = (dcs && dcs.list) || [];
        let home = all.find(dc => placeName(dc) === want);
        if (auto) {
          home = guessHome();
          const places = new Map();
          for (const dc of all) if (!places.has(placeName(dc))) places.set(placeName(dc), dc);
          const nearest = [...places.entries()].sort((x, y) => distanceKm(home, x[1]) - distanceKm(home, y[1]))[0];
          if (nearest) {
            want = nearest[0];
            wantLabel = niceName(want);
          }
          modal.status(lt('Finding the closest server to you ({region})…', { region: wantLabel }));
        }
        const ids = all.filter(dc => placeName(dc) === want).map(dc => dc.id);
        if (!ids.length) {
          return joinAny(lt('{region} isn’t in the region list anymore. Joining any server…', { region: wantLabel }));
        }
        const list = await regionList(ids, wantLabel);
        if (cancelled) return;
        if (!list) return joinAny(lt('Couldn’t check this game’s regions. Joining any server…'));
        modal.status(list.length ? ltn(list.length, 'Checking {n} server in {region}…', 'Checking {n} servers in {region}…', { n: formatNumber(list.length), region: wantLabel }) : lt('No servers running in {region}…', { region: wantLabel }));
        await wait(450);
        if (cancelled) return;
        modal.status(lt('Checking which {region} servers have room right now…', { region: wantLabel }));
        let pick = bestOpen(await openNow(list));
        if (!pick && !cancelled) pick = bestOpen(await openNow(await quickList(ids, wantLabel)));
        if (cancelled) return;
        if (pick) {
          modal.status(lt('Picking the best one…'));
          await wait(350);
          if (cancelled) return;
          return go(pick, all.find(dc => dc.id === pick.datacenterId) || home);
        }
        modal.status(lt('No open servers in {region}. Looking for the closest region…', { region: wantLabel }));
        let counts = p.regionCounts;
        if (!counts || !Array.isArray(counts.regions)) counts = await window.RoUtilityUI.request({ type: 'serverCounts', placeId }, r => r !== undefined);
        if (cancelled) return;
        const byPlace = new Map();
        for (const r of (counts && counts.regions) || []) {
          const dc = all.find(d => d.id === r.datacenterId);
          if (!dc || !r.servers) continue;
          const name = placeName(dc);
          if (name === want) continue;
          const g = byPlace.get(name) || { name, dc, ids: [] };
          g.ids.push(dc.id);
          byPlace.set(name, g);
        }
        const near = [...byPlace.values()].sort((x, y) => (home ? distanceKm(home, x.dc) - distanceKm(home, y.dc) : 0)).slice(0, 4);
        for (const g of near) {
          if (cancelled) return;
          modal.status(lt('Checking {region}…', { region: niceName(g.name) }));
          const l = await regionList(g.ids, niceName(g.name));
          const alt = l && bestOpen(await openNow(l));
          if (alt) {
            if (!auto) {
              modal.status(lt('No open servers in {region}. Joining {other}…', { region: wantLabel, other: niceName(g.name) }));
              await wait(900);
              if (cancelled) return;
            }
            return go(alt, all.find(dc => dc.id === alt.datacenterId) || g.dc);
          }
        }
        joinAny(lt('No open servers in or near {region}. Joining any server…', { region: wantLabel }));
      } catch {
        joinAny(lt('Couldn’t check this game’s regions. Joining any server…'));
      } finally {
        busy = false;
      }
    };
    document.addEventListener('click', onClick, true);
    p.stopPlay = () => document.removeEventListener('click', onClick, true);
  }

  function exactCounts(p, userId) {
    let counts = null;
    let loading = false;
    const load = async () => {
      if (loading || counts) return;
      loading = true;
      const [followers, following] = await Promise.all([
        json(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
        json(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      ]);
      if (p !== page) return;
      counts = { followers: followers && followers.count, followings: following && following.count };
      p.tick();
    };
    p.counts = () => {
      if (settings.exactCounts === false) return;
      for (const [kind, word] of [['followers', LT('{n} Followers')], ['following', LT('{n} Following')]]) {
        for (const a of document.querySelectorAll(`a[href*="/users/${userId}/friends#!/${kind}"]`)) {
          const target = a.querySelector('span.text-no-wrap') || a;
          const text = target.textContent.trim();
          if (!/\d(\.\d+)?[KMB]\+?/i.test(text)) continue;
          if (!counts) {
            load();
            continue;
          }
          const n = kind === 'followers' ? counts.followers : counts.followings;
          if (!Number.isFinite(n)) continue;
          const full = formatNumber(n);
          target.textContent = /[A-Za-z]{4,}/.test(text) ? lt(word, { n: full }) : full;
        }
      }
    };
  }

  function placeVisits(p, userId) {
    let total = null;
    let games = 0;
    (async () => {
      let sum = 0;
      let count = 0;
      let cursor = '';
      for (let page = 0; page < 6; page++) {
        const data = await json(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=2&limit=50&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (!data) break;
        for (const g of data.data || []) {
          sum += Number(g.placeVisits) || 0;
          count++;
        }
        cursor = data.nextPageCursor;
        if (!cursor) break;
      }
      if (p !== page) return;
      total = sum;
      games = count;
      p.tick();
    })();
    p.visits = () => {
      if (settings.placeVisits === false || !total) return;
      const following = document.querySelector(`a[href*="/users/${userId}/friends#!/following"]`);
      if (!following || following.closest('.routility-classic, ul.details-info')) return;
      const row = following.parentElement;
      if (!row || row.querySelector('.routility-visits-chip')) return;
      const chip = following.cloneNode(true);
      chip.classList.add('routility-injected', 'routility-visits-chip');
      chip.classList.remove('cursor-pointer');
      chip.removeAttribute('href');
      chip.setAttribute('role', 'note');
      chip.querySelector('[data-testid="foundation-web-state-layer"]')?.remove();
      const text = chip.querySelector('span.text-no-wrap') || chip;
      text.textContent = lt('{n} Place Visits', { n: formatNumber(total) });
      chip.dataset.rtTip = ltn(games, 'Total visits across {n} public experience', 'Total visits across {n} public experiences', { n: formatNumber(games) });
      const last = [...row.children].filter(c => c.matches('.routility-mutual-chip, .routility-groups-chip') || c === following).pop();
      last.after(chip);
    };
  }

  function mutualGroups(p, userId) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me || me === String(userId)) return;
    let shared = null;
    let icons = {};
    (async () => {
      const [mine, theirs] = await Promise.all([
        json(`https://groups.roblox.com/v2/users/${me}/groups/roles`),
        json(`https://groups.roblox.com/v2/users/${userId}/groups/roles`),
      ]);
      if (p !== page || !mine || !theirs) return;
      const ids = new Set((mine.data || []).map(r => r.group && r.group.id));
      const found = (theirs.data || []).filter(r => r.group && ids.has(r.group.id)).map(r => ({ id: r.group.id, name: r.group.name, members: r.group.memberCount || 0, verified: !!r.group.hasVerifiedBadge, role: r.role && r.role.name }))
        .sort((a, b) => b.members - a.members);
      if (!found.length) return;
      const d = await json(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${found.slice(0, 100).map(g => g.id).join(',')}&size=150x150&format=Webp&isCircular=false`);
      for (const t of (d && d.data) || []) if (t.imageUrl) icons[String(t.targetId)] = t.imageUrl;
      if (p !== page) return;
      shared = found;
      p.tick();
    })();

    const closePop = () => {
      document.querySelector('.routility-groups-pop')?.remove();
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', esc, true);
      if (untrack) untrack();
      untrack = null;
    };
    let untrack = null;
    const outside = (e) => { if (!e.target.closest?.('.routility-groups-pop, .routility-groups-trigger')) closePop(); };
    const esc = (e) => { if (e.key === 'Escape') closePop(); };
    p.closeGroups = closePop;

    const icon = (g, size) => {
      const pic = el('span', 'routility-mutual-face routility-group-face');
      pic.style.width = pic.style.height = size + 'px';
      if (icons[g.id]) {
        const img = el('img');
        img.alt = '';
        img.src = icons[g.id];
        pic.appendChild(img);
      }
      return pic;
    };

    const openPop = (anchor) => {
      if (document.querySelector('.routility-groups-pop')) return closePop();
      const pop = el('div', 'routility-injected routility-mutual-pop routility-groups-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
      pop.setAttribute('role', 'dialog');
      pop.appendChild(el('div', 'text-label content-default routility-mutual-pop-title', ltn(shared.length, '{n} mutual community', '{n} mutual communities', { n: formatNumber(shared.length) })));
      const list = el('ul', 'routility-mutual-list');
      for (const g of shared) {
        const li = el('li');
        const a = el('a', 'routility-mutual-row relative clip group/interactable');
        a.href = `/communities/${g.id}`;
        const layer = el('div', STATE_LAYER);
        layer.setAttribute('aria-hidden', 'true');
        const face = icon(g, 40);
        face.classList.add('routility-mutual-face-lg');
        const text = el('span', 'routility-mutual-text');
        const name = el('span', 'routility-mutual-name');
        name.appendChild(el('span', 'text-overflow', g.name));
        if (g.verified) name.appendChild(verifiedBadge());
        text.append(name, el('span', 'routility-mutual-user text-overflow', `${ltn(g.members, '{n} member', '{n} members', { n: formatNumber(g.members) })}${g.role ? ` • ${g.role}` : ''}`));
        a.append(layer, face, text);
        li.appendChild(a);
        list.appendChild(li);
      }
      pop.appendChild(list);
      document.body.appendChild(pop);
      const place = () => {
        const r = anchor.getBoundingClientRect();
        const w = pop.offsetWidth;
        pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left))) + 'px';
        pop.style.top = Math.round(r.bottom + 6) + 'px';
      };
      place();
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc, true);
      untrack = window.RoUtilityUI.trackPopover(pop, anchor, place, closePop);
    };

    const stack = (size) => {
      const wrap = el('span', 'routility-mutual-stack');
      for (const g of shared.slice(0, 3)) wrap.appendChild(icon(g, size));
      return wrap;
    };

    const trigger = (node) => {
      node.classList.add('routility-groups-trigger');
      node.addEventListener('click', (e) => {
        e.preventDefault();
        openPop(node);
      });
      return node;
    };

    p.groups = () => {
      if (settings.mutualGroups === false || !shared || !shared.length) return;
      const friendsChip = document.querySelector(`a[href*="/users/${userId}/friends#!/friends"].radius-circle:not(.routility-mutual-chip)`);
      const row = friendsChip?.parentElement;
      if (row && !row.querySelector('.routility-groups-chip')) {
        const after = row.querySelector('.routility-mutual-chip') || [...row.children].find(c => /Following$/.test(c.textContent.trim()));
        if (after) {
          const chip = el('a', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility routility-injected routility-groups-chip');
          chip.href = `/users/${userId}/communities`;
          chip.style.textDecoration = 'none';
          const layer = el('div', STATE_LAYER);
          layer.setAttribute('aria-hidden', 'true');
          chip.append(layer, stack(18), el('span', 'padding-y-xsmall text-no-wrap text-truncate-end', ltn(shared.length, '{n} Mutual Community', '{n} Mutual Communities', { n: formatNumber(shared.length) })));
          after.after(trigger(chip));
        }
      }
      const info = document.querySelector('.routility-classic .header-details ul.details-info');
      if (info && !document.querySelector('.routility-classic .routility-groups-li')) {
        const li = el('li', 'routility-injected routility-groups-li');
        const a = el('a', 'text-name routility-mutual-count');
        a.href = `/users/${userId}/communities`;
        a.append(stack(16), el('span', null, formatNumber(shared.length)));
        li.append(trigger(a), el('div', 'text-label font-caption-header', ltn(shared.length, 'Community', 'Communities')));
        info.appendChild(li);
      }
    };
  }

  function storeTotal(p, universeId) {
    let total = null;
    (async () => {
      const passes = [];
      let token = '';
      for (let i = 0; i < 5; i++) {
        const d = await json(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
        if (!d) break;
        passes.push(...(d.gamePasses || []));
        token = d.nextPageToken;
        if (!token) break;
      }
      if (p !== page) return;
      const priced = passes.filter(x => x.isForSale !== false && Number.isFinite(x.price) && x.price > 0);
      if (!priced.length) return;
      total = { count: priced.length, robux: priced.reduce((n, x) => n + x.price, 0), owned: priced.filter(x => x.isOwned).length };
      p.tick();
    })();
    p.store = () => {
      if (settings.storeTotal === false || !total) return;
      const head = document.querySelector('#rbx-game-passes .container-header');
      if (!head || head.querySelector('.routility-store-total')) return;
      const box = el('span', 'routility-injected routility-store-total text-secondary');
      box.appendChild(document.createTextNode(`${ltn(total.count, 'All {n} pass:', 'All {n} passes:', { n: formatNumber(total.count) })} `));
      box.appendChild(el('span', 'icon-robux-16x16'));
      box.appendChild(el('span', 'text-robux routility-store-robux', formatNumber(total.robux)));
      if (total.owned) box.appendChild(document.createTextNode(` • ${lt('You own {n}', { n: formatNumber(total.owned) })}`));
      head.appendChild(box);
    };
  }

  function devProducts(p, universeId) {
    let data = null;
    (async () => {
      const list = [];
      let cursor = '';
      for (let i = 0; i < 6; i++) {
        const d = await json(`https://apis.roblox.com/developer-products/v2/universes/${universeId}/developerproducts?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (!d) break;
        list.push(...(d.developerProducts || []));
        cursor = d.nextPageCursor;
        if (!cursor || p !== page) break;
      }
      const items = list.filter(x => x.IsForSale && Number.isFinite(x.PriceInRobux) && x.PriceInRobux > 0).sort((a, b) => a.PriceInRobux - b.PriceInRobux || String(a.Name).localeCompare(String(b.Name)));
      if (p !== page || !items.length) return;
      const thumbs = {};
      for (let i = 0; i < items.length; i += 100) {
        const ids = items.slice(i, i + 100).map(x => x.DeveloperProductId).join(',');
        const t = await json(`https://thumbnails.roblox.com/v1/developer-products/icons?developerProductIds=${ids}&size=150x150&format=Webp`);
        for (const x of (t && t.data) || []) if (x.state === 'Completed') thumbs[x.targetId] = x.imageUrl;
      }
      if (p !== page) return;
      data = items.map(x => ({ id: x.DeveloperProductId, name: x.displayName || x.Name || '', desc: x.displayDescription || x.Description || '', price: x.PriceInRobux, thumb: thumbs[x.DeveloperProductId] || '' }));
      p.tick();
    })();
    p.devProducts = () => {
      if (settings.devProducts === false || !data) return;
      const store = document.querySelector('#store');
      if (!store || store.querySelector('#routility-dev-products')) return;
      const box = el('div', 'container-list game-dev-store routility-injected');
      box.id = 'routility-dev-products';
      const head = el('div', 'container-header');
      head.appendChild(el('h3', null, lt('Developer Products')));
      head.appendChild(el('span', 'routility-creator-by text-secondary', lt('{n} · Buy them in the experience', { n: formatNumber(data.length) })));
      const list = el('ul', 'hlist store-cards gear-passes-container');
      for (const i of data) {
        const li = el('li', 'list-item');
        const card = el('div', 'store-card');
        const art = el('div', 'gear-passes-asset');
        const img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        if (i.thumb) img.src = i.thumb;
        art.appendChild(img);
        const cap = el('div', 'store-card-caption');
        const name = el('div', 'text-overflow store-card-name', i.name);
        name.dataset.rtTip = i.desc ? `${i.name}: ${i.desc}` : i.name;
        const price = el('div', 'store-card-price');
        price.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux', formatNumber(i.price)));
        cap.append(name, price);
        card.append(art, cap);
        li.appendChild(card);
        list.appendChild(li);
      }
      box.append(head, list);
      const creator = store.querySelector('#routility-creator-items');
      if (creator) creator.before(box);
      else store.appendChild(box);
      box.appendChild(window.RoUtilityUI.pager(list, 6));
    };
  }

  function creatorItems(p, universeId) {
    let data = null;
    (async () => {
      const g = (await json(`https://games.roblox.com/v1/games?universeIds=${universeId}`))?.data?.[0];
      const c = g?.creator;
      if (!c || !c.id || (c.type === 'User' && String(c.id) === '1')) return;
      const group = c.type === 'Group';
      const d = await json(`https://catalog.roblox.com/v1/search/items/details?CreatorTargetId=${c.id}&CreatorType=${group ? 2 : 1}&SortType=2&Limit=10`);
      const items = (d?.data || []).slice(0, 8);
      if (p !== page || !items.length) return;
      const assets = items.filter(i => i.itemType !== 'Bundle').map(i => i.id);
      const bundles = items.filter(i => i.itemType === 'Bundle').map(i => i.id);
      const thumbs = {};
      const [a, b] = await Promise.all([
        assets.length ? json(`https://thumbnails.roblox.com/v1/assets?assetIds=${assets.join(',')}&size=150x150&format=Webp&returnPolicy=PlaceHolder`) : null,
        bundles.length ? json(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundles.join(',')}&size=150x150&format=Webp`) : null,
      ]);
      for (const t of [...(a?.data || []), ...(b?.data || [])]) thumbs[t.targetId] = t.imageUrl;
      if (p !== page) return;
      data = { creator: { id: c.id, name: c.name || '', group }, items: items.map(i => ({ ...i, thumb: thumbs[i.id] || '' })) };
      p.tick();
    })();
    p.creatorItems = () => {
      if (settings.creatorItems === false || !data) return;
      const store = document.querySelector('#store');
      if (!store || store.querySelector('#routility-creator-items')) return;
      const box = el('div', 'container-list game-dev-store routility-injected');
      box.id = 'routility-creator-items';
      const head = el('div', 'container-header');
      head.appendChild(el('h3', null, lt('Avatar Items')));
      const by = el('span', 'routility-creator-by text-secondary');
      by.appendChild(document.createTextNode(`${lt('By {name}', { name: data.creator.name })} · `));
      const all = el('a', 'text-link', lt('See All'));
      all.href = `https://www.roblox.com/catalog?Category=1&CreatorName=${encodeURIComponent(data.creator.name)}&CreatorType=${data.creator.group ? 'Group' : 'User'}`;
      by.appendChild(all);
      head.appendChild(by);
      const list = el('ul', 'hlist store-cards gear-passes-container');
      for (const i of data.items) {
        const li = el('li', 'list-item');
        const card = el('div', 'store-card');
        const link = el('a', 'gear-passes-asset');
        link.href = `https://www.roblox.com/${i.itemType === 'Bundle' ? 'bundles' : 'catalog'}/${i.id}`;
        const img = el('img');
        img.alt = '';
        if (i.thumb) img.src = i.thumb;
        link.appendChild(img);
        const cap = el('div', 'store-card-caption');
        const name = el('a', 'text-overflow store-card-name', i.name);
        name.href = link.href;
        name.dataset.rtTip = i.name;
        const price = el('div', 'store-card-price');
        const robux = i.price > 0 ? i.price : i.lowestPrice > 0 ? i.lowestPrice : 0;
        if (robux) price.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux', formatNumber(robux)));
        else price.appendChild(el('span', 'text-label', i.priceStatus === 'Free' || i.price === 0 ? lt('Free') : lt('Off Sale')));
        cap.append(name, price);
        card.append(link, cap);
        li.appendChild(card);
        list.appendChild(li);
      }
      box.append(head, list);
      store.appendChild(box);
    };
  }

  async function bigJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      return JSON.parse((await res.text()).replace(/"(id|targetId)":\s*(\d{15,})/g, '"$1":"$2"'));
    } catch {
      return null;
    }
  }

  let closeOutfitModal = () => {};
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const OUTFIT_SEEN = 'routilityOutfitUsers';

  function outfitSeen(userId, has) {
    try {
      const all = JSON.parse(localStorage.getItem(OUTFIT_SEEN) || '{}') || {};
      if (has === undefined) return !!all[userId];
      if (!!all[userId] === has) return has;
      if (has) all[userId] = 1;
      else delete all[userId];
      const keys = Object.keys(all);
      if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete all[k]);
      localStorage.setItem(OUTFIT_SEEN, JSON.stringify(all));
      return has;
    } catch {
      return false;
    }
  }

  function userOutfits(p, userId) {
    let data = null;
    let loaded = false;
    const expect = outfitSeen(userId);
    (async () => {
      const list = [];
      let token = '';
      for (let i = 0; i < 4; i++) {
        const d = await bigJson(`https://avatar.roblox.com/v2/avatar/users/${userId}/outfits?page=1&itemsPerPage=50&outfitType=Avatar&isEditable=true${token ? '&paginationToken=' + encodeURIComponent(token) : ''}`);
        if (!d || !Array.isArray(d.data)) break;
        list.push(...d.data.filter(o => o.isEditable !== false));
        token = d.paginationToken || '';
        if (!token) break;
      }
      if (p !== page) return;
      loaded = true;
      outfitSeen(userId, list.length > 0);
      if (!list.length) {
        document.querySelectorAll('.routility-outfits-sk').forEach(n => n.remove());
        return;
      }
      data = list.map(o => ({ id: String(o.id), name: o.name || lt('Outfit'), thumb: '' }));
      p.tick();
      const byId = new Map(data.map(o => [o.id, o]));
      let want = data.map(o => o.id);
      for (let round = 0; round < 6 && want.length && p === page; round++) {
        if (round) await new Promise(r => setTimeout(r, 1500 + round * 1000));
        const pending = [];
        for (let i = 0; i < want.length; i += 50) {
          const t = await bigJson(`https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${want.slice(i, i + 50).join(',')}&size=150x150&format=Webp`);
          for (const x of (t && t.data) || []) {
            const o = byId.get(String(x.targetId));
            if (!o) continue;
            if (x.imageUrl && x.state === 'Completed') o.thumb = x.imageUrl;
            else if (x.state === 'Pending') pending.push(o.id);
            else if (x.state === 'Blocked') o.thumb = window.RoUtilityUI.blockedThumb(x);
            else o.thumb = 'none';
          }
        }
        if (p !== page) return;
        for (const o of data) paintThumb(o);
        want = pending;
      }
      for (const o of data) if (!o.thumb) { o.thumb = 'none'; paintThumb(o); }
      p.tick();
    })();

    const img = (src, cls) => {
      const i = el('img', cls || '');
      i.alt = '';
      if (src) i.src = src;
      return i;
    };

    const outfitImg = (o, cls) => {
      const i = el('img', (cls ? cls + ' ' : '') + 'routility-outfit-img');
      i.alt = '';
      i.dataset.outfit = o.id;
      setThumb(i, o.thumb === 'blocked' ? '' : o.thumb);
      if (o.thumb === 'blocked') queueMicrotask(() => setThumb(i, 'blocked'));
      return i;
    };

    function setThumb(i, thumb) {
      const mark = i.parentElement && i.parentElement.querySelector(':scope > .routility-outfit-blocked');
      if (thumb === 'blocked') {
        i.src = BLANK;
        i.classList.remove('routility-outfit-wait');
        i.classList.add('routility-outfit-none');
        if (!mark && i.parentElement) i.before(el('span', 'thumbnail-2d-container icon-blocked routility-outfit-blocked'));
        return;
      }
      mark?.remove();
      if (thumb && thumb !== 'none') {
        if (i.getAttribute('src') !== thumb) i.src = thumb;
        i.classList.remove('routility-outfit-wait', 'routility-outfit-none');
      } else {
        i.src = BLANK;
        i.classList.toggle('routility-outfit-wait', !thumb);
        i.classList.toggle('routility-outfit-none', thumb === 'none');
      }
    }

    function paintThumb(o) {
      for (const i of document.querySelectorAll(`img.routility-outfit-img[data-outfit="${o.id}"]`)) setThumb(i, o.thumb);
    }

    const modernTile = (o) => {
      const tile = el('div', 'item-card profile-item-card routility-modern-tile routility-outfit-tile');
      const box = el('div', 'item-card-container');
      const a = el('a', 'item-card-link');
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); openOutfit(o); });
      const thumb = el('div', 'item-card-thumb-container routility-modern-thumb');
      thumb.appendChild(outfitImg(o));
      const cap = el('div', 'item-card-caption');
      cap.appendChild(el('div', 'item-card-name routility-modern-tile-name', o.name));
      a.append(thumb, cap);
      box.appendChild(a);
      tile.appendChild(box);
      return tile;
    };

    const classicTile = (o) => {
      const li = el('li', 'list-item asset-item collections-item routility-classic-item routility-outfit-tile');
      const a = el('a', 'collections-link');
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); openOutfit(o); });
      const box = el('div', 'img-container');
      box.appendChild(outfitImg(o, 'asset-thumb-container'));
      a.append(box, el('span', 'font-header-2 text-overflow item-name', o.name));
      li.appendChild(a);
      return li;
    };

    const seeAll = (cls) => {
      const a = el('a', cls, lt('See All'));
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); openAll(); });
      return a;
    };

    async function openOutfit(o) {
      const { body, sub } = modal(o.name, lt('Loading outfit'));
      const grid = el('div', 'routility-outfit-detail');
      const big = el('div', 'routility-outfit-big');
      big.appendChild(img(o.thumb && o.thumb !== 'none' && o.thumb !== 'blocked' ? o.thumb : ''));
      const items = el('ul', 'routility-outfit-items');
      for (let i = 0; i < 6; i++) items.appendChild(el('li', 'routility-outfit-item routility-outfit-item-sk'));
      grid.append(big, items);
      body.appendChild(grid);
      const [d, t] = await Promise.all([
        bigJson(`https://avatar.roblox.com/v1/outfits/${o.id}/details`),
        bigJson(`https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${o.id}&size=420x420&format=Webp`),
      ]);
      if (!body.isConnected) return;
      const large = (t && t.data && t.data[0] && t.data[0].imageUrl) || '';
      if (large) big.firstChild.src = large;
      const assets = (d && d.assets) || [];
      sub.textContent = d ? `${ltn(assets.length, '{n} item', '{n} items', { n: formatNumber(assets.length) })}${d.playerAvatarType ? ' · ' + d.playerAvatarType : ''}` : lt('Roblox didn’t send this outfit');
      items.textContent = '';
      if (!assets.length) return;
      const at = {};
      for (let i = 0; i < assets.length; i += 100) {
        const r = await bigJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assets.slice(i, i + 100).map(a => a.id).join(',')}&size=110x110&format=Webp&returnPolicy=PlaceHolder`);
        for (const x of (r && r.data) || []) if (x.imageUrl) at[String(x.targetId)] = x.imageUrl;
      }
      if (!body.isConnected) return;
      const sales = {};
      for (const a of assets) {
        const li = el('li', 'routility-outfit-row');
        const link = el('a', 'routility-outfit-item');
        link.href = `https://www.roblox.com/catalog/${a.id}`;
        const pic = el('span', 'routility-outfit-item-thumb');
        pic.appendChild(img(at[String(a.id)]));
        const txt = el('span', 'routility-outfit-item-text');
        txt.append(el('span', 'text-label-medium content-emphasis text-truncate-end', a.name), el('span', 'text-caption-medium content-muted', (a.assetType && a.assetType.name || '').replace(/^TShirt$/, 'T-Shirt').replace(/([a-z])([A-Z])/g, '$1 $2')));
        link.append(pic, txt);
        const sale = el('span', 'routility-outfit-sale');
        sale.appendChild(el('span', 'routility-outfit-sale-sk'));
        sales[String(a.id)] = sale;
        li.append(link, sale);
        items.appendChild(li);
      }
      const [info, owned] = await Promise.all([catalogInfo(assets.map(a => a.id)), ownedSet(assets.map(a => a.id))]);
      if (!body.isConnected) return;
      for (const a of assets) paintSale(sales[String(a.id)], a.id, info[String(a.id)], owned.has(String(a.id)));
    }

    function paintSale(box, id, d, mine) {
      box.textContent = '';
      const limited = d && (d.itemRestrictions || []).some(r => /Limited|Collectible/.test(r));
      const resale = limited ? Number(d.lowestResalePrice || d.lowestPrice) || 0 : 0;
      const price = d && !d.isOffSale && d.priceStatus !== 'Off Sale' ? Number(d.price) || 0 : 0;
      const free = d && !d.isOffSale && (d.priceStatus === 'Free' || (d.price === 0 && !limited));
      const robux = resale || price;
      const line = el('span', 'routility-outfit-price');
      if (robux) line.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', formatNumber(robux)));
      else line.appendChild(el('span', 'text-label content-muted', free ? lt('Free') : lt('Off Sale')));
      box.appendChild(line);
      if (mine) {
        box.appendChild(el('span', 'routility-outfit-owned text-caption-medium', lt('Owned')));
        return;
      }
      if (!robux && !free) return;
      const buy = el('a', 'btn-primary-xs routility-outfit-buy', free ? lt('Get') : lt('Buy'));
      buy.href = `https://www.roblox.com/catalog/${id}`;
      buy.dataset.rtTip = limited ? lt('Opens the item page with the cheapest reseller') : lt('Opens the item page to buy it');
      box.appendChild(buy);
    }

    let catalogCsrf = '';
    async function catalogInfo(ids) {
      const out = {};
      for (let i = 0; i < ids.length; i += 100) {
        const body = JSON.stringify({ items: ids.slice(i, i + 100).map(id => ({ itemType: 'Asset', id: Number(id) })) });
        for (let t = 0; t < 3; t++) {
          try {
            const r = await fetch('https://catalog.roblox.com/v1/catalog/items/details', { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, catalogCsrf ? { 'x-csrf-token': catalogCsrf } : {}), body });
            if (r.status === 403 && r.headers.get('x-csrf-token')) { catalogCsrf = r.headers.get('x-csrf-token'); continue; }
            if (r.ok) for (const x of (await r.json()).data || []) out[String(x.id)] = x;
            break;
          } catch {
            break;
          }
        }
      }
      return out;
    }

    async function ownedSet(ids) {
      const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
      const set = new Set();
      if (!me) return set;
      await Promise.all(ids.map(async (id) => {
        const d = await json(`https://inventory.roblox.com/v1/users/${me}/items/Asset/${id}?limit=10`);
        if (d && (d.data || []).length) set.add(String(id));
      }));
      return set;
    }

    function openAll() {
      const { body } = modal(lt('Outfits'), ltn(data.length, '{n} saved outfit', '{n} saved outfits', { n: formatNumber(data.length) }));
      const wrap = el('div', 'routility-modern-row routility-modern-grid routility-outfit-all');
      for (const o of data) wrap.appendChild(modernTile(o));
      body.appendChild(wrap);
    }

    function modal(titleText, subText) {
      closeOutfitModal();
      const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-outfit-backdrop');
      const box = el('div', 'routility-modal routility-outfit-modal');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      const head = el('div', 'routility-modal-head');
      const tb = el('div', 'routility-clean-titlebox');
      const title = el('h2', 'routility-modal-title', titleText);
      const sub = el('span', 'text-body-medium content-muted', subText);
      tb.append(title, sub);
      const close = el('button', 'routility-modal-icon routility-modal-close');
      close.type = 'button';
      close.setAttribute('aria-label', lt('Close'));
      close.appendChild(el('span', 'icon icon-regular-x'));
      head.append(tb, close);
      const body = el('div', 'routility-modal-body routility-outfit-body');
      box.append(head, body);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      document.documentElement.classList.add('routility-modal-open');
      const shut = () => {
        backdrop.remove();
        document.documentElement.classList.remove('routility-modal-open');
        document.removeEventListener('keydown', onKey, true);
        if (closeOutfitModal === shut) closeOutfitModal = () => {};
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
      document.addEventListener('keydown', onKey, true);
      close.addEventListener('click', shut);
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });
      closeOutfitModal = shut;
      return { shut, body, title, sub };
    }

    p.outfits = () => {
      if (settings.userOutfits === false) return;
      if (!data) {
        if (loaded || !expect || document.querySelector('.routility-outfits')) return;
        const at = document.querySelector('.routility-columns') || document.querySelector('.routility-classic-wearing');
        if (!at) return;
        const sk = el('div', 'section routility-injected routility-outfits routility-outfits-sk routility-classic-outfits');
        const head = el('div', 'container-header');
        head.appendChild(el('span', 'routility-sk routility-outfits-sk-title'));
        const body = el('div', 'section-content remove-panel');
        const ul = el('ul', 'hlist collections-list item-list routility-classic-collection-list');
        for (let i = 0; i < 6; i++) {
          const li = el('li', 'list-item asset-item collections-item routility-classic-item routility-outfits-sk-tile');
          const box = el('div', 'img-container');
          box.appendChild(el('span', 'routility-sk routility-outfits-sk-thumb'));
          li.append(box, el('span', 'routility-sk routility-outfits-sk-name'));
          ul.appendChild(li);
        }
        body.appendChild(ul);
        sk.append(head, body);
        at.after(sk);
        return;
      }
      const placeholder = document.querySelector('.routility-outfits-sk');
      if (document.querySelector('.routility-outfits:not(.routility-outfits-sk)')) return;
      const classic = document.querySelector('.routility-columns') || document.querySelector('.routility-classic-wearing');
      if (classic) {
        const sec = el('div', 'section routility-injected routility-outfits routility-classic-outfits');
        const head = el('div', 'container-header');
        head.appendChild(el('h3', null, lt('Outfits ({n})', { n: formatNumber(data.length) })));
        if (data.length > 6) head.appendChild(seeAll('btn-secondary-xs btn-more see-all-link-icon routility-see-all'));
        const body = el('div', 'section-content remove-panel');
        const ul = el('ul', 'hlist collections-list item-list routility-classic-collection-list');
        data.slice(0, 6).forEach(o => ul.appendChild(classicTile(o)));
        body.appendChild(ul);
        sec.append(head, body);
        if (placeholder) placeholder.replaceWith(sec);
        else classic.after(sec);
        return;
      }
      placeholder?.remove();
      const ours = document.querySelector('.routility-modern-wearing');
      const native = [...document.querySelectorAll('h2')].find(x => x.textContent.trim() === 'Currently Wearing')?.closest('.profile-carousel');
      const anchor = ours || native;
      if (!anchor) return;
      const sec = el('div', 'routility-modern-section routility-injected routility-outfits');
      const head = el('div', 'routility-modern-section-head');
      const h = el('h2', 'routility-modern-title content-emphasis', lt('Outfits'));
      h.appendChild(el('span', 'routility-modern-count content-muted', `(${formatNumber(data.length)})`));
      head.appendChild(h);
      if (data.length > 6) head.appendChild(seeAll('routility-see-all text-link'));
      const row = el('div', 'routility-modern-row');
      data.slice(0, 6).forEach(o => row.appendChild(modernTile(o)));
      sec.append(head, row);
      anchor.after(sec);
    };
  }

  function setup() {
    teardown();
    watchLaunchDialog();
    const path = location.pathname;
    const game = path.match(/^\/games\/(\d+)/);
    const profile = path.match(/^\/users\/(\d+)\/profile/i);
    if (!game && !profile) return;
    const p = { observer: null, timer: null };
    page = p;
    let queued = false;
    p.tick = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        if (p !== page) return;
        p.servers?.();
        p.recent?.();
        tagServerSections();
        p.playLabel?.();
        p.counts?.();
        p.groups?.();
        p.visits?.();
        p.store?.();
        p.devProducts?.();
        p.creatorItems?.();
        p.outfits?.();
      }, 60);
    };
    if (game) {
      serverStats(p, game[1]);
      preferredPlay(p, game[1]);
      if (settings.recentServers !== false) recentServers(p, game[1]);
      const waitUniverse = () => {
        if (p !== page) return;
        const universeId = document.querySelector('#game-detail-meta-data')?.dataset.universeId;
        if (universeId) {
          if (settings.storeTotal !== false) storeTotal(p, universeId);
          if (settings.devProducts !== false) devProducts(p, universeId);
          if (settings.creatorItems !== false) creatorItems(p, universeId);
        }
        else setTimeout(waitUniverse, 500);
      };
      waitUniverse();
    }
    if (profile) {
      exactCounts(p, profile[1]);
      if (settings.mutualGroups !== false) mutualGroups(p, profile[1]);
      if (settings.placeVisits !== false) placeVisits(p, profile[1]);
      if (settings.userOutfits !== false) userOutfits(p, profile[1]);
    }
    p.clock = setInterval(() => { if (p === page) p.tick(); }, 30000);
    p.observer = new MutationObserver(p.tick);
    p.observer.observe(document.body, { childList: true, subtree: true });
    p.tick();
  }

  function teardown() {
    if (!page) return;
    page.observer?.disconnect();
    page.stopPlay?.();
    page.stopJoins?.();
    clearInterval(page.clock);
    page.closeGroups?.();
    closeOutfitModal();
    page = null;
    document.querySelectorAll('.routility-play-region, .routility-server-pills, .routility-server-region-line, .routility-server-meta, .routility-server-share, .routility-server-map, .routility-server-regions, .routility-recent-servers, .routility-groups-chip, .routility-groups-li, .routility-store-total, #routility-creator-items, .routility-outfits, .routility-outfit-backdrop').forEach(n => n.remove());
    document.querySelectorAll('[data-routility-region-hidden]').forEach(n => delete n.dataset.routilityRegionHidden);
  }

  window.RoUtilityExtras = { setup, teardown, serverMap };
})();
