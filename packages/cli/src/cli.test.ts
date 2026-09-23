import { describe, it, expect } from 'vitest';
import type { ICommand, CommandContext } from './index.js';

describe('@django-js/cli', () => {
  it('should support typing mock CLI commands', async () => {
    class MockVersionCommand implements ICommand {
      readonly name = 'version';
      readonly description = 'Display framework version';

      async execute(_ctx: CommandContext): Promise<number> {
        return 0;
      }
    }

    const cmd = new MockVersionCommand();
    expect(cmd.name).toBe('version');
    const exitCode = await cmd.execute({ args: [], flags: {}, cwd: '.' });
    expect(exitCode).toBe(0);
  });
});
