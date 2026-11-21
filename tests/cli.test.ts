import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from '../src/runner.js';
import { resolveOptions } from '../src/utils/config.js';
import { formatTerminalReport } from '../src/reporter/terminal.js';
import { formatJsonReport } from '../src/reporter/json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI & Audit Runner Integration', () => {
  it('runs all checks on false-positives fixture and reports 0 issues', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'false-positives');
    const options = await resolveOptions({
      cwd: fixtureDir,
      only: 'unused', // focus on unused check
    });

    const report = await runAudit(options);

    expect(report.summary.totalIssues).toBe(0);
    expect(report.summary.unusedCount).toBe(0);
    expect(report.summary.missingCount).toBe(0);
    expect(report.summary.shouldFail).toBe(false);

    const terminalOutput = formatTerminalReport(report, options);
    expect(terminalOutput).toContain('All declared dependencies are in use');
    expect(terminalOutput).toContain('PASSED');
  });

  it('runs audit on unused-deps fixture and detects issues', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'unused-deps');
    const options = await resolveOptions({
      cwd: fixtureDir,
      only: 'unused',
      failOn: 'unused',
    });

    const report = await runAudit(options);

    expect(report.summary.unusedCount).toBeGreaterThan(0);
    expect(report.summary.missingCount).toBeGreaterThan(0);
    expect(report.summary.shouldFail).toBe(true);

    const jsonOutput = formatJsonReport(report);
    const parsedJson = JSON.parse(jsonOutput);
    expect(parsedJson.summary.unusedCount).toBeGreaterThan(0);
    expect(parsedJson.checks.unused.unusedDependencies).toContain('unused-prod-pkg');
  });

  it('evaluates fail-on policy correctly', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'unused-deps');

    // fail-on duplicates should NOT fail here because only unused deps are present
    const options1 = await resolveOptions({
      cwd: fixtureDir,
      only: 'unused',
      failOn: 'duplicates',
    });
    const report1 = await runAudit(options1);
    expect(report1.summary.shouldFail).toBe(false);

    // fail-on any SHOULD fail
    const options2 = await resolveOptions({
      cwd: fixtureDir,
      only: 'unused',
      failOn: 'any',
    });
    const report2 = await runAudit(options2);
    expect(report2.summary.shouldFail).toBe(true);
  });

  it('handles missing package.json gracefully with clean error', async () => {
    const nonExistentDir = path.join(__dirname, 'fixtures', 'does-not-exist');
    const options = await resolveOptions({
      cwd: nonExistentDir,
    });

    await expect(runAudit(options)).rejects.toThrow(/No package\.json found/);
  });
});
