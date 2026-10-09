import { formatName } from './src/attendees';

const cases: Array<[string, 'apellidos-nombres' | 'nombres-apellidos' | 'tal-cual', string]> = [
  ['PEREZ GOMEZ ANA MARIA', 'apellidos-nombres', 'Ana Maria Perez Gomez'],
  ['RODRIGUEZ CARLOS', 'apellidos-nombres', 'Carlos Rodriguez'],
  ['PEREZ GOMEZ ANA', 'apellidos-nombres', 'Ana Perez Gomez'],
  ['DE LA CRUZ MARTINEZ LUISA FERNANDA', 'apellidos-nombres', 'Luisa Fernanda de la Cruz Martinez'],
  ['DEL RIO ORTEGA JUAN CARLOS', 'apellidos-nombres', 'Juan Carlos del Rio Ortega'],
  ['GARCIA MARQUEZ GABRIEL', 'apellidos-nombres', 'Gabriel Garcia Marquez'],
  ['ANA MARIA PEREZ GOMEZ', 'nombres-apellidos', 'Ana Maria Perez Gomez'],
  ['  ana   maria   perez ', 'tal-cual', 'Ana Maria Perez'],
  ['PEREZ', 'apellidos-nombres', 'Perez'],
];

let bad = 0;
for (const [raw, order, want] of cases) {
  const got = formatName(raw, order);
  if (got !== want) bad++;
  console.log(`${got === want ? '✓' : '✗'} ${raw} (${order}) -> ${got}${got === want ? '' : `  (esperado: ${want})`}`);
}
process.exit(bad ? 1 : 0);
