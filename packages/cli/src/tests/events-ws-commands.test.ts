import { describe, it, expect, beforeEach } from 'vitest';
import { CliApplication } from '../public/app.js';
import { CliOutput } from '../public/output.js';
import { ExitCode } from '../public/types.js';
import { EventBus } from '@django-js/events';
import { FakeWebSocketServer } from '@django-js/websocket/testing';
import { EventsListCommand } from '../commands/events-list.js';
import { WsStatusCommand } from '../commands/ws-status.js';
import { CommandContext } from '../public/context.js';

describe('CLI: Events & WebSocket Commands', () => {
  let app: CliApplication;
  let eventBus: EventBus;
  let wsServer: FakeWebSocketServer;

  beforeEach(() => {
    app = CliApplication.createDefault();
    eventBus = new EventBus();
    wsServer = new FakeWebSocketServer();
  });

  it('events:list command outputs registered events', async () => {
    eventBus.on('user.created', () => {}, { priority: 10 });
    eventBus.on('user.created', () => {}, { mode: 'async' });
    eventBus.on('order.completed', () => {}, { mode: 'queued', queue: 'billing' });

    let stdout = '';
    const output = new CliOutput({
      mode: 'json',
      stdout: {
        write: (s: string) => {
          stdout += s;
          return true;
        },
      },
    });
    const cmd = new EventsListCommand();
    const ctx = new CommandContext({ output, eventBus });

    const exitCode = await cmd.execute(ctx);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const json = JSON.parse(stdout);
    expect(json.events).toHaveLength(2);
    expect(json.events[0].type).toBe('user.created');
    expect(json.events[0].handlers).toHaveLength(2);
  });

  it('ws:status command outputs WebSocket metrics', async () => {
    await wsServer.start();

    let stdout = '';
    const output = new CliOutput({
      mode: 'json',
      stdout: {
        write: (s: string) => {
          stdout += s;
          return true;
        },
      },
    });
    const cmd = new WsStatusCommand();
    const ctx = new CommandContext({ output, wsServer });

    const exitCode = await cmd.execute(ctx);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const json = JSON.parse(stdout);
    expect(json.active).toBe(true);
    expect(json.stats.activeConnections).toBe(0);
    expect(json.stats.activeRooms).toBe(0);
  });

  it('app.run resolves events:list and ws:status commands', async () => {
    const output1 = new CliOutput({ mode: 'json' });
    const code1 = await app.run(['events:list', '--json'], output1);
    expect(code1).toBe(ExitCode.SUCCESS);

    const output2 = new CliOutput({ mode: 'json' });
    const code2 = await app.run(['ws:status', '--json'], output2);
    expect(code2).toBe(ExitCode.SUCCESS);
  });
});
