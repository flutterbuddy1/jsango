import type { JobDefinition } from './types.js';
/**
 * Registry mapping stable job types to executable job definitions.
 * Prevents duplicate registrations and protects against arbitrary code execution.
 */
export declare class JobRegistry {
    private readonly definitions;
    /**
     * Registers a job definition.
     */
    register<Payload = unknown, Result = unknown>(definition: JobDefinition<Payload, Result>): this;
    /**
     * Retrieves a registered job definition by type.
     */
    get<Payload = unknown, Result = unknown>(type: string): JobDefinition<Payload, Result> | undefined;
    /**
     * Checks whether a job type is registered.
     */
    has(type: string): boolean;
    /**
     * Returns all registered job definitions.
     */
    list(): readonly JobDefinition[];
    /**
     * Clears all registered job definitions.
     */
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map