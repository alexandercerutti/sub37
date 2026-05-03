import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../lib/Parser/parseStyle.js";

const def = resolveStyleDefinitionByName("tts:opacity");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("opacity", () => {
	describe("toCSS", () => {
		it("maps 0 to '0'", () => {
			expect(toCSS("0")).toEqual([["opacity", "0"]]);
		});

		it("maps 1 to '1'", () => {
			expect(toCSS("1")).toEqual([["opacity", "1"]]);
		});

		it("maps a fractional value to its string representation", () => {
			expect(toCSS("0.5")).toEqual([["opacity", "0.5"]]);
		});
	});
});
