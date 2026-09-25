import { type ArgumentDefinition, type OptionDefinition, type ParsedArgs } from './types.js';
import { InvalidOptionValueError, MissingArgumentError, UnknownOptionError } from './errors.js';
import { findClosest } from '../internal/leven.js';

export interface GlobalOptions {
  help: boolean;
  version: boolean;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  noColor: boolean;
  env?: string | undefined;
}

export const GLOBAL_OPTIONS: readonly OptionDefinition[] = [
  { name: 'help', short: 'h', description: 'Display help information', type: 'boolean' },
  { name: 'version', short: 'v', description: 'Display framework version', type: 'boolean' },
  { name: 'json', description: 'Output in machine-readable JSON format', type: 'boolean' },
  { name: 'quiet', short: 'q', description: 'Suppress non-essential output', type: 'boolean' },
  { name: 'verbose', description: 'Enable verbose diagnostic output', type: 'boolean' },
  { name: 'no-color', description: 'Disable ANSI terminal colors', type: 'boolean' },
  { name: 'env', description: 'Specify environment name (e.g. production)', type: 'string' },
];

export class ArgParser {
  /**
   * Extracts global CLI options regardless of command.
   */
  public static parseGlobalOptions(argv: readonly string[]): {
    globals: GlobalOptions;
    remaining: string[];
  } {
    const globals: GlobalOptions = {
      help: false,
      version: false,
      json: false,
      quiet: false,
      verbose: false,
      noColor: false,
      env: undefined,
    };

    const remaining: string[] = [];

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]!;

