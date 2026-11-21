import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { resolveOptions } from './utils/config.js';
import { runAudit } from './runner.js';
import { formatTerminalReport } from './reporter/terminal.js';
import { formatJsonReport } from './reporter/json.js';
import { CliOptions } from './types.js';

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('repo-audit')
    .description(
      'Audit JavaScript/TypeScript repositories for unused dependencies, oversized packages, and duplicate versions.',
    )
    .version('1.0.0', '-v, --version', 'Output the current version')
    .option(
      '--only <checks>',
      'Comma-separated list of checks to run: unused, size, duplicates (default: all)',
    )
    .option('--json', 'Output report as machine-readable JSON')
    .option(
      '--threshold <size>',
      'Size threshold to flag oversized packages (e.g., 5mb, 500kb, 1000000)',
    )
    .option('--top <n>', 'Number of largest packages to report (default: 10)')
    .option('--ignore <packages>', 'Comma-separated list of packages to ignore in unused checks')
    .option('--cwd <path>', 'Target project directory (default: current working directory)')
    .option(
      '--fail-on <type>',
      'Exit with code 1 if issues found in category: unused, size, duplicates, any',
    )
    .option('--no-color', 'Disable colored output');

  program.parse(argv);
  const cliOpts: CliOptions = program.opts();

  let resolved;
  try {
    resolved = await resolveOptions(cliOpts);
  } catch (err: any) {
    console.error(pc.red(`Configuration error: ${err.message}`));
    process.exit(1);
  }

  const isInteractive = Boolean(process.stdout.isTTY && !resolved.json && resolved.color);
  const spinner = isInteractive
    ? ora({
        text: 'Auditing repository dependencies...',
        color: 'cyan',
      }).start()
    : null;

  try {
    const report = await runAudit(resolved);

    if (spinner) {
      spinner.stop();
    }

    if (resolved.json) {
      console.log(formatJsonReport(report));
    } else {
      console.log(formatTerminalReport(report, resolved));
    }

    if (report.summary.shouldFail) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    if (spinner) {
      spinner.stop();
    }

    if (resolved.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(pc.red(`\n✖ Audit error: ${err.message}\n`));
    }
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.env.NODE_ENV !== 'test') {
  runCli();
}
