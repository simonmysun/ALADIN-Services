import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { DatabaseController } from '../database/database-controller';
import { TaskGenerationController } from '../generation/task-generation-controller';
import { GradingController } from '../grading/grading-controller';

const api = express();

api.use(bodyParser.json());
api.use(express.static(path.join(__dirname, '..', 'test-page')));
api.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'test-page', 'test-page.html'));
});

export function registerControllers(
    databaseController: DatabaseController,
    taskGenerationController: TaskGenerationController,
    gradingController: GradingController
) {
    api.use('/api/database', databaseController.router);
    api.use('/api/generation', taskGenerationController.router);
    api.use('/api/grading', gradingController.router);
}

export function startRestApi() {
    const PORT = process.env.PORT || 3000;
    api.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
