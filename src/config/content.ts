/** Todos los textos de la experiencia. Nada hardcodeado en componentes. */

export type AreaId = 'vender' | 'organizar' | 'aprender' | 'conectar';
export type SolutionId =
  | 'formacion'
  | 'acompanamiento'
  | 'programas'
  | 'contactos'
  | 'informacion'
  | 'eventos';

export interface NodeDef {
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
  color: string;
  icon: string;
}

export const NODES: readonly NodeDef[] = [
  { n: 1, title: 'Crea tu cuenta', color: 'var(--node-1)', icon: 'user' },
  { n: 2, title: 'Realiza tu diagnóstico', color: 'var(--node-2)', icon: 'chart' },
  { n: 3, title: 'Descubre tu ruta', color: 'var(--node-3)', icon: 'route' },
  { n: 4, title: 'Accede a soluciones', color: 'var(--node-4)', icon: 'grid' },
  { n: 5, title: 'Haz crecer tu empresa', color: 'var(--node-5)', icon: 'plant' },
];

export interface SolutionDef {
  id: SolutionId;
  title: string;
  short: string;
  color: string;
  icon: string;
}

export const SOLUTIONS: Record<SolutionId, SolutionDef> = {
  formacion: { id: 'formacion', title: 'Formación', short: 'Cursos, talleres y webinars', color: 'var(--sol-formacion)', icon: 'book' },
  acompanamiento: { id: 'acompanamiento', title: 'Acompañamiento experto', short: 'Asesorías personalizadas', color: 'var(--sol-acompanamiento)', icon: 'expert' },
  programas: { id: 'programas', title: 'Programas', short: 'Acceso a convocatorias', color: 'var(--sol-programas)', icon: 'flag' },
  contactos: { id: 'contactos', title: 'Red de contactos', short: 'Conecta con aliados estratégicos', color: 'var(--sol-contactos)', icon: 'network' },
  informacion: { id: 'informacion', title: 'Información estratégica', short: 'Tendencias y oportunidades', color: 'var(--sol-informacion)', icon: 'info' },
  eventos: { id: 'eventos', title: 'Eventos', short: 'Aprendizaje y networking', color: 'var(--sol-eventos)', icon: 'calendar' },
};

/** Orden de la grilla 3×2 de la Estación 4. */
export const SOLUTIONS_GRID: readonly SolutionId[] = [
  'formacion', 'acompanamiento', 'programas', 'contactos', 'informacion', 'eventos',
];

/** Las 5 soluciones de la Estación 3 (sin Red de contactos). */
export const ROUTE_SOLUTIONS: readonly SolutionId[] = [
  'formacion', 'informacion', 'programas', 'acompanamiento', 'eventos',
];

export interface AreaDef {
  id: AreaId;
  title: string;
  color: string;
  icon: string;
}

export const AREAS: Record<AreaId, AreaDef> = {
  vender: { id: 'vender', title: 'Vender más', color: 'var(--diag-vender)', icon: 'chart' },
  organizar: { id: 'organizar', title: 'Organizarme', color: 'var(--diag-organizar)', icon: 'gear' },
  aprender: { id: 'aprender', title: 'Aprender', color: 'var(--diag-aprender)', icon: 'book' },
  conectar: { id: 'conectar', title: 'Conectarme con oportunidades', color: 'var(--diag-conectar)', icon: 'network' },
};

export const TEXT = {
  brand: 'EnRuta',
  brandSub: 'EMPRESARIAL',
  cccName: 'Cámara de Comercio de Cartagena',

  idle: {
    display: 'Tu empresa tiene una ruta.',
    subtitle: 'Todo lo que necesitas en una sola plataforma.',
    slogan: 'Empresas que avanzan más lejos.', // [CONFIRMAR] slogan oficial
    prompt: 'Levanta tu mano derecha para comenzar.',
    cta: 'Comenzar',
  },
  home: { title: 'Tu ruta en 5 pasos simples' },

  badge: { info: 'INFORMATIVO', game1: 'JUEGO 1', game2: 'JUEGO 2' },

  s1: {
    title: 'Crea tu cuenta en minutos',
    instruction: 'Mira cómo funciona.',
    tabletLabel: 'Crea tu cuenta',
    benefits: [
      { icon: 'bolt', text: 'Es rápida y gratuita' },
      { icon: 'mail', text: 'Solo necesitas tu correo' },
      { icon: 'list', text: 'Y algunos datos básicos' },
    ],
  },
  s2: {
    title: '¿Qué quieres fortalecer en tu empresa?',
    instruction: 'Elige 2',
    counter: (n: number) => `${n} de 2`,
  },
  s3: {
    title: 'Tu ruta se construye según tus necesidades',
    instruction: 'Así se conectan tus necesidades con soluciones.',
    company: 'Tu empresa',
  },
  s4: {
    title: 'Soluciones para tu ruta',
    instruction: 'Acércate a una tarjeta para conocerla.',
  },
  s5: {
    title: 'Haz crecer tu empresa',
    instruction: 'Mueve la mano para recoger lo que impulsa tu crecimiento',
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

  cta: { continue: 'Continuar', back: 'Volver' },
  progress: (n: number) => `${n} de 5`,
  inactivity: { title: '¿Sigues ahí?', cta: 'Continuar' },
} as const;
