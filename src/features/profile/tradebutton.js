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

  function view(status, userId) {
    if (status === 'CanTrade') return { text: lt('Trade'), href: `/users/${userId}/trade`, tip: lt('Start a trade with this person') };
    if (status === 'ReceiverPrivacyTooStrict') return { text: lt('Can’t Trade'), off: true, tip: lt('Not accepting trades from you. Their trade settings may only allow friends or people they follow.') };
    if (status === 'ReceiverCannotTrade') return { text: lt('Can’t Trade'), off: true, tip: lt('This account can’t trade.') };
    if (status === 'SenderPrivacyTooStrict') return { text: lt('Can’t Trade'), href: '/my/account#!/privacy', tip: lt('Your “Who can trade with me?” setting doesn’t include this person. Click to change it.') };
    return null;
  }

  async function status(userId) {
    try {
      const r = await fetch(`https://trades.roblox.com/v1/users/${userId}/can-trade-with`, { credentials: 'include' });
      if (!r.ok) return null;
      return (await r.json()).status || null;
    } catch {
      return null;
    }
  }

  function header() {
    return document.querySelector('#content > .profile-platform-container .user-profile-header-info');
  }

  function build(ref, v) {
    const b = ref.cloneNode(true);
    b.removeAttribute('id');
    b.removeAttribute('data-testid');
    b.className = ref.className.replace(/\bbg-action-emphasis\b/g, 'bg-action-standard').replace(/\bcontent-action-emphasis\b/g, 'content-action-standard') + ' routility-injected routility-trade-btn';
    b.type = 'button';
    const spans = [...b.querySelectorAll('span')].filter(x => !x.children.length);
    const label = spans.find(x => x.textContent.trim()) || spans[0];
    b.querySelectorAll('span').forEach(x => { if (x !== label && !x.children.length && x.textContent.trim()) x.remove(); });
    if (label) label.textContent = v.text;
    if (v.tip) b.dataset.rtTip = v.tip;
    if (v.off) {
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
    } else {
      b.addEventListener('click', () => { location.href = v.href; });
    }
    return b;
  }

  function paint() {
    const m = location.pathname.match(PATH);
    const h = header();
    const existing = document.querySelector('.routility-trade-btn');
    if (!on || !m || !current || current.userId !== m[1] || !current.view || !h) {
      existing?.remove();
      return;
    }
    const box = h.querySelector('.button-container');
    const ref = box && [...box.querySelectorAll('button.foundation-web-button')].find(x => !x.classList.contains('routility-trade-btn') && x.textContent.trim());
    if (!ref) return;
    if (existing && existing.parentElement === box && existing.dataset.key === current.key) return;
    existing?.remove();
    const b = build(ref, current.view);
    b.dataset.key = current.key;
    box.appendChild(b);
  }

  async function load() {
    const m = location.pathname.match(PATH);
    if (!on || !m || m[1] === me()) {
      current = null;
      paint();
      return;
    }
    if (current && current.userId === m[1]) return paint();
    const mine = current = { userId: m[1], view: null, key: '' };
    const st = await status(m[1]);
    if (current !== mine) return;
    mine.view = view(st, m[1]);
    mine.key = st || '';
    paint();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame((records) => {
      if (records && records.every(r => r.target.closest?.('.routility-trade-btn'))) return;
      load();
    }));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    load();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).profileTrade !== false;
    if (on) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).profileTrade !== false;
    if (on) start();
    else paint();
  });
})();
