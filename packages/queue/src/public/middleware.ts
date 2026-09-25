import type { JobContext } from './types.js';
import { QueueError } from './errors.js';

export type QueueMiddlewareHandler = (
  context: JobContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Onion-style execution pipeline for queue jobs.
 */
export class QueueMiddlewarePipeline {
  private readonly handlers: QueueMiddlewareHandler[] = [];

  constructor(handlers: readonly QueueMiddlewareHandler[] = []) {
    this.handlers = [...handlers];
  }

  public use(...handlers: QueueMiddlewareHandler[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  public async execute(context: JobContext, terminal: () => Promise<void>): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new QueueError({
          code: 'ERR_QUEUE_MIDDLEWARE_MULTIPLE_NEXT',
          message: 'next() was called multiple times in queue middleware.',
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

      return handler(context, () => dispatch(i + 1));
    };

    return dispatch(0);
  }
}
