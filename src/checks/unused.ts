import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { extractPackagesFromCode } from '../utils/ast.js';
import { UnusedDepsResult } from '../types.js';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bin?: string | Record<string, string>;
  [key: string]: any;
}

// Common source file patterns to scan
const SOURCE_PATTERNS = ['**/*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte}'];

// Directories and patterns to ignore when scanning source files
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.git/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/.svelte-kit/**',
  '**/.cache/**',
  '**/temp/**',
  '**/tmp/**',
  '**/public/**',
  '**/fixtures/**',
  '**/__fixtures__/**',
  '**/*.min.js',
  '**/*.d.ts',
];

/**
 * Extracts binary and package tokens referenced in package.json "scripts".
 */
export function extractPackagesFromScripts(
  scripts: Record<string, string> = {},
  allDeps: Set<string>,
): Set<string> {
  const used = new Set<string>();
  const scriptContent = Object.values(scripts).join(' \n ');

  // Split into tokens (commands, flags, words)
  const tokens = scriptContent
    .split(/[\s;&|><'"`$()]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    // Direct match with a package name
    if (allDeps.has(token)) {
      used.add(token);
    }
  }

  // Also check common CLI commands mapped to packages
  for (const dep of allDeps) {
    if (dep === 'typescript' && (tokens.includes('tsc') || tokens.includes('typescript'))) {
      used.add('typescript');
    }
    if (dep === '@biomejs/biome' && tokens.includes('biome')) {
      used.add('@biomejs/biome');
    }
    if (tokens.includes(dep) || tokens.some((t) => t.endsWith(`/${dep}`))) {
      used.add(dep);
    }
  }

  return used;
}

/**
 * Scans root configuration files and package.json keys for referenced packages.
 */
export async function detectUsedToolingFromConfigs(
  cwd: string,
  allDeclaredDeps: Set<string>,
  pkgJson: PackageJson,
): Promise<Set<string>> {
  const used = new Set<string>();

  // Check top-level package.json config keys (e.g. "lint-staged", "prettier", "husky", "jest", "babel")
  for (const dep of allDeclaredDeps) {
    if (pkgJson[dep] !== undefined) {
      used.add(dep);
    }
  }
  if (pkgJson.eslintConfig && allDeclaredDeps.has('eslint')) {
    used.add('eslint');
  }

  // Find all config files in root directory
  const configFiles = await fg(
    ['*config*.{js,cjs,mjs,ts,json}', '.*rc*', '.*rc.{json,js,cjs,yaml,yml}', 'tsconfig*.json'],
    {
      cwd,
      deep: 1,
      dot: true,
      onlyFiles: true,
    },
  );

  for (const configFile of configFiles) {
    const filePath = path.join(cwd, configFile);
    const basename = path.basename(configFile).toLowerCase();

    // TypeScript config
    if (basename.startsWith('tsconfig') && allDeclaredDeps.has('typescript')) {
      used.add('typescript');
    }

    // ESLint configs
    if (basename.includes('eslint')) {
      if (allDeclaredDeps.has('eslint')) used.add('eslint');
    }

    // Prettier configs
    if (basename.includes('prettier')) {
      if (allDeclaredDeps.has('prettier')) used.add('prettier');
    }

    // Vitest / Jest
    if (basename.includes('vitest') && allDeclaredDeps.has('vitest')) used.add('vitest');
    if (basename.includes('jest') && allDeclaredDeps.has('jest')) used.add('jest');

    // Vite / Webpack / Rollup
    if (basename.includes('vite') && allDeclaredDeps.has('vite')) used.add('vite');
    if (basename.includes('webpack')) {
      if (allDeclaredDeps.has('webpack')) used.add('webpack');
      if (allDeclaredDeps.has('webpack-cli')) used.add('webpack-cli');
    }
    if (basename.includes('rollup') && allDeclaredDeps.has('rollup')) used.add('rollup');

    // Tailwind & PostCSS
    if (basename.includes('tailwind')) {
      if (allDeclaredDeps.has('tailwindcss')) used.add('tailwindcss');
    }
    if (basename.includes('postcss')) {
      if (allDeclaredDeps.has('postcss')) used.add('postcss');
    }

    // Babel
    if (basename.includes('babel')) {
      if (allDeclaredDeps.has('@babel/core')) used.add('@babel/core');
    }

    // Read config file content and parse for imports/requires and text mentions
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // 1. AST extraction if it's JS/TS
      if (/\.[mc]?[jt]sx?$/.test(basename)) {
        const pkgs = extractPackagesFromCode(content, basename);
        for (const p of pkgs) {
          if (allDeclaredDeps.has(p)) used.add(p);
        }
      }

      // 2. String search for package names and shorthands inside config files
      for (const dep of allDeclaredDeps) {
        // Direct package name match
        if (content.includes(`"${dep}"`) || content.includes(`'${dep}'`)) {
          used.add(dep);
          continue;
        }

        // ESLint plugin shorthand: eslint-plugin-react -> "react"
        if (dep.startsWith('eslint-plugin-')) {
          const shortName = dep.replace('eslint-plugin-', '');
          if (content.includes(`"${shortName}"`) || content.includes(`'${shortName}'`)) {
            used.add(dep);
            continue;
          }
        }

        // ESLint config shorthand: eslint-config-prettier -> "prettier"
        if (dep.startsWith('eslint-config-')) {
          const shortName = dep.replace('eslint-config-', '');
          if (content.includes(`"${shortName}"`) || content.includes(`'${shortName}'`)) {
            used.add(dep);
            continue;
          }
        }

        // Babel preset shorthand: @babel/preset-env -> "@babel/env" or "env"
        if (dep.startsWith('@babel/preset-')) {
          const shortName = dep.replace('@babel/preset-', '@babel/');
          if (content.includes(`"${shortName}"`) || content.includes(`'${shortName}'`)) {
            used.add(dep);
            continue;
          }
        }
      }
    } catch {
      // Ignore read errors for individual config files
    }
  }

  return used;
}

