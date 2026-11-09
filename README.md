# PoC — Panel de evidencias FUNDAE para Moodle 4.5 / 5.x y Open LMS (sin plugins)

> Versión actual: **v3.1**. Compatibilidad verificada contra el código fuente de
> las ramas MOODLE_405_STABLE, MOODLE_500_STABLE y MOODLE_501_STABLE (núcleo de
> Open LMS 5.1.4): las funciones de la API que usa el panel existen en las tres
> con la misma firma. La v3.1 se ha probado con un Moodle simulado; queda
> pendiente probarla en una plataforma real.

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
  5. **Informe de seguimiento FUNDAE** *(v3.1)*: tabla con las columnas del informe
     tipo (primer y último acceso, registros, tiempo acumulado, contenidos
     visualizados y mensajes del tutor, en foros y en chats), con el detalle de
     cada alumno sesión a sesión. Ver [Informe de seguimiento FUNDAE](#informe-de-seguimiento-fundae-v31).
- Se actualiza en cada visita (los datos se piden en vivo). Incluye botón «Actualizar».

## Modelo de seguridad: token personal por tutor

Las funciones de informes que usa el panel **no son invocables por el endpoint
AJAX interno** de Moodle (no tienen el flag `ajax` en `lib/db/services.php`;
están publicadas solo para servicios web externos). Por eso el panel usa el
protocolo **REST con token** (`/webservice/rest/server.php`).

**El código del panel NO contiene ningún token.** Cada tutor se conecta con su
**token personal**, que queda guardado solo en su navegador, nunca en la página.

**Conexión automática (el tutor no hace nada).** Al abrir la página, el panel
obtiene el token del tutor usando su propia sesión: replica con `fetch`
(same-origin, con la cookie del tutor) el gesto que Moodle hace al visitar
*Preferencias → Claves de seguridad* (`/user/managetoken.php`), donde el token
del servicio se **auto-genera** y su valor se devuelve al regenerarlo con el
`sesskey`. Es exactamente lo que el tutor haría a mano; no escala privilegios
(usa su sesión y sus permisos). El token se guarda en `sessionStorage` (se
borra al cerrar el navegador; en la siguiente sesión se vuelve a obtener solo).

**Respaldo manual.** Si la conexión automática no es posible (el usuario no
está autorizado en el servicio, es administrador del sitio, o el tema cambia el
HTML de esa página), el panel muestra un asistente para pegar el token a mano,
con opción de «Recordar en este navegador» (`localStorage`, persistente).

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
- `core_completion_get_activities_completion_status` *(para el % de progreso y, desde la v3.1, para «Contenidos visualizados»; si no se añade, esas columnas muestran «n/d»)*
- `gradereport_user_get_grade_items`

Nuevas en la v3.1, para el informe de seguimiento (si falta alguna, solo su
columna muestra «n/d»; el resto del panel funciona igual):

- `core_message_get_conversations` y `core_message_get_conversation_messages` *(mensajes privados del tutor)*
- `mod_forum_get_forums_by_courses`, `mod_forum_get_forum_discussions` y `mod_forum_get_discussion_posts` *(mensajes del alumno en foros y respuestas de los tutores)*

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
   **«Agregar funciones»** → pegar los nombres de las funciones en el
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

Con el paso 3 hecho, **el tutor no tiene que hacer nada**: abre la página del
panel y se conecta solo (el panel obtiene su token usando su sesión). Solo si
la conexión automática falla verá el asistente de respaldo para pegar el token
a mano. El botón 🔑 de la cabecera permite reconectar, cambiar o borrar el
token en cualquier momento.

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
| El panel vuelve a pedir el token | Token caducado o revocado (el panel lo borra solo) | El tutor genera otro en Claves de seguridad (paso 5) |
| El servicio no aparece en Claves de seguridad | Tutor sin `moodle/webservice:createtoken`, o no autorizado en el servicio | Paso 3 |
| «Excepción de control de acceso» (`accessexception`) | Función no añadida al servicio, o tutor sin `webservice/rest:use`, o no autorizado | Pasos 2 y 3 |
| «No tiene permiso…» en una función concreta | Al tutor le falta esa capacidad en el curso (p. ej. ver finalización) | Revisar su rol en el curso |
| «n/d» en Mensajes tutor *(v3.1)* | Faltan las funciones de mensajería o de foros en el servicio | Paso 2: añadir las funciones nuevas de la v3.1 |
| «—» en Contenidos visualizados *(v3.1)* | Ningún contenido tiene la finalización «ver» configurada | Configurar la finalización por vista en archivos, libros, lecciones, SCORM… |
| «Atención» en Tiempos de conexión con «Moodle responde: …» *(v3.1.1)* | La descarga de registros devuelve una página de error | Leer el mensaje: permiso `report/log:view` en el curso, lector de registros, sesión caducada… |
| Sin datos de finalización con un profesor sin permiso de edición | El curso está en grupos separados y ese rol no tiene «Acceder a todos los grupos» (`moodle/site:accessallgroups`) | Añadir al tutor a los grupos de sus alumnos o concederle ese permiso en el curso |

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
| 13 | Contenidos con finalización por vista configurada *(v3.1)* | Sin ella no se puede medir «Contenidos visualizados» |
| 14 | Alumnos con al menos un mensaje del tutor *(v3.1)* | Evidencia de tutorización individual |

## Informe de seguimiento FUNDAE (v3.1)

Sección adicional del panel con las columnas del informe de seguimiento tipo.
Cada cifra es un enlace que despliega el detalle del alumno: sus sesiones con
el tiempo acumulado, los contenidos vistos y pendientes, y el desglose de
mensajes.

| Columna | Criterio | Fuente |
|---------|----------|--------|
| Primer acceso | Primer evento del alumno en los registros del curso | `report/log` (sesión del tutor) |
| Último acceso | Último acceso al curso | `core_enrol_get_enrolled_users` (`lastcourseaccess`) |
| Registros | Número de sesiones | `report/log` |
| Tiempo acumulado | Suma de la duración de todas las sesiones | `report/log` |
| Contenidos visualizados | Contenidos cuya finalización exige verlos (archivos, libros, lecciones, SCORM…) que el alumno ha visto, sobre el total. No cuentan secciones, subsecciones ni áreas de texto | `core_completion_get_activities_completion_status` (regla `completionview`) |
| Mensajes tutor | Mensajes privados del tutor conectado al alumno, dentro de las fechas del curso, más las respuestas de los tutores a mensajes del alumno en los foros (incluidas las respuestas privadas) | Mensajería y foros (API) |
| Mensajes foros | Mensajes publicados por el alumno (debates iniciados y respuestas; sin los borrados) | Foros (API); si faltan las funciones, eventos de creación en `report/log` |
| Mensajes chats | Mensajes enviados por el alumno en las actividades de chat | `report/log` |

### Cómo se cuenta el tiempo

1. **Sesiones.** Los eventos del alumno se ordenan por hora. Si entre dos
   eventos consecutivos pasan más de `SESSION_GAP_MIN` minutos (30 por
   defecto), se cierra la sesión y la siguiente actividad abre otra.
2. **Duración de cada sesión.** La decide la función `fundaeDuracionSesion()`,
   al principio del script. Por defecto, del primer al último evento: una
   sesión de un solo evento suma 0 s, porque Moodle no registra el tiempo de
   lectura que sigue al último clic. El texto que lo explica en el panel está
   en `DURACION_SESION_DESCRIPCION`.
3. **Tiempo acumulado.** Suma de la duración de todas las sesiones. En el
   detalle del alumno, la columna «Acumulado» muestra la suma sesión a sesión,
   y el botón **«CSV sesiones»** exporta una fila por alumno y sesión con ese
   acumulado.

### Exportaciones

- **CSV informe FUNDAE**: una fila por alumno con las columnas del informe y su desglose.
- **CSV sesiones**: una fila por alumno y sesión (fecha, inicio, fin, eventos, duración y acumulado).

### Ajustes al inicio del script

- `SESSION_GAP_MIN`: minutos de inactividad que cierran una sesión (30).
- `LOG_READER`: lector de registros de la descarga. Vacío (por defecto) = el que tenga activo la plataforma *(v3.1.1)*.
- `ROLES_TUTOR`: roles que cuentan como tutor en los foros (`editingteacher`, `teacher`). El tutor conectado cuenta siempre.
- `EXCLUIR_CONTENIDOS`: tipos que nunca cuentan como contenido (`label`, `subsection`, `qbank`).
- `CONTAR_RESPUESTAS_FORO`: `true` suma las respuestas en foros a «Mensajes tutor»; `false` cuenta solo los mensajes privados.
- `CONCURRENCIA`: peticiones simultáneas máximas (6), para no saturar la plataforma.

### Límites conocidos

- Los mensajes privados de Moodle no pertenecen a un curso: se acotan a las
  fechas del curso y solo se ven los del tutor conectado (es su token).
- El tiempo es una estimación a partir de los registros. No ve el tiempo de
  lectura sin clics (por ejemplo, dentro de un SCORM largo).
- En Open LMS falta comprobar en una plataforma real que se pueda guardar
  `<script>` en un recurso Página y que la conexión automática funcione con
  el tema Snap.

## Seguridad: modelo de amenazas y límites residuales

Resuelto respecto a la versión anterior:

- ❌ ~~Token compartido incrustado en el HTML~~ → no hay credenciales en el
  código; el secreto vive solo en el navegador de cada tutor.
- ❌ ~~Escalada: un token con acceso a todos los cursos del usuario de
  servicio~~ → cada token vale exactamente lo que su dueño ya puede ver.

Riesgos residuales (asumidos y documentados):

- **El almacenamiento del navegador es legible por JavaScript de la misma
  página**: un XSS en Moodle podría leer el token del tutor — pero ese mismo
  XSS podría igualmente secuestrar su sesión, así que el token no amplía la
  superficie de ataque. El modo por defecto (`sessionStorage`, borrado al
  cerrar el navegador) reduce además la ventana de exposición. Una cookie
  creada por JavaScript no mejoraría nada (también es legible por XSS) y
  empeoraría la exposición al viajar en todas las peticiones al dominio; la
  única cookie segura (`HttpOnly`) requiere componente de servidor.
- **El token viaja en cada petición**: imprescindible servir Moodle por HTTPS.
- El tutor puede ver su propio token (es suyo): el daño máximo de un descuido
  es equivalente a dejar su sesión abierta. Mitigaciones del admin: fecha de
  caducidad y restricción por IP al gestionar tokens, y revocación inmediata
  desde *Administrar tokens*.
- **La conexión automática regenera (rotación) el token del servicio FUNDAE**
  al obtenerlo. Como ese servicio es de uso exclusivo del panel, la rotación no
  afecta a nada más; si el mismo tutor usara ese token en otra herramienta,
  dejaría de valer (debería usar un servicio distinto para ello).
- Es **ofuscación imposible**: cualquier intento de «esconder» un token
  compartido en el frontend (trocearlo, cifrarlo en cliente, cargarlo de otro
  archivo) es pseudoseguridad — lo que el navegador puede leer, el usuario
  puede leerlo. Por eso la solución es que no haya secreto compartido.

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
3. La duración de cada sesión la calcula `fundaeDuracionSesion()` (por defecto,
   último evento − primer evento). El tiempo total es la suma de sesiones.
4. Las sesiones se agrupan también **por día natural**: en la tabla, pulsar
   sobre el tiempo de un alumno despliega su desglose diario (día, nº de
   sesiones, tiempo), y el botón **«CSV por días»** exporta una fila por
   alumno y día — el registro de conexiones diarias que pide el seguimiento.

`SESSION_GAP_MIN` es una constante al inicio del script (por defecto **30
minutos**, el valor habitual en este tipo de cálculo). Un umbral muy bajo
(p. ej. 1 minuto) corta la sesión en cada lectura de contenido —ver una página
no genera eventos— y produce tiempos irrealmente bajos; uno muy alto infla las
sesiones con tiempo de ausencia. Es una **estimación**: el detalle por evento
exportable (la evidencia bruta para una inspección) sigue siendo el informe
*Registros* al que enlaza el panel.

Notas:

- **Formato de la descarga (corregido en la v3.1).** La descarga JSON de
  Moodle 4.5 y 5.x es una lista de hojas (`[[{fila}, {fila}…]]`). La v3.0
  recorría el nivel exterior y no leía ninguna hora, así que el tiempo salía a
  cero. La v3.1 aplana la lista y lee la hora con el formato de fecha del
  idioma del tutor (`strftimedatetimeshortaccurate`, obtenido con
  `core_get_string`), para no confundir día y mes en idiomas como `en_us`.
- **Lector y formato (v3.1.1).** La descarga usa el lector de registros que
  tenga activo la plataforma y, si el JSON falla, el CSV. Si aun así no se
  puede leer, el checklist muestra lo que responde Moodle.
- Si la columna «Tiempo en curso» muestra **n/d**, el usuario que ve la página
  no tiene `report/log:view` en el curso, o el formato de descarga JSON está
  deshabilitado (Administración del sitio → Extensiones → Formatos de datos).
- En cursos con mucho historial la descarga de logs por alumno puede tardar
  unos segundos; la PoC consulta hasta `MAX_ALUMNOS` (100) alumnos.

## Informes nativos enlazados desde el panel

- **Informes → Registros** (`report/log`): todos los eventos con fecha y hora,
  filtrables por alumno y exportables a Excel/CSV — es el registro de
  trazabilidad que se aporta en una inspección.
- **Informes → Participación en el curso** (`report/participation`).
- **Informes → Finalización de la actividad** (`report/progress`).

El panel automatiza la foto de estado y deja a un clic la descarga de la
evidencia documental desde los informes oficiales de Moodle.
