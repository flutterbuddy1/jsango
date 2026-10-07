import * as fs from 'node:fs';
import * as path from 'node:path';

const START = '<!-- jsango:start -->';
const END = '<!-- jsango:end -->';

/** The jsango section of AGENTS.md (packages/cli/templates/AGENTS.md, shipped with the package). */
export function agentsTemplate(): string {
  return fs.readFileSync(new URL('../../templates/AGENTS.md', import.meta.url), 'utf8');
}

export interface AgentFileResult {
  readonly file: string;
  readonly action: 'created' | 'updated' | 'unchanged';
}

/**
 * Writes the instructions AI coding agents read: AGENTS.md (Codex, Cursor, Copilot, ...) and a
 * CLAUDE.md that imports it (Claude Code). Existing files keep their own content: only the section
 * between the jsango markers is added or replaced.
 */
export function writeAgentFiles(dir: string): AgentFileResult[] {
  const section = agentsTemplate().trim();
  const results: AgentFileResult[] = [];

  const agentsPath = path.join(dir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, section + '\n', 'utf8');
    results.push({ file: 'AGENTS.md', action: 'created' });
  } else {
    const current = fs.readFileSync(agentsPath, 'utf8');
    const start = current.indexOf(START);
    const end = current.indexOf(END, start);
    const next =
      start !== -1 && end !== -1
        ? current.slice(0, start) + section + current.slice(end + END.length)
        : current.trimEnd() + '\n\n' + section + '\n';
    if (next !== current) fs.writeFileSync(agentsPath, next, 'utf8');
    results.push({ file: 'AGENTS.md', action: next === current ? 'unchanged' : 'updated' });
  }

  const claudePath = path.join(dir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    fs.writeFileSync(claudePath, '@AGENTS.md\n', 'utf8');
    results.push({ file: 'CLAUDE.md', action: 'created' });
  } else if (!/^@AGENTS\.md\s*$/m.test(fs.readFileSync(claudePath, 'utf8'))) {
    fs.appendFileSync(claudePath, '\n@AGENTS.md\n', 'utf8');
    results.push({ file: 'CLAUDE.md', action: 'updated' });
  } else {
    results.push({ file: 'CLAUDE.md', action: 'unchanged' });
  }
  return results;
}
