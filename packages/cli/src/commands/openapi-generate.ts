import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { OpenApiGenerator, OpenApiFormatter } from '@django-js/openapi';

export class OpenApiGenerateCommand extends BaseCommand {
  public readonly name = 'openapi:generate';
  public readonly description = 'Generate OpenAPI 3.x specification document for the application';
  public readonly usage = 'django-js openapi:generate [options]';
  public readonly aliases = ['openapi:gen', 'openapi'];
  public readonly options = [
    {
      name: 'output',
      short: 'o',
      description: 'Output file path (e.g. openapi.json or openapi.yaml)',
      type: 'string' as const,
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format: json | yaml (default: json)',
      type: 'string' as const,
      default: 'json',
    },
    {
      name: 'title',
      description: 'API title override',
      type: 'string' as const,
    },
    {
      name: 'version',
      description: 'API version override',
      type: 'string' as const,
    },
    {
      name: 'include-admin',
      description: 'Include Admin API routes',
      type: 'boolean' as const,
      default: false,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const app = await context.getApplication();
    const title = (context.options['title'] as string | undefined) ?? 'Nexora API';
    const version = (context.options['version'] as string | undefined) ?? '1.0.0';
    const includeAdmin = (context.options['include-admin'] as boolean | undefined) ?? false;
    const format = ((context.options['format'] as string | undefined) ?? 'json').toLowerCase();
    const outputFile = context.options['output'] as string | undefined;

    const generator = new OpenApiGenerator({
      info: { title, version },
      includeAdmin,
    });

    const doc = generator.generate(app?.router);

    let outputContent: string;
    if (format === 'yaml' || format === 'yml') {
      outputContent = OpenApiFormatter.toYaml(doc);
    } else {
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
      } else {
        context.output.success(
          `OpenAPI document generated at: ${resolvedPath} (${Object.keys(doc.paths).length} paths documented)`
        );
      }
    } else {
      context.output.text(outputContent);
    }

    return ExitCode.SUCCESS;
  }
}
