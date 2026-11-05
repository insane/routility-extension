(function () {
  'use strict';

  const { el, formatNumber, verifiedBadge } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const PAGE_SIZE = 50;
  let active = null;

  function pause(ms, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  async function json(url, init, signal, onWait) {
    let csrf = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      signal.throwIfAborted();
      let delay = 1500 * 2 ** attempt;
      let limited = false;
      try {
        const res = await fetch(url, {
          ...init, credentials: 'include', signal,
          headers: { ...init?.headers, ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        });
        if (res.ok) return await res.json();
        if (res.status === 403 && res.headers.get('x-csrf-token') && !csrf) {
          csrf = res.headers.get('x-csrf-token');
          continue;
        }
        if (res.status !== 429 && res.status < 500) throw new Error('HTTP ' + res.status, { cause: 'permanent' });
        limited = res.status === 429;
        if (limited) delay = 30000 * 2 ** attempt;
        const retry = res.headers.get('retry-after');
        const seconds = Number(retry);
        const after = retry ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now()) : 0;
        if (after > delay) delay = after;
      } catch (error) {
        signal.throwIfAborted();
        if (error.cause === 'permanent') throw error;
      }
      if (attempt < 3) {
        onWait({ delay, limited });
        await pause(delay, signal);
      }
    }
    throw new Error('Request failed');
  }

  // Read every member page; a failed page must never look like a completed scan.
  async function scan(gid, signal, onProgress, onWait = () => {}) {
    const seen = new Set();
    const cursors = new Set();
    const online = [];
    let checked = 0;
    let unknown = 0;
    let cursor = '';
    do {
      const url = `https://groups.roblox.com/v1/groups/${gid}/users?limit=100&sortOrder=Asc&cursor=${encodeURIComponent(cursor)}`;
      const members = await json(url, null, signal, onWait);
      if (!Array.isArray(members?.data)) throw new Error('Invalid member list');
      const batch = members.data.filter(member => {
        const id = member.user?.userId;
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid member');
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      // The member endpoint allows 100; the presence endpoint only allows 50.
      for (let i = 0; i < batch.length; i += 50) {
        const part = batch.slice(i, i + 50);
        const data = await json('https://presence.roblox.com/v1/presence/users', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userIds: part.map(member => member.user.userId) }),
        }, signal, onWait);
        if (!Array.isArray(data?.userPresences)) throw new Error('Invalid presence list');
        const presence = new Map(data.userPresences.map(p => [p.userId, p]));
        for (const member of part) {
          const p = presence.get(member.user.userId);
          if (![0, 1, 2, 3].includes(p?.userPresenceType)) unknown++;
          else if (p.userPresenceType > 0) online.push({ ...member, presence: p });
        }
        checked += part.length;
        signal.throwIfAborted();
        onProgress({ checked, unknown, online });
        if (i + 50 < batch.length) await pause(750, signal);
      }
      cursor = members.nextPageCursor;
      if (cursor != null && typeof cursor !== 'string') throw new Error('Invalid member cursor');
      if (cursor) {
        if (cursors.has(cursor)) throw new Error('Repeated member cursor');
        cursors.add(cursor);
        await pause(750, signal);
      }
    } while (cursor);
    signal.throwIfAborted();
    return { checked, unknown, online };
  }

  const validId = id => Number.isSafeInteger(id) && id > 0;

  function matchesFilter(member, inGame = false, place = '') {
    const p = member.presence;
    if (![1, 2, 3].includes(p?.userPresenceType)) return false;
    return !inGame || (p.userPresenceType === 2 && (!place || String(p.placeId) === place));
  }

  function joinUrl(member) {
    const p = member.presence;
    if (p?.userPresenceType !== 2 || !validId(p.placeId) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(p.gameId || '')) return null;
    return `https://www.roblox.com/games/start?placeId=${p.placeId}&gameInstanceId=${encodeURIComponent(p.gameId)}`;
  }

  async function loadGames(members, signal) {
    const ids = [...new Set(members.filter(member => member.presence?.userPresenceType === 2 && validId(member.presence.universeId)).map(member => member.presence.universeId))];
    const games = new Map();
    const get = async url => {
      const res = await fetch(url, { credentials: 'include', signal });
      return res.ok ? res.json() : null;
    };
    for (let i = 0; i < ids.length; i += 50) {
      signal.throwIfAborted();
      const part = ids.slice(i, i + 50).join(',');
      const [details, icons] = await Promise.allSettled([
        get(`https://games.roblox.com/v1/games?universeIds=${part}`),
        get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${part}&size=150x150&format=Webp&isCircular=false&returnPolicy=PlaceHolder`),
      ]);
      signal.throwIfAborted();
      if (details.status === 'fulfilled') for (const game of details.value?.data || []) {
        games.set(game.id, { name: game.name, place: game.rootPlaceId });
      }
      if (icons.status === 'fulfilled') for (const icon of icons.value?.data || []) {
        if (icon.imageUrl) games.set(icon.targetId, { ...games.get(icon.targetId), icon: icon.imageUrl });
      }
    }
    return games;
  }

  function close() {
    if (active) active.close();
  }

  function open(gid, anchor) {
    close();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-online-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-cm-online-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'routility-cm-online-title');
    const head = el('div', 'routility-modal-head');
    const title = el('h2', 'routility-modal-title', lt('Online Members'));
    title.id = 'routility-cm-online-title';
    const dismiss = el('button', 'routility-modal-icon routility-modal-close');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', lt('Close'));
    dismiss.appendChild(el('span', 'icon icon-regular-x'));
    head.append(title, dismiss);

    const tools = el('form', 'routility-cm-tools');
    tools.noValidate = true;
    const gameToggle = el('label', 'text-label-medium routility-cm-online-toggle');
    const inGame = el('input');
    inGame.type = 'checkbox';
    gameToggle.append(inGame, el('span', null, lt('In-game')));
    const placeField = el('div', 'routility-cm-online-place-field');
    const label = el('label', 'text-label-medium routility-cm-online-label', lt('Place ID (optional)'));
    label.htmlFor = 'routility-cm-online-place';
    const place = el('input', 'form-control input-field routility-cm-search');
    place.id = label.htmlFor;
    place.type = 'text';
    place.inputMode = 'numeric';
    place.placeholder = lt('All places');
    place.autocomplete = 'off';
    place.disabled = true;
    const action = el('button', 'btn-primary-md btn-min-width', lt('Stop Scan'));
    action.type = 'submit';
    placeField.append(label, place);
    tools.append(gameToggle, placeField, action);
    const note = el('p', 'text-body-small content-muted', lt('Scans every member, so large communities can take a while. Status is checked as each batch loads. Place filters only match locations Roblox shares.'));
    const progress = el('p', 'text-body-medium content-muted');
    progress.setAttribute('role', 'status');
    progress.setAttribute('aria-live', 'polite');
    const body = el('div', 'routility-modal-body routility-cm-body');
    const list = el('ul', 'routility-cm-online-list');
    body.appendChild(list);
    const foot = el('div', 'routility-cm-foot');
    const previous = el('button', 'btn-secondary-md', lt('Previous page'));
    const next = el('button', 'btn-secondary-md', lt('Next page'));
    previous.type = next.type = 'button';
    const pageLabel = el('span', 'text-body-small content-muted');
    foot.append(previous, pageLabel, next);
    modal.append(head, tools, note, progress, body, foot);
    backdrop.appendChild(modal);

    let controller = null;
    let running = false;
    let phase = 'ready';
    let waiting = '';
    let results = { checked: 0, unknown: 0, online: [] };
    let page = 0;
    let shown = null;
    let shownMembers = new Map();
    const pics = new Map();
    const games = new Map();
    const gameController = new AbortController();
    const state = {
      gid: String(gid),
      close: () => {
        controller?.abort();
        gameController.abort();
        backdrop.remove();
        document.removeEventListener('keydown', onKey, true);
        if (!document.querySelector('.routility-modal-backdrop')) document.documentElement.classList.remove('routility-modal-open');
        if (active === state) active = null;
        if (anchor?.isConnected) anchor.focus({ preventScroll: true });
      },
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); state.close(); }
    };
    const filterValue = () => {
      const value = inGame.checked ? place.value.trim() : '';
      const valid = !value || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0);
      place.setCustomValidity(valid ? '' : lt('Enter a valid place ID.'));
      place.setAttribute('aria-invalid', String(!valid));
      return valid ? (value ? String(Number(value)) : '') : null;
    };

    function paintGame(chip, member) {
      const p = member.presence;
      const game = games.get(p.universeId);
      chip.querySelector('.routility-cm-online-game-title').textContent = game?.name || p.lastLocation || lt('In Game');
      const image = chip.querySelector('img');
      if (game?.icon) image.src = game.icon;
      const target = validId(game?.place) ? game.place : validId(p.rootPlaceId) ? p.rootPlaceId : p.placeId;
      if (chip.tagName === 'A' && validId(target)) chip.href = `/games/${target}`;
    }

    function row(member) {
      const li = el('li');
      const link = el('a', 'routility-cm-online-player');
      link.href = `/users/${member.user.userId}/profile`;
      const image = el('img', 'routility-cm-online-avatar');
      image.alt = '';
      image.loading = 'lazy';
      const pic = pics.get(member.user.userId);
      if (pic) image.src = pic;
      image.dataset.userId = String(member.user.userId);
      const names = el('span', 'routility-cm-online-names');
      const name = el('span', 'text-label-medium', member.user.displayName || member.user.username);
      if (member.user.hasVerifiedBadge) name.appendChild(verifiedBadge());
      names.append(name, el('span', 'text-body-small content-muted', '@' + member.user.username));
      if (member.role?.name) names.appendChild(el('span', 'text-body-small content-muted', member.role.name));
      const p = member.presence;
      const status = p.userPresenceType === 2 ? lt('In Game') : p.userPresenceType === 3 ? lt('In Studio') : lt('Online');
      const detail = el('span', 'routility-cm-online-status');
      detail.appendChild(el('span', 'text-label-medium', status));
      if (p.userPresenceType === 2) {
        const game = el(validId(p.rootPlaceId) || validId(p.placeId) ? 'a' : 'span', 'routility-cm-online-game');
        game.dataset.userId = String(member.user.userId);
        const icon = el('span', 'routility-cm-online-game-icon');
        const image = el('img');
        image.alt = '';
        image.loading = 'lazy';
        icon.appendChild(image);
        game.append(icon, el('span', 'text-body-small routility-cm-online-game-title'));
        if (validId(p.placeId)) game.title = lt('Place {id}', { id: String(p.placeId) });
        paintGame(game, member);
        detail.appendChild(game);
      }
      link.append(image, names);
      li.append(link, detail);
      if (p.userPresenceType === 2) {
        const url = joinUrl(member);
        const join = el(url ? 'a' : 'button', 'btn-primary-sm routility-cm-online-join', lt('Join'));
        join.setAttribute('aria-label', lt('Join {name}', { name: member.user.displayName || member.user.username }));
        if (url) {
          join.href = url;
          join.target = '_blank';
          join.rel = 'noopener';
          join.title = lt('Join their server');
        } else {
          join.type = 'button';
          join.disabled = true;
          join.title = lt('Roblox hasn’t shared this server.');
        }
        li.appendChild(join);
      }
      return li;
    }

    function paint() {
      const filter = filterValue();
      const matches = filter === null ? [] : results.online.filter(member => matchesFilter(member, inGame.checked, filter));
      const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
      page = Math.max(0, Math.min(page, pages - 1));
      const visible = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      shownMembers = new Map(visible.map(member => [String(member.user.userId), member]));
      const key = visible.length ? visible.map(member => member.user.userId).join(',') : phase + ':' + filter;
      if (key !== shown) {
        shown = key;
        list.replaceChildren(...visible.map(row));
        if (!visible.length) {
          const text = filter === null ? lt('Enter a valid place ID.') : phase === 'ready' ? lt('Start a scan to find online members.') : running ? lt('Looking for online members…') : lt('No matching online members found in the members checked.');
          list.appendChild(el('li', 'routility-cm-empty text-body-medium content-muted', text));
        }
      }
      const status = running && waiting ? waiting : { ready: lt('Ready'), scanning: lt('Scanning…'), stopped: lt('Stopped · Partial results'), failed: lt('Couldn’t finish the scan. Results are partial. Try again in a moment.'), done: lt('Scan complete') }[phase];
      progress.textContent = lt('{status} · {checked} members checked · {online} online · {matches} matches', { status, checked: formatNumber(results.checked), online: formatNumber(results.online.length), matches: formatNumber(matches.length) });
      if (results.unknown) progress.textContent += ' · ' + ltn(results.unknown, '{n} status unavailable', '{n} statuses unavailable', { n: formatNumber(results.unknown) });
      previous.disabled = page === 0;
      next.disabled = page === pages - 1;
      pageLabel.textContent = lt('Page {page} of {pages}', { page: formatNumber(page + 1), pages: formatNumber(pages) });
      action.textContent = running ? lt('Stop Scan') : phase === 'ready' ? lt('Find Online Members') : lt('Scan Again');
      const missing = visible.map(member => member.user.userId).filter(id => !pics.has(id));
      if (missing.length) {
        missing.forEach(id => pics.set(id, ''));
        window.RoUtilityUI.request({ type: 'getHeadshots', ids: missing.map(String) }, r => r && typeof r === 'object').then(data => {
          if (active !== state) return;
          for (const id of missing) if (data?.[id]) pics.set(id, data[id]);
          for (const image of list.querySelectorAll('img[data-user-id]')) {
            const src = pics.get(Number(image.dataset.userId));
            if (src) image.src = src;
          }
        }).catch(() => {});
      }
      const missingGames = visible.filter(member => member.presence.userPresenceType === 2 && validId(member.presence.universeId) && !games.has(member.presence.universeId));
      if (missingGames.length) {
        missingGames.forEach(member => games.set(member.presence.universeId, {}));
        loadGames(missingGames, gameController.signal).then(data => {
          if (active !== state) return;
          for (const [id, game] of data) games.set(id, game);
          for (const chip of list.querySelectorAll('.routility-cm-online-game')) {
            const member = shownMembers.get(chip.dataset.userId);
            if (member) paintGame(chip, member);
          }
        }).catch(() => {});
      }
    }

    async function startScan() {
      if (running) return;
      if (filterValue() === null) { place.reportValidity(); return; }
      controller = new AbortController();
      running = true;
      phase = 'scanning';
      waiting = '';
      page = 0;
      results = { checked: 0, unknown: 0, online: [] };
      paint();
      try {
        results = await scan(gid, controller.signal, update => {
          if (active !== state) return;
          waiting = '';
          results = update;
          paint();
        }, ({ delay, limited }) => {
          if (active !== state) return;
          waiting = limited ? lt('Roblox is limiting requests. Retrying in {n} seconds…', { n: Math.ceil(delay / 1000) }) : lt('Retrying in {n} seconds…', { n: Math.ceil(delay / 1000) });
          paint();
        });
        phase = 'done';
      } catch {
        phase = controller.signal.aborted ? 'stopped' : 'failed';
      } finally {
        running = false;
        if (active === state) paint();
      }
    }
    tools.addEventListener('submit', e => {
      e.preventDefault();
      if (running) controller.abort();
      else startScan();
    });
    inGame.addEventListener('change', () => { place.disabled = !inGame.checked; page = 0; paint(); });
    place.addEventListener('input', () => { page = 0; paint(); });
    previous.addEventListener('click', () => { page--; paint(); body.scrollTop = 0; });
    next.addEventListener('click', () => { page++; paint(); body.scrollTop = 0; });
    dismiss.addEventListener('click', state.close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) state.close(); });
    document.addEventListener('keydown', onKey, true);
    active = state;
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    if (!document.hidden) modal.classList.add('routility-reveal');
    paint();
    inGame.focus();
    startScan();
  }

  window.RoUtilityGroupOnline = { scan, matchesFilter, joinUrl, loadGames, open, close };
})();
