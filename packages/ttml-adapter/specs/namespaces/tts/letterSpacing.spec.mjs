import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:letterSpacing");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

describe("letterSpacing", () => {
	describe("toCSS", () => {
		it("maps 'normal' to letter-spacing:0px — TTML §10.2.24 equates normal to zero", () => {
			expect(toCSS("normal")).toEqual([["letter-spacing", "0px"]]);
		});

		it("maps a px length", () => {
			expect(toCSS("2px")).toEqual([["letter-spacing", "2px"]]);
		});

		it("maps a negative px length", () => {
			expect(toCSS("-1px")).toEqual([["letter-spacing", "-1px"]]);
		});

		it("maps an em length", () => {
			expect(toCSS("0.5em")).toEqual([["letter-spacing", "0.5em"]]);
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
