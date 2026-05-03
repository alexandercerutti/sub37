import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../lib/Parser/parseStyle.js";

const def = resolveStyleDefinitionByName("tts:color");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("color", () => {
	describe("toCSS", () => {
		it("passes a named color through as-is", () => {
			expect(toCSS("red")).toEqual([["color", "red"]]);
		});

		it("passes a hex color through as-is", () => {
			expect(toCSS("#ff0000")).toEqual([["color", "#ff0000"]]);
		});

		it("passes an rgba color through as-is", () => {
			expect(toCSS("rgba(255,0,0,1)")).toEqual([["color", "rgba(255,0,0,1)"]]);
		});
	});
});
