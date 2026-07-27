// Carga las funciones puras de panel-fundae.html sin paso de compilación.
//
// El panel tiene que seguir siendo UN archivo que se pega tal cual en Moodle,
// así que no se puede trocear en módulos: en su lugar, extraemos el <script>
// y lo evaluamos en un contexto aislado con un `document` mínimo. Como
// `fundaeBoot()` sale de inmediato si no encuentra #fundae-panel, el panel no
// arranca y solo quedan las funciones, que el propio archivo expone por
// `module.exports`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const PANEL = join(here, '..', 'panel-fundae.html');

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('No se ha encontrado el <script> en panel-fundae.html');
  return m[1];
}

export function panelSource() {
  return extractScript(readFileSync(PANEL, 'utf8'));
}

export function loadPanel() {
  const source = panelSource();
  const module_ = { exports: {} };
  const sandbox = {
    module: module_,
    // `fundaeBoot` sale en cuanto getElementById devuelve null.
    document: { getElementById: () => null, createElement: () => ({}), head: {}, body: { className: '' } },
    location: { pathname: '/', search: '' },
    window: {},
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    URLSearchParams,
    console
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'panel-fundae.html' });
  return module_.exports;
}
