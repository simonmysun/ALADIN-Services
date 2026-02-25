import { DataSource } from 'typeorm';
import { AST, Join, Parser, Select } from 'node-sql-parser';
import { ComparisonResult, IParsedExecutionPlan } from '../shared/interfaces/index';
import { QueryPlan } from '../shared/interfaces/execution-plan';
import { ExecutionPlanParser } from './execution-plan-parser';
import { JoinComparator } from './join-comparator';
import { ResultSetComparator } from './result-set-comparator';

export class SQLQueryGradingService {
    private readonly fullGrade = 7;
    private readonly executionPlanParser = new ExecutionPlanParser();
    private readonly joinComparator = new JoinComparator();
    private readonly resultSetComparator = new ResultSetComparator();

    constructor() {}

    public async gradeQuery(
        referenceQuery: string,
        studentQuery: string,
        dataSource: DataSource,
        databaseKey: string
    ): Promise<ComparisonResult> {
        let grade = this.fullGrade;
        const feedback: string[] = [];
        const feedbackWithSolution: string[] = [];
        studentQuery = this.removeSemicolon(studentQuery);
        referenceQuery = this.removeSemicolon(referenceQuery);
        const parser = new Parser();

        const isQueryExecutable = await this.resultSetComparator.isExecutable(studentQuery, dataSource);
        feedback.push(...isQueryExecutable[1]);
        if (!isQueryExecutable[0])
            return {
                grade: 0,
                feedback,
                feedbackWithSolution,
                equivalent: false,
                supportedQueryType: false,
            };

        const sameResultSet = await this.resultSetComparator.compare(referenceQuery, studentQuery, dataSource);
        feedback.push(...sameResultSet[1]);
        sameResultSet[0]
            ? feedback.push('Same result set of both queries')
            : feedback.push('Result sets differ');

        let studentAST = parser.astify(studentQuery, { database: 'postgresql' });
        let referenceAST = parser.astify(referenceQuery, { database: 'postgresql' });

        if (Array.isArray(studentAST) || Array.isArray(referenceAST)) {
            feedback.push('AST array not supported');
            grade = sameResultSet[0] ? this.fullGrade : 0;
            return {
                grade,
                feedback,
                feedbackWithSolution,
                equivalent: grade == this.fullGrade,
                supportedQueryType: false,
            };
        }

        if (!(studentAST && referenceAST)) {
            feedback.push('AST parsing failed');
            grade = sameResultSet[0] ? this.fullGrade : 0;
            return {
                grade,
                feedback,
                feedbackWithSolution,
                equivalent: grade == this.fullGrade,
                supportedQueryType: false,
            };
        }

        studentAST = studentAST as AST;
        referenceAST = referenceAST as AST;

        if (studentAST.type != referenceAST.type) {
            feedback.push(`Incorrect SQL clause, the task requires a clause of type: ${referenceAST.type}`);
            grade = sameResultSet[0] ? this.fullGrade : 0;
            return {
                grade,
                feedback,
                feedbackWithSolution,
                equivalent: grade == this.fullGrade,
                supportedQueryType: false,
            };
        }

        if (this.hasUnsupportedQueryStructure(studentAST)) {
            grade = sameResultSet[0] ? this.fullGrade : 0;
            return {
                grade,
                feedback,
                feedbackWithSolution,
                equivalent: grade == this.fullGrade,
                supportedQueryType: false,
            };
        }

        const queryRunner = dataSource.createQueryRunner();
        const studentExecutionPlan = await queryRunner.query(`EXPLAIN (FORMAT JSON) ${studentQuery}`);
        const referenceExecutionPlan = await queryRunner.query(`EXPLAIN (FORMAT JSON) ${referenceQuery}`);
        queryRunner.release();

        if (!(studentExecutionPlan && referenceExecutionPlan)) {
            feedback.push('Unable to retrieve execution plans');
            grade = sameResultSet[0] ? this.fullGrade : 0;
            return {
                grade,
                feedback,
                feedbackWithSolution,
                equivalent: grade == this.fullGrade,
                supportedQueryType: false,
            };
        }

        if (!sameResultSet[0]) grade--;

        const areSameColumns = this.areSameColumnsSelected(studentAST, referenceAST);
        if (!areSameColumns[0]) grade--;
        feedback.push(...areSameColumns[1]);
        feedbackWithSolution.push(...areSameColumns[2]);
        const studentAliasMap = areSameColumns[3];
        const referenceAliasMap = areSameColumns[4];

        const parsedStudentExecutionPlan = this.executionPlanParser.parse(studentExecutionPlan[0], studentAliasMap);
        const parsedReferenceExecutionPlan = this.executionPlanParser.parse(referenceExecutionPlan[0], referenceAliasMap);

        if (!(parsedStudentExecutionPlan && parsedReferenceExecutionPlan)) {
            throw new Error('Unable to parse execution plans');
        }

        const comparisonResult = this.compareExecutionPlans(
            parsedStudentExecutionPlan,
            parsedReferenceExecutionPlan,
            studentAST,
            referenceAST,
            studentAliasMap,
            referenceAliasMap
        );

        grade = grade - comparisonResult[2];
        feedback.push(...comparisonResult[0]);
        feedbackWithSolution.push(...comparisonResult[1]);
        if (grade < 0) grade = 0;

        return {
            grade,
            feedback,
            feedbackWithSolution,
            equivalent: grade == this.fullGrade,
            supportedQueryType: true,
        };
    }

