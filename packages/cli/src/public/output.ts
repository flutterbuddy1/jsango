import { TerminalColors } from '../internal/colors.js';
import { TableFormatter, type TableOptions } from '../internal/table.js';
import type { OutputMode } from './types.js';

export interface CliOutputOptions {
  readonly mode?: OutputMode | undefined;
  readonly color?: boolean | undefined;
  readonly verbose?: boolean | undefined;
  readonly stdout?: { write(str: string): unknown } | undefined;
  readonly stderr?: { write(str: string): unknown } | undefined;
}

export class CliOutput {
  public mode: OutputMode;
  public verbose: boolean;
  public readonly colors: TerminalColors;
  private readonly stdoutStream: { write(str: string): unknown };
  private readonly stderrStream: { write(str: string): unknown };

  public constructor(options: CliOutputOptions = {}) {
    this.mode = options.mode ?? 'text';
    this.verbose = options.verbose ?? false;
    this.colors = new TerminalColors(options.color);
    this.stdoutStream = options.stdout ?? process.stdout;
    this.stderrStream = options.stderr ?? process.stderr;
  }

  public get isQuiet(): boolean {
    return this.mode === 'quiet';
  }

  public get isJson(): boolean {
    return this.mode === 'json';
  }

  public get isVerbose(): boolean {
    return this.verbose;
  }

  public setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  public setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  public setColor(enabled: boolean): void {
    this.colors.enabled = enabled;
  }

  /**
   * Writes normal text to stdout (suppressed in quiet and json modes).
   */
  public text(message = ''): void {
    if (this.isQuiet || this.isJson) {
      return;
    }
    this.stdoutStream.write(message + '\n');
  }

  /**
   * Writes success message to stdout (suppressed in quiet and json modes).
   */
  public success(message: string): void {
    if (this.isQuiet || this.isJson) {
      return;
    }
    const prefix = this.colors.green('✓');
    this.stdoutStream.write(`${prefix} ${message}\n`);
  }

  /**
   * Writes info message to stderr (suppressed in quiet and json modes).
   */
  public info(message: string): void {
    if (this.isQuiet || this.isJson) {
      return;
    }
    const prefix = this.colors.blue('ℹ');
    this.stderrStream.write(`${prefix} ${message}\n`);
  }

  /**
   * Writes warning message to stderr (suppressed only in quiet mode).
   */
  public warn(message: string): void {
    if (this.isQuiet) {
      return;
    }
    const prefix = this.colors.yellow('⚠ [WARN]');
    this.stderrStream.write(`${prefix} ${message}\n`);
  }

  /**
   * Writes error message to stderr (never suppressed).
   */
  public error(message: string, error?: unknown): void {
    const prefix = this.colors.red('✖ [ERROR]');
    this.stderrStream.write(`${prefix} ${message}\n`);
    if (error && this.isVerbose && error instanceof Error && error.stack) {
      this.stderrStream.write(this.colors.dim(error.stack) + '\n');
    }
  }

  /**
   * Writes debug message to stderr if verbose mode is enabled.
   */
  public debug(message: string): void {
    if (!this.isVerbose) {
      return;
    }
    const prefix = this.colors.dim('[DEBUG]');
    this.stderrStream.write(`${prefix} ${message}\n`);
  }

  /**
   * Renders a table to stdout (suppressed in quiet and json modes).
   */
  public table(
    headers: readonly string[],
    rows: readonly (readonly unknown[])[],
    options?: TableOptions
  ): void {
    if (this.isQuiet || this.isJson) {
      return;
    }
    const tableStr = TableFormatter.format(headers, rows, options);
    this.stdoutStream.write(tableStr + '\n');
  }

  /**
   * Outputs raw JSON to stdout. Never pollutes stdout with colors or logs.
   */
  public json(data: unknown): void {
    const jsonStr = JSON.stringify(data, null, 2);
    this.stdoutStream.write(jsonStr + '\n');
  }
}
