# Changelog — Panel de evidencias FUNDAE

Todas las versiones notables de la PoC. El formato sigue la idea de
[Keep a Changelog](https://keepachangelog.com/es-ES/) y un versionado semántico
simplificado donde el número MAYOR refleja el **modelo de autenticación**, que
es el eje de evolución del proyecto.

El código de cada versión se conserva en [`versions/`](versions/). La versión
en uso (`panel-fundae.html`) es siempre la más reciente.

---

## [3.0.0] — Auto-conexión (versión actual)

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
las ramas `MOODLE_405_STABLE` y `MOODLE_500_STABLE`). Requieren servicios web +
protocolo REST activados y un servicio externo con las funciones indicadas en el
[`README.md`](README.md). Sin plugins.
