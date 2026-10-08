import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levenshteinDistance } from '../leven.js';

/** One exported declaration from jsango's type definitions. */
export interface ApiEntry {
  readonly name: string;
  readonly kind: string;
  readonly pkg: string;
  readonly file: string;
  /** Declaration text with its JSDoc. */
  readonly text: string;
}

const MAX_OUTPUT = 9000;

/**
 * Index of every export in the installed jsango packages, read from their `.d.ts` files, so an AI
 * agent sees the real signatures of the version this project uses instead of guessing.
 */
export class ApiIndex {
  private readonly entries = new Map<string, ApiEntry[]>();

  public constructor(dtsFiles: ReadonlyArray<{ pkg: string; file: string; text: string }>) {
    for (const { pkg, file, text } of dtsFiles) {
      for (const decl of scanDeclarations(text)) {
        const list = this.entries.get(decl.name) ?? [];
        // Re-declared in several packages (re-exports): keep one per package.
        if (!list.some((e) => e.pkg === pkg && e.text === decl.text))
          list.push({ ...decl, pkg, file });
        this.entries.set(decl.name, list);
      }
    }
  }

  /** Finds the installed jsango packages from `cwd` (the project) and indexes them. */
  public static forProject(cwd: string): ApiIndex {
    return new ApiIndex(collectDtsFiles(cwd));
  }

  public get size(): number {
    return this.entries.size;
  }

  public names(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * `createAuth`, `Auth.login`, `fields.string`, ... Returns the declaration(s), or suggestions when
   * the name doesn't exist.
   */
  public lookup(query: string): string {
    const [base = '', member] = query.trim().split('.', 2) as [string, string | undefined];
    const found =
      this.entries.get(base) ??
      [...this.entries.entries()].find(([n]) => n.toLowerCase() === base.toLowerCase())?.[1];
    if (!found) {
      return `No export named "${base}" in jsango.${this.suggest(base)}`;
    }

    const parts: string[] = [];
    for (const entry of found) {
      let text = entry.text;
      if (member) {
        const members = splitMembers(entry.text);
        const matches = members.filter((m) => m.name === member);
        if (matches.length === 0) {
          const names = [...new Set(members.map((m) => m.name))];
          const close = names
            .map((n) => [n, levenshteinDistance(n.toLowerCase(), member.toLowerCase())] as const)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 5)
            .map(([n]) => n);
          parts.push(
            `${entry.kind} ${entry.name} has no member "${member}". Did you mean: ${close.join(', ')}?\nMembers: ${names.join(', ')}`
          );
          continue;
        }
        text = matches.map((m) => m.text).join('\n');
      } else if (text.length > MAX_OUTPUT) {
        text = outline(entry);
      }
      parts.push(
        `// ${entry.kind} ${entry.name}${member ? `.${member}` : ''} from ${entry.pkg}\n${text}`
      );
    }
    const out = parts.join('\n\n');
    return out.length > MAX_OUTPUT
      ? out.slice(0, MAX_OUTPUT) + '\n… (truncated; ask for a member, e.g. Name.method)'
      : out;
  }

  private suggest(name: string): string {
    const lower = name.toLowerCase();
    const scored = this.names()
      .map((n) => {
        const l = n.toLowerCase();
        const score =
          l.includes(lower) || (lower.length > 3 && lower.includes(l))
            ? 0
            : levenshteinDistance(l, lower);
        return [n, score] as const;
      })
      .filter(([, s]) => s <= Math.max(3, Math.floor(name.length / 2)))
      .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length)
      .slice(0, 8)
      .map(([n]) => n);
    return scored.length ? ` Did you mean: ${scored.join(', ')}?` : '';
  }
}

/** Class/interface body as member signatures only (no JSDoc), for very large declarations. */
function outline(entry: ApiEntry): string {
  const members = splitMembers(entry.text);
  const head = entry.text
    .slice(0, entry.text.indexOf('{') + 1)
    .replace(/\/\*\*[\s\S]*?\*\/\s*/g, '');
  return `${head}\n${members.map((m) => '    ' + m.signature).join('\n')}\n}\n// Ask for ${entry.name}.<member> to see a member's documentation.`;
}

// ---------------------------------------------------------------------------
// .d.ts scanning
// ---------------------------------------------------------------------------

const DECL =
  /^export\s+(?:declare\s+)?(?:abstract\s+)?(function|class|interface|type|const|let|var|enum|namespace)\s+([A-Za-z_$][\w$]*)/;

/** Splits a .d.ts into top-level exported declarations (with the JSDoc right before them). */
export function scanDeclarations(
  text: string
): Array<{ name: string; kind: string; text: string }> {
  const out: Array<{ name: string; kind: string; text: string }> = [];
  let i = 0;
  let doc = '';
  while (i < text.length) {
    if (/\s/.test(text[i]!)) {
      i++;
      continue;
    }
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      doc = text.startsWith('/**', i) ? text.slice(i, stop) : doc;
      i = stop;
      continue;
    }
    if (text.startsWith('//', i)) {
      i = nextLine(text, i);
      continue;
    }
    const end = statementEnd(text, i);
    const stmt = text.slice(i, end).trim();
    const m = DECL.exec(stmt);
    if (m) out.push({ kind: m[1]!, name: m[2]!, text: (doc ? doc + '\n' : '') + stmt });
    doc = '';
    i = end;
  }
  return out;
}

