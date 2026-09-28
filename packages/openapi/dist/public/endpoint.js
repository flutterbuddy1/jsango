import { HttpResponse, HttpStatus, ContentType } from '@jsango/http';
import { OpenApiFormatter } from './formatter.js';
/**
 * Creates an HTTP RouteHandler that serves the OpenAPI specification document.
 */
export function createOpenApiHandler(generator, options = {}) {
    let cachedJson;
    let cachedYaml;
    return (ctx) => {
        const targetRouter = options.router;
        const reqFormat = ctx.request.query.get('format')?.toLowerCase();
        const accept = ctx.request.headers.get('accept')?.toLowerCase() ?? '';
        const isYaml = reqFormat === 'yaml' ||
            options.format === 'yaml' ||
            (options.format === 'auto' &&
                (accept.includes('application/yaml') || accept.includes('text/yaml')));
        if (isYaml) {
            if (!cachedYaml || !options.cacheDocument) {
                const doc = generator.generate(targetRouter);
                cachedYaml = OpenApiFormatter.toYaml(doc);
            }
            return new HttpResponse(cachedYaml, {
                status: HttpStatus.OK,
                headers: { 'content-type': 'application/yaml; charset=utf-8' },
            });
        }
        // Default JSON
        if (!cachedJson || !options.cacheDocument) {
            const doc = generator.generate(targetRouter);
            cachedJson = OpenApiFormatter.toJson(doc, true);
        }
        return new HttpResponse(cachedJson, {
            status: HttpStatus.OK,
            headers: { 'content-type': `${ContentType.JSON}; charset=utf-8` },
        });
    };
}
//# sourceMappingURL=endpoint.js.map