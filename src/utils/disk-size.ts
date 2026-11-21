import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Calculates total size in bytes of a file or directory recursively.
 * Handles symlinks (common in pnpm / monorepos) and tracks visited realpaths to prevent cycles.
 */
export async function getDirectorySize(
  dirPath: string,
  visited: Set<string> = new Set(),
): Promise<number> {
  let totalBytes = 0;

  try {
    const realPath = await fs.realpath(dirPath);
    if (visited.has(realPath)) {
      return 0;
    }
    visited.add(realPath);

    const stat = await fs.stat(realPath);
    if (!stat.isDirectory()) {
      return stat.size;
    }

    const entries = await fs.readdir(realPath, { withFileTypes: true });

    const promises = entries.map(async (entry) => {
      const fullPath = path.join(realPath, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const symTarget = await fs.realpath(fullPath);
          if (visited.has(symTarget)) return 0;
          const targetStat = await fs.stat(symTarget);
          if (targetStat.isDirectory()) {
            return await getDirectorySize(symTarget, visited);
          } else if (targetStat.isFile()) {
            return targetStat.size;
          }
        } catch {
          return 0;
        }
        return 0;
      }

      if (entry.isDirectory()) {
        return await getDirectorySize(fullPath, visited);
      } else if (entry.isFile()) {
        try {
          const fileStat = await fs.stat(fullPath);
          return fileStat.size;
        } catch {
          return 0;
        }
      }
      return 0;
    });

    const sizes = await Promise.all(promises);
    totalBytes = sizes.reduce((acc, curr) => acc + curr, 0);
  } catch {
    return totalBytes;
  }

  return totalBytes;
}

/**
 * Resolves the directory path of a package in node_modules.
 */
export function getPackageNodeModulesPath(cwd: string, packageName: string): string {
  if (packageName.startsWith('@')) {
    const parts = packageName.split('/');
    if (parts.length >= 2) {
      return path.join(cwd, 'node_modules', parts[0], parts[1]);
    }
  }
  return path.join(cwd, 'node_modules', packageName);
}

/**
 * Gets on-disk size in bytes for an installed dependency in node_modules.
 */
export async function getPackageDiskSize(cwd: string, packageName: string): Promise<number> {
  const pkgDir = getPackageNodeModulesPath(cwd, packageName);
  return await getDirectorySize(pkgDir);
}
