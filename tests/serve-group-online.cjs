// Manual browser fixture: node tests/serve-group-online.cjs
// Open http://127.0.0.1:4173/communities/1200769/Test
// Optional ?scenario=error, ?scenario=limited, ?scenario=slow or ?disabled=1.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = new Set(['/src/core/ui.js', '/src/features/communities/online.js', '/src/features/communities/communities.js', '/styles/routility.css', '/styles/explorer.css']);
const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Online Members browser fixture</title>
<link rel="stylesheet" href="/styles/routility.css"><link rel="stylesheet" href="/styles/explorer.css">
<style>
:root { --color-content-emphasis:#f7f7f8; --color-content-muted:#bbbcbe; --color-surface-100:#1b1c20; --color-surface-300:#393b3d; }
body { background:#121318; color:#f7f7f8; font:16px Arial,sans-serif; margin:32px; }
a { color:inherit; text-decoration:none; } button,input { font:inherit; } button { cursor:pointer; } button:disabled { opacity:.4; cursor:default; }
.profile-insights-container { display:flex; gap:8px; } .profile-insight-pill-button { border:0; color:inherit; background:#393b3d; padding:8px 12px; border-radius:24px; }
.btn-primary-md,.btn-primary-sm,.btn-secondary-md { padding:8px 12px; border:0; border-radius:8px; color:inherit; background:#335fff; }
.btn-secondary-md { background:#393b3d; } .form-control { box-sizing:border-box; background:#24262c; color:inherit; border:1px solid #666; border-radius:8px; padding:8px; }
.text-body-small { font-size:13px; } .content-muted { color:#bbbcbe; } .routility-modal-head { margin-bottom:16px; } .routility-modal-close:after { content:'×'; font-size:24px; }
</style></head><body><h1>Official Group of Roblox · Test fixture</h1>
<p>205 mock members. This page uses the real shared UI, community router, scanner and styles.</p>
<div class="profile-insights-container"><span class="profile-insight-pill-button">205 Members</span></div>
<p><button id="navigate">Navigate to another group</button></p>
<script>
const params = new URLSearchParams(location.search);
const fill = (s, vars) => s.replace(/\\{(\\w+)\\}/g, (m, k) => vars?.[k] ?? m);
window.RoUtilityI18n = { lt: fill, LT: s => s, ltn: (n,a,b,v) => fill(n===1?a:b,{n,...v}), locale: () => 'en-US' };
const disabled = { groupFriends:false, groupDetails:false, groupManage:false, groupAdmin:false, groupFind:false, groupHiddenGames:false, groupCreated:false, groupJoined:false, groupCount:false, groupOnline:!params.has('disabled') };
window.chrome = { storage:{onChanged:{addListener:()=>{}},local:{get:(key,cb)=>cb({routilitySettings:disabled}),set:()=>{}}}, runtime:{id:'fixture',onMessage:{addListener:()=>{}},sendMessage:(msg,cb)=>cb({})} };
window.fetch = async (url, init={}) => {
  const signal = init.signal;
  signal?.throwIfAborted();
  await new Promise((resolve,reject) => {
    const abort = () => {clearTimeout(timer);reject(signal.reason);};
    const timer = setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();}, params.get('scenario')==='slow'?10000:80);
    signal?.addEventListener('abort',abort,{once:true});
  });
  if (url.includes('groups.roblox.com')) {
    const cursor = Number(new URL(url).searchParams.get('cursor') || 0);
    if (cursor && params.get('scenario')==='error') return new Response('{}',{status:403});
    if (params.get('scenario')==='limited') return new Response('{}',{status:429});
    const count = Math.min(100,205-cursor);
    return Response.json({data:Array.from({length:count},(_,i)=>{const id=cursor+i+1;return {user:{userId:id,username:'Player'+id,displayName:'Player '+id},role:{name:'Member',rank:1}};}), nextPageCursor:cursor+count<205?String(cursor+count):null});
  }
  if (url.includes('presence.roblox.com')) {
    const ids=JSON.parse(init.body).userIds;
    if(ids.length>50) return new Response('{}',{status:400});
    return Response.json({userPresences:ids.filter(id=>id!==205).map(userId=>({userId,userPresenceType:userId%4,placeId:userId%4===2?(userId%8===2?123:456):null,rootPlaceId:userId%8===2?123:456,universeId:userId%4===2?(userId%8===2?1001:1002):null,lastLocation:userId%8===2?'Harbor':'Mountain',gameId:userId%8===2?'01234567-89ab-cdef-0123-456789abcdef':null}))});
  }
  if (url.includes('games.roblox.com/v1/games?')) {
    return Response.json({data:new URL(url).searchParams.get('universeIds').split(',').map(Number).map(id=>({id,name:id===1001?'Mock Harbor':'Mock Mountain',rootPlaceId:id===1001?123:456}))});
  }
  if (url.includes('thumbnails.roblox.com/v1/games/icons')) {
    return Response.json({data:new URL(url).searchParams.get('universeIds').split(',').map(Number).map(targetId=>({targetId,imageUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="'+(targetId===1001?'#127b91':'#5939a8')+'"/><text x="40" y="55" text-anchor="middle" font-size="46" fill="white">'+(targetId===1001?'H':'M')+'</text></svg>')}))});
  }
  throw new Error('Unexpected fixture request');
};
document.getElementById('navigate').addEventListener('click',()=>history.pushState({},'', '/communities/999/Test'));
</script>
<script src="/src/core/ui.js"></script><script src="/src/features/communities/online.js"></script><script src="/src/features/communities/communities.js"></script>
</body></html>`;
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1:4173').pathname;
  if (files.has(pathname)) {
    res.setHeader('content-type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(fs.readFileSync(path.join(root, pathname)));
  } else if (pathname.startsWith('/communities/')) {
    res.setHeader('content-type', 'text/html');
    res.end(fixture);
  } else { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1', () => console.log('Online Members fixture: http://127.0.0.1:4173/communities/1200769/Test'));
