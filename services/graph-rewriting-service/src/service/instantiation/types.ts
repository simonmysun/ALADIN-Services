import { ReplacementGraphSchema } from '../../types/replacementgraph.schema';

export type IInstantiatorOptions = Record<string, unknown>;

export interface IInstantiator<T = IInstantiatorOptions> {
	readonly instantiatorKey: string;
	instantiate(args: T): unknown;
}

export interface IValueInstantiator<T = IInstantiatorOptions>
	extends IInstantiator<T> {
	readonly instantiatorKey: string;
	instantiate(args: T): string | number | boolean;
	instantiateValue(args: T): string | number | boolean;
}

export interface IGraphInstantiator<T = IInstantiatorOptions>
	extends IInstantiator<T> {
	readonly instantiatorKey: string;
	instantiate(args: T): Promise<ReplacementGraphSchema>;
	instantiateGraph(args: T): Promise<ReplacementGraphSchema>;
}
