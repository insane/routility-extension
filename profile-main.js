(function () {
  'use strict';

  const mounted = new WeakMap();

  function sync(host) {
    const id = Number(host.getAttribute('data-routility-3d'));
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const Viewer = window.RobloxThumbnail3d && window.RobloxThumbnail3d.Thumbnail3d;
    if (!React || !ReactDOM || !Viewer) return false;
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
    for (const host of document.querySelectorAll('[data-routility-3d]')) {
      if (!sync(host)) return setTimeout(scan, 300);
    }
  }

  let queued = false;
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes' && r.target.matches && r.target.matches('.routility-3d-host')) sync(r.target);
      else if (r.type === 'childList' && r.addedNodes.length && !queued) {
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          scan();
        });
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-routility-3d'] });
})();
