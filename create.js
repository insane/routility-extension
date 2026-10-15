(function () {
  'use strict';

  const { el, onFrame, formatUSD, formatNumber, robuxRate } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;
  const NS = 'http://www.w3.org/2000/svg';
  const settings = { createScanner: true, createIds: true, createDevItems: true, createUsd: true };
  let lastUrl = '';
  let page = null;

  const ICONS = {
    copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
    check: ['M5 12l4 4 10-10'],
    download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
    store: ['M4 9l1.5-5h13L20 9', 'M4 9h16v11H4z', 'M9 20v-6h6v6'],
    explorer: ['M3 3h7v4H3z', 'M6.5 7v11', 'M6.5 11.5H12', 'M6.5 18H12', 'M13 9.5h8v4h-8z', 'M13 16h8v4h-8z'],
    servers: ['M4 5h16v5H4z', 'M4 14h16v5H4z', 'M8 7.5h.01', 'M8 16.5h.01'],
    code: ['M8 7l-5 5 5 5', 'M16 7l5 5-5 5'],
  };

  function icon(name, size = 16) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(size));
    s.setAttribute('height', String(size));
    s.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      s.appendChild(p);
    }
    return s;
  }

  function copyText(text, btn) {
    const done = () => {
      if (!btn) return;
      const old = btn.querySelector('svg');
      if (old) old.replaceWith(icon('check', Number(old.getAttribute('width')) || 16));
      btn.classList.add('routility-cr-copied');
      clearTimeout(btn._rtCopied);
      btn._rtCopied = setTimeout(() => {
        const now = btn.querySelector('svg');
        if (now) now.replaceWith(icon('copy', Number(now.getAttribute('width')) || 16));
        btn.classList.remove('routility-cr-copied');
      }, 1200);
    };
    navigator.clipboard.writeText(text).then(done, () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
      done();
    });
  }

  function iconButton(name, label, onClick) {
    const b = el('button', 'routility-injected routility-cr-icon');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.appendChild(icon(name));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(b);
    });
    return b;
  }

  const MAGIC = [
    [[0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78, 0x21], 'rbxm'],
    [[0x3c, 0x72, 0x6f, 0x62, 0x6c, 0x6f, 0x78], 'rbxmx'],
    [[0x89, 0x50, 0x4e, 0x47], 'png'],
    [[0xff, 0xd8, 0xff], 'jpg'],
    [[0x4f, 0x67, 0x67, 0x53], 'ogg'],
    [[0x49, 0x44, 0x33], 'mp3'],
    [[0xff, 0xfb], 'mp3'],
    [[0x52, 0x49, 0x46, 0x46], 'wav'],
    [[0x1a, 0x45, 0xdf, 0xa3], 'webm'],
    [[0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x20], 'mesh'],
  ];

  function extension(bytes) {
    const u = new Uint8Array(bytes.slice(0, 8));
    for (const [sig, ext] of MAGIC) if (sig.every((v, i) => u[i] === v)) return ext;
    return 'bin';
  }

  async function download(id, name, btn) {
    btn.disabled = true;
    btn.classList.add('routility-cr-busy');
    btn.parentElement?.querySelector('.routility-cr-fail')?.remove();
    try {
      const res = await window.RoUtilityUI.request({ type: 'assetFile', id: String(id) }, r => r && typeof r.status === 'number');
      if (!res || res.status !== 200) throw new Error();
      const r = await fetch(res.location);
      if (!r.ok) throw new Error();
      const bytes = await r.arrayBuffer();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      a.download = `${(name || 'asset').replace(/[\\/:*?"<>|]+/g, '').trim() || 'asset'} ${id}.${extension(bytes)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      btn.classList.add('routility-cr-failed');
      const msg = el('span', 'routility-injected routility-cr-fail', lt('Couldn’t download'));
      btn.parentElement?.appendChild(msg);
      setTimeout(() => { btn.classList.remove('routility-cr-failed'); msg.remove(); }, 3000);
    }
    btn.disabled = false;
    btn.classList.remove('routility-cr-busy');
  }

  function leaf(root, text) {
    return [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,a')].find(e => !e.children.length && e.textContent.trim() === text) || null;
  }

  function storePage(id) {
    const s = { id, scan: null, started: false };
    s.run = () => {
      const details = document.querySelector('[class*="overallDetailsContainer"]');
      if (!details) return;
      const typeLabel = leaf(details, 'Type');
      const typeValue = typeLabel && typeLabel.nextElementSibling;
      const type = typeValue ? typeValue.textContent.trim() : '';
      if (!/Model|Plugin|Package/i.test(type)) return;
      const title = document.querySelector('h1')?.textContent.trim() || '';
      if (!document.querySelector('.routility-cr-card')) {
        const notice = [...document.querySelectorAll('p,span,div,h6')].find(n => !n.children.length && /contains scripts/i.test(n.textContent));
        const line = notice && notice.parentElement;
        const box = line && line.parentElement && line.parentElement.children.length === 1 ? line.parentElement : line;
        if (box) box.classList.add('routility-cr-hidden');
        const card = scanCard();
        (box || details).before(card);
        s.card = card;
        if (s.scan) paintScan(s, title);
      }
      const row = document.querySelector('[class*="headingButtonRow"]');
      if (row && !row.querySelector('.routility-cr-explorer')) {
        const model = row.querySelector('button[aria-label="More options"]') || row.querySelector('button');
        const b = el('button', [...model.classList].filter(c => !/^Mui-(disabled|focusVisible|selected)$/.test(c)).join(' ') + ' routility-injected routility-cr-explorer');
        b.type = 'button';
        b.setAttribute('aria-label', lt('Explorer'));
        const mine = icon('explorer', 24);
        mine.setAttribute('class', 'routility-cr-explorer-icon');
        b.appendChild(mine);
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.RoUtilityExplorer.openAsset({ itemId: id, name: title });
        });
        row.insertBefore(b, row.firstElementChild);
      }
      if (!s.started) {
        s.started = true;
        window.RoUtilityExplorer.analyze(id, (p) => {
          const fill = document.querySelector('.routility-cr-card .routility-cr-progress-fill');
          if (fill) fill.style.width = Math.round(p * 100) + '%';
        }).then((r) => {
          if (page !== s) return;
          s.scan = r;
          paintScan(s, title);
          s.run();
        });
      }
    };
    return s;
  }

  function scanCard() {
    const card = el('div', 'routility-injected routility-cr-card bg-shift-300 radius-medium');
    const body = el('div', 'routility-cr-body');
    body.append(el('span', 'routility-cr-sk routility-cr-sk-title'), el('span', 'routility-cr-sk routility-cr-sk-sub'));
    const bar = el('span', 'routility-cr-progress');
    bar.appendChild(el('span', 'routility-cr-progress-fill'));
    card.append(body, bar);
    return card;
  }

  function chip(text, tone) {
    return el('span', 'routility-cr-chip routility-cr-chip-' + tone, text);
  }

  function paintScan(s, title) {
    const card = s.card;
    if (!card || !card.isConnected || card.dataset.done) return;
    card.dataset.done = '1';
    card.textContent = '';
    const r = s.scan;
    const sc = r && r.scan;
    const tone = !sc ? 'muted' : sc.high ? 'high' : sc.medium ? 'medium' : 'ok';
    card.classList.add('routility-cr-tone-' + tone);
    const body = el('div', 'routility-cr-body');
    body.appendChild(el('span', 'routility-cr-title', lt('Script Scan')));
    const sub = el('span', 'routility-cr-sub');
    if (!sc) {
      sub.textContent = r && r.error && /share/.test(r.error) ? lt('Roblox doesn’t share this file, so it can’t be checked.') : lt('Couldn’t check this file right now.');
    } else if (!sc.scripts.length) {
      sub.append(document.createTextNode(lt('No scripts in this model')), chip(lt('Safe'), 'ok'));
    } else {
      const n = sc.scripts.length;
      sub.appendChild(document.createTextNode(ltn(n, '{count} script checked', '{count} scripts checked', { count: formatNumber(n) })));
      if (sc.high) sub.appendChild(chip(ltn(sc.high, '{count} High Risk', '{count} High Risk', { count: formatNumber(sc.high) }), 'high'));
      if (sc.medium) sub.appendChild(chip(ltn(sc.medium, '{count} to Review', '{count} to Review', { count: formatNumber(sc.medium) }), 'medium'));
      if (!sc.high && !sc.medium) sub.appendChild(chip(lt('Looks Clean'), 'ok'));
    }
    body.appendChild(sub);
    card.append(body);
    if (sc && sc.scripts.length) {
      const view = el('button', 'foundation-web-button relative clip group/interactable cursor-pointer flex items-center justify-center gap-small stroke-none padding-y-none select-none radius-medium text-label-medium height-800 padding-x-medium bg-action-standard content-action-standard routility-cr-view');
      view.type = 'button';
      const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)]');
      layer.setAttribute('aria-hidden', 'true');
      view.append(layer, el('span', 'padding-y-xsmall text-no-wrap', lt('View Scripts')));
      view.addEventListener('click', () => window.RoUtilityExplorer.openAsset({ itemId: s.id, name: title, focusFlag: true }));
      card.appendChild(view);
    }
  }

  function experiencePage(universeId) {
    const s = { id: universeId, placeId: null, asked: false };
    s.run = () => {
      const access = [...document.querySelectorAll('[class*="subtitleContainer"]')];
      const last = access[access.length - 1];
      if (!last) return;
      if (!s.asked) {
        s.asked = true;
        fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { credentials: 'include' })
          .then(r => (r.ok ? r.json() : null))
          .then((d) => {
            if (page !== s) return;
            const g = d && d.data && d.data[0];
            if (g && g.rootPlaceId) {
              s.placeId = String(g.rootPlaceId);
              document.querySelectorAll('.routility-cr-ids, .routility-cr-servers').forEach(n => n.remove());
              s.run();
            }
          })
          .catch(() => {});
      }
      if (!last.parentElement.querySelector('.routility-cr-ids')) {
        const line = (label, value) => {
          const box = last.cloneNode(true);
          box.classList.add('routility-injected', 'routility-cr-ids');
          const text = box.firstElementChild;
          text.textContent = lt('{label}: ', { label });
          text.appendChild(el('span', 'routility-cr-idval', value));
          text.appendChild(iconButton('copy', lt('Copy {label}', { label }), b => copyText(value, b)));
          return box;
        };
        const nodes = [line(lt('Universe ID'), universeId)];
        if (s.placeId) nodes.push(line(lt('Place ID'), s.placeId));
        last.after(...nodes);
      }
      if (s.placeId && !document.querySelector('.routility-cr-servers')) {
        const view = [...document.querySelectorAll('button, a')].find(e => e.textContent.trim() === 'View on Roblox');
        const cell = view && view.parentElement;
        if (cell) {
          const copy = cell.cloneNode(false);
          copy.classList.add('routility-injected', 'routility-cr-servers');
          const a = el('a', view.className);
          a.href = `https://www.roblox.com/games/${s.placeId}#!/game-instances`;
          a.target = '_blank';
          a.rel = 'noopener';
          const label = view.querySelector('span')?.cloneNode(false) || el('span');
          label.textContent = lt('Servers');
          a.appendChild(label);
          copy.appendChild(a);
          cell.after(copy);
        }
      }
    };
    return s;
  }

  function devItemsPage() {
    const s = {};
    s.run = () => {
      for (const btn of document.querySelectorAll('tr.foundation-web-table-row button[aria-label^="Asset ID:"]')) {
        const cell = btn.parentElement;
        if (!cell || cell.querySelector('.routility-cr-actions')) continue;
        const id = btn.textContent.trim();
        if (!/^\d+$/.test(id)) continue;
        const row = cell.closest('tr');
        const name = row.querySelector('.text-truncate-split, .text-no-wrap')?.textContent.trim() || '';
        const tab = new URLSearchParams(location.search).get('activeTab') || '';
        const box = el('span', 'routility-injected routility-cr-actions');
        box.appendChild(iconButton('copy', lt('Copy {label}', { label: 'rbxassetid://' + id }), b => copyText('rbxassetid://' + id, b)));
        if (/Model|Package|Plugin|Animation/i.test(tab)) box.appendChild(iconButton('explorer', lt('Explorer'), () => window.RoUtilityExplorer.openAsset({ itemId: id, name, focusFlag: true })));
        box.appendChild(iconButton('download', lt('Download'), b => download(id, name, b)));
        box.appendChild(iconButton('store', lt('Open in Store'), () => window.open(`https://create.roblox.com/store/asset/${id}`, '_blank', 'noopener')));
        cell.appendChild(box);
      }
    };
    return s;
  }

  function usdPass() {
    if (!settings.createUsd || /\/dashboard\/devex/.test(location.pathname)) return;
    for (const ic of document.querySelectorAll('main .icon-filled-robux, main .icon-regular-robux, [role="main"] .icon-filled-robux, table .icon-filled-robux')) {
      const holder = ic.parentElement;
      if (!holder || holder.dataset.rtUsd === holder.textContent) continue;
      holder.querySelector(':scope > .routility-cr-usd')?.remove();
      const text = holder.textContent.replace(/Robux/g, '');
      const m = text.match(/([+\-−]?)\s*([\d,]+(?:\.\d+)?)\s*([KkMm]?)/);
      if (!m) continue;
      let n = Number(m[2].replace(/,/g, ''));
      if (/k/i.test(m[3])) n *= 1e3;
      if (/m/i.test(m[3])) n *= 1e6;
      if (!(n > 0)) continue;
      const tag = el('span', 'routility-injected routility-cr-usd', '≈ ' + formatUSD(n * robuxRate(settings)));
      holder.appendChild(tag);
      holder.dataset.rtUsd = holder.textContent;
    }
  }

  function route() {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      document.querySelectorAll('.routility-cr-card, .routility-cr-explorer, .routility-cr-ids, .routility-cr-servers').forEach(n => n.remove());
      document.querySelectorAll('.routility-cr-hidden').forEach(n => n.classList.remove('routility-cr-hidden'));
      const path = location.pathname;
      let m;
      if (settings.createScanner && (m = path.match(/^\/store\/asset\/(\d+)/))) page = storePage(m[1]);
      else if (settings.createIds && (m = path.match(/^\/dashboard\/creations\/experiences\/(\d+)\/overview/))) page = experiencePage(m[1]);
      else if (settings.createDevItems && /^\/dashboard\/creations\/?$/.test(path)) page = devItemsPage();
      else page = null;
    }
    if (page) page.run();
    usdPass();
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    Object.assign(settings, st.routilitySettings || {});
    const tick = onFrame(route);
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(() => { if (location.href !== lastUrl) tick(); }, 400);
    tick();
  });
})();
