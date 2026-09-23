export type RuntimeName = 'node' | 'bun' | 'unknown';

export interface IRuntimeAdapter {
  readonly name: RuntimeName;
  readonly version: string;
  getEnv(key: string): string | undefined;
  getAllEnv(): Readonly<Record<string, string | undefined>>;
  cwd(): string;
  exit(code?: number): void;
}

export function detectRuntime(): RuntimeName {
  // Safe runtime detection without direct global references that throw in strict environments
  const globalObj = globalThis as {
    Bun?: unknown;
    process?: { versions?: { node?: string } };
  };

  if (typeof globalObj.Bun !== 'undefined') {
    return 'bun';
  }

  if (
    typeof globalObj.process !== 'undefined' &&
    typeof globalObj.process.versions?.node === 'string'
  ) {
    return 'node';
  }

  return 'unknown';
}
