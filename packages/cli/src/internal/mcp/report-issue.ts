import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const ISSUES_REPO = 'flutterbuddy1/jsango';
/** GitHub rejects very long new-issue URLs; keep the prefilled body well under that. */
const MAX_URL = 7500;

export interface IssueDraftInput {
  readonly kind: 'bug' | 'missing-feature' | 'docs';
  readonly title: string;
  readonly summary: string;
  readonly reproduction?: string | undefined;
  readonly expected?: string | undefined;
  readonly actual?: string | undefined;
}

export interface IssueDraft {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly redactions: number;
  readonly truncated: boolean;
}

// ---------------------------------------------------------------------------
// Redaction: nothing private may reach a public issue
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1<user>:<password>@'], // credentials in URLs
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<private key>'],
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, '<jwt>'],
  [/\b(?:sk|pk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9]{16,}\b/g, '<api key>'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '<github token>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<aws key>'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '<slack token>'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 <token>'],
  [/\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|DATABASE_URL|DSN)[A-Z0-9_]*)\s*[=:]\s*\S+/gi, '$1=<redacted>'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/gi, '<email>'],
];

/** Values from the project's .env files (any value of 6+ characters is treated as private). */
function envValues(cwd: string): string[] {
  const values: string[] = [];
  for (const name of ['.env', '.env.local', '.env.production', '.env.development']) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*(?:export\s+)?[\w.-]+\s*=\s*(.*)$/.exec(line);
      const value = m?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value && value.length >= 6 && !/^(true|false|\d+)$/i.test(value)) values.push(value);
    }
  }
  return values.sort((a, b) => b.length - a.length);
}

/** Removes secrets, .env values, emails and local paths. Returns the text and how many things were removed. */
export function redact(text: string, cwd: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const value of envValues(cwd)) {
    const parts = out.split(value);
    count += parts.length - 1;
    out = parts.join('<env value>');
  }
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, (...args) => {
      count++;
      return replacement.replace(/\$1/g, String(args[1] ?? ''));
    });
  }
  // Local paths reveal user names and project layout. Cover every spelling of the same directory:
  // symlinked (/var vs /private/var on macOS), the shell's $PWD, and the real path.
  const spellings = (dir: string) => {
    const all = new Set([dir]);
    try {
      all.add(fs.realpathSync(dir));
    } catch {
      // directory may not exist (tests, deleted projects)
    }
    for (const d of [...all]) if (d.startsWith('/private/')) all.add(d.slice('/private'.length));
    return [...all].filter((d) => d.length > 1).sort((a, b) => b.length - a.length);
  };
  const dirs: Array<[string, string]> = [
    ...spellings(cwd).map((d) => [d, '<project>'] as [string, string]),
    ...(process.env['PWD'] && path.resolve(process.env['PWD']) !== '/' ? spellings(process.env['PWD']).map((d) => [d, '<project>'] as [string, string]) : []),
    ...spellings(os.homedir()).map((d) => [d, '~'] as [string, string]),
  ];
  for (const [dir, label] of dirs) {
    if (out.includes(dir)) {
      count += out.split(dir).length - 1;
      out = out.split(dir).join(label);
    }
  }
  // Any other home directory (another user, a container path).
  out = out.replace(/(?:\/Users|\/home)\/[^/\s'"`]+/g, () => {
    count++;
    return '~';
  });
  return { text: out, count };
}

// ---------------------------------------------------------------------------
// Environment (versions and the database driver only: never connection details)
// ---------------------------------------------------------------------------

