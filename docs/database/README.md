# Database Setup

`jsango new <project-name>` creates `src/database.ts` and registers its `DatabaseManager` with the ORM. The generated app defaults to the in-memory driver so it runs without a database server. JSango does not automatically load a `jsango.config.ts` file. To use a real database, install that database's Node.js client, copy `.env.example` to `.env`, select the driver, and restart the app.

## PostgreSQL

```bash
npm install pg
```

```env
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://app_user:password@localhost:5432/app_db
```

## MySQL or MariaDB

```bash
npm install mysql2
```

```env
DATABASE_DRIVER=mysql
DATABASE_URL=mysql://app_user:password@localhost:3306/app_db
```

## SQLite

Node.js 22 and newer can use the built-in `node:sqlite` module. On Node.js 20, install `better-sqlite3`:

```bash
npm install better-sqlite3
```

```env
DATABASE_DRIVER=sqlite
DATABASE_FILE=./app.sqlite
```

## MongoDB

```bash
npm install mongodb
```

```env
DATABASE_DRIVER=mongodb
DATABASE_URL=mongodb://127.0.0.1:27017
DATABASE_NAME=app_db
```

The built-in ORM and migration tools issue SQL and are intended for PostgreSQL, MySQL, and SQLite. The MongoDB driver accepts JSON commands rather than SQL; use it through the low-level database connection API, not `defineModel()` or the SQL migration runner.

## Check the connection

The generated project exposes a database health endpoint. Start the app, then request:

```bash
curl http://127.0.0.1:3000/health/database
```

If the configured client package is missing or the server cannot be reached, the endpoint reports an unhealthy connection. Check `DATABASE_DRIVER`, the URL or host/name settings, credentials, and that the database server is running.

## Configure a database manually

For projects that do not use the generated `src/database.ts`, create and register the manager before using ORM models:

```ts
import { DatabaseManager, setDatabaseManager } from 'jsango';

export const db = new DatabaseManager({
  default: 'primary',
  connections: {
    primary: {
      driver: 'postgres',
      url: process.env.DATABASE_URL,
      pool: { min: 1, max: 10 },
    },
  },
});

setDatabaseManager(db);
```

Call `await db.close()` during graceful shutdown. Driver client packages are peer/runtime requirements for the selected database and are intentionally installed only when that database is used.
