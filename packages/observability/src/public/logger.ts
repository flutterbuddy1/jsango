import type { ILogger, LogContext } from '@django-js/core';
import type { ObservabilityLogLevel, StructuredLogEntry } from './types.js';
import { Redactor } from './redaction.js';

const LOG_LEVEL_SEVERITY: Record<ObservabilityLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export type LogSink = (entry: StructuredLogEntry, formattedString: string) => void;

export interface StructuredLoggerOptions {
  readonly minLevel?: ObservabilityLogLevel | undefined;
  readonly redactor?: Redactor | undefined;
  readonly sink?: LogSink | undefined;
  readonly format?: 'json' | 'text' | undefined;
  readonly sampleRate?: number | undefined;
  readonly context?: LogContext | undefined;
}

export class StructuredLogger implements ILogger {
  private readonly minSeverity: number;
  private readonly redactor: Redactor;
  private readonly sink: LogSink;
  private readonly format: 'json' | 'text';
  private readonly sampleRate: number;
  private readonly context: Record<string, unknown>;

  constructor(options: StructuredLoggerOptions = {}) {
    const level = options.minLevel ?? 'info';
    this.minSeverity = LOG_LEVEL_SEVERITY[level] ?? 30;
    this.redactor = options.redactor ?? new Redactor();
    this.sink = options.sink ?? this.defaultSink;
    this.format = options.format ?? 'json';
    this.sampleRate = options.sampleRate ?? 1.0;
    this.context = { ...(options.context ?? {}) };
  }

  public trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  public error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  public fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }

  public child(bindings: LogContext): StructuredLogger {
    return new StructuredLogger({
      minLevel: this.getLevelName(this.minSeverity),
      redactor: this.redactor,
      sink: this.sink,
      format: this.format,
      sampleRate: this.sampleRate,
      context: { ...this.context, ...bindings },
    });
  }

  public withContext(bindings: LogContext): StructuredLogger {
    return this.child(bindings);
  }

  private log(level: ObservabilityLogLevel, message: string, callContext?: LogContext): void {
    const severity = LOG_LEVEL_SEVERITY[level];
    if (severity < this.minSeverity) {
      return;
    }

    // Sampling: trace, debug, info, warn can be sampled; error & fatal are never sampled
    if (severity < 50 && this.sampleRate < 1.0) {
      if (Math.random() > this.sampleRate) {
        return;
      }
    }

    const mergedContext = { ...this.context, ...(callContext ?? {}) };
    const requestId =
      typeof mergedContext['requestId'] === 'string' ? mergedContext['requestId'] : undefined;
    const traceId =
      typeof mergedContext['traceId'] === 'string' ? mergedContext['traceId'] : undefined;
    const spanId =
      typeof mergedContext['spanId'] === 'string' ? mergedContext['spanId'] : undefined;
    const module =
      typeof mergedContext['module'] === 'string' ? mergedContext['module'] : undefined;

    // Extract error object if passed in context
    let errorDetail: StructuredLogEntry['error'] | undefined = undefined;
    const errObj = mergedContext['err'] ?? mergedContext['error'];
    if (errObj instanceof Error) {
      errorDetail = {
        message: errObj.message,
        stack: errObj.stack,
        code: (errObj as unknown as { code?: string }).code,
      };
      delete mergedContext['err'];
      delete mergedContext['error'];
    }

    delete mergedContext['requestId'];
    delete mergedContext['traceId'];
    delete mergedContext['spanId'];
    delete mergedContext['module'];

    // Redact sensitive context entries
    const cleanContext =
      Object.keys(mergedContext).length > 0
        ? (this.redactor.redact(mergedContext) as Record<string, unknown>)
        : undefined;

    // Sanitize message from control chars to prevent log injection
    const cleanMessage = this.sanitizeMessage(message);

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: cleanMessage,
      ...(cleanContext ? { context: cleanContext } : {}),
      ...(requestId ? { requestId } : {}),
      ...(traceId ? { traceId } : {}),
      ...(spanId ? { spanId } : {}),
      ...(module ? { module } : {}),
      ...(errorDetail ? { error: errorDetail } : {}),
    };

    const formatted = this.formatEntry(entry);
    this.sink(entry, formatted);
  }

  private formatEntry(entry: StructuredLogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const meta = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const err = entry.error ? ` [Error: ${entry.error.message}]` : '';
    const req = entry.requestId ? ` (req: ${entry.requestId})` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}]${req} ${entry.message}${meta}${err}`;
  }

  private sanitizeMessage(message: string): string {
    // Escape CRLF to prevent log injection attacks in text format logs
    return message.replace(/[\r\n]/g, ' ');
  }

  private defaultSink(entry: StructuredLogEntry, formattedString: string): void {
    if (entry.level === 'error' || entry.level === 'fatal') {
      process.stderr.write(formattedString + '\n');
    } else {
      process.stdout.write(formattedString + '\n');
    }
  }

  private getLevelName(severity: number): ObservabilityLogLevel {
    for (const [name, val] of Object.entries(LOG_LEVEL_SEVERITY)) {
      if (val === severity) return name as ObservabilityLogLevel;
    }
    return 'info';
  }
}
