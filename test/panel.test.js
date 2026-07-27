import { describe, it, expect, beforeAll } from 'vitest';
import { loadPanel } from './harness.js';

let P;
beforeAll(() => { P = loadPanel(); });

describe('esc', () => {
  it('escapa los caracteres que rompen HTML, incluida la comilla simple', () => {
    expect(P.esc('<b>&"\'/</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&#47;&lt;&#47;b&gt;');
  });

  it('convierte null y undefined en cadena vacía', () => {
    expect(P.esc(null)).toBe('');
    expect(P.esc(undefined)).toBe('');
  });
});

describe('csvCell — inyección de fórmulas', () => {
  it('neutraliza los prefijos de fórmula', () => {
    expect(P.csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(P.csvCell('+1+1')).toBe('"\'+1+1"');
    expect(P.csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(P.csvCell('\tcmd')).toBe('"\'\tcmd"');
  });

  it('deja intactos los números negativos para que Excel los trate como números', () => {
    expect(P.csvCell(-5)).toBe('"-5"');
    expect(P.csvCell('-3,5')).toBe('"-3,5"');
  });

  it('escapa las comillas dobles duplicándolas', () => {
    expect(P.csvCell('Ana "La Jefa"')).toBe('"Ana ""La Jefa"""');
  });

  it('trata null como celda vacía', () => {
    expect(P.csvCell(null)).toBe('""');
  });
});

describe('fundaeParseLogValue', () => {
  it('analiza el formato numérico con y sin segundos', () => {
    expect(P.fundaeParseLogValue('3/07/25, 09:14')).toMatchObject({ a: 3, b: 7, y: 2025, h: 9, mi: 14, s: 0 });
    expect(P.fundaeParseLogValue('13/07/2025, 09:14:35')).toMatchObject({ a: 13, b: 7, y: 2025, s: 35 });
  });

  it('analiza el formato ISO', () => {
    expect(P.fundaeParseLogValue('2025-07-03 09:14:35'))
      .toMatchObject({ iso: true, y: 2025, mo: 7, d: 3, h: 9, mi: 14, s: 35 });
  });

  it('acepta guiones y puntos como separador', () => {
    expect(P.fundaeParseLogValue('03-07-25, 09:14')).toMatchObject({ a: 3, b: 7 });
    expect(P.fundaeParseLogValue('03.07.25, 09:14')).toMatchObject({ a: 3, b: 7 });
  });

  it('devuelve null si no reconoce el valor', () => {
    expect(P.fundaeParseLogValue('Ayer por la tarde')).toBeNull();
    expect(P.fundaeParseLogValue('')).toBeNull();
    expect(P.fundaeParseLogValue(null)).toBeNull();
  });
});

describe('fundaeTimeCell', () => {
  it('localiza la columna por nombre de cabecera, no por posición', () => {
    expect(P.fundaeTimeCell({ 'Nombre completo': 'Ana', 'Hora': '3/07/25, 09:14' })).toBe('3/07/25, 09:14');
    expect(P.fundaeTimeCell({ 'User full name': 'Ana', 'Time': '7/3/25, 09:14' })).toBe('7/3/25, 09:14');
  });

  it('cae a la primera columna si ninguna cabecera parece de fecha', () => {
    expect(P.fundaeTimeCell({ x: 'primero', y: 'segundo' })).toBe('primero');
  });
});

describe('fundaeResolveDateOrder', () => {
  const p = (a, b) => ({ iso: false, a, b, y: 2025, h: 9, mi: 0, s: 0 });

  it('detecta d/m cuando la primera posición supera 12', () => {
    expect(P.fundaeResolveDateOrder([[p(3, 7), p(25, 7)]])).toEqual({ dayFirst: true, ambiguous: false });
  });

  it('detecta m/d cuando la segunda posición supera 12', () => {
    expect(P.fundaeResolveDateOrder([[p(7, 3), p(7, 25)]])).toEqual({ dayFirst: false, ambiguous: false });
  });

  it('marca ambigüedad si ningún valor desambigua, en vez de inventar horas', () => {
    expect(P.fundaeResolveDateOrder([[p(3, 7), p(5, 11)]])).toEqual({ dayFirst: true, ambiguous: true });
  });

  it('no marca ambigüedad si solo hay fechas ISO', () => {
    const iso = { iso: true, y: 2025, mo: 7, d: 3, h: 9, mi: 0, s: 0 };
    expect(P.fundaeResolveDateOrder([[iso]])).toEqual({ dayFirst: true, ambiguous: false });
  });

  it('agrega las muestras de todos los alumnos', () => {
    expect(P.fundaeResolveDateOrder([[p(3, 7)], [p(25, 7)]])).toEqual({ dayFirst: true, ambiguous: false });
  });

  it('tolera listas vacías o nulas', () => {
    expect(P.fundaeResolveDateOrder([])).toEqual({ dayFirst: true, ambiguous: false });
    expect(P.fundaeResolveDateOrder([null, []])).toEqual({ dayFirst: true, ambiguous: false });
  });
});

describe('fundaePartsToTs', () => {
  it('respeta el orden resuelto', () => {
    const parts = [{ iso: false, a: 3, b: 7, y: 2025, h: 9, mi: 0, s: 0 }];
    const dayFirst = new Date(P.fundaePartsToTs(parts, true)[0] * 1000);
    const monthFirst = new Date(P.fundaePartsToTs(parts, false)[0] * 1000);
    expect(dayFirst.getDate()).toBe(3);
    expect(dayFirst.getMonth()).toBe(6);   // julio
    expect(monthFirst.getDate()).toBe(7);
    expect(monthFirst.getMonth()).toBe(2); // marzo
  });
});

describe('fundaeSessions', () => {
  const T0 = 1_700_000_000;
  const MIN = 60;

  it('devuelve cero para una lista vacía', () => {
    expect(P.fundaeSessions([])).toEqual({ seconds: 0, sessions: 0, list: [] });
    expect(P.fundaeSessions(null)).toEqual({ seconds: 0, sessions: 0, list: [] });
  });

  it('atribuye el mínimo a una sesión de un solo evento en vez de cero', () => {
    const r = P.fundaeSessions([T0]);
    expect(r.sessions).toBe(1);
    expect(r.seconds).toBe(MIN);
  });

  it('no corta la sesión justo por debajo del umbral de 30 min', () => {
    const r = P.fundaeSessions([T0, T0 + 29 * 60]);
    expect(r.sessions).toBe(1);
    expect(r.seconds).toBe(29 * 60 + MIN);
  });

  it('corta la sesión justo por encima del umbral', () => {
    const r = P.fundaeSessions([T0, T0 + 31 * 60]);
    expect(r.sessions).toBe(2);
    expect(r.seconds).toBe(2 * MIN);
  });

  it('ordena los eventos desordenados antes de calcular', () => {
    const desordenado = P.fundaeSessions([T0 + 600, T0, T0 + 300]);
    expect(desordenado.sessions).toBe(1);
    expect(desordenado.seconds).toBe(600 + MIN);
  });
});

describe('fundaeByDay', () => {
  it('agrupa por día natural y suma sesiones', () => {
    const d1 = new Date(2025, 6, 3, 9, 0, 0).getTime() / 1000;
    const d1b = new Date(2025, 6, 3, 18, 0, 0).getTime() / 1000;
    const d2 = new Date(2025, 6, 4, 9, 0, 0).getTime() / 1000;
    const días = P.fundaeByDay([
      { start: d1, end: d1, seconds: 60 },
      { start: d1b, end: d1b, seconds: 120 },
      { start: d2, end: d2, seconds: 60 }
    ]);
    expect(días).toEqual([
      { day: '2025-07-03', seconds: 180, sessions: 2 },
      { day: '2025-07-04', seconds: 60, sessions: 1 }
    ]);
  });

  it('imputa la sesión al día en que empezó aunque cruce la medianoche', () => {
    const start = new Date(2025, 6, 3, 23, 30, 0).getTime() / 1000;
    const días = P.fundaeByDay([{ start, end: start + 3600, seconds: 3600 }]);
    expect(días).toHaveLength(1);
    expect(días[0].day).toBe('2025-07-03');
  });

  it('tolera una lista nula', () => {
    expect(P.fundaeByDay(null)).toEqual([]);
  });
});

describe('fundaeIsStudent', () => {
  const con = (...shortnames) => ({ roles: shortnames.map((shortname) => ({ shortname })) });

  it('reconoce el rol estándar', () => {
    expect(P.fundaeIsStudent(con('student'))).toBe(true);
  });

  it('reconoce roles renombrados o clonados', () => {
    expect(P.fundaeIsStudent(con('alumno'))).toBe(true);
    expect(P.fundaeIsStudent(con('estudiante'))).toBe(true);
    expect(P.fundaeIsStudent(con('student_bonificado'))).toBe(true);
    expect(P.fundaeIsStudent(con('alumnado2024'))).toBe(true);
    expect(P.fundaeIsStudent(con('Student'))).toBe(true);
  });

  it('no confunde al profesorado con alumnado', () => {
    expect(P.fundaeIsStudent(con('editingteacher'))).toBe(false);
    expect(P.fundaeIsStudent(con('teacher', 'manager'))).toBe(false);
    expect(P.fundaeIsStudent({})).toBe(false);
  });
});

describe('fundaeFindServiceLink — no tocar tokens ajenos', () => {
  // Réplica mínima de la tabla de user/managetoken.php.
  function fakeDoc(filas) {
    const links = filas.map((celdas, i) => {
      const row = {
        textContent: celdas.join(' '),
        querySelectorAll: () => celdas.map((t) => ({ textContent: t }))
      };
      const link = { href: `?action=resetwstoken&tokenid=${i + 1}`, closest: () => row };
      link.getAttribute = () => link.href;
      return link;
    });
    return { querySelectorAll: () => links };
  }

  it('elige la fila del servicio buscado', () => {
    const doc = fakeDoc([['Moodle mobile web service', 'Reiniciar'], ['FUNDAE PoC', 'Reiniciar']]);
    expect(P.fundaeFindServiceLink(doc, 'FUNDAE PoC').getAttribute()).toContain('tokenid=2');
  });

  it('NO se apropia del único token cuando es de otro servicio (regresión B1)', () => {
    const doc = fakeDoc([['Moodle mobile web service', 'Reiniciar']]);
    expect(P.fundaeFindServiceLink(doc, 'FUNDAE PoC')).toBeNull();
  });

  it('devuelve null si no hay ningún token', () => {
    expect(P.fundaeFindServiceLink(fakeDoc([]), 'FUNDAE PoC')).toBeNull();
  });

  it('acepta que el tema añada texto alrededor del nombre del servicio', () => {
    const doc = fakeDoc([['Servicio: FUNDAE PoC (activo)', 'Reiniciar']]);
    expect(P.fundaeFindServiceLink(doc, 'FUNDAE PoC')).not.toBeNull();
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    const doc = fakeDoc([['  fundae poc  ', 'Reiniciar']]);
    expect(P.fundaeFindServiceLink(doc, 'FUNDAE PoC')).not.toBeNull();
  });
});

describe('fundaePool', () => {
  it('nunca supera el límite de concurrencia', async () => {
    let enVuelo = 0, pico = 0;
    const items = Array.from({ length: 40 }, (_, i) => i);
    const res = await P.fundaePool(items, async (n) => {
      enVuelo++; pico = Math.max(pico, enVuelo);
      await new Promise((r) => setTimeout(r, 1));
      enVuelo--;
      return n * 2;
    }, 5);
    expect(pico).toBeLessThanOrEqual(5);
    expect(res).toEqual(items.map((n) => n * 2));
  });

  it('mantiene el orden de los resultados y convierte los fallos en null', async () => {
    const res = await P.fundaePool([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    }, 2);
    expect(res).toEqual([1, null, 3]);
  });

  it('informa del progreso una vez por elemento', async () => {
    const vistos = [];
    await P.fundaePool([1, 2, 3], async (n) => n, 2, (done, total) => vistos.push(`${done}/${total}`));
    expect(vistos).toHaveLength(3);
    expect(vistos.at(-1)).toBe('3/3');
  });

  it('resuelve de inmediato con una lista vacía', async () => {
    expect(await P.fundaePool([], async () => 1, 5)).toEqual([]);
  });
});

describe('fundaeRetry', () => {
  it('reintenta los errores transitorios', async () => {
    let intentos = 0;
    const r = await P.fundaeRetry(() => {
      intentos++;
      return intentos < 3 ? Promise.reject(new Error('red')) : Promise.resolve('ok');
    }, 3, 1);
    expect(r).toBe('ok');
    expect(intentos).toBe(3);
  });

  it('no reintenta los errores lógicos de Moodle', async () => {
    let intentos = 0;
    await expect(P.fundaeRetry(() => {
      intentos++;
      const e = new Error('accessexception');
      e.fatal = true;
      return Promise.reject(e);
    }, 3, 1)).rejects.toThrow('accessexception');
    expect(intentos).toBe(1);
  });
});

describe('fmtDur', () => {
  it('formatea horas y minutos con relleno', () => {
    expect(P.fmtDur(0)).toBe('0h 00m');
    expect(P.fmtDur(3600)).toBe('1h 00m');
    expect(P.fmtDur(3660)).toBe('1h 01m');
    expect(P.fmtDur(45 * 60)).toBe('0h 45m');
  });

  it('devuelve n/d cuando no hay dato', () => {
    expect(P.fmtDur(null)).toBe('n/d');
  });
});
