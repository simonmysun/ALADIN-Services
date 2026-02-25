import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ITaskConfiguration } from './domain';

export interface GradingRequest {
	referenceQuery: string;
	studentQuery: string;
}

export interface IRequestTaskOptions {
	connectionInfo: PostgresConnectionOptions;
	taskConfiguration: ITaskConfiguration;
}

export interface IRequestGradingOptions {
	connectionInfo: PostgresConnectionOptions;
	gradingRequest: GradingRequest;
}

export interface TaskResponse {
	templateBasedDescription: string;
	gptEntityRelationshipDescription: string;
	gptSchemaBasedDescription: string;
	hybridDescription: string;
	query: string;
	gptCreativeDescription?: string;
}

export interface ComparisonResult {
	feedback: string[];
	feedbackWithSolution: string[];
	grade: number;
	/** Whether the student query is semantically equivalent to the reference query. */
	equivalent: boolean;
	supportedQueryType: boolean;
}

export interface IRequestDescriptionOptions {
	connectionInfo: PostgresConnectionOptions;
	/** Raw SQL query string to generate a description for. */
	query: string;
	/** Whether the query involves a self-join. Defaults to false. */
	isSelfJoin?: boolean;
	/**
	 * BCP 47 language code for the desired output language (e.g. "en", "de", "nl").
	 * Defaults to "en".
	 */
	languageCode?: string;
}

export interface DescriptionResponse {
	description: string;
	/** The language code that was requested (echoes the input, defaults to "en"). */
	languageCode: string;
}
