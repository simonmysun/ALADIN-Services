import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { databaseMetadata } from '../../database/internal-memory';
import { invalidAggregationPatterns } from '../constants';
import { t, SupportedLanguage } from '../i18n';

export function isDatabaseRegistered(databaseKey: string): boolean {
    return databaseMetadata.has(databaseKey);
}

export function isValidForAggregation(columnName: string): boolean {
    return !invalidAggregationPatterns.test(columnName);
}

/**
 * Validates required fields on a Postgres connection info object.
 * Returns a translated error message string if invalid, or null if valid.
 *
 * @param connectionInfo - The connection options to validate.
 * @param lang           - Language for the error message (defaults to 'en').
 */
export function validateConnectionInfo(
    connectionInfo: PostgresConnectionOptions,
    lang: SupportedLanguage = 'en'
): string | null {
    if (
        !connectionInfo.host ||
        !connectionInfo.port ||
        !connectionInfo.username ||
        !connectionInfo.password ||
        !connectionInfo.schema
    ) {
        return t('INVALID_CONNECTION_INFO', lang);
    }
    return null;
}
