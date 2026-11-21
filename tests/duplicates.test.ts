import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDuplicates } from '../src/checks/duplicates.js';
import { parseLockfileDuplicates } from '../src/utils/lockfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Duplicate Versions Check', () => {
  it('detects duplicates in lockfileVersion 1', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'duplicate-versions-v1');
    const result = await checkDuplicates(fixtureDir);

    expect(result.duplicates.length).toBe(1);
    const duplicate = result.duplicates[0]!;
    expect(duplicate.name).toBe('shared-lib');
    expect(duplicate.versions.length).toBe(2);

    const versions = duplicate.versions.map((v) => v.version);
    expect(versions).toContain('1.0.0');
    expect(versions).toContain('2.0.0');

    // Dependents should show parent-a and parent-b
    const allDependents = duplicate.versions.flatMap((v) => v.dependents);
    expect(allDependents).toContain('parent-a');
    expect(allDependents).toContain('parent-b');
  });

  it('detects duplicates in lockfileVersion 2', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'duplicate-versions-v2');
    const result = await checkDuplicates(fixtureDir);

    expect(result.duplicates.length).toBe(1);
    const duplicate = result.duplicates[0]!;
    expect(duplicate.name).toBe('common-dep');
    expect(duplicate.versions.length).toBe(2);

    const versions = duplicate.versions.map((v) => v.version);
    expect(versions).toContain('1.5.0');
    expect(versions).toContain('2.1.0');
  });

  it('detects duplicates in lockfileVersion 3 including scoped packages', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'duplicate-versions-v3');
    const result = await checkDuplicates(fixtureDir);

    expect(result.duplicates.length).toBe(2); // @scope/nested and semver

    const scopedDup = result.duplicates.find((d) => d.name === '@scope/nested');
    expect(scopedDup).toBeDefined();
    expect(scopedDup?.versions.length).toBe(2);
    expect(scopedDup?.versions.map((v) => v.version)).toContain('1.0.0');
    expect(scopedDup?.versions.map((v) => v.version)).toContain('2.0.0');

    const semverDup = result.duplicates.find((d) => d.name === 'semver');
    expect(semverDup).toBeDefined();
    expect(semverDup?.versions.length).toBe(2);
    expect(semverDup?.versions.map((v) => v.version)).toContain('7.3.5');
    expect(semverDup?.versions.map((v) => v.version)).toContain('7.5.4');
  });

  it('throws a helpful message when package-lock.json is missing', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'unused-deps');
    await expect(checkDuplicates(fixtureDir)).rejects.toThrow(/package-lock\.json not found/);
  });

  it('provides specific instructions when pnpm or yarn lockfiles are detected', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'pnpm-detected');
    await expect(checkDuplicates(fixtureDir)).rejects.toThrow(/Detected "pnpm-lock.yaml"/);
  });
});
