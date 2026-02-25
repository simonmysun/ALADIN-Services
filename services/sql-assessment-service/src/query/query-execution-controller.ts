import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { connectToDatabase, generateDatabaseKey } from '../shared/utils/database-utils';
import { isDatabaseRegistered, validateConnectionInfo } from '../shared/utils/validation';
import { IRequestQueryOptions } from '../shared/interfaces/http';
import { QueryExecutionError, QueryExecutionService } from './query-execution-service';
import { t, resolveLanguageCode } from '../shared/i18n';

/**
 * Exposes a single endpoint for executing a raw SQL SELECT query against a
 * pre-registered database.
 *
 *   POST /api/query/execute
 *
 * Request body: IRequestQueryOptions
 *   { connectionInfo, query, languageCode? }
 *
 * Success response (200):
 *   { rows: Record<string, unknown>[], rowCount: number }
 *
 * Error responses:
 *   400 – missing / invalid input, unregistered DB, non-SELECT or unparseable query
 *   500 – database-level execution failure or unexpected error
 *
 * All error messages are localised according to the optional `languageCode`
 * field in the request body (default: "en").
 */
export class QueryExecutionController {
    public router: Router;
    private readonly queryExecutionService: QueryExecutionService;

    constructor(queryExecutionService: QueryExecutionService) {
        this.queryExecutionService = queryExecutionService;
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.post('/execute', (req: Request, res: Response) => {
            this.executeQuery(req, res);
        });
    }

    public async executeQuery(req: Request, res: Response): Promise<Response> {
        let options: IRequestQueryOptions;

        try {
            options = req.body as IRequestQueryOptions;
        } catch {
            // Language unknown at this point — fall back to default.
            return res.status(400).json({ message: t('INVALID_REQUEST_BODY', 'en') });
        }

        const lang = resolveLanguageCode(options?.languageCode);

        if (!options?.connectionInfo) {
            return res.status(400).json({ message: t('MISSING_CONNECTION_INFO', lang) });
        }

        if (!options.query || typeof options.query !== 'string' || options.query.trim() === '') {
            return res.status(400).json({ message: t('MISSING_OR_EMPTY_QUERY', lang) });
        }

        const validationError = validateConnectionInfo(options.connectionInfo, lang);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const { host, port, schema } = options.connectionInfo;
        const databaseKey = generateDatabaseKey(host!, port!, schema!);

        if (!isDatabaseRegistered(databaseKey)) {
            return res.status(400).json({ message: t('DATABASE_NOT_REGISTERED', lang) });
        }

        let dataSource: DataSource;
        let isConnected: boolean;
        try {
            dataSource = new DataSource(options.connectionInfo);
            isConnected = await connectToDatabase(dataSource);
        } catch {
            return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
        }

        if (!isConnected) {
            return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
        }

        try {
            const result = await this.queryExecutionService.executeQuery(
                options.query,
                dataSource,
                lang
            );
            await dataSource.destroy();
            return res.status(200).json(result);
        } catch (err) {
            await dataSource.destroy();

            if (err instanceof QueryExecutionError) {
                const clientCodes: QueryExecutionError['code'][] = [
                    'EMPTY_QUERY',
                    'PARSE_ERROR',
                    'MULTIPLE_STATEMENTS',
                    'NON_SELECT',
                ];
                const status = clientCodes.includes(err.code) ? 400 : 500;
                return res.status(status).json({ message: err.message, code: err.code });
            }

            console.error('Unexpected error in query execution', err);
            return res.status(500).json({ message: t('QUERY_UNEXPECTED_ERROR', lang, String(err)) });
        }
    }
}
