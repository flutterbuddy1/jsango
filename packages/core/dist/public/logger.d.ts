export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Readonly<Record<string, unknown>>;
export interface ILogger {
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    child(bindings: LogContext): ILogger;
}
export declare class NoopLogger implements ILogger {
    debug(_message: string, _context?: LogContext): void;
    info(_message: string, _context?: LogContext): void;
    warn(_message: string, _context?: LogContext): void;
    error(_message: string, _context?: LogContext): void;
    child(_bindings: LogContext): ILogger;
}
//# sourceMappingURL=logger.d.ts.map