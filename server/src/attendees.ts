import { existsSync, readFileSync } from 'node:fs';
import { config } from './config';
import { parseCsv } from './csv';

export interface Attendee {
  cedula: string;
  nombre: string;
  correo: string;
}

/** Deja solo los dígitos: "1.234.567-8" y "12345678" son la misma cédula. */
export function normalizeCedula(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCedula(cedula: string): boolean {
  return cedula.length >= 5 && cedula.length <= 12;
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** [CONFIRMAR] Nombres de columna posibles en el Sheet del cliente (sin tildes, en minúsculas). */
const ALIASES = {
  cedula: ['cedula', 'cc', 'documento', 'identificacion', 'numero de documento', 'numero de identificacion', 'numero documento', 'no. documento', 'nro documento', 'id'],
  nombre: ['nombre', 'nombres', 'nombre completo', 'nombre y apellido', 'nombres y apellidos', 'nombre del colaborador', 'colaborador', 'asistente', 'name'],
  apellido: ['apellido', 'apellidos'],
  correo: ['correo', 'correo electronico', 'correo corporativo', 'email', 'e-mail', 'mail'],
} as const;

/** Palabras clave para reconocer una columna cuando su nombre no es exactamente uno de los alias. */
const STEMS = {
  cedula: ['cedula', 'documento', 'identificacion'],
  nombre: ['nombre', 'colaborador', 'empleado'],
  apellido: ['apellido'],
  correo: ['correo', 'email', 'mail'],
} as const;

/** Primero el nombre exacto (alias); si no, la primera columna libre que contenga la palabra clave. */
function findColumn(header: string[], aliases: readonly string[], stems: readonly string[], taken: number[]): number {
  const h = header.map(norm);
  for (const a of aliases) {
    const i = h.indexOf(a);
    if (i >= 0 && !taken.includes(i)) return i;
  }
  return h.findIndex((name, i) => !taken.includes(i) && stems.some((s) => name.includes(s)));
}

export interface LoadResult {
  total: number;
  skipped: number;
  source: string;
}

/**
 * Base de asistentes del cliente (Google Sheet exportado como CSV, por URL o archivo).
 * Se lee completa a memoria: son miles de filas como mucho y la búsqueda por cédula es inmediata.
 */
class AttendeeSource {
  private map = new Map<string, Attendee>();
  info: LoadResult & { loadedAt: string | null; error: string | null } = {
    total: 0, skipped: 0, source: 'ninguna', loadedAt: null, error: null,
  };

  find(cedula: string): Attendee | null {
    return this.map.get(cedula) ?? null;
  }

  async reload(): Promise<LoadResult> {
    try {
      const { text, source } = await this.read();
      const result = this.ingest(text, source);
      this.info = { ...result, loadedAt: new Date().toISOString(), error: null };
      console.log(`[asistentes] ${result.total} cargados de ${source} (${result.skipped} filas omitidas)`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.info = { ...this.info, error: message };
      console.warn(`[asistentes] no se pudo cargar: ${message} (se conserva la última lectura: ${this.map.size})`);
      return { total: this.map.size, skipped: 0, source: this.info.source };
    }
  }

  private async read(): Promise<{ text: string; source: string }> {
    const { csvUrl, csvPath } = config.attendees;
    if (csvUrl) {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${csvUrl}`);
      return { text: await res.text(), source: 'URL del Sheet' };
    }
    const file = existsSync(csvPath) ? csvPath : 'server/data/asistentes.sample.csv';
    if (!existsSync(file)) throw new Error(`no existe ${csvPath} ni la URL del Sheet`);
    return { text: readFileSync(file, 'utf8'), source: file };
  }

  private ingest(text: string, source: string): LoadResult {
    const rows = parseCsv(text);
    const header = rows[0] ?? [];
    const taken: number[] = [];
    const pick = (key: keyof typeof ALIASES): number => {
      const i = findColumn(header, ALIASES[key], STEMS[key], taken);
      if (i >= 0) taken.push(i);
      return i;
    };
    const iCedula = pick('cedula');
    const iCorreo = pick('correo');
    const iApellido = pick('apellido');
    const iNombre = pick('nombre');
    if (iCedula < 0 || iNombre < 0 || iCorreo < 0) {
      throw new Error(
        `faltan columnas (cédula/nombre/correo). Encabezados vistos: ${header.join(' | ')}`,
      );
    }
    const next = new Map<string, Attendee>();
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const cedula = normalizeCedula(r[iCedula] ?? '');
      const nombre = [r[iNombre], iApellido >= 0 ? r[iApellido] : ''].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
      const correo = (r[iCorreo] ?? '').trim().toLowerCase();
      if (!isValidCedula(cedula) || !nombre) {
        skipped++;
        continue;
      }
      next.set(cedula, { cedula, nombre, correo });
    }
    this.map = next;
    return { total: next.size, skipped, source };
  }

  startAutoRefresh(): void {
    if (config.attendees.csvUrl) setInterval(() => void this.reload(), config.attendees.refreshMs).unref();
  }
}

export const attendees = new AttendeeSource();
