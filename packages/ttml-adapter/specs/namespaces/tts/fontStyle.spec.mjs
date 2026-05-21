import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:fontStyle");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("fontStyle", () => {
	describe("toCSS", () => {
		it("maps 'normal' to font-style:normal", () => {
			expect(toCSS("normal")).toEqual([["font-style", "normal"]]);
		});

		it("maps 'italic' to font-style:italic", () => {
			expect(toCSS("italic")).toEqual([["font-style", "italic"]]);
		});

		it("maps 'oblique' to font-style:oblique", () => {
			expect(toCSS("oblique")).toEqual([["font-style", "oblique"]]);
		});
	});
});
