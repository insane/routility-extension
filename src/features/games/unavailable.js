(function () {
  'use strict';

  const { el, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt, LT } = window.RoUtilityI18n;
  const REASONS = {
    InsufficientPermissionEditorsOnly: LT('This experience is private'),
    UniverseRootPlaceIsPrivate: LT('This experience is private'),
    PlaceHasNoPublishedVersion: LT('This experience was never published'),
    GameUnapproved: LT('Taken down by Roblox'),
    AssetUnapproved: LT('Taken down by Roblox'),
    UnderReview: LT('Under review by Roblox'),
    ContextualPlayabilityUnrated: LT('Not rated yet'),
    ContextualPlayabilityAgeGated: LT('Age restricted'),
    ContextualPlayabilityUnverifiedSeventeenPlusUser: LT('Only for verified 17+ players'),
    InsufficientPermissionFriendsOnly: LT('Only the creator\u2019s friends can join'),
    InsufficientPermissionGroupOnly: LT('Only community members can join'),
    DeviceRestricted: LT('Not available on this device'),
    UniverseDoesNotHaveARootPlace: LT('This experience was deleted'),
  };
  const SHORT = {
    InsufficientPermissionEditorsOnly: LT('Private'),
    UniverseRootPlaceIsPrivate: LT('Private'),
    PlaceHasNoPublishedVersion: LT('Never published'),
    GameUnapproved: LT('Taken down'),
    AssetUnapproved: LT('Taken down'),
    UnderReview: LT('Under review'),
    ContextualPlayabilityUnrated: LT('Unrated'),
    ContextualPlayabilityAgeGated: LT('Age restricted'),
    ContextualPlayabilityUnverifiedSeventeenPlusUser: LT('17+ only'),
    InsufficientPermissionFriendsOnly: LT('Friends only'),
    InsufficientPermissionGroupOnly: LT('Community only'),
    DeviceRestricted: LT('Device restricted'),
    UniverseDoesNotHaveARootPlace: LT('Deleted'),
  };
  const DIFFICULTY = [[90, LT('Freebie')], [80, LT('Cakewalk')], [50, LT('Easy')], [30, LT('Moderate')], [20, LT('Challenging')], [10, LT('Hard')], [5, LT('Extreme')], [1, LT('Insane')], [0, LT('Impossible')]];
  const PLAY_BTN = 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none relative flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-large height-1200 padding-x-medium bg-shift-300 content-default btn-full-width btn-common-play-game-lg routility-ug-play';
  const settings = { gameUnavailable: true };
  let busy = false;

  async function getJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function reasonText(status) {
    if (REASONS[status]) return lt(REASONS[status]);
    return status ? status.replace(/([a-z])([A-Z])/g, '$1 $2') : lt('Unavailable');
  }

  function h(tag, cls, kids, attrs) {
    const n = el(tag, cls);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    for (const k of [].concat(kids == null ? [] : kids)) if (k != null) n.append(k);
    return n;
  }

  function img(src) {
    const i = el('img');
    i.alt = '';
    if (src) i.src = src;
    return i;
  }

  function slug(s) {
    return String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || '-';
  }

  function rarity(pct) {
    const p = Number(pct) || 0;
    const name = (DIFFICULTY.find(([min]) => p >= min) || DIFFICULTY[DIFFICULTY.length - 1])[1];
    return `${p.toFixed(1)}% (${lt(name)})`;
  }

  function statLi(label, value) {
    return h('li', 'game-stat', [h('p', 'text-label text-overflow font-caption-header', label), h('p', 'text-lead font-caption-body', value)]);
  }

  function badgeRow(b, icon) {
    const st = b.statistics || {};
    return h('li', 'stack-row badge-row', [
      h('div', 'badge-image', h('a', '', h('span', 'thumbnail-2d-container badge-image-container', img(icon)), { href: `https://www.roblox.com/badges/${b.id}/${slug(b.name)}` })),
      h('div', 'badge-content', [
        h('div', 'badge-data-container', [h('div', 'font-header-2 badge-name', b.displayName || b.name), h('p', 'para-overflow', b.displayDescription || b.description || '')]),
        h('ul', 'badge-stats-container', [
          h('li', null, [h('div', 'text-label', lt('Rarity')), h('div', 'font-header-2 badge-stats-info', rarity((Number(st.winRatePercentage) || 0) * 100))]),
          h('li', null, [h('div', 'text-label', lt('Won Yesterday')), h('div', 'font-header-2 badge-stats-info', formatNumber(st.pastDayAwardedCount || 0))]),
          h('li', null, [h('div', 'text-label', lt('Won Ever')), h('div', 'font-header-2 badge-stats-info', formatNumber(st.awardedCount || 0))]),
        ]),
      ]),
    ]);
  }

  function passCard(g, icon) {
    const name = g.displayName || g.name;
    const price = g.price > 0
      ? h('div', 'store-card-price', [h('span', 'icon-robux-16x16'), h('span', 'text-robux', formatNumber(g.price))])
      : h('div', 'store-card-price', h('span', 'text-label', lt('Off sale')));
    return h('li', 'list-item real-game-pass', h('div', 'store-card', [
      h('a', 'gear-passes-asset', img(icon), { href: `/game-pass/${g.id}/${slug(g.name)}` }),
      h('div', 'store-card-caption', [h('div', 'text-overflow store-card-name', name, { title: name }), price]),
    ]));
  }

  function voting(up, down) {
    const total = up + down;
    const pct = total ? Math.round(up / total * 100) : 0;
    return h('li', 'voting-panel body', h('div', 'vote-summary', h('div', 'voting-details', h('div', 'users-vote', [
      h('div', 'upvote', h('span', 'icon-like')),
      h('div', 'vote-details', [
        h('div', 'vote-container', [h('div', 'vote-background'), h('div', 'vote-percentage', null, { style: `width: ${pct}%;` }), h('div', 'vote-mask', [1, 2, 3, 4].map(n => h('div', `segment seg-${n}`)))]),
        h('div', 'vote-numbers', [h('div', 'count-left', h('span', 'vote-text', formatNumber(up))), h('div', 'count-right', h('span', 'vote-text', formatNumber(down)))]),
      ]),
      h('div', 'downvote', h('span', 'icon-dislike')),
    ]))));
  }

  async function render(placeId, native) {
    const places = await getJson(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    const p = places && places[0];
    if (!p || !p.universeId) return false;
    const uid = p.universeId;
    const [play, favs, votes, thumbs, icon, badges, passes] = await Promise.all([
      getJson(`https://games.roblox.com/v1/games/multiget-playability-status?universeIds=${uid}`),
      getJson(`https://games.roblox.com/v1/games/${uid}/favorites/count`),
      getJson(`https://games.roblox.com/v1/games/votes?universeIds=${uid}`),
      getJson(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${uid}&size=768x432&format=Png&countPerUniverse=1`),
      getJson(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${uid}&size=512x512&format=Png`),
      getJson(`https://badges.roblox.com/v1/universes/${uid}/badges?limit=50&sortOrder=Asc`),
      getJson(`https://apis.roblox.com/game-passes/v1/universes/${uid}/game-passes?passView=Full&pageSize=50`),
    ]);
    const b = (badges && badges.data) || [];
    const g = (passes && passes.gamePasses) || [];
    const [badgeIcons, passIcons] = await Promise.all([
      b.length ? getJson(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${b.map(x => x.id).join(',')}&size=150x150&format=Png`) : null,
      g.length ? getJson(`https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${g.map(x => x.id).join(',')}&size=150x150&format=Png`) : null,
    ]);
    if (document.querySelector('.routility-ug:not(.routility-ug-loading)')) return true;
    const live = document.getElementById('game-details-unavailable-container') || native;
    if (!live.isConnected) return false;
    const iconMap = d => new Map(((d && d.data) || []).map(x => [x.targetId, x.imageUrl]));
    const bIcons = iconMap(badgeIcons);
    const gIcons = iconMap(passIcons);
    const status = play && play[0] && play[0].playabilityStatus;
    const v = (votes && votes.data && votes.data[0]) || { upVotes: 0, downVotes: 0 };
    const shot = ((thumbs && thumbs.data && thumbs.data[0] && thumbs.data[0].thumbnails) || []).find(x => x.state === 'Completed');
    const ico = icon && icon.data && icon.data[0] && icon.data[0].state === 'Completed' ? icon.data[0].imageUrl : '';
    const name = p.name || p.sourceName || lt('Unknown experience');
    const favCount = favs && Number.isFinite(favs.favoritesCount) ? favs.favoritesCount : null;

    const carousel = h('div', 'game-details-carousel-container', shot || ico
      ? h('div', null, h('span', 'thumbnail-2d-container carousel-item carousel-item-active' + (shot ? '' : ' routility-ug-icon-only'), img(shot ? shot.imageUrl : ico)))
      : h('div', 'carousel-image-empty-placeholder'));
    const creator = h('div', 'game-creator', [h('span', 'text-label', lt('By')), ' ', h('a', 'text-name text-overflow', '@' + (p.builder || '?'), { href: p.builderId ? `https://www.roblox.com/users/${p.builderId}/profile` : '#' })]);
    const playBtn = h('button', PLAY_BTN, [h('div', 'absolute inset-[0]', null, { 'aria-hidden': 'true' }), h('span', 'flex items-center min-width-0 gap-small', h('span', 'padding-y-xsmall text-truncate-end text-no-wrap', h('span', 'icon-common-play')))], { type: 'button', disabled: '', 'aria-label': lt('Play'), style: 'text-decoration: none; display: flex;' });
    const actions = h('ul', 'favorite-follow-vote-share', [
      h('li', 'game-favorite-button-container', h('div', 'tooltip-container', h('div', 'favorite-button', h('a', null, [h('div', 'icon-favorite'), h('div', 'icon-label', favCount == null ? lt('Favorite') : formatNumber(favCount))])))),
      h('li', 'game-follow-button-container', h('div', 'tooltip-container', h('div', 'follow-button', h('a', null, [h('div', 'icon-notifications-bell'), h('div', 'icon-label', lt('Notify'))])))),
      voting(v.upVotes || 0, v.downVotes || 0),
      h('li', 'social-media-share'),
    ]);
    const main = h('div', 'col-xs-12 section-content game-main-content remove-panel follow-button-enabled', [
      carousel,
      h('div', 'game-calls-to-action', [
        h('div', 'game-title-container', [h('h1', 'game-name', name, { title: name }), creator]),
        h('div', 'game-buttons-container', [
          h('div', 'game-details-play-button-container routility-ug-play-wrap', [h('span', 'play-button-contextual-message', reasonText(status)), playBtn]),
          actions,
        ]),
      ]),
    ]);

    const tabs = [['about', lt('About')]];
    if (g.length) tabs.push(['store', lt('Store')]);
    const nav = h('ul', 'nav nav-tabs', tabs.map(([id, label], i) => h('li', `rbx-tab tab-${id}` + (i === 0 ? ' active' : ''), h('a', 'rbx-tab-heading', h('span', 'text-lead', label), { href: '#' + id }))), { role: 'tablist' });
    const stats = h('ul', 'border-top border-bottom game-stat-container', [
      statLi(lt('Favorites'), favCount == null ? '-' : formatNumber(favCount)),
      statLi(lt('Status'), SHORT[status] ? lt(SHORT[status]) : reasonText(status)),
      statLi(lt('Place ID'), String(placeId)),
      statLi(lt('Universe ID'), String(uid)),
    ]);
    const about = h('div', 'tab-pane active', h('div', 'game-about-tab-container', [
      h('div', 'game-description-container', [h('div', 'container-header', h('h2', null, lt('Description'))), h('pre', 'text game-description', (p.description || '').trim()), stats]),
      b.length ? h('div', 'stack badge-container game-badges-list', [h('div', 'container-header', h('h3', null, lt('Badges'))), h('ul', 'stack-list', b.map(x => badgeRow(x, bIcons.get(x.id))))]) : null,
    ]), { 'data-tab': 'about' });
    const store = g.length ? h('div', 'tab-pane store', h('div', 'container-list game-dev-store game-passes', [h('div', 'container-header', h('h3', null, lt('Passes'))), h('ul', 'hlist store-cards gear-passes-container', g.map(x => passCard(x, gIcons.get(x.id))))]), { 'data-tab': 'store' }) : null;
    const content = h('div', 'tab-content rbx-tab-content', [about, store]);
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a.rbx-tab-heading');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      nav.querySelectorAll('.rbx-tab').forEach(li => li.classList.toggle('active', li.classList.contains('tab-' + id)));
      content.querySelectorAll(':scope > .tab-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.tab === id));
    });
    const page = h('div', 'row page-content inline-social routility-injected routility-ug', [main, h('div', 'col-xs-12 rbx-tabs-horizontal', [nav, content])]);
    document.querySelectorAll('.routility-ug-loading').forEach(n => n.remove());
    live.classList.add('routility-ug-native');
    live.after(page);
    return true;
  }

  function skeleton() {
    const sk = (w, hgt, extra) => h('span', 'routility-ug-sk' + (extra ? ' ' + extra : ''), null, { style: `width: ${w}; height: ${hgt};` });
    const carousel = h('div', 'game-details-carousel-container', h('div', null, h('span', 'thumbnail-2d-container carousel-item carousel-item-active', sk('100%', '100%'))));
    const play = h('div', 'game-details-play-button-container routility-ug-play-wrap', sk('100%', '60px'));
    const actions = h('ul', 'favorite-follow-vote-share routility-ug-sk-actions', [sk('40px', '40px'), sk('40px', '40px'), sk('120px', '40px')]);
    const main = h('div', 'col-xs-12 section-content game-main-content remove-panel follow-button-enabled', [
      carousel,
      h('div', 'game-calls-to-action', [
        h('div', 'game-title-container', [h('h1', 'game-name', sk('75%', '36px')), h('div', 'game-creator', sk('35%', '18px'))]),
        h('div', 'game-buttons-container', [play, actions]),
      ]),
    ]);
    return h('div', 'row page-content inline-social routility-injected routility-ug routility-ug-loading', main);
  }

  function run() {
    const m = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/(\d+)/i);
    const native = document.getElementById('game-details-unavailable-container');
    if (busy || !m || !native || native.classList.contains('routility-ug-native') || document.querySelector('.routility-ug:not(.routility-ug-loading)')) return;
    busy = true;
    if (!document.querySelector('.routility-ug-loading')) native.after(skeleton());
    render(m[1], native).then((ok) => {
      if (ok) return;
      document.querySelectorAll('.routility-ug-loading').forEach(n => n.remove());
      document.documentElement.classList.add('routility-ug-failed');
    }).catch(() => {
      document.querySelectorAll('.routility-ug-loading').forEach(n => n.remove());
      document.documentElement.classList.add('routility-ug-failed');
    }).finally(() => { busy = false; });
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    if (!settings.gameUnavailable) document.documentElement.classList.add('routility-ug-off');
    if (!settings.gameUnavailable || !/\/games\/\d+/.test(location.pathname)) return;
    const tick = onFrame(run);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
})();
