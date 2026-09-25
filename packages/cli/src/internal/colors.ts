export interface ColorFormatter {
  (text: string): string;
}

export class TerminalColors {
  public enabled: boolean;

  public constructor(enabled?: boolean) {
    this.enabled = enabled ?? TerminalColors.detectSupport();
  }

  public static detectSupport(): boolean {
    if (typeof process === 'undefined') {
      return false;
    }
    if (process.env['NO_COLOR'] !== undefined || process.env['NODE_ENV'] === 'test') {
      return false;
    }
    return Boolean(process.stdout && process.stdout.isTTY);
  }

  private wrap(startCode: number, endCode: number, text: string): string {
    if (!this.enabled) {
      return text;
    }
    return `\x1b[${startCode}m${text}\x1b[${endCode}m`;
  }

  public bold(text: string): string {
    return this.wrap(1, 22, text);
  }

  public dim(text: string): string {
    return this.wrap(2, 22, text);
  }

  public underline(text: string): string {
    return this.wrap(4, 24, text);
  }

  public red(text: string): string {
    return this.wrap(31, 39, text);
  }

  public green(text: string): string {
    return this.wrap(32, 39, text);
  }

  public yellow(text: string): string {
    return this.wrap(33, 39, text);
  }

  public blue(text: string): string {
    return this.wrap(34, 39, text);
  }

  public magenta(text: string): string {
    return this.wrap(35, 39, text);
  }

  public cyan(text: string): string {
    return this.wrap(36, 39, text);
  }

  public gray(text: string): string {
    return this.wrap(90, 39, text);
  }

  public strip(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
