import { existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import type { RegisterResponse, WallToServer } from '../../shared/protocol';
import { attendees, isValidCedula, normalizeCedula } from './attendees';
import { config } from './config';
import { now, one, run, type Participant } from './db';
import { processOutbox, retryOutboxNow, startOutboxLoop } from './evius';
import {
  adminState, attachWall, clearQueue, detachWall, exportRows, onWallMessage, queueInfo, recoverOnBoot,
  register, skipCurrent,
} from './manager';

const app = express();
app.use(express.json({ limit: '50kb' }));

// ───────── registro (tablet) ─────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}

function toQueue(participant: Participant): RegisterResponse {
  const r = register(participant.id);
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, status: 'queued', queueId: r.queueId, nombre: participant.nombre, position: r.position };
}

/** Paso 1: la tablet envía la cédula. Si la conocemos, entra a la cola; si no, pide más datos. */
app.post('/api/register', (req, res) => {
  const body = req.body as { cedula?: unknown };
  const cedula = normalizeCedula(typeof body.cedula === 'string' ? body.cedula : '');
  if (!isValidCedula(cedula)) return res.json({ ok: false, error: 'invalid_cedula' } satisfies RegisterResponse);

  let p = one<Participant>('SELECT * FROM participants WHERE cedula = ?', cedula);
  if (!p) {
    const a = attendees.find(cedula);
    if (!a) return res.json({ ok: true, status: 'new' } satisfies RegisterResponse);
    if (!EMAIL.test(a.correo)) {
      // La base la conoce pero sin un correo válido: lo necesitamos para Evius.
      return res.json({ ok: true, status: 'new', nombre: a.nombre } satisfies RegisterResponse);
    }
    const id = run(
      'INSERT INTO participants (cedula, nombre, correo, origen, created_at) VALUES (?,?,?,?,?)',
      a.cedula, a.nombre, a.correo, 'base', now(),
    );
    p = one<Participant>('SELECT * FROM participants WHERE id = ?', id);
  } else if (!EMAIL.test(p.correo)) {
    return res.json({ ok: true, status: 'new', nombre: p.nombre } satisfies RegisterResponse);
  }
  if (!p) return res.json({ ok: false, error: 'server_error' } satisfies RegisterResponse);
  return res.json(toQueue(p));
});

/** Paso 2 (solo si la cédula no estaba o faltaba el correo): nombre, correo y autorización de datos. */
app.post('/api/register/new', (req, res) => {
  const body = req.body as { cedula?: unknown; nombre?: unknown; correo?: unknown; consent?: unknown };
  const cedula = normalizeCedula(typeof body.cedula === 'string' ? body.cedula : '');
  const nombre = cleanName(body.nombre);
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  const fail = (error: Extract<RegisterResponse, { ok: false }>['error']): Response =>
    res.json({ ok: false, error } satisfies RegisterResponse);

  if (!isValidCedula(cedula)) return fail('invalid_cedula');
  if (nombre.length < 3 || nombre.length > 120 || !/\p{L}/u.test(nombre)) return fail('invalid_name');
  if (!EMAIL.test(correo) || correo.length > 120) return fail('invalid_email');
  if (body.consent !== true) return fail('consent_required');

  let p = one<Participant>('SELECT * FROM participants WHERE cedula = ?', cedula);
  if (p) {
    run('UPDATE participants SET nombre = ?, correo = ?, consent_at = ? WHERE id = ?', nombre, correo, now(), p.id);
  } else {
    const origen = attendees.find(cedula) ? 'base' : 'nuevo';
    run(
      'INSERT INTO participants (cedula, nombre, correo, origen, consent_at, created_at) VALUES (?,?,?,?,?,?)',
      cedula, nombre, correo, origen, now(), now(),
    );
  }
  p = one<Participant>('SELECT * FROM participants WHERE cedula = ?', cedula);
  if (!p) return fail('server_error');
  return res.json(toQueue(p));
});

app.get('/api/queue/:id', (req, res) => {
  const info = queueInfo(Number(req.params.id));
  if (!info) return res.status(404).json({ ok: false });
  return res.json(info);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, attendees: attendees.info.total, evius: config.evius.mode });
});

// ───────── operador ─────────

function requirePin(req: Request, res: Response, next: NextFunction): void {
  if (req.header('x-admin-pin') === config.adminPin) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: 'pin' });
}

app.use('/api/admin', requirePin);
app.get('/api/admin/state', (_req, res) => res.json(adminState()));
app.post('/api/admin/skip', (_req, res) => res.json({ ok: skipCurrent() }));
app.post('/api/admin/clear-queue', (_req, res) => res.json({ ok: true, cleared: clearQueue() }));
app.post('/api/admin/retry-evius', (_req, res) => {
  retryOutboxNow();
  res.json({ ok: true });
});
app.post('/api/admin/reload-attendees', async (_req, res) => res.json({ ok: true, ...(await attendees.reload()) }));
app.get('/api/admin/export.csv', (_req, res) => {
  const rows = exportRows();
  const first = rows[0];
  const header = first ? Object.keys(first) : ['sin_datos'];
  const q = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => q(r[h] ?? '')).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sesiones-pared.csv"');
  res.send(`﻿${csv}`);
});

// ───────── web (build de la pared, /registro y /admin) ─────────

const dist = path.resolve(config.distDir);
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    return res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  console.warn(`[web] no existe ${dist}: ejecuta "npm run build" (o usa "npm run dev" con el proxy de Vite)`);
}

// ───────── WebSocket de la pared ─────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function parseWallMessage(raw: string): WallToServer | null {
  try {
    const m = JSON.parse(raw) as { t?: unknown };
    if (m.t === 'hello' || m.t === 'wall-idle' || m.t === 'session-start' || m.t === 'session-end') {
      return m as WallToServer;
    }
  } catch {
    /* mensaje inválido: se ignora */
  }
  return null;
}

wss.on('connection', (ws) => {
  let isWall = false;
  ws.on('message', (data) => {
    const msg = parseWallMessage(data.toString());
    if (!msg) return;
    if (msg.t === 'hello') {
      isWall = true;
      attachWall(ws);
      return;
    }
    if (isWall) onWallMessage(msg);
  });
  ws.on('close', () => {
    if (isWall) detachWall(ws);
  });
  ws.on('error', () => ws.close());
});

// ───────── arranque ─────────

recoverOnBoot();
await attendees.reload();
attendees.startAutoRefresh();
startOutboxLoop();
void processOutbox();

server.listen(config.port, config.host, () => {
  console.log(`\nEnRuta · servidor local en el puerto ${config.port}`);
  console.log(`  Pared:    http://localhost:${config.port}/`);
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i?.address);
  for (const ip of lan) console.log(`  Tablet:   http://${ip}:${config.port}/registro`);
  console.log(`  Operador: http://localhost:${config.port}/admin  (PIN en ADMIN_PIN)`);
  console.log(`  Evius: ${config.evius.mode} · Asistentes: ${attendees.info.total} (${attendees.info.source})\n`);
});
