const PORT = 9333;
const FILE_URL = process.argv[2];
const OUT = process.argv[3];
async function main() {
  const listRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const target = await listRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  ws.addEventListener('message', (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
  function send(method, params = {}) { const thisId = ++id; ws.send(JSON.stringify({ id: thisId, method, params })); return new Promise((resolve) => pending.set(thisId, resolve)); }
  await send('Page.enable'); await send('Runtime.enable');
  const loadPromise = new Promise((resolve) => { const h=(ev)=>{const m=JSON.parse(ev.data); if(m.method==='Page.loadEventFired'){ws.removeEventListener('message',h); resolve();}}; ws.addEventListener('message', h); });
  await send('Page.navigate', { url: FILE_URL });
  await loadPromise;
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', { expression: `document.querySelector('.sec-process').scrollIntoView({block:'end'})` });
  await new Promise(r => setTimeout(r, 500));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', OUT);
  ws.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
