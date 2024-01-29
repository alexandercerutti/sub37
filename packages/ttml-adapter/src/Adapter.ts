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
import { NodeWithRelationship } from "./Parser/Tags/NodeTree.js";
import { parseCue } from "./Parser/parseCue.js";

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

					const styleTags = children.reduce<Record<string, string>>((acc, { content: token }) => {
						if (token.content !== "style") {
							return acc;
						}

						return Object.assign(acc, token.attributes);
					}, {});

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
					const node = value[1];
					cues.push(...parseCue(node, treeScope, documentSettings));

					break;
				}

				case isSelfClosingBlockTuple(value): {
					break;
				}
			}
		}

		return BaseAdapter.ParseResult(cues, []);
	}
}
