import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import { isLength } from "../../Units/length.js";
import type { BorderGrammar } from "../syntax/border.js";

export { BorderGrammar as Grammar } from "../syntax/border.js";

type ExtractBorderProperty<Name extends string> = Extract<
	InferDerivableValue<typeof BorderGrammar>[number],
	{ type: Name }
>["value"][number];

export function cssTransform(
	_scope: Scope,
	values: InferDerivableValue<typeof BorderGrammar>,
): PropertiesCollection<["border-width", "border-style", "border-color", "border-radius"]> {
	let borderColor: string | undefined = undefined;
	let borderStyle: string | undefined = undefined;
	let borderWidth: string | undefined = undefined;
	let borderRadius: string | undefined = undefined;

	for (const { type, value } of values) {
		if (type === "border-color") {
			borderColor = value;
		} else if (type === "border-style") {
			const nakedValue = value[0] as ExtractBorderProperty<"border-style">;
			borderStyle = nakedValue;
		} else if (type === "border-width") {
			const nakedValue = value[0] as ExtractBorderProperty<"border-width">;
			borderWidth = isLength(nakedValue) ? nakedValue.toString() : nakedValue;
		} else if (type === "border-radius") {
			borderRadius = value;
		}
	}

	return [
		["border-width", borderWidth || ""],
		["border-style", borderStyle || ""],
		["border-color", borderColor || ""],
		["border-radius", borderRadius || ""],
	];
}
