(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com' || window.RoUtilityCoexist) return;
  const root = document.documentElement;
  const MARKS = [
    ['routility-with-btr-profile', '.btr-profile-container'],
    ['routility-with-foreign-friendsown', '.rovalra-friend-ownership-container, .item-connections-social-count'],
    ['routility-with-foreign-rig', '.ropro-avatar-menu .avatar-type-toggle'],
    ['routility-with-foreign-filter', '#rovalra-fx-container'],
  ];
  const GROUPS = [
    ['#item-details', ':scope > .item-info-row-container', ':scope > .row-label, :scope > .text-label'],
    ['ul.game-stat-container', ':scope > li.game-stat', ':scope > .text-label'],
    ['.left-nav nav > ul', ':scope > li', '.text-truncate-end'],
  ];
  const YIELD = 'routility-yield';

  const label = (n, sel) => ((n.querySelector(sel) || {}).textContent || '').trim().toLowerCase();
  const shown = (n) => !n.classList.contains(YIELD) && n.getClientRects().length > 0;

  function dedupe() {
    for (const [hostSel, itemSel, labelSel] of GROUPS) {
      for (const host of document.querySelectorAll(hostSel)) {
        const items = [...host.querySelectorAll(itemSel)];
        const ours = items.filter(n => n.classList.contains('routility-injected'));
        if (!ours.length) continue;
        const theirs = new Set(items.filter(n => !n.classList.contains('routility-injected') && shown(n)).map(n => label(n, labelSel)).filter(Boolean));
        for (const n of ours) {
          const dup = theirs.has(label(n, labelSel));
          if (n.classList.contains(YIELD) !== dup) n.classList.toggle(YIELD, dup);
        }
      }
    }
  }

  function scan() {
    for (const [cls, sel] of MARKS) {
      const on = !!document.querySelector(sel);
      if (root.classList.contains(cls) !== on) root.classList.toggle(cls, on);
    }
    dedupe();
  }

  let queued = false;
  let last = 0;
  const tick = () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      last = Date.now();
      scan();
    }, Math.max(0, 400 - (Date.now() - last)));
  };

  new MutationObserver(tick).observe(root, { childList: true, subtree: true });
  tick();
  window.RoUtilityCoexist = { scan };
})();
