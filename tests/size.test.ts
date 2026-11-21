import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackageSizes } from '../src/checks/size.js';
import { getAlternativeSuggestion } from '../src/utils/alternatives.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Oversized Packages Check', () => {
  const fixtureDir = path.join(__dirname, 'fixtures', 'size-check');

  it('measures dependency sizes and orders them descending', async () => {
    const result = await checkPackageSizes(fixtureDir, 10, 0);

    expect(result.packages.length).toBe(2);
    expect(result.totalDirectDependencies).toBe(2);

    // moment file is larger than tiny-pkg
    expect(result.packages[0]?.name).toBe('moment');
    expect(result.packages[1]?.name).toBe('tiny-pkg');
    expect(result.packages[0]!.sizeBytes).toBeGreaterThanOrEqual(result.packages[1]!.sizeBytes);
  });

  it('respects top count limit', async () => {
    const result = await checkPackageSizes(fixtureDir, 1, 0);
    expect(result.packages.length).toBe(1);
    expect(result.packages[0]?.name).toBe('moment');
  });

  it('flags packages exceeding threshold', async () => {
    // Setting 10 bytes threshold should flag moment
    const result = await checkPackageSizes(fixtureDir, 10, 10);
    expect(result.thresholdExceededCount).toBeGreaterThan(0);
    expect(result.packages.find((p) => p.name === 'moment')?.exceedsThreshold).toBe(true);
  });

  it('does not flag packages when under threshold', async () => {
    // 50 MB threshold
    const result = await checkPackageSizes(fixtureDir, 10, 50 * 1024 * 1024);
    expect(result.thresholdExceededCount).toBe(0);
    expect(result.packages.every((p) => !p.exceedsThreshold)).toBe(true);
  });

  it('suggests lighter alternatives for known heavy packages', async () => {
    const result = await checkPackageSizes(fixtureDir, 10, 0);
    const momentPkg = result.packages.find((p) => p.name === 'moment');

    expect(momentPkg?.suggestion).toBeDefined();
    expect(momentPkg?.suggestion?.alternatives.some((alt) => alt.includes('dayjs'))).toBe(true);

    const lodashSuggestion = getAlternativeSuggestion('lodash');
    expect(lodashSuggestion).toBeDefined();
    expect(lodashSuggestion?.alternatives.some((alt) => alt.includes('lodash-es'))).toBe(true);
  });

  it('handles missing node_modules gracefully', async () => {
    const missingNodeModulesDir = path.join(__dirname, 'fixtures', 'unused-deps');
    const result = await checkPackageSizes(missingNodeModulesDir);

    expect(result.packages).toEqual([]);
    expect(result.thresholdExceededCount).toBe(0);
  });
});
