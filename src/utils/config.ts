import fs from 'node:fs/promises';
import path from 'node:path';
import { CheckType, CliOptions, FailOnType, RepoAuditConfig, ResolvedOptions } from '../types.js';
import { parseSize } from './format.js';

const CONFIG_FILES = ['.repoauditrc.json', '.repoauditrc'];
const VALID_CHECKS: CheckType[] = ['unused', 'size', 'duplicates'];
const VALID_FAIL_ON: FailOnType[] = ['unused', 'size', 'duplicates', 'any', 'none'];

/**
 * Loads configuration from .repoauditrc.json, .repoauditrc, or package.json "repo-audit" key.
 */
export async function loadConfigFile(cwd: string): Promise<RepoAuditConfig> {
  // Try dedicated config files first
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(cwd, filename);
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Failed to parse configuration file ${filename}: ${err.message}`);
      }
    }
  }

  // Next, try "repo-audit" key in package.json
  const pkgJsonPath = path.join(cwd, 'package.json');
  try {
    const content = await fs.readFile(pkgJsonPath, 'utf-8');
    const pkgJson = JSON.parse(content);
    if (pkgJson['repo-audit']) {
      return pkgJson['repo-audit'];
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      // ignore or throw only if strictly syntax error
    }
  }

  return {};
}

/**
 * Resolves full options by merging CLI arguments over config file settings.
 */
export async function resolveOptions(cliOpts: CliOptions = {}): Promise<ResolvedOptions> {
  const cwd = path.resolve(cliOpts.cwd || process.cwd());
  const config = await loadConfigFile(cwd);

  // Determine checks to run
  let checks: CheckType[] = ['unused', 'size', 'duplicates'];
  const rawOnly = cliOpts.only || (config.only ? config.only.join(',') : undefined);
  if (rawOnly) {
    const tokens = rawOnly
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const invalid = tokens.filter((t) => !VALID_CHECKS.includes(t as CheckType));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid check name(s): "${invalid.join(', ')}". Allowed checks are: ${VALID_CHECKS.join(', ')}`,
      );
    }
    checks = tokens as CheckType[];
  }

  // Threshold
  const rawThreshold = cliOpts.threshold ?? config.threshold;
  const thresholdBytes = rawThreshold ? parseSize(rawThreshold) : 0;

  // Top packages count
  const rawTop = cliOpts.top ?? config.top;
  let top = 10;
  if (rawTop !== undefined && rawTop !== null) {
    const parsedTop = parseInt(String(rawTop), 10);
    top = isNaN(parsedTop) || parsedTop < 1 ? 10 : parsedTop;
  }

  // Ignore list
  const cliIgnore = cliOpts.ignore ? cliOpts.ignore.split(',').map((s) => s.trim()) : [];
  const configIgnore = Array.isArray(config.ignore) ? config.ignore : [];
  const ignore = Array.from(new Set([...configIgnore, ...cliIgnore])).filter(Boolean);

  // Fail on
  let failOn: FailOnType = 'none';
  const rawFailOn = (cliOpts.failOn || config.failOn || '').toString().trim().toLowerCase();
  if (rawFailOn) {
    if (!VALID_FAIL_ON.includes(rawFailOn as FailOnType)) {
      throw new Error(
        `Invalid --fail-on option: "${rawFailOn}". Allowed options are: unused, size, duplicates, any`,
      );
    }
    failOn = rawFailOn as FailOnType;
  }

  // Output formatting
  const json = Boolean(cliOpts.json ?? config.json);
  const color = cliOpts.color !== false && !process.env.NO_COLOR && !config.noColor;

  return {
    cwd,
    checks,
    thresholdBytes,
    top,
    ignore,
    failOn,
    json,
    color,
  };
}
