(function () {
  'use strict';

  const { el, request, onFrame, verifiedBadge, formatNumber } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  let state = null;

  async function theirFriends(userId, allowHidden) {
    const ids = await window.RoUtilityUI.friendIds(userId);
    if (ids) return ids.filter(id => id > 0).map(String);
    if (!allowHidden || !window.RoUtilityFriends) return null;
    const list = await window.RoUtilityFriends.load(userId);
    return list ? list.map(f => String(f.id)) : null;
  }

  function stack(s, size) {
    const wrap = el('span', 'routility-mutual-stack');
    for (const f of s.mutual.slice(0, 3)) {
      const pic = el('span', 'routility-mutual-face');
      pic.style.width = pic.style.height = size + 'px';
      const src = s.pics[f.id];
      if (src) {
        const img = el('img');
        img.alt = '';
        img.src = src;
        pic.appendChild(img);
      }
      wrap.appendChild(pic);
    }
    return wrap;
  }

  function closePop() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.routility-mutual-chip, .routility-mutual-pop')) document.activeElement.blur();
    document.querySelector('.routility-mutual-pop')?.remove();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEsc, true);
    if (untrack) untrack();
    untrack = null;
  }

  let untrack = null;

  function onOutside(e) {
    if (!e.target.closest?.('.routility-mutual-pop, .routility-mutual-trigger')) closePop();
  }

  function onEsc(e) {
    if (e.key === 'Escape') closePop();
  }

  function openPop(anchor) {
    const s = state;
    if (!s || !s.mutual) return;
    if (document.querySelector('.routility-mutual-pop')) return closePop();
    const pop = el('div', 'routility-injected routility-mutual-pop bg-surface-100 stroke-muted stroke-standard radius-large shadow-transient-high');
    pop.setAttribute('role', 'dialog');
    pop.appendChild(el('div', 'text-label content-default routility-mutual-pop-title', ltn(s.mutual.length, '{n} mutual friend', '{n} mutual friends', { n: formatNumber(s.mutual.length) })));
    const list = el('ul', 'routility-mutual-list');
    for (const f of s.mutual) {
      const li = el('li');
      const a = el('a', 'routility-mutual-row relative clip group/interactable');
      a.href = `/users/${f.id}/profile`;
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      const face = el('span', 'routility-mutual-face routility-mutual-face-lg');
      if (s.pics[f.id]) {
        const img = el('img');
        img.alt = '';
        img.src = s.pics[f.id];
        face.appendChild(img);
      }
      const text = el('span', 'routility-mutual-text');
      const name = el('span', 'routility-mutual-name');
      name.appendChild(el('span', 'text-overflow', f.displayName || f.name));
      if (f.verified) name.appendChild(verifiedBadge());
      text.append(name, el('span', 'routility-mutual-user text-overflow', '@' + f.name));
      a.append(layer, face, text);
      li.appendChild(a);
      list.appendChild(li);
    }
    pop.appendChild(list);
    document.body.appendChild(pop);
    window.RoUtilityUI.keyNav(pop, '.routility-mutual-row', true);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.round(Math.max(8, Math.min(document.documentElement.clientWidth - w - 8, r.left))) + 'px';
      pop.style.top = Math.round(r.bottom + 6) + 'px';
    };
    place();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onEsc, true);
    untrack = window.RoUtilityUI.trackPopover(pop, anchor, place, closePop);
  }

  function trigger(node) {
    node.classList.add('routility-mutual-trigger');
    node.addEventListener('click', (e) => {
      e.preventDefault();
      openPop(node);
    });
    return node;
  }

  function ensure() {
    const s = state;
    if (!s || !s.mutual || !s.mutual.length) return;
    const label = ltn(s.mutual.length, '{n} Mutual', '{n} Mutual', { n: formatNumber(s.mutual.length) });
    const friendsChip = document.querySelector(`a[href*="/users/${s.userId}/friends#!/friends"].radius-circle:not(.routility-mutual-chip)`);
    const row = friendsChip?.parentElement;
    const following = row && [...row.children].find(c => /Following$/.test(c.textContent.trim()));
    if (following && !row.querySelector('.routility-mutual-chip')) {
      const chip = el('a', 'relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility routility-injected routility-mutual-chip');
      chip.href = `/users/${s.userId}/friends#!/friends`;
      chip.style.textDecoration = 'none';
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      chip.append(layer, stack(s, 18), el('span', 'padding-y-xsmall text-no-wrap text-truncate-end', label));
      following.after(trigger(chip));
    }
    const info = document.querySelector('.routility-classic .header-details ul.details-info');
    if (info && !document.querySelector('.routility-classic .routility-mutual-li')) {
      const li = el('li', 'routility-injected routility-mutual-li');
      const a = el('a', 'text-name routility-mutual-count');
      a.href = `/users/${s.userId}/friends#!/friends`;
      a.append(stack(s, 16), el('span', null, formatNumber(s.mutual.length)));
      li.append(trigger(a), el('div', 'text-label font-caption-header', lt('Mutual')));
      info.appendChild(li);
    }
  }

  async function setup(userId, opts = {}) {
    const me = document.querySelector('meta[name="user-data"]')?.dataset.userid;
    if (!me || me === String(userId) || !window.RoUtilitySearch?.myFriends) return;
    if (state && state.userId === String(userId)) return;
    teardown();
    const s = { userId: String(userId), mutual: null, pics: {} };
    state = s;
    s.observer = new MutationObserver(onFrame(ensure));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    const [mine, theirs] = await Promise.all([window.RoUtilitySearch.myFriends(), theirFriends(s.userId, opts.hidden)]);
    if (state !== s || !theirs || !mine) return;
    const set = new Set(theirs);
    const mutual = mine.filter(f => set.has(String(f.id))).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
    if (!mutual.length) return;
    const pics = (await request({ type: 'getHeadshots', ids: mutual.slice(0, 100).map(f => f.id) })) || {};
    if (state !== s) return;
    s.pics = pics;
    s.mutual = mutual;
    ensure();
  }

  function teardown() {
    closePop();
    if (!state) return;
    state.observer?.disconnect();
    state = null;
    document.querySelectorAll('.routility-mutual-chip, .routility-mutual-li').forEach(n => n.remove());
  }

  window.RoUtilityMutual = { setup, teardown };
})();
