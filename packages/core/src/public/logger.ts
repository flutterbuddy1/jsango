export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Readonly<Record<string, unknown>>;

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): ILogger;
}

export class NoopLogger implements ILogger {
  public debug(_message: string, _context?: LogContext): void {}
  public info(_message: string, _context?: LogContext): void {}
  public warn(_message: string, _context?: LogContext): void {}
  public error(_message: string, _context?: LogContext): void {}
  public child(_bindings: LogContext): ILogger {
    return this;
  }
}
