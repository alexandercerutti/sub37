import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { toLength } from "../../Units/length.js";

/**
 *
 * @syntax "auto" | "fitContent" | "maxContent" | "minContent" | \<length>
 *
 * A \<measure> value expresses a distance as an absolute dimension or a relative dimension,
 * where the context of use determines which dimension applies.
 *
 * If one of the two absolute dimensions, height or width, applies, then the associated
 * relative dimension, bpd or ipd, is determined in accordance with the applicable writing mode
 * and text orientation, such that the associated relative dimension governs the interpretation
 * of the specified value as described below.
 *
 * Otherwise, one of the two relative dimensions, bpd or ipd, applies, in which case that
 * relative dimension governs the interpretation of the specified value as defined below.
 *
 * The semantics of these values are defined as follows:
 *
 * **auto**
 *
 *   For ipd, when applied to an image, the intrinsic size in the inline progression direction;
 *   otherwise, the numeric value that would be obtained if a value of 100% were specified.
 *
 *   For bpd, when applied to an image, the intrinsic size in the block progression direction;
 *   otherwise, the numeric value that would be obtained if a value of 100% were specified.
 *
 * **fitContent**
 *
 *   A numeric value equal to the maximum of the values of (1) minContent and
 *   (2) the minimum of values of maxContent and auto.
 *
 * **maxContent**
 *
 *   For ipd, the maximum numeric value that encloses all of the element's content such
 *   that lines are broken only at hard, i.e., mandatory, break points, even if that
 *   means overflowing the parent's ipd.
 *
 *   For bpd, the maximum numeric value that encloses all of the element's content such
 *   that lines are broken at all possible line break positions, i.e., both hard (mandatory)
 *   and soft (optional) break points.
 *
 * **minContent**
 *
 *   For ipd, the minimum numeric value that encloses all of the element's content such
 *   that lines are broken at all possible line break positions, i.e., both hard (mandatory)
 *   and soft (optional) break points.
 *
 *   For bpd, the minimum numeric value that encloses all of the element's content such
 *   that lines are broken only at hard, i.e., mandatory, break points, even if that
 *   means overflowing the parent's ipd.
 *
 * **\<length>**
 *
 *   A non-negative numeric value expressed as a scalar or percentage.
 *
 * @see https://w3c.github.io/ttml2/#style-value-measure
 */
export const Measure = createStyleNode("measure", "measure", () => [
	Kleene.or(
		createStyleNode("auto", "auto"),
		createStyleNode("fitContent", "fitContent"),
		createStyleNode("maxContent", "maxContent"),
		createStyleNode("minContent", "minContent"),
		createStyleNode(
			"length",
			"length",
			() => [],
			(value) => toLength(value)?.toString(),
		),
	),
]);
