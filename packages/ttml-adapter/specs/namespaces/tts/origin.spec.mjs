// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../../lib/Parser/parseStyle.js";
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
});
