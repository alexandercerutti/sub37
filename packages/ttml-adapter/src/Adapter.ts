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
import type {
	StyleContainerContextState,
	TTMLStyle,
} from "./Parser/Scope/StyleContainerContext.js";
import type { RegionContainerContextState } from "./Parser/Scope/RegionContainerContext.js";
import {
	createRegionContainerContext,
	readScopeRegionContext,
} from "./Parser/Scope/RegionContainerContext.js";
import { parseCue } from "./Parser/parseCue.js";
import { createDocumentContext, readScopeDocumentContext } from "./Parser/Scope/DocumentContext.js";
import { Token, TokenType } from "./Parser/Token.js";
import type { UniquelyAnnotatedNode } from "./Parser/namespaces/xml/id.js";
import { isUniquelyAnnotatedNode, generateSyntheticId } from "./Parser/namespaces/xml/id.js";
import { NodeTree } from "./Parser/Tags/NodeTree.js";
import type { NodeWithRelationship } from "./Parser/Tags/NodeTree.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./Parser/Scope/TemporalActiveContext.js";
import { createVisitor } from "./Parser/structure/visitor.js";
import type { Visitor } from "./Parser/structure/visitor.js";
import { RepresentationTree } from "./Parser/Tags/Representation/RepresentationTree.js";
import type { NodeRepresentation } from "./Parser/Tags/Representation/NodeRepresentation.js";
import {
	AnimationContainerContextState,
	createAnimationContainerContext,
	readScopeAnimationContext,
} from "./Parser/Scope/AnimationContainerContext.js";
import { createErrorContext, readScopeErrorContext } from "./Parser/Scope/ErrorContext.js";

// ************************ //
// *** NODES ATTRIBUTES *** //
// ************************ //

const nodeAttributesSymbol = Symbol("nodeAttributesSymbol");

enum NodeAttributes {
	NO_ATTRS /************/ = 0b000,
	IGNORED /*************/ = 0b001,
	NO_SCOPE_CREATION /***/ = 0b010,
}

interface NodeWithAttributes {
	[nodeAttributesSymbol]: NodeAttributes;
}

function isNodeIgnored(
	node: NodeWithAttributes,
): node is NodeAttributes & { [nodeAttributesSymbol]: NodeAttributes.IGNORED } {
	return Boolean(node[nodeAttributesSymbol] & NodeAttributes.IGNORED);
}

/**
 * Non-content-module elements (region, layout, styling, animation, etc.)
 * do not always contribute timing or context. When they don't, no scope is
 * created for them — they inherit the current treeScope as a borrowed reference.
 *
 * Created scopes need to be explicitly popped when the closing tag is reached.
 * A node owns a scope only when it has NO flags set — IGNORED nodes and
 * NO_SCOPE_CREATION nodes both borrow their scope and must never pop.
 */
