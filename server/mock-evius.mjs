/**
 * Evius falso para probar la entrega (puerto MOCK_PORT, 4010 por defecto).
 *   POST /attendees  /experiences  /activities   (registran lo que reciben; exigen el token si MOCK_TOKEN está definido)
 *   POST /__config   {"fail":true}            -> responde 503 a todo (simula Evius caído)
 *                    {"noExperiences":true}   -> /experiences responde 404 (obliga al fallback a /activities)
 *   GET  /__log                               -> lo recibido (incluye Idempotency-Key y Authorization)
 *   POST /__reset                             -> limpia el registro
 */
import http from 'node:http';

const port = Number(process.env.MOCK_PORT ?? 4010);
const token = process.env.MOCK_TOKEN ?? '';
const cfg = { fail: false, noExperiences: false };
const log = [];
const seenAttendees = new Set();

const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => resolve(data));
});

http.createServer(async (req, res) => {
  const body = await readBody(req);
  const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.url === '/__log') return send(200, log);
  if (req.url === '/__reset') { log.length = 0; seenAttendees.clear(); return send(200, { ok: true }); }
  if (req.url === '/__config') { Object.assign(cfg, JSON.parse(body || '{}')); return send(200, cfg); }

  let json = {};
  try { json = JSON.parse(body || '{}'); } catch { /* cuerpo inválido */ }
  let status = 201;
  let out = { ok: true };
  if (token && req.headers.authorization !== `Bearer ${token}`) { status = 401; out = { error: 'token' }; }
  else if (cfg.fail) { status = 503; out = { error: 'caido' }; }
  else if (req.url === '/attendees') {
    const key = `${json.eventId}:${json.cedula}`;
    if (seenAttendees.has(key)) { status = 409; out = { error: 'ya existe' }; } else seenAttendees.add(key);
  } else if (req.url === '/experiences' && cfg.noExperiences) { status = 404; out = { error: 'no existe' }; }
  else if (!['/experiences', '/activities'].includes(req.url ?? '')) { status = 404; out = { error: 'ruta' }; }
  log.push({ at: new Date().toISOString(), route: req.url, status, idempotencyKey: req.headers['idempotency-key'] ?? null, auth: req.headers.authorization ?? null, body: json });
  console.log(`[mock-evius] ${req.method} ${req.url} -> ${status}`);
  send(status, out);
}).listen(port, () => console.log(`[mock-evius] escuchando en :${port}`));
