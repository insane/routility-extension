(function () {
  'use strict';

  const ORIGIN = location.origin;
  let on = false;

  function target(row) {
    const key = Object.keys(row).find(k => k.startsWith('__reactFiber'));
    let f = key ? row[key] : null;
    for (let i = 0; f && i < 6; i++, f = f.return) {
      const p = f.memoizedProps || {};
      const u = p.friend || p.user || p.result || null;
      const id = Number((u && (u.id || u.userId)) || p.userId);
      if (id > 0) return { id, name: String((u && (u.combinedName || u.displayName || u.name)) || p.displayName || ''), thumb: String(p.thumbnailUrl || (u && u.thumbnailUrl) || '') };
    }
    return null;
  }

  function pick(e) {
    if (!on) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target && e.target.closest ? e.target.closest('[role="option"]') : null;
    const sheet = row && row.closest('[role="dialog"]');
    if (!sheet || !sheet.querySelector('[data-testid="send-robux-search-row"]')) return;
    const who = target(row);
    if (!who) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.postMessage(Object.assign({ type: 'routility-send-pick' }, who), ORIGIN);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-send-on') return;
    on = e.data.on === true;
  });
  window.postMessage({ type: 'routility-send-hello' }, ORIGIN);
  window.addEventListener('click', pick, true);
  window.addEventListener('keydown', pick, true);
})();
