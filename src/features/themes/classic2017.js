(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  const SEE_ALL = LT('See All');
  const NAV = { 'nav-charts-md-link': LT('Games'), 'nav-marketplace-md-link': LT('Catalog') };
  let on = false;

  function seeAll() {
    for (const head of document.querySelectorAll('.games-list-container > .home-sort-header-container')) {
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

  function navNames() {
    for (const [id, name] of Object.entries(NAV)) {
      const a = document.getElementById(id);
      if (!a) continue;
      if (on) {
        if (a.dataset.rtName === undefined) a.dataset.rtName = a.textContent;
        if (a.textContent !== lt(name)) a.textContent = lt(name);
      } else if (a.dataset.rtName !== undefined) {
        a.textContent = a.dataset.rtName;
        delete a.dataset.rtName;
      }
    }
  }

  function run() {
    navNames();
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

  document.addEventListener('click', (e) => {
    if (!on) return;
    const opt = e.target.closest?.('.filters-container .filters-modal-container .filter-option');
    if (!opt) return;
    const modal = opt.closest('.filters-modal-container');
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
