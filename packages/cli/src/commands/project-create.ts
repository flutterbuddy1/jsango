import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { DestructiveOperationError, UsageError } from '../public/errors.js';
import { ProjectDiscovery } from '../internal/project.js';
import { FRAMEWORK_VERSION } from './version.js';
import { writeAgentFiles } from '../internal/agent-files.js';

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

    const files: Record<string, string> = {
      'package.json':
        JSON.stringify(
          {
            name: projectName,
            version: '0.1.0',
            private: true,
            type: 'module',
            scripts: {
              dev: 'tsx watch src/index.ts',
              build: 'tsc -b',
              start: 'node dist/index.js',
              makemigrations: 'jsango migrate:generate',
              migrate: 'jsango migrate',
              'migrate:status': 'jsango migrate:status',
              'migrate:rollback': 'jsango migrate:rollback',
              'db:status': 'jsango db:status',
            },
            dependencies: {
              jsango: `^${FRAMEWORK_VERSION}`,
              dotenv: '^16.4.7',
            },
            devDependencies: {
              typescript: '^5.8.2',
              tsx: '^4.20.0',
              '@types/node': '^22.0.0',
            },
            engines: {
              node: '>=22.13.0',
            },
          },
          null,
          2
        ) + '\n',

      'tsconfig.json':
        JSON.stringify(
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
        ) + '\n',

      'jsango.config.ts': `import { defineConfig } from 'jsango';
import { db } from './src/database.js';

/**
 * Used by the jsango CLI (migrate, makemigrations, db:status, ...).
 * The CLI loads .env before this file.
 */
export default defineConfig({
  database: db,
  models: './src/models',
  migrations: './migrations',
});
`,

      'src/database.ts': `import { DatabaseManager, databaseConfigFromEnv, setDatabaseManager } from 'jsango';

/**
 * Reads DATABASE_URL (or DATABASE_DRIVER / DATABASE_HOST / ...) from the environment.
 * With nothing set it uses SQLite at ./db.sqlite3. See .env.example.
 */
export const db = new DatabaseManager(databaseConfigFromEnv());

/** Makes every model use this database. Call once at startup. */
export function configureDatabase(): DatabaseManager {
  setDatabaseManager(db);
  return db;
}
`,

      'src/models/user.ts': `import { defineModel, fields } from 'jsango';

/**
 * Example model. After changing fields run:
 *   npm run makemigrations   # writes a migration file into ./migrations
 *   npm run migrate          # applies it to the database
 */
export const User = defineModel(
  'User',
  {
    id: fields.id(),
    email: fields.string({ maxLength: 255, unique: true }),
    name: fields.string({ maxLength: 120, nullable: true }),
    isActive: fields.boolean({ defaultValue: true }),
  },
  { table: 'users', timestamps: true }
);
`,

      'src/index.ts': `import 'dotenv/config';
import { createApp } from 'jsango';
import { configureDatabase, db } from './database.js';
import { User } from './models/user.js';

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

  // GET/POST /users, GET/PUT/PATCH/DELETE /users/:id
  app.crud('/users', User);

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApplication();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';

  // Fail fast with a clear message if the database is unreachable or misconfigured.
  await db.verify();
  await app.listen(port, host);
  console.log(\`Listening on http://\${host}:\${port}\`);

  const shutdown = async () => {
    await db.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
`,

      '.env.example': `# ---- Database -------------------------------------------------------------
# Option A: one URL (recommended for production)
#   PostgreSQL: DATABASE_URL=postgres://user:password@localhost:5432/myapp
#   MySQL:      DATABASE_URL=mysql://user:password@localhost:3306/myapp
#   SQLite:     DATABASE_URL=sqlite:./db.sqlite3
#   MongoDB:    DATABASE_URL=mongodb://user:password@localhost:27017/myapp  (npm install mongodb)
DATABASE_URL=

# Option B: individual settings (used when DATABASE_URL is empty)
DATABASE_DRIVER=sqlite
DATABASE_FILE=./db.sqlite3
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
# true / require, no-verify (self-signed certificates), false
DATABASE_SSL=
DATABASE_POOL_MAX=10

PORT=3000

# ---- Auth (createAuth) ----------------------------------------------------
# 32+ random characters: openssl rand -base64 48
AUTH_SECRET=
`,

      '.gitignore': `node_modules/
dist/
.env
*.sqlite3
*.sqlite3-shm
*.sqlite3-wal
`,

      'migrations/.gitkeep': '',

      'README.md': `# ${projectName}

A TypeScript backend powered by [jsango](https://github.com/flutterbuddy1/jsango).

## Getting started

\`\`\`bash
npm install
cp .env.example .env        # defaults to SQLite; edit for PostgreSQL / MySQL
npm run makemigrations      # create a migration from src/models
npm run migrate             # apply it
npm run dev                 # http://127.0.0.1:3000
\`\`\`

SQLite works out of the box on Node.js 22.13+. For other databases install the client:
\`npm install pg\` (PostgreSQL), \`npm install mysql2\` (MySQL / MariaDB) or \`npm install mongodb\` (MongoDB).

## Database workflow

1. Change or add models in \`src/models\`.
2. \`npm run makemigrations\` – writes \`migrations/<timestamp>_<name>.ts\`. Review it.
3. \`npm run migrate\` – applies pending migrations (\`npx jsango migrate --dry-run\` shows the SQL).
4. Commit the migration file together with the model change.

Other commands: \`npx jsango migrate:status\`, \`npx jsango migrate:rollback\`, \`npx jsango db:status\`.

See the [database guide](https://github.com/flutterbuddy1/jsango/tree/main/docs/database/README.md).

## Building with AI

\`AGENTS.md\` tells AI coding agents (Claude Code, Cursor, Copilot, Codex, ...) to build with jsango's APIs
instead of other libraries. Refresh it after upgrading jsango: \`npx jsango ai:init\`.
`,
    };

    for (const [relative, content] of Object.entries(files)) {
      const filePath = path.join(targetDir, relative);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    }

    // Instructions for AI coding agents (Claude Code, Cursor, Copilot, Codex, ...).
    const agentFiles = writeAgentFiles(targetDir).map((r) => r.file);

    // A ready-to-use .env (SQLite) so the first `npm run migrate` works without editing.
    const envPath = path.join(targetDir, '.env');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, files['.env.example']!, 'utf8');
    }

    if (context.output.isJson) {
      context.output.json({
        projectName,
        targetDir,
        files: [...Object.keys(files), ...agentFiles, '.env'],
      });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.success(`Created jsango project in ${colors.cyan(targetDir)}`);
    context.output.text();
    context.output.text('Next steps:');
    context.output.text(`  ${colors.dim('$')} cd ${projectName}`);
    context.output.text(`  ${colors.dim('$')} npm install`);
    context.output.text(`  ${colors.dim('$')} npm run makemigrations`);
    context.output.text(`  ${colors.dim('$')} npm run migrate`);
    context.output.text(`  ${colors.dim('$')} npm run dev`);
    context.output.text();
    context.output.text(
      `Building with an AI assistant? ${colors.cyan('AGENTS.md')} teaches it to use jsango.`
    );
    context.output.text();

    return ExitCode.SUCCESS;
  }
}
