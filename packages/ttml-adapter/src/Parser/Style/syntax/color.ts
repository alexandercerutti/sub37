import { createStyleNode } from "./StyleNode.js";

/**
 * @syntax \<color>
 * @see https://w3c.github.io/ttml2/#style-value-color
 */
export const Color = createStyleNode(null, null, () => [
	createStyleNode("color", "color", () => []),
]);
