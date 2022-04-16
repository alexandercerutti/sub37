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

	/**
	 * Describes how new cues should appear if others are
	 * still visible or should disappear soon.
	 *
	 * - Push bottom to up, for roll-up captions
	 * - Replace current cue. Default, for pop-on captions
	 *
	 * Paint-on is achieved by printing one word per time
	 *
	 * Default: "replace"
	 */
	displayStrategy?: "push" | "replace";

	/**
	 * (X, Y) of the region relative to root container
	 * Equivalent to VTT `viewportAnchor` and TTML `tts:origin`
	 */

	origin?: [`${number}%`, `${number}%`];

	// regionanchor?: [`${number}%`, `${number}%`]; // Is there something like this in other systems outside VTT?
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
