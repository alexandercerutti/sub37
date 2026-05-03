import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../lib/Parser/parseStyle.js";

const def = resolveStyleDefinitionByName("tts:backgroundColor");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("backgroundColor", () => {
	describe("toCSS", () => {
		it("passes a named color through as-is", () => {
			expect(toCSS("blue")).toEqual([["background-color", "blue"]]);
		});

		it("passes a hex color through as-is", () => {
			expect(toCSS("#0000ff")).toEqual([["background-color", "#0000ff"]]);
		});

		it("passes rgba color through as-is", () => {
			expect(toCSS("rgba(0,0,255,0.5)")).toEqual([["background-color", "rgba(0,0,255,0.5)"]]);
		});
	});
});
