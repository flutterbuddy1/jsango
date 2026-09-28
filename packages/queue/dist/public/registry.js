import { JobRegistrationError } from './errors.js';
/**
 * Registry mapping stable job types to executable job definitions.
 * Prevents duplicate registrations and protects against arbitrary code execution.
 */
export class JobRegistry {
    definitions = new Map();
    /**
     * Registers a job definition.
     */
    register(definition) {
        const type = definition.type?.trim();
        if (!type) {
            throw new JobRegistrationError('Job type cannot be empty.');
        }
        if (typeof definition.handler !== 'function') {
            throw new JobRegistrationError(`Job handler for type "${type}" must be a function.`, type);
        }
        if (this.definitions.has(type)) {
            throw new JobRegistrationError(`Job type "${type}" is already registered in JobRegistry.`, type);
        }
        this.definitions.set(type, definition);
        return this;
    }
    /**
     * Retrieves a registered job definition by type.
     */
    get(type) {
        return this.definitions.get(type);
    }
    /**
     * Checks whether a job type is registered.
     */
    has(type) {
        return this.definitions.has(type);
    }
    /**
     * Returns all registered job definitions.
     */
    list() {
        return Object.freeze([...this.definitions.values()]);
    }
    /**
     * Clears all registered job definitions.
     */
    clear() {
        this.definitions.clear();
    }
}
//# sourceMappingURL=registry.js.map