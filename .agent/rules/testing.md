---
trigger: always_on
---

# Testing Rules

Every feature must have tests.

Testing layers:

Unit
Integration
End-to-end
Benchmark

Framework core requires high coverage.

Tests must verify:

- expected behavior
- invalid input
- edge cases
- failure handling
- concurrency where relevant

Tests must be deterministic.

Do not make tests dependent on external services unless explicitly classified as integration tests.