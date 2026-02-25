import 'reflect-metadata';
import { DatabaseAnalyzer } from './database/database-analyzer';
import { DatabaseController } from './database/database-controller';
import { SQLQueryGradingService } from './grading/query-grading-service';
import { GradingController } from './grading/grading-controller';
import { SQLQueryGenerationService } from './generation/query/sql-query-generation-service';
import { SelectQueryGenerationDirector } from './generation/query/select-query-generation-director';
import { TemplateTaskDescriptionGenerationEngine } from './generation/description/template-task-description-generation-engine';
import { LLMTaskDescriptionGenerationEngine } from './generation/description/llm-task-description-generation-engine';
import { TaskDescriptionGenerationService } from './generation/description/task-description-generation-service';
import { TaskGenerationController } from './generation/task-generation-controller';
import { registerControllers, startRestApi } from './api/rest-api';

const databaseAnalyzer = new DatabaseAnalyzer();
const connectionController = new DatabaseController(databaseAnalyzer);

const selectQueryGenerator = new SQLQueryGenerationService(new SelectQueryGenerationDirector());
const templateTaskDescriptionGenerationEngine = new TemplateTaskDescriptionGenerationEngine();
const llmTaskDescriptionGenerationEngine = new LLMTaskDescriptionGenerationEngine();
const taskDescriptionGenerationService = new TaskDescriptionGenerationService(
    llmTaskDescriptionGenerationEngine,
    templateTaskDescriptionGenerationEngine
);
const taskGenerationController = new TaskGenerationController(selectQueryGenerator, taskDescriptionGenerationService);
const queryGradingService = new SQLQueryGradingService();
const gradingController = new GradingController(queryGradingService, taskDescriptionGenerationService);

registerControllers(connectionController, taskGenerationController, gradingController);
startRestApi();
