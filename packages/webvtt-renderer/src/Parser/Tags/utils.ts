import type { Entity, EntityType, TagType } from "@hsubs/server";
import type { CueParsedData } from "../CueNode.js";
import Node from "./Node.js";
import NodeTree from "./NodesTree.js";
import { EntitiesTokenMap } from "./tokenEntities.js";

type TagEntityValues = Pick<Entity & { type: EntityType.TAG }, "attributes" | "length" | "offset">;
export type TagEntityEntry = [TagType?, TagEntityValues?];
export type TagEntityMap = Map<TagType, TagEntityValues[]>;

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
): TagEntityEntry[] {
	let nodeCursor: Node = openTagsTree.current;

	if (!nodeCursor) {
		return [];
	}

	const entities: TagEntityEntry[] = [];

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

export function createTagEntity(currentCue: CueParsedData, tagStart: Node): TagEntityEntry {
	/**
	 * If length is negative, that means that the tag was opened before
	 * the beginning of the current Cue. Therefore, offset should represent
	 * the beginning of the **current cue** and the length should be set to
	 * current cue content.
	 */

	const tagOpenedInCurrentCue = currentCue.text.length - tagStart.index > 0;

	return [
		EntitiesTokenMap[tagStart.token.content],
		{
			offset: tagOpenedInCurrentCue ? tagStart.index : 0,
			length: tagOpenedInCurrentCue
				? currentCue.text.length - tagStart.index
				: currentCue.text.length,
			attributes: tagStart.token.annotations ?? [],
		},
	];
}
