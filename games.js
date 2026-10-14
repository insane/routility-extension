(function () {
  'use strict';

  const { onFrame, formatNumber, el } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  let state = null;

  function ago(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!(ms >= 0)) return '';
    const min = Math.floor(ms / 60000);
    if (min < 1) return lt('just now');
    if (min < 60) return ltn(min, '{n} minute ago', '{n} minutes ago');
    const hr = Math.floor(min / 60);
    if (hr < 24) return ltn(hr, '{n} hour ago', '{n} hours ago');
    const day = Math.floor(hr / 24);
    if (day < 30) return ltn(day, '{n} day ago', '{n} days ago');
    const mo = Math.floor(day / 30.44);
    if (mo < 12) return ltn(mo, '{n} month ago', '{n} months ago');
    const yr = Math.floor(day / 365.25);
    return ltn(yr, '{n} year ago', '{n} years ago');
  }

  function stamp(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function stat(label) {
    for (const li of document.querySelectorAll('.game-stat-container .game-stat')) {
      if (li.querySelector('.text-label')?.textContent.trim() === label) return li.querySelector('.text-lead');
    }
    return null;
  }

  function apply() {
    const s = state;
    if (!s || !s.game) return;
    const g = s.game;
    const visits = document.querySelector('#game-visits-count') || stat('Visits');
    if (visits && g.visits > 0 && visits.dataset.routilityExact !== String(g.visits)) {
      visits.dataset.routilityExact = String(g.visits);
      visits.textContent = formatNumber(g.visits);
    }
    const active = stat('Active');
    if (active && s.live && typeof g.playing === 'number' && active.textContent !== formatNumber(g.playing)) {
      active.textContent = formatNumber(g.playing);
    }
    const counts = [];
    for (const id of ['vote-up-text', 'vote-down-text']) {
      const node = document.getElementById(id);
      const exact = node && Number(node.getAttribute('title'));
      if (!node || !Number.isFinite(exact)) continue;
      counts.push(exact);
      const full = exact >= 1e6 ? `${(exact / 1e6).toFixed(2)}M` : exact >= 1e4 ? `${(exact / 1e3).toFixed(1)}K` : formatNumber(exact);
      if (node.textContent === full) continue;
      if (node.dataset.routilityVote === undefined) node.dataset.routilityVote = node.textContent;
      node.textContent = full;
    }
    const bar = document.querySelector('.users-vote .vote-container');
    if (bar && counts.length === 2 && counts[0] + counts[1] > 0) {
      const tip = lt('{pct}% liked • {likes} likes, {dislikes} dislikes', { pct: Math.round(counts[0] / (counts[0] + counts[1]) * 100), likes: formatNumber(counts[0]), dislikes: formatNumber(counts[1]) });
      if (bar.dataset.rtTip !== tip) bar.dataset.rtTip = tip;
    }
    for (const [label, iso] of [['Updated', g.updated], ['Created', g.created]]) {
      const node = stat(label);
      if (!node || node.dataset.routilityWhen || !iso || !stamp(iso)) continue;
      node.dataset.routilityWhen = node.textContent;
      if (label === 'Updated') {
        node.textContent = ago(iso).replace(/^\w/, c => c.toUpperCase());
        node.dataset.rtTip = stamp(iso);
      } else {
        node.dataset.rtTip = `${stamp(iso)} • ${ago(iso)}`;
      }
    }
  }

  async function setup(universeId) {
    if (!universeId) return;
    if (state && state.universeId === String(universeId)) return;
    resetStats();
    const s = { universeId: String(universeId), game: null };
    state = s;
    s.observer = new MutationObserver(onFrame(apply));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    await refresh(s);
    if (state !== s) return;
    s.timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh(s, true);
    }, 30000);
  }

  async function refresh(s, live) {
    try {
      const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${s.universeId}`, { credentials: 'include' });
      const data = res.ok ? await res.json() : null;
      if (state !== s) return;
      const game = (data && data.data || [])[0];
      if (game) s.game = game;
      if (live) s.live = true;
    } catch {}
    apply();
  }

  let trailers = null;

  function stopTrailers() {
    if (trailers) return;
    let intent = 0;
    const inCarousel = (n) => n && n.closest && n.closest('#game-details-carousel-container');
    const onIntent = (e) => { if (inCarousel(e.target)) intent = Date.now(); };
    const onPlay = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || !inCarousel(v)) return;
      if (Date.now() - intent < 2000) return;
      v.pause();
    };
    const sweep = () => {
      if (Date.now() - intent < 2000) return;
      document.querySelectorAll('#game-details-carousel-container video').forEach(v => { if (!v.paused) v.pause(); });
    };
    document.addEventListener('pointerdown', onIntent, true);
    document.addEventListener('keydown', onIntent, true);
    document.addEventListener('play', onPlay, true);
    document.addEventListener('playing', onPlay, true);
    const observer = new MutationObserver(onFrame(sweep));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    sweep();
    trailers = { onIntent, onPlay, observer };
  }

  function teardown() {
    if (trailers) {
      document.removeEventListener('pointerdown', trailers.onIntent, true);
      document.removeEventListener('keydown', trailers.onIntent, true);
      document.removeEventListener('play', trailers.onPlay, true);
      document.removeEventListener('playing', trailers.onPlay, true);
      trailers.observer.disconnect();
      trailers = null;
    }
    resetStats();
  }

  function resetStats() {
    if (!state) return;
    clearInterval(state.timer);
    state.observer.disconnect();
    state = null;
    document.querySelectorAll('[data-routility-vote]').forEach(n => {
      n.textContent = n.dataset.routilityVote;
      delete n.dataset.routilityVote;
    });
    document.querySelector('.users-vote .vote-container')?.removeAttribute('data-rt-tip');
    document.querySelectorAll('[data-routility-when]').forEach(n => {
      n.textContent = n.dataset.routilityWhen;
      delete n.dataset.routilityWhen;
      delete n.dataset.rtTip;
    });
  }

  let pt = null;

  function playText(min) {
    if (min < 60) return ltn(min, '{n}m', '{n}m');
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h >= 100 || !m ? ltn(h, '{n}h', '{n}h', { n: h.toLocaleString() }) : lt('{h}h {m}m', { h, m });
  }

  function dayKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function placePlaytime() {
    const p = pt;
    if (!p || !p.data) return;
    const list = document.querySelector('.game-stat-container');
    if (!list) return;
    let total = 0;
    let week = 0;
    let last = '';
    const since = dayKey(Date.now() - 6 * 86400000);
    for (const [day, games] of Object.entries(p.data.days || {})) {
      const m = Number(games && games[p.universeId]) || 0;
      if (!m) continue;
      total += m;
      if (day >= since) week += m;
      if (day > last) last = day;
    }
    let li = list.querySelector(':scope > .routility-pt-stat');
    if (!total) {
      li?.remove();
      return;
    }
    if (!li) {
      li = el('li', 'game-stat routility-injected routility-pt-stat');
      li.append(el('p', 'text-label text-overflow font-caption-header', lt('Your Playtime')), el('p', 'text-lead font-caption-body'));
      list.appendChild(li);
    }
    const lead = li.querySelector('.text-lead');
    const text = playText(total);
    if (lead.textContent !== text) lead.textContent = text;
    const lastDate = new Date(last + 'T12:00:00');
    const tip = [week ? lt('{time} in the past 7 days', { time: playText(week) }) : lt('Not played in the past 7 days'), lt('Last played {date}', { date: lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: lastDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) }), lt('Tracked by RoUtility while a Roblox tab is open.')].join(' • ');
    if (li.dataset.rtTip !== tip) li.dataset.rtTip = tip;
  }

  function setupPlaytime(universeId) {
    stopPlaytime();
    const me = document.querySelector('meta[name="user-data"]')?.getAttribute('data-userid');
    if (!me || !universeId) return;
    const p = { universeId: String(universeId), key: 'routilityPlaytime:' + me, data: null };
    pt = p;
    const load = () => chrome.storage.local.get(p.key, (st) => {
      if (chrome.runtime.lastError || pt !== p) return;
      p.data = st[p.key] || null;
      placePlaytime();
    });
    p.onStore = (changes, area) => { if (area === 'local' && changes[p.key]) load(); };
    chrome.storage.onChanged.addListener(p.onStore);
    p.observer = new MutationObserver(() => {
      if (pt === p && p.data && !document.querySelector('.game-stat-container > .routility-pt-stat')) placePlaytime();
    });
    p.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    load();
  }

  function stopPlaytime() {
    if (!pt) return;
    pt.observer.disconnect();
    chrome.storage.onChanged.removeListener(pt.onStore);
    pt = null;
    document.querySelectorAll('.routility-pt-stat').forEach(n => n.remove());
  }

  window.RoUtilityGames = { setup, teardown, stopTrailers, setupPlaytime, stopPlaytime };
})();
