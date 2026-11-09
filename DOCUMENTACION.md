# Documentación del proceso — Panel de evidencias FUNDAE para Moodle

> Prueba de concepto (PoC) de una aplicación que se conecta por API a Moodle
> (4.5 y 5.x, incluido Open LMS 5.1), lee el contexto del curso y los alumnos, y emite las evidencias de
> seguimiento necesarias para una acción formativa bonificable por **FUNDAE**.
> **Sin instalar plugins**: todo vive en una página HTML embebida en el curso.

Este documento recoge **todo el proceso desde el principio**: la idea original,
las decisiones técnicas, los problemas que fueron apareciendo y cómo se
resolvieron, hasta llegar a la arquitectura actual. El detalle de instalación
está en [`README.md`](README.md); el histórico de versiones en
[`CHANGELOG.md`](CHANGELOG.md); el código de cada versión en
[`versions/`](versions/).

---

## 1. La idea original

El punto de partida del usuario (consultora EdTech, Ojulab) fue:

> «Crear una aplicación que se conecte mediante API a un Moodle 5, lea el
> contexto del curso y los alumnos, y emita los informes necesarios para
> bonificar la formación en FUNDAE. La idea es montar un bloque HTML que llame
> a la API y cree una página en el curso, oculta a estudiantes y visible solo
> para el tutor u otro rol distinto de estudiante. En la página se mostrará:
> (1) un listado de elementos comprobados que informe de usabilidad,
> trazabilidad y cualquier evidencia conforme a la normativa; (2) la página se
> actualizará cada vez que el usuario entre.»

Decisiones de diseño que se tomaron de partida:

- **La "página oculta a estudiantes" es nativa de Moodle.** Un recurso *Página*
  marcado como oculto ya es invisible para estudiantes y visible para
  profesores/tutores. No hace falta programar control de roles.
- **El JavaScript se ejecuta en cada carga** → los datos se piden en vivo cada
  vez que el tutor entra. La "actualización en cada entrada" sale gratis.
- **Sin CORS**: como el código vive dentro del propio Moodle, las llamadas
  `fetch` a la API son del mismo origen.

---

## 2. Restricción transversal: "sin plugins"

A petición expresa del usuario, **toda la solución debía funcionar sin instalar
ningún plugin** en Moodle — solo configuración de administración y código
pegado en una página del curso. Esta restricción condicionó toda la
arquitectura y obligó a resolver por vías no evidentes varios problemas
(autenticación, tiempos de conexión, estilos). El precio a pagar y las
alternativas se documentan en cada apartado.

---

## 3. Cronología del desarrollo

El desarrollo fue iterativo, guiado por las pruebas del usuario en su Moodle
real. Estos son los hitos en orden:

| # | Hito | Resultado |
|---|------|-----------|
| 1 | PoC inicial: bloque HTML que llama a la API REST y pinta checklist + tabla de alumnos | Funciona la idea base |
| 2 | Intento de evitar el token con el endpoint AJAX interno (`lib/ajax/service.php`) | **Descartado**: las funciones de informes no son AJAX-callable |
| 3 | Confirmación de versión Moodle **4.5** (no 5) | Verificado: las 5 funciones existen igual en 4.5 |
| 4 | Localización de las funciones en el servicio externo | Se documenta el buscador de "Agregar funciones" |
| 5 | Mejora de presentación y contenido del panel | KPIs, badges, tabla con orden y filtro, CSV |
| 6 | **Tiempo de conexión** calculado desde los registros (`report/log`) | Sesiones por inactividad, sin plugins |
| 7 | Desglose del tiempo **por días** | Tabla desplegable + CSV por días |
| 8 | Inventario de **actividades/recursos**: SCORM, naturaleza, estado de calificación | Cruce de contenidos con el libro de calificaciones |
| 9 | Rediseño visual moderno (tarjetas, hero, avatares) | — |
| 10 | **El editor de Moodle elimina `<style>`** al guardar | Resuelto: CSS inyectado desde JS |
| 11 | Ajuste de tamaños (cabecera y KPIs demasiado grandes) | Rejilla CSS propia |
| 12 | Filtro por actividad/recurso | — |
| 13 | **Vulnerabilidad crítica**: token compartido expuesto en el frontend | Resuelto: token personal por tutor (v2.0) |
| 14 | Pregunta sobre cookies para ocultar el token | Analizado y descartado (no aporta seguridad) |
| 15 | Opción `sessionStorage` vs `localStorage` («Recordar») | — |
| 16 | **UX inaceptable** del pegado manual del token | Resuelto: auto-conexión silenciosa (v3.0) |
| 17 | Viabilidad en **Open LMS 5.1** (núcleo Moodle 5.1.4) | Verificado contra el código de MOODLE_501_STABLE |
| 18 | **Informe de seguimiento FUNDAE** con las columnas del informe tipo | Sección adicional y detalle de sesiones con acumulado (v3.1) |
| 19 | **Tiempos a cero**: la descarga JSON de registros llega anidada (`[[…]]`) | Resuelto: se aplana y la fecha se lee con el formato del idioma (v3.1) |
| 20 | Primera prueba real: «Sin acceso a los registros» sin causa visible | Lector de registros no forzado, respaldo en CSV y diagnóstico con el mensaje de Moodle (v3.1.1) |
| 21 | Segunda prueba real: el diagnóstico muestra «[]]» | Es la salida de Moodle sin filas; se lee como cero eventos y la trazabilidad pasa a usar solo el acceso al curso (v3.1.2) |

