import { TerminalColors } from '../internal/colors.js';
import { type TableOptions } from '../internal/table.js';
import type { OutputMode } from './types.js';
export interface CliOutputOptions {
    readonly mode?: OutputMode | undefined;
    readonly color?: boolean | undefined;
    readonly verbose?: boolean | undefined;
    readonly stdout?: {
        write(str: string): unknown;
    } | undefined;
    readonly stderr?: {
        write(str: string): unknown;
    } | undefined;
}
export declare class CliOutput {
    mode: OutputMode;
    verbose: boolean;
    readonly colors: TerminalColors;
    private readonly stdoutStream;
    private readonly stderrStream;
    constructor(options?: CliOutputOptions);
    get isQuiet(): boolean;
    get isJson(): boolean;
    get isVerbose(): boolean;
    setMode(mode: OutputMode): void;
    setVerbose(verbose: boolean): void;
    setColor(enabled: boolean): void;
    /**
     * Writes normal text to stdout (suppressed in quiet and json modes).
     */
    text(message?: string): void;
    /**
     * Writes success message to stdout (suppressed in quiet and json modes).
     */
    success(message: string): void;
    /**
     * Writes info message to stderr (suppressed in quiet and json modes).
     */
    info(message: string): void;
    /**
     * Writes warning message to stderr (suppressed only in quiet mode).
     */
    warn(message: string): void;
    /**
     * Writes error message to stderr (never suppressed).
     */
    error(message: string, error?: unknown): void;
    /**
     * Writes debug message to stderr if verbose mode is enabled.
     */
    debug(message: string): void;
    /**
     * Renders a table to stdout (suppressed in quiet and json modes).
     */
    table(headers: readonly string[], rows: readonly (readonly unknown[])[], options?: TableOptions): void;
    /**
     * Outputs raw JSON to stdout. Never pollutes stdout with colors or logs.
     */
    json(data: unknown): void;
}
//# sourceMappingURL=output.d.ts.map