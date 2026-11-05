(function () {
  'use strict';

  const mounted = new Map();
  const parked = new Set();
  const watched = new WeakSet();
  let retry = 0;
  let tries = 0;

  const inView = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const host = e.target;
      if (e.isIntersecting) {
        if (parked.delete(host)) sync(host);
      } else if (mounted.has(host) && host.isConnected) {
        window.ReactDOM?.unmountComponentAtNode(host);
        mounted.delete(host);
        parked.add(host);
      }
    }
  }, { rootMargin: '300px' });

  function sync(host) {
    const id = Number(host.getAttribute('data-routility-3d'));
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const Viewer = window.RobloxThumbnail3d && window.RobloxThumbnail3d.Thumbnail3d;
    if (!React || !ReactDOM || !Viewer) return false;
    if (!watched.has(host)) {
      watched.add(host);
      inView.observe(host);
    }
    if (!(id > 0)) parked.delete(host);
    if (parked.has(host)) return true;
    if (id > 0) {
      if (mounted.get(host) === id) return true;
      ReactDOM.render(React.createElement(Viewer, { targetId: id }), host);
      mounted.set(host, id);
    } else if (mounted.has(host)) {
      ReactDOM.unmountComponentAtNode(host);
      mounted.delete(host);
    }
    return true;
  }

  function scan() {
    retry = 0;
    for (const host of mounted.keys()) {
      if (host.isConnected) continue;
      window.ReactDOM?.unmountComponentAtNode(host);
      mounted.delete(host);
    }
    for (const host of parked) if (!host.isConnected) parked.delete(host);
    for (const host of document.querySelectorAll('[data-routility-3d]')) {
      if (sync(host)) continue;
      if (++tries < 40) retry = setTimeout(scan, 300);
      return;
    }
    tries = 0;
  }

  let queued = false;
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes' && r.target.matches && r.target.matches('.routility-3d-host')) sync(r.target);
      else if (r.type === 'childList' && (r.addedNodes.length || (r.removedNodes.length && mounted.size)) && !queued && !retry) {
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          scan();
        });
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-routility-3d'] });

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-follow') return;
    const userId = Number(e.data.userId);
    const placeId = Number(e.data.placeId);
    const gameId = String(e.data.gameId || '');
    const launcher = window.Roblox && window.Roblox.GameLauncher;
    if (!launcher || !Number.isSafeInteger(userId) || userId <= 0) return;
    if (Number.isSafeInteger(placeId) && placeId > 0 && /^[0-9a-f-]{36}$/i.test(gameId) && typeof launcher.joinGameInstance === 'function') launcher.joinGameInstance(placeId, gameId);
    else if (typeof launcher.followPlayerIntoGame === 'function') launcher.followPlayerIntoGame(userId);
  });
})();
