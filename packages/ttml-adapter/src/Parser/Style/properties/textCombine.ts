import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextCombineGrammar } from "../syntax/text-combine.js";

export { TextCombineGrammar as Grammar } from "../syntax/text-combine.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextCombineGrammar>,
): PropertiesCollection<["text-combine-upright"]> {
	return [["text-combine-upright", value[0]]];
}
