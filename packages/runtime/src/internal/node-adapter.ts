import type { IRuntimeAdapter, RuntimeName } from '../public/runtime.js';

export class NodeRuntimeAdapter implements IRuntimeAdapter {
  public readonly name: RuntimeName = 'node';

  public get version(): string {
    const globalObj = globalThis as { process?: { versions?: { node?: string } } };
    return globalObj.process?.versions?.node ?? 'unknown';
  }

  public getEnv(key: string): string | undefined {
    const globalObj = globalThis as { process?: { env?: Record<string, string | undefined> } };
    return globalObj.process?.env?.[key];
  }

  public getAllEnv(): Readonly<Record<string, string | undefined>> {
    const globalObj = globalThis as { process?: { env?: Record<string, string | undefined> } };
    return Object.freeze({ ...(globalObj.process?.env ?? {}) });
  }

  public cwd(): string {
    const globalObj = globalThis as { process?: { cwd?: () => string } };
    return globalObj.process?.cwd?.() ?? '.';
  }

  public exit(code = 0): void {
    const globalObj = globalThis as { process?: { exit?: (code?: number) => void } };
    globalObj.process?.exit?.(code);
  }
}
