(function () {
  'use strict';

  if (window.__routilityAvNext) return;
  window.__routilityAvNext = true;

  const root = document.documentElement;
  const enabled = () => root.classList.contains('routility-av-more');
  const RIGID = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58]);
  const LAYERED = new Set([41, 64, 65, 66, 67, 68, 69, 70, 71, 72]);
  const MAX = 10;
  const NEEDS = ['currentlyWornAssetsList', 'advancedAccessorySlots', 'setWearingAssets'];
  const WRAPPED = Symbol.for('routility.avNext');

  let worn = null;

  function kind(asset) {
    const id = asset && asset.assetType && asset.assetType.id;
    return { rigid: RIGID.has(id), layered: LAYERED.has(id) };
  }

  function wrapWear(ctx) {
    if (typeof ctx.wearAsset !== 'function' || typeof ctx.setWearingAssets !== 'function' || typeof ctx.constructLayeredClothingMetadata !== 'function') return;
    if (enabled()) {
      try { ctx.layeredClothingItemCount = 0; } catch {}
    }
    if (ctx.wearAsset[WRAPPED]) return;
    const original = ctx.wearAsset;
    const wrapped = function (asset, ...rest) {
      const list = worn && worn.currentlyWornAssetsList;
      const k = kind(asset);
      if (!enabled() || (!k.rigid && !k.layered) || !Array.isArray(list)) return Reflect.apply(original, this, [asset, ...rest]);
      let rigidLeft = MAX;
      let layeredLeft = MAX;
      const out = [];
      for (const a of [asset, ...list]) {
        if (!a || out.includes(a)) continue;
        const t = kind(a);
        if ((t.rigid && rigidLeft <= 0) || (t.layered && layeredLeft <= 0)) continue;
        out.push(a);
        if (t.rigid) rigidLeft--;
        if (t.layered) layeredLeft--;
      }
      return ctx.setWearingAssets(ctx.constructLayeredClothingMetadata(out));
    };
    Object.defineProperty(wrapped, WRAPPED, { value: true });
    ctx.wearAsset = wrapped;
    root.dataset.routilityAvHook = 'next';
  }

  function seeContext(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.currentlyWornAssetsList) && typeof value.setCurrentlyWornAssets === 'function') worn = value;
    wrapWear(value);
  }

  function seeProps(props) {
    if (!props || typeof props !== 'object') return;
    seeContext(props.value);
    if (enabled() && Array.isArray(props.advancedAccessorySlots) && Array.isArray(props.otherAssets) && typeof props.setWearingAssetsFromIdsV2 === 'function') {
      props.avatarSettings = { ...(props.avatarSettings || {}), LCEnabledInEditorAndCatalog: false };
    }
  }

  function moduleKind(m) {
    if (!m || (typeof m !== 'object' && typeof m !== 'function')) return null;
    if (typeof m.useState === 'function' && typeof m.useContext === 'function' && typeof m.createContext === 'function' && typeof m.createElement === 'function') return 'react';
    if (typeof m.jsx === 'function' && typeof m.jsxs === 'function' && m.Fragment !== undefined) return 'jsx';
    return null;
  }

  const patched = new WeakMap();

  function patchModule(m) {
    const type = moduleKind(m);
    if (!type) return m;
    let copy = patched.get(m);
    if (copy) return copy;
    copy = Object.assign({}, type === 'react' ? m.default : null, m);
    if (type === 'react') {
      copy.default = copy;
      const useContext = m.useContext;
      copy.useContext = function (...args) {
        const value = Reflect.apply(useContext, this, args);
        try { seeContext(value); } catch {}
        return value;
      };
      const createElement = m.createElement;
      copy.createElement = function (...args) {
        try { seeProps(args[1]); } catch {}
        return Reflect.apply(createElement, this, args);
      };
    } else {
      for (const key of ['jsx', 'jsxs']) {
        const fn = m[key];
        copy[key] = function (el, props, ...rest) {
          try { seeProps(props); } catch {}
          return Reflect.apply(fn, this, [el, props, ...rest]);
        };
      }
    }
    patched.set(m, copy);
    return copy;
  }

  const seen = new WeakSet();
  const matches = new WeakMap();

  function isAvatar(factory) {
    let hit = matches.get(factory);
    if (hit === undefined) {
      let src = '';
      try { src = Function.prototype.toString.call(factory); } catch {}
      hit = NEEDS.every(k => src.includes(k));
      matches.set(factory, hit);
    }
    return hit;
  }

  function wrapFactory(factory) {
    if (seen.has(factory)) return factory;
    const wrapped = function (ctx, ...rest) {
      if (!ctx || typeof ctx.i !== 'function' || !isAvatar(factory)) return Reflect.apply(factory, this, [ctx, ...rest]);
      const inner = Object.create(ctx);
      inner.i = function (id) {
        const m = Reflect.apply(ctx.i, ctx, [id]);
        try { return patchModule(m); } catch { return m; }
      };
      return Reflect.apply(factory, this, [inner, ...rest]);
    };
    seen.add(wrapped);
    return wrapped;
  }

  function wrapChunk(chunk) {
    if (!Array.isArray(chunk)) return;
    for (let i = 1; i < chunk.length; i++) {
      if (typeof chunk[i] === 'function') {
        try { chunk[i] = wrapFactory(chunk[i]); } catch {}
      }
    }
  }

  const pushes = new WeakSet();

  function watch(list) {
    let push;
    try { push = list && list.push; } catch { return; }
    if (typeof push !== 'function') return;
    if (Array.isArray(list)) for (const c of list) wrapChunk(c);
    if (pushes.has(push)) return;
    const next = function (...chunks) {
      for (const c of chunks) wrapChunk(c);
      return Reflect.apply(push, this, chunks);
    };
    pushes.add(next);
    try { list.push = next; } catch {}
  }

  const desc = Object.getOwnPropertyDescriptor(window, 'TURBOPACK');
  if (desc && (!desc.configurable || ('value' in desc ? !desc.writable : !desc.set))) {
    watch(window.TURBOPACK);
    return;
  }
  let current = desc ? ('value' in desc ? desc.value : undefined) : undefined;
  const get = desc && desc.get ? () => Reflect.apply(desc.get, window, []) : () => current;
  try {
    Object.defineProperty(window, 'TURBOPACK', {
      configurable: true,
      enumerable: desc ? desc.enumerable : true,
      get,
      set(v) {
        if (desc && desc.set) Reflect.apply(desc.set, window, [v]);
        else current = v;
        try { watch(get()); } catch {}
      },
    });
  } catch {}
  try { watch(window.TURBOPACK); } catch {}
})();
