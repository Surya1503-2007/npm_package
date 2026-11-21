# @surya1503/repo-audit

[![CI](https://github.com/Surya1503-2007/npm_package/actions/workflows/ci.yml/badge.svg)](https://github.com/Surya1503-2007/npm_package/actions)
[![npm version](https://img.shields.io/npm/v/@surya1503/repo-audit.svg)](https://www.npmjs.com/package/@surya1503/repo-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A fast, zero-configuration dependency auditor for JavaScript and TypeScript projects. It detects unused or missing dependencies, uncovers oversized packages with lighter replacement suggestions, and highlights duplicate versions across your lockfile with estimated wasted disk space.

---

## Features

- 🔍 **Unused & Missing Dependencies**:
  - Parses `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.vue`, and `.svelte` files using `@babel/parser` AST traversal.
  - Automatically avoids false positives:
    - `@types/*` packages whose base packages are used
    - Binaries and tools referenced in `package.json` scripts (`vitest`, `tsup`, `prettier`, etc.)
    - Tooling declared in root configuration files (ESLint, Prettier, TypeScript, Tailwind, PostCSS, Vite, etc.)
  - Reports undeclared "missing" packages imported in code.
- ⚖️ **Oversized Packages**:
  - Scans `node_modules` to compute real on-disk directory sizes for all direct dependencies.
  - Lists top packages by disk weight.
  - Provides instant lighter alternative suggestions (e.g. `moment` → `dayjs` / `date-fns`, `lodash` → `lodash-es` or native methods).
  - Enforces size budgets with `--threshold` (e.g. `--threshold 5mb`).
- 🧬 **Duplicate Package Versions**:
  - Supports `package-lock.json` versions **1**, **2**, and **3**.
  - Identifies packages present in multiple versions throughout your dependency tree.
  - Displays dependency paths explaining which parent package introduced each version.
  - Calculates estimated wasted disk footprint.
- 🚦 **CI & Monorepo Ready**:
  - Exit code 1 support via `--fail-on <unused|size|duplicates|any>` for automated pipelines.
  - `--cwd <path>` flag to inspect any workspace or sub-package directory.
  - `--json` mode for automated workflows and machine processing.

---

## Installation

### Run instantly with npx (recommended)

```bash
npx @surya1503/repo-audit
```

### Install globally

```bash
npm install -g @surya1503/repo-audit
repo-audit
```

### Install locally in a project

```bash
npm install --save-dev @surya1503/repo-audit
```

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "audit:deps": "repo-audit",
    "audit:ci": "repo-audit --fail-on any"
  }
}
```

---

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--only <checks>` | Comma-separated list of checks to run (`unused`, `size`, `duplicates`) | `unused,size,duplicates` |
| `--threshold <size>` | Size threshold to flag oversized packages (e.g. `5mb`, `500kb`, `1000000`) | `0` (disabled) |
| `--top <n>` | Number of largest packages to show in size analysis | `10` |
| `--ignore <packages>` | Comma-separated package names or prefixes to ignore | `[]` |
| `--fail-on <type>` | Exit with code 1 if issues found (`unused`, `size`, `duplicates`, `any`) | `none` |
| `--cwd <path>` | Target repository directory to audit | `process.cwd()` |
| `--json` | Output machine-readable JSON format | `false` |
| `--no-color` | Disable ANSI terminal colors | `false` |
| `-v, --version` | Output version number | |
| `-h, --help` | Display command help | |

---

## Usage Examples

### Run all checks on the current repository

```bash
npx repo-audit
```

### Check only for unused dependencies, ignoring specific packages

```bash
npx repo-audit --only unused --ignore "my-plugin,custom-pkg-*"
```

### Enforce a 5 MB package budget in CI

```bash
npx repo-audit --only size --threshold 5mb --fail-on size
```

### Inspect duplicate versions in a monorepo package

```bash
npx repo-audit --cwd packages/web-app --only duplicates
```

### Output JSON report for automated processing

```bash
npx repo-audit --json > audit-report.json
```

---

## Configuration File

You can configure `repo-audit` using a `.repoauditrc.json` file in your project root or via the `"repo-audit"` key in `package.json`:

```json
{
  "only": ["unused", "size", "duplicates"],
  "threshold": "5mb",
  "top": 10,
  "ignore": ["@types/node", "ts-node"],
  "failOn": "unused"
}
```

---

## Programmatic API

`repo-audit` also exports a complete TypeScript / JavaScript API:

```ts
import { runAudit, resolveOptions } from 'repo-audit';

const options = await resolveOptions({
  cwd: process.cwd(),
  threshold: '5mb',
  failOn: 'unused',
});

const report = await runAudit(options);

console.log(`Total issues: ${report.summary.totalIssues}`);
if (report.checks.unused) {
  console.log('Unused deps:', report.checks.unused.unusedDependencies);
}
```

---

## How It Works

1. **Unused Dependencies Check**:
   - `repo-audit` scans your project source files matching `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.vue`, and `.svelte`.
   - Uses `@babel/parser` to traverse Abstract Syntax Trees (ASTs), extracting imports (`import ...`, `import(...)`), CommonJS `require(...)`, `require.resolve(...)`, and `export ... from`.
   - Extracts binaries used in `package.json` `"scripts"`.
   - Inspects project configuration files (`tsconfig.json`, `eslint.config.*`, `.prettierrc`, `vite.config.*`, etc.) to recognize declared build tools and plugins.
   - Evaluates `@types/*` packages, preventing false flags when the underlying package or runtime is present.

2. **Oversized Packages Check**:
   - Recursively measures directory sizes within `node_modules` for every direct production and development dependency.
   - Compares measured sizes against built-in thresholds and an alternatives database to suggest modern, lightweight libraries.

3. **Duplicate Versions Check**:
   - Reads `package-lock.json` across formats `v1`, `v2`, and `v3`.
   - Maps each occurrence of a library to its installed version and dependent parent.
   - Calculates the storage wasted by multiple versions of identical packages.

---

## Limitations

- **Dynamic Specifiers**: Dynamic string template imports with computed runtime variables (e.g. `import('./locales/' + lang)`) cannot be statically resolved to package names.
- **npm Lockfile Requirement**: Duplicate version detection currently requires an npm lockfile (`package-lock.json`). If using pnpm or yarn, ensure an npm-compatible lockfile is generated or use the `--only unused,size` flag.
- **Pre-installed node_modules**: Package size measurement inspects physical files on disk; run `npm install` before running size analysis.

---

## License

[MIT](LICENSE) © Surya
