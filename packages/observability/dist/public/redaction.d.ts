import type { RedactionOptions } from './types.js';
export declare class Redactor {
    private readonly pattern;
    private readonly mask;
    constructor(options?: RedactionOptions);
    /**
     * Returns a deeply redacted copy of the input object.
     * Safe against circular references and never mutates original inputs.
     */
    redact<T>(input: T): T;
    /**
     * Redacts sensitive HTTP headers.
     */
    redactHeaders(headers: Record<string, string | readonly string[] | undefined>): Record<string, string | readonly string[]>;
    private redactRecursive;
}
//# sourceMappingURL=redaction.d.ts.map