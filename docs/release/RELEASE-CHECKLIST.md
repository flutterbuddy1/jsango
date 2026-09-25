# django-js Release Checklist

Follow this checklist prior to publishing any Release Candidate or Production Release.

---

## 1. Automated Verification & Quality Gates

- [ ] Clean install succeeds from lockfile (`pnpm install --frozen-lockfile`).
- [ ] Monorepo build passes across all packages (`pnpm build`).
- [ ] Strict TypeScript compilation passes with zero errors (`pnpm typecheck`).
- [ ] ESLint passes with zero errors or warnings (`pnpm lint`).
- [ ] Prettier formatting check passes (`pnpm format:check`).
- [ ] Complete Vitest test suite passes across all test files (`pnpm test`).
- [ ] End-to-end smoke test suite passes (`pnpm vitest run tests/e2e/rc-smoke.test.ts`).
- [ ] Performance and concurrency regression tests pass (`tests/performance/`).

---

## 2. Packaging & Manifest Audits

- [ ] All 25 packages in `packages/` have synchronized semantic version numbers.
- [ ] `package.json` contains valid `exports`, `types`, `main`, `license: "MIT"`, `repository`, and `publishConfig`.
- [ ] Package dry-run pack check passes (`npm pack --dry-run`) with zero leaked tests or temporary files.
- [ ] License file (`LICENSE`) is present and up to date.

---

## 3. Documentation & Governance

- [ ] `CHANGELOG.md` accurately documents all additions, fixes, and breaking changes.
- [ ] `ROADMAP.md` and `PROJECT_STATUS.md` reflect current release milestone.
- [ ] `SECURITY.md` and `CODE_OF_CONDUCT.md` are present.
- [ ] `docs/LIMITATIONS.md` documents current framework boundaries.
- [ ] Package-level `README.md` files are present across all 25 packages.

---

## 4. Git Tagging & Publishing

- [ ] Create git release tag (e.g. `v0.1.0-rc.1`).
- [ ] Publish packages to npm registry with appropriate dist-tag:
  ```bash
  pnpm -r publish --tag next --access public
  ```
