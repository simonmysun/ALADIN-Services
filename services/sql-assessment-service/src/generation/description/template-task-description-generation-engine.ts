import { AST, BaseFrom, Binary, ColumnRefItem, Join, Select } from 'node-sql-parser';
import { SQL_TEMPLATES } from './sql-templates';
import { IAliasMap } from '../../shared/interfaces/domain';

export class TemplateTaskDescriptionGenerationEngine {

    private readonly columnPattern = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
    private readonly aggregateFunctionPattern = /(MAX|MIN|SUM|AVG|COUNT)\((.*?)\)/i;

    public generateTaskFromQuery(query: AST, schema: string, schemaAliasMap?: IAliasMap): string {
        return this.traverseAST(query, schema, schemaAliasMap);
    }

    private traverseAST(node: AST, schema: string, schemaAliasMap?: IAliasMap): string {
        if (!node) return '';

        switch (node.type) {
            case 'select':
                return this.handleSelect(node, schema, schemaAliasMap);
            default:
                return 'Unsupported query type.';
        }
    }

    private handleSelect(node: Select, schema: string, schemaAliasMap?: IAliasMap): string {
        let result = '';
        const isSelectAll = node.columns.length === 1 && node.columns[0].expr?.column === '*';

        // Build an alias→table map so that column references using aliases
        // (e.g. e1.first_name in a self-join) resolve to the real table name.
        const aliasMap = this.buildAliasMap(Array.isArray(node.from) ? node.from : []);

        if (Array.isArray(node.from)) {
            if ((node.from as Join[]).some(fromItem => fromItem?.join)) {
                let baseTable = this.formatTableName((node.from[0] as BaseFrom)?.table || 'an unknown table', schemaAliasMap);

                const columns = isSelectAll
                    ? '*'
                    : node.columns.map((col: any) => this.getColumnName(col.expr, aliasMap, schemaAliasMap)).join(' and ');

                result += isSelectAll
                    ? SQL_TEMPLATES.SELECT_ALL_JOIN.replace('{database}', schema)
                    : SQL_TEMPLATES.SELECT_COLUMNS_JOIN.replace('{columns}', columns).replace('{database}', schema);

                (node.from as Join[]).forEach((join: Join) => {
                    if (join.join) {
                        const joinType = join.join.toUpperCase();
                        let joinTemplate;
                        let useAlias = false;
                        if (baseTable == this.formatTableName(join.table, schemaAliasMap)) {
                            joinTemplate = SQL_TEMPLATES.SELF_JOIN;
                            useAlias = true;
                        }
                        else joinTemplate = this.getJoinTemplate(joinType);

                        const condition: Binary | undefined = join.on;

                        result += ' ' + joinTemplate
                            .replace('{table1}', baseTable)
                            .replace('{table}', baseTable)
                            .replace('{table2}', this.formatTableName(join.table, schemaAliasMap) || 'another_table')
                            .replace('{condition}', this.handleJoinCondition(condition, aliasMap, schemaAliasMap));
                        baseTable = this.formatTableName(join.table, schemaAliasMap);
                    }
                });
            }
            else if ((node.from as BaseFrom[]).every(fromItem => fromItem?.table)) {
                const table = (node.from[0] as BaseFrom)?.table || 'an unknown table';

                const columns = isSelectAll
                    ? '*'
                    : node.columns.map((col: any) => this.getColumnName(col.expr, aliasMap, schemaAliasMap)).join(' and ');

                result += isSelectAll
                    ? SQL_TEMPLATES.SELECT_ALL.replace('{table}', this.formatTableName(table, schemaAliasMap)).replace('{database}', schema)
                    : SQL_TEMPLATES.SELECT_COLUMNS.replace('{columns}', columns).replace('{table}', this.formatTableName(table, schemaAliasMap)).replace('{database}', schema);
            }
            else {
                result += 'Unsupported FROM clause structure.';
            }
        }
        else {
            result += 'Invalid FROM clause.';
        }

        if (node.where) {
            const condition = this.handleCondition(node.where, aliasMap, schemaAliasMap);
            result += ' ' + SQL_TEMPLATES.WHERE.replace('{condition}', condition);
        }

        if (node.groupby && node.groupby.columns && node.groupby.columns.length > 0) {
            const groupByColumns = node.groupby.columns
                ? node.groupby.columns.map((col: any) => this.getColumnName(col, aliasMap, schemaAliasMap)).join(', ')
                : '';
            result += ' ' + SQL_TEMPLATES.GROUP_BY.replace('{columns}', groupByColumns);
        }

        if (node.having) {
            const havingCondition = this.handleCondition(node.having, aliasMap, schemaAliasMap);
            result += ' ' + SQL_TEMPLATES.HAVING.replace('{condition}', havingCondition);
        }

        if (node.orderby) {
            const orderByColumns = node.orderby.map((col: any) => {
                const columnName = this.getColumnName(col.expr, aliasMap, schemaAliasMap);
                const orderType = col.type?.toUpperCase() === 'DESC' ? 'descending' : 'ascending';
                return `${columnName} in ${orderType} order`;
            }).join(', ');

            result += ' ' + SQL_TEMPLATES.ORDER_BY.replace('{columns}', orderByColumns);
        }

        return result;
    }

