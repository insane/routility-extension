(function () {
  'use strict';

  const root = document.documentElement;
  const HIDE_AFTER = 1200;
  const EDGE = 24;
  const MIN_THUMB = 36;

  let track = null;
  let thumb = null;
  let resizes = null;
  let frame = 0;
  let hideTimer = 0;
  let near = false;
  let drag = null;
  let on = false;

  const scroller = () => document.scrollingElement || root;
  const locked = () => [root, document.body].some(n => n && getComputedStyle(n).overflowY === 'hidden');

  function bounds() {
    const header = document.getElementById('header');
    const top = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
    return { top, length: Math.max(0, innerHeight - top) };
  }

  function update() {
    frame = 0;
    if (!on) return;
    const el = scroller();
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 1 || locked()) {
      track.hidden = true;
      return;
    }
    const { top, length } = bounds();
    const size = Math.max(MIN_THUMB, Math.round((length * el.clientHeight) / el.scrollHeight));
    track.hidden = false;
    track.style.top = top + 'px';
    thumb.style.height = size + 'px';
    thumb.style.transform = `translateY(${Math.round((el.scrollTop / max) * (length - size))}px)`;
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  function reveal() {
    track.classList.add('routility-scrollbar-shown');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!near && !drag) track.classList.remove('routility-scrollbar-shown');
    }, HIDE_AFTER);
  }

  const onScroll = () => {
    schedule();
    reveal();
  };

  const onMove = (e) => {
    const next = e.clientX >= innerWidth - EDGE;
    if (next === near) return;
    near = next;
    schedule();
    reveal();
  };

  function endDrag(e) {
    if (!drag) return;
    drag = null;
    track.classList.remove('routility-scrollbar-dragging');
    if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
    reveal();
  }

  function build() {
    track = document.createElement('div');
    track.id = 'routility-scrollbar';
    track.className = 'routility-injected';
    track.setAttribute('aria-hidden', 'true');
    thumb = document.createElement('div');
    track.appendChild(thumb);
    thumb.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { y: e.clientY, start: scroller().scrollTop };
      thumb.setPointerCapture(e.pointerId);
      track.classList.add('routility-scrollbar-dragging');
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const el = scroller();
      const range = Math.max(1, bounds().length - thumb.offsetHeight);
      el.scrollTop = drag.start + ((e.clientY - drag.y) * (el.scrollHeight - el.clientHeight)) / range;
    });
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);
    resizes = new ResizeObserver(schedule);
  }

  function setOn(next) {
    if (next === on) return;
    on = next;
    if (on) {
      if (!track) build();
      root.appendChild(track);
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', schedule);
      document.addEventListener('mousemove', onMove, { passive: true });
      resizes.observe(root);
      if (document.body) resizes.observe(document.body);
      schedule();
      return;
    }
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', schedule);
    document.removeEventListener('mousemove', onMove);
    resizes.disconnect();
    clearTimeout(hideTimer);
    near = false;
    drag = null;
    track.classList.remove('routility-scrollbar-shown', 'routility-scrollbar-dragging');
    track.remove();
  }

  const wanted = (settings) => (settings || {}).scrollbarFix !== false && (settings || {}).scrollbarStyle !== 'default';

  chrome.storage.local.get('routilitySettings', (st) => setOn(wanted(st.routilitySettings)));
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.routilitySettings) setOn(wanted(ch.routilitySettings.newValue));
  });
})();
