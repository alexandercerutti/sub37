import { Token } from "./Token";
import { TokenType } from "./Token.js";
import type { Node } from "./Tags/Node";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";
import { TrackingTree } from "./Tags/TrackingTree.js";

export enum BlockType {
	DOCUMENT /******/ = 0b0000001,
	HEADER /********/ = 0b0000010,
	REGION /********/ = 0b0000100,
	STYLE /*********/ = 0b0001000,
	CUE /***********/ = 0b0010000,
	GROUP /*********/ = 0b0100000,
	SELFCLOSING /***/ = 0b1000000,
}

type DocumentBlockTuple = [blockType: BlockType.DOCUMENT, payload: NodeWithRelationship<Token>];

type CueBlockTuple = [blockType: BlockType.CUE, payload: NodeWithRelationship<Token>];

type RegionBlockTuple = [blockType: BlockType.REGION, payload: NodeWithRelationship<Token>];

type StyleBlockTuple = [blockType: BlockType.STYLE, payload: NodeWithRelationship<Token>];

type SelfClosingBlockTuple = [
	BlockTuple: BlockType.SELFCLOSING,
	payload: NodeWithRelationship<Token>,
];

type GroupBlockTuple = [blockType: BlockType.GROUP, payload: NodeWithRelationship<Token>];

type BlockTuple =
	| DocumentBlockTuple
	| CueBlockTuple
	| RegionBlockTuple
	| StyleBlockTuple
	| GroupBlockTuple
	| SelfClosingBlockTuple;

const BlockTupleMap = new Map<string, BlockTuple[0]>([
	["tt", BlockType.DOCUMENT],
	["body", BlockType.GROUP],
	["div", BlockType.GROUP],
	["layout", BlockType.REGION],
	["styling", BlockType.STYLE],
	["p", BlockType.CUE],
	["span", BlockType.CUE],
]);

const ignoredBlockSymbol = Symbol("ignoredBlock");

interface IgnoredNode {
	[ignoredBlockSymbol]: true;
}

export function* getNextContentBlock(tokenizer: Tokenizer): Iterator<BlockTuple, null, BlockTuple> {
	const trackingTree = new TrackingTree<Token>();

	let token: Token;

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.TAG: {
				if (trackingTree.currentNode && isTokenIgnored(trackingTree.currentNode.content)) {
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

				if (!isTokenParentRelationshipRespected(token, trackingTree)) {
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
						if (Object.entries(token.attributes).length) {
							yield [BlockType.GROUP, NodeTree.createNodeWithRelationshipShell(token, null)];
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

function isTokenIgnored(node: Token | IgnoredNode): node is IgnoredNode {
	return Boolean((node as IgnoredNode)[ignoredBlockSymbol]);
}
