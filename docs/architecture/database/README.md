# Database Architecture Documentation

This directory contains the architecture documentation for `@django-js/database`.

## Documentation Index

- [01-overview.md](./01-overview.md): High-level overview, boundaries, and responsibilities.
- [02-architecture.md](./02-architecture.md): Layered architecture (Manager -> Pool -> Connection/Tx -> Driver).
- [03-driver-abstraction.md](./03-driver-abstraction.md): Driver adapter contract and capability model.
- [04-connection-pooling.md](./04-connection-pooling.md): Connection pool mechanics, lifecycle, and queueing.
- [05-transactions.md](./05-transactions.md): Transaction state machine, auto-rollback, and savepoints.
- [06-errors.md](./06-errors.md): Error hierarchy and credential masking.
- [07-configuration.md](./07-configuration.md): Structured database configuration and loading.
- [08-performance.md](./08-performance.md): Performance design decisions and benchmark findings.
- [09-testing.md](./09-testing.md): Testing strategy and driver contract suite.
