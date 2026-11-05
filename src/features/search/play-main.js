(function () {
  'use strict';

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-quick-play') return;
    const placeId = Number(e.data.placeId);
    if (!Number.isSafeInteger(placeId) || placeId <= 0) return;
    const launcher = window.Roblox && window.Roblox.GameLauncher;
    if (launcher && typeof launcher.joinMultiplayerGame === 'function') launcher.joinMultiplayerGame(placeId);
    else location.href = `https://www.roblox.com/games/start?placeId=${placeId}`;
  });
})();
