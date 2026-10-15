(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { lt, LT } = window.RoUtilityI18n;
  let settings = {};

  const CLASSIC_SETS = {
    classicGames: { words: { experiences: 'Games', experience: 'Game', charts: 'Games' }, title: [/^\/charts(\/|$)/i, LT('Games')] },
    classicCatalog: { words: { marketplace: 'Catalog' }, title: [/^\/catalog\/?$/i, LT('Catalog')] },
    classicGroups: { words: { communities: 'Groups', community: 'Group' }, title: [/^\/communities\/?$/i, LT('Groups')] },
    classicPackages: { words: { bundles: 'Packages', bundle: 'Package' }, title: [/^\/bundles\/?$/i, LT('Packages')] },
  };
  const renamed = new Map();
  let namesObserver = null;
  let titleObserver = null;
  let titleWas = null;
  let classic = { words: {}, re: null, titles: [], develop: false, key: '' };

  function classicConfig() {
    const words = {};
    const titles = [];
    for (const [key, set] of Object.entries(CLASSIC_SETS)) {
      if (settings[key] === false) continue;
      Object.assign(words, set.words);
      titles.push(set.title);
    }
    const names = Object.keys(words);
    const develop = settings.classicDevelop !== false;
    return {
      words,
      titles,
      develop,
      re: names.length ? new RegExp('^((?:my|search|search my|join|leave|create|hidden|your|all|favorite|recent|popular|recommended|featured|related|similar|other|more|top|new) )?(' + names.join('|') + ')( \\([\\d,.]+[kmb+]*\\))?$', 'i') : null,
      key: names.join(',') + '|' + develop,
    };
  }

  const swapWord = (w) => {
    const to = classic.words[w.toLowerCase()];
    if (w === w.toLowerCase()) return to.toLowerCase();
    if (w === w.toUpperCase()) return to.toUpperCase();
    return to;
  };

  function classicText(t, el) {
    if (t === 'Create' && classic.develop && el && el.matches('a.nav-menu-title')) return 'Develop';
    if (!classic.re || !classic.re.test(t)) return null;
    return t.replace(classic.re, (m, pre, word, count) => (pre || '') + swapWord(word) + (count || ''));
  }

  function remember(target, from, to) {
    if (renamed.size > 400) for (const x of renamed.keys()) if (!(x.isConnected || x.ownerElement?.isConnected)) renamed.delete(x);
    if (!renamed.has(target)) renamed.set(target, { from, to });
    else renamed.get(target).to = to;
  }

  function renameText(n) {
    const p = n.parentElement;
    if (!p || p.closest('textarea, [contenteditable="true"], .rt-m-strike')) return;
    const t = n.nodeValue.trim();
    const to = t && classicText(t, p);
    if (!to || to === t) return;
    const next = n.nodeValue.replace(t, to);
    remember(n, n.nodeValue, next);
    n.nodeValue = next;
  }

  function renamePlaceholder(input) {
    const t = (input.getAttribute('placeholder') || '').trim();
    const to = t && classicText(t, null);
    if (!to || to === t) return;
    remember(input.getAttributeNode('placeholder'), t, to);
    input.setAttribute('placeholder', to);
  }

  function renameIn(root) {
    if (root.nodeType === 3) return renameText(root);
    if (root.nodeType !== 1) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) renameText(n);
    if (root.matches('input[placeholder]')) renamePlaceholder(root);
    root.querySelectorAll('input[placeholder]').forEach(renamePlaceholder);
  }

  function classicTitle() {
    const hit = classic.titles.find(([re]) => re.test(location.pathname));
    if (!hit) return;
    const now = document.title;
    const want = (now.match(/^\(\d+\+?\) /) || [''])[0] + lt('{page} - Roblox', { page: lt(hit[1]) });
    if (now === want) return;
    if (titleWas === null) titleWas = now;
    document.title = want;
  }

  function startClassicNames() {
    if (settings.classicNames !== true) return stopClassicNames();
    const next = classicConfig();
    if (namesObserver && next.key === classic.key) return;
    stopClassicNames();
    classic = next;
    const pending = new Set();
    let queued = false;
    const flush = () => {
      queued = false;
      for (const n of pending) {
        if (!n.isConnected) continue;
        let p = n.parentNode;
        while (p && !pending.has(p)) p = p.parentNode;
        if (!p) renameIn(n);
      }
      pending.clear();
    };
    namesObserver = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') renameText(m.target);
        else if (m.type === 'attributes') pending.add(m.target);
        else for (const n of m.addedNodes) pending.add(n);
      }
      if (pending.size && !queued) {
        queued = true;
        requestAnimationFrame(flush);
      }
    });
    namesObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder'] });
    renameIn(document.documentElement);
    const obs = titleObserver = new MutationObserver(classicTitle);
    const watchHead = () => {
      if (titleObserver !== obs) return;
      if (!document.head) return setTimeout(watchHead, 50);
      obs.observe(document.head, { subtree: true, childList: true, characterData: true });
      classicTitle();
    };
    watchHead();
  }

  function stopClassicNames() {
    if (!namesObserver) return;
    namesObserver.disconnect();
    namesObserver = null;
    titleObserver?.disconnect();
    titleObserver = null;
    for (const [node, { from, to }] of renamed) {
      if (node.nodeType === 2) {
        if (node.ownerElement && node.ownerElement.getAttribute('placeholder') === to) node.ownerElement.setAttribute('placeholder', from);
      } else if (node.nodeValue === to) node.nodeValue = from;
    }
    renamed.clear();
    if (titleWas !== null) {
      document.title = titleWas;
      titleWas = null;
    }
  }

  try { settings = (JSON.parse(localStorage.getItem('routilityEarly')) || {}).routilitySettings || {}; } catch {}
  startClassicNames();
  chrome.storage.local.get('routilitySettings', (st) => {
    settings = st.routilitySettings || {};
    startClassicNames();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.routilitySettings) return;
    settings = changes.routilitySettings.newValue || {};
    startClassicNames();
  });
  window.RoUtilityI18n.ready?.then(() => { if (namesObserver) classicTitle(); });
})();
