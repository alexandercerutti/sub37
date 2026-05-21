// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";
import { createScope } from "../../../lib/Parser/Scope/Scope.js";
import {
	createDocumentContext,
	readScopeDocumentContext,
} from "../../../lib/Parser/Scope/DocumentContext.js";
import { createErrorContext } from "../../../lib/Parser/Scope/ErrorContext.js";
import { NodeTree } from "../../../lib/Parser/Tags/NodeTree.js";

const def = resolveStyleDefinitionByName("tts:extent");

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

describe("tts:extent", () => {
	describe("keywords", () => {
		it("maps 'auto' to 100% width and height", () => {
			expect(toCSS("auto")).toEqual([
				["width", "100%"],
				["height", "100%"],
			]);
		});

		it("maps 'contain' to 100% width and height (fallback)", () => {
			expect(toCSS("contain")).toEqual([
				["width", "100%"],
				["height", "100%"],
			]);
		});

		it("maps 'cover' to 100% width and height (fallback)", () => {
			expect(toCSS("cover")).toEqual([
				["width", "100%"],
				["height", "100%"],
			]);
		});
	});

	describe("percentage lengths", () => {
		it("maps '80% 40%' to width:80% height:40%", () => {
			expect(toCSS("80% 40%")).toEqual([
				["width", "80%"],
				["height", "40%"],
			]);
		});

		it("clamps percentages above 100", () => {
			expect(toCSS("120% 150%")).toEqual([
				["width", "100%"],
				["height", "100%"],
			]);
		});

		/*
		 * Negative percentages are rejected by the grammar — the grammar
		 * enforces NonNegativeConstraint on length values.
		 */
		it("rejects negative percentages at parse time", () => {
			expect(parseAttributeValue(def.syntax, "-10% -20%")).toBeNull();
		});
	});

	describe("pixel lengths with document extent", () => {
		it("converts px to % using document extent", () => {
			expect(toCSS("960px 540px", { "tts:extent": "1920px 1080px" })).toEqual([
				["width", "50%"],
				["height", "50%"],
			]);
		});

		it("converts width and height independently", () => {
			expect(toCSS("320px 270px", { "tts:extent": "1280px 720px" })).toEqual([
				["width", "25%"],
				["height", "37.5%"],
			]);
		});
	});

	describe("pixel lengths without document extent", () => {
		it("falls back to 100% and reports an error when no document extent is declared", () => {
			expect(toCSS("960px 540px")).toEqual([
				["width", "100%"],
				["height", "100%"],
			]);
		});
	});
});

describe("tts:extent on <tt> (document coordinate space)", () => {
	/**
	 * @param {Record<string, string>} [documentAttributes]
	 */
	function getDocumentExtent(documentAttributes = {}) {
		const scope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "", ...documentAttributes }),
		);

		return readScopeDocumentContext(scope)?.attributes["tts:extent"];
	}

	it("parses two pixel values as [PixelScalar, PixelScalar]", () => {
		const extent = getDocumentExtent({ "tts:extent": "1920px 1080px" });

		expect(extent).toBeDefined();
		expect(extent[0].value).toBe(1920);
		expect(extent[0].metric).toBe("px");
		expect(extent[1].value).toBe(1080);
		expect(extent[1].metric).toBe("px");
	});

	it("returns undefined for 'auto'", () => {
		expect(getDocumentExtent({ "tts:extent": "auto" })).toBeUndefined();
	});

	it("returns undefined for 'contain'", () => {
		expect(getDocumentExtent({ "tts:extent": "contain" })).toBeUndefined();
	});

	it("returns undefined when tts:extent is absent", () => {
		expect(getDocumentExtent()).toBeUndefined();
	});

	it("returns undefined for non-px lengths (percentage not allowed on tt)", () => {
		/*
		 * §10.2.16 restricts tts:extent on <tt> to pixel units only.
		 * Percentage values are syntactically valid lengths but semantically
		 * invalid in this context — they resolve to undefined.
		 */
		expect(getDocumentExtent({ "tts:extent": "50% 50%" })).toBeUndefined();
	});
});
