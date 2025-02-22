import { BaseAdapter, CueNode } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import { createScope } from "./Parser/Scope/Scope.js";
import type { Scope, ContextFactory } from "./Parser/Scope/Scope.js";
import { createTimeContext } from "./Parser/Scope/TimeContext.js";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
} from "./Parser/Scope/StyleContainerContext.js";
import type { RegionContainerContextState } from "./Parser/Scope/RegionContainerContext.js";
import {
	createRegionContainerContext,
	readScopeRegionContext,
} from "./Parser/Scope/RegionContainerContext.js";
import { parseCue } from "./Parser/parseCue.js";
import { createDocumentContext, readScopeDocumentContext } from "./Parser/Scope/DocumentContext.js";
import { Token, TokenType } from "./Parser/Token.js";
import { NodeTree } from "./Parser/Tags/NodeTree.js";
import type { NodeWithRelationship } from "./Parser/Tags/NodeTree.js";
import type { ActiveStyle } from "./Parser/Scope/TemporalActiveContext.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./Parser/Scope/TemporalActiveContext.js";
import { createVisitor } from "./Parser/Tags/Representation/Visitor.js";
import { RepresentationTree } from "./Parser/Tags/Representation/RepresentationTree.js";
import type { NodeRepresentation } from "./Parser/Tags/Representation/NodeRepresentation.js";
import { createStyleParser } from "./Parser/parseStyle.js";

const nodeAttributesSymbol = Symbol("nodeAttributesSymbol");
const nodeScopeSymbol = Symbol("nodeScopeSymbol");
const nodeMatchSymbol = Symbol("nodeMatchSymbol");

enum NodeAttributes {
	NO_ATTRS /***/ = 0b000,
	IGNORED /****/ = 0b001,
}

interface NodeWithAttributes {
	[nodeAttributesSymbol]: NodeAttributes;
}

interface NodeWithScope {
	[nodeScopeSymbol]?: Scope;
}

interface NodeWithDestinationMatch {
	[nodeMatchSymbol]?: NodeRepresentation<string>;
}

function isNodeIgnored(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.IGNORED } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.IGNORED);
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

function appendNodeAttributes<NodeType extends object>(
	node: NodeType & NodeWithAttributes,
	attributes: NodeAttributes,
): NodeType & NodeWithAttributes {
	if (typeof node[nodeAttributesSymbol] === "undefined") {
		throw new Error("Cannot add attributes to node that has none.");
	}

	node[nodeAttributesSymbol] ^= attributes;
	return node;
}

function createNodeWithScope<NodeType extends object>(
	node: NodeType,
	scope: Scope,
): NodeType & NodeWithScope {
	return Object.create(node, {
		[nodeScopeSymbol]: {
			value: scope,
		},
	});
}

function createNodeWithDestinationMatch<NodeType extends object>(
	node: NodeType,
	destination: NodeRepresentation<string>,
): NodeType & NodeWithDestinationMatch {
	return Object.create(node, {
		[nodeMatchSymbol]: {
			value: destination,
		},
	});
}

function isNodeMatched(node: object): boolean {
	return nodeMatchSymbol in node;
}

/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#element-vocab-group-table
 */

const BLOCK_CLASS_ELEMENT = ["div", "p"] as const;
type BLOCK_CLASS_ELEMENT = typeof BLOCK_CLASS_ELEMENT;

function isBlockClassElement(content: string): content is BLOCK_CLASS_ELEMENT[number] {
	return BLOCK_CLASS_ELEMENT.includes(content as BLOCK_CLASS_ELEMENT[number]);
}

const INLINE_CLASS_ELEMENT = ["span", "br"] as const;
type INLINE_CLASS_ELEMENT = typeof INLINE_CLASS_ELEMENT;

function isInlineClassElement(content: string): content is INLINE_CLASS_ELEMENT[number] {
	return INLINE_CLASS_ELEMENT.includes(content as INLINE_CLASS_ELEMENT[number]);
}

