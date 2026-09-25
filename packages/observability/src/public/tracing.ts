import type {
  ISpan,
  ITracer,
  SpanContext,
  SpanKind,
  SpanOptions,
  SpanStatus,
  SpanStatusCode,
  SpanEvent,
  TraceSampler,
} from './types.js';
import { CorrelationManager } from './correlation.js';

export class Span implements ISpan {
  public readonly context: SpanContext;
  public readonly name: string;
  public readonly kind: SpanKind;
  public readonly startTime: number;
  public endTime?: number | undefined;
  public durationMs?: number | undefined;
  public status: SpanStatus = { code: 'unset' };
  public readonly attributes: Record<string, unknown>;
  public readonly events: SpanEvent[] = [];

  constructor(name: string, context: SpanContext, options: SpanOptions = {}) {
    this.name = name;
    this.context = context;
    this.kind = options.kind ?? 'internal';
    this.startTime = options.startTime ?? performance.now();
    this.attributes = { ...(options.attributes ?? {}) };
  }

  public setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  public setAttributes(attributes: Record<string, unknown>): this {
    Object.assign(this.attributes, attributes);
    return this;
  }

  public setStatus(code: SpanStatusCode, description?: string): this {
    this.status = { code, description };
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.events.push({
      name,
      timestamp: performance.now(),
      attributes: attributes ? Object.freeze({ ...attributes }) : undefined,
    });
    return this;
  }

  public recordException(exception: unknown): this {
    this.setStatus('error', exception instanceof Error ? exception.message : String(exception));
    this.addEvent('exception', {
      'exception.type': exception instanceof Error ? exception.name : typeof exception,
      'exception.message': exception instanceof Error ? exception.message : String(exception),
      'exception.stack': exception instanceof Error ? exception.stack : undefined,
    });
    return this;
  }

  public end(endTime?: number): void {
    if (this.endTime !== undefined) return;
    this.endTime = endTime ?? performance.now();
    this.durationMs = Math.max(0, this.endTime - this.startTime);
  }
}

export class NoopSpan implements ISpan {
  public static readonly INSTANCE = new NoopSpan();
  public readonly context: SpanContext = {
    traceId: '00000000000000000000000000000000',
    spanId: '0000000000000000',
    sampled: false,
  };
  public readonly name = 'noop';
  public readonly kind: SpanKind = 'internal';
  public readonly startTime = 0;
  public readonly status: SpanStatus = { code: 'unset' };
  public readonly attributes = {};
  public readonly events: readonly SpanEvent[] = [];

  public setAttribute(): this {
    return this;
  }
  public setAttributes(): this {
    return this;
  }
  public setStatus(): this {
    return this;
  }
  public addEvent(): this {
    return this;
  }
  public recordException(): this {
    return this;
  }
  public end(): void {}
}

export interface TracerOptions {
  readonly enabled?: boolean | undefined;
  readonly sampler?: TraceSampler | undefined;
  readonly sampleRate?: number | undefined;
}

export class Tracer implements ITracer {
  private readonly enabled: boolean;
  private readonly sampler: TraceSampler;

  constructor(options: TracerOptions = {}) {
    this.enabled = options.enabled ?? true;

    if (options.sampler) {
      this.sampler = options.sampler;
    } else if (options.sampleRate !== undefined) {
      const rate = options.sampleRate;
      this.sampler = () => Math.random() < rate;
    } else {
      this.sampler = () => true;
    }
  }

  public startSpan(name: string, options: SpanOptions = {}): ISpan {
    if (!this.enabled) {
      return NoopSpan.INSTANCE;
    }

    let traceId: string;
    let parentSpanId: string | undefined = undefined;

    if (options.parent) {
      if ('context' in options.parent) {
        traceId = options.parent.context.traceId;
        parentSpanId = options.parent.context.spanId;
      } else {
        traceId = options.parent.traceId;
        parentSpanId = options.parent.spanId;
      }
    } else {
      traceId = CorrelationManager.generateTraceId();
    }

    const sampled = this.sampler(traceId, name);
    const spanId = CorrelationManager.generateSpanId();

    const context: SpanContext = {
      traceId,
      spanId,
      parentSpanId,
      sampled,
    };

    return new Span(name, context, options);
  }

  public async withSpan<T>(
    name: string,
    fn: (span: ISpan) => Promise<T> | T,
    options: SpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      if (span.status.code === 'unset') {
        span.setStatus('ok');
      }
      return result;
    } catch (err: unknown) {
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  }
}
