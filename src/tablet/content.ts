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

  // Aceptación de la política (misma redacción que en las demás experiencias). Leerla es opcional; aceptarla es obligatorio.
  consent: {
    text: 'Autorizo el tratamiento de mis datos personales.',
    link: 'Política de Privacidad.',
  },

  policy: {
    title: 'Política de privacidad',
    heading: 'Autorización para el tratamiento de datos personales',
    paragraphs: [
      'Autorizo de manera libre, previa, expresa e informada a la Cámara de Comercio de Cartagena, como responsable del tratamiento, para recolectar, almacenar y utilizar los datos personales suministrados en este formulario con el fin de gestionar mi registro y participación en Enruta Empresarial, realizar seguimiento a mi experiencia y enviarme información sobre Enruta y otros programas, servicios, eventos y actividades de la Cámara de Comercio de Cartagena, a través de los medios de contacto suministrados.',
      'El tratamiento se realizará conforme a la Ley 1581 de 2012, sus normas reglamentarias y la Política de Protección de Datos Personales de la entidad.',
      'Como titular, tengo derecho a conocer, actualizar y rectificar mis datos; acceder gratuitamente a ellos; solicitar prueba de esta autorización; conocer el uso de mi información; presentar quejas ante la Superintendencia de Industria y Comercio; y solicitar la supresión de mis datos o revocar la autorización cuando legalmente proceda.',
      'Puedo consultar la política y el aviso de privacidad en Protección de Datos Personales.',
    ],
    accept: 'Aceptar',
    close: 'Volver',
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
    notFound: 'Tu cédula no está en la lista de asistentes.',
    server: 'Algo salió mal. Intenta de nuevo.',
    offline: 'No hay conexión con el servidor. Avisa al equipo.',
  },
} as const;

/** Primer nombre para el saludo: "Ana María Pérez" -> "Ana María" (hasta dos palabras). */
export function greetingName(full: string): string {
  return full.trim().split(/\s+/).slice(0, 2).join(' ');
}
