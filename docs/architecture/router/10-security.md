# Router Security Considerations

## Threat Vectors & Defenses

### 1. ReDoS (Regular Expression Denial of Service)

- **Built-in Constraints**: Built-in regex patterns (`number`, `uuid`, `slug`, `alpha`, `alphanumeric`) use non-backtracking, linear-time expressions without nested quantifiers.
- **Segment Scope**: Regex constraints only execute on single path segments, never across entire URLs, preventing polynomial or exponential catastrophic backtracking.

### 2. Path Traversal & Dot Segments

- Paths are normalized before traversal. Dot segments (`..` and `.`) within path parameters are captured as literal decoded strings and never interpreted as filesystem traversals by the router itself.

### 3. Null Byte Injection

- Paths containing null bytes (`\0`) or control characters are rejected or neutralized during URI decoding, preventing null-byte termination attacks.

### 4. URI Malformed Attacks

- Parameter extraction wraps `decodeURIComponent` in a safe try-catch wrapper. Malformed sequences (e.g. `%ZZ`, `%u0000`, dangling `%`) fallback to the raw escaped string rather than crashing the process or yielding an unhandled exception.

### 5. Prototype Pollution Protection

- Parameter dictionaries are created using clean object allocations or `Object.freeze` to prevent modifying `Object.prototype`.
