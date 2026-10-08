import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
/**
 * Prueba de punta a punta: abre la pared en Edge (modo headless), registra personas por la API como lo haría la tablet
 * y verifica saludo, inicio, envío del puntaje a Evius y paso a la siguiente persona.
 * Requiere: servidor en :3001 (EVIUS_MODE=mock, base de prueba) y la web en WALL_URL (por defecto el dev server de Vite).
 *   npm run server  +  npm run dev  ->  npm run e2e
 */
const SC = process.argv[2] ?? 'server/data';
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const WALL = process.env.WALL_URL ?? 'http://localhost:5173/?input=mouse&reg=1&debug=1';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, bad = 0;
const check = (n, c, x) => { c ? ok++ : bad++; console.log(`${c ? '✓' : '✗'} ${n}${c ? '' : ' -> ' + JSON.stringify(x)}`); };
const api = async (p, o) => (await fetch('http://localhost:3001' + p, { headers: { 'x-admin-pin': '1234', 'Content-Type': 'application/json' }, ...o })).json();

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--window-size=1920,1280', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
await wait(3000);
const targets = await (await fetch('http://localhost:9333/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0; const pending = new Map();
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const text = async () => (await cdp('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value;
const shot = async (n) => writeFileSync(`${SC}/${n}.png`, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const move = (x, y) => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const key = async (k) => { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };

await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1280, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: WALL });
await wait(3500);
let t = await text();
check('la pared espera registro', t.includes('Regístrate en la tablet'), t.slice(0, 300));
await shot('e2e-1-espera');

// La tablet registra a Ana (cédula de la base)
const r = await api('/api/register', { method: 'POST', body: JSON.stringify({ cedula: '1000000001' }) });
check('registro en la tablet', r.ok && r.status === 'queued', r);
await wait(800);
t = await text();
check('la pared saluda a Ana María', t.includes('Hola, Ana María'), t.slice(-200));
await shot('e2e-2-saludo');

// Comenzar con el cursor (dwell 1,5 s sobre el botón)
await move(1569, 1088);
await wait(300);
await move(1570, 1089);
await wait(2200);
t = await text();
check('al comenzar pasa a las instrucciones', t.includes('Controla con tu mano'), t.slice(0, 200));
await wait(300);
let st = await api('/api/admin/state');
check('el servidor marca la pared como jugando', st.wall === 'playing' && st.active?.nombre?.startsWith('Ana'), st);

// Salto de depuración al resultado: el puntaje se envía
await key('9');
await wait(1500);
st = await api('/api/admin/state');
check('el puntaje llegó al servidor y a Evius', st.recent[0]?.nombre?.startsWith('Ana') && st.recent[0].completed === true && st.recent[0].evius === 'sent', st.recent);
await shot('e2e-3-resultado');

// Otra persona se registra mientras la pared está en resultado: espera su turno
const r2 = await api('/api/register/new', { method: 'POST', body: JSON.stringify({ cedula: '999000111', nombre: 'Pedro Prueba', correo: 'pedro@ejemplo.com', consent: true }) });
check('segunda persona en cola', r2.ok && r2.status === 'queued', r2);
await wait(500);
await key('r'); // reinicia a IDLE
await wait(1500);
t = await text();
check('la pared pasa a la siguiente persona', t.includes('Hola, Pedro Prueba'), t.slice(-200));
await shot('e2e-4-siguiente');

ws.close(); edge.kill();
console.log(bad === 0 ? `\nTodo OK (${ok})` : `\n${bad} fallos`);
process.exit(bad === 0 ? 0 : 1);
