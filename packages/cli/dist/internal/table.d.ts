export interface TableOptions {
    readonly border?: boolean | undefined;
    readonly maxColumnWidth?: number | undefined;
}
export declare class TableFormatter {
    static format(headers: readonly string[], rows: readonly (readonly unknown[])[], options?: TableOptions): string;
}
//# sourceMappingURL=table.d.ts.map