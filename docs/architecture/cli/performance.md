# CLI Performance & Benchmarks

## Overview

CLI startup speed directly determines developer experience and shell responsiveness. Commands such as `version` and `help` must return in sub-millisecond times without eagerly booting databases or HTTP servers.

## Startup Optimization Strategies

1. **Zero-Boot Fast Paths**: `version` and `help` evaluate immediately at the router level without instantiating application containers or database connection pools.
2. **Lazy Service Resolution**: `CommandContext.getApplication()`, `getDatabaseManager()`, and `getMigrationRegistry()` are loaded only when requested by a command.
3. **No External Runtime Dependencies**: `@django-js/cli` uses pure TypeScript and standard library runtimes without bloated parsing libraries.
4. **Deterministic In-Memory Registry**: Lookup is backed by native `Map` structures yielding tens of millions of operations per second.

## Benchmark Results (`benchmarks/cli/cli.bench.ts`)

| Benchmark Scenario                      | Throughput (ops/sec) | Mean Latency        |
| --------------------------------------- | -------------------- | ------------------- |
| **Command Registry Lookup**             | **16,984,397 ops/s** | 0.0001 ms (100 ns)  |
| **Global Option Parsing**               | **15,734,916 ops/s** | 0.0001 ms (100 ns)  |
| **Complex Arg & Option Parsing**        | **1,379,463 ops/s**  | 0.0007 ms (700 ns)  |
| **Sensitive Data Masking**              | **276,681 ops/s**    | 0.0036 ms (3.6 µs)  |
| **Table Formatting (50 rows x 6 cols)** | **58,762 ops/s**     | 0.0170 ms (17 µs)   |
| **Fast-Path Version Execution**         | **18,696 ops/s**     | 0.0535 ms (53.5 µs) |
| **Global Help Rendering**               | **15,361 ops/s**     | 0.0651 ms (65.1 µs) |
