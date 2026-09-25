import { describe, it, expect } from 'vitest';
import { ArgParser } from '../public/parser.js';
import {
  InvalidOptionValueError,
  MissingArgumentError,
  UnknownOptionError,
} from '../public/errors.js';

describe('ArgParser', () => {
  describe('parseGlobalOptions', () => {
    it('should extract help and version flags', () => {
      const res = ArgParser.parseGlobalOptions(['--help', 'migrate']);
      expect(res.globals.help).toBe(true);
      expect(res.remaining).toEqual(['migrate']);

      const resShort = ArgParser.parseGlobalOptions(['-v']);
      expect(resShort.globals.version).toBe(true);
      expect(resShort.remaining).toEqual([]);
    });

    it('should extract json, quiet, verbose, no-color, and env', () => {
      const res = ArgParser.parseGlobalOptions([
        '--json',
        '--quiet',
        '--verbose',
        '--no-color',
        '--env=staging',
        'route:list',
      ]);
      expect(res.globals.json).toBe(true);
      expect(res.globals.quiet).toBe(true);
      expect(res.globals.verbose).toBe(true);
      expect(res.globals.noColor).toBe(true);
      expect(res.globals.env).toBe('staging');
      expect(res.remaining).toEqual(['route:list']);
    });
  });

  describe('parse', () => {
    it('should parse positional arguments', () => {
      const argDefs = [
        { name: 'name', description: 'Model name', required: true, type: 'string' as const },
        {
          name: 'count',
          description: 'Count',
          required: false,
          type: 'number' as const,
          default: 10,
        },
      ];

      const parsed = ArgParser.parse(['User', '42'], argDefs, []);
      expect(parsed.args).toEqual(['User', 42]);

      const parsedDefault = ArgParser.parse(['User'], argDefs, []);
      expect(parsedDefault.args).toEqual(['User', 10]);
    });

    it('should throw MissingArgumentError if required argument is missing', () => {
      const argDefs = [
        { name: 'name', description: 'Model name', required: true, type: 'string' as const },
      ];
      expect(() => ArgParser.parse([], argDefs, [])).toThrow(MissingArgumentError);
    });

    it('should support variadic arguments', () => {
      const argDefs = [
        { name: 'cmd', description: 'Subcommand', required: true, type: 'string' as const },
        { name: 'files', description: 'Files', variadic: true, type: 'string' as const },
      ];

      const parsed = ArgParser.parse(['lint', 'file1.ts', 'file2.ts', 'file3.ts'], argDefs, []);
      expect(parsed.args).toEqual(['lint', 'file1.ts', 'file2.ts', 'file3.ts']);
    });

    it('should parse long and short options', () => {
      const optDefs = [
        { name: 'target', short: 't', description: 'Target', type: 'string' as const },
        { name: 'steps', short: 's', description: 'Steps', type: 'number' as const },
        { name: 'force', short: 'f', description: 'Force', type: 'boolean' as const },
      ];

      const parsed = ArgParser.parse(['-t', '002_migration', '--steps=3', '--force'], [], optDefs);

      expect(parsed.options['target']).toBe('002_migration');
      expect(parsed.options['steps']).toBe(3);
      expect(parsed.options['force']).toBe(true);
    });

    it('should support boolean negation with --no-flag', () => {
      const optDefs = [
        { name: 'cache', description: 'Enable cache', type: 'boolean' as const, default: true },
      ];

      const parsed = ArgParser.parse(['--no-cache'], [], optDefs);
      expect(parsed.options['cache']).toBe(false);
    });

    it('should validate enum choices', () => {
      const optDefs = [
        {
          name: 'dialect',
          description: 'SQL dialect',
          type: 'enum' as const,
          choices: ['postgres', 'mysql', 'sqlite', 'memory'],
        },
      ];

      const valid = ArgParser.parse(['--dialect=postgres'], [], optDefs);
      expect(valid.options['dialect']).toBe('postgres');

      expect(() => ArgParser.parse(['--dialect=oracle'], [], optDefs)).toThrow(
        InvalidOptionValueError
      );
    });

    it('should support array/repeated options', () => {
      const optDefs = [{ name: 'include', description: 'Include path', type: 'array' as const }];

      const parsed = ArgParser.parse(['--include', 'src', '--include', 'tests'], [], optDefs);
      expect(parsed.options['include']).toEqual(['src', 'tests']);
    });

    it('should throw UnknownOptionError with suggestion for typos', () => {
      const optDefs = [
        { name: 'connection', description: 'Connection name', type: 'string' as const },
      ];

      expect(() => ArgParser.parse(['--conn=default'], [], optDefs)).toThrow(UnknownOptionError);

      try {
        ArgParser.parse(['--connecton=default'], [], optDefs);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(UnknownOptionError);
        expect((err as UnknownOptionError).suggestedOption).toBe('--connection');
      }
    });
  });
});
