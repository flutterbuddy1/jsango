export interface ColorFormatter {
    (text: string): string;
}
export declare class TerminalColors {
    enabled: boolean;
    constructor(enabled?: boolean);
    static detectSupport(): boolean;
    private wrap;
    bold(text: string): string;
    dim(text: string): string;
    underline(text: string): string;
    red(text: string): string;
    green(text: string): string;
    yellow(text: string): string;
    blue(text: string): string;
    magenta(text: string): string;
    cyan(text: string): string;
    gray(text: string): string;
    strip(text: string): string;
}
//# sourceMappingURL=colors.d.ts.map