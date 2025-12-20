import type { PropertiesCollection } from "../../parseStyle";
import type { Scope } from "../../Scope/Scope";
import { alias } from "../structure/derivables/alias";
import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax "repeat" | "repeatX" | "repeatY" | "noRepeat"
 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundRepeat
 */
export const Grammar = alias(
	"<background-repeat>",
	oneOf([
		//
		keyword("repeat"),
		keyword("repeatX"),
		keyword("repeatY"),
		keyword("noRepeat"),
	]),
);

export function cssTransform(
	_scope: Scope,
	value: "repeat" | "repeatX" | "repeatY" | "noRepeat",
): PropertiesCollection<["background-repeat"]> {
	switch (value) {
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
