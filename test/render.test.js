// Prueba de humo del renderizado: monta el panel en un DOM real (jsdom) con
// datos de ejemplo y comprueba que pinta, que filtra y ordena sin rehacer los
// inputs, y que no se cuela HTML sin escapar.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { panelSource } from './harness.js';

function montar() {
  const dom = new JSDOM('<!doctype html><html><head></head><body class="course-7">' +
    '<div id="fundae-panel"></div></body></html>', { runScripts: 'outside-only' });
  const { window } = dom;

  window.M = { cfg: { wwwroot: 'https://moodle.example', sesskey: 'abc', courseId: 7 } };
  // Ninguna prueba debe llegar a la red: si algo la toca, falla de forma visible.
  window.fetch = vi.fn(() => Promise.reject(new Error('sin red en las pruebas')));
  window.module = { exports: {} };

  window.eval(panelSource());
  return { window, api: window.module.exports, doc: window.document };
}

const CURSO = { id: 7, fullname: 'Investigando mi barrio', startdate: 1751500000, enddate: 1754100000 };

const CONTENIDOS = [{
  modules: [
    { modname: 'scorm', modplural: 'Paquetes SCORM', name: 'Módulo 1', instance: 11 },
    { modname: 'quiz', modplural: 'Cuestionarios', name: 'Test final', instance: 12 },
    { modname: 'forum', modplural: 'Foros', name: 'Dudas', instance: 13 },
    { modname: 'page', modplural: 'Páginas', name: 'Guía', instance: 14 }
  ]
}];

const NOTAS = {
  usergrades: [
    {
      userid: 1,
      gradeitems: [
        { itemtype: 'course', graderaw: 8.5, gradeformatted: '8,50' },
        { itemtype: 'mod', itemmodule: 'quiz', iteminstance: 12, grademax: 10 }
      ]
    },
    {
      userid: 2,
      // A este alumno le ocultan el ítem del SCORM: solo la UNIÓN lo ve.
      gradeitems: [
        { itemtype: 'course', graderaw: null, gradeformatted: '-' },
        { itemtype: 'mod', itemmodule: 'scorm', iteminstance: 11, grademax: 100 }
      ]
    }
  ]
};

function alumno(id, fullname, extra = {}) {
  return {
    user: { id, fullname, email: `u${id}@example.com`, lastcourseaccess: 1752000000, roles: [{ shortname: 'student' }] },
    completion: { completed: id === 1 },
    actstatuses: [{ state: 1 }, { state: 0 }],
    logparts: [
      { iso: false, a: 3, b: 7, y: 2025, h: 9, mi: 0, s: 0 },
      { iso: false, a: 25, b: 7, y: 2025, h: 10, mi: 0, s: 0 }
    ],
    ...extra
  };
}

let ctx;
beforeEach(() => {
  ctx = montar();
  ctx.api.fundaeBoot();
});

