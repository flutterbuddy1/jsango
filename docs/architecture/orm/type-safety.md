# TypeScript Type Safety & Inference

## Design Principles

`@jsango/orm` provides end-to-end compile-time type safety with zero code generation steps and zero runtime reflection.

---

## Attribute Inference (`InferModelAttributes`)

When a model is defined via `defineModel`, TypeScript maps field definitions into concrete attribute types:

```typescript
import { defineModel, fields, type InferModelAttributes } from '@jsango/orm';

const userFields = {
  id: fields.integer({ primaryKey: true, autoIncrement: true }),
  name: fields.string(),
  email: fields.string({ nullable: true }),
  role: fields.string({ default: 'user' }),
  score: fields.float({ default: 0 }),
};

const User = defineModel({
  name: 'User',
  table: 'users',
  fields: userFields,
});

type UserAttributes = InferModelAttributes<typeof userFields>;
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

When creating records via `User.create(...)`, every known field is type-checked against its inferred type, but **all fields are optional** at compile time (`InferCreationAttributes` maps each field to `T | undefined`). Missing required (non-nullable, no default) columns are rejected by the database at runtime, not by the compiler.

```typescript
// Valid
await User.create({ name: 'Alice' });

// Valid: optional fields overridden
await User.create({ name: 'Bob', email: 'bob@example.com', role: 'admin' });

// Compile-time Error: Type 'number' is not assignable to type 'string'
// await User.create({ name: 42 });
```

---

## Query Result Inference

Queries return typed model instances:

```typescript
const user = await User.find(1);
// user is typed as ModelInstance<typeof userFields> | null

const firstUser = await User.findOrFail(1);
// firstUser is typed as ModelInstance<typeof userFields> (throws ModelNotFoundError if not found)

const users = await User.query().get();
// users is typed as readonly ModelInstance<typeof userFields>[]
```
