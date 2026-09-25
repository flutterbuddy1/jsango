import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { OpenApiGenerator, OpenApiValidator, type OpenApiDocument } from '@jsango/openapi';

export class OpenApiValidateCommand extends BaseCommand {
  public readonly name = 'openapi:validate';
  public readonly description =
    'Validate an OpenAPI document for schema compliance and reference integrity';
  public readonly usage = 'jsango openapi:validate [options]';
  public readonly options = [
    {
      name: 'file',
      short: 'f',
      description: 'Path to an OpenAPI JSON file to validate',
      type: 'string' as const,
    },
    {
      name: 'include-admin',
      description: 'Include Admin API routes when validating application routes',
      type: 'boolean' as const,
      default: false,
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const filePath = context.options['file'] as string | undefined;
    let doc: OpenApiDocument;

    if (filePath) {
      const resolvedPath = path.resolve(context.projectRoot, filePath);
      if (!fs.existsSync(resolvedPath)) {
        context.output.error(`OpenAPI file not found: ${resolvedPath}`);
        return ExitCode.GENERAL_ERROR;
      }
      try {
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        doc = JSON.parse(raw) as OpenApiDocument;
      } catch (err) {
        context.output.error(
          `Failed to parse OpenAPI JSON file: ${err instanceof Error ? err.message : String(err)}`
        );
        return ExitCode.GENERAL_ERROR;
      }
    } else {
      const app = await context.getApplication();
      const includeAdmin = (context.options['include-admin'] as boolean | undefined) ?? false;

      const generator = new OpenApiGenerator({
        info: { title: 'JSango API', version: '1.0.0' },
        includeAdmin,
      });

      doc = generator.generate(app?.router);
    }

    const errors = OpenApiValidator.validate(doc);
    const isValid = errors.length === 0;

    if (context.output.isJson) {
      context.output.json({
        valid: isValid,
        errors,
      });
      return isValid ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR;
    }

    const { colors } = context.output;
    if (isValid) {
      context.output.success(colors.green('✔ OpenAPI specification is valid!'));
      return ExitCode.SUCCESS;
    }

    context.output.error(
      colors.red(`✖ OpenAPI specification validation failed with ${errors.length} error(s):`)
    );
    for (const e of errors) {
      context.output.text(` - ${e}`);
    }

    return ExitCode.GENERAL_ERROR;
  }
}
