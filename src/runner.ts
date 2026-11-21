import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditReport, ResolvedOptions } from './types.js';
import { checkUnusedDependencies } from './checks/unused.js';
import { checkPackageSizes } from './checks/size.js';
import { checkDuplicates } from './checks/duplicates.js';

export async function runAudit(options: ResolvedOptions): Promise<AuditReport> {
  const startTime = Date.now();
  const pkgJsonPath = path.join(options.cwd, 'package.json');

  try {
    await fs.access(pkgJsonPath);
  } catch {
    throw new Error(
      `No package.json found in "${options.cwd}". Are you in the root of a Node.js project?`,
    );
  }

  const errors: string[] = [];
  const checksReport: AuditReport['checks'] = {};

  // Check 1: Unused & Missing dependencies
  if (options.checks.includes('unused')) {
    try {
      checksReport.unused = await checkUnusedDependencies(options.cwd, options.ignore);
    } catch (err: any) {
      errors.push(`Unused dependencies check failed: ${err.message}`);
    }
  }

  // Check 2: Oversized packages
  if (options.checks.includes('size')) {
    try {
      checksReport.size = await checkPackageSizes(options.cwd, options.top, options.thresholdBytes);
    } catch (err: any) {
      errors.push(`Oversized packages check failed: ${err.message}`);
    }
  }

  // Check 3: Duplicate versions
  if (options.checks.includes('duplicates')) {
    try {
      checksReport.duplicates = await checkDuplicates(options.cwd);
    } catch (err: any) {
      errors.push(`Duplicate versions check: ${err.message}`);
    }
  }

  const unusedCount =
    (checksReport.unused?.unusedDependencies.length || 0) +
    (checksReport.unused?.unusedDevDependencies.length || 0);
  const missingCount = checksReport.unused?.missingDependencies.length || 0;
  const oversizedCount = checksReport.size?.thresholdExceededCount || 0;
  const duplicateCount = checksReport.duplicates?.duplicates.length || 0;

  const totalIssues = unusedCount + missingCount + oversizedCount + duplicateCount;

  let shouldFail = false;
  switch (options.failOn) {
    case 'any':
      shouldFail = totalIssues > 0 || errors.length > 0;
      break;
    case 'unused':
      shouldFail = unusedCount + missingCount > 0;
      break;
    case 'size':
      shouldFail = oversizedCount > 0;
      break;
    case 'duplicates':
      shouldFail = duplicateCount > 0 || errors.some((e) => e.toLowerCase().includes('duplicate'));
      break;
    default:
      shouldFail = false;
  }

  const durationMs = Date.now() - startTime;

  return {
    timestamp: new Date().toISOString(),
    cwd: options.cwd,
    durationMs,
    checks: checksReport,
    summary: {
      totalIssues,
      unusedCount,
      missingCount,
      oversizedCount,
      duplicateCount,
      shouldFail,
    },
    errors,
  };
}
