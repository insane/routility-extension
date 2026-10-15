(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  const OURS = {
    calc: { href: '/trades/calculator', label: LT('Trade Calculator'), icon: 'routility-calc-nav-icon', flags: ['tradeCalculator', 'calcNav'], after: 'trade', page: /^\/trades\/calculator\/?$/i },
    ads: { href: '/trade-ads', label: LT('Trade Ads'), icon: 'routility-ads-nav-icon', flags: ['tradeAds', 'tradeAdsNav'], after: 'calc', page: /^\/trade-ads\/?$/i },
    forum: { href: '/forum', label: LT('Forum'), icon: 'routility-forum-nav-icon', flags: ['forum', 'forumNav'], after: 'communities', page: /^\/forum(\/|$)/i },
  };
  const IDS = { home: 'nav-home', profile: 'nav-profile', messages: 'nav-message', friends: 'nav-friends', avatar: 'nav-character', inventory: 'nav-inventory', trade: 'nav-trade', communities: 'nav-group', newsroom: 'nav-blog', store: 'nav-shop', giftcards: 'nav-giftcards' };
  const DEFAULT_LAYOUT = { order: [], hidden: ['promo', 'store', 'newsroom', 'giftcards'] };
  let settings = {};
  let layout = null;

  function keyOf(li) {
    if (li.dataset.rtNav) return li.dataset.rtNav;
    if (li.classList.contains('rbx-upgrade-now')) return 'promo';
    const a = li.querySelector(':scope > a, :scope > button');
    return a ? Object.keys(IDS).find(k => IDS[k] === a.id) || null : null;
  }

  function make(template, key) {
    const it = OURS[key];
    const li = template.cloneNode(true);
    li.dataset.rtNav = key;
    li.classList.add('routility-injected', 'routility-oldnav-item');
    const a = li.querySelector(':scope > a');
    a.id = 'nav-routility-' + key;
    a.href = 'https://www.roblox.com' + it.href;
    a.target = '_self';
    a.querySelectorAll('.dynamic-width-item').forEach(n => n.remove());
    const holder = a.querySelector(':scope > div');
    if (holder) holder.replaceChildren(Object.assign(document.createElement('span'), { className: 'routility-oldnav-icon ' + it.icon }));
    const label = a.querySelector('.dynamic-ellipsis-item');
    if (label) {
      label.textContent = lt(it.label);
      label.title = lt(it.label);
    }
    return li;
  }

  function run() {
    const ul = document.querySelector('ul.left-col-list');
    if (!ul) return;
    const mine = [...ul.querySelectorAll(':scope > li.routility-oldnav-item')];
    if (settings.oldLeftNav !== true) {
      mine.forEach(n => n.remove());
      ul.querySelectorAll(':scope > .routility-oldnav-hidden').forEach(n => n.classList.remove('routility-oldnav-hidden'));
      return;
    }
    const template = ul.querySelector('#nav-trade')?.closest('li');
    if (!template) return;
    for (const [key, it] of Object.entries(OURS)) {
      const on = !it.flags.some(f => settings[f] === false);
      let li = ul.querySelector(`:scope > li[data-rt-nav="${key}"]`);
      if (!on) {
        li?.remove();
        continue;
      }
      if (!li) {
        li = make(template, key);
        const anchor = [...ul.children].find(n => keyOf(n) === it.after) || template;
        anchor.after(li);
      }
      li.querySelector(':scope > a').classList.toggle('active', it.page.test(location.pathname));
    }
    const lay = layout || DEFAULT_LAYOUT;
    const order = Array.isArray(lay.order) ? lay.order.map(String) : [];
    const hidden = new Set(Array.isArray(lay.hidden) ? lay.hidden.map(String) : []);
    const items = [...ul.children];
    if (order.length) {
      const ranked = items.map((li, i) => {
        const at = order.indexOf(keyOf(li));
        return { li, rank: at >= 0 ? at : 1000 + i };
      }).sort((a, b) => a.rank - b.rank).map(x => x.li);
      if (ranked.some((li, i) => li !== items[i])) ul.append(...ranked);
    }
    for (const li of ul.children) {
      const key = keyOf(li);
      li.classList.toggle('routility-oldnav-hidden', !!key && !OURS[key] && hidden.has(key));
    }
  }

  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  chrome.storage.local.get(['routilitySettings', 'routilityNavLayout'], (st) => {
    settings = st.routilitySettings || {};
    layout = st.routilityNavLayout || null;
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.routilitySettings) settings = changes.routilitySettings.newValue || {};
    if (changes.routilityNavLayout) layout = changes.routilityNavLayout.newValue || null;
    if (changes.routilitySettings || changes.routilityNavLayout) tick();
  });
})();
