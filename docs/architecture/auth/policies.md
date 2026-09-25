# Policy Architecture & Object-Level Access

## 1. Resource & Object-Level Policies

Policies govern permissions on specific entities and instances:

```typescript
export interface IPolicy<TResource = unknown> {
  readonly name: string;
  can(
    identity: Identity,
    action: string,
    resource?: TResource,
    context?: AuthContext
  ): Promise<PolicyResult> | PolicyResult;
}
```

## 2. BasePolicy

`BasePolicy<TResource>` automatically dispatches calls to methods matching action names (e.g. `view()`, `create()`, `update()`, `delete()`):

```typescript
class ArticlePolicy extends BasePolicy<Article> {
  public readonly name = 'ArticlePolicy';

  public view(_identity: Identity, article?: Article): boolean {
    return Boolean(article?.isPublished);
  }

  public update(identity: Identity, article?: Article): boolean {
    return article?.authorId === identity.id;
  }
}
```

## 3. ORM ModelMetadata Resolution

`PolicyRegistry.resolvePolicy()` supports Phase 6 ORM model metadata:

- If a resource instance is passed, it extracts `resource.constructor.metadata.name` or `resource.constructor.modelName`.
- This decouples `@django-js/auth` from direct dependency on `@django-js/orm` while allowing seamless object-level authorization on model instances.

## 4. Policy Composition Combinators

Policies can be composed using functional combinators:

- `andPolicy(policyA, policyB)`: Requires both policies to allow.
- `orPolicy(policyA, policyB)`: Requires either policy to allow.
- `notPolicy(policy)`: Inverts policy outcome.