    private removeSemicolon(str: string): string {
        return str.endsWith(';') ? str.slice(0, -1) : str;
    }

    private hasUnsupportedQueryStructure(studentAST: AST): boolean {
        return this.hasDistinct(studentAST) || this.hasSubquery(studentAST, true);
    }

    private hasSubquery(node: any, isInitial: boolean): boolean {
        if (!node || typeof node !== 'object') return false;

        if (node.type === 'select' && !isInitial) {
            return true;
        }

        const subqueryLocations = ['from', 'where', 'having', 'orderby', 'columns', 'groupby', 'limit', 'with'];

        for (const location of subqueryLocations) {
            if (node[location]) {
                if (Array.isArray(node[location])) {
                    for (const child of node[location]) {
                        if (this.hasSubquery(child, false)) return true;
                    }
                } else if (typeof node[location] === 'object') {
                    if (this.hasSubquery(node[location], false)) return true;
                }
            }
        }

        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                const value = node[key];
                if (Array.isArray(value)) {
                    for (const child of value) {
                        if (this.hasSubquery(child, false)) return true;
                    }
                } else if (typeof value === 'object' && value !== null) {
                    if (this.hasSubquery(value, false)) return true;
                }
            }
        }

        return false;
    }

    private hasDistinct(ast: any): boolean {
        return ast.type === 'select' && ast.distinct === true;
    }

    private buildASTAliasMap(from: any[]): Record<string, string> {
        const aliasMap: Record<string, string> = {};
        let previousJoinedTable = '';
        let previousJoinedAlias = '';
        if (from) {
            from.forEach((fromEntry: any) => {
                const alias = fromEntry.as;
                if (alias) {
                    const table = fromEntry.table;
                    const isSelfJoin = table == previousJoinedTable;
                    if (isSelfJoin) {
                        const selfJoinTable = fromEntry.join == 'RIGHT JOIN' ? `${table}0` : `${table}1`;
                        aliasMap[alias] = selfJoinTable;
                        aliasMap[previousJoinedAlias] =
                            fromEntry.join == 'RIGHT JOIN' ? `${previousJoinedTable}1` : `${previousJoinedTable}0`;
                    } else {
                        aliasMap[alias] = table;
                    }
                    previousJoinedAlias = alias;
                    previousJoinedTable = table;
                }
            });
        }
        return aliasMap;
    }

    private areSameColumnsSelected(
        studentAST: AST,
        referenceAST: AST
    ): [boolean, string[], string[], Record<string, string>, Record<string, string>] {
        const feedback: string[] = [];
        const feedbackWithSolution: string[] = [];
        let studentAliasMap: Record<string, string> = {};
        let referenceAliasMap: Record<string, string> = {};

        switch (studentAST.type) {
            case 'select': {
                const select = studentAST as Select;
                const referenceSelect = referenceAST as Select;

                if (!referenceSelect.columns || !select.columns) {
                    feedback.push('Error: Not a select statement');
                    return [false, feedback, feedbackWithSolution, studentAliasMap, referenceAliasMap];
                }

                const selectColumns = select.columns;
                const referenceSelectColumns = referenceSelect.columns;
                studentAliasMap = this.buildASTAliasMap(select.from as any[]);
                referenceAliasMap = this.buildASTAliasMap(referenceSelect.from as any[]);

                const [sameColumns, feedbackCol] = this.areColumnsEqual(
                    selectColumns,
                    referenceSelectColumns,
                    studentAliasMap,
                    referenceAliasMap
                );

                if (!sameColumns) {
                    feedback.push(`The column selection is incorrect: ${feedbackCol}`);
                    feedbackWithSolution.push('The task requires the selection of the following columns:');
                    referenceSelectColumns.forEach((column) => {
                        if (column?.expr?.type == 'column_ref')
                            feedbackWithSolution.push(`${column?.expr?.table}.${column?.expr?.column?.expr?.value}`);
                        if (column?.expr?.type == 'aggr_func')
                            feedbackWithSolution.push(
                                `${column?.expr?.name}(${column?.expr?.args?.expr?.table}.${column?.expr?.args?.expr?.column?.expr?.value})`
                            );
                    });
                }
                return [sameColumns, feedback, feedbackWithSolution, studentAliasMap, referenceAliasMap];
            }
            default:
                return [false, feedback, feedbackWithSolution, studentAliasMap, referenceAliasMap];
        }
    }

    private areColumnsEqual(
        student: any[],
        reference: any[],
        studentAliasMap?: Record<string, string>,
        referenceAliasMap?: Record<string, string>
    ): [boolean, string[]] {
        const feedback: string[] = [];
        if (student.length !== reference.length) {
            feedback.push('Incorrect number of columns selected.');
            return [false, feedback];
        }

        let areAllColumnsTheSame = true;
        reference.forEach((referenceColumn) => {
            const isIncluded = student.find((studentColumn: any) => {
                if (referenceColumn?.expr?.type == 'aggr_func') {
                    const referenceTable = this.joinComparator.normalizeTableName(referenceColumn?.expr?.args?.expr?.table, referenceAliasMap);
                    const studentTable = this.joinComparator.normalizeTableName(studentColumn?.expr?.args?.expr?.table, studentAliasMap);
                    return (
                        referenceTable == studentTable &&
                        studentColumn.expr?.name == referenceColumn.expr?.name &&
                        studentColumn?.expr?.args?.expr?.column?.expr?.value ==
                        referenceColumn?.expr?.args?.expr?.column?.expr?.value
                    );
                } else if (referenceColumn?.expr?.type == 'column_ref') {
                    const referenceTable = this.joinComparator.normalizeTableName(referenceColumn?.expr?.table, referenceAliasMap);
                    const studentTable = this.joinComparator.normalizeTableName(studentColumn?.expr?.table, studentAliasMap);
                    return (
                        referenceTable == studentTable &&
                        referenceColumn?.expr?.column?.expr?.value == studentColumn?.expr?.column?.expr?.value
                    );
                } else return false;
            });
            if (!isIncluded) {
                areAllColumnsTheSame = false;
                feedback.push('Incorrect columns selected.');
            }
        });
        return [areAllColumnsTheSame, feedback];
    }

    private compareExecutionPlans(
        studentPlan: IParsedExecutionPlan,
        referencePlan: IParsedExecutionPlan,
        studentAST: any,
        referenceAST: any,
        studentAliasMap: Record<string, string>,
        referenceAliasMap: Record<string, string>
    ): [string[], string[], number] {
        const feedback: string[] = [];
        const feedbackWithSolution: string[] = [];
        let grade = 0;

        if (!this.compareArrays(studentPlan.groupKey, referencePlan.groupKey, studentAliasMap, referenceAliasMap)) {
            feedback.push('Incorrect Group key.');
            feedbackWithSolution.push(`Expected ${referencePlan.groupKey}, got ${studentPlan.groupKey}.`);
            grade++;
        }

        if (
            this.joinComparator.normalizeFilter(studentPlan.havingFilter, studentAliasMap) !==
            this.joinComparator.normalizeFilter(referencePlan.havingFilter, referenceAliasMap)
        ) {
            grade++;
            feedback.push('Incorrect Having filter.');
            feedbackWithSolution.push(`Expected ${referencePlan.havingFilter}, got ${studentPlan.havingFilter}.`);
        }

        if (!this.compareArrays(studentPlan.sortKey, referencePlan.sortKey, studentAliasMap, referenceAliasMap)) {
            grade++;
            feedback.push('Incorrect Order By sort key.');
            feedbackWithSolution.push(`Expected ${referencePlan.sortKey}, got ${studentPlan.sortKey}.`);
        }

        if (!this.compareArrays(studentPlan.whereFilter, referencePlan.whereFilter, studentAliasMap, referenceAliasMap)) {
            grade++;
            feedback.push('Incorrect Where filter.');
            feedbackWithSolution.push(`Expected ${referencePlan.whereFilter}, got ${studentPlan.whereFilter}.`);
        }

        if (studentPlan.joinStatement && referencePlan.joinStatement) {
            let isJoinEqual = this.joinComparator.compareJoinStatements(
                studentPlan.joinStatement,
                referencePlan.joinStatement,
                studentAliasMap,
                referenceAliasMap
            );
            if (!isJoinEqual) {
                const [joinEqual, feedbackJoin, solution] = this.joinComparator.compareJoinAST(
                    referenceAST.from as Join[],
                    studentAST.from as Join[],
                    studentAliasMap,
                    referenceAliasMap
                );
                feedback.push(...feedbackJoin);
                feedbackWithSolution.push(...solution);
                if (!joinEqual) grade++;
            }
        } else if (studentPlan.joinStatement && !referencePlan.joinStatement) {
            feedback.push('Incorrect inclusion of Join statement');
        } else if (referencePlan.joinStatement && !studentPlan.joinStatement) {
            feedback.push('Join statement missing.');
        }

        return [feedback, feedbackWithSolution, grade];
    }

    private compareArrays(
        studentArray: string[] = [],
        referenceArray: string[] = [],
        studentAliasMap?: Record<string, string>,
        referenceAliasMap?: Record<string, string>
    ): boolean {
        if (studentArray.length !== referenceArray.length) return false;

        const normalizedStudentArray = studentArray.map(g => this.joinComparator.normalizeFilter(g, studentAliasMap));
        const normalizedReferenceArray = referenceArray.map(g => this.joinComparator.normalizeFilter(g, referenceAliasMap));
        const sortedArr1 = [...normalizedStudentArray].sort();
        const sortedArr2 = [...normalizedReferenceArray].sort();
        return sortedArr1.every((val, index) => val === sortedArr2[index]);
    }
}
