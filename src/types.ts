export type CheckType = 'unused' | 'size' | 'duplicates';

export type FailOnType = 'unused' | 'size' | 'duplicates' | 'any' | 'none';

export interface RepoAuditConfig {
  only?: CheckType[];
  threshold?: string | number;
  top?: number;
  ignore?: string[];
  failOn?: FailOnType;
  noColor?: boolean;
  json?: boolean;
  cwd?: string;
}

export interface CliOptions {
  only?: string;
  threshold?: string;
  top?: number | string;
  ignore?: string;
  failOn?: string;
  color?: boolean;
  json?: boolean;
  cwd?: string;
}

export interface ResolvedOptions {
  cwd: string;
  checks: CheckType[];
  thresholdBytes: number;
  top: number;
  ignore: string[];
  failOn: FailOnType;
  json: boolean;
  color: boolean;
}

export interface UnusedDepsResult {
  unusedDependencies: string[];
  unusedDevDependencies: string[];
  missingDependencies: string[];
  totalScannedFiles: number;
}

export interface AlternativeSuggestion {
  name: string;
  reason: string;
  alternatives: string[];
}

export interface PackageSizeItem {
  name: string;
  sizeBytes: number;
  formattedSize: string;
  exceedsThreshold: boolean;
  isDev: boolean;
  suggestion?: AlternativeSuggestion;
}

export interface PackageSizeResult {
  packages: PackageSizeItem[];
  thresholdBytes: number;
  thresholdExceededCount: number;
  totalDirectDependencies: number;
}

export interface DuplicateVersionInfo {
  version: string;
  dependents: string[];
}

export interface DuplicatePackageItem {
  name: string;
  versions: DuplicateVersionInfo[];
  wastedBytes: number;
  formattedWastedSize: string;
}

export interface DuplicatesResult {
  duplicates: DuplicatePackageItem[];
  totalWastedBytes: number;
  formattedTotalWastedSize: string;
  lockfileVersion?: number;
}

export interface AuditReport {
  timestamp: string;
  cwd: string;
  durationMs: number;
  checks: {
    unused?: UnusedDepsResult;
    size?: PackageSizeResult;
    duplicates?: DuplicatesResult;
  };
  summary: {
    totalIssues: number;
    unusedCount: number;
    missingCount: number;
    oversizedCount: number;
    duplicateCount: number;
    shouldFail: boolean;
  };
  errors: string[];
}
