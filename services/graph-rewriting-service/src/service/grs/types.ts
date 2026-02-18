export type GrsGraphMetadata = Record<string, unknown>;

export interface GrsGraphNodeMetadata {
	_grs_internalId: string;
	[name: string]: unknown;
}

export interface GrsGraphEdgeMetadata {
	_grs_internalId: string;
	[name: string]: unknown;
}
