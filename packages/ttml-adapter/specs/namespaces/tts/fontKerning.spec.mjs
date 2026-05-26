import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:fontKerning");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("fontKerning", () => {
	describe("toCSS", () => {
		it("maps 'none' to font-kerning:none", () => {
			expect(toCSS("none")).toEqual([["font-kerning", "none"]]);
		});

		it("maps 'normal' to font-kerning:normal", () => {
			expect(toCSS("normal")).toEqual([["font-kerning", "normal"]]);
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
