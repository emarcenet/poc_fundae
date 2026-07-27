# PoC — Panel de evidencias FUNDAE para Moodle 4.5 / 5 (sin plugins)

> Compatibilidad verificada contra el código fuente de las ramas
> MOODLE_405_STABLE y MOODLE_500_STABLE: las cinco funciones de la API que usa
> el panel existen en ambas versiones con la misma firma.

Prueba de concepto de un panel embebido en un curso Moodle que consulta la API
y muestra una lista de comprobaciones (checklist) orientada a los requisitos de
teleformación bonificada de FUNDAE: trazabilidad, seguimiento, controles de
aprendizaje e interacción con tutores. **No requiere instalar ningún plugin** —
solo configuración de administración.

## Qué hace

- Se pega como contenido HTML en un recurso **Página** (oculto a estudiantes) o en un **bloque HTML**.
- Al cargar la página, el JavaScript detecta el curso actual, llama a la API REST de Moodle y pinta:
  1. **Checklist FUNDAE** con ✔ / ⚠ / ✘ por cada evidencia comprobable automáticamente.
  2. **Desglose de actividades y recursos por tipo** (SCORM, cuestionarios, tareas,
     archivos, foros…), indicando si cada tipo es calificable y cuántos elementos
     tienen la calificación configurada en el libro (desplegable elemento a elemento).
  3. **Tabla por alumno**: último acceso (trazabilidad), tiempo de conexión por
     sesiones y por días, progreso, estado de finalización y nota final.
  4. **Enlaces directos a los informes nativos** del curso (registros, participación,
     finalización, calificaciones), que son la evidencia documental exportable.
- Se actualiza en cada visita (los datos se piden en vivo). Incluye botón «Actualizar».

## Modelo de seguridad: token personal por tutor

Las funciones de informes que usa el panel **no son invocables por el endpoint
AJAX interno** de Moodle (no tienen el flag `ajax` en `lib/db/services.php`;
están publicadas solo para servicios web externos). Por eso el panel usa el
protocolo **REST con token** (`/webservice/rest/server.php`).

**El código del panel NO contiene ningún token.** Cada tutor se conecta con su
**token personal**, que queda guardado solo en su navegador, nunca en la página.

**Conexión con un clic.** La primera vez, el panel muestra un botón *Conectar
con mi cuenta*. Al pulsarlo obtiene el token del tutor usando su propia sesión:
replica con `fetch` (same-origin, con la cookie del tutor) el gesto que Moodle
hace al visitar *Preferencias → Claves de seguridad*
(`/user/managetoken.php`), donde el token del servicio se **auto-genera** y su
valor se devuelve al regenerarlo con el `sesskey`. Es exactamente lo que el
tutor haría a mano; no escala privilegios (usa su sesión y sus permisos).

**Por qué un clic y no automático.** Obtener el valor del token exige
**regenerarlo**, y eso invalida el anterior: es una acción destructiva. Hasta la
v3.0 se disparaba sola al cargar la página, de modo que el tutor sufría el
cambio sin pedirlo. Desde la v4.0 requiere confirmación explícita, y la pantalla
avisa de lo que va a pasar.

**Solo el servicio del panel.** El panel únicamente toca la fila de
`SERVICE_NAME` en *Claves de seguridad*. Si no existe, no hace nada y ofrece la
conexión manual. La v3.0 tenía un respaldo —«si el tutor solo tiene un token,
usa ese»— que **regeneraba y se apropiaba de tokens de otros servicios**, en la
práctica el de la app móvil del propio tutor. Se ha eliminado.

**Dónde se guarda.** En `localStorage` de ese navegador. Es el único
almacenamiento compartido entre pestañas: con `sessionStorage` cada pestaña
nueva arrancaría sin token y regeneraría el suyo, invalidando el de las demás.
La casilla *Guardar solo durante esta sesión* lo devuelve a `sessionStorage` a
cambio de tener que reconectar (y regenerar) cada día.

**Respaldo manual.** Si la conexión no es posible (el usuario no está autorizado
en el servicio, es administrador del sitio, o el tema cambia el HTML de esa
página), el desplegable *Conexión manual* permite pegar el token a mano.

Por qué esto resuelve la vulnerabilidad del token compartido:

