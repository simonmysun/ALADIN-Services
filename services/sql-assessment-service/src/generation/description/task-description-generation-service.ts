import { AST } from 'node-sql-parser';
import {
	GenerationOptions,
	GptOptions,
	IAliasMap,
	IParsedTable,
} from '../../shared/interfaces/domain';
import { LLMTaskDescriptionGenerationEngine } from './llm-task-description-generation-engine';
import { TemplateTaskDescriptionGenerationEngine } from './template-task-description-generation-engine';
import { SupportedLanguage } from '../../shared/i18n';

export class TaskDescriptionGenerationService {
	templateTaskDescriptionGenerationEngine: TemplateTaskDescriptionGenerationEngine;
	llmTaskDescriptionGenerationEngine: LLMTaskDescriptionGenerationEngine | undefined;

	constructor(
		llmTaskDescriptionGenerationEngine: LLMTaskDescriptionGenerationEngine | undefined,
		templateTaskDescriptionGenerationEngine: TemplateTaskDescriptionGenerationEngine,
	) {
		this.templateTaskDescriptionGenerationEngine =
			templateTaskDescriptionGenerationEngine;
		this.llmTaskDescriptionGenerationEngine =
			llmTaskDescriptionGenerationEngine;
	}

	public async generateTaskFromQuery(config: {
		generationType: GenerationOptions;
		query: string;
		queryAST: AST;
		schema: string;
		databaseKey: string;
		isSelfJoin?: boolean;
		option?: GptOptions;
		schemaAliasMap?: IAliasMap;
		tables?: IParsedTable[];
		lang?: SupportedLanguage;
	}): Promise<string> {
		const {
			generationType,
			query,
			queryAST,
			schema,
			databaseKey,
			isSelfJoin,
			option,
			schemaAliasMap,
			tables,
		} = config;

		const lang = config.lang ?? 'en';
		switch (generationType) {
			case 'template':
				return this.templateTaskDescriptionGenerationEngine.generateTaskFromQuery(
					{
						query: queryAST,
						schema,
						schemaAliasMap,
						tables,
						lang,
					},
				);

			case 'llm':
				if (!this.llmTaskDescriptionGenerationEngine) {
					return this.templateTaskDescriptionGenerationEngine.generateTaskFromQuery(
						{ query: queryAST, schema, schemaAliasMap, tables, lang },
					);
				}
				if (!option) {
					throw Error('Undefined GPT configuration');
				}
				return await this.llmTaskDescriptionGenerationEngine.generateTaskFromQuery(
					{
						query,
						databaseKey,
						option,
						isSelfJoin,
						lang,
					},
				);

			case 'hybrid': {
				const templateDescription =
					this.templateTaskDescriptionGenerationEngine.generateTaskFromQuery({
						query: queryAST,
						schema,
						schemaAliasMap,
						tables,
						lang,
					});
				if (!this.llmTaskDescriptionGenerationEngine) {
					return templateDescription;
				}
				return await this.llmTaskDescriptionGenerationEngine.generateNLGTaskFromTemplateTask(
					query,
					templateDescription,
					databaseKey,
					isSelfJoin,
					lang,
				);
			}

			default:
				return 'Unknown generationType selected.';
		}
	}
}