// <br /> omitted on purpose, as it doesn't accept needed any property
const CONTENT_MODULE_ELEMENTS = ["div", "p", "span", "body"] as const;
type CONTENT_MODULE_ELEMENTS = typeof CONTENT_MODULE_ELEMENTS;

function isContentModuleElement(content: string): content is CONTENT_MODULE_ELEMENTS[number] {
	return CONTENT_MODULE_ELEMENTS.includes(content as CONTENT_MODULE_ELEMENTS[number]);
}

const LAYOUT_CLASS_ELEMENT = ["region"] as const;
type LAYOUT_CLASS_ELEMENT = typeof LAYOUT_CLASS_ELEMENT;

function isLayoutClassElement(content: string): content is LAYOUT_CLASS_ELEMENT[number] {
	return LAYOUT_CLASS_ELEMENT.includes(content as LAYOUT_CLASS_ELEMENT[number]);
}

export default class TTMLAdapter extends BaseAdapter {
	public static override get supportedType() {
		return "application/ttml+xml";
	}

	public override parse(rawContent: string): BaseAdapter.ParseResult {
		if (!rawContent) {
			return BaseAdapter.ParseResult(undefined, [
				{
					error: new MissingContentError(),
					failedChunk: "",
					isCritical: true,
				},
			]);
		}

		let cues: CueNode[] = [];
		let treeScope: Scope = createScope(undefined);

		const nodeTree = new NodeTree<
			Token & NodeWithAttributes & NodeWithScope & NodeWithDestinationMatch
		>();
		const representationVisitor = createVisitor(RepresentationTree);
		const tokenizer = new Tokenizer(rawContent);

		let token: Token = null;

		while ((token = tokenizer.nextToken())) {
			switch (token.type) {
				case TokenType.STRING: {
					if (!nodeTree.currentNode) {
						continue;
					}

					if (isNodeIgnored(nodeTree.currentNode.content)) {
						continue;
					}

					// Treating strings as Anonymous spans
					const destinationMatch = representationVisitor.match("span");

					if (!destinationMatch) {
						continue;
					}

					nodeTree.track(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));
					break;
				}

				case TokenType.START_TAG: {
					if (nodeTree.currentNode && isNodeIgnored(nodeTree.currentNode.content)) {
						continue;
					}

					const destinationMatch = representationVisitor.match(token.content);

					if (!destinationMatch) {
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

					representationVisitor.navigate(destinationMatch);

					if (token.content === "tt") {
						treeScope.addContext(createDocumentContext(nodeTree, token.attributes || {}));
						treeScope.addContext(
							createTimeContext({
								// Default data. Will result in an infinite duration.
								begin: "0s",
							}),
						);

						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(
									createNodeWithDestinationMatch(token, destinationMatch),
									treeScope,
								),
								NodeAttributes.NO_ATTRS,
							),
						);

						continue;
					}

					/**
					 * **LITTLE IMPLEMENTATION NOTE**
					 *
					 * In the context of building the ISD (Intermediary Synchronic Document)
					 * (note: we don't strictly do that, by not following the provided algorithm),
					 * _[associate region]_ procedure at 11.3.1.3, specifies a series of
					 * conditions for which a content element can flow into an out-of-line region.
					 *
					 * Its third point states what follows:
					 *
					 * A content element is associated with a region "if the element contains
					 * a descendant element that specifies a region attribute [...], then the
					 * element is associated with the region referenced by that attribute;"
					 *
					 * Imagining that we have a deep span, associated to a region through the
					 * relative attribute, and no parent above associated/flowed into a region,
					 * we would end up with the span to get pruned because parent doesn't have
					 * a region and would therefore get pruned itself.
					 *
					 * Region completion will happen in the END_TAG, if not ignored.
					 */

					if (isLayoutClassElement(token.content)) {
						const { currentNode } = nodeTree;
						const currentTagName = currentNode.content.content;
						const isParentLayout = currentTagName === "layout";

						if (isParentLayout) {
							if (shouldIgnoreOutOfLineRegion(token)) {
								nodeTree.push(
									createNodeWithAttributes(
										createNodeWithScope(
											createNodeWithDestinationMatch(token, destinationMatch),
											treeScope,
										),
										NodeAttributes.IGNORED,
									),
								);
								continue;
							}
						} else {
							if (isInlineRegionConflicting(treeScope)) {
								appendNodeAttributes(currentNode.content, NodeAttributes.IGNORED);
								nodeTree.push(
									createNodeWithAttributes(
										createNodeWithScope(
											createNodeWithDestinationMatch(token, destinationMatch),
											treeScope,
										),
										NodeAttributes.IGNORED,
									),
								);
								continue;
							}
						}
					}

					/**
					 * Checking if there's a region collision between a parent and a children.
					 * Regions will be evaluated when its end tag is received.
					 */

					if (destinationMatch.matchesAttribute("region") && token.attributes["region"]) {
						if (
							isDefaultRegionActive(treeScope) ||
							isFlowingTargetRegionConflicting(token.attributes["region"], treeScope)
						) {
							nodeTree.push(
								createNodeWithAttributes(
									createNodeWithScope(
										createNodeWithDestinationMatch(token, destinationMatch),
										treeScope,
									),
									NodeAttributes.IGNORED,
								),
							);

							continue;
						}
					} else if (!inlineClassElementFlowsInAnyRegion(token, treeScope)) {
						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(
									createNodeWithDestinationMatch(token, destinationMatch),
									treeScope,
								),
								NodeAttributes.IGNORED,
							),
						);

						continue;
					}