      if (arg === '--help' || arg === '-h') {
        globals.help = true;
      } else if (arg === '--version' || arg === '-v') {
        globals.version = true;
      } else if (arg === '--json') {
        globals.json = true;
      } else if (arg === '--quiet' || arg === '-q') {
        globals.quiet = true;
      } else if (arg === '--verbose') {
        globals.verbose = true;
      } else if (arg === '--no-color') {
        globals.noColor = true;
      } else if (arg.startsWith('--env=')) {
        globals.env = arg.slice(6);
      } else if (arg === '--env') {
        if (i + 1 < argv.length) {
          globals.env = argv[++i];
        }
      } else {
        remaining.push(arg);
      }
    }

    return { globals, remaining };
  }

  /**
   * Parses arguments and options against a command definition.
   */
  public static parse(
    argv: readonly string[],
    argDefs: readonly ArgumentDefinition[] = [],
    optDefs: readonly OptionDefinition[] = []
  ): ParsedArgs {
    const options: Record<string, unknown> = {};
    const positional: (string | number | boolean)[] = [];

    // Map allowed options by long name and short name
    const allOptDefs = [...optDefs, ...GLOBAL_OPTIONS];
    const nameMap = new Map<string, OptionDefinition>();
    const shortMap = new Map<string, OptionDefinition>();

    for (const opt of allOptDefs) {
      nameMap.set(opt.name, opt);
      if (opt.short) {
        shortMap.set(opt.short, opt);
      }
      if (opt.default !== undefined) {
        options[opt.name] = opt.default;
      }
    }

    let i = 0;
    let endOfOptions = false;

    while (i < argv.length) {
      const token = argv[i]!;

      if (endOfOptions) {
        positional.push(token);
        i++;
        continue;
      }

      if (token === '--') {
        endOfOptions = true;
        i++;
        continue;
      }

      // Long options: --name or --name=value or --no-name
      if (token.startsWith('--')) {
        const eqIdx = token.indexOf('=');
        let optName: string;
        let inlineVal: string | undefined;

        if (eqIdx !== -1) {
          optName = token.slice(2, eqIdx);
          inlineVal = token.slice(eqIdx + 1);
        } else {
          optName = token.slice(2);
        }

        // Check if boolean negation --no-xxx
        let isNegated = false;
        let matchedDef = nameMap.get(optName);

        if (!matchedDef && optName.startsWith('no-')) {
          const positiveName = optName.slice(3);
          const positiveDef = nameMap.get(positiveName);
          if (positiveDef && positiveDef.type === 'boolean') {
            matchedDef = positiveDef;
            optName = positiveName;
            isNegated = true;
          }
        }

        if (!matchedDef) {
          const allowedNames = [...nameMap.keys()].map((n) => `--${n}`);
          const closest = findClosest(`--${optName}`, allowedNames);
          throw new UnknownOptionError(`--${optName}`, closest);
        }

        if (matchedDef.type === 'boolean') {
          options[matchedDef.name] = !isNegated;
          i++;
        } else {
          let rawVal: string;
          if (inlineVal !== undefined) {
            rawVal = inlineVal;
            i++;
          } else {
            if (i + 1 >= argv.length || argv[i + 1]!.startsWith('-')) {
              throw new InvalidOptionValueError(
                `--${optName}`,
                undefined,
                'Value must be provided.'
              );
            }
            rawVal = argv[++i]!;
            i++;
          }

          ArgParser.assignOptionValue(options, matchedDef, rawVal);
        }
        continue;
      }

      // Short options: -o or -o=val or -o val
      if (token.startsWith('-') && token.length > 1 && !/^[0-9]/.test(token.charAt(1))) {
        const shortName = token.slice(1, 2);
        const rest = token.slice(2);

        const matchedDef = shortMap.get(shortName);
        if (!matchedDef) {
          const allowedShorts = [...shortMap.keys()].map((s) => `-${s}`);
          const closest = findClosest(`-${shortName}`, allowedShorts);
          throw new UnknownOptionError(`-${shortName}`, closest);
        }

        if (matchedDef.type === 'boolean') {
          options[matchedDef.name] = true;
          // If bundled flags (e.g. -qv), not supported in this lightweight parser; individual flags preferred
          i++;
        } else {
          let rawVal: string;
          if (rest.startsWith('=')) {
            rawVal = rest.slice(1);
            i++;
          } else if (rest.length > 0) {
            rawVal = rest;
            i++;
          } else {
            if (i + 1 >= argv.length || argv[i + 1]!.startsWith('-')) {
              throw new InvalidOptionValueError(
                `-${shortName}`,
                undefined,
                'Value must be provided.'
              );
            }
            rawVal = argv[++i]!;
            i++;
          }

          ArgParser.assignOptionValue(options, matchedDef, rawVal);
        }
        continue;
      }

      // Positional argument
      positional.push(token);
      i++;
    }

    // Validate required options
    for (const opt of optDefs) {
      if (opt.required && options[opt.name] === undefined) {
        throw new InvalidOptionValueError(`--${opt.name}`, undefined, 'This option is required.');
      }
    }

    // Coerce & map positional arguments
    const finalArgs: (string | number | boolean)[] = [];
    for (let aIdx = 0; aIdx < argDefs.length; aIdx++) {
      const def = argDefs[aIdx]!;
      if (def.variadic) {
        const variadicSlice = positional.slice(aIdx);
        if (def.required && variadicSlice.length === 0) {
          throw new MissingArgumentError(def.name);
        }
        for (const item of variadicSlice) {
          finalArgs.push(ArgParser.coerceArgument(item, def.type));
        }
        break;
      } else {
        const val = positional[aIdx];
        if (val === undefined) {
          if (def.required) {
            throw new MissingArgumentError(def.name);
          }
          if (def.default !== undefined) {
            finalArgs.push(ArgParser.coerceArgument(def.default as string, def.type));
          }
        } else {
          finalArgs.push(ArgParser.coerceArgument(val, def.type));
        }
      }
    }

    // If more positional arguments than defined and not variadic, keep them
    if (
      positional.length > argDefs.length &&
      !(argDefs.length > 0 && argDefs[argDefs.length - 1]!.variadic)
    ) {
      for (let extraIdx = argDefs.length; extraIdx < positional.length; extraIdx++) {
        finalArgs.push(positional[extraIdx]!);
      }
    }

    return {
      args: Object.freeze(finalArgs),
      options: Object.freeze(options),
      raw: Object.freeze([...argv]),
    };
  }

  private static assignOptionValue(
    options: Record<string, unknown>,
    def: OptionDefinition,
    rawVal: string
  ): void {
    if (def.type === 'number') {
      const num = Number(rawVal);
      if (Number.isNaN(num)) {
        throw new InvalidOptionValueError(`--${def.name}`, rawVal, 'Must be a valid number.');
      }
      options[def.name] = num;
    } else if (def.type === 'enum') {
      if (def.choices && !def.choices.includes(rawVal)) {
        throw new InvalidOptionValueError(
          `--${def.name}`,
          rawVal,
          `Must be one of: ${def.choices.join(', ')}.`
        );
      }
      options[def.name] = rawVal;
    } else if (def.type === 'array') {
      const existing = (options[def.name] as string[]) || [];
      existing.push(rawVal);
      options[def.name] = existing;
    } else {
      // string
      options[def.name] = rawVal;
    }
  }

  private static coerceArgument(
    val: string | number | boolean,
    type?: 'string' | 'number' | 'boolean'
  ): string | number | boolean {
    if (type === 'number') {
      const n = Number(val);
      if (Number.isNaN(n)) {
        throw new MissingArgumentError(`Expected number but got "${val}".`);
      }
      return n;
    }
    if (type === 'boolean') {
      return val === 'true' || val === true || val === '1';
    }
    return String(val);
  }
}
