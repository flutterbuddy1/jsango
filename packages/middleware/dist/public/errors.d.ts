import { JsangoError } from '@jsango/core';
export declare class MiddlewareError extends JsangoError {
}
export declare class MultipleNextCallsError extends MiddlewareError {
    constructor(middlewareName?: string);
}
export declare class NamedMiddlewareNotFoundError extends MiddlewareError {
    constructor(name: string);
}
export declare class PipelineExecutionError extends MiddlewareError {
    constructor(message: string, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map