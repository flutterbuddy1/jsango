import type { HttpMethod, HttpResponse, RequestContext } from '@jsango/http';
import type { RouteConstraintDefinition } from './constraints.js';

export type RouteHandler = (
  ctx: RequestContext
) => Promise<HttpResponse | unknown> | HttpResponse | unknown;

export interface RouteOptions {
  readonly name?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly constraints?: Record<string, RouteConstraintDefinition> | undefined;
  readonly middleware?: readonly unknown[] | undefined;
}

export class Route {
  public readonly method: HttpMethod;
  public readonly path: string;
  public readonly handler: RouteHandler;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly constraints: Readonly<Record<string, RouteConstraintDefinition>>;
  public readonly paramNames: readonly string[];
  public readonly middleware: readonly unknown[];
  private _name?: string | undefined;

  constructor(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options: RouteOptions = {},
    paramNames: readonly string[] = []
  ) {
    this.method = method;
    this.path = path;
    this.handler = handler;
    this._name = options.name;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.constraints = Object.freeze({ ...(options.constraints ?? {}) });
    this.paramNames = Object.freeze([...paramNames]);
    this.middleware = Object.freeze([...(options.middleware ?? [])]);
  }

  public get routeName(): string | undefined {
    return this._name;
  }

  /**
   * Fluent method to assign or update the route's unique name.
   */
  public name(name: string): this {
    this._name = name;
    return this;
  }
}
