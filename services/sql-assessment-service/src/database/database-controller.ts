import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DatabaseAnalyzer } from './database-analyzer';
import { connectToDatabase, generateDatabaseKey } from '../shared/utils/database-utils';
import { validateConnectionInfo } from '../shared/utils/validation';

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

        try {
            connectionInfo = req.body.connectionInfo;
        } catch (err: any) {
            console.log('Invalid connection info', err);
            return res.status(400).json({ message: 'Invalid connection information', error: err });
        }

        const validationError = validateConnectionInfo(connectionInfo);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        console.log('Received connection info:', connectionInfo);
        try {
            dataSource = new DataSource(connectionInfo);
            isConnected = await connectToDatabase(dataSource);
        } catch (error) {
            return res.status(400).json({ message: 'Unable to connect to database' });
        }

        if (isConnected) {
            if (
                await this.databaseAnalyzer.extractDatabaseSchema(
                    dataSource,
                    connectionInfo.schema!,
                    generateDatabaseKey(connectionInfo.host!, connectionInfo.port!, connectionInfo.schema!)
                )
            ) {
                await dataSource.destroy();
                return res.status(200).json({ message: 'Connection successful' });
            }
            await dataSource.destroy();
            return res.status(500).json({ message: 'Unable to extract database schema' });
        }

        try {
            await dataSource.destroy();
        } catch (error) {
            console.log(error);
        }
        return res.status(400).json({ message: 'Unable to connect to database' });
    }
}
