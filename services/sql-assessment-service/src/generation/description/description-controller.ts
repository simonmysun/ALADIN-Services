import { Router, Request, Response } from 'express';
import { Parser } from 'node-sql-parser';
import { GenerationOptions, GptOptions } from '../../shared/interfaces/domain';
import { DescriptionResponse, IRequestDescriptionOptions } from '../../shared/interfaces/http';
import { generateDatabaseKey } from '../../shared/utils/database-utils';
import { isDatabaseRegistered, validateConnectionInfo } from '../../shared/utils/validation';
import { TaskDescriptionGenerationService } from './task-description-generation-service';

const sqlParser = new Parser();

/**
 * Provides individual endpoints for each description generation approach.
 *
 * All routes are mounted under /api/description:
 *   POST /api/description/template        – deterministic AST-based template engine
 *   POST /api/description/llm/default     – single-shot LLM (temperature=0)
 *   POST /api/description/llm/creative    – single-shot LLM (temperature=0.7)
 *   POST /api/description/llm/multi-step  – three-stage chained LLM pipeline
 *   POST /api/description/hybrid          – template engine followed by LLM NLG post-processing
 *
 * All endpoints accept the same request body shape (IRequestDescriptionOptions) and return
 * a DescriptionResponse. The languageCode field is accepted and echoed back but is not yet
 * forwarded to the generation engines (see TODO comments below).
 */
export class DescriptionController {
    public router: Router;
    private taskDescriptionGenerationService: TaskDescriptionGenerationService;

    constructor(taskDescriptionGenerationService: TaskDescriptionGenerationService) {
        this.taskDescriptionGenerationService = taskDescriptionGenerationService;
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.post('/template', (req: Request, res: Response) => {
            this.generateTemplateDescription(req, res);
        });
        this.router.post('/llm/default', (req: Request, res: Response) => {
            this.generateLlmDefaultDescription(req, res);
        });
        this.router.post('/llm/creative', (req: Request, res: Response) => {
            this.generateLlmCreativeDescription(req, res);
        });
        this.router.post('/llm/multi-step', (req: Request, res: Response) => {
            this.generateLlmMultiStepDescription(req, res);
        });
        this.router.post('/hybrid', (req: Request, res: Response) => {
            this.generateHybridDescription(req, res);
        });
    }

    // ---------------------------------------------------------------------------
    // Shared request validation — returns null on success, a Response on failure
    // ---------------------------------------------------------------------------

    private validateRequest(
        req: Request,
        res: Response
    ): { options: IRequestDescriptionOptions; databaseKey: string } | null {
        let options: IRequestDescriptionOptions;

        try {
            options = req.body as IRequestDescriptionOptions;
        } catch (err) {
            res.status(400).json({ message: 'Invalid request body' });
            return null;
        }

        if (!options?.connectionInfo) {
            res.status(400).json({ message: 'Missing connectionInfo' });
            return null;
        }

        if (!options.query || typeof options.query !== 'string' || options.query.trim() === '') {
            res.status(400).json({ message: 'Missing or empty query string' });
            return null;
        }

        const connectionError = validateConnectionInfo(options.connectionInfo);
        if (connectionError) {
            res.status(400).json({ message: connectionError });
            return null;
        }

        const { host, port, schema } = options.connectionInfo;
        const databaseKey = generateDatabaseKey(host!, port!, schema!);

        if (!isDatabaseRegistered(databaseKey)) {
            res.status(400).json({ message: 'Unregistered database, please trigger database analysis.' });
            return null;
        }

        return { options, databaseKey };
    }

    // ---------------------------------------------------------------------------
    // POST /api/description/template
    // ---------------------------------------------------------------------------

