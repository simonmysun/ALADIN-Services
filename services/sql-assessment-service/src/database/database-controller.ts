import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseAnalyzer } from './database-analyzer';
import {
	connectToDatabase,
	generateDatabaseKey,
	generatePGliteKey,
} from '../shared/utils/database-utils';
import { validateConnectionInfo } from '../shared/utils/validation';
import { t, resolveLanguageCode, SupportedLanguage } from '../shared/i18n';
import { IAliasMap } from '../shared/interfaces/domain';
import { pgliteInstances } from './internal-memory';

/**
 * @openapi
 * /api/database/analyze-database:
 *   post:
 *     summary: Analyze and register a PostgreSQL database
 *     description: >
 *       Connects to a PostgreSQL database, extracts its full schema metadata
 *       (tables, columns, FK relationships, cardinalities), and stores it in
 *       the in-memory registry under a generated database key derived from
 *       host, port, and schema. The key is required by all subsequent endpoints.
 *     tags:
 *       - Database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyzeDatabaseRequest'
 *     responses:
 *       '200':
 *         description: Database successfully analyzed and registered.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       '400':
 *         description: Invalid connection info or connection failure.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Schema extraction failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export class DatabaseController {
	public router: Router;
	databaseAnalyzer: DatabaseAnalyzer;

	constructor(databaseAnalyzer: DatabaseAnalyzer) {
		this.databaseAnalyzer = databaseAnalyzer;
		this.router = Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.post('/analyze-database', (req: Request, resp: Response) => {
			this.analyzeDatabase(req, resp);
		});
	}

	public async analyzeDatabase(req: Request, res: Response): Promise<Response> {
		let connectionInfo: PostgresConnectionOptions;
		let dataSource: DataSource;
		let isConnected: boolean;

		const lang = resolveLanguageCode(req.body?.languageCode);

		try {
			connectionInfo = req.body.connectionInfo;
		} catch (err: any) {
			console.log('Invalid connection info', err);
			return res
				.status(400)
				.json({ message: t('INVALID_CONNECTION_INFO', lang) });
		}

		// ---- PGlite branch --------------------------------------------------
		if ((connectionInfo as any)?.type === 'pglite') {
			return this.analyzePGliteDatabase(connectionInfo as any, lang, res);
		}
		// ---------------------------------------------------------------------

		const validationError = validateConnectionInfo(connectionInfo, lang);
		if (validationError) {
			return res.status(400).json({ message: validationError });
		}

		console.log('Received connection info:', connectionInfo);
		try {
			dataSource = new DataSource(connectionInfo);
			isConnected = await connectToDatabase(dataSource);
		} catch (error) {
			console.error(error);
			return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
		}

		// Parse and validate the optional alias map
		let aliasMap: IAliasMap | undefined;
		const rawAliasMap = req.body.aliasMap;
		if (rawAliasMap !== undefined) {
			if (
				typeof rawAliasMap !== 'object' ||
				Array.isArray(rawAliasMap) ||
				rawAliasMap === null
			) {
				console.log(
					'Invalid aliasMap provided — must be a plain object. Ignoring.',
				);
			} else {
				aliasMap = rawAliasMap as IAliasMap;
			}
		}

		if (isConnected) {
			if (
				await this.databaseAnalyzer.extractDatabaseSchema(
					dataSource,
					connectionInfo.schema!,
					generateDatabaseKey(
						connectionInfo.host!,
						connectionInfo.port!,
						connectionInfo.schema!,
					),
					aliasMap,
				)
			) {
				await dataSource.destroy();
				return res
					.status(200)
					.json({ message: t('DATABASE_ANALYSIS_SUCCESS', lang) });
			}
			await dataSource.destroy();
			return res
				.status(500)
				.json({ message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang) });
		}

		try {
			await dataSource.destroy();
		} catch (error) {
			console.log(error);
		}
		return res.status(400).json({ message: t('UNABLE_TO_CONNECT', lang) });
	}

	// -------------------------------------------------------------------------
	// PGlite helpers
	// -------------------------------------------------------------------------

	private async analyzePGliteDatabase(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		rawInfo: any,
		lang: SupportedLanguage,
		res: Response,
	): Promise<Response> {
		const { databaseId, sqlContent } = rawInfo ?? {};

		if (!databaseId || typeof databaseId !== 'string') {
			return res
				.status(400)
				.json({ message: t('INVALID_CONNECTION_INFO', lang) });
		}
		if (!sqlContent || typeof sqlContent !== 'string') {
			return res
				.status(400)
				.json({ message: t('INVALID_CONNECTION_INFO', lang) });
		}

		// Close and evict any existing instance for this id
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
			return res
				.status(500)
				.json({ message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang) });
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
			return res
				.status(500)
				.json({ message: t('DATABASE_SCHEMA_EXTRACTION_FAILED', lang) });
		}

		pgliteInstances.set(databaseId, db);
		return res
			.status(200)
			.json({ message: t('DATABASE_ANALYSIS_SUCCESS', lang) });
	}
}
