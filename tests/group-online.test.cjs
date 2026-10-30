const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/features/communities/online.js'), 'utf8');

function load(fetch, timers = {}) {
  const delays = [];
  const context = {
    window: { RoUtilityUI: {}, RoUtilityI18n: {} }, fetch, AbortController,
    setTimeout: (fn, ms) => { delays.push(ms); return setTimeout(fn, 0); }, clearTimeout,
    ...timers,
  };
  vm.runInNewContext(source, context);
  return { ...context.window.RoUtilityGroupOnline, delays };
}

const member = id => ({ user: { userId: id, username: 'Player' + id, displayName: 'Player ' + id }, role: { name: 'Member', rank: 1 } });
const response = (body, status = 200, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers(headers) });
const run = (api, update = () => {}) => api.scan('1200769', new AbortController().signal, update);

test('walks every cursor, batches presence, deduplicates members and keeps every online status', async () => {
  const calls = [];
  const members = Array.from({ length: 100 }, (_, i) => member(i + 1));
  const api = load(async (url, init) => {
    calls.push({ url, init });
    if (url.includes('groups.roblox.com')) return response(new URL(url).searchParams.get('cursor')
      ? { data: [member(1), member(101)], nextPageCursor: null }
      : { data: members, nextPageCursor: 'cursor +/=' });
    const ids = JSON.parse(init.body).userIds;
    assert.ok(ids.length <= 50);
    return response({ userPresences: ids.map(userId => ({ userId, userPresenceType: userId % 4 })) });
  });
  const updates = [];
  const result = await run(api, value => updates.push(value.checked));
  assert.equal(result.checked, 101);
  assert.equal(result.unknown, 0);
  assert.equal(result.online.length, 76);
  assert.deepEqual(updates, [50, 100, 101]);
  assert.deepEqual(calls.filter(c => c.init.method === 'POST').map(c => JSON.parse(c.init.body).userIds.length), [50, 50, 1]);
  assert.ok(calls[3].url.includes('cursor=cursor%20%2B%2F%3D'));
  assert.equal(result.online[0].role.name, 'Member');
  assert.ok(calls.every(c => c.init.credentials === 'include'));
});

test('has no arbitrary member-page cap and continues through an empty page with a cursor', async () => {
  let pages = 0;
  const api = load(async url => {
    if (url.includes('groups.roblox.com')) {
      pages++;
      return response({ data: pages === 4 ? [] : [member(pages)], nextPageCursor: pages < 14 ? String(pages) : null });
    }
    return response({ userPresences: [{ userId: pages, userPresenceType: 0 }] });
  });
  assert.equal((await run(api)).checked, 13);
  assert.equal(pages, 14);
});

test('handles an empty group without a presence request', async () => {
  let calls = 0;
  const result = await run(load(async () => { calls++; return response({ data: [], nextPageCursor: null }); }));
  assert.equal(calls, 1);
  assert.equal(result.checked, 0);
});

test('reports missing and invalid presence as unavailable instead of offline', async () => {
  const api = load(async url => response(url.includes('groups.roblox.com')
    ? { data: [member(1), member(2), member(3)], nextPageCursor: null }
    : { userPresences: [{ userId: 1, userPresenceType: 9 }, { userId: 2, userPresenceType: 1 }] }));
  const result = await run(api);
  assert.equal(result.checked, 3);
  assert.equal(result.unknown, 2);
  assert.equal(result.online.length, 1);
});

