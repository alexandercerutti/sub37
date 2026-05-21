import { describe, expect, it } from "@jest/globals";
import { tokenizer } from "../../../lib/Parser/namespaces/tts/properties/fontFamily.js";
import { parseAttributeValue } from "../../../lib/Parser/grammar/parseAttributeValue.js";
import * as FontFamilySyntax from "../../../lib/Parser/namespaces/tts/syntax/font-family.js";
import * as FontFamilyProperty from "../../../lib/Parser/namespaces/tts/properties/fontFamily.js";

/** parseAttributeValue expects a { Grammar, tokenizer? } shape */
const syntaxDef = {
	Grammar: FontFamilySyntax.FontFamiliesGrammar,
	tokenizer: FontFamilyProperty.tokenizer,
};

/**
 * Parse a tts:fontFamily value and return the flat array of derived values,
 * filtering out comma separators so callers only see the family entries.
 */
function parseFamily(input) {
	const result = parseAttributeValue(syntaxDef, input)?.filter((v) => v?.value !== ",") ?? null;
	return result?.length ? result : null;
}

describe("fontFamily tokenizer", () => {
	it("produces a single token for a plain identifier", () => {
		expect(tokenizer("serif")).toEqual(["serif"]);
	});

	it("splits two families into three tokens (name, comma, name)", () => {
		expect(tokenizer("serif, monospace")).toEqual(["serif", ",", "monospace"]);
	});

	it("preserves spaces within an unquoted multi-word name", () => {
		expect(tokenizer("Times New Roman")).toEqual(["Times New Roman"]);
	});

	it("treats a quoted name as a single token", () => {
		expect(tokenizer('"Times New Roman"')).toEqual(['"Times New Roman"']);
	});

	it("handles a quoted name followed by a fallback", () => {
		expect(tokenizer('"Times New Roman", serif')).toEqual(['"Times New Roman"', ",", "serif"]);
	});

	it("strips leading/trailing spaces around a name", () => {
		expect(tokenizer("  serif  ")).toEqual(["serif"]);
	});

	it("handles single-quoted family name", () => {
		expect(tokenizer("'Comic Sans MS'")).toEqual(["'Comic Sans MS'"]);
	});
});

describe("fontFamily grammar", () => {
	describe("generic family names", () => {
		it("maps 'serif' to itself", () => {
			const result = parseFamily("serif");
			expect(result?.[0]?.value).toBe("serif");
		});

		it("maps 'monospace' to itself", () => {
			expect(parseFamily("monospace")?.[0]?.value).toBe("monospace");
		});

		it("maps 'sansSerif' to 'sans-serif'", () => {
			expect(parseFamily("sansSerif")?.[0]?.value).toBe("sansSerif");
		});

		it("maps 'proportionalSansSerif' to 'sans-serif'", () => {
			expect(parseFamily("proportionalSansSerif")?.[0]?.value).toBe("proportionalSansSerif");
		});

		it("maps 'proportionalSerif' to 'serif'", () => {
			expect(parseFamily("proportionalSerif")?.[0]?.value).toBe("proportionalSerif");
		});

		it("maps 'monospaceSansSerif' to 'monospace'", () => {
			expect(parseFamily("monospaceSansSerif")?.[0]?.value).toBe("monospaceSansSerif");
		});

		it("maps 'monospaceSerif' to 'monospace'", () => {
			expect(parseFamily("monospaceSerif")?.[0]?.value).toBe("monospaceSerif");
		});

		it("parses 'default'", () => {
			expect(parseFamily("default")?.[0]?.value).toBe("default");
		});
	});

	describe("quoted family names", () => {
		it("parses a double-quoted name and strips the quotes", () => {
			expect(parseFamily('"Times New Roman"')?.[0]?.value).toBe("Times New Roman");
		});

		it("parses a single-quoted name and strips the quotes", () => {
			expect(parseFamily("'Comic Sans MS'")?.[0]?.value).toBe("Comic Sans MS");
		});
	});

	describe("unquoted multi-word family names", () => {
		it("parses an unquoted multi-word name as a single family", () => {
			expect(parseFamily("Times New Roman")?.[0]?.value).toBe("Times New Roman");
		});
	});

	describe("comma-separated lists", () => {
		it("parses two generic families", () => {
			const result = parseFamily("serif, monospace");
			expect(result).toHaveLength(2);
			expect(result[0].value).toBe("serif");
			expect(result[1].value).toBe("monospace");
		});

		it("parses a quoted name followed by a generic fallback", () => {
			const result = parseFamily('"Times New Roman", serif');
			expect(result).toHaveLength(2);
			expect(result[0].value).toBe("Times New Roman");
			expect(result[1].value).toBe("serif");
		});

		it("parses three families", () => {
			const result = parseFamily("Arial, sansSerif, default");
			expect(result).toHaveLength(3);
			expect(result[0].value).toBe("Arial");
			expect(result[1].value).toBe("sansSerif");
			expect(result[2].value).toBe("default");
		});
	});

	describe("invalid input", () => {
		it("returns null for an empty string", () => {
			expect(parseFamily("")).toBeNull();
		});

		it("returns null for a value starting with a digit", () => {
			expect(parseFamily("123font")).toBeNull();
		});
	});
});
