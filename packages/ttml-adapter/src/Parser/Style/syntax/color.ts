import { isValidColor } from "../../Units/color.js";
import { createStyleNode } from "./StyleNode.js";

function colorValidator(attribute: string): string | undefined {
	if (!isValidColor(attribute)) {
		return undefined;
	}

	return attribute;
}

/**
 * @syntax \<color>
 * @see https://w3c.github.io/ttml2/#style-value-color
 */
export const Color = createStyleNode(null, null, () => [
	createStyleNode("color", "color", () => [], colorValidator),
]);
