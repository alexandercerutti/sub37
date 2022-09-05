import { Entities } from "@hsubs/server";
import type { CueParsedData } from "../CueNode.js";
import Node from "./Node.js";
import NodeTree from "./NodesTree.js";
import { EntitiesTokenMap } from "./tokenEntities.js";

export function isSupported(content: string): boolean {
	return EntitiesTokenMap.hasOwnProperty(content);
}

/**
 * Creates entities from tree entities that have not been popped
 * out yet, without removing them from the tree
 *
 * @param openTagsTree
 * @param currentCue
 * @returns
 */

export function createTagEntitiesFromUnpaired(
	openTagsTree: NodeTree,
	currentCue: CueParsedData,
): Entities.Tag[] {
	let nodeCursor: Node = openTagsTree.current;

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
