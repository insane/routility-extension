(function () {
  'use strict';

  const ascii = new TextDecoder('ascii');
  const utf8 = new TextDecoder('utf-8');

  function fits(dv, p, count, size) {
    if (!(count >= 0) || count > 4000000 || p + count * size > dv.byteLength) throw new Error('bad mesh');
  }

  function readVerts(dv, p, count, stride) {
    fits(dv, p, count, stride);
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const col = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      const o = p + i * stride;
      pos[i * 3] = dv.getFloat32(o, true);
      pos[i * 3 + 1] = dv.getFloat32(o + 4, true);
      pos[i * 3 + 2] = dv.getFloat32(o + 8, true);
      nrm[i * 3] = dv.getFloat32(o + 12, true);
      nrm[i * 3 + 1] = dv.getFloat32(o + 16, true);
      nrm[i * 3 + 2] = dv.getFloat32(o + 20, true);
      uv[i * 2] = dv.getFloat32(o + 24, true);
      uv[i * 2 + 1] = 1 - dv.getFloat32(o + 28, true);
      if (stride >= 40) {
        col[i * 4] = dv.getUint8(o + 36);
        col[i * 4 + 1] = dv.getUint8(o + 37);
        col[i * 4 + 2] = dv.getUint8(o + 38);
        col[i * 4 + 3] = dv.getUint8(o + 39);
      } else {
        col.fill(255, i * 4, i * 4 + 4);
      }
    }
    return { pos, nrm, uv, col, end: p + count * stride };
  }

  function readFaces(dv, p, count) {
    fits(dv, p, count, 12);
    const idx = new Uint32Array(count * 3);
    for (let i = 0; i < count * 3; i++) idx[i] = dv.getUint32(p + i * 4, true);
    return { idx, end: p + count * 12 };
  }

  function readU32s(dv, p, count) {
    fits(dv, p, count, 4);
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = dv.getUint32(p + i * 4, true);
    return out;
  }

  function readSkin(dv, p, numVerts) {
    fits(dv, p, numVerts, 8);
    const sub = new Uint8Array(numVerts * 4);
    const w = new Uint8Array(numVerts * 4);
    for (let i = 0; i < numVerts; i++) {
      for (let k = 0; k < 4; k++) {
        sub[i * 4 + k] = dv.getUint8(p + i * 8 + k);
        w[i * 4 + k] = dv.getUint8(p + i * 8 + 4 + k);
      }
    }
    return { sub, w, end: p + numVerts * 8 };
  }

  function readBones(dv, p, count) {
    const bones = [];
    for (let i = 0; i < count; i++) {
      const o = p + i * 60;
      const m = [];
      for (let k = 0; k < 12; k++) m.push(dv.getFloat32(o + 12 + k * 4, true));
      bones.push({ nameIndex: dv.getUint32(o, true), parent: dv.getUint16(o + 4, true), lodParent: dv.getUint16(o + 6, true), rot: m.slice(0, 9), pos: m.slice(9, 12) });
    }
    return { bones, end: p + count * 60 };
  }

  function readSubsets(dv, p, count) {
    const subsets = [];
    for (let i = 0; i < count; i++) {
      const o = p + i * 72;
      const n = dv.getUint32(o + 16, true);
      const bones = [];
      for (let k = 0; k < 26; k++) bones.push(dv.getUint16(o + 20 + k * 2, true));
      subsets.push({ vertsBegin: dv.getUint32(o + 8, true), vertsLength: dv.getUint32(o + 12, true), bones: bones.slice(0, n) });
    }
    return { subsets, end: p + count * 72 };
  }

  function nameAt(bytes, start) {
    let end = start;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return utf8.decode(bytes.subarray(start, end));
  }

  function buildSkin(numVerts, skin, bones, names, subsets) {
    if (!skin || !bones.length) return null;
    const index = new Uint16Array(numVerts * 4);
    const weight = new Float32Array(numVerts * 4);
    for (const s of subsets) {
      for (let v = s.vertsBegin; v < s.vertsBegin + s.vertsLength && v < numVerts; v++) {
        let total = 0;
        for (let k = 0; k < 4; k++) total += skin.w[v * 4 + k];
        for (let k = 0; k < 4; k++) {
          const wv = skin.w[v * 4 + k];
          if (!wv) continue;
          index[v * 4 + k] = s.bones[skin.sub[v * 4 + k]] ?? 0;
          weight[v * 4 + k] = total ? wv / total : 0;
        }
      }
    }
    return {
      index,
      weight,
      bones: bones.map(b => ({ name: nameAt(names, b.nameIndex), parent: b.parent === 0xffff ? -1 : b.parent, rot: b.rot, pos: b.pos })),
    };
  }

  function mainFaces(idx, lods) {
    if (!lods || lods.length < 2) return idx;
    const start = lods[0] * 3;
    const end = Math.min(lods[1] * 3, idx.length);
    return end > start ? idx.subarray(start, end) : idx;
  }

  function parseText(text, version) {
    const lines = text.split('\n');
    const nums = (lines[2] || '').match(/-?[\d.eE+-]+/g) || [];
    const faces = Math.min(2000000, Math.max(0, Number(lines[1]) || 0));
    const count = faces * 3;
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const scale = version === '1.00' ? 0.5 : 1;
    for (let i = 0; i < count && i * 9 + 8 < nums.length; i++) {
      const b = i * 9;
      pos[i * 3] = nums[b] * scale;
      pos[i * 3 + 1] = nums[b + 1] * scale;
      pos[i * 3 + 2] = nums[b + 2] * scale;
      nrm[i * 3] = +nums[b + 3];
      nrm[i * 3 + 1] = +nums[b + 4];
      nrm[i * 3 + 2] = +nums[b + 5];
      uv[i * 2] = +nums[b + 6];
      uv[i * 2 + 1] = +nums[b + 7];
    }
    const idx = new Uint32Array(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    return { pos, nrm, uv, col: null, idx, skin: null };
  }

  async function parse(buffer, decodeDraco) {
    const bytes = new Uint8Array(buffer);
    const header = ascii.decode(bytes.subarray(0, 12));
    const m = header.match(/^version (\d\.\d\d)/);
    if (!m) throw new Error('not a mesh');
    const version = m[1];
    if (version.startsWith('1.')) return parseText(utf8.decode(bytes), version);
    const dv = new DataView(buffer);
    let p = 13;
    if (version.startsWith('2.') || version.startsWith('3.')) {
      const hsize = dv.getUint16(p, true);
      const vsize = dv.getUint8(p + 2);
      const lodCount = version.startsWith('3.') ? dv.getUint16(p + 6, true) : 0;
      const numVerts = dv.getUint32(p + hsize - 8, true);
      const numFaces = dv.getUint32(p + hsize - 4, true);
      p += hsize;
      const v = readVerts(dv, p, numVerts, vsize);
      const f = readFaces(dv, v.end, numFaces);
      const lods = lodCount ? readU32s(dv, f.end, lodCount) : null;
      return { pos: v.pos, nrm: v.nrm, uv: v.uv, col: v.col, idx: mainFaces(f.idx, lods), skin: null };
    }
    if (version.startsWith('4.') || version.startsWith('5.')) {
      const hsize = dv.getUint16(p, true);
      const numVerts = dv.getUint32(p + 4, true);
      const numFaces = dv.getUint32(p + 8, true);
      const lodCount = dv.getUint16(p + 12, true);
      const boneCount = dv.getUint16(p + 14, true);
      const namesSize = dv.getUint32(p + 16, true);
      const subsetCount = dv.getUint16(p + 20, true);
      p += hsize;
      const v = readVerts(dv, p, numVerts, 40);
      let at = v.end;
      let skin = null;
      if (boneCount) { skin = readSkin(dv, at, numVerts); at = skin.end; }
      const f = readFaces(dv, at, numFaces);
      at = f.end;
      const lods = readU32s(dv, at, lodCount);
      at += lodCount * 4;
      const b = readBones(dv, at, boneCount);
      at = b.end;
      const names = bytes.subarray(at, at + namesSize);
      at += namesSize;
      const s = readSubsets(dv, at, subsetCount);
      return { pos: v.pos, nrm: v.nrm, uv: v.uv, col: v.col, idx: mainFaces(f.idx, lods), skin: buildSkin(numVerts, skin, b.bones, names, s.subsets) };
    }
    const out = { pos: null, nrm: null, uv: null, col: null, idx: null, skin: null };
    let lods = null;
    let skinRaw = null;
    let bones = [];
    let names = new Uint8Array(0);
    let subsets = [];
    while (p + 16 <= bytes.length) {
      const type = ascii.decode(bytes.subarray(p, p + 8)).replace(/\0+$/, '');
      const cver = dv.getUint32(p + 8, true);
      const size = dv.getUint32(p + 12, true);
      const start = p + 16;
      if (type === 'COREMESH') {
        if (cver === 1) {
          const nv = dv.getUint32(start, true);
          const v = readVerts(dv, start + 4, nv, 40);
          const nf = dv.getUint32(v.end, true);
          const f = readFaces(dv, v.end + 4, nf);
          Object.assign(out, { pos: v.pos, nrm: v.nrm, uv: v.uv, col: v.col, idx: f.idx });
        } else if (cver === 2) {
          if (!decodeDraco) throw new Error('draco');
          const len = dv.getUint32(start, true);
          Object.assign(out, await decodeDraco(bytes.slice(start + 4, start + 4 + len)));
        }
      } else if (type === 'LODS') {
        const n = dv.getUint32(start + 3, true);
        lods = readU32s(dv, start + 7, n);
      } else if (type === 'SKINNING') {
        let at = start;
        const ns = dv.getUint32(at, true);
        skinRaw = readSkin(dv, at + 4, ns);
        at = skinRaw.end;
        const nb = dv.getUint32(at, true);
        const b = readBones(dv, at + 4, nb);
        bones = b.bones;
        at = b.end;
        const nsize = dv.getUint32(at, true);
        names = bytes.subarray(at + 4, at + 4 + nsize);
        at += 4 + nsize;
        const nsub = dv.getUint32(at, true);
        subsets = readSubsets(dv, at + 4, nsub).subsets;
      }
      p = start + size;
    }
    if (!out.pos) throw new Error('no geometry');
    out.idx = mainFaces(out.idx, lods);
    out.skin = buildSkin(out.pos.length / 3, skinRaw, bones, names, subsets);
    return out;
  }

  window.RoUtilityMesh = { parse };
})();
