/**
 * Todos los textos de la experiencia. Nada hardcodeado en componentes.
 * Fuente: diseño de creatividad en Figma (página PARED DIGITAL INTERACTIVA, sección "Desarrollo").
 */

export type AreaId = 'vender' | 'organizar' | 'aprender' | 'conectar';
export type SolutionId =
  | 'formacion'
  | 'acompanamiento'
  | 'programas'
  | 'contactos'
  | 'informacion'
  | 'eventos';
export type ObstacleId = 'financiacion' | 'certificacion' | 'asesoria';

export interface NodeDef {
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
}

export const NODES: readonly NodeDef[] = [
  { n: 1, title: 'Conoce cómo\ncomienza la ruta' },
  { n: 2, title: 'Identifica las\nnecesidades del\nempresario o\nemprendedor' },
  { n: 3, title: 'Descubre cómo\nse construye su ruta' },
  { n: 4, title: 'Explora las\nsoluciones de\nEnruta' },
  { n: 5, title: 'Pon a prueba lo\naprendido' },
];

export interface SolutionDef {
  id: SolutionId;
  title: string;
  /** Texto que aparece al pasar la mano sobre la tarjeta. */
  short: string;
  /** Clave en ICONS (icono negro sobre cuadro naranja). */
  icon: string;
}

export const SOLUTIONS: Record<SolutionId, SolutionDef> = {
  formacion: { id: 'formacion', title: 'Formación', short: 'Conocimientos para avanzar.', icon: 'sol-formacion' },
  acompanamiento: { id: 'acompanamiento', title: 'Acompañamiento experto', short: 'Orientación para afrontar retos.', icon: 'sol-acompanamiento' },
  programas: { id: 'programas', title: 'Programas', short: 'Un proceso para fortalecer el negocio.', icon: 'sol-programas' },
  contactos: { id: 'contactos', title: 'Red de contactos', short: 'Relaciones que abren oportunidades.', icon: 'sol-contactos' },
  informacion: { id: 'informacion', title: 'Información estratégica', short: 'Información para decidir mejor.', icon: 'sol-informacion' },
  eventos: { id: 'eventos', title: 'Eventos', short: 'Espacios para aprender y conectar.', icon: 'sol-eventos' },
};

/** Orden de la grilla 3×2 de la Estación 4. */
export const SOLUTIONS_GRID: readonly SolutionId[] = [
  'formacion', 'acompanamiento', 'programas', 'contactos', 'informacion', 'eventos',
];

export interface ObstacleDef {
  id: ObstacleId;
  title: string;
  icon: string;
}

/** "Lo que no pertenece a tu ruta" (Juego de la Estación 5). [CONFIRMAR] regla de penalización en experience.ts */
export const OBSTACLES: Record<ObstacleId, ObstacleDef> = {
  financiacion: { id: 'financiacion', title: 'Financiación', icon: 'obs-financiacion' },
  certificacion: { id: 'certificacion', title: 'Certificación', icon: 'obs-certificacion' },
  asesoria: { id: 'asesoria', title: 'Asesoría legal', icon: 'obs-asesoria' },
};

export interface AreaDef {
  id: AreaId;
  /** Etiqueta en la Estación 2 (se muestra en mayúsculas). */
  title: string;
  /** Etiqueta en la Estación 3. */
  pill: string;
  /** Icono claro (Estación 2) e icono oscuro sobre círculo blanco (Estación 3). */
  iconLight: string;
  iconDark: string;
}

export const AREAS: Record<AreaId, AreaDef> = {
  vender: { id: 'vender', title: 'Vender más', pill: 'Vender más', iconLight: 'area-vender-s2', iconDark: 'area-vender' },
  organizar: { id: 'organizar', title: 'Organizar su negocio', pill: 'Organizar su negocio', iconLight: 'area-organizar', iconDark: 'area-organizar' },
  aprender: { id: 'aprender', title: 'Fortalecer sus conocimientos', pill: 'Fortalecer sus conocimientos', iconLight: 'area-aprender-s2', iconDark: 'area-aprender' },
  conectar: { id: 'conectar', title: 'Conectarme con oportunidades', pill: 'Conectarse con oportunidades', iconLight: 'area-conectar-s2', iconDark: 'area-conectar' },
};

export const AREA_ORDER: readonly AreaId[] = ['vender', 'organizar', 'aprender', 'conectar'];

