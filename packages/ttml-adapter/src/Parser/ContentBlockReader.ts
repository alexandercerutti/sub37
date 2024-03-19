import { Token } from "./Token";
import { TokenType } from "./Token.js";
import { NodeTree, type NodeWithRelationship } from "./Tags/NodeTree.js";
import { Tokenizer } from "./Tokenizer.js";
import { RelationshipTree } from "./Tags/RelationshipTree.js";

export enum BlockType {
	DOCUMENT /**********/ = 0b0000001,
	HEADER /************/ = 0b0000010,
	LAYOUT /************/ = 0b0000100,
	STYLE /*************/ = 0b0001000,
	CUE /***************/ = 0b0010000,
	CONTENT_ELEMENT /***/ = 0b0100000,
	SELFCLOSING /*******/ = 0b1000000,
}

enum NodeAttributes {
	NO_ATTRS /********/ = 0b000000,
	IGNORED /*********/ = 0b000001,
	GROUP_TRACKED /***/ = 0b000010,
	PRE_EMITTABLE /***/ = 0b000100,
	PRE_EMITTED /*****/ = 0b001000,
}

export type DocumentBlockTuple = [
	blockType: BlockType.DOCUMENT,
	payload: NodeWithRelationship<Token>,
];

export type CueBlockTuple = [blockType: BlockType.CUE, payload: NodeWithRelationship<Token>];

export type LayoutBlockTuple = [blockType: BlockType.LAYOUT, payload: NodeWithRelationship<Token>];

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
	| LayoutBlockTuple
	| StyleBlockTuple
	| ContentElementBlockTuple
	| SelfClosingBlockTuple;

const BlockTupleMap = new Map<string, BlockTuple[0]>([
	["tt", BlockType.DOCUMENT],
	["body", BlockType.CONTENT_ELEMENT],
	["div", BlockType.CONTENT_ELEMENT],
	["layout", BlockType.LAYOUT],
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

export function isLayoutBlockTuple(block: BlockTuple): block is LayoutBlockTuple {
	return block[0] === BlockType.LAYOUT;
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

				const relDescriptor = relationshipTree.getDirectionDescriptor(token.content);

				if (!relDescriptor) {
					break;
				}

				if (isBlockClassElement(token) && isNodePreEmittable(nodeTree.currentNode.content)) {
					setNodePreEmitted(nodeTree.currentNode.content);

					/**
					 * Emitting the current node before everything else in this round. We might want to
					 * check if this is a "div" or a "body" and act in a different way for other elements,
					 * if we'll introduce some more PreEmittable nodes.
					 */
					yield [BlockType.CONTENT_ELEMENT, nodeTree.currentNode];
				}

				let trackedNode: NodeWithRelationship<Token & NodeWithAttributes> = nodeTree.track(
					createNodeWithAttributes(token, NodeAttributes.NO_ATTRS),
				);

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

				if (isNodeIgnored(nodeTree.currentNode.content)) {
					break;
				}

				nodeTree.track(createNodeWithAttributes(token, NodeAttributes.GROUP_TRACKED));
				break;
			}

			case TokenType.START_TAG: {
				if (nodeTree.currentNode && isNodeIgnored(nodeTree.currentNode.content)) {
					continue;
				}

				const relDescriptor = relationshipTree.getDirectionDescriptor(token.content);

				if (!relDescriptor) {
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

				relDescriptor.navigate();

				if (token.content === "tt") {
					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.PRE_EMITTED));
					yield [BlockType.DOCUMENT, nodeTree.currentNode];
					continue;
				}

				if (token.content === "div" || token.content === "body") {
					if (isNodePreEmittable(nodeTree.currentNode.content)) {
						// Pre emitting the previous one before adding another one
						setNodePreEmitted(nodeTree.currentNode.content);
						yield [BlockType.CONTENT_ELEMENT, nodeTree.currentNode];
					}

					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.PRE_EMITTABLE));

					continue;
				}

				if (isBlockClassElement(token) && isNodePreEmittable(nodeTree.currentNode.content)) {
					setNodePreEmitted(nodeTree.currentNode.content);

					/**
					 * Emitting the current node before everything else. We might want to check if
					 * this is a "div" or a "body" and act in a different way for other kind of elements
					 * if we'll introduce some more preEmittable nodes.
					 */
					yield [BlockType.CONTENT_ELEMENT, nodeTree.currentNode];
				}

				let nextAttributes: NodeAttributes;

				if (isTokenAllowedToGroupTrack(token)) {
					nextAttributes |= NodeAttributes.GROUP_TRACKED;
				} else {
					nextAttributes |= NodeAttributes.NO_ATTRS;
				}

				nodeTree.push(createNodeWithAttributes(token, nextAttributes));
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

				const relDescriptor = relationshipTree.getDirectionDescriptor(
					nodeTree.currentNode.parent.content.content,
				);

				if (!relDescriptor) {
					break;
				}

				relDescriptor.navigate();

				if (
					isTokenAllowedToGroupTrack(token) &&
					!isNodeGroupTracked(nodeTree.currentNode.parent.content)
				) {
					const blockType: BlockTuple[0] = BlockTupleMap.get(nodeTree.currentNode.content.content);
					const currentElement = nodeTree.pop();

					yield [blockType, currentElement];
					break;
				}

				nodeTree.pop();
				break;
			}
		}
	}

	return null;
}

/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#element-vocab-group-table
 */

const BLOCK_CLASS = ["div", "p"] as const;
type BLOCK_CLASS = typeof BLOCK_CLASS;

function isBlockClassElement(token: Token): boolean {
	return BLOCK_CLASS.includes(token.content as BLOCK_CLASS[number]);
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

function isNodePreEmittable(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.PRE_EMITTABLE } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.PRE_EMITTABLE);
}

function setNodePreEmitted(node: NodeWithAttributes): void {
	if (!(node[nodeAttributesSymbol] & NodeAttributes.PRE_EMITTABLE)) {
		return;
	}

	node[nodeAttributesSymbol] =
		(node[nodeAttributesSymbol] & ~NodeAttributes.PRE_EMITTABLE) | NodeAttributes.PRE_EMITTED;
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