function isNodeOwningScope(node: NodeWithAttributes): boolean {
	return node[nodeAttributesSymbol] === NodeAttributes.NO_ATTRS;
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

function markSubtreeIgnored(node: NodeWithRelationship<Token & NodeWithAttributes>): void {
	appendNodeAttributes(node.content, NodeAttributes.IGNORED);

	for (const child of node.children) {
		markSubtreeIgnored(child);
	}
}

// ******************* //
// *** NODES SCOPE *** //
// ******************* //

export const nodeScopeSymbol = Symbol("nodeScopeSymbol");

export interface NodeWithScope {
	[nodeScopeSymbol]: Scope;
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

// ******************************* //
// *** NODES DESTINATION MATCH *** //
// ******************************* //

const nodeMatchSymbol = Symbol("nodeMatchSymbol");

interface NodeWithDestinationMatch {
	[nodeMatchSymbol]?: NodeRepresentation<string>;
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
			return BaseAdapter.ParseResult(
				[],
				[
					{
						error: new MissingContentError(),
						failedChunk: "",
						isCritical: true,
					},
				],
			);
		}

		let errors: BaseAdapter.ParseError[] = [];
		let cues: CueNode[] = [];
		const rootScope: Scope = createScope(
			undefined,
			createErrorContext({
				onReport(error: Error, isCritical: boolean, offset: number) {
					const failedChunk =
						rawContent
							.substring(offset, offset + 50)
							.replace(/\s+/g, " ")
							.trimStart() + "...";

					errors.push({
						error,
						isCritical,
						failedChunk,
					});
				},
			}),
		);

		const errorContext = readScopeErrorContext(rootScope)!;
		const onErrorReport = (error: Error) => errorContext.report(error, false);

		let treeScope: Scope | undefined = rootScope;

		const nodeTree = new NodeTree<
			Token & NodeWithAttributes & NodeWithScope & NodeWithDestinationMatch
		>();
		const tokenizer = new Tokenizer(rawContent);

		let token: Token | null = null;

		while ((token = tokenizer.nextToken())) {
			if (!treeScope) {
				errors.push({
					error: new Error(
						`Tree scope became undefined. This is an internal error that should not happen. Please report it. The error happened after token ${token.content} at offset ${token.position.offset} (line ${token.position.line}, column ${token.position.column}).`,
					),
					isCritical: true,
					failedChunk: `element: ${token.content} at offset ${token.position.offset} (line ${token.position.line}, column ${token.position.column})`,
				});

				break;
			}

			if (errorContext.hasCriticalError) {
				break;
			}

			errorContext.setTokenPosition(token.position.offset);

			switch (token.type) {
				case TokenType.STRING: {
					if (!nodeTree.currentNode) {
						continue;
					}

					if (isNodeIgnored(nodeTree.currentNode.content)) {
						continue;
					}

					// Treating strings as Anonymous spans
					const destinationMatch = getNextVisitor(nodeTree).match("span");

					if (!destinationMatch) {
						continue;
					}

					/**
					 * Creating a new scope to allow
					 * anonymous spans to access to parents
					 * `timeContainer`. On their own, they do
					 * not specify any timing detail.
					 */

					const localScope = createScope(
						treeScope,
						createTimeContext({
							timeContainer: undefined,
						}),
					);

					nodeTree.track(
						createNodeWithAttributes(
							createNodeWithScope(token, localScope),
							NodeAttributes.NO_ATTRS,
						),
					);
					break;
				}

				case TokenType.START_TAG: {
					if (nodeTree.currentNode && isNodeIgnored(nodeTree.currentNode.content)) {
						continue;
					}

					const destinationMatch = getNextVisitor(nodeTree).match(token.content);

					if (!destinationMatch) {
						/**
						 * Even if token does not respect it parent relatioship,
						 * we still add it to the queue to mark its end later.
						 *
						 * We don't want to track it inside the tree, instead,
						 * because we are going to ignore it.
						 */

						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(token, rootScope),
								NodeAttributes.IGNORED,
							),
						);
						continue;
					}

					if (token.content === "tt") {
						rootScope.addContexts(
							createDocumentContext(nodeTree, token.attributes || {}),
							createTimeContext({
								// Default data. Will result in an infinite duration.
								begin: "0s",
							}),
						);

						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(
									createNodeWithDestinationMatch(token, destinationMatch),
									rootScope,
								),
								NodeAttributes.NO_SCOPE_CREATION,
							),
						);

						continue;
					}

					/**
					 * Region completion will happen in the END_TAG, if not ignored.
					 */
					if (isLayoutClassElement(token.content)) {
						const { currentNode } = nodeTree;
						const isParentLayout = isLayoutElement(currentNode);

						if (isParentLayout) {
							if (!isUniquelyAnnotatedNode(token.attributes)) {
								errorContext.report(
									new Error("Region element has no 'xml:id' attribute. Ignored."),
									false,
								);

								nodeTree.push(
									createNodeWithAttributes(
										createNodeWithScope(
											createNodeWithDestinationMatch(token, destinationMatch),
											rootScope,
										),
										NodeAttributes.IGNORED,
									),
								);
								continue;
							}
						} else {
							if (isInlineRegionConflicting(treeScope)) {
								errorContext.report(
									new Error("Found an inline region flowing into an out-of-line region. Ignored."),
									false,
								);

								appendNodeAttributes(currentNode.content, NodeAttributes.IGNORED);
								nodeTree.push(
									createNodeWithAttributes(
										createNodeWithScope(
											createNodeWithDestinationMatch(token, destinationMatch),
											rootScope,
										),
										NodeAttributes.IGNORED,
									),
								);
								continue;
							}
						}
					}

					/**
					 * *****************************************************************
					 * *** IMPORTANT CONCEPT KNOWLEDGE AHEAD - PLEASE READ CAREFULLY ***
					 * *****************************************************************
					 *
					 * ISD (Intermediary Synchronic Document) construction is a process TTML standard
					 * defines as the duplication and replication of elements for each active region.
					 *
					 * [construct intermediate document] (11.3.1.3) procedure replicates the whole subtree
					 * after <body> for each active region.
					 *
					 * This means that some elements are always shared.
					 * We are not strictly following the ISD construction procedure, but achieving
					 * the same result.
					 *
					 * ========
					 *
					 * [associate region] (11.3.1.3) procedure defines, on it's 3rd and 4th rules, how an
					 * element should be associated with a region:
					 *
					 * > 3. if the element contains a descendant element that specifies a region attribute
					 * > [...], then the element is associated with the region referenced by that attribute;
					 * >
					 * > 4. if a default region was implied (due to the absence of any region element),
					 * > then the element is associated with the default region;
					 *
					 * The reason for the third point to exist, can be described with an example like follows:
					 * imagine to have tree with a deep <span> that flows into a region and no parent above
					 * flowing into a region.
					 *
					 * We would end up with the span to get pruned because parent doesn't have
					 * a region and would therefore get pruned itself.
					 *
					 * This implementation uses linear tree parsing, one element after the other, without
					 * building an actual ISD. This prevents us to understand if any element, except inline
					 * elements (`span`s and `br`s), will get pruned or replicated under a certain region without
					 * doing multiple iterations back and forth through the elements hierarchy.
					 *
					 * **HOWEVER**
					 *
					 * Rules 3 and 4 also implicitly mean that a parent can get ignored as well if it has no
					 * children at all, because they have been already pruned. And **this** is where we act.
					 *
					 * We can only reach the bottom of each cue to have pruning details.
					 * Pruning all the inline elements, will cause a parent to get pruned as well (which, in
					 * our case, corresponds to ignoring the elements or not using it).
					 *
					 * I really hope this is clear, because it took me a while to figure it out and I reworked
					 * this paragraph multiple times – yes, I couldn't understand it either when reading it again
					 * after a while.
					 */

					/**
					 * Checking if there's a region collision between a parent and a children.
					 * Regions will be evaluated when its end tag is received.
					 */

					if (destinationMatch.matchesAttribute("region") && token.attributes["region"]) {
						if (
							isDefaultRegionActive(treeScope) ||
							flowingIntoRegionConflicts(token.attributes["region"], treeScope)
						) {
							errorContext.report(
								new Error(
									`Element '${token.content}' is assigned to region '${token.attributes["region"]}' but either default region is active or this element is already flowing in a different region. Ignored.`,
								),
								false,
							);

							nodeTree.push(
								createNodeWithAttributes(
									createNodeWithScope(
										createNodeWithDestinationMatch(token, destinationMatch),
										rootScope,
									),
									NodeAttributes.IGNORED,
								),
							);

							continue;
						}
					}

					// ************************************* //
					// *** VALID NODE CONFIRMATION POINT *** //
					// ************************************* //

					const contextsList: ContextFactory[] = [];

					/**
					 * Using "begin" because if an element supports it,
					 * it must support "end" and "dur" as well.
					 *
					 * A time context should always get created because we
					 * might have an element with `timeContainer` attribute
					 * that must be read by its children.
					 *
					 * `timeContainer` is not forwarded for elements that don't
					 * support it (e.g. animate, set) to avoid creating unintended
					 * seq/par containers.
					 */
					if (destinationMatch.matchesAttribute("begin")) {
						contextsList.push(
							createTimeContext({
								begin: token.attributes["begin"],
								end: token.attributes["end"],
								dur: token.attributes["dur"],
								timeContainer: destinationMatch.matchesAttribute("timeContainer")
									? token.attributes["timeContainer"]
									: undefined,
							}),
						);
					}

					/**
					 * Checking this allows us to also
					 * prevent adding new things to a new scope.
					 * Regions and stylings > style are meant to
					 * be set on the global scope.
					 */

					if (!isContentModuleElement(token.content)) {
						let attributes = NodeAttributes.NO_ATTRS;

						if (contextsList.length) {
							treeScope = createScope(treeScope, ...contextsList);
						} else {
							attributes = NodeAttributes.NO_SCOPE_CREATION;
						}

						nodeTree.push(
							createNodeWithAttributes(
								createNodeWithScope(
									createNodeWithDestinationMatch(token, destinationMatch),
									treeScope,
								),
								attributes,
							),
						);

						continue;
					}

					if (destinationMatch.matchesAttribute("region") && token.attributes["region"]) {
						const regionContext = readScopeRegionContext(treeScope);
						const flowedRegion = regionContext?.getRegionById(token.attributes["region"]);

						if (flowedRegion) {
							contextsList.push(
								createTemporalActiveContext({
									regionIDRef: token.attributes["region"],
								}),
							);

							/**
							 * If a span flows into a region, according to [associate region] procedure,
							 * it should be associated with that region as well as its parent (which
							 * wasn't marked so). So, the best thing we can to is to assign the region to all
							 * the inline elements...
							 */
							if (isInlineClassElement(token.content)) {
								let ancestorElement: NodeWithRelationship<Token & NodeWithScope> =
									nodeTree.currentNode;

								/**
								 * ... but not to the parent, which may have other
								 * valid span blocks, with a region assigned.
								 *
								 * ```
								 * <p>
								 *   <span>
								 *     <span region="region1">...</span>
								 *   </span>
								 *   <span region="region2">
								 *     ...
								 *   </span>
								 * </p>
								 * ```
								 *
								 * When we are going to parse the paragraph, we'll therefore
								 * omit those spans that do not flow in any region (pruning).
								 */

								while (ancestorElement.content.content !== "p") {
									ancestorElement.content[nodeScopeSymbol].addContexts(
										createTemporalActiveContext({
											regionIDRef: token.attributes["region"],
										}),
									);

									ancestorElement = ancestorElement.parent!;
								}
							}
						}
					}

					if (destinationMatch.matchesAttribute("tts:*")) {
						const inlineStyles = extractInlineStylesFromToken(token);

						if (inlineStyles) {
							contextsList.push(
								createStyleContainerContext([inlineStyles]),
								createTemporalActiveContext({
									stylesIDRefs: [inlineStyles["xml:id"]],
								}),
							);
						}
					}

					if (token.attributes["style"] && destinationMatch.matchesAttribute("style")) {
						const outOfLineStyles = getOutOfLineStylesByIDREFS(token, treeScope, onErrorReport);

						if (outOfLineStyles.length) {
							contextsList.push(
								createTemporalActiveContext({
									stylesIDRefs: outOfLineStyles.map(({ "xml:id": id }) => id),
								}),
							);
						}
					}

					if (token.attributes["animate"] && destinationMatch.matchesAttribute("animate")) {
						const animationsIDRefs = getOutOfLineAnimationsIdsByIDREFS(
							token,
							treeScope,
							onErrorReport,
						);

						if (animationsIDRefs.length) {
							contextsList.push(
								createTemporalActiveContext({
									animationsIDRefs,
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

						const currentNode = nodeTree.currentNode.content;

						if (isNodeOwningScope(currentNode)) {
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

					if (isInlineAnimation(nodeTree.currentNode)) {
						const animation = getInlineAnimationFromOpeningTag(nodeTree.currentNode);
						const temporalActiveContext = readScopeTemporalActiveContext(treeScope!);

						/**
						 * There may be multiple inline animations inside the same element.
						 * If any have been already added, let's merge the contexts.
						 */
						if (temporalActiveContext) {
							treeScope!.addContexts(
								createAnimationContainerContext([animation]),
								createTemporalActiveContext({
									animationsIDRefs: [animation.attributes["xml:id"]!],
								}),
							);
						} else {
							treeScope = createScope(
								treeScope,
								createTemporalActiveContext({
									animationsIDRefs: [animation.attributes["xml:id"]!],
								}),
								createAnimationContainerContext([animation]),
							);
						}

						nodeTree.pop();
						break;
					}

					/**
					 * Processing inline regions to be saved.
					 * Remember: inline regions end before we
					 * can process a cue (paragraph) content
					 */

					if (isInlineRegion(nodeTree.currentNode)) {
						const inlineRegion = getInlineRegionFromOpeningTag(nodeTree.currentNode);

						treeScope = createScope(
							treeScope,
							createRegionContainerContext([inlineRegion]),
							createTemporalActiveContext({
								regionIDRef: inlineRegion.attributes["xml:id"]!,
							}),
						);

						nodeTree.pop();
						break;
					}

					/**
					 * Processing [out-of-line region]
					 * @see https://w3c.github.io/ttml2/#terms-out-of-line-region
					 */

					const closingElement = nodeTree.pop()!;

					/**
					 * This is the completion of the equivalent of [associate region] procedure
					 * described in ISD construction.
					 *
					 * When a span ends, if it has not been associated with any region, then
					 * it and its children will become ignored and then filtered later, when
					 * processing the paragraph.
					 */
					if (
						isInlineClassElement(closingElement.content.content) &&
						closingElement.content.content !== "br"
					) {
						if (
							!inlineClassElementFlowsInAnyRegion(
								closingElement.content,
								closingElement.content[nodeScopeSymbol],
							)
						) {
							errorContext.report(
								new Error(
									`Element '${closingElement.content.content}' is not flowing into any region. Ignored.`,
								),
								false,
							);

							markSubtreeIgnored(closingElement);
							break;
						}
					}

					if (isLayoutElement(closingElement)) {
						const outOfLineRegions = extractOutOfLineRegions(closingElement);

						if (outOfLineRegions.length) {
							rootScope.addContexts(createRegionContainerContext(outOfLineRegions));
						}

						break;
					}

					if (isStylingElement(closingElement)) {
						const initialStyles = extractInitialStyles(closingElement);
						const outOfLineStyles = initialStyles.concat(
							extractOutOfLineStyles(closingElement, rootScope),
						);

						rootScope.addContexts(
							createStyleContainerContext(outOfLineStyles),
							createTemporalActiveContext({
								stylesIDRefs: outOfLineStyles.map(({ "xml:id": id }) => id),
							}),
						);

						break;
					}

					if (isAnimationElement(closingElement)) {
						const animations = extractOutOfLineAnimations(closingElement, rootScope);

						rootScope.addContexts(
							//
							createAnimationContainerContext(animations),
						);

						break;
					}

					if (closingElement.content.content === "p") {
						const nodeForParsing = Object.create(closingElement, {
							children: {
								value: closingElement.children.filter((child) => !isNodeIgnored(child.content)),
								enumerable: true,
							},
						});

						cues = cues.concat(parseCue(nodeForParsing));
					}

					break;
				}
			}
		}

		if (!readScopeDocumentContext(rootScope)) {
			errors.push({
				error: new Error("Document failed to parse: <tt> element is apparently missing."),
				isCritical: true,
				failedChunk: rawContent,
			});
		} else if (!cues.length) {
			errors.push({
				error: new Error("Document parsed successfully but no cues have been found."),
				isCritical: false,
				failedChunk: rawContent,
			});
		}

		return BaseAdapter.ParseResult(cues, errors);
	}
}

function getNextVisitor<T extends Token & NodeWithDestinationMatch>(
	nodeTree: NodeTree<T>,
): Visitor<NodeRepresentation<string>> {
	if (!nodeTree.currentNode) {
		return createVisitor(RepresentationTree);
	}

	const lastDestinationMatched = nodeTree.currentNode.content[nodeMatchSymbol]!;

	return createVisitor(lastDestinationMatched);
}

// ******************************************** //
// *** REGIONS EXTRACTION AND PREPROCESSING *** //
// ******************************************** //
// region region extraction

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

	return Boolean(temporalActiveContext.region?.id);
}

/**
 * Default region is active when no out-of-line region is defined in the document.
 * TTML specifies that:
 *
 * > Furthermore, if no out-of-line region is specified,
 * > then the region attribute must not be specified on
 * > any content element in the document instance.
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
 * By TTML specification, "flowing into a region" means that an element gets
 * associated with that specific region.
 *
 * Flowing into a region is allowed only if the Default Region is active (not the
 * case here), if an element doesn't have a region associated yet (which is required if the
 * default region is not active) or if the region associated is the same as the parent one.
 *
 * In the example below, out-of-line regions definitions are omitted.
 *
 * @example
 * ```xml
 * <div region="r1">
 * 	<!-- paragraph element will get pruned by the ISD associated with Region `r1` -->
 * 	<!-- Same would be valid with a different region on a span inside the `p` -->
 * 	<p region="r2">...</p>
 * </div>
 * <!--
 * 	This div will get pruned as well, as the previous sibling
 * 	has a region, but default region is not active.
 * -->
 * <div>
 *     <!-- ... -->
 * </div>
 * ```
 */
function flowingIntoRegionConflicts(targetRegionId: string, scope: Scope): boolean {
	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	if (!temporalActiveContext?.region) {
		return false;
	}

	return temporalActiveContext.region.id !== targetRegionId;
}

function inlineClassElementFlowsInAnyRegion(token: Token, scope: Scope): boolean {
	if (!isInlineClassElement(token.content)) {
		return true;
	}

	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	return Boolean(temporalActiveContext?.region?.id || isDefaultRegionActive(scope));
}

function isInlineRegion(currentNode: NodeWithRelationship<Token>): boolean {
	if (!isRegionElement(currentNode)) {
		return false;
	}

	const parentNode = currentNode.parent!.content.content;

	return isBlockClassElement(parentNode);
}

/**
 * From "[process inline regions]" procedure:
 *
 * > If the `[attributes]` information item property of R' does not include
 * > an `xml:id` attribute, then add an implied `xml:id` attribute with a
 * > generated value _ID_ that is unique within the scope of the TTML
 * > document instance;
 * >
 * > otherwise, let _ID_ be the value of the `xml:id` attribute of R'
 *
 * ---
 *
 * This function is called when we receive the closing tag of an inline region.
 * This means that we have all the information about the region itself in the
 * opening tag.
 */
function getInlineRegionFromOpeningTag(
	openingTag: NodeWithRelationship<Token & NodeWithScope>,
): RegionContainerContextState {
	const {
		content: { attributes: regionAttributes },
		parent,
		children,
	} = openingTag;

	const {
		content: { attributes: parentAttributes },
	} = parent!;

	const regionIdBody =
		regionAttributes["xml:id"] ||
		(parentAttributes["xml:id"] && `in:region-${parentAttributes["xml:id"]}`) ||
		generateSyntheticId("in:region");

	return {
		attributes: Object.create(regionAttributes, {
			"xml:id": {
				value: regionIdBody,
			},
		}),
		children,
	};
}

function isRegionElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "region";
}

function isLayoutElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "layout";
}

function extractOutOfLineRegions(
	currentNode: NodeWithRelationship<Token & NodeWithScope>,
): RegionContainerContextState[] {
	const { children } = currentNode;

	if (!children.length) {
		return [];
	}

	const regions: RegionContainerContextState[] = [];

	for (const child of children) {
		if (!isRegionElement(child)) {
			continue;
		}

		const { content: tokenContent, children: regionChildren } = child;

		regions.push({ attributes: tokenContent.attributes, children: regionChildren });
	}

	return regions;
}

// ******************************************* //
// *** STYLES EXTRACTION AND PREPROCESSING *** //
// ******************************************* //
// region styles extraction

function isStylingElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "styling";
}

function extractInitialStyles(
	currentNode: NodeWithRelationship<Token>,
): StyleContainerContextState[] {
	const { children } = currentNode;

	if (!children.length) {
		return [];
	}

	const styles: StyleContainerContextState[] = [];

	for (const { content } of children) {
		if (content.content !== "initial") {
			continue;
		}

		styles.push(
			Object.create(content.attributes, {
				"xml:id": {
					value: content.attributes["xml:id"] || generateSyntheticId("in:style"),
					enumerable: true,
				},
				kind: {
					value: "initial",
				},
			}),
		);
	}

	return styles;
}