test('supports all online, in-game, and exact-place filters', () => {
  const { matchesFilter } = load();
  const online = p => ({ presence: p });
  for (const type of [1, 2, 3]) assert.ok(matchesFilter(online({ userPresenceType: type })));
  assert.ok(!matchesFilter(online({ userPresenceType: 0 })));
  assert.ok(!matchesFilter(online({ userPresenceType: 9 })));
  assert.ok(matchesFilter(online({ userPresenceType: 1 }), false, '123'), 'ignores a retained place ID when In-game is unchecked');
  assert.ok(matchesFilter(online({ userPresenceType: 2, placeId: null }), true), 'includes hidden locations in the in-game filter');
  assert.ok(!matchesFilter(online({ userPresenceType: 1 }), true));
  assert.ok(!matchesFilter(online({ userPresenceType: 3 }), true));
  assert.ok(matchesFilter(online({ userPresenceType: 2, placeId: 123, rootPlaceId: 456 }), true, '123'));
  assert.ok(!matchesFilter(online({ userPresenceType: 2, placeId: 123, rootPlaceId: 456 }), true, '456'));
  assert.ok(!matchesFilter(online({ userPresenceType: 2, placeId: null }), true, '123'));
  assert.ok(!matchesFilter(online({ userPresenceType: 3, placeId: 123 }), true, '123'));
});

test('Join targets the exact shared server and rejects unavailable or invalid server details', () => {
  const { joinUrl } = load();
  const p = { userPresenceType: 2, placeId: 123, gameId: '01234567-89ab-cdef-0123-456789abcdef' };
  assert.equal(joinUrl({ presence: p }), 'https://www.roblox.com/games/start?placeId=123&gameInstanceId=01234567-89ab-cdef-0123-456789abcdef');
  for (const change of [{ userPresenceType: 1 }, { userPresenceType: 3 }, { placeId: null }, { placeId: -1 }, { gameId: null }, { gameId: 'server&placeId=456' }]) {
    assert.equal(joinUrl({ presence: { ...p, ...change } }), null);
  }
});

test('loads game titles and icons once per universe in batches', async () => {
  const calls = [];
  const api = load(async (url, init) => {
    calls.push(url);
    assert.equal(init.credentials, 'include');
    const ids = new URL(url).searchParams.get('universeIds').split(',').map(Number);
    assert.ok(ids.length <= 50);
    return response({ data: ids.map(id => url.includes('thumbnails.roblox.com')
      ? { targetId: id, imageUrl: 'https://tr.rbxcdn.com/' + id }
      : { id, name: 'Game ' + id, rootPlaceId: id + 100 }) });
  });
  const playing = universeId => ({ presence: { userPresenceType: 2, universeId } });
  const games = await api.loadGames([
    ...Array.from({ length: 51 }, (_, i) => playing(i + 1)), playing(1),
    { presence: { userPresenceType: 1, universeId: 999 } }, playing(null),
  ], new AbortController().signal);
  assert.equal(calls.length, 4);
  assert.equal(games.size, 51);
  assert.equal(games.get(1).name, 'Game 1');
  assert.equal(games.get(1).place, 101);
  assert.equal(games.get(1).icon, 'https://tr.rbxcdn.com/1');
});

test('keeps game icons when title lookup fails, and titles when icon lookup fails', async () => {
  for (const failedHost of ['games.roblox.com', 'thumbnails.roblox.com']) {
    const api = load(async url => {
      if (new URL(url).hostname === failedHost) throw new Error('Unavailable');
      return response({ data: [{ id: 1, name: 'Game 1', targetId: 1, imageUrl: 'https://tr.rbxcdn.com/1' }] });
    });
    const games = await api.loadGames([{ presence: { userPresenceType: 2, universeId: 1 } }], new AbortController().signal);
    assert.ok(failedHost === 'games.roblox.com' ? games.get(1).icon : games.get(1).name);
  }
});

