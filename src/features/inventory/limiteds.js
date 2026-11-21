(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, onFrame, formatNumber, collectibles } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/inventory/i;
  const ON = 'routility-inv-lim-on';
  const PER = 30;
  let on = true;
  let active = false;
  let data = null;
  let loading = null;
  let page = 0;
  let crumb = null;

  function userId() {
    return (location.pathname.match(PATH) || [])[1] || null;
  }

  function load(id) {
    if (data && data.id === id) return Promise.resolve(data);
    if (loading && loading.id === id) return loading.job;
    const job = collectibles(id, { pages: 30 }).then((r) => {
      data = { id, status: r.status, items: (r.items || []).filter(x => !x.bundle) };
      return data;
    });
    loading = { id, job };
    return job;
  }

  const pics = new Map();
  const asking = new Map();

  function thumbs(ids) {
    const need = ids.filter(id => !pics.has(id) && !asking.has(id));
    for (let i = 0; i < need.length; i += 100) {
      const part = need.slice(i, i + 100);
      const body = part.map(id => ({ requestId: id, type: 'Asset', targetId: Number(id), size: '150x150', format: 'webp' }));
      const job = fetch('https://thumbnails.roblox.com/v1/batch', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => (r.ok ? r.json() : null))
        .then((d) => { for (const t of (d && d.data) || []) if (t.imageUrl) pics.set(String(t.targetId), t.imageUrl); })
        .catch(() => {})
        .finally(() => part.forEach(id => asking.delete(id)));
      part.forEach(id => asking.set(id, job));
    }
    return Promise.all(ids.map(id => asking.get(id)).filter(Boolean));
  }

  function fillPics(list) {
    for (const img of list.querySelectorAll('img[data-for]')) {
      const src = pics.get(img.dataset.for);
      if (src && !img.src) img.src = src;
    }
  }

  function card(it, src) {
    const li = el('li', 'list-item item-card routility-inv-lim-card');
    const box = el('div', 'item-card-container');
    const a = el('a', 'item-card-link');
    a.href = `https://www.roblox.com/catalog/${it.targetId}/`;
    const wrap = el('div', 'item-card-thumb-container');
    const thumb = el('span', 'item-card-thumb');
    const holder = el('span', 'thumbnail-2d-container');
    const img = el('img');
    img.alt = '';
    img.dataset.for = it.targetId;
    if (src) img.src = src;
    holder.appendChild(img);
    thumb.appendChild(holder);
    wrap.appendChild(thumb);
    if (it.serial) wrap.appendChild(el('span', 'routility-inv-lim-serial', '#' + formatNumber(it.serial)));
    const name = el('div', 'item-card-name');
    name.title = it.name;
    if (it.onHold) {
      const clock = el('span', 'icon icon-filled-clock routility-inv-lim-hold');
      clock.setAttribute('role', 'img');
      clock.setAttribute('aria-label', lt('On hold'));
      clock.dataset.rtTip = lt('On hold, can’t be traded yet');
      name.appendChild(clock);
    }
    name.appendChild(el('span', null, it.name));
    a.append(wrap, name);
    const price = el('div', 'text-overflow item-card-price');
    price.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', formatNumber(it.rap)));
    box.append(a, price);
    li.appendChild(box);
    return li;
  }

  function pager(total, list, holder) {
    const pages = Math.max(1, Math.ceil(total / PER));
    holder.textContent = '';
    if (pages <= 1) return;
    const ul = el('ul', 'pager');
    const btn = (side, disabled, step) => {
      const li = el('li', 'pager-' + side + (disabled ? ' disabled' : ''));
      const b = el('button', 'btn-generic-' + (side === 'prev' ? 'left' : 'right') + '-sm');
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-label', side === 'prev' ? lt('Previous page') : lt('Next page'));
      b.appendChild(el('span', side === 'prev' ? 'icon-left' : 'icon-right'));
      b.addEventListener('click', () => {
        page += step;
        render();
        const top = document.querySelector('.current-items') || list;
        if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      li.appendChild(b);
      return li;
    };
    ul.appendChild(btn('prev', page === 0, -1));
    const cur = el('li', 'pager-cur');
    cur.appendChild(el('span', null, String(page + 1)));
    ul.appendChild(cur);
    ul.appendChild(btn('next', page >= pages - 1, 1));
    holder.appendChild(ul);
  }

  async function render() {
    const grid = document.querySelector('#assetsItems');
    if (!grid || !active) return;
    let list = document.querySelector('.routility-inv-lim-list');
    let holder = document.querySelector('.routility-inv-lim-pager');
    let note = document.querySelector('.routility-inv-lim-note');
    if (!list) {
      list = el('ul', 'hlist item-cards item-cards-embed routility-injected routility-inv-lim-list');
      holder = el('div', 'pager-holder routility-injected routility-inv-lim-pager');
      note = el('p', 'text-body-medium content-muted routility-injected routility-inv-lim-note');
      grid.after(note, list, holder);
    }
    const id = userId();
    if (!data || data.id !== id) {
      note.textContent = lt('Loading limiteds…');
      list.textContent = '';
      holder.textContent = '';
    }
    const d = await load(id);
    if (!active || userId() !== id) return;
    if (d.status === 'private') { note.textContent = lt('This inventory is private.'); return; }
    if (!d.items.length) { note.textContent = d.status === 'ok' ? lt('No limiteds yet.') : lt('Couldn’t load limiteds. Try again.'); return; }
    const items = d.items.slice().sort((a, b) => b.rap - a.rap);
    page = Math.min(page, Math.ceil(items.length / PER) - 1);
    const shown = items.slice(page * PER, page * PER + PER);
    note.textContent = '';
    const count = document.querySelector('.routility-inv-lim-count');
    if (count) count.textContent = formatNumber(items.length);
    list.replaceChildren(...shown.map(it => card(it, pics.get(it.targetId))));
    pager(items.length, list, holder);
    const ids = [...new Set(shown.map(x => x.targetId))];
    thumbs(ids).then(() => { if (active) fillPics(list); });
    const next = items.slice((page + 1) * PER, (page + 2) * PER).map(x => x.targetId);
    if (next.length) thumbs([...new Set(next)]);
  }

  function setActive(want) {
    if (active === want) return;
    active = want;
    document.documentElement.classList.toggle(ON, want);
    const entry = document.querySelector('.routility-inv-lim-entry');
    entry?.classList.toggle('active', want);
    const menu = entry?.parentElement;
    menu?.querySelectorAll(':scope > li.menu-option:not(.routility-inv-lim-entry)').forEach(li => li.classList.toggle('routility-inv-lim-muted', want));
    const bc = document.querySelector('.current-items .breadcrumb-container, .breadcrumb-container');
    if (want && bc) {
      if (!crumb) crumb = bc.innerHTML;
      const step = el('li');
      step.append(el('span', null, lt('Limiteds')), el('span', 'routility-inv-lim-count'));
      bc.replaceChildren(step);
    } else if (!want && bc && crumb !== null) {
      bc.innerHTML = crumb;
      crumb = null;
    }
    if (want) {
      page = 0;
      render();
    } else {
      document.querySelectorAll('.routility-inv-lim-list, .routility-inv-lim-pager, .routility-inv-lim-note').forEach(n => n.remove());
    }
  }

  function place() {
    if (!on || !PATH.test(location.pathname)) return;
    const menu = document.querySelector('ul.menu-vertical.submenus');
    if (!menu || menu.querySelector('.routility-inv-lim-entry')) return;
    const li = el('li', 'menu-option routility-injected routility-inv-lim-entry');
    const a = el('a', 'menu-option-content');
    a.href = '#';
    a.appendChild(el('span', 'menu-text font-caption-header', lt('Limiteds')));
    li.appendChild(a);
    li.addEventListener('mouseenter', () => {
      const plain = [...menu.querySelectorAll(':scope > li.menu-option:not(.routility-inv-lim-entry)')].find(n => !n.querySelector('.menu-secondary-container'));
      const target = plain && (plain.querySelector(':scope > a') || plain);
      if (target) target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: li }));
    });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      a.blur();
      setActive(true);
    });
    const acc = menu.querySelector(':scope > li.menu-option > a[href="#!/accessories"]')?.parentElement;
    menu.insertBefore(li, acc ? acc.nextElementSibling : menu.firstElementChild);
    menu.addEventListener('click', (e) => {
      if (!e.target.closest('.routility-inv-lim-entry') && e.target.closest('li.menu-option, li.menu-secondary-option')) setActive(false);
    });
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).inventoryLimiteds !== false;
    if (!on) return;
    const tick = onFrame(place);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setActive(false));
    tick();
  });
})();
