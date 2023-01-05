// @ts-check
import { describe, beforeEach, it, expect } from "@jest/globals";
import { Token, TokenType } from "../lib/Token.js";

describe("Token", () => {
	/** @type {Token} */
	let token;

	describe("::String", () => {
		beforeEach(() => {
			token = Token.String("test content", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			expect(token.type).toBe(TokenType.STRING);
			expect(token.length).toBe(5);
			expect(token.offset).toBe(10);
		});

		it("should not have classes", () => {
			expect(token.classes).toBeUndefined();
		});

		it("should not have annotations", () => {
			expect(token.annotations).toBeUndefined();
		});

		it("should bring the content as-is", () => {
			expect(token.content).toBe("test content");
		});
	});

	describe("::StartTag", () => {
		beforeEach(() => {
			token = Token.StartTag("b", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			expect(token.type).toBe(TokenType.START_TAG);
			expect(token.length).toBe(5);
			expect(token.offset).toBe(10);
		});

		it("should retain classes", () => {
			const token = Token.StartTag("b", { start: 10, end: 15 }, ["className"]);
			expect(token.classes).toEqual(["className"]);
		});

		it("should retain annotations", () => {
			const token = Token.StartTag("b", { start: 10, end: 15 }, undefined, ["Fred"]);
			expect(token.annotations).toEqual(["Fred"]);
		});

		it("should set classes to empty array if none is available", () => {
			expect(token.classes).toEqual([]);
		});

		it("should set annotations to empty array if none is available", () => {
			expect(token.annotations).toEqual([]);
		});

		it("should bring the content as-is", () => {
			expect(token.content).toBe("b");
		});
	});

	describe("::EndTag", () => {
		beforeEach(() => {
			token = Token.EndTag("b", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			expect(token.type).toBe(TokenType.END_TAG);
			expect(token.length).toBe(5);
			expect(token.offset).toBe(10);
		});

		it("should not have classes", () => {
			expect(token.classes).toBeUndefined();
		});

		it("should not have annotations", () => {
			expect(token.annotations).toBeUndefined();
		});

		it("should bring the content as-is", () => {
			expect(token.content).toBe("b");
		});
	});

	describe("::TimestampTag", () => {
		beforeEach(() => {
			token = Token.TimestampTag("00.02.22:000", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			expect(token.type).toBe(TokenType.TIMESTAMP);
			expect(token.length).toBe(5);
			expect(token.offset).toBe(10);
		});

		it("should not have classes", () => {
			expect(token.classes).toBeUndefined();
		});

		it("should not have annotations", () => {
			expect(token.annotations).toBeUndefined();
		});

		it("should bring the content as-is", () => {
			expect(token.content).toBe("00.02.22:000");
		});
	});
});
