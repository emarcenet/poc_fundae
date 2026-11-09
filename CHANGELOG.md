# Changelog — Panel de evidencias FUNDAE

Todas las versiones notables de la PoC. El formato sigue la idea de
[Keep a Changelog](https://keepachangelog.com/es-ES/) y un versionado semántico
simplificado donde el número MAYOR refleja el **modelo de autenticación**, que
es el eje de evolución del proyecto.

El código de cada versión se conserva en [`versions/`](versions/). La versión
en uso (`panel-fundae.html`) es siempre la más reciente.

---

## [3.1.3] — Compatibilidad con los filtros MathJax y TeX (versión actual)

Archivo: [`versions/panel-fundae-v3.1.html`](versions/panel-fundae-v3.1.html)
· también publicado como `panel-fundae.html`. Surge de la tercera prueba real:
con la v3.1.2, la Página mostraba parte del código del panel como texto.

### Corregido
- La v3.1.2 incluía una expresión regular con una barra invertida seguida de
  un corchete de apertura. El filtro MathJax de Moodle se activa con esa
  secuencia, con una barra invertida seguida de paréntesis o con dos dólares
  seguidos. Al activarse, convierte en texto las etiquetas HTML que hay entre
  llaves e inserta sus propias etiquetas, lo que rompía el script. La
  comprobación de descarga vacía se escribe ahora sin esa secuencia.

### Añadido
- Guardia en las pruebas: fallan si el panel contiene alguna secuencia que
  active MathJax o la notación TeX.
- Recomendación en el README: desactivar los filtros MathJax y Notación TeX
  en la Página del panel.

### Verificación
- Guardia de filtros + 57 comprobaciones en siete escenarios.

---

## [3.1.2] — Registros vacíos y acceso al curso

Archivo: [`versions/panel-fundae-v3.1.html`](versions/panel-fundae-v3.1.html)
· también publicado como `panel-fundae.html`. Surge de la segunda prueba real,
en la que el diagnóstico de la v3.1.1 mostró «Moodle responde: «[]]»».

### Corregido
- **Descarga sin filas.** Cuando un alumno no tiene eventos, Moodle 5.1 cierra
  una hoja que nunca abrió y escribe «[]]», que no es JSON válido; en CSV solo
  escribe la marca BOM. El panel lo trataba como un error («No se ha podido
  leer la descarga»). Ahora lo lee como cero eventos.
- **Trazabilidad.** «Han accedido» y el último acceso usan solo el acceso al
  curso (`lastcourseaccess`). Hasta ahora se usaba como respaldo el último
  acceso a la plataforma, y un alumno que nunca había entrado en el curso
  contaba como «ha accedido».

### Añadido
- Aviso en el checklist cuando la descarga funciona pero ningún alumno tiene
  eventos en el curso, con las causas que hay que revisar (alumnos que no han
  entrado, retención de registros o lector activo).

### Verificación
- El Moodle simulado devuelve ahora la salida real de Moodle sin filas («[]]»
  y BOM). 57 comprobaciones en siete escenarios.

---

## [3.1.1] — Lectura de registros más robusta y diagnóstico

Archivo: [`versions/panel-fundae-v3.1.html`](versions/panel-fundae-v3.1.html)
· también publicado como `panel-fundae.html`. Surge de la primera prueba en
una plataforma real, donde el checklist indicaba «Sin acceso a los registros»
sin más detalle.

### Corregido
- La descarga de registros ya no fuerza `logreader=logstore_standard`: usa el
  lector que tenga activo la plataforma (`LOG_READER` vacío). Si los registros
  se guardan en otro almacén, la v3.1.0 no podía leerlos.
- Si la descarga JSON no se puede leer, el panel la pide en CSV. También
  tolera la marca BOM y los avisos de PHP alrededor del JSON.
- Tras dos alumnos sin poder leer los registros, deja de insistir con el resto.

### Añadido
- **Diagnóstico en el checklist.** Cuando una fuente falla, se muestra lo que
  responde Moodle: registros, finalización del curso, finalización de las
  actividades, mensajería y foros.

### Verificación
- Moodle simulado: 53 comprobaciones en seis escenarios (completo, sin
  mensajería ni foros, lector de registros distinto, JSON roto, sin permiso de
  registros y curso sin criterios de finalización).

