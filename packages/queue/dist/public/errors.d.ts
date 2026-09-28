import { JsangoError, type JsangoErrorOptions } from '@jsango/core';
export declare class QueueError extends JsangoError {
    constructor(options: JsangoErrorOptions);
}
export declare class JobNotFoundError extends QueueError {
    constructor(jobId: string, queueName?: string);
}
export declare class JobRegistrationError extends QueueError {
    constructor(message: string, jobType?: string);
}
export declare class JobSerializationError extends QueueError {
    constructor(message: string, cause?: unknown);
}
export declare class JobExecutionError extends QueueError {
    constructor(jobId: string, jobType: string, message: string, cause?: unknown);
}
export declare class JobTimeoutError extends QueueError {
    constructor(jobId: string, jobType: string, timeoutMs: number);
}
export declare class QueueConnectionError extends QueueError {
    constructor(message: string, cause?: unknown);
}
export declare class WorkerShutdownError extends QueueError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map