#!/usr/bin/env node
/**
 * Builds site/llms.txt and site/llms-full.txt (https://llmstxt.org) from the README, the guides in
 * docs/ and the AGENTS.md template, so AI assistants read the same type-checked docs developers do.
 * Run by the GitHub Pages workflow before deploying: `node scripts/build-llms.mjs [outDir]`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://flutterbuddy1.github.io/jsango';
const RAW = 'https://raw.githubusercontent.com/flutterbuddy1/jsango/main';

/** User-facing guides, in reading order: [path, title, one-line summary]. */
export const GUIDES = [
  ['README.md', 'Overview & quick start', 'Install, project scaffold, routing, CRUD, validation, jobs, events, cache, WebSockets, admin, OpenAPI, AI agents, CLI'],
  ['docs/database/README.md', 'Database guide', 'Connecting PostgreSQL/MySQL/SQLite/MongoDB, models and fields, queries, relations, transactions, migrations, production'],
  ['docs/auth/README.md', 'Authentication guide', 'createAuth: passwords, JWT + refresh tokens, cookie sessions, API keys, OAuth, external IdPs, TOTP 2FA, roles and permissions'],
  ['docs/admin/ADMIN-CUSTOMIZATION.md', 'Admin panel guide', 'app.admin: sign-in, resource customization, dashboards, custom pages, actions, large tables, permissions, branding'],
  ['docs/admin/ADMIN-RESOURCE-GUIDE.md', 'Admin resources (manual setup)', 'AdminResource, field types, AdminServer and query adapters'],
  ['docs/architecture/queue/README.md', 'Background jobs', 'Queues, workers, retries and failed jobs'],
  ['docs/architecture/events/README.md', 'Events', 'Typed event bus'],
  ['docs/architecture/cache/README.md', 'Cache', 'Cache stores, remember(), invalidation'],
  ['docs/architecture/websocket/README.md', 'WebSockets', 'app.ws, rooms, broadcasting'],
  ['docs/architecture/openapi/README.md', 'OpenAPI', 'OpenAPI 3.1 generation and Swagger UI'],
  ['docs/ai/tools.md', 'AI tools', 'Typed tools for agents'],
  ['docs/ai/memory.md', 'AI memory', 'Conversation memory stores'],
  ['docs/ai/rag.md', 'RAG', 'Knowledge bases and retrieval'],
  ['docs/ai/mcp.md', 'MCP', 'Model Context Protocol servers and clients'],
  ['docs/ai/human-in-the-loop.md', 'Human in the loop', 'Approval gates for agent tools'],
  ['docs/ai/testing.md', 'Testing AI', 'Fake providers and evaluations'],
  ['docs/deployment/README.md', 'Deployment', 'Running jsango in production'],
  ['docs/LIMITATIONS.md', 'Known limitations', 'What jsango does not do (yet)'],
];

const AGENTS = 'packages/cli/templates/AGENTS.md';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const stripMarkers = (text) => text.replace(/<!-- jsango:(start|end) -->\n?/g, '').trim();

export function buildLlms() {
  const guides = GUIDES.filter(([rel]) => fs.existsSync(path.join(ROOT, rel)));

  const llms = [
    '# jsango',
    '',
    '> jsango is a batteries-included TypeScript backend framework: routing, validation, ORM with',
    '> migrations (PostgreSQL, MySQL, SQLite, MongoDB), authentication, an admin panel, background jobs, events,',
    '> cache, WebSockets, OpenAPI and AI agents, all imported from the single `jsango` package.',
    '',
    'When building a backend with jsango, use its APIs instead of Express, Prisma, Passport, zod, BullMQ or',
    'socket.io. Start projects with `npx jsango new <name>`; every project includes an AGENTS.md with the rules.',
    'Only use APIs that appear in these docs or in the package type definitions.',
    '',
    '## Docs',
    '',
    `- [Full documentation in one file](${SITE}/llms-full.txt): every guide below, for loading into context`,
    `- [Rules for AI coding agents](${RAW}/${AGENTS}): which jsango API to use for each need, project layout, commands, reporting bugs`,
    ...guides.map(([rel, title, summary]) => `- [${title}](${RAW}/${rel}): ${summary}`),
    '',
    '## Optional',
    '',
    `- [Web documentation](${SITE}/docs.html)`,
    `- [Changelog](${RAW}/CHANGELOG.md)`,
    '- [Issues](https://github.com/flutterbuddy1/jsango/issues): search before reporting a bug or missing feature',
    '',
  ].join('\n');

  const sections = [
    ['Rules for AI coding agents', AGENTS, stripMarkers(read(AGENTS))],
    ...guides.map(([rel, title]) => [title, rel, read(rel).trim()]),
  ];
  const full = [
    '# jsango: full documentation for LLMs',
    '',
    `> Generated from the jsango repository (${RAW}). Sections are separated by "---".`,
    '',
    ...sections.map(([title, rel, body]) => `---\n\n<!-- source: ${rel} (${title}) -->\n\n${body}\n`),
  ].join('\n');

  return { llms, full };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'site'));
  const { llms, full } = buildLlms();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'llms.txt'), llms);
  fs.writeFileSync(path.join(outDir, 'llms-full.txt'), full);
  process.stdout.write(`Wrote llms.txt (${llms.length} B) and llms-full.txt (${full.length} B) to ${outDir}\n`);
}
