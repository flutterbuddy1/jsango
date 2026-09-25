import { describe, it, expect } from 'vitest';
import { CliApplication } from '../public/app.js';
import { CliOutput } from '../public/output.js';
import { ExitCode } from '../public/types.js';

describe('OpenAPI and Observability CLI Commands', () => {
  it('should run openapi:generate and return JSON document', async () => {
    const app = CliApplication.createDefault();
    const output = new CliOutput({ mode: 'json', color: false });

    const code = await app.run(['openapi:generate'], output);
    expect(code).toBe(ExitCode.SUCCESS);
  });

  it('should run openapi:validate and return valid status for empty app', async () => {
    const app = CliApplication.createDefault();
    const output = new CliOutput({ mode: 'json', color: false });

    const code = await app.run(['openapi:validate'], output);
    expect(code).toBe(ExitCode.SUCCESS);
  });

  it('should run health check command', async () => {
    const app = CliApplication.createDefault();
    const output = new CliOutput({ mode: 'json', color: false });

    const code = await app.run(['health'], output);
    expect(code).toBe(ExitCode.SUCCESS);
  });

  it('should run metrics command', async () => {
    const app = CliApplication.createDefault();
    const output = new CliOutput({ mode: 'json', color: false });

    const code = await app.run(['metrics'], output);
    expect(code).toBe(ExitCode.SUCCESS);
  });

  it('should run diagnostics command', async () => {
    const app = CliApplication.createDefault();
    const output = new CliOutput({ mode: 'json', color: false });

    const code = await app.run(['diagnostics'], output);
    expect(code).toBe(ExitCode.SUCCESS);
  });
});
