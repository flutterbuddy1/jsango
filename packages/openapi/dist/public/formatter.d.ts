import type { OpenApiDocument } from './types.js';
export declare class OpenApiFormatter {
    /**
     * Formats the document as JSON string.
     */
    static toJson(doc: OpenApiDocument, pretty?: boolean): string;
    /**
     * Formats the document as a clean YAML string with zero external dependencies.
     */
    static toYaml(doc: OpenApiDocument): string;
    private static serializeYamlValue;
}
//# sourceMappingURL=formatter.d.ts.map