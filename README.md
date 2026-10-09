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
2. El servidor la busca en la base de asistentes (el Sheet del cliente). Si está, trae el nombre y entra directo (la base no trae correo ni hace falta);
   si no está, la tablet pide **nombre y autorización de datos** y la registra como nueva.
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

La forma más simple y robusta: **exportar el Sheet a CSV y cargarlo desde `/admin`** (funciona sin internet y sin permisos de Google).

1. En el Sheet, abre la pestaña con los datos → *Archivo → Descargar → Valores separados por comas (.csv)*.
2. En `http://localhost:3001/admin` → tarjeta *Base de asistentes* → **Cargar CSV**. Se valida antes de guardar: si faltan columnas
   se muestran los encabezados que se vieron y la base actual **no** se modifica. Se guarda en `server/data/asistentes.csv`
   (no se sube al repo: tiene datos personales). Se puede volver a cargar las veces que haga falta (p. ej. si agregan gente).

Columnas: solo hacen falta **identificación (cédula)** y **nombre**; el **correo es opcional**. Se reconocen por palabras clave sin importar
tildes ni mayúsculas ("Identificación", "Nombre de Empleado", "Correo corporativo"…); el resto de columnas ("Cargo de Trabajo") se ignora.
Las cédulas se comparan solo por dígitos (`72.345.678` = `72345678`).

- **Sin correo:** el correo no se usa. Quien está en la base entra con solo la cédula (la tablet le muestra "¡Listo, Ana Maria!"). El servidor lo acepta si algún día se envía.
- **Formato del nombre:** viene en MAYÚSCULAS y casi siempre como "APELLIDOS NOMBRES", pero algunas filas vienen "NOMBRES APELLIDOS".
  Con `NAME_ORDER=auto` (por defecto) cada fila decide su orden usando una lista de nombres de pila comunes (`server/src/givenNames.ts`) y se
  convierte a "Nombres Apellidos" en formato Título (`PEREZ GOMEZ ANA MARIA` → `Ana Maria Perez Gomez`; reconoce `DE LA`, `DEL`…).
  Es una heurística: con la base real reconoce el primer nombre en 179 de 179 filas, pero revisa a mano unas cuantas personas.
  Se puede forzar con `NAME_ORDER=apellidos-nombres`, `nombres-apellidos` o `tal-cual`.
- **Personas que no están en la base** pueden registrarse en la tablet ("Regístrate") con cédula y nombre.
- Opcional: `ATTENDEES_CSV_URL` lee un Sheet publicado por enlace (se relee cada 5 min); no se recomienda con datos de colaboradores.
- Sin archivo ni URL se usa `server/data/asistentes.sample.csv` (datos de ejemplo).

## Evius

Cada sesión (completa o abandonada) se manda a Evius con **la cédula como identificador único** (no hay correo). Dos llamadas, en este orden:

Evius (Datahub) recibe **lotes**: `{ eventId, source, sentAt, records: [...] }` con `Authorization: Bearer EVIUS_TOKEN`, y responde `200` aunque falle algún
registro (`{ received, processed, failed, errors }`). Por eso el envío solo se da por bueno si `failed === 0`; si no, queda pendiente con el mensaje de error en `/admin`.

1. `POST /attendees` registra a la persona (`cedula`, `name`, `cargo`; nombre y cargo salen del CSV).
2. `POST /experiences` guarda el puntaje (`experienceId` en el lote y `play_timestamp` ISO 8601 por registro, más puntaje, áreas, duración…).
   Si el endpoint no existe (404/405/501) cae a `POST /activities` (`name` obligatorio, puntaje como JSON en `longDescription`).

**[CONFIRMAR]** con Evius los nombres de campo de cada record (solo se conocen `play_timestamp` y `name`): se ajustan solo en `server/src/evius.ts`.
Mientras tanto `EVIUS_MODE=off` en `.env` acumula todo en el outbox sin enviar; al quitarlo, se entrega lo acumulado.

**Outbox con reintento infinito** (`server/src/outbox.ts`): el resultado se escribe en `server/data/outbox.jsonl` (append-only, con fsync) **antes** de
intentar enviar. Si no hay internet o el servidor se cae, no se pierde nada: al volver se reanuda solo. Reintentos con backoff exponencial
(2 s, 4 s, 8 s… tope 5 min), un poll cada 3 s, nunca se rinde. Cada registro tiene `idempotencyKey`, así un reintento no duplica. El archivo no se compacta
ni se borra: es también el respaldo/historial (cédula, nombre, cargo, puntaje y hora de cada sesión). No hay base de rankings propia: el puntaje va solo a Evius.

- Sin `EVIUS_URL` el servidor funciona igual y acumula todo en el outbox (se ve en `/admin`); en cuanto se configure, se envía lo acumulado.
- **Validación por cédula:** `GET /attendee?cedula=...` devuelve `{ "nombre", "cargo" }` o `404` si no está en el CSV.
- Variables: `EVIUS_URL`, `EVIUS_TOKEN`, `EVIUS_EVENT_ID`, `EVIUS_EXPERIENCE_ID`, `EXPERIENCE_NAME`, `ATTENDEES_CSV_PATH`, `OUTBOX_PATH` (ver `.env.example`).

### Probar el envío sin Evius real

```bash
npm run mock:evius                               # Evius falso en :4010 (MOCK_TOKEN opcional)
EVIUS_URL=http://localhost:4010 EVIUS_TOKEN=tok EVIUS_EVENT_ID=ev-1 EVIUS_EXPERIENCE_ID=exp-1 npm run server
npm run play -- 1000000002 180                   # juega una sesión: cédula y puntaje
curl localhost:4010/__log                        # lo que recibió Evius
curl -X POST localhost:4010/__config -d '{"fail":true}'            # simula Evius caído
curl -X POST localhost:4010/__config -d '{"noExperiences":true}'   # obliga al fallback a /activities
```

## Operador (`/admin`)

Estado de la pared y de quién tiene el turno, fila de espera, últimas sesiones con su estado de envío a Evius, y acciones:
saltar el turno actual, vaciar la fila, **cargar el CSV de asistentes**, recargar la base, reintentar envíos y **descargar CSV** de todas las sesiones (respaldo).

## Datos personales

Se guardan cédula, nombre y cargo (para unir los puntajes en Evius) **solo en el servidor local** (`server/data/enruta.db` y `server/data/outbox.jsonl`) y en Evius.
La tablet muestra la autorización de tratamiento de datos antes de registrar a alguien nuevo. **[CONFIRMAR]** el texto legal definitivo
(`src/tablet/content.ts`) y el tiempo de conservación.

## Cámara

`?input=cam` (por defecto en producción). Solo controla a **una persona**: la primera que levanta y sostiene la mano derecha queda bloqueada;
el resto se ignora. Se libera si baja la mano 4 s o desaparece 1,5 s. Calibración: tecla `C` en la pantalla de inicio de la pared (`Esc` para salir);
detalles y valores ajustables en `MEDIAPIPE` (`src/config/experience.ts`). Con `?debug=1` aparece la vista de la cámara con todas las personas detectadas.

## Pruebas

```bash
npm run typecheck                                  # web y servidor
npx tsx server/names.test.ts                       # formato de nombres (apellidos/nombres, partículas)
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
