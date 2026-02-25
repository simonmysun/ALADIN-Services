import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { IMemoryDb, IBackup } from 'pg-mem';
import { DataSource } from 'typeorm';
import { createTestDb } from '../../helpers/pg-mem-factory';

// Tests for src/generation/query/sql-query-generation-service.ts
//
// Query generation requires a live DataSource to sample column values and
// validate generated queries. The pg-mem instance provides that without an
// external Postgres server.

let db: IMemoryDb;
let backup: IBackup;
let dataSource: DataSource;

beforeAll(async () => {
    ({ db, backup, dataSource } = await createTestDb());
});

beforeEach(() => {
    backup.restore();
});

afterAll(async () => {
    await dataSource.destroy();
});

describe('SQLQueryGenerationService', () => {
    describe('validateConfiguration', () => {
        it.todo('returns valid for a well-formed ITaskConfiguration');
        it.todo('returns invalid when joinDepth is negative');
        it.todo('returns invalid when columnCount is zero');
    });

    describe('generateContextBasedQuery', () => {
        it.todo('returns a SQL string and its AST for a simple configuration');
        it.todo('includes a JOIN clause when joinDepth > 0');
        it.todo('includes a WHERE clause when predicateCount > 0');
        it.todo('includes GROUP BY when groupby is true');
        it.todo('includes HAVING when having is true');
        it.todo('includes ORDER BY when orderby is true');
    });
});
