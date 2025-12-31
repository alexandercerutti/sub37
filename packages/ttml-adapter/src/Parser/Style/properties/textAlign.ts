import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextAlignGrammar } from "../syntax/text-align";

export { TextAlignGrammar as Grammar } from "../syntax/text-align.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextAlignGrammar>,
): PropertiesCollection<["text-align"]> | null {
	return [["text-align", value[0]]];
}
