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

const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => resolve(data));
});

http.createServer(async (req, res) => {
  const body = await readBody(req);
  const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.url === '/__log') return send(200, log);
  if (req.url === '/__reset') { log.length = 0; return send(200, { ok: true }); }
  if (req.url === '/__config') { Object.assign(cfg, JSON.parse(body || '{}')); return send(200, cfg); }

  let json = {};
  try { json = JSON.parse(body || '{}'); } catch { /* cuerpo inválido */ }
  let status = 200;
  let out = { received: 0, processed: 0, failed: 0, errors: [] };
  const records = Array.isArray(json.records) ? json.records : [];
  if (token && req.headers.authorization !== `Bearer ${token}`) { status = 401; out = { error: 'token' }; }
  else if (cfg.fail) { status = 503; out = { error: 'caido' }; }
  else if (req.url === '/experiences' && cfg.noExperiences) { status = 404; out = { error: 'no existe' }; }
  else if (!['/attendees', '/experiences', '/activities'].includes(req.url ?? '')) { status = 404; out = { error: 'ruta' }; }
  else {
    // Como la API real: siempre 200, los errores van en el cuerpo.
    out.received = records.length;
    if (!json.eventId) out.errors.push('eventId is required');
    if (!records.length) out.errors.push('records must be a non-empty array');
    if (req.url === '/experiences' && !json.experienceId) out.errors.push('experienceId is required');
    if (!out.errors.length) {
      records.forEach((r, i) => {
        if (req.url === '/experiences' && !r.play_timestamp) out.errors.push(`record[${i}]: play_timestamp is required (ISO 8601 string)`);
        else if (req.url === '/activities' && !r.name) out.errors.push(`record[${i}]: name is required`);
        else if (req.url === '/attendees' && !r.cedula) out.errors.push(`record[${i}]: cedula is required`);
        else out.processed++;
      });
    }
    out.failed = out.received - out.processed;
  }
  log.push({ at: new Date().toISOString(), route: req.url, status, idempotencyKey: req.headers['idempotency-key'] ?? null, auth: req.headers.authorization ?? null, body: json });
  console.log(`[mock-evius] ${req.method} ${req.url} -> ${status}`);
  send(status, out);
}).listen(port, () => console.log(`[mock-evius] escuchando en :${port}`));
