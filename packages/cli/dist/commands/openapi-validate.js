import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
import { OpenApiGenerator, OpenApiValidator } from '@jsango/openapi';
export class OpenApiValidateCommand extends BaseCommand {
    name = 'openapi:validate';
    description = 'Validate an OpenAPI document for schema compliance and reference integrity';
    usage = 'jsango openapi:validate [options]';
    options = [
        {
            name: 'file',
            short: 'f',
            description: 'Path to an OpenAPI JSON file to validate',
            type: 'string',
        },
        {
            name: 'include-admin',
            description: 'Include Admin API routes when validating application routes',
            type: 'boolean',
            default: false,
        },
    ];
    async execute(context) {
        const filePath = context.options['file'];
        let doc;
        if (filePath) {
            const resolvedPath = path.resolve(context.projectRoot, filePath);
            if (!fs.existsSync(resolvedPath)) {
                context.output.error(`OpenAPI file not found: ${resolvedPath}`);
                return ExitCode.GENERAL_ERROR;
            }
            try {
                const raw = fs.readFileSync(resolvedPath, 'utf8');
                doc = JSON.parse(raw);
            }
            catch (err) {
                context.output.error(`Failed to parse OpenAPI JSON file: ${err instanceof Error ? err.message : String(err)}`);
                return ExitCode.GENERAL_ERROR;
            }
        }
        else {
            const app = await context.getApplication();
            const includeAdmin = context.options['include-admin'] ?? false;
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
        context.output.error(colors.red(`✖ OpenAPI specification validation failed with ${errors.length} error(s):`));
        for (const e of errors) {
            context.output.text(` - ${e}`);
        }
        return ExitCode.GENERAL_ERROR;
    }
}
//# sourceMappingURL=openapi-validate.js.map