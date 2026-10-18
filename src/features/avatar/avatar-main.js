(function () {
  'use strict';

  const RIGID = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58]);
  const MAX = 10;
  const root = document.documentElement;
  const enabled = () => root.classList.contains('routility-av-more');
  const keepR6 = () => root.classList.contains('routility-keep-r6');
  const DYNAMIC_HEAD = 79;

  let wantR15Until = 0;
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.avatar-type-toggle-scale')) wantR15Until = Date.now() + 5000;
  }, true);

  const TYPE_URL = /avatar\.roblox\.com\/v\d+\/avatar\/(?:set-player-avatar-type|avatar)(?:[?#]|$)|avatar\.roblox\.com\/v4\/avatar(?:[?#]|$)/;
  const READ_URL = /avatar\.roblox\.com\/v\d+\/avatar(?:\/avatar)?(?:[?#]|$)/;
  let serverType = null;

  function learn(url, text) {
    if (!READ_URL.test(String(url)) || typeof text !== 'string') return;
    try {
      const d = JSON.parse(text);
      if (d && (d.playerAvatarType === 'R6' || d.playerAvatarType === 'R15')) serverType = d.playerAvatarType;
    } catch {}
  }

  fetch('https://avatar.roblox.com/v1/avatar', { credentials: 'include' })
    .then(r => (r.ok ? r.text() : ''))
    .then(t => { if (serverType === null) learn('https://avatar.roblox.com/v1/avatar', t); })
    .catch(() => {});

  function keepBody(url, body) {
    if (!keepR6() || typeof body !== 'string' || !TYPE_URL.test(String(url))) return body;
    try {
      const data = JSON.parse(body);
      const model = data && data.avatarDefinition && data.avatarDefinition.updateAvatarModel;
      const holder = model && model.playerAvatarType !== undefined ? model : data;
      if (!holder || holder.playerAvatarType !== 'R15') return body;
      if (Date.now() < wantR15Until) {
        serverType = 'R15';
        return body;
      }
      const typeOnly = /set-player-avatar-type/.test(String(url))
        || (holder === data ? Object.keys(data).length === 1 : Array.isArray(data.updateTypes) && data.updateTypes.length === 1 && data.updateTypes[0] === 'UpdateAvatarType');
      if (serverType === 'R6' || (typeOnly && serverType !== 'R15')) {
        holder.playerAvatarType = 'R6';
        return JSON.stringify(data);
      }
    } catch {}
    return body;
  }

  const SAVE_URL = /avatar\.roblox\.com\/v\d+\/avatar\//;
  const adjusted = new Map();
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.origin !== location.origin || !d || d.type !== 'routility-aa-saved' || !Array.isArray(d.items)) return;
    for (const [id, meta] of d.items) adjusted.set(Number(id), meta || null);
  });

  function keepMeta(url, body) {
    if (!adjusted.size || typeof body !== 'string' || !SAVE_URL.test(String(url))) return body;
    try {
      const data = JSON.parse(body);
      let hit = false;
      const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || depth > 8) return;
        if (Array.isArray(o)) {
          for (const x of o) walk(x, depth + 1);
          return;
        }
        if (adjusted.has(Number(o.id)) && ('meta' in o || 'assetType' in o || Object.keys(o).length === 1)) {
          const meta = adjusted.get(Number(o.id));
          if (meta) o.meta = meta;
          else delete o.meta;
          hit = true;
        }
        for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
      };
      walk(data, 0);
      return hit ? JSON.stringify(data) : body;
    } catch {
      return body;
    }
  }

  const OUTFIT_URL = /avatar\.roblox\.com\/v\d+\/outfits\/\d+\/details/;

  function keepOutfit(text) {
    if (!keepR6() || Date.now() < wantR15Until || serverType !== 'R6' || typeof text !== 'string' || !text.includes('R15')) return text;
    try {
      const data = JSON.parse(text);
      let hit = false;
      const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || depth > 6) return;
        if (o.playerAvatarType === 'R15') { o.playerAvatarType = 'R6'; hit = true; }
        for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
      };
      walk(data, 0);
      return hit ? JSON.stringify(data) : text;
    } catch {
      return text;
    }
  }

  const textDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
  const respDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');

  function watchOutfit(xhr) {
    Object.defineProperty(xhr, 'responseText', {
      configurable: true,
      get() { return keepOutfit(textDesc.get.call(xhr)); },
    });
    Object.defineProperty(xhr, 'response', {
      configurable: true,
      get() {
        const r = respDesc.get.call(xhr);
        if (typeof r === 'string') return keepOutfit(r);
        if (r && typeof r === 'object' && xhr.responseType === 'json') {
          try {
            const raw = JSON.stringify(r);
            const out = keepOutfit(raw);
            return out === raw ? r : JSON.parse(out);
          } catch {
            return r;
          }
        }
        return r;
      },
    });
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__routilityUrl = url;
    this.__routilyMethod = String(method || 'GET').toUpperCase();
    if (this.__routilyMethod === 'GET' && OUTFIT_URL.test(String(url))) watchOutfit(this);
    return xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__routilyMethod === 'GET' && READ_URL.test(String(this.__routilityUrl))) {
      this.addEventListener('load', () => {
        try { learn(this.__routilityUrl, typeof this.response === 'string' ? this.response : JSON.stringify(this.response)); } catch {}
      });
    }
    return xhrSend.call(this, keepMeta(this.__routilityUrl, keepBody(this.__routilityUrl, body)));
  };
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input && input.url;
      if (init && typeof init.body === 'string') {
        const body = keepMeta(url, keepBody(url, init.body));
        if (body !== init.body) init = { ...init, body };
      }
    } catch {}
    const job = origFetch.call(this, input, init);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method === 'GET' && READ_URL.test(String(url))) job.then(res => res.clone().text().then(t => learn(url, t))).catch(() => {});
    if (method === 'GET' && OUTFIT_URL.test(String(url))) {
      return job.then(res => res.clone().text().then((t) => {
        const out = keepOutfit(t);
        return out === t ? res : new Response(out, { status: res.status, statusText: res.statusText, headers: res.headers });
      }).catch(() => res));
    }
    return job;
  };

  function wrapLayered(original) {
    if (typeof original !== 'function' || original.__routility) return original;
    const wrapped = function (typeId, ...rest) {
      if (keepR6() && Number(typeId) === DYNAMIC_HEAD) return false;
      return original.call(this, typeId, ...rest);
    };
    wrapped.__routility = true;
    return wrapped;
  }

  function wrapAdd(original) {
    if (typeof original !== 'function' || original.__routility) return original;
    const wrapped = function (asset, current, ...rest) {
      const result = original.call(this, asset, current, ...rest);
      if (!enabled() || !Array.isArray(result) || !Array.isArray(current) || !asset) return result;
      const out = [];
      let left = MAX;
      for (const a of [asset, ...current]) {
        if (!a || out.includes(a)) continue;
        if (RIGID.has(a.assetType && a.assetType.id)) {
          if (left > 0) {
            out.push(a);
            left--;
          }
        } else if (result.includes(a)) {
          out.push(a);
        }
      }
      return out;
    };
    wrapped.__routility = true;
    root.dataset.routilityAvHook = '1';
    return wrapped;
  }

  function wrapLimit(original) {
    if (typeof original !== 'function' || original.__routility) return original;
    const wrapped = function (typeId, ...rest) {
      if (enabled() && RIGID.has(Number(typeId))) return undefined;
      return original.call(this, typeId, ...rest);
    };
    wrapped.__routility = true;
    return wrapped;
  }

  const define = Object.defineProperty;
  Object.defineProperty = function (obj, key, desc) {
    try {
      if (key === 'addAssetToAvatar' && obj && obj.__esModule && desc && typeof desc.get === 'function') {
        const value = wrapAdd(desc.get.call(obj));
        desc = { enumerable: true, configurable: true, value };
      } else if (key === 'isLayeredClothing' && obj && obj.__esModule && desc && typeof desc.get === 'function') {
        const value = wrapLayered(desc.get.call(obj));
        desc = { enumerable: true, configurable: true, value };
      }
    } catch {}
    return define.call(this, obj, key, desc);
  };

  function whenSet(obj, key, cb) {
    if (obj[key]) return cb(obj[key]);
    let value;
    define(obj, key, {
      configurable: true,
      enumerable: true,
      get() { return value; },
      set(v) {
        value = v;
        define(obj, key, { configurable: true, enumerable: true, writable: true, value: v });
        cb(v);
      },
    });
  }

  function patchService(service) {
    if (!service || service.__routility) return;
    service.__routility = true;
    for (const [key, wrap] of [['addAssetToAvatar', wrapAdd], ['getAdvancedAccessoryLimit', wrapLimit]]) {
      if (typeof service[key] === 'function') service[key] = wrap(service[key]);
      else whenSet(service, key, (fn) => { service[key] = wrap(fn); });
    }
  }

  whenSet(window, 'Roblox', (Roblox) => {
    whenSet(Roblox, 'AvatarAccoutrementService', patchService);
  });
})();
