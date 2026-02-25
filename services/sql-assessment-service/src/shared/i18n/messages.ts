/**
 * Centralised error-message catalogue.
 *
 * Every user-facing error string in the API lives here, keyed by a
 * language-neutral MessageKey.  Controllers and services call t(key, lang)
 * instead of inlining raw strings so that new languages can be added in one
 * place without touching any controller code.
 *
 * Interpolation: a handful of messages contain a single {{value}} placeholder.
 * Pass the `params` argument to t() to substitute it.
 *
 * Supported languages: "en" (default), "de".
 * Unknown language codes fall back to English.
 */

export type MessageKey =
    // ── shared / connection ──────────────────────────────────────────────────
    | 'INVALID_REQUEST_BODY'
    | 'MISSING_CONNECTION_INFO'
    | 'INVALID_CONNECTION_INFO'
    | 'UNABLE_TO_CONNECT'
    | 'DATABASE_NOT_REGISTERED'
    // ── database controller ──────────────────────────────────────────────────
    | 'DATABASE_ANALYSIS_SUCCESS'
    | 'DATABASE_SCHEMA_EXTRACTION_FAILED'
    // ── query execution ──────────────────────────────────────────────────────
    | 'MISSING_OR_EMPTY_QUERY'
    | 'QUERY_EMPTY'
    | 'QUERY_PARSE_ERROR'
    | 'QUERY_MULTIPLE_STATEMENTS'
    | 'QUERY_NON_SELECT'
    | 'QUERY_EXECUTION_FAILED'
    | 'QUERY_UNEXPECTED_ERROR'
    // ── grading ──────────────────────────────────────────────────────────────
    | 'GRADING_READ_ERROR'
    | 'GRADING_CONNECTION_READ_ERROR'
    | 'GRADING_FAILED'
    | 'GRADING_FAILED_WITH_ERROR'
    // ── description generation ───────────────────────────────────────────────
    | 'DESCRIPTION_MISSING_QUERY'
    | 'DESCRIPTION_PARSE_FAILED'
    | 'DESCRIPTION_TEMPLATE_FAILED'
    | 'DESCRIPTION_LLM_DEFAULT_FAILED'
    | 'DESCRIPTION_LLM_CREATIVE_FAILED'
    | 'DESCRIPTION_LLM_MULTISTEP_FAILED'
    | 'DESCRIPTION_HYBRID_FAILED'
    // ── task generation ──────────────────────────────────────────────────────
    | 'TASK_GENERATION_INVALID_REQUEST'
    | 'TASK_GENERATION_INVALID_CONNECTION'
    | 'TASK_GENERATION_QUERY_ERROR'
    | 'TASK_GENERATION_DESCRIPTION_ERROR';

export type SupportedLanguage = 'en' | 'de';

type MessageCatalogue = Record<SupportedLanguage, Record<MessageKey, string>>;

