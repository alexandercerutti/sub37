import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { Measure } from "./measure.js";

/**
 * @syntax \<extent>
 *  : "auto"
 *  | "contain"
 *  | "cover"
 *  | \<measure> \<lwsp> \<measure>
 *
 * @see https://w3c.github.io/ttml2/#style-value-extent
 */
export const Extent = createStyleNode("extent", "extent", () => [
	Kleene.or(
		createStyleNode("auto", "auto"),
		createStyleNode("contain", "contain"),
		createStyleNode("cover", "cover"),
		Kleene.ordered(Measure, Measure),
	),
]);
