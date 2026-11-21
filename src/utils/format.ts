/**
 * Formats a byte number into a human-readable string.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, idx)).toFixed(dm));
  return `${value} ${sizes[idx]}`;
}

/**
 * Parses a human-readable size string (e.g. '5mb', '500kb', '1.5GB', '102400') into bytes.
 */
export function parseSize(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') return Math.max(0, input);

  const trimmed = input.toString().trim().toLowerCase();
  if (!trimmed) return 0;

  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)?$/);
  if (!match) {
    const rawNum = Number(trimmed);
    return isNaN(rawNum) ? 0 : Math.max(0, rawNum);
  }

  const num = parseFloat(match[1]);
  const unit = match[2] || 'b';

  switch (unit) {
    case 'b':
    case 'bytes':
    case 'byte':
      return Math.round(num);
    case 'k':
    case 'kb':
    case 'kib':
      return Math.round(num * 1024);
    case 'm':
    case 'mb':
    case 'mib':
      return Math.round(num * 1024 * 1024);
    case 'g':
    case 'gb':
    case 'gib':
      return Math.round(num * 1024 * 1024 * 1024);
    case 't':
    case 'tb':
    case 'tib':
      return Math.round(num * 1024 * 1024 * 1024 * 1024);
    default:
      return Math.round(num);
  }
}
