---
trigger: always_on
---

# Coding Standards

## Language

TypeScript only.

Use strict TypeScript.

tsconfig must use:

"strict": true

Avoid:

any
unknown without validation
non-null assertions unless justified
type assertions unless necessary

---

## Naming

Classes:
PascalCase

Functions:
camelCase

Variables:
camelCase

Constants:
UPPER_SNAKE_CASE only for true constants.

Interfaces:
PascalCase

Types:
PascalCase

Files:
kebab-case

---

## Functions

Functions should have one clear responsibility.

Avoid giant functions.

Prefer composition.

---

## Classes

Classes should not become service containers for unrelated behavior.

Use interfaces for replaceable infrastructure.

---

## Exports

Prefer explicit exports.

Avoid wildcard exports unless intentional.

---

## Comments

Comments explain WHY.

Do not write comments explaining obvious code.

Architecture decisions must be documented separately.

---

## Error Handling

Never:

catch (error) {}

Never ignore errors.

Always either:

- handle
- transform
- rethrow
- intentionally document suppression

---

## Logging

Never use console.log inside framework packages.

Use the framework logger abstraction.

---

## Environment

Never directly access process.env outside configuration/runtime adapters.

---

## Dependencies

Before installing a package:

1. Check whether the functionality can be implemented internally.
2. Check package maturity.
3. Check maintenance.
4. Check license.
5. Check bundle/runtime impact.
6. Check security history.

Avoid unnecessary dependencies.