import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config, type NameOrder } from './config';
import { parseCsv } from './csv';
import { isGivenName } from './givenNames';

export interface Attendee {
  cedula: string;
  nombre: string;
  /** Cargo de trabajo (columna "Cargo de Trabajo" del CSV). */
  cargo: string;
  correo: string;
}

/** Deja solo los dígitos: "1.234.567-8" y "12345678" son la misma cédula. */
export function normalizeCedula(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCedula(cedula: string): boolean {
  return cedula.length >= 5 && cedula.length <= 12;
}

/** Partículas que forman parte de un apellido compuesto: "DE LA CRUZ", "DEL RIO", "DE LOS SANTOS"... */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa', 'da', 'di', 'van', 'von']);

/**
 * Detecta el orden de UNA fila: si los nombres de pila conocidos están al principio ("XIOMARA JOSE GAMARRA MENDOZA")
 * en vez de al final ("GAMARRA MENDOZA XIOMARA JOSE"), la fila viene como nombres-apellidos. Con empate, apellidos-nombres.
 */
function detectOrder(tokens: string[]): 'apellidos-nombres' | 'nombres-apellidos' {
  const words = tokens.filter((t) => !PARTICLES.has(t));
  const n = words.length;
  if (n < 2) return 'apellidos-nombres';
  const at = (i: number): number => (isGivenName(words[i] ?? '') ? 1 : 0);
  const head = at(0) + (n >= 4 ? at(1) : 0);
  const tail = at(n - 1) + (n >= 4 ? at(n - 2) : 0);
  return head > tail ? 'nombres-apellidos' : 'apellidos-nombres';
}

/** Cuántas de las últimas unidades son nombres de pila (el resto son apellidos). */
function givenNameCount(units: string[]): number {
  const n = units.length;
  if (n <= 2) return 1;
  const isName = (i: number): boolean => isGivenName(units[i] ?? '');
  // 3 unidades: "PEREZ GOMEZ ANA" (1 nombre) o "LOPEZ ANA MARIA" (2 nombres): si las dos últimas son nombres de pila, son 2.
  if (n === 3) return isName(1) && isName(2) ? 2 : 1;
  // 4 o más: lo habitual son 2 apellidos y 2 nombres; con 5+ puede haber un tercer nombre ("... JUAN CARLOS ANDRES").
  let k = 2;
  if (n >= 5 && isName(n - k - 1)) k = 3;
  return k;
}

/**
 * Deja el nombre legible: "PEREZ GOMEZ ANA MARIA" -> "Ana Maria Perez Gomez" (nombres primero).
 * Para separar apellidos de nombres se agrupan las partículas con la palabra siguiente ("DE LA CRUZ" es una unidad)
 * y se decide cuántas de las últimas unidades son nombres (ver givenNameCount, con una lista de nombres de pila comunes
 * para desempatar). Es una heurística: revisa el resultado con la base real.
 */
export function formatName(raw: string, requested: NameOrder): string {
  const tokens = raw.replace(/\s+/g, ' ').trim().toLowerCase().split(' ').filter(Boolean);
  if (tokens.length === 0) return '';
  const order = requested === 'auto' ? detectOrder(tokens) : requested;
  let units = tokens;
  if (order !== 'tal-cual') {
    units = [];
    let pending: string[] = [];
    for (const t of tokens) {
      pending.push(t);
      if (!PARTICLES.has(t)) {
        units.push(pending.join(' '));
        pending = [];
      }
    }
    if (pending.length) units.push(pending.join(' '));
    if (units.length > 1) {
      const names = givenNameCount(units);
      if (order === 'apellidos-nombres') units = [...units.slice(-names), ...units.slice(0, -names)];
    }
  }
  return units
    .join(' ')
    .split(' ')
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** [CONFIRMAR] Nombres de columna posibles en el Sheet del cliente (sin tildes, en minúsculas). */
const ALIASES = {
  cedula: ['cedula', 'cc', 'documento', 'identificacion', 'numero de documento', 'numero de identificacion', 'numero documento', 'no. documento', 'nro documento', 'id'],
  nombre: ['nombre', 'nombres', 'nombre completo', 'nombre y apellido', 'nombres y apellidos', 'nombre del colaborador', 'colaborador', 'asistente', 'name'],
  apellido: ['apellido', 'apellidos'],
  cargo: ['cargo', 'cargo de trabajo', 'cargo del colaborador', 'puesto', 'posicion', 'cargo actual'],
  correo: ['correo', 'correo electronico', 'correo corporativo', 'email', 'e-mail', 'mail'],
} as const;

/** Palabras clave para reconocer una columna cuando su nombre no es exactamente uno de los alias. */
const STEMS = {
  cedula: ['cedula', 'documento', 'identificacion'],
  nombre: ['nombre', 'colaborador', 'empleado'],
  apellido: ['apellido'],
  cargo: ['cargo', 'puesto'],
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

  /**
   * Reemplaza la base con un CSV subido desde /admin. Se valida antes de guardar: si faltan columnas
   * se lanza el error (con los encabezados vistos) y NO se toca la base actual.
   */
  upload(text: string): LoadResult {
    const result = this.ingest(text, 'archivo cargado desde /admin');
    mkdirSync(path.dirname(config.attendees.csvPath), { recursive: true });
    writeFileSync(config.attendees.csvPath, text, 'utf8');
    this.info = { ...result, loadedAt: new Date().toISOString(), error: null };
    console.log(`[asistentes] ${result.total} cargados desde /admin (${result.skipped} filas omitidas)`);
    return result;
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
    const iCargo = pick('cargo');
    const iNombre = pick('nombre');
    // El correo es opcional: si la base no lo trae, la tablet se lo pide a cada persona al registrarse.
    if (iCedula < 0 || iNombre < 0) {
      throw new Error(`faltan columnas (cédula/nombre). Encabezados vistos: ${header.join(' | ')}`);
    }
    const next = new Map<string, Attendee>();
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const cedula = normalizeCedula(r[iCedula] ?? '');
      const raw = [r[iNombre], iApellido >= 0 ? r[iApellido] : ''].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
      // Con columna de apellido aparte ya viene "nombre + apellido": solo se pone en formato Título.
      const nombre = formatName(raw, iApellido >= 0 ? 'tal-cual' : config.attendees.nameOrder);
      const correo = iCorreo >= 0 ? (r[iCorreo] ?? '').trim().toLowerCase() : '';
      if (!isValidCedula(cedula) || !nombre) {
        skipped++;
        continue;
      }
      const cargo = iCargo >= 0 ? (r[iCargo] ?? '').replace(/\s+/g, ' ').trim() : '';
      next.set(cedula, { cedula, nombre, cargo, correo });
    }
    this.map = next;
    return { total: next.size, skipped, source };
  }

  startAutoRefresh(): void {
    if (config.attendees.csvUrl) setInterval(() => void this.reload(), config.attendees.refreshMs).unref();
  }
}

export const attendees = new AttendeeSource();
