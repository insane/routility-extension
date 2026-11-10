(function () {
  'use strict';

  if (location.hostname !== 'www.roblox.com') return;
  const { el, json, formatNumber } = window.RoUtilityUI;
  const { lt } = window.RoUtilityI18n;
  const LOGO_URL = chrome.runtime.getURL('assets/icons/logo.png');
  const ROBUX_PATH = 'M19.78 4.897A4.369 4.369 0 0122 8.69v6.62a4.37 4.37 0 01-2.22 3.792l-5.812 3.311a4.487 4.487 0 01-4.437 0l-5.813-3.31A4.37 4.37 0 011.5 15.31V8.69c0-1.565.846-3.011 2.218-3.793l5.813-3.31a4.487 4.487 0 014.437 0l5.813 3.31zM10.31 3.09L4.648 6.313a2.836 2.836 0 00-1.44 2.463v6.448c0 1.015.548 1.954 1.44 2.463l5.66 3.223c.892.508 1.99.508 2.882 0l5.66-3.223a2.838 2.838 0 001.442-2.463V8.776c0-1.017-.55-1.955-1.441-2.463L13.19 3.09a2.914 2.914 0 00-2.882 0zm2.624 1.801l4.466 2.543a2.33 2.33 0 011.184 2.024v5.087a2.33 2.33 0 01-1.184 2.023l-4.466 2.544a2.394 2.394 0 01-2.367 0L6.1 16.568a2.33 2.33 0 01-1.183-2.023V9.458c0-.835.451-1.606 1.183-2.024l4.466-2.543a2.394 2.394 0 012.367 0zM9.188 14.53h5.124V9.473H9.189v5.057z';

  function loadImg(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function button(label, primary) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
    layer.setAttribute('aria-hidden', 'true');
    b.label = el('span', 'text-no-wrap', label);
    b.append(layer, b.label);
    return b;
  }

  async function tradesThisYear(year) {
    const from = new Date(year, 0, 1).getTime();
    let cursor = '';
    let n = 0;
    for (let page = 0; page < 10; page++) {
      const d = await json(`https://trades.roblox.com/v1/trades/completed?limit=100&sortOrder=Desc${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      if (!d || !Array.isArray(d.data)) return page ? { n, more: true } : null;
      for (const t of d.data) {
        if (new Date(t.created).getTime() < from) return { n, more: false };
        n++;
      }
      cursor = d.nextPageCursor || '';
      if (!cursor) return { n, more: false };
    }
    return { n, more: true };
  }

  async function gather(me) {
    const year = new Date().getFullYear();
    const key = 'routilityPlaytime:' + me;
    const [st, user, head, friends, totals, trades] = await Promise.all([
      chrome.storage.local.get(key),
      json(`https://users.roblox.com/v1/users/${me}`),
      json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${me}&size=150x150&format=Png&isCircular=true`),
      json(`https://friends.roblox.com/v1/users/${me}/friends/count`),
      json(`https://economy.roblox.com/v2/users/${me}/transaction-totals?timeFrame=Year&transactionType=summary`),
      tradesThisYear(year),
    ]);
    const days = ((st[key] || {}).days) || {};
    const per = new Map();
    let total = 0;
    let first = '';
    for (const [day, games] of Object.entries(days)) {
      if (!day.startsWith(year + '-')) continue;
      if (!first || day < first) first = day;
      for (const [uni, min] of Object.entries(games)) {
        per.set(uni, (per.get(uni) || 0) + min);
        total += min;
      }
    }
    const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const info = {};
    if (top.length) {
      const ids = top.map(t => t[0]).join(',');
      const [g, icons] = await Promise.all([
        json(`https://games.roblox.com/v1/games?universeIds=${ids}`),
        json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`),
      ]);
      for (const x of (g && g.data) || []) info[String(x.id)] = { name: x.name };
      for (const x of (icons && icons.data) || []) if (info[String(x.targetId)]) info[String(x.targetId)].icon = x.imageUrl;
    }
    return {
      year,
      user: { name: (user && user.name) || '', display: (user && (user.displayName || user.name)) || '', head: head && head.data && head.data[0] && head.data[0].imageUrl },
      minutes: total,
      games: per.size,
      first,
      top: top.map(([uni, min]) => ({ uni, min, name: (info[uni] && info[uni].name) || lt('Experience'), icon: info[uni] && info[uni].icon })),
      spent: totals && Number.isFinite(totals.purchasesTotal) ? Math.abs(totals.purchasesTotal) : null,
      trades,
      friends: friends && Number.isFinite(friends.count) ? friends.count : null,
    };
  }

  async function draw(d) {
    const [logo, face, ...icons] = await Promise.all([loadImg(LOGO_URL), loadImg(d.user.head), ...d.top.map(t => loadImg(t.icon))]);
    const dark = !document.body.classList.contains('light-theme');
    const C = dark
      ? { bg: '#121215', tile: '#202228', track: '#2c2f36', text: '#f7f7f8', muted: '#a3a6ad', accent: '#5cb2ff', glow: 'rgba(51,95,255,0.30)', line: 'rgba(255,255,255,0.10)' }
      : { bg: '#ffffff', tile: '#f0f1f4', track: '#e1e3e8', text: '#202227', muted: '#666a72', accent: '#0a72c2', glow: 'rgba(51,95,255,0.16)', line: 'rgba(0,0,0,0.10)' };
    const W = 540;
    const PAD = 32;
    const scale = 2;
    const MAXH = 1100;
    const cv = document.createElement('canvas');
    cv.width = W * scale;
    cv.height = MAXH * scale;
    const g = cv.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, MAXH);
    const glow = g.createRadialGradient(W - 60, 20, 10, W - 60, 20, 420);
    glow.addColorStop(0, C.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, MAXH);
    const font = (w, s) => `${w} ${s}px "Builder Sans", "Gotham SSm", Arial, sans-serif`;
    const text = (s, x, y, f, color, align = 'left') => {
      g.font = f;
      g.fillStyle = color;
      g.textAlign = align;
      g.fillText(s, x, y);
      return g.measureText(s).width;
    };
    const fit = (s, max, f) => {
      g.font = f;
      if (g.measureText(s).width <= max) return s;
      let t = s;
      while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
      return t + '…';
    };
    const round = (x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    const hours = (min) => {
      if (min < 60) return lt('{n}m', { n: Math.round(min) });
      const h = Math.floor(min / 60);
      return lt('{h}h {m}m', { h: formatNumber(h), m: Math.round(min % 60) });
    };
    const compact = (n) => (n >= 100000 ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n) : formatNumber(n));
    const glyph = (kind, x, y, size, color) => {
      g.save();
      g.translate(x, y);
      g.scale(size / 24, size / 24);
      if (kind === 'robux') {
        g.fillStyle = color;
        g.fill(new Path2D(ROBUX_PATH));
      } else {
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.stroke(new Path2D(kind === 'trades' ? 'M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4' : 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.6M18 14.3c2.2.8 3.5 2.9 3.5 5.7'));
      }
      g.restore();
    };

    let y = PAD + 18;
    if (logo) g.drawImage(logo, PAD, y - 16, 20, 20);
    text('RoUtility', PAD + 28, y, font(800, 16), C.text);
    const tag = lt('{year} Wrapped', { year: d.year });
    g.font = font(700, 13);
    const tagW = g.measureText(tag).width + 24;
    round(W - PAD - tagW, y - 18, tagW, 26, 13);
    g.fillStyle = C.glow;
    g.fill();
    text(tag, W - PAD - tagW / 2, y, font(700, 13), C.accent, 'center');

    y += 30;
    g.beginPath();
    g.arc(PAD + 34, y + 34, 35, 0, Math.PI * 2);
    g.fillStyle = C.accent;
    g.fill();
    g.beginPath();
    g.arc(PAD + 34, y + 34, 32.5, 0, Math.PI * 2);
    g.fillStyle = C.tile;
    g.fill();
    if (face) {
      g.save();
      g.beginPath();
      g.arc(PAD + 34, y + 34, 32, 0, Math.PI * 2);
      g.clip();
      g.drawImage(face, PAD + 2, y + 2, 64, 64);
      g.restore();
    }
    text(fit(d.user.display, W - PAD * 2 - 92, font(700, 22)), PAD + 86, y + 32, font(700, 22), C.text);
    text('@' + d.user.name, PAD + 86, y + 54, font(500, 15), C.muted);

    y += 132;
    const inHours = d.minutes >= 60;
    const num = formatNumber(Math.round(inHours ? d.minutes / 60 : d.minutes));
    const nw = text(num, PAD, y, font(800, 68), C.accent);
    text(inHours ? lt('hours') : lt('minutes'), PAD + nw + 12, y, font(800, 30), C.text);
    y += 32;
    text(lt('played across {n} experiences', { n: formatNumber(d.games) }), PAD, y, font(500, 17), C.muted);
    if (d.first && d.first > d.year + '-01-07') {
      y += 22;
      const since = new Date(d.first + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      text(lt('Tracked since {date}', { date: since }), PAD, y, font(500, 13), C.muted);
    }

    y += 42;
    text(lt('Most Played'), PAD, y, font(700, 15), C.text);
    y += 14;
    const ICON = 56;
    const ROW = ICON + 14;
    if (!d.top.length) {
      text(lt('Play anything with Roblox open in Chrome and your top games show up here.'), PAD, y + 28, font(500, 14), C.muted);
      y += 48;
    }
    const most = d.top.length ? d.top[0].min : 1;
    d.top.forEach((t, i) => {
      const top = y + i * ROW;
      round(PAD, top, ICON, ICON, 12);
      g.fillStyle = C.tile;
      g.fill();
      if (icons[i]) {
        g.save();
        round(PAD, top, ICON, ICON, 12);
        g.clip();
        g.drawImage(icons[i], PAD, top, ICON, ICON);
        g.restore();
      }
      const tx = PAD + ICON + 16;
      const tw = W - PAD - tx;
      const time = hours(t.min);
      g.font = font(600, 14);
      const timeW = g.measureText(time).width;
      text(String(i + 1), tx, top + 24, font(800, 16), C.accent);
      text(fit(t.name, tw - timeW - 40, font(700, 16)), tx + 22, top + 24, font(700, 16), C.text);
      text(time, W - PAD, top + 24, font(600, 14), C.muted, 'right');
      round(tx, top + 36, tw, 6, 3);
      g.fillStyle = C.track;
      g.fill();
      round(tx, top + 36, Math.max(6, tw * t.min / most), 6, 3);
      g.fillStyle = C.accent;
      g.fill();
    });
    if (d.top.length) y += d.top.length * ROW;
    y += 10;

    const tiles = [
      { icon: 'robux', label: lt('Robux Spent'), sub: lt('Past 12 months'), value: d.spent == null ? '—' : compact(d.spent) },
      { icon: 'trades', label: lt('Trades'), sub: lt('This year'), value: d.trades ? compact(d.trades.n) + (d.trades.more ? '+' : '') : '—' },
      { icon: 'friends', label: lt('Friends'), sub: lt('Right now'), value: d.friends == null ? '—' : compact(d.friends) },
    ];
    const GAP = 12;
    const TW = (W - PAD * 2 - GAP * 2) / 3;
    const TH = 112;
    tiles.forEach((t, i) => {
      const x = PAD + i * (TW + GAP);
      round(x, y, TW, TH, 14);
      g.fillStyle = C.tile;
      g.fill();
      glyph(t.icon, x + 14, y + 14, 20, C.accent);
      text(fit(t.value, TW - 28, font(800, 24)), x + 14, y + 64, font(800, 24), C.text);
      text(fit(t.label, TW - 28, font(700, 13)), x + 14, y + 86, font(700, 13), C.text);
      text(fit(t.sub, TW - 28, font(500, 12)), x + 14, y + 102, font(500, 12), C.muted);
    });
    y += TH + 26;

    g.fillStyle = C.line;
    g.fillRect(PAD, y, W - PAD * 2, 1);
    y += 26;
    text(new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), PAD, y, font(600, 12), C.muted);
    text('routility.io', W - PAD, y, font(600, 12), C.muted, 'right');
    const H = Math.ceil(y + PAD - 6);
    const out = document.createElement('canvas');
    out.width = W * scale;
    out.height = H * scale;
    out.getContext('2d').drawImage(cv, 0, 0);
    return out;
  }

  async function open(me) {
    document.querySelector('.routility-wrapped-backdrop')?.remove();
    const year = new Date().getFullYear();
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-wrapped-backdrop');
    const modal = el('div', 'routility-modal routility-wrapped-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'routility-wrapped-title');
    const head = el('div', 'routility-modal-head');
    const title = el('h2', 'routility-modal-title', lt('{year} Wrapped', { year }));
    title.id = 'routility-wrapped-title';
    const closeBtn = el('button', 'routility-modal-icon routility-modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', lt('Close'));
    closeBtn.appendChild(el('span', 'icon icon-regular-x'));
    head.append(title, closeBtn);
    const shot = el('div', 'routility-wrapped-shot');
    shot.appendChild(el('span', 'routility-sk routility-wrapped-sk'));
    const actions = el('div', 'routility-wrapped-actions');
    const copy = button(lt('Copy Image'), true);
    const save = button(lt('Download'));
    copy.disabled = save.disabled = true;
    actions.append(copy, save);
    modal.append(head, shot, actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    let alive = true;
    const shut = () => {
      alive = false;
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });

    const data = await gather(me).catch(() => null);
    if (!alive) return;
    if (!data) {
      shot.textContent = '';
      shot.appendChild(el('p', 'text-body-medium content-muted', lt('Couldn’t load your year. Try again in a moment.')));
      return;
    }
    const canvas = await draw(data);
    if (!alive) return;
    const img = el('img', 'routility-wrapped-img');
    img.alt = lt('{year} Wrapped', { year });
    img.src = canvas.toDataURL('image/png');
    shot.replaceChildren(img);
    copy.disabled = save.disabled = false;
    const flash = (b, words) => {
      const was = b.label.textContent;
      b.label.textContent = words;
      setTimeout(() => { b.label.textContent = was; }, 1600);
    };
    copy.addEventListener('click', () => {
      const blob = new Promise((resolve, reject) => canvas.toBlob(x => (x ? resolve(x) : reject(new Error('blob'))), 'image/png'));
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => flash(copy, lt('Copied!')), () => flash(copy, lt('Couldn’t Copy')));
    });
    save.addEventListener('click', () => {
      const a = el('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `roblox-wrapped-${year}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  window.RoUtilityWrapped = { open, gather, draw };
})();
