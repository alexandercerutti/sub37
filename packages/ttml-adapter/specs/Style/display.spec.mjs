import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../lib/Parser/parseStyle.js";

const def = resolveStyleDefinitionByName("tts:display");

function toCSS(input, element = "span") {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), element);
}

describe("display", () => {
	describe("toCSS", () => {
		it("maps 'none' to display:none regardless of element", () => {
			expect(toCSS("none", "span")).toEqual([["display", "none"]]);
			expect(toCSS("none", "p")).toEqual([["display", "none"]]);
		});

		it("maps 'auto' on a span to display:inline", () => {
			expect(toCSS("auto", "span")).toEqual([["display", "inline"]]);
		});

		it("maps 'auto' on a region to display:flex", () => {
			expect(toCSS("auto", "region")).toEqual([["display", "flex"]]);
		});

		it("maps 'auto' on block elements to display:block", () => {
			expect(toCSS("auto", "p")).toEqual([["display", "block"]]);
			expect(toCSS("auto", "div")).toEqual([["display", "block"]]);
			expect(toCSS("auto", "body")).toEqual([["display", "block"]]);
		});

		it("maps 'inlineBlock' on a span to display:inline-block", () => {
			expect(toCSS("inlineBlock", "span")).toEqual([["display", "inline-block"]]);
		});

		it("throws when 'inlineBlock' is applied to a non-span element", () => {
			expect(() => toCSS("inlineBlock", "p")).toThrow();
		});
	});
});
