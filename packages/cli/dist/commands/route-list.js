import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
export class RouteListCommand extends BaseCommand {
    name = 'route:list';
    description = 'List all registered HTTP routes';
    usage = 'jsango route:list [options]';
    aliases = ['routes'];
    options = [
        {
            name: 'method',
            short: 'm',
            description: 'Filter routes by HTTP method (GET, POST, etc.)',
            type: 'string',
        },
        {
            name: 'path',
            short: 'p',
            description: 'Filter routes by path pattern (substring or wildcard)',
            type: 'string',
        },
        {
            name: 'name',
            description: 'Filter routes by route name',
            type: 'string',
        },
    ];
    async execute(context) {
        const app = await context.getApplication();
        if (!app) {
            if (context.output.isJson) {
                context.output.json({ routes: [] });
            }
            else {
                context.output.warn('No application instance loaded. No routes to display.');
            }
            return ExitCode.SUCCESS;
        }
        let routes = app.router.routes();
        // Filters
        const methodFilter = context.options['method']?.toUpperCase();
        const pathFilter = context.options['path'];
        const nameFilter = context.options['name'];
        if (methodFilter) {
            routes = routes.filter((r) => r.method === methodFilter);
        }
        if (pathFilter) {
            routes = routes.filter((r) => r.path.includes(pathFilter));
        }
        if (nameFilter) {
            routes = routes.filter((r) => r.routeName && r.routeName.includes(nameFilter));
        }
        if (context.output.isJson) {
            context.output.json({
                total: routes.length,
                routes: routes.map((r) => ({
                    method: r.method,
                    path: r.path,
                    name: r.routeName ?? null,
                    handler: r.handler.name || 'anonymous',
                    middlewareCount: r.middleware.length,
                    metadata: r.metadata,
                })),
            });
            return ExitCode.SUCCESS;
        }
        if (routes.length === 0) {
            context.output.text('No matching routes found.');
            return ExitCode.SUCCESS;
        }
        const { colors } = context.output;
        context.output.text(colors.bold(`Registered Application Routes (${routes.length})`));
        context.output.text();
        const rows = routes.map((r) => {
            let methodColor;
            switch (r.method) {
                case 'GET':
                    methodColor = colors.green(r.method);
                    break;
                case 'POST':
                    methodColor = colors.blue(r.method);
                    break;
                case 'PUT':
                case 'PATCH':
                    methodColor = colors.yellow(r.method);
                    break;
                case 'DELETE':
                    methodColor = colors.red(r.method);
                    break;
                default:
                    methodColor = colors.cyan(r.method);
            }
            return [
                methodColor,
                r.path,
                r.routeName ? colors.cyan(r.routeName) : colors.dim('-'),
                r.handler.name || 'anonymous',
                String(r.middleware.length),
            ];
        });
        context.output.table(['Method', 'Path', 'Name', 'Handler', 'Middleware'], rows);
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=route-list.js.map