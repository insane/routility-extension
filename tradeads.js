(function () {
  'use strict';

  const { el, pageTitle, formatUSD, formatNumber, request, cashTile, itemValue, valueTag, shows } = window.RoUtilityUI;
  const showing = shows('Ads');
  const { lt, ltn, LT } = window.RoUtilityI18n;
  const PATH = /^\/trade-ads\/?$/i;
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
    return v > 0 ? formatUSD(v) : '$0';
  }

  function thumbImg(src, size) {
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
    if (v >= 1000) return '$' + compact(v);
    return '$' + (Number.isInteger(v) ? formatNumber(v) : v.toFixed(2));
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
    if (showing.usd) line.append(el('span', 'content-emphasis routility-ads-total-usd', usd(usdTotal)));
    if (showing.value && valueTotal > 0) {
      const v = valueTag(valueTotal, { short: true, className: 'routility-ads-total-val', tip: false });
      v.dataset.rtTip = lt('RoUtility Value: {value} Robux', { value: formatNumber(valueTotal) }) + ' · ' + lt('Only items with a RoUtility value are counted');
      line.append(v);
    }
    if (showing.rap) line.append(el('span', 'content-muted routility-ads-total-rap', 'RAP'), robuxIcon(), el('span', 'content-emphasis', compact(rapTotal)));
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
      tile.dataset.rtTip = lt(TAG_NAME[tag]) + ' · ' + lt(TAG_TIP[tag]);
      tile.setAttribute('role', 'img');
      tile.setAttribute('aria-label', lt(TAG_NAME[tag]));
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = chrome.runtime.getURL(`icons/tags/tag-${tag}.webp`);
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
    a.dataset.rtTip = (x.name || lt('Item')) + (x.usd ? ' · ' + usd(Number(x.usd)) : '') + (adValue(x) ? ' · ' + lt('Value {value}', { value: formatNumber(adValue(x)) }) : '') + (x.rap ? ' · R$ ' + formatNumber(x.rap) : '');
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
    img.src = chrome.runtime.getURL(`icons/tags/tag-${tag}.webp`);
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
    const b = el('button', 'routility-ads-tile relative clip group/interactable cursor-pointer' + (opts.picked ? ' routility-ads-tile-on' : ''));
    b.type = 'button';
    b.disabled = !!opts.disabled;
    b.appendChild(layer());
    const box = el('span', 'routility-ads-tile-img');
    if (it.thumb) {
      const img = el('img', 'routility-fade');
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('load', () => img.classList.add('routility-loaded'), { once: true });
      img.src = it.thumb;
      box.appendChild(img);
    }
    if (it.rare) {
      const gem = el('span', 'routility-ads-gem');
      gem.dataset.rtTip = lt('Rare');
      box.appendChild(gem);
    }
    if (opts.serial) box.appendChild(el('span', 'routility-ads-serial text-label-small', '#' + formatNumber(opts.serial)));
    const rap = el('span', 'routility-ads-tile-rap text-label-small content-muted');
    if (!showing.value && itemValue(it)) b.dataset.rtTip = window.RoUtilityUI.valueTip(it);
    if (showing.value && itemValue(it)) rap.append(valueTag(itemValue(it), { short: true, className: 'routility-ads-tile-val' }), document.createTextNode(' · '));
    rap.append(document.createTextNode('RAP '), robuxIcon(), document.createTextNode(' ' + (it.rap ? compact(it.rap) : '-')));
    b.append(box, el('span', 'routility-ads-tile-name text-label-medium content-emphasis', it.name), el('span', 'routility-ads-tile-usd text-title-medium content-emphasis', it.usd ? usd(it.usd) : lt('No price')), rap);
    if (opts.onHold) b.dataset.rtTip = lt('On hold, can’t be traded yet');
    b.addEventListener('click', opts.onClick);
    return b;
  }

  function skTile() {
    const t = el('div', 'routility-ads-tile routility-ads-tile-sk');
    t.setAttribute('aria-hidden', 'true');
    t.append(el('span', 'routility-ads-tile-img routility-sk'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-name'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-name2'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-usd'), el('span', 'routility-sk routility-ads-sk-line routility-ads-sk-rap'));
    return t;
  }

  function slotView(e, onRemove) {
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
      b.appendChild(el('span', 'routility-ads-slot-cap text-label-small', it.usd ? usd(it.usd) : compact(it.rap)));
    } else if (e.kind === 'tag') {
      b.classList.add('routility-ads-slot-tag');
      b.appendChild(tagImg(e.tag));
    } else if (e.kind === 'usd' || e.kind === 'robux') {
      b.appendChild(cashTile(e.kind, e.amount));
    }
    b.addEventListener('click', onRemove);
    return b;
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
      const uUsd = el('button', 'routility-ads-unit-btn radius-circle', '$');
      uUsd.type = 'button';
      uUsd.setAttribute('aria-label', 'USD');
      const uRbx = el('button', 'routility-ads-unit-btn radius-circle');
      uRbx.type = 'button';
      uRbx.setAttribute('aria-label', 'Robux');
      uRbx.appendChild(robuxIcon());
      unit.append(uUsd, uRbx);
      const amount = finput(lt('USD amount'), { inputmode: 'decimal', max: 12 });
      const add = fbutton(lt('Add USD'), 'bg-action-standard content-action-standard');
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
        amount.input.placeholder = u === 'usd' ? lt('USD amount') : lt('Robux amount');
        amount.input.setAttribute('aria-label', amount.input.placeholder);
        add.label.textContent = u === 'usd' ? lt('Add USD') : lt('Add Robux');
      };
      uUsd.addEventListener('click', () => setUnit('usd'));
      uRbx.addEventListener('click', () => setUnit('robux'));
      setUnit('usd');
      amount.input.addEventListener('input', () => {
        amount.input.value = amount.input.value.replace(st.unit[key] === 'usd' ? /[^\d.]/g : /[^\d]/g, '');
      });
      const addAmount = () => {
        const u = st.unit[key];
        const v = u === 'usd' ? Math.round(Number(amount.input.value) * 100) / 100 : Math.floor(Number(amount.input.value));
        if (!(v > 0)) return;
        if (u === 'usd' && st.user && !st.user.discord) return hint(lt('Link your Discord on routility.io to add USD to an ad.'), true);
        const list = st[key];
        const same = list.find(e => e.kind === u);
        if (same) same.amount = u === 'usd' ? Math.round((same.amount + v) * 100) / 100 : same.amount + v;
        else if (list.length < 4) list.push({ kind: u, amount: v });
        else return hint(lt('Each side holds 4 things. Remove one to add more.'), true);
        amount.input.value = '';
        paint();
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
      side.count.textContent = lt('{count} of {max}', { count: list.length, max: 4 });
      side.slots.replaceChildren(...Array.from({ length: 4 }, (_, i) => {
        const e = list[i];
        const b = slotView(e, () => { st[side.key] = list.filter(x => x !== e); paint(); });
        if (!e) b.addEventListener('click', () => side.search.input.focus());
        return b;
      }));
    }

    function paintTags() {
      const side = sides.look;
      side.tags.replaceChildren(...TAGS.map(tag => {
        const on = st.look.some(e => e.kind === 'tag' && e.tag === tag);
        const b = el('button', 'routility-ads-tagbtn relative clip group/interactable cursor-pointer' + (on ? ' routility-ads-tile-on' : ''));
        b.type = 'button';
        b.dataset.rtTip = lt(TAG_NAME[tag]) + ' · ' + lt(TAG_TIP[tag]);
        b.setAttribute('aria-pressed', String(on));
        b.append(layer(), tagImg(tag));
        b.disabled = !on && st.look.length >= 4;
        b.addEventListener('click', () => {
          if (on) st.look = st.look.filter(e => !(e.kind === 'tag' && e.tag === tag));
          else if (st.look.length < 4) st.look.push({ kind: 'tag', tag });
          paint();
        });
        return b;
      }));
    }

    function paintGrid(side) {
      const q = side.search.input.value.trim().toLowerCase();
      const words = q ? q.split(/\s+/) : [];
      const match = (name, extra) => words.every(w => (name + ' ' + (extra || '')).toLowerCase().includes(w));
      const full = st[side.key].length >= 4;
      if (side.key === 'off') {
        if (st.mine === null) return side.grid.replaceChildren(...Array.from({ length: 12 }, skTile));
        if (st.mine.hidden) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Your inventory is private, so your limiteds can’t be listed. Make it visible to everyone in Roblox privacy settings.')));
        const list = st.mine.items.map(x => ({ x, it: itemInfo(x.assetId, x.name) })).filter(({ it }) => match(it.name, it.acr)).sort((a, b) => (b.it.usd || 0) - (a.it.usd || 0));
        if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', st.mine.items.length ? lt('No limiteds match that.') : lt('You don’t have any limiteds to offer.')));
        return side.grid.replaceChildren(...list.slice(0, 120).map(({ x, it }) => {
          const on = st.off.some(e => e.uaid === x.uaid);
          return itemCard(it, { picked: on, serial: x.serial, onHold: x.onHold, disabled: x.onHold || (!on && full), onClick: () => {
            if (on) st.off = st.off.filter(e => e.uaid !== x.uaid);
            else if (st.off.length < 4) st.off.push({ kind: 'item', assetId: x.assetId, uaid: x.uaid });
            paint();
          } });
        }));
      }
      if (!s.items.length) return side.grid.replaceChildren(...(s.itemsFailed ? [el('div', 'routility-ads-grid-note text-body-small content-muted', lt('Couldn’t load the item list. Refresh the page to try again.'))] : Array.from({ length: 12 }, skTile)));
      const list = s.items.filter(i => match(i.name, (i.acr || '') + ' ' + i.id)).sort((a, b) => (b.usd || 0) - (a.usd || 0));
      if (!list.length) return side.grid.replaceChildren(el('div', 'routility-ads-grid-note text-body-small content-muted', lt('No limiteds match that.')));
      side.grid.replaceChildren(...list.slice(0, 120).map(it => {
        const on = st.look.some(e => e.kind === 'item' && e.assetId === String(it.id));
        return itemCard(it, { picked: on, disabled: !on && full, onClick: () => {
          if (on) st.look = st.look.filter(e => !(e.kind === 'item' && e.assetId === String(it.id)));
          else if (st.look.length < 4) st.look.push({ kind: 'item', assetId: String(it.id) });
          paint();
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

  function go(view) {
    if (!s) return;
    s.view = view;
    s.page = 0;
    paintSeg();
    paintToolbar();
    const post = view === 'post';
    s.root.querySelector('.routility-ads-sub').textContent = post ? lt('Pick what you’re offering and what you want back.') : view === 'mine' ? lt('Your ads stay up for 14 days. You can have 5 at a time.') : lt('Live from routility.io. See what people are offering and looking for, then send them a trade.');
    for (const n of s.root.querySelectorAll('.routility-ads-toolbar, .routility-ads-list, .routility-ads-pager, .routility-ads-count')) n.hidden = post;
    if (!s.post) {
      s.post = buildPost();
      s.root.querySelector('.routility-ads-list').before(s.post);
    }
    s.post.hidden = !post;
    if (post) s.post.start();
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
    bar.replaceChildren(s.search, tiers, wrap);
  }

  function build() {
    const root = el('div', 'routility-injected routility-ads');
    const head = el('div', 'routility-ads-top');
    const titles = el('div', 'routility-ads-titles');
    titles.append(el('h1', 'text-heading-large content-emphasis margin-none', lt('Trade Ads')), el('p', 'text-body-medium content-muted margin-none routility-ads-sub', lt('Live from routility.io. See what people are offering and looking for, then send them a trade.')));
    const seg = el('div', 'routility-ads-seg radius-circle bg-shift-200');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', lt('Trade Ads views'));
    head.append(titles, seg);
    const box = el('div', 'routility-ads-notice');
    box.hidden = true;
    box.setAttribute('role', 'status');
    root.append(head, box, el('div', 'routility-ads-toolbar'), el('div', 'routility-ads-count text-body-medium content-muted'), el('div', 'routility-ads-list'), el('div', 'routility-ads-pager'), el('div', 'routility-ads-foot-note text-body-small content-muted', lt('Trade Ads come from routility.io and aren’t affiliated with Roblox. Only trade through Roblox’s own trade window.')));
    return root;
  }

  function setup() {
    if (!PATH.test(location.pathname) || s || settings.tradeAds === false) return;
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
    pageTitle(lt('Trade Ads') + ' - Roblox');
    s.root = build();
    content.appendChild(s.root);
    document.documentElement.classList.add('routility-ads-ready');
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
      a.querySelectorAll('.foundation-web-badge').forEach(b => (b.closest('span.fill') || b).remove());
      const icon = a.querySelector('.icon');
      if (icon) icon.className = 'grow-0 shrink-0 basis-auto icon routility-ads-nav-icon size-[var(--icon-size-large)]';
      const label = a.querySelector(':scope > .text-truncate-end') || [...a.querySelectorAll('span')].find(sp => /^Trade( Calculator)?$/.test(sp.textContent.trim()));
      if (label) label.textContent = lt('Trade Ads');
    }
    if (after.nextElementSibling !== mine) after.after(mine);
    mine.querySelector('a').classList.toggle('bg-shift-200', here);
    if (here) trade.classList.remove('bg-shift-200');
  }

  let navObserver = null;

  function startNav() {
    if (navObserver || settings.tradeAds === false) return;
    let queued = false;
    navObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureNav();
        if (PATH.test(location.pathname) && !s) setup();
      });
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
    ensureNav();
  }

  if (location.hostname === 'www.roblox.com') {
    chrome.storage.local.get('routilitySettings', (st) => {
      settings = st.routilitySettings || {};
      if (settings.tradeAds === false) return;
      startNav();
      setup();
    });
  }
})();
