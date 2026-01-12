import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextOutlineGrammar } from "../syntax/text-outline.js";

export { TextOutlineGrammar as Grammar } from "../syntax/text-outline.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOutlineGrammar>,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> | null {
	if (value.length === 1) {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const outlineColor: string | undefined = value[0]?.value.value;
	const outlineThickness: string | undefined = value[1]?.value.value.toString();
	const outlineBlurRadius: string | undefined = value[2]?.value.value.toString();

	/**
	 * For some kind of reason, Web Animation API doesn't support animating `-webkit-text-stroke`
	 * but @keyframes do. Therefore we need to use style tags for animation generation
	 * instead of WAAPI in the caption-renderer.
	 */

	return [
		["text-shadow", `1px 1px ${outlineBlurRadius || 0}px ${outlineColor || "currentColor"}`],
		["-webkit-text-stroke", `${outlineThickness || 0}px ${outlineColor || "currentColor"}`],
	];
}
