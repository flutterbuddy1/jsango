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
}
