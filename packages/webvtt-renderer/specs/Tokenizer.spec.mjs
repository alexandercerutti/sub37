// @ts-check
/// <reference types="chai">
import { Token, Tokenizer, TokenType } from "../lib/Tokenizer.js";

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

		describe("isWhitespace", () => {
			it("should match actual whitespace", () => {
				chai.expect(Tokenizer.isWhitespace(" ")).to.be.true;
			});

			it("should match tabulation character", () => {
				chai.expect(Tokenizer.isWhitespace("\x09")).to.be.true;
			});

			it("should match form feed (page break) character", () => {
				chai.expect(Tokenizer.isWhitespace("\x0C")).to.be.true;
			});

			it("should not match new line", () => {
				chai.expect(Tokenizer.isWhitespace("\x0A")).to.be.false;
			});
		});

		describe("isNewline", () => {
			it("should match only new lines", () => {
				const NEWLINE = "\x0A";
				const NOT_NEWLINE = "a";
				chai.expect(Tokenizer.isNewLine(NEWLINE)).to.be.true;
				chai.expect(Tokenizer.isNewLine(NOT_NEWLINE)).to.be.false;
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
				chai.expect(tokenizer.nextToken()).to.be.null;
			});

			it("should return null if no more content is available", () => {
				const tokenizer = new Tokenizer("mocked content");
				tokenizer.nextToken();

				chai.expect(tokenizer.nextToken()).to.be.null;
			});

			it("should return a string token if rawContent contains only a string", () => {
				const tokenizer = new Tokenizer("mocked content");
				const nextToken = tokenizer.nextToken();

				chai.expect(nextToken).to.be.instanceOf(Token);
				chai.expect(nextToken.type).to.equal(TokenType.STRING);
			});

			describe("Start Tags", () => {
				describe("bold", () => {
					it("should return a start tag token if rawContent contains only a bold start tag with no data", () => {
						const tokenizer = new Tokenizer("<b>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<b>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("b");
					});
				});

				describe("italic", () => {
					it("should return a start tag token if rawContent contains only an italic start tag with no data", () => {
						const tokenizer = new Tokenizer("<i>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<i>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("i");
					});
				});

				describe("underline", () => {
					it("should return a start tag token if rawContent contains only an underline start tag with no data", () => {
						const tokenizer = new Tokenizer("<u>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<u>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("u");
					});
				});

				describe("Ruby Text", () => {
					it("should return a start tag token if rawContent contains only an rt start tag with no data", () => {
						const tokenizer = new Tokenizer("<rt>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<rt>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("rt");
					});
				});

				describe("Ruby", () => {
					it("should return a start tag token if rawContent contains only a ruby start tag with no data", () => {
						const tokenizer = new Tokenizer("<ruby>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<ruby>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("ruby");
					});
				});

				describe("Lang", () => {
					it("should return a start tag token if rawContent contains only a lang start tag with no data", () => {
						const tokenizer = new Tokenizer("<lang>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<lang>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("lang");
					});
				});

				describe("Voice", () => {
					it("should return a start tag token if rawContent contains only a voice start tag with no data", () => {
						const tokenizer = new Tokenizer("<v>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a start tag with annotations if rawContent contains a voice start tag with data", () => {
						const tokenizer = new Tokenizer("<v Fred>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
						chai.expect(nextToken.annotations).to.contain("Fred");
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<v>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("v");
					});
				});

				describe("Class", () => {
					it("should return a start tag token if rawContent contains only a class start tag with no data", () => {
						const tokenizer = new Tokenizer("<c>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
					});

					it("should return a start tag token with annotations and classes if rawContent contains a class start tag with classes and annotations", () => {
						const tokenizer = new Tokenizer("<c.className.klaasNaame testAnnotation>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.START_TAG);
						chai.expect(nextToken.annotations).to.contain("testAnnotation");
						chai.expect(nextToken.classes).to.contain("className");
						chai.expect(nextToken.classes).to.contain("klaasNaame");
						chai.expect(nextToken.classes).to.contain("klaasNaame");
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("<c.className.klaasName testAnnotation>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("c");
					});
				});
			});

			describe("End Tags", () => {
				describe("bold", () => {
					it("should return an end tag token if rawContent contains only a bold end tag", () => {
						const tokenizer = new Tokenizer("</b>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</b>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("b");
					});
				});

				describe("italic", () => {
					it("should return an end tag token if rawContent contains only an italic end tag", () => {
						const tokenizer = new Tokenizer("</i>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</i>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("i");
					});
				});

				describe("underline", () => {
					it("should return an end tag token if rawContent contains only an underline end tag", () => {
						const tokenizer = new Tokenizer("</u>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</u>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("u");
					});
				});

				describe("Ruby Text", () => {
					it("should return an end tag token if rawContent contains only an rt end tag", () => {
						const tokenizer = new Tokenizer("</rt>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</rt>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("rt");
					});
				});

				describe("Ruby", () => {
					it("should return an end tag token if rawContent contains only a ruby end tag", () => {
						const tokenizer = new Tokenizer("</ruby>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</ruby>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("ruby");
					});
				});

				describe("Lang", () => {
					it("should return an end tag token if rawContent contains only a lang end tag", () => {
						const tokenizer = new Tokenizer("</lang>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</lang>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("lang");
					});
				});

				describe("Voice", () => {
					it("should return an end tag token if rawContent contains only a voice end tag", () => {
						const tokenizer = new Tokenizer("</v>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken).to.be.instanceOf(Token);
						chai.expect(nextToken.type).to.equal(TokenType.END_TAG);
					});

					it("should return a token with content without special characters", () => {
						const tokenizer = new Tokenizer("</v>");
						const nextToken = tokenizer.nextToken();

						chai.expect(nextToken.content).to.be.eq("v");
					});
				});
			});

			describe("Timestamps Tags", () => {
				it("should return a timestamp token if a timestamp is found", () => {
					const tokenizer = new Tokenizer("<00:05:02.000>");
					const nextToken = tokenizer.nextToken();

					chai.expect(nextToken).to.be.instanceOf(Token);
					chai.expect(nextToken.type).to.equal(TokenType.TIMESTAMP);
				});

				it("should return a timestamp token without attributes or class name", () => {
					const tokenizer = new Tokenizer("<00:05:02.000>");
					const nextToken = tokenizer.nextToken();

					chai.expect(nextToken.classes).to.be.undefined;
					chai.expect(nextToken.annotations).to.be.undefined;
				});

				it("should emit a timestamp tag even if it has an invalid timestamp", () => {
					const tokenizer = new Tokenizer("<00:05.alpha.omega>");
					const nextToken = tokenizer.nextToken();

					chai.expect(nextToken).to.be.instanceOf(Token);
					chai.expect(nextToken.type).to.be.equal(TokenType.TIMESTAMP);
				});

				it("should emit a timestamp tag if string ends before it is complete", () => {
					const tokenizer = new Tokenizer("<00:05:03");
					const nextToken = tokenizer.nextToken();

					chai.expect(nextToken).to.be.instanceOf(Token);
					chai.expect(nextToken.type).to.be.equal(TokenType.TIMESTAMP);
				});
			});
		});
	});
});