export const MESSAGES: MessageCatalogue = {
    en: {
        // shared
        INVALID_REQUEST_BODY:             'Invalid request body.',
        MISSING_CONNECTION_INFO:          'Missing connectionInfo.',
        INVALID_CONNECTION_INFO:          'Invalid connection information.',
        UNABLE_TO_CONNECT:                'Unable to connect to database.',
        DATABASE_NOT_REGISTERED:          'Unregistered database, please trigger database analysis.',
        // database controller
        DATABASE_ANALYSIS_SUCCESS:        'Connection successful.',
        DATABASE_SCHEMA_EXTRACTION_FAILED:'Unable to extract database schema.',
        // query execution
        MISSING_OR_EMPTY_QUERY:           'Missing or empty query string.',
        QUERY_EMPTY:                      'Query must not be empty.',
        QUERY_PARSE_ERROR:                'The provided input could not be parsed as a SQL query.',
        QUERY_MULTIPLE_STATEMENTS:        'Only a single SELECT statement is allowed per request.',
        QUERY_NON_SELECT:                 'Only SELECT queries are permitted. Received statement type: "{{value}}".',
        QUERY_EXECUTION_FAILED:           'Query execution failed: {{value}}',
        QUERY_UNEXPECTED_ERROR:           'Unexpected error: {{value}}',
        // grading
        GRADING_READ_ERROR:               'Error reading task configuration.',
        GRADING_CONNECTION_READ_ERROR:    'Error reading connection information.',
        GRADING_FAILED:                   'Unable to grade query.',
        GRADING_FAILED_WITH_ERROR:        'Unable to grade query. Error: {{value}}',
        // description
        DESCRIPTION_MISSING_QUERY:        'Missing or empty query string.',
        DESCRIPTION_PARSE_FAILED:         'Failed to parse SQL query: {{value}}',
        DESCRIPTION_TEMPLATE_FAILED:      'Error in template description generation: {{value}}',
        DESCRIPTION_LLM_DEFAULT_FAILED:   'Error in LLM default description generation: {{value}}',
        DESCRIPTION_LLM_CREATIVE_FAILED:  'Error in LLM creative description generation: {{value}}',
        DESCRIPTION_LLM_MULTISTEP_FAILED: 'Error in LLM multi-step description generation: {{value}}',
        DESCRIPTION_HYBRID_FAILED:        'Error in hybrid description generation: {{value}}',
        // task generation
        TASK_GENERATION_INVALID_REQUEST:    'Invalid request information.',
        TASK_GENERATION_INVALID_CONNECTION: 'Invalid connection information.',
        TASK_GENERATION_QUERY_ERROR:        'Error in query generation, please try again. {{value}}',
        TASK_GENERATION_DESCRIPTION_ERROR:  'Error in task description generation, please try again.',
    },

    de: {
        // shared
        INVALID_REQUEST_BODY:             'Ungültiger Anfrage-Body.',
        MISSING_CONNECTION_INFO:          'Verbindungsinformationen fehlen.',
        INVALID_CONNECTION_INFO:          'Ungültige Verbindungsinformationen.',
        UNABLE_TO_CONNECT:                'Verbindung zur Datenbank nicht möglich.',
        DATABASE_NOT_REGISTERED:          'Datenbank nicht registriert. Bitte zunächst eine Datenbankanalyse auslösen.',
        // database controller
        DATABASE_ANALYSIS_SUCCESS:        'Verbindung erfolgreich.',
        DATABASE_SCHEMA_EXTRACTION_FAILED:'Das Datenbankschema konnte nicht extrahiert werden.',
        // query execution
        MISSING_OR_EMPTY_QUERY:           'Abfragezeichenkette fehlt oder ist leer.',
        QUERY_EMPTY:                      'Die Abfrage darf nicht leer sein.',
        QUERY_PARSE_ERROR:                'Die Eingabe konnte nicht als SQL-Abfrage analysiert werden.',
        QUERY_MULTIPLE_STATEMENTS:        'Pro Anfrage ist nur eine einzelne SELECT-Anweisung erlaubt.',
        QUERY_NON_SELECT:                 'Nur SELECT-Abfragen sind zulässig. Empfangener Anweisungstyp: "{{value}}".',
        QUERY_EXECUTION_FAILED:           'Abfrageausführung fehlgeschlagen: {{value}}',
        QUERY_UNEXPECTED_ERROR:           'Unerwarteter Fehler: {{value}}',
        // grading
        GRADING_READ_ERROR:               'Fehler beim Lesen der Aufgabenkonfiguration.',
        GRADING_CONNECTION_READ_ERROR:    'Fehler beim Lesen der Verbindungsinformationen.',
        GRADING_FAILED:                   'Die Abfrage konnte nicht bewertet werden.',
        GRADING_FAILED_WITH_ERROR:        'Die Abfrage konnte nicht bewertet werden. Fehler: {{value}}',
        // description
        DESCRIPTION_MISSING_QUERY:        'Abfragezeichenkette fehlt oder ist leer.',
        DESCRIPTION_PARSE_FAILED:         'SQL-Abfrage konnte nicht analysiert werden: {{value}}',
        DESCRIPTION_TEMPLATE_FAILED:      'Fehler bei der Template-basierten Beschreibungsgenerierung: {{value}}',
        DESCRIPTION_LLM_DEFAULT_FAILED:   'Fehler bei der Standard-LLM-Beschreibungsgenerierung: {{value}}',
        DESCRIPTION_LLM_CREATIVE_FAILED:  'Fehler bei der kreativen LLM-Beschreibungsgenerierung: {{value}}',
        DESCRIPTION_LLM_MULTISTEP_FAILED: 'Fehler bei der mehrstufigen LLM-Beschreibungsgenerierung: {{value}}',
        DESCRIPTION_HYBRID_FAILED:        'Fehler bei der hybriden Beschreibungsgenerierung: {{value}}',
        // task generation
        TASK_GENERATION_INVALID_REQUEST:    'Ungültige Anfrageinformationen.',
        TASK_GENERATION_INVALID_CONNECTION: 'Ungültige Verbindungsinformationen.',
        TASK_GENERATION_QUERY_ERROR:        'Fehler bei der Abfragegenerierung, bitte erneut versuchen. {{value}}',
        TASK_GENERATION_DESCRIPTION_ERROR:  'Fehler bei der Aufgabenbeschreibungsgenerierung, bitte erneut versuchen.',
    },
};
