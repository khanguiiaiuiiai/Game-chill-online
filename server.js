// Happy World Online – server (Node + ws). Chạy trên Render: node server.js
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, VER = '2.0.0', MAX = 60;

const players = new Map();
let nid = 1;

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, version: VER, online: players.size }));
  }
  if (u === '/' || u === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(html);
    } catch (e) { res.writeHead(500); return res.end('Thiếu index.html'); }
  }
  res.writeHead(404); res.end('404');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

const HATS = ['', 'cap', 'bean', 'straw', 'cat', 'bun', 'wiz', 'crown'];
const GLS = ['', 'round', 'sun', 'heart'];
const PETS = ['', '🐶', '🐱', '🐰', '🐥', '🦊', '🐼', '🦄'];
const EMO = ['😀', '😂', '😍', '😭', '😡', '👍', '💃', '🎉'];
const col = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const num = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
const txt = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);

function clean(u) {
  u = u || {};
  return {
    n: txt(u.n, 14) || 'Bạn',
    top: col(u.top, '#ff7aa2'), hair: col(u.hair, '#5a3a2a'),
    hat: HATS.includes(u.hat) ? u.hat : '', gl: GLS.includes(u.gl) ? u.gl : '',
    g: u.g === 1 ? 1 : 0, pet: PETS.includes(u.pet) ? u.pet : '', veh: u.veh ? 1 : 0,
  };
}
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const bcast = (o, except) => { const s = JSON.stringify(o); for (const p of players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s); };

wss.on('connection', ws => {
  if (players.size >= MAX) { send(ws, { t: 'full' }); return ws.close(); }
  const p = { ws, id: String(nid++), u: null, x: 1800, y: 1400, z: 0, d: 1, sp: 0, fs: 0, fx: 0, fy: 0, r: 0, ct: 0, alive: true };
  ws.on('pong', () => { p.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hi' && !p.u) {
      p.u = clean(m.u); players.set(p.id, p);
      send(ws, { t: 'w', id: p.id, now: Date.now(), list: [...players.values()].filter(q => q !== p).map(q => [q.id, q.u, q.x, q.y]) });
      bcast({ t: 'j', id: p.id, u: p.u, x: p.x, y: p.y }, p);
      return;
    }
    if (!p.u) return;
    if (m.t === 's') {
      p.x = num(m.x, 0, 3600); p.y = num(m.y, 0, 2700); p.z = num(m.z, 0, 200);
      p.d = m.d < 0 ? -1 : 1; p.sp = num(m.sp, 0, 400);
      p.fs = num(m.fs, 0, 3) | 0; p.fx = num(m.fx, 0, 3600); p.fy = num(m.fy, 0, 2800); p.r = m.r ? 1 : 0;
    } else if (m.t === 'o') {
      p.u = clean(m.u); bcast({ t: 'o', id: p.id, u: p.u }, p);
    } else if (m.t === 'c') {
      const now = Date.now(); if (now - p.ct < 700) return; p.ct = now;
      const s = txt(m.m, 60); if (s) bcast({ t: 'c', id: p.id, m: s }, p);
    } else if (m.t === 'e') {
      if (EMO.includes(m.e)) bcast({ t: 'e', id: p.id, e: m.e }, p);
    }
  });
  ws.on('close', () => { if (players.delete(p.id)) bcast({ t: 'l', id: p.id }); });
  ws.on('error', () => {});
});

// gửi vị trí mọi người ~15 lần/giây
setInterval(() => {
  if (players.size < 2) return;
  const arr = [...players.values()].map(p => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.z), p.d, Math.round(p.sp), p.fs, Math.round(p.fx), Math.round(p.fy), p.r]);
  const s = JSON.stringify({ t: 'u', p: arr });
  for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(s);
}, 66);

// giữ kết nối, dọn client chết
setInterval(() => {
  for (const p of players.values()) {
    if (!p.alive) { p.ws.terminate(); continue; }
    p.alive = false; try { p.ws.ping(); } catch (e) {}
  }
}, 30000);

server.listen(PORT, () => console.log('Happy World Online v' + VER + ' chạy ở cổng ' + PORT));
