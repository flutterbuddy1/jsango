import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type { IContainer } from '@jsango/container';
import type { HttpRequest } from './request.js';
import { HttpResponse } from './response.js';

export interface RequestContextInit {
  readonly request: HttpRequest;
  readonly response?: HttpResponse | undefined;
  readonly requestId?: string | undefined;
  readonly logger?: ILogger | undefined;
  readonly container?: IContainer | undefined;
  readonly signal?: AbortSignal | undefined;
}

export class RequestContext {
  public readonly request: HttpRequest;
  public response: HttpResponse;
  public readonly requestId: string;
  public readonly logger: ILogger;
  public readonly container?: IContainer | undefined;
  public readonly signal: AbortSignal;
  public readonly state = new Map<string, unknown>();

  constructor(init: RequestContextInit) {
    this.request = init.request;
    this.response = init.response ?? new HttpResponse();
    this.requestId = init.requestId ?? init.request.requestId;
    this.logger = init.logger ?? new NoopLogger();
    this.container = init.container;
    this.signal = init.signal ?? init.request.signal;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any -- request data is untyped until validated; `any` keeps `({ body }) => body.title` ergonomic */
  /** Route parameters (`/posts/:id` → `ctx.params.id`). Validated values when `validate({ params })` ran. */
  public get params(): Readonly<Record<string, any>> {
    return (this.state.get('validatedParams') as Record<string, any> | undefined) ?? this.request.params;
  }

  /** Query string as an object (`?page=2` → `ctx.query.page`). Validated values when `validate({ query })` ran. */
  public get query(): Readonly<Record<string, any>> {
    return (this.state.get('validatedQuery') as Record<string, any> | undefined) ?? this.request.query.toRecord();
  }

  /**
   * The JSON body validated by `validate({ body })`. Without `validate()` it is undefined: read the
   * raw body with `await ctx.request.json()`.
   */
  public get body(): any {
    return this.state.get('validatedBody');
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
