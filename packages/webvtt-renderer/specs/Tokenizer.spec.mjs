/// <reference types="chai">
import { Tokenizer } from "../lib/Tokenizer.js";

describe("Tokenizer", () => {
	describe("[static]", () => {
		describe("parseHTMLEntity", () => {
			it("empty string should return current cursor", () => {
				const currentCursor = 4;
				chai.expect(Tokenizer.parseHTMLEntity("", currentCursor)).to.eql(["", currentCursor]);
			});

			it("should return current content and cursor if a whitespace is found", () => {
				const WHITE_SPACE_TEST_STRING = "am p;";
				chai.expect(Tokenizer.parseHTMLEntity(WHITE_SPACE_TEST_STRING, 0)).to.eql(["&am ", 2]);
			});

			it("should return current content and cursor if a newline is found", () => {
				const NEWLINE_TEST_STRING = "am\x0Ap;";
				chai.expect(Tokenizer.parseHTMLEntity(NEWLINE_TEST_STRING, 0)).to.eql(["&am\x0A", 2]);
			});

			it("should return current content and cursor if a '<' or another '&' are found", () => {
				const TAG_OPEN_STRING = "am<c.className> p";
				chai.expect(Tokenizer.parseHTMLEntity(TAG_OPEN_STRING, 0)).to.eql(["&am<", 2]);

				const HTML_ENTITY_IN_HTML_ENTITY_STRING = "am&amp;";
				chai
					.expect(Tokenizer.parseHTMLEntity(HTML_ENTITY_IN_HTML_ENTITY_STRING, 0))
					.to.eql(["&am&", 2]);
			});

			it("should return current content and cursor if allowed characters are passed and met", () => {
				const ADDITIONAL_CHARACTERS = [">"];
				const TEST_STRING = "amp> test;";

				chai
					.expect(Tokenizer.parseHTMLEntity(TEST_STRING, 0, ADDITIONAL_CHARACTERS))
					.to.eql(["&amp>", 3]);
			});

			/**
			 * Right now we are using DOMParser to achieve this task.
			 * If, in the future, we'll want to change content, we'll
			 * probably have to add more test cases parsed strings;
			 */

			it("should return a parsed content if a valid HTMLEntity is found in string", () => {
				const VALID_HTML_ENTITY_STRING = "amp;";
				chai.expect(Tokenizer.parseHTMLEntity(VALID_HTML_ENTITY_STRING, 0)).to.eql(["&", 3]);
			});
		});
	});

	xdescribe("[instance]", () => {});
});