					// ************************************* //
					// *** VALID NODE CONFIRMATION POINT *** //
					// ************************************* //

					/**
					 * Checking this allows us to also
					 * prevent adding new things to a new scope.
					 * Regions and stylings > style are meant to
					 * be set on the global scope.
					 *
					 * @TODO should we use regions and style contexts
					 * to write on the document context instead
					 * and only use them as processors?
					 */

					if (!isContentModuleElement(token.content)) {
						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(
									createNodeWithDestinationMatch(token, destinationMatch),
									treeScope,
								),
								NodeAttributes.NO_ATTRS,
							),
						);

						continue;
					}

					const contextsList: ContextFactory[] = [];

					if (destinationMatch.matchesAttribute("region") && token.attributes["region"]) {
						const regionContext = readScopeRegionContext(treeScope);
						const flowedRegion = regionContext.getRegionById(token.attributes["region"]);

						if (flowedRegion) {
							contextsList.push(
								/**
								 * @TODO timing attributes on a region are temporal details
								 * for which "the region is eligible for activation".
								 *
								 * This means that we could have an element E with both
								 * region R and longer timing range [ET1, ET2]. Such
								 * element could technically overflow the time span of
								 * region in both -x and +x like ET1 ≤ RT1 ≤ RT2 ≤ ET2.
								 *
								 * However, right now we don't have a mean to split the
								 * cues in this sense.
								 */
								createTimeContext({
									begin: flowedRegion.timingAttributes["begin"],
									dur: flowedRegion.timingAttributes["dur"],
									end: flowedRegion.timingAttributes["end"],
									timeContainer: flowedRegion.timingAttributes["timeContainer"],
								}),
								createTemporalActiveContext({
									regionIDRef: token.attributes["region"],
								}),
							);
						}
					}

					/**
					 * Using "begin" because if an element supports it,
					 * it must support "end", "dur" and "timeContainer" as well.
					 */
					if (destinationMatch.matchesAttribute("begin") && hasTimingAttributes(token)) {
						contextsList.push(
							createTimeContext({
								begin: token.attributes["begin"],
								end: token.attributes["end"],
								dur: token.attributes["dur"],
								timeContainer: token.attributes["timeContainer"],
							}),
						);
					}

					if (destinationMatch.matchesAttribute("tts:*")) {
						const inlineStyles = extractInlineStylesFromToken(token, treeScope);

						if (inlineStyles) {
							contextsList.push(
								createTemporalActiveContext({
									styles: [inlineStyles],
								}),
							);
						}
					}

					if (destinationMatch.matchesAttribute("style") && token.attributes["style"]) {
						const outOfLineStyle = getOutOfLineStyle(token, treeScope);

						if (outOfLineStyle) {
							contextsList.push(
								createTemporalActiveContext({
									styles: [outOfLineStyle],
								}),
							);
						}
					}

					treeScope = createScope(treeScope, ...contextsList);

					nodeTree.push(
						createNodeWithAttributes(
							createNodeWithScope(
								createNodeWithDestinationMatch(token, destinationMatch),
								treeScope,
							),
							NodeAttributes.NO_ATTRS,
						),
					);

					break;
				}

				case TokenType.END_TAG: {
					if (!nodeTree.currentNode) {
						continue;
					}

					if (nodeTree.currentNode.content.content !== token.content) {
						continue;
					}

					if (isNodeMatched(nodeTree.currentNode.content)) {
						// Pruned by rules, not by destination mismatching
						representationVisitor.back();

						const currentNode = nodeTree.currentNode.content;
						const parentNode = nodeTree.currentNode.parent?.content;
						const didScopeUpgrade = parentNode
							? currentNode[nodeScopeSymbol] !== parentNode[nodeScopeSymbol]
							: true;

						if (didScopeUpgrade && treeScope.parent) {
							treeScope = treeScope.parent;
						}
					}

					if (isNodeIgnored(nodeTree.currentNode.content)) {
						nodeTree.pop();
						break;
					}

					if (token.content === "tt") {
						nodeTree.pop();
						break;
					}

					/**
					 * Processing inline regions to be saved.
					 * Remember: inline regions end before we
					 * can process a cue (paragraph) content
					 */

					if (isInlineRegion(nodeTree.currentNode)) {
						const inlineRegion = getInlineRegionFromCloseTag(nodeTree.currentNode);

						/**
						 * if the `[attributes]` information item property of R does not include
						 * an `xml:id` attribute, then add an implied `xml:id` attribute with a
						 * generated value _ID_ that is unique within the scope of the TTML
						 * document instance;
						 *
						 * otherwise, let _ID_ be the value of the `xml:id` attribute of R;
						 */

						treeScope = createScope(
							treeScope,
							createRegionContainerContext([inlineRegion]),
							createTemporalActiveContext({
								regionIDRef: inlineRegion.attributes["xml:id"],
								styles: [],
							}),
						);

						break;
					}

					const currentTag = nodeTree.currentNode.content.content;

					/**
					 * Processing [out-of-line region]
					 * @see https://w3c.github.io/ttml2/#terms-out-of-line-region
					 */

					const currentElement = nodeTree.pop();

					if (isLayoutElement(currentElement)) {
						const outOfLineRegions = extractOutOfLineRegions(currentElement);

						if (outOfLineRegions.length) {
							treeScope.addContext(createRegionContainerContext(outOfLineRegions));
						}

						break;
					}

					if (isStylingElement(currentElement)) {
						const styles = extractOutOfLineStyles(currentElement);
						treeScope.addContext(createStyleContainerContext(styles));

						break;
					}

					if (
						isBlockClassElement(currentTag) ||
						(isInlineClassElement(currentTag) && currentTag !== "br")
					) {
						if (currentTag === "p") {
							const node = currentElement;
							cues.push(...parseCue(node, currentElement.content[nodeScopeSymbol]));
						}

						break;
					}
				}
			}
		}

		if (!readScopeDocumentContext(treeScope)) {
			throw new Error(`Document failed to parse: <tt> element is apparently missing.`);
		}

		return BaseAdapter.ParseResult(cues, []);
	}
}

