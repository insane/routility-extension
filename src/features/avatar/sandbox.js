(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, dropdown } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const KEY = 'routilitySandbox';
  const AVATAR = /^\/my\/avatar/i;
  const MODES = [['all', LT('All Items')], ['limited', LT('Limiteds')], ['classic', LT('Classic Limiteds')]];
  const SORTS = [['relevance', LT('Relevance')], ['favorites', LT('Most Favorited')], ['bestselling', LT('Bestselling')], ['updated', LT('Recently Updated')], ['high', LT('Price High to Low')], ['low', LT('Price Low to High')]];
  const FIELD_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

  let settings = {};
  let state = null;
  let banner = null;
  let lastPick = null;
  let searchTimer = 0;

  const PAGE = /^\/my\/avatar\/?$/i.test(location.pathname) && new URLSearchParams(location.search).has('sandbox');
  const sandboxOn = () => PAGE;
  const filter = () => (state && state.filter) || (() => { try { return (JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}).filter; } catch { return null; } })() || { mode: 'classic', q: '', sort: 'high' };
  const send = (action, extra) => window.postMessage(Object.assign({ type: 'routility-sandbox', action }, extra || {}), location.origin);

  function exitSandbox() {
    try { sessionStorage.removeItem(KEY); } catch {}
    send('exit');
    location.href = 'https://www.roblox.com/my/avatar';
  }

  function chip(label, on, onClick) {
    const b = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center select-none radius-circle text-label-medium height-800 padding-x-medium routility-sb-chip' + (on ? ' routility-sb-chip-on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    b.addEventListener('click', onClick);
    return b;
  }

  function button(label, primary) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'text-no-wrap', label));
    return b;
  }

  const fire = (node) => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) node.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  };
  const items = () => [...document.querySelectorAll('#avatar-web-app .tab-horizontal-submenu li')];

  function refreshList() {
    if (!lastPick) return;
    const heading = document.getElementById(lastPick.heading);
    if (!heading) return;
    const open = () => heading.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    const close = () => heading.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));
    open();
    setTimeout(() => {
      const list = items();
      const target = list.find(li => li.textContent.trim() === lastPick.label);
      const other = list.find(li => li !== target && li.textContent.trim());
      if (!target) return close();
      if (other) fire(other);
      setTimeout(() => {
        open();
        setTimeout(() => {
          const again = items().find(li => li.textContent.trim() === lastPick.label);
          if (again) fire(again);
          close();
        }, 150);
      }, 200);
    }, 150);
  }

  function openDefault(tries = 0) {
    const heading = document.getElementById('heading.accessories-dropdown');
    if (!heading) {
      if (tries < 40) setTimeout(() => openDefault(tries + 1), 250);
      return;
    }
    const active = document.querySelector('#avatar-web-app .rbx-tab-heading.active, #avatar-web-app .rbx-tab.active .rbx-tab-heading, #avatar-web-app [aria-selected="true"].rbx-tab-heading');
    if (active && !/recent|avatars/i.test(active.id || '')) return;
    heading.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    setTimeout(() => {
      const first = items()[0];
      if (first) {
        lastPick = { heading: heading.id, label: first.textContent.trim() };
        fire(first);
      }
      heading.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, view: window }));
    }, 200);
  }

  function setFilter(next) {
    const f = Object.assign({}, filter(), next);
    state = Object.assign({}, state || {}, { filter: f });
    send('filter', { filter: f });
    paint();
    refreshList();
  }

  function build() {
    const root = el('section', 'routility-injected routility-sb bg-surface-100 radius-large');
    const top = el('div', 'routility-sb-top');
    const icon = el('span', 'routility-sb-icon');
    icon.setAttribute('aria-hidden', 'true');
    const text = el('div', 'routility-sb-text');
    text.append(el('h2', 'text-title-large content-emphasis margin-none', lt('Sandbox Mode')), el('p', 'text-body-small content-muted margin-none', lt('Try on anything from the Marketplace, limiteds included. Nothing you change here touches your real avatar.')));
    const exit = button(lt('Exit Sandbox'));
    exit.addEventListener('click', exitSandbox);
    top.append(icon, text, exit);
    const tools = el('div', 'routility-sb-tools');
    const chips = el('div', 'routility-sb-chips');
    const field = el('div', 'foundation-web-input flex items-center relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis routility-sb-search');
    const layer = el('div', FIELD_LAYER + ' pointer-events-none');
    layer.setAttribute('aria-hidden', 'true');
    const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
    glass.setAttribute('aria-hidden', 'true');
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium');
    input.type = 'search';
    input.placeholder = lt('Search the Marketplace');
    input.setAttribute('aria-label', lt('Search the Marketplace'));
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = filter().q || '';
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => setFilter({ q: input.value.trim() }), 450);
    });
    field.append(layer, glass, input);
    const sort = dropdown(SORTS.map(([value, label]) => ({ value, label: lt(label) })), filter().sort || 'high', (v) => setFilter({ sort: v }), 'routility-sb-sort');
    tools.append(chips, field, sort);
    const empty = el('div', 'routility-sb-empty');
    empty.hidden = true;
    const showAll = el('button', 'text-link routility-sb-showall', lt('Show All Items'));
    showAll.type = 'button';
    showAll.addEventListener('click', () => setFilter({ mode: 'all' }));
    empty.append(el('span', 'text-body-small content-muted', lt('Nothing in this category matches your filter.')), showAll);
    root.append(top, tools, empty);
    root.parts = { chips, empty };
    return root;
  }

  function paint() {
    if (!banner) return;
    const f = filter();
    banner.parts.chips.replaceChildren(...MODES.map(([mode, label]) => chip(lt(label), f.mode === mode, () => setFilter({ mode }))));
  }

  let renderSeq = 0;

  function enlarge() {
    document.querySelector('.routility-sb-zoom')?.remove();
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-sb-zoom');
    overlay.dataset.state = 'open';
    const dialog = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-sb-zoom-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', lt('Sandbox Mode'));
    const close = el('button', 'routility-modal-icon routility-sb-zoom-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(el('span', 'icon icon-regular-x'));
    const shot = el('div', 'routility-sb-zoom-shot');
    shot.appendChild(el('span', 'routility-sk routility-sb-zoom-sk'));
    dialog.append(close, shot);
    overlay.appendChild(dialog);
    const id = ++renderSeq;
    const onRender = (e) => {
      if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-render' || e.data.id !== id) return;
      window.removeEventListener('message', onRender);
      shot.textContent = '';
      if (!e.data.url) {
        shot.appendChild(el('p', 'text-body-medium content-muted', lt('Couldn’t render your avatar. Try again in a moment.')));
        return;
      }
      const img = el('img', 'routility-sb-zoom-img');
      img.alt = lt('Avatar');
      img.src = e.data.url;
      shot.appendChild(img);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shut();
    };
    const shut = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('message', onRender);
    };
    window.addEventListener('message', onRender);
    close.addEventListener('click', shut);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) shut(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    send('render', { id, size: '720x720' });
  }

  function zoomButton() {
    const thumb = document.querySelector('#avatar-web-app .avatar-thumbnail');
    if (!thumb || thumb.querySelector(':scope > .routility-sb-enlarge')) return;
    const native = [...thumb.querySelectorAll('button')].find(x => /^(2D|3D)$/.test(x.textContent.trim()));
    const b = el('button', (native ? native.className : 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium height-1000 bg-action-standard content-action-standard') + ' routility-injected routility-sb-enlarge');
    b.type = 'button';
    b.setAttribute('aria-label', lt('Enlarge'));
    b.dataset.rtTip = lt('Enlarge');
    const layer = el('div', FIELD_LAYER);
    layer.setAttribute('aria-hidden', 'true');
    b.append(layer, el('span', 'routility-sb-enlarge-icon'));
    b.addEventListener('click', enlarge);
    thumb.appendChild(b);
    alignZoom();
  }

  function alignZoom() {
    const b = document.querySelector('#avatar-web-app .avatar-thumbnail > .routility-sb-enlarge');
    const native = b && [...b.parentElement.querySelectorAll('button')].find(x => x !== b && /^(2D|3D)$/.test(x.textContent.trim()));
    if (!b || !native) return;
    const box = b.parentElement.getBoundingClientRect();
    const r = native.getBoundingClientRect();
    if (!r.width) return;
    b.style.setProperty('right', Math.round(box.right - r.right) + 'px', 'important');
  }

  function place() {
    const on = settings.avatarSandbox !== false && AVATAR.test(location.pathname) && sandboxOn();
    document.documentElement.classList.toggle('routility-sandbox', on);
    if (!on) {
      banner?.remove();
      banner = null;
      document.querySelectorAll('.routility-sb-enlarge').forEach(n => n.remove());
      return;
    }
    zoomButton();
    alignZoom();
    const app = document.querySelector('#avatar-web-app');
    const host = app && app.querySelector(':scope > #avatar-react-container');
    if (!host) return;
    if (!banner) {
      banner = build();
      paint();
      openDefault();
    }
    if (banner.nextElementSibling !== host) host.before(banner);
  }

  function ensureNav() {
    const off = settings.avatarSandbox === false;
    const avatar = document.querySelector('.left-nav nav a[href*="/my/avatar"]:not(.routility-sb-nav-link)');
    const li = avatar && avatar.closest('li');
    let mine = document.querySelector('.left-nav li.routility-sb-nav');
    if (off) {
      mine?.remove();
      return;
    }
    if (!li || !li.parentElement) return;
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.add('routility-injected', 'routility-sb-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/my/avatar?sandbox';
      a.classList.add('routility-sb-nav-link');
      a.removeAttribute('id');
      a.classList.remove('bg-shift-200');
      a.querySelectorAll('.foundation-web-badge').forEach(n => n.remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-sb-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => !sp.children.length && sp.textContent.trim());
      if (label) label.textContent = lt('Sandbox');
    }
    if (!mine.isConnected || mine.previousElementSibling !== li) li.after(mine);
    const here = AVATAR.test(location.pathname) && sandboxOn();
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) avatar.classList.remove('bg-shift-200');
  }

  document.addEventListener('pointerdown', (e) => {
    const li = e.isTrusted && e.target.closest?.('#avatar-web-app .tab-horizontal-submenu li');
    if (li && lastHeading) {
      lastPick = { heading: lastHeading, label: li.textContent.trim() };
    }
  }, true);
  let lastHeading = '';
  document.addEventListener('mouseover', (e) => {
    const h = e.isTrusted && e.target.closest?.('#avatar-web-app [id^="heading."]');
    if (h) lastHeading = h.id;
  }, true);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-result' || !banner) return;
    banner.parts.empty.hidden = !(e.data.count === 0 && e.data.filtered && filter().mode !== 'all');
  });

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.type !== 'routility-sandbox-state') return;
    state = e.data.state || null;
    paint();
  });

  let queued = false;
  const tick = () => {
    queued = false;
    ensureNav();
    place();
  };
  const observer = new MutationObserver((records) => {
    if (queued || records.every(r => r.target.closest?.('.routility-sb'))) return;
    queued = true;
    requestAnimationFrame(tick);
  });

  function start() {
    if (settings.avatarSandbox === false && sandboxOn()) {
      try { sessionStorage.removeItem(KEY); } catch {}
      location.replace('https://www.roblox.com/my/avatar');
      return;
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    tick();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    tick();
  });
})();
