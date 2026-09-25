import { bench, describe } from 'vitest';
import { CliApplication } from '../../packages/cli/src/public/app.js';
import { ArgParser } from '../../packages/cli/src/public/parser.js';
import { CommandRegistry } from '../../packages/cli/src/public/registry.js';
import { TableFormatter } from '../../packages/cli/src/internal/table.js';
import { MaskUtil } from '../../packages/cli/src/internal/mask.js';
import { CliOutput } from '../../packages/cli/src/public/output.js';
import { VersionCommand } from '../../packages/cli/src/commands/version.js';
import { HelpCommand } from '../../packages/cli/src/commands/help.js';
import { RouteListCommand } from '../../packages/cli/src/commands/route-list.js';
import { MigrateRunCommand } from '../../packages/cli/src/commands/migrate-run.js';

describe('CLI Performance Benchmarks', () => {
  const app = CliApplication.createDefault();
  const nullOutput = new CliOutput({
    color: false,
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  });

  const registry = new CommandRegistry();
  registry.register(new VersionCommand());
  registry.register(new HelpCommand(registry));
  registry.register(new RouteListCommand());
  registry.register(new MigrateRunCommand());

  const complexArgv = [
    '--target=20260924000000_init',
    '--connection=default',
    '--yes',
    '--verbose',
    'create_users_table',
  ];

  const complexArgDefs = [
    { name: 'name', description: 'Migration name', required: true, type: 'string' as const },
  ];

  const complexOptDefs = [
    { name: 'target', short: 't', description: 'Target', type: 'string' as const },
    { name: 'connection', short: 'c', description: 'Connection', type: 'string' as const },
    { name: 'yes', short: 'y', description: 'Auto-confirm', type: 'boolean' as const },
    { name: 'verbose', description: 'Verbose', type: 'boolean' as const },
  ];

  const largeConfig = {
    database: {
      default: {
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'super-secret-password-12345',
        database: 'jsango_db',
      },
    },
    auth: {
      jwtSecret: 'very-long-secret-key-that-must-be-masked-1234567890',
      tokenExpiry: 3600,
      apiKey: 'api-secret-token-key-999',
    },
    services: {
      aws: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    },
  };

  const tableHeaders = ['ID', 'Method', 'Path', 'Name', 'Handler', 'Middleware'];
  const tableRows: string[][] = [];
  for (let i = 0; i < 50; i++) {
    tableRows.push([
      String(i),
      i % 2 === 0 ? 'GET' : 'POST',
      `/api/v1/resource/${i}/action`,
      `resource.action.${i}`,
      `handler_${i}`,
      String(i % 5),
    ]);
  }

  bench('1. Command Registry lookup throughput', () => {
    registry.resolve('migrate:run');
    registry.resolve('migrate');
    registry.resolve('route:list');
  });

  bench('2. Global option parsing throughput', () => {
    ArgParser.parseGlobalOptions(['--json', '--quiet', '--verbose', '--no-color', 'doctor']);
  });

  bench('3. Complex argument and option parsing', () => {
    ArgParser.parse(complexArgv, complexArgDefs, complexOptDefs);
  });

  bench('4. Sensitive data masking throughput', () => {
    MaskUtil.maskValue(largeConfig);
  });

  bench('5. Table formatting throughput (50 rows x 6 columns)', () => {
    TableFormatter.format(tableHeaders, tableRows);
  });

  bench('6. Fast-path version command execution throughput', async () => {
    await app.run(['version'], nullOutput);
  });

  bench('7. Global help rendering execution throughput', async () => {
    await app.run(['help'], nullOutput);
  });
});
