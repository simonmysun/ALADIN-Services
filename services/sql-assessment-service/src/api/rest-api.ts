import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { DatabaseController } from '../database/database-controller';
import { TaskGenerationController } from '../generation/task-generation-controller';
import { GradingController } from '../grading/grading-controller';
import { DescriptionController } from '../generation/description/description-controller';
import { QueryExecutionController } from '../query/query-execution-controller';
import dotenv from 'dotenv';
const api = express();

api.use(bodyParser.json());
api.use(express.static(path.join(__dirname, '..', 'test-page')));
api.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'test-page', 'test-page.html'));
});

export function registerControllers(
	databaseController: DatabaseController,
	taskGenerationController: TaskGenerationController,
	gradingController: GradingController,
	descriptionController: DescriptionController,
	queryExecutionController: QueryExecutionController,
) {
	api.use('/api/database', databaseController.router);
	api.use('/api/generation', taskGenerationController.router);
	api.use('/api/grading', gradingController.router);
	api.use('/api/description', descriptionController.router);
	api.use('/api/query', queryExecutionController.router);
}

export function startRestApi() {
	dotenv.config();

	const PORT = process.env.PORT || 3000;
	api.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
	});
}
