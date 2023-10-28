import { Token } from "./Token";
import { TokenType } from "./Token.js";
import type { Node } from "./Tags/Node";
import { NodeQueue } from "./Tags/NodeQueue.js";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";

export enum BlockType {
	IGNORED /****/ = 0b00000001,
	DOCUMENT /***/ = 0b00000010,
	HEADER /*****/ = 0b00000100,
	BODY /*******/ = 0b00001000,
	REGION /*****/ = 0b00010000,
	STYLE /******/ = 0b00100000,
	CUE /********/ = 0b01000000,
	GROUP /******/ = 0b10000000,
}

type DocumentBlockTuple = [blockType: BlockType.DOCUMENT, payload: NodeWithRelationship<Token>];

type CueBlockTuple = [blockType: BlockType.CUE, payload: NodeWithRelationship<Token>];

type HeaderBlockTuple = [blockType: BlockType.HEADER, payload: NodeWithRelationship<Token>];

type RegionBlockTuple = [blockType: BlockType.REGION, payload: NodeWithRelationship<Token>];

type StyleBlockTuple = [blockType: BlockType.STYLE, payload: NodeWithRelationship<Token>];

type GroupBlockTuple = [blockType: BlockType.GROUP, payload: NodeWithRelationship<Token>];

type IgnoredBlockTuple = [blockType: BlockType.IGNORED, payload: undefined];

type BlockTuple =
	| DocumentBlockTuple
	| CueBlockTuple
	| HeaderBlockTuple
	| RegionBlockTuple
	| StyleBlockTuple
	| GroupBlockTuple
	| IgnoredBlockTuple;

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
	const openTagsList = new NodeQueue<Token>();
	let openTagsTree: NodeTree<Token> | null = null;

	let currentBlockType: BlockType = BlockType.DOCUMENT;
	let token: Token;

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.TAG: {
				if (currentBlockType & BlockType.IGNORED) {
					continue;
				}

				if (!isTokenParentRelationshipRespected(token, openTagsList)) {
					break;
				}

				if (shouldTokenCreateNodeTree(token) && !openTagsTree) {
					openTagsTree = new NodeTree();
				}

				if (openTagsTree) {
					openTagsTree.track(token);
				}

				break;
			}

			case TokenType.START_TAG: {
				if (currentBlockType & BlockType.IGNORED) {
					continue;
				}

				const nodeRepresentation: Node<Token> = {
					content: token,
				};

				if (shouldTokenCreateNodeTree(token) && !openTagsTree) {
					openTagsTree = new NodeTree();
				}

				if (!isTokenParentRelationshipRespected(token, openTagsList)) {
					/**
					 * Even if token does not respect it parent relatioship,
					 * we still add it to the queue to mark its end later.
					 *
					 * We don't want to track it inside the tree, instead,
					 * because we are going to ignore it.
					 */

					currentBlockType ^= BlockType.IGNORED;
					openTagsList.push(nodeRepresentation);
					continue;
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

				if (openTagsTree) {
					openTagsTree.push(token);
				} else {
					openTagsList.push(nodeRepresentation);
				}

				break;
			}

			case TokenType.END_TAG: {
				if (!openTagsList.length) {
					continue;
				}

				if (openTagsList.current.content.content !== token.content) {
					continue;
				}

				if (currentBlockType & BlockType.IGNORED) {
					currentBlockType ^= BlockType.IGNORED;
					openTagsList.pop();

					break;
				}

				if (shouldTokenCreateNodeTree(token) && !openTagsTree?.parentNode) {
					const blockType: BlockTuple[0] = BlockTupleMap.get(
						openTagsTree.currentNode.content.content,
					);

					if (blockType !== BlockType.IGNORED) {
						yield [blockType, openTagsTree.pop()];
					}

					openTagsTree = null;
					break;
				}

				if (openTagsTree) {
					openTagsTree.pop();
				} else {
					openTagsList.pop();
				}

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

function isTokenParentRelationshipRespected(
	token: Token,
	openTagsQueue: NodeQueue<Token>,
): boolean {
	const { content } = token;

	if (!isTokenTreeConstrained(content)) {
		return true;
	}

	if (!openTagsQueue.current) {
		return true;
	}

	const treeNode: Node<Token> = openTagsQueue.current;

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

function shouldTokenCreateNodeTree(token: Token): boolean {
	return NODE_TREE_ALLOWED_ELEMENTS.includes(token.content as NODE_TREE_ALLOWED_ELEMENTS[number]);
}
