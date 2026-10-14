(function () {
  'use strict';

  const MATCH = /^https:\/\/apis\.roblox\.com\/transaction-records\/v1\/users\/\d+\/transactions\?/;

  function note(url) {
    const text = String(url || '');
    if (MATCH.test(text)) document.documentElement.dataset.routilityTxUrl = text;
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    note(url);
    return open.apply(this, arguments);
  };

  const fetchFn = window.fetch;
  window.fetch = function (input) {
    note(typeof input === 'string' ? input : input && input.url);
    return fetchFn.apply(this, arguments);
  };
})();
