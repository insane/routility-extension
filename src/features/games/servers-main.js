(function () {
  'use strict';

  const MATCH = /\/v[12]\/games\/\d+\/servers\/(Public|Friend)\b/;
  let redirect = null;

  function rewrite(url) {
    const text = String(url || '');
    if (!redirect || !/^https:\/\/games\.roblox\.com\//.test(text)) return text;
    const to = redirect.to;
    return text.replace(redirect.path, (m, a, b) => a + to + b).replace(redirect.query, (m, a) => a + to);
  }

  function forward(url, text) {
    const hit = String(url).match(/\/v[12]\/games\/(\d+)\/servers\/(Public|Friend)\b/);
    if (!hit || !text) return;
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
    window.postMessage({ type: 'routility-servers', servers, placeId: hit[1], kind: hit[2] }, location.origin);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.type === 'routility-place') {
      const from = String(e.data.from || '');
      const to = String(e.data.to || '');
      if (!/^\d{1,20}$/.test(from) || !/^\d{1,20}$/.test(to)) return;
      redirect = from === to ? null : { to, path: new RegExp(`(/games/)${from}(/servers\\b)`, 'g'), query: new RegExp(`([?&]placeId=)${from}(?=&|$)`, 'g') };
      return;
    }
    if (e.data.type === 'routility-play') {
      const id = Number(e.data.placeId);
      if (!Number.isFinite(id) || id <= 0) return;
      const launcher = window.Roblox && window.Roblox.GameLauncher;
      if (launcher && typeof launcher.joinMultiplayerGame === 'function') launcher.joinMultiplayerGame(id);
      else location.href = `roblox://experiences/start?placeId=${id}`;
      return;
    }
    if (e.data.type !== 'routility-join') return;
    const placeId = Number(e.data.placeId);
    const gameId = String(e.data.gameId || '');
    if (!Number.isFinite(placeId) || !/^[0-9a-f-]{36}$/i.test(gameId)) return;
    const launcher = window.Roblox && window.Roblox.GameLauncher;
    if (launcher && typeof launcher.joinGameInstance === 'function') launcher.joinGameInstance(placeId, gameId);
    else location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${gameId}`;
  });

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = rewrite(url);
    this.__routilityUrl = String(args[1] || '');
    return open.apply(this, args);
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
    const args = Array.prototype.slice.call(arguments);
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    if (redirect) {
      const next = rewrite(url);
      if (next !== url) {
        url = next;
        args[0] = typeof input === 'string' || input instanceof URL ? next : new Request(next, input);
      }
    }
    const result = origFetch.apply(this, args);
    if (MATCH.test(url)) {
      result.then(res => res.clone().text()).then(text => forward(url, text)).catch(() => {});
    }
    return result;
  };
})();
