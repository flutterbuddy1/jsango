# ADR-032: Health Check Subsystem and Liveness/Readiness Separation

## Status

Accepted

## Context

Kubernetes and container orchestration environments require distinct checks:

- **Liveness**: Determines if the process is responsive. Failing liveness triggers a container restart.
- **Readiness**: Determines if the process can accept traffic (e.g. database connected, cache warmed). Failing readiness stops routing traffic to the pod.

## Decision

1. Implement `HealthRegistry` supporting individual named checks with timeouts, critical flags, and execution status (`healthy`, `degraded`, `unhealthy`).
2. Implement HTTP handlers (`createHealthHandler`) for `/health`, `/health/live`, and `/health/ready`.
3. Liveness checks verify only local process responsiveness by default.
4. Readiness checks evaluate external dependencies (databases, cache stores, queues).
5. Expose sanitized statuses in public responses while restricting detailed diagnostic stack traces to authenticated diagnostic endpoints.

## Consequences

- Compliance with standard container orchestration lifecycle patterns.
- Secure, un-spoofable health reporting that avoids leaking connection strings or internal paths.
