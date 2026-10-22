(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  const SEE_ALL = LT('See All');
  let on = false;

  function seeAll() {
    for (const head of document.querySelectorAll(':is(.games-list-container, .game-sort-carousel-wrapper) > .home-sort-header-container')) {
      const link = head.querySelector('a[data-testid="section-header-title-subtitle-container"][href]');
      let more = head.querySelector(':scope > .routility-2017-more');
      if (!link) {
        more?.remove();
        continue;
      }
      if (!more) {
        more = document.createElement('a');
        more.className = 'routility-2017-more';
        more.textContent = lt(SEE_ALL);
        head.append(more);
      }
      if (more.getAttribute('href') !== link.getAttribute('href')) more.setAttribute('href', link.getAttribute('href'));
    }
  }

  let searchLeft = '';
  function placeSearch() {
    const root = document.documentElement;
    const input = document.getElementById('navbar-search-input');
    if (!on || !input) {
      if (searchLeft) {
        root.style.removeProperty('--c17-search-left');
        searchLeft = '';
      }
      return;
    }
    const r = input.closest('.navbar-search')?.getBoundingClientRect() || input.getBoundingClientRect();
    if (!r.width) return;
    const vw = root.clientWidth;
    const w = Math.min(800, vw - 24);
    const left = Math.round(Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12))) + 'px';
    if (left === searchLeft) return;
    searchLeft = left;
    root.style.setProperty('--c17-search-left', left);
  }

  function run() {
    placeSearch();
    if (!on) {
      document.querySelectorAll('.routility-2017-more').forEach(n => n.remove());
      return;
    }
    seeAll();
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

  window.addEventListener('resize', placeSearch);
  document.addEventListener('focusin', (e) => { if (e.target?.id === 'navbar-search-input') placeSearch(); });

  document.addEventListener('click', (e) => {
    if (!on) return;
    const opt = e.target.closest?.(':is(.filters-container, .catalog-search-options-top-bar) .filters-modal-container .filter-option');
    if (!opt) return;
    const modal = opt.closest('.filters-modal-container');
    if (modal.querySelector('input')) return;
    setTimeout(() => modal.querySelector('.apply-button')?.click(), 0);
  }, true);

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).classicSite === true;
    new MutationObserver(() => { if (on) tick(); }).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).classicSite === true;
    tick();
  });
})();
