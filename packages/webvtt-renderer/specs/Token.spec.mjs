// @ts-check
/// <reference types="chai">
import { Token, TokenType } from "../lib/Token.js";

describe("Token", () => {
	/** @type {Token} */
	let token;

	describe("::String", () => {
		beforeEach(() => {
			token = Token.String("test content", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			chai.expect(token.type).to.equal(TokenType.STRING);
			chai.expect(token.length).to.equal(5);
			chai.expect(token.offset).to.equal(10);
		});

		it("should not have classes", () => {
			chai.expect(token.classes).to.be.undefined;
		});

		it("should not have annotations", () => {
			chai.expect(token.annotations).to.be.undefined;
		});

		it("should bring the content as-is", () => {
			chai.expect(token.content).to.equal("test content");
		});
	});

	describe("::StartTag", () => {
		beforeEach(() => {
			token = Token.StartTag("b", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			chai.expect(token.type).to.equal(TokenType.START_TAG);
			chai.expect(token.length).to.equal(5);
			chai.expect(token.offset).to.equal(10);
		});

		it("should retain classes", () => {
			const token = Token.StartTag("b", { start: 10, end: 15 }, ["className"]);
			chai.expect(token.classes).to.eql(["className"]);
		});

		it("should retain annotations", () => {
			const token = Token.StartTag("b", { start: 10, end: 15 }, undefined, "Fred");
			chai.expect(token.annotations).to.be.equal("Fred");
		});

		it("should set classes to empty array if none is available", () => {
			chai.expect(token.classes).to.eql([]);
		});

		it("should set annotations to empty array if none is available", () => {
			chai.expect(token.annotations).to.be.eql([]);
		});

		it("should bring the content as-is", () => {
			chai.expect(token.content).to.equal("b");
		});
	});

	describe("::EndTag", () => {
		beforeEach(() => {
			token = Token.EndTag("b", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			chai.expect(token.type).to.equal(TokenType.END_TAG);
			chai.expect(token.length).to.equal(5);
			chai.expect(token.offset).to.equal(10);
		});

		it("should not have classes", () => {
			chai.expect(token.classes).to.be.undefined;
		});

		it("should not have annotations", () => {
			chai.expect(token.annotations).to.be.undefined;
		});

		it("should bring the content as-is", () => {
			chai.expect(token.content).to.equal("b");
		});
	});

	describe("::TimestampTag", () => {
		beforeEach(() => {
			token = Token.TimestampTag("00.02.22:000", { start: 10, end: 15 });
		});

		it("should own a length and an offset", () => {
			chai.expect(token.type).to.equal(TokenType.TIMESTAMP);
			chai.expect(token.length).to.equal(5);
			chai.expect(token.offset).to.equal(10);
		});

		it("should not have classes", () => {
			chai.expect(token.classes).to.be.undefined;
		});

		it("should not have annotations", () => {
			chai.expect(token.annotations).to.be.undefined;
		});

		it("should bring the content as-is", () => {
			chai.expect(token.content).to.equal("00.02.22:000");
		});
	});
});
