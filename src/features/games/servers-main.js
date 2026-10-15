(function () {
  'use strict';

  const MATCH = /\/v[12]\/games\/\d+\/servers\/(Public|Friend)\b/;

  function forward(url, text) {
    if (!MATCH.test(url) || !text) return;
    let data;
    try { data = JSON.parse(text); } catch { return; }
    const list = Array.isArray(data && data.data) ? data.data : [];
    const servers = list.filter(s => s && typeof s.id === 'string').map(s => ({
      id: s.id,
      playing: Number(s.playing) || 0,
      maxPlayers: Number(s.maxPlayers) || 0,
      ping: Number.isFinite(s.ping) ? s.ping : null,
      fps: Number.isFinite(s.fps) ? s.fps : null,
      playerTokens: Array.isArray(s.playerTokens) ? s.playerTokens.filter(t => typeof t === 'string').slice(0, 5) : [],
    }));
    if (servers.length) window.postMessage({ type: 'routility-servers', servers }, location.origin);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-join') return;
    const placeId = Number(e.data.placeId);
    const gameId = String(e.data.gameId || '');
    if (!Number.isFinite(placeId) || !/^[0-9a-f-]{36}$/i.test(gameId)) return;
    const launcher = window.Roblox && window.Roblox.GameLauncher;
    if (launcher && typeof launcher.joinGameInstance === 'function') launcher.joinGameInstance(placeId, gameId);
    else location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${gameId}`;
  });

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__routilityUrl = String(url || '');
    return open.apply(this, arguments);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (MATCH.test(this.__routilityUrl || '')) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') forward(this.__routilityUrl, this.responseText);
          else if (this.responseType === 'json' && this.response) forward(this.__routilityUrl, JSON.stringify(this.response));
        } catch {}
      });
    }
    return send.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const result = origFetch.apply(this, arguments);
    if (MATCH.test(url)) {
      result.then(res => res.clone().text()).then(text => forward(url, text)).catch(() => {});
    }
    return result;
  };
})();
