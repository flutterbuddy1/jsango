# Migration File Generator

The `MigrationGenerator` formats schema diffs into production-ready TypeScript migration files.

## Naming & Timestamping

Files follow the standard pattern:
`YYYYMMDDHHmmss_<name>.ts` (e.g. `20260924103000_create_users_table.ts`).

## File Structure

Generated files export a default `Migration` instance containing:

- `id`: Timestamp prefix + snake_case name.
- `name`: Human-readable identifier.
- `operations`: Serialized operations array.
- `up(context)`: Asynchronous execution hook.
- `down(context)`: Inverse rollback hook.
- `checksum`: Cryptographic verification hash of the file contents.
