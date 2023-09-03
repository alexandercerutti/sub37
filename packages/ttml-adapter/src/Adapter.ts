import type { TTMLStyle } from "./Parser/parseStyle.js";
import type { TimeDetails } from "./Parser/TimeBase/index.js";
import { BaseAdapter, Region } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import {
	Token,
	TokenType,
	isRegionEndTagToken,
	isRegionStyleToken,
	isRegionTagToken,
	isStyleTagToken,
} from "./Parser/Token.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import * as Tags from "./Parser/Tags/index.js";
import { parseStyleFactory } from "./Parser/parseStyle.js";
import { parseRegion } from "./Parser/parseRegion.js";
import {
	LogicalGroupingContext,
	addContextBeginPoint,
	addContextDuration,
	addContextEndPoint,
	setTimeContainerType,
} from "./Parser/LogicalGroupingContext.js";
import { assignParsedRootSupportedAttributes } from "./Parser/TTRootAttributes.js";

enum BlockType {
	IGNORED /***/ = 0b0001,
	HEADER /****/ = 0b0010,
	HEAD /******/ = 0b0100,
	BODY /******/ = 0b1000,
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

		let parsingState: BlockType = BlockType.HEADER;
		const openTagsQueue = new Tags.NodeQueue();
		const parseStyle = parseStyleFactory();
		const globalStyles: TTMLStyle[] = [];

		const documentSettings: TimeDetails = {
			"ttp:frameRate": undefined,
			"ttp:frameRateMultiplier": undefined,
			"ttp:subFrameRate": undefined,
			"ttp:tickRate": undefined,
			"ttp:timeBase": undefined,
			"ttp:dropMode": undefined,
		};

		const regionsMap: Map<string, Region> = new Map();
		const regionStylesProcessingQueue: Token[] = [];

		let groupContext = new LogicalGroupingContext();

		const tokenizer = new Tokenizer(rawContent);

		let token: Token;

		while ((token = tokenizer.nextToken())) {
			switch (token.type) {
				case TokenType.TAG: {
					if (parsingState & BlockType.IGNORED) {
						continue;
					}

					if (!isTokenParentRelationshipRespected(token, openTagsQueue)) {
						continue;
					}

					if (isRegionTagToken(token)) {
						const region = parseRegion(token, []);

						if (regionsMap.has(region.id)) {
							/**
							 * @TODO should we resolve the conflict here
							 * or just ignore the region? Does the spec
							 * say something about?
							 *
							 * If resolving conflict, we should also
							 * resolve it when a region end tag happens.
							 */
							break;
						}

						regionsMap.set(region.id, region);
						break;
					}

					if (isStyleTagToken(token)) {
						if (isRegionStyleToken(token, openTagsQueue.current.parent.token)) {
							regionStylesProcessingQueue.push(token);
							break;
						}

						globalStyles.push(parseStyle(token));
					}

					break;
				}

				case TokenType.START_TAG: {
					if (parsingState & BlockType.IGNORED) {
						continue;
					}

					if (!openTagsQueue.length) {
						if (token.content !== "tt") {
							throw new Error("Malformed TTML track: starting tag must be a <tt> element");
						} else {
							assignParsedRootSupportedAttributes(token.attributes, documentSettings);
							continue;
						}
					}

					/**
					 * Even if token does not respect it parent relatioship,
					 * we still add it to the queue to mark its end
					 */
					openTagsQueue.push(new Tags.Node(undefined, token));

					if (!isTokenParentRelationshipRespected(token, openTagsQueue)) {
						parsingState ^= BlockType.IGNORED;
						break;
					}

					if (tokenSupportsLogicalGroupingSwitch(token)) {
						groupContext = new LogicalGroupingContext(groupContext);
					}

					if (isTokenAllowedToHaveRegion(token) && token.attributes["region"]) {
						/**
						 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-attribute-region
						 */
						groupContext.regionIdentifiers.push(token.attributes["region"]);
					}

					switch (token.content) {
						case "head": {
							parsingState = BlockType.HEAD;
							break;
						}
						case "body": {
							parsingState = BlockType.BODY;

							break;
						}
						case "style": {
							globalStyles.push(parseStyle(token));
							break;
						}
						case "p":
						case "div":
						case "span": {
							if (token.attributes["style"]) {
								const style = globalStyles.find((style) => style.id === token.attributes["style"]);

								if (style) {
									/**
									 * Adding styles. These might be already there in the chain of styles,
									 * so, later, we'll have to check them in order to not apply them twice
									 * or more.
									 */
									groupContext.addStyles(style);
								}
							}

							addContextBeginPoint(groupContext, token.attributes["begin"], documentSettings);
							addContextEndPoint(groupContext, token.attributes["end"], documentSettings);
							addContextDuration(groupContext, token.attributes["dur"], documentSettings);
							setTimeContainerType(groupContext, token.attributes["timeContainer"]);

							break;
						}
					}

					break;
				}

				case TokenType.END_TAG: {
					if (!openTagsQueue.length) {
						break;
					}

					const { current: currentNode } = openTagsQueue;

					if (currentNode.token.content !== token.content) {
						break;
					}

					if (parsingState & BlockType.IGNORED) {
						parsingState ^= BlockType.IGNORED;
						openTagsQueue.pop();
						continue;
					}

					if (isRegionEndTagToken(token)) {
						let regionOpeningNode = openTagsQueue.pop();

						while (regionOpeningNode.token.content !== token.content) {
							regionOpeningNode = openTagsQueue.pop();
						}

						if (regionsMap.has(regionOpeningNode.token.attributes["xml:id"])) {
							/**
							 * @TODO should we resolve the conflict here
							 * or just ignore the region? Does the spec
							 * say something about?
							 *
							 * If resolving conflict, we should also
							 * resolve it when a region self-closing tag happens.
							 */
							break;
						}

						const localStyleParser = parseStyleFactory();
						const styles: TTMLStyle[] = [];

						for (let styleToken of regionStylesProcessingQueue) {
							const style = localStyleParser(styleToken);

							if (!style) {
								continue;
							}

							styles.push(style);
						}

						regionStylesProcessingQueue.length = 0;

						const region = parseRegion(regionOpeningNode.token, styles);
						regionsMap.set(region.id, region);

						break;
					}

					if (tokenSupportsLogicalGroupingSwitch(token)) {
						/**
						 * Exiting current context. We don't need their things anymore.
						 * Things on "p" should get executed before this, otherwise we
						 * are going to use the wrong context.
						 */
						groupContext = groupContext.parent;
					}

					break;
				}
			}

			token = null;
		}

