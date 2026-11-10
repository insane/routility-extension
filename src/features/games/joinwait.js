(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const EVERY = 6000;
  const GIVE_UP = 15 * 60000;
  const TILE = 'li.rbx-public-game-server-item, li.rbx-friends-game-server-item';
  const servers = new Map();
  let on = false;
  let observer = null;
  let watch = null;

  const placeId = () => Number((location.pathname.match(/^\/games\/(\d+)/i) || [])[1]) || 0;
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

  function stop() {
    if (!watch) return;
    clearInterval(watch.poll);
    clearInterval(watch.tick);
    watch = null;
    paint();
  }

  function join() {
    if (!watch || watch.state === 'joining') return;
    watch.state = 'joining';
    paint();
    window.postMessage({ type: 'routility-join', placeId: watch.placeId, gameId: watch.id }, location.origin);
    setTimeout(stop, 4000);
  }

  async function check() {
    const w = watch;
    if (!w || w.busy || w.state === 'joining') return;
    if (Date.now() - w.started > GIVE_UP) return stop();
    w.busy = true;
    try {
      let cursor = '';
      for (let page = 0; page < 5; page++) {
        const d = await json(`https://games.roblox.com/v1/games/${w.placeId}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (watch !== w || !d) return;
        for (const sv of d.data || []) {
          if (sv.id === w.id) {
            if (Number(sv.playing) < Number(sv.maxPlayers)) join();
            return;
          }
          if (Number(sv.playing) < Number(sv.maxPlayers)) {
            join();
            return;
          }
        }
        cursor = d.nextPageCursor || '';
        if (!cursor) {
          stop();
          return;
        }
      }
    } finally {
      w.busy = false;
    }
  }

  function toggle(id) {
    if (!id) return;
    if (watch && watch.id === id) return stop();
    stop();
    watch = { id, placeId: placeId(), started: Date.now(), state: 'waiting', busy: false };
    watch.poll = setInterval(check, EVERY);
    watch.tick = setInterval(() => document.querySelectorAll('.routility-wait-btn').forEach(label), 1000);
    paint();
    check();
  }

  function start() {
    if (observer) return;
    const queue = onFrame(paint);
    observer = new MutationObserver((records) => {
      if (records.every(r => r.target.closest?.('.routility-wait-btn'))) return;
      queue();
    });
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    paint();
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
