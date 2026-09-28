import { CorrelationManager } from './correlation.js';
/**
 * Creates HTTP request instrumentation middleware.
 * Automatically handles request ID correlation, tracing span, metric increments, and structured logging.
 */
export function createHttpInstrumentationMiddleware(options = {}) {
    const metrics = options.metrics;
    const tracer = options.tracer;
    const logger = options.logger;
    // Pre-register standard metrics if registry is provided
    const requestsCounter = metrics?.counter('http_requests_total', 'Total count of HTTP requests processed', ['method', 'status']);
    const durationHistogram = metrics?.histogram('http_request_duration_seconds', 'HTTP request duration in seconds', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], ['method', 'status']);
    return async (ctx, next) => {
        const startTime = performance.now();
        const req = ctx.request;
        // Resolve or generate correlation request ID
        const rawReqId = req.headers.get('x-request-id');
        const requestId = CorrelationManager.resolveRequestId(rawReqId ?? undefined);
        // Parse incoming W3C traceparent or start fresh trace
        const rawTraceparent = req.headers.get('traceparent');
        const incomingTrace = CorrelationManager.parseTraceparent(rawTraceparent ?? undefined);
        const span = tracer?.startSpan(`HTTP ${req.method} ${req.pathname}`, {
            kind: 'server',
            parent: incomingTrace
                ? {
                    traceId: incomingTrace.traceId,
                    spanId: incomingTrace.parentSpanId,
                    sampled: incomingTrace.sampled,
                }
                : undefined,
            attributes: {
                'http.method': req.method,
                'http.url': req.pathname,
                'http.request_id': requestId,
            },
        });
        const traceId = span?.context.traceId ?? incomingTrace?.traceId ?? CorrelationManager.generateTraceId();
        const spanId = span?.context.spanId ?? CorrelationManager.generateSpanId();
        // Bind request context to scoped logger
        const reqLogger = logger?.child({
            requestId,
            traceId,
            spanId,
            method: req.method,
            path: req.pathname,
        });
        try {
            await next();
            // Ensure correlation headers are present on the final ctx.response
            ctx.response.headers.set('x-request-id', requestId);
            if (options.includeTraceHeaders !== false) {
                ctx.response.headers.set('traceparent', CorrelationManager.formatTraceparent(traceId, spanId, span?.context.sampled ?? true));
            }
            const durationSec = (performance.now() - startTime) / 1000;
            const status = String(ctx.response.statusCode);
            requestsCounter?.inc(1, { method: req.method, status });
            durationHistogram?.observe(durationSec, { method: req.method, status });
            span?.setAttribute('http.status_code', ctx.response.statusCode);
            if (ctx.response.statusCode >= 500) {
                span?.setStatus('error', `HTTP ${ctx.response.statusCode}`);
            }
            else {
                span?.setStatus('ok');
            }
            reqLogger?.info(`${req.method} ${req.pathname} ${ctx.response.statusCode}`, {
                statusCode: ctx.response.statusCode,
                durationMs: Math.round(durationSec * 1000),
            });
        }
        catch (err) {
            // Ensure correlation headers are present even on error
            ctx.response.headers.set('x-request-id', requestId);
            if (options.includeTraceHeaders !== false) {
                ctx.response.headers.set('traceparent', CorrelationManager.formatTraceparent(traceId, spanId, span?.context.sampled ?? true));
            }
            const durationSec = (performance.now() - startTime) / 1000;
            requestsCounter?.inc(1, { method: req.method, status: '500' });
            durationHistogram?.observe(durationSec, { method: req.method, status: '500' });
            span?.recordException(err);
            reqLogger?.error(`Unhandled error during ${req.method} ${req.pathname}: ${err instanceof Error ? err.message : String(err)}`, {
                error: err,
                durationMs: Math.round(durationSec * 1000),
            });
            throw err;
        }
        finally {
            span?.end();
        }
    };
}
export class FrameworkInstrumentation {
    /**
     * Database operation instrumentation hook.
     */
    static createDatabaseHook(metrics, tracer) {
        const queryCounter = metrics?.counter('db_queries_total', 'Total database queries executed', [
            'operation',
        ]);
        const queryDuration = metrics?.histogram('db_query_duration_seconds', 'Database query duration in seconds', undefined, ['operation']);
        return async (operation, queryFn) => {
            const start = performance.now();
            const span = tracer?.startSpan(`DB ${operation}`, { kind: 'client' });
            try {
                const result = await queryFn();
                const durationSec = (performance.now() - start) / 1000;
                queryCounter?.inc(1, { operation });
                queryDuration?.observe(durationSec, { operation });
                span?.setStatus('ok');
                return result;
            }
            catch (err) {
                span?.recordException(err);
                throw err;
            }
            finally {
                span?.end();
            }
        };
    }
    /**
     * Cache operation instrumentation hook.
     */
    static createCacheHook(metrics) {
        const opsCounter = metrics?.counter('cache_operations_total', 'Total cache operations', [
            'operation',
        ]);
        const hitsCounter = metrics?.counter('cache_hits_total', 'Total cache hits');
        const missesCounter = metrics?.counter('cache_misses_total', 'Total cache misses');
        return {
            recordHit(operation = 'get') {
                opsCounter?.inc(1, { operation });
                hitsCounter?.inc(1);
            },
            recordMiss(operation = 'get') {
                opsCounter?.inc(1, { operation });
                missesCounter?.inc(1);
            },
            recordSet() {
                opsCounter?.inc(1, { operation: 'set' });
            },
            recordDelete() {
                opsCounter?.inc(1, { operation: 'delete' });
            },
        };
    }
    /**
     * Queue job instrumentation hook.
     */
    static createQueueHook(metrics, tracer) {
        const jobsCounter = metrics?.counter('queue_jobs_total', 'Total queue jobs processed', [
            'jobName',
            'status',
        ]);
        const jobDuration = metrics?.histogram('queue_job_duration_seconds', 'Queue job execution duration', undefined, ['jobName']);
        return async (jobName, executeFn) => {
            const start = performance.now();
            const span = tracer?.startSpan(`QueueJob ${jobName}`, { kind: 'consumer' });
            try {
                const result = await executeFn();
                const durationSec = (performance.now() - start) / 1000;
                jobsCounter?.inc(1, { jobName, status: 'success' });
                jobDuration?.observe(durationSec, { jobName });
                span?.setStatus('ok');
                return result;
            }
            catch (err) {
                jobsCounter?.inc(1, { jobName, status: 'failed' });
                span?.recordException(err);
                throw err;
            }
            finally {
                span?.end();
            }
        };
    }
}
//# sourceMappingURL=instrumentation.js.map