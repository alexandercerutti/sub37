import { Token } from "./Token";
import { TokenType } from "./Token.js";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";
import { TrackingTree } from "./Tags/TrackingTree.js";
import { RelationshipTree } from "./Tags/RelationshipTree.js";

export enum BlockType {
	DOCUMENT /**********/ = 0b0000001,
	HEADER /************/ = 0b0000010,
	REGION /************/ = 0b0000100,
	STYLE /*************/ = 0b0001000,
	CUE /***************/ = 0b0010000,
	CONTENT_ELEMENT /***/ = 0b0100000,
	SELFCLOSING /*******/ = 0b1000000,
}

export type DocumentBlockTuple = [
	blockType: BlockType.DOCUMENT,
	payload: NodeWithRelationship<Token>,
];

export type CueBlockTuple = [blockType: BlockType.CUE, payload: NodeWithRelationship<Token>];

export type RegionBlockTuple = [blockType: BlockType.REGION, payload: NodeWithRelationship<Token>];

export type StyleBlockTuple = [blockType: BlockType.STYLE, payload: NodeWithRelationship<Token>];

export type SelfClosingBlockTuple = [
	BlockTuple: BlockType.SELFCLOSING,
	payload: NodeWithRelationship<Token>,
];

export type ContentElementBlockTuple = [
	blockType: BlockType.CONTENT_ELEMENT,
	payload: NodeWithRelationship<Token>,
];

export type BlockTuple =
	| DocumentBlockTuple
	| CueBlockTuple
	| RegionBlockTuple
	| StyleBlockTuple
	| ContentElementBlockTuple
	| SelfClosingBlockTuple;

const BlockTupleMap = new Map<string, BlockTuple[0]>([
	["tt", BlockType.DOCUMENT],
	["body", BlockType.CONTENT_ELEMENT],
	["div", BlockType.CONTENT_ELEMENT],
	["layout", BlockType.REGION],
	["styling", BlockType.STYLE],
	["p", BlockType.CUE],
	["span", BlockType.CUE],
]);

export function isDocumentBlockTuple(block: BlockTuple): block is DocumentBlockTuple {
	return block[0] === BlockType.DOCUMENT;
}

export function isCueBlockTuple(block: BlockTuple): block is CueBlockTuple {
	return block[0] === BlockType.CUE;
}

export function isRegionBlockTuple(block: BlockTuple): block is RegionBlockTuple {
	return block[0] === BlockType.REGION;
}

export function isStyleBlockTuple(block: BlockTuple): block is StyleBlockTuple {
	return block[0] === BlockType.STYLE;
}

export function isContentElementBlockTuple(block: BlockTuple): block is ContentElementBlockTuple {
	return block[0] === BlockType.CONTENT_ELEMENT;
}

export function isSelfClosingBlockTuple(block: BlockTuple): block is SelfClosingBlockTuple {
	return block[0] === BlockType.SELFCLOSING;
}

const ignoredBlockSymbol = Symbol("ignoredBlock");

interface IgnoredNode {
	[ignoredBlockSymbol]: true;
}

export function* getNextContentBlock(tokenizer: Tokenizer): Iterator<BlockTuple, null, BlockTuple> {
	const trackingTree = new TrackingTree<Token>();
	const relationshipTree = new RelationshipTree();

	let token: Token;

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.TAG: {
				if (trackingTree.currentNode && isTokenIgnored(trackingTree.currentNode.content)) {
					continue;
				}

				if (
					relationshipTree.currentNode.parent &&
					!relationshipTree.currentNode.has(token.content)
				) {
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

				trackingTree.ascendCurrentNode();
				break;
			}

			case TokenType.STRING: {
				if (!trackingTree.currentNode) {
					continue;
				}

				trackingTree.addTrackedNode(token);

				trackingTree.ascendCurrentNode();
				break;
			}

			case TokenType.START_TAG: {
				if (trackingTree.currentNode && isTokenIgnored(trackingTree.currentNode.content)) {
					continue;
				}

				if (
					relationshipTree.currentNode.parent &&
					!relationshipTree.currentNode.has(token.content)
				) {
					/**
					 * Even if token does not respect it parent relatioship,
					 * we still add it to the queue to mark its end later.
					 *
					 * We don't want to track it inside the tree, instead,
					 * because we are going to ignore it.
					 */

					trackingTree.addUntrackedNode(
						Object.create(token, {
							[ignoredBlockSymbol]: {
								value: true,
							},
						}),
					);

					continue;
				}

				relationshipTree.setCurrent(relationshipTree.currentNode.get(token.content));

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
							yield [
								BlockType.CONTENT_ELEMENT,
								NodeTree.createNodeWithRelationshipShell(token, null),
							];
						}

						continue;
					}

					case "body": {
						if (Object.entries(token.attributes).length) {
							yield [
								BlockType.CONTENT_ELEMENT,
								NodeTree.createNodeWithRelationshipShell(token, null),
							];
						}

						continue;
					}
				}

				break;
			}

			case TokenType.END_TAG: {
				if (!trackingTree.currentNode) {
					continue;
				}

				if (trackingTree.currentNode.content.content !== token.content) {
					continue;
				}

				if (isTokenIgnored(trackingTree.currentNode.content)) {
					trackingTree.pop();
					break;
				}

				relationshipTree.ascend();

				if (
					shouldTokenBeTracked(token) &&
					!TrackingTree.isTracked(trackingTree.currentNode.parent.content)
				) {
					const blockType: BlockTuple[0] = BlockTupleMap.get(
						trackingTree.currentNode.content.content,
					);

					yield [blockType, trackingTree.pop()];
					break;
				}

				trackingTree.pop();
				break;
			}
		}
	}

	return null;
}

const NODE_TREE_ALLOWED_ELEMENTS = ["p", "span", "layout", "styling"] as const;
type NODE_TREE_ALLOWED_ELEMENTS = typeof NODE_TREE_ALLOWED_ELEMENTS;

function shouldTokenBeTracked(token: Token): boolean {
	return NODE_TREE_ALLOWED_ELEMENTS.includes(token.content as NODE_TREE_ALLOWED_ELEMENTS[number]);
}

function isTokenIgnored(node: Token | IgnoredNode): node is IgnoredNode {
	return Boolean((node as IgnoredNode)[ignoredBlockSymbol]);
}