Los hitos 1, 13 y 16 marcan los tres saltos de versión mayor; el 18, la versión
menor 3.1 (ver §7).

---

## 4. Arquitectura técnica

### 4.1 Dónde vive el panel

Un único archivo `panel-fundae.html` (HTML mínimo + un `<script>`) que se pega,
**en modo HTML**, en un recurso *Página* del curso marcado como **oculto**.
Solo tutores/profesores lo ven; los estudiantes no.

### 4.2 Datos que consume y de dónde

| Dato | Origen | Mecanismo |
|------|--------|-----------|
| Metadatos del curso (fechas, nombre) | `core_course_get_courses_by_field` | API REST |
| Alumnos + último acceso | `core_enrol_get_enrolled_users` | API REST |
| Actividades y recursos | `core_course_get_contents` | API REST |
| Ítems y notas del libro de calificaciones | `gradereport_user_get_grade_items` | API REST |
| Estado de finalización del curso | `core_completion_get_course_completion_status` | API REST |
| % de actividades completadas (opcional) | `core_completion_get_activities_completion_status` | API REST |
| **Tiempo de conexión** | `report/log` (descarga JSON) | Sesión del tutor (sin token) |

### 4.3 Qué pinta

1. **Cabecera "hero"** con el curso, fechas y nº de alumnos.
2. **KPIs**: alumnos, % con acceso, % con progreso ≥ 75 %, tiempo total.
3. **Checklist de 12 evidencias** FUNDAE con estado Cumple / Atención / No cumple.
4. **Inventario de actividades y recursos** por tipo (SCORM incluido), con
   naturaleza (actividad/recurso), si es calificable y si la calificación está
   configurada en el libro. Filtrable y desplegable.
5. **Tabla de seguimiento por alumno**: último acceso, inactividad, tiempo en
   curso (desplegable por días), progreso, finalización y nota. Ordenable y
   filtrable.
6. **Enlaces a los informes oficiales** de Moodle (evidencia documental
   exportable).
7. **Exportación CSV**: resumen por alumno y conexiones diarias.

---

## 5. Problemas resueltos y decisiones clave

### 5.1 El token, no el AJAX interno

La primera idea para evitar credenciales fue usar el **endpoint AJAX interno**
de Moodle (`/lib/ajax/service.php`), que ejecuta funciones con la sesión del
usuario. **No funcionó**: verificado contra el código fuente, las funciones de
informes que necesita el panel **no tienen el flag `ajax => true`** en
`lib/db/services.php` (solo están publicadas para servicios web externos, como
la app móvil). Por eso el panel usa el protocolo **REST con token**
(`/webservice/rest/server.php`). Esto es configuración estándar, no un plugin.

### 5.2 Compatibilidad 4.5 / 5

Al confirmarse que el Moodle del usuario era **4.5** (no 5), se verificó contra
el código de las ramas `MOODLE_405_STABLE` y `MOODLE_500_STABLE` que las cinco
funciones existen con la misma firma en ambas. El panel es compatible con las
dos versiones.

### 5.3 Tiempo de conexión sin plugins

FUNDAE exige acreditar **tiempos de conexión**, no solo el último acceso. Ese
dato no lo expone la API estándar. Solución sin plugins: el panel descarga el
informe de **registros** del curso (`report/log` en formato JSON) **con la
sesión del propio tutor** (capacidad `report/log:view`, que los roles de
profesor tienen por defecto) y reconstruye las sesiones:

1. Ordena los eventos del alumno por hora.
2. Si entre dos eventos consecutivos pasan más de `SESSION_GAP_MIN` minutos
   (por defecto **30**), cierra la sesión y abre otra.
