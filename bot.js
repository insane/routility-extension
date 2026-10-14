(function () {
  'use strict';

  const { el, onFrame, formatUSD, formatNumber } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const KEY = 'routilityBot';
  const NAME = 'RoUtility';
  const AVATAR = chrome.runtime.getURL('icons/bot.png');
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const MAX = 60;

  const state = { msgs: [], onboarded: false, open: false, collapsed: false, unread: false };
  let settings = {};
  let items = null;
  let features = null;
  let shell = null;
  let typing = false;
  let shown = Infinity;

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9$+.\s]/g, ' ').replace(/\s+/g, ' ').trim();

  function save() {
    chrome.storage.local.set({ [KEY]: { msgs: state.msgs.slice(-MAX), onboarded: state.onboarded, open: state.open, collapsed: state.collapsed, unread: state.unread } });
  }

  function robuxRate() {
    const custom = Number(settings.calcRate);
    if (settings.calcRobux === 'custom' && custom > 0) return custom / 1000;
    return 0.0038;
  }

  async function loadItems() {
    if (items) return items;
    const list = await window.RoUtilityUI.request({ type: 'calcItems' }, r => Array.isArray(r));
    const next = (list || []).map(i => ({ ...i, n: norm(i.name), a: norm(i.acr), f: norm(i.name).replace(FILLER, ' ').replace(/\s+/g, ' ').trim() }));
    if (next.length) items = next;
    return next;
  }

  async function loadFeatures() {
    if (features) return features;
    const list = await window.RoUtilityUI.request({ type: 'botFeatures' }, r => Array.isArray(r));
    const next = (list || []).map(f => ({ ...f, n: norm(f.title) + (f.parentTitle ? ' ' + norm(f.parentTitle) : ''), d: norm(f.desc) + (f.parentDesc ? ' ' + norm(f.parentDesc) : '') }));
    if (next.length) features = next;
    return next;
  }

  function scoreItem(i, q) {
    if (!q) return 0;
    if (i.a && i.a === q) return 100;
    if (i.n === q || (i.f && i.f === q)) return 99;
    if (i.n.startsWith(q + ' ') || i.n.startsWith(q) || (i.f && i.f.startsWith(q))) return 80;
    const words = q.split(' ');
    const nameWords = (i.f || i.n).split(' ');
    if (words.every(w => nameWords.some(n => n.startsWith(w)))) return 70 - Math.max(0, nameWords.length - words.length);
    if (i.n.includes(q)) return 55;
    if (i.a && words.length === 1 && i.a.startsWith(q) && q.length >= 3) return 50;
    return 0;
  }

  function findItems(q, limit) {
    const hits = [];
    for (const i of items) {
      const s = scoreItem(i, q);
      if (s) hits.push([s, i]);
    }
    hits.sort((a, b) => b[0] - a[0] || (b[1].usd || 0) - (a[1].usd || 0));
    return hits.slice(0, limit || 3).map(h => ({ score: h[0], item: h[1] }));
  }

  const FILLER = /\b(whats|what is|what are|how much is|how much are|how much|is|are|the|a|an|value|values|valued|worth|price|prices|rap|of|check|show|me|tell|about|please|pls|plz|item|items|limited|limiteds|lookup|look up|find|now|currently|rn)\b/g;

  function parseSide(text) {
    const parts = text.split(/\s*(?:\+|,|&|\band\b|\bplus\b)\s*/).map(s => s.trim()).filter(Boolean);
    const out = { items: [], robux: 0, missing: [] };
    for (let p of parts) {
      const rb = p.match(/^(?:r\$\s*)?([\d.,]+)\s*(k|m)?\s*(?:r\$|robux|rbx|bux)?$/i);
      if (rb && /robux|r\$|rbx|bux|k|m/i.test(p) && !/^\d+$/.test(p.trim())) {
        let n = Number(rb[1].replace(/,/g, ''));
        if (/k/i.test(rb[2] || '')) n *= 1000;
        if (/m/i.test(rb[2] || '')) n *= 1000000;
        if (n > 0) { out.robux += Math.round(n); continue; }
      }
      let qty = 1;
      const q1 = p.match(/^(\d{1,2})\s*x?\s+(.+)$/i) || p.match(/^(.+?)\s+x\s*(\d+)$/i);
      if (q1) {
        qty = Number(/^\d+$/.test(q1[1]) ? q1[1] : q1[2]);
        p = /^\d+$/.test(q1[1]) ? q1[2] : q1[1];
      }
      const q = norm(p).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
      const best = findItems(q, 1)[0];
      if (!best || best.score < 50) { out.missing.push(p); continue; }
      for (let k = 0; k < Math.min(qty, 10); k++) out.items.push(best.item);
    }
    return out;
  }

  function sideTotals(side) {
    const usd = side.items.reduce((t, i) => t + (i.usd || 0), 0) + side.robux * robuxRate();
    const rap = side.items.reduce((t, i) => t + (i.rap || 0), 0);
    return { usd, rap };
  }

  const COMMANDS = [
    { name: 'value', alias: ['v', 'worth', 'price'], args: LT('item'), desc: LT('What a limited is worth') },
    { name: 'trade', alias: ['t', 'calc'], args: LT('give {for} get'), desc: LT('Is a trade a win or a loss') },
    { name: 'compare', alias: ['c', 'vs'], args: LT('item {or} item'), desc: LT('Which of two items is worth more') },
    { name: 'player', alias: ['p', 'user', 'who'], args: LT('username'), desc: LT('What a player’s limiteds are worth') },
    { name: 'me', alias: ['inventory', 'inv'], args: '', desc: LT('What your limiteds are worth') },
    { name: 'top', alias: ['richest'], args: '', desc: LT('The most valuable limiteds') },
    { name: 'rising', alias: [], args: '', desc: LT('Limiteds going up') },
    { name: 'falling', alias: [], args: '', desc: LT('Limiteds going down') },
    { name: 'projected', alias: [], args: '', desc: LT('Limiteds with a pushed-up RAP') },
    { name: 'setting', alias: ['s', 'find', 'feature'], args: LT('what you want'), desc: LT('Find a RoUtility setting') },
    { name: 'help', alias: ['commands'], args: '', desc: LT('Everything I can do') },
  ];
  const LIST_CMD = { top: 'Most Valuable', rising: 'Rising', falling: 'Falling', projected: 'Projected' };

  function findCommand(name) {
    const n = String(name || '').toLowerCase();
    return COMMANDS.find(c => c.name === n || c.alias.includes(n)) || null;
  }

  const argText = (c) => (c.args ? lt(c.args, { for: 'for', or: 'or' }) : '');
  const usage = (c) => `/${c.name}${c.args ? ' ' + argText(c) : ''}`;
  const fill = (c, extra) => ({ label: '/' + c.name, act: c.args ? 'fill' : 'say', value: '/' + c.name + (c.args ? ' ' : '') + (extra || '') });

  function helpReply() {
    return { text: lt('Type / and pick a command:') + '\n' + COMMANDS.filter(c => c.name !== 'help').map(c => `${usage(c)} · ${lt(c.desc)}`).join('\n'), chips: ['value', 'trade', 'player', 'me', 'top'].map(n => fill(findCommand(n))) };
  }

  function listByTitle(title, n) {
    const l = LISTS.find(x => x.title === title);
    const picks = l.pick(items).slice(0, n || 5);
    if (!picks.length) return { text: lt('Nothing is marked {title} right now.', { title: lt(title).toLowerCase() }) };
    return { text: lt('{title} right now:', { title: lt(title) }), cards: [{ type: 'list', title, ids: picks.map(i => i.id) }] };
  }

  async function runCommand(text) {
    const m = text.match(/^\/(\S*)\s*([\s\S]*)$/);
    const c = findCommand(m[1]);
    const rest = m[2].trim();
    if (!c) {
      const h = helpReply();
      return [{ ...h, text: (m[1] ? lt('I don’t know {command}.', { command: '/' + m[1] }) + ' ' : '') + h.text }];
    }
    if (c.name === 'help') return [helpReply()];
    if (c.name === 'me') {
      const id = document.querySelector('meta[name="user-data"]')?.dataset.userid;
      return [id ? await playerReply(id, true) : { text: lt('Sign in to Roblox first.') }];
    }
    if (c.name === 'player') {
      if (!rest) return [{ text: lt('Add a username, like {example}.', { example: '/player builderman' }), chips: [fill(c)] }];
      return [await playerReply(rest.replace(/^@/, '').split(/\s+/)[0], false)];
    }
    if (c.name === 'setting') {
      await loadFeatures();
      if (!rest) return [{ text: lt('Say what you want to change, like {example1} or {example2}.', { example1: '/setting hide robux', example2: '/setting streamer mode' }), chips: [fill(c)] }];
      const hits = searchFeatures(rest);
      const named = features.filter(f => norm(f.title).length > 3 && norm(rest).includes(norm(f.title)))[0];
      const top = named ? [{ f: named }] : hits.slice(0, 3).filter(h => h.score >= hits[0].score * 0.6);
      if (!top.length) return [{ text: lt('No setting matches “{query}”. Try other words, or open Settings.', { query: rest }), chips: [{ label: lt('Open Settings'), act: 'url', value: '/my/account#!/routility' }] }];
      return [{ text: top.length === 1 ? lt('Here it is:') : lt('These settings match:'), cards: top.map(h => ({ type: 'feature', key: h.f.key })) }];
    }
    await loadItems();
    if (LIST_CMD[c.name]) return [listByTitle(LIST_CMD[c.name], Math.min(8, Math.max(3, Number(rest) || 5)))];
    if (c.name === 'value') {
      if (!rest) return [{ text: lt('Add an item, like {example1} or {example2}.', { example1: '/value valk', example2: '/value dominus frigidus' }), chips: [fill(c)] }];
      const q = norm(rest).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
      const hits = findItems(q, 4).filter(h => h.score >= 50);
      if (hits.length && (hits[0].score >= 70 || (hits.length === 1 && hits[0].score >= 60))) {
        const top = hits[0].item;
        return [{ text: valueLine(top), cards: [{ type: 'item', id: top.id }] }];
      }
      if (hits.length) return [{ text: lt('Did you mean one of these?'), chips: hits.map(h => ({ label: h.item.name, act: 'say', value: '/value ' + h.item.name })) }];
      return [{ text: lt('No limited matches “{query}”. Values are only for limiteds.', { query: rest }) }];
    }
    if (c.name === 'compare') {
      const parts = rest.split(/\s+(?:or|vs\.?|versus)\s+|\s*,\s*/i).filter(Boolean);
      if (parts.length !== 2) return [{ text: lt('Write two items with “{or}” between them, like {example}.', { or: 'or', example: '/compare valk or blackvalk' }), chips: [fill(c)] }];
      const pick = parts.map(x => findItems(norm(x).replace(FILLER, ' ').replace(/\s+/g, ' ').trim(), 1)[0]);
      const miss = parts.filter((x, i) => !pick[i] || pick[i].score < 50);
      if (miss.length) return [{ text: lt('I couldn’t find: {items}.', { items: miss.join(', ') }) }];
      return [compareReply(pick[0].item, pick[1].item)];
    }
    if (c.name === 'trade') {
      const sides = rest.split(/\s+(?:for|vs\.?|versus|<->|->|=>)\s+/i);
      if (sides.length !== 2) return [{ text: lt('Write what you give, “{for}”, then what you get. Use + between items, like {example}.', { for: 'for', example: '/trade valk + 10k robux for dominus frigidus' }), chips: [fill(c)] }];
      const give = parseSide(sides[0]);
      const get = parseSide(sides[1]);
      if (!(give.items.length || give.robux) || !(get.items.length || get.robux)) return [{ text: lt('I couldn’t find: {items}.', { items: [...give.missing, ...get.missing].join(', ') || lt('those items') }) }];
      return [tradeReply(give, get)];
    }
    return [helpReply()];
  }

  async function userFallback(text) {
    const m = text.match(/@?([A-Za-z0-9_]{3,20})(?:'s|’s)\b/) || text.match(/^(?:how (?:much|rich) is|whats|what is)\s+@?([A-Za-z0-9_]{3,20})(?:\s+(?:worth|usd|value))?\??$/i) || text.match(/^@?([A-Za-z0-9_]{3,20})$/);
    const cand = m && m[1];
    if (!cand || /^(it|this|that|my|your|what|whats|how|who|lol|lmao|nice|bruh|cool|wow|yes|yeah|nah|nope|okay|hello|thanks|test|idk|why|when|where|cap)$/i.test(cand)) return null;
    const u = await lookupUser(cand);
    if (!u) return null;
    return [await playerReply(u.name, false)];
  }

  async function brain(raw) {
    const text = String(raw || '').trim();
    if (text.startsWith('/')) return runCommand(text);
    const t = norm(text);
    if (!t) return [];
    if (/^(hi|hey|hello|yo|sup|hii+|heya|howdy)\b/.test(t) && t.split(' ').length <= 3) {
      return [{ text: lt('Hey! Type / to see my commands, like {example1} or {example2}.', { example1: '/value valk', example2: '/player builderman' }), chips: HOME_CHIPS }];
    }
    if (/^(help|commands|what can you do|menu|start)\b/.test(t)) return [helpReply()];
    if (/\b(look ?up|find|search|check)\b.*\b(user|player|someone|somebody|person|account|profile)\b/.test(t)) return [{ text: lt('Use {command} with their username, like {example}. I’ll show what their limiteds are worth.', { command: '/player', example: '/player builderman' }), chips: [fill(findCommand('player'))] }];
    if (/\b(settings|options|preferences)\b/.test(t) && t.split(' ').length <= 4) {
      return [{ text: lt('Here’s where every RoUtility feature lives.'), chips: [{ label: lt('Open Settings'), act: 'url', value: '/my/account#!/routility' }] }];
    }
    if (/\b(thanks|thank you|ty|thx)\b/.test(t)) return [{ text: lt('Anytime!') }];

    if (SELF.test(t)) {
      const id = document.querySelector('meta[name="user-data"]')?.dataset.userid;
      if (id) return [await playerReply(id, true)];
    }
    const who = text.match(PLAYER);
    if (who) {
      const name = who.slice(1).find(Boolean);
      if (name) return [await playerReply(name, false)];
    }

    const toggle = t.match(/^(?:can you |please )?(turn on|turn off|enable|disable|switch on|switch off|hide|show)\s+(.+)$/);
    if (toggle) {
      await loadFeatures();
      const on = /on|enable|show/.test(toggle[1]);
      const hit = searchFeatures(toggle[2])[0];
      if (hit && hit.score >= 6) return [toggleReply(hit.f, on)];
    }

    await loadItems();
    const pageId = (location.pathname.match(/^\/catalog\/(\d+)/) || [])[1];
    if (pageId && /\b(this|it|this item|this one)\b/.test(t)) {
      const here = itemById(pageId);
      if (here) return [{ text: valueLine(here), cards: [{ type: 'item', id: here.id }] }];
      return [{ text: lt('This item doesn’t have a RoUtility value. Values are only for limiteds.') }];
    }
    const list = listReply(t);
    if (list) return [list];
    const either = text.replace(/\?+$/, '').replace(/^(?:which is better|whats better|what is better|which is worth more|should i get)[:,]?\s+/i, '').split(/\s+or\s+/i);
    if (either.length === 2) {
      const pick = either.map(s => findItems(norm(s).replace(FILLER, ' ').replace(/\s+/g, ' ').trim(), 1)[0]);
      if (pick.every(p => p && p.score >= 70) && pick[0].item.id !== pick[1].item.id) return [compareReply(pick[0].item, pick[1].item)];
    }
    const tradeSplit = text.split(/\s+(?:vs\.?|versus|for|<->|->|=>|⇄|↔)\s+/i);
    if (tradeSplit.length === 2 && tradeSplit[0].trim() && tradeSplit[1].trim()) {
      const give = parseSide(tradeSplit[0].replace(/^(?:is|would|should i (?:do|take|accept)|calc(?:ulate)?|trade|my)\s+/i, ''));
      const get = parseSide(tradeSplit[1].replace(/\?+$/, ''));
      if ((give.items.length || give.robux) && (get.items.length || get.robux)) return [tradeReply(give, get)];
    }

    if (items.length) {
      const sides = text.split(/\s*(?:\+|,|&)\s*/).filter(Boolean);
      if (sides.length > 1 && sides.length <= 6) {
        const found = [];
        for (const s of sides) {
          const best = findItems(norm(s).replace(FILLER, ' ').replace(/\s+/g, ' ').trim(), 1)[0];
          if (best && best.score >= 50) found.push(best.item);
        }
        if (found.length === sides.length) return [{ text: ltn(found.length, 'Those {n} together are worth {value}.', 'Those {n} together are worth {value}.', { value: formatUSD(sideTotals({ items: found, robux: 0 }).usd) }), cards: found.map(i => ({ type: 'item', id: i.id })) }];
      }
      const q = t.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
      const hits = findItems(q, 4).filter(h => h.score >= 50);
      if (hits.length && (hits[0].score >= 70 || (hits.length === 1 && hits[0].score >= 60))) {
        const top = hits[0].item;
        const others = hits.slice(1).filter(h => h.score >= hits[0].score - 5);
        return [{ text: valueLine(top), cards: [{ type: 'item', id: top.id }], chips: others.slice(0, 3).map(h => ({ label: h.item.name, act: 'say', value: h.item.name })) }];
      }
      if (hits.length && hits[0].score >= 55 && q.length >= 3) {
        return [{ text: lt('Did you mean one of these?'), chips: hits.slice(0, 4).map(h => ({ label: h.item.name, act: 'say', value: h.item.name })) }];
      }
    }

    const asUser = await userFallback(text);
    if (asUser) return asUser;

    await loadFeatures();
    const fhits = searchFeatures(text);
    const strong = fhits.length && (fhits[0].score >= 6 || features.some(f => norm(f.title).length > 5 && t.includes(norm(f.title))));
    if (strong) {
      const intent = /\b(hide|remove|disable|turn off|get rid|stop|block)\b/i.test(text) ? 'off' : /\b(show|enable|turn on|add)\b/i.test(text) ? 'on' : '';
      let ranked = fhits;
      if (intent === 'off') ranked = [...fhits].sort((a, b) => (b.score + ((settings[b.f.key] ?? b.f.def) ? 2 : 0) - (/\binstead\b/.test(b.f.d) ? 2 : 0)) - (a.score + ((settings[a.f.key] ?? a.f.def) ? 2 : 0) - (/\binstead\b/.test(a.f.d) ? 2 : 0)));
      const best = ranked[0].score;
      const named = features.filter(f => norm(f.title).length > 5 && t.includes(norm(f.title))).sort((a, b) => b.title.length - a.title.length)[0];
      const top = named ? [{ f: named }] : intent ? ranked.slice(0, 1) : ranked.slice(0, 2).filter(h => h.score >= best);
      const inverted = top.length === 1 && /^(Hide|Stop|Avoid|Collapse)\b/.test(top[0].f.title);
      const want = inverted && intent ? (intent === 'off' ? 'on' : 'off') : intent;
      const lead = top.length !== 1 ? lt('These RoUtility features match:') : intent === 'off' ? (want === 'on' ? lt('Turn on {feature} to hide it:', { feature: lt(top[0].f.title) }) : lt('Turn off {feature} to hide it:', { feature: lt(top[0].f.title) })) : lt('This sounds like what you’re after:');
      return [{ text: lead, cards: top.map(h => ({ type: 'feature', key: h.f.key, intent: want })) }];
    }

    return [{ text: lt('I’m not sure what you mean. Type / to see my commands, or tap one:'), chips: HOME_CHIPS }];
  }

  function searchFeatures(q) {
    const words = norm(q).replace(/\b(how|do|does|i|can|you|my|to|the|a|an|is|there|way|it|on|off|in|of|for|what|where|turn|enable|disable|feature|features|setting|settings|roblox|routility|get|see|want|make|let|me|from|with|and|or|when|why|who|any)\b/g, ' ').split(' ').filter(w => w.length > 1);
    if (!words.length) return [];
    const out = [];
    for (const f of features) {
      let score = 0;
      let hit = 0;
      for (const w of words) {
        const stem = w.length > 4 ? w.replace(/(ing|ers|ed|es|s)$/, '') : w;
        const alts = [stem, ...(SYNONYMS[stem] || [])];
        let best = 0;
        for (const a of alts) {
          if (f.n.split(' ').some(x => x.startsWith(a) || (x.length >= 5 && a.startsWith(x)))) best = Math.max(best, 3);
          else if (f.d.includes(a)) best = Math.max(best, 1);
          else if (f.key.toLowerCase().includes(a)) best = Math.max(best, 1);
        }
        if (best) { score += best; hit++; }
      }
      if (score) out.push({ f, score: score + (hit > 1 ? (hit - 1) * 2 : 0) });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  const SYNONYMS = {
    hide: ['blur', 'hidden', 'remove'],
    blur: ['hide'],
    value: ['worth', 'usd', 'price'],
    worth: ['value'],
    price: ['value', 'usd'],
    money: ['usd', 'robux', 'dollar'],
    dollar: ['usd'],
    server: ['servers', 'region'],
    region: ['regions', 'server'],
    friend: ['friends'],
    unfriend: ['unfriended', 'no longer friends'],
    trade: ['trades', 'trading'],
    stream: ['streamer'],
    group: ['communit'],
    communit: ['group'],
    font: ['font'],
    dark: ['theme', 'classic'],
    old: ['classic'],
    alert: ['notif', 'alerts'],
    notif: ['alert'],
  };

  const SELF = /^(?:me|my (?:inventory|inv|value|worth|account|profile|stats|limiteds)|how (?:rich|much) am i(?: worth)?|whats my (?:inventory|inv|account) worth|how much is my (?:inventory|inv|account) worth|am i rich)$/;
  const PLAYER = /^(?:(?:lookup|look up|check|who is|whos|who's|how rich is|player|user|profile)?\s*@([a-z0-9_]{3,20})|(?:who is|whos|who's|how rich is|player|user)\s+([a-z0-9_]{3,20})|([a-z0-9_]{3,20})(?:'s|’s)\s+(?:inventory|inv|profile|account))\??$/i;
  const LISTS = [
    { re: /\b(most valuable|most expensive|richest|highest value|top items|top limiteds|best items|top \d+)\b/, title: LT('Most Valuable'), pick: all => all.filter(i => i.usd).sort((a, b) => b.usd - a.usd) },
    { re: /\b(rising|raising|going up|trending up|gainers|on the rise)\b/, title: LT('Rising'), pick: all => all.filter(i => i.trend === LT('Raising')).sort((a, b) => b.usd - a.usd) },
    { re: /\b(falling|lowering|going down|dropping|crashing|losers)\b/, title: LT('Falling'), pick: all => all.filter(i => i.trend === LT('Lowering')).sort((a, b) => b.usd - a.usd) },
    { re: /\b(projected|projecteds)\b/, title: LT('Projected'), pick: all => all.filter(i => i.projected).sort((a, b) => b.rap - a.rap) },
    { re: /\b(amazing demand|high demand|most demanded|in demand|hyped)\b/, title: LT('Top Demand'), pick: all => all.filter(i => i.demand === 'Amazing' || i.demand === 'High').sort((a, b) => (b.demand === 'Amazing') - (a.demand === 'Amazing') || b.usd - a.usd) },
  ];

  function listReply(t) {
    for (const l of LISTS) {
      if (!l.re.test(t)) continue;
      const rest = t.replace(new RegExp(l.re.source, 'g'), ' ').replace(FILLER, ' ').replace(/\b(what|whats|which|items|limiteds|right|today|list|top|most|\d+|are|in|on|roblox|show|give|best|any|good|ones|things|stuff|trending)\b/g, ' ').trim();
      if (rest) continue;
      const n = Math.min(8, Math.max(3, Number((t.match(/\btop (\d+)/) || [])[1]) || 5));
      const picks = l.pick(items).slice(0, n);
      if (!picks.length) return { text: lt('Nothing is marked {title} right now.', { title: lt(l.title).toLowerCase() }) };
      return { text: lt('{title} right now:', { title: lt(l.title) }), cards: [{ type: 'list', title: l.title, ids: picks.map(i => i.id) }] };
    }
    return null;
  }

  function compareReply(a, b) {
    const [hi, lo] = (a.usd || 0) >= (b.usd || 0) ? [a, b] : [b, a];
    const gap = (hi.usd || 0) - (lo.usd || 0);
    const pct = lo.usd ? Math.round((gap / lo.usd) * 100) : 0;
    let text = gap ? (pct && pct < 1000 ? lt('{item} is worth {value} more ({pct}).', { item: hi.name, value: formatUSD(gap), pct: pctText(pct) }) : lt('{item} is worth {value} more.', { item: hi.name, value: formatUSD(gap) })) : lt('They’re worth the same.');
    const d = i => [LT('Terrible'), LT('Low'), LT('Normal'), LT('High'), LT('Amazing')].indexOf(i.demand);
    if (d(lo) > d(hi) && d(lo) >= 3) text += ' ' + lt('{item} has better demand though.', { item: lo.name });
    return { text, cards: [{ type: 'item', id: hi.id }, { type: 'item', id: lo.id }] };
  }

  async function lookupUser(q) {
    try {
      if (/^\d+$/.test(q)) {
        const r = await fetch(`https://users.roblox.com/v1/users/${q}`, { credentials: 'include' });
        const u = r.ok ? await r.json() : null;
        return u && u.id ? { id: String(u.id), name: u.name, display: u.displayName, verified: !!u.hasVerifiedBadge } : null;
      }
      const r = await fetch('https://users.roblox.com/v1/usernames/users', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernames: [q], excludeBannedUsers: true }) });
      const u = r.ok ? ((await r.json()).data || [])[0] : null;
      return u ? { id: String(u.id), name: u.name, display: u.displayName, verified: !!u.hasVerifiedBadge } : null;
    } catch {
      return null;
    }
  }

  async function playerReply(q, self) {
    const u = await lookupUser(q);
    if (!u) return { text: lt('I couldn’t find a player named “{name}”. Check the spelling and try again.', { name: q }) };
    const [stats, heads] = await Promise.all([
      window.RoUtilityUI.request({ type: 'playerLookup', ids: [u.id] }, r => r !== undefined),
      window.RoUtilityUI.request({ type: 'getHeadshots', ids: [u.id] }, r => r && typeof r === 'object'),
    ]);
    const p = stats && stats[u.id];
    const c = { type: 'player', ...u, head: (heads || {})[u.id] || '', usd: p ? p.usd || 0 : 0, rap: p ? p.rap || 0 : 0, count: p ? p.limiteds || 0 : 0, hidden: !!(p && p.inventoryPrivate), known: !!p };
    let text;
    if (!p) text = self ? lt('I don’t have your inventory scanned yet. Open your profile and it’ll show up soon.') : lt('I don’t have {name}’s inventory scanned yet.', { name: u.display });
    else if (c.hidden) text = self ? lt('Your inventory is private, so I can’t see your limiteds. Make it public in Privacy settings and I’ll pick it up on the next scan.') : lt('{name}’s inventory is private, so I can’t see their limiteds.', { name: u.display });
    else if (!c.count) text = self ? lt('You don’t own any limiteds yet. Want to see what’s rising?') : lt('{name} doesn’t own any limiteds.', { name: u.display });
    else text = self ? lt('Your limiteds are worth {value}.', { value: formatUSD(c.usd) }) : lt('{name}’s limiteds are worth {value}.', { name: u.display, value: formatUSD(c.usd) });
    return { text, cards: [c], chips: self && !c.count ? [{ label: lt('What’s Rising?'), act: 'say', value: 'what’s rising' }] : undefined };
  }

  const SEGMENT = /^(.*(?:\+|,|&|\band\b|\bfor\b|\bvs\.?|\bor\b|->)\s*|)(\d{1,2}\s*x?\s+)?([^+,&]*)$/i;

  function valueLine(i) {
    const vars = { item: i.name, value: i.usd ? formatUSD(i.usd) : '', rap: i.rap ? formatNumber(i.rap) : '' };
    if (i.usd && i.rap) return lt('{item} is worth {value} with a RAP of R$ {rap}.', vars);
    if (i.usd) return lt('{item} is worth {value}.', vars);
    if (i.rap) return lt('{item} doesn’t have a RoUtility value yet with a RAP of R$ {rap}.', vars);
    return lt('{item} doesn’t have a RoUtility value yet.', vars);
  }

  function tradeReply(give, get) {
    const a = sideTotals(give);
    const b = sideTotals(get);
    const diff = a.usd ? (b.usd - a.usd) / a.usd : 0;
    const pct = Math.round(diff * 1000) / 10;
    const verdict = Math.abs(pct) < 3 ? lt('That trade is about even in value.') : pct >= 1000 ? lt('That trade is a massive win in value.') : pct > 0 ? lt('That trade is a win, {pct} in value.', { pct: pctText(pct) }) : pct <= -90 ? lt('That trade is a massive loss in value.') : lt('That trade is a loss, {pct} in value.', { pct: pctText(pct) });
    const missing = [...give.missing, ...get.missing];
    return {
      text: verdict + (missing.length ? ' ' + lt('I couldn’t find: {items}.', { items: missing.join(', ') }) : ''),
      cards: [{ type: 'trade', give: give.items.map(i => i.id), giveRobux: give.robux, get: get.items.map(i => i.id), getRobux: get.robux }],
      chips: [{ label: lt('Open in Trade Calculator'), act: 'url', value: calcLink(give, get) }],
    };
  }

  function calcLink(give, get) {
    const side = (x) => [...x.items.map(i => 'i' + i.id), ...(x.robux ? ['r' + x.robux] : [])].join(',');
    const n = Math.min(4, Math.max(give.items.length + (give.robux ? 1 : 0), get.items.length + (get.robux ? 1 : 0), 1));
    return `/trades/calculator#give=${side(give)}&get=${side(get)}&giveSlots=${Math.max(4, n)}`;
  }

  function pctText(p) {
    const n = Math.abs(p) >= 100 ? formatNumber(Math.round(p)) : String(p);
    return (p > 0 ? '+' : '') + n + '%';
  }

  function toggleReply(f, on) {
    const cur = settings[f.key] ?? f.def;
    if (cur === on) return { text: on ? lt('{feature} is already on.', { feature: lt(f.title) }) : lt('{feature} is already off.', { feature: lt(f.title) }), cards: [{ type: 'feature', key: f.key }] };
    return { text: on ? lt('Want me to turn on {feature}?', { feature: lt(f.title) }) : lt('Want me to turn off {feature}?', { feature: lt(f.title) }), cards: [{ type: 'feature', key: f.key }] };
  }

  const HOME_CHIPS = [
    { label: '/value', act: 'fill', value: '/value ' },
    { label: '/trade', act: 'fill', value: '/trade ' },
    { label: '/player', act: 'fill', value: '/player ' },
    { label: '/me', act: 'say', value: '/me' },
    { label: '/help', act: 'say', value: '/help' },
  ];

  function intro() {
    return { text: lt('I can check what a limited is worth, size up a trade, look up any player and find any RoUtility setting. Type / to see my commands, or tap one:'), chips: HOME_CHIPS };
  }

  const CANNED = {
    'how do i check a value?': () => [{ text: lt('Just type an item name, like “Dominus Frigidus”, “valk” or “sparkle time fedora”. I’ll show its value, RAP, demand and the last 30 days. You can also ask what’s rising, what’s falling, or the most valuable items.'), chips: [{ label: 'valk', act: 'say', value: 'valk' }, { label: lt('What’s Rising?'), act: 'say', value: 'what’s rising' }, { label: lt('Top 5'), act: 'say', value: 'top 5 most valuable' }] }],
    'how do i check a trade?': () => [{ text: lt('Write what you give, then “{for}”, then what you get. Use + between items. For example:', { for: 'for' }), chips: [{ label: 'valk + 10k robux for dominus frigidus', act: 'say', value: 'valk + 10k robux for dominus frigidus' }] }],
    'what can routility do?': () => [{ text: lt('A lot! Values and demand on every limited, a trade calculator, trade ads, profile and inventory values, server regions, a forum, and dozens of small fixes to Roblox. Ask me about any of it, like “server regions” or “streamer mode”.'), chips: [{ label: lt('Open Settings'), act: 'url', value: '/my/account#!/routility' }] }],
  };

  function onboard() {
    return [
      { text: me() ? lt('Hey {name}! I’m the RoUtility bot. I live here in your chat.', { name: me() }) : lt('Hey! I’m the RoUtility bot. I live here in your chat.') },
      intro(),
    ];
  }

  function me() {
    return document.querySelector('meta[name="user-data"]')?.dataset.displayname || document.querySelector('meta[name="user-data"]')?.dataset.name || '';
  }

  function push(from, msg) {
    state.msgs.push({ from, t: Date.now(), ...msg });
    if (state.msgs.length > MAX) state.msgs = state.msgs.slice(-MAX);
  }

  let sayChain = Promise.resolve();

  function botSay(list, quick) {
    sayChain = sayChain.then(() => sayNow(list, quick)).catch(() => {});
    return sayChain;
  }

  async function sayNow(list, quick) {
    for (const m of list) {
      if (!quick) await wait(260);
      typing = true;
      render();
      await wait(Math.min(1400, 650 + (m.text || '').length * 7 + (m.cards || []).length * 250));
      typing = false;
      push('bot', m);
      if (!state.open || state.collapsed) state.unread = true;
      render();
    }
    save();
  }

  async function userSay(text) {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;
    push('me', { text: clean });
    render();
    save();
    const canned = CANNED[clean.toLowerCase()];
    sayChain = sayChain.then(async () => {
      const reply = canned ? canned() : await brain(clean).catch(() => [{ text: lt('Something went wrong on my end. Try that again in a moment.') }]);
      await sayNow(reply);
    }).catch(() => {});
    return sayChain;
  }

  function avatar(cls) {
    const wrap = el('span', 'react-chat-avatar-headshot inline-flex shrink-0 size-800 radius-circle bg-shift-300 clip' + (cls ? ' ' + cls : ''));
    const box = el('span', 'thumbnail-2d-container float-left overflow-hidden block height-full width-full');
    const img = el('img', 'size-full height-full width-full object-cover');
    img.src = AVATAR;
    img.alt = NAME;
    box.appendChild(img);
    wrap.appendChild(box);
    return wrap;
  }

  function iconButton(icon, label, onClick) {
    const b = el('button', 'foundation-web-icon-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center padding-none stroke-none select-none size-800 radius-circle bg-action-link');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.dataset.rtTip = label;
    b.appendChild(el('div', STATE_LAYER));
    b.appendChild(el('span', `icon ${icon} size-500 content-emphasis`));
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  function lastPreview() {
    if (typing) return lt('Typing…');
    const last = [...state.msgs].reverse().find(m => m.text);
    if (!last) return lt('Values, trades and RoUtility help');
    return last.from === 'me' ? lt('You: {text}', { text: last.text }) : last.text;
  }

  function placeRow() {
    const list = document.querySelector('#chat-container .react-chat-thread-list');
    if (!list) return;
    let row = list.querySelector(':scope > .routility-bot-row');
    if (!row) {
      row = el('button', 'react-chat-row flex width-full shrink-0 items-center gap-medium padding-x-medium padding-y-xsmall text-left bg-none stroke-none cursor-pointer hover:bg-shift-100 routility-injected routility-bot-row');
      row.type = 'button';
      const pic = el('div', 'relative shrink-0');
      pic.appendChild(avatar());
      pic.appendChild(el('span', 'routility-bot-dot'));
      const body = el('div', 'react-chat-row-body flex min-width-none grow-1 flex-col gap-xxsmall');
      const line = el('div', 'react-chat-row-title-line flex min-width-none items-center justify-between gap-small');
      line.append(el('span', 'react-chat-row-title min-width-none grow-1 content-emphasis text-body-medium', NAME), el('span', 'shrink-0 text-caption-medium content-muted routility-bot-tag', lt('Bot')));
      body.append(line, el('span', 'react-chat-row-preview text-caption-medium text-truncate-end content-muted routility-bot-preview'));
      row.append(pic, body);
      row.addEventListener('click', () => openBot());
    }
    if (list.firstElementChild !== row) list.prepend(row);
    const prev = row.querySelector('.routility-bot-preview');
    const text = lastPreview();
    if (prev.textContent !== text) prev.textContent = text;
    row.classList.toggle('routility-bot-unread', state.unread);
    row.classList.toggle('routility-bot-row-typing', typing);
  }

  function dialogHost() {
    const root = document.querySelector('#chat-container .react-chat-root');
    return root && root.firstElementChild;
  }

  function openBot() {
    state.open = true;
    state.collapsed = false;
    state.unread = false;
    save();
    render();
    shell?.querySelector('textarea')?.focus();
  }

  function closeBot() {
    state.open = false;
    save();
    shell?.remove();
    shell = null;
    placeRow();
  }

  function buildShell() {
    const s = el('section', 'react-chat-dialog-shell react-chat-top-radius flex width-[260px] pointer-events-auto flex-col overflow-hidden bg-surface-100 stroke-standard stroke-muted shadow-transient-high clip content-default routility-injected routility-bot-shell');
    s.setAttribute('aria-label', NAME);
    const head = el('div', 'react-chat-dialog-header react-chat-top-radius flex width-full shrink-0 items-center gap-small overflow-hidden bg-surface-100 padding-x-small padding-y-small cursor-pointer');
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    head.setAttribute('aria-label', NAME);
    const main = el('div', 'react-chat-dialog-header-main flex min-width-0 grow-1 items-center gap-small overflow-hidden');
    const wrap = el('span', 'react-chat-dialog-avatar-wrap relative shrink-0');
    wrap.appendChild(avatar());
    const names = el('span', 'flex min-width-0 grow-1 flex-col');
    const titleRow = el('span', 'flex min-width-0 items-center gap-xsmall shrink-0');
    titleRow.appendChild(el('span', 'react-chat-dialog-title min-width-0 grow-1 text-title-medium content-emphasis text-truncate-end', NAME));
    names.append(titleRow, el('span', 'text-caption-small content-muted shrink-0 routility-bot-sub', lt('Values, trades and help')));
    main.append(wrap, names);
    const actions = el('div', 'react-chat-dialog-header-actions flex shrink-0 items-center gap-xsmall');
    actions.append(
      iconButton('icon-regular-gear', lt('RoUtility Settings'), () => { location.href = '/my/account#!/routility'; }),
      iconButton('icon-regular-x', lt('Close'), closeBot),
    );
    head.append(main, actions);
    const toggle = () => { state.collapsed = !state.collapsed; if (!state.collapsed) state.unread = false; save(); render(); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    const scroll = el('div', 'react-chat-dialog-scroll flex min-height-0 grow-1 basis-0 flex-col scroll-y bg-surface-100 routility-bot-scroll');
    const ul = el('ul', 'margin-top-auto flex flex-col gap-medium bg-surface-100 padding-bottom-medium padding-top-small routility-bot-list');
    scroll.appendChild(ul);
    const foot = el('div', 'flex items-end bg-surface-100 padding-bottom-medium padding-x-medium padding-top-small routility-bot-foot');
    const box = el('div', 'flex fill flex-col width-full gap-small react-chat-message-input width-full');
    const ta = el('textarea', 'foundation-web-text-area foundation-web-input outline-none radius-medium content-emphasis placeholder:content-muted bg-none stroke-standard stroke-contrast-alpha focus-within:stroke-system-emphasis text-body-small placeholder:text-body-small padding-x-medium padding-y-small react-chat-message-input-textarea max-height-[96px] scroll-y routility-bot-input');
    ta.rows = 1;
    ta.placeholder = lt('Type / for commands');
    ta.setAttribute('aria-label', lt('Message the RoUtility bot'));
    ta.maxLength = 300;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight + 2) + 'px'; };
    const sug = el('div', 'routility-bot-suggest');
    let picks = [];
    let mode = '';
    let active = 0;
    const clear = () => { picks = []; mode = ''; active = 0; sug.textContent = ''; };
    const mark = () => [...sug.children].forEach((b, i) => b.classList.toggle('routility-bot-suggest-on', i === active));
    const split = () => {
      const m = ta.value.match(/^(\/\S+\s+)([\s\S]*)$/);
      return m ? { head: m[1], body: m[2] } : { head: '', body: ta.value };
    };
    const accept = (pick) => {
      if (mode === 'cmd') {
        clear();
        if (!pick.args) { ta.value = ''; grow(); userSay('/' + pick.name); return; }
        ta.value = '/' + pick.name + ' ';
        grow();
        ta.focus();
        suggest();
        return;
      }
      const { head, body } = split();
      const m = body.match(SEGMENT);
      ta.value = head + (m ? m[1] + (m[2] || '') : '') + pick.name;
      clear();
      grow();
      ta.focus();
    };
    const suggest = () => {
      clear();
      const v = ta.value;
      const cm = v.match(/^\/(\S*)$/);
      if (cm) {
        const q = cm[1].toLowerCase();
        picks = COMMANDS.filter(c => c.name.startsWith(q) || (q && c.alias.some(a => a.startsWith(q))));
        mode = picks.length ? 'cmd' : '';
        for (const c of picks) {
          const b = el('button', 'routility-bot-suggest-item routility-bot-cmd');
          b.type = 'button';
          const top = el('span', 'routility-bot-cmd-top');
          top.append(el('span', 'text-caption-medium content-emphasis routility-bot-cmd-name', '/' + c.name), el('span', 'text-caption-small content-muted', argText(c)));
          b.append(top, el('span', 'text-caption-small content-muted text-truncate-end routility-bot-cmd-desc', lt(c.desc)));
          b.addEventListener('mousedown', (e) => { e.preventDefault(); accept(c); });
          sug.appendChild(b);
        }
        mark();
        return;
      }
      if (!items) return;
      const cmdName = (v.match(/^\/(\S+)\s/) || [])[1];
      const c = cmdName ? findCommand(cmdName) : null;
      if (cmdName && !(c && ['value', 'trade', 'compare'].includes(c.name))) return;
      const m = split().body.match(SEGMENT);
      const q = m ? norm(m[3]).replace(FILLER, ' ').replace(/\s+/g, ' ').trim() : '';
      if (q.length < 2 || /^[\d.,]+\s*(k|m)?\s*(robux|r\$|rbx)?$/.test(q)) return;
      picks = findItems(q, 3).filter(h => h.score >= 70 && h.item.n !== q).map(h => h.item);
      mode = picks.length ? 'item' : '';
      for (const i of picks) {
        const b = el('button', 'routility-bot-suggest-item');
        b.type = 'button';
        b.append(thumb(i, 20), el('span', 'text-caption-medium content-emphasis text-truncate-end', i.name), el('span', 'text-caption-small content-muted', i.usd ? (i.usd >= 1e6 ? '$' + short(i.usd) : formatUSD(i.usd)) : ''));
        b.addEventListener('mousedown', (e) => { e.preventDefault(); accept(i); });
        sug.appendChild(b);
      }
      mark();
    };
    ta.addEventListener('focus', () => { loadItems(); loadFeatures(); });
    ta.addEventListener('input', () => { grow(); suggest(); });
    ta.addEventListener('blur', clear);
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (picks.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + picks.length) % picks.length;
        mark();
        return;
      }
      if (picks.length && (e.key === 'Tab' || (e.key === 'Enter' && mode === 'cmd'))) { e.preventDefault(); accept(picks[active]); return; }
      if (e.key === 'Escape' && picks.length) { e.preventDefault(); clear(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        const v = ta.value;
        ta.value = '';
        clear();
        grow();
        userSay(v);
      }
    });
    box.append(sug, ta);
    foot.appendChild(box);
    s.append(head, scroll, foot);
    return s;
  }

  function bubble(m) {
    const li = el('li');
    const group = el('ul', 'react-chat-message-group flex flex-col');
    const row = el('li', 'flex gap-small padding-x-medium ' + (m.from === 'me' ? 'justify-end' : 'justify-start'));
    if (m.from !== 'me') {
      const a = el('span', 'react-chat-message-avatar shrink-0');
      a.appendChild(avatar());
      row.appendChild(a);
    }
    const col = el('div', 'flex max-width-[196px] flex-col gap-xxsmall ' + (m.from === 'me' ? 'items-end' : 'items-start') + ' routility-bot-col');
    if (m.text) {
      const line = el('div', 'flex items-center gap-xsmall');
      const b = el('div', 'react-chat-message-bubble padding-x-medium padding-y-small text-body-small react-chat-message-bubble-single ' + (m.from === 'me' ? 'react-chat-message-bubble-outgoing content-action-emphasis' : 'react-chat-message-bubble-incoming content-emphasis'));
      b.appendChild(el('span', 'text-body-small routility-bot-text', m.text));
      line.appendChild(b);
      col.appendChild(line);
    }
    for (const c of m.cards || []) {
      const node = card(c);
      if (node) col.appendChild(node);
    }
    if (m.chips && m.chips.length) {
      const chips = el('div', 'routility-bot-chips');
      for (const c of m.chips) {
        const b = el('button', 'routility-bot-chip text-caption-medium', c.label);
        b.type = 'button';
        b.addEventListener('click', () => chip(c));
        chips.appendChild(b);
      }
      col.appendChild(chips);
    }
    row.appendChild(col);
    group.appendChild(row);
    li.appendChild(group);
    return li;
  }

  function chip(c) {
    if (c.act === 'fill') {
      const ta = shell?.querySelector('.routility-bot-input');
      if (!ta) return;
      ta.value = c.value;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.dispatchEvent(new Event('input'));
      return;
    }
    if (c.act === 'say') userSay(c.value);
    else if (c.act === 'url') {
      const u = new URL(c.value, location.origin);
      if (u.pathname === location.pathname && u.hash) { location.href = u.href; location.reload(); }
      else location.href = u.href;
    }
  }

  function short(n) {
    const [d, u] = n >= 1e9 ? [1e9, 'B'] : n >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
    const v = n / d;
    return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2).replace(/\.?0+$/, '') + u;
  }

  function itemById(id) {
    return items && items.find(i => String(i.id) === String(id));
  }

  function thumb(i, size) {
    const box = el('span', 'routility-bot-thumb');
    box.style.width = box.style.height = size + 'px';
    if (i && i.thumb) {
      const img = el('img');
      img.src = i.thumb;
      img.alt = '';
      box.appendChild(img);
    }
    return box;
  }

  function card(c) {
    if (c.type === 'item') {
      const i = itemById(c.id);
      if (!i) return null;
      const a = el('a', 'routility-bot-card routility-bot-item');
      a.href = `/catalog/${i.id}`;
      const top = el('div', 'routility-bot-item-top');
      const names = el('div', 'routility-bot-item-names');
      names.append(el('span', 'text-label-medium content-emphasis routility-bot-item-name', i.name));
      const tags = [i.demand && lt('{demand} demand', { demand: lt(i.demand) }), i.trend && lt(i.trend), i.projected && lt('Projected'), i.rare && lt('Rare')].filter(Boolean);
      if (tags.length) names.append(el('span', 'text-caption-small content-muted', tags.join(' · ')));
      top.append(thumb(i, 40), names);
      const stats = el('div', 'routility-bot-stats');
      const stat = (label, value) => { const s = el('div', 'routility-bot-stat'); s.append(el('span', 'text-caption-small content-muted', label), el('span', 'text-label-medium content-emphasis', value)); return s; };
      stats.append(stat(lt('Price'), i.usd ? (i.usd >= 1e6 ? '$' + short(i.usd) : formatUSD(i.usd)) : '—'), ...(window.RoUtilityUI.shows('Bot').value && Number(i.value) > 0 ? [stat(lt('Value'), 'R$ ' + (i.value >= 1e5 ? short(i.value) : formatNumber(i.value)))] : []), stat('RAP', i.rap ? 'R$ ' + (i.rap >= 1e5 ? short(i.rap) : formatNumber(i.rap)) : '—'));
      a.append(top, stats);
      if (i.usd) a.appendChild(spark(i.id));
      return a;
    }
    if (c.type === 'player') {
      const a = el('a', 'routility-bot-card routility-bot-item routility-bot-player');
      a.href = `/users/${c.id}/profile`;
      const top = el('div', 'routility-bot-item-top');
      const pic = el('span', 'routility-bot-thumb routility-bot-head');
      if (c.head) { const img = el('img'); img.src = c.head; img.alt = ''; pic.appendChild(img); }
      const names = el('div', 'routility-bot-item-names');
      const title = el('span', 'text-label-medium content-emphasis routility-bot-item-name', c.display || c.name);
      if (c.verified && window.RoUtilityUI.verifiedBadge) title.appendChild(window.RoUtilityUI.verifiedBadge());
      names.append(title, el('span', 'text-caption-small content-muted', '@' + c.name));
      top.append(pic, names);
      a.appendChild(top);
      if (c.known && !c.hidden) {
        const stats = el('div', 'routility-bot-stats routility-bot-stats-3');
        const stat = (label, value) => { const s = el('div', 'routility-bot-stat'); s.append(el('span', 'text-caption-small content-muted', label), el('span', 'text-label-medium content-emphasis', value)); return s; };
        stats.append(stat(lt('Price'), c.usd >= 1e5 ? '$' + short(c.usd) : '$' + formatNumber(Math.round(c.usd))), stat('RAP', 'R$ ' + (c.rap >= 1e4 ? short(c.rap) : formatNumber(c.rap))), stat(lt('Limiteds'), formatNumber(c.count)));
        a.appendChild(stats);
      }
      return a;
    }
    if (c.type === 'list') {
      const box = el('div', 'routility-bot-card routility-bot-list-card');
      (c.ids || []).map(itemById).filter(Boolean).forEach((i, n) => {
        const row = el('a', 'routility-bot-rank');
        row.href = `/catalog/${i.id}`;
        const name = el('span', 'routility-bot-rank-name');
        name.append(el('span', 'text-label-medium content-emphasis text-truncate-end', i.name), el('span', 'text-caption-small content-muted', i.usd ? (i.usd >= 1e6 ? '$' + short(i.usd) : formatUSD(i.usd)) : 'R$ ' + formatNumber(i.rap)));
        row.append(el('span', 'text-caption-medium content-muted routility-bot-rank-n', String(n + 1)), thumb(i, 30), name);
        box.appendChild(row);
      });
      return box;
    }
    if (c.type === 'trade') {
      const give = (c.give || []).map(itemById).filter(Boolean);
      const get = (c.get || []).map(itemById).filter(Boolean);
      const a = sideTotals({ items: give, robux: c.giveRobux || 0 });
      const b = sideTotals({ items: get, robux: c.getRobux || 0 });
      const pct = a.usd ? Math.round(((b.usd - a.usd) / a.usd) * 1000) / 10 : 0;
      const box = el('div', 'routility-bot-card routility-bot-trade');
      const side = (label, list, robux, tot) => {
        const s = el('div', 'routility-bot-side');
        const head = el('div', 'routility-bot-side-head');
        head.append(el('span', 'text-caption-small content-muted', label), el('span', 'text-label-medium content-emphasis', formatUSD(tot.usd)));
        const pics = el('div', 'routility-bot-pics');
        for (const i of list.slice(0, 6)) {
          const t = thumb(i, 30);
          t.dataset.rtTip = `${i.name} · ${i.usd ? formatUSD(i.usd) : lt('no price')}`;
          pics.appendChild(t);
        }
        if (robux) pics.appendChild(el('span', 'text-caption-small content-default routility-bot-robux', '+ R$ ' + formatNumber(robux)));
        s.append(head, pics);
        return s;
      };
      const verdict = el('div', 'routility-bot-verdict text-label-medium ' + (Math.abs(pct) < 3 ? 'routility-bot-even' : pct > 0 ? 'routility-bot-win' : 'routility-bot-loss'), Math.abs(pct) < 3 ? lt('About Even') : pct >= 1000 ? lt('Massive Win') : pct > 0 ? lt('Win {pct}', { pct: pctText(pct) }) : pct <= -90 ? lt('Massive Loss') : lt('Loss {pct}', { pct: pctText(pct) }));
      box.append(side(lt('You Give'), give, c.giveRobux, a), side(lt('You Get'), get, c.getRobux, b), verdict);
      return box;
    }
    if (c.type === 'feature') {
      const f = features && features.find(x => x.key === c.key);
      if (!f) return null;
      const on = settings[f.key] ?? f.def;
      const box = el('div', 'routility-bot-card routility-bot-feature');
      const head = el('div', 'routility-bot-feature-head');
      head.append(el('span', 'text-label-medium content-emphasis', lt(f.title)), el('span', 'text-caption-small routility-bot-pill ' + (on ? 'routility-bot-pill-on' : ''), on ? lt('On') : lt('Off')));
      box.append(head, el('span', 'text-caption-medium content-default routility-bot-feature-desc', lt(f.desc)));
      const row = el('div', 'routility-bot-feature-row');
      const want = c.intent === 'off' ? on : c.intent === 'on' ? !on : !on;
      const toggle = el('button', 'routility-bot-chip text-caption-medium ' + (want ? 'routility-bot-chip-primary' : ''), on ? lt('Turn Off') : lt('Turn On'));
      toggle.type = 'button';
      toggle.addEventListener('click', () => setFeature(f, !on));
      const open = el('button', 'routility-bot-chip text-caption-medium', lt('Settings'));
      open.type = 'button';
      open.dataset.rtTip = f.tabLabel ? lt('Open in {tab}', { tab: lt(f.tabLabel) }) : lt('Open Settings');
      open.addEventListener('click', () => { location.href = '/my/account' + f.hash; });
      row.append(toggle, open);
      box.appendChild(row);
      return box;
    }
    return null;
  }

  const history = new Map();

  function spark(id) {
    const box = el('div', 'routility-bot-spark routility-bot-spark-loading');
    const draw = (points) => {
      box.classList.remove('routility-bot-spark-loading');
      const cut = Date.now() / 1000 - 30 * 86400;
      let pts = (points || []).filter(p => p.ts >= cut);
      if (pts.length < 2) pts = (points || []).slice(-30);
      if (pts.length < 2) { box.remove(); return; }
      const lo = Math.min(...pts.map(p => p.usd));
      const hi = Math.max(...pts.map(p => p.usd));
      const t0 = pts[0].ts;
      const t1 = pts[pts.length - 1].ts;
      const W = 172;
      const H = 26;
      const xy = pts.map(p => [((p.ts - t0) / Math.max(1, t1 - t0)) * W, hi === lo ? H / 2 : H - 2 - ((p.usd - lo) / (hi - lo)) * (H - 4)]);
      const line = xy.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
      const change = pts[0].usd ? ((pts[pts.length - 1].usd - pts[0].usd) / pts[0].usd) * 100 : 0;
      const dir = Math.abs(change) < 0.5 ? 'flat' : change > 0 ? 'up' : 'down';
      box.classList.add('routility-bot-spark-' + dir);
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      const area = document.createElementNS(ns, 'polygon');
      area.setAttribute('points', `0,${H} ${line} ${W},${H}`);
      area.setAttribute('class', 'routility-bot-spark-area');
      const pl = document.createElementNS(ns, 'polyline');
      pl.setAttribute('points', line);
      pl.setAttribute('class', 'routility-bot-spark-line');
      svg.append(area, pl);
      const label = el('div', 'routility-bot-spark-label');
      label.append(el('span', 'text-caption-small content-muted', lt('30 Days')), el('span', 'text-caption-small routility-bot-spark-pct', dir === 'flat' ? lt('Steady') : pctText(Math.round(change * 10) / 10)));
      box.append(label, svg);
    };
    if (history.has(id)) draw(history.get(id));
    else {
      window.RoUtilityUI.request({ type: 'getHistory', id }, r => r && 'points' in r).then(r => {
        const pts = (r && r.points) || [];
        history.set(id, pts);
        draw(pts);
      });
    }
    return box;
  }

  function setFeature(f, on) {
    chrome.storage.local.get('routilitySettings', (st) => {
      const next = { ...(st.routilitySettings || {}), [f.key]: on };
      chrome.storage.local.set({ routilitySettings: next }, () => {
        settings = next;
        botSay([{ text: on ? lt('Done, {feature} is on. Reload the page to see it everywhere.', { feature: lt(f.title) }) : lt('Done, {feature} is off. Reload the page to see it everywhere.', { feature: lt(f.title) }), chips: [{ label: lt('Reload'), act: 'url', value: location.pathname + location.search + location.hash }] }]);
      });
    });
  }

  function typingRow() {
    const li = el('li', 'flex items-center gap-small padding-x-medium padding-y-small routility-bot-typing-row');
    li.setAttribute('aria-hidden', 'true');
    li.appendChild(avatar());
    const b = el('div', 'react-chat-message-bubble react-chat-message-bubble-incoming flex items-center gap-xxsmall padding-x-medium padding-y-small routility-bot-typing');
    for (let k = 0; k < 3; k++) b.appendChild(el('span', 'inline-block size-[6px] radius-circle bg-system-neutral'));
    li.appendChild(b);
    return li;
  }

  function render() {
    placeRow();
    const host = dialogHost();
    if (!state.open || !host) {
      if (shell && !state.open) { shell.remove(); shell = null; }
      return;
    }
    if (!shell) shell = buildShell();
    if (shell.parentElement !== host || host.lastElementChild !== shell) host.appendChild(shell);
    shell.classList.toggle('routility-bot-collapsed', state.collapsed);
    const sub = shell.querySelector('.routility-bot-sub');
    const subText = typing ? lt('Typing…') : lt('Values, trades and help');
    if (sub.textContent !== subText) sub.textContent = subText;
    sub.classList.toggle('routility-bot-sub-typing', typing);
    shell.querySelector('.react-chat-dialog-header').setAttribute('aria-expanded', String(!state.collapsed));
    const ul = shell.querySelector('.routility-bot-list');
    const lastAt = state.msgs.length ? state.msgs[state.msgs.length - 1].t : 0;
    const sig = state.msgs.length + ':' + lastAt + ':' + typing + ':' + (features ? 1 : 0) + ':' + (items ? 1 : 0) + ':' + JSON.stringify(settings).length;
    if (ul.dataset.sig !== sig) {
      ul.dataset.sig = sig;
      ul.textContent = '';
      const day = el('li', 'flex justify-center padding-x-medium');
      day.appendChild(el('span', 'text-caption-small content-muted text-center', lt('Only you can see this chat. Nothing is sent to Roblox.')));
      ul.appendChild(day);
      state.msgs.forEach((m, n) => {
        const li = bubble(m);
        if (m.t > shown) li.classList.add('routility-bot-new');
        ul.appendChild(li);
      });
      shown = lastAt;
      if (typing) ul.appendChild(typingRow());
      const scroll = shell.querySelector('.routility-bot-scroll');
      requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    }
  }

  async function start() {
    const st = await new Promise(r => chrome.storage.local.get([KEY, 'routilitySettings'], r));
    settings = st.routilitySettings || {};
    if (settings.chatBot === false) return;
    Object.assign(state, st[KEY] || {});
    const needCards = state.msgs.some(m => m.cards && m.cards.length);
    if (needCards) Promise.all([loadItems(), loadFeatures()]).then(render);
    const tick = onFrame(() => {
      if (!document.getElementById('chat-container')) return;
      render();
      if (!state.onboarded && document.querySelector('#chat-container .react-chat-root')) {
        state.onboarded = true;
        state.open = true;
        save();
        render();
        botSay(onboard());
      }
    });
    new MutationObserver(tick).observe(document.body || document.documentElement, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.routilitySettings) { settings = ch.routilitySettings.newValue || {}; render(); }
      if (ch[KEY] && ch[KEY].newValue) {
        const v = ch[KEY].newValue;
        const theirs = v.msgs && v.msgs.length ? v.msgs[v.msgs.length - 1].t : 0;
        const ours = state.msgs.length ? state.msgs[state.msgs.length - 1].t : 0;
        if (v.msgs && theirs !== ours && !typing) {
          Object.assign(state, { msgs: v.msgs, unread: v.unread });
          if (v.msgs.some(m => m.cards && m.cards.length)) Promise.all([loadItems(), loadFeatures()]).then(render);
          render();
        }
      }
    });
    tick();
  }

  start();
})();
