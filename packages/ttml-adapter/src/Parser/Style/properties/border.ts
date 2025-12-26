import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import { isLength } from "../../Units/length.js";
import type { BorderGrammar } from "../syntax/border.js";

export { BorderGrammar as Grammar } from "../syntax/border.js";

export function cssTransform(
	_scope: Scope,
	values: InferDerivableValue<typeof BorderGrammar>[],
): PropertiesCollection<["border-width", "border-style", "border-color", "border-radius"]> {
	const propertiesDictionary = values.reduce(
		(acc, curr) => {
			acc[curr.type] = isLength(curr.value) ? curr.value.toString() : curr.value;
			return acc;
		},
		{
			"border-color": "",
			"border-style": "",
			"border-width": "",
			"border-radius": "",
		} as { [K in InferDerivableValue<typeof BorderGrammar>["type"]]: string },
	);

	return [
		["border-width", propertiesDictionary["border-width"]],
		["border-style", propertiesDictionary["border-style"]],
		["border-color", propertiesDictionary["border-color"]],
		["border-radius", propertiesDictionary["border-radius"]],
	];
}
