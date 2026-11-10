(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { json } = window.RoUtilityUI;
  const EVERY = 60000;
  const STALE = 10 * 60000;
  const KEEP = 300;
  let on = false;
  let timer = null;
  let busy = false;

  const me = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const keyFor = (id) => 'routilityFriendsToday:' + id;
  const dayOf = (ms) => {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  function stateOf(f) {
    const p = f.userPresence || {};
    const type = p.UserPresenceType || p.userPresenceType || '';
    return {
      s: type === 'InGame' ? 'game' : type === 'InStudio' ? 'studio' : 'online',
      uni: String(p.universeId || ''),
      place: String(p.rootPlaceId || p.placeId || ''),
      game: p.lastLocation || '',
      name: f.name || '',
      display: f.displayName || '',
    };
  }

  function played(id, o, at) {
    return { id, t: 'played', at, game: o.game, uni: o.uni, place: o.place, mins: Math.max(1, Math.round((at - (o.since || at)) / 60000)), name: o.name, display: o.display };
  }

  async function tick() {
    const id = me();
    if (!on || !id || busy) return;
    busy = true;
    try {
      const key = keyFor(id);
      const st = await chrome.storage.local.get(key);
      const log = st[key] || { day: '', events: [], last: null, seen: 0, claim: 0 };
      const at = Date.now();
      if (at - (log.claim || 0) < EVERY - 5000) return;
      log.claim = at;
      await chrome.storage.local.set({ [key]: log });
      const d = await json(`https://friends.roblox.com/v1/users/${id}/friends/online`);
      if (!d || !Array.isArray(d.data)) return;
      const now = {};
      for (const f of d.data) now[String(f.id)] = stateOf(f);
      const today = dayOf(at);
      const events = log.day === today ? (log.events || []).slice() : [];
      const prev = log.last && at - (log.seen || 0) < STALE ? log.last : null;
      for (const [uid, n] of Object.entries(now)) {
        const o = prev && prev[uid];
        if (n.s === 'game') n.since = o && o.s === 'game' && o.uni === n.uni ? o.since || at : at;
        if (!prev) continue;
        if (!o && n.s !== 'game') events.push({ id: uid, t: 'online', at, name: n.name, display: n.display });
        if (o && o.s === 'game' && (n.s !== 'game' || o.uni !== n.uni)) events.push(played(uid, o, at));
        if (n.s === 'game' && (!o || o.s !== 'game' || o.uni !== n.uni)) events.push({ id: uid, t: 'play', at, game: n.game, uni: n.uni, place: n.place, name: n.name, display: n.display });
      }
      if (prev) {
        for (const [uid, o] of Object.entries(prev)) {
          if (now[uid]) continue;
          if (o.s === 'game') events.push(played(uid, o, at));
          events.push({ id: uid, t: 'offline', at, name: o.name, display: o.display });
        }
      }
      const fresh = (await chrome.storage.local.get(key))[key] || log;
      await chrome.storage.local.set({ [key]: { day: today, events: events.slice(-KEEP), last: now, seen: at, claim: Math.max(at, fresh.claim || 0) } });
    } finally {
      busy = false;
    }
  }

  function apply(next) {
    on = next;
    if (on && !timer) {
      timer = setInterval(tick, EVERY);
      setTimeout(tick, 3000);
    } else if (!on && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  chrome.storage.local.get('routilitySettings', (st) => apply((st.routilitySettings || {}).friendsToday !== false));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    apply((changes.routilitySettings.newValue || {}).friendsToday !== false);
  });
  window.RoUtilityFriendsToday = { keyFor, dayOf, tick };
})();
