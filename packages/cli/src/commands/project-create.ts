import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError, UsageError } from '../public/errors.js';
import { ProjectDiscovery } from '../internal/project.js';

export class ProjectCreateCommand extends BaseCommand {
  public readonly name = 'create';
  public readonly description = 'Create and scaffold a new jsango project';
  public readonly usage = 'jsango create <projectName> [options]';
  public readonly aliases = ['init', 'new'];
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
          dev: 'tsc -b && node dist/index.js',
        },
        dependencies: {
          jsango: '^1.1.1',
          dotenv: '^16.4.7',
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
    const indexTsContent = `import 'dotenv/config';
import { createApp } from 'jsango';
import { configureDatabase, db } from './database.js';

export function createApplication() {
  configureDatabase();
  const app = createApp();

  app.get('/', () => ({
    message: 'Welcome to your new JSango application!',
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health', () => ({ status: 'healthy' }));
  app.get('/health/database', async () => ({ connections: await db.health() }));

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApplication();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';

  await app.listen(port, host);
}
`;
    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexTsContent, 'utf8');

    // 4. src/database.ts
    const databaseTsContent = `import { DatabaseManager, setDatabaseManager } from 'jsango';

const driver = process.env.DATABASE_DRIVER || 'memory';

export const db = new DatabaseManager({
  default: 'default',
  connections: {
    default: {
      driver,
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_HOST || undefined,
      port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : undefined,
      database: process.env.DATABASE_NAME || undefined,
      username: process.env.DATABASE_USER || undefined,
      password: process.env.DATABASE_PASSWORD || undefined,
      filename: process.env.DATABASE_FILE || './app.sqlite',
    },
  },
});

export function configureDatabase(): void {
  setDatabaseManager(db);
}
`;
    fs.writeFileSync(path.join(srcDir, 'database.ts'), databaseTsContent, 'utf8');

    // 5. .env.example
    const envExample = `DATABASE_DRIVER=memory
DATABASE_URL=
DATABASE_HOST=127.0.0.1
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_FILE=./app.sqlite
`;
    fs.writeFileSync(path.join(targetDir, '.env.example'), envExample, 'utf8');

    // 6. README.md
    const readmeContent = `# ${projectName}

A modern TypeScript backend application powered by jsango.

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Build
pnpm build

# Start development server
pnpm start
\`\`\`

## Database

The starter uses an in-memory database by default. Copy \`.env.example\` to \`.env\`, choose a
database driver, and follow the [database setup guide](https://github.com/flutterbuddy1/jsango/tree/main/docs/database/README.md).
`;
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

    if (context.output.isJson) {
      context.output.json({
        projectName,
        targetDir,
        files: ['package.json', 'tsconfig.json', 'src/index.ts', 'src/database.ts', '.env.example', 'README.md'],
      });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.success(`Created jsango project in ${colors.cyan(targetDir)}`);
    context.output.text();
    context.output.text('Inside that directory, you can run:');
    context.output.text(`  ${colors.dim('$')} cd ${projectName}`);
    context.output.text(`  ${colors.dim('$')} pnpm install`);
    context.output.text(`  ${colors.dim('$')} pnpm dev`);
    context.output.text();

    return ExitCode.SUCCESS;
  }
}
