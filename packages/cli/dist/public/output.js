import { TerminalColors } from '../internal/colors.js';
import { TableFormatter } from '../internal/table.js';
export class CliOutput {
    mode;
    verbose;
    colors;
    stdoutStream;
    stderrStream;
    constructor(options = {}) {
        this.mode = options.mode ?? 'text';
        this.verbose = options.verbose ?? false;
        this.colors = new TerminalColors(options.color);
        this.stdoutStream = options.stdout ?? process.stdout;
        this.stderrStream = options.stderr ?? process.stderr;
    }
    get isQuiet() {
        return this.mode === 'quiet';
    }
    get isJson() {
        return this.mode === 'json';
    }
    get isVerbose() {
        return this.verbose;
    }
    setMode(mode) {
        this.mode = mode;
    }
    setVerbose(verbose) {
        this.verbose = verbose;
    }
    setColor(enabled) {
        this.colors.enabled = enabled;
    }
    /**
     * Writes normal text to stdout (suppressed in quiet and json modes).
     */
    text(message = '') {
        if (this.isQuiet || this.isJson) {
            return;
        }
        this.stdoutStream.write(message + '\n');
    }
    /**
     * Writes success message to stdout (suppressed in quiet and json modes).
     */
    success(message) {
        if (this.isQuiet || this.isJson) {
            return;
        }
        const prefix = this.colors.green('✓');
        this.stdoutStream.write(`${prefix} ${message}\n`);
    }
    /**
     * Writes info message to stderr (suppressed in quiet and json modes).
     */
    info(message) {
        if (this.isQuiet || this.isJson) {
            return;
        }
        const prefix = this.colors.blue('ℹ');
        this.stderrStream.write(`${prefix} ${message}\n`);
    }
    /**
     * Writes warning message to stderr (suppressed only in quiet mode).
     */
    warn(message) {
        if (this.isQuiet) {
            return;
        }
        const prefix = this.colors.yellow('⚠ [WARN]');
        this.stderrStream.write(`${prefix} ${message}\n`);
    }
    /**
     * Writes error message to stderr (never suppressed).
     */
    error(message, error) {
        const prefix = this.colors.red('✖ [ERROR]');
        this.stderrStream.write(`${prefix} ${message}\n`);
        if (error && this.isVerbose && error instanceof Error && error.stack) {
            this.stderrStream.write(this.colors.dim(error.stack) + '\n');
        }
    }
    /**
     * Writes debug message to stderr if verbose mode is enabled.
     */
    debug(message) {
        if (!this.isVerbose) {
            return;
        }
        const prefix = this.colors.dim('[DEBUG]');
        this.stderrStream.write(`${prefix} ${message}\n`);
    }
    /**
     * Renders a table to stdout (suppressed in quiet and json modes).
     */
    table(headers, rows, options) {
        if (this.isQuiet || this.isJson) {
            return;
        }
        const tableStr = TableFormatter.format(headers, rows, options);
        this.stdoutStream.write(tableStr + '\n');
    }
    /**
     * Outputs raw JSON to stdout. Never pollutes stdout with colors or logs.
     */
    json(data) {
        const jsonStr = JSON.stringify(data, null, 2);
        this.stdoutStream.write(jsonStr + '\n');
    }
}
//# sourceMappingURL=output.js.map