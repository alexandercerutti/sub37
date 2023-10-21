// @ts-check

import { describe, it, expect } from "@jest/globals";
import { Tokenizer } from "../lib/Parser/Tokenizer.js";
import { Token, TokenType } from "../lib/Parser/Token.js";

describe("Tokenizer", () => {
	describe("Tokenization", () => {
		it("should return a ProcessingInstruction, if available", () => {
			const content = `
			<?xml version="1.0" encoding="UTF-8" standalone="no"?>
			`;
			const tokenizer = new Tokenizer(content);
			const result = tokenizer.nextToken();

			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Token);
			expect(result?.type).toBe(TokenType.PROCESSING_INSTRUCTION);

			/**
			 * We expect these two tests to fail, if one day we'll start
			 * to support ProcessingInstruction validation
			 */
			expect(result?.content).toBe("ProcessingInstruction");
			expect(result?.attributes).toEqual({});
		});

		it("should return a ValidationEntity, if available", () => {
			// Space on purpose
			const content = `
						<!ENTITY d "&#xD;">
				<!ENTITY a "&#xA;">
				<!ENTITY da "&#xD;&#xA;">
			`;
			const tokenizer = new Tokenizer(content);
			const result = tokenizer.nextToken();

			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Token);
			expect(result?.type).toBe(TokenType.VALIDATION_ENTITY);

			/**
			 * We expect these two tests to fail, if one day we'll start
			 * to support ValidationEntity validation
			 */
			expect(result?.content).toBe("ValidationEntity");
			expect(result?.attributes).toEqual({});
		});

		it("should return a CData, if available", () => {
			const content = `
				<![CDATA[<greeting>Hello, world!</greeting>]]> 
			`;
			const tokenizer = new Tokenizer(content);
			const result = tokenizer.nextToken();

			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Token);
			expect(result?.type).toBe(TokenType.CDATA);

			/**
			 * We expect these two tests to fail, if one day we'll start
			 * to support CDATA validation
			 */
			expect(result?.content).toBe("CDATA Tag");
			expect(result?.attributes).toEqual({});
		});

		it("should return a Comment, if available", () => {
			const content = `
				<!-- I'm just a useless comment. Don't you feel a bit like me? -->
			`;
			const tokenizer = new Tokenizer(content);
			const result = tokenizer.nextToken();

			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Token);
			expect(result?.type).toBe(TokenType.COMMENT);
			expect(result?.content).toBe("Comment Tag");
			expect(result?.attributes).toEqual({});
		});

		it("should return a self-closing tag with all of its attributes", () => {
			const content = `
				<style
					xml:id="s1"
					tts:color="white"
					tts:fontFamily="proportionalSansSerif"
					tts:fontSize="22px"
					tts:textAlign="center"
				/>
			`;
			const tokenizer = new Tokenizer(content);
			const result = tokenizer.nextToken();

			expect(result).not.toBeNull();
			expect(result).toBeInstanceOf(Token);
			expect(result?.type).toBe(TokenType.TAG);
			expect(result?.content).toBe("style");
			expect(result?.attributes).toEqual({
				"xml:id": "s1",
				"tts:color": "white",
				"tts:fontFamily": "proportionalSansSerif",
				"tts:fontSize": "22px",
				"tts:textAlign": "center",
			});
		});

		it("should return a couple of tags with all of their attributes (with children)", () => {
			/**
			 * For XML specification, having tabs and spaces
			 * in strings (like after the parenthesis), is allowed.
			 *
			 * So, when testing, we might check them too. Yeah, they
			 * would suck in a content.
			 * Also having a bracket on a new line would suck, but it
			 * is more readable here.
			 */
			const content = `
				<p begin="342010001t" end="365370003t"
				region="region_00" tts:extent="35.00% 5.33%"
				tts:origin="30.00% 79.29%" xml:id="subtitle1"
				>
					(alarm beeping,<strong>Jane gasps</strong>)
				</p>
			`;
			const tokenizer = new Tokenizer(content);

			/**
			 * @type {Token[]}
			 */
			const tokens = [];

			/**
			 * @type {Token | null}
			 */

			let token;

			while ((token = tokenizer.nextToken()) !== null) {
				tokens.push(token);
			}

			const [
				pStartToken,
				stringToken1,
				strongStartToken,
				stringToken2,
				strongEndToken,
				stringToken3,
				pEndToken,
			] = tokens;

			expect(pStartToken).not.toBeNull();
			expect(pStartToken).toBeInstanceOf(Token);
			expect(pStartToken?.type).toBe(TokenType.START_TAG);
			expect(pStartToken?.content).toBe("p");
			expect(pStartToken?.attributes).toMatchObject({
				begin: "342010001t",
				end: "365370003t",
				region: "region_00",
				"tts:extent": "35.00% 5.33%",
				"tts:origin": "30.00% 79.29%",
				"xml:id": "subtitle1",
			});

			expect(stringToken1).not.toBeNull();
			expect(stringToken1).toBeInstanceOf(Token);
			expect(stringToken1?.type).toBe(TokenType.STRING);
			expect(stringToken1?.content).toBe("(alarm beeping,");
			expect(stringToken1?.attributes).toMatchObject({});

			expect(strongStartToken).not.toBeNull();
			expect(strongStartToken).toBeInstanceOf(Token);
			expect(strongStartToken?.type).toBe(TokenType.START_TAG);
			expect(strongStartToken?.content).toBe("strong");
			expect(strongStartToken?.attributes).toMatchObject({});

			expect(stringToken2).not.toBeNull();
			expect(stringToken2).toBeInstanceOf(Token);
			expect(stringToken2?.type).toBe(TokenType.STRING);
			expect(stringToken2?.content).toBe("Jane gasps");
			expect(stringToken2?.attributes).toMatchObject({});

			expect(strongEndToken).not.toBeNull();
			expect(strongEndToken).toBeInstanceOf(Token);
			expect(strongEndToken?.type).toBe(TokenType.END_TAG);
			expect(strongEndToken?.content).toBe("strong");
			expect(strongEndToken?.attributes).toMatchObject({});

			expect(stringToken3).not.toBeNull();
			expect(stringToken3).toBeInstanceOf(Token);
			expect(stringToken3?.type).toBe(TokenType.STRING);
			expect(stringToken3?.content).toBe(")\n\t\t\t\t");
			expect(stringToken3?.attributes).toMatchObject({});

			expect(pEndToken).not.toBeNull();
			expect(pEndToken).toBeInstanceOf(Token);
			expect(pEndToken?.type).toBe(TokenType.END_TAG);
			expect(pEndToken?.content).toBe("p");
			expect(pEndToken?.attributes).toMatchObject({});
		});

		it("should return a couple of tags with all of their attributes (no children)", () => {
			const content = `<p begin="342010001t" xml:id="subtitle1"></p>`;
			const tokenizer = new Tokenizer(content);
			const [startToken, endToken] = [tokenizer.nextToken(), tokenizer.nextToken()];

			expect(startToken).not.toBeNull();
			expect(startToken).toBeInstanceOf(Token);
			expect(startToken?.type).toBe(TokenType.START_TAG);
			expect(startToken?.content).toBe("p");
			expect(startToken?.attributes).toEqual({
				begin: "342010001t",
				"xml:id": "subtitle1",
			});

			expect(endToken).not.toBeNull();
			expect(endToken).toBeInstanceOf(Token);
			expect(endToken?.type).toBe(TokenType.END_TAG);
			expect(endToken?.content).toBe("p");
			expect(endToken?.attributes).toEqual({});
		});

		it("should accept a token with an attribute surrounded by spaces", () => {
			const content = `<p begin = "342010001t" xml:id="subtitle1"></p>`;
			const tokenizer = new Tokenizer(content);
			const startToken = tokenizer.nextToken();

			expect(startToken).not.toBeNull();
			expect(startToken).toBeInstanceOf(Token);
			expect(startToken?.type).toBe(TokenType.START_TAG);
			expect(startToken?.attributes["begin"]).not.toBeUndefined();
			expect(startToken?.attributes["begin"]).toBe("342010001t");
		});

		it("should accept a token with an attribute on a new line", () => {
			const content = `<p begin =
				"342010001t
			"
			xml:id="subtitle1"></p>`;
			const tokenizer = new Tokenizer(content);
			const startToken = tokenizer.nextToken();

			expect(startToken).not.toBeNull();
			expect(startToken).toBeInstanceOf(Token);
			expect(startToken?.type).toBe(TokenType.START_TAG);
			expect(startToken?.attributes["begin"]).not.toBeUndefined();
			expect(startToken?.attributes["begin"]).toBe("342010001t");
		});
	});
});
