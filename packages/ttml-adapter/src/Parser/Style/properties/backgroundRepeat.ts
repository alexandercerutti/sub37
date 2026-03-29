import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { BackgroundRepeatGrammar } from "../syntax/background-repeat.js";

export { BackgroundRepeatGrammar as Grammar } from "../syntax/background-repeat.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof BackgroundRepeatGrammar>,
): PropertiesCollection<["background-repeat"]> {
	switch (value[0].value) {
		case "repeat": {
			return [["background-repeat", "repeat"]];
		}

		case "repeatX": {
			return [["background-repeat", "repeat-x"]];
		}

		case "repeatY": {
			return [["background-repeat", "repeat-y"]];
		}

		case "noRepeat": {
			return [["background-repeat", "no-repeat"]];
		}
	}
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof BackgroundRepeatGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
