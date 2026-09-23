export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HttpHeaders = Readonly<Record<string, string | string[] | undefined>>;

export interface IHttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly headers: HttpHeaders;
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  readonly params: Readonly<Record<string, string | undefined>>;
  body<T = unknown>(): Promise<T>;
}

export interface IHttpResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | string[]>>;
  readonly body: unknown;
}
