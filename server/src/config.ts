import { existsSync } from 'node:fs';

// Variables de entorno desde .env (si existe). Las mismas que usa Vite (las VITE_* se ignoran aquí).
try {
  if (existsSync('.env')) process.loadEnvFile('.env');
} catch {
  /* sin .env: se usan los valores por defecto */
}

const env = process.env;

export type NameOrder = 'auto' | 'apellidos-nombres' | 'nombres-apellidos' | 'tal-cual';

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback;
}

/** Todo lo configurable del servidor. Lo no confirmado con el cliente / Evius está marcado [CONFIRMAR]. */
export const config = {
  port: num(env.PORT, 3001),
  host: env.HOST ?? '0.0.0.0',
  dbPath: env.DB_PATH ?? 'server/data/enruta.db',
  /** Carpeta del build de la web (pared, /registro y /admin). */
  distDir: env.DIST_DIR ?? 'dist',
  /** PIN de la pantalla del operador (/admin). Cámbialo en .env. */
  adminPin: env.ADMIN_PIN ?? '1234',
  /** Si la persona asignada no empieza en la pared en este tiempo, se pasa a la siguiente. */
  turnTimeoutMs: num(env.TURN_TIMEOUT_MS, 120_000),
  /** [CONFIRMAR] 'allow': una cédula puede jugar más de una vez; 'block': solo una vez. */
  replayPolicy: env.REPLAY_POLICY === 'block' ? ('block' as const) : ('allow' as const),
  /** Identificador de esta pared en los datos enviados a Evius. */
  deviceId: env.DEVICE_ID ?? env.VITE_DEVICE_ID ?? 'pared-01',

  attendees: {
    /** Archivo CSV local (exportado del Sheet del cliente). */
    csvPath: env.ATTENDEES_CSV ?? 'server/data/asistentes.csv',
    /** [CONFIRMAR] URL de exportación CSV del Google Sheet (compartido por enlace). Tiene prioridad sobre el archivo. */
    csvUrl: env.ATTENDEES_CSV_URL ?? '',
    /** Cada cuánto se vuelve a leer la fuente (ms). */
    refreshMs: num(env.ATTENDEES_REFRESH_MS, 300_000),
    /**
     * Cómo viene escrito el nombre en la base: 'auto' (por defecto: decide fila por fila, la base real mezcla ambos),
     * 'apellidos-nombres' ("PEREZ GOMEZ ANA MARIA"), 'nombres-apellidos' o 'tal-cual' (solo formato Título).
     */
    nameOrder: ((): NameOrder => {
      const v = env.NAME_ORDER;
      if (v === 'apellidos-nombres' || v === 'nombres-apellidos' || v === 'tal-cual') return v;
      return 'auto';
    })(),
  },

  evius: {
    /** 'http': POST a EVIUS_URL · 'mock': solo registra en consola · 'off': deja los envíos pendientes. */
    mode: ((): 'http' | 'mock' | 'off' => {
      if (env.EVIUS_MODE === 'mock') return 'mock';
      if (env.EVIUS_MODE === 'off') return 'off';
      return env.EVIUS_URL ? 'http' : 'off';
    })(),
    url: env.EVIUS_URL ?? '',
    token: env.EVIUS_TOKEN ?? '',
    authHeader: env.EVIUS_AUTH_HEADER ?? 'Authorization',
    /** Nombre de esta experiencia en Evius. [CONFIRMAR] */
    experience: env.EVIUS_EXPERIENCE ?? 'pared-interactiva',
    retryMs: num(env.EVIUS_RETRY_MS, 15_000),
  },
};
