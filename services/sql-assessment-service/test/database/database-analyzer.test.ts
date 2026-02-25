import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { IMemoryDb, IBackup } from 'pg-mem';
import { DataSource } from 'typeorm';
import { createTestDb } from '../helpers/pg-mem-factory';

// Tests for src/database/database-analyzer.ts

let db: IMemoryDb;
let backup: IBackup;
let dataSource: DataSource;

beforeAll(async () => {
    ({ db, backup, dataSource } = await createTestDb());
});

beforeEach(() => {
    // Reset the in-memory DB to the post-seed state before each test.
    backup.restore();
});

afterAll(async () => {
    await dataSource.destroy();
});

describe('DatabaseAnalyzer', () => {
    it.todo('extracts table metadata from a connected database');
    it.todo('stores parsed tables in the in-memory metadata map');
    it.todo('stores parsed tables in the self-join metadata map when self-joins are present');
});
