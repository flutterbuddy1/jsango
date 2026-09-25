---
trigger: always_on
---

# Dependency Policy

JSango should remain lightweight.

Before adding any dependency, answer:

1. Why is it needed?
2. Why can't JSango implement this internally?
3. Is it actively maintained?
4. Does it support Node.js and Bun?
5. What is the runtime cost?
6. What is the security risk?
7. What is the license?

Avoid dependencies for trivial functionality.

Prefer Web Platform / Node.js / runtime APIs where appropriate.

Do not introduce a dependency only because it makes implementation slightly easier.