/**
 * Prepares style nodes to be fed into the Style context, which
 * will filter the attributes.
 *
 * @param currentNode
 * @returns
 */
function extractOutOfLineStyles(
	currentNode: NodeWithRelationship<Token>,
	scope: Scope,
): StyleContainerContextState[] {
	const { children } = currentNode;

	const styles: StyleContainerContextState[] = [];

	for (const { content } of children) {
		if (content.content !== "style") {
			continue;
		}

		if (!isUniquelyAnnotatedNode(content.attributes)) {
			const errorContext = readScopeErrorContext(scope)!;

			errorContext.report(
				new Error(
					`Style element '${content.content}' has no 'xml:id' attribute. Although it not mandatory, this style won't be able to be referenced by any element.`,
				),
				false,
			);
		}

		styles.push(
			Object.create(content.attributes, {
				kind: {
					value: "referential",
					enumerable: true,
				},
			}),
		);
	}

	return styles;
}

/**
 * Perpares all the inline styles to be added to the Style context,
 * which will filter the attributes.
 *
 * @param token
 * @returns
 */
function extractInlineStylesFromToken(
	token: Token,
): (Record<string, string> & UniquelyAnnotatedNode & { kind: "inline" }) | undefined {
	const { attributes } = token;

	return Object.create(attributes, {
		"xml:id": {
			value: attributes["xml:id"] || generateSyntheticId("in:style"),
			enumerable: true,
		},
		kind: {
			value: "inline",
		},
	});
}

