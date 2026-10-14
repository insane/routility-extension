(function () {
  'use strict';

  if (window.RoUtilityLife) return;
  const root = document.documentElement;
  const token = Math.random().toString(36).slice(2);
  const late = !!root.dataset.routilityLife;
  root.dataset.routilityLife = token;
  let dead = false;

  const guard = (fn) => (typeof fn === 'function' ? function (...args) { if (!dead) return fn.apply(this, args); } : fn);

  const nativeTimeout = window.setTimeout;
  const nativeInterval = window.setInterval;
  const nativeClearInterval = window.clearInterval;
  const nativeFrame = window.requestAnimationFrame;
  const intervals = new Set();
  window.setTimeout = function (fn, ...rest) { return nativeTimeout.call(window, guard(fn), ...rest); };
  window.setInterval = function (fn, ...rest) {
    const id = nativeInterval.call(window, guard(fn), ...rest);
    intervals.add(id);
    return id;
  };
  window.clearInterval = function (id) {
    intervals.delete(id);
    return nativeClearInterval.call(window, id);
  };
  window.requestAnimationFrame = function (fn) { return nativeFrame.call(window, guard(fn)); };
  for (const name of ['MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'PerformanceObserver']) {
    const Native = window[name];
    if (typeof Native !== 'function') continue;
    window[name] = class extends Native {
      constructor(callback, ...rest) { super(guard(callback), ...rest); }
    };
  }

  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeRemove = EventTarget.prototype.removeEventListener;
  const wrapped = new WeakMap();
  const lasting = (target) => target === window || target === document || target === root || target === document.body;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (!listener || !lasting(this)) return nativeAdd.call(this, type, listener, options);
    let w = wrapped.get(listener);
    if (!w) {
      w = function (e) {
        if (dead) return;
        return typeof listener === 'function' ? listener.call(this, e) : listener.handleEvent(e);
      };
      wrapped.set(listener, w);
    }
    return nativeAdd.call(this, type, w, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    return nativeRemove.call(this, type, (listener && wrapped.get(listener)) || listener, options);
  };

  function sweep() {
    document.querySelectorAll('.routility-injected, style[id^="routility"]').forEach(n => n.remove());
    for (const n of document.querySelectorAll('[class*="routility-"]')) {
      for (const c of [...n.classList]) if (c.startsWith('routility-')) n.classList.remove(c);
    }
    delete root.dataset.rtTitle;
  }

  function die() {
    dead = true;
    intervals.forEach(id => nativeClearInterval.call(window, id));
    if (root.dataset.routilityLife !== token) return;
    delete root.dataset.routilityLife;
    sweep();
    window.postMessage({ type: 'routility-fun', cfg: null }, location.origin);
  }

  const watch = nativeInterval.call(window, () => {
    let alive = false;
    try { alive = !!(chrome.runtime && chrome.runtime.id); } catch {}
    if (alive) return;
    nativeClearInterval.call(window, watch);
    die();
  }, 1000);

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg && msg.type === 'routilityPing' && !dead) reply(true);
  });

  if (late) sweep();
  window.RoUtilityLife = { late, sweep };
})();
