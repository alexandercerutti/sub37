// @ts-check
import { describe, beforeEach, it, expect } from "@jest/globals";
import { Tokenizer } from "../lib/Tokenizer.js";
import { Token, TokenType } from "../lib/Token.js";

describe("Tokenizer", () => {
	describe("[static]", () => {
		describe("parseHTMLEntity", () => {
			it("empty string should return current cursor", () => {
				/** @type {number} */
				const currentCursor = 4;
				expect(Tokenizer.parseHTMLEntity("", currentCursor)).toEqual(["", currentCursor]);
			});

			it("should return current content and cursor if a whitespace is found", () => {
				const WHITE_SPACE_TEST_STRING = "am p;";
				expect(Tokenizer.parseHTMLEntity(WHITE_SPACE_TEST_STRING, 0)).toEqual(["&am ", 2]);
			});

			it("should return current content and cursor if a newline is found", () => {
				const NEWLINE_TEST_STRING = "am\x0Ap;";
				expect(Tokenizer.parseHTMLEntity(NEWLINE_TEST_STRING, 0)).toEqual(["&am\x0A", 2]);
			});

			it("should return current content and cursor if a '<' or another '&' are found", () => {
				const TAG_OPEN_STRING = "am<c.className> p";
				expect(Tokenizer.parseHTMLEntity(TAG_OPEN_STRING, 0)).toEqual(["&am<", 2]);

				const HTML_ENTITY_IN_HTML_ENTITY_STRING = "am&amp;";

				expect(Tokenizer.parseHTMLEntity(HTML_ENTITY_IN_HTML_ENTITY_STRING, 0)).toEqual([
					"&am&",
					2,
				]);
			});

			it("should return current content and cursor if allowed characters are passed and met", () => {
				const ADDITIONAL_CHARACTERS = [">"];
				const TEST_STRING = "amp> test;";

				expect(Tokenizer.parseHTMLEntity(TEST_STRING, 0, ADDITIONAL_CHARACTERS)).toEqual([
					"&amp>",
					3,
				]);
			});

			/**
			 * Right now we are using DOMParser to achieve this task.
			 * If, in the future, we'll want to change content, we'll
			 * probably have to add more test cases parsed strings;
			 */

			it("should return a parsed content if a valid HTMLEntity is found in string", () => {
				const VALID_HTML_ENTITY_STRING = "amp;";
				expect(Tokenizer.parseHTMLEntity(VALID_HTML_ENTITY_STRING, 0)).toEqual(["&", 3]);
			});
		});

		describe("isWhitespace", () => {
			it("should match actual whitespace", () => {
				expect(Tokenizer.isWhitespace(" ")).toBe(true);
			});

			it("should match tabulation character", () => {
				expect(Tokenizer.isWhitespace("\x09")).toBe(true);
			});

			it("should match form feed (page break) character", () => {
				expect(Tokenizer.isWhitespace("\x0C")).toBe(true);
			});

			it("should not match new line", () => {
				expect(Tokenizer.isWhitespace("\x0A")).toBe(false);
			});
		});

		describe("isNewline", () => {
			it("should match only new lines", () => {
				const NEWLINE = "\x0A";
				const NOT_NEWLINE = "a";
				expect(Tokenizer.isNewLine(NEWLINE)).toBe(true);
				expect(Tokenizer.isNewLine(NOT_NEWLINE)).toBe(false);
			});
		});
	});

	describe("[instance]", () => {
		let tokenizerInstance;

		beforeEach(() => {
			// tokenizerInstance = new Tokenizer();
		});

		describe("nextToken", () => {
			it("should not return a token if tokenizer instance's cursor is greater than content length", () => {
				const tokenizer = new Tokenizer("mocked content");
				// @ts-ignore
				tokenizer.cursor = tokenizer.rawContent.length;
				expect(tokenizer.nextToken()).toBeNull();
			});

			it("should return null if no more content is available", () => {
				const tokenizer = new Tokenizer("mocked content");
				tokenizer.nextToken();

				expect(tokenizer.nextToken()).toBeNull();
			});

			it("should return a string token if rawContent contains only a string", () => {
				const tokenizer = new Tokenizer("mocked content");
				const nextToken = tokenizer.nextToken();

				expect(nextToken).toBeInstanceOf(Token);
				expect(nextToken.type).toBe(TokenType.STRING);
			});

			describe("Start Tags", () => {
				describe("bold", () => {
					it("should return a start tag token if rawContent contains only a bold start tag with no data", () => {
						const tokenizer = new Tokenizer("<b>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<b>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("b");
					});
				});

				describe("italic", () => {
					it("should return a start tag token if rawContent contains only an italic start tag with no data", () => {
						const tokenizer = new Tokenizer("<i>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<i>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("i");
					});
				});

				describe("underline", () => {
					it("should return a start tag token if rawContent contains only an underline start tag with no data", () => {
						const tokenizer = new Tokenizer("<u>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<u>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("u");
					});
				});

				describe("Ruby Text", () => {
					it("should return a start tag token if rawContent contains only an rt start tag with no data", () => {
						const tokenizer = new Tokenizer("<rt>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<rt>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("rt");
					});
				});

				describe("Ruby", () => {
					it("should return a start tag token if rawContent contains only a ruby start tag with no data", () => {
						const tokenizer = new Tokenizer("<ruby>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<ruby>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("ruby");
					});
				});

				describe("Lang", () => {
					it("should return a start tag token if rawContent contains only a lang start tag with no data", () => {
						const tokenizer = new Tokenizer("<lang>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<lang>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("lang");
					});
				});

				describe("Voice", () => {
					it("should return a start tag token if rawContent contains only a voice start tag with no data", () => {
						const tokenizer = new Tokenizer("<v>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a start tag with annotations if rawContent contains a voice start tag with data", () => {
						const tokenizer = new Tokenizer("<v Fred>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
						expect(nextToken.annotations).toContain("Fred");
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<v>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("v");
					});
				});

				describe("Class", () => {
					it("should return a start tag token if rawContent contains only a class start tag with no data", () => {
						const tokenizer = new Tokenizer("<c>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
					});

					it("should return a start tag token with annotations and classes if rawContent contains a class start tag with classes and annotations", () => {
						const tokenizer = new Tokenizer("<c.className.klaasNaame testAnnotation>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.START_TAG);
						expect(nextToken.annotations).toContain("testAnnotation");
						expect(nextToken.classes).toContain("className");
						expect(nextToken.classes).toContain("klaasNaame");
						expect(nextToken.classes).toContain("klaasNaame");
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<c.className.klaasName testAnnotation>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("c");
					});
				});
			});

			describe("End Tags", () => {
				describe("bold", () => {
					it("should return an end tag token if rawContent contains only a bold end tag", () => {
						const tokenizer = new Tokenizer("</b>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</b>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("b");
					});
				});

				describe("italic", () => {
					it("should return an end tag token if rawContent contains only an italic end tag", () => {
						const tokenizer = new Tokenizer("</i>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</i>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("i");
					});
				});

				describe("underline", () => {
					it("should return an end tag token if rawContent contains only an underline end tag", () => {
						const tokenizer = new Tokenizer("</u>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</u>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("u");
					});
				});

				describe("Ruby Text", () => {
					it("should return an end tag token if rawContent contains only an rt end tag", () => {
						const tokenizer = new Tokenizer("</rt>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</rt>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("rt");
					});
				});

				describe("Ruby", () => {
					it("should return an end tag token if rawContent contains only a ruby end tag", () => {
						const tokenizer = new Tokenizer("</ruby>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</ruby>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("ruby");
					});
				});

				describe("Lang", () => {
					it("should return an end tag token if rawContent contains only a lang end tag", () => {
						const tokenizer = new Tokenizer("</lang>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</lang>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("lang");
					});
				});

				describe("Voice", () => {
					it("should return an end tag token if rawContent contains only a voice end tag", () => {
						const tokenizer = new Tokenizer("</v>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken).toBeInstanceOf(Token);
						expect(nextToken.type).toBe(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</v>");
						const nextToken = tokenizer.nextToken();

						expect(nextToken.content).toBe("v");
					});
				});
			});

			describe("Timestamps Tags", () => {
				it("should return a timestamp token if a timestamp is found", () => {
					const tokenizer = new Tokenizer("<00:05:02.000>");
					const nextToken = tokenizer.nextToken();

					expect(nextToken).toBeInstanceOf(Token);
					expect(nextToken.type).toBe(TokenType.TIMESTAMP);
				});

				it("should return a timestamp token without attributes or class name", () => {
					const tokenizer = new Tokenizer("<00:05:02.000>");
					const nextToken = tokenizer.nextToken();

					expect(nextToken.classes).toBeUndefined();
					expect(nextToken.annotations).toBeUndefined();
				});

				it("should emit a timestamp tag even if it has an invalid timestamp", () => {
					const tokenizer = new Tokenizer("<00:05.alpha.omega>");
					const nextToken = tokenizer.nextToken();

					expect(nextToken).toBeInstanceOf(Token);
					expect(nextToken.type).toBe(TokenType.TIMESTAMP);
				});

				it("should emit a timestamp tag if string ends before it is complete", () => {
					const tokenizer = new Tokenizer("<00:05:03");
					const nextToken = tokenizer.nextToken();

					expect(nextToken).toBeInstanceOf(Token);
					expect(nextToken.type).toBe(TokenType.TIMESTAMP);
				});
			});
		});
	});
});
