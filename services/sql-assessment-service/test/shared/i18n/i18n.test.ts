import { describe, it, expect } from 'vitest';
import { t, resolveLanguageCode, DEFAULT_LANGUAGE, MESSAGES } from '../../../src/shared/i18n';
import type { MessageKey, SupportedLanguage } from '../../../src/shared/i18n';

// ---------------------------------------------------------------------------
// resolveLanguageCode
// ---------------------------------------------------------------------------

describe('resolveLanguageCode', () => {

    it('returns "en" for undefined input', () => {
        expect(resolveLanguageCode(undefined)).toBe('en');
    });

    it('returns "en" for null input', () => {
        expect(resolveLanguageCode(null)).toBe('en');
    });

    it('returns "en" for an empty string', () => {
        expect(resolveLanguageCode('')).toBe('en');
    });

    it('returns "en" for a non-string value (number coerced)', () => {
        expect(resolveLanguageCode(42 as any)).toBe('en');
    });

    it('returns "en" for an unknown language code', () => {
        expect(resolveLanguageCode('fr')).toBe('en');
    });

    it('returns "en" for an unknown code that looks like BCP 47', () => {
        expect(resolveLanguageCode('fr-FR')).toBe('en');
    });

    it('returns "en" for the bare code "en"', () => {
        expect(resolveLanguageCode('en')).toBe('en');
    });

    it('returns "en" for uppercase "EN"', () => {
        expect(resolveLanguageCode('EN')).toBe('en');
    });

    it('returns "de" for the bare code "de"', () => {
        expect(resolveLanguageCode('de')).toBe('de');
    });

    it('returns "de" for uppercase "DE"', () => {
        expect(resolveLanguageCode('DE')).toBe('de');
    });

    it('strips the region subtag: "de-AT" resolves to "de"', () => {
        expect(resolveLanguageCode('de-AT')).toBe('de');
    });

    it('strips the region subtag: "de-DE" resolves to "de"', () => {
        expect(resolveLanguageCode('de-DE')).toBe('de');
    });

    it('strips the region subtag: "en-US" resolves to "en"', () => {
        expect(resolveLanguageCode('en-US')).toBe('en');
    });

    it('DEFAULT_LANGUAGE is "en"', () => {
        expect(DEFAULT_LANGUAGE).toBe('en');
    });

});

// ---------------------------------------------------------------------------
// t() — basic resolution
// ---------------------------------------------------------------------------

describe('t()', () => {

    it('returns the English message for a known key with lang "en"', () => {
        expect(t('UNABLE_TO_CONNECT', 'en')).toBe('Unable to connect to database.');
    });

    it('returns the German message for a known key with lang "de"', () => {
        expect(t('UNABLE_TO_CONNECT', 'de')).toBe('Verbindung zur Datenbank nicht möglich.');
    });

    it('English and German messages for the same key are different', () => {
        expect(t('DATABASE_NOT_REGISTERED', 'en')).not.toBe(t('DATABASE_NOT_REGISTERED', 'de'));
    });

    it('returns a non-empty string for every key in English', () => {
        const enKeys = Object.keys(MESSAGES.en) as MessageKey[];
        for (const key of enKeys) {
            const msg = t(key, 'en');
            expect(msg, `key "${key}" must not be empty`).toBeTruthy();
        }
    });

    it('returns a non-empty string for every key in German', () => {
        const deKeys = Object.keys(MESSAGES.de) as MessageKey[];
        for (const key of deKeys) {
            const msg = t(key, 'de');
            expect(msg, `key "${key}" must not be empty`).toBeTruthy();
        }
    });

    it('English and German catalogues have identical sets of keys', () => {
        const enKeys = Object.keys(MESSAGES.en).sort();
        const deKeys = Object.keys(MESSAGES.de).sort();
        expect(enKeys).toEqual(deKeys);
    });

});

// ---------------------------------------------------------------------------
// t() — {{value}} interpolation
// ---------------------------------------------------------------------------

