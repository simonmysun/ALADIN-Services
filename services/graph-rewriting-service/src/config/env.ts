export type EnvVarAppEnvironment = 'production' | 'development' | 'test';

export interface AppEnvConfig {
	APP_ENV: EnvVarAppEnvironment;
}

export function getAppEnvConfig(): AppEnvConfig {
	const { APP_ENV } = process.env as Record<string, EnvVarAppEnvironment>;

	return {
		APP_ENV: APP_ENV ?? 'production',
	};
}