describe('renderizado', () => {
  it('pinta la cabecera y las cuatro tarjetas sin lanzar', () => {
    const { api, doc } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana Ruiz'), alumno(2, 'Luis Paz')],
      [alumno(1, 'Ana Ruiz'), alumno(2, 'Luis Paz')], CONTENIDOS, NOTAS, true);

    expect(doc.getElementById('fp-chips').textContent).toContain('Investigando mi barrio');
    expect(doc.querySelectorAll('#fp-body .fp-card').length).toBeGreaterThan(4);
    expect(doc.getElementById('fp-check-tbody').querySelectorAll('tr')).toHaveLength(12);
    expect(doc.getElementById('fp-stu-tbody').textContent).toContain('Ana Ruiz');
    expect(doc.getElementById('fp-mod-tbody').textContent).toContain('Paquetes SCORM');
  });

  it('cuenta el ítem calificable que solo ve el segundo alumno (regresión I4)', () => {
    const { api } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana'), alumno(2, 'Luis')],
      [alumno(1, 'Ana'), alumno(2, 'Luis')], CONTENIDOS, NOTAS, true);
    // scorm y quiz calificables, ambos con grademax > 0 gracias a la unión.
    expect(api.fundaeData.summary.nGradableActs).toBe(3); // scorm + quiz + forum
    expect(api.fundaeData.summary.nGradedActs).toBe(2);   // scorm y quiz configurados
  });

  it('usa graderaw y no el texto localizado para saber si hay notas', () => {
    const { api } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana'), alumno(2, 'Luis')],
      [alumno(1, 'Ana'), alumno(2, 'Luis')], CONTENIDOS, NOTAS, true);
    expect(api.fundaeData.summary.anyGraded).toBe(true);
    expect(api.fundaeData.students.find((s) => s.uid === 2).graded).toBe(false);
  });

  it('filtrar no destruye el input ni pierde el foco (regresión I10)', () => {
    const { api, doc } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana Ruiz'), alumno(2, 'Luis Paz')],
      [alumno(1, 'Ana Ruiz'), alumno(2, 'Luis Paz')], CONTENIDOS, NOTAS, true);

    const input = doc.getElementById('fp-filter');
    input.focus();
    input.value = 'ana';
    api.fundaeRenderTables();

    expect(doc.getElementById('fp-filter')).toBe(input);      // el mismo nodo
    expect(doc.activeElement).toBe(input);                    // sin parche de foco
    expect(doc.getElementById('fp-stu-tbody').textContent).toContain('Ana Ruiz');
    expect(doc.getElementById('fp-stu-tbody').textContent).not.toContain('Luis Paz');
  });

  it('ordena al pulsar la cabecera y refleja el sentido en aria-sort', () => {
    const { api, doc } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Zoe'), alumno(2, 'Ana')],
      [alumno(1, 'Zoe'), alumno(2, 'Ana')], CONTENIDOS, NOTAS, true);

    const th = doc.querySelector('#fp-stu-thead th[data-fp-key="name"]');
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(doc.getElementById('fp-stu-tbody').textContent.indexOf('Ana'))
      .toBeLessThan(doc.getElementById('fp-stu-tbody').textContent.indexOf('Zoe'));

    api.fundaeSort('name');
    expect(doc.querySelector('#fp-stu-thead th[data-fp-key="name"]').getAttribute('aria-sort'))
      .toBe('descending');
  });

  it('escapa el HTML que venga en los datos de Moodle', () => {
    const { api, doc } = ctx;
    const malicioso = alumno(1, '<img src=x onerror=alert(1)>');
    api.fundaeBuild(CURSO, [malicioso], [malicioso], CONTENIDOS, NOTAS, true);

    const tbody = doc.getElementById('fp-stu-tbody');
    expect(tbody.querySelector('img')).toBeNull();
    expect(tbody.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('avisa cuando el formato de fecha es ambiguo en vez de dar horas falsas', () => {
    const { api, doc } = ctx;
    const ambiguo = alumno(1, 'Ana', {
      logparts: [
        { iso: false, a: 3, b: 7, y: 2025, h: 9, mi: 0, s: 0 },
        { iso: false, a: 5, b: 11, y: 2025, h: 10, mi: 0, s: 0 }
      ]
    });
    api.fundaeBuild(CURSO, [ambiguo], [ambiguo], CONTENIDOS, NOTAS, true);

    expect(api.fundaeData.dateOrder.ambiguous).toBe(true);
    expect(doc.getElementById('fp-body').textContent).toContain('no están verificados');
    expect(doc.getElementById('fp-check-tbody').textContent).toContain('SIN verificar');
  });

  it('marca el tiempo como n/d si no hay acceso a los registros', () => {
    const { api, doc } = ctx;
    const sinLogs = alumno(1, 'Ana', { logparts: null });
    api.fundaeBuild(CURSO, [sinLogs], [sinLogs], CONTENIDOS, NOTAS, false);

    expect(api.fundaeData.students[0].time).toBeNull();
    expect(doc.getElementById('fp-body').textContent).toContain('report/log:view');
  });

  it('no deja atributos onclick en línea (compatibilidad con CSP)', () => {
    const { api, doc } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana')], [alumno(1, 'Ana')], CONTENIDOS, NOTAS, true);
    expect(doc.querySelectorAll('#fundae-panel [onclick]')).toHaveLength(0);
    expect(doc.getElementById('fundae-panel').innerHTML).not.toContain('javascript:');
  });

  it('despliega el detalle diario de un alumno al alternarlo', () => {
    const { api, doc } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana')], [alumno(1, 'Ana')], CONTENIDOS, NOTAS, true);

    expect(doc.querySelectorAll('#fp-stu-tbody tr.fp-detail')).toHaveLength(0);
    api.fundaeToggle(1);
    expect(doc.querySelectorAll('#fp-stu-tbody tr.fp-detail')).toHaveLength(1);
    expect(doc.querySelector('#fp-stu-tbody button[data-fp-action="toggle-student"]')
      .getAttribute('aria-expanded')).toBe('true');
  });

  it('la delegación de eventos responde a un clic real', () => {
    const { api, doc, window } = ctx;
    api.fundaeBuild(CURSO, [alumno(1, 'Ana')], [alumno(1, 'Ana')], CONTENIDOS, NOTAS, true);

    const botón = doc.querySelector('#fp-mod-tbody button[data-fp-action="toggle-type"]');
    botón.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(doc.querySelectorAll('#fp-mod-tbody tr.fp-detail').length).toBeGreaterThan(0);
  });

  it('indica cuántos alumnos se han omitido por el límite de la PoC', () => {
    const { api, doc } = ctx;
    const muchos = Array.from({ length: 3 }, (_, i) => alumno(i + 1, `Alumno ${i + 1}`));
    api.fundaeBuild(CURSO, new Array(150), muchos, CONTENIDOS, NOTAS, true);
    expect(doc.getElementById('fp-body').textContent).toContain('3 de 150');
  });
});
