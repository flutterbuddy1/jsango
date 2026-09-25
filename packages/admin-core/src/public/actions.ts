import type { AdminActionConfig, AdminBulkActionConfig } from './types.js';

export class AdminAction<TInput = unknown, TResult = unknown> {
  public readonly id: string;
  public readonly label: string;
  public readonly description?: string | undefined;
  public readonly permission?: string | undefined;
  public readonly requiresConfirmation: boolean;
  public readonly confirmationMessage?: string | undefined;
  public readonly inputSchema?: unknown | undefined;
  public readonly handler?:
    | ((options: {
        readonly item: Record<string, unknown>;
        readonly input?: TInput | undefined;
        readonly actor?: unknown | undefined;
      }) => Promise<TResult> | TResult)
    | undefined;

  constructor(config: AdminActionConfig<TInput, TResult>) {
    this.id = config.id;
    this.label = config.label;
    this.description = config.description;
    this.permission = config.permission;
    this.requiresConfirmation = config.requiresConfirmation ?? false;
    this.confirmationMessage = config.confirmationMessage;
    this.inputSchema = config.inputSchema;
    this.handler = config.handler;
  }

  public toJSON(): {
    id: string;
    label: string;
    requiresConfirmation: boolean;
    confirmationMessage?: string | undefined;
  } {
    return {
      id: this.id,
      label: this.label,
      requiresConfirmation: this.requiresConfirmation,
      confirmationMessage: this.confirmationMessage,
    };
  }
}

export class AdminBulkAction<TInput = unknown, TResult = unknown> {
  public readonly id: string;
  public readonly label: string;
  public readonly description?: string | undefined;
  public readonly permission?: string | undefined;
  public readonly requiresConfirmation: boolean;
  public readonly confirmationMessage?: string | undefined;
  public readonly inputSchema?: unknown | undefined;
  public readonly handler?:
    | ((options: {
        readonly ids: readonly (string | number)[];
        readonly input?: TInput | undefined;
        readonly actor?: unknown | undefined;
      }) => Promise<TResult> | TResult)
    | undefined;

  constructor(config: AdminBulkActionConfig<TInput, TResult>) {
    this.id = config.id;
    this.label = config.label;
    this.description = config.description;
    this.permission = config.permission;
    this.requiresConfirmation = config.requiresConfirmation ?? false;
    this.confirmationMessage = config.confirmationMessage;
    this.inputSchema = config.inputSchema;
    this.handler = config.handler;
  }

  public toJSON(): {
    id: string;
    label: string;
    requiresConfirmation: boolean;
    confirmationMessage?: string | undefined;
  } {
    return {
      id: this.id,
      label: this.label,
      requiresConfirmation: this.requiresConfirmation,
      confirmationMessage: this.confirmationMessage,
    };
  }
}
