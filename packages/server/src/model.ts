export interface RawTrack {
	lang: string;
	content: unknown;
}

export interface Entity {
	offset: number;
	length: number;
	attributes?: any[];
}
