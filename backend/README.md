# Crossed Backend

Backend service for Crossed. This document includes instructions for managing database migrations with TypeORM using the ESM-compatible CLI.

## Prerequisites

- Node.js and Yarn installed
- PostgreSQL running and accessible
- Environment variables configured in a `.env` file (the app loads it automatically)
- Install dependencies:
  - `yarn install`

## Database Migrations (TypeORM + ts-node ESM)

This project uses the `typeorm-ts-node-esm` CLI to work with TypeORM migrations in an ESM environment. Package scripts are configured in `package.json` so you can use simple Yarn commands.

Scripts configured:
- Generate migration (ESM, uses the project DataSource):
  - `yarn run migration:generate src/migrations/<name>`
- Run pending migrations:
  - `yarn run migration:run`
- Revert the last migration:
  - `yarn run migration:revert`
- Create an empty migration (for manual edits):
  - `yarn run migration:create src/migrations/<name>`

The `-d ./src/data-source.ts` flag is baked into the scripts so the CLI uses the project's DataSource configuration.

### Common workflows

- Create a new migration from entity changes
  1) Make changes to your entities under `src/entities/*`.
  2) Generate a migration:
     ```
     yarn run migration:generate src/migrations/add-new-feature
     ```
  3) Review and commit the generated file under `src/migrations/`.

- Apply migrations to your database
  ```
  yarn run migration:run
  ```

- Revert the most recent migration
  ```
  yarn run migration:revert
  ```

- Create an empty migration (manual)
  ```
  yarn run migration:create src/migrations/manual-tweak
  ```
  Then edit the generated migration file to implement the changes you need.

- Show migration status (on-demand via npx)
  ```
  npx typeorm-ts-node-esm migration:show -d ./src/data-source.ts
  ```

### Notes and conventions

- Migration files live in `src/migrations/`.
- The CLI is ESM-compatible and runs through `typeorm-ts-node-esm`.
- The DataSource used by the CLI is `./src/data-source.ts`.

### Troubleshooting

- Error: `no schema has been selected to create in`
  - Cause: PostgreSQL needs a target schema when creating the `migrations` table or running migrations.
  - Fix options:
    - Ensure your database user's `search_path` includes a default schema (e.g., `public`), or
    - Set the schema explicitly in your TypeORM DataSource options (e.g., `schema: 'public'` for Postgres).
  - Example (TypeORM DataSource snippet):
    ```ts
    import 'reflect-metadata';
    import { DataSource } from 'typeorm';

    export const dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      // or provide host, port, username, password, database
      // host: process.env.PGHOST,
      // port: Number(process.env.PGPORT || 5432),
      // username: process.env.PGUSER,
      // password: process.env.PGPASSWORD,
      // database: process.env.PGDATABASE,
      schema: 'public', // ensure a schema is set/available
      entities: ['src/entities/**/*.ts'],
      migrations: ['src/migrations/**/*.ts'],
      // ...other options
    });
    ```
  - Also confirm the `DATABASE_URL` (or individual PG vars) in your `.env` file point to the right database.

- ESM/TypeScript quirks:
  - The CLI is already configured to work with ESM TypeScript via `typeorm-ts-node-esm`.
  - If you encounter module resolution issues, ensure your `tsconfig.json` and `type: "module"` are aligned, and that you are not mixing CJS and ESM unintentionally.

### Examples

- Generate an initial migration:
  ```
  yarn run migration:generate src/migrations/init
  ```

- Run migrations on CI (example):
  ```
  yarn run migration:run
  ```

- Revert the last migration if needed:
  ```
  yarn run migration:revert
  ```

## Testing

- Run the test suite with coverage:
  ```
  yarn test
  ```

## Coverage Report

- Serve the coverage report locally:
  ```
  yarn serve:coverage
