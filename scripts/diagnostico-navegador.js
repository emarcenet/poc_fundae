/* Diagnóstico del entorno Moodle para el panel FUNDAE.
 *
 * QUÉ HACE: comprueba los supuestos que el panel no puede verificar sin un
 * Moodle real. Es de SOLO LECTURA.
 *
 * QUÉ NO HACE: no regenera ni crea ningún token, no modifica nada, y no
 * imprime datos personales — de las fechas del informe de registros solo
 * muestra la FORMA (dígitos enmascarados con «d»), nunca los valores.
 *
 * CÓMO USARLO:
 *   1. Inicia sesión en Moodle con tu cuenta de TUTOR del curso.
 *   2. Abre la página del panel (o cualquier página del curso).
 *   3. Abre la consola del navegador (F12 → Consola).
 *   4. Pega todo este archivo y pulsa Enter.
 *   5. Copia la salida y pásamela.
 */

(async function () {
  var SERVICE_NAME = 'FUNDAE PoC'; // ajústalo si tu servicio se llama distinto
  var out = {};

  function nota(k, v) { out[k] = v; }

  // --- 1. Configuración de Moodle expuesta al navegador -----------------
  try {
    nota('M.cfg presente', typeof M !== 'undefined' && !!M.cfg);
    nota('M.cfg.courseId', (typeof M !== 'undefined' && M.cfg) ? M.cfg.courseId : '(sin M.cfg)');
    nota('tipo de courseId', typeof ((typeof M !== 'undefined' && M.cfg) ? M.cfg.courseId : undefined));
    nota('M.cfg.wwwroot', (typeof M !== 'undefined' && M.cfg) ? M.cfg.wwwroot : '(sin M.cfg)');
    nota('M.cfg.sesskey presente', !!(typeof M !== 'undefined' && M.cfg && M.cfg.sesskey));
    nota('idioma del navegador', navigator.language);
    nota('clases del body (id de curso de respaldo)',
      (document.body.className.match(/course-\d+/) || ['(no aparece)'])[0]);
  } catch (e) { nota('error en configuración', String(e)); }

  var courseid = (typeof M !== 'undefined' && M.cfg && M.cfg.courseId) ? M.cfg.courseId : null;
  if (!courseid) {
    var bc = document.body.className.match(/course-(\d+)/);
    courseid = bc ? bc[1] : null;
  }
  nota('id de curso usado en el diagnóstico', courseid || '(no detectado)');

  // --- 2. Detección de permiso sobre los registros ----------------------
  // Es la comprobación que usa el panel como guarda de rol.
  if (courseid) {
    try {
      var r = await fetch(M.cfg.wwwroot + '/report/log/index.php?id=' + courseid, { credentials: 'same-origin' });
      var html = await r.text();
      nota('report/log — código HTTP', r.status);
      nota('report/log — contiene "logreader"', html.indexOf('logreader') >= 0);
      nota('report/log — contiene "chooselog"', html.indexOf('chooselog') >= 0);
      nota('report/log — DETECCIÓN DEL PANEL',
        (html.indexOf('logreader') >= 0 || html.indexOf('chooselog') >= 0) ? 'OK, te reconoce' : 'FALLA');
      nota('report/log — tamaño del HTML', html.length);
    } catch (e) { nota('error en report/log', String(e)); }
  }

  // --- 3. Formato de fecha del informe de registros ---------------------
  // Solo se mira la FORMA de la primera columna, nunca los valores.
  if (courseid) {
    try {
      var p = new URLSearchParams({
        chooselog: 1, id: courseid, user: 0, date: 0,
        modid: '', modaction: '', origin: '', edulevel: -1,
        logreader: 'logstore_standard', download: 'json'
      });
      var r2 = await fetch(M.cfg.wwwroot + '/report/log/index.php?' + p.toString(), { credentials: 'same-origin' });
      var txt = await r2.text();
      var rows = null;
      try { rows = JSON.parse(txt); } catch (e) { /* no era JSON */ }

      if (!Array.isArray(rows)) {
        nota('descarga JSON de registros', 'NO devuelve JSON (¿formato deshabilitado o sin permiso?)');
        nota('primeros caracteres de la respuesta', txt.slice(0, 60).replace(/\s+/g, ' '));
      } else {
        nota('descarga JSON de registros', 'OK, ' + rows.length + ' filas');
        nota('nombres de columna', rows.length ? Object.keys(rows[0]) : '(sin filas)');

        // Enmascara los dígitos: '3/07/25, 09:14' -> 'd/dd/dd, dd:dd'
        var muestra = [];
        var a12 = false, b12 = false, n = 0;
        rows.slice(0, 400).forEach(function (row) {
          var keys = Object.keys(row);
          var k = keys.filter(function (x) { return /hora|time|fecha|date/i.test(x); })[0] || keys[0];
          var v = String(row[k] == null ? '' : row[k]);
          if (muestra.length < 3) muestra.push(v.replace(/\d/g, 'd'));
          var m = v.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
          if (m) { n++; if (+m[1] > 12) a12 = true; if (+m[2] > 12) b12 = true; }
        });
        nota('forma de la columna de hora (dígitos enmascarados)', muestra);
        nota('valores numéricos analizables', n);
        nota('ORDEN DE FECHA RESUELTO',
          (a12 && !b12) ? 'd/m/aa (sin ambigüedad)'
            : (b12 && !a12) ? 'm/d/aa (sin ambigüedad)'
              : (n === 0 ? 'sin datos suficientes' : 'AMBIGUO — el panel avisará de estimación sin verificar'));
      }
    } catch (e) { nota('error en descarga de registros', String(e)); }
  }

  // --- 4. Servicio y tokens (SOLO LECTURA, no regenera nada) ------------
  try {
    var r3 = await fetch(M.cfg.wwwroot + '/user/managetoken.php', { credentials: 'same-origin' });
    var h3 = await r3.text();
    var doc = new DOMParser().parseFromString(h3, 'text/html');
    var links = Array.prototype.slice.call(doc.querySelectorAll('a[href*="resetwstoken"]'));
    nota('claves de seguridad — código HTTP', r3.status);
    nota('nº de tokens con enlace «Reiniciar»', links.length);

    var target = SERVICE_NAME.trim().toLowerCase();
    var exacto = 0, laxo = 0, servicios = [];
    links.forEach(function (a) {
      var row = a.closest ? a.closest('tr') : null;
      if (!row) return;
      var cells = Array.prototype.slice.call(row.querySelectorAll('td, th'))
        .map(function (c) { return c.textContent.replace(/\s+/g, ' ').trim(); })
        .filter(function (t) { return t && t.length < 60 && !/^\s*$/.test(t); });
      servicios.push(cells.slice(0, 3));
      if (cells.some(function (t) { return t.toLowerCase() === target; })) exacto++;
      else if (row.textContent.replace(/\s+/g, ' ').toLowerCase().indexOf(target) >= 0) laxo++;
    });
    nota('filas encontradas (primeras celdas de cada una)', servicios);
    nota('coincidencia EXACTA con "' + SERVICE_NAME + '"', exacto);
    nota('coincidencia laxa (el tema añade texto)', laxo);
    nota('BÚSQUEDA DEL PANEL',
      (exacto + laxo) > 0 ? 'OK, encontraría el servicio'
        : (links.length > 0
          ? 'NO lo encuentra — con la v3.0 se habría apropiado de otro token'
          : 'no hay ningún token en esta cuenta'));
  } catch (e) { nota('error en claves de seguridad', String(e)); }

  console.log('%c=== Diagnóstico panel FUNDAE ===', 'font-weight:bold');
  console.table(out);
  console.log('Copia esto y pásamelo:\n' + JSON.stringify(out, null, 2));
  return out;
})();
