import { Entities } from "@sub37/server";
import { EntitiesTokenMap } from "./tokenEntities.js";
import type { CueParsedData } from "../parseCue.js";
import type Node from "./Node.js";
import type NodeQueue from "./NodeQueue.js";

export function isSupported(content: string): boolean {
	return EntitiesTokenMap.hasOwnProperty(content);
}

/**
 * Creates entities from tree entities that have not been popped
 * out yet, without removing them from the tree
 *
 * @param openTagsQueue
 * @param currentCue
 * @returns
 */

export function createTagEntitiesFromUnpaired(
	openTagsQueue: NodeQueue,
	currentCue: CueParsedData,
): Entities.Tag[] {
	let nodeCursor: Node = openTagsQueue.current;

	if (!nodeCursor) {
		return [];
	}

	const entities: Entities.Tag[] = [];

	while (nodeCursor !== null) {
		if (currentCue.text.length - nodeCursor.index !== 0) {
			/**
			 * If an entity startTag is placed between two timestamps
			 * the closing timestamp should not have the new tag associated.
			 * tag.index is zero-based.
			 */

			entities.push(createTagEntity(currentCue, nodeCursor));
		}

		nodeCursor = nodeCursor.parent;
	}

	return entities;
}

export function createTagEntity(currentCue: CueParsedData, tagStart: Node): Entities.Tag {
	/**
	 * If length is negative, that means that the tag was opened before
	 * the beginning of the current Cue. Therefore, offset should represent
	 * the beginning of the **current cue** and the length should be set to
	 * current cue content.
	 */

	const tagOpenedInCurrentCue = currentCue.text.length - tagStart.index > 0;

	const attributes = new Map(
		tagStart.token.annotations?.map((annotation) => {
			if (tagStart.token.content === "lang") {
				return ["lang", annotation];
			}

			if (tagStart.token.content === "v") {
				return ["voice", annotation];
			}

			const attribute = annotation.split("=");
			return [attribute[0], attribute[1]?.replace(/["']/g, "")];
		}),
	);

	return new Entities.Tag({
		tagType: EntitiesTokenMap[tagStart.token.content],
		offset: tagOpenedInCurrentCue ? tagStart.index : 0,
		length: tagOpenedInCurrentCue
			? currentCue.text.length - tagStart.index
			: currentCue.text.length,
		attributes,
		classes: tagStart.token.classes,
	});
}
