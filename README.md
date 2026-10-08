# EnRuta Empresarial · pared interactiva

Instalación para la Cámara de Comercio de Cartagena: una pared de 3 m × 2 m que se controla con la mano derecha
(cámara + MediaPipe, o TouchDesigner/Kinect) y una **tablet de registro** al lado. Todo corre desde un solo servidor local.

```
Tablet (/registro) ──HTTP──┐
                           ├── Servidor local (Node, SQLite) ──► Evius (cola con reintentos)
Pared  (/)  ◄──WebSocket───┘            ▲
                                        └── Base de asistentes (Sheet del cliente en CSV)
Operador (/admin) ──HTTP──► servidor
```

## Flujo

1. En la **tablet** la persona escribe su cédula.
2. El servidor la busca en la base de asistentes (el Sheet del cliente). Si está, trae nombre y correo; si no (o falta el correo),
   la tablet pide **nombre, correo y autorización de datos** y la registra como nueva.
3. Entra a la **fila**. Cuando la pared está libre, la pared saluda por su nombre ("Hola, Ana María") y habilita **Comenzar**.
4. La persona juega. Al terminar (o si abandona / se va por inactividad) la pared envía el **puntaje** al servidor.
5. El servidor lo guarda y lo manda a **Evius** (con cola y reintentos: sin internet se envía después). La pared vuelve a IDLE y pasa la siguiente persona.

## Puesta en marcha

Requisitos: Node 22.13+ (probado con 24). Una vez: `npm install`.

```bash
npm run build      # genera dist/ (pared + tablet + operador)
npm run server     # servidor en http://localhost:3001
```

Al arrancar, el servidor imprime las direcciones:

| Quién | Dirección |
|---|---|
| Pared (PC con la cámara) | `http://localhost:3001/` |
| Tablet de registro | `http://<IP-del-PC>:3001/registro` (misma red Wi-Fi) |
| Operador | `http://localhost:3001/admin` (PIN en `ADMIN_PIN`) |

Configuración en un archivo `.env` (ver `.env.example`).

### Pared en modo kiosko (Chrome)

```
chrome.exe --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:3001/
```

La pared debe abrirse en `localhost` (la cámara exige un contexto seguro). La tablet no usa cámara: basta HTTP por la red local.
En la tablet, bloquéala en el navegador a pantalla completa (Android: fijar pantalla o Chrome en modo kiosko; iPad: Acceso guiado).

### Desarrollo

```bash
npm run server:dev   # servidor con recarga
npm run dev          # web en :5173 (proxy a :3001). Pared: /?input=mouse&reg=1 · tablet: /registro · operador: /admin
```

En desarrollo la pared funciona sola (sin registro); `?reg=1` activa el registro, `?reg=0` lo apaga en producción.

## Base de asistentes (Sheet del cliente)

Columnas esperadas (con cualquiera de estos nombres, sin importar tildes ni mayúsculas): **cédula** (`cedula`, `cc`, `documento`…),
**nombre** (`nombre`, `nombres`, `nombre completo`… + opcional `apellido`) y **correo** (`correo`, `email`…).
Las cédulas se comparan solo por dígitos (`1.234.567` = `1234567`).

- **CSV:** exporta el Sheet a `server/data/asistentes.csv` (no se sube al repo: tiene datos personales).
- **Sheet en vivo:** comparte el Sheet "con quien tenga el enlace" y pon en `ATTENDEES_CSV_URL` la URL
  `https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>`. Se vuelve a leer cada 5 minutos.
- En `/admin` se ve cuántos asistentes hay cargados y se puede **recargar** al instante.
- Sin archivo ni URL se usa `server/data/asistentes.sample.csv` (datos de ejemplo).

## Evius

Los puntajes se guardan en una cola (`outbox`) y se envían en segundo plano con reintentos. **[CONFIRMAR]** el formato real con la API de Evius:
URL, autenticación y campos se ajustan en `server/src/evius.ts` y en las variables `EVIUS_*`.

- `EVIUS_MODE=mock`: registra en consola y los marca como enviados (para probar).
- Sin `EVIUS_URL`: los envíos quedan **pendientes** (se ven en `/admin`) hasta que se configure.
- Dato enviado por sesión: cédula, nombre, correo, puntaje total, si completó, último paso, puntos del juego, áreas elegidas, soluciones vistas, duración, pared y hora.

## Operador (`/admin`)

Estado de la pared y de quién tiene el turno, fila de espera, últimas sesiones con su estado de envío a Evius, y acciones:
saltar el turno actual, vaciar la fila, recargar la base, reintentar envíos y **descargar CSV** de todas las sesiones (respaldo).

## Datos personales

Se guardan cédula, nombre y correo (necesarios para unir los puntajes en Evius) **solo en el servidor local** (`server/data/enruta.db`) y en Evius.
La tablet muestra la autorización de tratamiento de datos antes de registrar a alguien nuevo. **[CONFIRMAR]** el texto legal definitivo
(`src/tablet/content.ts`) y el tiempo de conservación.

## Cámara

`?input=cam` (por defecto en producción). Solo controla a **una persona**: la primera que levanta y sostiene la mano derecha queda bloqueada;
el resto se ignora. Se libera si baja la mano 4 s o desaparece 1,5 s. Calibración: tecla `C` en la pantalla de inicio de la pared (`Esc` para salir);
detalles y valores ajustables en `MEDIAPIPE` (`src/config/experience.ts`). Con `?debug=1` aparece la vista de la cámara con todas las personas detectadas.

## Pruebas

```bash
npm run typecheck                                  # web y servidor
# Servidor de prueba (base aparte, Evius simulado):
PORT=3055 DB_PATH=server/data/smoke.db EVIUS_MODE=mock npm run server
SMOKE_URL=http://localhost:3055 npm run server:smoke     # API + cola + WebSocket (17 comprobaciones)
# Punta a punta con la pared real en Edge headless (servidor en :3001 y `npm run dev`):
PORT=3001 DB_PATH=server/data/e2e.db EVIUS_MODE=mock npm run server
npm run e2e
```

## Estructura

```
shared/protocol.ts   contrato servidor ⇄ pared/tablet/operador
server/src/          config, base de datos, asistentes (CSV/Sheet), Evius + cola, gestor de turnos, API y WebSocket
src/screens/         pantallas de la pared        src/tablet/   tablet de registro        src/admin/   operador
src/config/          tiempos, tokens de marca, textos (content.ts), modo registro
```
