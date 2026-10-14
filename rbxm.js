(function () {
  'use strict';

  const SPECIAL = {
    0x02: [0, 0, 0], 0x03: [90, 0, 0], 0x05: [0, 180, 180], 0x06: [-90, 0, 0], 0x07: [0, 180, 90], 0x09: [0, 90, 90],
    0x0a: [0, 0, 90], 0x0c: [0, -90, 90], 0x0d: [-90, -90, 0], 0x0e: [0, -90, 0], 0x10: [90, -90, 0], 0x11: [0, 90, 180],
    0x14: [0, 180, 0], 0x15: [-90, -180, 0], 0x17: [0, 0, 180], 0x18: [90, 180, 0], 0x19: [0, 0, -90], 0x1b: [0, -90, -90],
    0x1c: [0, -180, -90], 0x1e: [0, 90, -90], 0x1f: [90, 90, 0], 0x20: [0, 90, 0], 0x22: [-90, 90, 0], 0x23: [0, -90, 180],
  };
  const utf8 = new TextDecoder('utf-8');

  class Unsupported extends Error {}

  function lz4(src, size) {
    if (!(size >= 0) || size > 128 * 1024 * 1024 || size > src.length * 255 + 64) throw new Error('bad lz4 size');
    const out = new Uint8Array(size);
    let i = 0;
    let o = 0;
    while (i < src.length) {
      const token = src[i++];
      let lit = token >> 4;
      if (lit === 15) { let b; do { b = src[i++]; lit += b; } while (b === 255); }
      out.set(src.subarray(i, i + lit), o);
      i += lit;
      o += lit;
      if (i >= src.length) break;
      const offset = src[i] | (src[i + 1] << 8);
      i += 2;
      let len = token & 15;
      if (len === 15) { let b; do { b = src[i++]; len += b; } while (b === 255); }
      len += 4;
      let from = o - offset;
      if (offset <= 0 || from < 0) throw new Error('bad lz4 offset');
      for (let k = 0; k < len; k++) out[o++] = out[from++];
    }
    return out;
  }

  class Reader {
    constructor(bytes) {
      this.b = bytes;
      this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.p = 0;
    }
    left() { return this.b.length - this.p; }
    u8() { return this.b[this.p++]; }
    u16() { const x = this.v.getUint16(this.p, true); this.p += 2; return x; }
    i16() { const x = this.v.getInt16(this.p, true); this.p += 2; return x; }
    u32() { const x = this.v.getUint32(this.p, true); this.p += 4; return x; }
    f32() { const x = this.v.getFloat32(this.p, true); this.p += 4; return x; }
    f64() { const x = this.v.getFloat64(this.p, true); this.p += 8; return x; }
    bytes(n) { const x = this.b.subarray(this.p, this.p + n); this.p += n; return x; }
    raw() { return this.bytes(this.u32()); }
    str() { return utf8.decode(this.raw()); }
    deinterleave(n, width) {
      const src = this.bytes(n * width);
      const out = new Uint8Array(n * width);
      for (let i = 0; i < n; i++) for (let b = 0; b < width; b++) out[i * width + b] = src[b * n + i];
      return out;
    }
    beU32s(n) {
      const d = this.deinterleave(n, 4);
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = ((d[i * 4] << 24) | (d[i * 4 + 1] << 16) | (d[i * 4 + 2] << 8) | d[i * 4 + 3]) >>> 0;
      return out;
    }
    ints(n) { return this.beU32s(n).map(x => (x >>> 1) ^ -(x & 1)); }
    floats(n) {
      const tmp = new DataView(new ArrayBuffer(4));
      return this.beU32s(n).map(x => {
        tmp.setUint32(0, ((x >>> 1) | ((x & 1) << 31)) >>> 0);
        return tmp.getFloat32(0);
      });
    }
    refs(n) {
      const r = this.ints(n);
      for (let i = 1; i < n; i++) r[i] += r[i - 1];
      return r;
    }
    int64s(n) {
      const d = this.deinterleave(n, 8);
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        let x = 0n;
        for (let b = 0; b < 8; b++) x = (x << 8n) | BigInt(d[i * 8 + b]);
        const v = (x >> 1n) ^ -(x & 1n);
        out[i] = v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
      }
      return out;
    }
  }

  function round(n) {
    return Math.abs(n) < 1e-6 ? 0 : Math.round(n * 1000) / 1000;
  }

  function fromOrientation(deg) {
    const [x, y, z] = deg.map(d => d * Math.PI / 180);
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return [
      cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
      cx * sz, cx * cz, -sx,
      -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
    ];
  }

  function orientation(m) {
    const d = (r) => round(r * 180 / Math.PI);
    const x = Math.asin(Math.max(-1, Math.min(1, -m[5])));
    return [d(x), d(Math.atan2(m[2], m[8])), d(Math.atan2(m[3], m[4]))];
  }

  function readValues(r, type, n, ctx) {
    const many = (fn) => Array.from({ length: n }, fn);
    switch (type) {
      case 0x01: case 0x1d: return many(() => {
        const b = r.raw();
        const text = utf8.decode(b);
        return /[\u0000-\u0008\u000e-\u001f�]/.test(text) ? { kind: 'binary', size: b.length, bytes: b.slice(), text: type === 0x1d ? text : undefined } : { kind: 'string', value: text };
      });
      case 0x02: return many(() => ({ kind: 'bool', value: r.u8() !== 0 }));
      case 0x03: return r.ints(n).map(v => ({ kind: 'number', value: v }));
      case 0x04: return r.floats(n).map(v => ({ kind: 'number', value: round(v) }));
      case 0x05: return many(() => ({ kind: 'number', value: round(r.f64()) }));
      case 0x06: { const s = r.floats(n); const o = r.ints(n); return s.map((v, i) => ({ kind: 'tuple', value: [round(v), o[i]] })); }
      case 0x07: { const sx = r.floats(n), sy = r.floats(n), ox = r.ints(n), oy = r.ints(n); return sx.map((v, i) => ({ kind: 'udim2', value: [round(v), ox[i], round(sy[i]), oy[i]] })); }
      case 0x08: return many(() => ({ kind: 'tuple', value: [r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32()].map(round) }));
      case 0x09: case 0x0a: return many(() => ({ kind: 'number', value: r.u8() }));
      case 0x0b: return r.beU32s(n).map(v => ({ kind: 'number', value: v }));
      case 0x0c: { const a = r.floats(n), b = r.floats(n), c = r.floats(n); return a.map((v, i) => ({ kind: 'color', value: [v, b[i], c[i]] })); }
      case 0x0d: { const a = r.floats(n), b = r.floats(n); return a.map((v, i) => ({ kind: 'tuple', value: [round(v), round(b[i])] })); }
      case 0x0e: { const a = r.floats(n), b = r.floats(n), c = r.floats(n); return a.map((v, i) => ({ kind: 'tuple', value: [round(v), round(b[i]), round(c[i])], raw: [v, b[i], c[i]] })); }
      case 0x10: case 0x1e: {
        if (type === 0x1e && r.u8() !== 0x10) throw new Unsupported();
        const mats = many(() => {
          const id = r.u8();
          if (id === 0) return Array.from({ length: 9 }, () => r.f32());
          return fromOrientation(SPECIAL[id] || [0, 0, 0]);
        });
        const rots = mats.map(orientation);
        const a = r.floats(n), b = r.floats(n), c = r.floats(n);
        let has = null;
        if (type === 0x1e) { if (r.u8() !== 0x02) throw new Unsupported(); has = many(() => r.u8() !== 0); }
        return rots.map((rot, i) => has && !has[i] ? { kind: 'none' } : { kind: 'cframe', pos: [round(a[i]), round(b[i]), round(c[i])], rot, mat: mats[i], raw: [a[i], b[i], c[i]] });
      }
      case 0x12: return r.beU32s(n).map(v => ({ kind: 'enum', value: v }));
      case 0x13: return r.refs(n).map(v => ({ kind: 'ref', value: v }));
      case 0x14: return many(() => ({ kind: 'tuple', value: [r.i16(), r.i16(), r.i16()] }));
      case 0x15: return many(() => ({ kind: 'sequence', count: Array.from({ length: r.u32() }, () => [r.f32(), r.f32(), r.f32()]).length }));
      case 0x16: return many(() => ({ kind: 'sequence', count: Array.from({ length: r.u32() }, () => [r.f32(), r.f32(), r.f32(), r.f32(), r.f32()]).length }));
      case 0x17: return many(() => ({ kind: 'tuple', value: [round(r.f32()), round(r.f32())] }));
      case 0x18: { const a = r.floats(n), b = r.floats(n), c = r.floats(n), d = r.floats(n); return a.map((v, i) => ({ kind: 'tuple', value: [round(v), round(b[i]), round(c[i]), round(d[i])] })); }
      case 0x19: return many(() => {
        const flag = r.u8();
        if (!(flag & 1)) return { kind: 'string', value: 'Default' };
        const vals = [r.f32(), r.f32(), r.f32(), r.f32(), r.f32()];
        if (flag & 2) vals.push(r.f32());
        return { kind: 'tuple', value: vals.map(round) };
      });
      case 0x1a: { const a = r.bytes(n), b = r.bytes(n), c = r.bytes(n); return Array.from(a, (v, i) => ({ kind: 'color', value: [v / 255, b[i] / 255, c[i] / 255] })); }
      case 0x1b: return r.int64s(n).map(v => ({ kind: 'number', value: v }));
      case 0x1c: return r.beU32s(n).map(i => ({ kind: 'shared', size: ctx.shared[i] ? ctx.shared[i].length : 0 }));
      case 0x20: return many(() => {
        const family = r.str();
        const weight = r.u16();
        const style = r.u8();
        r.str();
        return { kind: 'string', value: `${family} (${weight}${style ? ', italic' : ''})` };
      });
      case 0x22: {
        const types = r.beU32s(n);
        const uris = Array.from({ length: r.u32() }, () => r.str());
        const objs = r.refs(r.u32());
        r.refs(r.u32());
        let u = 0;
        let ob = 0;
        return types.map(t => t === 1 ? { kind: 'string', value: uris[u++] || '' } : t === 2 ? { kind: 'ref', value: objs[ob++] } : { kind: 'none' });
      }
      default: throw new Unsupported();
    }
  }

  function parseBinary(bytes) {
    const head = new Reader(bytes);
    head.p = 32;
    const classes = new Map();
    const byRef = new Map();
    const ctx = { shared: [] };
    const props = [];
    let parents = null;
    const meta = {};
    while (head.left() >= 16) {
      const name = utf8.decode(head.bytes(4)).replace(/\0+$/, '');
      const clen = head.u32();
      const len = head.u32();
      head.p += 4;
      const body = head.bytes(clen || len);
      if (name === 'END') break;
      let data;
      if (!clen) data = body;
      else if (body[0] === 0x28 && body[1] === 0xb5 && body[2] === 0x2f && body[3] === 0xfd) throw new Unsupported('zstd');
      else data = lz4(body, len);
      const r = new Reader(data);
      if (name === 'META') {
        const count = r.u32();
        for (let i = 0; i < count; i++) meta[r.str()] = r.str();
      } else if (name === 'SSTR') {
        r.u32();
        const count = r.u32();
        for (let i = 0; i < count; i++) { r.bytes(16); ctx.shared.push(r.raw()); }
      } else if (name === 'INST') {
        const id = r.u32();
        const className = r.str();
        r.u8();
        const count = r.u32();
        const refs = r.refs(count);
        classes.set(id, { className, refs });
        for (const ref of refs) byRef.set(ref, { ref, className, name: className, props: [], children: [] });
      } else if (name === 'PROP') {
        props.push(data);
      } else if (name === 'PRNT') {
        r.u8();
        const count = r.u32();
        parents = { child: r.refs(count), parent: r.refs(count) };
      }
    }
    for (const data of props) {
      const r = new Reader(data);
      const cls = classes.get(r.u32());
      const propName = r.str();
      const type = r.u8();
      if (!cls) continue;
      let values;
      try {
        values = readValues(r, type, cls.refs.length, ctx);
      } catch (e) {
        if (!(e instanceof Unsupported) && !(e instanceof RangeError)) throw e;
        values = cls.refs.map(() => ({ kind: 'unknown' }));
      }
      cls.refs.forEach((ref, i) => {
        const inst = byRef.get(ref);
        if (!inst) return;
        if (propName === 'Name' && values[i].kind === 'string') inst.name = values[i].value;
        else inst.props.push({ name: propName, ...values[i] });
      });
    }
    const roots = [];
    if (parents) {
      parents.child.forEach((c, i) => {
        const inst = byRef.get(c);
        const p = byRef.get(parents.parent[i]);
        if (!inst) return;
        if (p) p.children.push(inst);
        else roots.push(inst);
      });
    } else {
      roots.push(...byRef.values());
    }
    return { roots, byRef, meta };
  }

  function parseXml(text) {
    const clean = text.replace(/[^\u0009\u000a\u000d -퟿-�\ud800-􏰀-\udfff]/g, '');
    const doc = new DOMParser().parseFromString(clean, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('bad xml');
    const byRef = new Map();
    let next = 1;
    const refIds = new Map();
    const refOf = (key) => { if (!refIds.has(key)) refIds.set(key, next++); return refIds.get(key); };
    const num = (n, tag) => { const c = n.querySelector(':scope > ' + tag); return c ? round(Number(c.textContent)) : 0; };
    const value = (p) => {
      const t = p.tagName;
      const txt = p.textContent.trim();
      if (t === 'string' || t === 'ProtectedString') return { kind: 'string', value: p.textContent };
      if (t === 'bool') return { kind: 'bool', value: txt === 'true' };
      if (t === 'int' || t === 'int64' || t === 'float' || t === 'double' || t === 'BrickColor') return { kind: 'number', value: round(Number(txt)) };
      if (t === 'token') return { kind: 'enum', value: Number(txt) };
      if (t === 'Vector3' || t === 'Vector2') return { kind: 'tuple', value: ['X', 'Y', 'Z'].filter(k => p.querySelector(':scope > ' + k)).map(k => num(p, k)), raw: ['X', 'Y', 'Z'].filter(k => p.querySelector(':scope > ' + k)).map(k => Number(p.querySelector(':scope > ' + k).textContent)) };
      if (t === 'CoordinateFrame' || t === 'CFrame') {
        const raw = (k) => { const c = p.querySelector(':scope > ' + k); return c ? Number(c.textContent) : 0; };
        const m = ['R00', 'R01', 'R02', 'R10', 'R11', 'R12', 'R20', 'R21', 'R22'].map(raw);
        return { kind: 'cframe', pos: [num(p, 'X'), num(p, 'Y'), num(p, 'Z')], rot: orientation(m), mat: m, raw: [raw('X'), raw('Y'), raw('Z')] };
      }
      if (t === 'Color3') return p.querySelector(':scope > R') ? { kind: 'color', value: [num(p, 'R'), num(p, 'G'), num(p, 'B')] } : (() => { const v = Number(txt) >>> 0; return { kind: 'color', value: [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] }; })();
      if (t === 'Color3uint8') { const v = Number(txt) >>> 0; return { kind: 'color', value: [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] }; }
      if (t === 'Content') { const u = p.querySelector(':scope > url'); return u ? { kind: 'string', value: u.textContent.trim() } : { kind: 'none' }; }
      if (t === 'Ref') return txt && txt !== 'null' ? { kind: 'ref', value: refOf(txt) } : { kind: 'none' };
      if (t === 'BinaryString') return { kind: 'binary', size: Math.floor(txt.length * 3 / 4) };
      if (t === 'SharedString') return { kind: 'shared', size: 0 };
      return { kind: 'unknown' };
    };
    const walk = (item) => {
      const inst = { ref: refOf(item.getAttribute('referent') || 'x' + next), className: item.getAttribute('class') || 'Instance', props: [], children: [] };
      inst.name = inst.className;
      const props = item.querySelector(':scope > Properties');
      for (const p of props ? props.children : []) {
        const v = value(p);
        if (p.getAttribute('name') === 'Name' && v.kind === 'string') inst.name = v.value;
        else inst.props.push({ name: p.getAttribute('name'), ...v });
      }
      byRef.set(inst.ref, inst);
      for (const c of item.querySelectorAll(':scope > Item')) inst.children.push(walk(c));
      return inst;
    };
    const roots = [...doc.documentElement.querySelectorAll(':scope > Item')].map(walk);
    return { roots, byRef, meta: {} };
  }

  function parse(buffer) {
    const bytes = new Uint8Array(buffer);
    const magic = utf8.decode(bytes.subarray(0, 8));
    if (magic === '<roblox!') return parseBinary(bytes);
    const text = utf8.decode(bytes);
    if (text.includes('<roblox')) return parseXml(text);
    throw new Unsupported('format');
  }

  window.RoUtilityRbxm = { parse, Unsupported };
})();
