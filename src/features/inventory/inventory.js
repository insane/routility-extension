(function () {
  'use strict';

  const { el, formatUSD, cardKey, prices, priceTitle, itemValue, valueTag, shows } = window.RoUtilityUI;
  const showing = shows(() => (/^\/(catalog|bundles|marketplace)\b/i.test(location.pathname) ? 'Market' : /^\/users\/\d+\/profile/i.test(location.pathname) ? 'Profile' : 'Inventory'));
  const LOGO_URL = chrome.runtime.getURL('assets/icons/logo.png');
  let observer = null;

  function usdLine(card, key, price) {
    let line = card.querySelector('.routility-card-usd');
    const text = price ? (showing.usd ? formatUSD(price.usd) : '') + '|' + (showing.value ? itemValue(price) : '') : '';
    if (line && line.dataset.key === (key || '') && line.dataset.text === text) return;
    if (!line) {
      const anchor = card.querySelector('.item-card-price:not(.routility-card-usd)');
      line = el('div', (anchor ? anchor.className : 'text-overflow item-card-price font-header-2 text-subheader margin-top-none') + ' routility-injected routility-card-usd');
      if (anchor) anchor.after(line);
      else (card.querySelector('.item-card-caption') || card.querySelector('.item-card-container') || card).appendChild(line);
    }
    line.dataset.key = key || '';
    line.dataset.text = text;
    line.dataset.rtTip = priceTitle(price);
    line.textContent = '';
    if (price) {
      const logo = el('img', 'routility-logo');
      logo.src = LOGO_URL;
      logo.alt = '';
      if (showing.usd) line.append(logo, el('span', 'text-robux-tile', formatUSD(price.usd)));
      if (showing.value && itemValue(price)) line.appendChild(valueTag(itemValue(price), { short: true, className: 'routility-card-val text-robux-tile' }));
      if (!line.childNodes.length) line.appendChild(el('span', 'text-robux-tile', '\u00a0'));
    } else {
      line.appendChild(el('span', 'text-robux-tile', ' '));
    }
  }

  async function scan() {
    const units = new Set();
    for (const c of document.querySelectorAll('.list-item.item-card, .item-card-container')) {
      if (c.closest('.trade-request-window-offer, .trade-list-detail-offer')) continue;
      units.add(c.closest('.list-item.item-card, .catalog-item-container') || c);
    }
    const cards = [...units].filter((u) => {
      const up = u.parentElement && u.parentElement.closest('.list-item.item-card, .catalog-item-container, .item-card-container');
      return !(up && units.has(up));
    });
    if (cards.length) window.RoUtilityUI.mark('cards-dom');
    if (!cards.length) return;
    const keys = cards.map(cardKey);
    if (keys.some(Boolean)) window.RoUtilityUI.mark('cards-keyed');
    const found = await prices(keys);
    if (found.some(p => p === undefined)) setTimeout(schedule, 2500);
    const byCard = new Map(cards.map((c, i) => [c, { key: keys[i], price: found[i] }]));
    const lists = new Map();
    for (const c of cards) {
      const group = lists.get(c.parentElement);
      if (group) group.push(c);
      else lists.set(c.parentElement, [c]);
    }
    for (const listCards of lists.values()) {
      const anyPriced = listCards.some(c => byCard.get(c).price);
      for (const card of listCards) {
        if (!card.isConnected) continue;
        const { key, price } = byCard.get(card);
        if (cardKey(card) !== key) continue;
        if (anyPriced) { usdLine(card, key, price); window.RoUtilityUI.cardTags(card, price); window.RoUtilityUI.mark('cards'); }
        else card.querySelector('.routility-card-usd')?.remove();
      }
    }
  }

  const schedule = window.RoUtilityUI.onFrame(() => scan());

  function setup() {
    if (observer) return;
    observer = new MutationObserver((records) => { if (window.RoUtilityUI.foreign(records)) schedule(); });
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    schedule();
  }

  function teardown() {
    observer?.disconnect();
    observer = null;
  }

  window.RoUtilityInventory = { setup, teardown, refresh: () => { if (observer) schedule(); } };
})();
