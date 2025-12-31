import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { ColorGrammar } from "../syntax/color.js";

export { ColorGrammar as Grammar } from "../syntax/color.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof ColorGrammar>,
): PropertiesCollection<["background-color"]> | null {
	return [["background-color", value[0]]];
}
