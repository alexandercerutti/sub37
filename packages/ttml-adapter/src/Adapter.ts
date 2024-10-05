import { BaseAdapter, CueNode } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import { createScope, type Scope } from "./Parser/Scope/Scope.js";
import { createTimeContext } from "./Parser/Scope/TimeContext.js";
import { createStyleContainerContext } from "./Parser/Scope/StyleContainerContext.js";
import type { RegionContainerContextState } from "./Parser/Scope/RegionContainerContext.js";
import {
	createRegionContainerContext,
	readScopeRegionContext,
} from "./Parser/Scope/RegionContainerContext.js";
import { parseCue } from "./Parser/parseCue.js";
import { createDocumentContext, readScopeDocumentContext } from "./Parser/Scope/DocumentContext.js";
import { Token, TokenType } from "./Parser/Token.js";
import { NodeTree } from "./Parser/Tags/NodeTree.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./Parser/Scope/TemporalActiveContext.js";
import { createVisitor } from "./Parser/Tags/Representation/Visitor.js";
import { RepresentationTree } from "./Parser/Tags/Representation/RepresentationTree.js";

const nodeAttributesSymbol = Symbol("nodeAttributesSymbol");

enum NodeAttributes {
	NO_ATTRS /***/ = 0b000,
	IGNORED /****/ = 0b001,
}

interface NodeWithAttributes {
	[nodeAttributesSymbol]: NodeAttributes;
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

					if (isLayoutClassElement(token.content) && !token.attributes["xml:id"]) {
						nodeTree.push(createNodeWithAttributes(token, NodeAttributes.IGNORED));
						continue;
					}

					/**
					 * Checking if there's a region collision between a parent and a children.
					 * Regions will be evaluated when its end tag is received.
					 */

					if (
						isBlockClassElement(nodeTree.currentNode.content.content) ||
						(isInlineClassElement(nodeTree.currentNode.content.content) &&
							nodeTree.currentNode.content.content !== "br")
					) {
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

						/** Region attribute could be in any of the parents */
						const temporalActiveContext = readScopeTemporalActiveContext(treeScope);

						if (temporalActiveContext?.region) {
							const regionIdentifier: string | undefined = token.attributes["region"];

							/**
							 * @example (out-of-line regions definitions in head omitted)
							 *
							 * ```
							 * <div region="r1">
							 * 	<!-- paragraph element will get pruned by the ISD associated with Region `r1` -->
							 * 	<!-- Same would be valid with a different region on a span inside the `p` -->
							 * 	<p region="r2">...</p>
							 * </div>
							 *
							 * <!-- next div will get pruned as previous sibling
							 * 		 has a region but default region is not active. -->
							 * <div>...</div>
							 * ```
							 */
							if (temporalActiveContext.region.id !== regionIdentifier) {
								nodeTree.push(createNodeWithAttributes(token, NodeAttributes.IGNORED));
								continue;
							}

							/**
							 * If there's any [temporally active region], we have to
							 * ignore the parent element if we find an inline region
							 * element. The first step of _[construct intermediate document]_
							 * at _11.3.1.3 Intermediate Synchronic Document Construction_,
							 * defines that inline regions should be first resolved and
							 * converted to normal regions.
							 */

							/**
							 * @example
							 *
							 * |--------------------------------|--------------------------------------------------------------|
							 * | Before [process inline region]	|	 After [process inline region] 															 |
							 * |--------------------------------|--------------------------------------------------------------|
							 * | ```xml													| ```xml																											 |
							 * | 	<tt>													|		<tt>																											 |
							 * | 		<head>											|			<head>																									 |
							 * | 			<region xml:id="r1" />		|				<region xml:id="r1" />																 |
							 * | 																|				<region xml:id="__custom_id__" />	<!--   <--|   -->		 |
							 * | 		</head>											|			</head>															<!--      |   -->		 |
							 * | 		<body region="r1">					|			<body region="r1">									<!--      |   -->		 |
							 * | 			<div>											|				<div region="__custom_id__">			<!--      |   -->		 |
							 * | 				<region ... />					|																					<!--   >--|   -->		 |
							 * | 				<p>...</p>							|					<p>...</p>																					 |
							 * | 			</div>										|				</div>																								 |
							 * | 		</body>											|			</body>																									 |
							 * | 	</tt>													|		</tt>																											 |
							 * | ```														| ```																													 |
							 * |________________________________|______________________________________________________________|
							 *
							 * Therefore the div will end up being pruned, because of a different region.
							 * @see https://w3c.github.io/ttml2/#procedure-process-inline-regions
							 */
							if (isLayoutClassElement(token.content)) {
								appendNodeAttributes(nodeTree.currentNode.content, NodeAttributes.IGNORED);
								nodeTree.push(createNodeWithAttributes(token, NodeAttributes.IGNORED));
								continue;
							}
						} else if (token.attributes["region"]) {
							const regionContext = readScopeRegionContext(treeScope);

							if (
								regionContext.regions.some((region) => region.id === token.attributes["region"])
							) {
								treeScope = createScope(
									treeScope,
									createTimeContext({
										begin: token.attributes["begin"],
										dur: token.attributes["dur"],
										end: token.attributes["end"],
										timeContainer: token.attributes["timeContainer"],
									}),
									createTemporalActiveContext({
										regionIDRef: token.attributes["region"],
										stylesIDRefs: [],
									}),
								);
							}
						}
					}

