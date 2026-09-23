import type { IConfigProvider } from '../public/config.js';
import type { IRuntimeAdapter } from '@django-js/runtime';

export class MemoryConfigProvider implements IConfigProvider {
  private readonly store = new Map<string, unknown>();

  constructor(initialValues?: Record<string, unknown>) {
    if (initialValues) {
      for (const [key, value] of Object.entries(initialValues)) {
        this.store.set(key, value);
      }
    }
  }

  public static fromRuntime(runtime: IRuntimeAdapter): MemoryConfigProvider {
    const env = runtime.getAllEnv();
    const store: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(env)) {
      if (typeof val !== 'undefined') {
        store[key] = val;
      }
    }
    return new MemoryConfigProvider(store);
  }

  public get<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.store.get(key);
    if (typeof value === 'undefined') {
      if (typeof defaultValue !== 'undefined') {
        return defaultValue;
      }
      return undefined as T;
    }
    return value as T;
  }

  public getString(key: string, defaultValue?: string): string {
    const val = this.get<unknown>(key);
    if (typeof val === 'string') return val;
    if (typeof val !== 'undefined' && val !== null) return String(val);
    if (typeof defaultValue === 'string') return defaultValue;
    return '';
  }

  public getNumber(key: string, defaultValue?: number): number {
    const val = this.get<unknown>(key);
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = Number(val);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return defaultValue ?? 0;
  }

  public getBoolean(key: string, defaultValue?: boolean): boolean {
    const val = this.get<unknown>(key);
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return defaultValue ?? false;
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }
}
