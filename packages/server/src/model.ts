export interface RawTrack {
	lang: string;
	content: unknown;
}

export interface Entity {
	/** zero-based shift based on cue begin, from which the entity will begin */
	offset: number;
	/** one-based content length in entity */
	length: number;
	attributes?: any[];
	type: number;
}

export interface Region {
	id: string;
	width?: string;
	lines?: number;
	scroll?: "up" | "none";
	regionanchor?: [`${number}%`, `${number}%`];
	viewportanchor?: [`${number}%`, `${number}%`];
}

export interface CueNode {
	startTime: number;
	endTime: number;
	id?: string;
	styles?: any /** @TODO parse them */;
	region?: Region;
	entities?: Entity[];
	content: string;
	attributes?: any /** @TODO attributes are generic cue attributes, but we miss a shared format yet */;
}
