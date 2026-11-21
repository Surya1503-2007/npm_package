import fs from 'node:fs/promises';
import path from 'node:path';
import { DuplicatePackageItem, DuplicatesResult } from '../types.js';
import { formatBytes } from './format.js';
import { getDirectorySize } from './disk-size.js';

interface LockfileV1Dependency {
  version: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, LockfileV1Dependency>;
}

interface LockfileV2V3Package {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface LockfileV2V3 {
  lockfileVersion?: number;
  packages?: Record<string, LockfileV2V3Package>;
  dependencies?: Record<string, LockfileV1Dependency>;
}

interface VersionOccurrence {
  version: string;
  dependent: string;
  locationPath?: string;
}

/**
 * Extracts the package name from a lockfile package path.
 * e.g. "node_modules/foo" -> "foo"
 * "node_modules/foo/node_modules/@scope/bar" -> "@scope/bar"
 */
export function getPackageNameFromPath(packagePath: string): string {
  const normalized = packagePath.replace(/\\/g, '/');
  const parts = normalized.split('node_modules/');
  const lastPart = parts[parts.length - 1] || '';
  return lastPart.trim();
}

/**
 * Extracts the parent package name from a nested lockfile path.
 * e.g. "node_modules/foo/node_modules/bar" -> "foo"
 * "node_modules/foo" -> "root"
 */
export function getParentFromPath(packagePath: string): string {
  const normalized = packagePath.replace(/\\/g, '/');
  const parts = normalized.split('/node_modules/');
  if (parts.length <= 1) {
    return 'root';
  }
  const parentSegment = parts[parts.length - 2];
  if (!parentSegment) return 'root';
  const subParts = parentSegment.split('node_modules/');
  return subParts[subParts.length - 1] || 'root';
}

/**
 * Parses lockfile v1 (npm 5/6) recursive dependencies tree.
 */
function parseV1Dependencies(
  deps: Record<string, LockfileV1Dependency>,
  parent: string,
  currentPath: string,
  map: Map<string, VersionOccurrence[]>,
): void {
  for (const [name, info] of Object.entries(deps)) {
    if (!info || !info.version) continue;

    const locPath = currentPath ? `${currentPath}/node_modules/${name}` : `node_modules/${name}`;
    const occurrences = map.get(name) || [];
    occurrences.push({
      version: info.version,
      dependent: parent,
      locationPath: locPath,
    });
    map.set(name, occurrences);

    if (info.dependencies) {
      parseV1Dependencies(info.dependencies, name, locPath, map);
    }
  }
}

/**
 * Parses lockfile v2/v3 (npm 7+) packages map.
 */
function parseV2V3Packages(
  packages: Record<string, LockfileV2V3Package>,
  map: Map<string, VersionOccurrence[]>,
): void {
  // Build a reverse dependency lookup map: childPkg -> Set of parent names
  const reverseDeps = new Map<string, Set<string>>();

  for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
    if (!pkgInfo) continue;
    const parentName = pkgPath === '' ? 'root' : getPackageNameFromPath(pkgPath);

    const allDeps = {
      ...pkgInfo.dependencies,
      ...pkgInfo.devDependencies,
      ...pkgInfo.peerDependencies,
      ...pkgInfo.optionalDependencies,
    };

    for (const depName of Object.keys(allDeps)) {
      if (!reverseDeps.has(depName)) {
        reverseDeps.set(depName, new Set());
      }
      reverseDeps.get(depName)!.add(parentName);
    }
  }

  for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
    // Skip the root project entry itself
    if (pkgPath === '' || !pkgInfo.version) continue;

    const name = getPackageNameFromPath(pkgPath);
    if (!name) continue;

    const pathParent = getParentFromPath(pkgPath);
    let dependent = pathParent;

