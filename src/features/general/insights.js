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
  const WHO = { AllUsers: LT('Everyone'), All: LT('Everyone'), FriendsFollowingAndFollowers: LT('Friends & Follows'), FriendsAndFollowing: LT('Friends & Following'), Friends: LT('Friends'), Following: LT('People I Follow'), NoOne: LT('No One') };
  const SETTINGS_URL = 'https://apis.roblox.com/user-settings-api/v1/user-settings';
  let csrf = '';

  async function save(key, value) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(SETTINGS_URL, { method: 'POST', credentials: 'include', headers: Object.assign({ 'content-type': 'application/json' }, csrf ? { 'x-csrf-token': csrf } : {}), body: JSON.stringify({ [key]: value }) });
        if (r.status === 403 && r.headers.get('x-csrf-token')) { csrf = r.headers.get('x-csrf-token'); continue; }
        return r.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  let filterAsked = 0;
  let filterData = null;

  function tradeFilter() {
    const header = document.querySelector('.trades-header');
    if (!header) return;
    if (!filterData || Date.now() - filterAsked > 60000) {
      if (Date.now() - filterAsked > 60000) {
        filterAsked = Date.now();
        cache.delete(SETTINGS_URL + '/settings-and-options');
        get(SETTINGS_URL + '/settings-and-options').then((d) => { if (d) filterData = d; tradeFilter(); });
      }
      if (!filterData) return;
    }
    const d = filterData;
    const quality = d.tradeQualityFilter && FILTER[d.tradeQualityFilter.currentValue] ? d.tradeQualityFilter : null;
    const who = d.whoCanTradeWithMe && WHO[d.whoCanTradeWithMe.currentValue] ? d.whoCanTradeWithMe : null;
    if (!quality && !who) return;
    const host = document.querySelector('.routility-trade-allowance');
    const key = (quality ? quality.currentValue : '') + '|' + (who ? who.currentValue : '') + '|' + (host ? 'in' : 'own');
    let part = document.querySelector('.routility-trade-prefs');
    if (part && part.dataset.key === key && (host ? part.parentElement === host : part.previousElementSibling === header)) return;
    if (part && part.querySelector('.routility-trade-pill-busy, .dropdown-menu[style*="block"]')) return;
    part?.remove();
    part = el('span', 'routility-injected routility-trade-prefs' + (host ? '' : ' routility-trade-prefs-own text-body-small'));
    part.dataset.key = key;
    const pill = (label, setting, names, field) => {
      const box = el('div', 'routility-trade-pill routility-trade-pill-pick');
      const opts = (setting.options || []).filter(o => !o.requirement || o.requirement === 'SelfUpdateSetting' || o.requirement === 'Inherited').map(o => o.option.optionValue).filter(v => names[v]);
      if (!opts.includes(setting.currentValue)) opts.unshift(setting.currentValue);
      let saved = setting.currentValue;
      const dd = window.RoUtilityUI.dropdown(opts.map(v => ({ value: v, label: lt(names[v]) })), saved, async (value) => {
        box.classList.remove('routility-trade-pill-bad');
        box.classList.add('routility-trade-pill-busy');
        const ok = await save(field, value);
        box.classList.remove('routility-trade-pill-busy');
        if (ok) {
          saved = value;
          setting.currentValue = value;
          part.dataset.key = (d.tradeQualityFilter ? d.tradeQualityFilter.currentValue : '') + '|' + (d.whoCanTradeWithMe ? d.whoCanTradeWithMe.currentValue : '') + '|' + (host ? 'in' : 'own');
          delete box.dataset.rtTip;
        } else {
          dd.setValue(saved);
          box.classList.add('routility-trade-pill-bad');
          box.dataset.rtTip = lt('Roblox didn’t save that. Try again.');
        }
      }, 'routility-trade-pill-dd');
      box.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) dd.querySelector('.input-dropdown-btn').click();
      });
      box.append(el('span', 'routility-trade-pill-label', label), dd);
      return box;
    };
    if (quality) part.appendChild(pill(lt('Filter'), quality, FILTER, 'tradeQualityFilter'));
    if (who) part.appendChild(pill(lt('From'), who, WHO, 'whoCanTradeWithMe'));
    if (host) host.appendChild(part);
    else header.after(part);
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
