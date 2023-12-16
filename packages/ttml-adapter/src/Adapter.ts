import type { TimeDetails } from "./Parser/TimeBase/index.js";
import { BaseAdapter, CueNode, Region } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Token, TokenType } from "./Parser/Token.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
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

		let treeScope: Scope = createScope(undefined, createTimeContext({}), createStyleContext([]));
		let documentSettings: TimeDetails;

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

		return BaseAdapter.ParseResult([], []);
	}
}
