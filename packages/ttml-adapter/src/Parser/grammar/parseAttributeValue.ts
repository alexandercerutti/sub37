import type { Derivable, DerivedValue, InferDerivableValue } from "../structure/grammar.js";
import { isDerived, isRejected } from "../structure/grammar.js";
import { getSplittedLinearWhitespaceValues } from "../lwsp.js";

export interface GrammarDefinition<Grammar extends Derivable = Derivable> {
	Grammar: Grammar;

	tokenizer?(input: string): string[];

	validateAnimation?(
		keyframes: (DerivedValue | undefined)[][],
		animationType: "discrete" | "continuous",
	): boolean;
}

/**
 * Parses a style attribute value according to its definition grammar.
 *
 * Please note that animation-value-list might be defined as follows as well
 * for multi-components attributes, like `tts:border`:
 *
 * ```
 * tts:border="2px red; green; blue"
 * ```
 *
 * or
 *
 * ```xml
 * <p tts:border="2x solid">
 * 	<animate tts:border="red; green; blue"/>
 * 	<span>
 * 		A paragraph with a 2px, solid border with a linear animated border color
 * 		transitioning from red to green to blue
 * 		over implied keyTimes="0;0.5;1".
 * 	</span>
 * </p>
 * ```
 *
 * Both of these cases define that there is a default value for `2px solid` (width and style)
 * and that they do not need to be re-defined in the animation values.
 *
 * The grammar system, as was designed, is not able to handle this case yet because it is strict
 * according to the syntax definitions. Supporting these cases would require a more complex system
 * that could bypass derivation rejections when checking for animations.
 *
 * So, in order to correctly support animations, full properties will need to be defined in each keyframe.
 *
 * Furthermore, this behavior is not explicitly defined in the TTML2 specification but rather in the
 * the emails I exchanged in the W3C TTML mailing list.
 *
 * @see https://lists.w3.org/Archives/Public/public-tt/2025Mar/0001.html
 */
export function parseAttributeValue<Syntax extends GrammarDefinition>(
	syntaxModuleDefinition: Syntax,
	value: string,
): InferDerivableValue<Syntax["Grammar"]> {
	const tokens =
		typeof syntaxModuleDefinition.tokenizer === "function"
			? syntaxModuleDefinition.tokenizer(value)
			: getSplittedLinearWhitespaceValues(value);

	let collectedValues: (DerivedValue | undefined)[] = [];
	let nextGrammar: Derivable = syntaxModuleDefinition.Grammar;

	while (tokens.length) {
		const token = tokens.shift();

		if (!token) {
			break;
		}

		const tokenDerivationResult = nextGrammar.derive(token);
		const syntaxName = syntaxModuleDefinition.Grammar.type;

		if (isRejected(tokenDerivationResult)) {
			// A token couldn't be derived, skip entire attribute
			throw new StyleParsingUnrecognizedTokenError(value, syntaxName, token);
		}

		if (isDerived(tokenDerivationResult)) {
			nextGrammar = tokenDerivationResult.nextNode;
			collectedValues = collectedValues.concat(tokenDerivationResult.values);
			continue;
		}

		if (tokens.length > 0) {
			throw new StyleParsingExcessTokensError(value, syntaxName);
		}

		collectedValues = collectedValues.concat(tokenDerivationResult.values);
	}

	// Safe casting, but typescript cannot hold the reference.
	return collectedValues as InferDerivableValue<Syntax["Grammar"]>;
}

class StyleParsingExcessTokensError extends Error {
	constructor(value: string, syntaxName: string) {
		super();

		this.name = "StyleParsingExcessTokensError";
		this.message = `Can't parse attribute value '${value}' according to syntax '${syntaxName}': extra unknown tokens found after parsing succeeded correctly. The whole attribute is ignored.`;
	}
}

class StyleParsingUnrecognizedTokenError extends Error {
	constructor(value: string, syntaxName: string, token: string) {
		super();

		this.name = "StyleParsingUnrecognizedTokenError";
		this.message = `Can't parse attribute value '${value}' according to syntax '${syntaxName}': unrecognized token '${token}' found. The whole attribute is ignored.`;
	}
}