    public async generateTemplateDescription(req: Request, res: Response): Promise<Response> {
        const validated = this.validateRequest(req, res);
        if (!validated) return res;

        const { options, databaseKey } = validated;
        // TODO: pass languageCode to TemplateTaskDescriptionGenerationEngine when i18n is supported
        const languageCode = options.languageCode ?? 'en';

        let ast: any;
        try {
            ast = sqlParser.astify(options.query);
        } catch (err) {
            return res.status(400).json({ message: `Failed to parse SQL query: ${err}` });
        }

        try {
            const description = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                GenerationOptions.Template,
                options.query,
                ast,
                options.connectionInfo.schema!,
                databaseKey,
                options.isSelfJoin ?? false
            );

            const response: DescriptionResponse = { description, languageCode };
            return res.status(200).json(response);
        } catch (err) {
            console.error('Error in template description generation', err);
            return res.status(500).json({ message: `Error in template description generation: ${err}` });
        }
    }

    // ---------------------------------------------------------------------------
    // POST /api/description/llm/default
    // ---------------------------------------------------------------------------

    public async generateLlmDefaultDescription(req: Request, res: Response): Promise<Response> {
        const validated = this.validateRequest(req, res);
        if (!validated) return res;

        const { options, databaseKey } = validated;
        // TODO: pass languageCode to LLMTaskDescriptionGenerationEngine when i18n is supported
        const languageCode = options.languageCode ?? 'en';

        try {
            const description = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                GenerationOptions.LLM,
                options.query,
                null as any,
                options.connectionInfo.schema!,
                databaseKey,
                options.isSelfJoin ?? false,
                GptOptions.Default
            );

            const response: DescriptionResponse = { description, languageCode };
            return res.status(200).json(response);
        } catch (err) {
            console.error('Error in LLM default description generation', err);
            return res.status(500).json({ message: `Error in LLM default description generation: ${err}` });
        }
    }

    // ---------------------------------------------------------------------------
    // POST /api/description/llm/creative
    // ---------------------------------------------------------------------------

    public async generateLlmCreativeDescription(req: Request, res: Response): Promise<Response> {
        const validated = this.validateRequest(req, res);
        if (!validated) return res;

        const { options, databaseKey } = validated;
        // TODO: pass languageCode to LLMTaskDescriptionGenerationEngine when i18n is supported
        const languageCode = options.languageCode ?? 'en';

        try {
            const description = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                GenerationOptions.LLM,
                options.query,
                null as any,
                options.connectionInfo.schema!,
                databaseKey,
                options.isSelfJoin ?? false,
                GptOptions.Creative
            );

            const response: DescriptionResponse = { description, languageCode };
            return res.status(200).json(response);
        } catch (err) {
            console.error('Error in LLM creative description generation', err);
            return res.status(500).json({ message: `Error in LLM creative description generation: ${err}` });
        }
    }

    // ---------------------------------------------------------------------------
    // POST /api/description/llm/multi-step
    // ---------------------------------------------------------------------------

    public async generateLlmMultiStepDescription(req: Request, res: Response): Promise<Response> {
        const validated = this.validateRequest(req, res);
        if (!validated) return res;

        const { options, databaseKey } = validated;
        // TODO: pass languageCode to LLMTaskDescriptionGenerationEngine when i18n is supported
        const languageCode = options.languageCode ?? 'en';

        try {
            const description = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                GenerationOptions.LLM,
                options.query,
                null as any,
                options.connectionInfo.schema!,
                databaseKey,
                options.isSelfJoin ?? false,
                GptOptions.MultiStep
            );

            const response: DescriptionResponse = { description, languageCode };
            return res.status(200).json(response);
        } catch (err) {
            console.error('Error in LLM multi-step description generation', err);
            return res.status(500).json({ message: `Error in LLM multi-step description generation: ${err}` });
        }
    }

    // ---------------------------------------------------------------------------
    // POST /api/description/hybrid
    // ---------------------------------------------------------------------------

    public async generateHybridDescription(req: Request, res: Response): Promise<Response> {
        const validated = this.validateRequest(req, res);
        if (!validated) return res;

        const { options, databaseKey } = validated;
        // TODO: pass languageCode to both engines when i18n is supported
        const languageCode = options.languageCode ?? 'en';

        let ast: any;
        try {
            ast = sqlParser.astify(options.query);
        } catch (err) {
            return res.status(400).json({ message: `Failed to parse SQL query: ${err}` });
        }

        try {
            const description = await this.taskDescriptionGenerationService.generateTaskFromQuery(
                GenerationOptions.Hybrid,
                options.query,
                ast,
                options.connectionInfo.schema!,
                databaseKey,
                options.isSelfJoin ?? false
            );

            const response: DescriptionResponse = { description, languageCode };
            return res.status(200).json(response);
        } catch (err) {
            console.error('Error in hybrid description generation', err);
            return res.status(500).json({ message: `Error in hybrid description generation: ${err}` });
        }
    }
}
