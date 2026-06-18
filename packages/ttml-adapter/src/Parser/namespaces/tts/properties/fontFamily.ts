import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { DerivedValue, InferDerivableValue } from "../../../structure/grammar.js";
import { FontFamiliesGrammar } from "../syntax/font-family.js";

export const Grammar = alias("tts:fontFamily", FontFamiliesGrammar);

type InferredFontFamily = InferDerivableValue<typeof FontFamiliesGrammar>[number];
type GenericFamilyName = Extract<InferredFontFamily, DerivedValue<"keyword", string>>["value"];
type QuotedFontFamily = Extract<InferredFontFamily, DerivedValue<"font-families", string>>["value"];
type UnquotedFontFamily = Extract<
	InferredFontFamily,
	DerivedValue<"unquoted-string", string>
>["value"];

type FontFamily = GenericFamilyName | QuotedFontFamily | UnquotedFontFamily;

/**
 * Maps TTML generic family names (lowercased) to their CSS equivalents.
 * Empty string signals "omit from CSS output" (no CSS equivalent for "default").
 * @see https://w3c.github.io/ttml2/#style-value-generic-family-name
 */
const GENERIC_FAMILY_CSS_MAP = new Map([
	["default", ""],
	["monospace", "monospace"],
	["sansserif", "sans-serif"],
	["serif", "serif"],

	/* no exact CSS equivalent; closest approximations follow */
	["monospacesansserif", "monospace"],
	["monospaceserif", "monospace"],
	["proportionalsansserif", "sans-serif"],
	["proportionalserif", "serif"],
]);

/**
 * Splits on commas (emitting each comma as its own token) while preserving
 * spaces within each segment, so multi-word unquoted names like
 * "Times New Roman" arrive as a single token.
 */
export function tokenizer(input: string): string[] {
	return input
		.split(/\s*(,)\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof FontFamiliesGrammar>,
): PropertiesCollection<["font-family"]> | null {
	const values = value.slice();
	const fontFamilies: FontFamily[] = [];

	while (values.length) {
		const token = values.shift();

		switch (token?.type) {
			case undefined:
				continue;

			case "keyword": {
				const cssValue = GENERIC_FAMILY_CSS_MAP.get(token.value);

				if (cssValue === undefined) {
					/* unrecognized keyword value — reject entire declaration */
					return null;
				}

				if (cssValue !== "") {
					fontFamilies.push(cssValue);
				}

				continue;
			}

			case "unquoted-string": {
				fontFamilies.push(token.value);
				continue;
			}

			default:
				/* unrecognized token type — reject entire declaration */
				return null;
		}
	}

	return [["font-family", fontFamilies.join(", ")]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof FontFamiliesGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
