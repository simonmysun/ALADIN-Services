import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DatabaseAnalyzer } from './database-analyzer';
import { connectToDatabase, generateDatabaseKey } from '../shared/utils/database-utils';
import { validateConnectionInfo } from '../shared/utils/validation';
import { t, resolveLanguageCode } from '../shared/i18n';
import { IAliasMap } from '../shared/interfaces/domain';

export class DatabaseController {
    public router: Router;
    databaseAnalyzer: DatabaseAnalyzer;

    constructor(databaseAnalyzer: DatabaseAnalyzer) {
        this.databaseAnalyzer = databaseAnalyzer;
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.post('/analyze-database', (req: Request, resp: Response) => {
            this.analyzeDatabase(req, resp);
        });
    }

    public async analyzeDatabase(req: Request, res: Response): Promise<Response> {
        let connectionInfo: PostgresConnectionOptions;
        let dataSource: DataSource;
        let isConnected: boolean;

        const lang = resolveLanguageCode(req.body?.languageCode);

        try {
            connectionInfo = req.body.connectionInfo;
        } catch (err: any) {
            console.log('Invalid connection info', err);
            return res.status(400).json({ message: t('INVALID_CONNECTION_INFO', lang) });
        }

        const validationError = validateConnectionInfo(connectionInfo, lang);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        console.log('Received connection info:', connectionInfo);
        try {
            dataSource = new DataSource(connectionInfo);
            isConnected = await connectToDatabase(dataSource);
        } catch (error) {
            return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
        }

        // Parse and validate the optional alias map
        let aliasMap: IAliasMap | undefined;
        const rawAliasMap = req.body.aliasMap;
        if (rawAliasMap !== undefined) {
            if (
                typeof rawAliasMap !== 'object' ||
                Array.isArray(rawAliasMap) ||
                rawAliasMap === null
            ) {
                console.log('Invalid aliasMap provided — must be a plain object. Ignoring.');
            } else {
                aliasMap = rawAliasMap as IAliasMap;
            }
        }

        if (isConnected) {
            if (
                await this.databaseAnalyzer.extractDatabaseSchema(
                    dataSource,
                    connectionInfo.schema!,
                    generateDatabaseKey(connectionInfo.host!, connectionInfo.port!, connectionInfo.schema!),
                    aliasMap
                )
            ) {
                await dataSource.destroy();
                return res.status(200).json({ message: t('DATABASE_ANALYSIS_SUCCESS', lang) });
            }
            await dataSource.destroy();
            return res.status(500).json({ message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang) });
        }

        try {
            await dataSource.destroy();
        } catch (error) {
            console.log(error);
        }
        return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
    }
}
