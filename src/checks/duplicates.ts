import fs from 'node:fs/promises';
import path from 'node:path';
import { DuplicatesResult } from '../types.js';
import { parseLockfileDuplicates } from '../utils/lockfile.js';

/**
 * Checks for packages with multiple versions installed across the dependency tree.
 */
export async function checkDuplicates(cwd: string): Promise<DuplicatesResult> {
  const lockfilePath = path.join(cwd, 'package-lock.json');

  try {
    await fs.access(lockfilePath);
  } catch {
    // Check if other lockfiles exist to provide intelligent guidance
    const files = await fs.readdir(cwd).catch(() => [] as string[]);
    if (files.includes('pnpm-lock.yaml')) {
      throw new Error(
        `package-lock.json not found in "${cwd}". Detected "pnpm-lock.yaml". Duplicate analysis currently requires an npm lockfile. Run "npm install --package-lock-only" to generate one without altering your node_modules.`,
      );
    }
    if (files.includes('yarn.lock')) {
      throw new Error(
        `package-lock.json not found in "${cwd}". Detected "yarn.lock". Duplicate analysis currently requires an npm lockfile. Run "npm install --package-lock-only" to generate one.`,
      );
    }
    if (files.includes('bun.lockb') || files.includes('bun.lock')) {
      throw new Error(
        `package-lock.json not found in "${cwd}". Detected Bun lockfile. Duplicate analysis currently requires an npm lockfile. Run "npm install --package-lock-only" to generate one.`,
      );
    }

    throw new Error(
      `package-lock.json not found in "${cwd}". Duplicate version analysis requires an npm lockfile. Run "npm install" to generate one.`,
    );
  }

  return await parseLockfileDuplicates(lockfilePath, cwd);
}
