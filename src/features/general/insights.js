(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const settings = { storePlusPrice: true, tradeFilterInfo: true, usernamePrice: true };
  const cache = new Map();

  function get(url) {
    if (!cache.has(url)) cache.set(url, fetch(url, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null));
    return cache.get(url);
  }

  function plusPrices() {
    for (const btn of document.querySelectorAll('.store-card .PurchaseButton[data-discount-information]:not([data-rt-was])')) {
      btn.dataset.rtWas = '1';
      let info = null;
      try { info = JSON.parse(btn.dataset.discountInformation); } catch {}
      const was = info && Number(info.originalPrice);
      const now = Number(btn.dataset.expectedPrice);
      const price = btn.closest('.store-card')?.querySelector('.store-card-price');
      if (!price || !(was > now) || price.querySelector('.routility-plus-was')) continue;
      const old = el('span', 'routility-injected routility-plus-was', formatNumber(was));
      old.dataset.rtTip = lt('Roblox Plus saves you {n} Robux', { n: formatNumber(was - now) });
      price.appendChild(old);
    }
  }

  const FILTER = { None: LT('Off'), Off: LT('Off'), Low: LT('Low'), Medium: LT('Medium'), High: LT('High') };
  const WHO = { AllUsers: LT('Everyone'), All: LT('Everyone'), Friends: LT('Friends'), FriendsAndFollowing: LT('Friends and people you follow'), Following: LT('People you follow'), NoOne: LT('No one') };

  let filterAsked = 0;
  let filterData = null;

  function tradeFilter() {
    const header = document.querySelector('.trades-header');
    if (!header) return;
    if (!filterData || Date.now() - filterAsked > 60000) {
      if (Date.now() - filterAsked > 60000) {
        filterAsked = Date.now();
        cache.delete('https://apis.roblox.com/user-settings-api/v1/user-settings');
        get('https://apis.roblox.com/user-settings-api/v1/user-settings').then((d) => { filterData = d; tradeFilter(); });
      }
      if (!filterData) return;
    }
    const d = filterData;
    const quality = FILTER[d.tradeQualityFilter];
    const who = WHO[d.whoCanTradeWithMe];
    if (!quality && !who) return;
    const anchor = document.querySelector('.routility-trade-allowance') || header;
    const key = (quality || '') + '|' + (who || '');
    let part = document.querySelector('.routility-trade-filter');
    if (part && part.dataset.key === key && part.previousElementSibling === anchor) return;
    part?.remove();
    part = el('a', 'routility-injected routility-trade-filter text-body-small');
    part.href = '/my/account#!/privacy';
    part.dataset.key = key;
    part.dataset.rtTip = lt('Change these in Privacy settings');
    const bits = [];
    if (quality) bits.push(lt('Filter: {level}', { level: lt(quality) }));
    if (who) bits.push(lt('Trades from: {who}', { who: lt(who) }));
    bits.forEach((t, i) => {
      if (i) part.appendChild(el('span', 'routility-trade-filter-sep'));
      part.appendChild(el('span', null, t));
    });
    anchor.after(part);
  }

  function usernamePrice() {
    const row = document.getElementById('account-field-username');
    const meta = row && row.querySelector('.account-settings-value-metadata-container');
    if (!meta || meta.querySelector('.routility-uname-price')) return;
    const tag = el('span', 'routility-injected routility-uname-price routility-uname-hold');
    meta.appendChild(tag);
    get('https://auth.roblox.com/v1/username/change/price').then((d) => {
      if (!tag.isConnected || !d) { tag.remove(); return; }
      tag.classList.remove('routility-uname-hold');
      if (d.isFreeUsernameChange) {
        tag.textContent = lt('Your next change is free');
        return;
      }
      const now = Number(d.priceInRobux);
      const base = Number(d.basePriceInRobux);
      if (!(now > 0)) { tag.remove(); return; }
      tag.append(document.createTextNode(lt('Changing costs')), el('span', 'icon-robux-16x16 routility-uname-icon'), el('strong', null, formatNumber(now)));
      if (base > now) tag.appendChild(el('span', 'routility-plus-was', formatNumber(base)));
    });
  }

  function route() {
    const path = location.pathname;
    if (settings.storePlusPrice && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/\d+/i.test(path)) plusPrices();
    if (settings.tradeFilterInfo && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?trades\/?$/i.test(path)) tradeFilter();
    if (settings.usernamePrice && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?my\/account/i.test(path) && /^#!\/info/.test(location.hash || '#!/info')) usernamePrice();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    const tick = onFrame(route);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
})();
