/**
 * Every TypeScript snippet in the documentation must compile against the real `jsango` types,
 * so the docs can only show APIs that exist.
 *
 * Sources: site/docs.html (copy buttons), site/js/app.js (landing page), README.md,
 * docs/**\/*.md and packages/*\/README.md.
 *
 * Names a snippet uses without defining (e.g. `db`, `User`) are treated as `any`; what is checked
 * is every import, every exported function/class, and every method/option used on them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
// Inside packages/jsango so both 'jsango' and '@jsango/*' resolve like in a user project.
const WORK = path.join(ROOT, 'packages', 'jsango', `.doc-snippets-${process.pid}`);

interface Snippet {
  readonly source: string;
  readonly code: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function looksLikeTypeScript(code: string): boolean {
  return (
    /\b(import|export|const|let|await|function|class)\b/.test(code) &&
    !/^\s*(npx|npm|pnpm|curl|cd)\b/m.test(code.split('\n')[0] ?? '')
  );
}

function collect(): Snippet[] {
  const out: Snippet[] = [];

  const html = fs.readFileSync(path.join(ROOT, 'site/docs.html'), 'utf8');
  for (const m of html.matchAll(/data-copy="([^"]*)"/g)) {
    const code = decodeHtml(m[1]!);
    if (looksLikeTypeScript(code))
      out.push({ source: `site/docs.html:${html.slice(0, m.index).split('\n').length}`, code });
  }

  const app = fs.readFileSync(path.join(ROOT, 'site/js/app.js'), 'utf8');
  for (const m of app.matchAll(/snippet:\s*`((?:\\`|[^`])*)`/g)) {
    out.push({
      source: `site/js/app.js:${app.slice(0, m.index).split('\n').length}`,
      code: m[1]!.replace(/\\`/g, '`').replace(/\\\$/g, '$'),
    });
  }

  const markdown: string[] = [path.join(ROOT, 'README.md')];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) markdown.push(full);
    }
  };
  walk(path.join(ROOT, 'docs'));
  for (const pkg of fs.readdirSync(path.join(ROOT, 'packages'))) {
    const readme = path.join(ROOT, 'packages', pkg, 'README.md');
    if (fs.existsSync(readme)) markdown.push(readme);
  }
  markdown.push(path.join(ROOT, 'packages', 'cli', 'templates', 'AGENTS.md')); // AI agent rules

  for (const file of markdown) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)) {
      out.push({
        source: `${path.relative(ROOT, file)}:${text.slice(0, m.index).split('\n').length}`,
        code: m[1]!,
      });
    }
  }
  return out;
}

// Diagnostics about the snippet's own free variables, placeholders and style are not API errors.
const IGNORED = new Set([
  2304, // Cannot find name 'db' (snippet context)
  2552, // Cannot find name (did you mean)
  2580, // Cannot find name 'require'
  7006,
  7005,
  7031,
  7034,
  7053, // implicit any
  6133,
  6192,
  6196, // unused
  2451, // redeclare block-scoped variable across snippets in one file
  1375,
  1378, // top-level await settings
  2307, // module not found is reported separately below for non-jsango modules
  18048,
  18047,
  2532,
  2531, // possibly undefined/null (snippets skip guards)
]);

function check(snippets: readonly Snippet[]): string[] {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const files = snippets.map((s, i) => {
    const file = path.join(WORK, `snippet_${i}.ts`);
    // `export {}` makes each snippet its own module so names do not collide.
    fs.writeFileSync(file, `${s.code}\nexport {};\n`);
    return file;
  });

  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: false,
    noImplicitAny: false,
    skipLibCheck: true,
    noEmit: true,
    types: ['node'],
    typeRoots: [path.join(ROOT, 'node_modules', '@types')],
    // Resolve every workspace package, including ones the jsango facade does not depend on.
    baseUrl: path.join(ROOT, 'packages'),
    paths: { '@jsango/*': ['./*/dist/index.d.ts'], jsango: ['./jsango/dist/index.d.ts'] },
  });

  const problems: string[] = [];
  for (const diag of ts.getPreEmitDiagnostics(program)) {
    if (!diag.file || !diag.file.fileName.startsWith(WORK)) continue;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    if (diag.code === 2307 && !/'(jsango|@jsango\/[^']+)'/.test(message)) continue;
    if (IGNORED.has(diag.code) && diag.code !== 2307) continue;
    const index = Number(path.basename(diag.file.fileName).match(/snippet_(\d+)/)![1]);
    const { line } = diag.file.getLineAndCharacterOfPosition(diag.start ?? 0);
    const snippet = snippets[index]!;
    const [src, startLine] = snippet.source.split(':');
    problems.push(`${src}:${Number(startLine) + line} TS${diag.code}: ${message.split('\n')[0]}`);
  }
  fs.rmSync(WORK, { recursive: true, force: true });
  return problems;
}

describe('documentation snippets', () => {
  it('only use APIs that exist', () => {
    const snippets = collect();
    expect(snippets.length).toBeGreaterThan(50);
    const problems = check(snippets);
    if (process.env['DOCS_REPORT'])
      fs.writeFileSync(process.env['DOCS_REPORT'], problems.join('\n'));
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  }, 120_000);
});
