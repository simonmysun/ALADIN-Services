import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as fs from 'fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseAnalyzer } from './database-analyzer';
import {
	connectToDatabase,
	generateDatabaseKey,
	generatePGliteKey,
} from '../shared/utils/database-utils';
import {
	isDatabaseRegistered,
	validateConnectionInfo,
} from '../shared/utils/validation';
import { t, SupportedLanguage } from '../shared/i18n';
import { IAliasMap } from '../shared/interfaces/domain';
import { pgliteInstances } from './internal-memory';

export interface AnalyzeResult {
	ok: boolean;
	status: number;
	message: string;
}

/**
 * Pure business-logic service for analyzing / registering databases.
 *
 * Used by {@link DatabaseController} to handle `/api/database/analyze-database`
 * and by the four downstream controllers to auto-analyze before their own logic.
 *
 * When {@link initSqlFilePath} is configured (via constructor, the
 * `PGLITE_INIT_SQL_FILE` environment variable, or the `--init-sql-file` CLI
 * flag), a PGlite request that carries **no** `sqlContent` field will
 * automatically fall back to reading that file as the initialisation SQL.
 */
export class DatabaseService {
	private readonly initSqlFilePath?: string;
	private cachedInitSql?: string;

	constructor(
		private readonly databaseAnalyzer: DatabaseAnalyzer,
		initSqlFilePath?: string,
	) {
		this.initSqlFilePath = initSqlFilePath;
	}
	/**
	 * Ensures the database described by `connectionInfo` is analyzed and its
	 * schema metadata stored in the in-memory registry.
	 *
	 * Behaviour by connection type:
	 * - **PGlite** – always (re-)creates the in-process instance when
	 *   `sqlContent` is present.  If `sqlContent` is absent and `required` is
	 *   `false` (the default for the four downstream controllers), the call is a
	 *   no-op (assumes a prior registration is still valid for the process).
	 *   When `required` is `true` (used by the `/api/database/analyze-database`
	 *   endpoint), `sqlContent` is mandatory and its absence is an error.
	 * - **PostgreSQL** – runs a full schema extraction only when the database
	 *   key is not yet registered.  Subsequent calls within the same process
	 *   skip the expensive round-trip.
	 */
	async ensureAnalyzed(
		connectionInfo: any,
		aliasMap?: IAliasMap,
		lang: SupportedLanguage = 'en',
		required = false,
	): Promise<AnalyzeResult> {
		if (!connectionInfo) {
			return {
				ok: false,
				status: 400,
				message: t('MISSING_CONNECTION_INFO', lang),
			};
		}

		if (connectionInfo.type === 'pglite') {
			// Resolve sqlContent: use the value from the request body first.
			let sqlContent: string | undefined = connectionInfo.sqlContent;

			if (!sqlContent) {
				// If the DB is already registered and the caller did not supply new
				// sqlContent, treat this as a no-op — same semantics as the PG branch.
				const databaseId: string | undefined = connectionInfo.databaseId;
				if (
					!required &&
					databaseId &&
					isDatabaseRegistered(generatePGliteKey(databaseId))
				) {
					return { ok: true, status: 200, message: 'already registered' };
				}

				// Fall back to the configured init-SQL file (if any).
				if (this.initSqlFilePath) {
					try {
						if (!this.cachedInitSql) {
							this.cachedInitSql = await fs.readFile(
								this.initSqlFilePath,
								'utf-8',
							);
						}
						sqlContent = this.cachedInitSql;
					} catch (err) {
						console.error(
							`Failed to read init SQL file: ${this.initSqlFilePath}`,
							err,
						);
						return {
							ok: false,
							status: 500,
							message: t('INIT_SQL_READ_ERROR', lang),
						};
					}
				}

				if (!sqlContent) {
					if (required) {
						return {
							ok: false,
							status: 400,
							message: t('INVALID_CONNECTION_INFO', lang),
						};
					}
					return { ok: true, status: 200, message: 'skipped' };
				}
			}
			return this.analyzePGlite({ ...connectionInfo, sqlContent }, lang);
		}

		// PostgreSQL – validate first so we never generate a bogus key from undefined fields.
		const pgInfo = connectionInfo as PostgresConnectionOptions;
		const pgValidationError = validateConnectionInfo(pgInfo, lang);
		if (pgValidationError) {
			return { ok: false, status: 400, message: pgValidationError };
		}

		// Skip the expensive round-trip only when the caller did not explicitly
		// require a fresh analysis (required=true is used by /analyze-database).
		const key = generateDatabaseKey(pgInfo.host!, pgInfo.port!, pgInfo.schema!);
		if (!required && isDatabaseRegistered(key)) {
			return { ok: true, status: 200, message: 'already registered' };
		}

		return this.analyzePostgres(connectionInfo, aliasMap, lang);
	}

