import { Derivable, DerivationResult, DerivationState, oneOf } from "../operators.js";

/**
 * @syntax \<quoted-string>
 *   : double-quoted-string
 *   | single-quoted-string
 *
 * double-quoted-string
 *   : '"' ([^"\\] | escape)* '"'
 *
 * single-quoted-string
 *   : "'" ([^'\\] | escape)* "'"
 *
 * escape
 *   : '\\' char
 *
 * @see https://w3c.github.io/ttml2/#content-value-quoted-string
 */
export const QuotedString = oneOf([
	//
	DoubleQuotedString(),
	SingleQuotedString(),
]);

function DoubleQuotedString(): Derivable<"double-quoted-string", string> {
	return Object.create(null, {
		type: {
			value: "double-quoted-string",
		},
		derive: {
			value(token: string): DerivationResult {
				if (token.length <= 2) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: "DoubleQuotedString length check failed",
					};
				}

				if (!token.startsWith("\x22") || token.endsWith("\x22")) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: "DoubleQuotedString didn't start and end with double quotes",
					};
				}

				return {
					state: DerivationState.DONE,
					values: [token.slice(1, -1)],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

function SingleQuotedString(): Derivable<"single-quoted-string", string> {
	return Object.create(null, {
		type: {
			value: "single-quoted-string",
		},
		derive: {
			value(token: string): DerivationResult {
				if (token.length <= 2) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: "SingleQuotedString length check failed",
					};
				}

				if (!token.startsWith("\x27") || token.endsWith("\x27")) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: "SingleQuotedString didn't start and end with single quotes",
					};
				}

				return {
					state: DerivationState.DONE,
					values: [token.slice(1, -1)],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