/**
 * We cannot use an out-of-line region element if
 * it doesn't have an id, isn't it? ¯\_(ツ)_/¯
 */
function shouldIgnoreOutOfLineRegion(token: Token): boolean {
	return !("xml:id" in token.attributes);
}

/**
 * Having two nested elements that flow into different regions is forbidden.
 * The same is valid if a parent flows inside a out-of-line region
 * while a child flows inside a different (inline) region.
 *
 * @example
 * |--------------------------------|----------------------------------------------------|
 * | Before [process inline region]	|	 After [process inline region]										 |
 * | 																|	 (inline region gets moved)												 |
 * |--------------------------------|----------------------------------------------------|
 * | <tt>														| <tt>																							 |
 * | 	<head>												| 	<head>																					 |
 * | 		<region xml:id="r1" />			| 		<region xml:id="r1" />												 |
 * | 																| 		<region xml:id="__custom_id__" />		<----			 |
 * | 	</head>												| 	</head>																		|			 |
 * | 	<body region="r1">						| 	<body region="r1">										 		|			 |
 * | 		<div>												| 		<div region="__custom_id__">						|			 |
 * | 			<region ... />						| 																				>----			 |
 * | 			<p>...</p>								| 			<p>...</p>																	 |
 * | 		</div>											| 		</div>																				 |
 * | 	</body>												| 	</body>																					 |
 * | </tt>													| </tt>																							 |
 * |________________________________|____________________________________________________|
 *
 * Therefore, for the [associate region] procedure, the whole
 * div will end up being pruned, because of a different region.
 *
 * @see https://w3c.github.io/ttml2/#procedure-process-inline-regions
 */
