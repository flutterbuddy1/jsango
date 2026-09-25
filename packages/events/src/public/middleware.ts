import type { EventDefinition, EventMiddlewareHandler } from './types.js';
import { EventError } from './errors.js';

/**
 * Onion-style event middleware pipeline.
 * Separate from HTTP middleware and Queue middleware.
 */
export class EventMiddlewarePipeline {
  private readonly handlers: EventMiddlewareHandler[] = [];

  constructor(handlers: readonly EventMiddlewareHandler[] = []) {
    this.handlers = [...handlers];
  }

  public use(...handlers: EventMiddlewareHandler[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  public async execute(event: EventDefinition, terminal: () => Promise<void>): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new EventError({
          code: 'ERR_EVENT_MIDDLEWARE_MULTIPLE_NEXT',
          message: 'next() was called multiple times in event middleware.',
          statusCode: 500,
        });
      }

      index = i;

      if (i === this.handlers.length) {
        return terminal();
      }

      const handler = this.handlers[i];
      if (!handler) {
        return terminal();
      }

      return handler(event, () => dispatch(i + 1));
    };

    return dispatch(0);
  }

  public get length(): number {
    return this.handlers.length;
  }
}
