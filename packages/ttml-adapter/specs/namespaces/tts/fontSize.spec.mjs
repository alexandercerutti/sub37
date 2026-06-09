// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";
import { createScope } from "../../../lib/Parser/Scope/Scope.js";
import { createDocumentContext } from "../../../lib/Parser/Scope/DocumentContext.js";
import { createErrorContext } from "../../../lib/Parser/Scope/ErrorContext.js";
import { NodeTree } from "../../../lib/Parser/Tags/NodeTree.js";

const def = resolveStyleDefinitionByName("tts:fontSize");

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

describe("tts:fontSize", () => {
	describe("non-cell units", () => {
		it("passes through a pixel value", () => {
			expect(toCSS("24px")).toEqual([["font-size", "24px"]]);
		});

		it("passes through a percentage value", () => {
			expect(toCSS("50%")).toEqual([["font-size", "50%"]]);
		});

		it("passes through an em value", () => {
			expect(toCSS("1.5em")).toEqual([["font-size", "1.5em"]]);
		});
	});

	describe("cell unit (c)", () => {
		it("returns null when no document extent is present", () => {
			expect(toCSS("1c")).toBeNull();
		});

		/*
		 * ttp:cellResolution defaults to [32, 15] per TTML2 spec when absent.
		 * So with 640×480 and the default 32×15 grid: 480/15 = 32px.
		 */
		it("uses the default cellResolution (32×15) when absent", () => {
			expect(toCSS("1c", { "tts:extent": "640px 480px" })).toEqual([["font-size", "32px"]]);
		});

		/*
		 * TTML2 §10.2.21: a single `c` length for tts:fontSize resolves against
		 * the HEIGHT component of the computed cell size.
		 *
		 * Given container 640×480 and cellResolution "32 15":
		 *   cell height = 480 / 15 = 32px
		 *   1c = 32px
		 *   0.5c = 16px
		 */
		it("converts 1c to px using container height / cell rows", () => {
			expect(
				toCSS("1c", {
					"tts:extent": "640px 480px",
					"ttp:cellResolution": "32 15",
				}),
			).toEqual([["font-size", "32px"]]);
		});

		it("converts 0.5c correctly", () => {
			expect(
				toCSS("0.5c", {
					"tts:extent": "640px 480px",
					"ttp:cellResolution": "32 15",
				}),
			).toEqual([["font-size", "16px"]]);
		});

		/*
		 * Regression: prior to the fix, extent[0] (width=640) was used instead
		 * of extent[1] (height=480). On a non-square container the results differ.
		 * This test fails with the original code and passes after the fix.
		 */
		it("uses container HEIGHT, not width, for non-square containers", () => {
			/*
			 * 1920×1080, cellResolution "40 22"
			 * correct: 1080 / 22 ≈ 49.09px
			 * wrong  : 1920 / 22 ≈ 87.27px
			 */
			const result = toCSS("1c", {
				"tts:extent": "1920px 1080px",
				"ttp:cellResolution": "40 22",
			});

			const pxValue = parseFloat(result?.[0]?.[1] ?? "");

			expect(pxValue).toBeCloseTo(1080 / 22, 5);
		});
	});
});