- **Nada que robar en el código fuente**: la página no contiene credenciales.
- **Sin escalada de privilegios**: el token de cada tutor tiene exactamente sus
  permisos. Si se filtra, el atacante obtiene lo que ese tutor ya podía ver —
  no un acceso transversal a todos los cursos como con un token de servicio.
- **Revocación individual**: cada tutor (o el admin) puede regenerar su token
  sin afectar al resto. El panel detecta el token inválido, lo borra del
  navegador y vuelve a pedir uno.
- **Trazabilidad real**: las llamadas a la API quedan registradas a nombre del
  tutor que las hace, no de un usuario de servicio genérico.

Funciones de la API utilizadas (hay que añadirlas todas al servicio):

- `core_course_get_courses_by_field`
- `core_course_get_contents`
- `core_enrol_get_enrolled_users`
- `core_completion_get_course_completion_status`
- `core_completion_get_activities_completion_status` *(para el % de progreso por alumno; si no se añade, el panel funciona igual pero esa columna muestra «n/d»)*
- `gradereport_user_get_grade_items`

## Configuración en Moodle (una sola vez, como administrador)

### Paso 1 — Activar servicios web y REST

1. Administración del sitio → General → Características avanzadas → ✔ **Habilitar servicios web** → Guardar.
2. Administración del sitio → Servidor → Servicios web → **Administrar protocolos** → habilitar **REST** (icono del ojo).

### Paso 2 — Crear el servicio externo con las funciones

1. Servidor → Servicios web → **Servicios externos** → *Agregar*.
2. Nombre: `FUNDAE PoC` · ✔ Habilitado · (opcional) ✔ «Solo usuarios autorizados».
   - El campo **«Capacidad requerida»** (bajo «Mostrar más») se deja en
     **Ninguna**. Ese selector muestra permisos (formato
     `gradereport/overview:view`), no funciones — no es ahí donde se añaden.
3. Guardar. De vuelta en la **tabla de servicios externos**, en la fila de
   `FUNDAE PoC`, pulsar el enlace **«Funciones»** (no «Editar») → botón
   **«Agregar funciones»** → pegar los nombres de las 5 funciones en el
   buscador y confirmar. Las funciones se reconocen porque van con guiones
   bajos y descripción en inglés (p. ej.
   `core_course_get_contents: Get course contents`); si las sugerencias llevan
   barra y dos puntos (`algo/algo:view`), es el selector de permisos y no es
   la pantalla correcta.

### Paso 3 — Permitir que los tutores usen la API con su propio token

Verificado contra el código de Moodle 4.5: por defecto solo los *managers*
tienen `moodle/webservice:createtoken`, y **ningún** rol trae
`webservice/rest:use`. Hay que concedérselas a los tutores:

1. **Crear un rol pequeño** (Usuarios → Permisos → *Definir roles* → Agregar):
   nombre p. ej. `Acceso API informes`, contexto **Sistema**, con solo dos
   capacidades en *Permitir*:
   - `moodle/webservice:createtoken` (crear su propio token)
   - `webservice/rest:use` (usar el protocolo REST)
2. **Asignarlo a los tutores a nivel de sistema**: Usuarios → Permisos →
   *Asignar roles globales* → rol `Acceso API informes` → añadir a los tutores.
3. Si el servicio se creó con «Solo usuarios autorizados»: en *Servicios
   externos* → enlace **Usuarios autorizados** del servicio → añadir a los
   tutores. (Alternativa: desmarcar esa opción — cada token solo otorga los
   permisos de su dueño, así que no hay riesgo de escalada.)
4. **Si existía el token compartido anterior, revocarlo**: Servidor →
   Servicios web → *Administrar tokens* → eliminar. Y borrar también el
   usuario de servicio si ya no se usa.

### Paso 4 — Pegar el panel en el curso

1. Copiar todo el contenido de `panel-fundae.html` **tal cual** (ya no hay que
   editar ningún token en el código). Único requisito: la constante
   `SERVICE_NAME` al inicio del script debe coincidir con el **nombre exacto**
   del servicio externo creado en el paso 2 (por defecto `FUNDAE PoC`); la
   conexión automática lo usa para localizar el token del tutor.
2. En el curso: activar edición → añadir recurso **Página** → pegar el código
   en el editor **en modo HTML** (botón `</>`).
3. Marcar el recurso como **Oculto**: los estudiantes no lo verán; tutores y profesores sí.

