export type PlaceholderType = 'dollar' | 'question' | 'named';
export declare class SqlDialect {
    readonly placeholderType: PlaceholderType;
    constructor(placeholderType?: PlaceholderType);
    /**
     * Translates standard positional '?' placeholders to the target driver's placeholder format.
     * Accurately skips single-quoted string literals so '?' inside text is preserved.
     */
    normalizePlaceholders(sql: string): string;
    /**
     * Quotes a table or column identifier safely according to the dialect.
     */
    quoteIdentifier(identifier: string): string;
}
//# sourceMappingURL=dialect.d.ts.map