export interface IParsedExecutionPlan {
    groupKey?: string[];
    havingFilter?: string;
    sortKey?: string[];
    whereFilter?: string[];
    joinStatement?: JoinStatement;
}

export interface JoinStatement {
    joinType?: string;
    tableName: string;
    joinedTable?: JoinStatement;
    joinCondition?: string;
}

export interface QueryPlanNode {
    "Node Type"?: string;
    "Strategy"?: string;
    "Partial Mode"?: string;
    "Parallel Aware"?: boolean;
    "Startup Cost"?: number;
    "Total Cost"?: number;
    "Plan Rows"?: number;
    "Plan Width"?: number;
    "Group Key"?: string[];
    "Filter"?: string;
    "Plans"?: QueryPlanNode[];
    "Parent Relationship": string;
    "Sort Key"?: string[];
    "Join Type"?: string;
    "Join Filter": string;
    "Inner Unique"?: boolean;
    "Hash Cond"?: string;
    "Alias"?: string;
    "Relation Name"?: string;
    "Index Cond"?: string;
    "Recheck Cond"?: string;
}

export type QueryPlanKeys =
    | "Node Type"
    | "Strategy"
    | "Partial Mode"
    | "Parallel Aware"
    | "Startup Cost"
    | "Total Cost"
    | "Plan Rows"
    | "Plan Width"
    | "Group Key"
    | "Filter"
    | "Plans"
    | "Parent Relationship"
    | "Sort Key"
    | "Join Type"
    | "Join Filter"
    | "Inner Unique"
    | "Hash Cond"
    | "Alias"
    | "Relation Name"
    | "Index Cond"
    | "Recheck Cond";

export interface QueryPlan {
    "QUERY PLAN": Plan[];
}

export interface Plan {
    "Plan": QueryPlanNode;
}