function nextLine(text: string, i: number): number {
  const n = text.indexOf('\n', i);
  return n === -1 ? text.length : n + 1;
}

/**
 * End of the statement starting at `start`: `;` at depth 0, or the closing brace of a block
 * declaration (class / interface / enum / namespace) that has no trailing semicolon.
 */
function statementEnd(text: string, start: number): number {
  let depth = 0;
  let sawBlock = false;
  const isBlockDecl =
    /^(export\s+)?(declare\s+)?(abstract\s+)?(class|interface|enum|namespace|module)\b/.test(
      text.slice(start, start + 80)
    );
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(text, i);
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      i = e === -1 ? text.length : e + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      i = nextLine(text, i) - 1;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') {
      depth++;
      if (c === '{') sawBlock = true;
    } else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0 && c === '}' && isBlockDecl && sawBlock) return i + 1;
    } else if (c === ';' && depth === 0) {
      return i + 1;
    }
  }
  return text.length;
}

function skipString(text: string, i: number): number {
  const q = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === q) return j;
  }
  return text.length;
}

const MEMBER =
  /^(?:(?:public|protected|static|readonly|abstract|declare|get|set|async)\s+)*([A-Za-z_$][\w$]*)\??\s*[<(:]/;

/** Members of a class/interface/object-type declaration, with their JSDoc. Private members are skipped. */
export function splitMembers(
  decl: string
): Array<{ name: string; text: string; signature: string }> {
  const open = decl.search(/[{]/);
  if (open === -1) return [];
  const members: Array<{ name: string; text: string; signature: string }> = [];
  let depth = 0;
  let segStart = open + 1;
  let doc = '';
  for (let i = open; i < decl.length; i++) {
    const c = decl[i]!;
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(decl, i);
      continue;
    }
    if (c === '/' && decl[i + 1] === '*') {
      const e = decl.indexOf('*/', i + 2);
      const stop = e === -1 ? decl.length : e + 2;
      if (depth === 1 && decl.startsWith('/**', i)) doc = decl.slice(i, stop);
      i = stop - 1;
      if (depth === 1) segStart = stop;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) break;
    } else if (c === ';' && depth === 1) {
      const signature = decl
        .slice(segStart, i + 1)
        .trim()
        .replace(/\s+/g, ' ');
      const m = MEMBER.exec(signature);
      if (m && !/^(private|#)/.test(signature)) {
        members.push({ name: m[1]!, signature, text: (doc ? doc + '\n' : '') + signature });
      }
      doc = '';
      segStart = i + 1;
    }
  }
  return members;
}

// ---------------------------------------------------------------------------
// Locating the installed packages
// ---------------------------------------------------------------------------

function findUp(from: string, rel: string): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    const candidate = path.join(dir, rel);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function listDts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'tests' && entry.name !== 'node_modules') out.push(...listDts(full));
    } else if (entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.d.ts')) out.push(full);
  }
  return out;
}

/** The jsango package and its @jsango/* dependencies: the project's copy first, else this CLI's. */
export function collectDtsFiles(cwd: string): Array<{ pkg: string; file: string; text: string }> {
  const self = path.dirname(fileURLToPath(import.meta.url));
  const jsangoDir = findUp(cwd, 'node_modules/jsango') ?? findUp(self, 'node_modules/jsango');
  const roots = new Map<string, string>();
  if (jsangoDir) {
    roots.set('jsango', jsangoDir);
    const deps = Object.keys(
      (
        JSON.parse(fs.readFileSync(path.join(jsangoDir, 'package.json'), 'utf8')) as {
          dependencies?: Record<string, string>;
        }
      ).dependencies ?? {}
    );
    for (const dep of deps.filter((d) => d.startsWith('@jsango/'))) {
      const dir = findUp(jsangoDir, `node_modules/${dep}`);
      if (dir) roots.set(dep, dir);
    }
  }
  // No project copy (global install or a checkout): index the packages next to this CLI's package.
  const cliDir = findUp(self, '.');
  if (roots.size === 0 && cliDir) {
    const siblings = path.dirname(cliDir);
    for (const name of fs.readdirSync(siblings)) {
      const pkgDir = path.join(siblings, name);
      if (fs.existsSync(path.join(pkgDir, 'dist')))
        roots.set(name === 'jsango' ? 'jsango' : `@jsango/${name}`, fs.realpathSync(pkgDir));
    }
  }
  const files: Array<{ pkg: string; file: string; text: string }> = [];
  for (const [pkg, dir] of roots) {
    for (const file of listDts(path.join(dir, 'dist'))) {
      files.push({ pkg, file: path.relative(dir, file), text: fs.readFileSync(file, 'utf8') });
    }
  }
  return files;
}