function getOutOfLineStylesByIDREFS(
	token: Token,
	scope: Scope,
	onStyleNotFound: (error: Error) => void,
): TTMLStyle[] {
	const { attributes } = token;
	const styleContext = readScopeStyleContainerContext(scope);

	if (!styleContext) {
		onStyleNotFound(
			new Error(
				`Element '${token.content}' (id: ${attributes["xml:id"] || "(n/a)"}) referenced style(s) '${attributes["style"]}', but no out-of-line styles were defined in this document. Ignored.`,
			),
		);

		return [];
	}

	const idrefsStyleList = attributes["style"]!.split(/\s+/);
	const referencialStyles: TTMLStyle[] = [];

	for (const idref of idrefsStyleList) {
		const style = styleContext.getStyleByIDRef(idref);

		if (!style) {
			onStyleNotFound(
				new Error(
					`Element '${token.content}' (id: ${attributes["xml:id"] || "(n/a)"}) referenced style '${idref}', but no such out-of-line style was defined in this document. Ignored.`,
				),
			);

			continue;
		}

		referencialStyles.push(style);
	}

	return referencialStyles;
}

// ********************************************** //
// *** ANIMATION EXTRACTION AND PREPROCESSING *** //
// ********************************************** //
// region animation extraction

type AnimateOrSetToken = Token & { content: "animate" | "set" };

