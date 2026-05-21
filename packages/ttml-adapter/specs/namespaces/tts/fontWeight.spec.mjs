import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:fontWeight");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("fontWeight", () => {
	describe("toCSS", () => {
		it("maps 'normal' to font-weight:normal", () => {
			expect(toCSS("normal")).toEqual([["font-weight", "normal"]]);
		});

		it("maps 'bold' to font-weight:bold", () => {
			expect(toCSS("bold")).toEqual([["font-weight", "bold"]]);
		});
	});

	describe("validateAnimation", () => {
		it("accepts discrete animation", () => {
			expect(def.syntax.validateAnimation([], "discrete")).toBe(true);
		});

		it("rejects continuous animation", () => {
			expect(def.syntax.validateAnimation([], "continuous")).toBe(false);
		});
	});
});
