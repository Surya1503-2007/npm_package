import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUnusedDependencies } from '../src/checks/unused.js';
import { extractPackagesFromCode } from '../src/utils/ast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Unused & Missing Dependencies Check', () => {
  it('identifies unused prod dependencies, unused dev dependencies, and missing dependencies', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'unused-deps');
    const result = await checkUnusedDependencies(fixtureDir);

    expect(result.unusedDependencies).toContain('unused-prod-pkg');
    expect(result.unusedDependencies).not.toContain('lodash'); // lodash is used

    expect(result.unusedDevDependencies).toContain('unused-dev-pkg');
    expect(result.unusedDevDependencies).not.toContain('vitest'); // vitest is in scripts

    expect(result.missingDependencies).toContain('missing-lib');
    expect(result.totalScannedFiles).toBeGreaterThan(0);
  });

  it('avoids false positives for @types, scripts, and config files', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'false-positives');
    const result = await checkUnusedDependencies(fixtureDir);

    // react is used in App.tsx
    expect(result.unusedDependencies).not.toContain('react');

    // @types/react is preserved because react is used
    expect(result.unusedDevDependencies).not.toContain('@types/react');

    // @types/node is preserved
    expect(result.unusedDevDependencies).not.toContain('@types/node');

    // typescript is preserved because tsconfig.json exists
    expect(result.unusedDevDependencies).not.toContain('typescript');

    // tsup, vitest are in scripts
    expect(result.unusedDevDependencies).not.toContain('tsup');
    expect(result.unusedDevDependencies).not.toContain('vitest');

    // eslint is in scripts and config
    expect(result.unusedDevDependencies).not.toContain('eslint');

    // eslint-plugin-react is referenced in eslint.config.js
    expect(result.unusedDevDependencies).not.toContain('eslint-plugin-react');

    // prettier is in scripts and .prettierrc exists
    expect(result.unusedDevDependencies).not.toContain('prettier');

    // All should be marked as used!
    expect(result.unusedDependencies).toEqual([]);
    expect(result.unusedDevDependencies).toEqual([]);
    expect(result.missingDependencies).toEqual([]);
  });

  it('respects the ignore list', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'unused-deps');
    const result = await checkUnusedDependencies(fixtureDir, ['unused-prod-pkg', 'missing-lib']);

    expect(result.unusedDependencies).not.toContain('unused-prod-pkg');
    expect(result.missingDependencies).not.toContain('missing-lib');
  });

  describe('AST import extractor', () => {
    it('extracts imports, dynamic imports, requires, and exports', () => {
      const code = `
        import defaultExport from 'my-pkg';
        import { a, b } from '@scoped/pkg/sub';
        const c = require('cjs-pkg');
        const d = require.resolve('resolve-pkg');
        export { e } from 'export-pkg';
        export * from 'export-all-pkg';
        async function load() {
          const mod = await import('dynamic-pkg');
        }
      `;
      const pkgs = extractPackagesFromCode(code, 'test.ts');
      expect(pkgs.has('my-pkg')).toBe(true);
      expect(pkgs.has('@scoped/pkg')).toBe(true);
      expect(pkgs.has('cjs-pkg')).toBe(true);
      expect(pkgs.has('resolve-pkg')).toBe(true);
      expect(pkgs.has('export-pkg')).toBe(true);
      expect(pkgs.has('export-all-pkg')).toBe(true);
      expect(pkgs.has('dynamic-pkg')).toBe(true);
    });

    it('ignores Node built-ins and relative paths', () => {
      const code = `
        import fs from 'node:fs';
        import path from 'path';
        import local from './local-module';
        import parent from '../parent-module';
      `;
      const pkgs = extractPackagesFromCode(code, 'test.js');
      expect(pkgs.size).toBe(0);
    });

    it('extracts scripts from Vue SFC files', () => {
      const vueSfc = `
        <template>
          <div>{{ msg }}</div>
        </template>
        <script setup lang="ts">
          import { ref } from 'vue-demi';
          import { format } from 'date-fns';
        </script>
      `;
      const pkgs = extractPackagesFromCode(vueSfc, 'Component.vue');
      expect(pkgs.has('vue-demi')).toBe(true);
      expect(pkgs.has('date-fns')).toBe(true);
    });

    it('extracts scripts from Svelte files', () => {
      const svelteComp = `
        <script>
          import { spring } from 'svelte/motion';
          import axios from 'axios';
        </script>
        <main></main>
      `;
      const pkgs = extractPackagesFromCode(svelteComp, 'Widget.svelte');
      expect(pkgs.has('svelte')).toBe(true);
      expect(pkgs.has('axios')).toBe(true);
    });
  });
});