export function isAnimateOrSetElement(currentNode: Token): currentNode is AnimateOrSetToken {
	return currentNode.content === "animate" || currentNode.content === "set";
}

function isInlineAnimation(
	currentNode: NodeWithRelationship<Token & NodeWithDestinationMatch>,
): currentNode is NodeWithRelationship<AnimateOrSetToken & NodeWithDestinationMatch> {
	const { content, parent } = currentNode;
	const parentNode = parent!.content;

	if (isLayoutClassElement(parentNode.content)) {
		/**
		 * Inline animations within regions are applied through the region context
		 * itself.
		 */
		return false;
	}

	const isParentAllowedToContainInlineAnimation =
		parentNode[nodeMatchSymbol]?.matchesAttribute("animate") || false;

	return isParentAllowedToContainInlineAnimation && isAnimateOrSetElement(content);
}

function isAnimationElement(currentNode: NodeWithRelationship<Token>): boolean {
	return currentNode.content.content === "animation";
}

function extractOutOfLineAnimations(
	currentNode: NodeWithRelationship<Token>,
	scope: Scope,
): AnimationContainerContextState[] {
	const { children } = currentNode;

	if (!children.length) {
		return [];
	}

	const animations: AnimationContainerContextState[] = [];

	for (const { content: tokenContent } of children) {
		if (!isAnimateOrSetElement(tokenContent)) {
			continue;
		}

		if (!isUniquelyAnnotatedNode(tokenContent.attributes)) {
			const errorContext = readScopeErrorContext(scope)!;

			errorContext.report(
				new Error(
					`Animation element '${tokenContent.content}' has no 'xml:id' attribute. Ignored.`,
				),
				false,
			);

			continue;
		}

		const animationId = getInlineAnimationId(tokenContent, currentNode.content);

		animations.push(getInlineAnimationFromToken(animationId, tokenContent));
	}

	return animations;
}