    // If path is top-level (dependent === 'root'), check which package required it
    if (dependent === 'root') {
      const candidates = reverseDeps.get(name);
      if (candidates && candidates.size > 0) {
        // Exclude self if recursive
        const filtered = Array.from(candidates).filter((c) => c !== name);
        if (filtered.length > 0) {
          dependent = filtered.slice(0, 3).join(', ');
          if (filtered.length > 3) {
            dependent += ` +${filtered.length - 3} more`;
          }
        }
      }
    }

    const occurrences = map.get(name) || [];
    occurrences.push({
      version: pkgInfo.version,
      dependent,
      locationPath: pkgPath,
    });
    map.set(name, occurrences);
  }
}

/**
 * Parses package-lock.json (supporting v1, v2, and v3) and identifies duplicate packages.
 */
export async function parseLockfileDuplicates(
  lockfilePath: string,
  cwd: string,
): Promise<DuplicatesResult> {
  const content = await fs.readFile(lockfilePath, 'utf-8');
  let data: LockfileV2V3;

  try {
    data = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed to parse package-lock.json: ${err.message}`);
  }

  const occurrencesMap = new Map<string, VersionOccurrence[]>();

  if (data.packages && Object.keys(data.packages).length > 0) {
    parseV2V3Packages(data.packages, occurrencesMap);
  } else if (data.dependencies) {
    parseV1Dependencies(data.dependencies, 'root', '', occurrencesMap);
  }

  const duplicates: DuplicatePackageItem[] = [];
  let totalWastedBytes = 0;

  for (const [name, occurrences] of occurrencesMap.entries()) {
    // Group occurrences by version
    const versionMap = new Map<string, Set<string>>();
    const versionLocations = new Map<string, string[]>();

    for (const occ of occurrences) {
      if (!versionMap.has(occ.version)) {
        versionMap.set(occ.version, new Set());
      }
      versionMap.get(occ.version)!.add(occ.dependent);

      if (occ.locationPath) {
        const paths = versionLocations.get(occ.version) || [];
        paths.push(occ.locationPath);
        versionLocations.set(occ.version, paths);
      }
    }

    // Only packages with 2 or more distinct versions count as duplicates
    if (versionMap.size > 1) {
      const versionsList = Array.from(versionMap.entries()).map(([version, depsSet]) => ({
        version,
        dependents: Array.from(depsSet),
      }));

      // Calculate on-disk size for duplicate versions
      // Sort versions and measure disk size of each version's location
      const versionSizes: number[] = [];

      for (const [ver] of versionMap.entries()) {
        const locations = versionLocations.get(ver) || [];
        let verSize = 0;
        for (const loc of locations) {
          const absLoc = path.isAbsolute(loc) ? loc : path.join(cwd, loc);
          const s = await getDirectorySize(absLoc);
          if (s > 0) {
            verSize = s;
            break;
          }
        }

        // If not found at specific location, try standard node_modules/<name>
        if (verSize === 0) {
          const fallbackPath = path.join(cwd, 'node_modules', name);
          verSize = await getDirectorySize(fallbackPath);
        }

        versionSizes.push(verSize);
      }

      // Wasted size: all duplicate versions beyond the first one (or sum of sizes minus max single version)
      let pkgWastedBytes = 0;
      if (versionSizes.length > 1) {
        const maxSingleVersionSize = Math.max(...versionSizes);
        const totalSize = versionSizes.reduce((a, b) => a + b, 0);
        pkgWastedBytes = Math.max(0, totalSize - maxSingleVersionSize);
      }

      totalWastedBytes += pkgWastedBytes;

      duplicates.push({
        name,
        versions: versionsList,
        wastedBytes: pkgWastedBytes,
        formattedWastedSize: formatBytes(pkgWastedBytes),
      });
    }
  }

  // Sort duplicates by wasted bytes descending, then name ascending
  duplicates.sort((a, b) => b.wastedBytes - a.wastedBytes || a.name.localeCompare(b.name));

  return {
    duplicates,
    totalWastedBytes,
    formattedTotalWastedSize: formatBytes(totalWastedBytes),
    lockfileVersion: data.lockfileVersion,
  };
}
