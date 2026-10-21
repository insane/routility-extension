(function () {
  'use strict';

  if (window.RoUtilityClassicSkeleton) return;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  let skSettings = {};

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function bar(w, h, extra) {
    const b = el('span', 'routility-sk' + (extra ? ' ' + extra : ''));
    b.style.width = typeof w === 'number' ? w + 'px' : w;
    b.style.height = h + 'px';
    return b;
  }

  function heading(w) {
    const head = el('div', 'container-header');
    head.appendChild(bar(w, 22, 'routility-sk-heading'));
    return head;
  }

  function people(count) {
    const wrap = el('div', 'routility-sk-people');
    for (let i = 0; i < count; i++) {
      const p = el('div', 'routility-sk-person');
      p.append(bar(90, 90, 'routility-sk-circle'), bar(64, 10, 'routility-sk-line'));
      wrap.appendChild(p);
    }
    return wrap;
  }

  function panel(children) {
    const box = el('div', 'section-content');
    box.append(...children);
    return box;
  }

  function tiles(count, size) {
    const row = el('div', 'routility-sk-grid');
    for (let i = 0; i < count; i++) row.appendChild(bar(size, size, 'routility-sk-tile'));
    return row;
  }

  let skNote = false;
  let skOwn = false;

  function note() {
    const box = el('div', 'routility-sk-note');
    box.append(bar(130, 14), bar('100%', 38, 'routility-sk-note-input'));
    return box;
  }

  function slot(height, top, child) {
    const box = el('div', 'routility-sk-slot');
    box.style.height = height + 'px';
    if (top) box.style.marginTop = top + 'px';
    box.appendChild(child);
    return box;
  }

  function footer() {
    const box = el('div', 'routility-sk-foot' + (skOwn ? ' routility-sk-foot-own' : ''));
    if (!skOwn) box.appendChild(bar(80, 12));
    return box;
  }

  function columnsBody() {
    const grid = el('div', 'routility-columns routility-columns-games');
    const about = el('div', 'section profile-about');
    const stats = el('div', 'routility-sk-row');
    stats.classList.add('routility-sk-stats');
    stats.append(bar(90, 34), bar(90, 34), bar(90, 34));
    const info = panel([slot(22, 0, bar(80, 14)), slot(300, 6, bar(180, 260, 'routility-sk-body')), skOwn ? slot(101, 12, bar('100%', 101, 'routility-sk-note-input')) : slot(29, 12, bar('45%', 14)), ...(skNote ? [note()] : []), stats, footer()]);
    info.classList.add('routility-sk-about');
    about.append(heading(70), info);
    const creations = el('div', 'routility-column-creations');
    const games = el('div', 'section');
    games.append(heading(130), panel([bar('100%', 440, 'routility-sk-tile')]));
    games.lastChild.classList.add('profile-slide-container');
    creations.appendChild(games);
    const left = el('div', 'routility-column routility-column-left');
    const robloxBadges = el('div', 'section');
    robloxBadges.append(heading(150), panel([tiles(5, 72)]));
    const badges = el('div', 'section');
    badges.append(heading(90), panel([tiles(10, 72)]));
    left.append(robloxBadges, badges);
    const right = el('div', 'routility-column routility-column-right');
    const friends = el('div', 'section');
    friends.append(heading(110), people(8));
    const favorites = el('div', 'section');
    favorites.append(heading(100), panel([tiles(6, 110)]));
    right.append(friends, favorites);
    grid.append(about, creations, left, right);
    return grid;
  }

  function valuePills() {
    const s = skSettings;
    const worth = s.profileValue !== false && s.showValues !== false;
    const rap = s.profileRap !== false;
    const w = s.profileShort === true ? { both: 164, worth: 85, rap: 80, usd: 67 } : { both: 200, worth: 104, rap: 96, usd: 72 };
    const pills = el('div', 'routility-sk-row routility-sk-values');
    if (worth && rap && !/^(separate|gray)$/.test(s.profilePills)) pills.appendChild(bar(w.both, 28, 'routility-sk-value'));
    else {
      if (worth) pills.appendChild(bar(w.worth, 28, 'routility-sk-value'));
      if (rap) pills.appendChild(bar(w.rap, 28, 'routility-sk-value'));
    }
    if (s.profileUsd !== false) pills.appendChild(bar(w.usd, 28, 'routility-sk-value'));
    return pills;
  }

  function build(columns) {
    const root = el('div', 'routility-classic routility-injected routility-classic-loading' + (columns ? ' routility-classic-columns' : ''));
    const card = el('div', 'section-content profile-header-content');
    const top = el('div', 'profile-header-top');
    top.appendChild(bar(128, 128, 'routility-sk-circle routility-sk-avatar'));
    const caption = el('div', 'header-caption');
    const names = el('div', 'header-names');
    names.appendChild(bar(240, 32, 'routility-sk-name'));
    names.appendChild(bar(90, 12, 'routility-sk-line'));
    caption.appendChild(names);
    if (!/routility-user=/.test(location.hash) && skSettings.inventoryValues !== false) caption.appendChild(valuePills());
    const details = el('div', 'header-details');
    const counts = el('div', 'routility-sk-row');
    counts.append(bar(80, 16), bar(110, 16), bar(100, 16));
    const buttons = el('div', 'routility-sk-row');
    buttons.classList.add('routility-sk-actions');
    buttons.append(bar(100, 36, 'routility-sk-button'), bar(155, 36, 'routility-sk-button'));
    details.append(counts, buttons);
    caption.appendChild(details);
    top.appendChild(caption);
    card.appendChild(top);
    root.appendChild(card);
    if (columns) {
      root.appendChild(columnsBody());
      return root;
    }

    const tabs = el('div', 'rbx-tabs-horizontal');
    const nav = el('ul', 'nav nav-tabs');
    for (const [label, active] of [[LT('About'), true], [LT('Creations'), false]]) {
      const li = el('li', 'rbx-tab' + (active ? ' active' : ''));
      const a = el('a', 'rbx-tab-heading');
      const text = el('span', 'text-lead', lt(label));
      window.RoUtilityI18n.ready.then(() => { text.textContent = lt(label); });
      a.appendChild(text);
      li.appendChild(a);
      nav.appendChild(li);
    }
    tabs.appendChild(nav);
    const pane = el('div', 'tab-content rbx-tab-content');
    const about = el('div', 'section');
    about.appendChild(heading(70));
    if (skOwn) about.appendChild(bar('100%', 53, 'routility-sk-note-input'));
    else {
      const lines = el('div', 'routility-sk-lines routility-sk-bio');
      lines.append(bar('80%', 12), bar('55%', 12));
      about.appendChild(lines);
    }
    if (skNote) about.appendChild(note());
    about.appendChild(footer());
    pane.appendChild(about);
    const wearing = el('div', 'section');
    wearing.appendChild(heading(190));
    const row = el('div', 'routility-classic-wearing-row');
    const left = el('div', 'layer profile-avatar-left');
    left.appendChild(bar(180, 260, 'routility-sk-body'));
    const right = el('div', 'section-content profile-avatar-right');
    const grid = el('div', 'routility-sk-grid');
    for (let i = 0; i < 8; i++) grid.appendChild(bar(100, 100, 'routility-sk-tile'));
    right.appendChild(grid);
    row.append(left, right);
    wearing.appendChild(row);
    pane.appendChild(wearing);
    const friends = el('div', 'section');
    friends.appendChild(heading(130));
    friends.appendChild(people(9));
    pane.appendChild(friends);
    tabs.appendChild(pane);
    root.appendChild(tabs);
    return root;
  }

  function buildModern() {
    const root = el('div', 'routility-modern routility-injected routility-classic-loading');
    const head = el('div', 'routility-modern-header');
    const info = el('div', 'routility-modern-info');
    info.appendChild(bar(128, 128, 'routility-sk-circle'));
    const names = el('div', 'routility-modern-names');
    names.append(bar(200, 30), bar(110, 14));
    info.appendChild(names);
    head.appendChild(info);
    const pills = el('div', 'routility-modern-counts');
    pills.append(bar(100, 32, 'routility-sk-pill'), bar(130, 32, 'routility-sk-pill'), bar(120, 32, 'routility-sk-pill'));
    head.appendChild(pills);
    const lines = el('div', 'routility-sk-lines');
    lines.style.height = 'auto';
    lines.append(bar('80%', 12), bar('55%', 12));
    head.appendChild(lines);
    root.appendChild(head);
    for (let r = 0; r < 2; r++) {
      const sec = el('div', 'routility-modern-section');
      sec.appendChild(bar(180, 22));
      const row = el('div', 'routility-modern-row');
      for (let i = 0; i < 6; i++) row.appendChild(bar(152, 152, 'routility-sk-tile'));
      sec.appendChild(row);
      root.appendChild(sec);
    }
    return root;
  }

  window.RoUtilityClassicSkeleton = build;
  window.RoUtilityModernSkeleton = buildModern;

  const errorPage = location.pathname === '/request-error';
  if (!errorPage && !/^\/users\/\d+\/profile\/?$/i.test(location.pathname)) return;
  chrome.storage.local.get(['routilitySettings', 'routilityLastProfile'], (s) => {
    const settings = { revealTerminated: true, classicProfile: true, ...(s.routilitySettings || {}) };
    skSettings = settings;
    let shown = null;
    try { shown = sessionStorage.getItem('routilityTerminated'); } catch {}
    const nav = performance.getEntriesByType('navigation')[0]?.type;
    const recent = (s.routilityLastProfile && Date.now() - s.routilityLastProfile.t < 20000) || (shown && (nav === 'reload' || nav === 'back_forward'));
    const terminated = errorPage && (/routility-user=\d+/.test(location.hash) || recent);
    if (errorPage && !terminated) return;
    if (terminated ? !settings.revealTerminated : !settings.classicProfile) return;
    const pending = terminated && !/routility-user=\d+/.test(location.hash) && (s.routilityLastProfile && Date.now() - s.routilityLastProfile.t < 20000 ? s.routilityLastProfile.id : shown);
    if (pending && /^\d+$/.test(String(pending)) && document.readyState === 'loading') {
      document.documentElement.dataset.routilityCheck = String(pending);
      history.replaceState(history.state, '', `/users/${pending}/profile`);
    }
    const modern = terminated && !settings.classicProfile;
    document.documentElement.classList.add('routility-classic-on');
    const place = () => {
      const content = document.getElementById('content');
      if (!content) return false;
      const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
      skOwn = !errorPage && !!me && location.pathname.split('/')[2] === me;
      skNote = !errorPage && !skOwn && settings.profileNotes !== false;
      if (!content.querySelector(':scope > .routility-classic, :scope > .routility-modern')) content.prepend(modern ? buildModern() : build(settings.classicLayout === 'columns'));
      return true;
    };
    if (place()) return;
    const watch = new MutationObserver(() => { if (place()) watch.disconnect(); });
    watch.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => watch.disconnect(), 15000);
  });
})();