					nodeTree.push(createNodeWithAttributes(token, NodeAttributes.NO_ATTRS));
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

					if (token.content === "tt") {
						nodeTree.pop();
						break;
					}

					const parentNode = nodeTree.currentNode.parent.content.content;

					/**
					 * Processing inline regions to be saved
					 */

					if (
						isBlockClassElement(parentNode) ||
						(isInlineClassElement(parentNode) && parentNode !== "br")
					) {
						if (token.content === "region") {
							/**
							 * if the `[attributes]` information item property of R does not include
							 * an `xml:id` attribute, then add an implied `xml:id` attribute with a
							 * generated value _ID_ that is unique within the scope of the TTML
							 * document instance;
							 *
							 * otherwise, let _ID_ be the value of the `xml:id` attribute of R;
							 */

							const regionId =
								token.attributes["xml:id"] ||
								`i_region-${
									nodeTree.currentNode.content.attributes["xml:id"] ||
									nodeTree.currentNode.parent.content.attributes["xml:id"]
								}`;

							const { children } = nodeTree.currentNode;

							const inlineRegion: RegionContainerContextState = {
								attributes: Object.create(token.attributes, {
									"xml:id": {
										value: regionId,
									},
								}),
								children,
							};

							treeScope = createScope(
								treeScope,
								createRegionContainerContext([inlineRegion]),
								createTemporalActiveContext({
									regionIDRef: regionId,
								}),
							);

							break;
						}
					}

					const currentTag = nodeTree.currentNode.content.content;

					/**
					 * Processing [out-of-line region]
					 * @see https://w3c.github.io/ttml2/#terms-out-of-line-region
					 */

					const currentElement = nodeTree.pop();

					if (currentTag === "layout") {
						const { children } = currentElement;

						const localRegions: RegionContainerContextState[] = [];

						for (const { content: tokenContent, children: regionChildren } of children) {
							if (tokenContent.content !== "region") {
								continue;
							}

							localRegions.push({ attributes: tokenContent.attributes, children: regionChildren });
						}

						treeScope.addContext(createRegionContainerContext(localRegions));

						break;
					}

					/**
					 * Processing out-of-line styles
					 */

					if (currentTag === "styling") {
						const { children } = currentElement;

						const styleTags = children.reduce<Record<string, Record<string, string>>>(
							(acc, { content: token }) => {
								if (token.content !== "style") {
									return acc;
								}

								if (!token.attributes["xml:id"]) {
									return acc;
								}

								acc[token.attributes["xml:id"]] = token.attributes;
								return acc;
							},
							{},
						);

						treeScope.addContext(createStyleContainerContext(styleTags));

						break;
					}

					if (currentTag === "p" || currentTag === "span") {
						const node = currentElement;
						cues.push(...parseCue(node, treeScope));

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
