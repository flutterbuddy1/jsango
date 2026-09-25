import type { JobDefinition } from './types.js';
import { JobRegistrationError } from './errors.js';

/**
 * Registry mapping stable job types to executable job definitions.
 * Prevents duplicate registrations and protects against arbitrary code execution.
 */
export class JobRegistry {
  private readonly definitions = new Map<string, JobDefinition<unknown, unknown>>();

  /**
   * Registers a job definition.
   */
  public register<Payload = unknown, Result = unknown>(
    definition: JobDefinition<Payload, Result>
  ): this {
    const type = definition.type?.trim();

    if (!type) {
      throw new JobRegistrationError('Job type cannot be empty.');
    }

    if (typeof definition.handler !== 'function') {
      throw new JobRegistrationError(`Job handler for type "${type}" must be a function.`, type);
    }

    if (this.definitions.has(type)) {
      throw new JobRegistrationError(
        `Job type "${type}" is already registered in JobRegistry.`,
        type
      );
    }

    this.definitions.set(type, definition as unknown as JobDefinition<unknown, unknown>);
    return this;
  }

  /**
   * Retrieves a registered job definition by type.
   */
  public get<Payload = unknown, Result = unknown>(
    type: string
  ): JobDefinition<Payload, Result> | undefined {
    return this.definitions.get(type) as JobDefinition<Payload, Result> | undefined;
  }

  /**
   * Checks whether a job type is registered.
   */
  public has(type: string): boolean {
    return this.definitions.has(type);
  }

  /**
   * Returns all registered job definitions.
   */
  public list(): readonly JobDefinition[] {
    return Object.freeze([...this.definitions.values()]);
  }

  /**
   * Clears all registered job definitions.
   */
  public clear(): void {
    this.definitions.clear();
  }
}