function findUp(from: string, rel: string): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function environment(cwd: string, cliVersion: string): string {
  const pkgFile = findUp(cwd, 'node_modules/jsango/package.json');
  const jsango = pkgFile ? (JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as { version?: string }).version : undefined;
  let driver = 'unknown';
  const envFile = path.join(cwd, '.env');
  if (fs.existsSync(envFile)) {
    const env = fs.readFileSync(envFile, 'utf8');
    const url = /^\s*DATABASE_URL\s*=\s*['"]?([a-z0-9+]+):/im.exec(env)?.[1];
    const named = /^\s*DATABASE_DRIVER\s*=\s*['"]?([a-z0-9]+)/im.exec(env)?.[1];
    driver = url ?? named ?? 'sqlite (default)';
  }
  return [
    `- jsango: ${jsango ?? cliVersion}`,
    `- Node.js: ${process.version}`,
    `- OS: ${process.platform} ${process.arch}`,
    `- Database driver: ${driver}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Draft + link
// ---------------------------------------------------------------------------

const KIND_LABEL = { bug: 'Bug', 'missing-feature': 'Missing feature', docs: 'Docs' } as const;

export function draftIssue(input: IssueDraftInput, cwd: string, cliVersion: string): IssueDraft {
  let redactions = 0;
  const clean = (text: string | undefined) => {
    if (!text?.trim()) return undefined;
    const r = redact(text.trim(), cwd);
    redactions += r.count;
    return r.text;
  };
  const title = `[${KIND_LABEL[input.kind]}] ${clean(input.title) ?? 'Untitled'}`.slice(0, 200);
  const sections: Array<[string, string | undefined]> = [
    ['Summary', clean(input.summary)],
    ['Minimal reproduction', clean(input.reproduction)],
    ['Expected', clean(input.expected)],
    ['Actual', clean(input.actual)],
    ['Environment', environment(cwd, cliVersion)],
  ];
  let body = sections
    .filter(([, text]) => text)
    .map(([heading, text]) => `### ${heading}\n\n${text}`)
    .join('\n\n');
  body += '\n\n---\n_Drafted by an AI coding agent with `jsango mcp` and reviewed by the reporter before submitting._';

  const build = (b: string) =>
    `https://github.com/${ISSUES_REPO}/issues/new?` +
    new URLSearchParams({ template: 'ai_report.md', title, body: b, labels: 'ai-reported' }).toString();
  let url = build(body);
  let truncated = false;
  while (url.length > MAX_URL && body.length > 200) {
    truncated = true;
    body = body.slice(0, Math.floor(body.length * 0.8)) + '\n\n_(truncated: paste the rest of the reproduction here)_';
    url = build(body);
  }
  return { title, body, url, redactions, truncated };
}

// ---------------------------------------------------------------------------
// Duplicate search
// ---------------------------------------------------------------------------

const STOP = new Set('a an and are as at be but by can does for from has have how in is it its not of on or the this to when with without'.split(' '));

export async function findSimilarIssues(
  title: string,
  options: { fetch?: typeof fetch; apiBase?: string } = {}
): Promise<{ ok: true; issues: Array<{ title: string; url: string; state: string }> } | { ok: false; reason: string }> {
  const words = (title.toLowerCase().replace(/^\[[^\]]*\]\s*/, '').match(/[a-z0-9_.$-]+/g) ?? [])
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 6);
  if (words.length === 0) return { ok: true, issues: [] };
  const q = `repo:${ISSUES_REPO} is:issue ${words.join(' ')}`;
  const base = options.apiBase ?? process.env['JSANGO_GITHUB_API'] ?? 'https://api.github.com';
  try {
    const res = await (options.fetch ?? fetch)(`${base}/search/issues?per_page=5&q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'jsango-mcp' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, reason: `GitHub search returned HTTP ${res.status}` };
    const data = (await res.json()) as { items?: Array<{ title: string; html_url: string; state: string }> };
    return { ok: true, issues: (data.items ?? []).map((i) => ({ title: i.title, url: i.html_url, state: i.state })) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** The `report_issue` tool result: draft, possible duplicates, and how to submit with the user's consent. */
export async function reportIssue(input: IssueDraftInput, cwd: string, cliVersion: string): Promise<string> {
  const draft = draftIssue(input, cwd, cliVersion);
  const similar = await findSimilarIssues(draft.title);
  const searchUrl = `https://github.com/${ISSUES_REPO}/issues?q=${encodeURIComponent(`is:issue ${input.title}`)}`;

  const duplicates = !similar.ok
    ? `Could not search GitHub (${similar.reason}). Ask the user to check ${searchUrl} first.`
    : similar.issues.length === 0
      ? 'No similar issues found.'
      : [
          'Possibly the same problem. If one matches, suggest adding a 👍 or a comment there instead of a new issue:',
          ...similar.issues.map((i) => `- [${i.state}] ${i.title}: ${i.url}`),
        ].join('\n');

  return [
    'IMPORTANT: Do not submit anything yourself. Show the user the draft below and ask whether to report it.',
    'Only if they agree, give them the link: they review it on GitHub and press "Submit new issue" themselves.',
    '',
    `## Similar issues\n${duplicates}`,
    '',
    `## Draft (${draft.redactions} private value(s) removed${draft.truncated ? '; body shortened to fit the link' : ''})`,
    '',
    `Title: ${draft.title}`,
    '',
    draft.body,
    '',
    '## Link for the user (after they approve)',
    draft.url,
    '',
    'Users with the GitHub CLI can instead run (after reviewing the text):',
    `gh issue create --repo ${ISSUES_REPO} --title ${JSON.stringify(draft.title)} --body-file <file with the draft body>`,
  ].join('\n');
}
