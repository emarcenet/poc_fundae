# Versiones anteriores — congeladas, no usar en producción

Estos archivos se conservan como registro del proceso descrito en
[`DOCUMENTACION.md`](../DOCUMENTACION.md). **No reciben correcciones.** La única
versión mantenida es [`../panel-fundae.html`](../panel-fundae.html) (v4.0).

| Archivo | Modelo de conexión | Estado |
|---------|--------------------|--------|
| `panel-fundae-v1.0.html` | Token de servicio incrustado en el código | ⛔ **Vulnerable por diseño** |
| `panel-fundae-v2.0.html` | Token personal, pegado a mano | ⚠️ Sin correcciones desde v4.0 |
| `panel-fundae-v3.0.html` | Token personal auto-obtenido al cargar | ⛔ **Dos defectos graves** |

## Por qué no debes desplegar v1.0 ni v3.0

**v1.0** lleva un token de servicio compartido en el frontend: cualquiera que
abra la página lo lee y accede con él a los datos de todos los cursos que
alcance el usuario de servicio. No es apta ni para pruebas con datos reales.

**v3.0** tiene dos defectos detectados en la revisión de la v4.0:

1. Si el tutor no tiene token del servicio FUNDAE pero sí exactamente uno de
   otro servicio, el panel **regenera y se apropia de ese token ajeno**
   (típicamente el de la app móvil del propio tutor, que deja de funcionar).
2. La regeneración se dispara **sola al cargar la página**, sin que el tutor lo
   pida: es un cambio de estado irreversible que invalida el token anterior.

Ambos están corregidos en v4.0, que además limita la concurrencia contra Moodle
y neutraliza la inyección de fórmulas en los CSV.

**v2.0** no tiene esos defectos (no genera tokens: el tutor pega el suyo), pero
comparte con las anteriores el resto de problemas corregidos en v4.0 —
concurrencia sin límite, CSV inyectable y análisis de fechas dependiente del
idioma del sitio.
