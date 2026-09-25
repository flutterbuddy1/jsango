# TypeScript Type Safety & Inference

## Design Principles

`@jsango/orm` provides end-to-end compile-time type safety with zero code generation steps and zero runtime reflection.

---

## Attribute Inference (`InferModelAttributes`)

When a model is defined via `defineModel`, TypeScript maps field definitions into concrete attribute types:

```typescript
const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.integer({ primaryKey: true, autoIncrement: true }),
    name: fields.string(),
    email: fields.string({ nullable: true }),
    role: fields.string({ default: 'user' }),
    score: fields.float({ default: 0 }),
  },
});

type UserAttributes = InferModelAttributes<typeof User.metadata.fields>;
// Resulting type:
// {
//   id: number;
//   name: string;
//   email: string | null;
//   role: string;
//   score: number;
// }
```

---

## Creation Attribute Inference (`InferCreationAttributes`)

When creating records via `User.create(...)`, TypeScript distinguishes between required fields and optional fields:

- Fields with `default` values are optional.
- Fields with `autoIncrement: true` are optional.
- Fields with `nullable: true` are optional.
- All other fields are strictly required.

```typescript
// Valid: required fields provided
await User.create({ name: 'Alice' });

// Valid: optional fields overridden
await User.create({ name: 'Bob', email: 'bob@example.com', role: 'admin' });

// Compile-time Error: Property 'name' is missing in type '{}'
// await User.create({});
```

---

## Query Result Inference

Queries return typed model instances:

```typescript
const user = await User.find(1);
// user is typed as UserInstance | null

const firstUser = await User.findOrFail(1);
// firstUser is typed as UserInstance (throws 404 if not found)

const users = await User.query().get();
// users is typed as readonly UserInstance[]
```
