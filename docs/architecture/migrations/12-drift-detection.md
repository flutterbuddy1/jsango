# Schema Drift Detection

The `DriftDetector` verifies runtime database consistency against code definitions.

## Workflow

1. Introspect active database schema using `SchemaIntrospector`.
2. Convert registered ORM models into expected `SchemaSnapshot`.
3. Compute differences using `SchemaDiffEngine.diff()`.
4. Return `DriftDetectionResult`:
   - `hasDrift`: boolean flag.
   - `differences`: array of human-readable operation diffs.
   - `diff`: full `SchemaDiff` object.

## Usage in CI/CD & Deployments

Applications can run drift detection during startup or deployment health-checks to ensure no manual SQL modifications were applied out-of-band.