		return BaseAdapter.ParseResult([], []);
	}
}

/**
 * "body" and "region" are also supported but we treat them
 * in a different way. "body" is treated to be as global as
 * <tt> element (they share the same context).
 */

const LOGICAL_GROUP_TOKENS = ["div", "p", "span"] as const;
type LOGICAL_GROUP_TOKENS = typeof LOGICAL_GROUP_TOKENS;

function tokenSupportsLogicalGroupingSwitch(
	token: Token,
): token is Token & { content: (typeof LOGICAL_GROUP_TOKENS)[number] } {
	return LOGICAL_GROUP_TOKENS.includes(token.content as LOGICAL_GROUP_TOKENS[number]);
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

function isTokenParentRelationshipRespected(token: Token, openTagsQueue: Tags.NodeQueue): boolean {
	const { content } = token;

	if (!isTokenTreeConstrained(content)) {
		return true;
	}

	const treeNode: Tags.Node = openTagsQueue.current.parent;

	/**
	 * If we already reached the point of checking if a tag
	 * is in a parent, then we don't need to check the others
	 */
	for (const direction of TokenRelationships[content]) {
		if (treeNode.token.content === direction) {
			return true;
		}
	}

	return false;
}

function isTokenTreeConstrained(content: string): content is keyof typeof TokenRelationships {
	return Object.prototype.hasOwnProperty.call(TokenRelationships, content);
}

const REGION_ALLOWED_ELEMENTS = ["body", "div", "p", "span", "image"] as const;
type REGION_ALLOWED_ELEMENTS = typeof REGION_ALLOWED_ELEMENTS;

/**
 * @param token
 * @returns
 *
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-attribute-region
 */

function isTokenAllowedToHaveRegion(
	token: Token,
): token is Token & { content: REGION_ALLOWED_ELEMENTS[number] } {
	return REGION_ALLOWED_ELEMENTS.includes(token.content as REGION_ALLOWED_ELEMENTS[number]);
}
