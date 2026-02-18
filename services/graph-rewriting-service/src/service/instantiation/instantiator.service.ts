import { IGraphInstantiator, IValueInstantiator } from './types';

import { RandExpInstantiator } from './modules/randexp-instantiator';
import { FakerInstantiator } from './modules/faker-instantiator';
import { JsonLogicInstantiator } from './modules/json-logic-instantiator';
import { ExternalApiInstantiator } from './modules/external-api-instantiator';

export class InstantiatorService {
	static plugins = [
		RandExpInstantiator,
		FakerInstantiator,
		JsonLogicInstantiator,
		ExternalApiInstantiator,
	];
	private instantiators: Map<string, IValueInstantiator | IGraphInstantiator>;

	constructor() {
		this.instantiators = new Map();

		InstantiatorService.plugins.forEach((instantiator) => {
			const instantiatorInstance = new instantiator();
			const key = instantiatorInstance.instantiatorKey;
			this.instantiators.set(key, instantiatorInstance);
		});
	}

	private getInstantiator(instantiator: string) {
		const instantiatorInstance = this.instantiators.get(instantiator);
		if (!instantiatorInstance) {
			throw Error(`Instantiator of type "${instantiator}" is not loaded`);
		}
		return instantiatorInstance;
	}

	public getGraphInstantiator(instantiatorName: string): IGraphInstantiator {
		const instantiatorInstance = this.getInstantiator(instantiatorName);
		if (!this.isGraphInstantiator(instantiatorInstance)) {
			throw Error(
				`Instantiator of type "${instantiatorName}" is not a subgraph instantiator`
			);
		}
		return instantiatorInstance;
	}

	public getValueInstantiator(instantiatorName: string): IValueInstantiator {
		const instantiatorInstance = this.getInstantiator(instantiatorName);
		if (!this.isValueInstantiator(instantiatorInstance)) {
			throw Error(
				`Instantiator of type "${instantiatorName}" is not a value instantiator`
			);
		}
		return instantiatorInstance;
	}

	private isGraphInstantiator(
		instantiatorInstance: IValueInstantiator | IGraphInstantiator
	): instantiatorInstance is IGraphInstantiator {
		return (
			(instantiatorInstance as IGraphInstantiator).instantiateGraph !==
			undefined
		);
	}

	private isValueInstantiator(
		instantiatorInstance: IValueInstantiator | IGraphInstantiator
	): instantiatorInstance is IValueInstantiator {
		return !this.isGraphInstantiator(instantiatorInstance);
	}
}
