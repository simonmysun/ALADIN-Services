import { DataSource, Table } from 'typeorm';
import 'reflect-metadata';
import {
    IParsedColumn,
    IParsedTable,
    IJoinPaths,
    IPath,
    IAliasMap,
    EntityType,
    RelationshipType,
    Participation,
    IForeignKeyRelationship,
} from '../shared/interfaces/domain';
import { databaseMetadata, selfJoinDatabaseMetadata } from './internal-memory';

export class DatabaseAnalyzer {

    public async extractDatabaseSchema(
        dataSource: DataSource,
        schema: string,
        databaseKey: string,
        aliasMap?: IAliasMap
    ): Promise<boolean> {
        try {
            const queryRunner = dataSource.createQueryRunner();

            const tables: Table[] = await queryRunner.getTables();

            await queryRunner.release();

            const filteredTables = tables.filter(
                table => table.schema === schema
            );

            if (filteredTables.length == 0)
                return false;

            // ----------------------------------------------------------------
            // First pass: build base IParsedTable entries (columns + join paths)
            // ----------------------------------------------------------------
            let parsedTables: IParsedTable[] = [];
            let selfJoinTable: IParsedTable[] = [];

            filteredTables.forEach(table => {
                const tableName = this.getTableName(table.name);

                // --- Collect PK column names for this table ---
                const pkColumnNames = new Set<string>(
                    table.primaryColumns.map(pc => pc.name)
                );

                // --- Collect FK column names for this table ---
                const fkColumnNames = new Set<string>(
                    table.foreignKeys.flatMap(fk => fk.columnNames)
                );

                // --- Collect unique-indexed column names (used for 1:1 detection) ---
                const uniqueColumnNames = new Set<string>(
                    table.uniques.flatMap(u => u.columnNames)
                );

                // --- Build parsed columns ---
                const parsedColumns: IParsedColumn[] = table.columns.map(column => ({
                    name: column.name,
                    tableName: tableName,
                    type: column.type,
                    isNullable: column.isNullable,
                    isPrimaryKey: pkColumnNames.has(column.name),
                    isForeignKey: fkColumnNames.has(column.name),
                    alternativeName: aliasMap?.columns?.[tableName]?.[column.name],
                }));

                // --- Build FK relationships ---
                const relationships = this.buildRelationships(
                    table,
                    tableName,
                    pkColumnNames,
                    uniqueColumnNames
                );

                // --- Build join paths ---
                const joinPaths = this.findJoinPaths(
                    tableName,
                    [],
                    0,
                    new Set(),
                    filteredTables,
                    schema,
                    false
                );

                let selfJoinPaths: IJoinPaths[];
                let otherPaths: IJoinPaths[];
                [selfJoinPaths, otherPaths] = this.separateSelfAndNonSelfJoinPaths(joinPaths);

                const baseEntry: Omit<IParsedTable, 'entityType' | 'relationships' | 'supertableOf' | 'subtableOf' | 'alternativeName'> = {
                    name: tableName,
                    joinPaths: [],   // filled below
                    columns: parsedColumns,
                };

                parsedTables.push({
                    ...baseEntry,
                    joinPaths: this.filterJoinPaths(tableName, otherPaths),
                    // Placeholder values — overwritten in second pass
                    entityType: EntityType.Strong,
                    relationships,
                    alternativeName: aliasMap?.tables?.[tableName],
                });

                selfJoinTable.push({
                    ...baseEntry,
                    joinPaths: this.filterJoinPaths(tableName, selfJoinPaths),
                    entityType: EntityType.Strong,
                    relationships,
                    alternativeName: aliasMap?.tables?.[tableName],
                });
            });

            // ----------------------------------------------------------------
            // Second pass: classify entity types and wire supertype/subtype
            // ----------------------------------------------------------------
            this.classifyEntities(parsedTables, filteredTables, schema);
            this.classifyEntities(selfJoinTable, filteredTables, schema);

            // Propagate N:M cardinality onto the two tables bridged by each
            // associative table.
            this.propagateManyToMany(parsedTables);
            this.propagateManyToMany(selfJoinTable);

            databaseMetadata.set(databaseKey, parsedTables);
            selfJoinDatabaseMetadata.set(databaseKey, selfJoinTable);
            return true;
        } catch (error: any) {
            console.log('Unable to parse database schema', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Entity-type classification
    // -------------------------------------------------------------------------

    /**
     * Classifies each table's EntityType and wires supertype/subtype links.
     * Operates in-place on the provided array.
     */
    private classifyEntities(
        parsedTables: IParsedTable[],
        rawTables: Table[],
        schema: string
    ): void {
        // Build a quick lookup: tableName → rawTable
        const rawMap = new Map<string, Table>();
        rawTables.forEach(t => rawMap.set(this.getTableName(t.name), t));

        // Build a lookup for PK column sets per table (raw names)
        const pkMap = new Map<string, Set<string>>();
        rawTables.forEach(t => {
            pkMap.set(
                this.getTableName(t.name),
                new Set(t.primaryColumns.map(c => c.name))
            );
        });

        // ---- Classify each table ----
        for (const parsedTable of parsedTables) {
            const raw = rawMap.get(parsedTable.name);
            if (!raw) continue;

            const pkCols = pkMap.get(parsedTable.name) ?? new Set<string>();
            const fkColNames = new Set<string>(raw.foreignKeys.flatMap(fk => fk.columnNames));
            const referencedTables = raw.foreignKeys.map(fk =>
                this.getTableName(fk.referencedTableName)
            );

            // Associative: every PK column is also a FK column
            const allPkAreFk = pkCols.size > 0 && [...pkCols].every(col => fkColNames.has(col));

            // Subtype: the table has exactly one FK that references another table
            //          AND that FK column set equals the full PK of this table
            //          (shared-PK pattern → IS-A relationship).
            const isSubtype = this.detectSubtype(raw, pkCols, pkMap, schema);

            // Weak: at least one PK column is a FK, but not all (partial dependency)
            const somePkAreFk = pkCols.size > 0 && [...pkCols].some(col => fkColNames.has(col));

            if (allPkAreFk && referencedTables.length >= 2) {
                parsedTable.entityType = EntityType.Associative;
            } else if (isSubtype) {
                parsedTable.entityType = EntityType.Subtype;
            } else if (somePkAreFk) {
                parsedTable.entityType = EntityType.Weak;
            } else {
                parsedTable.entityType = EntityType.Strong;
            }
        }

        // ---- Back-fill supertype ↔ subtype links ----
        const tableMap = new Map<string, IParsedTable>(parsedTables.map(t => [t.name, t]));

        for (const parsedTable of parsedTables) {
            if (parsedTable.entityType !== EntityType.Subtype) continue;

            const raw = rawMap.get(parsedTable.name);
            if (!raw) continue;

            const pkCols = pkMap.get(parsedTable.name) ?? new Set<string>();

            // Find the FK whose column set equals the full PK of this table
            for (const fk of raw.foreignKeys) {
                const fkCols = new Set<string>(fk.columnNames);
                const sharedWithPk = fk.columnNames.every(c => pkCols.has(c));
                if (!sharedWithPk) continue;

                const supertableName = this.getTableName(fk.referencedTableName);
                parsedTable.subtableOf = supertableName;

                const superEntry = tableMap.get(supertableName);
                if (superEntry) {
                    if (!superEntry.supertableOf) superEntry.supertableOf = [];
                    if (!superEntry.supertableOf.includes(parsedTable.name)) {
                        superEntry.supertableOf.push(parsedTable.name);
                    }
                }
                break; // Only one supertype per table
            }
        }
    }

    /**
     * Returns true when the table uses a shared-PK pattern:
     * the table's full PK is covered by FK columns that reference another table's PK.
     */
    private detectSubtype(
        table: Table,
        pkCols: Set<string>,
        pkMap: Map<string, Set<string>>,
        schema: string
    ): boolean {
        if (pkCols.size === 0) return false;

        for (const fk of table.foreignKeys) {
            const refTableName = this.getTableName(fk.referencedTableName);
            const refPkCols = pkMap.get(refTableName);
            if (!refPkCols) continue;

            // All PK columns of this table must be covered by this FK's columns
            const fkColSet = new Set<string>(fk.columnNames);
            const allPkCoveredByFk = [...pkCols].every(c => fkColSet.has(c));

            // The referenced columns must be the PK of the referenced table
            const fkRefColSet = new Set<string>(fk.referencedColumnNames);
            const referencesFullPk = [...refPkCols].every(c => fkRefColSet.has(c));

            if (allPkCoveredByFk && referencesFullPk) return true;
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Relationship building
    // -------------------------------------------------------------------------

    private buildRelationships(
        table: Table,
        tableName: string,
        pkColumnNames: Set<string>,
        uniqueColumnNames: Set<string>
    ): IForeignKeyRelationship[] {
        return table.foreignKeys.map(fk => {
            const fkCol = fk.columnNames[0];
            const referencedTable = this.getTableName(fk.referencedTableName);
            const referencedColumn = fk.referencedColumnNames[0];

            const isIdentifying = fk.columnNames.every(c => pkColumnNames.has(c));

            // Find the actual column definition to check nullability
            const columnDef = table.columns.find(c => c.name === fkCol);
            const participation = columnDef?.isNullable
                ? Participation.Optional
                : Participation.Mandatory;

            // 1:1 if the FK column has a unique constraint or unique index
            const hasUniqueConstraint = uniqueColumnNames.has(fkCol)
                || table.indices.some(idx => idx.isUnique && idx.columnNames.includes(fkCol));

            // N:M is assigned later by propagateManyToMany; default to 1:N here
            const cardinality = hasUniqueConstraint
                ? RelationshipType.OneToOne
                : RelationshipType.OneToMany;

            return {
                fkColumn: fkCol,
                referencedTable,
                referencedColumn,
                isIdentifying,
                participation,
                cardinality,
            };
        });
    }

    // -------------------------------------------------------------------------
    // N:M propagation via associative tables
    // -------------------------------------------------------------------------

    /**
     * For every associative (junction) table, marks the FK relationships on
     * the two bridged tables as N:M.
     */
    private propagateManyToMany(parsedTables: IParsedTable[]): void {
        const tableMap = new Map<string, IParsedTable>(parsedTables.map(t => [t.name, t]));

        for (const table of parsedTables) {
            if (table.entityType !== EntityType.Associative) continue;
            if (table.relationships.length < 2) continue;

            const bridgedTables = table.relationships.map(r => r.referencedTable);

            // Mark relationship on each bridged side
            for (let i = 0; i < bridgedTables.length; i++) {
                const sideA = tableMap.get(bridgedTables[i]);
                if (!sideA) continue;

                // For each other bridged table
                for (let j = 0; j < bridgedTables.length; j++) {
                    if (i === j) continue;
                    // Find the FK relationship on sideA that points to the junction table
                    // (sideA itself usually doesn't hold the FK; the junction table does).
                    // We instead mark the relationship on the junction entry towards sideA's peer.
                    // Update the junction table's FK relationships to N:M
                    for (const rel of table.relationships) {
                        rel.cardinality = RelationshipType.ManyToMany;
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Existing join-path helpers (unchanged)
    // -------------------------------------------------------------------------

    private findJoinPaths(
        tableName: string,
        path: IPath[],
        depth: number,
        visited: Set<string>,
        tables: Table[],
        schema: string,
        isPreviousPathSelfJoin: boolean
    ): IJoinPaths[] {
        const results: IJoinPaths[] = [];
        const visitedPaths = new Set(visited);

        const table = tables.find(
            (table) => table.name === `${schema}.${tableName}` || table.name === tableName
        );

        if (!table) return results;

        const relatedTables = table.foreignKeys.map((fk) => ({
            tableName: this.getTableName(fk.referencedTableName),
            relationKey: `${this.getTableName(table.name)}.${fk.columnNames[0]} = ${this.getTableName(fk.referencedTableName)}.${fk.referencedColumnNames[0]}`
        }));

        for (const relation of relatedTables) {
            const newPath: IPath[] = [...path, { tableName: relation.tableName, relationKey: relation.relationKey }];
            const pathKey = `${tableName}-${relation.relationKey}-${relation.tableName}`;

            if (visitedPaths.has(pathKey)) continue;
            visitedPaths.add(pathKey);

            const newDepth = depth + 1;
            const isSelfJoin = isPreviousPathSelfJoin || tableName === relation.tableName;

            results.push({
                path: newPath,
                depth: newDepth,
                isSelfJoin: isSelfJoin,
                selfJoinDepth: 0
            });

            const recursivePaths = this.findJoinPaths(
                relation.tableName,
                newPath,
                newDepth,
                new Set(visitedPaths),
                tables,
                schema,
                isSelfJoin
            );

            results.push(...recursivePaths);
        }

        return results;
    }

    private separateSelfAndNonSelfJoinPaths(paths: IJoinPaths[]): [selfPaths: IJoinPaths[], otherPaths: IJoinPaths[]] {
        const selfPaths = paths.filter(path => path.isSelfJoin);
        const otherPaths = paths.filter(path => !path.isSelfJoin);
        return [selfPaths, otherPaths];
    }

    private filterJoinPaths(currentTableName: string, paths: IJoinPaths[]): IJoinPaths[] {
        const uniquePaths = new Map<string, IJoinPaths>();

        for (const path of paths) {
            const key = path.path.map(p => p.tableName).join('->');

            let selfJoinDepth: number = 0;
            let selfJoinCount = 0;
            if (path.isSelfJoin) {
                const tableNames = new Set<string>();
                for (let i = 0; i < path.path.length; i++) {
                    const tableName = path.path[i].tableName;

                    if (currentTableName === tableName) {
                        selfJoinDepth = i + 1;
                    }
                    if (tableNames.has(tableName)) {
                        selfJoinCount = 2;
                        if (selfJoinCount === 2) {
                            selfJoinDepth = i + 1;
                        }
                    } else {
                        tableNames.add(tableName);
                    }
                }
            }
            const pathWithSelfJoinDepth: IJoinPaths = {
                ...path,
                selfJoinDepth: selfJoinDepth,
            };

            const existingPath = uniquePaths.get(key);
            if (!existingPath || existingPath.depth < path.depth) {
                uniquePaths.set(key, pathWithSelfJoinDepth);
            }
        }

        const sortedPaths = Array.from(uniquePaths.values()).sort((a, b) => b.depth - a.depth);

        const finalPaths: IJoinPaths[] = [];
        const seenKeys = new Set<string>();

        for (const path of sortedPaths) {
            const key = path.path.map(p => p.tableName).join('->');

            let isSubPath = false;
            for (const existingKey of seenKeys) {
                if (existingKey.startsWith(key)) {
                    isSubPath = true;
                    break;
                }
            }

            if (!isSubPath) {
                finalPaths.push(path);
                seenKeys.add(key);
            }
        }

        return finalPaths;
    }

    private getTableName(tableName: string): string {
        const names = tableName.split('.');
        return names.length > 1 ? names[1] : names[0];
    }
}
