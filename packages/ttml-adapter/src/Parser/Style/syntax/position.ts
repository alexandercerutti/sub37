import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { toLength } from "../../Units/length.js";

/**
 * @syntax "left" | "right"
 */
const EdgeKeywordH = createStyleNode("edge-keyword-h", "edge-keyword-h", () => [
	Kleene.or(
		//
		createStyleNode("left", "left"),
		createStyleNode("right", "right"),
	),
]);

/**
 * @syntax "top" | "bottom"
 */
const EdgeKeywordV = createStyleNode("edge-keyword-v", "edge-keyword-v", () => [
	Kleene.or(
		//
		createStyleNode("top", "edge-keyword-v"),
		createStyleNode("bottom", "edge-keyword-v"),
	),
]);

/**
 * @syntax "center" | edge-keyword-h
 */
const PositionKeywordH = createStyleNode("position-keyword-h", "position-keyword-h", () => [
	Kleene.or(
		//
		createStyleNode("center", "center"),
		EdgeKeywordH,
	),
]);

/**
 * @syntax "center" | edge-keyword-v
 */
const PositionKeywordV = createStyleNode("position-keyword-v", "position-keyword-v", () => [
	Kleene.or(
		//
		createStyleNode("center", "center"),
		EdgeKeywordV,
	),
]);

/**
 * @syntax edge-keyword-h \<lwsp> \<length>
 */
const EdgeOffsetH = createStyleNode("edge-offset-h", "edge-offset-h", () => [
	Kleene.ordered(
		//
		EdgeKeywordH,
		createStyleNode(
			"length",
			"h-length",
			() => [],
			(value) => toLength(value)?.toString(),
		),
	),
]);

/**
 * @syntax edge-keyword-v \<lwsp> \<length>
 */
const EdgeOffsetV = createStyleNode("edge-offset-v", "edge-offset-v", () => [
	Kleene.ordered(
		//
		EdgeKeywordV,
		createStyleNode(
			"length",
			"v-length",
			() => [],
			(value) => toLength(value)?.toString(),
		),
	),
]);

/**
 * @syntax position-keyword-h | \<length>
 */
const OffsetPositionH = createStyleNode("offset-position-h", "offset-position-h", () => [
	Kleene.or(
		//
		PositionKeywordH,
		createStyleNode(
			"length",
			"h-length",
			() => [],
			(value) => toLength(value)?.toString(),
		),
	),
]);

/**
 * @syntax position-keyword-v | \<length>
 */
const OffsetPositionV = createStyleNode("offset-position-v", "offset-position-v", () => [
	Kleene.or(
		//
		PositionKeywordV,
		createStyleNode(
			"length",
			"v-length",
			() => [],
			(value) => toLength(value)?.toString(),
		),
	),
]);

