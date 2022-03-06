import { CueNode, Entity } from "@hsubs/server";
import { Token } from "../Token.js";

export enum VTTEntities {
	VOICE /*******/ = 0b00000001,
	LANG /********/ = 0b00000010,
	RUBY /********/ = 0b00000100,
	RT /**********/ = 0b00001000,
	CLASS /*******/ = 0b00010000,
	BOLD /********/ = 0b00100000,
	ITALIC /******/ = 0b01000000,
	UNDERLINE /***/ = 0b10000000,
}

export interface OpenTag {
	/** Zero-based position of cue (or timestamp section) content */
	index: number;
	token: Token;
}

const EntitiesTokenMap: { [key: string]: VTTEntities } = {
	v: VTTEntities.VOICE,
	lang: VTTEntities.LANG,
	ruby: VTTEntities.RUBY,
	rt: VTTEntities.RT,
	c: VTTEntities.CLASS,
	b: VTTEntities.BOLD,
	i: VTTEntities.ITALIC,
	u: VTTEntities.UNDERLINE,
};

export function isSupported(content: string): boolean {
	return Boolean(EntitiesTokenMap[content]);
}

export function completeMissing(openTags: OpenTag[], currentCue: CueNode): Entity[] {
	return openTags.reduce<Entity[]>((acc, tag) => {
		if (currentCue.content.length - tag.index === 0) {
			/**
			 * If an entity startTag is placed between two timestamps
			 * the closing timestamp should not have the new tag associated.
			 * tag.index is zero-based.
			 */

			return acc;
		}

		const entity = createEntity(currentCue, tag);

		return [...acc, entity];
	}, []);
}

export function createEntity(currentCue: CueNode, tagStart: OpenTag): Entity {
	/**
	 * If length is negative, that means that the tag was opened before
	 * the beginning of the current Cue. Therefore, offset should represent
	 * the beginning of the **current cue** and the length should be set to
	 * current cue content.
	 */

	const tagOpenedInCurrentCue = currentCue.content.length - tagStart.index > 0;

	return {
		offset: tagOpenedInCurrentCue ? tagStart.index : 0,
		length: tagOpenedInCurrentCue
			? currentCue.content.length - tagStart.index
			: currentCue.content.length,
		attributes: tagStart.token.annotations ?? [],
		type: EntitiesTokenMap[tagStart.token.content],
	};
}
