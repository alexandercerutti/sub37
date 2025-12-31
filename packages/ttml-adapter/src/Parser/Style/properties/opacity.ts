import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { OpacityGrammar } from "../syntax/opacity.js";

export { OpacityGrammar as Grammar } from "../syntax/opacity.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof OpacityGrammar>,
): PropertiesCollection<["opacity"]> {
	return [["opacity", String(value[0])]];
}
