(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/profile/i;
  let on = false;
  let observer = null;
  let current = null;

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  async function status(userId) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.dataset.token || '';
    try {
      const r = await fetch('https://apis.roblox.com/profile-platform-api/v1/profiles/get', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ profileId: String(userId), profileType: 'User', components: [{ component: 'UserProfileHeader' }] }) });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.components?.UserProfileHeader?.viewerRelationship?.trustedFriendStatus || null;
    } catch {
      return null;
    }
  }

  function buttons() {
    return [...document.querySelectorAll('.user-profile-header-info button[id^="user-profile-header-AddTrusted"]')];
  }

  function release() {
    for (const b of document.querySelectorAll('.routility-trusted-off')) {
      b.classList.remove('routility-trusted-off');
      b.disabled = false;
      b.removeAttribute('aria-disabled');
      delete b.dataset.rtTip;
    }
  }

  function paint() {
    const m = location.pathname.match(PATH);
    if (!on || !m || !current || current.userId !== m[1] || current.status !== 'NotEligible') return release();
    const tip = lt('Roblox won’t let you add them as a Trusted Friend. Trusted Friends have to be people you know, and some accounts can’t have them at all.');
    for (const b of buttons()) {
      if (b.classList.contains('routility-trusted-off') && b.disabled) continue;
      b.classList.add('routility-trusted-off');
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
      b.dataset.rtTip = tip;
    }
  }

  async function load() {
    const m = location.pathname.match(PATH);
    if (!on || !m || m[1] === me()) {
      current = null;
      return paint();
    }
    if (current && current.userId === m[1]) return paint();
    if (!buttons().length) return;
    const mine = current = { userId: m[1], status: null };
    const st = await status(m[1]);
    if (current !== mine) return;
    mine.status = st;
    paint();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame(load));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    load();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).profileTrusted !== false;
    if (on) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).profileTrusted !== false;
    if (on) start();
    else paint();
  });
})();