    private buildAliasMap(from: any[]): Record<string, string> {
        const map: Record<string, string> = {};
        for (const entry of from) {
            if (entry.as && entry.table) {
                map[entry.as] = entry.table;
            }
        }
        return map;
    }

    private handleJoinCondition(
        on: string | any,
        aliasMap: Record<string, string> = {},
        schemaAliasMap?: IAliasMap
    ): string {
        let left, operator, right;
        if (typeof on === 'string') {
            [left, operator, right] = this.parseConditionString(on);
        } else if (on?.operator) {
            left = on.left;
            right = on.right;
            operator = on.operator;
        }
        else {
            return 'an unspecified condition';
        }
        const operatorTemplate = SQL_TEMPLATES[operator] || `{left} ${operator} {right}`;
        const formattedLeft = this.getColumnName(left, aliasMap, schemaAliasMap);
        let formattedRight = right?.value || this.getColumnName(right, aliasMap, schemaAliasMap);

        return operatorTemplate
            .replace('{left}', formattedLeft)
            .replace('{right}', formattedRight);
    }

    private handleCondition(
        condition: any,
        aliasMap: Record<string, string> = {},
        schemaAliasMap?: IAliasMap
    ): string {
        if (!condition) return 'an unspecified condition';

        if (condition.operator && (condition.operator === 'AND' || condition.operator === 'OR')) {
            const left = this.handleCondition(condition.left, aliasMap, schemaAliasMap);
            const right = this.handleCondition(condition.right, aliasMap, schemaAliasMap);
            const operatorTemplate = SQL_TEMPLATES[condition.operator.toUpperCase()] || `{left} ${condition.operator} {right}`;
            return operatorTemplate.replace('{left}', left).replace('{right}', right);
        }

        if (condition.type === 'binary_expr') {
            if (['IS', 'IS NOT'].includes(condition.operator)) {
                if (condition.right.type == 'null') {
                    const operatorTemplate = SQL_TEMPLATES[`${condition.operator} NULL`];
                    const left = this.getColumnName(condition.left, aliasMap, schemaAliasMap);
                    return operatorTemplate.replace('{left}', left);
                }
            }

            const operatorTemplate = SQL_TEMPLATES[condition.operator] || `{left} ${condition.operator} {right}`;
            const left = this.getColumnName(condition.left, aliasMap, schemaAliasMap);
            let right = condition.right?.value || this.getColumnName(condition.right, aliasMap, schemaAliasMap);

            if (condition.operator === 'BETWEEN' && Array.isArray(condition.right.value)) {
                right = `${condition.right.value[0].value} and ${condition.right.value[1].value}`;
            }

            if (condition.operator === 'IN' && Array.isArray(condition.right.value)) {
                right = condition.right.value.map((item: any) => item.value).join(', ');
            }

            return operatorTemplate
                .replace('{left}', left)
                .replace('{right}', right);
        }

        return 'an unspecified condition';
    }

    private parseConditionString(condition: string): [ColumnRefItem, string, ColumnRefItem] {
        const operators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'BETWEEN', 'NOT LIKE', 'NOT IN'];

        let operator: string | null = null;
        for (const op of operators) {
            if (condition.includes(op)) {
                operator = op;
                break;
            }
        }

        if (!operator) {
            throw new Error('No valid operator found in condition');
        }

        const [left, right] = condition.split(operator).map(part => part.trim());

