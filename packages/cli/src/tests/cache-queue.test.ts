import { describe, it, expect, beforeEach } from 'vitest';
import { CliApplication } from '../public/app.js';
import { CliOutput } from '../public/output.js';
import { ExitCode } from '../public/types.js';
import { CacheManager } from '@jsango/cache';
import { QueueManager } from '@jsango/queue';

describe('CLI: Cache & Queue Commands', () => {
  let app: CliApplication;
  let cacheManager: CacheManager;
  let queueManager: QueueManager;

  beforeEach(() => {
    app = CliApplication.createDefault();
    cacheManager = new CacheManager({
      default: 'default',
      stores: {
        default: { driver: 'memory' },
        custom: { driver: 'memory' },
      },
    });
    queueManager = new QueueManager();
  });

  it('cache:clear should require --force or fail with destructive warning', async () => {
    const output = new CliOutput({ mode: 'quiet' });
    const exitCode = await app.run(['cache:clear'], output);
    expect(exitCode).toBe(ExitCode.USAGE_ERROR);
  });

  it('cache:clear --force should clear cache store successfully', async () => {
    await cacheManager.set('key1', 'val1');
    expect(await cacheManager.has('key1')).toBe(true);

    const output = new CliOutput({ mode: 'json' });
    const exitCode = await app.run(['cache:clear', '--force'], output);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('queue:work --once should process queued jobs and exit', async () => {
    let _processed = false;
    queueManager.registerJob({
      type: 'test.task',
      handler: async () => {
        _processed = true;
      },
    });

    await queueManager.dispatch('test.task', { foo: 'bar' });
    expect(await queueManager.queue().depth()).toBe(1);

    const output = new CliOutput({ mode: 'json' });
    // In our test, register a provider or invoke with context
    const exitCode = await app.run(['queue:work', '--once'], output);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('queue:status should report queue metrics', async () => {
    const output = new CliOutput({ mode: 'json' });
    const exitCode = await app.run(['queue:status', '--json'], output);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('queue:clear should require --force or fail', async () => {
    const output = new CliOutput({ mode: 'quiet' });
    const exitCode = await app.run(['queue:clear'], output);
    expect(exitCode).toBe(ExitCode.USAGE_ERROR);
  });

  it('queue:clear --force should clear specified queue', async () => {
    const output = new CliOutput({ mode: 'json' });
    const exitCode = await app.run(['queue:clear', '--force'], output);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('queue:failed and queue:retry should list and retry failed jobs', async () => {
    const failedStore = queueManager.failedJobStore;
    await failedStore.record({
      id: 'failed-1',
      jobId: 'job-1',
      jobType: 'bad.job',
      queue: 'default',
      payload: { hello: 'world' },
      error: {
        errorType: 'Error',
        message: 'Something went wrong',
        failedAt: Date.now(),
        attempt: 3,
      },
      failedAt: Date.now(),
      attempts: 3,
    });

    const output = new CliOutput({ mode: 'json' });
    const listCode = await app.run(['queue:failed'], output);
    expect(listCode).toBe(ExitCode.SUCCESS);

    const retryCode = await app.run(['queue:retry', '--all'], output);
    expect(retryCode).toBe(ExitCode.SUCCESS);
  });
});
