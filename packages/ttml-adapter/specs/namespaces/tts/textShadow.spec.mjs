import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName, parseAttributeValue } from "../../../lib/Parser/parseStyle.js";

const def = resolveStyleDefinitionByName("tts:textShadow");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "span");
}

function parse(input) {
	return parseAttributeValue(def.syntax, input);
}

describe("textShadow", () => {
	describe("tokenizer", () => {
		it("splits a single shadow into space-separated tokens", () => {
			expect(def.syntax.tokenizer("2px 4px 6px red")).toEqual(["2px", "4px", "6px", "red"]);
		});

		it("makes the comma a standalone token for multi-shadow values", () => {
			expect(def.syntax.tokenizer("2px 4px red, 1px 1px blue")).toEqual([
				"2px",
				"4px",
				"red",
				",",
				"1px",
				"1px",
				"blue",
			]);
		});

		it("collapses multiple spaces into a single split", () => {
			expect(def.syntax.tokenizer("2px  4px")).toEqual(["2px", "4px"]);
		});
	});

	describe("toCSS", () => {
		it("returns the 'none' keyword as-is", () => {
			expect(toCSS("none")).toEqual([["text-shadow", "none"]]);
		});

		it("produces a CSS shadow string from all four components", () => {
			expect(toCSS("2px 4px 6px red")).toEqual([["text-shadow", "2px 4px 6px red"]]);
		});

		it("omits blur-radius from the CSS string when not provided", () => {
			expect(toCSS("2px 4px red")).toEqual([["text-shadow", "2px 4px red"]]);
		});

		it("joins multiple shadows with a comma separator", () => {
			expect(toCSS("2px 4px red, 1px 1px blue")).toEqual([
				["text-shadow", "2px 4px red,1px 1px blue"],
			]);
		});
	});

	describe("validateAnimation", () => {
		it("always allows discrete animation regardless of keyframe content", () => {
			expect(
				def.syntax.validateAnimation(
					[parse("2px 4px 6px red"), parse("10px 10px 0px blue")],
					"discrete",
				),
			).toBe(true);
		});

		it("allows continuous animation when only the color changes between keyframes", () => {
			expect(
				def.syntax.validateAnimation(
					[parse("2px 4px 6px red"), parse("2px 4px 6px blue")],
					"continuous",
				),
			).toBe(true);
		});

		it("rejects continuous animation when offset-x differs between keyframes", () => {
			expect(
				def.syntax.validateAnimation(
					[parse("2px 4px 6px red"), parse("3px 4px 6px red")],
					"continuous",
				),
			).toBe(false);
		});

		it("rejects continuous animation when blur-radius differs between keyframes", () => {
			expect(
				def.syntax.validateAnimation(
					[parse("2px 4px 6px red"), parse("2px 4px 3px red")],
					"continuous",
				),
			).toBe(false);
		});

		it("rejects continuous animation when the number of shadows differs between keyframes", () => {
			expect(
				def.syntax.validateAnimation(
					[parse("2px 4px 6px red"), parse("2px 4px 6px red, 1px 1px blue")],
					"continuous",
				),
			).toBe(false);
		});
	});
});
