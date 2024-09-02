import { BaseAdapter, CueNode } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import { createScope, type Scope } from "./Parser/Scope/Scope.js";
import { createTimeContext } from "./Parser/Scope/TimeContext.js";
import { createStyleContext } from "./Parser/Scope/StyleContext.js";
import type { RegionContextState } from "./Parser/Scope/RegionContext.js";
import { createRegionContext, findInlineRegionInChildren } from "./Parser/Scope/RegionContext.js";
import { parseCue } from "./Parser/parseCue.js";
import { createDocumentContext, readScopeDocumentContext } from "./Parser/Scope/DocumentContext.js";
import { Token, TokenType } from "./Parser/Token.js";
import { NodeTree } from "./Parser/Tags/NodeTree.js";
import { createVisitor } from "./Parser/Tags/Representation/Visitor.js";
import { RepresentationTree } from "./Parser/Tags/Representation/RepresentationTree.js";

const nodeAttributesSymbol = Symbol("nodeAttributesSymbol");

enum NodeAttributes {
	NO_ATTRS /********/ = 0b000000,
	IGNORED /*********/ = 0b000001,
	GROUP_TRACKED /***/ = 0b000010,
}

interface NodeWithAttributes {
	[nodeAttributesSymbol]: NodeAttributes;
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

const GROUP_TRACKING_ALLOWED_ELEMENTS = ["p", "span", "layout", "styling"] as const;
type GROUP_TRACKING_ALLOWED_ELEMENTS = typeof GROUP_TRACKING_ALLOWED_ELEMENTS;

function isTokenAllowedToGroupTrack(token: Token): boolean {
	return GROUP_TRACKING_ALLOWED_ELEMENTS.includes(
		token.content as GROUP_TRACKING_ALLOWED_ELEMENTS[number],
	);
}

/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#element-vocab-group-table
 */

const BLOCK_CLASS = ["div", "p"] as const;
type BLOCK_CLASS = typeof BLOCK_CLASS;

function isBlockClassElement(token: Token): boolean {
	return BLOCK_CLASS.includes(token.content as BLOCK_CLASS[number]);
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
		let treeScope: Scope = createScope(undefined, createTimeContext({}), createStyleContext({}));

		const nodeTree = new NodeTree<Token & NodeWithAttributes>();
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

					nodeTree.track(createNodeWithAttributes(token, NodeAttributes.GROUP_TRACKED));
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
						if (readScopeDocumentContext(treeScope)) {
							/**
							 * @TODO Change in a fatal error;
							 */
							throw new Error("Malformed TTML track: multiple <tt> were found.");
						}

						nodeTree.push(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));

