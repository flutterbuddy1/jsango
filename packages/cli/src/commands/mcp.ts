import { fileURLToPath } from 'node:url';
import { McpServer } from '@jsango/ai';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';
import { FRAMEWORK_VERSION } from './version.js';
import { ApiIndex } from '../internal/mcp/api-index.js';
import { DocsSearch } from '../internal/mcp/docs-search.js';
import { runChecks } from '../internal/mcp/checks.js';
import { reportIssue, type IssueDraftInput } from '../internal/mcp/report-issue.js';

const INSTRUCTIONS = `This project is built with jsango, a batteries-included TypeScript backend framework (routing, validation,
ORM + migrations, auth, admin panel, jobs, events, cache, WebSockets, OpenAPI, AI agents), imported from 'jsango'.
- Use jsango instead of Express, Prisma, Passport, zod, BullMQ or socket.io. Follow AGENTS.md in the project root.
- Before using a jsango API you are not certain about, call get_api (e.g. "createAuth", "QueryBuilder.paginate",
  "fields.string") to read its real signature from the installed version. Never guess method names.
- For how-to questions (migrations, auth flows, admin customization, ...), call search_docs.
- Before saying the work is done, call run_check and fix every failure it reports.
- If jsango itself has a bug, a missing feature or wrong docs (not this project's code), work around it, tell the
  user, and call report_issue to prepare a GitHub issue. Never submit issues yourself: the user decides.`;

/** `jsango mcp`: an MCP server (stdio) that gives AI coding agents jsango's real API, docs and checks. */
export class McpCommand extends BaseCommand {
  public readonly name = 'mcp';
  public readonly description = 'Start the jsango MCP server (stdio) for AI coding agents';
  public readonly usage = 'jsango mcp';

  public async execute(context: CommandContext): Promise<number> {
    const cwd = context.cwd;
    let index: ApiIndex | undefined;
    const api = () => (index ??= ApiIndex.forProject(cwd));
    let docs: DocsSearch | undefined | null;
    const loadDocs = () =>
      docs === undefined
        ? (docs =
            DocsSearch.load(fileURLToPath(new URL('../docs/llms-full.txt', import.meta.url))) ??
            null)
        : docs;

    const server = createJsangoMcpServer({
      getApi: (name) => api().lookup(name),
      searchDocs: (query, limit) =>
        loadDocs()?.search(query, limit) ??
        'The docs bundle is missing from this jsango install. Read https://flutterbuddy1.github.io/jsango/llms-full.txt instead.',
      runCheck: (tests) => runChecks(cwd, api(), { tests }),
      reportIssue: (input) => reportIssue(input, cwd, FRAMEWORK_VERSION),
    });

    // stdout carries the protocol; anything else goes to stderr.
    process.stderr.write(`jsango MCP server v${FRAMEWORK_VERSION} ready on stdio (${cwd})\n`);
    await server.serveStdio();
    return ExitCode.SUCCESS;
  }
}

export interface JsangoMcpHandlers {
  getApi(name: string): string;
  searchDocs(query: string, limit: number): string;
  runCheck(tests: boolean): Promise<string>;
  reportIssue(input: IssueDraftInput): Promise<string>;
}

export function createJsangoMcpServer(handlers: JsangoMcpHandlers): McpServer {
  return new McpServer({ name: 'jsango', version: FRAMEWORK_VERSION, instructions: INSTRUCTIONS })
    .registerTool({
      name: 'get_api',
      description:
        'Exact TypeScript signature and documentation of a jsango export from the installed version, e.g. "createAuth", "defineModel", "fields.string", "QueryBuilder.paginate", "Auth.login". Suggests close names when it does not exist.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Export name, optionally with a member: Name or Name.member',
          },
        },
        required: ['name'],
      },
      execute: ({ name }: { name?: unknown }) => handlers.getApi(String(name ?? '')),
    })
    .registerTool({
      name: 'search_docs',
      description:
        'Search the jsango guides (database, migrations, auth, admin, jobs, WebSockets, AI agents, deployment) bundled with the installed version. Returns the best matching sections.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords, e.g. "refresh token rotation" or "admin dashboard widgets"',
          },
          limit: { type: 'number', description: 'Sections to return (default 4, max 8)' },
        },
        required: ['query'],
      },
      execute: ({ query, limit }: { query?: unknown; limit?: unknown }) =>
        handlers.searchDocs(String(query ?? ''), Math.min(Math.max(Number(limit) || 4, 1), 8)),
    })
    .registerTool({
      name: 'run_check',
      description:
        'Verify the project: TypeScript type-check, migrations in sync with the models (jsango migrate:check), and optionally the test suite. Returns failures with jsango-specific hints. Run it before finishing a task.',
      inputSchema: {
        type: 'object',
        properties: {
          tests: { type: 'boolean', description: 'Also run `npm test` (default false)' },
        },
      },
      execute: ({ tests }: { tests?: unknown }) => handlers.runCheck(tests === true),
    })
    .registerTool({
      name: 'report_issue',
      description:
        'Prepare a GitHub issue for a bug, missing feature or docs error in jsango itself (not in this project). Removes secrets, .env values, emails and local paths, adds versions, searches for duplicates, and returns a draft plus a prefilled link. It never submits: show the draft to the user and let them decide.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['bug', 'missing-feature', 'docs'] },
          title: {
            type: 'string',
            description: 'Short and specific, e.g. "paginate() ignores orderBy on MongoDB"',
          },
          summary: { type: 'string', description: 'What is wrong or missing, in a few sentences' },
          reproduction: {
            type: 'string',
            description: 'Minimal code that shows the problem (no project secrets or private data)',
          },
          expected: { type: 'string' },
          actual: { type: 'string', description: 'Actual behaviour or error message' },
        },
        required: ['kind', 'title', 'summary'],
      },
      execute: (args: Record<string, unknown>) => {
        const kind = ['bug', 'missing-feature', 'docs'].includes(String(args['kind']))
          ? (args['kind'] as IssueDraftInput['kind'])
          : 'bug';
        const text = (key: string) =>
          typeof args[key] === 'string' ? (args[key] as string) : undefined;
        return handlers.reportIssue({
          kind,
          title: text('title') ?? '',
          summary: text('summary') ?? '',
          reproduction: text('reproduction'),
          expected: text('expected'),
          actual: text('actual'),
        });
      },
    });
}
