# sql-query-generation

To use this application add a .env file in the root level with the following key: `API_KEY={Add  OpenAI key here}`

Run the application with the command: `npx ts-node src/index.ts`

## Docker

```bash
# Build the image
docker build -t sql-assessment-service .

# Run (PostgreSQL-only mode — no PGlite needed)
docker run -p 3000:3000 sql-assessment-service

# Run with OpenAI key
docker run -p 3000:3000 -e API_KEY=sk-... sql-assessment-service
```

PGlite works out of the box inside the container — no external database required. The `@electric-sql/pglite` package (including its WASM binary) is copied into the image separately from the bundle because esbuild cannot inline WASM files.

To start a local PostgreSQL alongside the service:

```bash
docker compose up
```

The `docker-compose.yml` spins up a Postgres container. Uncomment the `app` service block to also run the API in Docker.

## PostgreSQL (external database)

Database Analysis: Call the POST API:
`http://localhost:3000/api/database/analyze-database`

with the following DTO in the body:

```json
{
	"connectionInfo": {
		"type": "postgres",
		"host": "{DatabaseHost}",
		"port": "{DatabasePort}",
		"username": "{DatabaseUserName}",
		"password": "{DatabasePassword}",
		"database": "{DatabaseName}",
		"schema": "{SchemaName}"
	}
}
```

```json
{
	"connectionInfo": {
		"type": "postgres",
		"host": "localhost",
		"port": "5432",
		"username": "myuser",
		"password": "mypass",
		"database": "fussballdb",
		"schema": "public"
	}
}
```

## PGlite (in-process, no external database required)

PGlite embeds a full PostgreSQL engine in-process. No server, no credentials — just pass your DDL + seed SQL and a unique `databaseId`. The instance is kept alive in memory for the lifetime of the service process.

### 1. Analyze (register) a PGlite database

Call `POST /api/database/analyze-database` with `type: "pglite"`:

```json
{
	"connectionInfo": {
		"type": "pglite",
		"databaseId": "my-db",
		"sqlContent": "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(10,2));\nINSERT INTO products (name, price) VALUES ('Widget', 9.99);"
	}
}
```

| Field | Required | Description |
|---|---|---|
| `type` | ✓ | Must be `"pglite"` |
| `databaseId` | ✓ | Arbitrary string key used to reference this instance in all subsequent calls |
| `sqlContent` | ✓ | Full DDL + optional seed DML executed once on a fresh in-memory PG instance |

Calling this endpoint again with the same `databaseId` replaces the existing instance.

### 2. Execute a query against a PGlite database

Call `POST /api/query/execute` with `type: "pglite"`:

```json
{
	"connectionInfo": {
		"type": "pglite",
		"databaseId": "my-db"
	},
	"query": "SELECT * FROM products"
}
```

Only SELECT statements are accepted; INSERT / UPDATE / DELETE / DDL are rejected with 400. The database must have been previously registered via the analyze endpoint.

## Task Generation

Call `POST /api/generation/generate` with the following body:

```json
{
	"connectionInfo": {
		"type": "postgres",
		"host": "localhost",
		"port": "5432",
		"username": "myuser",
		"password": "mypass",
		"database": "fussballdb",
		"schema": "public"
	},
	"taskConfiguration": {
		"aggregation": false,
		"columnCount": 2,
		"predicateCount": 2,
		"operationTypes": [],
		"joinDepth": 2,
		"joinTypes": [],
		"groupby": false,
		"having": false,
		"orderby": true
	}
}
```

PGlite variant:

```json
{
	"connectionInfo": {
		"type": "pglite",
		"databaseId": "my-db"
	},
	"taskConfiguration": {
		"aggregation": false,
		"columnCount": 2,
		"predicateCount": 2,
		"operationTypes": [],
		"joinDepth": 2,
		"joinTypes": [],
		"groupby": false,
		"having": false,
		"orderby": true
	}
}
```

What is possible to fill out in the configuration parameters can be found in interfaces.ts/ITaskConfiguration.

## Grading

Call `POST /api/grading/grade` with the following body:

```json
{
	"connectionInfo": {
		"type": "postgres",
		"host": "localhost",
		"port": "5432",
		"username": "myuser",
		"password": "mypass",
		"database": "fussballdb",
		"schema": "public"
	},
	"gradingRequest": {
		"taskId": "4f7c66ed-e4e5-422e-8d6f-ef4ee3876d07",
		"studentQuery": "SELECT character.kindid, character.genderid FROM public.couple INNER JOIN public.character ON couple.femaleid = character.characterid INNER JOIN public.kind ON character.kindid = kind.kindid WHERE kind.kindid >= 1 AND kind.kindid <= 4    OR character.characterid = 108 ORDER BY couple.femaleid ASC"
	}
}
```

PGlite variant:

```json
{
	"connectionInfo": {
		"type": "pglite",
		"databaseId": "my-db"
	},
	"gradingRequest": {
		"referenceQueries": [{ "query": "SELECT * FROM products ORDER BY price DESC" }],
		"studentQuery": "SELECT * FROM products ORDER BY price"
	}
}
```

