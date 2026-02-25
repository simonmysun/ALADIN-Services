import { DataSource, QueryRunner } from 'typeorm';

export function generateDatabaseKey(host: string, port: number, schema: string): string {
    return `${host}${port}${schema}`;
}

export async function connectToDatabase(dataSource: DataSource): Promise<boolean> {
    let isConnected = false;
    await dataSource
        .initialize()
        .then(() => {
            console.log(`Data Source ${dataSource} has been initialized!`);
            isConnected = true;
        })
        .catch(err => {
            console.error(
                `Error during Data Source ${dataSource} initialization`,
                err
            );
            isConnected = false;
        });
    return isConnected;
}

export function createQueryRunner(dataSource: DataSource): QueryRunner | undefined {
    if (!dataSource) {
        console.log('Undefined datasource, please establish a database connection');
        return undefined;
    }
    return dataSource.createQueryRunner();
}
