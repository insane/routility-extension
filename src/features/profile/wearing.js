(function () {
  'use strict';

  const { json } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  let st = null;

  function section() {
    const h = [...document.querySelectorAll('h2')].find(x => x.textContent.trim() === 'Currently Wearing');
    let sec = h;
    while (sec && !(sec.querySelector('[class*="carouselItem"]') && sec.querySelectorAll('h2').length === 1)) sec = sec.parentElement;
    return sec && sec !== document.body ? sec : null;
  }

  function tile(model, gear, thumb) {
    const item = model.cloneNode(true);
    item.classList.add('routility-injected', 'routility-gear-tile');
    item.querySelectorAll('.routility-injected, .restriction-icon, .item-serial-number, .item-card-price').forEach(n => n.remove());
    const link = item.querySelector('a.item-card-link');
    if (link) link.href = `https://www.roblox.com/catalog/${gear.id}/`;
    const name = item.querySelector('.item-card-name');
    if (name) {
      name.textContent = gear.name;
      name.setAttribute('title', '');
      name.removeAttribute('title');
    }
    const holder = item.querySelector('.item-card-thumb-container .thumbnail-2d-container');
    if (holder) {
      holder.classList.remove('shimmer');
      holder.textContent = '';
      const img = document.createElement('img');
      img.className = '';
      img.alt = '';
      if (thumb) img.src = thumb;
      else holder.classList.add('shimmer');
      holder.appendChild(img);
    }
    const inner = item.querySelector('.item-card-thumb-container-inner');
    if (inner && gear.limited) {
      const tag = document.createElement('span');
      tag.className = 'restriction-icon ' + (gear.limited === 'unique' ? 'icon-limited-unique-label' : 'icon-limited-label');
      inner.after(tag);
    }
    const caption = item.querySelector('.item-card-caption');
    if (caption && gear.label) caption.appendChild(gear.label.cloneNode(true));
    return item;
  }

  function priceLabel(details, lowest) {
    const line = document.createElement('div');
    line.className = 'text-overflow item-card-price font-header-2 text-subheader margin-top-none';
    const robux = lowest > 0 ? lowest : details && details.IsForSale && Number(details.PriceInRobux) > 0 ? Number(details.PriceInRobux) : 0;
    if (robux) {
      const icon = document.createElement('span');
      icon.className = 'icon-robux-16x16';
      const n = document.createElement('span');
      n.className = 'text-robux-tile';
      n.textContent = robux.toLocaleString('en-US');
      line.append(icon, n);
    } else {
      const n = document.createElement('span');
      n.className = 'text-label';
      n.textContent = lt('Off Sale');
      line.appendChild(n);
    }
    return line;
  }

  function place() {
    const s = st;
    if (!s || !s.gear || !s.gear.length || document.documentElement.classList.contains('routility-classic-on')) return;
    const sec = section();
    if (!sec) return;
    const items = [...sec.querySelectorAll('[class*="carouselItem"]')];
    const model = items.find(i => !i.classList.contains('routility-gear-tile') && i.querySelector('a.item-card-link'));
    if (!model) return;
    const shown = new Set(items.flatMap(i => [...i.querySelectorAll('a[href*="/catalog/"]')].map(a => (a.getAttribute('href').match(/catalog\/(\d+)/) || [])[1])));
    for (const g of s.gear) {
      if (shown.has(String(g.id))) continue;
      model.parentElement.insertBefore(tile(model, g, s.thumbs[g.id]), model.parentElement.firstChild);
    }
  }

  async function setup(userId) {
    teardown();
    const s = st = { userId: String(userId), gear: null, thumbs: {} };
    const avatar = await json(`https://avatar.roblox.com/v2/avatar/users/${s.userId}/avatar`);
    if (st !== s || !avatar) return;
    const gear = (avatar.assets || []).filter(a => a && a.assetType && a.assetType.id === 19).map(a => ({ id: a.id, name: a.name }));
    if (!gear.length) return;
    const [thumbs, ...details] = await Promise.all([
      window.RoUtilityUI.request({ type: 'getAssetThumbs', ids: gear.map(g => String(g.id)) }, r => r && typeof r === 'object'),
      ...gear.map(g => json(`https://economy.roblox.com/v2/assets/${g.id}/details`)),
    ]);
    if (st !== s) return;
    const lowest = details.map(d => Number(d && d.CollectiblesItemDetails && d.CollectiblesItemDetails.CollectibleLowestResalePrice) || 0);
    gear.forEach((g, i) => {
      const d = details[i];
      g.limited = d && d.IsLimitedUnique ? 'unique' : d && (d.IsLimited || (d.CollectiblesItemDetails && d.CollectiblesItemDetails.IsLimited)) ? 'limited' : '';
      g.label = priceLabel(d, lowest[i]);
    });
    s.thumbs = thumbs || {};
    s.gear = gear;
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!st) return;
    st.observer?.disconnect();
    st = null;
    document.querySelectorAll('.routility-gear-tile').forEach(n => n.remove());
  }

  window.RoUtilityWearing = { setup, teardown };
})();