### Paso 5 — Primera conexión de cada tutor

Con el paso 3 hecho, el tutor abre la página del panel y pulsa **«Conectar con
mi cuenta»** una sola vez. A partir de ahí el panel carga solo en cada visita.
Si la conexión falla, el desplegable *Conexión manual* permite pegar el token.
El botón 🔑 de la cabecera permite reconectar, cambiar o borrar el token en
cualquier momento.

> El alumnado no ve nada de esto: antes de mostrar la pantalla de conexión, el
> panel comprueba que quien la abre puede ver los registros del curso
> (`report/log:view`, un permiso de profesorado). Es una salvaguarda por si la
> Página deja de estar oculta por un descuido.

> Nota para el administrador: la conexión automática **no funciona para cuentas
> de administrador del sitio** (Moodle no auto-genera tokens de usuario para
> ellas). Para probar el panel usa una cuenta de **profesor**; como admin
> puedes, si lo necesitas, crear un token en *Administrar tokens* y pegarlo con
> el asistente de respaldo.

### Importante: limpieza de HTML / JavaScript

Moodle elimina las etiquetas `<script>` al guardar contenido, salvo que quien
lo guarda tenga la capacidad `moodle/site:trustcontent` y esté activado
*trusttext* (Administración del sitio → Seguridad → Políticas del sitio →
✔ *Habilitar contenido confiable*). Pegar el contenido **como administrador**
con esa opción activada.

## Errores frecuentes

| Mensaje | Causa | Solución |
|---------|-------|----------|
| «El servicio Web no está disponible» | Servicios web o REST deshabilitados | Paso 1 |
| El panel vuelve a pedir el token | Token caducado o revocado (el panel lo borra solo) | Pulsar «Conectar con mi cuenta» |
| «No hay ningún token del servicio…» | El tutor no está autorizado en el servicio, o es administrador del sitio | Paso 3, o usar una cuenta de profesor |
| El servicio no aparece en Claves de seguridad | Tutor sin `moodle/webservice:createtoken`, o no autorizado en el servicio | Paso 3 |
| «Excepción de control de acceso» (`accessexception`) | Función no añadida al servicio, o tutor sin `webservice/rest:use`, o no autorizado | Pasos 2 y 3 |
| «No tiene permiso…» en una función concreta | Al tutor le falta esa capacidad en el curso (p. ej. ver finalización) | Revisar su rol en el curso |
| «Tu cuenta no tiene permiso para ver los registros» | Falta `report/log:view` en el curso (es lo que ve el alumnado) | Revisar su rol; si es tutor, usar el enlace «continúa de todos modos» |
| El tiempo aparece con aviso de «estimación sin verificar» | El formato de fecha del informe de registros es ambiguo en ese sitio | Ver *Tiempos de conexión* más abajo |

## Comprobaciones incluidas en la PoC

| # | Comprobación | Por qué importa para FUNDAE |
|---|--------------|------------------------------|
| 1 | El curso tiene fecha de inicio y fin definidas | La acción formativa debe estar acotada temporalmente |
| 2 | Hay alumnos matriculados | Participantes comunicados |
| 3 | % de alumnos que han accedido al curso | Trazabilidad: registros de conexión |
| 4 | Tiempos de conexión calculados desde los registros | Acreditación de horas de conexión |
| 5 | Seguimiento de finalización (completion) activado | Permite evidenciar el progreso ≥ 75 % |
| 6 | Existen controles de aprendizaje (quiz / tarea) | Evaluación del aprendizaje exigida |
| 7 | Hay contenido SCORM cargado | Contenido con seguimiento estandarizado |
| 8 | Actividades calificables con calificación configurada | El control debe puntuar en el libro de calificaciones |
| 9 | Existe foro u otro canal de interacción | Evidencia de tutorización / interactividad |
| 10 | Hay calificaciones registradas | Evidencia de evaluación efectiva |
| 11 | % de alumnos con progreso ≥ 75 % de actividades | Criterio de aprovechamiento |
| 12 | % de alumnos con el curso completado | Indicador de finalización |

## Seguridad: modelo de amenazas y límites residuales

Resuelto respecto a la versión anterior:

- ❌ ~~Token compartido incrustado en el HTML~~ → no hay credenciales en el
  código; el secreto vive solo en el navegador de cada tutor.
