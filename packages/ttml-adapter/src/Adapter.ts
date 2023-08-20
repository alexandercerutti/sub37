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
	isStyleEndTagToken,
	isStyleTagToken,
} from "./Parser/Token.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import * as Tags from "./Parser/Tags/index.js";
import { parseStyle } from "./Parser/parseStyle.js";
import { parseRegion } from "./Parser/parseRegion.js";
import { LogicalGroupingContext } from "./Parser/LogicalGroupingContext.js";
import { assignParsedRootSupportedAttributes } from "./Parser/TTRootAttributes.js";
import { parseTimeString } from "./Parser/parseCue.js";

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
		const headTokensList: Array<Token | Array<Token>> = [];

		/**
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-attribute-style
		 * @see https://www.w3.org/TR/xmlschema-2/#IDREFS
		 */

		const documentSettings: TimeDetails = {
			"ttp:frameRate": undefined,
			"ttp:frameRateMultiplier": undefined,
			"ttp:subFrameRate": undefined,
			"ttp:tickRate": undefined,
			"ttp:timeBase": undefined,
			"ttp:dropMode": undefined,
		};

		const trackRegions: Region[] = [];
		const StyleIDREFSMap = new Map<string, TTMLStyle>([]);

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
						headTokensList.push(token, []);
						break;
					}

					if (isStyleTagToken(token)) {
						if (!headTokensList.length) {
							headTokensList.push(token);
							break;
						}

						if (isRegionStyleToken(token, openTagsQueue.current.parent.token)) {
							(headTokensList[headTokensList.length - 1] as Array<Token>).push(token);
							break;
						}

						headTokensList.unshift(token);
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

					if (!isTokenParentRelationshipRespected(token, openTagsQueue)) {
						parsingState ^= BlockType.IGNORED;
					} else {
						switch (token.content) {
							case "head": {
								parsingState = BlockType.HEAD;
								break;
							}
							case "body": {
								parsingState = BlockType.BODY;
								break;
							}
							case "p":
							case "div":
							case "span": {
								groupContext = new LogicalGroupingContext(groupContext);

								if (token.attributes["style"] && StyleIDREFSMap.has(token.attributes["style"])) {
									/**
									 * Adding styles. These might be already there in the chain of styles,
									 * so, later, we'll have to check them in order to not apply them twice
									 * or more.
									 */
									groupContext.addStyles(StyleIDREFSMap.get(token.attributes["style"]));
								}

								/**
								 * @TODO make duration to autofill the begin and the end
								 */

								groupContext.begin = parseTimeString(token.attributes["begin"], documentSettings);
								groupContext.end = parseTimeString(token.attributes["end"], documentSettings);
								groupContext.dur = parseTimeString(token.attributes["dur"], documentSettings);
								groupContext.timeContainer = token.attributes["timeContainer"];

								break;
							}
						}
					}

					openTagsQueue.push(new Tags.Node(undefined, token));

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

					if (token.content === "head") {
						for (let i = 0; i < headTokensList.length; i++) {
							const token = headTokensList[i] as Token;

							if (token.content === "region") {
								const styleTokens = headTokensList[i++] as Token[];
								let styles: TTMLStyle[] = [];

								for (let styleToken of styleTokens) {
									const style = getIDREFSChainedStyle(StyleIDREFSMap, parseStyle(styleToken));
									styles.push(style);
								}

								trackRegions.push(parseRegion(token, styles));
							}

							if (token.content === "style") {
								const style = getIDREFSChainedStyle(StyleIDREFSMap, parseStyle(token));
								groupContext.addStyles(style);

								const resolvedStyle = resolveIDREFSNameConflict(StyleIDREFSMap, style);
								StyleIDREFSMap.set(resolvedStyle.id, resolvedStyle);
							}
						}

						break;
					}

					if (isRegionEndTagToken(token)) {
						headTokensList.push(token, []);
						break;
					}

					if (isStyleEndTagToken(token)) {
						if (!headTokensList.length) {
							headTokensList.push(token);
							break;
						}

						if (isRegionStyleToken(token, openTagsQueue.current.parent.token)) {
							(headTokensList[headTokensList.length - 1] as Array<Token>).push(token);
							break;
						}

						headTokensList.unshift(token);
					}

					if (token.content === "div" || token.content === "p") {
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

	for (const direction of TokenRelationships[content]) {
		if (
			treeNode.token.content === direction &&
			isTokenParentRelationshipRespected(treeNode.token, openTagsQueue)
		) {
			return true;
		}
	}

	return false;
}

function isTokenTreeConstrained(content: string): content is keyof typeof TokenRelationships {
	return Object.prototype.hasOwnProperty.call(TokenRelationships, content);
}

function resolveIDREFSNameConflict(idrefsMap: Map<string, TTMLStyle>, style: TTMLStyle): TTMLStyle {
	if (!idrefsMap.has(style.id)) {
		return style;
	}

	let styleConflictOverrideIdentifier = parseInt(style.id.match(/--(\d{1,})/)?.[1]);

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return style;
	}

	while (idrefsMap.has(`${style.id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	style.id = style.id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);

	return style;
}

/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential
 * @param idrefsMap
 * @param style
 * @returns
 */

function getIDREFSChainedStyle(idrefsMap: Map<string, TTMLStyle>, style: TTMLStyle): TTMLStyle {
	const parentStyle = style.attributes["style"];

	if (!idrefsMap.has(parentStyle)) {
		return style;
	}

	const chainedStyleRef = idrefsMap.get(parentStyle);

	return {
		id: style.id,
		attributes: {
			...chainedStyleRef.attributes,
			...style.attributes,
		},
	};
}
