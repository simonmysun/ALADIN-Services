import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { IMemoryDb, IBackup } from 'pg-mem';
import { DataSource } from 'typeorm';
import { createTestDb } from '../helpers/pg-mem-factory';

// Tests for src/grading/query-grading-service.ts
//
// The grading service runs live SQL queries (SELECT, EXPLAIN) against a real
// DataSource. We replace that DataSource with the pg-mem in-memory instance so
// no external Postgres server is required.

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

describe('SQLQueryGradingService', () => {
    describe('gradeQuery', () => {
        it.todo('returns grade 0 for a non-executable student query');
        it.todo('returns grade 0 when the student query uses an unsupported SQL clause type');
        it.todo('returns the maximum grade when student and reference queries are identical');
        it.todo('deducts points for a wrong SELECT column list');
        it.todo('deducts points for a missing WHERE clause');
        it.todo('deducts points for incorrect JOIN structure');
        it.todo('deducts points for a missing GROUP BY');
        it.todo('deducts points for a missing HAVING clause');
        it.todo('deducts points for a missing ORDER BY');
        it.todo('returns equivalent=true when result sets match');
        it.todo('returns equivalent=false when result sets differ');
    });
});
