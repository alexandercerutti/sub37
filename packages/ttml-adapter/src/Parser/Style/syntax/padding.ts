import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { toLength } from "../../Units/length.js";
import { getSplittedLinearWhitespaceValues } from "../../Units/lwsp.js";

function PaddingProcessor(value: string) {
	return getSplittedLinearWhitespaceValues(value);
}

/**
 * @syntax \<padding>
 *  : \<length> \<lwsp> \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length>
 *  | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-padding
 */
export const Padding = createStyleNode(null, null, () => [
	createStyleNode(
		"padding",
		"padding",
		() => [
			Kleene.or(
				// Four values: top right bottom left
				Kleene.ordered(
					createStyleNode(
						"length",
						"padding-top",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-right",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-bottom",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-left",
						() => [],
						(value) => toLength(value)?.toString(),
					),
				),

				// Three values: top right/left bottom
				Kleene.ordered(
					createStyleNode(
						"length",
						"padding-top",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-right-left",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-bottom",
						() => [],
						(value) => toLength(value)?.toString(),
					),
				),

				// Two values: top/bottom right/left
				Kleene.ordered(
					createStyleNode(
						"length",
						"padding-top-bottom",
						() => [],
						(value) => toLength(value)?.toString(),
					),
					createStyleNode(
						"length",
						"padding-right-left",
						() => [],
						(value) => toLength(value)?.toString(),
					),
				),

				// One value: all sides
				createStyleNode(
					"length",
					"padding-all",
					() => [],
					(value) => toLength(value)?.toString(),
				),
			),
		],
		PaddingProcessor,
	),
]);
