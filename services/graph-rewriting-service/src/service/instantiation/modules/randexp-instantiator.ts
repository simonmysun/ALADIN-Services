import RandExp from 'randexp';
import { IValueInstantiator, IInstantiatorOptions } from '../types';

interface RandExpInstantiatorOptions extends IInstantiatorOptions {
	pattern: string;
	flags?: 'i' | 'm';
}

export enum RandexpErrors {
	'PatternNotProvided' = 'Randexp value instantiation: "pattern" parameter needs to be provided.',
}

export class RandExpInstantiator
	implements IValueInstantiator<RandExpInstantiatorOptions>
{
	_instantiatorKey = 'randexp';

	get instantiatorKey() {
		return this._instantiatorKey;
	}

	public instantiateValue(args: RandExpInstantiatorOptions) {
		const { pattern, flags } = args;

		if (!pattern) {
			throw new Error(RandexpErrors.PatternNotProvided);
		}

		if (flags) return new RandExp(pattern, flags).gen();

		return new RandExp(pattern).gen();
	}

	public instantiate(args: RandExpInstantiatorOptions) {
		return this.instantiateValue(args);
	}
}
