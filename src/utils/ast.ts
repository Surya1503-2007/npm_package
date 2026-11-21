import { parse, ParserPlugin } from '@babel/parser';
import { builtinModules } from 'node:module';

// Set of all Node.js built-in modules
const BUILT_IN_MODULES = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  'node:test',
  'node:sqlite',
]);

const BABEL_PLUGINS: ParserPlugin[] = [
  'typescript',
  'jsx',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'exportDefaultFrom',
  'dynamicImport',
  'topLevelAwait',
  ['importAttributes', { deprecatedAssertSyntax: true }],
];

/**
 * Extracts the root package name from an import/require specifier.
 * Examples:
 * - 'lodash/get' -> 'lodash'
 * - '@babel/core/lib/index.js' -> '@babel/core'
 * - 'react' -> 'react'
 * - './utils' -> null (relative)
 * - 'node:fs' -> null (built-in)
 */
export function extractPackageName(specifier: string): string | null {
  if (!specifier || typeof specifier !== 'string') return null;

  const trimmed = specifier.trim().replace(/\\/g, '/');

  // Ignore relative imports, absolute paths, or common aliases
  if (
    trimmed.startsWith('.') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('~') ||
    trimmed.startsWith('@/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('$') ||
    trimmed.startsWith('http:') ||
    trimmed.startsWith('https:')
  ) {
    return null;
  }

  // Ignore Node.js built-ins with or without node: prefix
  if (trimmed.startsWith('node:') || BUILT_IN_MODULES.has(trimmed)) {
    return null;
  }

  // Handle scoped packages: @scope/pkg or @scope/pkg/sub/path
  if (trimmed.startsWith('@')) {
    const parts = trimmed.split('/');
    if (parts.length >= 2) {
      const scope = parts[0];
      const pkg = parts[1];
      if (scope && pkg) {
        return `${scope}/${pkg}`;
      }
    }
    return null;
  }

  // Handle normal packages: pkg or pkg/sub/path
  const parts = trimmed.split('/');
  return parts[0] || null;
}

/**
 * Extracts script contents from Vue SFC files (<script> and <script setup>).
 */
export function extractVueScripts(content: string): string[] {
  const scripts: string[] = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(content)) !== null) {
    if (match[1]) {
      scripts.push(match[1]);
    }
  }
  return scripts;
}

/**
 * Extracts script contents from Svelte files (<script> and <script context="module">).
 */
export function extractSvelteScripts(content: string): string[] {
  const scripts: string[] = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(content)) !== null) {
    if (match[1]) {
      scripts.push(match[1]);
    }
  }
  return scripts;
}

/**
 * Extracts package names referenced in CSS / SCSS / LESS files.
 */
export function extractPackagesFromCss(code: string): Set<string> {
  const packages = new Set<string>();
  if (!code || typeof code !== 'string') return packages;

  const importRegex = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?/gi;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(code)) !== null) {
    const pkg = extractPackageName(match[1]);
    if (pkg) packages.add(pkg);
  }

  if (/@(?:tailwind|apply|theme|config|plugin)\b/i.test(code)) {
    packages.add('tailwindcss');
  }

  return packages;
}

/**
 * Fallback regex to extract imports/requires if AST parsing fails.
 */
function extractWithRegex(code: string, result: Set<string>): void {
  // ESM: import ... from 'pkg' or export ... from 'pkg'
  const esmRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = esmRegex.exec(code)) !== null) {
    const pkg = extractPackageName(match[1]);
    if (pkg) result.add(pkg);
  }

  // Dynamic import('pkg') and require('pkg')
  const callRegex = /(?:import|require|require\.resolve)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = callRegex.exec(code)) !== null) {
    const pkg = extractPackageName(match[1]);
    if (pkg) result.add(pkg);
  }
}

/**
 * Lightweight recursive AST walker to extract module specifiers without extra dependencies.
 */
function walkAst(node: any, callback: (source: string) => void): void {
  if (!node || typeof node !== 'object') return;

  // import ... from '...'
  if (node.type === 'ImportDeclaration' && node.source?.value) {
    callback(node.source.value);
  }

  // export ... from '...'
  if (
    (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
    node.source?.value
  ) {
    callback(node.source.value);
  }

  // ImportExpression: import('...')
  if (node.type === 'ImportExpression' && node.source?.value) {
    callback(node.source.value);
  }

  // TS: import foo = require('...')
  if (
    node.type === 'TSImportEqualsDeclaration' &&
    node.moduleReference?.type === 'TSExternalModuleReference' &&
    node.moduleReference.expression?.value
  ) {
    callback(node.moduleReference.expression.value);
  }

  // require('...'), require.resolve('...'), or dynamic import()
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    const isRequire = callee?.type === 'Identifier' && callee.name === 'require';
    const isRequireResolve =
      callee?.type === 'MemberExpression' &&
      callee.object?.type === 'Identifier' &&
      callee.object.name === 'require' &&
      callee.property?.type === 'Identifier' &&
      callee.property.name === 'resolve';
    const isDynamicImport = callee?.type === 'Import';

    if (isRequire || isRequireResolve || isDynamicImport) {
      const firstArg = node.arguments?.[0];
      if (
        firstArg &&
        (firstArg.type === 'StringLiteral' || firstArg.type === 'Literal') &&
        typeof firstArg.value === 'string'
      ) {
        callback(firstArg.value);
      }
    }
  }

  // Recurse child nodes
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'comments') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        walkAst(item, callback);
      }
    } else if (child && typeof child === 'object' && typeof child.type === 'string') {
      walkAst(child, callback);
    }
  }
}

/**
 * Parses code and extracts all referenced package names.
 */
export function extractPackagesFromCode(code: string, filename?: string): Set<string> {
  const packages = new Set<string>();

  if (!code || typeof code !== 'string') return packages;

  // Pre-process CSS / SCSS / LESS
  if (filename && /\.(css|scss|sass|less)$/i.test(filename)) {
    return extractPackagesFromCss(code);
  }

  // Pre-process Vue or Svelte SFC files
  let codeFragments = [code];
  if (filename) {
    if (filename.endsWith('.vue')) {
      codeFragments = extractVueScripts(code);
      if (codeFragments.length === 0) return packages;
    } else if (filename.endsWith('.svelte')) {
      codeFragments = extractSvelteScripts(code);
      if (codeFragments.length === 0) return packages;
    }
  }

  for (const fragment of codeFragments) {
    try {
      const ast = parse(fragment, {
        sourceType: 'unambiguous',
        plugins: BABEL_PLUGINS,
        errorRecovery: true,
      });

      walkAst(ast, (specifier) => {
        const pkg = extractPackageName(specifier);
        if (pkg) {
          packages.add(pkg);
        }
      });
    } catch {
      // Fallback to regex if parsing fails (e.g. non-standard syntax)
      extractWithRegex(fragment, packages);
    }
  }

  return packages;
}
