# Field System

## Supported Field Types

`@django-js/orm` includes standard field types corresponding to relational database column types:

| Helper Factory              | TypeScript Type | Description                                |
| :-------------------------- | :-------------- | :----------------------------------------- |
| `fields.string(options?)`   | `string`        | Variable-length character string (VARCHAR) |
| `fields.text(options?)`     | `string`        | Long text data (TEXT / CLOB)               |
| `fields.integer(options?)`  | `number`        | 32-bit signed integer (INTEGER)            |
| `fields.bigint(options?)`   | `bigint`        | 64-bit integer (BIGINT)                    |
| `fields.float(options?)`    | `number`        | Floating-point number (REAL / FLOAT)       |
| `fields.decimal(options?)`  | `number`        | Exact decimal number with precision/scale  |
| `fields.boolean(options?)`  | `boolean`       | Boolean flag (BOOLEAN / TINYINT)           |
| `fields.dateTime(options?)` | `Date`          | Timestamp with date and time               |
| `fields.date(options?)`     | `Date`          | Date without time                          |
| `fields.time(options?)`     | `Date`          | Time without date                          |
| `fields.json(options?)`     | `unknown`       | JSON document (JSON / JSONB)               |
| `fields.uuid(options?)`     | `string`        | Universally Unique Identifier              |
| `fields.binary(options?)`   | `Uint8Array`    | Raw binary buffer (BLOB / BYTEA)           |

---

## Field Options

Every field factory accepts an options configuration:

```typescript
fields.string({
  nullable: true, // Allows null values (defaults to false)
  primaryKey: true, // Marks column as primary key
  autoIncrement: true, // Database auto-increments column
  unique: true, // Enforces unique constraint
  indexed: true, // Creates a database index
  default: 'draft', // Default value (literal or function)
  columnName: 'post_status', // Custom database column name
  length: 50, // Maximum string length
  precision: 10, // Total number of digits (decimals)
  scale: 2, // Digits after decimal point
  comment: 'Status of post', // Schema documentation
  options: { admin: {} }, // Extensible metadata options
});
```

---

## Dynamic Default Values

Defaults can be specified either as static literals or generator functions:

```typescript
// Static default
fields.string({ default: 'user' });

// Dynamic generator function
fields.string({ default: () => crypto.randomUUID() });
```

Dynamic defaults are executed during model instantiation when saving a new record.
