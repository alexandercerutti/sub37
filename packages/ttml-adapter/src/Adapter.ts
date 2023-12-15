import type { TimeDetails } from "./Parser/TimeBase/index.js";
import { BaseAdapter, CueNode, Region } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Token, TokenType } from "./Parser/Token.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import { LogicalGroupingContext } from "./Parser/LogicalGroupingContext.js";
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
} from "./Parser/ContentBlockReader.js";
import { createScope, type Scope } from "./Parser/Scope/Scope.js";
import { createTimeContext } from "./Parser/Scope/TimeContext.js";
import { createStyleContext } from "./Parser/Scope/StyleContext.js";
import { createRegionContext } from "./Parser/Scope/RegionContext.js";
import { parseTimeString } from "./Parser/parseCue.js";
import { NodeWithRelationship } from "./Parser/Tags/NodeTree.js";

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
		let treeScope: Scope = createScope(undefined, createTimeContext({}), createStyleContext([]));
		let documentSettings: TimeDetails;

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
				case isDocumentBlockTuple(value): {
					if (documentSettings) {
						/**
						 * @TODO Change in a fatal error;
						 */
						throw new Error("Malformed TTML track: multiple <tt> were found.");
					}

					documentSettings = parseDocumentSupportedAttributes(value[1].content.attributes || {});
					break;
				}

				case isLayoutBlockTuple(value): {
					const { children } = value[1];

					const localRegions: {
						region: Token;
						children: NodeWithRelationship<Token>[];
					}[] = [];

					for (const { content: regionToken, children: regionChildren } of children) {
						if (regionToken.content !== "region") {
							continue;
						}

						localRegions.push({ region: regionToken, children: regionChildren });
					}

					treeScope.addContext(createRegionContext(localRegions));

					break;
				}

				case isStyleBlockTuple(value): {
					const { children } = value[1];

					const styleTags = children
						.filter(({ content: token }) => token.content === "style")
						.map(({ content }) => content);

					treeScope.addContext(createStyleContext(styleTags));

					break;
				}

				case isContentElementBlockTuple(value): {
					if (
						treeScope.parent &&
						value[1].parent.content.content !== "div" &&
						value[1].content.content === "div"
					) {
						treeScope = treeScope.parent;
					}

					const localRegions: { region: Token; children: NodeWithRelationship<Token>[] }[] = [];

					for (const { content: token, children } of value[1].children) {
						switch (token.content) {
							case "region": {
								localRegions.push({
									region: token,
									children,
								});
							}
						}
					}

					treeScope = createScope(treeScope, createRegionContext(localRegions));

					break;
				}

				case isCueBlockTuple(value): {
					const { attributes } = value[1].content;

					const timeContainer =
						attributes["timeContainer"] === "par" || attributes["timeContainer"] === "seq"
							? attributes["timeContainer"]
							: undefined;

					const regionTokens: { region: Token; children: NodeWithRelationship<Token>[] }[] = [];

					for (const { content, children } of value[1].children) {
						if (content.content === "region") {
							regionTokens.push({ region: content, children });
						}
					}

					const localScope = createScope(
						treeScope,
						createTimeContext({
							begin: parseTimeString(attributes["begin"], documentSettings),
							dur: parseTimeString(attributes["end"], documentSettings),
							end: parseTimeString(attributes["dur"], documentSettings),
							timeContainer: timeContainer,
						}),
						createRegionContext(regionTokens),
					);

					for (const { content } of value[1].children) {
						if (content.type === TokenType.STRING) {
							/**
							 * @TODO add text to current cue
							 */
							continue;
						}

						if (content.content === "span") {
							const { attributes } = content;

							const spanScope = createScope(
								localScope,
								createTimeContext({
									begin: parseTimeString(attributes["begin"], documentSettings),
									dur: parseTimeString(attributes["end"], documentSettings),
									end: parseTimeString(attributes["dur"], documentSettings),
									timeContainer: timeContainer,
								}),
							);

							/**
							 * @TODO understand if we should emit a new cue or add it to
							 * current one
							 */
						}
					}

					break;
				}

				case isSelfClosingBlockTuple(value): {
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

