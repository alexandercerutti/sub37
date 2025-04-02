import { EntityProtocol, Type } from "./index.js";

/**
 * TagType includes only the common tag types that
 * could or will show in adapters.
 *
 * If missing, "span" should be used.
 */

export enum TagType {
	SPAN /********/ = "span",
	RUBY /********/ = "ruby",
	RT /**********/ = "rt",
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
