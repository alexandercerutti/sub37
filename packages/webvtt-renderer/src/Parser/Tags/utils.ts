import { CueNode, Entity } from "@hsubs/server";
import Node from "./Node";
import NodeTree from "./NodesTree";
import { EntitiesTokenMap } from "./tokenEntities";

export function isSupported(content: string): boolean {
	return Boolean(EntitiesTokenMap[content]);
}

/**
 * Creates entities from tree entities that have not been popped
 * out yet, without removing them from the tree
 *
 * @param openTagsTree
 * @param currentCue
 * @returns
 */

export function createEntitiesFromUnpaired(openTagsTree: NodeTree, currentCue: CueNode): Entity[] {
	let nodeCursor: Node = openTagsTree.current;

	if (!nodeCursor) {
		return [];
	}

	const entities: Entity[] = [];

	while (nodeCursor !== null) {
		if (currentCue.content.length - nodeCursor.index !== 0) {
			/**
			 * If an entity startTag is placed between two timestamps
			 * the closing timestamp should not have the new tag associated.
			 * tag.index is zero-based.
			 */

			entities.push(createEntity(currentCue, nodeCursor));
		}

		nodeCursor = nodeCursor.parent;
	}

	return entities;
}

export function createEntity(currentCue: CueNode, tagStart: Node): Entity {
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
