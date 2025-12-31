import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PaddingGrammar } from "../syntax/padding.js";

export { PaddingGrammar as Grammar } from "../syntax/padding.js";

export function cssTransform(
	_scope: Scope,
	paddingValues: InferDerivableValue<typeof PaddingGrammar>,
): PropertiesCollection<["padding"]> | null {
	return [
		//
		["padding", paddingValues.map((value) => value.toString()).join(" ")],
	];
}