test('does not load game details after the dialog is closed', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const api = load(async () => { calls++; return response({ data: [] }); });
  await assert.rejects(api.loadGames([{ presence: { userPresenceType: 2, universeId: 1 } }], controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('retries rate limits, honors Retry-After and handles a CSRF challenge', async () => {
  let attempts = 0;
  const api = load(async (url, init) => {
    if (url.includes('groups.roblox.com')) return response({ data: [member(1)], nextPageCursor: null });
    attempts++;
    if (attempts === 1) return response({}, 429, { 'retry-after': '90' });
    if (attempts === 2) return response({}, 403, { 'x-csrf-token': 'test-token' });
    assert.equal(init.headers['x-csrf-token'], 'test-token');
    return response({ userPresences: [{ userId: 1, userPresenceType: 1 }] });
  });
  assert.equal((await run(api)).online.length, 1);
  assert.equal(attempts, 3);
  assert.equal(api.delays[0], 90000);
});

test('fails after bounded retries and never reports a failed page as complete', async () => {
  let attempts = 0;
  let last;
  const api = load(async url => {
    if (!url.includes('groups.roblox.com')) return response({ userPresences: [{ userId: 1, userPresenceType: 1 }] });
    if (new URL(url).searchParams.get('cursor')) { attempts++; return response({}, 503); }
    return response({ data: [member(1)], nextPageCursor: 'next' });
  });
  await assert.rejects(run(api, value => { last = value; }), /Request failed/);
  assert.equal(attempts, 4);
  assert.equal(last.checked, 1);
  assert.equal(last.online.length, 1);
});

test('does not retry permission errors', async () => {
  let calls = 0;
  await assert.rejects(run(load(async () => { calls++; return response({}, 403); })), /HTTP 403/);
  assert.equal(calls, 1);
});

test('reports rate-limit waits and honors an HTTP-date Retry-After', async () => {
  let calls = 0;
  const waits = [];
  const after = new Date(Date.now() + 90000).toUTCString();
  const api = load(async () => {
    calls++;
    return calls === 1 ? response({}, 429, { 'retry-after': after }) : response({ data: [], nextPageCursor: null });
  });
  await api.scan('1200769', new AbortController().signal, () => {}, value => waits.push(value));
  assert.equal(waits.length, 1);
  assert.ok(waits[0].limited);
  assert.ok(waits[0].delay > 88000 && waits[0].delay <= 90000);
});

test('rejects malformed member and presence responses', async () => {
  await assert.rejects(run(load(async () => response({}))), /Invalid member list/);
  await assert.rejects(run(load(async url => response(url.includes('groups.roblox.com')
    ? { data: [member(1)] } : {}))), /Invalid presence list/);
  await assert.rejects(run(load(async () => response({ data: [member(-1)] }))), /Invalid member/);
});

test('rejects repeated cursors instead of looping forever', async () => {
  await assert.rejects(run(load(async () => response({ data: [], nextPageCursor: 'same' }))), /Repeated member cursor/);
});

test('aborts in-flight requests and starts no more work', async () => {
  const controller = new AbortController();
  let calls = 0;
  const api = load(async (url, init) => {
    calls++;
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  });
  const pending = api.scan('1200769', controller.signal, () => {});
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('aborts a rate-limit wait promptly', async () => {
  const controller = new AbortController();
  let calls = 0;
  let wake;
  const waiting = new Promise(resolve => { wake = resolve; });
  const api = load(async () => { calls++; return response({}, 429); }, {
    setTimeout: fn => { wake(); return setTimeout(fn, 60000); },
  });
  const pending = api.scan('1200769', controller.signal, () => {});
  await waiting;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('live scan of the supplied Roblox group', { skip: !process.env.ROUTILITY_LIVE_GROUP, timeout: 180000 }, async t => {
  const api = load(fetch, { setTimeout, clearTimeout });
  const result = await api.scan(process.env.ROUTILITY_LIVE_GROUP, t.signal, progress => {
    if (progress.checked % 500 === 0) console.log('Checked', progress.checked, 'members');
  }, wait => console.log('Retrying in', Math.ceil(wait.delay / 1000), 'seconds'));
  assert.ok(result.checked > 0);
  console.log(JSON.stringify({ checked: result.checked, online: result.online.length, unknown: result.unknown }));
});
