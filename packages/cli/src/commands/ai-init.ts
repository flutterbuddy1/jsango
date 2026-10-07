import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { writeAgentFiles } from '../internal/agent-files.js';

export class AiInitCommand extends BaseCommand {
  public readonly name = 'ai:init';
  public readonly description = 'Add or update AGENTS.md / CLAUDE.md so AI coding agents build with jsango';
  public readonly usage = 'jsango ai:init';
  public readonly aliases = ['ai:setup'];

  public async execute(context: CommandContext): Promise<number> {
    const results = writeAgentFiles(context.cwd);
    if (context.output.isJson) {
      context.output.json({ files: results });
      return ExitCode.SUCCESS;
    }
    for (const r of results) context.output.success(`${r.file}: ${r.action}`);
    context.output.text();
    context.output.text('AI coding agents (Claude Code, Cursor, Copilot, Codex, ...) now read the jsango rules from AGENTS.md.');
    context.output.text('Run it again after upgrading jsango to refresh them.');
    return ExitCode.SUCCESS;
  }
}
