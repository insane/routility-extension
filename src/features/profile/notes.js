(function () {
  'use strict';

  if (window.RoUtilityNotes) return;
  const { el, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;

  const MAX = 500;
  let notes = {};
  let on = false;
  let observer = null;
  let saveTimer = 0;

  const myId = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const KEY = 'routilityNotes:' + (myId() || '0');

  function profileId() {
    const m = location.pathname.match(/^\/users\/(\d+)\/profile\/?$/i);
    return m ? m[1] : '';
  }

  function spot() {
    const columns = document.querySelector('.routility-classic .routility-columns-about');
    if (columns) {
      const stats = columns.querySelector(':scope > .profile-stats-container');
      return stats && stats.childElementCount ? { parent: columns, before: stats } : null;
    }
    const about = document.querySelector('.routility-classic .profile-about');
    if (about) {
      const desc = about.querySelector(':scope > .section-content');
      return desc && desc.nextElementSibling ? { parent: about, before: desc.nextElementSibling } : null;
    }
    const header = document.querySelector('#content > .profile-platform-container .user-profile-header');
    return header && header.childElementCount ? { parent: header, before: null } : null;
  }

  function save(id, text) {
    let clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX);
    if (!clean.trim()) clean = '';
    if (clean === ((notes[id] && notes[id].text) || '')) return;
    notes[id] = { text: clean, at: Date.now() };
    chrome.storage.local.set({ [KEY]: notes });
  }

  function grow(area) {
    area.style.height = 'auto';
    area.style.height = area.scrollHeight + 'px';
  }

  function block(id) {
    const box = el('div', 'routility-injected routility-profile-note');
    box.dataset.user = id;
    const head = el('div', 'routility-profile-note-head');
    const hint = el('span', 'text-body-small content-muted routility-profile-note-hint');
    hint.append(el('span', 'routility-profile-note-lock'), el('span', null, lt('Only visible to you')));
    const count = el('span', 'text-body-small content-muted routility-profile-note-count');
    head.append(el('span', 'text-label-medium content-emphasis', lt('Note')), hint, count);
    const area = el('textarea', 'text-body-medium routility-profile-note-input');
    area.rows = 1;
    area.maxLength = MAX;
    area.placeholder = lt('Click to add a note');
    area.setAttribute('aria-label', lt('Note'));
    area.value = (notes[id] && notes[id].text) || '';
    area.spellcheck = false;
    const counter = () => { count.textContent = area.value.length > MAX - 100 ? `${area.value.length}/${MAX}` : ''; };
    area.addEventListener('focus', () => { area.spellcheck = true; });
    area.addEventListener('input', () => {
      grow(area);
      counter();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(id, area.value), 400);
    });
    area.addEventListener('blur', () => {
      area.spellcheck = false;
      clearTimeout(saveTimer);
      save(id, area.value);
    });
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') area.blur();
    });
    box.append(head, area);
    requestAnimationFrame(() => grow(area));
    return box;
  }

  function place() {
    const id = profileId();
    const old = document.querySelector('.routility-profile-note');
    if (!on || !id || id === myId()) {
      old?.remove();
      return;
    }
    const at = spot();
    if (!at) return;
    if (old && old.dataset.user === id && old.parentElement === at.parent) return;
    old?.remove();
    at.parent.insertBefore(block(id), at.before && at.before.parentElement === at.parent ? at.before : null);
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame(place));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
    if (profileId() && myId()) chrome.runtime.sendMessage({ type: 'notesSync' }, () => void chrome.runtime.lastError);
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    document.querySelectorAll('.routility-profile-note').forEach(n => n.remove());
  }

  chrome.storage.local.get([KEY, 'routilitySettings'], (st) => {
    notes = (st && st[KEY]) || {};
    on = ((st && st.routilitySettings) || {}).profileNotes !== false;
    if (on) start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[KEY]) {
      notes = changes[KEY].newValue || {};
      const input = document.querySelector('.routility-profile-note-input');
      const box = input && input.closest('.routility-profile-note');
      if (input && box && document.activeElement !== input) {
        input.value = (notes[box.dataset.user] && notes[box.dataset.user].text) || '';
        grow(input);
      }
    }
    if (changes.routilitySettings) {
      on = (changes.routilitySettings.newValue || {}).profileNotes !== false;
      if (on) start();
      else stop();
    }
  });

  window.RoUtilityNotes = { start, stop };
})();
