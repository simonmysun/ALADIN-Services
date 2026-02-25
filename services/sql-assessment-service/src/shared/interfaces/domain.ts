import { aggregateType } from '../constants';

export interface IParsedTable {
    name: string;
    joinPaths: IJoinPaths[];
    columns: IParsedColumn[];
}

export interface IParsedColumn {
    name: string;
    type: string;
    tableName: string;
    aggregation?: aggregateType;
    isNullable: boolean;
}

export interface IJoinPaths {
    path: IPath[];
    isSelfJoin: boolean;
    depth: number;
    selfJoinDepth: number;
}

export interface IPath {
    tableName: string;
    relationKey: string;
}

export enum GptOptions {
    Creative = "creative",
    MultiStep = "multi-step",
    Default = "default"
}

export enum GenerationOptions {
    Template = "template",
    LLM = "llm",
    Hybrid = "hybrid"
}

export interface ITaskConfiguration {
    aggregation: boolean;
    orderby: boolean;
    joinDepth: number;
    joinTypes: import('../constants').joinType[];
    predicateCount: number;
    groupby: boolean;
    having: boolean;
    columnCount: number;
    operationTypes: import('../constants').operationType[];
}
