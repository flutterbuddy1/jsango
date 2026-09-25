import { randomUUID } from 'node:crypto';

/**
 * Generates a unique, collision-resistant string identifier for jobs.
 */
export function generateJobId(): string {
  return randomUUID();
}
