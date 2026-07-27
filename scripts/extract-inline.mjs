// Extrae el <script> de panel-fundae.html a .lint/panel-inline.js para poder
// pasarle ESLint. El panel tiene que seguir siendo un único archivo pegable en
// Moodle, así que la fuente de verdad es el HTML: este archivo es temporal y
// está en .gitignore.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const html = readFileSync(join(root, 'panel-fundae.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) {
  console.error('No se ha encontrado el <script> en panel-fundae.html');
  process.exit(1);
}

mkdirSync(join(root, '.lint'), { recursive: true });
writeFileSync(join(root, '.lint', 'panel-inline.js'), m[1], 'utf8');
