// @ts-check

import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:border");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("tts:border", () => {
	describe("toCSS", () => {
		it("produces all four border properties from a full specification", () => {
			expect(toCSS("2px solid black")).toEqual([
				["border-width", "2px"],
				["border-style", "solid"],
				["border-color", "black"],
				["border-radius", "0px"],
			]);
		});

		it("defaults border-width to 0px when only style and color are given", () => {
			expect(toCSS("solid red")).toEqual([
				["border-width", "0px"],
				["border-style", "solid"],
				["border-color", "red"],
				["border-radius", "0px"],
			]);
		});

		it("defaults border-color to currentColor when only width and style are given", () => {
			expect(toCSS("1px dotted")).toEqual([
				["border-width", "1px"],
				["border-style", "dotted"],
				["border-color", "currentColor"],
				["border-radius", "0px"],
			]);
		});

		it("rejects input that has no valid border components", () => {
			expect(() => parseAttributeValue(def.syntax, "invalid")).toThrow();
		});
	});
});
