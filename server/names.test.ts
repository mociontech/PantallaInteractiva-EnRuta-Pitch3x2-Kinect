import { formatName } from './src/attendees';

import type { NameOrder } from './src/config';

const cases: Array<[string, NameOrder, string]> = [
  ['PEREZ GOMEZ ANA MARIA', 'apellidos-nombres', 'Ana Maria Perez Gomez'],
  ['RODRIGUEZ CARLOS', 'apellidos-nombres', 'Carlos Rodriguez'],
  ['PEREZ GOMEZ ANA', 'apellidos-nombres', 'Ana Perez Gomez'],
  ['DE LA CRUZ MARTINEZ LUISA FERNANDA', 'apellidos-nombres', 'Luisa Fernanda de la Cruz Martinez'],
  ['DEL RIO ORTEGA JUAN CARLOS', 'apellidos-nombres', 'Juan Carlos del Rio Ortega'],
  ['GARCIA MARQUEZ GABRIEL', 'apellidos-nombres', 'Gabriel Garcia Marquez'],
  ['ANA MARIA PEREZ GOMEZ', 'nombres-apellidos', 'Ana Maria Perez Gomez'],
  ['  ana   maria   perez ', 'tal-cual', 'Ana Maria Perez'],
  ['PEREZ', 'apellidos-nombres', 'Perez'],
  ['LOPEZ ANA MARIA', 'apellidos-nombres', 'Ana Maria Lopez'],
  ['GOMEZ JUAN CARLOS', 'apellidos-nombres', 'Juan Carlos Gomez'],
  ['PEREZ GOMEZ JUAN CARLOS ANDRES', 'apellidos-nombres', 'Juan Carlos Andres Perez Gomez'],
  ['PEREZ GOMEZ MARIA', 'apellidos-nombres', 'Maria Perez Gomez'],
  // Automático: cada fila decide su orden
  ['PEREZ GOMEZ ANA MARIA', 'auto', 'Ana Maria Perez Gomez'],
  ['XIOMARA JOSE GAMARRA MENDOZA', 'auto', 'Xiomara Jose Gamarra Mendoza'],
  ['ANA MARIA GONZALEZ IRIARTE', 'auto', 'Ana Maria Gonzalez Iriarte'],
  ['JOHN PEREZ GOMEZ DIAZ', 'auto', 'John Perez Gomez Diaz'],
  ['LOPEZ ANA MARIA', 'auto', 'Ana Maria Lopez'],
  ['ANA MARIA GOMEZ', 'auto', 'Ana Maria Gomez'],
  ['RODRIGUEZ CARLOS', 'auto', 'Carlos Rodriguez'],
  ['DE LA CRUZ MARTINEZ LUISA FERNANDA', 'auto', 'Luisa Fernanda de la Cruz Martinez'],
  ['ANGEL DIAZ ANA MARIA', 'auto', 'Ana Maria Angel Diaz'],
];

let bad = 0;
for (const [raw, order, want] of cases) {
  const got = formatName(raw, order);
  if (got !== want) bad++;
  console.log(`${got === want ? '✓' : '✗'} ${raw} (${order}) -> ${got}${got === want ? '' : `  (esperado: ${want})`}`);
}
process.exit(bad ? 1 : 0);
