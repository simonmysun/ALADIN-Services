import { describe, it } from 'vitest';

// Tests for src/shared/utils/validation.ts
describe('validateConnectionInfo', () => {
    it.todo('returns null for a valid PostgresConnectionOptions object');
    it.todo('returns an error message when host is missing');
    it.todo('returns an error message when port is missing');
    it.todo('returns an error message when schema is missing');
});

describe('isDatabaseRegistered', () => {
    it.todo('returns true when the database key exists in the metadata map');
    it.todo('returns false when the database key is absent from both metadata maps');
});
