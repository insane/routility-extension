(function () {
  'use strict';

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-try-game') return;
    const placeId = Number(e.data.placeId);
    const launchData = String(e.data.launchData || '');
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || !launchData || launchData.length > 200) return;
    const launcher = window.Roblox && window.Roblox.GameLauncher;
    if (launcher && typeof launcher.joinMultiplayerGame === 'function') launcher.joinMultiplayerGame(placeId, true, false, undefined, undefined, { launchData });
    else location.href = `https://www.roblox.com/games/start?placeId=${placeId}&launchData=${encodeURIComponent(launchData)}`;
  });
})();
