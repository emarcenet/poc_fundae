import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'versions/**'] },

  // El panel, extraído del HTML por scripts/extract-inline.mjs.
  // Es ES5 a propósito: se pega tal cual en Moodle y debe funcionar en
  // cualquier navegador que soporte el tema del cliente.
  {
    files: ['.lint/panel-inline.js'],
    languageOptions: {
      ecmaVersion: 2017, // solo por las promesas; el estilo sigue siendo ES5
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        M: 'readonly' // objeto de configuración de Moodle
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-var': 'off',
      // Los catch vacíos son deliberados: almacenamiento bloqueado, JSON que
      // en realidad era HTML de error… el panel degrada en vez de romperse.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      eqeqeq: ['error', 'allow-null'],
      'no-implicit-globals': 'off'
    }
  },

  // Diagnóstico que se pega en la consola del navegador del tutor.
  {
    files: ['scripts/diagnostico-navegador.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, M: 'readonly' }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  // Herramientas y pruebas: aquí sí usamos JS moderno.
  {
    files: ['test/**/*.js', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: 'error'
    }
  }
];
