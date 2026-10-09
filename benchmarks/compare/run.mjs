#!/usr/bin/env node
/**
 * HTTP throughput: plain node:http (baseline), Express, Fastify and jsango serving the same three
 * routes. Each server runs in its own process with NODE_ENV=production and no logging; load comes
 * from autocannon (100 connections, 3s warm-up, then a measured run per scenario).
 *
 *   pnpm build && pnpm bench:compare            # writes benchmarks/compare/results.json
 *   DURATION=30 pnpm bench:compare             # longer runs
 *   FRAMEWORKS=jsango PROFILE_DIR=/tmp/prof pnpm bench:compare   # CPU profile of a server
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autocannon from 'autocannon';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DURATION = Number(process.env.DURATION ?? 10);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 100);
const FRAMEWORKS = (process.env.FRAMEWORKS ?? 'node,express,fastify,jsango').split(',');

const SCENARIOS = [
  { name: 'JSON hello world', method: 'GET', path: '/' },
  { name: 'Route params', method: 'GET', path: '/users/42' },
  {
    name: 'POST + body validation',
    method: 'POST',
    path: '/users',
    body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com' }),
    headers: { 'content-type': 'application/json' },
  },
];

function startServer(framework, port) {
  return new Promise((resolve, reject) => {
    // PROFILE_DIR=/tmp/prof writes a CPU profile per server (open it in Chrome DevTools).
    const profile = process.env.PROFILE_DIR
      ? ['--cpu-prof', `--cpu-prof-dir=${process.env.PROFILE_DIR}`]
      : [];
    const script = path.join(HERE, 'servers', `${framework}.mjs`);
    const child = spawn(process.execPath, [...profile, script, port], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.on('data', (d) => {
      if (String(d).includes('ready')) resolve(child);
    });
    child.on('exit', (code) => reject(new Error(`${framework} server exited (${code})`)));
  });
}

const load = (url, scenario, duration) =>
  autocannon({
    url: url + scenario.path,
    method: scenario.method,
    body: scenario.body,
    headers: scenario.headers,
    connections: CONNECTIONS,
    duration,
  });

const results = [];
let port = 4300;
for (const framework of FRAMEWORKS) {
  const server = await startServer(framework, ++port);
  const url = `http://127.0.0.1:${port}`;
  try {
    for (const scenario of SCENARIOS) {
      await load(url, scenario, 3); // warm-up (JIT)
      const r = await load(url, scenario, DURATION);
      const row = {
        framework,
        scenario: scenario.name,
        requestsPerSec: Math.round(r.requests.average),
        latencyP50Ms: r.latency.p50,
        latencyP99Ms: r.latency.p99,
        errors: r.errors + r.non2xx,
      };
      results.push(row);
      console.log(
        `${framework.padEnd(8)} ${scenario.name.padEnd(24)} ${String(row.requestsPerSec).padStart(8)} req/s  p50 ${row.latencyP50Ms}ms  p99 ${row.latencyP99Ms}ms  errors ${row.errors}`
      );
    }
  } finally {
    await new Promise((done) => {
      server.once('exit', done);
      server.kill();
    });
  }
}

const ROOT = path.join(HERE, '..', '..');
const version = (dir) =>
  JSON.parse(readFileSync(path.join(ROOT, dir, 'package.json'), 'utf8')).version;
const versions = {
  express: version('node_modules/express'),
  fastify: version('node_modules/fastify'),
  jsango: version('packages/jsango'),
};
const report = {
  date: new Date().toISOString().slice(0, 10),
  node: process.version,
  cpu: os.cpus()[0]?.model,
  cores: os.cpus().length,
  connections: CONNECTIONS,
  durationSeconds: DURATION,
  versions,
  results,
};
writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\nSaved benchmarks/compare/results.json`);
