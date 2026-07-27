# Changelog — Panel de evidencias FUNDAE

Todas las versiones notables de la PoC. El formato sigue la idea de
[Keep a Changelog](https://keepachangelog.com/es-ES/) y un versionado semántico
simplificado donde el número MAYOR refleja el **modelo de autenticación**, que
es el eje de evolución del proyecto.

El código de cada versión se conserva en [`versions/`](versions/). La versión
en uso (`panel-fundae.html`) es siempre la más reciente.

---

## [4.0.0] — Conexión con consentimiento y correcciones de seguridad (versión actual)

Archivo: [`panel-fundae.html`](panel-fundae.html).

Revisión completa del código de la v3.0. El número mayor sube porque **cambia
el modelo de conexión**: obtener el token deja de ser automático.

### Seguridad

- **Corregido: el panel podía apropiarse del token de otro servicio.** Cuando no
  encontraba el del servicio FUNDAE y el tutor tenía exactamente un token,
  usaba ese: lo **regeneraba** y lo empleaba. En la práctica se quedaba con el
  token de la app móvil del tutor y se la dejaba rota. Se ha eliminado ese
  respaldo: ahora exige coincidencia con `SERVICE_NAME` o no hace nada.
- **Corregido: la regeneración del token ya no se dispara sola.** Regenerar
  invalida el token anterior, así que es una acción destructiva y ahora
  requiere pulsar «Conectar con mi cuenta», con aviso previo de lo que implica.
- **Corregido: inyección de fórmulas en los CSV.** Los nombres vienen de
  usuarios de Moodle; uno llamado `=HYPERLINK(...)` ejecutaba la fórmula en el
  Excel de quien abriera la evidencia. Las celdas que empiezan por `=`, `+`,
  `-`, `@`, tabulador o retorno se prefijan con un apóstrofo (los números
  negativos se dejan como números).
- **Añadida guarda de rol**: antes de mostrar nada se comprueba
  `report/log:view`. Si la Página deja de estar oculta, el alumnado ve un
  mensaje neutro en vez de la pantalla de conexión.
- `esc()` escapa también la comilla simple y la barra.
- Los `onclick` en línea se sustituyen por delegación de eventos, de modo que
  el panel sigue funcionando con una CSP sin `unsafe-inline`.
- Los enlaces con `target="_blank"` llevan `rel="noopener"`.

### Corregido

- **Estampida de peticiones**: hasta ~300 llamadas simultáneas contra el propio
  Moodle (100 de ellas descargas completas de registros) podían dejar el sitio
  sin responder. Ahora hay un pool con `CONCURRENCY` (5) peticiones en vuelo,
  barra de progreso y reintentos con espera creciente ante errores de red.
- **Tiempos falsos por el idioma del sitio**: la fecha del informe de registros
  se analizaba asumiendo `d/m/aa`. En un sitio en inglés (`m/d/aa`) día y mes se
  intercambiaban en silencio. Ahora el orden se deduce del conjunto completo de
  registros y, si es indeterminable, el panel marca el tiempo como **estimación
  sin verificar** en vez de dar una cifra falsa. Se acepta también formato ISO.
- **Columna de hora localizada por nombre de cabecera**, no por posición.
- **Sesiones de un solo evento contaban cero segundos**, infravalorando las
  horas acreditadas. Nueva constante `SESSION_MIN_SEC` (60 s por sesión).
- **Inventario de calificaciones tomado de un solo alumno**: si a ese alumno le
  ocultaban ítems, el estado «calificación configurada» salía mal para todo el
  curso. Ahora se usa la unión de todos los alumnos.
- **Detección de notas dependiente del idioma**: se comparaba el texto contra
  «-». Ahora se usa `graderaw`.
- **Detección de alumnado**: además de `student`, se aceptan roles renombrados
  o clonados (`alumno`, `estudiante`, `student_*`, `alumn*`), configurables en
  `STUDENT_ROLES`.
- **Id del curso** vía `M.cfg.courseId`, con los métodos anteriores de respaldo.
- **Descarga de CSV**: el enlace se inserta en el DOM y la URL se libera con
  retardo; sin ello la descarga fallaba en algunos navegadores.
- **Filtros**: ya no se rehace todo el DOM en cada tecla. El esqueleto se pinta
  una vez y solo se repintan los `<tbody>`, con retardo de 150 ms. Desaparece
  el parche que devolvía el foco a mano.

### Cambiado

- **El token se guarda en `localStorage` por defecto** (antes `sessionStorage`).
  Es el único almacenamiento compartido entre pestañas: con `sessionStorage`,
  cada pestaña nueva regeneraba su propio token e invalidaba el de las demás.
  La casilla *Guardar solo durante esta sesión* mantiene el comportamiento
  anterior.

### Accesibilidad

- `scope` en las cabeceras de tabla, `aria-sort` en las columnas ordenables,
  `aria-expanded` en los desplegables y `<caption>` oculta en cada tabla.
- Los desplegables pasan a ser `<button>` en lugar de `javascript:void(0)`, con
  activación por teclado.
- El emoji decorativo se oculta a los lectores de pantalla.
- Se sube el contraste del texto atenuado y de la barra de progreso intermedia.

### Protección de datos

- Aviso antes de cada exportación a CSV y nota permanente en el panel: los
  datos que salen son personales.
- Sección **RGPD** en el README (base legal, minimización, conservación,
  encargo de tratamiento).

### Proyecto

- `LICENSE` (MIT), `.editorconfig`, ESLint y pruebas unitarias con Vitest
  (43 casos), más CI en GitHub Actions.
- Las pruebas extraen el `<script>` del propio HTML: sigue habiendo **un solo
  archivo** que pegar en Moodle, sin paso de compilación ni copias que
  desincronizar.
- `scripts/purgar-historial.sh` para eliminar del historial de git el paquete
  SCORM de 26 MB que se subió y se borró (borrarlo no lo quitó del historial).
- `.gitignore` ampliado: nunca más `*.zip` ni `*.mbz` en el repositorio.
- `versions/README.md` advierte de que v1.0 y v3.0 tienen defectos conocidos y
  no deben desplegarse.

---

## [3.0.0] — Auto-conexión

Archivo: [`versions/panel-fundae-v3.0.html`](versions/panel-fundae-v3.0.html).

> ⛔ **No desplegar.** La revisión de la v4.0 encontró dos defectos graves en
> esta versión: podía apropiarse del token de otro servicio del tutor, y
> regeneraba el token sin que nadie lo pidiera. Ver v4.0.

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
las ramas `MOODLE_405_STABLE` y `MOODLE_500_STABLE`). Requieren servicios web +
protocolo REST activados y un servicio externo con las funciones indicadas en el
[`README.md`](README.md). Sin plugins.
