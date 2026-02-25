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
