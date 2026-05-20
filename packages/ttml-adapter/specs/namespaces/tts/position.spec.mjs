// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../../lib/Parser/parseStyle.js";
import { createScope } from "../../../lib/Parser/Scope/Scope.js";
import { createDocumentContext } from "../../../lib/Parser/Scope/DocumentContext.js";
import { createErrorContext } from "../../../lib/Parser/Scope/ErrorContext.js";
import { NodeTree } from "../../../lib/Parser/Tags/NodeTree.js";

const def = resolveStyleDefinitionByName("tts:position");

/**
 * @param {string} input
 * @param {Record<string, string>} [documentAttributes]
 */
function toCSS(input, documentAttributes = {}) {
	const scope = createScope(
		undefined,
		createDocumentContext(new NodeTree(), { "xml:lang": "", ...documentAttributes }),
		createErrorContext({ onReport() {} }),
	);

	return def.toCSS(scope, parseAttributeValue(def.syntax, input), "region");
}

describe("tts:position", () => {
	/*
	 * One-component values: a lone keyword or length. The missing axis
	 * always defaults to 'center' (50%).
	 */
	describe("one-component normalization", () => {
		it("maps 'left' to left:0% top:50%", () => {
			expect(toCSS("left")).toEqual([
				["position", "absolute"],
				["left", "0%"],
				["top", "50%"],
			]);
		});

		it("maps 'right' to left:100% top:50%", () => {
			expect(toCSS("right")).toEqual([
				["position", "absolute"],
				["left", "100%"],
				["top", "50%"],
			]);
		});

		it("maps 'top' to left:50% top:0%", () => {
			expect(toCSS("top")).toEqual([
				["position", "absolute"],
				["left", "50%"],
				["top", "0%"],
			]);
		});

		it("maps 'bottom' to left:50% top:100%", () => {
			expect(toCSS("bottom")).toEqual([
				["position", "absolute"],
				["left", "50%"],
				["top", "100%"],
			]);
		});

		it("maps 'center' to left:50% top:50%", () => {
			expect(toCSS("center")).toEqual([
				["position", "absolute"],
				["left", "50%"],
				["top", "50%"],
			]);
		});

		it("maps a lone length to left:<length> top:50%", () => {
			expect(toCSS("10%")).toEqual([
				["position", "absolute"],
				["left", "10%"],
				["top", "50%"],
			]);
		});
	});

	/*
	 * Two-component values: keyword + keyword, keyword + length, length + length.
	 */
	describe("two-component normalization", () => {
		describe("keyword normalization", () => {
			it("maps 'left top' to left:0% top:0%", () => {
				expect(toCSS("left top")).toEqual([
					["position", "absolute"],
					["left", "0%"],
					["top", "0%"],
				]);
			});

			it("maps 'center center' to left:50% top:50%", () => {
				expect(toCSS("center center")).toEqual([
					["position", "absolute"],
					["left", "50%"],
					["top", "50%"],
				]);
			});

			it("maps 'right bottom' to left:100% top:100%", () => {
				expect(toCSS("right bottom")).toEqual([
					["position", "absolute"],
					["left", "100%"],
					["top", "100%"],
				]);
			});

			it("maps reversed 'top left' to left:0% top:0%", () => {
				/*
				 * Vertical keyword first, horizontal second — normalization
				 * must still assign the right axis to each component.
				 */
				expect(toCSS("top left")).toEqual([
					["position", "absolute"],
					["left", "0%"],
					["top", "0%"],
				]);
			});

			it("rejects two horizontal keywords ('left right') at parse time", () => {
				expect(parseAttributeValue(def.syntax, "left right")).toBeNull();
			});

			it("rejects two vertical keywords ('top bottom') at parse time", () => {
				expect(parseAttributeValue(def.syntax, "top bottom")).toBeNull();
			});
		});

		describe("percentage lengths", () => {
			it("passes through percentage values unchanged", () => {
				expect(toCSS("10% 20%")).toEqual([
					["position", "absolute"],
					["left", "10%"],
					["top", "20%"],
				]);
			});

			it("maps 'right 30%' to left:100% top:30% (right is a keyword, 30% is vertical)", () => {
				expect(toCSS("right 30%")).toEqual([
					["position", "absolute"],
					["left", "100%"],
					["top", "30%"],
				]);
			});
		});
	});

	/*
	 * Three-component values: edge + offset + keyword, or keyword + edge + offset.
	 * The offset is always relative to the named edge.
	 */
	describe("three-component normalization", () => {
		describe("edge-first (edge offset keyword)", () => {
			it("maps 'left 20% top' to left:20% top:0%", () => {
				expect(toCSS("left 20% top")).toEqual([
					["position", "absolute"],
					["left", "20%"],
					["top", "0%"],
				]);
			});

			it("maps 'right 20% bottom' to left:80% top:100% (offset subtracted from right edge)", () => {
				expect(toCSS("right 20% bottom")).toEqual([
					["position", "absolute"],
					["left", "80%"],
					["top", "100%"],
				]);
			});

			it("maps 'top 20% left' to left:0% top:20%", () => {
				expect(toCSS("top 20% left")).toEqual([
					["position", "absolute"],
					["left", "0%"],
					["top", "20%"],
				]);
			});

			it("maps 'bottom 20% right' to left:100% top:80% (offset subtracted from bottom edge)", () => {
				expect(toCSS("bottom 20% right")).toEqual([
					["position", "absolute"],
					["left", "100%"],
					["top", "80%"],
				]);
			});
		});

		describe("edge-last (keyword edge offset)", () => {
			it("maps 'left top 20%' to left:0% top:20%", () => {
				expect(toCSS("left top 20%")).toEqual([
					["position", "absolute"],
					["left", "0%"],
					["top", "20%"],
				]);
			});

			it("maps 'left bottom 20%' to left:0% top:80% (offset subtracted from bottom edge)", () => {
				expect(toCSS("left bottom 20%")).toEqual([
					["position", "absolute"],
					["left", "0%"],
					["top", "80%"],
				]);
			});

			it("maps 'right top 20%' to left:100% top:20%", () => {
				expect(toCSS("right top 20%")).toEqual([
					["position", "absolute"],
					["left", "100%"],
					["top", "20%"],
				]);
			});

			it("maps 'center bottom 20%' to left:50% top:80%", () => {
				expect(toCSS("center bottom 20%")).toEqual([
					["position", "absolute"],
					["left", "50%"],
					["top", "80%"],
				]);
			});

			it("maps 'center right 20%' to left:80% top:50%", () => {
				expect(toCSS("center right 20%")).toEqual([
					["position", "absolute"],
					["left", "80%"],
					["top", "50%"],
				]);
			});
		});
	});

	/*
	 * Four-component values: edge offset edge offset.
	 * Each edge/offset pair names one axis explicitly.
	 */
	describe("four-component normalization", () => {
		it("maps 'left 10% top 20%' to left:10% top:20%", () => {
			expect(toCSS("left 10% top 20%")).toEqual([
				["position", "absolute"],
				["left", "10%"],
				["top", "20%"],
			]);
		});

		it("maps 'left 10% bottom 20%' to left:10% top:80% (offset from bottom)", () => {
			expect(toCSS("left 10% bottom 20%")).toEqual([
				["position", "absolute"],
				["left", "10%"],
				["top", "80%"],
			]);
		});

		it("maps 'right 10% top 20%' to left:90% top:20% (offset from right)", () => {
			expect(toCSS("right 10% top 20%")).toEqual([
				["position", "absolute"],
				["left", "90%"],
				["top", "20%"],
			]);
		});

		it("maps 'right 10% bottom 20%' to left:90% top:80% (both offsets from far edges)", () => {
			expect(toCSS("right 10% bottom 20%")).toEqual([
				["position", "absolute"],
				["left", "90%"],
				["top", "80%"],
			]);
		});

		it("maps 'top 20% left 10%' to left:10% top:20% (reversed axis order)", () => {
			expect(toCSS("top 20% left 10%")).toEqual([
				["position", "absolute"],
				["left", "10%"],
				["top", "20%"],
			]);
		});

		it("maps 'bottom 20% right 10%' to left:90% top:80%", () => {
			expect(toCSS("bottom 20% right 10%")).toEqual([
				["position", "absolute"],
				["left", "90%"],
				["top", "80%"],
			]);
		});
	});

	describe("pixel lengths with document extent", () => {
		it("converts x and y px to % using the respective axes of the document extent", () => {
			expect(toCSS("192px 108px", { "tts:extent": "1920px 1080px" })).toEqual([
				["position", "absolute"],
				["left", "10%"],
				["top", "10%"],
			]);
		});

		it("uses width (axis 0) for left and height (axis 1) for top independently", () => {
			/*
			 * 640 / 1280 = 50%, 180 / 720 = 25%
			 */
			expect(toCSS("640px 180px", { "tts:extent": "1280px 720px" })).toEqual([
				["position", "absolute"],
				["left", "50%"],
				["top", "25%"],
			]);
		});
	});

	describe("pixel lengths without document extent", () => {
		/*
		 * Without a declared document coordinate space, TTML px cannot be
		 * converted to CSS %. The value is passed through as-is rather than
		 * falling back to 0%, since there is no meaningful default position.
		 */
		it("passes px values through as-is when no document extent is declared", () => {
			expect(toCSS("100px 200px")).toEqual([
				["position", "absolute"],
				["left", "100px"],
				["top", "200px"],
			]);
		});
	});
});