- ❌ ~~Escalada: un token con acceso a todos los cursos del usuario de
  servicio~~ → cada token vale exactamente lo que su dueño ya puede ver.

Corregido en la v4.0 (defectos reales encontrados al revisar la v3.0):

- ❌ ~~El panel podía **regenerar y apropiarse del token de otro servicio**~~
  (el de la app móvil del tutor, dejándosela rota) cuando no encontraba el de
  FUNDAE y solo había uno. Ahora exige coincidencia con `SERVICE_NAME`.
- ❌ ~~La regeneración se disparaba **sola al cargar la página**~~: un cambio de
  estado irreversible sin intervención del usuario. Ahora requiere un clic.
- ❌ ~~Los CSV eran **inyectables por fórmula**~~: un alumno llamado
  `=HYPERLINK(...)` ejecutaba código al abrir la evidencia en Excel. Ahora las
  celdas peligrosas se neutralizan con un apóstrofo.
- ❌ ~~Hasta **300 peticiones simultáneas**~~ contra el propio Moodle (100 de
  ellas descargas completas de registros). Ahora hay un pool de 5 en vuelo.
- ❌ ~~Cualquiera que abriera la Página veía la pantalla de conexión~~. Ahora se
  comprueba `report/log:view` antes.

Riesgos residuales (asumidos y documentados):

- **El almacenamiento del navegador es legible por JavaScript de la misma
  página**: un XSS en Moodle podría leer el token del tutor — pero ese mismo
  XSS podría igualmente secuestrar su sesión, así que el token no amplía la
  superficie de ataque. Una cookie creada por JavaScript no mejoraría nada
  (también es legible por XSS) y empeoraría la exposición al viajar en todas
  las peticiones al dominio; la única cookie segura (`HttpOnly`) requiere
  componente de servidor.
- **`localStorage` frente a `sessionStorage`**: desde la v4.0 el modo por
  defecto es `localStorage`. Es un cambio deliberado: `sessionStorage` es por
  pestaña, así que cada pestaña nueva regeneraba su propio token e invalidaba
  el de las demás. La ventana de exposición es mayor, pero el modelo de
  amenazas no cambia (un XSS lee ambos) y desaparece la rotación constante. La
  casilla *Guardar solo durante esta sesión* mantiene el comportamiento
  anterior para quien lo prefiera.
- **El token viaja en cada petición**: imprescindible servir Moodle por HTTPS.
- El tutor puede ver su propio token (es suyo): el daño máximo de un descuido
  es equivalente a dejar su sesión abierta. Mitigaciones del admin: fecha de
  caducidad y restricción por IP al gestionar tokens, y revocación inmediata
  desde *Administrar tokens*.
- **Conectar regenera (rota) el token del servicio FUNDAE.** Como ese servicio
  es de uso exclusivo del panel, la rotación no afecta a nada más; si el mismo
  tutor usara ese token en otra herramienta, dejaría de valer (debería usar un
  servicio distinto para ello).
- Es **ofuscación imposible**: cualquier intento de «esconder» un token
  compartido en el frontend (trocearlo, cifrarlo en cliente, cargarlo de otro
  archivo) es pseudoseguridad — lo que el navegador puede leer, el usuario
  puede leerlo. Por eso la solución es que no haya secreto compartido.
- **La eliminación total del secreto en cliente requiere sacar el panel de
  Moodle.** Es el siguiente paso previsto: ver *Camino a producción* en
  [`DOCUMENTACION.md`](DOCUMENTACION.md).

## Protección de datos (RGPD)

El panel trata **datos personales**: nombre y apellidos, correo electrónico,
última conexión y **patrón horario de conexión** de cada persona matriculada.
El patrón horario es dato de comportamiento y merece el mismo cuidado que una
calificación.

Qué implica en la práctica:

- **Base legal y finalidad.** El tratamiento se ampara en la obligación de
  acreditar la formación bonificada ante FUNDAE. No uses estos datos ni los
  CSV que genera el panel para otra finalidad (marketing, evaluación del
  desempeño del profesorado, etc.).
- **Minimización.** El panel no envía nada a terceros: todas las peticiones van
  al propio Moodle y todo el cálculo ocurre en el navegador del tutor. Los CSV
  se generan en local y no se suben a ningún sitio.
