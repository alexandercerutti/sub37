import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { BorderGrammar } from "../syntax/border.js";

export { BorderGrammar as Grammar } from "../syntax/border.js";

export function cssTransform(
	_scope: Scope,
	values: InferDerivableValue<typeof BorderGrammar>,
): PropertiesCollection<["border-width", "border-style", "border-color", "border-radius"]> {
	let borderColor: string | undefined = undefined;
	let borderStyle: string | undefined = undefined;
	let borderWidth: string | undefined = undefined;
	let borderRadius: string | undefined = undefined;

	for (const output of values) {
		if (isBorderColor(output)) {
			borderColor = output.value.value;
		} else if (isBorderStyle(output)) {
			const nakedValue = output.value[0].value;
			borderStyle = nakedValue;
		} else if (isBorderWidth(output)) {
			const nakedValue = output.value[0].value;
			borderWidth = nakedValue.toString();
		} else if (isBorderRadius(output)) {
			borderRadius = output.value;
		}
	}

	return [
		["border-width", borderWidth || ""],
		["border-style", borderStyle || ""],
		["border-color", borderColor || ""],
		["border-radius", borderRadius || ""],
	];
}

type ExtractBorderProperty<Name extends string> = Extract<
	InferDerivableValue<typeof BorderGrammar>[number],
	{ type: Name }
>;

type BorderColor = ExtractBorderProperty<"border-color">;

function isBorderColor(
	value: InferDerivableValue<typeof BorderGrammar>[number],
): value is BorderColor {
	return value.type === "border-color";
}

type BorderRadius = ExtractBorderProperty<"border-radius">;

function isBorderRadius(
	value: InferDerivableValue<typeof BorderGrammar>[number],
): value is BorderRadius {
	return value.type === "border-radius";
}

type BorderWidth = ExtractBorderProperty<"border-width">;

function isBorderWidth(
	value: InferDerivableValue<typeof BorderGrammar>[number],
): value is BorderWidth {
	return value.type === "border-width";
}

type BorderStyle = ExtractBorderProperty<"border-style">;

function isBorderStyle(
	value: InferDerivableValue<typeof BorderGrammar>[number],
): value is BorderStyle {
	return value.type === "border-style";
}
