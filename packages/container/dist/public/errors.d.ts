import { JsangoError } from '@jsango/core';
import type { ServiceIdentifier } from './container.js';
export declare class ServiceNotFoundError extends JsangoError {
    constructor(id: ServiceIdentifier<unknown>);
}
export declare class CircularDependencyError extends JsangoError {
    constructor(chain: string[]);
}
export declare class ContainerDisposedError extends JsangoError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map