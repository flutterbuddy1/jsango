/**
 * What AI coding agents read: the AGENTS.md rules (written by `jsango new` / `jsango ai:init`)
 * and the llms.txt files published with the docs. Its code snippets are type-checked by
 * docs-snippets.test.ts; here we check the files are written safely and only mention real commands.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CliApplication, CliOutput } from '../packages/cli/dist/index.js';
// @ts-expect-error plain ESM script without types
import { buildLlms, GUIDES } from '../scripts/build-llms.mjs';

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'packages/cli/templates/AGENTS.md'), 'utf8');
const dirs: string[] = [];

async function aiInit(cwd: string) {
  const output = new CliOutput({
    color: false,
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  });
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await CliApplication.createDefault().run(['ai:init'], output);
  } finally {
    process.chdir(previous);
  }
}

const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsango-ai-'));
  dirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe('jsango ai:init', () => {
  it('creates AGENTS.md and a CLAUDE.md that imports it', async () => {
    const dir = tmp();
    expect(await aiInit(dir)).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).toBe(TEMPLATE.trim() + '\n');
    expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
  });

  it("keeps the project's own instructions and refreshes only the jsango section", async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Team rules\n\nUse tabs.\n');
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Claude notes\n');
    await aiInit(dir);
    const once = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    expect(once.startsWith('# Team rules\n\nUse tabs.\n\n<!-- jsango:start -->')).toBe(true);

    // An outdated jsango section is replaced in place; running again changes nothing.
    fs.writeFileSync(
      path.join(dir, 'AGENTS.md'),
      once.replace(
        /<!-- jsango:start -->[\s\S]*<!-- jsango:end -->/,
        '<!-- jsango:start -->\nold\n<!-- jsango:end -->'
      ) + '\nFooter\n'
    );
    await aiInit(dir);
    await aiInit(dir);
    const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    expect(agents).not.toContain('\nold\n');
    expect(agents.match(/jsango:start/g)).toHaveLength(1);
    expect(agents.endsWith('\nFooter\n')).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe(
      '# Claude notes\n\n@AGENTS.md\n'
    );
  });

  it('only mentions CLI commands that exist', () => {
    const registry = CliApplication.createDefault().registry;
    const commands = [...TEMPLATE.matchAll(/npx jsango ([a-z][\w:-]*)/g)].map((m) => m[1]!);
    expect(commands.length).toBeGreaterThan(5);
    for (const name of commands) expect(registry.has(name), name).toBe(true);
  });
});

describe('llms.txt', () => {
  it('lists every guide and bundles them with the agent rules', () => {
    const { llms, full } = buildLlms();
    for (const [rel] of GUIDES as [string][]) {
      expect(
        fs.existsSync(path.join(ROOT, rel)),
        `${rel} is listed in scripts/build-llms.mjs but missing`
      ).toBe(true);
      expect(llms).toContain(`/${rel})`);
      expect(full).toContain(`<!-- source: ${rel} `);
    }
    expect(llms.startsWith('# jsango\n\n> ')).toBe(true);
    expect(full).toContain('## Which API to use');
    expect(full).not.toContain('jsango:start');
  });
});
