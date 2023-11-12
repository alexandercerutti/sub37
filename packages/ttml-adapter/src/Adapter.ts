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
import { parseDocumentSupportedAttributes } from "./Parser/TTRootAttributes.js";
import {
	type BlockTuple,
	getNextContentBlock,
	isDocumentBlockTuple,
	isLayoutBlockTuple,
	isStyleBlockTuple,
	isContentElementBlockTuple,
	isCueBlockTuple,
	isSelfClosingBlockTuple,
	DocumentBlockTuple,
	LayoutBlockTuple,
	StyleBlockTuple,
	ContentElementBlockTuple,
	CueBlockTuple,
	SelfClosingBlockTuple,
} from "./Parser/ContentBlockReader.js";

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

		let documentSettings: TimeDetails;

		const regionsMap: Map<string, Region> = new Map();

		let groupContext = new LogicalGroupingContext();

		const tokenizer = new Tokenizer(rawContent);
		const blockReader = getNextContentBlock(tokenizer);

		let block: IteratorResult<BlockTuple, BlockTuple>;

		while ((block = blockReader.next())) {
			const { done, value } = block;

			if (done) {
				if (!documentSettings) {
					throw new Error(`Document failed to parse: <tt> element is apparently missing.`);
				}

				break;
			}

			switch (true) {
				/**
				 * @TODO upgrade to Typescript 5.3 after Nov 14
				 * to have Control Flow Access to narrow value
				 * when using switch (true).
				 */
				case isDocumentBlockTuple(value): {
					if (documentSettings) {
						/**
						 * @TODO Change in a fatal error;
						 */
						throw new Error("Malformed TTML track: multiple <tt> were found.");
					}

					const block: DocumentBlockTuple[1] = value[1];

					documentSettings = parseDocumentSupportedAttributes(block.content.attributes || {});
					break;
				}

				case isLayoutBlockTuple(value): {
					const block: LayoutBlockTuple[1] = value[1];

					const { children } = block;

					for (const { content: regionToken, children: regionChildren } of children) {
						if (regionToken.content !== "region") {
							continue;
						}

						const styleTokenChildren = regionChildren
							.filter((children) => children.content.content === "style")
							.map((children) => children.content);

						const region = parseRegion(regionToken, styleTokenChildren);

						if (regionsMap.has(region.id)) {
							/**
							 * @TODO should we resolve the conflict here
							 * or just ignore the region? Does the spec
							 * say something about?
							 *
							 * If resolving conflict, we should also
							 * resolve it when a region end tag happens.
							 */
							continue;
						}

						regionsMap.set(region.id, region);
					}

					break;
				}

				case isStyleBlockTuple(value): {
					const block: StyleBlockTuple[1] = value[1];
					const { children } = block;

					for (const { content: tagToken } of children) {
						if (tagToken.content !== "style") {
							continue;
						}

						globalStyles.push(parseStyle(tagToken));
					}

					break;
				}

				case isContentElementBlockTuple(value): {
					const block: ContentElementBlockTuple[1] = value[1];
					break;
				}

				case isCueBlockTuple(value): {
					const block: CueBlockTuple[1] = value[1];
					break;
				}

				case isSelfClosingBlockTuple(value): {
					const block: SelfClosingBlockTuple[1] = value[1];
					break;
				}
			}
		}

		// while ((token = tokenizer.nextToken())) {
		// 	switch (token.type) {
		// 		case TokenType.TAG: {
		// 			if (parsingState & BlockType.IGNORED) {
		// 				continue;
		// 			}

		// 			if (!isTokenParentRelationshipRespected(token, openTagsQueue)) {
		// 				continue;
		// 			}

		// 			if (isRegionTagToken(token)) {
		// 				const region = parseRegion(token, []);

		// 				if (regionsMap.has(region.id)) {
		// 					/**
		// 					 * @TODO should we resolve the conflict here
		// 					 * or just ignore the region? Does the spec
		// 					 * say something about?
		// 					 *
		// 					 * If resolving conflict, we should also
		// 					 * resolve it when a region end tag happens.
		// 					 */
		// 					break;
		// 				}

		// 				regionsMap.set(region.id, region);
		// 				break;
		// 			}

		// 			if (isStyleTagToken(token)) {
		// 				if (isRegionStyleToken(token, parentNodeContent.token)) {
		// 					regionStylesProcessingQueue.push(token);
		// 					break;
		// 				}

		// 				globalStyles.push(parseStyle(token));
		// 			}

		// 			break;
		// 		}

		// 		case TokenType.START_TAG: {
		// 			if (parsingState & BlockType.IGNORED) {
		// 				continue;
		// 			}

		// 			if (!openTagsQueue.length) {
		// 				if (token.content !== "tt") {
		// 					throw new Error("Malformed TTML track: starting tag must be a <tt> element");
		// 				} else {
		// 					assignParsedRootSupportedAttributes(token.attributes, documentSettings);
		// 					continue;
		// 				}
		// 			}

		// 			/**
		// 			 * Even if token does not respect it parent relatioship,
		// 			 * we still add it to the queue to mark its end
		// 			 */
		// 			// openTagsQueue.push(new Tags.Node(undefined, token));
		// 			openTagsQueue.push(createTokenNode(token, groupContext));

		// 			if (!isTokenParentRelationshipRespected(token, openTagsQueue)) {
		// 				parsingState ^= BlockType.IGNORED;
		// 				break;
		// 			}

		// 			if (tokenSupportsLogicalGroupingSwitch(token)) {
		// 				groupContext = new LogicalGroupingContext(groupContext);
		// 			}

		// 			if (isTokenAllowedToHaveRegion(token) && token.attributes["region"]) {
		// 				/**
		// 				 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-attribute-region
		// 				 */
		// 				groupContext.regionIdentifiers.push(token.attributes["region"]);
		// 			}

		// 			switch (token.content) {
		// 				case "head": {
		// 					parsingState = BlockType.HEAD;
		// 					break;
		// 				}
		// 				case "body": {
		// 					parsingState = BlockType.BODY;

		// 					break;
		// 				}
		// 				case "style": {
		// 					globalStyles.push(parseStyle(token));
		// 					break;
		// 				}
		// 				case "p":
		// 				case "div":
		// 				case "span": {
		// 					if (token.attributes["style"]) {
		// 						const style = globalStyles.find((style) => style.id === token.attributes["style"]);

		// 						if (style) {
		// 							/**
		// 							 * Adding styles. These might be already there in the chain of styles,
		// 							 * so, later, we'll have to check them in order to not apply them twice
		// 							 * or more.
		// 							 */
		// 							groupContext.addStyles(style);
		// 						}
		// 					}

		// 					addContextBeginPoint(groupContext, token.attributes["begin"], documentSettings);
		// 					addContextEndPoint(groupContext, token.attributes["end"], documentSettings);
		// 					addContextDuration(groupContext, token.attributes["dur"], documentSettings);
		// 					setTimeContainerType(groupContext, token.attributes["timeContainer"]);

		// 					break;
		// 				}
		// 			}

		// 			break;
		// 		}

		// 		case TokenType.END_TAG: {
		// 			if (!openTagsQueue.length) {
		// 				break;
		// 			}

		// 			const { current: currentNode } = openTagsQueue;

		// 			if (currentNode.nodeContent.name !== token.content) {
		// 				break;
		// 			}

		// 			if (parsingState & BlockType.IGNORED) {
		// 				parsingState ^= BlockType.IGNORED;
		// 				openTagsQueue.pop();
		// 				continue;
		// 			}

		// 			if (isRegionEndTagToken(token)) {
		// 				let regionOpeningNode = openTagsQueue.pop();

		// 				while (regionOpeningNode.nodeContent.name !== token.content) {
		// 					regionOpeningNode = openTagsQueue.pop();
		// 				}

		// 				if (regionsMap.has(regionOpeningNode.nodeContent.attributes["xml:id"])) {
		// 					/**
		// 					 * @TODO should we resolve the conflict here
		// 					 * or just ignore the region? Does the spec
		// 					 * say something about?
		// 					 *
		// 					 * If resolving conflict, we should also
		// 					 * resolve it when a region self-closing tag happens.
		// 					 */
		// 					regionStylesProcessingQueue.length = 0;
		// 					break;
		// 				}

		// 				const localStyleParser = parseStyleFactory();
		// 				const styles: TTMLStyle[] = [];

		// 				for (let styleToken of regionStylesProcessingQueue) {
		// 					const style = localStyleParser(styleToken);

		// 					if (!style) {
		// 						continue;
		// 					}

		// 					styles.push(style);
		// 				}

		// 				regionStylesProcessingQueue.length = 0;

		// 				const region = parseRegion(regionOpeningNode.nodeContent.token, styles);
		// 				regionsMap.set(region.id, region);

		// 				break;
		// 			}

		// 			if (tokenSupportsLogicalGroupingSwitch(token)) {
		// 				/**
		// 				 * Exiting current context. We don't need their things anymore.
		// 				 * Things on "p" should get executed before this, otherwise we
		// 				 * are going to use the wrong context.
		// 				 */
		// 				groupContext = groupContext.parent;
		// 			}

		// 			break;
		// 		}
		// 	}

		// 	token = null;
		// }

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
): token is Token & { content: LOGICAL_GROUP_TOKENS[number] } {
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
