/**
 * Juega una sesión completa como lo haría la pared: se conecta por WebSocket, registra la cédula (como la tablet),
 * recibe el turno, empieza y termina enviando el puntaje.
 *   node server/play.mjs <cedula> <puntaje> [completo=1|0]      (SERVER_URL por defecto http://localhost:3001)
 */
import WebSocket from 'ws';

const [cedula, score = '100', completed = '1'] = process.argv.slice(2);
const base = process.env.SERVER_URL ?? 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
await new Promise((r) => ws.on('open', r));
const inbox = [];
ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
const send = (m) => ws.send(JSON.stringify(m));
send({ t: 'hello' });
await wait(200);

const reg = await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cedula }) })).json();
console.log('registro:', JSON.stringify(reg));
if (!reg.ok || reg.status !== 'queued') process.exit(1);
await wait(300);
const assign = inbox.find((m) => m.t === 'assign');
console.log('turno asignado a:', assign?.participant?.nombre ?? '(nadie)');
if (!assign) process.exit(1);

send({ t: 'session-start', localId: `play-${Date.now()}` });
await wait(200);
send({
  t: 'session-end',
  summary: {
    localId: `play-${Date.now()}`, completed: completed === '1', lastStep: completed === '1' ? 6 : 3, score: Number(score),
    gameScore: 50, areas: ['vender', 'aprender'], solutionsViewed: ['formacion', 'eventos'], durationMs: 90000, startedAt: Date.now() - 90000,
  },
});
await wait(200);
send({ t: 'wall-idle' });
await wait(200);
ws.close();
console.log(`sesión enviada: ${score} puntos`);
