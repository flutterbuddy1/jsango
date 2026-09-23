import type { IHttpRequest, IHttpResponse } from '@django-js/http';

export type NextFunction = () => Promise<IHttpResponse>;

export interface IMiddleware {
  handle(req: IHttpRequest, next: NextFunction): Promise<IHttpResponse>;
}

export interface IMiddlewarePipeline {
  use(middleware: IMiddleware): void;
  execute(
    req: IHttpRequest,
    finalHandler: (req: IHttpRequest) => Promise<IHttpResponse>
  ): Promise<IHttpResponse>;
}