/**
 * Checks if a package matches any item in the ignore list.
 */
function isIgnored(pkg: string, ignoreList: string[]): boolean {
  for (const item of ignoreList) {
    if (item === pkg) return true;
    if (item.endsWith('*') && pkg.startsWith(item.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Performs check for unused and missing dependencies.
 */
export async function checkUnusedDependencies(
  cwd: string,
  ignoreList: string[] = [],
): Promise<UnusedDepsResult> {
  const pkgJsonPath = path.join(cwd, 'package.json');
  let pkgJson: PackageJson;

  try {
    const raw = await fs.readFile(pkgJsonPath, 'utf-8');
    pkgJson = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to read package.json at ${pkgJsonPath}: ${err.message}`);
  }

  const declaredDeps = Object.keys(pkgJson.dependencies || {});
  const declaredDevDeps = Object.keys(pkgJson.devDependencies || {});
  const peerDeps = Object.keys(pkgJson.peerDependencies || {});
  const optionalDeps = Object.keys(pkgJson.optionalDependencies || {});

  const allDeclared = new Set([...declaredDeps, ...declaredDevDeps, ...peerDeps, ...optionalDeps]);

  // Find all project source files
  const files = await fg(SOURCE_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: true,
    dot: false,
  });

  const usedPackages = new Set<string>();

  // Process files in parallel
  const BATCH_SIZE = 50;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const code = await fs.readFile(file, 'utf-8');
          const pkgs = extractPackagesFromCode(code, file);
          for (const p of pkgs) {
            usedPackages.add(p);
          }
        } catch {
          // File reading error, continue
        }
      }),
    );
  }

  // 1. Tooling from scripts
  const scriptUsed = extractPackagesFromScripts(pkgJson.scripts, allDeclared);
  for (const p of scriptUsed) {
    usedPackages.add(p);
  }

  // 2. Tooling from config files and package.json keys
  const configUsed = await detectUsedToolingFromConfigs(cwd, allDeclared, pkgJson);
  for (const p of configUsed) {
    usedPackages.add(p);
  }

  // 3. Check binary files in node_modules/.bin matching package names
  try {
    const binDir = path.join(cwd, 'node_modules', '.bin');
    const bins = await fs.readdir(binDir).catch(() => [] as string[]);
    const scriptText = Object.values(pkgJson.scripts || {}).join(' ');
    for (const binName of bins) {
      if (scriptText.includes(binName)) {
        for (const dep of allDeclared) {
          if (dep === binName || dep.endsWith(`/${binName}`)) {
            usedPackages.add(dep);
          }
        }
      }
    }
  } catch {
    // node_modules/.bin might not exist, that is okay
  }

  // 4. Handle @types/* false-positives
  // If @types/foo is in devDeps, and 'foo' is used or declared, mark @types/foo as used
  for (const dep of declaredDevDeps) {
    if (dep.startsWith('@types/')) {
      const basePkg = dep.replace('@types/', '');
      const unescapedBase = basePkg.includes('__') ? `@${basePkg.replace('__', '/')}` : basePkg;

      if (
        usedPackages.has(unescapedBase) ||
        usedPackages.has(basePkg) ||
        allDeclared.has(unescapedBase) ||
        allDeclared.has(basePkg) ||
        unescapedBase === 'node'
      ) {
        usedPackages.add(dep);
      }
    }
  }

  // Unused dependencies
  const unusedDependencies = declaredDeps.filter((dep) => {
    if (isIgnored(dep, ignoreList)) return false;
    return !usedPackages.has(dep);
  });

  // Unused devDependencies
  const unusedDevDependencies = declaredDevDeps.filter((dep) => {
    if (isIgnored(dep, ignoreList)) return false;
    return !usedPackages.has(dep);
  });

  // Missing dependencies (used in code, but not declared in dependencies, devDependencies, etc.)
  const missingDependencies: string[] = [];
  for (const pkg of usedPackages) {
    if (isIgnored(pkg, ignoreList)) continue;
    if (!allDeclared.has(pkg)) {
      missingDependencies.push(pkg);
    }
  }
  missingDependencies.sort();

  return {
    unusedDependencies,
    unusedDevDependencies,
    missingDependencies,
    totalScannedFiles: files.length,
  };
}
