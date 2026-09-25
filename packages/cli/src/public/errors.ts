import { JsangoError } from '@jsango/core';
import { ExitCode } from './types.js';

export interface CliErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly exitCode?: ExitCode | undefined;
  readonly cause?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export class CliError extends JsangoError {
  public readonly exitCode: ExitCode;

  public constructor(options: CliErrorOptions) {
    super({
      code: options.code,
      message: options.message,
      cause: options.cause,
      metadata: options.metadata,
      statusCode: 500,
    });
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? ExitCode.GENERAL_ERROR;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UsageError extends CliError {
  public constructor(message: string, code = 'ERR_CLI_USAGE', metadata?: Record<string, unknown>) {
    super({
      code,
      message,
      exitCode: ExitCode.USAGE_ERROR,
      metadata,
    });
    this.name = 'UsageError';
  }
}

export class CommandNotFoundError extends UsageError {
  public readonly commandName: string;
  public readonly suggestedCommand?: string | undefined;

  public constructor(commandName: string, suggestedCommand?: string) {
    const suggestionText = suggestedCommand ? ` Did you mean "${suggestedCommand}"?` : '';
    super(`Unknown command "${commandName}".${suggestionText}`, 'ERR_CLI_COMMAND_NOT_FOUND', {
      commandName,
      suggestedCommand,
    });
    this.name = 'CommandNotFoundError';
    this.commandName = commandName;
    this.suggestedCommand = suggestedCommand;
  }
}

export class UnknownOptionError extends UsageError {
  public readonly optionName: string;
  public readonly suggestedOption?: string | undefined;

  public constructor(optionName: string, suggestedOption?: string) {
    const suggestionText = suggestedOption ? ` Did you mean "${suggestedOption}"?` : '';
    super(`Unknown option "${optionName}".${suggestionText}`, 'ERR_CLI_UNKNOWN_OPTION', {
      optionName,
      suggestedOption,
    });
    this.name = 'UnknownOptionError';
    this.optionName = optionName;
    this.suggestedOption = suggestedOption;
  }
}

export class MissingArgumentError extends UsageError {
  public readonly argumentName: string;

  public constructor(argumentName: string) {
    super(`Missing required argument "${argumentName}".`, 'ERR_CLI_MISSING_ARGUMENT', {
      argumentName,
    });
    this.name = 'MissingArgumentError';
    this.argumentName = argumentName;
  }
}

export class InvalidOptionValueError extends UsageError {
  public readonly optionName: string;
  public readonly value: unknown;

  public constructor(optionName: string, value: unknown, reason: string) {
    super(`Invalid value for option "${optionName}": ${reason}`, 'ERR_CLI_INVALID_OPTION_VALUE', {
      optionName,
      value,
    });
    this.name = 'InvalidOptionValueError';
    this.optionName = optionName;
    this.value = value;
  }
}

export class ProjectNotFoundError extends CliError {
  public constructor(searchPath: string) {
    super({
      code: 'ERR_CLI_PROJECT_NOT_FOUND',
      message: `Could not locate a valid jsango project starting from "${searchPath}".`,
      exitCode: ExitCode.CONFIG_ERROR,
      metadata: { searchPath },
    });
    this.name = 'ProjectNotFoundError';
  }
}

export class DestructiveOperationError extends CliError {
  public constructor(message: string) {
    super({
      code: 'ERR_CLI_DESTRUCTIVE_CONFIRMATION_REQUIRED',
      message: `${message} Pass --yes or --force to proceed.`,
      exitCode: ExitCode.USAGE_ERROR,
    });
    this.name = 'DestructiveOperationError';
  }
}

export class InterruptedError extends CliError {
  public constructor(message = 'Operation interrupted by user.') {
    super({
      code: 'ERR_CLI_INTERRUPTED',
      message,
      exitCode: ExitCode.INTERRUPTED,
    });
    this.name = 'InterruptedError';
  }
}
