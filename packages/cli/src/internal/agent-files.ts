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
  readonly action: 'created' | 'updated' | 'unchanged' | 'skipped';
}

/**
 * Writes what AI coding agents read: AGENTS.md (Codex, Cursor, Copilot, ...), a CLAUDE.md that imports
 * it (Claude Code), and MCP configs that start `jsango mcp`. Existing files keep their own content: only
 * the section between the jsango markers / the `jsango` server entry is added or replaced.
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

  // MCP server (`jsango mcp`) for the editors that read project-level config.
  const server = { command: 'npx', args: ['jsango', 'mcp'] };
  results.push(mergeJson(dir, '.mcp.json', 'mcpServers', server)); // Claude Code
  results.push(mergeJson(dir, '.cursor/mcp.json', 'mcpServers', server)); // Cursor
  results.push(mergeJson(dir, '.vscode/mcp.json', 'servers', { type: 'stdio', ...server })); // VS Code / Copilot
  return results;
}

/** Adds the `jsango` server under `key` without touching the rest of an existing config file. */
function mergeJson(
  dir: string,
  file: string,
  key: string,
  server: Record<string, unknown>
): AgentFileResult {
  const full = path.join(dir, file);
  let config: Record<string, Record<string, unknown>> = {};
  if (fs.existsSync(full)) {
    try {
      config = JSON.parse(fs.readFileSync(full, 'utf8')) as typeof config;
    } catch {
      return { file, action: 'skipped' }; // JSON with comments or invalid: leave it to the user
    }
    if (JSON.stringify(config[key]?.['jsango']) === JSON.stringify(server))
      return { file, action: 'unchanged' };
  }
  const existed = fs.existsSync(full);
  config[key] = { ...config[key], jsango: server };
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { file, action: existed ? 'updated' : 'created' };
}
