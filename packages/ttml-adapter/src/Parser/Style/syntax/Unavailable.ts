import { createStyleNode } from "./StyleNode.js";

/**
 * This syntax acts like a placeholder, because
 * we might not have implemented or won't implement
 * a certain syntax.
 */
export const Unavailable = createStyleNode(null, null, () => [
	createStyleNode("unavailable", "unavailable"),
]);
