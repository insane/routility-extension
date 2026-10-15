(function () {
  'use strict';

  const { el, onFrame } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const SIZE = 128;
  const INPUT = 'input[placeholder^="#FFF000"]';
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const PARTS = { all: 'torsoColor3', head: 'headColor3', torso: 'torsoColor3', 'left arm': 'leftArmColor3', 'right arm': 'rightArmColor3', 'left leg': 'leftLegColor3', 'right leg': 'rightLegColor3' };
  let observer = null;

  function hsvToRgb(h, s, v) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
  }

  function rgbToHsv([r, g, b]) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, max ? d / max : 0, max];
  }

  const toHex = (rgb) => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

  function parseColor(text) {
    const s = String(text || '').trim();
    let m = s.match(/^#?([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^#?([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16));
    m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }

  function drawWheel(canvas, v) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const n = Math.round(SIZE * dpr);
    if (canvas.width !== n) {
      canvas.width = n;
      canvas.height = n;
    }
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(n, n);
    const r = n / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - r;
        const dy = y + 0.5 - r;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const [R, G, B] = hsvToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, Math.min(1, d / r), v);
        const i = (y * n + x) * 4;
        img.data[i] = R;
        img.data[i + 1] = G;
        img.data[i + 2] = B;
        img.data[i + 3] = d > r - 1 ? Math.round(255 * (r - d)) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function setValue(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function dropperIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M13.5 6.5l4 4', 'M15.6 4.4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3l-2.6 2.6-4-4z', 'M12.5 9.5L5.6 16.4a2 2 0 0 0-.5.9L4 20l2.7-1.1a2 2 0 0 0 .9-.5l6.9-6.9']) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.8');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    }
    return svg;
  }

  function build(input) {
    const field = input.closest('.foundation-web-input') || input.parentElement;
    const host = field.parentElement;
    const panel = el('div', 'routility-injected routility-skin-wheel');
    const disc = el('div', 'routility-skin-wheel-disc');
    const canvas = el('canvas', 'routility-skin-wheel-canvas');
    canvas.setAttribute('role', 'slider');
    canvas.setAttribute('aria-label', lt('Color wheel'));
    canvas.tabIndex = 0;
    const dot = el('span', 'routility-skin-wheel-dot');
    disc.append(canvas, dot);

    const side = el('div', 'routility-skin-wheel-side');
    const label = el('div', 'text-label-small content-default routility-skin-wheel-label', lt('Brightness'));
    const range = el('input', 'routility-skin-wheel-range');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.setAttribute('aria-label', lt('Brightness'));
    const now = el('div', 'routility-skin-wheel-now');
    const swatch = el('span', 'routility-skin-wheel-swatch');
    const hex = el('span', 'text-body-small content-emphasis routility-skin-wheel-hex');
    now.append(swatch, hex);
    side.append(label, range, now);
    if (window.EyeDropper) {
      const pick = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none padding-y-none select-none radius-small text-label-small height-800 padding-x-small bg-action-standard content-action-standard routility-skin-wheel-pick');
      pick.type = 'button';
      const layer = el('div', STATE_LAYER);
      layer.setAttribute('aria-hidden', 'true');
      const inner = el('span', 'flex items-center min-width-0 gap-xsmall');
      inner.append(dropperIcon(), el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', lt('Pick From Screen')));
      pick.append(layer, inner);
      pick.addEventListener('click', async () => {
        try {
          const res = await new window.EyeDropper().open();
          const rgb = parseColor(res && res.sRGBHex);
          if (rgb) {
            show(rgbToHsv(rgb));
            commit();
          }
        } catch {}
      });
      side.appendChild(pick);
    }
    panel.append(disc, side);
    host.insertBefore(panel, field.nextSibling);

    let hsv = [0, 0, 1];
    let drawnV = -1;
    let dragging = false;

    const current = () => hsvToRgb(hsv[0], hsv[1], hsv[2]);
    function show(next) {
      hsv = next;
      if (hsv[2] !== drawnV) {
        drawnV = hsv[2];
        drawWheel(canvas, hsv[2]);
      }
      const angle = hsv[0] * Math.PI / 180;
      const radius = hsv[1] * SIZE / 2;
      dot.style.left = (SIZE / 2 + Math.cos(angle) * radius) + 'px';
      dot.style.top = (SIZE / 2 + Math.sin(angle) * radius) + 'px';
      const rgb = current();
      const full = hsvToRgb(hsv[0], hsv[1], 1);
      dot.style.background = toHex(rgb);
      swatch.style.background = toHex(rgb);
      hex.textContent = toHex(rgb);
      range.value = String(Math.round(hsv[2] * 100));
      range.style.setProperty('--routility-wheel-full', toHex(full));
      canvas.setAttribute('aria-valuetext', toHex(rgb));
    }
    function commit() {
      const value = toHex(current());
      if (input.value.trim().toUpperCase() === value) return;
      setValue(input, value);
      const radio = dialog.querySelector('input[type="radio"]:checked, [role="radio"][aria-checked="true"]');
      const name = radio ? (radio.closest('label') || radio.parentElement).textContent.trim().toLowerCase() : 'all';
      if (body) for (const key of name === 'all' ? Object.values(PARTS) : [PARTS[name]]) if (key) body[key] = value;
    }
    const dialog = input.closest('[role="dialog"]') || host;
    let body = null;
    fetch('https://avatar.roblox.com/v2/avatar/avatar', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        body = (d && d.bodyColor3s) || null;
        fromInput();
      })
      .catch(() => {});
    function partColor() {
      const radio = dialog.querySelector('input[type="radio"]:checked, [role="radio"][aria-checked="true"]');
      const name = radio ? (radio.closest('label') || radio.parentElement).textContent.trim().toLowerCase() : 'all';
      return body && parseColor(body[PARTS[name] || 'torsoColor3']);
    }
    function fromInput() {
      if (dragging) return;
      const active = dialog.querySelector('button.color-dot.active');
      const rgb = parseColor(input.value) || (active && parseColor(active.style.backgroundColor)) || partColor();
      if (rgb && toHex(rgb) !== toHex(current())) show(rgbToHsv(rgb));
    }

    const pointAt = (e) => {
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
      show([(Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s, hsv[2] || 1]);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      pointAt(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (dragging) pointAt(e); });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      commit();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 2;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] };
      const m = moves[e.key];
      if (!m) return;
      e.preventDefault();
      show([(hsv[0] + m[0] + 360) % 360, Math.min(1, Math.max(0, hsv[1] + m[1])), hsv[2]]);
      commit();
    });
    range.addEventListener('input', () => show([hsv[0], hsv[1], Number(range.value) / 100]));
    range.addEventListener('change', commit);
    input.addEventListener('input', () => fromInput());
    const watch = new MutationObserver(onFrame(fromInput));
    watch.observe(dialog, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'aria-checked', 'checked'] });
    dialog.addEventListener('change', () => fromInput());
    panel.routilityWatch = watch;
    show([0, 0, 1]);
    fromInput();
  }

  function scan() {
    for (const input of document.querySelectorAll(`[role="dialog"] ${INPUT}`)) {
      const field = input.closest('.foundation-web-input') || input.parentElement;
      if (field.nextElementSibling && field.nextElementSibling.classList.contains('routility-skin-wheel')) continue;
      build(input);
    }
  }

  function setup() {
    if (observer) return;
    observer = new MutationObserver(onFrame(scan));
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
  }

  function teardown() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    document.querySelectorAll('.routility-skin-wheel').forEach(n => {
      if (n.routilityWatch) n.routilityWatch.disconnect();
      n.remove();
    });
  }

  window.RoUtilitySkinTone = { setup, teardown };
})();
