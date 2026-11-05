(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const KEY = 'routilityServerPlayers';
  let on = false;
  let observer = null;
  let range = { min: '', max: '' };
  try { range = Object.assign(range, JSON.parse(sessionStorage.getItem(KEY) || '{}')); } catch {}

  const onGame = () => /^\/games\/\d+/i.test(location.pathname);
  const num = (v) => (/^\d{1,3}$/.test(String(v).trim()) ? Number(v) : null);

  function playersOf(li) {
    const m = (li.querySelector('.rbx-public-game-server-status')?.textContent || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function field(which, label) {
    const input = el('input', 'input-field routility-players-input');
    input.type = 'number';
    input.min = '0';
    input.max = '700';
    input.inputMode = 'numeric';
    input.placeholder = label;
    input.setAttribute('aria-label', lt('{bound} players', { bound: label }));
    input.value = range[which];
    input.addEventListener('input', () => {
      range[which] = input.value;
      try { sessionStorage.setItem(KEY, JSON.stringify(range)); } catch {}
      apply();
    });
    return input;
  }

  function control() {
    const box = el('div', 'select-group routility-injected routility-players-filter');
    box.append(el('span', 'select-label text-label', lt('Players')), field('min', lt('Min')), el('span', 'text-label routility-players-dash', '–'), field('max', lt('Max')));
    return box;
  }

  function apply() {
    const min = num(range.min);
    const max = num(range.max);
    const active = on && (min != null || max != null);
    const list = document.querySelector('#rbx-public-game-server-item-container');
    let shown = 0;
    let total = 0;
    for (const li of document.querySelectorAll('#rbx-public-game-server-item-container > li.rbx-public-game-server-item')) {
      const n = playersOf(li);
      const hide = active && n != null && ((min != null && n < min) || (max != null && n > max));
      if (hide) li.dataset.routilityPlayersHidden = '1';
      else delete li.dataset.routilityPlayersHidden;
      total++;
      if (!hide) shown++;
    }
    let note = document.querySelector('.routility-players-note');
    const want = active && total > 0 && shown === 0;
    if (want && !note && list) {
      note = el('p', 'text-body-medium content-muted routility-injected routility-players-note', lt('No servers loaded so far have that many players. Press Load More to check more servers.'));
      list.after(note);
    } else if (!want && note) note.remove();
  }

  function run() {
    const opts = on && onGame() ? document.querySelector('#rbx-public-running-games .server-list-options') : null;
    const mine = document.querySelector('.routility-players-filter');
    if (!opts) {
      if (!on) {
        mine?.remove();
        document.querySelector('.routility-players-note')?.remove();
        document.querySelectorAll('[data-routility-players-hidden]').forEach(li => delete li.dataset.routilityPlayersHidden);
      }
      return;
    }
    if (!mine || mine.parentElement !== opts) {
      mine?.remove();
      const sort = opts.querySelector(':scope > .select-group');
      if (sort) sort.after(control());
      else opts.prepend(control());
    }
    apply();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame(run));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    run();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).serverPlayerFilter !== false;
    if (on) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).serverPlayerFilter !== false;
    if (on) start();
    run();
  });
})();
