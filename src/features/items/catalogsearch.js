(function () {
  'use strict';

  let on = true;
  const ready = new Promise((resolve) => {
    chrome.storage.local.get('routilitySettings', (s) => {
      on = ((s && s.routilitySettings) || {}).catalogSmartSearch !== false;
      resolve();
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.routilitySettings) on = (changes.routilitySettings.newValue || {}).catalogSmartSearch !== false;
  });

  const asked = new Set();
  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-catalog' || typeof e.data.id !== 'string' || asked.has(e.data.id)) return;
    const { id } = e.data;
    asked.add(id);
    const reply = data => window.postMessage(Object.assign({ type: 'routility-catalog-done', id }, data), location.origin);
    await ready;
    if (!on) return reply({ on: false });
    let hits = [];
    try { hits = await chrome.runtime.sendMessage({ type: 'acronymItems', query: String(e.data.q || '') }); } catch {}
    reply({ on: true, hits: Array.isArray(hits) ? hits : [] });
  });
})();
