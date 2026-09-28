import type { OpenApiDocument } from './types.js';
export declare class OpenApiValidator {
    /**
     * Validates an OpenApiDocument.
     * Returns an array of validation error messages (empty if valid).
     */
    static validate(doc: OpenApiDocument): string[];
    /**
     * Asserts that an OpenApiDocument is valid, throwing InvalidOpenApiDocumentError if not.
     */
    static assertValid(doc: OpenApiDocument): void;
    private static validateRefs;
}
//# sourceMappingURL=validator.d.ts.map