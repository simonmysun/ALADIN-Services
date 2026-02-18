import { ResultGraphSchema } from './graph-transformation.service';

export class HistoryService {
	private history: ResultGraphSchema[] = [];
	// private _trackHistory = false;

	// get trackHistory() {
	// 	return this._trackHistory;
	// }

	// set trackHistory(trackHistory: boolean) {
	// 	this._trackHistory = trackHistory;
	// }

	public addToHistory(graph: ResultGraphSchema): void {
		this.history.push(graph);
	}

	public getHistory(): ResultGraphSchema[] {
		return this.history;
	}

	public clearHistory(): void {
		this.history = [];
	}
}