- **El punto débil es el CSV.** Una vez descargado sale del control de Moodle.
  Guárdalo en el repositorio documental de la entidad, con control de acceso, y
  bórralo del equipo del tutor cuando deje de hacer falta. El panel muestra un
  aviso antes de cada descarga.
- **Conservación.** Conserva las evidencias el plazo que exija la normativa de
  la acción formativa, y no más.
- **Encargado del tratamiento.** Si Ojulab opera el Moodle de un cliente, hace
  falta el contrato de encargo del artículo 28 del RGPD.
- **Acceso.** La visibilidad la controla Moodle: recurso *Página* oculto más la
  comprobación de `report/log:view` que hace el propio panel. Revisa
  periódicamente quién tiene rol de profesor en el curso.

## Alternativas evaluadas (verificadas contra el código de Moodle 4.5)

1. **Sin token en absoluto (solo sesión del usuario)** — parcialmente viable:
   los logs (`report/log?download=json`) y la finalización
   (`report/progress/index.php?course=ID&format=csv` y
   `report/completion/index.php?course=ID&format=csv`) sí se pueden descargar
   con la sesión del tutor. Pero **ninguna función AJAX devuelve el último
   acceso de los alumnos como dato estructurado** (solo el HTML de la tabla de
   participantes, que habría que parsear) ni las notas por alumno, y las
   funciones limpias del generador de informes (`core_reportbuilder_*`) no son
   AJAX en 4.5. Resultado: posible pero frágil (scraping). Descartada como
   base; las descargas CSV de sesión pueden incorporarse puntualmente.
2. **Puente en servidor (un único archivo PHP junto a Moodle)** — elimina los
   tokens por completo: el archivo hace `require_login()` + comprobación de
   capability y consulta en servidor con la sesión del tutor. No es un plugin
   (no se instala nada en la administración), pero requiere acceso al sistema
   de archivos del servidor. Es el paso natural si algún día se relaja esa
   restricción, y la antesala del plugin local definitivo.
3. **Plugin local** (`local_fundae` con función WS propia + capability) — la
   solución canónica de producción, fuera del alcance de esta PoC por decisión
   de proyecto.

## Tiempos de conexión por sesión

FUNDAE exige acreditar tiempos de conexión, no solo el último acceso. Ese dato
no está expuesto por la API estándar, pero el panel lo **calcula desde el
informe de registros del curso** (`report/log`, descarga JSON) sin plugins y
sin usar el token: la descarga se hace **con la sesión del tutor que está
viendo la página**, que ya tiene permiso para ver los logs de su curso
(capacidad `report/log:view`, incluida por defecto en los roles de profesor).

Método de cálculo (el mismo que usan los bloques de "dedicación"):

1. Se descargan los eventos del alumno en el curso, ordenados por hora.
2. Se agrupan en **sesiones**: si entre dos eventos consecutivos pasan más de
   `SESSION_GAP_MIN` minutos de inactividad, se cierra la sesión y empieza otra.
3. Duración de cada sesión = último evento − primer evento **+
   `SESSION_MIN_SEC`**. El tiempo total es la suma de sesiones.
4. Las sesiones se agrupan también **por día natural**: en la tabla, pulsar
   sobre el tiempo de un alumno despliega su desglose diario (día, nº de
   sesiones, tiempo), y el botón **«CSV por días»** exporta una fila por
   alumno y día — el registro de conexiones diarias que pide el seguimiento.

`SESSION_GAP_MIN` es una constante al inicio del script (por defecto **30
minutos**, el valor habitual en este tipo de cálculo). Un umbral muy bajo
(p. ej. 1 minuto) corta la sesión en cada lectura de contenido —ver una página
no genera eventos— y produce tiempos irrealmente bajos; uno muy alto infla las
sesiones con tiempo de ausencia.

`SESSION_MIN_SEC` (por defecto **60 s**) es el tiempo que se atribuye a una
sesión con un solo evento registrado. Sin él, la resta «último menos primero»
daba **cero** para esas sesiones e infravaloraba de forma sistemática las horas
acreditadas. Sigue siendo una **estimación**: el detalle por evento exportable
(la evidencia bruta para una inspección) es el informe *Registros* al que
enlaza el panel.

### Cuándo el panel avisa de que la estimación no está verificada

