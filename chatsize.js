(function () {
  'use strict';

  const { lt } = window.RoUtilityI18n;
  const KEY = 'routilityChatSize';
  const BASE_W = 260;
  const BASE_H = 360;
  const START = { w: 367, h: 603 };
  const LIST_W = 286;

  let size = null;
  let style = null;
  let layer = null;
  let on = false;
  let drag = null;
  let queued = false;

  function clamp(w, h) {
    const maxW = Math.max(BASE_W, Math.min(720, innerWidth - LIST_W - 48));
    const maxH = Math.max(BASE_H, innerHeight - 72);
    return { w: Math.round(Math.min(maxW, Math.max(BASE_W, w))), h: Math.round(Math.min(maxH, Math.max(BASE_H, h))) };
  }

  function css() {
    if (!style) {
      style = document.createElement('style');
      style.id = 'routility-chat-size';
      (document.head || document.documentElement).appendChild(style);
    }
    if (!on) { style.textContent = ''; return; }
    const cur = size || START;
    const s = clamp(cur.w, cur.h);
    style.textContent = `
#chat-container { --rt-chat-w: ${s.w}px; --rt-chat-h: ${s.h}px; }
#chat-container .react-chat-dialog-shell { width: ${s.w}px !important; }
#chat-container .react-chat-dialog-shell.height-\\[360px\\],
#chat-container .routility-bot-shell:not(.routility-bot-collapsed) { height: ${s.h}px !important; }
#chat-container .react-chat-root > section.height-\\[360px\\] { height: ${s.h}px !important; }
`;
  }

  function shells() {
    return [...document.querySelectorAll('#chat-container .react-chat-dialog-shell')].filter(s => (s.classList.contains('height-[360px]') || (s.classList.contains('routility-bot-shell') && !s.classList.contains('routility-bot-collapsed'))) && s.getBoundingClientRect().width > 0);
  }

  function place() {
    queued = false;
    if (!layer) return;
    const list = on ? shells() : [];
    while (layer.children.length > list.length) layer.lastChild.remove();
    list.forEach((s, i) => {
      let g = layer.children[i];
      if (!g) {
        g = document.createElement('div');
        g.className = 'routility-chat-grip';
        g.dataset.rtTip = lt('Drag to resize · Double-click to reset');
        g.setAttribute('aria-hidden', 'true');
        g.addEventListener('pointerdown', start);
        g.addEventListener('dblclick', reset);
        layer.appendChild(g);
      }
      const r = s.getBoundingClientRect();
      g.style.left = r.left - 4 + 'px';
      g.style.top = r.top - 4 + 'px';
    });
  }

  let settle = 0;

  function schedule() {
    clearTimeout(settle);
    settle = setTimeout(() => requestAnimationFrame(place), 350);
    if (queued) return;
    queued = true;
    requestAnimationFrame(place);
  }

  function start(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = shells()[0];
    const r = s ? s.getBoundingClientRect() : { width: START.w, height: START.h };
    drag = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, id: e.pointerId, el: e.currentTarget };
    drag.el.setPointerCapture(e.pointerId);
    document.documentElement.classList.add('routility-chat-dragging');
    drag.el.addEventListener('pointermove', move);
    drag.el.addEventListener('pointerup', end);
    drag.el.addEventListener('pointercancel', end);
  }

  function move(e) {
    if (!drag) return;
    size = clamp(drag.w + (drag.x - e.clientX), drag.h + (drag.y - e.clientY));
    css();
    schedule();
  }

  function end() {
    if (!drag) return;
    drag.el.removeEventListener('pointermove', move);
    drag.el.removeEventListener('pointerup', end);
    drag.el.removeEventListener('pointercancel', end);
    drag = null;
    document.documentElement.classList.remove('routility-chat-dragging');
    if (size && size.w === START.w && size.h === START.h) size = null;
    chrome.storage.local.set({ [KEY]: size });
    schedule();
  }

  function reset() {
    size = null;
    chrome.storage.local.set({ [KEY]: null });
    css();
    schedule();
  }

  function setOn(v) {
    on = v;
    css();
    if (on && !layer) {
      layer = document.createElement('div');
      layer.className = 'routility-chat-grips routility-injected';
      document.documentElement.appendChild(layer);
    }
    schedule();
  }

  chrome.storage.local.get([KEY, 'routilitySettings'], (st) => {
    size = st[KEY] || null;
    setOn((st.routilitySettings || {}).chatResize !== false);
    const watch = () => {
      const host = document.getElementById('chat-container');
      if (!host) { setTimeout(watch, 1000); return; }
      new MutationObserver(schedule).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      schedule();
    };
    watch();
    addEventListener('resize', () => { css(); schedule(); });
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.routilitySettings) setOn((ch.routilitySettings.newValue || {}).chatResize !== false);
    if (ch[KEY] && !drag) { size = ch[KEY].newValue || null; css(); schedule(); }
  });
})();
