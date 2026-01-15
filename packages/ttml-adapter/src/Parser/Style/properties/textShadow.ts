import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextShadowGrammar } from "../syntax/text-shadow.js";

export { TextShadowGrammar as Grammar } from "../syntax/text-shadow.js";

/**
 * TextShadow allows splitting by commas to separate multiple shadows
 * @param input
 * @returns 
 */
export function tokenizer(input: string): string[] {
	return input.split(/\s*(,)\s*|\s+/).filter(Boolean);
}

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextShadowGrammar>,
): PropertiesCollection<["text-shadow"]> | null {
	return [["text-shadow", value.map(({ value }) => value.toString()).join(" ")]];
}
