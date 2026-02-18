import { faker, Faker } from '@faker-js/faker';
import { IValueInstantiator, IInstantiatorOptions } from '../types';

// TODO: Check for better typing

type FakerModule = keyof Faker;
type FakerMethod<T extends FakerModule> = keyof Faker[T];

// interface FakerInstantiatorOptions<T extends FakerModule> {
// 	module: T;
// 	method: FakerMethod<T>;
// }

export enum FakerErrors {
	'ModuleNotProvided' = 'Faker value instantiation: "module" parameter needs to be provided.',
	'MethodNotProvided' = 'Faker value instantiation: "method" parameter needs to be provided.',
	'ModuleNotFound' = 'Faker value instantiation: module not found',
	'MethodNotFound' = 'Faker value instantiation: method not found',
	'MethodNotAFunction' = 'Faker value instantiation: method is not a function',
}

interface FakerInstantiatorOptions extends IInstantiatorOptions {
	module: FakerModule;
	method: string;
	options?: Record<string, unknown>;
}

export class FakerInstantiator
	implements IValueInstantiator<FakerInstantiatorOptions>
{
	_instantiatorKey = 'faker';

	get instantiatorKey() {
		return this._instantiatorKey;
	}

	public instantiate(args: FakerInstantiatorOptions) {
		return this.instantiateValue(args);
	}

	public instantiateValue(args: FakerInstantiatorOptions) {
		const { module, method, options } = args as {
			module: FakerModule;
			method: FakerMethod<typeof module>;
			options: Record<string, unknown>;
		};

		if (!module) {
			throw new Error(FakerErrors.ModuleNotProvided);
		}

		if (!method) {
			throw new Error(FakerErrors.MethodNotProvided);
		}

		if (!faker[module]) {
			throw new Error(FakerErrors.ModuleNotFound + `: "${module}" `);
		}

		if (!faker[module][method]) {
			throw new Error(FakerErrors.MethodNotFound + `: "${module}.${method}" `);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		type FakerFunction = (...args: unknown[]) => any;

		const fakerFunction = faker[module][method] as FakerFunction;

		if (typeof fakerFunction !== 'function') {
			throw new Error(
				FakerErrors.MethodNotAFunction + `: "${module}.${method}" `
			);
		}

		if (options) {
			return fakerFunction(options);
		}

		return fakerFunction();
	}
}
