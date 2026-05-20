import { DerivationState } from "../operators.js";
import type { Derivable, DerivationResult, DerivedValue } from "../operators.js";

export type UnquotedString = DerivedValue<"unquoted-string", string>;

/**
 * identifier
 *   : [-]? identifier-start identifier-following*
 *
 * identifier-start
 *   : [_a-zA-Z] | non-ascii-or-c1 | escape
 *
 * identifier-following
 *   : [_a-zA-Z0-9-] | non-ascii-or-c1 | escape
 *
 * non-ascii-or-c1 : [^\0-\x9F]  (octal \237 = 0x9F)
 * escape          : '\\' char
 */
const IDENTIFIER_REGEX =
	/^-?(?:[_a-zA-Z\xA0-\uFFFF]|\\[\s\S])(?:[-_a-zA-Z0-9\xA0-\uFFFF]|\\[\s\S])*$/;

/**
 * @syntax unquoted-string : identifier (<lwsp> identifier)*
 *
 * Multi-word names (e.g. "Times New Roman") arrive as a single token
 * because the font-family tokenizer preserves spaces within each
 * comma-separated segment.
 *
 * @see https://w3c.github.io/ttml2/#style-value-font-families
 */
export function UnquotedString(): Derivable<"unquoted-string", UnquotedString> {
	return Object.create(null, {
		type: {
			value: "unquoted-string",
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				if (!token.split(/\x20+/).every((part) => IDENTIFIER_REGEX.test(part))) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: `${token} is not a valid unquoted-string`,
					};
				}

				return {
					state: DerivationState.DONE,
					values: [{ type: "unquoted-string", value: token }],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
