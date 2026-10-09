/** Textos de la tablet de registro (/registro). Fuente: diseño de creatividad (Figma, sección "Tablet"). */
export const T = {
  attract: 'Toca la pantalla para iniciar',

  cedula: {
    title: 'VALIDACIÓN',
    placeholder: 'Cédula', // el diseño dice "Cedula": se corrige la tilde
    cta: 'Comenzar',
    register: 'Regístrate',
    back: 'Volver',
    invalid: 'Escribe tu número de cédula, solo números.',
  },

  datos: {
    title: 'REGÍSTRATE',
    cedula: 'Cédula',
    nombre: 'Nombre completo',
    // [CONFIRMAR] texto legal definitivo del cliente (Ley 1581 de 2012: autorización de tratamiento de datos).
    consent:
      'Autorizo el tratamiento de mis datos personales (cédula y nombre) para participar en las experiencias del evento y asociar mi puntaje.',
    cta: 'Continuar',
    back: 'Volver',
    invalidName: 'Escribe tu nombre completo.',
    consentRequired: 'Debes aceptar la autorización para continuar.',
  },

  listo: {
    hello: (nombre: string) => `¡Listo, ${nombre}!`,
    turn: 'Ve a la pared y levanta tu mano derecha.',
    waiting: (n: number) => (n === 1 ? 'Hay 1 persona antes que tú.' : `Hay ${n} personas antes que tú.`),
    waitingHint: 'Cuando sea tu turno, la pared te saludará por tu nombre.',
    playing: '¡Disfruta la experiencia!',
    next: 'Registrar a otra persona',
  },

  errors: {
    alreadyPlayed: 'Esta cédula ya participó.',
    server: 'Algo salió mal. Intenta de nuevo.',
    offline: 'No hay conexión con el servidor. Avisa al equipo.',
  },
} as const;

/** Primer nombre para el saludo: "Ana María Pérez" -> "Ana María" (hasta dos palabras). */
export function greetingName(full: string): string {
  return full.trim().split(/\s+/).slice(0, 2).join(' ');
}