---

## [3.1.0] — Informe de seguimiento FUNDAE

Archivo: [`versions/panel-fundae-v3.1.html`](versions/panel-fundae-v3.1.html)
· también publicado como `panel-fundae.html`. Versión menor: el modelo de
autenticación no cambia.

### Añadido
- **Informe de seguimiento FUNDAE**, como sección adicional: primer acceso,
  último acceso, registros (sesiones), tiempo acumulado, contenidos
  visualizados y mensajes del tutor, en foros y en chats.
- **Detalle por alumno** con sus sesiones (fecha, inicio, fin, eventos,
  duración) y el **tiempo acumulado sesión a sesión**, más los contenidos
  vistos y pendientes y el desglose de mensajes.
- Recuadro **«Cómo se calcula cada columna»** dentro del propio panel.
- **Contenidos visualizados**: contenidos cuya finalización exige verlos
  (regla `completionview`), sin secciones, subsecciones ni áreas de texto.
- **Mensajes tutor**: mensajes privados del tutor conectado dentro de las
  fechas del curso, más las respuestas de los tutores a mensajes del alumno
  en los foros (incluidas las privadas). Ajustable con `CONTAR_RESPUESTAS_FORO`.
- **Mensajes foros** (sin los borrados) y **mensajes chats**.
- Exportaciones **«CSV informe FUNDAE»** y **«CSV sesiones»** (con acumulado).
- Dos comprobaciones nuevas en el checklist: contenidos con finalización por
  vista y alumnos con mensajes del tutor (14 en total).
- Indicador de progreso durante la carga y límite de peticiones simultáneas
  (`CONCURRENCIA`).
- Funciones nuevas en el servicio externo: `core_message_get_conversations`,
  `core_message_get_conversation_messages`, `mod_forum_get_forums_by_courses`,
  `mod_forum_get_forum_discussions` y `mod_forum_get_discussion_posts`.
  Si faltan, solo su columna muestra «n/d».

### Corregido
- **Tiempo de conexión a cero.** La descarga JSON de `report/log` en Moodle
  4.5 y 5.x es una lista de hojas (`[[…]]`). La v3.0 recorría el nivel
  exterior y no leía ninguna hora. La v3.1 aplana la lista antes de leerla.
- **Fechas según el idioma.** La hora se lee con el formato
  `strftimedatetimeshortaccurate` del idioma del tutor (`core_get_string`,
  AJAX con la sesión). Así no se confunden día y mes en idiomas como `en_us`.

### Cambiado
- La duración de cada sesión se calcula en una función aislada,
  `fundaeDuracionSesion()`, para poder fijar el criterio de acreditación sin
  tocar el resto del código. Por defecto, del primer al último evento.
- El curso se detecta primero con `M.cfg.courseId` y el tutor conectado con
  `M.cfg.userId` (Moodle 4.x/5.x).
- `core_completion_get_activities_completion_status` pasa a ser necesaria
  para «Contenidos visualizados».

### Verificación
- Funciones y textos de evento comprobados contra el código de
  MOODLE_501_STABLE, núcleo de Open LMS 5.1.4.
- Probada con un Moodle simulado (39 comprobaciones, en dos escenarios:
  completo y sin funciones de mensajería ni foros). Pendiente: prueba en
  una plataforma real.

---

## [3.0.0] — Auto-conexión

Archivo: [`versions/panel-fundae-v3.0.html`](versions/panel-fundae-v3.0.html)
· también publicado como `panel-fundae.html`.

### Añadido
- **Auto-conexión silenciosa**: el panel obtiene el token del tutor usando su
  propia sesión (replica con `fetch` same-origin el gesto de visitar
  *Claves de seguridad*, localiza el token del servicio FUNDAE, lo regenera con
  el `sesskey` y lee su valor del HTML). El tutor **no hace nada**.
- Pantalla "Conectando con Moodle con tu sesión…" durante el proceso.
- Botón 🔑 en la cabecera para reconectar / cambiar / borrar el token.
- Mensajes de respaldo según la causa del fallo (usuario no autorizado, cuenta
  de administrador, etc.).

### Cambiado
- El asistente de token pasa a ser **respaldo** ("Conexión manual (respaldo)"),
  con enlace para reintentar la conexión automática.
