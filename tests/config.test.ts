import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFile, resolveOptions } from '../src/utils/config.js';
import { formatBytes, parseSize } from '../src/utils/format.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Configuration & Utilities', () => {
  it('loads config from .repoauditrc.json', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'config-project');
    const config = await loadConfigFile(fixtureDir);

    expect(config.only).toEqual(['unused', 'size']);
    expect(config.threshold).toBe('1mb');
    expect(config.top).toBe(5);
    expect(config.ignore).toEqual(['my-ignored-pkg']);
    expect(config.failOn).toBe('unused');
  });

  it('merges CLI options over file configuration', async () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'config-project');
    const resolved = await resolveOptions({
      cwd: fixtureDir,
      threshold: '2mb', // override file config of 1mb
      ignore: 'extra-pkg', // append to file config
    });

    expect(resolved.thresholdBytes).toBe(2 * 1024 * 1024);
    expect(resolved.ignore).toContain('my-ignored-pkg');
    expect(resolved.ignore).toContain('extra-pkg');
    expect(resolved.checks).toEqual(['unused', 'size']);
    expect(resolved.failOn).toBe('unused');
  });

  it('validates --only flag and rejects invalid check names', async () => {
    await expect(resolveOptions({ only: 'foo,bar' })).rejects.toThrow(
      /Invalid check name\(s\): "foo, bar"/,
    );
  });

  it('validates --fail-on flag and rejects invalid values', async () => {
    await expect(resolveOptions({ failOn: 'everything' })).rejects.toThrow(
      /Invalid --fail-on option: "everything"/,
    );
  });

  describe('parseSize', () => {
    it('parses various units correctly', () => {
      expect(parseSize('500b')).toBe(500);
      expect(parseSize('10kb')).toBe(10 * 1024);
      expect(parseSize('5mb')).toBe(5 * 1024 * 1024);
      expect(parseSize('1.5GB')).toBe(Math.round(1.5 * 1024 * 1024 * 1024));
      expect(parseSize(2048)).toBe(2048);
      expect(parseSize('invalid')).toBe(0);
      expect(parseSize(undefined)).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('formats bytes to human-readable strings', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024 * 5)).toBe('5 MB');
    });
  });
});
