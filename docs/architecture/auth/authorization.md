# Authorization Architecture

## 1. Overview

Authorization governs what an authenticated principal is permitted to execute.

```
Identity
   ↓
AuthorizationManager
   ↓
Decision: ALLOW or DENY
```

## 2. Core Security Invariant: Fail-Closed

If any factor in authorization is uncertain:

- Missing identity -> **DENY**
- Missing policy -> **DENY**
- Unknown permission -> **DENY**
- Thrown error inside policy -> **DENY**

Access is granted **only** when an affirmative rule, role, permission, or policy explicitly permits the action.

## 3. Explicit Superuser Centralization

Superusers (`isSuperuser: true`) bypass granular checks. To prevent hidden backdoor bypasses:

- Superuser handling is centralized strictly inside `AuthorizationManager.authorize()`.
- Decisions explicitly set `policy: 'SuperuserPolicy'` and `{ isSuperuser: true }` in metadata for security auditability.
- No loose checks like `if (role === 'admin')` are scattered throughout the codebase.
