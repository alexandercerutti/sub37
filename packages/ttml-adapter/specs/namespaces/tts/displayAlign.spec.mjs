import { describe, expect, it } from "@jest/globals";
import { resolveStyleDefinitionByName } from "../../../lib/Parser/parseStyle.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";

const def = resolveStyleDefinitionByName("tts:displayAlign");

function toCSS(input) {
	return def.toCSS(null, parseAttributeValue(def.syntax, input), "region");
}

describe("displayAlign", () => {
	describe("toCSS", () => {
		it("maps 'before' to justify-content:flex-start", () => {
			expect(toCSS("before")).toEqual([["justify-content", "flex-start"]]);
		});

		it("maps 'center' to justify-content:center", () => {
			expect(toCSS("center")).toEqual([["justify-content", "center"]]);
		});

		it("maps 'after' to justify-content:flex-end", () => {
			expect(toCSS("after")).toEqual([["justify-content", "flex-end"]]);
		});

		it("maps 'justify' to justify-content:space-between", () => {
			expect(toCSS("justify")).toEqual([["justify-content", "space-between"]]);
		});
	});
});
