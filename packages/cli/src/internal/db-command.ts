import type { DatabaseManager } from '@jsango/database';
import type { CommandContext } from '../public/context.js';
import { missingDatabaseHelp } from './project-loader.js';

/**
 * Loads the project and returns its DatabaseManager, printing setup instructions when no
 * database is configured.
 */
export async function requireDatabase(context: CommandContext): Promise<DatabaseManager | undefined> {
  await context.loadProject();
  const db = await context.getDatabaseManager();
  if (!db) {
    context.output.error(missingDatabaseHelp(context.projectRoot));
  }
  return db;
}

/** The --connection option value, or undefined for the default connection. */
export function connectionOption(context: CommandContext): string | undefined {
  const value = context.options['connection'];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export const CONNECTION_OPTION = {
  name: 'connection',
  short: 'c',
  description: 'Database connection name (default: the configured default connection)',
  type: 'string' as const,
};
