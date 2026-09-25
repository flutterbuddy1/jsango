import type { RouteHandler } from '@jsango/router';
import type { IRouter } from '@jsango/router';
import type { RequestContext } from '@jsango/http';
import { HttpResponse, HttpStatus, ContentType } from '@jsango/http';
import type { OpenApiDocument } from './types.js';
import { OpenApiGenerator } from './generator.js';
import { OpenApiFormatter } from './formatter.js';

export interface OpenApiEndpointOptions {
  readonly router?: IRouter | undefined;
  readonly format?: 'json' | 'yaml' | 'auto' | undefined;
  readonly cacheDocument?: boolean | undefined;
}

/**
 * Creates an HTTP RouteHandler that serves the OpenAPI specification document.
 */
export function createOpenApiHandler(
  generator: OpenApiGenerator,
  options: OpenApiEndpointOptions = {}
): RouteHandler {
  let cachedJson: string | undefined;
  let cachedYaml: string | undefined;

  return (ctx: RequestContext) => {
    const targetRouter = options.router;
    const reqFormat = ctx.request.query.get('format')?.toLowerCase();
    const accept = ctx.request.headers.get('accept')?.toLowerCase() ?? '';

    const isYaml =
      reqFormat === 'yaml' ||
      options.format === 'yaml' ||
      (options.format === 'auto' &&
        (accept.includes('application/yaml') || accept.includes('text/yaml')));

    if (isYaml) {
      if (!cachedYaml || !options.cacheDocument) {
        const doc: OpenApiDocument = generator.generate(targetRouter);
        cachedYaml = OpenApiFormatter.toYaml(doc);
      }
      return new HttpResponse(cachedYaml, {
        status: HttpStatus.OK,
        headers: { 'content-type': 'application/yaml; charset=utf-8' },
      });
    }

    // Default JSON
    if (!cachedJson || !options.cacheDocument) {
      const doc: OpenApiDocument = generator.generate(targetRouter);
      cachedJson = OpenApiFormatter.toJson(doc, true);
    }

    return new HttpResponse(cachedJson, {
      status: HttpStatus.OK,
      headers: { 'content-type': `${ContentType.JSON}; charset=utf-8` },
    });
  };
}