3. Duración de sesión = último evento − primer evento; total = suma.
4. Las sesiones se agrupan también **por día natural**.

Es una **estimación** (el método de los bloques de "dedicación"). Un umbral muy
bajo, p. ej. 1 minuto, cortaría la sesión en cada lectura de contenido —ver una
página no genera eventos— y daría tiempos irreales; de ahí los 30 min. La
evidencia bruta para una inspección sigue siendo el informe *Registros*.

### 5.4 El editor de Moodle elimina el `<style>`

Al rediseñar el panel con un bloque `<style>`, el resultado se veía sin estilos:
botones blancos sobre blanco, tarjetas planas. Causa: **el editor de Moodle
purga las etiquetas `<style>`** al guardar (respeta `<script>` pero no
`<style>`). Solución: **todo el CSS se inyecta desde JavaScript** en tiempo de
ejecución (se crea la etiqueta de estilo al cargar), y la cabecera se construye
también desde JS. El HTML estático que se pega es una sola línea, así que no
queda nada que el editor pueda romper. Además, badges/botones usan clases
propias (`fp-ok`, `fp-warn`…) en vez de las de Bootstrap, para verse igual en
cualquier tema.

### 5.5 La vulnerabilidad del token compartido (el gran giro)

Hasta la v1.0 el panel llevaba **un token de servicio incrustado** en el código
(`WSTOKEN`). Problema crítico señalado por el usuario: **cualquiera que viera la
página podía leer ese token** y, con él, extraer datos de los alumnos de todos
los cursos a los que el usuario de servicio tuviera acceso. Es la vulnerabilidad
inherente a poner un *bearer token* en el frontend.

Se evaluaron las opciones (verificadas contra el código de Moodle 4.5):

1. **Sin token (solo sesión)**: parcialmente viable —logs y finalización sí se
   descargan con la sesión—, pero **ninguna función AJAX devuelve el último
   acceso ni las notas como dato estructurado**, y las funciones limpias del
   generador de informes no son AJAX. Quedaría *scraping* frágil. Descartada
   como base.
2. **Token personal por tutor**: cada tutor usa su propio token, con sus
   permisos. Si se filtra, no concede más de lo que ese tutor ya ve. **Elegida.**
3. **Puente PHP en servidor / plugin local**: la solución canónica, fuera del
   alcance "sin plugins".

La v2.0 implementó la opción 2: **no hay ningún token en el código**; cada tutor
genera el suyo en *Preferencias → Claves de seguridad* y se guarda solo en su
navegador. Ventajas: nada que robar en el código, sin escalada de privilegios,
revocación individual y trazabilidad real (las llamadas quedan a nombre del
tutor).

### 5.6 ¿Y guardarlo en una cookie?

Se evaluó. **No aporta seguridad**: la única ventaja real de una cookie es el
flag `HttpOnly` (ilegible por JS), que **solo puede ponerlo el servidor** — y
aquí no hay servidor propio (restricción "sin plugins"). Una cookie creada por
JavaScript es tan legible por XSS como `localStorage`, y **empeora** la
exposición porque viajaría en *todas* las peticiones al dominio. Se mantuvo el
almacenamiento del navegador, con `sessionStorage` por defecto (se borra al
cerrar) y `localStorage` opcional («Recordar en este navegador»).

### 5.7 La UX del token manual era inaceptable (segundo giro)

Pedir a un tutor sin perfil técnico que vaya a "Claves de seguridad", localice
el servicio, copie un token y lo pegue es una mala experiencia. La v3.0 lo
resuelve con **auto-conexión**: verificado contra el código de Moodle 4.5, al
visitar `user/managetoken.php` con la sesión del usuario, Moodle **auto-genera**
el token del servicio y muestra su valor una vez al (re)generarlo. El panel
replica ese gesto del propio tutor por detrás (`fetch` same-origin, con su
cookie y su `sesskey`): localiza el token del servicio FUNDAE, fuerza su
regeneración y lee el valor del HTML. **El tutor no hace nada**; solo ve
"Conectando con Moodle…". Si no es posible (usuario no autorizado, cuenta de
administrador, o tema que cambia el HTML), aparece el asistente manual como
respaldo.

Se confirmó además que **no existe ninguna función AJAX** que entregue un token
con solo la sesión (la única, `tool_mobile_get_tokens_for_qr_login`, está
bloqueada para navegadores normales), por lo que esta vía es la mejor posible
sin plugins. La auto-conexión hace exactamente lo que el tutor podría hacer a
mano: **no escala privilegios**.

