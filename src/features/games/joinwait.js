(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const TILE = 'li.rbx-public-game-server-item, li.rbx-friends-game-server-item';
  const servers = new Map();
  let on = false;
  let observer = null;
  let watch = null;

  const placeId = () => Number(document.documentElement.dataset.routilitySubplace) || Number((location.pathname.match(/^\/games\/(\d+)/i) || [])[1]) || 0;
  const shortOf = (li) => li.querySelector('.server-id-text')?.textContent.replace(/^[^:]*:\s*/, '').trim() || '';
  const clock = (ms) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };

  function countOf(li) {
    const m = (li.querySelector('[class*="game-server-status"]')?.textContent || '').match(/(\d[\d,]*)\D+(\d[\d,]*)/);
    return m ? { n: Number(m[1].replace(/,/g, '')), max: Number(m[2].replace(/,/g, '')) } : null;
  }

  function label(btn) {
    const mine = watch && watch.id === btn.dataset.serverId;
    let text = lt('Join When Open');
    let tip = lt('Waits for someone to leave this full server, then joins you right away.');
    if (mine && watch.state === 'joining') {
      text = lt('Joining');
      tip = '';
    } else if (mine) {
      text = lt('Waiting {time}', { time: clock(Date.now() - watch.started) });
      tip = lt('Checks every few seconds and joins the moment a spot opens. Click to stop waiting.');
    }
    if (btn.textContent !== text) btn.textContent = text;
    if (tip) btn.dataset.rtTip = tip;
    else delete btn.dataset.rtTip;
    btn.classList.toggle('routility-wait-active', !!mine);
  }

  function paint() {
    for (const li of document.querySelectorAll(TILE)) {
      const sv = servers.get(shortOf(li));
      const c = countOf(li);
      const mine = watch && sv && watch.id === sv.id;
      const full = on && sv && c && c.max > 0 && c.n >= c.max;
      let btn = li.querySelector('.routility-wait-btn');
      if (!full && !mine) {
        btn?.remove();
        continue;
      }
      if (!btn) {
        btn = el('button', 'btn-full-width btn-control-xs routility-injected routility-wait-btn');
        btn.type = 'button';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(btn.dataset.serverId);
        });
        const join = li.querySelector('.game-server-join-btn');
        if (join) join.after(btn);
        else (li.querySelector('.game-server-details') || li).appendChild(btn);
      }
      btn.dataset.serverId = sv.id;
      label(btn);
    }
  }

  let base = null;

  function untitle() {
    if (base === null) return;
    document.title = base;
    base = null;
  }

  function tick() {
    document.querySelectorAll('.routility-wait-btn').forEach(label);
    if (!watch || watch.state === 'joining') return untitle();
    if (base === null) base = document.title;
    document.title = `${lt('Waiting {time}', { time: clock(Date.now() - watch.started) })} · ${base}`;
  }

  function drop() {
    if (!watch) return;
    clearInterval(watch.tick);
    watch = null;
    untitle();
    paint();
  }

  function stop() {
    if (!watch) return;
    drop();
    chrome.runtime.sendMessage({ type: 'joinWaitStop' }).catch(() => {});
  }

  function adopt(w, state) {
    if (watch) clearInterval(watch.tick);
    watch = { id: w.id, placeId: Number(w.placeId), started: w.started, state };
    watch.tick = setInterval(tick, 1000);
    tick();
    paint();
  }

  function gameName() {
    const sub = document.documentElement.dataset.routilitySubplace && document.querySelector('.routility-subplace-dropdown .input-dropdown-btn')?.textContent.trim();
    return sub || document.querySelector('.game-name')?.textContent.trim() || document.title.replace(/\s*-\s*Roblox\s*$/i, '');
  }

  async function toggle(id) {
    if (!id) return;
    if (watch && watch.id === id) return stop();
    stop();
    const w = await chrome.runtime.sendMessage({ type: 'joinWaitStart', id, placeId: placeId(), game: gameName() }).catch(() => null);
    if (w) adopt(w, 'waiting');
  }

  async function scan(placeId, id) {
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const d = await json(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!d) return null;
      for (const sv of d.data || []) {
        const open = Number(sv.playing) < Number(sv.maxPlayers);
        if (sv.id === id) return open ? 'open' : 'full';
        if (open) return 'open';
      }
      cursor = d.nextPageCursor || '';
      if (!cursor) return 'gone';
    }
    return 'full';
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg && msg.type === 'joinWaitScan') {
      scan(Number(msg.placeId), String(msg.id)).then(state => reply({ state }), () => reply(null));
      return true;
    }
    if (!msg || !watch || msg.id !== watch.id) return;
    if (msg.type === 'joinWaitGo') {
      watch.state = 'joining';
      tick();
      paint();
      window.postMessage({ type: 'routility-join', placeId: Number(msg.placeId), gameId: msg.id }, location.origin);
      setTimeout(drop, 4000);
    } else if (msg.type === 'joinWaitState' && msg.state === 'stopped') {
      drop();
    }
  });

  function start() {
    if (observer) return;
    const queue = onFrame(paint);
    observer = new MutationObserver((records) => {
      if (records.every(r => r.target.closest?.('.routility-wait-btn'))) return;
      queue();
    });
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    paint();
    chrome.runtime.sendMessage({ type: 'joinWaitGet' }).then(w => { if (w && !watch) adopt(w, 'waiting'); }, () => {});
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-servers' || !Array.isArray(e.data.servers)) return;
    for (const sv of e.data.servers) {
      const parts = String(sv.id || '').split('-');
      if (parts.length >= 3) servers.set(`${parts[1]}-${parts[2]}`, sv);
    }
    if (observer) paint();
  });

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).joinWhenOpen !== false;
    if (/^\/games\/\d+/i.test(location.pathname)) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).joinWhenOpen !== false;
    if (!on) stop();
    if (observer) paint();
  });
})();
