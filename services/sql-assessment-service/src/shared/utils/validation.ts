import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { databaseMetadata } from '../../database/internal-memory';
import { invalidAggregationPatterns } from '../constants';

export function isDatabaseRegistered(databaseKey: string): boolean {
    return databaseMetadata.has(databaseKey);
}

export function isValidForAggregation(columnName: string): boolean {
    return !invalidAggregationPatterns.test(columnName);
}

/**
 * Validates required fields on a Postgres connection info object.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateConnectionInfo(connectionInfo: PostgresConnectionOptions): string | null {
    if (
        !connectionInfo.host ||
        !connectionInfo.port ||
        !connectionInfo.username ||
        !connectionInfo.password ||
        !connectionInfo.schema
    ) {
        return 'Invalid connection information';
    }
    return null;
}