function isInlineRegionConflicting(scope: Scope): boolean {
	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	if (!temporalActiveContext) {
		return false;
	}

	return Boolean(temporalActiveContext.regionIdRef);
}

/**
 * "Furthermore, if no out-of-line region is specified,
 * then the region attribute must not be specified on
 * any content element in the document instance."
 *
 * @TODO this is marked as a must, so should we throw an error?
 */
function isDefaultRegionActive(scope: Scope): boolean {
	const regionContext = readScopeRegionContext(scope);

	if (!regionContext) {
		return true;
	}

	return !regionContext.regions.length;
}

/**
 * @example (out-of-line regions definitions in head omitted)
 * Inspecting <p region="r2">, but
 *
 * ```
 * <div region="r1">
 * 	<!-- paragraph element will get pruned by the ISD associated with Region `r1` -->
 * 	<!-- Same would be valid with a different region on a span inside the `p` -->
 * 	<p region="r2">...</p>
 * </div>
 *
 * <!-- next div will get pruned as previous sibling
 * 		 has a region but default region is not active (implict in code). -->
 * <div>...</div>
 * ```
 */
function isFlowingTargetRegionConflicting(targetRegionId: string, scope: Scope): boolean {
	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	if (!temporalActiveContext) {
		return false;
	}

	if (!temporalActiveContext.regionIdRef) {
		return false;
	}

	return temporalActiveContext.regionIdRef !== targetRegionId;
}

/**
 * [construct intermediate document] procedure replicates the whole subtree
 * after <body> for each active region.
 *
 * ISD construction should be seen as a set of replicated documents for each
 * region. This means that some elements are always shared.
 *
 * ========
 *
 * [associate region] defines on it's 3rd rule, that an element (e.g. <p>) should
 * get ignored if none of its children have a region associated (if any defined in
 * the document - default region is fine then).
 *
 * However, a parent can get ignored as well if it has no children because all
 * of them have been already pruned. And **this** is where we act.
 *
 * Linear tree parsing, without doing multiple iterations back and forth through
 * the elements hierarchy and without building an actualy ISD, prevents us to
 * understand if any element outside inline elements (`span`s and `br`s) will get
 * pruned or replicated under a certain region.
 *
 * So we can only reach the bottom of each cue to have such information.
 * Pruning all the inline elements, will cause a parent to get pruned as well.
 */
function inlineClassElementFlowsInAnyRegion(token: Token, scope: Scope): boolean {
	if (!isInlineClassElement(token.content)) {
		return true;
	}

	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	return Boolean(temporalActiveContext?.regionIdRef || isDefaultRegionActive(scope));
}

/**
 * Checks if the element is suitable for
 * containing time attributes and if it
 * actually have them
 *
 * @param token
 * @returns
 */
