import { Token } from "./Token";
import { TokenType } from "./Token.js";
import type { Node } from "./Tags/Node";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";
import { TrackingTree } from "./Tags/TrackingTree.js";

export enum BlockType {
	IGNORED /*******/ = 0b000000001,
	DOCUMENT /******/ = 0b000000010,
	HEADER /********/ = 0b000000100,
	BODY /**********/ = 0b000001000,
	REGION /********/ = 0b000010000,
	STYLE /*********/ = 0b000100000,
	CUE /***********/ = 0b001000000,
	GROUP /*********/ = 0b010000000,
	SELFCLOSING /***/ = 0b100000000,
}

type DocumentBlockTuple = [blockType: BlockType.DOCUMENT, payload: NodeWithRelationship<Token>];

type CueBlockTuple = [blockType: BlockType.CUE, payload: NodeWithRelationship<Token>];

type HeaderBlockTuple = [blockType: BlockType.HEADER, payload: NodeWithRelationship<Token>];

type RegionBlockTuple = [blockType: BlockType.REGION, payload: NodeWithRelationship<Token>];

type StyleBlockTuple = [blockType: BlockType.STYLE, payload: NodeWithRelationship<Token>];

type SelfClosingBlockTuple = [
	BlockTuple: BlockType.SELFCLOSING,
	payload: NodeWithRelationship<Token>,
];

type GroupBlockTuple = [blockType: BlockType.GROUP, payload: NodeWithRelationship<Token>];

type IgnoredBlockTuple = [blockType: BlockType.IGNORED, payload: undefined];

type BlockTuple =
	| DocumentBlockTuple
	| CueBlockTuple
	| HeaderBlockTuple
	| RegionBlockTuple
	| StyleBlockTuple
	| GroupBlockTuple
	| IgnoredBlockTuple
	| SelfClosingBlockTuple;

const BlockTupleMap = new Map<string, BlockTuple[0]>([
	["tt", BlockType.DOCUMENT],
	["head", BlockType.HEADER],
	["body", BlockType.GROUP],
	["div", BlockType.GROUP],
	["layout", BlockType.REGION],
	["styling", BlockType.STYLE],
	["p", BlockType.CUE],
	["span", BlockType.CUE],
]);

export function* getNextContentBlock(tokenizer: Tokenizer): Iterator<BlockTuple, null, BlockTuple> {
	const trackingTree = new TrackingTree<Token>();

	let currentBlockType: BlockType = BlockType.DOCUMENT;
	let token: Token;

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.TAG: {
				if (currentBlockType & BlockType.IGNORED) {
					continue;
				}

				if (!isTokenParentRelationshipRespected(token, trackingTree)) {
					break;
				}

				if (
					shouldTokenBeTracked(token) &&
					trackingTree.currentNode &&
					!TrackingTree.isTracked(trackingTree.currentNode.content)
				) {
					yield [
						BlockType.SELFCLOSING,
						NodeTree.createNodeWithRelationshipShell(token, trackingTree.currentNode),
					];
					continue;
				}

				if (shouldTokenBeTracked(token)) {
					trackingTree.addTrackedNode(token);
				} else {
					trackingTree.addUntrackedNode(token);
				}

				// As this the parent is tracked, we should only ascend the list.
				trackingTree.pop();

				break;
			}

			case TokenType.START_TAG: {
				if (currentBlockType & BlockType.IGNORED) {
					continue;
				}

				if (!isTokenParentRelationshipRespected(token, trackingTree)) {
					/**
					 * Even if token does not respect it parent relatioship,
					 * we still add it to the queue to mark its end later.
					 *
					 * We don't want to track it inside the tree, instead,
					 * because we are going to ignore it.
					 */

					currentBlockType ^= BlockType.IGNORED;

					trackingTree.addUntrackedNode(token);

					continue;
				}

				if (shouldTokenBeTracked(token)) {
					trackingTree.addTrackedNode(token);
				} else {
					trackingTree.addUntrackedNode(token);
				}

				switch (token.content) {
					case "tt": {
						yield [BlockType.DOCUMENT, NodeTree.createNodeWithRelationshipShell(token, null)];
						continue;
					}

					case "div": {
						if (Object.entries(token.attributes).length) {
							yield [BlockType.GROUP, NodeTree.createNodeWithRelationshipShell(token, null)];
						}

						continue;
					}

					case "body": {
						currentBlockType = BlockType.BODY;

						if (Object.entries(token.attributes).length) {
							yield [BlockType.GROUP, NodeTree.createNodeWithRelationshipShell(token, null)];
						}

						continue;
					}

					case "head": {
						currentBlockType = BlockType.HEADER;
						break;
					}
				}

				break;
			}

			case TokenType.END_TAG: {
				// if (!tr.length) {
				// 	continue;
				// }

				if (trackingTree.currentNode.content.content !== token.content) {
					continue;
				}

				if (currentBlockType & BlockType.IGNORED) {
					currentBlockType ^= BlockType.IGNORED;
					openTagsList.pop();

					break;
				}

				if (
					shouldTokenBeTracked(token) &&
					!TrackingTree.isTracked(trackingTree.currentNode.parent.content)
				) {
					const blockType: BlockTuple[0] = BlockTupleMap.get(
						trackingTree.currentNode.content.content,
					);

					if (blockType !== BlockType.IGNORED) {
						yield [blockType, trackingTree.pop()];
					}

					break;
				}

				trackingTree.pop();
				break;
			}
		}
	}

	return null;
}

function isTokenTreeConstrained(content: string): content is keyof typeof TokenRelationships {
	return Object.prototype.hasOwnProperty.call(TokenRelationships, content);
}

const TokenRelationships = {
	region: ["layout"],
	style: ["styling", "region"],
	layout: ["head"],
	styling: ["head"],
	head: ["tt"],
	body: ["tt"],
	div: ["body"],
	span: ["span", "p"],
	p: ["div", "body"],
} as const;

function isTokenParentRelationshipRespected(token: Token, tagsTree: TrackingTree<Token>): boolean {
	const { content } = token;

	if (!isTokenTreeConstrained(content)) {
		return true;
	}

	if (!tagsTree.currentNode) {
		return true;
	}

	const treeNode: Node<Token> = tagsTree.currentNode;

	/**
	 * If we already reached the point of checking if a tag
	 * is in a parent, then we don't need to check the others
	 */
	for (const direction of TokenRelationships[content]) {
		if (treeNode.content.content === direction) {
			return true;
		}
	}

	return false;
}

const NODE_TREE_ALLOWED_ELEMENTS = ["p", "span", "layout", "styling"] as const;
type NODE_TREE_ALLOWED_ELEMENTS = typeof NODE_TREE_ALLOWED_ELEMENTS;

function shouldTokenBeTracked(token: Token): boolean {
	return NODE_TREE_ALLOWED_ELEMENTS.includes(token.content as NODE_TREE_ALLOWED_ELEMENTS[number]);
}
