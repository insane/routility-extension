(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt } = window.RoUtilityI18n;
  let on = false;
  let observer = null;
  let original = '';

  function apply() {
    for (const root of document.querySelectorAll('#game-context-menu, .popover')) {
      const place = root.querySelector('li#configure');
      const game = root.querySelector('li#rbx-configure-game > a');
      if (!place || !game) continue;
      if (!original) original = game.textContent;
      if (on) {
        place.hidden = true;
        place.style.display = 'none';
        if (game.textContent !== lt('Configure')) game.textContent = lt('Configure');
      } else {
        place.hidden = false;
        place.style.display = '';
        if (original && game.textContent !== original) game.textContent = original;
      }
    }
  }

  function start() {
    if (observer || !/^\/games\/\d+/i.test(location.pathname)) return;
    let queued = false;
    observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).combineConfigure !== false;
    start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).combineConfigure !== false;
    apply();
  });
})();
