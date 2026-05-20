import { describe, expect, it } from "@jest/globals";
import { UnquotedString } from "../../lib/Parser/Style/structure/derivables/unquoted-string.js";
import { DerivationState } from "../../lib/Parser/Style/structure/operators.js";

const derivable = UnquotedString();

function derive(token) {
	return derivable.derive(token);
}

function accepted(token) {
	const result = derive(token);
	return result.state === DerivationState.DONE ? result.values[0] : null;
}

function rejected(token) {
	const result = derive(token);
	return result.state & DerivationState.REJECTED ? true : false;
}

describe("UnquotedString", () => {
	describe("single identifiers", () => {
		it("accepts a plain lowercase name", () => {
			expect(accepted("arial")).toEqual({ type: "unquoted-string", value: "arial" });
		});

		it("accepts a mixed-case name", () => {
			expect(accepted("Arial")).toEqual({ type: "unquoted-string", value: "Arial" });
		});

		it("accepts a name starting with underscore", () => {
			expect(accepted("_my-font")).toEqual({ type: "unquoted-string", value: "_my-font" });
		});

		it("accepts a name starting with a single dash", () => {
			expect(accepted("-my-font")).toEqual({ type: "unquoted-string", value: "-my-font" });
		});

		it("accepts a name with digits after the first char", () => {
			expect(accepted("font2")).toEqual({ type: "unquoted-string", value: "font2" });
		});

		it("accepts a name with non-ascii characters", () => {
			expect(accepted("Hébraïque")).toEqual({ type: "unquoted-string", value: "Hébraïque" });
		});
	});

	describe("multi-word names (space-separated identifiers)", () => {
		it("accepts 'Times New Roman'", () => {
			expect(accepted("Times New Roman")).toEqual({
				type: "unquoted-string",
				value: "Times New Roman",
			});
		});

		it("accepts 'Comic Sans MS'", () => {
			expect(accepted("Comic Sans MS")).toEqual({
				type: "unquoted-string",
				value: "Comic Sans MS",
			});
		});
	});

	describe("invalid identifiers", () => {
		it("rejects a name starting with a digit", () => {
			expect(rejected("1font")).toBe(true);
		});

		it("rejects a name starting with two dashes", () => {
			expect(rejected("--font")).toBe(true);
		});

		it("rejects an empty string", () => {
			expect(rejected("")).toBe(true);
		});

		it("rejects a name containing only spaces", () => {
			expect(rejected("   ")).toBe(true);
		});
	});
});
