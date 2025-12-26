import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextOutlineGrammar } from "../syntax/text-outline";

export { TextOutlineGrammar as Grammar } from "../syntax/text-outline";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOutlineGrammar>,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> | null {
	if (value[0] === "none") {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const [outlineColor, outlineThickness, outlineBlurRadius] = value;

	return [
		["text-shadow", `${outlineColor} 1px 1px ${outlineBlurRadius}`],
		["-webkit-text-stroke", `${outlineThickness} ${outlineColor}`],
	];
}
