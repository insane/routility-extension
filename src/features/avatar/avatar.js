(function () {
  'use strict';

  const { el, onFrame, formatUSD, formatNumber, prices, request } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  let state = null;

  const CARD = '.tab-pane.active .avatar-item-list .hlist > li.item-card';

  function cardText(li) {
    if (!li.dataset.routilitySearch) {
      const name = li.querySelector('.item-card-name')?.textContent || li.querySelector('[data-item-name]')?.dataset.itemName || '';
      const id = (li.querySelector('a[href*="/catalog/"], a[href*="/bundles/"]')?.getAttribute('href') || '').match(/\/(?:catalog|bundles)\/(\d+)/);
      li.dataset.routilitySearch = (name + ' ' + (id ? id[1] : '')).toLowerCase();
    }
    return li.dataset.routilitySearch;
  }

  function apply() {
    const s = state;
    if (!s) return;
    ensureBox();
    const q = s.query;
    const cards = [...document.querySelectorAll(CARD)];
    let shown = 0;
    for (const li of cards) {
      const name = li.querySelector('.item-card-name')?.textContent || '';
      if (li.dataset.routilityName !== name) {
        li.dataset.routilityName = name;
        delete li.dataset.routilitySearch;
      }
      const miss = (!!q && !q.split(/\s+/).every(w => cardText(li).includes(w))) || !passesFilter(s, li);
      li.classList.toggle('routility-av-miss', miss);
      if (!miss) shown++;
    }
    document.documentElement.classList.toggle('routility-av-searching', isActive(s));
    if (cards.length !== s.lastCount) {
      s.lastCount = cards.length;
      s.lastGrowth = Date.now();
    }
    status(shown, cards.length);
  }

  function status(shown, total) {
    const s = state;
    const list = document.querySelector('.tab-pane.active #avatar-items-container .avatar-item-list');
    let row = document.querySelector('.routility-av-status');
    const count = document.querySelector('.routility-av-count');
    if (count) {
      const text = isActive(s) ? `• ${ltn(shown, '{n} result', '{n} results')}` : '';
      if (count.textContent !== text) count.textContent = text;
    }
    if (!isActive(s) || !list) {
      row?.remove();
      clearTimeout(s.settle);
      return;
    }
    if (!row || row.previousElementSibling !== list) {
      row?.remove();
      row = el('div', 'routility-injected routility-av-status');
      list.after(row);
    }
    const loading = Date.now() - s.lastGrowth < 1500;
    const want = loading ? 'loading' : shown ? 'done' : 'empty';
    const text = want === 'empty' ? (s.query ? lt('No items match "{query}".', { query: s.query }) : lt('No items match these filters.')) : '';
    if (row.dataset.state !== want || row.dataset.text !== text) {
      row.dataset.state = want;
      row.dataset.text = text;
      row.textContent = '';
      if (want === 'loading') {
        const tiles = el('ul', 'hlist routility-av-sk');
        for (let i = 0; i < 7; i++) {
          const li = el('li', 'routility-av-sk-card');
          li.append(el('span', 'routility-sk routility-av-sk-thumb'), el('span', 'routility-sk routility-av-sk-line'));
          tiles.appendChild(li);
        }
        row.appendChild(tiles);
      } else if (text) {
        row.appendChild(el('p', 'text-secondary routility-av-empty', text));
      }
    }
    clearTimeout(s.settle);
    if (loading) s.settle = setTimeout(schedule, 1600 - (Date.now() - s.lastGrowth));
  }

  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const BY_SUB = new Set(['body', 'clothing', 'accessories']);
  const NAMES = { recent: LT('recent items') };

  function placeholder() {
    const parts = [...document.querySelectorAll('#avatar-web-app .breadcrumb-container li')].map(l => l.textContent.trim()).filter(Boolean);
    const top = (parts[0] || '').toLowerCase();
    const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    const sub = last && last !== 'all' ? (top === 'accessories' ? lt('{type} accessories', { type: last }) : last) : '';
    const name = BY_SUB.has(top) && sub ? sub : NAMES[top] ? lt(NAMES[top]) : top;
    return name ? lt('Search {name}', { name }) : lt('Search');
  }

  function filterCount(s) {
    return (s.filter.show !== 'all' ? 1 : 0) + (s.filter.limited ? 1 : 0);
  }

  function isActive(s) {
    return !!s.query || filterCount(s) > 0;
  }

  function passesFilter(s, li) {
    const f = s.filter;
    if (f.show !== 'all') {
      const worn = !!li.querySelector('.item-card-equipped[data-item-status="equipped"]');
      if (f.show === 'wearing' ? !worn : worn) return false;
    }
    if (f.limited && !li.querySelector('.restriction-icon[class*="icon-limited"]')) return false;
    return true;
  }

  function closeFilterMenu() {
    const s = state;
    if (!s || !s.menu) return;
    s.menu.remove();
    s.menu = null;
    document.querySelector('.routility-av-filter-btn')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', s.onOutside, true);
    document.removeEventListener('keydown', s.onEsc, true);
    if (s.untrack) s.untrack();
    s.untrack = null;
  }

  function menuItem(label, checked, onPick) {
    const item = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small gap-x-medium radius-medium routility-av-filter-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', String(checked));
    item.appendChild(el('div', STATE_LAYER));
    item.appendChild(el('span', 'grow-1 content-emphasis', label));
    const tick = el('span', 'routility-av-filter-tick');
    tick.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    tick.style.visibility = checked ? 'visible' : 'hidden';
    item.appendChild(tick);
    item.addEventListener('click', onPick);
    return item;
  }

  function renderFilterMenu() {
    const s = state;
    if (!s || !s.menu) return;
    const menu = s.menu.querySelector('.routility-av-filter-menu');
    menu.textContent = '';
    menu.appendChild(el('div', 'text-label-small content-muted routility-av-filter-head', lt('Show')));
    for (const [value, label] of [['all', lt('All items')], ['wearing', lt('Wearing')], ['not', lt('Not wearing')]]) {
      menu.appendChild(menuItem(label, s.filter.show === value, () => setFilter({ show: value })));
    }
    menu.appendChild(el('div', 'routility-av-filter-sep'));
    menu.appendChild(menuItem(lt('Limiteds only'), s.filter.limited, () => setFilter({ limited: !s.filter.limited })));
    if (filterCount(s)) {
      menu.appendChild(el('div', 'routility-av-filter-sep'));
      const reset = el('button', 'foundation-web-link bg-none stroke-none appearance-none inline-flex items-center content-emphasis no-underline hover:underline cursor-pointer text-body-medium routility-av-filter-clear', lt('Clear filters'));
      reset.type = 'button';
      reset.addEventListener('click', () => setFilter({ show: 'all', limited: false }));
      menu.appendChild(reset);
    }
  }

  function setFilter(patch) {
    const s = state;
    if (!s) return;
    Object.assign(s.filter, patch);
    s.lastGrowth = Date.now();
    updateFilterButton();
    renderFilterMenu();
    schedule();
  }

  function updateFilterButton() {
    const s = state;
    const btn = document.querySelector('.routility-av-filter-btn');
    if (!s || !btn) return;
    const n = filterCount(s);
    const badge = btn.querySelector('.routility-av-filter-badge');
    badge.textContent = n ? String(n) : '';
    badge.hidden = !n;
    btn.classList.toggle('routility-av-filter-on', n > 0);
  }

  function openFilterMenu(btn) {
    const s = state;
    if (s.menu) return closeFilterMenu();
    const pop = el('div', 'routility-injected routility-av-filter-pop');
    const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small routility-av-filter-menu');
    menu.setAttribute('role', 'menu');
    pop.appendChild(menu);
    document.body.appendChild(pop);
    s.menu = pop;
    renderFilterMenu();
    const place = () => {
      const r = btn.getBoundingClientRect();
      pop.style.left = Math.round(r.left) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
    };
    place();
    btn.setAttribute('aria-expanded', 'true');
    s.onOutside = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeFilterMenu(); };
    s.onEsc = (e) => { if (e.key === 'Escape') closeFilterMenu(); };
    document.addEventListener('mousedown', s.onOutside, true);
    document.addEventListener('keydown', s.onEsc, true);
    s.untrack = window.RoUtilityUI.trackPopover(pop, btn, place, closeFilterMenu);
  }

  function filterButton() {
    const btn = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center gap-small shrink-0 stroke-standard stroke-contrast-alpha bg-none height-1000 radius-medium padding-x-medium content-emphasis text-label-medium routility-av-filter-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(el('div', STATE_LAYER));
    btn.appendChild(el('span', null, lt('Filter Items')));
    const badge = el('span', 'routility-av-filter-badge');
    badge.hidden = true;
    btn.appendChild(badge);
    const chev = el('span', 'icon icon-regular-chevron-small-down size-500');
    chev.setAttribute('aria-hidden', 'true');
    btn.appendChild(chev);
    btn.addEventListener('click', () => openFilterMenu(btn));
    return btn;
  }

  function ensureBox() {
    const s = state;
    const crumb = document.querySelector('#avatar-web-app .breadcrumb-container');
    if (!crumb) return;
    const host = crumb.parentElement;
    const existing = host.parentElement.querySelector(':scope > .routility-av-toolbar');
    if (existing) {
      if (existing.previousElementSibling !== host) host.after(existing);
      const input = existing.querySelector('input');
      const ph = placeholder();
      if (input.placeholder !== ph) {
        input.placeholder = ph;
        input.setAttribute('aria-label', ph);
      }
      const hide = !document.querySelector('.tab-pane.active #avatar-items-container .avatar-item-list');
      if (existing.hidden !== hide) {
        existing.hidden = hide;
        if (hide) closeFilterMenu();
      }
      return;
    }
    host.classList.add('routility-av-crumb-row');
    if (!host.querySelector('.routility-av-count')) crumb.after(el('span', 'text-secondary routility-injected routility-av-count'));
    const bar = el('div', 'routility-injected routility-av-toolbar');
    const box = el('div', 'routility-injected routility-av-search');
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable focus-visible:outline-focus disabled:outline-none stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis');
    const layer = el('div', STATE_LAYER + ' pointer-events-none');
    layer.setAttribute('aria-hidden', 'true');
    const lead = el('div', 'flex shrink-0 items-center');
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-emphasis');
    glass.setAttribute('aria-hidden', 'true');
    lead.appendChild(glass);
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium routility-av-search-input');
    input.type = 'search';
    input.placeholder = placeholder();
    input.setAttribute('aria-label', input.placeholder);
    input.maxLength = 100;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = s.raw;
    const trail = el('div', 'flex shrink-0 items-center');
    const clear = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center padding-none stroke-none select-none size-600 radius-circle bg-action-link routility-av-search-clear');
    clear.type = 'button';
    clear.setAttribute('aria-label', lt('Clear'));
    const clearLayer = el('div', STATE_LAYER);
    clearLayer.setAttribute('aria-hidden', 'true');
    clear.append(clearLayer, el('span', 'icon icon-regular-x size-400 content-emphasis'));
    clear.hidden = !s.raw;
    trail.appendChild(clear);
    field.append(layer, lead, input, trail);
    box.appendChild(field);
    let timer = null;
    const set = (v) => {
      s.raw = v;
      clear.hidden = !v;
      clearTimeout(timer);
      timer = setTimeout(() => {
        s.query = v.trim().toLowerCase();
        s.lastGrowth = Date.now();
        schedule();
      }, 120);
    };
    input.addEventListener('input', () => set(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        set('');
      }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      set('');
      input.focus();
    });
    bar.append(filterButton(), box);
    host.after(bar);
    updateFilterButton();
  }

  const schedule = onFrame(apply);

  function setup() {
    if (state) return;
    state = { raw: '', query: '', filter: { show: 'all', limited: false }, menu: null, lastCount: 0, lastGrowth: 0, settle: null };
    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, characterData: true });
    schedule();
  }


  const FIXED = /Animation$|^Face$/;
  const BODY_PART = /^(Head|DynamicHead|Torso|LeftArm|RightArm|LeftLeg|RightLeg)$/;
  const HIDDEN_TYPES = /Animation$/;
  const WRITE = /avatar\.roblox\.com\/v\d+\/avatar$|avatar\.roblox\.com\/v\d+\/outfits\/\d+\/wear|set-wearing|avatar\.roblox\.com\/v\d+\/avatar\/(set|remove|wear)/;
  const LOGO_URL = chrome.runtime.getURL('assets/icons/logo.png');
  let wear = null;

  function cardFor(id) {
    const cards = [...document.querySelectorAll('.avatar-item-list li.item-card')].filter(l => !l.closest('.routility-av-snapshot') && (l.querySelector('a[href*="/catalog/"]')?.getAttribute('href') || '').includes(`/catalog/${id}/`));
    return cards.find(c => c.closest('.tab-pane.active')) || cards[0] || null;
  }

  function press(node) {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      node.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const RIGID = /^(Hat|HairAccessory|FaceAccessory|NeckAccessory|ShoulderAccessory|FrontAccessory|BackAccessory|WaistAccessory)$/;
  const SUB_TYPE = { head: 'Hat', face: 'FaceAccessory', neck: 'NeckAccessory', shoulders: 'ShoulderAccessory', front: 'FrontAccessory', back: 'BackAccessory', waist: 'WaistAccessory', hair: 'HairAccessory' };
  const MAX_RIGID = 10;
  const DIALOG = '.advanced-accessories-dialog';

  async function openSection(tabId, subName) {
    const tab = document.getElementById(tabId);
    if (!tab) return false;
    tab.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    let sub = null;
    for (let i = 0; i < 10 && !sub; i++) {
      await wait(60);
      sub = [...document.querySelectorAll('.tab-horizontal-submenu li')].find(l => l.textContent.trim() === subName);
    }
    if (!sub) return false;
    press(sub);
    tab.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));
    return true;
  }

  function rigidWorn() {
    return (wear?.assets || []).filter(a => RIGID.test(a.type));
  }

  async function loadRules() {
    if (wear.limits) return;
    try {
      const res = await fetch('https://avatar.roblox.com/v1/avatar-rules', { credentials: 'include' });
      const data = res.ok ? await res.json() : null;
      const limits = {};
      for (const t of (data && data.wearableAssetTypes) || []) limits[String(t.name || '').replace(/\s+/g, '')] = t.maxNumber;
      if (wear) wear.limits = limits;
    } catch {}
  }

  function setValue(input, value) {
    if (input.value === value) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function currentSection() {
    const crumbs = [...document.querySelectorAll('#avatar-web-app .breadcrumb-container li')].map(l => l.textContent.trim()).filter(Boolean);
    if (!crumbs.length) return null;
    const tab = [...document.querySelectorAll('#avatar-web-app .rbx-tab .rbx-tab-heading')].find(b => b.textContent.trim().toLowerCase() === crumbs[0].toLowerCase());
    if (!tab || !tab.id || crumbs.length < 2) return null;
    return { tabId: tab.id, sub: crumbs[crumbs.length - 1], key: crumbs.join('>') };
  }

  function freezePanel() {
    const panel = document.querySelector('#avatar-web-app .right-panel');
    if (!panel || !panel.parentElement) return () => {};
    const r = panel.getBoundingClientRect();
    const host = panel.offsetParent || document.body;
    const hr = host.getBoundingClientRect();
    const shot = panel.cloneNode(true);
    shot.classList.add('routility-av-snapshot');
    shot.removeAttribute('id');
    shot.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    shot.setAttribute('aria-hidden', 'true');
    Object.assign(shot.style, { position: 'absolute', left: (r.left - hr.left + host.scrollLeft) + 'px', top: (r.top - hr.top + host.scrollTop) + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: '5', pointerEvents: 'none', overflow: 'hidden' });
    if (getComputedStyle(host).position === 'static') host.classList.add('routility-av-snapshot-host');
    host.appendChild(shot);
    panel.classList.add('routility-av-frozen');
    return () => {
      shot.remove();
      panel.classList.remove('routility-av-frozen');
      host.classList.remove('routility-av-snapshot-host');
    };
  }

  const SECTION_KEY = 'routilityAvSection';
  let remember = null;

  function setupRemember() {
    if (remember) return;
    const r = { restored: false, last: '', restoring: false };
    remember = r;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SECTION_KEY) || 'null'); } catch {}
    const root = document.documentElement;
    const done = () => {
      r.restoring = false;
      root.classList.remove('routility-av-restoring');
    };
    const tick = async () => {
      if (remember !== r || r.restoring) return;
      const now = currentSection();
      if (!now) return;
      if (!r.restored) {
        r.restored = true;
        if (saved && saved.tabId && saved.sub && saved.key !== now.key && document.getElementById(saved.tabId)) {
          r.restoring = true;
          root.classList.add('routility-av-restoring');
          const ok = await openSection(saved.tabId, saved.sub);
          for (let i = 0; ok && i < 30; i++) {
            await wait(50);
            if (currentSection()?.key === saved.key) break;
          }
          r.last = currentSection()?.key || '';
          setTimeout(done, 150);
          return;
        }
      }
      if (now.key === r.last) return;
      r.last = now.key;
      try { localStorage.setItem(SECTION_KEY, JSON.stringify({ tabId: now.tabId, sub: now.sub, key: now.key })); } catch {}
    };
    r.observer = new MutationObserver(onFrame(tick));
    r.observer.observe(document.querySelector('#avatar-web-app') || document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { if (remember === r && r.restoring) done(); }, 3000);
    tick();
  }

  function teardownRemember() {
    if (!remember) return;
    remember.observer.disconnect();
    remember = null;
    document.documentElement.classList.remove('routility-av-restoring');
  }

  async function advanced(change) {
    const w = wear;
    if (!w || w.advancedBusy) return false;
    w.advancedBusy = true;
    renderWearing();
    const root = document.documentElement;
    root.classList.add('routility-av-adv-auto');
    let ok = false;
    let back = null;
    let thaw = null;
    try {
      const activeLink = () => document.querySelector('#avatar-web-app .tab-pane.active .advanced-link');
      let link = activeLink();
      if (!link) {
        back = currentSection();
        if (back) {
          back.y = window.scrollY;
          thaw = freezePanel();
        }
      }
      if (!link && await openSection('heading.accessories-dropdown', 'Head')) {
        for (let i = 0; i < 30 && !link; i++) {
          await wait(100);
          link = activeLink();
        }
      }
      if (link) {
        link.click();
        let dialog = null;
        for (let i = 0; i < 30 && !dialog; i++) {
          await wait(60);
          dialog = [...document.querySelectorAll(DIALOG)].find(d => d.dataset.state === 'open' && d.querySelector('input'));
        }
        if (dialog) {
          const inputs = [...dialog.querySelectorAll('input')];
          const next = change(inputs.map(i => i.value.trim()));
          if (next) {
            inputs.forEach((input, i) => setValue(input, next[i] || ''));
            await wait(80);
          }
          const known = new Set(document.querySelectorAll('[role=dialog]'));
          const button = [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === (next ? 'Save' : 'Cancel'));
          button?.click();
          if (next && button) {
            let confirm = null;
            for (let i = 0; i < 30 && !confirm; i++) {
              await wait(60);
              confirm = [...document.querySelectorAll('[role=dialog][data-state=open]')].find(d => !known.has(d) && d !== dialog);
            }
            const yes = confirm && [...confirm.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save');
            if (yes) {
              yes.click();
              ok = true;
            } else {
              const no = [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel');
              no?.click();
            }
          }
          const stillOpen = () => dialog.isConnected && dialog.dataset.state === 'open';
          for (let i = 0; i < (ok ? 8 : 40) && stillOpen(); i++) await wait(50);
          if (stillOpen()) [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel')?.click();
        }
      }
      if (back && await openSection(back.tabId, back.sub)) {
        for (let i = 0; i < 30; i++) {
          await wait(100);
          const now = currentSection();
          if (now && now.key === back.key && document.querySelector('#avatar-web-app .tab-pane.active .avatar-item-list li.item-card')) break;
        }
        await wait(120);
        window.scrollTo(window.scrollX, back.y);
      }
    } finally {
      thaw?.();
      setTimeout(() => root.classList.remove('routility-av-adv-auto'), 400);
      if (wear === w) {
        w.advancedBusy = false;
        renderWearing();
      }
    }
    return ok;
  }

  function removeAllAccessories() {
    const ids = new Set(rigidWorn().map(a => a.id));
    if (!ids.size) return;
    ids.forEach(id => wear.pending.add(id));
    advanced(values => values.map(() => '')).then((ok) => {
      if (ok || !wear) return;
      ids.forEach(id => wear.pending.delete(id));
      wearError(lt('Couldn’t remove your accessories. Try again.'));
    });
  }

  function wearError(text) {
    const w = wear;
    if (!w) return;
    w.error = text;
    renderWearing();
    clearTimeout(w.errorTimer);
    w.errorTimer = setTimeout(() => {
      if (wear !== w) return;
      w.error = '';
      renderWearing();
    }, 6000);
  }

  const TYPE_BY_ID = { 8: 'Hat', 41: 'HairAccessory', 42: 'FaceAccessory', 43: 'NeckAccessory', 44: 'ShoulderAccessory', 45: 'FrontAccessory', 46: 'BackAccessory', 47: 'WaistAccessory' };
  const MIXED = new Set(['recently added', 'recently worn', 'accessories']);
  const typeCache = new Map();

  function assetType(id) {
    if (typeCache.has(id)) return typeCache.get(id);
    const job = fetch(`https://economy.roblox.com/v2/assets/${id}/details`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d ? TYPE_BY_ID[d.AssetTypeId] || '' : null))
      .catch(() => null);
    typeCache.set(id, job);
    job.then(t => { if (t === null) typeCache.delete(id); });
    return job;
  }

  function limitOf(type) {
    return (wear?.limits || {})[type] ?? (type === 'Hat' ? 3 : 1);
  }

  function addViaAdvanced(id) {
    return advanced((values) => {
      if (values.includes(id)) return null;
      const slot = values.findIndex(v => !v);
      if (slot < 0) return null;
      const next = values.slice();
      next[slot] = id;
      return next;
    });
  }

  function onCardClick(e) {
    const w = wear;
    if (!w || !w.more || !w.assets || w.advancedBusy || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.documentElement.dataset.routilityAvHook === '1') return;
    const thumb = e.target.closest?.('.tab-pane.active .avatar-item-list li.item-card');
    if (!thumb || !e.isTrusted) return;
    const parts = [...document.querySelectorAll('#avatar-web-app .breadcrumb-container li')].map(l => l.textContent.trim().toLowerCase()).filter(Boolean);
    const id = ((thumb.querySelector('a[href*="/catalog/"]')?.getAttribute('href') || '').match(/\/catalog\/(\d+)/) || [])[1];
    if (!id || w.assets.some(a => a.id === id)) return;
    const rigid = rigidWorn();
    if (rigid.length >= MAX_RIGID) return;
    const full = (type) => rigid.filter(a => a.type === type).length >= limitOf(type);
    const known = (parts[0] === 'accessories' || parts[0] === 'body') ? SUB_TYPE[parts[parts.length - 1]] : null;
    if (known) {
      if (!full(known)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      addViaAdvanced(id);
      return;
    }
    if (parts[0] !== 'recent' || !MIXED.has(parts[parts.length - 1])) return;
    if (!Object.values(TYPE_BY_ID).some(full)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const target = thumb.querySelector('.item-card-thumb-container') || thumb;
    thumb.classList.add('routility-av-checking');
    assetType(id).then((type) => {
      thumb.classList.remove('routility-av-checking');
      if (wear !== w || !thumb.isConnected) return;
      if (type && RIGID.test(type) && full(type) && rigidWorn().length < MAX_RIGID) addViaAdvanced(id);
      else target.click();
    });
  }

  const SECTION_FOR = {
    TShirt: ['heading.clothing-dropdown', 'Classic T-Shirts'],
    Shirt: ['heading.clothing-dropdown', 'Classic Shirts'],
    Pants: ['heading.clothing-dropdown', 'Classic Pants'],
    TShirtAccessory: ['heading.clothing-dropdown', 'T-Shirts'],
    ShirtAccessory: ['heading.clothing-dropdown', 'Shirts'],
    SweaterAccessory: ['heading.clothing-dropdown', 'Sweaters'],
    JacketAccessory: ['heading.clothing-dropdown', 'Jackets'],
    PantsAccessory: ['heading.clothing-dropdown', 'Pants'],
    ShortsAccessory: ['heading.clothing-dropdown', 'Shorts'],
    DressSkirtAccessory: ['heading.clothing-dropdown', 'Dresses & Skirts'],
    LeftShoeAccessory: ['heading.clothing-dropdown', 'Left Shoes'],
    RightShoeAccessory: ['heading.clothing-dropdown', 'Right Shoes'],
    Gear: ['heading.accessories-dropdown', 'Gear'],
    Hat: ['heading.accessories-dropdown', 'Head'],
    FaceAccessory: ['heading.accessories-dropdown', 'Face'],
    NeckAccessory: ['heading.accessories-dropdown', 'Neck'],
    ShoulderAccessory: ['heading.accessories-dropdown', 'Shoulders'],
    FrontAccessory: ['heading.accessories-dropdown', 'Front'],
    BackAccessory: ['heading.accessories-dropdown', 'Back'],
    WaistAccessory: ['heading.accessories-dropdown', 'Waist'],
    HairAccessory: ['heading.body-dropdown', 'Hair'],
    Head: ['heading.body-dropdown', 'Heads'],
    DynamicHead: ['heading.body-dropdown', 'Heads'],
    Torso: ['heading.body-dropdown', 'Torso'],
    LeftArm: ['heading.body-dropdown', 'Left Arms'],
    RightArm: ['heading.body-dropdown', 'Right Arms'],
    LeftLeg: ['heading.body-dropdown', 'Left Legs'],
    RightLeg: ['heading.body-dropdown', 'Right Legs'],
  };

  function searchBox() {
    return [...document.querySelectorAll('#avatar-web-app .right-panel input[type="search"]')].find(i => !i.closest('.routility-av-snapshot')) || null;
  }

  function equippedCard() {
    const list = document.querySelector('#avatar-web-app .tab-pane.active .avatar-item-list');
    const hit = list && [...list.querySelectorAll('li.item-card')].find(li => !li.closest('.routility-av-snapshot') && li.querySelector('.item-card-equipped'));
    return hit || null;
  }

  async function findCard(id, name, worn) {
    let card = null;
    let search = null;
    let shown = 0;
    let count = -1;
    let still = 0;
    for (let i = 0; i < 60 && !card; i++) {
      await wait(100);
      card = cardFor(id) || (worn && currentSection()?.sub === worn ? equippedCard() : null);
      if (card) break;
      const list = document.querySelector('#avatar-web-app .tab-pane.active .avatar-item-list');
      const cards = list ? list.querySelectorAll('li.item-card').length : 0;
      if (!cards || ++shown < 3) continue;
      if (!search && name) {
        search = searchBox();
        if (search) setValue(search, worn ? name.split(/\s+/)[0] : name);
      }
      if (cards !== count) {
        count = cards;
        still = 0;
        list.scrollIntoView({ block: 'end' });
      } else if (++still > 15) break;
    }
    for (let i = 0; card && i < 25 && !card.querySelector('.item-card-equipped'); i++) {
      await wait(80);
      card = cardFor(id) || card;
    }
    return { card, search };
  }

  async function viaSection(w, id, name, tabId, sub) {
    const back = currentSection();
    if (back) back.y = window.scrollY;
    const thaw = back ? freezePanel() : null;
    let found = { card: null, search: null };
    try {
      if (await openSection(tabId, sub)) found = await findCard(id, name, BODY_PART.test(wear?.assets?.find(a => a.id === id)?.type || '') ? sub : '');
      const target = found.card?.querySelector('.item-card-thumb-container');
      if (target && wear === w) {
        target.click();
        await wait(150);
      }
      if (found.search) {
        setValue(found.search, '');
        await wait(100);
      }
      if (back && back.key !== currentSection()?.key && await openSection(back.tabId, back.sub)) {
        for (let i = 0; i < 30; i++) {
          await wait(100);
          const now = currentSection();
          if (now && now.key === back.key && document.querySelector('#avatar-web-app .tab-pane.active .avatar-item-list li.item-card')) break;
        }
        await wait(120);
      }
      if (back) window.scrollTo(window.scrollX, back.y);
    } finally {
      thaw?.();
    }
    return !!found.card;
  }

  async function takeOff(w, id) {
    if (wear !== w) return false;
    const here = cardFor(id)?.querySelector('.item-card-thumb-container');
    if (here) {
      here.click();
      return true;
    }
    const item = (w.assets || []).find(a => a.id === id);
    const type = item?.type || '';
    const rigid = RIGID.test(type);
    const viaAdvanced = () => advanced(values => (values.includes(id) ? values.map(v => (v === id ? '' : v)) : null));
    if (rigid && await viaAdvanced()) return true;
    if (wear !== w) return false;
    const section = SECTION_FOR[type];
    if (section && await viaSection(w, id, item?.name, section[0], section[1])) return true;
    return wear === w && viaSection(w, id, '', 'heading.recent-dropdown', 'Recently Worn');
  }

  function unequip(id) {
    const w = wear;
    if (!w || w.pending.has(id)) return;
    w.pending.add(id);
    renderWearing();
    w.queue = (w.queue || Promise.resolve()).then(() => takeOff(w, id)).catch(() => false).then((done) => {
      if (!done && wear === w && w.pending.has(id)) {
        const item = (w.assets || []).find(a => a.id === id);
        w.pending.delete(id);
        wearError(lt('Couldn’t remove {name}. Try again, or click it in the list.', { name: (item && item.name) || lt('that item') }));
        return;
      }
      setTimeout(() => {
        if (wear !== w || !w.pending.delete(id)) return;
        renderWearing();
      }, 8000);
    });
  }

  async function loadWearing() {
    const w = wear;
    if (!w) return;
    const token = ++w.token;
    let data = null;
    try {
      const res = await fetch('https://avatar.roblox.com/v1/avatar', { credentials: 'include' });
      data = res.ok ? await res.json() : null;
    } catch {}
    if (wear !== w || token !== w.token) return;
    if (!data) {
      if (!w.assets) w.failed = true;
      renderWearing();
      return;
    }
    w.failed = false;
    w.assets = (data.assets || []).filter(a => !HIDDEN_TYPES.test(a.assetType?.name || '')).map(a => ({ id: String(a.id), name: a.name, type: a.assetType?.name || '', removable: !FIXED.test(a.assetType?.name || '') }));
    const FAKE_TYPES = { 8: 'Hat', 41: 'HairAccessory', 42: 'FaceAccessory', 43: 'NeckAccessory', 44: 'ShoulderAccessory', 45: 'FrontAccessory', 46: 'BackAccessory', 47: 'WaistAccessory', 57: 'EarAccessory', 58: 'EyeAccessory' };
    for (const f of window.RoUtilityFun ? window.RoUtilityFun.worn() : []) {
      if (!w.assets.some(a => a.id === String(f.id))) w.assets.push({ id: String(f.id), name: f.name, type: FAKE_TYPES[f.type] || 'Hat', removable: true });
    }
    const ids = new Set(w.assets.map(a => a.id));
    for (const id of [...w.pending]) if (!ids.has(id)) w.pending.delete(id);
    const missing = w.assets.map(a => a.id).filter(id => !w.thumbs.has(id));
    const [thumbMap, found] = await Promise.all([
      missing.length ? request({ type: 'getAssetThumbs', ids: missing }).catch(() => null) : null,
      w.values ? prices(w.assets.map(a => 'id:' + a.id)).catch(() => []) : [],
    ]);
    if (wear !== w || token !== w.token) return;
    for (const id of missing) w.thumbs.set(id, (thumbMap || {})[id] || '');
    w.prices = new Map(w.assets.map((a, i) => [a.id, (found || [])[i] || null]));
    renderWearing();
  }

  function wearHost() {
    if (!wear.panel) return null;
    const left = document.querySelector('#avatar-web-app .left-wrapper');
    if (!left) return null;
    let panel = left.querySelector('.routility-av-wearing');
    if (!panel) {
      panel = el('div', 'routility-injected routility-av-wearing');
      left.appendChild(panel);
      wear.rendered = '';
    }
    return panel;
  }

  function renderWearing() {
    const w = wear;
    if (!w) return;
    const panel = wearHost();
    if (!panel) return;
    const assets = w.assets;
    const key = JSON.stringify([assets && assets.map(a => a.id + (w.thumbs.get(a.id) ? 't' : '') + (w.prices?.get(a.id) ? 'p' : '')), [...w.pending], w.failed, !!w.advancedBusy, w.error || '']);
    if (w.rendered === key) return;
    w.rendered = key;
    panel.textContent = '';
    const head = el('div', 'routility-av-wearing-head');
    head.appendChild(el('div', 'text-label content-default', lt('Wearing')));
    const rigid = assets ? rigidWorn() : [];
    if (rigid.length) {
      const all = el('button', 'foundation-web-link bg-none stroke-none padding-none appearance-none inline-flex items-center content-emphasis no-underline hover:underline hover:cursor-pointer font-caption-body routility-av-remove-all', lt('Remove all accessories'));
      all.type = 'button';
      all.disabled = !!w.advancedBusy;
      all.addEventListener('click', removeAllAccessories);
      head.appendChild(all);
    }
    panel.appendChild(head);
    if (assets) {
      panel.appendChild(el('div', 'text-secondary font-caption-body routility-av-wearing-sub', ltn(assets.length, '{n} item • {worn}/{max} accessories', '{n} items • {worn}/{max} accessories', { n: formatNumber(assets.length), worn: rigid.length, max: MAX_RIGID })));
      if (w.error) panel.appendChild(el('div', 'text-secondary font-caption-body routility-av-wearing-error', w.error));
      const usd = assets.reduce((sum, a) => sum + (w.prices?.get(a.id)?.usd || 0), 0);
      const rap = assets.reduce((sum, a) => sum + (w.prices?.get(a.id)?.rap || 0), 0);
      if (w.values && (usd > 0 || rap > 0)) {
        const stats = el('div', 'routility-av-wearing-stats');
        const short = (n) => {
          for (const [d, u] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (n >= d) return (Math.floor(n / d * 10) / 10).toString().replace(/\.0$/, '') + u;
          return String(Math.round(n));
        };
        const box = (label, tip, icon, text, brief) => {
          const b = el('div', 'routility-av-wearing-stat');
          b.dataset.rtTip = tip;
          b.appendChild(el('span', 'text-secondary font-caption-body', label));
          const v = el('span', 'routility-av-wearing-stat-value');
          const num = el('span', 'routility-av-num');
          num.append(el('span', 'routility-av-num-short', brief), el('span', 'routility-av-num-full', text));
          v.append(icon, num);
          b.appendChild(v);
          return b;
        };
        const logo = el('img', 'routility-logo');
        logo.src = LOGO_URL;
        logo.alt = '';
        stats.appendChild(box(lt('Price'), lt('RoUtility USD price of the limiteds you’re wearing'), logo, formatUSD(usd), window.RoUtilityUI.shortUSD(usd)));
        stats.appendChild(box(lt('R$ value'), lt('Recent average price of the limiteds you’re wearing'), el('span', 'icon-robux-16x16'), formatNumber(Math.round(rap)), short(rap)));
        panel.appendChild(stats);
      }
    }
    const grid = el('ul', 'routility-av-wearing-grid');
    if (!assets) {
      if (w.failed) {
        panel.appendChild(el('p', 'text-secondary routility-av-wearing-note', lt('Couldn\u2019t load what you\u2019re wearing.')));
        return;
      }
      for (let i = 0; i < 8; i++) {
        const li = el('li', 'routility-av-wearing-tile');
        li.appendChild(el('span', 'routility-sk routility-av-wearing-sk'));
        grid.appendChild(li);
      }
      panel.appendChild(grid);
      return;
    }
    if (!assets.length) {
      panel.appendChild(el('p', 'text-secondary routility-av-wearing-note', lt('Nothing equipped.')));
      return;
    }
    for (const a of assets) {
      const li = el('li', 'routility-av-wearing-tile' + (w.pending.has(a.id) ? ' routility-av-wearing-pending' : ''));
      const link = el('a', 'item-card-thumb-container routility-av-wearing-thumb');
      link.href = `/catalog/${a.id}`;
      link.dataset.rtTip = a.name;
      const src = w.thumbs.get(a.id);
      if (src) {
        const img = el('img', 'routility-fade');
        img.alt = '';
        img.src = src;
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        link.appendChild(img);
        if (img.complete && img.naturalWidth) img.classList.add('loaded');
      } else if (!w.thumbs.has(a.id)) {
        link.appendChild(el('span', 'routility-sk routility-av-wearing-sk'));
      }
      if (a.removable) {
        link.classList.add('routility-av-wearing-removable');
        link.setAttribute('aria-label', lt('Remove {name}', { name: a.name }));
        link.addEventListener('click', (e) => {
          if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          unequip(a.id);
        });
      }
      li.appendChild(link);
      grid.appendChild(li);
    }
    panel.appendChild(grid);
  }

  const refreshWearing = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(loadWearing, 250);
    };
  })();

  function setupWearing(opts = {}) {
    if (wear) return;
    wear = { assets: null, thumbs: new Map(), prices: null, pending: new Set(), token: 0, failed: false, rendered: '', panel: opts.panel !== false, values: opts.values !== false, more: !!opts.more, limits: null, advancedBusy: false };
    const w = wear;
    document.addEventListener('click', onCardClick, true);
    loadRules();
    w.perf = new PerformanceObserver((list) => {
      if (list.getEntries().some(e => WRITE.test(e.name.split('?')[0]))) refreshWearing();
    });
    w.perf.observe({ type: 'resource' });
    w.observer = new MutationObserver(onFrame(() => {
      if (wear === w && !document.querySelector('#avatar-web-app .left-wrapper .routility-av-wearing')) renderWearing();
    }));
    w.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    renderWearing();
    loadWearing();
  }

  function teardownWearing() {
    if (!wear) return;
    document.removeEventListener('click', onCardClick, true);
    document.documentElement.classList.remove('routility-av-adv-auto');
    wear.perf.disconnect();
    wear.observer.disconnect();
    wear = null;
    document.querySelectorAll('.routility-av-wearing').forEach(n => n.remove());
  }

  const RIG_SOURCE = '#avatar-web-app .right-panel .avatar-type-toggle-scale button[role="switch"]';
  let rig = null;

  function rigSource() {
    return document.querySelector(RIG_SOURCE);
  }

  function syncRig(row, src) {
    const on = src.getAttribute('aria-checked') === 'true';
    const btn = row.querySelector('button[role="switch"]');
    const busy = !!src.disabled;
    if (btn.getAttribute('aria-checked') === String(on) && btn.disabled === busy) return;
    const st = on ? 'checked' : 'unchecked';
    btn.setAttribute('aria-checked', String(on));
    btn.disabled = busy;
    row.querySelectorAll('[data-state]').forEach(n => { n.dataset.state = st; });
    const [r6, r15] = row.querySelectorAll('.routility-av-rig-label');
    r6.classList.toggle('content-emphasis', !on);
    r6.classList.toggle('content-muted', on);
    r15.classList.toggle('content-emphasis', on);
    r15.classList.toggle('content-muted', !on);
  }

  function pickRig(want) {
    const src = rigSource();
    if (!src || src.disabled) return;
    if (want === null || (src.getAttribute('aria-checked') === 'true') !== want) src.click();
  }

  function ensureRig() {
    if (!rig) return;
    const sliders = document.querySelector('#avatar-web-app .left-wrapper .section-sliders');
    const src = rigSource();
    if (!sliders || !src) return;
    let row = sliders.querySelector(':scope > .routility-av-rig');
    if (!row) {
      row = el('div', 'routility-injected routility-av-rig');
      row.appendChild(el('div', 'text-label content-default', lt('Avatar type')));
      const wrap = src.closest('.avatar-type-toggle-scale').cloneNode(true);
      const spans = wrap.querySelectorAll(':scope > span');
      spans.forEach((sp, i) => {
        sp.classList.add('routility-av-rig-label');
        sp.addEventListener('click', () => pickRig(i === 1));
      });
      const btn = wrap.querySelector('button[role="switch"]');
      btn.setAttribute('aria-label', lt('Avatar type, R6 or R15'));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pickRig(null);
      });
      row.appendChild(wrap);
      sliders.prepend(row);
    }
    syncRig(row, src);
  }

  function setupRig() {
    if (rig) return;
    rig = {};
    rig.observer = new MutationObserver(onFrame(ensureRig));
    rig.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked', 'disabled'] });
    ensureRig();
  }

  function teardownRig() {
    if (!rig) return;
    rig.observer.disconnect();
    rig = null;
    document.querySelectorAll('.routility-av-rig').forEach(n => n.remove());
  }

  function teardown() {
    teardownWearing();
    teardownRig();
    teardownRemember();
    if (!state) return;
    closeFilterMenu();
    state.observer.disconnect();
    clearTimeout(state.settle);
    state = null;
    document.documentElement.classList.remove('routility-av-searching');
    document.querySelectorAll('.routility-av-toolbar, .routility-av-search, .routility-av-status, .routility-av-count').forEach(n => n.remove());
    document.querySelectorAll('.routility-av-miss').forEach(n => n.classList.remove('routility-av-miss'));
    document.querySelectorAll('.routility-av-crumb-row').forEach(n => n.classList.remove('routility-av-crumb-row'));
  }

  window.RoUtilityAvatar = { setup, setupWearing, setupRig, setupRemember, teardown };
})();