/**
 * @syntax
 *  | offset-position-h
 *  | edge-keyword-v
 *  | offset-position-h \<lwsp> offset-position-v
 *  | position-keyword-v \<lwsp> position-keyword-h
 *  | position-keyword-h \<lwsp> edge-offset-v
 *  | position-keyword-v \<lwsp> edge-offset-h
 *  | edge-offset-h \<lwsp> position-keyword-v
 *  | edge-offset-v \<lwsp> position-keyword-h
 *  | edge-offset-h \<lwsp> edge-offset-v
 *  | edge-offset-v \<lwsp> edge-offset-h
 *
 * @see https://w3c.github.io/ttml2/#style-value-position
 *
 * A \<position> expression is used to indirectly determine
 * the origin of an area or an image with respect to a reference area.
 *
 * A \<position> expression may consist of one to four component values as
 * follows, formally defined by the above syntax:
 *
 * **one component**
 * 		either a horizontal offset position or a vertical edge keyword
 *
 * **two components**
 * 		a horizontal position offset followed by a vertical position offset
 * 		or a vertical position keyword followed by a horizontal position keyword
 *
 * **three components**
 * 		a horizontal edge offset and a vertical position keyword or a horizontal
 * 		position keyword and a vertical edge offset, in any order
 *
 * **four components**
 * 		a horizontal edge offset and a vertical edge offset, in any order
 *
 * Every \<position> expression can be translated to a four component equivalent
 * of the form left \<length> top \<length> by means of the following equivalence
 * tables:
 *
 * ---
 *
 * **One Component Equivalents**
 *
 * | Value    	|     Equivalent    |
 * |------------|-------------------|
 * | center			|	center center			|
 * | left				|	left center 			|
 * | right			|	right center			|
 * | top				|	center top				|
 * | bottom			|	center bottom			|
 * | \<length>	|	\<length> center	|
 *
 * ---
 *
 * **Two Component Equivalents**
 *
 * | Value										|	Equivalent													|
 * |--------------------------|-------------------------------------|
 * | bottom center						| left 50% top 100%										|
 * | bottom left							| left 0% top 100%										|
 * | bottom right							| left 100% top 100%									|
 * | center center						| left 50% top 50%										|
 * | center top								| left 50% top 0%											|
 * | center bottom						| left 50% top 100%										|
 * | center left							| left 0% top 50%											|
 * | center right							| left 100% top 50%										|
 * | center \<length>					| left 50% top \<length>							|
 * | left center							| left 0% top 50%											|
 * | left top									| left 0% top 0%											|
 * | left bottom							| left 0% top 100%										|
 * | left \<length>						| 	left 0% top \<length>							|
 * | right center							| left 100% top 50%										|
 * | right top								| left 100% top 0%										|
 * | right bottom							| left 100% top 100%									|
 * | right \<length>					| 	left 100% top \<length>						|
 * | top center								| left 50% top 0%											|
 * | top left									| left 0% top 0%											|
 * | top right								| left 100% top 0%										|
 * | \<length> center					| 	left \<length> top 50%						|
 * | \<length> top						| 	left \<length> top 0%							|
 * | \<length> bottom					| 	left \<length> top 100%						|
 * | \<length-1> \<length-2>	| 	left \<length-1> top \<length-2>	|
 *
 * Note:
 * When a two component expression consists of two \<length> values, then,
 * to avoid a possibly ambiguous interpretation, the first is interpreted
 * as a horizontal length and the second as a vertical length as indicated
 * in the last row of the above table.
 *
 * ---
 *
 * **Three Component Equivalents**
 *
 * | Value										|	Equivalent									|
 * |--------------------------|-----------------------------|
 * | bottom left \<length>		|	left \<length> top 100			|
 * | bottom right \<length>		|	right \<length> top 100			|
 * | bottom \<length> center	|	left 50% bottom \<length>		|
 * | bottom \<length> left		|	left 0% bottom \<length>		|
 * | bottom \<length> right		|	left 100% bottom \<length>	|
 * | center bottom \<length>	|	left 50% bottom \<length>		|
 * | center left \<length>		|	left \<length> top 50				|
 * | center right \<length>		|	right \<length> top 50			|
 * | center top \<length>			|	left 50% top \<length>			|
 * | left bottom \<length>		|	left 0% bottom \<length>		|
 * | left top \<length>				|	left 0% top \<length>				|
 * | left \<length> bottom		|	left \<length> top 100			|
 * | left \<length> center		|	left \<length> top 50				|
 * | left \<length> top				|	left \<length> top 0				|
 * | right bottom \<length>		|	left 100% bottom \<length>	|
 * | right top \<length>			|	left 100% top \<length>			|
 * | right \<length> bottom		|	right \<length> top 100			|
 * | right \<length> center		|	right \<length> top 50			|
 * | right \<length> top			|	right \<length> top 0				|
 * | top left \<length>				|	left \<length> top 0				|
 * | top right \<length>			|	right \<length> top 0				|
 * | top \<length> center			|	left 50% top \<length>			|
 * | top \<length> left				|	left 100% top \<length>			|
 * | top \<length> right			|	left 100% top \<length>			|
 *
 * ---
 *
 * **Four Component Equivalents**
 *
 * | Value																	|	Equivalent																					|
 * |----------------------------------------|-----------------------------------------------------|
 * |	bottom \<length-v> left \<length-h>		|	left \<length-h> top (100% - \<length-v>)						|
 * |	bottom \<length-v> right \<length-h>	|	left (100% - \<length-h>) top (100% - \<length-v>)	|
 * |	left \<length-h> bottom \<length-v>		|	left \<length-h> top (100% - \<length-v>)						|
 * |	right \<length-h> bottom \<length-v>	|	left (100% - \<length-h>) top (100% - \<length-v>)	|
 * |	right \<length-h> top \<length-v>			|	left (100% - \<length-h>) top \<length-v>						|
 * |	top \<length-v> left \<length-h>			|	left \<length-h> top \<length-v>										|
 * |	top \<length-v> right \<length-h>			|	left (100% - \<length-h>) top \<length-v>						|
 *
 * If a \<length> component is expressed as a percentage, then that
 * percentage is interpreted in relation to some reference dimension,
 * where the reference dimension is defined by the context of use.
 *
 * A \<length> component of a \<position> expression may be positive or negative.
 * Positive lengths are interpreted as insets from the referenced
 * edge, while negative lengths are interpreted as outsets from the
 * referenced edge.
 *
 * For example, an inset from the left edge is located to the right
 * of that edge (if non-zero), while an outset from the left edge is
 * located to the left of that edge (if non-zero).
 *
 * In contrast, an inset from the right edge is located to the left
 * of that edge (if non-zero), while an outset from the right edge is
 * located to the right of that edge (if non-zero).
 *
 * A similar arrangement holds for top and bottom edges.
 *
 * When performing four component equivalent conversion, the expression
 * (100% - \<length-h>) is to be interpreted as the difference between
 * 100% and the percentage equivalent of the \<length-h> expression.
 *
 * Similarly, the expression (100% - \<length-v>) is to be interpreted
 * as the difference between 100% and the percentage equivalent of the
 * \<length-v> expression.
 *
 * In both cases, the resulting difference may be a negative percentage.
 */
export const Position = createStyleNode("position", "position", () => [
	Kleene.or(
		// Single component values
		OffsetPositionH,
		EdgeKeywordV,

		// Two component values
		Kleene.ordered(OffsetPositionH, OffsetPositionV),
		Kleene.ordered(PositionKeywordV, PositionKeywordH),

		// Three component values
		Kleene.ordered(PositionKeywordH, EdgeOffsetV),
		Kleene.ordered(PositionKeywordV, EdgeOffsetH),
		Kleene.ordered(EdgeOffsetH, PositionKeywordV),
		Kleene.ordered(EdgeOffsetV, PositionKeywordH),

		// Four component values
		Kleene.ordered(EdgeOffsetH, EdgeOffsetV),
		Kleene.ordered(EdgeOffsetV, EdgeOffsetH),
	),
]);
