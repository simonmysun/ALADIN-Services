import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AST, Parser } from 'node-sql-parser';
import { connectToDatabase, generateDatabaseKey } from '../shared/utils/database-utils';
import { isDatabaseRegistered, validateConnectionInfo } from '../shared/utils/validation';
import { SQLQueryGradingService } from './query-grading-service';
import { GenerationOptions, GptOptions, IRequestGradingOptions } from '../shared/interfaces/index';
import { TaskDescriptionGenerationService } from '../generation/description/task-description-generation-service';

export class GradingController {
    public router: Router;
    queryGradingService: SQLQueryGradingService;
    taskDescriptionGenerationService: TaskDescriptionGenerationService;

    constructor(
        queryGradingService: SQLQueryGradingService,
        taskDescriptionGenerationService: TaskDescriptionGenerationService
    ) {
        this.queryGradingService = queryGradingService;
        this.taskDescriptionGenerationService = taskDescriptionGenerationService;
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.post('/grade', (req: Request, resp: Response) => {
            this.gradeQuery(req, resp);
        });
    }

    async gradeQuery(req: Request, res: Response): Promise<Response> {
        let gradingRequestOptions: IRequestGradingOptions;
        let connectionInfo: PostgresConnectionOptions;

        try {
            gradingRequestOptions = req.body;
        } catch (err: any) {
            console.log('Error in reading grading request', err);
            return res.status(400).json({ message: 'Error in reading task configuration' });
        }

        try {
            connectionInfo = gradingRequestOptions.connectionInfo;
        } catch (err: any) {
            console.log('Error in reading connection info', err);
            return res.status(400).json({ message: 'Error in connection info' });
        }

        const validationError = validateConnectionInfo(connectionInfo);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const databaseKey = generateDatabaseKey(connectionInfo.host!, connectionInfo.port!, connectionInfo.schema!);
        if (!isDatabaseRegistered(databaseKey)) {
            return res.status(400).json({ message: 'Unregistered database, please trigger database analysis.' });
        }

        let dataSource: DataSource;
        let isConnected: boolean;
        try {
            dataSource = new DataSource(connectionInfo);
            isConnected = await connectToDatabase(dataSource);
        } catch (error) {
            return res.status(400).json({ message: 'Unable to connect to database' });
        }

        const gradingRequest = gradingRequestOptions.gradingRequest;
        if (isConnected) {
            try {
                let comparisonResult = await this.queryGradingService.gradeQuery(
                    gradingRequest.referenceQuery,
                    gradingRequest.studentQuery,
                    dataSource,
                    databaseKey
                );
                let studentTaskDescription: string | undefined;

                if (!comparisonResult.equivalent && comparisonResult.supportedQueryType && process.env.OPENAI_API_KEY) {
                    const parser = new Parser();
                    let studentAST = parser.astify(gradingRequest.studentQuery, { database: 'postgresql' });
                    studentTaskDescription = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                        GenerationOptions.Hybrid,
                        gradingRequest.studentQuery,
                        studentAST as AST,
                        connectionInfo.schema!,
                        databaseKey
                    );
                } else if (!comparisonResult.equivalent && process.env.OPENAI_API_KEY) {
                    studentTaskDescription = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                        GenerationOptions.LLM,
                        gradingRequest.studentQuery,
                        {} as AST,
                        connectionInfo.schema!,
                        databaseKey,
                        undefined,
                        GptOptions.Default
                    );
                }

                if (studentTaskDescription) {
                    comparisonResult.feedback.push('\n Your query solves the task with the following description:');
                    comparisonResult.feedback.push(studentTaskDescription);
                }

                await dataSource.destroy();
                return res.status(200).json({ comparisonResult });
            } catch (error) {
                console.log(error);
                await dataSource.destroy();
                return res.status(500).json({ message: `Unable to grade query. Error: ${error}` });
            }
        }
        return res.status(500).json({ message: 'Unable to grade query.' });
    }
}
