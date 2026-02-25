import {
    IParsedExecutionPlan,
    JoinStatement,
    QueryPlan,
    QueryPlanKeys,
    QueryPlanNode,
} from '../shared/interfaces/execution-plan';

/**
 * Parses a raw PostgreSQL EXPLAIN (FORMAT JSON) execution plan into a normalized structure
 * suitable for comparison.
 */
export class ExecutionPlanParser {

    parse(executionPlan: QueryPlan, aliasMap: Record<string, string>): IParsedExecutionPlan {
        const parsedExecutionPlan: IParsedExecutionPlan = {};
        const queryPlan = executionPlan['QUERY PLAN'][0]['Plan'];
        parsedExecutionPlan.groupKey = this.extractKeyForNodeType(queryPlan, 'Aggregate', 'Group Key');
        parsedExecutionPlan.havingFilter = this.extractKeyForNodeType(queryPlan, 'Aggregate', 'Filter');
        parsedExecutionPlan.sortKey = this.extractKeyForNodeType(queryPlan, 'Sort', 'Sort Key');
        parsedExecutionPlan.whereFilter = this.extractAllKeysForNodeType(
            queryPlan,
            ['Seq Scan', 'Hash Join', 'Bitmap Heap Scan', 'Index Scan'],
            ['Filter', 'Join Filter', 'Recheck Cond']
        );
        parsedExecutionPlan.joinStatement = this.parseQueryPlanToJoinOrFromStatement(queryPlan, aliasMap);
        return parsedExecutionPlan;
    }

    private parseQueryPlanToJoinOrFromStatement(
        planNode: QueryPlanNode,
        aliasMap: Record<string, string>
    ): JoinStatement | undefined {
        const nodeType = planNode['Node Type'];

        if (nodeType === 'Seq Scan' || nodeType === 'Bitmap Heap Scan') {
            const tableName =
                aliasMap[planNode['Alias'] || planNode['Relation Name'] || ''] || planNode['Relation Name'] || '';
            return { tableName };
        }

        if (nodeType === 'Index Scan' || nodeType === 'Index Only Scan') {
            const tableName =
                aliasMap[planNode['Alias'] || planNode['Relation Name'] || ''] || planNode['Relation Name'] || '';
            const condition = planNode['Index Cond'] || '';
            return { tableName, joinCondition: condition };
        }

        if (planNode['Join Type']) {
            const joinType = planNode['Join Type'];
            const joinCondition = planNode['Hash Cond'] || planNode['Index Cond'] || '';

            const [outerPlan, innerPlan] = planNode['Plans'] || [];

            const outerJoinStatement = outerPlan
                ? this.parseQueryPlanToJoinOrFromStatement(outerPlan, aliasMap)
                : { tableName: '' };
            const innerJoinStatement = innerPlan
                ? this.parseQueryPlanToJoinOrFromStatement(innerPlan, aliasMap)
                : { tableName: '' };

            return outerPlan['Plans']
                ? {
                    joinType,
                    tableName: innerJoinStatement?.tableName || '',
                    joinedTable: {
                        tableName: outerJoinStatement?.tableName || '',
                        joinType: outerJoinStatement?.joinType,
                        joinedTable: outerJoinStatement?.joinedTable,
                        joinCondition: outerJoinStatement?.joinCondition,
                    },
                    joinCondition: joinCondition ? joinCondition : innerJoinStatement?.joinCondition,
                }
                : {
                    joinType,
                    tableName: outerJoinStatement?.tableName || '',
                    joinedTable: {
                        tableName: innerJoinStatement?.tableName || '',
                        joinType: innerJoinStatement?.joinType,
                        joinedTable: innerJoinStatement?.joinedTable,
                        joinCondition: innerJoinStatement?.joinCondition,
                    },
                    joinCondition: joinCondition ? joinCondition : outerJoinStatement?.joinCondition,
                };
        }

        const nestedPlans = planNode['Plans'];
        if (nestedPlans && nestedPlans.length > 0) {
            return this.parseQueryPlanToJoinOrFromStatement(nestedPlans[0], aliasMap);
        }

        return undefined;
    }

    private extractKeyForNodeType(plan: QueryPlanNode, nodeType: string, keyToExtract: QueryPlanKeys): any {
        if (plan['Node Type'] === nodeType) {
            return plan[keyToExtract];
        }

        if (plan.Plans) {
            for (const subPlan of plan.Plans) {
                const result = this.extractKeyForNodeType(subPlan, nodeType, keyToExtract);
                if (result !== undefined) {
                    return result;
                }
            }
        }

        return undefined;
    }

    private extractAllKeysForNodeType(
        plan: QueryPlanNode,
        nodeType: string[],
        keysToExtract: QueryPlanKeys[],
        results: any[] = []
    ): any[] {
        keysToExtract.forEach((keyToExtract) => {
            if (plan['Node Type'] && nodeType.includes(plan['Node Type'])) {
                if (plan[keyToExtract] !== undefined) {
                    results.push(plan[keyToExtract]);
                }
            }

            if (plan.Plans) {
                for (const subPlan of plan.Plans) {
                    this.extractAllKeysForNodeType(subPlan, nodeType, [keyToExtract], results);
                }
            }
        });

        return results;
    }
}