### 5.8 Informe de seguimiento FUNDAE y tiempo por sesiones (v3.1)

El punto de partida fue un informe tipo de otra plataforma, con nueve
columnas: nombre, primer y último acceso, registros, tiempo acumulado,
contenidos visualizados y mensajes del tutor, en foros y en chats. El objetivo
era verlo en Open LMS sin plugins. Open LMS usa el núcleo de Moodle 5.1.4, así
que todo se verificó contra el código de `MOODLE_501_STABLE`.

Criterios acordados con el usuario:

- **Registros** = número de sesiones.
- **Contenidos visualizados** = contenidos cuya finalización exige verlos
  (archivos, libros, lecciones, SCORM…). Quedan fuera secciones, subsecciones
  y áreas de texto. Se lee de la regla `completionview` que devuelve
  `core_completion_get_activities_completion_status` en `details`.
- **Mensajes tutor** = mensajes del tutor a los alumnos, en privado y en los foros.

Decisiones técnicas:

- **Una sola descarga de registros por alumno** alimenta el primer acceso, las
  sesiones, el tiempo, los chats y, de respaldo, los foros. Las descripciones
  de evento están en inglés y Moodle no las traduce, así que se reconocen
  igual en cualquier idioma del sitio.
- **El tutor conectado** se obtiene de `M.cfg.userId`, sin añadir funciones al
  servicio. Los mensajes privados se acotan a las fechas del curso, porque en
  Moodle no pertenecen a ningún curso.
- **Respuestas en foros**: se reconstruye el árbol de cada debate (`parentid`)
  para contar las respuestas de los tutores a mensajes del alumno, también las
  privadas.
- **Duración de sesión aislada** en `fundaeDuracionSesion()`, para fijar el
  criterio de acreditación sin tocar el resto. Si la función falla, se usa
  fin − inicio y se avisa en la consola.

**Fallo corregido.** Según el código de `dataformat_json` y de la exportación
de tablas en 4.5 y 5.1, la descarga JSON de `report/log` es una lista de hojas
(`[[{fila}…]]`). La v3.0 recorría el nivel exterior y no leía ninguna hora, de
modo que el tiempo salía a cero; se confirmó pasando la v3.0 por el mismo
Moodle simulado. La v3.1 aplana la lista y lee la hora con el formato
`strftimedatetimeshortaccurate` del idioma del tutor (vía `core_get_string`),
para no confundir día y mes.

**Prueba.** Moodle simulado con cuatro alumnos, dos tutores, foros con
respuestas privadas y borradas, chat y un mensaje anterior al curso: 39
comprobaciones en dos escenarios (completo y sin mensajería ni foros). Falta
la prueba en una plataforma real.

### 5.9 Lectura de registros robusta y diagnóstico (v3.1.1)

En la primera prueba real, el checklist marcaba «Sin acceso a los registros»
mientras la API funcionaba. Según el código de `report/log` en 5.1, ese mismo
síntoma tiene varias causas: falta de `report/log:view`, un lector de
registros distinto de `logstore_standard` (el panel lo forzaba y Moodle no
encuentra el lector), un formato de descarga que no se puede usar o salida
previa que impide exportar. El profesor sin permiso de edición tiene
`report/log:view` por defecto, pero no «Acceder a todos los grupos», lo que
afecta a la finalización en cursos con grupos separados.

Cambios: la descarga usa el lector activo de la plataforma, prueba JSON y CSV,
tolera BOM y avisos de PHP, y el checklist muestra el mensaje de Moodle en
cada fuente que falla. Se añadieron cuatro escenarios al Moodle simulado (53
comprobaciones en total).

### 5.10 Registros vacíos y acceso al curso (v3.1.2)

Con la v3.1.1, el diagnóstico de la segunda prueba real mostró «[]]». Según el
código de la exportación de tablas en 5.1, cuando no hay filas la descarga
escribe la apertura del documento, pero nunca la cabecera de la hoja; al
cerrar, cierra la hoja y el documento: `[` + `]` + `]`. Es decir, la descarga
funcionaba y el alumno no tenía eventos en el curso. La v3.1.2 lo lee como
cero eventos y avisa si ningún alumno tiene registros.

Se corrigió además un fallo heredado: la trazabilidad usaba como respaldo el
último acceso a la plataforma, de modo que un alumno que no había entrado en
el curso contaba como «ha accedido». Ahora solo cuenta el acceso al curso.
Lección para las pruebas: el Moodle simulado debe reproducir también las
salidas vacías reales, no solo las respuestas con datos.

---

## 6. Modelo de seguridad (estado actual)

