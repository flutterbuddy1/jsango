# Framework comparison benchmark

The same three endpoints in plain `node:http` (the ceiling for any Node.js framework), Express,
Fastify and JSango:

| Scenario               | Route                                                        |
| ---------------------- | ------------------------------------------------------------ |
| JSON hello world       | `GET /` → `{ "hello": "world" }`                             |
| Route params           | `GET /users/:id` → `{ id, name }`                            |
| POST + body validation | `POST /users` with `{ name, email }`, validated, echoed back |

Each framework uses its idiomatic API ([servers/](./servers)): a hand-written check in Express and
plain Node (neither has validation built in), JSON Schema in Fastify, `validate(schema(...))` in
JSango.

## Method

- Every server runs in its own process with `NODE_ENV=production` and logging off.
- Load comes from [autocannon](https://github.com/mcollina/autocannon) (the tool Fastify uses for
  its own benchmarks): 100 connections, a 3 s warm-up, then 10 s
  measured per scenario.
- Results go to [results.json](./results.json); the landing page numbers are copied from it.

## Results

Apple M2 (8 cores), Node.js v22.14.0, 2026-10-09:

|                      | JSON hello world        | Route params            | POST + body validation   |
| -------------------- | ----------------------- | ----------------------- | ------------------------ |
| node:http (baseline) | 88,399 req/s (p99 2 ms) | 84,669 req/s (p99 2 ms) | 72,288 req/s (p99 2 ms)  |
| Fastify 5.12.5       | 60,074 req/s (p99 3 ms) | 62,013 req/s (p99 2 ms) | 50,585 req/s (p99 3 ms)  |
| **JSango 1.6.0**     | 57,814 req/s (p99 3 ms) | 52,889 req/s (p99 3 ms) | 41,479 req/s (p99 4 ms)  |
| Express 5.2.1        | 15,996 req/s (p99 8 ms) | 15,700 req/s (p99 9 ms) | 13,915 req/s (p99 10 ms) |

JSango serves 3.0–3.6× the requests of Express and
82–96% of Fastify's, while also shipping an ORM, auth, admin, jobs and WebSockets.
Numbers vary by machine: compare frameworks within one run, not across machines.

## Run it

```bash
pnpm install && pnpm build
pnpm bench:compare                                    # ~3 minutes
DURATION=30 pnpm bench:compare                        # longer runs
FRAMEWORKS=jsango,fastify pnpm bench:compare          # a subset
FRAMEWORKS=jsango PROFILE_DIR=/tmp/prof pnpm bench:compare   # CPU profile (open in Chrome DevTools)
```
