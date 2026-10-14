(function () {
  'use strict';

  const { el, dropdown } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PAGE_SIZE = 10;
  const FILTERS = [
    { value: 'premium', name: LT('Plus/Premium') },
    { value: 'all', name: LT('All') },
    { value: 'hoards', name: LT('Hoards') },
  ];

  let state = null;

  function send(msg) {
    return window.RoUtilityUI.request(msg);
  }

  function ago(ts) {
    const s = Math.max(0, Date.now() / 1000 - ts);
    const units = [
      [31536000, n => ltn(n, '{n} year ago', '{n} years ago')],
      [2592000, n => ltn(n, '{n} month ago', '{n} months ago')],
      [604800, n => ltn(n, '{n} week ago', '{n} weeks ago')],
      [86400, n => ltn(n, '{n} day ago', '{n} days ago')],
      [3600, n => ltn(n, '{n} hour ago', '{n} hours ago')],
      [60, n => ltn(n, '{n} minute ago', '{n} minutes ago')],
    ];
    for (const [size, text] of units) {
      const n = Math.floor(s / size);
      if (n >= 1) return text(n);
    }
    return lt('just now');
  }

  function presenceText(row) {
    if (row.presence === 'InStudio') return lt('In Studio');
    if (row.presence === 'InGame') return lt('In game');
    if (row.presence === 'Online') return lt('Online');
    return row.last_online ? lt('Online {time}', { time: ago(row.last_online) }) : null;
  }

  function myUserId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || null;
  }

  function filterOptions(counts) {
    return FILTERS.map(f => ({
      value: f.value,
      label: counts && counts[f.value] != null ? lt('{name} ({count})', { name: lt(f.name), count: window.RoUtilityUI.formatNumber(counts[f.value]) }) : lt(f.name),
    }));
  }

  function ownerRow(row, headshots, me) {
    const li = el('li', 'reseller-item list-item routility-owner-row');
    const ownerId = row.owner_id != null ? String(row.owner_id) : '';
    const known = /^\d+$/.test(ownerId) && !!row.owner_name;
    const profile = known ? `https://www.roblox.com/users/${ownerId}/profile` : null;

    const avatar = el(known ? 'a' : 'span', 'list-header reseller-item-avatar');
    if (known) avatar.href = profile;
    const thumb = el('span', 'thumbnail-2d-container avatar-headshot-md');
    const src = known && headshots[ownerId];
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = '';
      thumb.appendChild(img);
    }
    avatar.appendChild(thumb);
    li.appendChild(avatar);

    const info = el('div', 'resale-info');
    const nameWrap = el('div', 'item-reseller-container');
    if (known) {
      const a = el('a', 'text-name username', row.owner_name);
      a.href = profile;
      nameWrap.appendChild(a);
    } else {
      nameWrap.appendChild(el('span', 'text-name username', lt('Hidden')));
    }
    info.appendChild(nameWrap);

    const details = [row.serial != null ? lt('Serial #{serial}', { serial: row.serial }) : lt('Serial N/A')];
    if (row.hoard_count > 1) details.push(ltn(row.hoard_count, '{n} copy', '{n} copies'));
    const presence = known && presenceText(row);
    if (presence) details.push(presence);
    info.appendChild(el('span', 'separator', '-'));
    info.appendChild(el('span', 'font-caption-body serial-number', details.join(' • ')));

    const since = el('div', 'reseller-price-container routility-owned-since');
    if (row.ts) since.appendChild(el('span', 'font-caption-body', lt('Owned {time}', { time: ago(row.ts) })));
    info.appendChild(since);
    li.appendChild(info);

    const buttons = el('div', 'reseller-buttons-container');
    if (known && ownerId !== me) {
      const trade = el('button', 'btn-min-width btn-buy-md routility-trade-button', lt('Trade'));
      trade.type = 'button';
      trade.addEventListener('click', () => {
        location.href = `https://www.roblox.com/users/${ownerId}/trade`;
      });
      buttons.appendChild(trade);
    }
    li.appendChild(buttons);
    return li;
  }

  async function load(reset) {
    const s = state;
    if (!s) return;
    if (!reset && s.loading) return;
    const token = ++s.token;
    s.loading = true;
    if (reset) {
      s.page = 0;
      s.list.textContent = '';
    }
    s.empty.hidden = true;
    s.more.hidden = true;
    s.spinner.hidden = false;
    const data = await send({ type: 'getOwners', id: s.itemId, filter: s.filter, page: s.page });
    const ids = data ? [...new Set(data.uaids.filter(r => r.owner_id != null).map(r => String(r.owner_id)))] : [];
    const headshots = ids.length ? (await send({ type: 'getHeadshots', ids })) || {} : {};
    if (state !== s || token !== s.token) return;
    s.spinner.hidden = true;
    s.loading = false;
    if (!data) {
      s.empty.textContent = lt('Couldn’t load owners right now. Try again in a minute.');
      s.empty.hidden = false;
      s.more.hidden = s.list.children.length === 0;
      return;
    }
    if (data.counts) {
      s.counts = data.counts;
      s.filterDropdown.setOptions(filterOptions(s.counts));
    }
    const me = myUserId();
    for (const row of data.uaids) s.list.appendChild(ownerRow(row, headshots, me));
    s.page += 1;
    s.more.hidden = !data.hasMore;
    s.empty.textContent = lt('No owners to show.');
    s.empty.hidden = s.list.children.length > 0;
  }

  function applyMode() {
    const s = state;
    if (!s || !s.section) return;
    const owners = s.mode === 'owners';
    s.section.classList.toggle('routility-owners-mode', owners);
    if (owners && !s.loadedOnce) {
      s.loadedOnce = true;
      load(true);
    }
  }

  function ensureInjected() {
    const s = state;
    if (!s) return;
    const section = document.querySelector('#resellers');
    const header = section?.querySelector('.container-header');
    const content = section?.querySelector('.section-content');
    if (!header || !content) return;
    if (section === s.section && header.querySelector('.routility-owners-mode-dropdown') && content.contains(s.panel)) {
      if (section.classList.contains('routility-owners-mode') !== (s.mode === 'owners')) applyMode();
      return;
    }

    s.section = section;
    header.querySelectorAll('.routility-injected').forEach(n => n.remove());

    const modeDropdown = dropdown(
      [{ value: 'resellers', label: lt('Resellers') }, { value: 'owners', label: lt('Owners') }],
      s.mode,
      (mode) => { s.mode = mode; applyMode(); },
      'routility-owners-mode-dropdown'
    );
    s.filterDropdown = dropdown(filterOptions(s.counts), s.filter, (filter) => { s.filter = filter; load(true); }, 'routility-owners-filter');
    header.prepend(s.filterDropdown, modeDropdown);
    header.appendChild(el('h2', 'routility-owners-title routility-injected', lt('Owners')));

    content.appendChild(s.panel);
    window.RoUtilityUI.mark('owners');
    applyMode();
  }

  function buildPanel(s) {
    s.panel = el('div', 'routility-owners routility-injected');
    const wrap = el('div', 'resellers');
    s.list = el('ul', 'vlist');
    wrap.appendChild(s.list);
    s.panel.appendChild(wrap);
    s.spinner = el('span', 'spinner spinner-default routility-owners-spinner');
    s.spinner.hidden = true;
    s.panel.appendChild(s.spinner);
    s.empty = el('p', 'section-content-off routility-owners-empty', lt('No owners to show.'));
    s.empty.hidden = true;
    s.panel.appendChild(s.empty);
    s.more = el('button', 'btn-control-sm routility-see-more', lt('See More'));
    s.more.type = 'button';
    s.more.hidden = true;
    s.more.addEventListener('click', () => load(false));
    s.panel.appendChild(s.more);
  }

  function teardown() {
    if (!state) return;
    state.observer?.disconnect();
    state.section?.classList.remove('routility-owners-mode');
    state = null;
  }

  function setup(itemId) {
    teardown();
    const s = {
      itemId,
      mode: 'resellers',
      filter: 'premium',
      page: 0,
      counts: null,
      loading: false,
      loadedOnce: false,
      token: 0,
      section: null,
    };
    buildPanel(s);
    state = s;
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(ensureInjected));
    s.observer.observe(document.querySelector('#item-details-container') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    ensureInjected();
  }

  window.RoUtilityOwners = { setup, teardown };
})();