describe('t() interpolation', () => {

    it('substitutes {{value}} in English', () => {
        const msg = t('QUERY_NON_SELECT', 'en', 'insert');
        expect(msg).toBe('Only SELECT queries are permitted. Received statement type: "insert".');
    });

    it('substitutes {{value}} in German', () => {
        const msg = t('QUERY_NON_SELECT', 'de', 'insert');
        expect(msg).toBe('Nur SELECT-Abfragen sind zulässig. Empfangener Anweisungstyp: "insert".');
    });

    it('substitutes {{value}} for QUERY_EXECUTION_FAILED in English', () => {
        const msg = t('QUERY_EXECUTION_FAILED', 'en', 'syntax error');
        expect(msg).toContain('syntax error');
        expect(msg).toContain('Query execution failed');
    });

    it('substitutes {{value}} for QUERY_EXECUTION_FAILED in German', () => {
        const msg = t('QUERY_EXECUTION_FAILED', 'de', 'Syntaxfehler');
        expect(msg).toContain('Syntaxfehler');
        expect(msg).toContain('fehlgeschlagen');
    });

    it('returns the template unchanged when no value is provided for a placeholder message', () => {
        // Without a value argument, the literal {{value}} stays in the string.
        const msg = t('QUERY_NON_SELECT', 'en');
        expect(msg).toContain('{{value}}');
    });

    it('substitutes only the first occurrence of {{value}}', () => {
        // All current templates contain at most one {{value}}, so this is a
        // consistency guard.
        const msg = t('GRADING_FAILED_WITH_ERROR', 'en', 'timeout');
        expect(msg).toContain('timeout');
        expect(msg).not.toContain('{{value}}');
    });

});

// ---------------------------------------------------------------------------
// t() — language coverage for every error-path key
// ---------------------------------------------------------------------------

describe('t() — spot-checks across languages', () => {

    const cases: Array<[MessageKey, SupportedLanguage, string]> = [
        ['INVALID_REQUEST_BODY',             'en', 'Invalid request body'],
        ['INVALID_REQUEST_BODY',             'de', 'Anfrage-Body'],
        ['MISSING_CONNECTION_INFO',          'en', 'Missing'],
        ['MISSING_CONNECTION_INFO',          'de', 'fehlen'],
        ['INVALID_CONNECTION_INFO',          'en', 'Invalid connection'],
        ['INVALID_CONNECTION_INFO',          'de', 'Ungültige Verbindung'],
        ['DATABASE_NOT_REGISTERED',          'en', 'database analysis'],
        ['DATABASE_NOT_REGISTERED',          'de', 'Datenbankanalyse'],
        ['DATABASE_ANALYSIS_SUCCESS',        'en', 'successful'],
        ['DATABASE_ANALYSIS_SUCCESS',        'de', 'erfolgreich'],
        ['DATABASE_SCHEMA_EXTRACTION_FAILED','en', 'extract'],
        ['DATABASE_SCHEMA_EXTRACTION_FAILED','de', 'extrahiert'],
        ['MISSING_OR_EMPTY_QUERY',           'en', 'empty'],
        ['MISSING_OR_EMPTY_QUERY',           'de', 'leer'],
        ['QUERY_EMPTY',                      'en', 'must not be empty'],
        ['QUERY_EMPTY',                      'de', 'leer'],
        ['QUERY_PARSE_ERROR',                'en', 'parsed'],
        ['QUERY_PARSE_ERROR',                'de', 'analysiert'],
        ['QUERY_MULTIPLE_STATEMENTS',        'en', 'single SELECT'],
        ['QUERY_MULTIPLE_STATEMENTS',        'de', 'SELECT-Anweisung'],
        ['GRADING_FAILED',                   'en', 'grade'],
        ['GRADING_FAILED',                   'de', 'bewertet'],
        ['DESCRIPTION_MISSING_QUERY',        'en', 'empty'],
        ['DESCRIPTION_MISSING_QUERY',        'de', 'leer'],
        ['TASK_GENERATION_DESCRIPTION_ERROR','en', 'try again'],
        ['TASK_GENERATION_DESCRIPTION_ERROR','de', 'erneut versuchen'],
    ];

    it.each(cases)('t("%s", "%s") contains "%s"', (key, lang, expected) => {
        expect(t(key, lang)).toContain(expected);
    });

});
