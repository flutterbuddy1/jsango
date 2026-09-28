import { JsangoError } from '@jsango/core';
import { ExitCode } from './types.js';
export interface CliErrorOptions {
    readonly code: string;
    readonly message: string;
    readonly exitCode?: ExitCode | undefined;
    readonly cause?: unknown;
    readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
export declare class CliError extends JsangoError {
    readonly exitCode: ExitCode;
    constructor(options: CliErrorOptions);
}
export declare class UsageError extends CliError {
    constructor(message: string, code?: string, metadata?: Record<string, unknown>);
}
export declare class CommandNotFoundError extends UsageError {
    readonly commandName: string;
    readonly suggestedCommand?: string | undefined;
    constructor(commandName: string, suggestedCommand?: string);
}
export declare class UnknownOptionError extends UsageError {
    readonly optionName: string;
    readonly suggestedOption?: string | undefined;
    constructor(optionName: string, suggestedOption?: string);
}
export declare class MissingArgumentError extends UsageError {
    readonly argumentName: string;
    constructor(argumentName: string);
}
export declare class InvalidOptionValueError extends UsageError {
    readonly optionName: string;
    readonly value: unknown;
    constructor(optionName: string, value: unknown, reason: string);
}
export declare class ProjectNotFoundError extends CliError {
    constructor(searchPath: string);
}
export declare class DestructiveOperationError extends CliError {
    constructor(message: string);
}
export declare class InterruptedError extends CliError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map