function getInlineAnimationFromOpeningTag(
	openingTag: NodeWithRelationship<AnimateOrSetToken>,
): AnimationContainerContextState {
	const { content, parent } = openingTag;

	const animationId = getInlineAnimationId(content, parent?.content);

	return getInlineAnimationFromToken(animationId, content);
}

function getInlineAnimationFromToken(
	animationId: string,
	token: AnimateOrSetToken,
): AnimationContainerContextState {
	const tokenAttributes = token.attributes;

	return {
		element: token.content,
		attributes: Object.create(tokenAttributes, {
			"xml:id": {
				value: animationId,
			},
		}),
		calcMode: token.content === "set" ? "discrete" : tokenAttributes["calcMode"],
	};
}

function getInlineAnimationId(token: Token, parent?: Token): string {
	if (token.attributes["xml:id"]) {
		return token.attributes["xml:id"];
	}

	if (parent?.attributes["xml:id"]) {
		return `in:animation-${parent.attributes["xml:id"]}`;
	}

	return generateSyntheticId("in:animation");
}

/**
 * Given a token having an "animate" attribute, look for the corresponding animation
 * definitions and hence validates the animations themselves. Then, returns the list
 * of valid animation IDs to be added to the temporal active context.
 *
 * @param token
 * @param scope
 * @returns
 */
