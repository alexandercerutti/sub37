/**
 * This object overrides and contains
 * the original "@sub37/server" tag entity in order
 * to add properties without altering the original
 * object. This is needed for a matter of tag matching
 * with styles
 */

import { Entities } from "@sub37/server";

const WebVTTEntities = {
	b: Entities.TagType.BOLD,
	i: Entities.TagType.ITALIC,
	span: Entities.TagType.SPAN,
	rt: Entities.TagType.RT,
	ruby: Entities.TagType.RUBY,
	u: Entities.TagType.UNDERLINE,

	/**
	 * Custom for WebVTT. They are remapped to
	 * span for the renderer
	 */
	lang: Entities.TagType.SPAN,
	v: Entities.TagType.SPAN,
	c: Entities.TagType.SPAN,
} as const;

function isWebVTTEntityRecognized(tagType: string): tagType is keyof typeof WebVTTEntities {
	return WebVTTEntities.hasOwnProperty(tagType);
}

export function createTagEntity(
	tagType: string,
	attributes: Map<string, string | undefined>,
	classes: string[] = [],
): Entities.TagEntity {
	const originalTagType = isWebVTTEntityRecognized(tagType)
		? WebVTTEntities[tagType]
		: Entities.TagType.SPAN;

	const originalEntity = Entities.createTagEntity(originalTagType, attributes, classes);

	return Object.create(originalEntity, {
		type: {
			value: Entities.Type.TAG,
		},
		tagType: {
			value: tagType,
		},
		attributes: {
			value: attributes,
		},
		classes: {
			value: classes,
		},
	});
}