function hasTimingAttributes(token: Token): boolean {
	const { attributes } = token;

	return (
		"begin" in attributes ||
		"end" in attributes ||
		"dur" in attributes ||
		"timeContainer" in attributes
	);
}

function isInlineRegion(currentNode: NodeWithRelationship<Token>): boolean {
	const { parent, content } = currentNode;
	const parentNode = parent.content.content;
	return isBlockClassElement(parentNode) && content.content === "region";
}

function getInlineRegionFromCloseTag(
	currentNode: NodeWithRelationship<Token>,
): RegionContainerContextState {
	/**
	 * "if the `[attributes]` information item property of R does not include
	 * an `xml:id` attribute, then add an implied `xml:id` attribute with a
	 * generated value _ID_ that is unique within the scope of the TTML
	 * document instance;
	 *
	 * otherwise, let _ID_ be the value of the `xml:id` attribute of R;"
	 */

	const {
		content: { attributes: regionAttributes },
		parent: {
			content: { attributes: parentAttributes },
		},
		children,
	} = currentNode;

	const INLINE_REGION_PREFIX = "in:region";
	const regionId =
		regionAttributes["xml:id"] ||
		parentAttributes["xml:id"] ||
		Math.floor(Math.random() * (500 - 100) + 100);

	return {
		attributes: Object.create(regionAttributes, {
			"xml:id": {
				value: `${INLINE_REGION_PREFIX}-${regionId}`,
			},
		}),
		children,
	};
}

function isLayoutElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "layout";
}

function extractOutOfLineRegions(
	currentNode: NodeWithRelationship<Token>,
): RegionContainerContextState[] {
	const { children } = currentNode;

	if (!children.length) {
		return [];
	}

	const regions: RegionContainerContextState[] = [];

	for (const { content: tokenContent, children: regionChildren } of children) {
		if (tokenContent.content !== "region") {
			continue;
		}

		regions.push({ attributes: tokenContent.attributes, children: regionChildren });
	}

	return regions;
}

function isStylingElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "styling";
}

function extractOutOfLineStyles(currentNode: NodeWithRelationship<Token>) {
	const { children } = currentNode;

	const styles: Record<string, Record<string, string>> = {};

	for (const { content } of children) {
		if (content.content !== "style") {
			continue;
		}

		if (!content.attributes["xml:id"]) {
			continue;
		}

		const id = content.attributes["xml:id"];
		styles[id] = content.attributes;
	}

	return styles;
}

function extractInlineStylesFromToken(token: Token, scope: Scope): ActiveStyle | undefined {
	const { attributes } = token;

	const styles = Object.keys(attributes).reduce<Record<string, string>>((acc, key) => {
		if (key.startsWith("tts:")) {
			acc[key] = attributes[key];
		}

		return acc;
	}, {});

	if (!Object.keys(styles).length) {
		return undefined;
	}

	const styleParser = createStyleParser(scope);
	styleParser.process(
		Object.create(styles, {
			"xml:id": {
				value: "inline",
				enumerable: true,
			},
		}),
	);

	return Object.create(styleParser.get("inline"), {
		kind: {
			value: "inline",
		},
	}) as ActiveStyle;
}

function getOutOfLineStyle(token: Token, scope: Scope): ActiveStyle | undefined {
	const { attributes } = token;
	const styleContext = readScopeStyleContainerContext(scope);

	if (!styleContext) {
		const tokenId = `${token.content}#${attributes["xml:id"] || "(n/a)"}`;

		console.warn(
			`'${tokenId}' referenced style '${attributes["style"]}', but no out-of-line style was defined in this document. Ignored.`,
		);

		return undefined;
	}

	const style = styleContext.getStyleByIDRef(attributes["style"]);

	if (!style) {
		const tokenId = `${token.content}#${attributes["xml:id"] || "(n/a)"}`;
		console.warn(
			`'${tokenId}' referenced style '${attributes["style"]}', but this out-of-line style was not defined or was ignored. Ignored.`,
		);

		return undefined;
	}

	return Object.create(style, {
		kind: {
			value: "referential",
		},
	});
}
