import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextOutlineGrammar } from "../syntax/text-outline.js";

export { TextOutlineGrammar as Grammar } from "../syntax/text-outline.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOutlineGrammar>,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> | null {
	if (value[0].type === "keyword") {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const [
		//
		{ value: outlineColor },
		{ value: outlineThickness },
		{ value: outlineBlurRadius },
	] = value;

	return [
		["text-shadow", `${outlineColor} 1px 1px ${outlineBlurRadius}`],
		["-webkit-text-stroke", `${outlineThickness} ${outlineColor}`],
	];
}
