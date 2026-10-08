import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config';

mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS participants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula     TEXT NOT NULL UNIQUE,
    nombre     TEXT NOT NULL,
    correo     TEXT NOT NULL,
    origen     TEXT NOT NULL,            -- 'base' (Sheet del cliente) | 'nuevo' (registrado en la tablet)
    consent_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS queue (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    status         TEXT NOT NULL,        -- waiting | active | playing | done | expired | skipped
    created_at     TEXT NOT NULL,
    activated_at   TEXT,
    finished_at    TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    local_id       TEXT,
    started_at     TEXT,
    ended_at       TEXT NOT NULL,
    completed      INTEGER NOT NULL,
    last_step      INTEGER NOT NULL,
    score          INTEGER NOT NULL,
    game_score     INTEGER NOT NULL,
    areas          TEXT NOT NULL,
    solutions      TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    device_id      TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outbox (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id),
    payload     TEXT NOT NULL,
    status      TEXT NOT NULL,           -- pending | sent
    attempts    INTEGER NOT NULL DEFAULT 0,
    next_try_at INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TEXT NOT NULL,
    sent_at     TEXT
  );
`);

export interface Participant {
  id: number;
  cedula: string;
  nombre: string;
  correo: string;
  origen: 'base' | 'nuevo';
  consent_at: string | null;
  created_at: string;
}

export interface QueueRow {
  id: number;
  participant_id: number;
  status: 'waiting' | 'active' | 'playing' | 'done' | 'expired' | 'skipped';
  created_at: string;
  activated_at: string | null;
  finished_at: string | null;
}

export interface SessionRow {
  id: number;
  participant_id: number;
  local_id: string | null;
  started_at: string | null;
  ended_at: string;
  completed: number;
  last_step: number;
  score: number;
  game_score: number;
  areas: string;
  solutions: string;
  duration_ms: number;
  device_id: string;
}

export interface OutboxRow {
  id: number;
  session_id: number;
  payload: string;
  status: 'pending' | 'sent';
  attempts: number;
  next_try_at: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

/** Los resultados de node:sqlite llegan como objetos genéricos: se tipan aquí, en un solo lugar. */
export function one<T>(sql: string, ...params: Array<string | number | null>): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function all<T>(sql: string, ...params: Array<string | number | null>): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function run(sql: string, ...params: Array<string | number | null>): number {
  return Number(db.prepare(sql).run(...params).lastInsertRowid);
}

export const now = (): string => new Date().toISOString();
