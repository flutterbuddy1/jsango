# Route Priority and Determinism

## Precedence Hierarchy

The Nexora router implements strict deterministic precedence. The matching order at any node in the Radix Trie is:

1. **Static Segment**: Exact string match via $O(1)$ child map.
2. **Constrained Parameter**: Parameter segment with validation rule (`:id<number>`, `:id<uuid>`, etc.).
3. **Generic Parameter**: Unconstrained parameter segment (`:id`).
4. **Wildcard Segment**: Catch-all multi-segment remainder (`*path`).

## Determinism Over Registration Order

In naive routers, the registration order of routes dictates matching priority. In Nexora, routes with different segment types are resolved according to their intrinsic specificity, regardless of which route was registered first.

### Example

Consider the following route registrations:

```typescript
router.get('/items/*rest', wildcardHandler);
router.get('/items/:id', genericHandler);
router.get('/items/:id<number>', constrainedHandler);
router.get('/items/special', staticHandler);
```

Resolutions are strictly deterministic:

- `/items/special` $\rightarrow$ `staticHandler` (Static > Param)
- `/items/42` $\rightarrow$ `constrainedHandler` (Constrained > Generic)
- `/items/keyboard` $\rightarrow$ `genericHandler` (Generic > Wildcard)
- `/items/a/b/c` $\rightarrow$ `wildcardHandler` (Wildcard matches multi-segment)
