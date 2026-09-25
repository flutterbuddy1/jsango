import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { FRAMEWORK_VERSION } from './version.js';
import { MigrationRunner } from '@jsango/migrations';

export interface DiagnosticCheck {
  readonly category: string;
  readonly name: string;
  readonly status: 'ok' | 'warn' | 'error';
  readonly message: string;
  readonly details?: unknown;
}

export class DoctorCommand extends BaseCommand {
  public readonly name = 'doctor';
  public readonly description = 'Run system and project diagnostics';
  public readonly usage = 'jsango doctor [options]';

  public async execute(context: CommandContext): Promise<number> {
    const checks: DiagnosticCheck[] = [];

    // 1. Node.js runtime version
    const nodeMajor = parseInt(process.versions.node.split('.')[0]!, 10);
    if (nodeMajor >= 20) {
      checks.push({
        category: 'Runtime',
        name: 'Node.js Version',
        status: 'ok',
        message: `${process.version} (>= 20.0.0 required)`,
      });
    } else {
      checks.push({
        category: 'Runtime',
        name: 'Node.js Version',
        status: 'error',
        message: `${process.version} is not supported. Please upgrade to Node.js >= 20.0.0.`,
      });
    }

    // 2. Framework Version
    checks.push({
      category: 'Framework',
      name: 'JSango Core',
      status: 'ok',
      message: `v${FRAMEWORK_VERSION}`,
    });

    // 3. Project Configuration
    if (context.projectRoot) {
      checks.push({
        category: 'Project',
        name: 'Project Root',
        status: 'ok',
        message: context.projectRoot,
      });
    } else {
      checks.push({
        category: 'Project',
        name: 'Project Root',
        status: 'warn',
        message: 'No project root detected. Running in standalone mode.',
      });
    }

    // 4. Environment
    checks.push({
      category: 'Environment',
      name: 'Active Environment',
      status: 'ok',
      message: context.env,
    });

    // 5. Database Connectivity
    const db = await context.getDatabaseManager();
    if (db) {
      try {
        const conn = await db.connection('default');
        try {
          const isAlive = await conn.ping();
          if (isAlive) {
            checks.push({
              category: 'Database',
              name: 'Default Connection',
              status: 'ok',
              message: 'Connected and responsive',
            });
          } else {
            checks.push({
              category: 'Database',
              name: 'Default Connection',
              status: 'error',
              message: 'Connection ping failed.',
            });
          }
        } finally {
          if ('release' in conn && typeof conn.release === 'function') {
            await conn.release();
          }
        }
      } catch (err) {
        checks.push({
          category: 'Database',
          name: 'Default Connection',
          status: 'error',
          message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // 6. Migration Status (if DB available)
      try {
        const runner = new MigrationRunner({
          databaseManager: db,
          registry: context.getMigrationRegistry(),
        });
        const status = await runner.status();
        if (status.isUpToDate) {
          checks.push({
            category: 'Migrations',
            name: 'Schema Status',
            status: 'ok',
            message: `Up to date (${status.applied.length} applied)`,
          });
        } else {
          checks.push({
            category: 'Migrations',
            name: 'Schema Status',
            status: 'warn',
            message: `${status.pending.length} pending migration(s) to apply`,
          });
        }
      } catch (err) {
        checks.push({
          category: 'Migrations',
          name: 'Schema Status',
          status: 'warn',
          message: `Could not check migrations: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      checks.push({
        category: 'Database',
        name: 'Database Configuration',
        status: 'ok',
        message: 'No database configured for this application',
      });
    }

    // Format output
    if (context.output.isJson) {
      context.output.json({ checks });
    } else {
      const { colors } = context.output;
      context.output.text(colors.bold('JSango Diagnostic Report'));
      context.output.text();

      const rows = checks.map((c) => {
        let statusBadge: string;
        if (c.status === 'ok') {
          statusBadge = colors.green('✓ OK');
        } else if (c.status === 'warn') {
          statusBadge = colors.yellow('⚠ WARN');
        } else {
          statusBadge = colors.red('✖ FAIL');
        }
        return [c.category, c.name, statusBadge, c.message];
      });

      context.output.table(['Category', 'Check', 'Status', 'Message'], rows);
      context.output.text();

      const hasErrors = checks.some((c) => c.status === 'error');
      if (hasErrors) {
        context.output.error('One or more diagnostic checks failed.');
        return ExitCode.GENERAL_ERROR;
      }
      context.output.success('All diagnostic checks passed!');
    }

    return ExitCode.SUCCESS;
  }
}
