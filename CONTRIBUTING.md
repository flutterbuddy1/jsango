# Contributing to jsango

Thank you for contributing to **jsango**. As a production-grade framework designed for enterprise workloads, we maintain strict architectural standards and quality gates.

---

## Engineering Workflow

Every change must progress through our standard development lifecycle:

```
UNDERSTAND
   ↓
INSPECT
   ↓
DESIGN
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
TEST
   ↓
BENCHMARK
   ↓
REVIEW
   ↓
DOCUMENT
```

1. **UNDERSTAND**: Clarify the problem, constraints, and requirements before writing any code.
2. **INSPECT**: Review existing architecture, boundaries, and reusable abstractions.
3. **DESIGN**: Formulate an interface-first solution conforming to `.agent/rules/`.
4. **PLAN**: Propose architectural changes and get alignment.
5. **IMPLEMENT**: Write strict TypeScript code with explicit public boundaries.
6. **TEST**: Add deterministic unit, integration, and edge-case tests.
7. **BENCHMARK**: Measure performance-sensitive changes to verify zero regression.
8. **REVIEW**: Verify no circular dependencies, no unnecessary dependencies, and no leaking internals.
9. **DOCUMENT**: Update architectural documentation, ADRs, and API docs.

---

## Branch Naming Conventions

- `feature/<package>-<description>` (e.g. `feature/http-streaming-response`)
- `fix/<package>-<description>` (e.g. `fix/router-param-decoding`)
- `refactor/<package>-<description>` (e.g. `refactor/container-scope-resolution`)
- `docs/<description>` (e.g. `docs/architecture-update`)
- `perf/<package>-<description>` (e.g. `perf/router-radix-tree`)

---

## Commit Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

### Allowed Types

- `feat`: A new user-facing framework feature
- `fix`: A bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding or correcting tests
- `docs`: Documentation-only changes
- `chore`: Tooling, build pipeline, or repository maintenance

### Examples

- `feat(core): add application lifecycle management`
- `feat(http): add request abstraction`
- `fix(router): correct parameter matching for trailing slashes`
- `refactor(container): simplify scope resolution`
- `docs(architecture): update package boundaries`
- `test(core): add lifecycle event tests`
- `perf(router): optimize static route matching`

---

## Pull Request Quality Gates

Before opening a pull request, ensure all quality gates pass:

```bash
# 1. Typecheck
pnpm typecheck

# 2. Test
pnpm test

# 3. Lint
pnpm lint

# 4. Format Check
pnpm format:check

# 5. Build
pnpm build
```

### Strict Quality Rules

- **No `any`**: Strict TypeScript is enforced without exceptions.
- **No `console.log`**: Use the framework logger abstraction (`ILogger`).
- **No Leaking Globals**: Do not access `process.env` directly outside `@jsango/runtime`.
- **No Unjustified Dependencies**: Check bundle size, security history, and runtime cost before introducing any external dependency.
- **Test Coverage**: Every new feature or bug fix must include comprehensive tests.
