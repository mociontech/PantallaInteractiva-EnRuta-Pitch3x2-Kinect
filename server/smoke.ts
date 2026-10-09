/**
 * Prueba de humo del servidor: simula la tablet (HTTP) y la pared (WebSocket).
 * Uso:  PORT=3055 DB_PATH=server/data/smoke.db EVIUS_MODE=mock npm run server   (en otra terminal)
 *       SMOKE_URL=http://localhost:3055 npm run server:smoke
 */
import WebSocket from 'ws';
import type { AdminState, QueueInfo, RegisterResponse, ServerToWall, SessionSummary } from '../shared/protocol';

const base = process.env.SMOKE_URL ?? 'http://localhost:3055';
const pin = process.env.ADMIN_PIN ?? '1234';
let failures = 0;

function check(name: string, ok: boolean, extra?: unknown): void {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` -> ${JSON.stringify(extra)}`}`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify(body) });
  return (await res.json()) as T;
}
async function get<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { headers: { 'x-admin-pin': pin } });
  return (await res.json()) as T;
}
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const inbox: ServerToWall[] = [];
const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
ws.on('message', (d) => inbox.push(JSON.parse(d.toString()) as ServerToWall));
await new Promise<void>((r) => ws.on('open', () => r()));
const send = (m: unknown): void => ws.send(JSON.stringify(m));

const summary = (score: number, completed: boolean): SessionSummary => ({
  localId: 'local-1', completed, lastStep: completed ? 6 : 3, score, gameScore: 50,
  areas: ['vender', 'aprender'], solutionsViewed: ['formacion', 'eventos'], durationMs: 90_000, startedAt: Date.now() - 90_000,
});

// 1. Validaciones
check('cédula inválida', (await post<RegisterResponse>('/api/register', { cedula: '12' })).ok === false);

// 2. Pared conectada y cédula conocida -> asignación inmediata
send({ t: 'hello' });
await wait(150);
const r1 = await post<RegisterResponse>('/api/register', { cedula: '1.000.000.002' });
check('cédula de la base entra a la cola', r1.ok && r1.status === 'queued' && r1.nombre === 'Carlos Rodriguez', r1);
await wait(150);
const a1 = inbox.find((m) => m.t === 'assign');
check('la pared recibe la asignación', a1?.t === 'assign' && a1.participant.nombre.startsWith('Carlos'), inbox);
if (r1.ok && r1.status === 'queued') {
  const info = await get<QueueInfo>(`/api/queue/${r1.queueId}`);
  check('su turno está activo (posición 0)', info.status === 'active' && info.position === 0, info);
}

// 3. Cédula desconocida -> pide datos; con consentimiento entra a la cola detrás de Ana
const r2 = await post<RegisterResponse>('/api/register', { cedula: '999888777' });
check('cédula desconocida pide datos', r2.ok && r2.status === 'new', r2);
const bad = await post<RegisterResponse>('/api/register/new', { cedula: '999888777', nombre: 'Pedro Nuevo', correo: 'pedro@ejemplo.com', consent: false });
check('sin consentimiento se rechaza', !bad.ok && bad.error === 'consent_required', bad);
const badMail = await post<RegisterResponse>('/api/register/new', { cedula: '999888777', nombre: 'Pedro Nuevo', correo: 'pedro@', consent: true });
check('correo inválido se rechaza', !badMail.ok && badMail.error === 'invalid_email', badMail);
const r3 = await post<RegisterResponse>('/api/register/new', { cedula: '999888777', nombre: 'Pedro  Nuevo', consent: true });
check('nuevo usuario queda en la cola (1 persona delante)', r3.ok && r3.status === 'queued' && r3.position === 1, r3);

// 4. Base sin correo (lo habitual): entra directo, con el nombre ya formateado
const r4 = await post<RegisterResponse>('/api/register', { cedula: '1000000004' });
check('base sin correo entra directo a la cola', r4.ok && r4.status === 'queued' && r4.nombre === 'Jorge Herrera' && r4.position === 2, r4);
const r5 = await post<RegisterResponse>('/api/register', { cedula: '1000000003' });
check('apellido compuesto bien separado', r5.ok && r5.status === 'queued' && r5.nombre === 'Luisa Fernanda de la Cruz Martinez', r5);

// 5. Ana juega y termina -> se guarda; Pedro es el siguiente al volver la pared a IDLE
send({ t: 'session-start', localId: 'local-1' });
await wait(100);
send({ t: 'session-end', summary: summary(180, true) });
await wait(200);
let admin = await get<AdminState>('/api/admin/state');
check('sesión guardada y en cola de Evius', admin.recent[0]?.nombre.startsWith('Carlos') && admin.recent[0].score === 180, admin.recent);
check('Evius mock la marcó como enviada', admin.recent[0]?.evius === 'sent', admin.recent[0]);
check('la pared sigue ocupada hasta volver a IDLE', admin.wall === 'finishing', admin.wall);
inbox.length = 0;
send({ t: 'wall-idle' });
await wait(200);
const a2 = inbox.find((m) => m.t === 'assign');
check('al volver a IDLE se asigna a Pedro', a2?.t === 'assign' && a2.participant.nombre === 'Pedro Nuevo', inbox);

// 6. Pedro abandona
send({ t: 'session-start', localId: 'local-2' });
await wait(100);
send({ t: 'session-end', summary: { ...summary(40, false), localId: 'local-2' } });
send({ t: 'wall-idle' });
await wait(200);
admin = await get<AdminState>('/api/admin/state');
check('el abandono también se registra', admin.recent[0]?.nombre === 'Pedro Nuevo' && !admin.recent[0].completed, admin.recent[0]);
check('la fila avanza: Jorge tiene el turno y Luisa espera', admin.waiting.length === 1 && admin.active?.nombre === 'Jorge Herrera' && admin.wall === 'assigned', admin);

// 7. Operador
const noPin = await fetch(base + '/api/admin/state');
check('el operador exige PIN', noPin.status === 401);
const csv = await (await fetch(base + '/api/admin/export.csv', { headers: { 'x-admin-pin': pin } })).text();
check('exporta CSV con las dos sesiones', csv.split('\r\n').length === 3, csv);

ws.close();
console.log(failures === 0 ? '\nTodo OK' : `\n${failures} fallos`);
process.exit(failures === 0 ? 0 : 1);
