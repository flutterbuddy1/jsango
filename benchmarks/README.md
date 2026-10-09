# Benchmarks

This directory will contain performance benchmarks and concurrency evaluation suites to ensure high throughput and low latency as required by `.agent/rules/performance.md`.

## Framework comparison

[`compare/`](./compare) runs the same endpoints in `node:http`, Express, Fastify and JSango under
autocannon: `pnpm build && pnpm bench:compare`. See its README for the method and latest results.
Package micro-benchmarks (router, ORM, cache, ...) run with `pnpm bench`.
