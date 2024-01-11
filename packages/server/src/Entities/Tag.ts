import { EntityProtocol, Type } from "./index.js";

/**
 * TagType is an enum containing
 * recognized types in adapters
 * like vtt
 *
 * @TODO this enum should not include WebVTT-only element
 * like class, voice and lang
 */

export enum TagType {
	SPAN /********/ = "span",
	VOICE /*******/ = "v",
	LANG /********/ = "lang",
	RUBY /********/ = "ruby",
	RT /**********/ = "rt",
	CLASS /*******/ = "c",
	BOLD /********/ = "b",
	ITALIC /******/ = "i",
	UNDERLINE /***/ = "u",
}

export interface TagEntity extends EntityProtocol {
	type: Type.TAG;
	tagType: TagType;
	attributes: Map<string, string | undefined>;
	classes: string[];
}

export function createTagEntity(
	tagType: TagType,
	attributes: Map<string, string | undefined>,
	classes: string[] = [],
): TagEntity {
	return {
		type: Type.TAG,
		tagType,
		attributes,
		classes,
	};
}

export function isTagEntity(entity: EntityProtocol): entity is TagEntity {
	return entity.type === Type.TAG;
}
