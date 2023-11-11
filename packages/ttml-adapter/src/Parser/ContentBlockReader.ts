import { Token } from "./Token";
import { TokenType } from "./Token.js";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";
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

enum NodeAttributes {
	NO_ATTRS /*********/ = 0b000000,
	IGNORED /*********/ = 0b000001,
	GROUP_TRACKED /***/ = 0b000010,
	PRE_EMITTED /*****/ = 0b000100,
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

const nodeAttributesSymbol = Symbol("nodeAttributesSymbol");

interface NodeWithAttributes {
	[nodeAttributesSymbol]: NodeAttributes;
}

export function* getNextContentBlock(tokenizer: Tokenizer): Iterator<BlockTuple, null, BlockTuple> {
	const nodeTree = new NodeTree<Token & NodeWithAttributes>();
	const relationshipTree = new RelationshipTree();

	let token: Token;

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.TAG: {
				if (!nodeTree.currentNode || isNodeIgnored(nodeTree.currentNode.content)) {
					continue;
				}

				if (
					relationshipTree.currentNode.parent &&
					!relationshipTree.currentNode.has(token.content)
				) {
					break;
				}

				let trackedNode: NodeWithRelationship<Token & NodeWithAttributes>;

				if (isTokenAllowedToGroupTrack(token)) {
					trackedNode = nodeTree.track(
						createNodeWithAttributes(token, NodeAttributes.GROUP_TRACKED),
					);
				} else {
					trackedNode = nodeTree.track(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));
				}

				if (
					isTokenAllowedToGroupTrack(token) &&
					nodeTree.currentNode &&
					!isNodeGroupTracked(nodeTree.currentNode.content)
				) {
					yield [BlockType.SELFCLOSING, trackedNode];
					continue;
				}

				break;
			}

			case TokenType.STRING: {
				if (!nodeTree.currentNode) {
					continue;
				}

				nodeTree.track(createNodeWithAttributes(token, NodeAttributes.GROUP_TRACKED));
				break;
			}

			case TokenType.START_TAG: {
				if (nodeTree.currentNode && isNodeIgnored(nodeTree.currentNode.content)) {
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

					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.IGNORED));
					continue;
				}

				if (isBlockClassElement(token) && !isNodePreEmitted(nodeTree.currentNode.content)) {
					const { content: lastToken } = nodeTree.currentNode;
					const { content: tagName, attributes } = lastToken;

					if (tagName === "div" || tagName === "body") {
						makeNodePreEmitted(nodeTree.currentNode.content);

						if (Object.keys(attributes).length) {
							yield [BlockType.CONTENT_ELEMENT, nodeTree.currentNode];
						}
					}
				}

				relationshipTree.setCurrent(relationshipTree.currentNode.get(token.content));

				if (isTokenAllowedToGroupTrack(token)) {
					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.GROUP_TRACKED));
				} else {
					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));
				}

				if (token.content === "tt") {
					makeNodePreEmitted(nodeTree.currentNode.content);

					yield [BlockType.DOCUMENT, nodeTree.currentNode];
					continue;
				}

				break;
			}

			case TokenType.END_TAG: {
				if (!nodeTree.currentNode) {
					continue;
				}

				if (nodeTree.currentNode.content.content !== token.content) {
					continue;
				}

				if (
					isNodeIgnored(nodeTree.currentNode.content) ||
					isNodePreEmitted(nodeTree.currentNode.content)
				) {
					nodeTree.pop();
					break;
				}

				relationshipTree.ascend();

				if (
					isTokenAllowedToGroupTrack(token) &&
					!isNodeGroupTracked(nodeTree.currentNode.parent.content)
				) {
					const blockType: BlockTuple[0] = BlockTupleMap.get(nodeTree.currentNode.content.content);

					yield [blockType, nodeTree.pop()];
					break;
				}

				nodeTree.pop();
				break;
			}
		}
	}

	return null;
}

const GROUP_TRACKING_ALLOWED_ELEMENTS = ["p", "span", "layout", "styling"] as const;
type GROUP_TRACKING_ALLOWED_ELEMENTS = typeof GROUP_TRACKING_ALLOWED_ELEMENTS;

function isTokenAllowedToGroupTrack(token: Token): boolean {
	return GROUP_TRACKING_ALLOWED_ELEMENTS.includes(
		token.content as GROUP_TRACKING_ALLOWED_ELEMENTS[number],
	);
}

function isNodeIgnored(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.IGNORED } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.IGNORED);
}

function isNodeGroupTracked(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.GROUP_TRACKED } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.GROUP_TRACKED);
}

function isNodePreEmitted(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.PRE_EMITTED } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.PRE_EMITTED);
}

function createNodeWithAttributes<NodeType extends object>(
	node: NodeType,
	attributes: NodeAttributes,
): NodeType & NodeWithAttributes {
	return Object.create(node, {
		[nodeAttributesSymbol]: {
			value: attributes,
			writable: true,
		},
	});
}

function makeNodePreEmitted(node: NodeWithAttributes) {
	node[nodeAttributesSymbol] = node[nodeAttributesSymbol] | NodeAttributes.PRE_EMITTED;
}
