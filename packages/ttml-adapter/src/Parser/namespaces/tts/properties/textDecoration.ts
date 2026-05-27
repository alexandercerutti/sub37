import { readScopeErrorContext } from "../../../Scope/ErrorContext.js";
import type { Scope } from "../../../Scope/Scope.js";
import type { PropertiesCollection } from "../../../parseStyle.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { TextDecorationGrammar } from "../syntax/text-decoration.js";

export const Grammar = alias("tts:textDecoration", TextDecorationGrammar);

/**
 * @TODO TTML allows several values that CSS do not expect,
 * like `"noUnderline"`, `"noLineThrough"`, `"noOverline"`.
 *
 * However, resetting text-decoration is a difficult matter, as
 * it requires creating a span and setting it to have
 * `display: inline-block`.
 *
 * This is important as introducing such style, might compromise
 * the whole rendering in the captions-renderer.
 *
 * Further tests should be performed.
 *
 * Just for reference for when this will be implemented, to perform
 * a reset of text-decoration and apply a different effect, two nested
 * spans should be produced:
 *
 * @example
 * ```html
 * <div style="text-decoration: underline">
 * 	<p>
 * 		Lorem ipsum dolor sit amet, consectetur
 * 		<span style="text-decoration: none; display: inline-block">
 * 			<span style="text-decoration: line-through"> adipiscing elit </span>
 * 		</span>
 * 	</p>
 * 	. Curabitur tempor vitae augue lobortis rutrum. Nam nisi enim, lobortis
 * </div>
 * ```
 *
 * Producing two spans would mean, probably, to emit a "style reset entity"
 * or something like that.
 *
 * As this is right now too complex to achieve, I rathered to disable
 * the `text-decoration` property at all. Sorry folks.
 *
 * @see https://www.w3.org/TR/ttml2/#style-attribute-textDecoration
 */

export function cssTransform(
	scope: Scope,
	_value: InferDerivableValue<typeof TextDecorationGrammar>,
): PropertiesCollection<[]> | null {
	const errorContext = readScopeErrorContext(scope)!;

	errorContext.report(
		new Error(
			`text-decoration property is not supported.
			You might want help supporting that. Look for this message in the codebase,
			and you'll find a full explanation on what should be done to achieve it.`,
		),
		false,
	);

	return null;
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof TextDecorationGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
