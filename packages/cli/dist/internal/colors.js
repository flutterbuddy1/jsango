export class TerminalColors {
    enabled;
    constructor(enabled) {
        this.enabled = enabled ?? TerminalColors.detectSupport();
    }
    static detectSupport() {
        if (typeof process === 'undefined') {
            return false;
        }
        if (process.env['NO_COLOR'] !== undefined || process.env['NODE_ENV'] === 'test') {
            return false;
        }
        return Boolean(process.stdout && process.stdout.isTTY);
    }
    wrap(startCode, endCode, text) {
        if (!this.enabled) {
            return text;
        }
        return `\x1b[${startCode}m${text}\x1b[${endCode}m`;
    }
    bold(text) {
        return this.wrap(1, 22, text);
    }
    dim(text) {
        return this.wrap(2, 22, text);
    }
    underline(text) {
        return this.wrap(4, 24, text);
    }
    red(text) {
        return this.wrap(31, 39, text);
    }
    green(text) {
        return this.wrap(32, 39, text);
    }
    yellow(text) {
        return this.wrap(33, 39, text);
    }
    blue(text) {
        return this.wrap(34, 39, text);
    }
    magenta(text) {
        return this.wrap(35, 39, text);
    }
    cyan(text) {
        return this.wrap(36, 39, text);
    }
    gray(text) {
        return this.wrap(90, 39, text);
    }
    strip(text) {
        // eslint-disable-next-line no-control-regex
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }
}
//# sourceMappingURL=colors.js.map