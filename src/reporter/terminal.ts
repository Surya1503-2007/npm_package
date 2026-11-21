import pc from 'picocolors';
import { AuditReport, ResolvedOptions } from '../types.js';
import { formatBytes } from '../utils/format.js';

export function formatTerminalReport(report: AuditReport, options: ResolvedOptions): string {
  const c = pc.createColors(options.color);
  const lines: string[] = [];

  const divider = c.dim('─'.repeat(60));
  const sectionDivider = c.dim('┄'.repeat(60));

  // Header
  lines.push('');
  lines.push(`${c.bold(c.cyan('  REPO AUDIT REPORT'))} ${c.dim(`v1.0.0`)}`);
  lines.push(`  ${c.dim('Target:')} ${c.bold(report.cwd)}`);
  lines.push(divider);

  // Section 1: Unused & Missing Dependencies
  if (report.checks.unused) {
    const { unusedDependencies, unusedDevDependencies, missingDependencies, totalScannedFiles } =
      report.checks.unused;

    lines.push('');
    lines.push(
      `  ${c.bold('📦 DEPENDENCY USAGE')} ${c.dim(`(${totalScannedFiles} files scanned)`)}`,
    );
    lines.push(sectionDivider);

    const hasIssues =
      unusedDependencies.length > 0 ||
      unusedDevDependencies.length > 0 ||
      missingDependencies.length > 0;

    if (!hasIssues) {
      lines.push(
        `  ${c.green('✔')} ${c.green('All declared dependencies are in use and none are missing.')}`,
      );
    } else {
      if (unusedDependencies.length > 0) {
        lines.push(`  ${c.yellow(c.bold(`Unused dependencies (${unusedDependencies.length}):`))}`);
        for (const dep of unusedDependencies) {
          lines.push(`    ${c.red('✖')} ${c.bold(dep)} ${c.dim('(declared in dependencies)')}`);
        }
      }

      if (unusedDevDependencies.length > 0) {
        if (unusedDependencies.length > 0) lines.push('');
        lines.push(
          `  ${c.yellow(c.bold(`Unused devDependencies (${unusedDevDependencies.length}):`))}`,
        );
        for (const dep of unusedDevDependencies) {
          lines.push(`    ${c.yellow('!')} ${dep} ${c.dim('(declared in devDependencies)')}`);
        }
      }

      if (missingDependencies.length > 0) {
        if (unusedDependencies.length > 0 || unusedDevDependencies.length > 0) lines.push('');
        lines.push(`  ${c.red(c.bold(`Missing dependencies (${missingDependencies.length}):`))}`);
        for (const dep of missingDependencies) {
          lines.push(
            `    ${c.red('?')} ${c.bold(dep)} ${c.dim('→ imported in code but not in package.json')}`,
          );
        }
      }
    }
  }

  // Section 2: Oversized Packages & Alternatives
  if (report.checks.size) {
    const { packages, thresholdBytes, thresholdExceededCount, totalDirectDependencies } =
      report.checks.size;

    lines.push('');
    lines.push(
      `  ${c.bold('⚖️  OVERSIZED PACKAGES')} ${c.dim(`(Top ${packages.length} of ${totalDirectDependencies} direct dependencies)`)}`,
    );
    lines.push(sectionDivider);

    if (packages.length === 0) {
      lines.push(
        `  ${c.dim('No direct dependency sizes available (node_modules may be missing).')}`,
      );
    } else {
      if (thresholdBytes > 0) {
        const thresholdLabel = formatBytes(thresholdBytes);
        if (thresholdExceededCount > 0) {
          lines.push(
            `  ${c.yellow(`⚠️  Threshold: ${thresholdLabel} (${thresholdExceededCount} exceeded)`)}`,
          );
        } else {
          lines.push(`  ${c.green(`✔ All packages are below the ${thresholdLabel} threshold.`)}`);
        }
        lines.push('');
      }

      // Find max name length for alignment
      const maxNameLen = Math.max(...packages.map((p) => p.name.length), 10);
      const maxSizeLen = Math.max(...packages.map((p) => p.formattedSize.length), 6);

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i]!;
        const rank = c.dim(`${(i + 1).toString().padStart(2, ' ')}.`);
        const namePadded = pkg.name.padEnd(maxNameLen + 2, ' ');
        const sizePadded = pkg.formattedSize.padStart(maxSizeLen, ' ');

        const sizeFormatted = pkg.exceedsThreshold ? c.bold(c.red(sizePadded)) : c.cyan(sizePadded);

        const typeBadge = pkg.isDev ? c.dim('[dev]') : c.dim('[prod]');
        const thresholdBadge = pkg.exceedsThreshold ? c.bold(c.red(' (EXCEEDS THRESHOLD)')) : '';

        lines.push(
          `  ${rank} ${c.bold(namePadded)} ${sizeFormatted}  ${typeBadge}${thresholdBadge}`,
        );
      }

      // Lighter alternatives suggestions
      const packagesWithSuggestions = packages.filter((p) => p.suggestion);
      if (packagesWithSuggestions.length > 0) {
        lines.push('');
        lines.push(`  ${c.bold(c.cyan('💡 Lighter Alternatives Suggestions:'))}`);
        for (const pkg of packagesWithSuggestions) {
          const sug = pkg.suggestion!;
          lines.push(
            `    • ${c.bold(pkg.name)} ${c.dim(`(${pkg.formattedSize})`)}: ${c.dim(sug.reason)}`,
          );
          lines.push(`      ${c.green('Suggested:')} ${sug.alternatives.join(' or ')}`);
        }
      }
    }
  }

  // Section 3: Duplicate Versions
  if (report.checks.duplicates) {
    const { duplicates, totalWastedBytes, formattedTotalWastedSize, lockfileVersion } =
      report.checks.duplicates;

    lines.push('');
    const lockfileInfo = lockfileVersion ? `(lockfile v${lockfileVersion})` : '';
    lines.push(`  ${c.bold('🧬 DUPLICATE VERSIONS')} ${c.dim(lockfileInfo)}`);
    lines.push(sectionDivider);

    if (duplicates.length === 0) {
      lines.push(`  ${c.green('✔')} ${c.green('No duplicate package versions detected.')}`);
    } else {
      lines.push(
        `  ${c.yellow(`Found ${c.bold(duplicates.length.toString())} package(s) with multiple installed versions.`)}`,
      );
      if (totalWastedBytes > 0) {
        lines.push(
          `  ${c.dim('Estimated wasted disk space:')} ${c.bold(c.yellow(formattedTotalWastedSize))}`,
        );
      }
      lines.push('');

      for (const item of duplicates) {
        const wastedText =
          item.wastedBytes > 0 ? c.dim(`(~${item.formattedWastedSize} wasted)`) : '';
        lines.push(`  ${c.bold(c.magenta(item.name))} ${wastedText}`);

        item.versions.forEach((verInfo, vIdx) => {
          const isLast = vIdx === item.versions.length - 1;
          const branch = isLast ? '└─' : '├─';
          const dependents = verInfo.dependents.join(', ');
          lines.push(
            `    ${c.dim(branch)} ${c.cyan(verInfo.version)} ${c.dim(`(required by: ${dependents})`)}`,
          );
        });
      }
    }
  }

  // Errors / Warnings
  if (report.errors.length > 0) {
    lines.push('');
    lines.push(`  ${c.bold(c.yellow('⚠️  NOTICES'))}`);
    lines.push(sectionDivider);
    for (const err of report.errors) {
      lines.push(`  ${c.yellow('!')} ${err}`);
    }
  }

  // Summary box
  lines.push('');
  lines.push(divider);
  lines.push(`  ${c.bold('SUMMARY')}`);
  lines.push(divider);

  const durationSec = (report.durationMs / 1000).toFixed(2);
  lines.push(`  ${c.dim('Scan Duration:')}    ${durationSec}s`);
  lines.push(
    `  ${c.dim('Unused Deps:')}      ${report.summary.unusedCount > 0 ? c.yellow(report.summary.unusedCount.toString()) : c.green('0')}`,
  );
  lines.push(
    `  ${c.dim('Missing Deps:')}     ${report.summary.missingCount > 0 ? c.red(report.summary.missingCount.toString()) : c.green('0')}`,
  );
  lines.push(
    `  ${c.dim('Oversized Items:')}  ${report.summary.oversizedCount > 0 ? c.red(report.summary.oversizedCount.toString()) : c.green('0')}`,
  );
  lines.push(
    `  ${c.dim('Duplicate Pkgs:')}   ${report.summary.duplicateCount > 0 ? c.yellow(report.summary.duplicateCount.toString()) : c.green('0')}`,
  );
  lines.push(
    `  ${c.dim('Total Issues:')}     ${report.summary.totalIssues > 0 ? c.bold(c.yellow(report.summary.totalIssues.toString())) : c.bold(c.green('0'))}`,
  );

  if (report.summary.shouldFail) {
    lines.push('');
    lines.push(
      `  ${c.bold(c.red('FAILED'))}: Audit policy triggered exit code 1 (--fail-on ${options.failOn}).`,
    );
  } else {
    lines.push('');
    lines.push(`  ${c.bold(c.green('PASSED'))}: Audit completed successfully.`);
  }

  lines.push(divider);
  lines.push('');

  return lines.join('\n');
}
