import { AlternativeSuggestion } from '../types.js';

export const ALTERNATIVES_MAP: Record<string, AlternativeSuggestion> = {
  moment: {
    name: 'moment',
    reason: 'Heavy bundle (~300KB+), mutable API, lacks tree-shaking.',
    alternatives: [
      'dayjs (2KB, compatible API)',
      'date-fns (modular, tree-shakeable)',
      'Temporal API',
    ],
  },
  'moment-timezone': {
    name: 'moment-timezone',
    reason: 'Includes massive timezone database.',
    alternatives: ['date-fns-tz', 'Intl.DateTimeFormat (native)'],
  },
  lodash: {
    name: 'lodash',
    reason: 'CommonJS build is not easily tree-shaken and adds substantial weight.',
    alternatives: [
      'lodash-es',
      'radash',
      'Native JS methods (Array.prototype, Object.fromEntries)',
    ],
  },
  underscore: {
    name: 'underscore',
    reason: 'Legacy utility library, largely superseded by modern ES6+ features.',
    alternatives: ['Native JavaScript methods', 'radash', 'lodash-es'],
  },
  request: {
    name: 'request',
    reason: 'Deprecated and unmaintained since 2020.',
    alternatives: ['fetch (native in Node 18+)', 'ky', 'undici'],
  },
  axios: {
    name: 'axios',
    reason: 'Adds extra bundle weight when native fetch is built into Node 18+ and all browsers.',
    alternatives: ['fetch (native)', 'ky', 'ofetch'],
  },
  colors: {
    name: 'colors',
    reason: 'Modifies String.prototype and has legacy security incidents.',
    alternatives: ['picocolors', 'colorette', 'ansis'],
  },
  chalk: {
    name: 'chalk',
    reason: 'Heavier dependency graph compared to micro-libraries.',
    alternatives: ['picocolors (much lighter & faster)', 'colorette'],
  },
  bluebird: {
    name: 'bluebird',
    reason: 'Native Promises are now heavily optimized in V8/Node.',
    alternatives: ['Native Promise', 'Native async/await'],
  },
  async: {
    name: 'async',
    reason: 'Heavy callback-oriented utility library.',
    alternatives: ['Native async/await', 'p-map', 'p-limit', 'p-queue'],
  },
  querystring: {
    name: 'querystring',
    reason: 'Legacy Node.js core module that is deprecated.',
    alternatives: ['URLSearchParams (native)'],
  },
  'deep-extend': {
    name: 'deep-extend',
    reason: 'Can be replaced by structuredClone or lighter deep merge utilities.',
    alternatives: ['structuredClone (native)', 'deepmerge-ts'],
  },
  extend: {
    name: 'extend',
    reason: 'Simple shallow merges are native in modern JS.',
    alternatives: ['Object.assign()', 'Object spread ({ ...a, ...b })'],
  },
  faker: {
    name: 'faker',
    reason: 'Original package is abandoned and deprecated.',
    alternatives: ['@faker-js/faker'],
  },
  validator: {
    name: 'validator',
    reason: 'Heavy string validation library (~280KB).',
    alternatives: ['zod', 'valibot', 'native RegExp'],
  },
};

export function getAlternativeSuggestion(packageName: string): AlternativeSuggestion | undefined {
  return ALTERNATIVES_MAP[packageName.toLowerCase()];
}
