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
): Entities.TagEntity[] {
	let nodeCursor: Node = openTagsQueue.current;

	if (!nodeCursor) {
		return [];
	}

	const entities: Entities.TagEntity[] = [];

	while (nodeCursor !== null) {
		const entity = createTagEntity(currentCue, nodeCursor);

		if (!currentCue.tags.length || !currentCue.tags.find((e) => e.tagType === entity.tagType)) {
			entities.unshift(entity);
		}

		nodeCursor = nodeCursor.parent;
	}

	return entities;
}

export function createTagEntity(currentCue: CueParsedData, tagStart: Node): Entities.TagEntity {
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

	return Entities.createTagEntity(
		EntitiesTokenMap[tagStart.token.content],
		attributes,
		tagStart.token.classes,
	);
}
