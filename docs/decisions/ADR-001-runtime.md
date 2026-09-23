# ADR-001: Runtime Abstraction Layer

## Status

Accepted

## Context

Modern JavaScript backend development is no longer confined to Node.js. High-performance runtimes such as Bun have emerged, offering significantly faster startup times, native TypeScript execution, and high-performance network APIs. However, tightly coupling a backend framework to Node.js-specific globals (`process`, `Buffer`, Node streams) creates vendor lock-in and makes running on other runtimes difficult and brittle.

## Decision

We introduce an explicit runtime abstraction layer (`@django-js/runtime`) centered around the `IRuntimeAdapter` contract.

- The framework packages must never directly reference host-specific globals like `process.env` or `Bun`.
- In Phase 0, `NodeRuntimeAdapter` provides the reference implementation.
- Subsequent phases will introduce `BunRuntimeAdapter` behind the same interface.
- Runtime detection is implemented safely via `detectRuntime()`.

## Alternatives Considered

1. **Node.js only**: Couple directly to `process` and Node.js standard modules. Rejected because it precludes multi-runtime flexibility and high-performance Bun workloads.
2. **Dynamic Polyfills**: Conditionally monkey-patch global variables at runtime. Rejected because monkey-patching global state violates explicit typing, causes side effects, and harms predictability.

## Consequences

- **Positive**: Strict isolation of platform-specific code; portability across Node.js and Bun; easier mockability in automated tests.
- **Negative**: Adds a minor layer of indirection for environmental operations such as reading environment variables or getting the current working directory.