	// -------------------------------------------------------------------------
	// PGlite helpers
	// -------------------------------------------------------------------------

	private async analyzePGlite(
		rawInfo: any,
		lang: SupportedLanguage,
	): Promise<AnalyzeResult> {
		const { databaseId, sqlContent } = rawInfo ?? {};

		if (!databaseId || typeof databaseId !== 'string') {
			return {
				ok: false,
				status: 400,
				message: t('INVALID_CONNECTION_INFO', lang),
			};
		}
		if (!sqlContent || typeof sqlContent !== 'string') {
			return {
				ok: false,
				status: 400,
				message: t('INVALID_CONNECTION_INFO', lang),
			};
		}

		// Close and evict any existing instance for this id.
		const existing = pgliteInstances.get(databaseId);
		if (existing) {
			try {
				await existing.close();
			} catch {
				/* ignore */
			}
			pgliteInstances.delete(databaseId);
		}

		let db: PGlite;
		try {
			db = new PGlite();
			await db.exec(sqlContent);
		} catch (error) {
			console.error('PGlite initialisation failed', error);
			return {
				ok: false,
				status: 500,
				message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang),
			};
		}

		const key = generatePGliteKey(databaseId);
		const success = await this.databaseAnalyzer.extractSchemaFromPGlite(
			db,
			key,
		);

		if (!success) {
			try {
				await db.close();
			} catch {
				/* ignore */
			}
			return {
				ok: false,
				status: 500,
				message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang),
			};
		}

		pgliteInstances.set(databaseId, db);
		return {
			ok: true,
			status: 200,
			message: t('DATABASE_ANALYSIS_SUCCESS', lang),
		};
	}

	// -------------------------------------------------------------------------
	// PostgreSQL helpers
	// -------------------------------------------------------------------------

	private async analyzePostgres(
		connectionInfo: PostgresConnectionOptions,
		aliasMap: IAliasMap | undefined,
		lang: SupportedLanguage,
	): Promise<AnalyzeResult> {
		const validationError = validateConnectionInfo(connectionInfo, lang);
		if (validationError) {
			return { ok: false, status: 400, message: validationError };
		}

		let dataSource: DataSource;
		let isConnected: boolean;
		try {
			dataSource = new DataSource(connectionInfo);
			isConnected = await connectToDatabase(dataSource);
		} catch {
			return { ok: false, status: 400, message: t('UNABLE_TO_CONNECT', lang) };
		}

		if (!isConnected) {
			try {
				await dataSource!.destroy();
			} catch {
				/* ignore */
			}
			return { ok: false, status: 400, message: t('UNABLE_TO_CONNECT', lang) };
		}

		const key = generateDatabaseKey(
			connectionInfo.host!,
			connectionInfo.port!,
			connectionInfo.schema!,
		);
		const extracted = await this.databaseAnalyzer.extractDatabaseSchema(
			dataSource,
			connectionInfo.schema!,
			key,
			aliasMap,
		);
		await dataSource.destroy();

		if (!extracted) {
			return {
				ok: false,
				status: 500,
				message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang),
			};
		}
		return {
			ok: true,
			status: 200,
			message: t('DATABASE_ANALYSIS_SUCCESS', lang),
		};
	}
}
