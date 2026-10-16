(function () {
  'use strict';

  const { el } = window.RoUtilityUI;
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]';
  const ACCESSORY = new Set([8, 41, 42, 43, 44, 45, 46, 47, 57, 58, 64, 65, 66, 67, 68, 69, 70, 71, 72]);
  const HEADS = new Set([17, 79]);
  const ALLOWED = new Set([2, 11, 12, 18, 19, 27, 28, 29, 30, 31, 78, ...ACCESSORY, ...HEADS]);
  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    hat: ['M4 15h16', 'M7 15c0-5 2-8 5-8s5 3 5 8', 'M3 15c0 1.5 4 3 9 3s9-1.5 9-3'],
    part: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
    mesh: ['M12 3l8 14H4z', 'M12 3l-3 14', 'M12 3l3 14', 'M6.5 12.5h11'],
    attachment: ['M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4'],
    weld: ['M9 15l6-6', 'M10.5 6.5l1.5-1.5a4 4 0 0 1 6 6l-1.5 1.5', 'M13.5 17.5l-1.5 1.5a4 4 0 0 1-6-6l1.5-1.5'],
    wrap: ['M12 4l8 4-8 4-8-4z', 'M4 12l8 4 8-4', 'M4 16l8 4 8-4'],
    image: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0'],
    shirt: ['M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z'],
    folder: ['M3 7h7l2 2h9v10H3z'],
    value: ['M5 5h14v14H5z', 'M9 9l3 6 3-6'],
    script: ['M7 3h7l4 4v14H7z', 'M14 3v4h4', 'M10 12h5', 'M10 16h5'],
    camera: ['M4 8h11v9H4z', 'M15 11l5-3v9l-5-3'],
    sound: ['M5 10h4l5-4v12l-5-4H5z', 'M17 9a4 4 0 0 1 0 6'],
    anim: ['M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0', 'M10 9l5 3-5 3z'],
    box: ['M5 5h14v14H5z'],
    sky: ['M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 11 3.5 3.5 0 0 0 7 18z'],
    light: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z'],
    effect: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M6 6l2.5 2.5', 'M15.5 15.5L18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5L6 18'],
    particle: ['M6 7h.01', 'M12 4h.01', 'M18 8h.01', 'M9 12h.01', 'M15 12h.01', 'M7 17h.01', 'M12 19h.01', 'M17 16h.01'],
    gui: ['M3 5h18v14H3z', 'M3 9h18'],
    text: ['M5 6h14', 'M12 6v13', 'M9 19h6'],
    layout: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
    humanoid: ['M12 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M5 21c1-4 4-6 7-6s6 2 7 6'],
    tool: ['M14.5 5.5l4 4', 'M4 20l9.5-9.5', 'M12.5 3.5l3-1 6 6-1 3-3 1-6-6z'],
    remote: ['M4 8h14l-3-3', 'M20 16H6l3 3'],
    prompt: ['M5 3l13 6-6 2-2 6z'],
    highlight: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4'],
    gear: ['M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M19.1 4.9L17 7', 'M7 17l-2.1 2.1'],
  };
  const COLORS = { hat: '#f2b134', part: '#5aa7ff', mesh: '#7fd3a1', attachment: '#ff8a5b', weld: '#c38bff', wrap: '#6cc3d6', image: '#e7a1ff', shirt: '#ffb0c8', folder: '#e3c16f', value: '#9aa7c7', script: '#8fd16a', camera: '#9fb4d9', sound: '#ffd166', anim: '#ff7aa8', box: '#a3a9b6', sky: '#8ec5ff', light: '#ffd166', effect: '#c9a7ff', particle: '#ff9f68', gui: '#7fc8ff', text: '#e8e8e8', layout: '#9fd8c0', humanoid: '#f2b134', tool: '#d0a070', remote: '#ffcf5a', prompt: '#b0e57c', highlight: '#ffd166', gear: '#9aa7c7' };
  const SURFACE = { 0: 'Smooth', 1: 'Glue', 2: 'Weld', 3: 'Studs', 4: 'Inlet', 5: 'Universal', 6: 'Hinge', 7: 'Motor', 8: 'SteppingMotor', 10: 'SmoothNoOutlines' };
  const INPUT = { 0: 'NoInput', 1: 'Constant', 2: 'Sin' };
  const ENUMS = {
    MeshType: { 0: 'Head', 1: 'Torso', 2: 'Wedge', 3: 'Sphere', 4: 'Cylinder', 5: 'FileMesh', 6: 'Brick', 7: 'Prism', 8: 'Pyramid', 9: 'ParallelRamp', 10: 'RightAngleRamp', 11: 'CornerWedge' },
    Material: { 256: 'Plastic', 272: 'SmoothPlastic', 288: 'Neon', 512: 'Wood', 528: 'WoodPlanks', 784: 'Marble', 788: 'Basalt', 800: 'Slate', 804: 'CrackedLava', 816: 'Concrete', 820: 'Limestone', 832: 'Granite', 836: 'Pavement', 848: 'Brick', 864: 'Pebble', 880: 'Cobblestone', 896: 'Rock', 912: 'Sandstone', 1040: 'CorrodedMetal', 1056: 'DiamondPlate', 1072: 'Foil', 1088: 'Metal', 1280: 'Grass', 1284: 'LeafyGrass', 1296: 'Sand', 1312: 'Fabric', 1328: 'Snow', 1344: 'Mud', 1360: 'Ground', 1376: 'Asphalt', 1392: 'Salt', 1536: 'Ice', 1552: 'Glacier', 1568: 'Glass', 1584: 'ForceField', 1792: 'Air', 2048: 'Water', 2304: 'Cardboard', 2305: 'Carpet', 2306: 'CeramicTiles', 2307: 'ClayRoofTiles', 2308: 'RoofShingles', 2309: 'Leather', 2310: 'Plaster', 2311: 'Rubber' },
    AccessoryType: { 0: 'Unknown', 1: 'Hat', 2: 'Hair', 3: 'Face', 4: 'Neck', 5: 'Shoulder', 6: 'Front', 7: 'Back', 8: 'Waist', 9: 'TShirt', 10: 'Shirt', 11: 'Pants', 12: 'Jacket', 13: 'Sweater', 14: 'Shorts', 15: 'LeftShoe', 16: 'RightShoe', 17: 'DressSkirt', 18: 'Eyebrow', 19: 'Eyelash' },
    RenderFidelity: { 0: 'Automatic', 1: 'Precise', 2: 'Performance' },
    CollisionFidelity: { 0: 'Default', 1: 'Hull', 2: 'Box', 3: 'PreciseConvexDecomposition' },
    FluidFidelity: { 0: 'Automatic', 1: 'UseCollisionGeometry', 2: 'UsePreciseGeometry' },
    Shape: { 0: 'Ball', 1: 'Block', 2: 'Cylinder', 3: 'Wedge', 4: 'CornerWedge' },
    Order: { 0: 'Inner', 1: 'Outer' },
    CameraType: { 0: 'Fixed', 1: 'Attach', 2: 'Watch', 3: 'Track', 4: 'Follow', 5: 'Custom', 6: 'Scriptable', 7: 'Orbital' },
    FieldOfViewMode: { 0: 'Vertical', 1: 'Diagonal', 2: 'MaxAxis' },
    Face: { 0: 'Right', 1: 'Top', 2: 'Back', 3: 'Left', 4: 'Bottom', 5: 'Front' },
    BodyPart: { 0: 'Head', 1: 'Torso', 2: 'LeftArm', 3: 'RightArm', 4: 'LeftLeg', 5: 'RightLeg' },
    AlphaMode: { 0: 'Overlay', 1: 'Transparency', 2: 'TintMask' },
  };
  const HIDDEN = new Set(['AttributesSerialize', 'SourceAssetId', 'HistoryId', 'UniqueId', 'DefinesCapabilities', 'Capabilities', 'AeroMeshData', 'PhysicsData', 'PhysicalConfigData', 'ModelMeshData', 'ModelMeshCFrame', 'ModelMeshSize', 'CollisionGroupId', 'ScriptGuid', 'MeshID', 'FormFactor', 'formFactorRaw', 'BrickColor', 'Source']);
  const ALIAS = { size: 'Size', Color3uint8: 'Color', shape: 'Shape', MaterialVariantSerialized: 'MaterialVariant', Health_XML: 'Health' };
  let st = null;

  function enumName(prop, value) {
    const table = ENUMS[prop] || (/Surface$/.test(prop) ? SURFACE : /SurfaceInput$/.test(prop) ? INPUT : null);
    return table && table[value] != null ? table[value] : null;
  }

  function iconFor(cls) {
    if (/^(Sky|Atmosphere|Clouds)$/.test(cls)) return 'sky';
    if (/^(Highlight|SelectionBox|SelectionSphere)$|HandleAdornment$/.test(cls)) return 'highlight';
    if (/^(PointLight|SpotLight|SurfaceLight)$/.test(cls)) return 'light';
    if (/^(Bloom|Blur|ColorCorrection|SunRays|DepthOfField)Effect$|^ColorGradingEffect$/.test(cls)) return 'effect';
    if (/^(ParticleEmitter|Fire|Smoke|Sparkles|Beam|Trail|Explosion)$/.test(cls)) return 'particle';
    if (/^(ScreenGui|SurfaceGui|BillboardGui|Frame|ScrollingFrame|CanvasGroup|ViewportFrame|VideoFrame)$/.test(cls)) return 'gui';
    if (/^Text(Label|Button|Box)$/.test(cls)) return 'text';
    if (/^UI[A-Z]/.test(cls)) return 'layout';
    if (/^Humanoid/.test(cls)) return 'humanoid';
    if (/^(Tool|HopperBin)$/.test(cls)) return 'tool';
    if (/^(Remote|Bindable|UnreliableRemote)(Event|Function)$/.test(cls)) return 'remote';
    if (/^(ProximityPrompt|ClickDetector|DragDetector)$/.test(cls)) return 'prompt';
    if (cls === 'Configuration') return 'gear';
    if (/^(Accessory|Hat|Accoutrement)$/.test(cls)) return 'hat';
    if (/^(Part|MeshPart|UnionOperation|TrussPart|WedgePart|CornerWedgePart|BasePart)$/.test(cls)) return 'part';
    if (/Mesh$/.test(cls)) return 'mesh';
    if (/^Attachment$|^Bone$/.test(cls)) return 'attachment';
    if (/Weld|Motor6D|Constraint/.test(cls)) return 'weld';
    if (/^Wrap(Layer|Target)$/.test(cls)) return 'wrap';
    if (/^(Decal|Texture|SurfaceAppearance|ImageLabel)$/.test(cls)) return 'image';
    if (/^(Shirt|Pants|ShirtGraphic|CharacterMesh)$/.test(cls)) return 'shirt';
    if (/^(Folder|Model)$/.test(cls)) return 'folder';
    if (/Value$/.test(cls)) return 'value';
    if (/Script$/.test(cls)) return 'script';
    if (cls === 'Camera') return 'camera';
    if (cls === 'Sound') return 'sound';
    if (/^(Animation|KeyframeSequence|Keyframe|Pose|AnimationController)$/.test(cls)) return 'anim';
    return 'box';
  }

  function svg(paths, color, size) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(size || 16));
    s.setAttribute('height', String(size || 16));
    s.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color || 'currentColor');
      p.setAttribute('stroke-width', size >= 20 ? '1.6' : '2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      s.appendChild(p);
    }
    return s;
  }

  function classIcon(cls) {
    const key = iconFor(cls);
    const box = el('span', 'routility-rx-icon');
    box.appendChild(svg(ICONS[key], COLORS[key], 16));
    return box;
  }

  function request(msg) {
    return window.RoUtilityUI.request(msg, r => r && typeof r.status === 'number');
  }

  function variantsFor(type) {
    if (ACCESSORY.has(type)) return [{ label: 'SpecialMesh', format: '' }, { label: 'MeshPart', format: 'avatar_meshpart_accessory' }];
    if (HEADS.has(type)) return [{ label: 'MeshPart', format: 'avatar_meshpart_head' }, { label: LT('Classic'), format: '' }];
    return [{ label: LT('Model'), format: '' }];
  }

  async function loadVariant(s, v) {
    if (v.result) return v.result;
    if (!v.job) {
      v.job = (async () => {
        const res = await request({ type: 'assetFile', id: v.id || s.itemId, format: v.format });
        if (res && (res.status === 409 || res.status === 403)) return { error: LT('Roblox doesn’t share this item’s file.') };
        if (!res || res.status !== 200) return { error: LT('Couldn’t load the file right now.'), retry: true };
        let buf;
        try {
          const r = await fetch(res.location);
          if (!r.ok) throw new Error();
          const total = Number(r.headers.get('content-length')) || 0;
          if (r.body && total && v.onProgress) {
            const reader = r.body.getReader();
            const parts = [];
            let got = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              parts.push(value);
              got += value.length;
              v.onProgress(Math.min(0.9, (got / total) * 0.9));
            }
            const all = new Uint8Array(got);
            let at = 0;
            for (const part of parts) { all.set(part, at); at += part.length; }
            buf = all.buffer;
          } else {
            buf = await r.arrayBuffer();
          }
        } catch {
          return { error: LT('Couldn’t download the file right now.'), retry: true };
        }
        try {
          return { model: window.RoUtilityRbxm.parse(buf), bytes: buf };
        } catch (e) {
          return { error: e instanceof window.RoUtilityRbxm.Unsupported ? LT('This file uses a format RoUtility can’t read yet.') : LT('Couldn’t read this file.'), bytes: buf };
        }
      })();
    }
    const result = await v.job;
    if (result.retry) v.job = null;
    else v.result = result;
    return result;
  }

  function assetId(text) {
    const m = String(text).match(/^(?:rbxassetid:\/\/|https?:\/\/(?:www\.)?roblox\.com\/asset\/?\?id=)(\d+)\s*$/i);
    return m ? m[1] : null;
  }

  function fmt(n) {
    return typeof n === 'number' ? String(n) : String(n);
  }

  function valueNode(p, model) {
    const box = el('span', 'routility-rx-val');
    if (p.kind === 'string') {
      const id = assetId(p.value.trim());
      if (id) {
        const a = el('a', 'routility-rx-link', 'rbxassetid://' + id);
        a.href = `https://www.roblox.com/library/${id}`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.dataset.rtTip = lt('Open asset {id}', { id });
        box.appendChild(a);
      } else {
        box.textContent = p.value;
        box.dataset.rtTip = p.value.length > 40 ? p.value.slice(0, 300) : '';
        if (!box.dataset.rtTip) delete box.dataset.rtTip;
      }
    } else if (p.kind === 'bool') {
      const c = el('span', 'routility-rx-check' + (p.value ? ' routility-rx-on' : ''));
      if (p.value) c.appendChild(svg(['M5 12l4 4 10-10'], 'currentColor', 12));
      box.appendChild(c);
    } else if (p.kind === 'enum') {
      const nm = enumName(p.name, p.value);
      box.textContent = nm || fmt(p.value);
      if (nm) box.dataset.rtTip = lt('Enum value {value}', { value: p.value });
    } else if (p.kind === 'number') {
      box.textContent = fmt(p.value);
    } else if (p.kind === 'tuple') {
      box.textContent = p.value.join(', ');
    } else if (p.kind === 'udim2') {
      box.textContent = `{${p.value[0]}, ${p.value[1]}}, {${p.value[2]}, ${p.value[3]}}`;
    } else if (p.kind === 'cframe') {
      box.textContent = `${p.pos.join(', ')}  ·  ${p.rot.map(x => x + '°').join(', ')}`;
      box.dataset.rtTip = lt('Position, then orientation');
    } else if (p.kind === 'color') {
      const rgb = p.value.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255));
      const sw = el('span', 'routility-rx-swatch');
      sw.style.background = `rgb(${rgb.join(',')})`;
      box.append(sw, document.createTextNode(rgb.join(', ')));
    } else if (p.kind === 'ref') {
      const t = model.byRef.get(p.value);
      box.textContent = t ? t.name : 'nil';
      if (!t) box.classList.add('content-muted');
    } else if (p.kind === 'binary' || p.kind === 'shared') {
      box.textContent = p.size ? ltn(p.size, 'Binary data ({size} byte)', 'Binary data ({size} bytes)', { size: p.size.toLocaleString() }) : lt('Binary data');
      box.classList.add('content-muted');
    } else if (p.kind === 'sequence') {
      box.textContent = ltn(p.count, '{n} keypoint', '{n} keypoints');
      box.classList.add('content-muted');
    } else {
      box.textContent = '—';
      box.classList.add('content-muted');
    }
    return box;
  }

  function sourceView(pane, info) {
    const box = el('div', 'routility-rx-source');
    if (info.findings.length) {
      const list = el('div', 'routility-rx-findings');
      for (const f of info.findings) {
        const row = el('button', 'routility-rx-finding routility-rx-' + f.level);
        row.type = 'button';
        row.append(el('span', 'routility-rx-dot'), el('span', 'routility-rx-finding-label', lt(f.label)));
        if (f.lines.length) row.appendChild(el('span', 'routility-rx-finding-lines', ltn(f.lines.length, 'Line {lines}', 'Lines {lines}', { lines: f.lines.slice(0, 4).join(', ') + (f.lines.length > 4 ? '…' : '') })));
        row.addEventListener('click', () => {
          const ln = f.lines[0] && box.querySelector(`[data-line="${f.lines[0]}"]`);
          if (ln) ln.scrollIntoView({ block: 'center' });
        });
        list.appendChild(row);
      }
      box.appendChild(list);
    } else {
      box.appendChild(el('div', 'routility-rx-clean text-body-small', info.source ? lt('Nothing suspicious found in this script.') : lt('This script is empty.')));
    }
    if (info.source) {
      const marks = new Map();
      for (const f of info.findings) for (const n of f.lines) if (!marks.has(n) || f.level === 'high') marks.set(n, f.level);
      const code = el('div', 'routility-rx-code');
      const lines = info.source.split(/\r?\n/);
      const max = Math.min(lines.length, 4000);
      for (let i = 0; i < max; i++) {
        const row = el('div', 'routility-rx-ln' + (marks.has(i + 1) ? ' routility-rx-ln-' + marks.get(i + 1) : ''));
        row.dataset.line = String(i + 1);
        row.append(el('span', 'routility-rx-no', String(i + 1)), el('span', 'routility-rx-src', lines[i].length > 600 ? lines[i].slice(0, 600) + ' …' : lines[i]));
        code.appendChild(row);
      }
      if (lines.length > max) code.appendChild(el('div', 'routility-rx-more text-body-small', ltn(lines.length - max, '{count} more line. Download the file to see all of it.', '{count} more lines. Download the file to see all of it.', { count: (lines.length - max).toLocaleString() })));
      box.appendChild(code);
    }
    pane.appendChild(box);
  }

  function renderProps(pane, inst, model, scan) {
    pane.textContent = '';
    const head = el('div', 'routility-rx-pane-head');
    head.appendChild(el('span', 'text-label-medium content-emphasis', lt('Properties')));
    head.appendChild(el('span', 'text-body-small content-muted routility-rx-sub', inst ? lt('{class} “{name}”', { class: inst.className, name: inst.name }) : ''));
    pane.appendChild(head);
    const info = inst && scan && scan.byInst.get(inst);
    if (info) sourceView(pane, info);
    const filter = el('input', 'routility-rx-filter');
    filter.type = 'search';
    filter.placeholder = lt('Filter Properties');
    filter.value = pane.dataset.q || '';
    pane.appendChild(filter);
    const list = el('div', 'routility-rx-props');
    if (inst) {
      const rows = [{ name: 'ClassName', kind: 'string', value: inst.className }, { name: 'Name', kind: 'string', value: inst.name }, ...inst.props.filter(p => p.kind !== 'unknown' && !HIDDEN.has(p.name)).map(p => ALIAS[p.name] ? { ...p, name: ALIAS[p.name] } : p).sort((a, b) => a.name.localeCompare(b.name))];
      for (const p of rows) {
        const row = el('div', 'routility-rx-prop');
        row.dataset.key = p.name.toLowerCase();
        row.appendChild(el('span', 'routility-rx-key text-body-small', p.name));
        row.appendChild(valueNode(p, model));
        list.appendChild(row);
      }
    }
    pane.appendChild(list);
    const apply = () => {
      const q = filter.value.trim().toLowerCase();
      pane.dataset.q = filter.value;
      for (const row of list.children) row.hidden = !!q && !row.dataset.key.includes(q);
    };
    filter.addEventListener('input', apply);
    apply();
  }

  function renderTree(treeList, propsPane, model, scan, focusFlag) {
    treeList.textContent = '';
    let selected = null;
    let flaggedRow = null;
    const select = (row, inst) => {
      selected?.classList.remove('routility-rx-selected');
      selected = row;
      row.classList.add('routility-rx-selected');
      renderProps(propsPane, inst, model, scan);
    };
    const add = (inst, depth, parent) => {
      const li = el('li', 'routility-rx-node');
      li.dataset.text = (inst.name + ' ' + inst.className).toLowerCase();
      const row = el('button', 'routility-rx-row relative clip group/interactable');
      row.type = 'button';
      row.style.paddingLeft = (8 + depth * 18) + 'px';
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      const caret = el('span', 'routility-rx-caret' + (inst.children.length ? '' : ' routility-rx-leaf'));
      if (inst.children.length) caret.appendChild(svg(['M9 6l6 6-6 6'], 'currentColor', 12));
      row.append(layer, caret, classIcon(inst.className), el('span', 'routility-rx-name text-body-small content-emphasis', inst.name));
      const info = scan && scan.byInst.get(inst);
      if (info && info.level && info.level !== 'low') {
        row.appendChild(el('span', 'routility-rx-dot routility-rx-' + info.level));
        if (!flaggedRow || (info.level === 'high' && flaggedRow.level !== 'high')) flaggedRow = { row, inst, level: info.level };
      }
      li.appendChild(row);
      const kids = el('ul', 'routility-rx-kids');
      li.appendChild(kids);
      if (inst.children.length) li.classList.add('routility-rx-open');
      row.addEventListener('click', (e) => {
        if (e.target.closest('.routility-rx-caret') && inst.children.length) li.classList.toggle('routility-rx-open');
        select(row, inst);
      });
      row.addEventListener('dblclick', () => { if (inst.children.length) li.classList.toggle('routility-rx-open'); });
      parent.appendChild(li);
      for (const c of inst.children) add(c, depth + 1, kids);
      return row;
    };
    let first = null;
    for (const r of model.roots) {
      const row = add(r, 0, treeList);
      if (!first) first = { row, inst: r };
    }
    if (focusFlag && flaggedRow) {
      select(flaggedRow.row, flaggedRow.inst);
      flaggedRow.row.scrollIntoView({ block: 'center' });
    } else if (first) select(first.row, first.inst);
    else renderProps(propsPane, null, model, scan);
  }

  function open(s) {
    document.querySelector('.routility-rx-backdrop')?.remove();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-rx-backdrop');
    const modal = el('div', 'routility-modal routility-rx');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head routility-rx-head');
    const title = el('div', 'routility-rx-title');
    title.appendChild(el('h2', 'routility-modal-title', lt('Explorer')));
    title.appendChild(el('span', 'text-body-medium content-muted routility-rx-item', s.name));
    const summary = el('span', 'routility-rx-summary');
    title.appendChild(summary);
    const tabs = el('div', 'routility-rx-tabs');
    const download = el('button', 'foundation-web-button relative clip group/interactable cursor-pointer flex items-center justify-center gap-small stroke-none padding-y-none select-none radius-medium text-label-medium height-800 padding-x-medium bg-action-standard content-action-standard routility-rx-download');
    download.type = 'button';
    const dlLayer = el('div', STATE_LAYER);
    dlLayer.setAttribute('aria-hidden', 'true');
    download.append(dlLayer, svg(['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'], 'currentColor', 16), el('span', 'padding-y-xsmall text-no-wrap', lt('Download')));
    download.disabled = true;
    const close = el('button', 'routility-modal-icon routility-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', lt('Close'));
    close.appendChild(svg(['M6 6l12 12', 'M18 6L6 18'], 'currentColor', 20));
    head.append(title, tabs, download, close);
    const body = el('div', 'routility-rx-body');
    const treePane = el('div', 'routility-rx-pane routility-rx-tree');
    const treeHead = el('div', 'routility-rx-pane-head');
    treeHead.appendChild(el('span', 'text-label-medium content-emphasis', lt('Explorer')));
    const treeFilter = el('input', 'routility-rx-filter');
    treeFilter.type = 'search';
    treeFilter.placeholder = lt('Filter Explorer');
    const treeList = el('ul', 'routility-rx-list');
    treePane.append(treeHead, treeFilter, treeList);
    const filterTree = () => {
      const q = treeFilter.value.trim().toLowerCase();
      const walk = (li) => {
        const kids = [...li.querySelectorAll(':scope > .routility-rx-kids > .routility-rx-node')].map(walk);
        const hit = !q || li.dataset.text.includes(q) || kids.some(Boolean);
        li.hidden = !hit;
        if (q && kids.some(Boolean)) li.classList.add('routility-rx-open');
        return hit;
      };
      treeList.querySelectorAll(':scope > .routility-rx-node').forEach(walk);
    };
    treeFilter.addEventListener('input', filterTree);
    const propsPane = el('div', 'routility-rx-pane routility-rx-propspane');
    body.append(treePane, propsPane);
    modal.append(head, body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');

    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    backdrop.routilityShut = shut;
    document.addEventListener('keydown', onKey, true);
    close.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    let current = null;
    const show = async (v) => {
      current = v;
      tabs.querySelectorAll('button').forEach(b => {
        const on = b.dataset.label === v.label;
        b.classList.toggle('bg-inverse-surface-0', on);
        b.classList.toggle('content-inverse-emphasis', on);
        b.classList.toggle('bg-shift-300', !on);
        b.classList.toggle('content-action-utility', !on);
        b.setAttribute('aria-pressed', String(on));
      });
      treeList.textContent = '';
      for (let i = 0; i < 4; i++) treeList.appendChild(el('li', 'routility-rx-skel routility-sk'));
      propsPane.textContent = '';
      download.disabled = true;
      const r = await loadVariant(s, v);
      if (current !== v || !backdrop.isConnected) return;
      download.disabled = !r.bytes;
      if (r.error) {
        treeList.textContent = '';
        treeList.appendChild(el('li', 'routility-rx-msg text-body-small content-muted', lt(r.error)));
        return;
      }
      if (!r.scan && window.RoUtilityScan) r.scan = window.RoUtilityScan.scan(r.model);
      paintSummary(summary, r.scan);
      renderTree(treeList, propsPane, r.model, r.scan, s.focusFlag);
      filterTree();
      if (!document.hidden) body.classList.add('routility-reveal');
    };
    download.addEventListener('click', () => {
      const r = current && current.result;
      if (!r || !r.bytes) return;
      const isText = !String.fromCharCode(...new Uint8Array(r.bytes.slice(0, 8))).startsWith('<roblox!');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.bytes], { type: 'application/octet-stream' }));
      a.download = `${(s.name || 'item').replace(/[\\/:*?"<>|]+/g, '').trim() || 'item'}${s.variants.length > 1 ? ' (' + current.label + ')' : ''}.${isText ? 'rbxmx' : 'rbxm'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    if (s.variants.length > 1) {
      for (const v of s.variants) {
        const b = el('button', 'relative clip group/interactable cursor-pointer flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility');
        b.type = 'button';
        b.dataset.label = v.label;
        const layer = el('div', STATE_LAYER);
        layer.setAttribute('aria-hidden', 'true');
        b.append(layer, el('span', 'padding-y-xsmall text-no-wrap', lt(v.label)));
        b.addEventListener('click', () => show(v));
        tabs.appendChild(b);
      }
    }
    show(s.variants[0]);
  }

  function paintSummary(node, scan) {
    node.textContent = '';
    node.className = 'routility-rx-summary';
    if (!scan || !scan.scripts.length) return;
    node.classList.add(scan.high ? 'routility-rx-high' : scan.medium ? 'routility-rx-medium' : 'routility-rx-ok');
    node.append(el('span', 'routility-rx-dot'), document.createTextNode(scanText(scan)));
  }

  function scanText(scan) {
    const n = scan.scripts.length;
    const parts = [ltn(n, '{count} Script', '{count} Scripts', { count: n.toLocaleString() })];
    if (scan.high) parts.push(ltn(scan.high, '{count} High Risk', '{count} High Risk', { count: scan.high.toLocaleString() }));
    if (scan.medium) parts.push(ltn(scan.medium, '{count} to Review', '{count} to Review', { count: scan.medium.toLocaleString() }));
    if (!scan.high && !scan.medium) parts.push(lt('Looks Clean'));
    return parts.join(' · ');
  }

  const assets = new Map();

  function assetVariant(id) {
    if (!assets.has(id)) assets.set(id, { id, label: LT('Model'), format: '' });
    return assets.get(id);
  }

  async function analyze(id, onProgress) {
    const v = assetVariant(String(id));
    if (onProgress) v.onProgress = onProgress;
    const r = await loadVariant({ itemId: String(id) }, v);
    if (onProgress) onProgress(0.95);
    if (r.model && !r.scan && window.RoUtilityScan) r.scan = window.RoUtilityScan.scan(r.model);
    if (onProgress) onProgress(1);
    v.onProgress = null;
    return r;
  }

  function openAsset(o) {
    open({ itemId: String(o.itemId), name: o.name || '', variants: [assetVariant(String(o.itemId))], focusFlag: !!o.focusFlag });
  }

  function button(s) {
    const b = el('button', 'routility-injected routility-rx-btn');
    b.type = 'button';
    b.setAttribute('aria-label', lt('Explorer'));
    const icon = document.createElementNS(NS, 'svg');
    icon.setAttribute('viewBox', '0 0 25 22');
    icon.setAttribute('width', '25');
    icon.setAttribute('height', '22');
    icon.setAttribute('aria-hidden', 'true');
    for (const d of ['M2.5 1h6A1.5 1.5 0 0 1 10 2.5v3A1.5 1.5 0 0 1 8.5 7h-6A1.5 1.5 0 0 1 1 5.5v-3A1.5 1.5 0 0 1 2.5 1z', 'M5.5 7v11.5', 'M5.5 11.5H12', 'M5.5 18H12', 'M13.5 8.5h9A1.5 1.5 0 0 1 24 10v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 12 13v-3a1.5 1.5 0 0 1 1.5-1.5z', 'M13.5 15h9a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5z']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      icon.appendChild(path);
    }
    b.appendChild(icon);
    b.addEventListener('click', () => open(s));
    return b;
  }

  function place() {
    const s = st;
    if (!s || !s.variants) return;
    const actions = document.querySelector('.item-details-info-header .item-details-header-actions');
    const cart = actions && actions.querySelector(':scope > .shopping-cart-btn-container');
    if (!actions || actions.querySelector('.routility-rx-btn')) return;
    s.name = document.querySelector('.item-details-info-header h1, #item-container h1')?.textContent.trim() || '';
    actions.classList.add('routility-rx-actions');
    actions.insertBefore(button(s), cart || null);
  }

  async function bundleVariants(s) {
    let d = null;
    try {
      const r = await fetch(`https://catalog.roblox.com/v1/bundles/${s.itemId}/details`, { credentials: 'include' });
      d = r.ok ? await r.json() : null;
    } catch {}
    if (!d || st !== s) return null;
    const parts = (d.items || []).filter(i => i && i.type === 'Asset' && /^\d+$/.test(String(i.id))).slice(0, 12);
    const types = await Promise.all(parts.map(p => request({ type: 'assetFile', id: String(p.id) })));
    if (st !== s) return null;
    const base = String(d.name || '').trim();
    return parts.map((p, i) => {
      const type = types[i] && types[i].status === 200 ? types[i].assetTypeId : 0;
      if (!ALLOWED.has(type)) return null;
      let label = String(p.name || '').trim();
      if (base && label.toLowerCase().startsWith(base.toLowerCase())) label = label.slice(base.length).replace(/^[\s\-–—:]+/, '') || label;
      return { id: String(p.id), label: label || lt('Part {n}', { n: i + 1 }), format: HEADS.has(type) ? 'avatar_meshpart_head' : ACCESSORY.has(type) ? 'avatar_meshpart_accessory' : '' };
    }).filter(Boolean);
  }

  async function setup(itemId, opts) {
    teardown();
    const s = st = { itemId: String(itemId), variants: null, name: '' };
    if (opts && opts.bundle) {
      const variants = await bundleVariants(s);
      if (st !== s || !variants || !variants.length) return;
      s.variants = variants;
      s.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
      s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
      place();
      return;
    }
    const key = 'routilityAssetType:' + s.itemId;
    let type = Number(sessionStorage.getItem(key)) || 0;
    if (!type) {
      const res = await request({ type: 'assetFile', id: s.itemId });
      if (st !== s || !res || res.status !== 200) return;
      type = res.assetTypeId;
      try { sessionStorage.setItem(key, String(type)); } catch {}
    }
    if (st !== s || !ALLOWED.has(type)) return;
    s.variants = variantsFor(type);
    s.observer = new MutationObserver(window.RoUtilityUI.onFrame(place));
    s.observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    place();
  }

  function teardown() {
    if (!st) return;
    st.observer?.disconnect();
    st = null;
    document.querySelectorAll('.routility-rx-backdrop').forEach(n => (n.routilityShut ? n.routilityShut() : n.remove()));
    document.querySelectorAll('.routility-rx-btn').forEach(n => n.remove());
    document.querySelectorAll('.routility-rx-actions').forEach(n => n.classList.remove('routility-rx-actions'));
  }

  window.RoUtilityExplorer = { setup, teardown, analyze, openAsset, scanText };
})();
