import { BaseAdapter } from "@sub37/server";
import { MissingContentError } from "./MissingContentError.js";
import { Token, TokenType } from "./Parser/Token.js";
import { Tokenizer } from "./Parser/Tokenizer.js";
import * as Tags from "./Parser/Tags/index.js";

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

					if (openTagsQueue.length) {
						openTagsQueue.push(new Tags.Node(undefined, token));
					}

					break;
				}

				case TokenType.START_TAG: {
					if (parsingState & BlockType.IGNORED) {
						continue;
					}

					if (!openTagsQueue.length && token.content !== "tt") {
						throw new Error("Malformed TTML track: starting tag must be a <tt> element");
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
					}

					if (isTokenParentRelationshipRespected(token, openTagsQueue)) {
						parsingState ^= BlockType.IGNORED;
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
						/**
						 * @TODO parse styles
						 * @TODO parse regions
						 * @TODO parse regions' styles
						 * @TODO cross-links all the styles
						 */

						break;
					}

					if (token.content === "region") {
						headTokensList.push(token, []);
						break;
					}

					if (token.content === "style") {
						if (!headTokensList.length) {
							headTokensList.push(token);
							break;
						}

						if (openTagsQueue.current.parent.token.content === "region") {
							(headTokensList[headTokensList.length - 1] as Array<Token>).push(token);
							break;
						}

						headTokensList.unshift(token);
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
} as const;

function isTokenParentRelationshipRespected(token: Token, openTagsQueue: Tags.NodeQueue): boolean {
	const { content } = token;

	if (!isTokenTreeConstrained(content)) {
		return true;
	}

	let treeToken: Tags.Node = openTagsQueue.current.parent;

	for (const direction of TokenRelationships[content]) {
		if (
			treeToken.token.content === direction &&
			isTokenParentRelationshipRespected(treeToken.token, openTagsQueue)
		) {
			return true;
		}
	}

	return false;
}

function isTokenTreeConstrained(content: string): content is keyof typeof TokenRelationships {
	return Object.prototype.hasOwnProperty.call(TokenRelationships, content);
}
