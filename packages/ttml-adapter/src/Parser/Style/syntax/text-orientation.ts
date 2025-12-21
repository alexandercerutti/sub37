import type { PropertiesCollection } from "../../parseStyle";
import type { Scope } from "../../Scope/Scope";
import { alias } from "../structure/derivables/alias";
import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";
import type { InferDerivableValue } from "../structure/operators";

/**
 * @syntax "sideways" | "mixed" | "upright"
 * @see https://w3c.github.io/ttml2/#style-attribute-textOrientation
 */

export const Grammar = alias(
	"<text-orientation>",
	oneOf([
		//
		keyword("sideways"),
		keyword("mixed"),
		keyword("upright"),

		// Legacy values
		keyword("sideways-left"),
		keyword("sideways-right"),

		// SVG ignore value
		keyword("use-glyph-orientation"),
	]),
);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof Grammar>,
): PropertiesCollection<["text-orientation"]> | null {
	switch (value) {
		// Kept only for compatibility. Remapping.
		case "sideways-left":
		case "sideways-right": {
			return [["text-orientation", "sideways"]];
		}

		case "use-glyph-orientation": {
			// Invalid, as it is used only for SVG
			return null;
		}
	}

	return [["text-orientation", value]];
}
