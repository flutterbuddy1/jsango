import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { OpenApiGenerator, OpenApiFormatter } from '@jsango/openapi';
export class OpenApiGenerateCommand extends BaseCommand {
    name = 'openapi:generate';
    description = 'Generate OpenAPI 3.x specification document for the application';
    usage = 'jsango openapi:generate [options]';
    aliases = ['openapi:gen', 'openapi'];
    options = [
        {
            name: 'output',
            short: 'o',
            description: 'Output file path (e.g. openapi.json or openapi.yaml)',
            type: 'string',
        },
        {
            name: 'format',
            short: 'f',
            description: 'Output format: json | yaml (default: json)',
            type: 'string',
            default: 'json',
        },
        {
            name: 'title',
            description: 'API title override',
            type: 'string',
        },
        {
            name: 'version',
            description: 'API version override',
            type: 'string',
        },
        {
            name: 'include-admin',
            description: 'Include Admin API routes',
            type: 'boolean',
            default: false,
        },
    ];
    async execute(context) {
        const app = await context.getApplication();
        const title = context.options['title'] ?? 'JSango API';
        const version = context.options['version'] ?? '1.0.0';
        const includeAdmin = context.options['include-admin'] ?? false;
        const format = (context.options['format'] ?? 'json').toLowerCase();
        const outputFile = context.options['output'];
        const generator = new OpenApiGenerator({
            info: { title, version },
            includeAdmin,
        });
        const doc = generator.generate(app?.router);
        let outputContent;
        if (format === 'yaml' || format === 'yml') {
            outputContent = OpenApiFormatter.toYaml(doc);
        }
        else {
            outputContent = OpenApiFormatter.toJson(doc, true);
        }
        if (outputFile) {
            const resolvedPath = path.resolve(context.projectRoot, outputFile);
            fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
            fs.writeFileSync(resolvedPath, outputContent, 'utf8');
            if (context.output.isJson) {
                context.output.json({
                    success: true,
                    path: resolvedPath,
                    format,
                    operations: Object.keys(doc.paths).length,
                });
            }
            else {
                context.output.success(`OpenAPI document generated at: ${resolvedPath} (${Object.keys(doc.paths).length} paths documented)`);
            }
        }
        else {
            context.output.text(outputContent);
        }
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=openapi-generate.js.map