El informe de registros de Moodle devuelve la fecha **ya formateada en el
idioma del sitio**, no como marca de tiempo. En español es `d/m/aa`; en inglés,
`m/d/aa`. Confundirlos intercambia día y mes en silencio y produce tiempos
plausibles pero falsos.

El panel resuelve el orden mirando **todos los registros del curso a la vez**:
en cuanto un valor supera 12 en una de las dos posiciones, esa posición queda
fijada como el día. Si ningún valor lo desambigua (cursos muy cortos, todo en
los primeros doce días del mes), asume `d/m` pero **marca el tiempo como
estimación sin verificar** y lo dice en la tabla y en la checklist. Preferimos
declarar la duda a publicar horas que parecen buenas y no lo son.

Notas:

- Si la columna «Tiempo en curso» muestra **n/d**, el usuario que ve la página
  no tiene `report/log:view` en el curso, o el formato de descarga JSON está
  deshabilitado (Administración del sitio → Extensiones → Formatos de datos).
- En cursos con mucho historial la descarga de logs por alumno puede tardar
  unos segundos; la PoC consulta hasta `MAX_ALUMNOS` (100) alumnos, con
  `CONCURRENCY` (5) peticiones en vuelo y una barra de progreso.

## Informes nativos enlazados desde el panel

- **Informes → Registros** (`report/log`): todos los eventos con fecha y hora,
  filtrables por alumno y exportables a Excel/CSV — es el registro de
  trazabilidad que se aporta en una inspección.
- **Informes → Participación en el curso** (`report/participation`).
- **Informes → Finalización de la actividad** (`report/progress`).

El panel automatiza la foto de estado y deja a un clic la descarga de la
evidencia documental desde los informes oficiales de Moodle.

## Desarrollo

`panel-fundae.html` es la **única fuente de verdad**: se pega tal cual en
Moodle, sin paso de compilación. Las pruebas extraen el `<script>` del propio
HTML y lo evalúan en un contexto aislado (`test/harness.js`), así que no hay
copias que puedan desincronizarse.

```bash
npm install
npm run lint     # ESLint sobre el panel extraído, las pruebas y los scripts
npm test         # pruebas unitarias de las funciones de cálculo
npm run check    # ambas
```

Las pruebas cubren lo que es determinista y donde se concentran los errores de
cálculo: reconstrucción de sesiones, agrupación por día, detección del formato
de fecha, neutralización de fórmulas en CSV, escapado HTML, pool de
concurrencia, política de reintentos, detección de rol de alumnado y —la
regresión más importante— que el panel **no toque tokens de otros servicios**.

Lo que las pruebas no pueden cubrir (hace falta un Moodle real) está en el
guion de verificación manual de la sección siguiente.

### Guion de verificación manual

Con un Moodle de pruebas y el servicio configurado según los pasos 1–3:

1. **Tutor sin token del servicio, con un token de otro servicio presente**
   (p. ej. el de Moodle Mobile): al pulsar «Conectar» el panel debe decir que
   no encuentra el servicio, y ese otro token debe seguir **intacto** en
   *Claves de seguridad*.
2. **Dos pestañas** con el panel abierto: ambas funcionan y no se invalidan
   entre ellas.
3. **Revocar el token** desde *Administrar tokens* y recargar: el panel lo
   detecta, lo borra del navegador y ofrece reconectar.
4. **Curso con ~50 alumnos**: en las herramientas de red del navegador nunca
   debe haber más de 5 peticiones en vuelo, y la barra de progreso avanza.
5. **Matricular un usuario llamado `=1+1`** y exportar el CSV: la celda debe
   verse literal en Excel, no evaluada.
6. **Entrar como estudiante** en una Página visible: mensaje neutro, sin
   llamadas a la API ni generación de token.
7. **Cambiar el idioma del sitio a inglés** y comparar la columna de tiempo con
   el informe *Registros*: o coincide, o el panel declara la estimación como no
   verificada.

## Estructura del repositorio

```
panel-fundae.html           el panel (esto es lo que se pega en Moodle)
versions/                   versiones anteriores, congeladas — ver su README
test/                       pruebas unitarias + arnés de carga
scripts/extract-inline.mjs  extrae el <script> del HTML para poder lintarlo
scripts/purgar-historial.sh limpieza del ZIP que quedó en el historial de git
```
