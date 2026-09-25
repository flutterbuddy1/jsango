import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type { WebSocketConnection } from './connection.js';
import type { HeartbeatConfig } from './types.js';

export class HeartbeatManager {
  private readonly connections = new Map<string, WebSocketConnection>();
  private readonly pingIntervalMs: number;
  private readonly logger: ILogger;
  private timer?: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(config: HeartbeatConfig = {}, logger: ILogger = new NoopLogger()) {
    this.pingIntervalMs = config.pingIntervalMs ?? 30000;
    this.logger = logger;
  }

  public register(connection: WebSocketConnection): void {
    this.connections.set(connection.id, connection);
  }

  public unregister(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  public onPong(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.isAlive = true;
    }
  }

  public start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.checkConnections();
    }, this.pingIntervalMs);

    // Unref timer so Node process is not kept alive solely by the ping timer
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.connections.clear();
  }

  private checkConnections(): void {
    for (const [id, conn] of this.connections) {
      if (!conn.isAlive) {
        this.logger.warn(
          `Connection ${id} failed heartbeat response; terminating dead connection.`
        );
        this.connections.delete(id);
        conn.terminate();
      } else {
        conn.isAlive = false;
        conn.ping();
      }
    }
  }
}
