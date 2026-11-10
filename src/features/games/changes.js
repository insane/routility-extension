(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, onFrame, formatNumber } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const KEY = 'routilityGameSnaps';
  const SHOWN = 'routilityGameChange:';
  const MAX = 400;
  const LINES = 10;
  let on = false;
  let doing = '';
  let observer = null;
  let current = null;

  const universe = () => document.querySelector('#game-detail-meta-data')?.dataset.universeId || '';

  function snapshot(g) {
    return {
      name: g.name || '',
      description: String(g.description || '').replace(/\r\n?/g, '\n'),
      maxPlayers: Number(g.maxPlayers) || 0,
      price: g.price == null ? null : Number(g.price),
      genre: [g.genre_l1, g.genre_l2].filter(Boolean).join(' / ') || (g.genre && g.genre !== 'All' ? g.genre : ''),
      at: Date.now(),
    };
  }

  function lineDiff(a, b) {
    const x = a.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 300);
    const y = b.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 300);
    const n = x.length;
    const m = y.length;
    const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    const out = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) out.push({ sign: '-', text: x[i++] }); else out.push({ sign: '+', text: y[j++] });
    }
    while (i < n) out.push({ sign: '-', text: x[i++] });
    while (j < m) out.push({ sign: '+', text: y[j++] });
    return out;
  }

  function price(v) {
    if (v == null) return lt('Free');
    return lt('{n} Robux', { n: formatNumber(v) });
  }

  function changesOf(old, now) {
    const facts = [];
    if (old.name !== now.name) facts.push([lt('Name'), old.name, now.name]);
    if (old.maxPlayers && now.maxPlayers && old.maxPlayers !== now.maxPlayers) facts.push([lt('Server Size'), formatNumber(old.maxPlayers), formatNumber(now.maxPlayers)]);
    if ((old.price ?? null) !== (now.price ?? null)) facts.push([lt('Price'), price(old.price), price(now.price)]);
    if (old.genre && now.genre && old.genre !== now.genre) facts.push([lt('Genre'), old.genre, now.genre]);
    const lines = old.description !== now.description ? lineDiff(old.description, now.description) : [];
    return facts.length || lines.length ? { facts, lines, since: old.at } : null;
  }

  function prune(all) {
    const ids = Object.keys(all);
    if (ids.length <= MAX) return;
    ids.sort((a, b) => (all[a].at || 0) - (all[b].at || 0)).slice(0, ids.length - MAX).forEach(id => delete all[id]);
  }

  function card(id, change) {
    const sec = el('div', 'section routility-injected routility-gc');
    const head = el('div', 'container-header routility-gc-head');
    head.appendChild(el('h2', null, lt('What Changed')));
    const when = new Date(change.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    head.appendChild(el('span', 'text-body-small content-muted routility-gc-since', lt('Since you last opened it on {date}', { date: when })));
    const hide = el('button', 'routility-modal-icon routility-gc-hide');
    hide.type = 'button';
    hide.setAttribute('aria-label', lt('Hide'));
    hide.appendChild(el('span', 'icon icon-regular-x'));
    hide.addEventListener('click', () => {
      try { sessionStorage.removeItem(SHOWN + id); } catch {}
      sec.remove();
      current = null;
    });
    head.appendChild(hide);
    const box = el('div', 'section-content routility-gc-box');
    if (change.facts.length) {
      const facts = el('ul', 'routility-gc-facts');
      for (const [name, a, b] of change.facts) {
        const li = el('li', 'text-body-medium');
        li.append(el('span', 'content-muted', name + ' '), el('span', 'routility-gc-old', a), el('span', 'content-muted', ' → '), el('span', 'content-emphasis', b));
        facts.appendChild(li);
      }
      box.appendChild(facts);
    }
    if (change.lines.length) {
      const list = el('ul', 'routility-gc-lines');
      const draw = (all) => {
        list.replaceChildren(...(all ? change.lines : change.lines.slice(0, LINES)).map((l) => {
          const li = el('li', 'text-body-small routility-gc-line routility-gc-' + (l.sign === '+' ? 'add' : 'del'));
          li.append(el('span', 'routility-gc-sign', l.sign === '+' ? '+' : '−'), el('span', 'routility-gc-text', l.text));
          return li;
        }));
      };
      draw(false);
      box.appendChild(list);
      if (change.lines.length > LINES) {
        const more = el('button', 'btn-control-xs routility-gc-more', lt('Show All {n} Changes', { n: formatNumber(change.lines.length) }));
        more.type = 'button';
        more.addEventListener('click', () => {
          draw(true);
          more.remove();
        });
        box.appendChild(more);
      }
    }
    sec.append(head, box);
    return sec;
  }

  function place() {
    if (!current || !on) {
      document.querySelectorAll('.routility-gc').forEach(n => n.remove());
      return;
    }
    const host = document.querySelector('.game-about-tab-container');
    if (!host) return;
    if (current.node.parentElement !== host || host.firstElementChild !== current.node) host.prepend(current.node);
  }

  async function check() {
    const id = universe();
    if (!on || !id || doing === id) return;
    doing = id;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SHOWN + id) || 'null'); } catch {}
    const d = await json(`https://games.roblox.com/v1/games?universeIds=${id}`);
    const g = d && d.data && d.data[0];
    if (!g) {
      doing = '';
      return;
    }
    const now = snapshot(g);
    const st = await chrome.storage.local.get(KEY);
    const all = st[KEY] || {};
    const old = all[id];
    all[id] = now;
    prune(all);
    await chrome.storage.local.set({ [KEY]: all });
    const change = (old && changesOf(old, now)) || saved;
    if (!change || universe() !== id) return;
    try { sessionStorage.setItem(SHOWN + id, JSON.stringify(change)); } catch {}
    current = { id, node: card(id, change) };
    place();
  }

  function start() {
    if (observer || !/^\/games\/\d+/i.test(location.pathname)) return;
    const queue = onFrame(place);
    observer = new MutationObserver((records) => {
      if (records.every(r => r.target.closest?.('.routility-gc'))) return;
      queue();
    });
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    check();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    on = (st.routilitySettings || {}).gameChanges !== false;
    if (on) start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    on = (changes.routilitySettings.newValue || {}).gameChanges !== false;
    if (on) start();
    place();
  });
})();