- **El código no contiene credenciales.**
- **Token personal por tutor**: vale exactamente lo que su dueño ya puede ver;
  si se filtra, no hay escalada transversal.
- **Almacenamiento**: `sessionStorage` por defecto (se borra al cerrar el
  navegador y se vuelve a obtener solo en la siguiente sesión); `localStorage`
  si el tutor marca «Recordar».
- **Riesgos residuales asumidos**: el almacenamiento del navegador es legible
  por un XSS de la propia página (pero ese XSS ya secuestraría la sesión, así
  que el token no amplía la superficie de ataque); el token viaja en cada
  petición (obliga a HTTPS); la auto-conexión **rota** el token del servicio
  FUNDAE al leerlo (inocuo por ser un servicio de uso exclusivo del panel).
- **No funciona para cuentas de administrador del sitio** (Moodle no les
  auto-genera tokens): para probar se usa una cuenta de profesor.

---

## 7. Las tres versiones

El versionado sigue la evolución del **modelo de autenticación**, que es el eje
del proyecto. Cada versión es funcional y autónoma.

| Versión | Modelo de conexión | UX del tutor | Seguridad |
|---------|--------------------|--------------|-----------|
| **v1.0** | Token de servicio **incrustado** en el código | Ninguna acción (token ya puesto) | ❌ Token expuesto en el frontend |
| **v2.0** | **Token personal** por tutor, **pegado manual** | Copiar/pegar el token una vez | ✅ Sin escalada; mal UX |
| **v3.0** | Token personal **auto-obtenido** por la sesión | **Ninguna acción** | ✅ Sin escalada; buen UX |
| **v3.1** | Igual que v3.0 | **Ninguna acción** | ✅ Igual que v3.0; añade el informe de seguimiento FUNDAE |

Las tres comparten **el mismo conjunto de funcionalidades** de informe
(checklist de 12 puntos, inventario de actividades/SCORM, tiempo de conexión por
sesiones y días, tabla por alumno, filtros, CSV, enlaces a informes oficiales,
CSS inyectado desde JS). **Solo cambia cómo se autentica el panel.** La v3.1
añade sobre la v3.0 el informe de seguimiento FUNDAE y corrige la lectura de
los registros (§5.8).

Código de cada versión:

- [`versions/panel-fundae-v1.0.html`](versions/panel-fundae-v1.0.html)
- [`versions/panel-fundae-v2.0.html`](versions/panel-fundae-v2.0.html)
- [`versions/panel-fundae-v3.0.html`](versions/panel-fundae-v3.0.html)
- [`versions/panel-fundae-v3.1.html`](versions/panel-fundae-v3.1.html) (= `panel-fundae.html`, la actual)

> **Por qué se conservan v1.0 y v2.0**: v1.0 es la más simple de desplegar en un
> entorno de pruebas cerrado y controlado (un solo token, sin pasos por tutor),
> útil como demo rápida. v2.0 sirve donde la auto-conexión no aplique (p. ej.
> políticas que impidan la regeneración automática de tokens, o pruebas con
> cuentas de administrador). v3.1 es la recomendada para uso real.

---

## 8. Limitaciones de la PoC y camino a producción

- **Tiempo de conexión** = estimación por sesiones de log, no medición exacta.
  La regla de duración de cada sesión está en `fundaeDuracionSesion()`.
- **Mensajes privados**: solo los del tutor conectado, acotados a las fechas
  del curso (los mensajes de Moodle no pertenecen a ningún curso).
- **Límite** de `MAX_ALUMNOS` (100) consultados por carga.
- **Calificación "configurada"** = el módulo tiene ítem en el libro con nota
  máxima > 0; el detalle fino (método de calificación de un SCORM, etc.) no lo
  expone la API.
- **El token sigue en el navegador**: aceptable para la PoC; la eliminación
  total del secreto requiere componente de servidor.

Evolución natural (fuera del alcance "sin plugins"):

1. **Puente PHP en servidor** (un archivo junto a Moodle, sin instalar plugin):
   `require_login()` + comprobación de capability + consulta en servidor con la
   sesión del tutor. Elimina los tokens del cliente.
2. **Plugin local** (`local_fundae`): función web service propia que calcula el
   informe en servidor (incluidos tiempos reales desde el log store), comprueba
   la capability y devuelve el resultado ya calculado. El panel solo pinta.
3. **Bloque instalable** (`block_fundae`): control de visibilidad por capability
   sin depender de "contenido confiable" ni de pegar HTML.
4. **Informes descargables firmados** (PDF/XLSX) como evidencia formal ante FUNDAE.
