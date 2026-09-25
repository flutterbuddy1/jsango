import type { HttpResponse, RequestContext } from '@jsango/http';
import type { Middleware, NextFunction } from '../public/types.js';
import { MultipleNextCallsError } from '../public/errors.js';
import { ResponseNormalizer } from './normalizer.js';

export class MiddlewarePipeline {
  private readonly stack: Middleware[] = [];

  constructor(middlewares: readonly Middleware[] = []) {
    this.stack.push(...middlewares);
  }

  public use(...middleware: Middleware[]): this {
    this.stack.push(...middleware);
    return this;
  }

  public get length(): number {
    return this.stack.length;
  }

  public async execute(
    ctx: RequestContext,
    terminalHandler: (ctx: RequestContext) => Promise<HttpResponse>
  ): Promise<HttpResponse> {
    let prevIndex = -1;

    const dispatch = async (i: number): Promise<HttpResponse> => {
      if (i <= prevIndex) {
        throw new MultipleNextCallsError();
      }
      prevIndex = i;

      if (i === this.stack.length) {
        return terminalHandler(ctx);
      }

      const mw = this.stack[i]!;

      const next: NextFunction = async () => {
        return dispatch(i + 1);
      };

      let result: unknown;
      if (typeof mw === 'function') {
        result = await mw(ctx, next);
      } else {
        result = await mw.handle(ctx, next);
      }

      return ResponseNormalizer.normalize(result, ctx);
    };

    return dispatch(0);
  }
}