- El token auto-obtenido se guarda en `sessionStorage` (se renueva solo en la
  siguiente sesión).

### Seguridad
- Verificado contra el código de Moodle 4.5: **no existe función AJAX** que
  entregue un token con solo la sesión, por lo que esta es la mejor vía sin
  plugins. La auto-conexión hace lo que el tutor podría hacer a mano: **no
  escala privilegios**.
- Nota: la auto-conexión **rota** el token del servicio FUNDAE al leerlo
  (inocuo por ser un servicio de uso exclusivo del panel). No aplica a cuentas
  de administrador del sitio.

---

## [2.0.0] — Token personal por tutor

Archivo: [`versions/panel-fundae-v2.0.html`](versions/panel-fundae-v2.0.html).

### Seguridad (cambio principal)
- **Eliminado el token incrustado en el código.** Resuelve la vulnerabilidad
  crítica de la v1.0 (cualquiera que viera la página podía leer el token de
  servicio y extraer datos de los alumnos).
- **Token personal por tutor**: cada tutor genera el suyo en *Preferencias →
  Claves de seguridad* y lo pega en el panel. Opera con sus propios permisos:
  si se filtra, no concede más acceso del que ese tutor ya tiene. Sin escalada
  transversal; revocación individual; trazabilidad por usuario real.

### Añadido
- Asistente de conexión con enlace a *Claves de seguridad* e instrucciones.
- Almacenamiento en el navegador: `sessionStorage` por defecto (se borra al
  cerrar el navegador) o `localStorage` con la casilla **«Recordar en este
  navegador»**.
- Borrado automático y reintento si el token es inválido o caduca.

### Notas
- Se evaluó y **descartó** guardar el token en una cookie creada por JS: no
  aporta seguridad (sigue siendo legible por XSS) y empeora la exposición.
- Limitación conocida: la experiencia exige que el tutor copie y pegue el token
  manualmente (resuelto en la v3.0).

---

## [1.0.0] — PoC funcional con token de servicio

Archivo: [`versions/panel-fundae-v1.0.html`](versions/panel-fundae-v1.0.html).

Primera versión completa y funcional. Conexión por **token de servicio
compartido incrustado** en el código (constante `WSTOKEN`).

### Funcionalidades base (heredadas por todas las versiones)
- Detección automática del id del curso; ejecución en cada carga.
- **Checklist de evidencias FUNDAE** (fechas del curso, matriculados, acceso,
  finalización, controles de aprendizaje, SCORM, calificaciones configuradas,
  interacción, progreso ≥ 75 %, completados) con estados Cumple/Atención/No.
- **Inventario de actividades y recursos por tipo** (SCORM incluido), con
  naturaleza, si es calificable y si la calificación está configurada. Filtrable
  y desplegable elemento a elemento.
- **Tiempo de conexión** calculado desde los registros (`report/log`, JSON) con
  la sesión del tutor: sesiones por inactividad (`SESSION_GAP_MIN`, 30 min) y
  desglose **por días**.
- **Tabla de seguimiento por alumno** (último acceso, inactividad, tiempo,
  progreso, finalización, nota) con orden y filtro, y avatares de iniciales.
- **KPIs**, **CSV** (resumen y conexiones diarias), **impresión** y **enlaces a
  los informes oficiales** de Moodle.
- **CSS inyectado desde JavaScript** para sortear el filtrado de `<style>` del
  editor de Moodle; diseño con tarjetas, cabecera "hero" y badges propios.

### Seguridad
- ⚠️ **Vulnerabilidad conocida**: el token de servicio está incrustado en el
  frontend y es legible por cualquiera que vea la página. Solo apto para un
  entorno de pruebas cerrado. Resuelto en la v2.0.

---

## Compatibilidad

Todas las versiones son compatibles con **Moodle 4.5 y 5** (verificado contra
las ramas `MOODLE_405_STABLE` y `MOODLE_500_STABLE`). La v3.1 se ha verificado
además contra `MOODLE_501_STABLE`, el núcleo de Open LMS 5.1.4. Requieren
servicios web + protocolo REST activados y un servicio externo con las funciones
indicadas en el [`README.md`](README.md). Sin plugins.
