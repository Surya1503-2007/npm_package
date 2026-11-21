import fs from 'node:fs/promises';
import path from 'node:path';
import { PackageSizeItem, PackageSizeResult } from '../types.js';
import { getPackageDiskSize } from '../utils/disk-size.js';
import { formatBytes } from '../utils/format.js';
import { getAlternativeSuggestion } from '../utils/alternatives.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Checks on-disk sizes of direct dependencies and suggests lighter alternatives.
 */
export async function checkPackageSizes(
  cwd: string,
  topCount = 10,
  thresholdBytes = 0,
): Promise<PackageSizeResult> {
  const pkgJsonPath = path.join(cwd, 'package.json');
  let pkgJson: PackageJson;

  try {
    const raw = await fs.readFile(pkgJsonPath, 'utf-8');
    pkgJson = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to read package.json at ${pkgJsonPath}: ${err.message}`);
  }

  const prodDeps = Object.keys(pkgJson.dependencies || {});
  const devDeps = Object.keys(pkgJson.devDependencies || {});
  const directDeps = [
    ...prodDeps.map((name) => ({ name, isDev: false })),
    ...devDeps.map((name) => ({ name, isDev: true })),
  ];

  const nodeModulesPath = path.join(cwd, 'node_modules');
  let nodeModulesExists = false;
  try {
    const stat = await fs.stat(nodeModulesPath);
    nodeModulesExists = stat.isDirectory();
  } catch {
    nodeModulesExists = false;
  }

  if (!nodeModulesExists) {
    return {
      packages: [],
      thresholdBytes,
      thresholdExceededCount: 0,
      totalDirectDependencies: directDeps.length,
    };
  }

  // Measure size of each package in parallel
  const packageItems: PackageSizeItem[] = await Promise.all(
    directDeps.map(async ({ name, isDev }) => {
      const sizeBytes = await getPackageDiskSize(cwd, name);
      const formattedSize = formatBytes(sizeBytes);
      const exceedsThreshold = thresholdBytes > 0 && sizeBytes > thresholdBytes;
      const suggestion = getAlternativeSuggestion(name);

      return {
        name,
        sizeBytes,
        formattedSize,
        exceedsThreshold,
        isDev,
        suggestion,
      };
    }),
  );

  // Sort descending by size
  packageItems.sort((a, b) => b.sizeBytes - a.sizeBytes);

  const thresholdExceededCount = packageItems.filter((p) => p.exceedsThreshold).length;
  const topPackages = packageItems.slice(0, topCount);

  return {
    packages: topPackages,
    thresholdBytes,
    thresholdExceededCount,
    totalDirectDependencies: directDeps.length,
  };
}
