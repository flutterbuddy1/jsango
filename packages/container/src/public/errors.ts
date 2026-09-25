import { JsangoError } from '@jsango/core';
import type { ServiceIdentifier } from './container.js';

export class ServiceNotFoundError extends JsangoError {
  constructor(id: ServiceIdentifier<unknown>) {
    const idName = typeof id === 'function' ? id.name : String(id);
    super({
      code: 'ERR_SERVICE_NOT_FOUND',
      message: `Service "${idName}" is not registered in the container.`,
      statusCode: 500,
      metadata: { serviceId: idName },
    });
  }
}

export class CircularDependencyError extends JsangoError {
  constructor(chain: string[]) {
    super({
      code: 'ERR_CIRCULAR_DEPENDENCY',
      message: `Circular dependency detected while resolving services: ${chain.join(' -> ')}`,
      statusCode: 500,
      metadata: { resolutionChain: chain },
    });
  }
}

export class ContainerDisposedError extends JsangoError {
  constructor() {
    super({
      code: 'ERR_CONTAINER_DISPOSED',
      message: 'Cannot resolve services from a disposed container scope.',
      statusCode: 500,
    });
  }
}
