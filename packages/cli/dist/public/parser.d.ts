import { type ArgumentDefinition, type OptionDefinition, type ParsedArgs } from './types.js';
export interface GlobalOptions {
    help: boolean;
    version: boolean;
    json: boolean;
    quiet: boolean;
    verbose: boolean;
    noColor: boolean;
    env?: string | undefined;
}
export declare const GLOBAL_OPTIONS: readonly OptionDefinition[];
export declare class ArgParser {
    /**
     * Extracts global CLI options regardless of command.
     */
    static parseGlobalOptions(argv: readonly string[]): {
        globals: GlobalOptions;
        remaining: string[];
    };
    /**
     * Parses arguments and options against a command definition.
     */
    static parse(argv: readonly string[], argDefs?: readonly ArgumentDefinition[], optDefs?: readonly OptionDefinition[]): ParsedArgs;
    private static assignOptionValue;
    private static coerceArgument;
}
//# sourceMappingURL=parser.d.ts.map