/** Categorías de la pantalla IDLE. */
export const IDLE_CATEGORIES: ReadonlyArray<{ label: string; icon: string; color: string; ownGraphic?: boolean }> = [
  { label: 'Diagnóstico', icon: 'cat-diagnostico', color: 'var(--cat-diagnostico)' },
  { label: 'Caracterización', icon: 'cat-caracterizacion', color: 'var(--cat-caracterizacion)' },
  { label: 'Enrutamiento', icon: 'cat-enrutamiento', color: 'var(--cat-enrutamiento)', ownGraphic: true },
  { label: 'Servicios', icon: 'cat-servicios', color: 'var(--cat-servicios)' },
  { label: 'Seguimiento', icon: 'cat-seguimiento', color: 'var(--cat-seguimiento)', ownGraphic: true },
  { label: 'Impacto', icon: 'cat-impacto', color: 'var(--cat-impacto)' },
];

export const TEXT = {
  brand: 'EnRuta',

  idle: {
    // La palabra "ruta" va en naranja.
    titleBefore: 'Tu empresa tiene una ',
    titleAccent: 'ruta',
    titleAfter: '. Descúbrela hoy.',
    subtitle: 'Todo lo que necesitas en una sola plataforma.',
    prompt: 'Levanta tu mano derecha para comenzar.',
    cta: 'Comenzar',
    // Con registro en tablet (el diseño de creatividad aún no define estos textos). [CONFIRMAR]
    registerPrompt: 'Regístrate en la tablet para comenzar.',
    connecting: 'Conectando con el servidor…',
    hello: (nombre: string) => `Hola, ${nombre}`,
    raise: 'Levanta tu mano derecha para comenzar.',
  },
  home: { title: 'Tu ruta en 5 pasos simples', exit: 'SALIR' },

  badge: { info: 'INFORMATIVO', game1: 'JUEGO 1', game3: 'JUEGO 3' },

  instructions: {
    title: 'Controla con tu mano',
    steps: [
      { icon: 'monitor', text: 'Párate frente a la pantalla' },
      { icon: 'hand', text: 'Levanta tu mano derecha' },
      { icon: 'target', text: 'Mantén el cursor sobre un botón para elegirlo' },
    ],
    practice: 'Practica mantener el cursor aquí',
    practiceDone: '¡Muy bien!',
    course: {
      title: 'Ahora recorre la pantalla',
      hint: 'Lleva el cursor a cada punto y manténlo ahí.',
      step: (n: number, total: number) => `${n} de ${total}`,
      done: '¡Listo! Ya controlas el cursor en toda la pantalla.',
    },
    cta: 'Entendido',
  },

  s1: {
    title: 'Crea tu cuenta en minutos',
    instruction: 'Mira cómo funciona.',
    tabletLabel: 'Crea tu cuenta',
    benefits: [
      { icon: 'clock', text: 'Es rápida y gratuita' },
      { icon: 'mail', text: 'Solo necesitas tu correo' },
      { icon: 'doc', text: 'Y algunos datos básicos' },
    ],
  },
  s2: {
    title: 'Identifica las necesidades en tu empresa',
    description:
      'Comprender cómo conocer al empresario o emprendedor y su negocio permite orientar una ruta acorde con sus necesidades.',
    pick: 'Elige 2',
    counter: (n: number) => `${n} de 2`,
  },
  s3: {
    title: 'Descubre cómo se construye tu ruta',
    company: 'Tu empresa',
    extraPill: { label: 'Eventos', icon: 'area-eventos' },
  },
  s4: {
    title: 'EXPLORA LAS SOLUCIONES DE ENRUTA',
    cta: 'Pon a prueba lo aprendido',
    allSeen:
      '¡Ya conoces las soluciones de Enruta! Ahora identifica cuál responde mejor a las necesidades de un empresario o emprendedor.',
  },
  s5: {
    instruction: 'Atrapa lo que impulsa tu crecimiento.\nEsquiva lo que no pertenece a tu ruta.',
    time: 'Tiempo',
    points: 'Puntos',
    end: '¡Tu empresa sigue creciendo!',
  },
  result: {
    title: '¡Felicitaciones!',
    score: 'Puntaje total',
    areas: 'Áreas que elegiste',
    qr: 'Escanea y conoce la oferta de la Cámara para ti',
    restart: 'Volver a empezar',
    countdown: (s: number) => `Vuelve al inicio en ${s} s`,
  },
  calibration: {
    title: 'Calibración',
    intro: 'Levanta tu mano derecha y apunta a cada punto.',
    step: (n: number, total: number) => `Punto ${n} de ${total}: mantén la mano quieta`,
    lost: 'No veo tu mano derecha. Levántala.',
    verify: 'Prueba: el cursor debe llegar a las cuatro esquinas.',
    save: 'Guardar',
    retry: 'Repetir',
    saved: 'Calibración guardada',
    failed: 'No se pudo calcular. Repite la calibración.',
    onlyCam: 'La calibración solo aplica al input de cámara (?input=cam).',
    exit: 'Esc para salir',
  },

  cta: { continue: 'Continuar', back: 'Volver' },
  progress: (n: number) => `${n} de 5`,
  inactivity: { title: '¿Sigues ahí?', cta: 'Continuar' },
} as const;
