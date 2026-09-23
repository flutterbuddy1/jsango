# 04 — Runtime Independence Strategy

## Runtime Abstraction Model

High-concurrency modern TypeScript backends must not be tightly coupled to any single JavaScript runtime. While Node.js represents the dominant enterprise deployment target, Bun offers high throughput, faster cold starts, and alternative networking primitives.

To avoid vendor lock-in and enable cross-runtime execution without architectural rewrite, `django-js` abstracts the runtime behind the `IRuntimeAdapter` contract:

```typescript
export interface IRuntimeAdapter {
  readonly name: 'node' | 'bun' | 'unknown';
  readonly version: string;
  getEnv(key: string): string | undefined;
  getAllEnv(): Readonly<Record<string, string | undefined>>;
  cwd(): string;
  exit(code?: number): void;
}
```

---

## Strategy & Principles

1. **Isolation of Host Globals**:
   Direct access to `process`, `process.env`, `Bun`, or runtime-specific file/network primitives is prohibited throughout framework packages. All runtime-specific calls must be mediated through `IRuntimeAdapter`.
2. **First Implementation — Node.js**:
   In Phase 0, `NodeRuntimeAdapter` provides the reference implementation leveraging standard Node.js APIs behind the interface.
3. **Future Extension — Bun**:
   Future phases will introduce `BunRuntimeAdapter` with runtime-specific optimizations (e.g., native Bun HTTP server primitives) while keeping the application domain and HTTP abstractions unchanged.
4. **Graceful Fallback**:
   When running in unknown or test environments, the runtime adapter falls back cleanly without crashing.