        const parseColumn = (columnString: string): ColumnRefItem => {
            const match = columnString.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/);
            if (match) {
                return { table: match[1], column: match[2], type: 'column_ref' };
            }
            return { table: '', column: columnString, type: 'column_ref' };
        };

        const leftColumn = parseColumn(left);
        const rightColumn = parseColumn(right);

        return [leftColumn, operator, rightColumn];
    }

    private getColumnName(
        column: any,
        aliasMap: Record<string, string> = {},
        schemaAliasMap?: IAliasMap
    ): string {
        if (!column) return 'unknown column';

        if (column.type === 'aggr_func') {
            const func = column.name?.toUpperCase();
            const arg = column.args?.expr;

            if (func && arg) {
                const aggTemplate = SQL_TEMPLATES[func.toUpperCase()] || func.toLowerCase();
                let col = typeof (arg.column) === 'string' ? arg.column : arg.column.expr.value;
                return aggTemplate.replace('{column}', this.formatName(col || 'unknown column', func));
            }
        }

        if (column.column) {
            // Resolve SQL alias to real table name if present in the alias map.
            const resolvedTable = column.table
                ? (aliasMap[column.table] ?? column.table)
                : null;

            if (typeof column.column === 'string') {
                const displayTable = resolvedTable
                    ? this.resolveTableDisplayName(resolvedTable, schemaAliasMap)
                    : null;
                const displayColumn = this.resolveColumnDisplayName(resolvedTable, column.column, schemaAliasMap);
                let tablePart = displayTable ? `the ${displayTable} ` : '';
                return `${tablePart}${displayColumn}`;
            }
            else if (column.column.expr) {
                const displayTable = resolvedTable
                    ? this.resolveTableDisplayName(resolvedTable, schemaAliasMap)
                    : null;
                const displayColumn = this.resolveColumnDisplayName(resolvedTable, column.column.expr.value, schemaAliasMap);
                let tablePart = displayTable ? `the ${displayTable} ` : '';
                return `${tablePart}${displayColumn}`;
            }
        }

        if (column.type == 'bool') {
            return column.value;
        }

        return 'unavailable';
    }

    /**
     * Returns the display name for a table, applying schemaAliasMap if available,
     * then formatting the result.
     */
    private formatTableName(tableName: string, schemaAliasMap?: IAliasMap): string {
        const alias = schemaAliasMap?.tables?.[tableName];
        return this.formatName(alias ?? tableName);
    }

    /**
     * Returns the display name for a column, applying schemaAliasMap if available,
     * then formatting the result.
     */
    private resolveColumnDisplayName(
        tableName: string | null,
        columnName: string,
        schemaAliasMap?: IAliasMap
    ): string {
        const alias = tableName
            ? schemaAliasMap?.columns?.[tableName]?.[columnName]
            : undefined;
        return this.formatName(alias ?? columnName);
    }

    /**
     * Returns the formatted display name for a table (alias-aware).
     */
    private resolveTableDisplayName(tableName: string, schemaAliasMap?: IAliasMap): string {
        const alias = schemaAliasMap?.tables?.[tableName];
        return this.formatName(alias ?? tableName);
    }

    private pluralize(name: string): string {
        if (name.endsWith('s')) return name;
        return `${name}s`;
    }

    private formatName(column: string, aggregation?: string): string {
        let formattedColumn = column.replace(/_/g, ' ').replace(/-/g, ' ').replace(/(\w+)id$/i, '$1 id');
        if (aggregation && (aggregation === 'COUNT' || aggregation === 'SUM' || aggregation === 'AVG'))
            return this.pluralize(formattedColumn);
        return this.separateWords(formattedColumn);
    }

    private separateWords(str: string): string {
        const regex = /([a-z0-9])([A-Z])|([_-])([a-zA-Z0-9])/g;
        return str.replace(regex, (match, p1, p2, p3, p4) => {
            if (p1 && p2) {
                return p1 + ' ' + p2;
            }
            if (p3 && p4) {
                return ' ' + p4;
            }
            return 'match';
        }).toLowerCase();
    }

    private getJoinTemplate(joinType: string): string {
        switch (joinType) {
            case 'INNER JOIN': return SQL_TEMPLATES.INNER_JOIN;
            case 'JOIN': return SQL_TEMPLATES.INNER_JOIN;
            case 'LEFT JOIN': return SQL_TEMPLATES.LEFT_JOIN;
            case 'RIGHT JOIN': return SQL_TEMPLATES.RIGHT_JOIN;
            case 'FULL JOIN': return SQL_TEMPLATES.FULL_JOIN;
            case 'SELF JOIN': return SQL_TEMPLATES.SELF_JOIN;
            case 'CROSS JOIN': return SQL_TEMPLATES.CROSS_JOIN;
            default: return 'Perform an unspecified join.';
        }
    }
}