function getOutOfLineAnimationsIdsByIDREFS(
	token: Token,
	scope: Scope,
	onAnimationNotFound: (error: Error) => void,
): string[] {
	const { attributes } = token;
	const animationContext = readScopeAnimationContext(scope);

	if (!animationContext) {
		onAnimationNotFound(
			new Error(
				`Element '${token.content}' (id: ${attributes["xml:id"] || "(n/a)"}) referenced animation(s) '${attributes["animate"]}', but no out-of-line animations were defined in this document. Ignored.`,
			),
		);

		return [];
	}

	const idrefsAnimationList = attributes["animate"]!.split(/\s+/);
	const seenAnimationIDRefs = new Set<string>();

	for (const idref of idrefsAnimationList) {
		if (!animationContext.getAnimationById(idref)) {
			onAnimationNotFound(
				new Error(
					`Element '${token.content}' (id: ${attributes["xml:id"] || "(n/a)"}) referenced animation '${idref}', but no such out-of-line animation was defined in this document. Ignored.`,
				),
			);

			continue;
		}

		/**
		 * @see §13.2.1
		 * > A given IDREF must not appear more than one time in the value of an animate attribute.
		 */
		if (seenAnimationIDRefs.has(idref)) {
			onAnimationNotFound(
				new Error(
					`Element '${token.content}' (id: ${attributes["xml:id"] || "(n/a)"}) referenced animation '${idref}' multiple times. Duplicated references are not allowed.`,
				),
			);

			continue;
		}

		seenAnimationIDRefs.add(idref);
	}

	return Array.from(seenAnimationIDRefs);
}
