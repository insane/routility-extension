(function () {
  'use strict';

  if (window.RoUtilitySocial) return;
  const { el, onFrame } = window.RoUtilityUI;
  const { lt, ltn } = window.RoUtilityI18n;

  const MAX = 200;
  const CONTACT = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|gg|io|me|co|tv|xyz|ly|link|app|dev|info)\b|[^\s@]+@[^\s@]+\.[a-z]{2,}|\d(?:[\s.()-]*\d){6,}|\b(?:discord|instagram|insta|snapchat|snap|tiktok|twitter|telegram|whatsapp|youtube|twitch|facebook|kik)\b)/i;
  const LINK = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
  const STRONG = /\b(n+[i1!|]+[gq]{2,}[e3a@4]+[rh]*[sz]?|f+[a@4]+[gq]+(?:[o0]+[t7]+)?[sz]?|k+[i1!|]+k+[e3]+[sz]?|ch+[i1!|]+n+k+[sz]?|sp+[i1!|]+c+[sz]?|tr+[a@4]+nn+(?:y|[i1!|]e)[sz]?|w+[e3]+tb+[a@4]+c+k+[sz]?|g+[o0]{2,}k+[sz]?)\b/gi;
  const SPOTS = [
    { card: '#friends-web-app li.avatar-card, .routility-friends-grid li.avatar-card, li.routility-rf-card', box: '.avatar-name-container' },
    { card: '.friends-carousel-tile', box: '.friends-carousel-tile-name' },
    { card: 'article.player-search-card', box: '.player-search-card-name' },
    { card: 'li.routility-search-row', box: '.routility-search-title' },
    { card: '.routility-classic-people .friend, .routility-modern-friend', box: '.routility-friend-name-row' },
  ];

  let settings = {};
  let observer = null;
  let who = null;
  let onVerified = null;
  const badges = new Map();
  let badgeAsk = null;
  let badgeRetry = 0;
  let notes = null;
  let notesAt = 0;
  let notesAsk = null;
  let send = null;
  let incoming = null;
  let passing = false;
  let toastTimer = 0;

  const ask = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r); });
    } catch {
      resolve(null);
    }
  });
  const myId = () => document.querySelector('meta[name="user-data"]')?.dataset.userid || '';
  const canMessage = () => settings.socialBadge !== false && settings.socialMessages !== false && !!who && !!who.me && who.minor === false;
  const messagesOn = () => canMessage() && !!who.verified;

  function cardUserId(li) {
    if (li.id && /^\d+$/.test(li.id)) return li.id;
    const rf = li.id && li.id.match(/^routility-rf-(\d+)$/);
    if (rf) return rf[1];
    const test = (li.dataset.testid || '').match(/^player-card-(\d+)$/);
    if (test) return test[1];
    const a = li.querySelector('a[href*="/users/"]');
    const m = a && a.getAttribute('href').match(/\/users\/(\d+)\//);
    return m ? m[1] : '';
  }

  function badgeMark() {
    const b = el('span', 'routility-injected routility-user-badge');
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', lt('RoUtility User'));
    b.dataset.rtTip = lt('RoUtility User');
    return b;
  }

  function profileTarget() {
    const m = location.pathname.match(/^\/users\/(\d+)\/profile\/?$/i);
    return m ? m[1] : '';
  }

  function profileBadgeBox() {
    const name = document.querySelector('#profile-header-title-container-name');
    if (!name || !name.parentElement) return null;
    const after = [...name.parentElement.children].filter(c => c !== name && !c.classList.contains('routility-injected'));
    const own = name.parentElement.querySelector(':scope > .routility-name-holder');
    name.parentElement.querySelectorAll(':scope > .routility-user-badge').forEach(n => n.remove());
    if (after.length) {
      own?.remove();
      return after[0];
    }
    if (own) return own;
    const holder = el('span', 'routility-injected routility-name-holder items-center gap-xxsmall inline-flex shrink-0');
    name.after(holder);
    return holder;
  }

  function placeBadges() {
    const spots = SPOTS.flatMap(spot => [...document.querySelectorAll(spot.card)].map(li => [cardUserId(li), li.querySelector(spot.box)]));
    const target = profileTarget();
    if (target) spots.push([target, profileBadgeBox()]);
    const unknown = [];
    for (const [id, box] of spots) {
      if (!id) continue;
      const known = badges.get(id);
      if (known === undefined) {
        unknown.push(id);
        continue;
      }
      if (!box) continue;
      const mark = box.querySelector(':scope > .routility-user-badge');
      if (known && !mark) box.appendChild(badgeMark());
      else if (known && mark !== box.lastElementChild) box.appendChild(mark);
      else if (!known && mark) mark.remove();
    }
    if (!unknown.length || badgeAsk || Date.now() < badgeRetry) return;
    const ids = [...new Set(unknown)].slice(0, 300);
    ids.forEach(id => badges.set(id, null));
    badgeAsk = ask({ type: 'socialBadges', ids }).then((r) => {
      badgeAsk = null;
      if (!r || typeof r !== 'object') {
        ids.forEach(id => badges.delete(id));
        badgeRetry = Date.now() + 60000;
        return;
      }
      ids.forEach(id => badges.set(id, r[id] || null));
      tick();
    });
  }

  function clean(text) {
    return settings.socialFilter === false ? text : text.replace(STRONG, m => '•'.repeat(Math.min(m.length, 6)));
  }

  function fillText(host, text) {
    let last = 0;
    for (const m of text.matchAll(LINK)) {
      if (m.index > last) host.appendChild(document.createTextNode(text.slice(last, m.index)));
      const url = /^www\./i.test(m[0]) ? 'https://' + m[0] : m[0];
      const a = el('a', 'text-link routility-req-note-link', m[0]);
      a.href = url;
      a.rel = 'noopener noreferrer nofollow';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        leaving(url);
      });
      host.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) host.appendChild(document.createTextNode(text.slice(last)));
  }

  function dialog(titleText) {
    const overlay = el('div', 'foundation-web-dialog-overlay padding-medium foundation-web-portal-zindex bg-common-backdrop routility-injected routility-tc-modal routility-note-modal');
    overlay.dataset.state = 'open';
    const box = el('div', 'relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high routility-note-dialog');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const title = el('h2', 'text-heading-small routility-note-title', titleText);
    box.appendChild(title);
    overlay.appendChild(box);
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    return { overlay, box, close };
  }

  function button(label, primary) {
    const b = el('button', 'foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium ' + (primary ? 'bg-action-emphasis content-action-emphasis' : 'bg-action-standard content-action-standard'));
    b.type = 'button';
    const layer = el('div', 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none');
    layer.setAttribute('aria-hidden', 'true');
    const text = el('span', 'padding-y-xsmall text-truncate-end text-no-wrap', label);
    b.append(layer, text);
    b.label = text;
    return b;
  }

  function leaving(url) {
    let host = url;
    try { host = new URL(url).hostname; } catch {}
    const d = dialog(lt('Open This Link?'));
    d.box.appendChild(el('p', 'text-body-medium content-default routility-note-copy', lt('This link goes to {site}, outside Roblox. RoUtility didn’t check it, so only open it if you trust the person who sent it.', { site: host })));
    d.box.appendChild(el('p', 'text-body-small content-muted routility-note-url', url));
    const foot = el('div', 'routility-note-foot');
    const cancel = button(lt('Cancel'));
    const go = button(lt('Open Link'), true);
    cancel.addEventListener('click', d.close);
    go.addEventListener('click', () => {
      d.close();
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    foot.append(cancel, go);
    d.box.appendChild(foot);
    go.focus();
  }

  function toast(text, bad) {
    document.querySelector('.routility-note-toast')?.remove();
    clearTimeout(toastTimer);
    const box = el('div', 'routility-injected routility-toast routility-note-toast flex items-center gap-large bg-system-contrast content-inverse-emphasis radius-medium padding-x-large padding-y-medium shadow-transient-high text-body-medium' + (bad ? ' routility-toast-bad' : ''));
    box.setAttribute('role', bad ? 'alert' : 'status');
    box.appendChild(el('span', null, text));
    document.body.appendChild(box);
    toastTimer = setTimeout(() => box.remove(), 5000);
  }

  function onRequests() {
    return /^\/users\/(?:\d+\/)?friends\/?$/i.test(location.pathname) && /^#!\/friend-requests/i.test(location.hash);
  }

  function ago(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 1) return lt('just now');
    if (mins < 60) return ltn(mins, '{n} minute ago', '{n} minutes ago');
    const hours = Math.round(mins / 60);
    if (hours < 48) return ltn(hours, '{n} hour ago', '{n} hours ago');
    return ltn(Math.round(hours / 24), '{n} day ago', '{n} days ago');
  }

  function noteTools(n, done, li) {
    const tools = el('div', 'routility-note-tools');
    const act = (label, confirm, run) => {
      const b = button(label);
      b.classList.add('routility-note-tool');
      let armed = false;
      let timer = 0;
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm && !armed) {
          armed = true;
          b.label.textContent = confirm;
          b.classList.add('routility-note-tool-armed');
          timer = setTimeout(() => {
            armed = false;
            b.label.textContent = label;
            b.classList.remove('routility-note-tool-armed');
          }, 4000);
          return;
        }
        clearTimeout(timer);
        b.disabled = true;
        const ok = await run();
        if (!ok) {
          b.disabled = false;
          armed = false;
          b.label.textContent = label;
          b.classList.remove('routility-note-tool-armed');
          toast(lt('That didn’t work. Try again.'), true);
          return;
        }
        notes?.delete(String(n.fromUserId));
        document.querySelectorAll(`.routility-req-note[data-note-id="${CSS.escape(String(n.id))}"]`).forEach(x => x.remove());
        done?.();
      });
      tools.appendChild(b);
    };
    const ignore = li && li.isConnected && [...li.querySelectorAll('button')].find(b => b.textContent.trim() === lt('Ignore') || /^ignore$/i.test(b.textContent.trim()));
    if (ignore) act(lt('Ignore'), null, async () => {
      if (!ignore.isConnected || ignore.disabled) return false;
      ignore.click();
      return true;
    });
    act(lt('Report'), lt('Confirm Report'), async () => {
      const ok = (await ask({ type: 'socialReport', id: n.id }))?.ok;
      if (ok) toast(lt('Thanks, the message was reported and hidden.'));
      return ok;
    });
    act(lt('Block'), lt('Confirm Block'), async () => {
      const ok = (await ask({ type: 'socialBlock', userId: n.fromUserId }))?.ok;
      if (ok) toast(lt('They can’t send you messages anymore.'));
      return ok;
    });
    return tools;
  }

  function cardWho(li) {
    if (!li || !li.isConnected) return null;
    const name = li.querySelector('.avatar-name, .avatar-card-name')?.textContent.trim() || '';
    const user = [...li.querySelectorAll('.avatar-card-label, .avatar-name-container ~ *, [class*="username"]')].map(x => x.textContent.trim()).find(t => /^@\S+$/.test(t)) || '';
    const img = li.querySelector('.avatar-card-image img, .thumbnail-2d-container img, img');
    return { name, user, img: img && img.src && !/placeholder|blank/i.test(img.src) ? img.src : '' };
  }

  function profileWho() {
    const head = document.querySelector('#content .user-profile-header-info') || document;
    const name = document.querySelector('#profile-header-title-container-name')?.textContent.trim() || '';
    const user = [...head.querySelectorAll('span, div')].filter(x => !x.children.length).map(x => x.textContent.trim()).find(t => /^@\S+$/.test(t)) || '';
    const img = document.querySelector('#content .user-profile-header img, #content .profile-avatar-thumb img, .routility-classic-headshot img');
    return { name, user, img: img && img.src ? img.src : '' };
  }

  function openNote(n, li, fallback) {
    const who = cardWho(li) || fallback || { name: '', user: '', img: '' };
    const d = dialog(lt('Friend Request Message'));
    const head = el('div', 'routility-note-from');
    const face = el('span', 'routility-note-face');
    if (who.img) {
      const img = el('img');
      img.src = who.img;
      img.alt = '';
      face.appendChild(img);
    }
    const names = el('div', 'routility-note-names');
    names.appendChild(el('span', 'text-title-medium content-emphasis text-truncate-end text-no-wrap', who.name || lt('Someone')));
    const sub = [who.user, n.at ? ago(Date.now() - Number(n.at)) : ''].filter(Boolean).join(' · ');
    if (sub) names.appendChild(el('span', 'text-body-small content-muted text-truncate-end text-no-wrap', sub));
    head.append(face, names);
    const text = el('p', 'text-body-medium content-default routility-note-copy routility-note-full');
    fillText(text, clean(String(n.text || '')));
    d.box.append(head, text);
    const foot = el('div', 'routility-note-foot routility-note-foot-split');
    const close = button(lt('Close'), true);
    close.addEventListener('click', d.close);
    foot.append(noteTools(n, d.close, li), close);
    d.box.appendChild(foot);
    close.focus();
  }

  function noteEl(n, li) {
    const box = el('div', 'routility-injected routility-req-note');
    box.dataset.noteId = String(n.id);
    box.tabIndex = 0;
    box.setAttribute('role', 'button');
    const shown = clean(String(n.text || ''));
    const text = el('span', 'text-body-small routility-req-note-text');
    fillText(text, shown);
    box.dataset.rtTip = shown;
    box.appendChild(text);
    const open = (e) => {
      if (e.target.closest('a')) return;
      e.preventDefault();
      e.stopPropagation();
      openNote(n, li);
    };
    box.addEventListener('click', open);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
    return box;
  }

  function loadNotes() {
    if (!notesAsk && Date.now() - notesAt > 60000) {
      notesAsk = ask({ type: 'socialNotes' }).then((list) => {
        notesAsk = null;
        notesAt = Date.now();
        if (!Array.isArray(list)) return;
        notes = new Map();
        for (const n of list.sort((a, b) => a.at - b.at)) if (n && n.fromUserId && n.text) notes.set(String(n.fromUserId), n);
        document.querySelectorAll('.routility-req-note').forEach(x => x.remove());
        tick();
      });
    }
  }

  function placeNotes() {
    if (!messagesOn()) return;
    loadNotes();
    if (!notes || !notes.size) return;
    const cards = [...document.querySelectorAll('#friends-web-app .tab-pane.active li.avatar-card, li.routility-rf-card')];
    for (const li of cards) {
      const id = cardUserId(li);
      const n = id && notes.get(id);
      if (!n || li.querySelector('.routility-req-note')) continue;
      const after = li.querySelector('.routility-req-sent') || li.querySelector('.avatar-card-label');
      if (after) after.after(noteEl(n, li));
    }
  }

  async function friendStatus(target) {
    try {
      const res = await fetch(`https://friends.roblox.com/v1/users/${myId()}/friends/statuses?userIds=${target}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      const d = (await res.json()).data || [];
      return d[0] ? d[0].status : null;
    } catch {
      return null;
    }
  }

  function placeProfileNote() {
    const target = profileTarget();
    const old = document.querySelector('.routility-view-note');
    if (!target || target === myId() || !messagesOn()) {
      old?.remove();
      return;
    }
    loadNotes();
    const n = notes && notes.get(target);
    if (!n) {
      old?.remove();
      return;
    }
    if (!incoming || incoming.target !== target) {
      incoming = { target, status: undefined };
      const s = incoming;
      friendStatus(target).then((st) => {
        if (incoming !== s) return;
        s.status = st;
        tick();
      });
      return;
    }
    const accept = addFriendButton();
    if (incoming.status !== 'RequestReceived' || !accept) {
      old?.remove();
      return;
    }
    if (old && old.previousElementSibling === accept) return;
    const mine = old || accept.cloneNode(true);
    if (!old) {
      mine.classList.add('routility-injected', 'routility-view-note');
      mine.removeAttribute('id');
      mine.disabled = false;
      mine.classList.remove('bg-action-emphasis', 'content-action-emphasis');
      mine.classList.add('bg-action-standard', 'content-action-standard');
      const label = [...mine.querySelectorAll('span')].reverse().find(sp => sp.textContent.trim()) || mine;
      label.textContent = lt('View Message');
      mine.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const latest = notes && notes.get(target);
        if (latest) openNote(latest, null, profileWho());
      });
    }
    accept.after(mine);
  }

  function addFriendButton() {
    const head = document.querySelector('#content .user-profile-header-info');
    return head ? head.querySelector('button.foundation-web-button:not(.routility-view-note)') : null;
  }

  function prepSend() {
    const target = profileTarget();
    if (!target || target === myId() || !canMessage() || !(badges.get(target) || {}).messages) {
      send = null;
      return;
    }
    if (send && send.target === target) return;
    send = { target, status: undefined };
    const s = send;
    friendStatus(target).then((st) => {
      if (send === s) s.status = st;
    });
  }

  function addFriend() {
    const add = addFriendButton();
    if (!add || add.disabled) return;
    passing = true;
    try {
      add.click();
    } finally {
      passing = false;
    }
  }

  function onAddClick(e) {
    if (passing || !observer) return;
    const add = addFriendButton();
    if (!add || !add.contains(e.target)) return;
    prepSend();
    if (!send || send.status !== 'NotFriends' || send.target !== profileTarget()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    compose(send.target);
  }

  async function signIn(btn) {
    const res = await ask({ type: 'forumSignIn' });
    if (!res || !res.pairing) return false;
    const pairing = res.pairing;
    const until = Date.now() + 180000;
    btn.label.textContent = lt('Signing In…');
    btn.disabled = true;
    while (Date.now() < until) {
      await new Promise(r => setTimeout(r, 1000));
      const r = await ask({ type: 'forumClaim', pairing });
      if (r && r.status === 200) {
        ask({ type: 'forumSignInClose', pairing });
        return true;
      }
      if (r && r.status && r.status !== 404) break;
    }
    btn.disabled = false;
    return false;
  }

  function compose(target) {
    const name = document.querySelector('#profile-header-title-container-name')?.textContent.trim() || lt('They');
    const d = dialog(lt('Add {name} as a Friend', { name }));
    d.box.appendChild(el('p', 'text-body-medium content-muted routility-note-copy', lt('{name} uses RoUtility, so you can add a message they’ll see with your request. No links or contact info.', { name })));
    const area = el('textarea', 'routility-note-input text-body-medium');
    area.maxLength = MAX;
    area.rows = 3;
    area.placeholder = lt('Add a message (optional)');
    const count = el('span', 'text-body-small content-muted routility-note-count', `0/${MAX}`);
    const status = el('p', 'text-body-small routility-note-status');
    status.setAttribute('role', 'status');
    const foot = el('div', 'routility-note-foot');
    const cancel = button(lt('Cancel'));
    const askVerify = lt('Verify with Roblox once to send messages. Roblox opens a window where you click Allow. Or clear the message to just add them.');
    let verify = !(who && who.verified);
    const noContact = lt('Messages can’t include links or contact info, like emails, phone numbers or social media names.');
    const go = button(lt('Send Request'), true);
    foot.append(cancel, go);
    d.box.append(area, count, status, foot);
    const bad = (text) => {
      status.textContent = text;
      status.classList.add('routility-note-bad');
    };
    const sync = () => {
      count.textContent = `${area.value.length}/${MAX}`;
      if (!go.disabled) go.label.textContent = verify && area.value.trim() ? lt('Verify with Roblox') : lt('Send Request');
    };
    const verified = () => {
      if (!verify) return;
      verify = false;
      status.classList.remove('routility-note-bad');
      status.textContent = lt('Verified. You can send your message now.');
      sync();
    };
    onVerified = () => {
      if (d.box.isConnected) verified();
      else onVerified = null;
    };
    if (verify) status.textContent = askVerify;
    area.addEventListener('input', sync);
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (!go.disabled) go.click();
    });
    sync();
    area.focus();
    cancel.addEventListener('click', d.close);
    go.addEventListener('click', async () => {
      const text = area.value.trim();
      if (!text) {
        d.close();
        addFriend();
        return;
      }
      status.textContent = '';
      status.classList.remove('routility-note-bad');
      if (verify) {
        if (!(await signIn(go))) {
          sync();
          return bad(lt('Verifying didn’t finish. Try again.'));
        }
        const r = await ask({ type: 'socialSync', force: true });
        go.disabled = false;
        if (!r || !r.ok) {
          sync();
          return bad(lt('Couldn’t verify right now. Try again in a minute.'));
        }
        who = await ask({ type: 'socialState', me: myId() }) || who;
        verified();
        return;
      }
      if (CONTACT.test(text)) return bad(noContact);
      go.disabled = true;
      go.label.textContent = lt('Sending…');
      const r = await ask({ type: 'socialSendNote', toUserId: target, text });
      if (!r || !r.ok) {
        go.disabled = false;
        if (r && r.status === 401 && r.error === 'not_verified') verify = true;
        sync();
        if (r && r.status === 429) bad(lt('You’ve sent a lot of messages. Try again in {n} minutes, or clear the message to just add them.', { n: Math.max(1, Math.ceil((Number(r.retryAfter) || 600) / 60)) }));
        else if (r && r.status === 400 && r.error === 'blocked_text') bad(lt('Messages can’t include links, contact info or swearing. Edit it, or clear the message to just add them.'));
        else if (r && r.status === 403 && r.error === 'banned') bad(lt('You can’t send messages with friend requests anymore. Clear the message to just add them.'));
        else if (r && r.status === 403) bad(lt('They can’t get messages right now. Clear the message to just add them.'));
        else if (r && r.status === 401 && r.error === 'not_verified') bad(askVerify);
        else if (r && r.status === 401) bad(lt('Sign in to Roblox to send messages.'));
        else bad(lt('Couldn’t send it. Try again, or clear the message to just add them.'));
        return;
      }
      d.close();
      addFriend();
      toast(lt('Friend request sent with your message.'));
    });
  }

  function tick() {
    if (!observer) return;
    placeBadges();
    if (onRequests()) placeNotes();
    placeProfileNote();
    prepSend();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(onFrame(tick));
    observer.observe(document.querySelector('#content') || document.body, { childList: true, subtree: true });
    const header = document.querySelector('#header');
    if (header) observer.observe(header, { childList: true, subtree: true });
    document.addEventListener('click', onAddClick, true);
    window.addEventListener('hashchange', tick);
    ask({ type: 'socialState', me: myId() }).then((s) => {
      who = s;
      if (s && s.me) ask({ type: 'socialSync' });
      tick();
    });
    tick();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    window.removeEventListener('hashchange', tick);
    document.removeEventListener('click', onAddClick, true);
    document.querySelectorAll('.routility-user-badge, .routility-name-holder, .routility-req-note, .routility-view-note').forEach(n => n.remove());
  }

  chrome.storage.local.get('routilitySettings', (st) => {
    settings = (st && st.routilitySettings) || {};
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.routilitySettings) {
      const before = settings;
      settings = changes.routilitySettings.newValue || {};
      if (before.socialFilter !== settings.socialFilter) document.querySelectorAll('.routility-req-note').forEach(n => n.remove());
      tick();
    }
    if (changes.routilityForumAuth || changes.routilitySocialAccounts) ask({ type: 'socialState', me: myId() }).then((s) => {
      who = s;
      notesAt = 0;
      if (s && s.verified && onVerified) onVerified();
      tick();
    });
  });

  window.RoUtilitySocial = { start, stop };
})();
