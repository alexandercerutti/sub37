import { oneOf, sequence, zeroOrMore } from "../../../structure/grammar.js";
import { keyword } from "../structure/derivables/keyword.js";
import { QuotedString } from "../structure/derivables/quoted-string.js";
import { UnquotedString } from "../structure/derivables/unquoted-string.js";

const GenericFamilyNames = oneOf([
	keyword("default"),
	keyword("monospace"),
	keyword("sansSerif"),
	keyword("serif"),
	keyword("monospaceSansSerif"),
	keyword("monospaceSerif"),
	keyword("proportionalSansSerif"),
	keyword("proportionalSerif"),
]);

const FontFamilyGrammar = oneOf([
	/**
	 * Order here is important.
	 * Generic family names are more specific than just strings.
	 */
	GenericFamilyNames,
	oneOf([
		//
		QuotedString,
		UnquotedString(),
	]),
]);

/**
 * @syntax <font-families>
 *   : font-family (<lwsp>? "," <lwsp>? font-family)*
 * @see https://w3c.github.io/ttml2/#style-value-font-families
 */
export const FontFamiliesGrammar = sequence([
	FontFamilyGrammar,
	zeroOrMore(
		//
		sequence([
			//
			keyword(","),
			FontFamilyGrammar,
		]),
	),
]);
