import { aggregateType } from '../constants';

export enum EntityType {
    Strong      = 'strong',
    Weak        = 'weak',
    Associative = 'associative',
    Subtype     = 'subtype',
}

export enum RelationshipType {
    OneToOne   = '1:1',
    OneToMany  = '1:N',
    ManyToMany = 'N:M',
}

export enum Participation {
    Mandatory = 'mandatory',
    Optional  = 'optional',
}

export interface IForeignKeyRelationship {
    /** FK column name on this table. */
    fkColumn: string;
    referencedTable: string;
    referencedColumn: string;
    /** True when fkColumn is part of this table's primary key. */
    isIdentifying: boolean;
    participation: Participation;
    cardinality: RelationshipType;
}

export interface IAliasMap {
    /** Maps original table name → alternative display name. */
    tables?: Record<string, string>;
    /** Maps original table name → (original column name → alternative display name). */
    columns?: Record<string, Record<string, string>>;
}

export interface IParsedTable {
    name: string;
    joinPaths: IJoinPaths[];
    columns: IParsedColumn[];
    /** Structural classification of the entity. */
    entityType: EntityType;
    /** Foreign-key relationships originating from this table. */
    relationships: IForeignKeyRelationship[];
    /** Names of subtype tables whose PK is a FK to this table (populated on the supertype). */
    supertableOf?: string[];
    /** Name of the supertype table this table specialises (populated on the subtype). */
    subtableOf?: string;
    /** Human-readable alternative name supplied via aliasMap at analysis time. */
    alternativeName?: string;
}

export interface IParsedColumn {
    name: string;
    type: string;
    tableName: string;
    aggregation?: aggregateType;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    /** Human-readable alternative name supplied via aliasMap at analysis time. */
    alternativeName?: string;
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
