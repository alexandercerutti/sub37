import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:zIndex");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "region");
}

describe("zIndex", () => {
	describe("toCSS", () => {
		it("maps 'auto' to z-index:auto", () => {
			expect(toCSS("auto")).toEqual([["z-index", "auto"]]);
		});

		it("maps a positive integer to its string representation", () => {
			expect(toCSS("10")).toEqual([["z-index", "10"]]);
		});

		it("maps zero to '0'", () => {
			expect(toCSS("0")).toEqual([["z-index", "0"]]);
		});

		it("maps a negative integer to its string representation", () => {
			expect(toCSS("-1")).toEqual([["z-index", "-1"]]);
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
