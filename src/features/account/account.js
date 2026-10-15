(function () {
  'use strict';

  const { el, onFrame } = window.RoUtilityUI;
  const { lt, locale } = window.RoUtilityI18n;
  const settings = { sessionIps: true, backupCodeDate: true, voiceStatus: true };
  let sessionsJob = null;
  let codesJob = null;
  let voiceJob = null;
  let picked = null;

  async function getJson(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function userId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || null;
  }

  function day(value) {
    const d = new Date(value);
    if (isNaN(d)) return '';
    try {
      return d.toLocaleString(locale(), { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return d.toString();
    }
  }

  function sessions() {
    if (!sessionsJob) {
      sessionsJob = (async () => {
        const all = [];
        let cursor = '';
        for (let page = 0; page < 8; page++) {
          const d = await getJson(`https://apis.roblox.com/token-metadata-service/v1/sessions?desiredLimit=25${cursor ? '&nextCursor=' + encodeURIComponent(cursor) : ''}`);
          if (!d || !Array.isArray(d.sessions)) break;
          all.push(...d.sessions);
          cursor = d.hasMore ? d.nextCursor : '';
          if (!cursor) break;
        }
        return all;
      })();
      sessionsJob.then(list => { if (!list.length) setTimeout(() => { sessionsJob = null; }, 30000); });
    }
    return sessionsJob;
  }

  function place(s) {
    const l = s && s.location;
    return l ? [l.city, l.subdivision, l.country].filter(Boolean).join(', ') : '';
  }

  async function deviceIps() {
    const list = document.querySelector('.routility-devices-list');
    if (!list) return;
    const rows = [...list.children].slice(1).filter(li => li.querySelector('.text-title-large'));
    if (!rows.length || rows.every(li => li.querySelector('.routility-session-ip'))) return;
    const all = await sessions();
    if (!all.length || !list.isConnected) return;
    const current = all.find(s => s.isCurrentSession);
    const used = new Set();
    const langs = [...new Set([document.documentElement.lang, navigator.language, 'en-US'].filter(Boolean))];
    const stamp = (s, lang) => {
      try {
        return new Date(Number(s.lastAccessedTimestampEpochMilliseconds)).toLocaleString(lang, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      } catch {
        return '';
      }
    };
    rows.forEach((li, n) => {
      if (li.querySelector('.routility-session-ip')) return;
      const lines = [...li.querySelectorAll('.text-body-medium')].map(x => x.textContent.trim());
      let s = null;
      if (n === 0 && current) s = current;
      else s = all.find(x => !x.isCurrentSession && !used.has(x) && place(x) === lines[0] && langs.some(lang => stamp(x, lang) === lines[1])) || null;
      if (!s || !s.lastAccessedIp) return;
      used.add(s);
      li.dataset.rtIp = s.lastAccessedIp;
      const col = li.querySelector('.text-title-large')?.parentElement;
      if (col) col.appendChild(el('div', 'content-default text-align-x-start padding-top-xsmall text-body-medium routility-injected routility-session-ip', lt('IP {ip}', { ip: s.lastAccessedIp })));
    });
  }

  function modalIp() {
    if (!picked || Date.now() - picked.at > 5000) return;
    const dialog = [...document.querySelectorAll('[role="dialog"].foundation-web-dialog-content')].pop();
    const list = dialog && dialog.querySelector('.foundation-web-list');
    if (!list || list.querySelector('.routility-modal-ip')) return;
    const items = [...list.children];
    if (items.length < 3) return;
    const row = items[Math.min(2, items.length - 1)].cloneNode(true);
    const [title, value] = row.querySelectorAll('.text-title-large, .text-body-medium');
    if (!title || !value) return;
    row.classList.add('routility-injected', 'routility-modal-ip');
    title.textContent = lt('IP address').toLocaleUpperCase();
    value.textContent = picked.ip;
    items[2].after(row);
    picked = null;
  }

  async function codesDate() {
    const count = document.querySelector('#generate-recovery-codes-count');
    if (!count || document.querySelector('.routility-codes-date')) return;
    const me = userId();
    if (!me) return;
    if (!codesJob) codesJob = getJson(`https://twostepverification.roblox.com/v1/users/${me}/recovery-codes`);
    const d = await codesJob;
    if (!d || !(d.activeCount > 0) || !d.created || !count.isConnected || document.querySelector('.routility-codes-date')) return;
    const when = day(d.created);
    if (!when) return;
    count.parentElement.after(el('span', 'small text routility-injected routility-codes-date', lt('Made {date}', { date: when })));
  }

  function micOff() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'routility-voice-ban-icon');
    for (const d of ['M9 9V5a3 3 0 0 1 5.9-.8', 'M15 10.5V11a3 3 0 0 1-4.6 2.5', 'M19 10v1a7 7 0 0 1-11.6 5.3', 'M5 10v1c0 .9.2 1.8.5 2.6', 'M12 18v3', 'M8.5 21h7', 'M4 3l16 18']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  async function voiceBan() {
    if (!/^#!\/privacy\/?$/.test(location.hash)) return;
    const nav = document.querySelector('.settings-container-v2 nav');
    if (!nav || nav.querySelector('.routility-voice-ban')) return;
    if (!voiceJob) voiceJob = getJson('https://voice.roblox.com/v1/settings');
    const v = await voiceJob;
    if (!v || !v.isBanned || !nav.isConnected || nav.querySelector('.routility-voice-ban')) return;
    const row = el('div', 'settings-list-item-container routility-injected routility-voice-ban');
    const info = el('div', 'flex items-center gap-small');
    info.appendChild(micOff());
    const name = el('div', 'settings-list-item-info');
    name.appendChild(el('span', 'setting-name font-body', lt('Voice chat')));
    info.appendChild(name);
    const until = v.bannedUntil && v.bannedUntil.Seconds ? v.bannedUntil.Seconds * 1000 : v.bannedUntil;
    const when = until ? day(typeof until === 'number' ? until : String(until)) : '';
    row.append(info, el('div', 'font-body settings-list-item-value-arrow routility-voice-ban-value', when ? lt('Suspended until {date}', { date: when }) : lt('Suspended')));
    nav.prepend(row);
  }

  function run() {
    if (location.pathname !== '/my/account') return;
    if (/^#!\/security/.test(location.hash)) {
      if (settings.sessionIps) {
        deviceIps();
        modalIp();
      }
      if (settings.backupCodeDate) codesDate();
    } else if (settings.voiceStatus) voiceBan();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    if (location.pathname !== '/my/account' || (!settings.sessionIps && !settings.backupCodeDate && !settings.voiceStatus)) return;
    const tick = onFrame(run);
    document.addEventListener('click', (e) => {
      const li = e.target.closest && e.target.closest('.routility-devices-list > li');
      picked = li && li.dataset.rtIp ? { ip: li.dataset.rtIp, at: Date.now() } : null;
    }, true);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    tick();
  });
})();
