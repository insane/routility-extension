(function () {
  'use strict';

  const MATCH = /^https:\/\/inventory\.roblox\.com\/v2\/users\/\d+\/inventory\/\d+/;
  const sent = [];

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-inventory-replay') return;
    for (const msg of sent) window.postMessage(msg, location.origin);
  });

  function forward(url, text) {
    if (!MATCH.test(url) || !text) return;
    let data;
    try { data = JSON.parse(text); } catch { return; }
    const list = Array.isArray(data && data.data) ? data.data : [];
    const items = list.filter(x => x && Number.isFinite(x.assetId)).map(x => ({
      assetId: x.assetId,
      userAssetId: Number(x.userAssetId) || 0,
      created: typeof x.created === 'string' ? x.created : '',
      updated: typeof x.updated === 'string' ? x.updated : '',
      tradable: !!(x.collectibleItemId || x.serialNumber),
    }));
    if (!items.length) return;
    const msg = { type: 'routility-inventory', url: url.split('?')[0], items };
    sent.push(msg);
    if (sent.length > 200) sent.shift();
    window.postMessage(msg, location.origin);
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__routilityInvUrl = String(url || '');
    return open.apply(this, arguments);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (MATCH.test(this.__routilityInvUrl || '')) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') forward(this.__routilityInvUrl, this.responseText);
          else if (this.responseType === 'json' && this.response) forward(this.__routilityInvUrl, JSON.stringify(this.response));
        } catch {}
      });
    }
    return send.apply(this, arguments);
  };

  let exactQueued = false;
  function exactPrices() {
    exactQueued = false;
    if (!document.documentElement.classList.contains('routility-exact-prices') || !window.angular) return;
    for (const span of document.querySelectorAll('.item-card .text-robux-tile')) {
      const text = span.textContent.trim();
      if (!/^\d+(\.\d+)?[KMB]\+?$/.test(text)) continue;
      let price = null;
      try {
        const scope = window.angular.element(span).scope();
        price = scope && scope.item && scope.item.Product ? Number(scope.item.Product.PriceInRobux) : null;
      } catch {}
      if (!(price >= 1000)) continue;
      span.textContent = price.toLocaleString('en-US');
      span.dataset.routilityExact = text;
      span.classList.toggle('routility-exact-long', span.textContent.length > 10);
    }
  }
  new MutationObserver(() => {
    if (exactQueued) return;
    exactQueued = true;
    setTimeout(exactPrices, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const result = origFetch.apply(this, arguments);
    if (MATCH.test(url)) result.then(res => res.clone().text()).then(text => forward(url, text)).catch(() => {});
    return result;
  };
})();
