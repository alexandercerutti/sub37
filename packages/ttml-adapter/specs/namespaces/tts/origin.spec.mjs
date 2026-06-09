// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";
import { createScope } from "../../../lib/Parser/Scope/Scope.js";
import { createDocumentContext } from "../../../lib/Parser/Scope/DocumentContext.js";
import { createErrorContext } from "../../../lib/Parser/Scope/ErrorContext.js";
import { NodeTree } from "../../../lib/Parser/Tags/NodeTree.js";

const def = resolveStyleDefinitionByName("tts:origin");

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

describe("tts:origin", () => {
	describe("auto keyword", () => {
		it("maps 'auto' to x:0px y:0px", () => {
			expect(toCSS("auto")).toEqual([
				["x", "0px"],
				["y", "0px"],
			]);
		});
	});

	describe("percentage lengths", () => {
		it("passes through percentage values unchanged", () => {
			expect(toCSS("10% 20%")).toEqual([
				["x", "10%"],
				["y", "20%"],
			]);
		});

		it("passes through 0% correctly", () => {
			expect(toCSS("0% 0%")).toEqual([
				["x", "0%"],
				["y", "0%"],
			]);
		});
	});

	describe("pixel lengths with document extent", () => {
		it("converts x and y px to % using document extent axes independently", () => {
			expect(toCSS("192px 108px", { "tts:extent": "1920px 1080px" })).toEqual([
				["x", "10%"],
				["y", "10%"],
			]);
		});

		it("uses width (axis 0) for x and height (axis 1) for y", () => {
			/*
			 * 640 / 1280 = 50%, 180 / 720 = 25%
			 */
			expect(toCSS("640px 180px", { "tts:extent": "1280px 720px" })).toEqual([
				["x", "50%"],
				["y", "25%"],
			]);
		});
	});

	describe("pixel lengths without document extent", () => {
		it("falls back to 0% when no document extent is declared", () => {
			expect(toCSS("100px 200px")).toEqual([
				["x", "0%"],
				["y", "0%"],
			]);
		});
	});

	describe("cell lengths (c unit)", () => {
		/*
		 * Cell size per axis:
		 *   cell width  = containerWidth  / cellColumns = 640 / 32 = 20px  → 20 / 640 = 3.125%
		 *   cell height = containerHeight / cellRows    = 480 / 15 = 32px  → 32 / 480 ≈ 6.667%
		 */
		it("converts c units to % via axis-aware cell size", () => {
			expect(
				toCSS("1c 1c", {
					"tts:extent": "640px 480px",
					"ttp:cellResolution": "32 15",
				}),
			).toEqual([
				["x", "3.125%"],
				["y", `${(100 * 32) / 480}%`],
			]);
		});

		it("uses width axis for x and height axis for y", () => {
			/*
			 * 1920×1080, cellResolution 40×22
			 *   x: 1920/40 = 48px → 48/1920 = 2.5%
			 *   y: 1080/22 ≈ 49.09px → ≈ 4.545%
			 */
			const result = toCSS("1c 1c", {
				"tts:extent": "1920px 1080px",
				"ttp:cellResolution": "40 22",
			});

			expect(parseFloat(result[0][1])).toBeCloseTo(2.5, 5);
			expect(parseFloat(result[1][1])).toBeCloseTo((100 * (1080 / 22)) / 1080, 5);
		});

		it("falls back to 0% when document extent is absent", () => {
			expect(toCSS("1c 1c")).toEqual([
				["x", "0%"],
				["y", "0%"],
			]);
		});
	});
});
