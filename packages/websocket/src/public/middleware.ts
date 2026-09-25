import type { WebSocketInboundMessage, WebSocketMiddlewareHandler } from './types.js';
import type { WebSocketContext } from './context.js';

export class WebSocketMiddlewarePipeline {
  private readonly middlewares: WebSocketMiddlewareHandler[] = [];

  public use(...handlers: WebSocketMiddlewareHandler[]): this {
    this.middlewares.push(...handlers);
    return this;
  }

  public async execute(
    ctx: WebSocketContext,
    message: WebSocketInboundMessage,
    target: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const current = this.middlewares[index++];
        if (current) {
          await current(ctx, message, next);
        }
      } else {
        await target();
      }
    };

    await next();
  }
}
