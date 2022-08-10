export interface RawTrack {
	lang: string;
	content: unknown;
}

export const enum EntityType {
	STYLE,
	TAG,
}

/**
 * TagType is an enum containing
 * recognized types in renderers
 * like vtt
 */

export enum TagType {
	VOICE /*******/ = 0b00000001,
	LANG /********/ = 0b00000010,
	RUBY /********/ = 0b00000100,
	RT /**********/ = 0b00001000,
	CLASS /*******/ = 0b00010000,
	BOLD /********/ = 0b00100000,
	ITALIC /******/ = 0b01000000,
	UNDERLINE /***/ = 0b10000000,
}

export type Entity = {
	/** zero-based shift based on cue begin, from which the entity will begin */
	offset: number;
	/** one-based content length in entity */
	length: number;
} & (
	| {
			type: EntityType.STYLE;
			styles: { [key: string]: string | number } | string /** @TODO choose one of the two */;
	  }
	| {
			type: EntityType.TAG;
			tagType: TagType;
			attributes: Map<string, string>;
	  }
);

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
	 *
	 * @TODO implement support
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
	id: string;
	region?: Region;
	entities: Entity[];
	content: string;
	attributes?: any /** @TODO attributes are generic cue attributes, but we miss a shared format yet */;
}
