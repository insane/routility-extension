(function () {
  'use strict';

  if (window.RoUtilityI18n) return;

  const LANGS = {
    en: 'English',
    es: 'Español',
    pt: 'Português (Brasil)',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    'zh-cn': '简体中文',
    'zh-tw': '繁體中文',
    id: 'Bahasa Indonesia',
    th: 'ไทย',
    vi: 'Tiếng Việt',
    tr: 'Türkçe',
    ru: 'Русский',
    pl: 'Polski',
  };
  const LOCALE_KEY = 'routilityLocale';
  const CACHE_KEY = 'routilityI18nDict';
  const VERSION = chrome.runtime.getManifest().version;

  let lang = 'en';
  let dict = null;
  let rules = new Intl.PluralRules('en');

  function fromCode(code) {
    const c = String(code || '').toLowerCase().replace('-', '_');
    if (!c) return null;
    if (c.startsWith('zh')) return /_(tw|hk|mo|hant)/.test(c) ? 'zh-tw' : 'zh-cn';
    if (c.startsWith('pt')) return 'pt';
    const two = c.slice(0, 2);
    return LANGS[two] ? two : null;
  }

  function robloxLocale() {
    return document.querySelector('meta[name="locale-data"]')?.dataset.languageCode || '';
  }

  function domReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  function storageGet(keys) {
    return new Promise(r => chrome.storage.local.get(keys, st => r(st || {})));
  }

  async function loadDict(next) {
    if (next === 'en') {
      const cached = (await storageGet(CACHE_KEY))[CACHE_KEY];
      if (cached && cached.lang !== 'en') chrome.storage.local.set({ [CACHE_KEY]: { lang: 'en', ver: VERSION, data: null } });
      return null;
    }
    const fresh = await new Promise(r => {
      try {
        chrome.runtime.sendMessage({ type: 'i18nDict', lang: next }, (res) => {
          void chrome.runtime.lastError;
          r(res && typeof res === 'object' ? res : null);
        });
      } catch {
        r(null);
      }
    });
    const cached = (await storageGet(CACHE_KEY))[CACHE_KEY];
    if (!fresh) return cached && cached.lang === next && cached.data ? cached.data : null;
    if (!cached || cached.lang !== next || cached.ver !== VERSION || JSON.stringify(cached.data).length !== JSON.stringify(fresh).length) chrome.storage.local.set({ [CACHE_KEY]: { lang: next, ver: VERSION, data: fresh } });
    return fresh;
  }

  async function pick() {
    const st = await storageGet(['routilitySettings', LOCALE_KEY]);
    const chosen = ((st.routilitySettings || {}).language) || 'auto';
    if (chosen !== 'auto' && LANGS[chosen]) return chosen;
    let code = st[LOCALE_KEY];
    if (!code) {
      await domReady();
      code = robloxLocale();
    }
    return fromCode(code) || fromCode(navigator.language) || 'en';
  }

  const ready = (async () => {
    try {
      const next = await pick();
      const data = await loadDict(next);
      lang = data || next === 'en' ? next : 'en';
      dict = data;
      rules = new Intl.PluralRules(lang === 'zh-cn' ? 'zh-CN' : lang === 'zh-tw' ? 'zh-TW' : lang);
      document.documentElement.dataset.routilityLang = lang;
    } catch {}
  })();

  domReady().then(() => {
    const code = robloxLocale();
    if (!code) return;
    chrome.storage.local.get(LOCALE_KEY, (st) => {
      if (st[LOCALE_KEY] !== code) chrome.storage.local.set({ [LOCALE_KEY]: code });
    });
  });

  function fill(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  }

  function t(text, vars) {
    const v = dict ? dict[text] : null;
    const out = typeof v === 'string' && v ? v : v && typeof v === 'object' ? v.other || text : text;
    return fill(out, vars);
  }

  function tn(n, one, other, vars) {
    const count = Number(n);
    const all = Object.assign({ n }, vars || {});
    const v = dict ? dict[other] : null;
    if (typeof v === 'string' && v) return fill(v, all);
    if (v && typeof v === 'object') {
      const cat = rules.select(count);
      return fill(v[cat] || v.other || other, all);
    }
    return fill(count === 1 ? one : other, all);
  }

  window.RoUtilityI18n = {
    lt: t,
    ltn: tn,
    LT: (text) => text,
    ready,
    lang: () => lang,
    locale: () => (lang === 'zh-cn' ? 'zh-CN' : lang === 'zh-tw' ? 'zh-TW' : lang === 'pt' ? 'pt-BR' : lang),
    LANGS,
  };
})();
