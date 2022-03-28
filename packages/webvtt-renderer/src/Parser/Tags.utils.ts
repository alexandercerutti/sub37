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

export class NodeTree {
	private root: Node = null;

	public get current() {
		return this.root;
	}

	public get length() {
		let thisNode: Node = this.root;

		if (!thisNode) {
			return 0;
		}

		let length = 1;
		while (thisNode.parent !== null) {
			length++;
			thisNode = thisNode.parent;
		}

		return length;
	}

	public push(node: Node) {
		if (!this.root) {
			this.root = node;
			return;
		}

		node.parent = this.root;
		this.root = node;
	}

	public pop() {
		if (!this.root) {
			return;
		}

		const out = this.root;
		this.root = this.root.parent;
		return out;
	}
}

export class Node {
	public parent: Node = null;

	constructor(
		/** Zero-based position of cue (or timestamp section) content */
		public index: number,
		public token: Token,
	) {}
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
