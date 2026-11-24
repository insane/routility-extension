(function () {
  'use strict';

  const { el, pageTitle, formatUSD, formatNumber, request, cashTile, itemValue, valueTag, shows } = window.RoUtilityUI;
  const showing = shows('Ads');
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PATH = /^\/trade-ads\/?$/i;
  const MASS_PATH = /^\/mass-send\/?$/i;
  const SITE = 'https://routility.io';
  const STATE_LAYER = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';
  const CHIP_ON = ['bg-inverse-surface-0', 'content-inverse-emphasis'];
  const CHIP_OFF = ['bg-shift-300', 'content-action-utility'];
  const TAG_NAME = { any: LT('Any'), demand: LT('Demand'), rares: LT('Rares'), rap: 'RAP', wishlist: LT('Wishlist'), robux: 'Robux', upgrade: LT('Upgrade'), downgrade: LT('Downgrade'), adds: LT('Adds'), projecteds: LT('Projecteds') };
  const TAG_TIP = { any: LT('Open to any offer'), demand: LT('Wants items with demand'), rares: LT('Wants rare items'), rap: LT('Wants RAP items (unvalued limiteds that trade at RAP)'), wishlist: LT('Wants items from their wishlist'), robux: LT('Wants Robux'), upgrade: LT('Wants fewer, bigger items'), downgrade: LT('Wants more, smaller items'), adds: LT('Wants adds on top'), projecteds: LT('Open to projected items') };
  const VIEWS = [['browse', LT('Browse')], ['post', LT('Post an Ad')], ['mine', LT('My Ads')]];
  const TIERS = [['all', LT('All')], ['top', LT('Top')], ['mid', LT('Mid')], ['low', LT('Low')]];
  const SORTS = [['newest', LT('Newest')], ['rap-desc', LT('Highest RAP')], ['rap-asc', LT('Lowest RAP')]];
  const TAGS = ['any', 'demand', 'rares', 'rap', 'wishlist', 'robux', 'upgrade', 'downgrade', 'adds', 'projecteds'];
  const REASONS = [LT('Scam / bait trade'), LT('Fake items (doesn’t own)'), LT('Spam / advertising'), LT('Offensive content'), LT('Other')];

  let settings = {};
  let s = null;

  function layer() {
    const d = el('div', STATE_LAYER);
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  function fbutton(label, variant, onClick, size) {
    const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium padding-x-medium ' + (size || 'height-1000') + ' ' + (variant || 'bg-action-standard content-action-standard'));
    btn.type = 'button';
    btn.appendChild(layer());
    const text = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    btn.appendChild(text);
    btn.label = text;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  function linkButton(label, href, variant) {
    const a = el('a', 'foundation-web-button relative clip group/interactable cursor-pointer flex items-center justify-center stroke-none select-none radius-medium text-label-medium height-1000 padding-x-medium routility-ads-linkbtn ' + (variant || 'bg-action-emphasis content-action-emphasis'));
    a.href = href;
    if (/^https:\/\/routility\.io/.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.append(layer(), el('span', 'text-no-wrap', label));
    return a;
  }

  function finput(placeholder, opts = {}) {
    const field = el('div', 'foundation-web-input flex items-center width-full relative clip group/interactable stroke-standard bg-none height-1000 radius-medium padding-x-medium gap-x-small stroke-contrast-alpha focus-within:stroke-system-emphasis');
    const l = layer();
    l.classList.add('pointer-events-none');
    field.appendChild(l);
    const input = el('input', 'width-full min-width-0 padding-none bg-none stroke-none outline-none content-emphasis placeholder:content-muted [appearance:none] text-body-medium placeholder:text-body-medium');
    input.type = 'text';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (opts.max) input.maxLength = opts.max;
    if (opts.inputmode) input.inputMode = opts.inputmode;
    field.appendChild(input);
    field.input = input;
    return field;
  }

  function modalShell(title, extraClass) {
    const backdrop = el('div', 'routility-modal-backdrop routility-injected routility-cm-backdrop routility-ads-backdrop');
    const modal = el('div', 'routility-modal routility-cm-modal routility-ads-modal' + (extraClass ? ' ' + extraClass : ''));
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = el('div', 'routility-modal-head');
    const closeBtn = el('button', 'routility-modal-icon routility-modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', lt('Close'));
    closeBtn.appendChild(el('span', 'icon icon-regular-x'));
    head.append(el('h2', 'routility-modal-title', title), closeBtn);
    const body = el('div', 'routility-modal-body routility-cm-body routility-ads-form');
    const foot = el('div', 'routility-cm-foot');
    modal.append(head, body, foot);
    backdrop.appendChild(modal);
    document.querySelector('.routility-ads-backdrop')?.remove();
    document.body.appendChild(backdrop);
    document.documentElement.classList.add('routility-modal-open');
    const shut = () => {
      backdrop.remove();
      document.documentElement.classList.remove('routility-modal-open');
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); shut(); } };
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', shut);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) shut(); });
    if (!document.hidden) modal.classList.add('routility-reveal');
    return { backdrop, modal, body, foot, shut };
  }

  function chip(label, on, onClick, count) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center justify-center gap-xsmall stroke-none select-none radius-circle text-label-medium height-800 padding-x-medium routility-ads-chip');
    b.type = 'button';
    b.appendChild(layer());
    b.appendChild(el('span', 'text-no-wrap', label));
    if (count != null) b.appendChild(el('span', 'text-no-wrap routility-ads-chip-count', formatNumber(count)));
    b.classList.add(...(on ? CHIP_ON : CHIP_OFF));
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', onClick);
    return b;
  }

  function ago(ms) {
    const sec = Math.max(0, (Date.now() - ms) / 1000);
    if (sec < 60) return lt('just now');
    if (sec < 3600) return ltn(Math.floor(sec / 60), '{n}m ago', '{n}m ago');
    if (sec < 86400) return ltn(Math.floor(sec / 3600), '{n}h ago', '{n}h ago');
    return ltn(Math.floor(sec / 86400), '{n}d ago', '{n}d ago');
  }

  function myId() {
    return document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  }

  function usd(v) {
    return window.RoUtilityUI.formatCash(v);
  }

  function siteImg(src) {
    if (!src) return '';
    let u;
    try { u = new URL(src, SITE); } catch { return ''; }
    if (u.origin === SITE && u.pathname === '/api/imgproxy.png') {
      try {
        const inner = new URL(u.searchParams.get('url') || '');
        if (inner.protocol === 'https:' && /(^|\.)rbxcdn\.com$/.test(inner.hostname)) return inner.href;
      } catch {}
    }
    return u.protocol === 'https:' ? u.href : '';
  }

  function thumbImg(src, size) {
    src = siteImg(src);
    const box = el('span', 'thumbnail-2d-container routility-ads-thumb');
    box.style.width = box.style.height = size + 'px';
    if (src) {
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = src;
      box.appendChild(img);
    }
    return box;
  }

  function shortUsd(v) {
    const { symbol } = window.RoUtilityUI.cash();
    const n = window.RoUtilityUI.toCash(v);
    if (n >= 1000) return symbol + compact(n);
    return symbol + (Number.isInteger(n) ? formatNumber(n) : n.toFixed(2));
  }

  function priceLabel(x) {
    const v = Number(x.usd);
    const box = el('span', 'routility-ads-item-value text-label-small');
    if (v > 0) box.textContent = shortUsd(v);
    else box.append(robuxIcon(), el('span', null, compact(Number(x.rap) || 0)));
    return box;
  }

  function adValue(x) {
    return s && s.byId ? itemValue(s.byId.get(String(x.asset_id || ''))) : 0;
  }

  function totals(usdTotal, rapTotal, valueTotal) {
    const line = el('span', 'routility-ads-total text-label-medium');
    if (showing.rap) {
      const part = el('span', 'routility-ads-total-part');
      part.append(robuxIcon(), el('span', 'content-emphasis', compact(rapTotal)));
      line.append(part);
    }
    if (showing.value && valueTotal > 0) line.append(valueTag(valueTotal, { short: true, className: 'routility-ads-total-part routility-ads-total-val content-emphasis', tip: false }));
    if (showing.usd) {
      const part = el('span', 'routility-ads-total-part');
      part.append(window.RoUtilityUI.usdIcon('routility-ads-usd-ic'), el('span', 'content-emphasis routility-ads-total-usd', usd(usdTotal)));
      line.append(part);
    }
    return line;
  }

  function isItem(x) {
    return !!x && typeof x === 'object' && x.type !== 'tag' && x.type !== 'text' && /^\d+$/.test(String(x.asset_id || ''));
  }

  function untilText(sec) {
    const left = sec * 1000 - Date.now();
    if (!(left > 0)) return lt('Expired');
    const d = Math.floor(left / 86400000);
    if (d >= 1) return ltn(d, 'Expires in {n}d', 'Expires in {n}d');
    const h = Math.max(1, Math.floor(left / 3600000));
    return ltn(h, 'Expires in {n}h', 'Expires in {n}h');
  }

  function handleOf(ad) {
    if (ad.show_as === 'discord' && ad.discord_username) return String(ad.discord_username);
    return String(ad.roblox_username || '');
  }

  function pill(text, extra) {
    return el('span', 'routility-ads-pill text-label-small bg-shift-300 content-emphasis' + (extra ? ' ' + extra : ''), text);
  }

  function entry(x) {
    if (!x || typeof x !== 'object') return null;
    if (x.type === 'tag') {
      const tag = String(x.tag || '');
      if (!Object.hasOwn(TAG_NAME, tag)) return pill(tag, 'routility-ads-tag');
      const tile = el('span', 'routility-ads-tagtile');
      tile.dataset.rtTip = lt(TAG_NAME[tag]) + ', ' + lt(TAG_TIP[tag]);
      tile.setAttribute('role', 'img');
      tile.setAttribute('aria-label', lt(TAG_NAME[tag]));
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = chrome.runtime.getURL(`assets/icons/tags/tag-${tag}.webp`);
      tile.appendChild(img);
      return tile;
    }
    if (x.type === 'text') return pill('“' + String(x.text || '').slice(0, 120) + '”', 'routility-ads-tag routility-ads-text');
    const id = String(x.asset_id || '');
    if (!id) return null;
    if (id.startsWith('usd-')) return cashItem('usd', Number(x.usd) || 0);
    if (id.startsWith('robux-')) return cashItem('robux', Number(x.robux) || 0);
    const a = el('a', 'routility-ads-item');
    a.href = `https://www.roblox.com/catalog/${encodeURIComponent(id)}`;
    window.RoUtilityUI.itemTip(a, { name: x.name || lt('Item'), value: adValue(x) || 0, usd: Number(x.usd) || 0, rap: Number(x.rap) || 0 });
    a.appendChild(thumbImg(x.thumb || '', 84));
    a.appendChild(priceLabel(x));
    return a;
  }

  function cashItem(kind, amount) {
    const box = el('span', 'routility-ads-item routility-ads-cash');
    const thumb = el('span', 'thumbnail-2d-container routility-ads-thumb');
    thumb.appendChild(cashTile(kind, amount));
    box.appendChild(thumb);
    return box;
  }

  function side(title, list, robux, usdTotal, rapTotal) {
    const box = el('div', 'routility-ads-side');
    const label = el('div', 'routility-ads-side-label');
    label.appendChild(el('span', 'text-label-medium content-muted routility-ads-side-title', title));
    if ((list || []).some(isItem) && (usdTotal > 0 || rapTotal > 0)) label.appendChild(totals(usdTotal || 0, rapTotal || 0, (list || []).filter(isItem).reduce((n, x) => n + adValue(x), 0)));
    box.appendChild(label);
    const row = el('div', 'routility-ads-items');
    for (const x of list || []) {
      const n = entry(x);
      if (n) row.appendChild(n);
    }
    if (robux > 0 && !(list || []).some(x => x && String(x.asset_id || '').startsWith('robux-'))) row.appendChild(cashItem('robux', robux));
    box.appendChild(row);
    return box;
  }

  function adCard(ad) {
    const robloxId = String(ad.roblox_id || '');
    const mine = (robloxId && robloxId === myId()) || s.view === 'mine';
    const card = el('article', 'routility-ads-card bg-surface-100 radius-large');
    const head = el('div', 'routility-ads-head');
    const who = el('a', 'routility-ads-who');
    if (robloxId) who.href = `https://www.roblox.com/users/${encodeURIComponent(robloxId)}/inventory`;
    const face = thumbImg(ad.poster_avatar || '', 40);
    face.classList.add('routility-ads-face');
    const names = el('span', 'routility-ads-names');
    const created = Number(ad.created_at) * 1000;
    const handle = handleOf(ad);
    const sub = el('span', 'routility-ads-byline text-body-small content-muted');
    if (handle) sub.appendChild(el('span', 'text-truncate-end', '@' + handle));
    if (created) sub.appendChild(el('span', 'text-no-wrap', s.view === 'mine' ? lt('posted {time}', { time: ago(created) }) : ago(created)));
    names.append(el('span', 'text-title-medium content-emphasis text-truncate-end', ad.poster_name || ad.roblox_username || lt('Trader')), sub);
    who.append(face, names);
    const acts = el('div', 'routility-ads-acts');
    if (mine) {
      if (Number(ad.expires_at) > 0) acts.appendChild(el('span', 'text-body-small content-muted text-no-wrap', untilText(Number(ad.expires_at))));
      const del = fbutton(lt('Delete'), 'bg-action-standard content-action-standard', () => {
        if (del.disabled) return;
        if (!del.armed) {
          del.armed = true;
          del.label.textContent = lt('Confirm Delete');
          del.timer = setTimeout(() => { del.armed = false; del.label.textContent = lt('Delete'); }, 4000);
          return;
        }
        clearTimeout(del.timer);
        del.disabled = true;
        del.label.textContent = lt('Deleting');
        removeAd(ad, card).finally(() => { if (del.isConnected) { del.disabled = false; del.armed = false; del.label.textContent = lt('Delete'); } });
      });
      acts.appendChild(del);
    } else {
      acts.appendChild(fbutton(lt('Contact'), 'bg-action-standard content-action-standard', () => openContact(ad, card)));
      if (robloxId) acts.appendChild(linkButton(lt('Send Trade'), `https://www.roblox.com/users/${encodeURIComponent(robloxId)}/trade`));
    }
    head.append(who, acts);
    card.appendChild(head);
    const body = el('div', 'routility-ads-body');
    body.appendChild(side(lt('Offering'), ad.offering, Number(ad.offering_robux) || 0, Number(ad.offering_usd) || 0, Number(ad.offering_rap) || 0));
    const swap = el('span', 'routility-ads-swap bg-shift-200 content-muted');
    swap.setAttribute('aria-hidden', 'true');
    swap.appendChild(el('span', 'icon routility-calc-icon routility-calc-icon-swap'));
    body.appendChild(swap);
    body.appendChild(side(lt('Looking For'), ad.looking_for, Number(ad.looking_robux) || 0, Number(ad.looking_usd) || 0, Number(ad.looking_rap) || 0));
    card.appendChild(body);
    if (ad.note) card.appendChild(el('p', 'routility-ads-note text-body-medium content-default', String(ad.note)));
    return card;
  }

  function copyRow(label, value) {
    const row = el('div', 'routility-ads-contact-row radius-medium');
    const text = el('div', 'routility-ads-contact-text');
    text.append(el('span', 'text-body-small content-muted', label), el('span', 'text-title-medium content-emphasis text-truncate-end', value));
    const copy = fbutton(lt('Copy'), 'bg-action-standard content-action-standard', async () => {
      try {
        await navigator.clipboard.writeText(value);
        copy.label.textContent = lt('Copied');
      } catch {
        copy.label.textContent = lt('Couldn’t copy');
      }
      clearTimeout(copy.timer);
      copy.timer = setTimeout(() => { copy.label.textContent = lt('Copy'); }, 1500);
    }, 'height-800');
    row.append(text, copy);
    return row;
  }

  function openContact(ad, card) {
    const name = ad.poster_name || ad.roblox_username || lt('Trader');
    const m = modalShell(lt('Trade with {name}', { name }), 'routility-ads-contact-modal');
    const robloxId = String(ad.roblox_id || '');
    if (ad.discord_username) m.body.appendChild(copyRow('Discord', '@' + ad.discord_username));
    if (ad.roblox_username) m.body.appendChild(copyRow('Roblox', String(ad.roblox_username)));
    if (robloxId) {
      const send = linkButton(lt('Send Trade'), `https://www.roblox.com/users/${encodeURIComponent(robloxId)}/trade`);
      send.classList.add('routility-ads-contact-btn');
      m.body.appendChild(send);
    }
    if (/^\d{5,22}$/.test(String(ad.discord_user_id || ''))) {
      const dm = linkButton(lt('Message on Discord'), `https://discord.com/users/${ad.discord_user_id}`, 'bg-action-standard content-action-standard');
      dm.target = '_blank';
      dm.rel = 'noopener';
      dm.classList.add('routility-ads-contact-btn');
      m.body.appendChild(dm);
    }
    m.foot.classList.add('routility-ads-contact-foot');
    if (robloxId) {
      const inv = el('a', 'text-body-medium content-default routility-ads-contact-link', lt('See inventory'));
      inv.href = `https://www.roblox.com/users/${encodeURIComponent(robloxId)}/inventory`;
      m.foot.appendChild(inv);
    } else m.foot.appendChild(el('span'));
    const rep = el('button', 'text-body-medium content-muted routility-ads-contact-report', lt('Report this ad'));
    rep.type = 'button';
    rep.addEventListener('click', () => { m.shut(); openReport(ad, card); });
    m.foot.appendChild(rep);
  }

  function skeletonCard() {
    const card = el('div', 'routility-ads-card routility-ads-card-sk bg-surface-100 radius-large');
    const head = el('div', 'routility-ads-head');
    head.append(el('span', 'routility-sk routility-sk-circle routility-ads-sk-face'), el('span', 'routility-sk routility-ads-sk-line'));
    const body = el('div', 'routility-ads-body');
    for (let i = 0; i < 2; i++) {
      const row = el('div', 'routility-ads-items');
      for (let j = 0; j < 3; j++) row.appendChild(el('span', 'routility-sk routility-ads-sk-item'));
      body.appendChild(row);
    }
    card.append(head, body);
    return card;
  }

  function notice(text, kind) {
    const box = s && s.root.querySelector('.routility-ads-notice');
    if (!box) return;
    clearTimeout(s.noticeTimer);
    box.textContent = text || '';
    box.hidden = !text;
    box.className = 'routility-ads-notice text-body-medium radius-medium' + (kind ? ' routility-ads-notice-' + kind : '');
    if (kind === 'success') s.noticeTimer = setTimeout(() => notice(''), 5000);
  }

  async function removeAd(ad, card) {
    const res = await request({ type: 'tradeAdsWrite', action: 'delete', id: String(ad.id) }, () => true);
    if (res && res.status >= 200 && res.status < 300) {
      card.remove();
      return notice(lt('Your ad was deleted.'), 'success');
    }
    notice((res && res.data && res.data.error) || lt('Couldn’t delete that ad. Try again.'), 'alert');
  }

  function empty(title, sub, action) {
    const box = el('div', 'routility-ads-empty bg-surface-100 radius-large');
    box.append(el('div', 'text-title-large content-emphasis', title), el('div', 'text-body-medium content-muted', sub));
    if (action) box.appendChild(action);
    return box;
  }

  async function load() {
    const job = (s.job || 0) + 1;
    s.job = job;
    const list = s.root.querySelector('.routility-ads-list');
    const pagerBox = s.root.querySelector('.routility-ads-pager');
    pagerBox.textContent = '';
    s.total = null;
    paintCount();
    list.replaceChildren(skeletonCard(), skeletonCard(), skeletonCard(), skeletonCard());
    const res = await request({ type: 'tradeAdsList', params: { mine: s.view === 'mine', page: s.page, tier: s.tier, sort: s.sort, q: s.q } }, r => r && r.status !== 0);
    if (!s || s.job !== job) return;
    if (s.view === 'mine' && res && (res.status === 401 || res.status === 403)) return list.replaceChildren(empty(lt('Sign in on routility.io'), lt('Your ads are tied to your routility.io account. Sign in there, then come back.'), linkButton(lt('Open routility.io'), SITE + '/trade-ads/mine')));
    if (!res || res.status !== 200 || !res.data || !Array.isArray(res.data.ads)) return list.replaceChildren(empty(lt('Couldn’t load trade ads'), lt('Refresh the page to try again.')));
    const ads = res.data.ads;
    if (res.data.counts && typeof res.data.counts === 'object') {
      s.counts = res.data.counts;
      paintToolbar();
    }
    s.total = s.view === 'mine' ? ads.length : Number(res.data.total) || ads.length;
    paintCount();
    if (!ads.length) return list.replaceChildren(s.view === 'mine' ? empty(lt('No active trade ads'), lt('You haven’t posted anything yet. Ads stay up for 14 days, and you can have 5 at once.'), fbutton(lt('Post a Trade Ad'), 'bg-action-emphasis content-action-emphasis', () => go('post'))) : empty(lt('No trade ads found'), s.q || s.tier !== 'all' ? lt('Try another search or tier.') : lt('Be the first to post one.')));
    list.replaceChildren(...ads.map(adCard));
    if (s.view === 'mine') return;
    if (s.page === 0) s.pageSize = ads.length;
    const total = Number(res.data.total) || 0;
    const pages = s.pageSize ? Math.max(1, Math.ceil(total / s.pageSize)) : 1;
    if (pages > 1) {
      const ul = el('ul', 'pager');
      const go = (d) => { s.page += d; load(); window.scrollTo(0, 0); };
      ul.appendChild(window.RoUtilityFriends.pagerButton('prev', s.page <= 0, () => go(-1)));
      const cur = el('li', 'pager-cur');
      cur.appendChild(el('span', null, formatNumber(s.page + 1)));
      ul.appendChild(cur);
      ul.appendChild(window.RoUtilityFriends.pagerButton('next', s.page >= pages - 1, () => go(1)));
      pagerBox.appendChild(ul);
    }
  }

  function routilityMe() {
    return request({ type: 'routilityMe' }, r => r && r.status !== 0).then(r => (r && r.user) || null);
  }

  async function myCollectibles() {
    const inv = await window.RoUtilityUI.collectibles(myId(), { pages: 20 });
    if (inv.status === 'private') return { hidden: true, items: [] };
    if (inv.status !== 'ok') return { hidden: false, items: [], failed: true };
    await s?.itemsJob;
    const lookup = window.RoUtilityUI.catalogFor(s ? s.items : []);
    const out = [];
    for (const x of inv.items) {
      const item = x.bundle ? lookup(x) : null;
      if (x.bundle && !item) continue;
      out.push({ uaid: x.key, assetId: item ? String(item.id) : x.targetId, name: (item && item.name) || x.name, serial: x.serial || null, onHold: x.onHold });
    }
    return { hidden: false, items: out, failed: !inv.complete && !out.length };
  }

  function itemInfo(assetId, fallbackName) {
    return s.byId.get(String(assetId)) || { id: String(assetId), name: fallbackName || lt('Item {id}', { id: assetId }), usd: 0, rap: 0, thumb: '' };
  }

  function compact(n) {
    const v = Number(n) || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v));
  }

  function tagImg(tag) {
    const img = el('img', 'routility-fade');
    img.alt = lt(TAG_NAME[tag]);
    img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
    img.src = chrome.runtime.getURL(`assets/icons/tags/tag-${tag}.webp`);
    return img;
  }

  function robuxIcon() {
    return el('span', 'icon-robux-16x16 routility-ads-rbx');
  }

  function entryUsd(e) {
    if (e.kind === 'item') return itemInfo(e.assetId).usd || 0;
    if (e.kind === 'usd') return e.amount;
    if (e.kind === 'robux') return e.amount * window.RoUtilityUI.robuxRate(settings);
    return 0;
  }

  function itemCard(it, opts) {
    const card = el('div', 'list-item item-card routility-calc-card routility-ads-card' + (opts.picked ? ' routility-ads-card-on' : ''));
    const b = el('button', 'item-card-container relative clip group/interactable cursor-pointer routility-calc-card-btn');
    b.type = 'button';
    b.disabled = !!opts.disabled;
    b.setAttribute('aria-pressed', String(!!opts.picked));
    const thumbBox = el('div', 'item-card-thumb-container');
    const thumb = el('span', 'thumbnail-2d-container item-card-thumb');
    if (it.thumb) {
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = it.thumb;
      thumb.appendChild(img);
    }
    thumbBox.appendChild(thumb);
    if (it.rare || it.ultra || it.projected) {
      const tags = el('span', 'routility-calc-tags');
      tags.append(...window.RoUtilityUI.tagIcons(it));
      thumbBox.appendChild(tags);
    }
    if (opts.serial) thumbBox.appendChild(el('span', 'routility-calc-serial text-label-small', '#' + formatNumber(opts.serial)));
    if (opts.count > 1) thumbBox.appendChild(el('span', 'routility-ads-count text-label-small', '×' + opts.count));
    const cap = el('div', 'item-card-caption');
    cap.appendChild(el('div', 'item-card-name text-overflow', it.name));
    const rap = el('div', 'text-overflow item-card-price routility-calc-price');
    rap.append(el('span', 'icon-robux-16x16'), el('span', 'text-robux-tile', formatNumber(it.rap || 0)));
    cap.appendChild(rap);
    if (showing.value) {
      const worth = el('div', 'text-overflow item-card-price routility-calc-price');
      worth.appendChild(valueTag(itemValue(it) || it.rap || 0, { textClass: 'text-robux-tile', tip: false }));
      worth.dataset.rtTip = itemValue(it) ? lt('Value: {value}', { value: formatNumber(itemValue(it)) }) : lt('Not valued yet, so this is its RAP');
      cap.appendChild(worth);
    }
    const price = el('div', 'text-overflow item-card-price routility-calc-price');
    price.append(window.RoUtilityUI.usdIcon('routility-logo'), el('span', 'text-robux-tile', it.usd ? usd(it.usd) : lt('No price')));
    cap.appendChild(price);
    b.append(thumbBox, cap);
    if (opts.onHold) {
      b.dataset.rtTip = lt('On hold, can’t be traded yet');
      card.dataset.hold = '1';
    }
    card.dataset.key = opts.key || '';
    b.addEventListener('click', opts.onClick);
    card.appendChild(b);
    if (opts.onMinus && opts.count > 0) {
      const minus = el('button', 'routility-ads-minus');
      minus.type = 'button';
      minus.textContent = '−';
      minus.disabled = !!opts.lockMinus;
      minus.setAttribute('aria-label', lt('Remove one'));
      minus.dataset.rtTip = lt('Remove one');
      minus.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onMinus();
      });
      card.appendChild(minus);
    }
    return card;
  }

  function syncCards(grid, isOn, full, busy) {
    for (const card of grid.querySelectorAll('.routility-ads-card')) {
      const on = isOn(card.dataset.key);
      card.classList.toggle('routility-ads-card-on', on);
      const b = card.querySelector('button');
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !!busy || card.dataset.hold === '1' || (!on && full);
    }
  }

  function skTile() {
    const t = el('div', 'routility-ads-sk-card');
    t.setAttribute('aria-hidden', 'true');
    t.append(el('span', 'routility-sk routility-ads-sk-thumb'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-name'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-rap'));
    if (showing.value) t.appendChild(el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-val'));
    t.appendChild(el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-usd'));
    return t;
  }

  function slotView(e, onRemove, opts = {}) {
    const b = el('button', 'routility-ads-slot relative clip group/interactable cursor-pointer' + (e ? ' routility-ads-slot-full' : ''));
    b.type = 'button';
    b.appendChild(layer());
    if (!e) {
      b.appendChild(el('span', 'routility-ads-slot-plus', '+'));
      b.setAttribute('aria-label', lt('Empty slot'));
      return b;
    }
    b.dataset.rtTip = lt('Click to remove');
    if (e.kind === 'item') {
      const it = itemInfo(e.assetId);
      if (it.thumb) {
        const img = el('img', 'routility-fade');
        img.alt = it.name;
        img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
        img.src = it.thumb;
        b.appendChild(img);
      }
      if (opts.cap !== false) b.appendChild(el('span', 'routility-ads-slot-cap text-label-small', it.usd ? usd(it.usd) : compact(it.rap)));
    } else if (e.kind === 'tag') {
      b.classList.add('routility-ads-slot-tag');
      b.appendChild(tagImg(e.tag));
    } else if (e.kind === 'usd' || e.kind === 'robux') {
      b.appendChild(cashTile(e.kind, e.amount));
    }
    b.addEventListener('click', onRemove);
    return b;
  }

  const CASH = new Set(['usd', 'robux']);
  const goods = (list) => list.filter(e => !CASH.has(e.kind));

  function fillSlots(box, list, onRemove, onEmpty, opts) {
    const items = goods(list);
    const cash = list.filter(e => CASH.has(e.kind));
    const views = Array.from({ length: 4 }, (_, i) => {
      const e = items[i];
      const b = slotView(e, () => onRemove(e), opts);
      if (!e) b.addEventListener('click', () => onEmpty('item', b));
      return b;
    });
    const cashViews = opts && opts.noCash ? [] : cash.length ? cash.map(e => slotView(e, () => onRemove(e), opts)) : [slotView(null, () => {}, opts)];
    cashViews.forEach((b) => {
      b.classList.add('routility-ads-slot-cash');
      if (!b.classList.contains('routility-ads-slot-full')) {
        b.querySelector('.routility-ads-slot-plus')?.remove();
        b.appendChild(robuxIcon());
        b.setAttribute('aria-label', lt('Robux slot'));
        b.dataset.rtTip = lt('Robux go here, so all 4 slots stay free for items');
        b.addEventListener('click', () => onEmpty('cash', b));
      }
    });
    box.style.gridTemplateColumns = `repeat(${4 + cashViews.length}, minmax(0, 1fr))`;
    box.replaceChildren(...views, ...cashViews);
    return items.length;
  }

  function buildPost() {
    const st = { off: [], look: [], unit: { off: 'usd', look: 'usd' }, note: '', showAs: 'roblox', mine: null, user: undefined, sending: false };
    const root = el('div', 'routility-ads-post');
    const form = el('div', 'routility-ads-form-grid');
    const sides = {};

    const makeSide = (key, title) => {
      const panel = el('section', 'routility-ads-panel bg-surface-100 radius-large');
      const head = el('div', 'routility-ads-panel-head');
      const count = el('span', 'text-body-small content-muted');
      head.append(el('h2', 'text-heading-small content-emphasis margin-none', title), count);
      const slots = el('div', 'routility-ads-slots');
      const amountRow = el('div', 'routility-ads-amount');
      const unit = el('div', 'routility-ads-unit radius-circle bg-shift-200');
      const money = window.RoUtilityUI.cash();
      const uUsd = el('button', 'routility-ads-unit-btn radius-circle', money.symbol);
      uUsd.type = 'button';
      uUsd.setAttribute('aria-label', money.code);
      const uRbx = el('button', 'routility-ads-unit-btn radius-circle');
      uRbx.type = 'button';
      uRbx.setAttribute('aria-label', 'Robux');
      uRbx.appendChild(robuxIcon());
      unit.append(uUsd, uRbx);
      const amount = finput(lt('{currency} amount', { currency: money.code }), { inputmode: 'decimal', max: 12 });
      const add = fbutton(lt('Add {currency}', { currency: money.code }), 'bg-action-standard content-action-standard');
      amountRow.append(unit, amount, add);
      const tags = key === 'look' ? el('div', 'routility-ads-tagpick') : null;
      const search = finput(key === 'off' ? lt('Search your inventory') : lt('Search all limiteds'));
      const grid = el('div', 'routility-ads-grid');
      panel.append(head, slots, amountRow);
      if (tags) panel.appendChild(tags);
      panel.append(search, grid);
      const side = { key, panel, count, slots, uUsd, uRbx, amount, add, tags, search, grid };
      const setUnit = (u) => {
        st.unit[key] = u;
        uUsd.classList.toggle('routility-ads-unit-on', u === 'usd');
        uRbx.classList.toggle('routility-ads-unit-on', u === 'robux');
        amount.input.placeholder = u === 'usd' ? lt('{currency} amount', { currency: money.code }) : lt('Robux amount');
        amount.input.setAttribute('aria-label', amount.input.placeholder);
        add.label.textContent = u === 'usd' ? lt('Add {currency}', { currency: money.code }) : lt('Add Robux');
      };
      uUsd.addEventListener('click', () => setUnit('usd'));
      uRbx.addEventListener('click', () => setUnit('robux'));
      setUnit('usd');
      amount.input.addEventListener('input', () => {
        amount.input.value = amount.input.value.replace(st.unit[key] === 'usd' ? /[^\d.,]/g : /[^\d.,]/g, '');
      });
      const addAmount = () => {
        const u = st.unit[key];
        const v = u === 'usd' ? Math.round(window.RoUtilityUI.fromCash(window.RoUtilityUI.parseAmount(amount.input.value)) * 100) / 100 : window.RoUtilityUI.parseAmount(amount.input.value, true);
        if (!(v > 0)) return;
        if (u === 'usd' && st.user && !st.user.discord) return hint(lt('Link your Discord on routility.io to add USD to an ad.'), true);
        const list = st[key];
        const same = list.find(e => e.kind === u);
        if (same) same.amount = u === 'usd' ? Math.round((same.amount + v) * 100) / 100 : same.amount + v;
        else list.push({ kind: u, amount: v });
        amount.input.value = '';
        picks();
      };
      add.addEventListener('click', addAmount);
      amount.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addAmount(); });
      let typing = 0;
      search.input.addEventListener('input', () => {
        clearTimeout(typing);
        typing = setTimeout(() => paintGrid(side), 120);
      });
      sides[key] = side;
      return panel;
    };

    form.append(makeSide('off', lt('Offering')), makeSide('look', lt('Looking For')));
    const notePanel = el('section', 'routility-ads-panel routility-ads-note-panel bg-surface-100 radius-large');
    const noteHead = el('div', 'routility-ads-panel-head');
    const noteCount = el('span', 'text-body-small content-muted', lt('optional, {count}/{max}', { count: 0, max: 400 }));
    noteHead.append(el('h2', 'text-heading-small content-emphasis margin-none', lt('Note')), noteCount);
    const note = el('textarea', 'routility-ads-textarea text-body-medium radius-medium');
    note.maxLength = 400;
    note.rows = 3;
    note.placeholder = lt('Adds, what you’re really after, anything else. Keep it short.');
    note.setAttribute('aria-label', lt('Note'));
    note.addEventListener('input', () => { st.note = note.value; noteCount.textContent = lt('optional, {count}/{max}', { count: note.value.length, max: 400 }); });
    const postAs = el('div', 'routility-ads-post-as');
    postAs.hidden = true;
    const footRow = el('div', 'routility-ads-post-foot');
    const post = fbutton(lt('Post Trade Ad'), 'bg-action-emphasis content-action-emphasis');
    const hintEl = el('span', 'text-body-small content-muted', lt('Ads stay up for 14 days and you can have 5 at once. Use a middleman if you feel unsafe.'));
    footRow.append(post, hintEl);
    notePanel.append(noteHead, note, postAs, footRow);
    root.append(form, notePanel);

    const DEFAULT_HINT = hintEl.textContent;
    function hint(text, alert) {
      hintEl.textContent = text || DEFAULT_HINT;
      hintEl.classList.toggle('routility-ads-hint-alert', !!alert);
    }

    function pct() {
      const give = st.off.reduce((t, e) => t + entryUsd(e), 0);
      const ask = st.look.reduce((t, e) => t + entryUsd(e), 0);
      return give > 0 && ask > 0 ? Math.round(give / ask * 100) : null;
    }

    function paintSlots(side) {
      const list = st[side.key];
      const n = fillSlots(side.slots, list, (e) => { st[side.key] = list.filter(x => x !== e); picks(); }, (kind) => (kind === 'cash' ? side.amount.input : side.search.input).focus());
      side.count.textContent = lt('{count} of {max}', { count: n, max: 4 });
    }

    function paintTags() {
      const side = sides.look;
      side.tags.replaceChildren(...TAGS.map(tag => {
        const on = st.look.some(e => e.kind === 'tag' && e.tag === tag);
        const b = el('button', 'routility-ads-tagbtn relative clip group/interactable cursor-pointer' + (on ? ' routility-ads-tile-on' : ''));
        b.type = 'button';
        b.dataset.rtTip = lt(TAG_NAME[tag]) + ', ' + lt(TAG_TIP[tag]);
        b.setAttribute('aria-pressed', String(on));
        b.append(layer(), tagImg(tag));
        b.disabled = !on && goods(st.look).length >= 4;
        b.addEventListener('click', () => {
          if (on) st.look = st.look.filter(e => !(e.kind === 'tag' && e.tag === tag));
          else if (goods(st.look).length < 4) st.look.push({ kind: 'tag', tag });
          picks();
        });
        return b;
      }));
    }

    function paintGrid(side) {
      const q = side.search.input.value.trim().toLowerCase();
      const words = q ? q.split(/\s+/) : [];
      const match = (name, extra) => words.every(w => (name + ' ' + (extra || '')).toLowerCase().includes(w));
      const full = goods(st[side.key]).length >= 4;
      if (side.key === 'off') {
        if (st.mine === null) return side.grid.replaceChildren(...Array.from({ length: 12 }, skTile));
        if (st.mine.hidden) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Your inventory is private, so your limiteds can’t be listed. Make it visible to everyone in Roblox privacy settings.')));
        const list = st.mine.items.map(x => ({ x, it: itemInfo(x.assetId, x.name) })).filter(({ it }) => match(it.name, it.acr)).sort((a, b) => (b.it.usd || 0) - (a.it.usd || 0));
        if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', st.mine.items.length ? lt('No limiteds match that.') : lt('You don’t have any limiteds to offer.')));
        return side.grid.replaceChildren(...list.slice(0, 120).map(({ x, it }) => {
          const on = st.off.some(e => e.uaid === x.uaid);
          return itemCard(it, { key: x.uaid, picked: on, serial: x.serial, onHold: x.onHold, disabled: x.onHold || (!on && full), onClick: () => {
            if (st.off.some(e => e.uaid === x.uaid)) st.off = st.off.filter(e => e.uaid !== x.uaid);
            else if (goods(st.off).length < 4) st.off.push({ kind: 'item', assetId: x.assetId, uaid: x.uaid });
            picks();
          } });
        }));
      }
      if (!s.items.length) return side.grid.replaceChildren(...(s.itemsFailed ? [el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Couldn’t load the item list. Refresh the page to try again.'))] : Array.from({ length: 12 }, skTile)));
      const list = s.items.filter(i => match(i.name, (i.acr || '') + ' ' + i.id)).sort((a, b) => (b.usd || 0) - (a.usd || 0));
      if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('No limiteds match that.')));
      side.grid.replaceChildren(...list.slice(0, 120).map(it => {
        const id = String(it.id);
        const count = st.look.filter(e => e.kind === 'item' && e.assetId === id).length;
        return itemCard(it, { key: id, picked: count > 0, count, disabled: full, onClick: () => {
          if (goods(st.look).length < 4) st.look.push({ kind: 'item', assetId: id });
          picks();
        }, onMinus: () => {
          const at = st.look.findIndex(e => e.kind === 'item' && e.assetId === id);
          if (at >= 0) st.look.splice(at, 1);
          picks();
        } });
      }));
    }

    function paintPostAs() {
      const on = !!(st.user && st.user.discord);
      postAs.hidden = !on;
      if (!on) {
        st.showAs = 'roblox';
        return;
      }
      const chips = el('div', 'routility-ads-chips');
      [['roblox', 'Roblox'], ['discord', 'Discord']].forEach(([key, label]) => chips.appendChild(chip(label, st.showAs === key, () => { st.showAs = key; paintPostAs(); })));
      postAs.replaceChildren(el('span', 'text-label-medium content-muted', lt('Post as')), chips);
    }

    function paintPost() {
      paintPostAs();
      const p = pct();
      if (st.user === undefined) {
        post.disabled = true;
        return;
      }
      if (!st.user) {
        post.disabled = false;
        post.label.textContent = lt('Sign In on routility.io');
        return hint(lt('Ads are posted with your routility.io account. Sign in there, then come back to this tab.'));
      }
      post.label.textContent = st.sending ? lt('Posting') : lt('Post Trade Ad');
      const bad = p !== null && (p < 50 || p > 200);
      if (bad) hint(lt('Your offer is worth {pct}% of what you’re asking. It has to be between 50% and 200%.', { pct: p }), true);
      else if (hintEl.classList.contains('routility-ads-hint-alert') && !st.lastError) hint('');
      else if (!st.lastError && st.user.robloxId !== myId()) hint(lt('Posting as {name}, your routility.io account.', { name: st.user.name }));
      post.disabled = st.sending || !st.off.length || !st.look.length || bad;
    }

    function paint() {
      st.lastError = '';
      paintSlots(sides.off);
      paintSlots(sides.look);
      paintTags();
      paintGrid(sides.off);
      paintGrid(sides.look);
      paintPost();
    }

    function picks() {
      st.lastError = '';
      paintSlots(sides.off);
      paintSlots(sides.look);
      paintTags();
      syncCards(sides.off.grid, k => st.off.some(e => e.uaid === k), goods(st.off).length >= 4);
      paintGrid(sides.look);
      paintPost();
    }

    post.addEventListener('click', async () => {
      if (st.user === null) return window.open(SITE + '/trade-ads/create', '_blank', 'noopener');
      if (post.disabled) return;
      st.sending = true;
      paintPost();
      const wire = (e) => {
        if (e.kind === 'item') return { asset_id: e.assetId };
        if (e.kind === 'tag') return { type: 'tag', tag: e.tag };
        if (e.kind === 'usd') return { asset_id: 'usd-1', usd: e.amount };
        return { asset_id: 'robux-1', robux: e.amount };
      };
      const res = await request({ type: 'tradeAdsWrite', action: 'create', body: { offering: st.off.map(wire), looking_for: st.look.map(wire), note: st.note, show_as: st.showAs } }, () => true);
      st.sending = false;
      if (res && res.status >= 200 && res.status < 300 && res.data && res.data.ok !== false) {
        st.off = [];
        st.look = [];
        st.note = '';
        note.value = '';
        noteCount.textContent = lt('optional, {count}/{max}', { count: 0, max: 400 });
        paint();
        notice(lt('Your ad is up on Trade Ads and routility.io.'), 'success');
        return go('mine');
      }
      if (res && res.status === 401) st.user = null;
      const msg = (res && res.data && res.data.code === 'discord_required') ? lt('Link your Discord on routility.io to add USD to an ad.') : (res && res.data && res.data.error) || (res && res.status === 429 ? lt('You can post a new ad every 15 minutes, with up to 5 up at once.') : lt('Couldn’t post your ad. Try again.'));
      paintPost();
      st.lastError = msg;
      hint(msg, true);
    });

    const recheck = () => routilityMe().then(u => { st.user = u; paintPost(); });
    window.addEventListener('focus', () => { if (s && s.view === 'post' && !st.user) recheck(); });

    root.start = () => {
      if (root.started) return;
      root.started = true;
      paint();
      recheck();
      s.itemsJob.then(() => paintGrid(sides.look));
      Promise.all([myCollectibles(), s.itemsJob]).then(([mine]) => {
        st.mine = mine;
        if (mine.failed) {
          root.started = false;
          hint(lt('Couldn’t load all your items right now. Open Post again to retry.'), true);
        }
        paint();
      });
    };
    return root;
  }

  const MASS_SOURCES = [['owners', LT('Item Owners')], ['ads', LT('Trade Ads')]];
  const MASS_ACTIVE = [['1', LT('1 Day')], ['3', LT('3 Days')], ['7', LT('7 Days')], ['30', LT('30 Days')], ['any', LT('Any Time')]];
  const MASS_COUNTS = [10, 25, 50, 100];
  const OWNED = [[0, ''], [1, LT('1 day')], [3, LT('3 days')], [7, LT('1 week')], [30, LT('1 month')], [90, LT('3 months')], [180, LT('6 months')], [365, LT('1 year')], [730, LT('2 years')], [1095, LT('3 years')], [1460, LT('4 years')], [1825, LT('5 years')], [Infinity, '']];
  const CIID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let massCsrf = '';
  const DAILY = 100;
  const DAY = 864e5;
  const SENT_KEY = 'routilityMassSent';
  const TO_KEY = 'routilityMassSentTo';
  const BLOCK_KEY = 'routilityMassBlocked';
  const WEEK = 7 * DAY;
  const ADDS_KEY = 'routilityMassAdds';
  const RUNS_KEY = 'routilityMassRuns';
  const SETUPS_KEY = 'routilityMassSetups';
  const DEMAND_RANK = { Terrible: 0, Low: 1, Normal: 2, High: 3, Amazing: 4 };
  const ADD_DEMAND = [['any', LT('Any demand')], ['Normal', LT('Normal demand or better')], ['High', LT('High demand or better')], ['Amazing', LT('Amazing demand')]];
  const ADD_NEVER = [['rap', LT('Unvalued (RAP) items')], ['face', LT('Faces')], ['gear', LT('Gear')], ['trend', LT('Dropping or unstable items')]];
  const MASS_SKIPS = [['pending', LT('People I already have a trade with')], ['recent', LT('People I mass sent to this week')], ['blocked', LT('People I couldn’t send to this week')], ['traded', LT('People I’ve traded with')], ['friends', LT('My friends')], ['fresh', LT('Accounts under 30 days old')]];

  function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  function clock(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function buildMass() {
    const st = { setups: [], cancel: 0, runAt: 0, off: [], look: [], source: 'owners', active: '7', max: 25, skip: { pending: true, recent: true, blocked: true, traded: false, friends: false, fresh: false }, mine: null, job: null, meta: null, allow: null, today: null, rangeFrom: '', rangeTo: '', rangeCount: '', owned: [2, OWNED.length - 1], adds: { demand: 'any', never: {}, count: 'any' }, review: false, ownedCustom: false };
    try {
      const saved = JSON.parse(localStorage.getItem(ADDS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        if (ADD_DEMAND.some(([k]) => k === saved.demand)) st.adds.demand = saved.demand;
        for (const [k] of ADD_NEVER) if (saved.never && saved.never[k] === true) st.adds.never[k] = true;
        if (['any', 'up', 'down', '1', '2', '3', '4'].includes(String(saved.count))) st.adds.count = String(saved.count);
        st.review = saved.review === true;
      }
    } catch {}
    const saveAdds = () => { try { localStorage.setItem(ADDS_KEY, JSON.stringify({ demand: st.adds.demand, never: st.adds.never, count: st.adds.count, review: st.review })); } catch {} };
    const addOk = (it) => {
      if (!it) return false;
      const a = st.adds;
      if (a.demand !== 'any' && !((DEMAND_RANK[it.demand] ?? -1) >= DEMAND_RANK[a.demand])) return false;
      if (a.never.rap && !(itemValue(it) > 0)) return false;
      if (a.never.face && Number(it.type) === 18) return false;
      if (a.never.gear && Number(it.type) === 19) return false;
      if (a.never.trend && /lower|unstable|fluctuat|drop/i.test(String(it.trend || ''))) return false;
      return true;
    };
    const root = el('div', 'routility-ads-post routility-mass');
    const form = el('div', 'routility-ads-form-grid');
    const sides = {};

    const makeSide = (key, title) => {
      const panel = el('section', 'routility-ads-panel bg-surface-100 radius-large');
      const head = el('div', 'routility-ads-panel-head');
      const count = el('span', 'text-body-small content-muted');
      head.append(el('h2', 'text-heading-small content-emphasis margin-none', title), count);
      const total = el('span', 'routility-mass-total');
      head.appendChild(total);
      const slots = el('div', 'routility-ads-slots');
      panel.append(head, slots);
      const side = { key, panel, count, slots, total };
      const search = finput(key === 'off' ? lt('Search your inventory') : lt('Search all limiteds'));
      const glass = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
      glass.setAttribute('aria-hidden', 'true');
      search.insertBefore(glass, search.input);
      const row = el('div', 'routility-mass-inputs');
      row.appendChild(search);
      panel.appendChild(row);
      if (key === 'look') {
        const mix = fbutton(lt('Shuffle'), 'bg-action-standard content-action-standard', () => shuffle());
        mix.classList.add('routility-mass-shuffle');
        mix.dataset.rtTip = lt('Pick random items worth this much more than your offer in USD and Value, favoring good demand');
        const pct = finput(lt('Upgrade'), { inputmode: 'numeric', max: 3 });
        pct.classList.add('routility-mass-pct');
        pct.input.setAttribute('aria-label', lt('Upgrade %'));
        let saved = '';
        try { saved = localStorage.getItem('routilityShufflePct') || ''; } catch {}
        pct.input.value = /^\d{1,3}$/.test(saved) ? saved : '15';
        pct.insertBefore(el('span', 'text-body-medium content-muted routility-mass-pct-sign', '+'), pct.input);
        pct.appendChild(el('span', 'text-body-medium content-muted routility-mass-pct-sign', '%'));
        pct.input.addEventListener('input', () => {
          pct.input.value = pct.input.value.replace(/\D/g, '');
          try { localStorage.setItem('routilityShufflePct', pct.input.value); } catch {}
        });
        pct.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') shuffle(); });
        row.append(pct, mix);
        side.shuffle = mix;
        side.pct = pct;
      }
      if (key === 'off') {
        const amount = finput(lt('Add Robux'), { inputmode: 'numeric', max: 13 });
        amount.classList.add('routility-mass-robux');
        amount.insertBefore(robuxIcon(), amount.input);
        row.appendChild(amount);
        side.amount = amount;
        amount.input.addEventListener('input', () => {
          amount.input.value = amount.input.value.replace(/[^\d.,kKmM]/g, '').replace(/([kKmM]).+$/, '$1');
          if (st.job) return;
          const raw = amount.input.value.trim();
          const unit = /[kK]$/.test(raw) ? 1e3 : /[mM]$/.test(raw) ? 1e6 : 1;
          const v = unit > 1 ? Math.round(window.RoUtilityUI.parseAmount(raw.slice(0, -1)) * unit) : window.RoUtilityUI.parseAmount(raw, true);
          st.off = st.off.filter(e => e.kind !== 'robux');
          if (v > 0) st.off.push({ kind: 'robux', amount: v });
          picks();
        });
        amount.input.addEventListener('blur', () => { if (!st.job) picks(); });
      }
      const grid = el('div', 'routility-ads-grid');
      panel.appendChild(grid);
      side.search = search;
      side.grid = grid;
      let typing = 0;
      search.input.addEventListener('input', () => {
        clearTimeout(typing);
        typing = setTimeout(() => paintGrid(side), 120);
      });
      sides[key] = side;
      return panel;
    };

    form.append(makeSide('off', lt('You Offer')), makeSide('look', lt('You Want')));
    const sendPanel = el('section', 'routility-ads-panel routility-ads-note-panel routility-mass-panel bg-surface-100 radius-large');
    const sendHead = el('div', 'routility-ads-panel-head');
    const reach = el('span', 'text-body-small content-muted');
    sendHead.append(el('h2', 'text-heading-small content-emphasis margin-none', lt('Send To')), reach);
    const opts = el('div', 'routility-mass-opts');
    const footRow = el('div', 'routility-ads-post-foot');
    const start = fbutton(lt('Start Sending'), 'bg-action-emphasis content-action-emphasis');
    const hintEl = el('span', 'text-body-small content-muted');
    const cont = fbutton(lt('Continue'), 'bg-action-emphasis content-action-emphasis');
    cont.hidden = true;
    cont.dataset.rtTip = lt('Picks up where it stopped, skipping everyone it already sent to');
    const test = fbutton(lt('Test Run'), 'bg-action-standard content-action-standard');
    test.dataset.rtTip = lt('Goes through everything, but doesn’t send any trades');
    const savedPick = menuButton(() => lt('Saved setups'), () => [{ plain: true, empty: lt('Nothing saved yet'), items: st.setups.map(x => ({ label: x.name, run: () => loadSetup(x), remove: () => removeSetup(x), removeLabel: lt('Delete') })) }], () => ({ label: lt('Save this setup'), run: saveSetup }));
    savedPick.classList.add('routility-mass-saved');
    footRow.append(cont, start, test, savedPick, hintEl);
    const results = el('div', 'routility-mass-results');
    results.hidden = true;
    const progress = el('div', 'routility-mass-progress');
    progress.hidden = true;
    const status = el('div', 'text-body-medium content-default routility-mass-status');
    status.setAttribute('role', 'status');
    const bar = el('div', 'routility-clean-bar');
    const fill = el('span');
    bar.appendChild(fill);
    const list = el('ul', 'routility-clean-list routility-mass-list');
    progress.append(status, bar, list);
    const rangeFields = el('div', 'routility-mass-rangefields');
    const rangeField = (label, prop, placeholder, opts2) => {
      const wrap = el('label', 'routility-mass-field');
      wrap.appendChild(el('span', 'text-caption-medium content-muted', label));
      const f = finput(placeholder, { inputmode: 'numeric', max: opts2.max });
      f.classList.add('routility-mass-range', opts2.cls);
      if (opts2.logo) {
        const logo = el('img', 'routility-val-logo routility-mass-range-logo');
        logo.alt = '';
        logo.src = chrome.runtime.getURL('assets/icons/logo.png');
        f.insertBefore(logo, f.input);
      }
      f.input.addEventListener('input', () => {
        f.input.value = f.input.value.replace(opts2.logo ? /[^\d.,kmbKMB]/g : /[^\d]/g, '');
        st[prop] = f.input.value.trim();
        paintSlots(sides.look);
        paintStart();
      });
      wrap.appendChild(f);
      rangeFields.appendChild(wrap);
      return f;
    };
    const rFrom = rangeField(lt('From'), 'rangeFrom', lt('e.g. {n}', { n: '25k' }), { max: 14, logo: true, cls: 'routility-mass-range-val' });
    const rTo = rangeField(lt('To'), 'rangeTo', lt('e.g. {n}', { n: '35k' }), { max: 14, logo: true, cls: 'routility-mass-range-val' });
    const rCount = rangeField(lt('How many'), 'rangeCount', lt('Any'), { max: 1, logo: false, cls: 'routility-mass-range-count' });
    sendPanel.append(sendHead, opts, footRow, results, progress);
    root.append(form, sendPanel);

    function hint(text, alert) {
      hintEl.textContent = text || defaultHint();
      hintEl.classList.toggle('routility-ads-hint-alert', !!alert);
    }

    const DEMAND_WEIGHT = { Amazing: 6, High: 4, Normal: 2, Low: 0.5 };

    function shuffle() {
      if (st.job || !s.items.length) return;
      const rate = window.RoUtilityUI.robuxRate(settings);
      const valOf = it => itemValue(it) || it.rap || 0;
      const usdOf = it => Number(it.usd) || 0;
      const offVal = st.off.reduce((t, e) => t + (e.kind === 'robux' ? e.amount : e.kind === 'item' ? valOf(itemInfo(e.assetId)) : 0), 0);
      const offUsd = st.off.reduce((t, e) => t + (e.kind === 'robux' ? e.amount * rate : e.kind === 'item' ? usdOf(itemInfo(e.assetId)) : 0), 0);
      if (!(offVal > 0) && !(offUsd > 0)) return hint(lt('Pick what you’re offering first, then Shuffle finds an upgrade for it.'), true);
      const byUsd = offUsd > 0;
      const offer = byUsd ? offUsd : offVal;
      const worthOf = byUsd ? usdOf : valOf;
      const mine = new Set(st.off.filter(e => e.kind === 'item').map(e => e.assetId));
      const current = new Set(st.look.map(e => e.assetId));
      const pool = s.items.filter(it => !it.projected && it.demand !== 'Terrible' && !mine.has(String(it.id)) && worthOf(it) > 0 && addOk(it));
      const weight = (it) => (DEMAND_WEIGHT[it.demand] || (itemValue(it) ? 1 : 1.5)) * (current.has(String(it.id)) ? 0.3 : 1);
      const draw = (list) => {
        let roll = Math.random() * list.reduce((t, it) => t + weight(it), 0);
        for (const it of list) { roll -= weight(it); if (roll <= 0) return it; }
        return list[list.length - 1];
      };
      const combo = (n, lo, hi) => {
        const got = [];
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const left = n - i;
          const min = left === 1 ? offer * lo - sum : (offer * lo - sum) / left * 0.5;
          const max = left === 1 ? offer * hi - sum : (offer * hi - sum) / left * 1.4;
          const list = pool.filter(it => { const w = worthOf(it); return w >= min && w <= max && got.filter(g => g === it).length < 2; });
          if (!list.length) return null;
          const it = draw(list);
          got.push(it);
          sum += worthOf(it);
        }
        if (sum < offer * lo || sum > offer * hi) return null;
        return got;
      };
      const up = Math.min(300, Number(sides.look.pct && sides.look.pct.input.value) || 0) / 100;
      const goal = 1 + up;
      const now = st.look.map(e => e.assetId).sort().join(',');
      const found = new Map();
      const mineCount = st.off.filter(e => e.kind === 'item').length;
      const want = st.adds.count;
      const sizes = want === 'up' ? [1, 2, 3].filter(k => k < mineCount).concat(mineCount <= 1 ? [1] : []) : want === 'down' ? [2, 3, 4].filter(k => k > mineCount).concat(mineCount >= 4 ? [4] : []) : /^[1-4]$/.test(String(want)) ? [Number(want)] : [1, 2, 3, 4];
      for (let tries = 0; tries < 1500 && found.size < 40; tries++) {
        const n = sizes[Math.floor(Math.random() * sizes.length)];
        const pad = tries < 900 ? 0.05 : 0.12;
        const got = combo(n, Math.max(1, goal - pad), goal + pad);
        if (!got) continue;
        const key = got.map(it => String(it.id)).sort().join(',');
        if (key === now || found.has(key)) continue;
        const u = offUsd > 0 ? got.reduce((t, it) => t + usdOf(it), 0) / offUsd : goal;
        const v = offVal > 0 ? got.reduce((t, it) => t + valOf(it), 0) / offVal : goal;
        if (u < 1 || v < 1) continue;
        found.set(key, { got, miss: Math.abs(u - goal) + Math.abs(v - goal) });
      }
      const best = [...found.values()].sort((x, y) => x.miss - y.miss).slice(0, 5);
      const picked = best.length ? best[Math.floor(Math.random() * best.length)].got : null;
      if (!picked) return hint(lt('No upgrades found for this offer. Try offering a bit more or less.'), true);
      st.look = picked.map(it => ({ kind: 'item', assetId: String(it.id) }));
      st.rangeFrom = '';
      st.rangeTo = '';
      st.rangeCount = '';
      for (const f of [rFrom, rTo, rCount]) if (f && f.input) f.input.value = '';
      picks();
    }

    function defaultHint() {
      return lt('Each person gets their own trade. RoUtility checks their inventory right before sending and skips anyone who no longer has the item. Keep this tab open while it sends.');
    }

    function optRow(label, children) {
      const row = el('div', 'routility-mass-opt');
      const chips = el('div', 'routility-ads-chips');
      chips.append(...children);
      row.append(el('span', 'text-label-medium content-muted routility-mass-opt-label', label), chips);
      return row;
    }

    function menuButton(text, sections, footer, columns) {
      const wrap = el('span', 'routility-mass-pick');
      const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center gap-xsmall stroke-none select-none radius-circle text-label-medium height-800 padding-x-medium bg-shift-300 content-emphasis routility-mass-pick-btn');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      const label = el('span', null, text());
      btn.append(layer(), label, el('span', 'icon routility-calc-icon routility-calc-icon-chevron routility-ads-sort-caret'));
      let menu = null;
      const outside = (e) => { if (!wrap.contains(e.target)) close(); };
      const keys = (e) => { if (e.key === 'Escape') { close(); btn.focus(); } };
      const close = () => {
        if (!menu) return;
        menu.remove();
        menu = null;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', outside, true);
        document.removeEventListener('keydown', keys, true);
      };
      const item = (role, on, labelText) => {
        const it = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center gap-x-medium content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small radius-medium routility-mass-pick-item');
        it.type = 'button';
        it.setAttribute('role', role);
        it.setAttribute('aria-checked', String(on));
        const mark = el('span', role === 'menuitemcheckbox' ? 'routility-mass-pick-box' : 'routility-mass-pick-dot');
        mark.appendChild(el('span', 'icon icon-filled-check size-400'));
        it.append(layer(), mark, el('span', null, labelText));
        return it;
      };
      btn.addEventListener('click', () => {
        if (menu) return close();
        document.querySelectorAll('.routility-mass-pick-menu').forEach(m => m.dispatchEvent(new Event('routility-close')));
        menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small routility-ads-sort-menu routility-mass-pick-menu');
        menu.setAttribute('role', 'menu');
        menu.addEventListener('routility-close', close);
        if (columns) menu.classList.add('routility-mass-pick-cols');
        (typeof sections === 'function' ? sections() : sections).forEach((sec, i) => {
          const host = columns && sec.title ? el('div', 'routility-mass-pick-col') : menu;
          if (host !== menu) menu.appendChild(host);
          if (i && !columns) menu.appendChild(el('div', 'routility-mass-pick-sep'));
          if (sec.title) host.appendChild(el('div', 'text-caption-medium content-muted routility-mass-pick-head', sec.title));
          if (sec.empty && !sec.items.length) host.appendChild(el('div', 'text-body-small content-muted routility-mass-pick-empty', sec.empty));
          for (const o of sec.items) {
            if (sec.plain) {
              const row = el('div', 'routility-mass-pick-row');
              const it = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small radius-medium routility-mass-pick-item');
              it.type = 'button';
              it.setAttribute('role', 'menuitem');
              it.append(layer(), el('span', 'routility-mass-pick-name', o.label));
              it.addEventListener('click', () => { close(); o.run(); });
              row.appendChild(it);
              if (o.remove) {
                const x = el('button', 'relative clip group/interactable focus-visible:outline-focus cursor-pointer stroke-none bg-none radius-medium routility-mass-pick-remove');
                x.type = 'button';
                x.setAttribute('aria-label', o.removeLabel || lt('Remove'));
                x.dataset.rtTip = o.removeLabel || lt('Remove');
                x.append(layer(), el('span', 'icon icon-regular-x size-400'));
                x.addEventListener('click', () => { o.remove(); row.remove(); });
                row.appendChild(x);
              }
              host.appendChild(row);
              continue;
            }
            if (sec.multi) {
              const it = item('menuitemcheckbox', !!o.on(), o.label);
              it.addEventListener('click', () => {
                o.toggle();
                it.setAttribute('aria-checked', String(!!o.on()));
                label.textContent = text();
              });
              host.appendChild(it);
            } else {
              const on = sec.current() === o.value;
              const it = item('menuitemradio', on, o.label);
              it.addEventListener('click', () => { close(); if (sec.current() !== o.value) sec.pick(o.value); });
              host.appendChild(it);
            }
          }
        });
        const foot = typeof footer === 'function' ? footer() : footer;
        if (foot) {
          menu.appendChild(el('div', 'routility-mass-pick-sep'));
          const f = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center content-muted cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small radius-medium routility-mass-pick-item', foot.label);
          f.type = 'button';
          f.addEventListener('click', () => { close(); foot.run(); });
          menu.appendChild(f);
        }
        wrap.appendChild(menu);
        const room = window.innerHeight - menu.getBoundingClientRect().top - 12;
        if (menu.scrollHeight > room) {
          menu.style.maxHeight = Math.max(200, room) + 'px';
          menu.style.overflowY = 'auto';
        }
        btn.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', outside, true);
        document.addEventListener('keydown', keys, true);
        (menu.querySelector('[aria-checked="true"]') || menu.querySelector('button'))?.focus();
      });
      wrap.appendChild(btn);
      wrap.btn = btn;
      wrap.refresh = () => { label.textContent = text(); };
      return wrap;
    }

    function choose(options, current, onChange) {
      return menuButton(() => (options.find(o => o.value === current) || options[0]).label, [{ items: options, current: () => current, pick: onChange }]);
    }

    function ownedText([a, b] = st.owned) {
      const top = OWNED.length - 1;
      if (!a && b === top) return lt('Any length');
      if (b === top) return lt('{time} or more', { time: lt(OWNED[a][1]) });
      if (!a) return lt('Up to {time}', { time: lt(OWNED[b][1]) });
      return lt('{from} to {to}', { from: lt(OWNED[a][1]), to: lt(OWNED[b][1]) });
    }

    function ownedPick() {
      const top = OWNED.length - 1;
      const least = [0, 2, 4, 7].map(i => [i, top]);
      const most = [4, 7].map(i => [0, i]);
      const key = pair => pair.join('-');
      if (![...least, ...most].some(pair => pair[0] === st.owned[0] && pair[1] === st.owned[1])) st.ownedCustom = true;
      const now = () => (st.ownedCustom ? 'custom' : key(st.owned));
      const set = (v) => {
        if (v === 'custom') st.ownedCustom = true;
        else { st.owned = v.split('-').map(Number); st.ownedCustom = false; }
        paintOpts();
      };
      return menuButton(() => (st.ownedCustom ? lt('Custom') : ownedText()), [
        { title: lt('Owned at least'), items: least.map(pair => ({ value: key(pair), label: ownedText(pair) })), current: now, pick: set },
        { title: lt('Owned at most'), items: most.map(pair => ({ value: key(pair), label: ownedText(pair) })), current: now, pick: set },
        { items: [{ value: 'custom', label: lt('Custom') }], current: now, pick: set },
      ]);
    }

    function ownedSlider() {
      const top = OWNED.length - 1;
      const custom = el('div', 'routility-mass-owned-custom');
      const value = el('span', 'text-body-medium content-default routility-mass-owned-val');
      const track = el('div', 'routility-mass-owned-track');
      const ends = el('div', 'routility-mass-owned-ends text-caption-medium content-muted');
      ends.append(el('span', null, lt('0 days')), el('span', null, lt('5+ years')));
      const make = (i, name) => {
        const input = el('input', 'routility-mass-owned-input');
        input.type = 'range';
        input.min = '0';
        input.max = String(top);
        input.step = '1';
        input.value = String(st.owned[i]);
        input.disabled = !!st.job;
        input.setAttribute('aria-label', name);
        input.addEventListener('input', () => {
          let v = Number(input.value);
          v = i ? Math.max(v, st.owned[0] + 1) : Math.min(v, st.owned[1] - 1);
          input.value = String(v);
          st.owned[i] = v;
          paint();
        });
        return input;
      };
      const lo = make(0, lt('Owned at least'));
      const hi = make(1, lt('Owned at most'));
      const paint = () => {
        track.style.setProperty('--rt-lo', (st.owned[0] / top * 100) + '%');
        track.style.setProperty('--rt-hi', (st.owned[1] / top * 100) + '%');
        lo.style.zIndex = st.owned[0] >= top - 1 ? '3' : '';
        value.textContent = ownedText();
      };
      track.addEventListener('pointerdown', (e) => {
        if (st.job || e.target !== track) return;
        const r = track.getBoundingClientRect();
        const v = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left - 10) / (r.width - 20))) * top);
        const i = Math.abs(v - st.owned[0]) <= Math.abs(v - st.owned[1]) && v <= st.owned[1] - 1 ? 0 : 1;
        st.owned[i] = i ? Math.max(v, st.owned[0] + 1) : v;
        (i ? hi : lo).value = String(st.owned[i]);
        paint();
      });
      track.append(lo, hi);
      custom.append(value, track, ends);
      paint();
      return custom;
    }

    function ownedBounds() {
      const [a, b] = st.owned;
      const now = Date.now() / 1000;
      return { newest: a ? now - OWNED[a][0] * 86400 : Infinity, oldest: b < OWNED.length - 1 ? now - OWNED[b][0] * 86400 : 0 };
    }

    function paintOpts() {
      const busy = !!st.job;
      const field = (label, control) => {
        const f = el('div', 'routility-mass-f');
        f.append(el('span', 'text-caption-medium content-muted routility-mass-f-label', label), control);
        return f;
      };
      const reset = async () => {
        if (st.job) return;
        const { all } = await toStore();
        delete all[myId()];
        chrome.storage.local.set({ [TO_KEY]: all });
        st.skip.recent = false;
        st.skip.pending = false;
        st.resume = null;
        paintOpts();
        paintStart();
        hint(lt('Mass Send forgot who you sent to, so your next run can send them a new offer. Their earlier trades stay in your Outbound list.'));
      };
      const skipCount = () => MASS_SKIPS.filter(([k]) => st.skip[k]).length;
      const skipMenu = menuButton(() => (skipCount() ? ltn(skipCount(), '{n} group', '{n} groups', { n: formatNumber(skipCount()) }) : lt('None')), [
        { multi: true, items: MASS_SKIPS.map(([k, label]) => ({ label: lt(label), on: () => st.skip[k], toggle: () => { st.skip[k] = !st.skip[k]; } })) },
      ], { label: lt('Reset who I’ve sent to'), run: reset });
      const neverCount = () => ADD_NEVER.filter(([k]) => st.adds.never[k]).length + (st.adds.count !== 'any' ? 1 : 0);
      const shuffleMenu = menuButton(() => lt((ADD_DEMAND.find(([k]) => k === st.adds.demand) || ADD_DEMAND[0])[1]) + (neverCount() ? ' +' + neverCount() : ''), [
        { items: ADD_DEMAND.map(([k, label]) => ({ value: k, label: lt(label) })), current: () => st.adds.demand, pick: (v) => { st.adds.demand = v; saveAdds(); paintOpts(); } },
        { title: lt('How many items'), items: [{ value: 'any', label: lt('Any number') }, { value: 'up', label: lt('Upgrade') }, { value: 'down', label: lt('Downgrade') }].concat([1, 2, 3, 4].map(n => ({ value: String(n), label: ltn(n, '{n} item', '{n} items', { n: formatNumber(n) }) }))), current: () => st.adds.count, pick: (v) => { st.adds.count = v; saveAdds(); paintOpts(); } },
        { title: lt('Never add'), multi: true, items: ADD_NEVER.map(([k, label]) => ({ label: lt(label), on: () => !!st.adds.never[k], toggle: () => { st.adds.never[k] = !st.adds.never[k]; saveAdds(); } })) },
      ]);
      const line1 = el('div', 'routility-mass-line');
      const theirs = field(lt('Their items worth'), rangeFields);
      theirs.dataset.rtTip = lt('Fills empty You Want boxes with their own items worth this much. Leave blank to skip.');
      line1.append(theirs, el('span', 'routility-mass-line-div'));
      line1.append(field(lt('Find people in'), choose(MASS_SOURCES.map(([k, label]) => ({ value: k, label: lt(label) })), st.source, (v) => { st.source = v; paintOpts(); })));
      if (st.source === 'owners') line1.append(field(lt('Online in the last'), choose(MASS_ACTIVE.map(([k, label]) => ({ value: k, label: lt(label) })), st.active, (v) => { st.active = v; paintOpts(); })));
      line1.append(field(lt('Send up to'), choose(MASS_COUNTS.map(n => ({ value: n, label: ltn(n, '{n} trade', '{n} trades', { n: formatNumber(n) }) })), st.max, (v) => { st.max = v; paintOpts(); })));
      const line2 = el('div', 'routility-mass-line');
      if (st.source === 'owners') line2.append(field(lt('Owned for'), ownedPick()));
      line2.append(field(lt('Skip'), skipMenu), field(lt('Shuffle picks'), shuffleMenu));
      line2.append(field(lt('Before sending'), choose([{ value: 'send', label: lt('Send right away') }, { value: 'review', label: lt('Let me review each trade') }], st.review ? 'review' : 'send', (v) => { st.review = v === 'review'; saveAdds(); paintOpts(); })));
      const rows = [line1, line2];
      if (st.source === 'owners' && st.ownedCustom) rows.push(ownedSlider());
      opts.replaceChildren(...rows);
      opts.querySelectorAll('button, input').forEach(b => { b.disabled = busy; });
      const full = st.look.length >= 4;
      for (const f of [rFrom, rTo, rCount]) f.input.disabled = busy || full;
      rangeFields.classList.toggle('routility-mass-range-off', full);
      reach.textContent = st.source === 'owners' ? lt('People who own what you want, from RoUtility’s owner list') : lt('People whose ads on routility.io offer what you want');
    }

    function paintSlots(side) {
      const list = st[side.key];
      if (side.key === 'off') {
        const n = fillSlots(side.slots, list, (e) => { if (st.job) return; st.off = list.filter(x => x !== e); picks(); }, () => side.search.input.focus(), { cap: false, noCash: true });
        const robux = list.find(e => e.kind === 'robux');
        if (side.amount && document.activeElement !== side.amount.input) side.amount.input.value = robux ? formatNumber(robux.amount) : '';
        side.count.textContent = lt('{count} of {max}', { count: n, max: 4 });
      } else {
        side.count.textContent = lt('{count} of {max}', { count: list.length, max: 4 });
        side.slots.style.gridTemplateColumns = '';
        side.slots.replaceChildren(...Array.from({ length: 4 }, (_, i) => {
          const e = list[i];
          const b = slotView(e, () => { if (st.job) return; st[side.key] = list.filter(x => x !== e); picks(); }, { cap: false });
          if (!e) b.addEventListener('click', () => side.search.input.focus());
          if (!e && range() && typeof range() === 'object') {
            b.classList.add('routility-mass-slot-range');
            b.appendChild(el('span', 'routility-mass-slot-note text-label-small content-muted', lt('Their items')));
          }
          return b;
        }));
      }
      if (side.key === 'look') {
        const full = list.length >= 4;
        for (const f of [rFrom, rTo, rCount]) f.input.disabled = !!st.job || full;
        rangeFields.classList.toggle('routility-mass-range-off', full);
      }
      const items = list.filter(e => e.kind === 'item').map(e => itemInfo(e.assetId));
      const robux = list.filter(e => e.kind === 'robux').reduce((n, e) => n + e.amount, 0);
      const usdSum = items.reduce((n, it) => n + (it.usd || 0), 0) + robux * window.RoUtilityUI.robuxRate(settings);
      const rapSum = items.reduce((n, it) => n + (it.rap || 0), 0) + robux;
      const valSum = items.reduce((n, it) => n + (itemValue(it) || it.rap || 0), 0);
      const r = side.key === 'look' ? range() : null;
      let extra = null;
      if (r && typeof r === 'object') {
        extra = el('span', 'text-label-medium content-muted routility-mass-range-sum');
        const logo = el('img', 'routility-val-logo routility-mass-range-logo');
        logo.alt = '';
        logo.src = chrome.runtime.getURL('assets/icons/logo.png');
        extra.append(document.createTextNode('+'), logo, document.createTextNode(compact(r.lo) + '–' + compact(r.hi)));
        extra.dataset.rtTip = lt('+ {from}–{to} from their items', { from: compact(r.lo), to: compact(r.hi) });
      }
      side.total.replaceChildren(...(list.length ? [totals(usdSum, rapSum, valSum)] : []), ...(extra ? [extra] : []));
    }

    function paintGrid(side) {
      const q = side.search.input.value.trim().toLowerCase();
      const words = q ? q.split(/\s+/) : [];
      const match = (name, extra) => words.every(w => (name + ' ' + (extra || '')).toLowerCase().includes(w));
      const full = goods(st[side.key]).length >= 4;
      if (side.key === 'off') {
        if (st.mine === null) return side.grid.replaceChildren(...Array.from({ length: 12 }, skTile));
        if (st.mine.hidden) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Your inventory is private, so your limiteds can’t be listed. Make it visible to everyone in Roblox privacy settings.')));
        const list = st.mine.items.map(x => ({ x, it: itemInfo(x.assetId, x.name) })).filter(({ it }) => match(it.name, it.acr)).sort((a, b) => (b.it.usd || 0) - (a.it.usd || 0));
        if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', st.mine.items.length ? lt('No limiteds match that.') : lt('You don’t have any limiteds to offer.')));
        return side.grid.replaceChildren(...list.slice(0, 120).map(({ x, it }) => {
          const on = st.off.some(e => e.uaid === x.uaid);
          return itemCard(it, { key: x.uaid, picked: on, serial: x.serial, onHold: x.onHold, disabled: !!st.job || x.onHold || (!on && full), onClick: () => {
            if (st.off.some(e => e.uaid === x.uaid)) st.off = st.off.filter(e => e.uaid !== x.uaid);
            else if (goods(st.off).length < 4) st.off.push({ kind: 'item', assetId: x.assetId, uaid: x.uaid });
            picks();
          } });
        }));
      }
      if (!s.items.length) return side.grid.replaceChildren(...(s.itemsFailed ? [el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Couldn’t load the item list. Refresh the page to try again.'))] : Array.from({ length: 12 }, skTile)));
      const list = s.items.filter(i => match(i.name, (i.acr || '') + ' ' + i.id)).sort((a, b) => (b.usd || 0) - (a.usd || 0));
      if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('No limiteds match that.')));
      side.grid.replaceChildren(...list.slice(0, 120).map(it => {
        const id = String(it.id);
        const count = st.look.filter(e => e.assetId === id).length;
        return itemCard(it, { key: id, picked: count > 0, count, disabled: !!st.job || full, lockMinus: !!st.job, onClick: () => {
          if (st.job) return;
          if (goods(st.look).length < 4) st.look.push({ kind: 'item', assetId: id });
          picks();
        }, onMinus: () => {
          if (st.job) return;
          const at = st.look.findIndex(e => e.assetId === id);
          if (at >= 0) st.look.splice(at, 1);
          picks();
        } });
      }));
    }

    function sideRap(list) {
      return list.reduce((t, e) => t + (e.kind === 'item' ? itemInfo(e.assetId).rap || 0 : 0), 0);
    }

    function range() {
      if (st.look.length >= 4 || (!st.rangeFrom && !st.rangeTo)) return null;
      const parse = (v) => {
        let t = String(v || '').trim().toLowerCase();
        if (/^\d+,\d{1,2}[kmb]?$/.test(t)) t = t.replace(',', '.');
        const m = t.replace(/[,\s]/g, '').match(/^(\d+(?:\.\d+)?)([kmb])?$/);
        return m ? Math.round(Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1)) : NaN;
      };
      const a = parse(st.rangeFrom);
      const c = parse(st.rangeTo);
      if (!(a > 0) || !(c > 0)) return 'bad';
      const count = st.rangeCount ? Number(st.rangeCount) : 0;
      if (st.rangeCount && !(count >= 1 && count <= 4 - st.look.length)) return 'count';
      return { lo: Math.min(a, c), hi: Math.max(a, c), count };
    }

    function balance(extra = 0) {
      const robux = st.off.filter(e => e.kind === 'robux').reduce((n, e) => n + e.amount, 0);
      const give = st.off.filter(e => e.kind === 'item').map(e => itemInfo(e.assetId));
      const get = st.look.map(e => itemInfo(e.assetId));
      const priced = !extra && [...give, ...get].every(it => it.usd > 0);
      const worth = (it) => priced ? it.usd : (itemValue(it) || it.rap || 0);
      const a = give.reduce((n, it) => n + worth(it), 0) + (priced ? robux * window.RoUtilityUI.robuxRate(settings) : robux);
      const c = get.reduce((n, it) => n + worth(it), 0) + extra;
      if (!(a > 0) || !(c > 0)) return null;
      return Math.round(a / c * 100);
    }

    function runSig() {
      return JSON.stringify([st.off, st.look, st.rangeFrom, st.rangeTo, st.rangeCount, st.source, st.active, st.max]);
    }

    function paintTest() {
      queueMicrotask(() => {
        test.hidden = !!st.job;
        test.disabled = start.disabled;
        savedPick.btn.disabled = !!st.job;
        results.querySelectorAll('button').forEach(b => { b.disabled = !!st.job || !!st.cancelling; });
        const can = !!(st.resume && !st.job && st.resume.sig === runSig());
        cont.hidden = !can;
        cont.disabled = start.disabled;
        start.classList.toggle('bg-action-emphasis', !can || !!st.job);
        start.classList.toggle('content-action-emphasis', !can || !!st.job);
        start.classList.toggle('bg-action-standard', can && !st.job);
        start.classList.toggle('content-action-standard', can && !st.job);
      });
    }

    function offBalance() {
      const r = range();
      const checks = r && typeof r === 'object' ? [balance(r.lo), balance(r.hi)] : [balance()];
      for (const p of checks) if (p !== null && (p < 50 || p > 200)) return p;
      return null;
    }

    function paintStart() {
      paintTest();
      if (st.job) {
        start.label.textContent = st.job.stop ? lt('Stopping') : lt('Stop');
        start.disabled = st.job.stop;
        start.classList.remove('bg-action-emphasis', 'content-action-emphasis');
        start.classList.add('bg-system-alert', 'content-inverse-emphasis');
        return;
      }
      start.label.textContent = lt('Start Sending');
      start.classList.add('bg-action-emphasis', 'content-action-emphasis');
      start.classList.remove('bg-system-alert', 'content-inverse-emphasis');
      const items = st.off.filter(e => e.kind === 'item');
      const free = st.allow && st.allow.freeTradesAllowance;
      const limited = free && Number(free.limit) > 0 && Number(free.remaining) >= 0;
      const ranged = range();
      const wantOk = st.look.length > 0 || (ranged && typeof ranged === 'object');
      start.disabled = !items.length || !wantOk;
      if (st.allow && st.allow.canTrade === false) {
        start.disabled = true;
        return hint(lt('You can’t trade right now'), true);
      }
      if (limited && Number(free.remaining) === 0) {
        start.disabled = true;
        return hint(lt('You’re out of free trades this month, so Roblox won’t send more. Roblox Plus gives unlimited trades.'), true);
      }
      const rangeMsg = ranged === 'bad' ? lt('Fill in both From and To, or leave both blank.') : ranged === 'count' ? ltn(4 - st.look.length, 'How many can be 1, since you have {n} empty box under You Want.', 'How many can be 1 to {n}, the empty boxes under You Want.', { n: 4 - st.look.length }) : '';
      if (rangeMsg) {
        start.disabled = true;
        return hint(rangeMsg, true);
      }
      if (!items.length || !wantOk) return hint(lt('Pick at least one of your items, and at least one item you want or a value range for their items. Roblox needs an item on each side of a trade.'));
      const bad = offBalance();
      if (bad !== null) {
        start.disabled = true;
        return hint(lt('Your offer is worth {pct}% of what you’re asking. It has to be between 50% and 200%.', { pct: bad }), true);
      }
      const give = sideRap(items) + (st.off.find(e => e.kind === 'robux')?.amount || 0);
      const get = sideRap(st.look);
      const ratio = Number(st.meta && st.meta.minValueRatio) || 0;
      if (ratio > 0 && give > 0 && get > 0 && (give < get * ratio || get < give * ratio)) return hint(lt('Roblox only sends trades where each side’s RAP is at least {pct}% of the other’s, so this offer would be refused.', { pct: Math.round(ratio * 100) }), true);
      if (st.today !== null && st.today >= DAILY) {
        start.disabled = true;
        return hint(lt('You’ve sent about {max} trades in the last 24 hours, which is Roblox’s limit. Try again later.', { max: DAILY }), true);
      }
      const notes = [];
      if (st.today !== null) notes.push(lt('{left} of {max} trades left today', { left: formatNumber(DAILY - st.today), max: DAILY }) + '.');
      if (limited) notes.push(lt('{left} of {limit} free trades left this month', { left: Number(free.remaining), limit: free.limit }) + '.');
      hint(notes.length ? notes.join(' ') + ' ' + defaultHint() : '');
    }

    function paint() {
      paintSlots(sides.off);
      paintSlots(sides.look);
      paintGrid(sides.off);
      paintGrid(sides.look);
      paintOpts();
      paintStart();
      root.classList.toggle('routility-mass-busy', !!st.job);
    }

    function picks() {
      paintSlots(sides.off);
      paintSlots(sides.look);
      syncCards(sides.off.grid, k => st.off.some(e => e.uaid === k), goods(st.off).length >= 4, st.job);
      paintGrid(sides.look);
      paintOpts();
      paintStart();
      root.classList.toggle('routility-mass-busy', !!st.job);
    }

    async function robloxGet(url, job) {
      for (let tries = 0; tries < 4 && !job.stop; tries++) {
        let r;
        try {
          r = await fetch(url, { credentials: 'include' });
        } catch {
          await wait(1500);
          continue;
        }
        if (r.status === 429) {
          await cooldown(job, Number(r.headers.get('retry-after')), 15);
          tries--;
          continue;
        }
        return { status: r.status, body: r.ok ? await r.json().catch(() => null) : null };
      }
      return { status: 0, body: null };
    }

    async function cooldown(job, retryAfter, base) {
      job.backoff = Math.min(Math.max((job.backoff || base / 2) * 2, base), 900);
      const until = Date.now() + (retryAfter > 0 ? retryAfter : job.backoff) * 1000;
      job.waiting = true;
      setStatus(lt('Roblox asked to slow down. Sending resumes at {time}.', { time: clock(until) }));
      while (!job.stop && Date.now() < until) await wait(500);
      job.waiting = false;
      setStatus();
    }

    let statusText = '';
    function setStatus(text) {
      const job = st.job;
      if (text !== undefined) statusText = text;
      if (!job) return;
      const cap = job.cap || st.max;
      status.textContent = statusText || lt('Sent {sent} of {max}, skipped {skipped}', { sent: formatNumber(job.sent), max: formatNumber(cap), skipped: formatNumber(job.skipped) });
      fill.style.width = Math.min(100, job.sent / cap * 100) + '%';
    }

    function addRow(c) {
      const li = el('li', 'routility-clean-item routility-clean-working');
      const names = el('span', 'routility-clean-item-names');
      const link = el('a', 'text-label-medium content-emphasis text-truncate-end', c.name ? '@' + c.name : lt('User {id}', { id: c.id }));
      link.href = `https://www.roblox.com/users/${c.id}/profile`;
      link.target = '_blank';
      link.rel = 'noopener';
      names.appendChild(link);
      const info = el('span', 'text-caption-medium content-muted routility-clean-item-info', lt('Checking'));
      const face = el('span', 'routility-sk routility-sk-circle routility-mass-face');
      const who = el('span', 'routility-mass-who');
      who.append(face, names);
      li.append(who, info);
      request({ type: 'getHeadshots', ids: [String(c.id)] }, r => r && typeof r === 'object').then(pics => {
        const src = pics && pics[String(c.id)];
        if (!src) return;
        const img = el('img', 'routility-fade');
        img.alt = '';
        img.addEventListener('load', () => { img.classList.add('routility-loaded'); face.classList.remove('routility-sk'); }, { once: true });
        img.src = src;
        face.appendChild(img);
      });
      list.prepend(li);
      while (list.children.length > 200) list.lastChild.remove();
      const done = (kind, text) => {
        li.classList.remove('routility-clean-working');
        li.classList.add('routility-mass-' + kind);
        info.textContent = text;
      };
      let codeNote = null;
      let codeErr = '';
      done.codeError = (text) => { codeErr = text; };
      done.code = (text, key) => new Promise((res) => {
        const job = st.job;
        info.textContent = text;
        info.classList.add('routility-mass-asking');
        const box = el('span', 'routility-mass-review routility-mass-code');
        const field = finput(lt('6-digit code'), { inputmode: 'numeric', max: 8 });
        field.classList.add('routility-mass-code-field');
        field.input.autocomplete = 'one-time-code';
        const go = fbutton(lt('Verify'), 'bg-action-emphasis content-action-emphasis');
        const no = fbutton(lt('Cancel'), 'bg-shift-300 content-action-utility');
        codeNote = el('span', 'text-caption-medium routility-mass-code-note', codeErr);
        codeNote.hidden = !codeErr;
        codeErr = '';
        if (key) box.append(no, go);
        else box.append(field, no, go);
        li.append(box, codeNote);
        li.classList.add('routility-mass-reviewing');
        setStatus(lt('Roblox wants to check it’s really you'));
        const end = (v) => {
          box.remove();
          codeNote.remove();
          codeNote = null;
          li.classList.remove('routility-mass-reviewing');
          info.classList.remove('routility-mass-asking');
          if (job) job.wake = null;
          setStatus('');
          res(v);
        };
        const submit = () => { if (key) return end('key'); const v = field.input.value.replace(/\D/g, ''); if (v.length >= 6) end(v); else field.input.focus(); };
        field.input.addEventListener('input', () => { field.input.value = field.input.value.replace(/\D/g, ''); if (codeNote) codeNote.hidden = true; });
        field.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        go.addEventListener('click', submit);
        no.addEventListener('click', () => end(null));
        if (job) job.wake = () => end(null);
        (key ? go : field.input).focus();
      });
      done.ask = (text) => new Promise((res) => {
        const job = st.job;
        info.textContent = text;
        info.classList.add('routility-mass-asking');
        const btns = el('span', 'routility-mass-review');
        const go = fbutton(lt('Send'), 'bg-action-emphasis content-action-emphasis');
        const no = fbutton(lt('Skip'), 'bg-shift-300 content-action-utility');
        btns.append(no, go);
        li.appendChild(btns);
        li.classList.add('routility-mass-reviewing');
        setStatus(lt('Check this trade, then press Send or Skip'));
        const end = (v) => {
          btns.remove();
          li.classList.remove('routility-mass-reviewing');
          info.classList.remove('routility-mass-asking');
          if (job) job.wake = null;
          setStatus('');
          res(v);
        };
        go.addEventListener('click', () => end('send'));
        no.addEventListener('click', () => end('skip'));
        if (job) job.wake = () => end('stop');
        go.focus();
      });
      return done;
    }

    async function outbound(job) {
      const partners = new Set();
      const recent = new Map();
      let cursor = '';
      for (let p = 0; p < 15 && !job.stop; p++) {
        const r = await robloxGet(`https://trades.roblox.com/v1/trades/outbound?sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, job);
        if (!r.body || !Array.isArray(r.body.data)) return { partners, recent, failed: p === 0 };
        for (const t of r.body.data) {
          if (t.user && t.user.id) partners.add(String(t.user.id));
          const at = new Date(t.created).getTime();
          if (Date.now() - at < DAY) recent.set(String(t.id), at);
        }
        cursor = r.body.nextPageCursor || '';
        if (!cursor) break;
      }
      return { partners, recent };
    }

    function sentStore() {
      return new Promise(res => chrome.storage.local.get(SENT_KEY, (v) => {
        const all = (v && v[SENT_KEY]) || {};
        const mine = all[myId()] || {};
        for (const [id, at] of Object.entries(mine)) if (!(Date.now() - at < DAY)) delete mine[id];
        res({ all, mine });
      }));
    }

    async function rememberSent(id) {
      const { all, mine } = await sentStore();
      mine[id] = Date.now();
      all[myId()] = mine;
      chrome.storage.local.set({ [SENT_KEY]: all });
    }

    function toStore() {
      return new Promise(res => chrome.storage.local.get(TO_KEY, (v) => {
        const all = (v && v[TO_KEY]) || {};
        const mine = all[myId()] || {};
        for (const [id, at] of Object.entries(mine)) if (!(Date.now() - at < WEEK)) delete mine[id];
        res({ all, mine });
      }));
    }

    function blockStore() {
      return new Promise(res => chrome.storage.local.get(BLOCK_KEY, (v) => {
        const all = (v && v[BLOCK_KEY]) || {};
        const mine = all[myId()] || {};
        for (const [id, at] of Object.entries(mine)) if (!(Date.now() - at < WEEK)) delete mine[id];
        res({ all, mine });
      }));
    }

    async function rememberBlocked(id) {
      const { all, mine } = await blockStore();
      mine[String(id)] = Date.now();
      all[myId()] = mine;
      chrome.storage.local.set({ [BLOCK_KEY]: all });
    }

    async function rememberTo(id) {
      const { all, mine } = await toStore();
      mine[String(id)] = Date.now();
      all[myId()] = mine;
      chrome.storage.local.set({ [TO_KEY]: all });
    }

    function runStore() {
      return new Promise(res => chrome.storage.local.get(RUNS_KEY, (v) => {
        const all = (v && v[RUNS_KEY]) || {};
        const raw = all[myId()];
        const mine = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        mine.runs = (Array.isArray(mine.runs) ? mine.runs : []).filter(r => r && Array.isArray(r.ids) && Date.now() - r.at < 14 * DAY).slice(0, 20);
        mine.cancel = [1, 2, 3].includes(mine.cancel) ? mine.cancel : 0;
        res({ all, mine });
      }));
    }

    let runWrite = Promise.resolve();
    function rememberRun(id) {
      const at = st.runAt;
      if (!at || !id) return;
      runWrite = runWrite.then(async () => {
        const { all, mine } = await runStore();
        let run = mine.runs.find(r => r.at === at);
        if (!run) {
          run = { at, ids: [] };
          mine.runs.unshift(run);
        }
        if (!run.ids.includes(id)) run.ids.push(id);
        all[myId()] = mine;
        await chrome.storage.local.set({ [RUNS_KEY]: all });
      }).catch(() => {});
    }

    async function tradesSince(type, since) {
      const out = new Map();
      let cursor = '';
      for (let p = 0; p < 10; p++) {
        let body = null;
        try {
          const r = await fetch(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { credentials: 'include' });
          if (r.ok) body = await r.json();
        } catch {}
        if (!body || !Array.isArray(body.data)) return p ? out : null;
        let older = false;
        for (const t of body.data) {
          if (new Date(t.created).getTime() < since - 120000) { older = true; continue; }
          out.set(String(t.id), String(t.status || ''));
        }
        cursor = body.nextPageCursor || '';
        if (!cursor || older) break;
      }
      return out;
    }

    async function declineOne(id) {
      for (let i = 0; i < 6; i++) {
        try {
          const r = await fetch(`https://trades.roblox.com/v1/trades/${id}/decline`, { method: 'POST', credentials: 'include', headers: massCsrf ? { 'x-csrf-token': massCsrf } : {} });
          if (r.status === 403 && r.headers.get('x-csrf-token')) { massCsrf = r.headers.get('x-csrf-token'); continue; }
          if (r.status === 429) { await wait(5000 * (i + 1)); continue; }
          return r.ok;
        } catch {
          await wait(1500);
        }
      }
      return false;
    }

    let resultsAt = 0;
    async function paintResults() {
      const ticket = ++resultsAt;
      const { mine } = await runStore();
      st.cancel = mine.cancel;
      const run = mine.runs.find(r => r.ids.length);
      if (!run) {
        results.hidden = true;
        return;
      }
      const [open, done, gone] = await Promise.all([tradesSince('outbound', run.at), tradesSince('completed', run.at), tradesSince('inactive', run.at)]);
      if (ticket !== resultsAt) return;
      const n = { sent: run.ids.length, accepted: 0, countered: 0, declined: 0, waiting: 0 };
      const waiting = [];
      for (const id of run.ids) {
        if (open && open.has(id)) { n.waiting++; waiting.push(id); }
        else if (done && done.has(id)) n.accepted++;
        else if (gone && gone.get(id) === 'Countered') n.countered++;
        else if (gone && gone.has(id)) n.declined++;
      }
      const known = !!(open && done && gone);
      const stat = (value, text, cls) => {
        const b = el('span', 'text-body-small content-muted routility-mass-stat' + (cls ? ' ' + cls : ''));
        b.append(el('b', 'content-emphasis', formatNumber(value)), document.createTextNode(' ' + text));
        return b;
      };
      const stats = el('div', 'routility-mass-stats');
      stats.appendChild(el('span', 'text-caption-medium content-muted routility-mass-results-label', lt('Last run, {time}', { time: ago(run.at) })));
      stats.appendChild(stat(n.sent, lt('sent')));
      if (known) {
        stats.appendChild(stat(n.accepted, lt('accepted'), n.accepted ? 'routility-mass-stat-good' : ''));
        stats.appendChild(stat(n.countered, lt('countered')));
        stats.appendChild(stat(n.declined, lt('declined')));
        stats.appendChild(stat(n.waiting, lt('waiting')));
      }
      const dayText = (d) => d ? ltn(d, 'Cancel after {n} day', 'Cancel after {n} days', { n: formatNumber(d) }) : lt('Keep waiting trades');
      const cancelPick = menuButton(() => dayText(st.cancel), [
        { title: lt('If they don’t answer'), items: [0, 1, 2, 3].map(d => ({ value: d, label: dayText(d) })), current: () => st.cancel, pick: (v) => setCancel(v, cancelPick) },
      ], () => (waiting.length ? { label: ltn(waiting.length, 'Cancel {n} waiting trade now', 'Cancel {n} waiting trades now', { n: formatNumber(waiting.length) }), run: () => cancelNow(waiting) } : null));
      cancelPick.dataset.rtTip = lt('Cancels Mass Send trades nobody answered, even while Roblox isn’t open');
      results.replaceChildren(stats, cancelPick);
      results.hidden = false;
      paintTest();
    }

    async function setCancel(v, pickEl) {
      const { all, mine } = await runStore();
      mine.cancel = v;
      all[myId()] = mine;
      await chrome.storage.local.set({ [RUNS_KEY]: all });
      st.cancel = v;
      pickEl.refresh();
    }

    async function cancelNow(ids) {
      if (st.job || st.cancelling || !ids.length) return;
      const ok = await window.RoUtilityUI.confirmDialog({
        title: ltn(ids.length, 'Cancel {n} waiting trade?', 'Cancel {n} waiting trades?', { n: formatNumber(ids.length) }),
        text: lt('They’re taken off your Outbound list and the other person can’t accept them anymore.'),
        confirm: lt('Cancel Trades'),
        cancel: lt('Keep Them'),
      });
      if (!ok) return;
      st.cancelling = true;
      paintTest();
      let gone = 0;
      const label = results.querySelector('.routility-mass-results-label');
      for (const [i, id] of ids.entries()) {
        if (label) label.textContent = lt('Cancelling {n} of {total}', { n: formatNumber(i + 1), total: formatNumber(ids.length) });
        if (await declineOne(id)) gone++;
        await wait(600);
      }
      st.cancelling = false;
      await paintResults();
      hint(gone === ids.length ? ltn(gone, 'Cancelled {n} trade.', 'Cancelled {n} trades.', { n: formatNumber(gone) }) : lt('Cancelled {n} of {total}. Roblox refused the rest, so try again in a minute.', { n: formatNumber(gone), total: formatNumber(ids.length) }), gone !== ids.length);
    }

    function setupStore() {
      return new Promise(res => chrome.storage.local.get(SETUPS_KEY, (v) => {
        const all = (v && v[SETUPS_KEY]) || {};
        const mine = Array.isArray(all[myId()]) ? all[myId()].filter(x => x && typeof x === 'object' && x.name) : [];
        res({ all, mine });
      }));
    }

    function snapshot() {
      return {
        off: st.off.map(e => ({ ...e })),
        look: st.look.map(e => ({ ...e })),
        rangeFrom: st.rangeFrom, rangeTo: st.rangeTo, rangeCount: st.rangeCount,
        source: st.source, active: st.active, max: st.max,
        owned: [...st.owned], ownedCustom: st.ownedCustom,
        skip: { ...st.skip },
        adds: { demand: st.adds.demand, never: { ...st.adds.never }, count: st.adds.count },
        review: st.review,
      };
    }

    function setupName() {
      const names = (list) => {
        const n = list.map(e => itemInfo(e.assetId).name);
        return n.length > 2 ? lt('{items} and {n} more', { items: n.slice(0, 2).join(', '), n: n.length - 2 }) : n.join(', ');
      };
      const give = names(st.off.filter(e => e.kind === 'item'));
      const items = st.look.filter(e => e.kind === 'item');
      const r = range();
      const want = items.length ? names(items) : r && typeof r === 'object' ? lt('{from} to {to}', { from: st.rangeFrom, to: st.rangeTo }) : '';
      return want ? lt('{give} for {want}', { give, want }) : give;
    }

    async function saveSetup() {
      if (st.job) return;
      if (!st.off.some(e => e.kind === 'item')) return hint(lt('Pick at least one of your items first, then save.'), true);
      const snap = snapshot();
      const sig = JSON.stringify(snap);
      const name = setupName();
      const { all, mine } = await setupStore();
      const list = [{ name, at: Date.now(), sig, ...snap }].concat(mine.filter(x => x.sig !== sig)).slice(0, 10);
      all[myId()] = list;
      await chrome.storage.local.set({ [SETUPS_KEY]: all });
      st.setups = list;
      hint(lt('Saved as {name}. Open Saved setups to use it again.', { name }));
    }

    async function removeSetup(x) {
      const { all, mine } = await setupStore();
      const list = mine.filter(y => y.sig !== x.sig);
      all[myId()] = list;
      await chrome.storage.local.set({ [SETUPS_KEY]: all });
      st.setups = list;
    }

    function loadSetup(x) {
      if (st.job) return;
      const have = st.mine && !st.mine.failed ? new Set(st.mine.items.map(i => String(i.uaid))) : null;
      const off = (Array.isArray(x.off) ? x.off : []).filter(e => e && ((e.kind === 'robux' && Number(e.amount) > 0) || (e.kind === 'item' && e.uaid && e.assetId)));
      const missing = have ? off.filter(e => e.kind === 'item' && !have.has(String(e.uaid))) : [];
      st.off = off.filter(e => !missing.includes(e)).map(e => e.kind === 'robux' ? { kind: 'robux', amount: Number(e.amount) } : { kind: 'item', assetId: String(e.assetId), uaid: String(e.uaid) });
      st.look = (Array.isArray(x.look) ? x.look : []).filter(e => e && ((e.kind === 'item' && e.assetId) || (e.kind === 'tag' && TAGS.includes(e.tag)))).slice(0, 4).map(e => e.kind === 'tag' ? { kind: 'tag', tag: e.tag } : { kind: 'item', assetId: String(e.assetId) });
      const text = (v) => (typeof v === 'string' ? v.replace(/[^\d.,kmbKMB]/g, '').slice(0, 14) : '');
      st.rangeFrom = text(x.rangeFrom);
      st.rangeTo = text(x.rangeTo);
      st.rangeCount = /^[1-4]$/.test(String(x.rangeCount)) ? String(x.rangeCount) : '';
      if (MASS_SOURCES.some(([k]) => k === x.source)) st.source = x.source;
      if (MASS_ACTIVE.some(([k]) => k === x.active)) st.active = x.active;
      if (MASS_COUNTS.includes(x.max)) st.max = x.max;
      if (Array.isArray(x.owned) && x.owned.length === 2 && x.owned.every(v => Number.isInteger(v) && v >= 0 && v < OWNED.length) && x.owned[0] < x.owned[1]) st.owned = [...x.owned];
      st.ownedCustom = x.ownedCustom === true;
      if (x.skip && typeof x.skip === 'object') for (const [k] of MASS_SKIPS) st.skip[k] = x.skip[k] === true;
      if (x.adds && typeof x.adds === 'object') {
        if (ADD_DEMAND.some(([k]) => k === x.adds.demand)) st.adds.demand = x.adds.demand;
        st.adds.never = {};
        for (const [k] of ADD_NEVER) if (x.adds.never && x.adds.never[k] === true) st.adds.never[k] = true;
        if (['any', 'up', 'down', '1', '2', '3', '4'].includes(String(x.adds.count))) st.adds.count = String(x.adds.count);
      }
      st.review = x.review === true;
      saveAdds();
      rFrom.input.value = st.rangeFrom;
      rTo.input.value = st.rangeTo;
      rCount.input.value = st.rangeCount;
      const robux = st.off.find(e => e.kind === 'robux');
      sides.off.amount.input.value = robux ? formatNumber(robux.amount) : '';
      paint();
      hint(missing.length ? lt('Loaded {name}. {items} isn’t in your inventory anymore, so it was left out.', { name: x.name, items: missing.map(e => itemInfo(e.assetId).name).join(', ') }) : lt('Loaded {name}.', { name: x.name }), missing.length > 0);
    }

    async function partnersIn(type, pages, job) {
      const ids = new Set();
      let cursor = '';
      for (let p = 0; p < pages && !job.stop; p++) {
        const r = await robloxGet(`https://trades.roblox.com/v1/trades/${type}?sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, job);
        if (!r.body || !Array.isArray(r.body.data)) break;
        for (const t of r.body.data) if (t.user && t.user.id) ids.add(String(t.user.id));
        cursor = r.body.nextPageCursor || '';
        if (!cursor) break;
      }
      return ids;
    }

    async function countToday(job) {
      const [out, store] = await Promise.all([outbound(job), sentStore()]);
      if (out.failed) return { count: null, partners: out.partners };
      let added = false;
      for (const [id, at] of out.recent) if (!store.mine[id]) { store.mine[id] = at; added = true; }
      if (added) {
        store.all[myId()] = store.mine;
        chrome.storage.local.set({ [SENT_KEY]: store.all });
      }
      return { count: Object.keys(store.mine).length, partners: out.partners };
    }

    function rangeTargets() {
      const r = range();
      if (!r || typeof r !== 'object') return [];
      const list = s.items.filter(i => {
        const v = itemValue(i) || i.rap || 0;
        return v >= r.lo && v <= r.hi;
      });
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list.map(i => String(i.id));
    }

    async function* candidates(job) {
      const want = st.look.map(e => e.assetId);
      if (!want.length) {
        const targets = rangeTargets();
        if (!targets.length) return;
        if (st.source === 'ads') {
          const fits = new Set(targets);
          for (let page = 0; page < 50 && !job.stop; page++) {
            const res = await request({ type: 'tradeAdsList', params: { page } }, r => r && r.status !== 0);
            const ads = res && res.data && Array.isArray(res.data.ads) ? res.data.ads : null;
            if (!ads || !ads.length) return;
            for (const ad of ads) {
              if (!/^\d+$/.test(String(ad.roblox_id || ''))) continue;
              if (!(ad.offering || []).some(x => fits.has(String(x.asset_id)))) continue;
              yield { id: String(ad.roblox_id), name: String(ad.roblox_username || '') };
            }
          }
          return;
        }
        const days = st.active === 'any' ? 0 : Number(st.active);
        const cutoff = days ? Date.now() / 1000 - days * 86400 : 0;
        const held = ownedBounds();
        const live = targets.map(id => ({ id, page: 0, done: false }));
        for (let round = 0; round < 40 && !job.stop && live.some(t => !t.done); round++) {
          for (const t of live) {
            if (t.done || job.stop) continue;
            const res = await request({ type: 'massOwners', id: t.id, page: t.page }, r => r !== undefined);
            t.page++;
            if (!res || !res.more) t.done = true;
            for (const o of (res && res.owners) || []) {
              if (o.since && o.since < held.oldest) { t.done = true; break; }
              if (o.since > held.newest) continue;
              if (cutoff && !(o.active >= cutoff)) continue;
              yield o;
            }
          }
        }
        return;
      }
      if (st.source === 'ads') {
        for (let page = 0; page < 50 && !job.stop; page++) {
          const res = await request({ type: 'tradeAdsList', params: { page, itemId: want[0] } }, r => r && r.status !== 0);
          const ads = res && res.data && Array.isArray(res.data.ads) ? res.data.ads : null;
          if (!ads || !ads.length) return;
          for (const ad of ads) {
            if (!/^\d+$/.test(String(ad.roblox_id || ''))) continue;
            const offered = new Set((ad.offering || []).map(x => String(x.asset_id)));
            if (!want.every(a => offered.has(a))) continue;
            yield { id: String(ad.roblox_id), name: String(ad.roblox_username || '') };
          }
        }
        return;
      }
      const days = st.active === 'any' ? 0 : Number(st.active);
      const cutoff = days ? Date.now() / 1000 - days * 86400 : 0;
      const held = ownedBounds();
      for (let page = 0; page < 400 && !job.stop; page++) {
        const res = await request({ type: 'massOwners', id: want[0], page }, r => r !== undefined);
        if (!res) return;
        for (const o of res.owners) {
          if (o.since && o.since < held.oldest) return;
          if (o.since > held.newest) continue;
          if (cutoff && !(o.active >= cutoff)) continue;
          yield o;
        }
        if (!res.more) return;
      }
    }

    async function copiesOf(userId, job) {
      const need = new Map();
      for (const e of st.look) need.set(e.assetId, (need.get(e.assetId) || 0) + 1);
      const lookup = window.RoUtilityUI.catalogFor(s.items);
      const got = new Map();
      const held = new Set();
      const r = range();
      const fill = r && typeof r === 'object' ? r : null;
      const pool = [];
      let cursor = '';
      for (let p = 0; p < 60 && !job.stop; p++) {
        const r = await robloxGet(`https://trades.roblox.com/v2/users/${userId}/tradableItems?sortBy=CreationTime&sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, job);
        if (!r.body || !Array.isArray(r.body.items)) return { status: r.status === 403 ? 'private' : 'error' };
        for (const it of r.body.items) {
          const t = it.itemTarget || {};
          if (!t.targetId) continue;
          const bundle = t.itemType === 'Bundle';
          const item = bundle ? lookup({ targetId: String(t.targetId), bundle: true }) : null;
          const assetId = bundle ? (item ? String(item.id) : '') : String(t.targetId);
          const wanted = need.has(assetId);
          if (!wanted && !fill) continue;
          const info = assetId ? s.byId.get(assetId) : null;
          const worth = info ? (itemValue(info) || info.rap || 0) : 0;
          for (const x of (Array.isArray(it.instances) && it.instances.length ? it.instances : [it])) {
            if (!CIID.test(String(x.collectibleItemInstanceId || ''))) continue;
            if (x.isOnHold) { if (wanted) held.add(assetId); continue; }
            if (wanted && (got.get(assetId) || []).length < need.get(assetId)) {
              if (!got.has(assetId)) got.set(assetId, []);
              got.get(assetId).push(String(x.collectibleItemInstanceId));
            } else if (fill && worth > 0 && addOk(info)) pool.push({ id: String(x.collectibleItemInstanceId), worth, name: info.name });
          }
        }
        if (!fill && [...need].every(([a, n]) => (got.get(a) || []).length >= n)) break;
        cursor = r.body.nextPageCursor || '';
        if (!cursor) break;
      }
      const picked = [];
      for (const [a, n] of need) {
        const have = got.get(a) || [];
        if (have.length < n) return { status: held.has(a) ? 'held' : 'missing', assetId: a };
        picked.push(...have.slice(0, n));
      }
      if (!fill) return { status: 'ok', ids: picked, extra: [] };
      const best = pick(pool, fill.lo, fill.hi, 4 - st.look.length, fill.count);
      if (!best) return { status: 'norange' };
      return { status: 'ok', ids: picked.concat(best.items.map(x => x.id)), extra: best.items };
    }

    function pick(pool, lo, hi, slots, count) {
      const items = pool.filter(x => x.worth <= hi).sort((a, c) => c.worth - a.worth).slice(0, 40);
      const sizes = !(count > 0) ? Array.from({ length: slots }, (_, i) => i + 1) : count <= slots ? [count] : [];
      for (const size of sizes) {
        let best = null;
        const chosen = [];
        const walk = (from, sum) => {
          if (chosen.length === size) {
            if (sum >= lo && (!best || sum > best.sum)) best = { sum, items: chosen.slice() };
            return;
          }
          for (let i = from; i < items.length; i++) {
            if (sum + items[i].worth > hi) continue;
            chosen.push(items[i]);
            walk(i + 1, sum + items[i].worth);
            chosen.pop();
            if (best && best.sum === hi) return;
          }
        };
        walk(0, 0);
        if (best) return best;
      }
      return null;
    }

    async function landed(to, since) {
      try {
        const r = await fetch('https://trades.roblox.com/v1/trades/outbound?sortOrder=Desc&limit=10', { credentials: 'include' });
        if (!r.ok) return null;
        const d = await r.json();
        if (!d || !Array.isArray(d.data)) return null;
        const hit = d.data.find(t => String(t.user?.id) === String(to) && new Date(t.created).getTime() >= since - 60000);
        return { hit: hit || null };
      } catch {
        return null;
      }
    }

    async function sendTrade(body, job, pass) {
      const since = Date.now();
      let unsure = false;
      for (let tries = 0; tries < 5 && !job.stop; tries++) {
        if (unsure) {
          const seen = await landed(body.recipientOffer.userId, since);
          if (!seen) {
            await wait(3000);
            continue;
          }
          if (seen.hit) return { kind: 'reply', status: 200, data: { id: seen.hit.id } };
          unsure = false;
        }
        let r;
        try {
          r = await fetch('https://trades.roblox.com/v2/trades/send', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', ...(massCsrf ? { 'x-csrf-token': massCsrf } : {}), ...(pass || {}) }, body: JSON.stringify(body) });
        } catch {
          unsure = true;
          await wait(2000);
          continue;
        }
        if (r.headers.get('rblx-challenge-id')) return { kind: 'challenge', id: r.headers.get('rblx-challenge-id'), type: r.headers.get('rblx-challenge-type') || '', meta: r.headers.get('rblx-challenge-metadata') || '' };
        if (r.status === 403 && r.headers.get('x-csrf-token') && r.headers.get('x-csrf-token') !== massCsrf) {
          massCsrf = r.headers.get('x-csrf-token');
          tries--;
          continue;
        }
        if (r.status === 429) {
          job.sendWaits = (job.sendWaits || 0) + 1;
          if (job.sendWaits > 5) return { kind: 'limit' };
          const after = Number(r.headers.get('retry-after'));
          await cooldown(job, after > 0 ? after : 61, 61);
          tries--;
          continue;
        }
        const data = await r.json().catch(() => null);
        return { kind: 'reply', status: r.status, data };
      }
      return { kind: 'reply', status: 0, data: null };
    }

    const STOPS = {
      4: LT('Roblox says you’re logged out. Log in again, then start over.'),
      15: LT('Roblox says this trade is too uneven, so it won’t send it.'),
      17: LT('You don’t have enough Robux for this offer.'),
      18: LT('Roblox only allows Robux up to half of what the items in the trade are worth.'),
      23: LT('Roblox wants to check it’s really you. Send one trade from Roblox’s trade window and finish the check, then press Continue.'),
      30: LT('This trade needs Roblox Plus to include Robux.'),
    };

    async function tsvPost(url, data) {
      let token = massCsrf;
      for (let i = 0; i < 2; i++) {
        let r;
        try { r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', ...(token ? { 'x-csrf-token': token } : {}) }, body: JSON.stringify(data) }); } catch { return { ok: false, status: 0, data: null }; }
        const fresh = r.headers.get('x-csrf-token');
        if (r.status === 403 && fresh && fresh !== token) { token = massCsrf = fresh; continue; }
        return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
      }
      return { ok: false, status: 403, data: null };
    }

    const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unb64 = (str) => { const t = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, ''); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), ch => ch.charCodeAt(0)); };

    async function keyCheck(base, path, challengeId, actionType) {
      const s = await tsvPost(`${base}/challenges/${path}/verify-start`, { challengeId, actionType });
      let opts;
      try { opts = JSON.parse(s.data.authenticationOptions).publicKey; } catch { return null; }
      if (!opts || !opts.challenge) return null;
      opts.challenge = unb64(opts.challenge);
      for (const c of opts.allowCredentials || []) c.id = unb64(c.id);
      let cred;
      try { cred = await navigator.credentials.get({ publicKey: opts }); } catch { return null; }
      if (!cred) return null;
      const r = cred.response;
      return JSON.stringify({ id: cred.id, rawId: b64u(cred.rawId), type: cred.type, response: { authenticatorData: b64u(r.authenticatorData), clientDataJSON: b64u(r.clientDataJSON), signature: b64u(r.signature), userHandle: r.userHandle ? b64u(r.userHandle) : '' } });
    }

    async function verifyCode(ch, job, done) {
      let meta;
      try { meta = JSON.parse(atob(ch.meta)); } catch { return null; }
      if (!meta || !meta.challengeId || !meta.userId) return null;
      const base = `https://twostepverification.roblox.com/v1/users/${encodeURIComponent(meta.userId)}`;
      const actionType = meta.actionType || 'Generic';
      let media = 'Authenticator';
      try {
        const r = await fetch(`${base}/configuration?challengeId=${encodeURIComponent(meta.challengeId)}&actionType=${encodeURIComponent(actionType)}`, { credentials: 'include' });
        const c = r.ok ? await r.json() : null;
        if (c && c.primaryMediaType) media = c.primaryMediaType;
      } catch {}
      const path = { Authenticator: 'authenticator', Email: 'email', SMS: 'sms', RecoveryCode: 'recovery-codes', Passkey: 'passkey', SecurityKey: 'security-key' }[media] || 'authenticator';
      const key = path === 'passkey' || path === 'security-key';
      if (path === 'email' || path === 'sms') await tsvPost(`${base}/challenges/${path}/send-code`, { challengeId: meta.challengeId, actionType });
      const prompt = path === 'email' ? lt('Roblox emailed you a code. Enter it to keep sending.') : path === 'sms' ? lt('Roblox texted you a code. Enter it to keep sending.') : path === 'passkey' ? lt('Press Verify, then use your passkey to keep sending.') : path === 'security-key' ? lt('Press Verify, then use your security key to keep sending.') : lt('Enter the code from your authenticator app to keep sending.');
      for (;;) {
        const code = await done.code(prompt, key);
        if (!code || job.stop) return null;
        let v;
        if (key) {
          const cred = await keyCheck(base, path, meta.challengeId, actionType);
          if (job.stop) return null;
          if (!cred) { done.codeError(lt('The check didn’t finish. Try again.')); continue; }
          v = await tsvPost(`${base}/challenges/${path}/verify-finish`, { challengeId: meta.challengeId, actionType, code: cred });
        } else v = await tsvPost(`${base}/challenges/${path}/verify`, { challengeId: meta.challengeId, actionType, code });
        const token = v.ok && v.data && v.data.verificationToken;
        if (!token) { done.codeError(key ? lt('The check didn’t finish. Try again.') : lt('That code didn’t work. Try again.')); continue; }
        const answer = { verificationToken: token, rememberDevice: false, challengeId: meta.challengeId, actionType };
        const c = await tsvPost('https://apis.roblox.com/challenge/v1/continue', { challengeID: ch.id, challengeType: ch.type, challengeMetadata: JSON.stringify(answer) });
        if (!c.ok) { done.codeError(lt('Roblox didn’t accept the check. Try again.')); continue; }
        return { 'rblx-challenge-id': ch.id, 'rblx-challenge-type': ch.type, 'rblx-challenge-metadata': btoa(JSON.stringify(answer)) };
      }
    }

    function needYou() {
      if (!document.hidden && document.hasFocus()) return;
      try { chrome.runtime.sendMessage({ type: 'massAlert', title: lt('Mass Send needs you'), message: lt('Roblox wants to check it’s really you. Come back to finish the check, then press Continue.') }, () => void chrome.runtime.lastError); } catch {}
    }

    async function tryOne(c, job, done) {
      const halt = () => {
        done('skipped', lt('Stopped'));
        return { stopped: true };
      };
      if (st.skip.fresh) {
        const u = await robloxGet(`https://users.roblox.com/v1/users/${c.id}`, job);
        if (job.stop) return halt();
        const made = u.body && new Date(u.body.created).getTime();
        if (u.body && u.body.isBanned) { job.skipped++; rememberBlocked(c.id); return done('skipped', lt('Can’t trade with them')); }
        if (made && Date.now() - made < 30 * DAY) { job.skipped++; return done('skipped', lt('Account is under 30 days old')); }
      }
      const ct = await robloxGet(`https://trades.roblox.com/v1/users/${c.id}/can-trade-with`, job);
      if (job.stop) return halt();
      if (!ct.body) { job.skipped++; return done('skipped', lt('Couldn’t check if you can trade')); }
      if (!ct.body.canTrade) {
        if (ct.body.status === 'SenderPrivacyTooStrict') { done('failed', lt('Your privacy settings block it')); return { stop: lt('Your privacy settings stop you from sending trades. Set Who can trade with me to Everyone in Roblox settings, then start again.') }; }
        job.skipped++;
        rememberBlocked(c.id);
        return done('skipped', ct.body.status === 'UserPrivacyTooStrict' ? lt('Their privacy settings block trades') : lt('Can’t trade with them'));
      }
      const found = await copiesOf(c.id, job);
      if (job.stop) return halt();
      if (found.status !== 'ok') {
        job.skipped++;
        if (found.status === 'private') rememberBlocked(c.id);
        const name = found.assetId ? itemInfo(found.assetId).name : '';
        return done('skipped', found.status === 'norange' ? lt('Nothing of theirs fits the range') : found.status === 'held' ? lt('{item} is on hold', { item: name }) : found.status === 'missing' ? lt('Doesn’t have {item} anymore', { item: name }) : found.status === 'private' ? lt('Their inventory is private') : lt('Couldn’t load their items'));
      }
      const asks = found.extra.map(x => x.name).join(', ');
      if (st.review && !job.dry) {
        const all = st.look.map(e => itemInfo(e.assetId).name).concat(found.extra.map(x => x.name)).join(', ');
        const said = await done.ask(lt('Asking for {items}', { items: all }));
        if (said === 'stop' || job.stop) return halt();
        if (said === 'skip') { job.skipped++; return done('skipped', lt('You skipped this one')); }
      }
      if (job.dry) {
        job.sent++;
        return done('sent', asks ? lt('Would send, asking for {items}', { items: asks }) : lt('Would send'));
      }
      const me = myId();
      const body = {
        senderOffer: { userId: Number(me), robux: st.off.find(e => e.kind === 'robux')?.amount || 0, collectibleItemInstanceIds: st.off.filter(e => e.kind === 'item').map(e => e.uaid) },
        recipientOffer: { userId: Number(c.id), robux: 0, collectibleItemInstanceIds: found.ids },
      };
      job.posted = true;
      let res = await sendTrade(body, job);
      if (res.kind === 'challenge' && /^twostepverification$/i.test(res.type)) {
        needYou();
        const pass = await verifyCode(res, job, done);
        if (job.stop) return halt();
        if (pass) res = await sendTrade(body, job, pass);
      }
      if (job.stop && (res.kind !== 'reply' || res.status === 0)) return halt();
      if (res.kind === 'challenge') { done('failed', lt('Roblox wants to verify')); needYou(); return { stop: lt(STOPS[23]) }; }
      if (res.kind === 'limit') { done('failed', lt('Refused')); return { stop: lt('Roblox kept limiting new trades for about 5 minutes, so you’ve probably used its limit of {max} trades a day. Trades sent from anywhere count, even declined ones. Try again later.', { max: DAILY }) }; }
      const d = res.data || {};
      if (res.status === 200 && d.FailureReason !== undefined && d.ExpirationTimeInMinutes !== undefined) {
        done('failed', lt('Trading paused'));
        const hours = Math.max(1, Math.ceil(Number(d.ExpirationTimeInMinutes) / 60));
        return { stop: ltn(hours, 'Roblox paused trading on your account for about {hours} hour.', 'Roblox paused trading on your account for about {hours} hours.', { hours: formatNumber(hours) }) };
      }
      if (res.status >= 200 && res.status < 300) {
        job.sent++;
        job.misses = 0;
        job.backoff = 0;
        job.sendWaits = 0;
        rememberSent(String(d.tradeId || d.id || 'x' + Date.now() + Math.random()));
        if (d.tradeId || d.id) rememberRun(String(d.tradeId || d.id));
        rememberTo(c.id);
        if (st.today !== null) st.today++;
        if (asks) return done('sent', lt('Sent, asking for {items}', { items: asks }));
        return done('sent', lt('Sent'));
      }
      const err = Array.isArray(d.errors) && d.errors[0] ? d.errors[0] : {};
      const code = Number(err.code);
      if (code === 22 && err.field === 'sender') { done('failed', lt('Your privacy settings block it')); return { stop: lt('Your privacy settings stop you from sending trades. Set Who can trade with me to Everyone in Roblox settings, then start again.') }; }
      if (STOPS[code]) { done('failed', lt('Refused')); if (code === 23) needYou(); return { stop: lt(STOPS[code]) }; }
      job.skipped++;
      job.misses = (job.misses || 0) + 1;
      if (code === 22) {
        rememberBlocked(c.id);
        done('skipped', lt('Their privacy settings block trades'));
      }
      else if (code === 16) done('skipped', lt('Their trade filter wants a better offer'));
      else if (code === 7) {
        const mine = await robloxGet('https://trades.roblox.com/v2/users/me/can-trade', job);
        const f = mine.body && mine.body.freeTradesAllowance;
        if (mine.body && (mine.body.canTrade === false || (f && Number(f.limit) > 0 && Number(f.remaining) === 0))) {
          st.allow = mine.body;
          done('failed', lt('Refused'));
          return { stop: mine.body.canTrade === false ? lt('You can’t trade right now') : lt('You’re out of free trades this month, so Roblox won’t send more. Roblox Plus gives unlimited trades.') };
        }
        rememberBlocked(c.id);
        done('skipped', lt('Can’t trade with them'));
      }
      else if (code === 12) done('failed', lt('Roblox says an item can’t be traded'));
      else done('failed', lt('Roblox refused this one'));
      if (job.misses >= 5) return { stop: lt('Roblox refused 5 trades in a row, so sending stopped. Check your offer and try again.') };
      return null;
    }

    async function run(dry, resume) {
      const job = { stop: false, sent: resume ? resume.sent : 0, skipped: resume ? resume.skipped : 0, dry: !!dry, done: new Set(resume ? resume.done : []) };
      const startSent = job.sent;
      st.resume = null;
      st.job = job;
      if (!dry && !resume) st.runAt = Date.now();
      if (!resume) list.replaceChildren();
      progress.hidden = false;
      picks();
      setStatus(lt('Checking your items'));
      const finish = (text, alert, again) => {
        if (st.job !== job) return;
        st.job = null;
        if (again && !dry) st.resume = { done: [...job.done], sent: job.sent, skipped: job.skipped, sig: runSig() };
        window.removeEventListener('beforeunload', guard);
        statusText = '';
        status.textContent = text;
        status.classList.toggle('routility-ads-hint-alert', !!alert);
        bar.hidden = true;
        picks();
        if (!dry) setTimeout(paintResults, 2000);
      };
      status.classList.remove('routility-ads-hint-alert');
      bar.hidden = false;
      fill.style.width = '0%';
      window.addEventListener('beforeunload', guard);
      const mine = await window.RoUtilityUI.collectibles(myId(), { pages: 20 });
      if (job.stop) return finish(lt('Stopped. Nothing was sent.'));
      const have = new Map((mine.items || []).map(x => [String(x.key), x]));
      for (const e of st.off.filter(x => x.kind === 'item')) {
        const x = have.get(String(e.uaid));
        if (!CIID.test(String(e.uaid)) || mine.status !== 'ok') return finish(lt('Couldn’t check your items with Roblox. Refresh the page and try again.'), true);
        if (!x) return finish(lt('You don’t have {item} anymore. Remove it and pick again.', { item: itemInfo(e.assetId).name }), true);
        if (x.onHold) return finish(lt('{item} is on hold, so it can’t be traded yet.', { item: itemInfo(e.assetId).name }), true);
      }
      const bad = offBalance();
      if (bad !== null) return finish(lt('Your offer is worth {pct}% of what you’re asking. It has to be between 50% and 200%.', { pct: bad }), true);
      const skip = new Set([String(myId())]);
      setStatus(lt('Checking your outbound trades'));
      const today = await countToday(job);
      if (job.stop) return finish(lt('Stopped. Nothing was sent.'));
      if (today.count !== null) st.today = today.count;
      if (!dry && st.today !== null && st.today >= DAILY) return finish(lt('You’ve sent about {max} trades in the last 24 hours, which is Roblox’s limit. Try again later.', { max: DAILY }), true);
      job.cap = !dry && st.today !== null ? Math.min(st.max, startSent + DAILY - st.today) : st.max;
      setStatus(lt('Checking who to skip'));
      const lists = await Promise.all([
        st.skip.pending ? Promise.resolve(today.partners) : null,
        st.skip.pending ? partnersIn('inbound', 10, job) : null,
        st.skip.traded ? partnersIn('completed', 10, job) : null,
        st.skip.recent ? toStore().then(v => Object.keys(v.mine)) : null,
        st.skip.blocked ? blockStore().then(v => Object.keys(v.mine)) : null,
        st.skip.friends ? window.RoUtilityUI.friendIds(myId()).then(ids => (ids || []).map(String)) : null,
      ]);
      if (job.stop) return finish(lt('Stopped. Nothing was sent.'));
      for (const l of lists) if (l) for (const id of l) skip.add(String(id));
      for (const id of job.done) skip.add(id);
      setStatus(lt('Finding people'));
      let seen = 0;
      let stopText = '';
      for await (const c of candidates(job)) {
        if (job.stop || job.sent >= job.cap) break;
        if (skip.has(c.id)) continue;
        skip.add(c.id);
        seen++;
        setStatus('');
        const r = await tryOne(c, job, addRow(c));
        if (r && r.stop) { stopText = r.stop; break; }
        if (r && r.stopped) break;
        job.done.add(c.id);
        if (job.stop || job.sent >= job.cap) break;
        await wait(job.posted ? 2500 + Math.random() * 1500 : 300);
        job.posted = false;
      }
      const summary = dry
        ? ltn(job.sent, 'Test run: {sent} person would get this trade, {skipped} skipped. Nothing was sent.', 'Test run: {sent} people would get this trade, {skipped} skipped. Nothing was sent.', { sent: formatNumber(job.sent), skipped: formatNumber(job.skipped) })
        : ltn(job.sent, 'Sent {sent} trade, skipped {skipped}.', 'Sent {sent} trades, skipped {skipped}.', { sent: formatNumber(job.sent), skipped: formatNumber(job.skipped) });
      if (stopText) return finish(stopText + ' ' + summary, true, true);
      if (job.stop) return finish(lt('Stopped.') + ' ' + summary, false, job.sent < job.cap);
      if (!seen) return finish(st.source === 'owners' ? lt('Nobody who owns that was online in that time. Try a longer time or Trade Ads.') : lt('No trade ads offer that right now. Try Item Owners.'), true);
      if (job.sent < job.cap) return finish(lt('Ran out of people to send to.') + ' ' + summary);
      if (!dry && job.cap < st.max) return finish(summary + ' ' + lt('That’s your {max} trades for today.', { max: DAILY }));
      finish(summary);
    }

    function guard(e) {
      e.preventDefault();
      e.returnValue = '';
    }

    start.addEventListener('click', async () => {
      if (st.job) {
        st.job.stop = true;
        if (st.job.wake) st.job.wake();
        paintStart();
        return;
      }
      if (start.disabled) return;
      const ok = await window.RoUtilityUI.confirmDialog({
        title: ltn(Math.max(1, st.today !== null ? Math.min(st.max, DAILY - st.today) : st.max), 'Send this offer to {n} person?', 'Send this offer to up to {n} people?', { n: formatNumber(Math.max(1, st.today !== null ? Math.min(st.max, DAILY - st.today) : st.max)) }),
        text: lt('Each one gets their own trade from you on Roblox. You can stop at any time, and trades already sent stay in your Outbound list.'),
        confirm: lt('Start Sending'),
        danger: false,
      });
      if (ok && !st.job) run();
    });

    test.addEventListener('click', () => {
      if (st.job || test.disabled) return;
      run(true);
    });

    cont.addEventListener('click', () => {
      if (st.job || cont.disabled || !st.resume || st.resume.sig !== runSig()) return;
      run(false, st.resume);
    });

    root.start = () => {
      if (root.started) return;
      root.started = true;
      paint();
      s.itemsJob.then(() => { paintGrid(sides.look); paintStart(); });
      paintResults();
      setupStore().then(({ mine }) => { st.setups = mine; });
      const { json } = window.RoUtilityUI;
      Promise.all([json('https://trades.roblox.com/v1/trades/metadata'), json('https://trades.roblox.com/v2/users/me/can-trade'), countToday({ stop: false })]).then(([meta, allow, today]) => {
        st.meta = meta;
        st.allow = allow;
        if (today.count !== null) st.today = today.count;
        if (!st.job) paintStart();
      });
      Promise.all([myCollectibles(), s.itemsJob]).then(([mine]) => {
        st.mine = mine;
        if (mine.failed) {
          root.started = false;
          hint(lt('Couldn’t load all your items right now. Open Mass Send again to retry.'), true);
        }
        paint();
      });
    };
    return root;
  }

  function go(view) {
    if (!s) return;
    s.view = view;
    s.page = 0;
    paintSeg();
    paintToolbar();
    const post = view === 'post';
    const mass = view === 'mass';
    s.root.querySelector('.routility-ads-sub').textContent = post ? lt('Pick what you’re offering and what you want back.') : mass ? lt('Set up one offer and send it to everyone who has what you want.') : view === 'mine' ? lt('Your ads stay up for 14 days. You can have 5 at a time.') : lt('Live from routility.io. See what people are offering and looking for, then send them a trade.');
    for (const n of s.root.querySelectorAll('.routility-ads-toolbar, .routility-ads-list, .routility-ads-pager, .routility-ads-count')) n.hidden = post || mass;
    if (post && !s.post) {
      s.post = buildPost();
      s.root.querySelector('.routility-ads-list').before(s.post);
    }
    if (mass && !s.mass) {
      s.mass = buildMass();
      s.root.querySelector('.routility-ads-list').before(s.mass);
    }
    if (s.post) s.post.hidden = !post;
    if (s.mass) s.mass.hidden = !mass;
    if (post) s.post.start();
    else if (mass) s.mass.start();
    else load();
  }


  function paintSeg() {
    const seg = s.root.querySelector('.routility-ads-seg');
    seg.replaceChildren(...VIEWS.map(([key, label]) => {
      const b = el('button', 'routility-ads-seg-btn radius-circle text-label-medium' + (s.view === key ? ' routility-ads-seg-on' : ''), lt(label));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(s.view === key));
      b.addEventListener('click', () => { if (s.view !== key) go(key); });
      return b;
    }));
  }

  function openReport(ad, card) {
    const m = modalShell(lt('Report Ad'), 'routility-ads-report-modal');
    let pick = '';
    const list = el('div', 'routility-ads-reasons');
    const other = finput(lt('Tell us what’s wrong'), { max: 200 });
    other.hidden = true;
    const hint = el('span', 'text-body-small content-muted', lt('Ads reported by 3 people are hidden until staff review them.'));
    const send = fbutton(lt('Report'), 'bg-action-emphasis content-action-emphasis');
    const paint = () => {
      list.replaceChildren(...REASONS.map(r => chip(lt(r), pick === r, () => { pick = r; other.hidden = r !== 'Other'; paint(); })));
      send.disabled = !pick || (pick === 'Other' && !other.input.value.trim());
    };
    other.input.addEventListener('input', paint);
    m.body.append(el('p', 'text-body-medium content-default margin-none', lt('Why are you reporting this ad?')), list, other);
    m.foot.append(hint, send);
    send.addEventListener('click', async () => {
      if (send.disabled) return;
      send.disabled = true;
      const reason = pick === 'Other' ? 'Other: ' + other.input.value.trim() : pick;
      const res = await request({ type: 'tradeAdsWrite', action: 'report', id: String(ad.id), reason }, () => true);
      if (res && res.status >= 200 && res.status < 300) {
        m.shut();
        if (res.data && res.data.removed) card.remove();
        return notice(res.data && res.data.already ? lt('You already reported this ad.') : lt('Thanks, your report was sent.'), 'success');
      }
      hint.textContent = (res && res.data && res.data.error) || (res && res.status === 401 ? lt('Sign in on routility.io to report ads.') : lt('Couldn’t send the report. Try again.'));
      hint.classList.add('routility-ads-hint-alert');
      send.disabled = false;
    });
    paint();
  }

  function closeSort() {
    document.querySelector('.routility-ads-sort-menu')?.remove();
    document.querySelector('.routility-ads-sort-btn')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', sortOutside, true);
    document.removeEventListener('keydown', sortKey, true);
  }

  function sortOutside(e) {
    if (!e.target.closest('.routility-ads-sort')) closeSort();
  }

  function sortKey(e) {
    if (e.key === 'Escape') closeSort();
  }

  function openSort(wrap, btn) {
    if (wrap.querySelector('.routility-ads-sort-menu')) return closeSort();
    const menu = el('div', 'foundation-web-menu bg-surface-100 stroke-standard stroke-default shadow-transient-high radius-large padding-small routility-ads-sort-menu');
    menu.setAttribute('role', 'menu');
    SORTS.forEach(([key, label]) => {
      const item = el('button', 'relative clip group/interactable focus-visible:outline-focus foundation-web-menu-item flex items-center justify-between content-default cursor-pointer stroke-none bg-none text-align-x-left width-full text-body-medium padding-x-medium padding-y-small gap-x-medium radius-medium');
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(s.sort === key));
      item.append(layer(), el('span', null, lt(label)));
      if (s.sort === key) item.appendChild(el('span', 'icon icon-filled-check size-500 routility-ads-sort-check'));
      item.addEventListener('click', () => {
        closeSort();
        if (s.sort === key) return;
        s.sort = key;
        s.page = 0;
        paintToolbar();
        load();
      });
      menu.appendChild(item);
    });
    wrap.appendChild(menu);
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', sortOutside, true);
    document.addEventListener('keydown', sortKey, true);
    menu.querySelector('button')?.focus();
  }

  function countLine(tpl, value) {
    const [before, after] = tpl.split('{count}');
    const line = el('span');
    if (before) line.appendChild(document.createTextNode(before));
    line.appendChild(el('strong', 'content-emphasis', value));
    if (after) line.appendChild(document.createTextNode(after));
    return line;
  }

  function paintCount() {
    const box = s && s.root.querySelector('.routility-ads-count');
    if (!box) return;
    box.textContent = '';
    if (s.view === 'post' || s.total == null) return;
    if (s.view === 'mine') {
      if (!s.total) return;
      box.appendChild(countLine(lt('{count} of {max} ads up', { max: 5 }), formatNumber(s.total)));
      return;
    }
    box.appendChild(countLine(ltn(s.total, '{count} ad', '{count} ads'), formatNumber(s.total)));
    if (s.tier !== 'all' || s.q) {
      const clear = el('button', 'routility-ads-clear text-body-medium content-link', lt('Clear filters'));
      clear.type = 'button';
      clear.addEventListener('click', () => {
        s.tier = 'all';
        s.q = '';
        if (s.search) s.search.input.value = '';
        s.page = 0;
        paintToolbar();
        load();
      });
      box.appendChild(clear);
    }
  }

  function paintToolbar() {
    const bar = s.root.querySelector('.routility-ads-toolbar');
    closeSort();
    if (s.view !== 'browse') return bar.replaceChildren();
    if (!s.search) {
      s.search = finput(lt('Search items, players or notes'), { max: 50 });
      s.search.classList.add('routility-ads-search');
      const icon = el('span', 'grow-0 shrink-0 basis-auto icon icon-regular-magnifying-glass size-[var(--icon-size-medium)] content-muted');
      icon.setAttribute('aria-hidden', 'true');
      s.search.insertBefore(icon, s.search.input);
      s.search.input.addEventListener('input', () => {
        clearTimeout(s.searchTimer);
        s.searchTimer = setTimeout(() => {
          const q = s.search.input.value.trim();
          if (q === s.q) return;
          s.q = q;
          s.page = 0;
          load();
        }, 350);
      });
    }
    const tiers = el('div', 'routility-ads-chips');
    TIERS.forEach(([key, label]) => tiers.appendChild(chip(lt(label), s.tier === key, () => {
      if (s.tier === key) return;
      s.tier = key;
      s.page = 0;
      paintToolbar();
      load();
    }, s.counts && Number.isFinite(Number(s.counts[key])) ? Number(s.counts[key]) : null)));
    const wrap = el('div', 'routility-ads-sort');
    const btn = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus cursor-pointer flex items-center gap-xsmall stroke-none select-none radius-circle text-label-medium height-800 padding-x-medium bg-shift-300 content-action-utility routility-ads-sort-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.append(layer(), el('span', 'content-muted', lt('Sort:')), el('span', 'content-emphasis', lt((SORTS.find(x => x[0] === s.sort) || SORTS[0])[1])), el('span', 'icon routility-calc-icon routility-calc-icon-chevron routility-ads-sort-caret'));
    btn.addEventListener('click', () => openSort(wrap, btn));
    wrap.appendChild(btn);
    if (bar.firstElementChild === s.search) {
      while (bar.lastElementChild !== s.search) bar.lastElementChild.remove();
      bar.append(tiers, wrap);
    } else bar.replaceChildren(s.search, tiers, wrap);
  }

  function build(mass) {
    const root = el('div', 'routility-injected routility-ads' + (mass ? ' routility-mass-page' : ''));
    const head = el('div', 'routility-ads-top');
    const titles = el('div', 'routility-ads-titles');
    titles.append(el('h1', 'text-heading-large content-emphasis margin-none', mass ? lt('Mass Send') : lt('Trade Ads')), el('p', 'text-body-medium content-muted margin-none routility-ads-sub', lt('Live from routility.io. See what people are offering and looking for, then send them a trade.')));
    const seg = el('div', 'routility-ads-seg radius-circle bg-shift-200');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', lt('Trade Ads views'));
    seg.hidden = !!mass;
    head.append(titles, seg);
    const box = el('div', 'routility-ads-notice');
    box.hidden = true;
    box.setAttribute('role', 'status');
    root.append(head, box, el('div', 'routility-ads-toolbar'), el('div', 'routility-ads-count text-body-medium content-muted'), el('div', 'routility-ads-list'), el('div', 'routility-ads-pager'));
    if (!mass) root.appendChild(el('div', 'routility-ads-foot-note text-body-small content-muted', lt('Trade Ads come from routility.io and aren’t affiliated with Roblox. Only trade through Roblox’s own trade window.')));
    return root;
  }

  function setup() {
    const mass = MASS_PATH.test(location.pathname);
    if (s || !(mass ? settings.massSend !== false : PATH.test(location.pathname) && settings.tradeAds !== false)) return;
    const content = document.querySelector('#content');
    if (!content) return;
    s = { view: 'browse', tier: 'all', sort: 'newest', q: '', total: null, page: 0, pageSize: 0, counts: null, items: [], byId: new Map() };
    s.itemsJob = request({ type: 'calcItems' }, r => Array.isArray(r)).then(items => {
      if (!s) return;
      if (!Array.isArray(items) || !items.length) {
        s.itemsFailed = true;
        return;
      }
      s.items = items;
      s.byId = new Map(items.map(i => [String(i.id), i]));
    });
    pageTitle((mass ? lt('Mass Send') : lt('Trade Ads')) + ' - Roblox');
    s.root = build(mass);
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-ads-ready');
    if (mass) return go('mass');
    paintSeg();
    paintToolbar();
    load();
  }

  function ensureNav() {
    if (settings.tradeAds === false || settings.tradeAdsNav === false) {
      document.querySelectorAll('.routility-ads-nav').forEach(n => n.remove());
      return;
    }
    const trade = document.querySelector('.left-nav nav a[href$="/trades"]') || [...document.querySelectorAll('nav a[href$="/trades"]')].find(a => /Trade/.test(a.textContent));
    if (!trade) return;
    const li = trade.closest('li');
    if (!li || !li.parentElement) return;
    const after = li.parentElement.querySelector(':scope > .routility-calc-nav') || li;
    let mine = li.parentElement.querySelector(':scope > .routility-ads-nav');
    const here = PATH.test(location.pathname);
    if (!mine) {
      mine = li.cloneNode(true);
      mine.classList.remove('routility-calc-nav');
      mine.classList.add('routility-injected', 'routility-ads-nav');
      const a = mine.querySelector('a');
      a.href = 'https://www.roblox.com/trade-ads';
      a.classList.remove('bg-shift-200');
      a.querySelectorAll('.foundation-web-badge, .foundation-web-status-indicator').forEach(b => (b.closest('span.fill') || b).remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-ads-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => /^Trade( Calculator)?$/.test(sp.textContent.trim()));
      if (label) label.textContent = lt('Trade Ads');
    }
    if (after.nextElementSibling !== mine) after.after(mine);
    window.RoUtilityUI.stripNavBadges(mine);
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) trade.classList.remove('bg-shift-200');
  }

  let navObserver = null;

  function startNav() {
    if (navObserver) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
        if ((PATH.test(location.pathname) || MASS_PATH.test(location.pathname)) && !s) setup();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
  }

  if (location.hostname === 'www.roblox.com') {
    chrome.storage.local.get('routilitySettings', (st) => {
      settings = st.routilitySettings || {};
      startNav();
      setup();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.routilitySettings) return;
      settings = changes.routilitySettings.newValue || {};
      ensureNav();
      startNav();
    });
  }
})();
