import type { ILogger, LogContext } from '@jsango/core';
import type { ObservabilityLogLevel, StructuredLogEntry } from './types.js';
import { Redactor } from './redaction.js';
export type LogSink = (entry: StructuredLogEntry, formattedString: string) => void;
export interface StructuredLoggerOptions {
    readonly minLevel?: ObservabilityLogLevel | undefined;
    readonly redactor?: Redactor | undefined;
    readonly sink?: LogSink | undefined;
    readonly format?: 'json' | 'text' | undefined;
    readonly sampleRate?: number | undefined;
    readonly context?: LogContext | undefined;
}
export declare class StructuredLogger implements ILogger {
    private readonly minSeverity;
    private readonly redactor;
    private readonly sink;
    private readonly format;
    private readonly sampleRate;
    private readonly context;
    constructor(options?: StructuredLoggerOptions);
    trace(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    fatal(message: string, context?: LogContext): void;
    child(bindings: LogContext): StructuredLogger;
    withContext(bindings: LogContext): StructuredLogger;
    private log;
    private formatEntry;
    private sanitizeMessage;
    private defaultSink;
    private getLevelName;
}
//# sourceMappingURL=logger.d.ts.map