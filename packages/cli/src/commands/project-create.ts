import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError, UsageError } from '../public/errors.js';
import { ProjectDiscovery } from '../internal/project.js';

export class ProjectCreateCommand extends BaseCommand {
  public readonly name = 'create';
  public readonly description = 'Create and scaffold a new django-js project';
  public readonly usage = 'django-js create <projectName> [options]';
  public readonly aliases = ['init'];
  public readonly arguments = [
    {
      name: 'projectName',
      description: 'The name of the new project directory',
      required: true,
      type: 'string' as const,
    },
  ];
  public readonly options = [
    {
      name: 'force',
      description: 'Overwrite existing directory if it exists and is non-empty',
      type: 'boolean' as const,
    },
  ];

  public execute(context: CommandContext): number {
    const projectName = context.args[0] as string;

    // Validate project name: must not contain path traversal, must be valid directory/package name
    if (!/^[a-zA-Z0-9_.-]+$/.test(projectName) || projectName.includes('..')) {
      throw new UsageError(
        `Invalid project name "${projectName}". Project name may only contain alphanumeric characters, hyphens, and underscores.`,
        'ERR_CLI_INVALID_PROJECT_NAME'
      );
    }

    const targetDir = ProjectDiscovery.assertSafePath(projectName, context.cwd);
    const force = Boolean(context.options['force']);

    if (fs.existsSync(targetDir)) {
      const contents = fs.readdirSync(targetDir);
      if (contents.length > 0 && !force) {
        throw new DestructiveOperationError(
          `Directory "${projectName}" already exists and is not empty.`
        );
      }
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const srcDir = path.join(targetDir, 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    // 1. package.json
    const packageJsonContent = JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          build: 'tsc -b',
          start: 'node dist/index.js',
          dev: 'node dist/index.js',
        },
        dependencies: {
          '@django-js/core': '^0.0.1',
          '@django-js/http': '^0.0.1',
          '@django-js/router': '^0.0.1',
          '@django-js/middleware': '^0.0.1',
          '@django-js/database': '^0.0.1',
          '@django-js/orm': '^0.0.1',
          '@django-js/migrations': '^0.0.1',
        },
        devDependencies: {
          typescript: '^5.8.2',
          '@types/node': '^20.0.0',
        },
      },
      null,
      2
    );
    fs.writeFileSync(path.join(targetDir, 'package.json'), packageJsonContent, 'utf8');

    // 2. tsconfig.json
    const tsconfigContent = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*'],
      },
      null,
      2
    );
    fs.writeFileSync(path.join(targetDir, 'tsconfig.json'), tsconfigContent, 'utf8');

    // 3. src/index.ts
    const indexTsContent = `import { Application } from '@django-js/middleware';

export function createApplication(): Application {
  const app = new Application({ isProduction: process.env.NODE_ENV === 'production' });

  app.get('/', () => ({
    message: 'Welcome to your new django-js application!',
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health', () => ({ status: 'healthy' }));

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApplication();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';

  app.listen(port, host).then((server) => {
    console.log(\`Server running at http://\${host}:\${port}\`);

    const shutdown = async () => {
      console.log('Shutting down server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
`;
    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexTsContent, 'utf8');

    // 4. README.md
    const readmeContent = `# ${projectName}

A modern TypeScript backend application powered by django-js.

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Build
pnpm build

# Start development server
pnpm start
\`\`\`
`;
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

    if (context.output.isJson) {
      context.output.json({
        projectName,
        targetDir,
        files: ['package.json', 'tsconfig.json', 'src/index.ts', 'README.md'],
      });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.success(`Created django-js project in ${colors.cyan(targetDir)}`);
    context.output.text();
    context.output.text('Inside that directory, you can run:');
    context.output.text(`  ${colors.dim('$')} cd ${projectName}`);
    context.output.text(`  ${colors.dim('$')} pnpm install`);
    context.output.text(`  ${colors.dim('$')} pnpm build`);
    context.output.text(`  ${colors.dim('$')} pnpm start`);
    context.output.text();

    return ExitCode.SUCCESS;
  }
}
