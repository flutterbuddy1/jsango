import { CorrelationManager } from './correlation.js';
export class Span {
    context;
    name;
    kind;
    startTime;
    endTime;
    durationMs;
    status = { code: 'unset' };
    attributes;
    events = [];
    constructor(name, context, options = {}) {
        this.name = name;
        this.context = context;
        this.kind = options.kind ?? 'internal';
        this.startTime = options.startTime ?? performance.now();
        this.attributes = { ...(options.attributes ?? {}) };
    }
    setAttribute(key, value) {
        this.attributes[key] = value;
        return this;
    }
    setAttributes(attributes) {
        Object.assign(this.attributes, attributes);
        return this;
    }
    setStatus(code, description) {
        this.status = { code, description };
        return this;
    }
    addEvent(name, attributes) {
        this.events.push({
            name,
            timestamp: performance.now(),
            attributes: attributes ? Object.freeze({ ...attributes }) : undefined,
        });
        return this;
    }
    recordException(exception) {
        this.setStatus('error', exception instanceof Error ? exception.message : String(exception));
        this.addEvent('exception', {
            'exception.type': exception instanceof Error ? exception.name : typeof exception,
            'exception.message': exception instanceof Error ? exception.message : String(exception),
            'exception.stack': exception instanceof Error ? exception.stack : undefined,
        });
        return this;
    }
    end(endTime) {
        if (this.endTime !== undefined)
            return;
        this.endTime = endTime ?? performance.now();
        this.durationMs = Math.max(0, this.endTime - this.startTime);
    }
}
export class NoopSpan {
    static INSTANCE = new NoopSpan();
    context = {
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
        sampled: false,
    };
    name = 'noop';
    kind = 'internal';
    startTime = 0;
    status = { code: 'unset' };
    attributes = {};
    events = [];
    setAttribute() {
        return this;
    }
    setAttributes() {
        return this;
    }
    setStatus() {
        return this;
    }
    addEvent() {
        return this;
    }
    recordException() {
        return this;
    }
    end() { }
}
export class Tracer {
    enabled;
    sampler;
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        if (options.sampler) {
            this.sampler = options.sampler;
        }
        else if (options.sampleRate !== undefined) {
            const rate = options.sampleRate;
            this.sampler = () => Math.random() < rate;
        }
        else {
            this.sampler = () => true;
        }
    }
    startSpan(name, options = {}) {
        if (!this.enabled) {
            return NoopSpan.INSTANCE;
        }
        let traceId;
        let parentSpanId = undefined;
        if (options.parent) {
            if ('context' in options.parent) {
                traceId = options.parent.context.traceId;
                parentSpanId = options.parent.context.spanId;
            }
            else {
                traceId = options.parent.traceId;
                parentSpanId = options.parent.spanId;
            }
        }
        else {
            traceId = CorrelationManager.generateTraceId();
        }
        const sampled = this.sampler(traceId, name);
        const spanId = CorrelationManager.generateSpanId();
        const context = {
            traceId,
            spanId,
            parentSpanId,
            sampled,
        };
        return new Span(name, context, options);
    }
    async withSpan(name, fn, options = {}) {
        const span = this.startSpan(name, options);
        try {
            const result = await fn(span);
            if (span.status.code === 'unset') {
                span.setStatus('ok');
            }
            return result;
        }
        catch (err) {
            span.recordException(err);
            throw err;
        }
        finally {
            span.end();
        }
    }
}
//# sourceMappingURL=tracing.js.map