						treeScope.addContext(
							createDocumentContext(nodeTree.currentNode.content.attributes || {}),
						);
						continue;
					}

					/**
					 * Checking if there's a region collision between a parent and a children.
					 * Regions will be evaluated when its end tag is received.
					 */

					if (isBlockClassElement(nodeTree.currentNode.content.content)) {
						/**
						 * body > div > region
						 * div > p > region
						 * p > span > region
						 */

						/** Region attribute could be in any of the parents */
						const temporalActiveContext = readScopeTemporalActiveContext(treeScope);

						/**
						 * [associate region] procedure at 11.3.1.3, defines that for
						 * any [out-of-line region](https://w3c.github.io/ttml2/#terms-out-of-line-region),
						 * a content element should be associated to the region by the first satisfied
						 * condition among these:
						 *
						 *	- if the element specifies a region attribute [...] then the element is associated
						 *			with the region referenced by that attribute;
						 *	- if some ancestor of that element specifies a region attribute [...], then the
						 *			element is associated with the region referenced by the most immediate ancestor
						 *			that specifies this attribute;
						 *	- if the element contains a descendant element that specifies a region attribute [...],
						 *			then the element is associated with the region referenced by that attribute;
						 *	- if a default region was implied (due to the absence of any region element),
						 *			then the element is associated with the default region;
						 * 	-	(otherwise) the element is not associated with any region.
						 *
						 * So some notes after reading this:
						 *
						 *  - If the third point is not applied, if e.g. we had a deep span with a region attribute, we
						 * 			would end up with it to get pruned because parent wouldn't have a region and would
						 * 			therefore get pruned itself.
						 *  - As the [associate region] is executed for any out-of-line region, if any out-of-line
						 *			region is defined, associating a content element to the default region is not
						 *			possible. Firth rule will apply. Whenever fifth rule will apply, a content element
						 *			is not associated with any region and then the element ignored / pruned.
						 *
						 * However, [associate region] is executed in a context of generating an ISD
						 * (Intermediate Synchronic Document)
						 * which is a thing we do not strictly do. As long as we obtain the same result of it,
						 * we can skip parts and still be defined as compliant.
						 *
						 * Region completion will happen in the END_TAG, if not ignored.
						 */

						if (temporalActiveContext.regions.size) {
							const regionIdentifier: string | undefined = token.attributes["region"];

							if (regionIdentifier && !temporalActiveContext.regions.has(regionIdentifier)) {
								nodeTree.push(createNodeWithAttributes(token, NodeAttributes.IGNORED));
								continue;
							}
						}
					}

					if (token.content === "div" || token.content === "body") {
						// if (
						// 	treeScope.parent &&
						// 	nodeTree.currentNode.parent.content.content !== "div" &&
						// 	nodeTree.currentNode.content.content === "div"
						// ) {
						// 	treeScope = treeScope.parent;
						// }

						const {
							children,
							content: { attributes },
						} = nodeTree.currentNode;

						treeScope = createScope(
							treeScope,
							createRegionContext(findInlineRegionInChildren(attributes["xml:id"], children)),
						);

						nodeTree.push(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));

						continue;
					}

					if (isBlockClassElement(token)) {
						if (
							treeScope.parent &&
							nodeTree.currentNode.parent.content.content !== "div" &&
							nodeTree.currentNode.content.content === "div"
						) {
							treeScope = treeScope.parent;
						}

						const {
							children,
							content: { attributes },
						} = nodeTree.currentNode;

						treeScope = createScope(
							treeScope,
							createRegionContext(findInlineRegionInChildren(attributes["xml:id"], children)),
						);

						break;
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

					if (isNodeIgnored(nodeTree.currentNode.content)) {
						nodeTree.pop();
						break;
					}

					representationVisitor.back();

					if (
						isTokenAllowedToGroupTrack(token) &&
						!isNodeGroupTracked(nodeTree.currentNode.parent.content)
					) {
						const currentTag = nodeTree.currentNode.content.content;
						const currentElement = nodeTree.pop();

						if (currentTag === "layout") {
							const { children } = currentElement;

							const localRegions: RegionContextState[] = [];

							for (const { content: regionToken, children: regionChildren } of children) {
								if (regionToken.content !== "region") {
									continue;
								}

								localRegions.push({ attributes: regionToken.attributes, children: regionChildren });
							}

							treeScope.addContext(createRegionContext(localRegions));

							break;
						}

						if (currentTag === "styling") {
							const { children } = currentElement;

							const styleTags = children.reduce<Record<string, string>>(
								(acc, { content: token }) => {
									if (token.content !== "style") {
										return acc;
									}

									return Object.assign(acc, token.attributes);
								},
								{},
							);

							treeScope.addContext(createStyleContext(styleTags));

							break;
						}

						if (currentTag === "p" || currentTag === "span") {
							const node = currentElement;
							cues.push(...parseCue(node, treeScope));

							break;
						}

						break;
					}

					nodeTree.pop();
					break;
				}
			}
		}

		if (!readScopeDocumentContext(treeScope)) {
			throw new Error(`Document failed to parse: <tt> element is apparently missing.`);
		}

		return BaseAdapter.ParseResult(cues, []);
	}
}
