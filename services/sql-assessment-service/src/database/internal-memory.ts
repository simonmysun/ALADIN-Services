import { IParsedTable } from '../shared/interfaces/domain';

export const databaseMetadata: Map<string, IParsedTable[]> = new Map();

export const selfJoinDatabaseMetadata: Map<string, IParsedTable[]> = new Map();

// Stores live PGlite instances indexed by databaseId.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pgliteInstances: Map<string, any> = new Map();
