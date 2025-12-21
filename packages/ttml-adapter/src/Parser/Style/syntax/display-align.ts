import type { Scope } from "../../Scope/Scope";
import type { PropertiesCollection } from "../../parseStyle";
import { keyword } from "../structure/derivables/keyword";
import { as } from "../structure/derivables/tag";
import { oneOf } from "../structure/operators";
import type { InferDerivableValue } from "../structure/operators";

/**
 * @syntax "before" | "center" | "after" | "justify"
 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
 */
export const Grammar = as(
	"justify-content",
	oneOf([
		//
		keyword("before"),
		keyword("center"),
		keyword("after"),
		keyword("justify"),
	]),
);

export function cssTransform(
	_scope: Scope,
	outcome: InferDerivableValue<typeof Grammar>,
): PropertiesCollection<["justify-content"]> {
	switch (outcome.value) {
		case "before": {
			return [["justify-content", "flex-start"]];
		}

		case "center": {
			return [["justify-content", "center"]];
		}

		case "after": {
			return [["justify-content", "flex-end"]];
		}

		case "justify": {
			return [["justify-content", "space-between"]];
		}
	}
}
