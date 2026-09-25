import { describe, it, expect } from 'vitest';
import { CliOutput } from '../public/output.js';

describe('CliOutput', () => {
  it('should route normal text and tables to stdout', () => {
    let stdoutData = '';
    let stderrData = '';

    const output = new CliOutput({
      color: false,
      stdout: {
        write: (str: string) => {
          stdoutData += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderrData += str;
        },
      },
    });

    output.text('Hello World');
    output.success('Saved');
    output.table(['A', 'B'], [['1', '2']]);

    expect(stdoutData).toContain('Hello World');
    expect(stdoutData).toContain('Saved');
    expect(stdoutData).toContain('A');
    expect(stdoutData).toContain('1');
    expect(stderrData).toBe('');
  });

  it('should route warnings, errors, and info to stderr', () => {
    let stdoutData = '';
    let stderrData = '';

    const output = new CliOutput({
      color: false,
      stdout: {
        write: (str: string) => {
          stdoutData += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderrData += str;
        },
      },
    });

    output.info('Connecting');
    output.warn('Low disk');
    output.error('Fatal crash');

    expect(stdoutData).toBe('');
    expect(stderrData).toContain('Connecting');
    expect(stderrData).toContain('Low disk');
    expect(stderrData).toContain('Fatal crash');
  });

  it('should output clean JSON without stdout pollution in json mode', () => {
    let stdoutData = '';
    let _stderrData = '';

    const output = new CliOutput({
      mode: 'json',
      color: false,
      stdout: {
        write: (str: string) => {
          stdoutData += str;
        },
      },
      stderr: {
        write: (str: string) => {
          _stderrData += str;
        },
      },
    });

    output.text('Should be suppressed in stdout');
    output.success('Suppressed');
    output.json({ foo: 'bar', count: 42 });

    expect(stdoutData).not.toContain('Should be suppressed');
    expect(stdoutData).not.toContain('Suppressed');

    const parsed = JSON.parse(stdoutData.trim()) as Record<string, unknown>;
    expect(parsed).toEqual({ foo: 'bar', count: 42 });
  });

  it('should suppress non-errors in quiet mode', () => {
    let stdoutData = '';
    let stderrData = '';

    const output = new CliOutput({
      mode: 'quiet',
      color: false,
      stdout: {
        write: (str: string) => {
          stdoutData += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderrData += str;
        },
      },
    });

    output.text('Normal text');
    output.success('Success');
    output.info('Info');
    output.warn('Warning');
    output.error('Critical failure');

    expect(stdoutData).toBe('');
    expect(stderrData).not.toContain('Info');
    expect(stderrData).not.toContain('Warning');
    expect(stderrData).toContain('Critical failure');
  });
});
