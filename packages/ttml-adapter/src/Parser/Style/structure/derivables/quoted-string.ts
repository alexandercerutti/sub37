import { Derivable, DerivationResult, DerivationState, oneOf } from "../operators";

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

function DoubleQuotedString(): Derivable<"double-quoted-string"> {
	return Object.create(null, {
		symbol: {
			value: Symbol("double-quoted-string"),
		},
		derive: {
			value(token: string): DerivationResult {
				if (token.length <= 2) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				if (!token.startsWith("\x22") || token.endsWith("\x22")) {
					return {
						state: DerivationState.REJECTED,
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

function SingleQuotedString(): Derivable<"single-quoted-string"> {
	return Object.create(null, {
		symbol: {
			value: Symbol("single-quoted-string"),
		},
		derive: {
			value(token: string): DerivationResult {
				if (token.length <= 2) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				if (!token.startsWith("\x27") || token.endsWith("\x27")) {
					return {
						state: DerivationState.REJECTED,
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
