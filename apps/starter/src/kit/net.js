// Multiplayer over a plain WebSocket (works on iOS 8; matches a Cloudflare Durable Object like the timstaana lobby).
// socket.io also works on iOS 8, but plain WebSockets are lighter and are what Workers speak.
//
//   const net = connect('wss://example.com/room/abc', { onMessage: (m) => ..., onOpen: () => ... });
//   net.send({ t: 'pos', x, y });      // JSON; keep messages small (arrays beat objects)

export function connect(url, { onMessage = () => {}, onOpen = () => {}, onClose = () => {}, pingEvery = 25000 } = {}) {
  if (!/^wss?:/.test(url)) url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + (url[0] === '/' ? '' : '/') + url;
  let ws = null, wait = 1000, closed = false, pinger = null;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { wait = 1000; onOpen(); pinger = setInterval(() => send({ t: 'ping' }), pingEvery); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMessage(m); };
    ws.onclose = () => { clearInterval(pinger); onClose(); if (!closed) { setTimeout(open, wait); wait = Math.min(wait * 2, 10000); } };
    ws.onerror = () => {}; // onclose follows and reconnects
  };
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  open();
  return { send, close() { closed = true; if (ws) ws.close(); }, get open() { return !!ws && ws.readyState === 1; } };
}
