import { oneOf, sequence } from "../structure/operators.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";
import { length } from "../structure/derivables/length.js";
import { isLength, subtract } from "../../Units/length.js";
import type { Length } from "../../Units/length.js";
import { createUnit } from "../../Units/unit.js";

/**
 * @syntax "left" | "right"
 */
const EdgeKeywordH = oneOf([
	//
	keyword("left"),
	keyword("right"),
]);

/**
 * @syntax "top" | "bottom"
 */
const EdgeKeywordV = oneOf([
	//
	keyword("top"),
	keyword("bottom"),
]);

/**
 * @syntax "center" | edge-keyword-h
 */
const PositionKeywordH = oneOf([
	//
	keyword("center"),
	EdgeKeywordH,
]);

/**
 * @syntax "center" | edge-keyword-v
 */
const PositionKeywordV = oneOf([
	//
	keyword("center"),
	EdgeKeywordV,
]);

/**
 * @syntax edge-keyword-h \<lwsp> \<length>
 */
const EdgeOffsetH = sequence([
	//
	EdgeKeywordH,
	length(),
]);

/**
 * @syntax edge-keyword-v \<lwsp> \<length>
 */
const EdgeOffsetV = sequence([
	//
	EdgeKeywordV,
	length(),
]);

/**
 * @syntax position-keyword-h | \<length>
 */
const OffsetPositionH = oneOf([
	//
	PositionKeywordH,
	length(),
]);

/**
 * @syntax position-keyword-v | \<length>
 */
const OffsetPositionV = oneOf([
	//
	PositionKeywordV,
	length(),
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
 * | left \<length>						| left 0% top \<length>								|
 * | right center							| left 100% top 50%										|
 * | right top								| left 100% top 0%										|
 * | right bottom							| left 100% top 100%									|
 * | right \<length>					| left 100% top \<length>							|
 * | top center								| left 50% top 0%											|
 * | top left									| left 0% top 0%											|
 * | top right								| left 100% top 0%										|
 * | \<length> center					| left \<length> top 50%							|
 * | \<length> top						| left \<length> top 0%								|
 * | \<length> bottom					| left \<length> top 100%							|
 * | \<length-1> \<length-2>	| left \<length-1> top \<length-2>		|
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
 * | bottom left \<length>		|	left \<length> top 100%			|
 * | bottom right \<length>		|	right \<length> top 100%			|
 * | bottom \<length> center	|	left 50% bottom \<length>		|
 * | bottom \<length> left		|	left 0% bottom \<length>		|
 * | bottom \<length> right		|	left 100% bottom \<length>	|
 * | center bottom \<length>	|	left 50% bottom \<length>		|
 * | center left \<length>		|	left \<length> top 50%				|
 * | center right \<length>		|	right \<length> top 50%			|
 * | center top \<length>			|	left 50% top \<length>			|
 * | left bottom \<length>		|	left 0% bottom \<length>		|
 * | left top \<length>				|	left 0% top \<length>				|
 * | left \<length> bottom		|	left \<length> top 100%			|
 * | left \<length> center		|	left \<length> top 50%				|
 * | left \<length> top				|	left \<length> top 0%				|
 * | right bottom \<length>		|	left 100% bottom \<length>	|
 * | right top \<length>			|	left 100% top \<length>			|
 * | right \<length> bottom		|	right \<length> top 100%			|
 * | right \<length> center		|	right \<length> top 50%			|
 * | right \<length> top			|	right \<length> top 0%				|
 * | top left \<length>				|	left \<length> top 0%				|
 * | top right \<length>			|	right \<length> top 0%				|
 * | top \<length> center			|	left 50% top \<length>			|
 * | top \<length> left				|	left 100% top \<length>			| <!--- @TODO is this wrong? Shouldn't it be 0% as per the others? -->
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
export const PositionGrammar = oneOf([
	// Single component values
	// Wrapping in sequences to force them to return arrays
	sequence([OffsetPositionH]),
	sequence([EdgeKeywordV]),

	// Two component values
	sequence([OffsetPositionH, OffsetPositionV]),
	sequence([PositionKeywordV, PositionKeywordH]),

	// Three component values
	sequence([PositionKeywordH, EdgeOffsetV]),

	sequence([PositionKeywordV, EdgeOffsetH]),
	sequence([EdgeOffsetH, PositionKeywordV]),
	sequence([EdgeOffsetV, PositionKeywordH]),

	// Four component values
	sequence([EdgeOffsetH, EdgeOffsetV]),
	sequence([EdgeOffsetV, EdgeOffsetH]),
]);

// ********************* //
// *** NORMALIZATION *** //
// ********************* //

export function normalizePositionValue(
	value: InferDerivableValue<typeof PositionGrammar>,
): ["left", Length, "top", Length] | undefined {
	if (value.length === 1) {
		return normalizeOneComponentValue(value);
	}

	if (isTwoComponentValue(value)) {
		return normalizeTwoComponentValue(value);
	}

	if (isThreeComponentValue(value)) {
		return normalizeThreeComponentValue(value);
	}

	return normalizeFourComponentValue(value);
}

// ***************************************** //
// *** ONE COMPONENT VALUE NORMALIZATION *** //
// ***************************************** //

type OneComponentValue = Extract<InferDerivableValue<typeof PositionGrammar>, [unknown]>;

function normalizeOneComponentValue(
	value: OneComponentValue & {},
): ["left", Length, "top", Length] {
	const extractedValue = value[0];

	if (isLength(extractedValue)) {
		// | `<length>`	|	`<length> center`	| `left \<length> top 50%`
		return ["left", extractedValue, "top", createUnit(50, "%")];
	}

	/**
	 * Converting directly to four-component equivalent
	 */
	switch (extractedValue) {
		case "left":
			// "left center"
			return ["left", createUnit(0, "%"), "top", createUnit(50, "%")];
		case "right":
			// "right center"
			return ["left", createUnit(100, "%"), "top", createUnit(50, "%")];
		case "top":
			// "center top"
			return ["left", createUnit(50, "%"), "top", createUnit(0, "%")];
		case "bottom":
			// "center bottom"
			return ["left", createUnit(50, "%"), "top", createUnit(100, "%")];
		case "center":
			// "center center"
			return ["left", createUnit(50, "%"), "top", createUnit(50, "%")];
	}
}

// ***************************************** //
// *** TWO COMPONENT VALUE NORMALIZATION *** //
// ***************************************** //

type TwoComponentValue = Extract<InferDerivableValue<typeof PositionGrammar>, [unknown, unknown]>;

function isTwoComponentValue(
	value: InferDerivableValue<typeof PositionGrammar>,
): value is TwoComponentValue {
	return value.length === 2;
}

function normalizeTwoComponentValue(
	value: TwoComponentValue & {},
): ["left", Length, "top", Length] | undefined {
	const [first, second] = value;

	/**
	 * @TODO is this covering all the cases? What if we have an invalid combination?
	 */
	const axes = mapTwoComponentValueAxes(first, second);

	if (!axes) {
		return undefined;
	}

	return ["left", axes[0], "top", axes[1]];
}

function mapTwoComponentValueAxes(
	first: TwoComponentValue[0],
	second: TwoComponentValue[1],
): [horizontal: Length, vertical: Length] | undefined {
	const scales = {
		left: 0,
		top: 0,
		center: 50,
		right: 100,
		bottom: 100,
	};

	if (isLength(first)) {
		if (isLength(second)) {
			return [first, second];
		}

		const horizontal = first;

		if (second === "left" || second === "right") {
			return undefined;
		}

		return [horizontal, createUnit(scales[second], "%")];
	}

	if (first === "left" || first === "right") {
		const horizontal = createUnit(scales[first], "%");

		if (isLength(second)) {
			return [horizontal, second];
		}

		if (second === "left" || second === "right") {
			return undefined;
		}

		return [horizontal, createUnit(scales[second], "%")];
	}

	if (first === "top" || first === "bottom") {
		const vertical = createUnit(scales[first], "%");

		if (isLength(second) || second === "top" || second === "bottom") {
			return undefined;
		}

		return [createUnit(scales[second], "%"), vertical];
	}

	if (isLength(second)) {
		return [createUnit(scales[first], "%"), second];
	}

	if (second === "left" || second === "right") {
		return [createUnit(scales[second], "%"), createUnit(scales[first], "%")];
	}

	if (second === "top" || second === "bottom" || second === "center") {
		return [createUnit(scales[first], "%"), createUnit(scales[second], "%")];
	}

	return undefined;
}

// ******************************************* //
// *** THREE COMPONENT VALUE NORMALIZATION *** //
// ******************************************* //

type ThreeComponentValue = Extract<
	InferDerivableValue<typeof PositionGrammar>,
	[unknown, unknown, unknown]
>;

function isThreeComponentValue(
	value: InferDerivableValue<typeof PositionGrammar>,
): value is ThreeComponentValue {
	return value.length === 3;
}

function normalizeThreeComponentValue(
	value: ThreeComponentValue & {},
): ["left", Length, "top", Length] {
	const axes = mapThreeComponentValueAxes(value);

	if (!axes) {
		return undefined;
	}

	return ["left", axes[0], "top", axes[1]];
}

/**
 * When the offset is defined first, it means it is the second component
 * and thus it refers to the edge defined in first position.
 *
 * @param value
 * @returns
 */
function isEdgeFirst(
	value: ThreeComponentValue & {},
): value is Extract<ThreeComponentValue, [unknown, Length, unknown]> {
	return isLength(value[1]);
}

/**
 * When the offset is defined last, it means it is the third component
 * and thus it refers to the edge defined in second position.
 * @param value
 * @returns
 */
function isEdgeLast(
	value: ThreeComponentValue & {},
): value is Extract<ThreeComponentValue, [unknown, unknown, Length]> {
	return isLength(value[2]);
}

function mapThreeComponentValueAxes(
	value: ThreeComponentValue & {},
): [horizontal: Length, vertical: Length] | undefined {
	const scales = {
		left: 0,
		top: 0,
		center: 50,
		right: 100,
		bottom: 100,
	};

	if (isEdgeFirst(value)) {
		const [edge, offset, position] = value;

		// Horizontal edge offset + vertical position keyword
		if (edge === "left" || edge === "right") {
			if (position !== "top" && position !== "bottom" && position !== "center") {
				return undefined;
			}

			/**
			 * Converting these, according to the table, directly to four-component equivalent:
			 *
			 * | `left <length> bottom`		|	`left <length> top 100%`	|	-
			 * | `left <length> center`		|	`left <length> top 50%`		|	-
			 * | `left <length> top`			|	`left <length> top 0%`		|	-
			 * | `right <length> bottom`	|	`right <length> top 100%`	|	`left (100% - <length-h>) top <length-v>`	| `left (100% - <length-h>) top 100%`
			 * | `right <length> center`	|	`right <length> top 50%`	|	`left (100% - <length-h>) top <length-v>`	| `left (100% - <length-h>) top 50%`
			 * | `right <length> top`			|	`right <length> top 0%`		|	`left (100% - <length-h>) top <length-v>`	| `left (100% - <length-h>) top 0%`
			 */
			if (edge === "right") {
				return [subtract(createUnit(100, "%"), offset), createUnit(scales[position], "%")];
			}

			return [offset, createUnit(scales[position], "%")];
		}

		// Vertical edge offset + horizontal position keyword
		if (edge === "top" || edge === "bottom") {
			if (position !== "left" && position !== "right" && position !== "center") {
				return undefined;
			}

			/**
			 * | `bottom <length> center`	|	`left 50% bottom <length>`	|	`left <length-h> top (100% - <length-v>)` | `left 50% top (100% - <length-v>)`
			 * | `bottom <length> left`		|	`left 0% bottom <length>`		|	`left <length-h> top (100% - <length-v>)` | `left 0% top (100% - <length-v>)`
			 * | `bottom <length> right`	|	`left 100% bottom <length>`	|	`left <length-h> top (100% - <length-v>)` | `left 100% top (100% - <length-v>)`
			 * | `top <length> center`		|	`left 50% top <length>`			|	-
			 * | `top <length> left`			|	`left 100% top <length>`		|	-
			 * | `top <length> right`			|	`left 100% top <length>`		|	-
			 */

			if (edge === "bottom") {
				return [createUnit(scales[position], "%"), subtract(createUnit(100, "%"), offset)];
			}

			/**
			 * @TODO Conversion table seems to indicate that for the top <length> left, here, it should be 100%
			 * but that contradicts all the other similar cases. Shouldn't it be 0% as per the others?
			 *
			 * Right now we are keeping 0 for consistency with the other similar cases.
			 */
			return [createUnit(scales[position], "%"), offset];
		}

		return undefined;
	}

	if (isEdgeLast(value)) {
		const [position, edge, offset] = value;

		// Horizontal position keyword + vertical edge offset
		if (position === "left" || position === "right") {
			if (edge !== "top" && edge !== "bottom") {
				return undefined;
			}

			if (edge === "bottom") {
				/**
				 * | `left bottom <length>`		|	`left 0% bottom <length>`		|	`left <length-h> top (100% - <length-v>)` | `left 0% top (100% - <length-v>)`
				 * | `right bottom <length>`	|	`left 100% bottom <length>`	|	`left <length-h> top (100% - <length-v>)` | `left 100% top (100% - <length-v>)`
				 */
				return [createUnit(scales[position], "%"), subtract(createUnit(100, "%"), offset)];
			}

			/**
			 * | `left top <length>`			|	`left 0% top <length>`			|	-
			 * | `right top <length>`			|	`left 100% top <length>`		|	-
			 */
			return [createUnit(scales[position], "%"), offset];
		}

		// Vertical position keyword + horizontal edge offset
		if (position === "top" || position === "bottom") {
			if (edge !== "left" && edge !== "right") {
				return undefined;
			}

			if (edge === "right") {
				/**
				 * | `bottom right \<length>`	|	`right \<length> top 100`	|	`left (100% - \<length-h>) top \<length-v>`	|	`left (100% - \<length-h>) top 100`
				 * | `top right \<length>`		|	`right \<length> top 0`		|	`left (100% - \<length-h>) top \<length-v>`	|	`left (100% - \<length-h>) top 0`
				 */
				return [subtract(createUnit(100, "%"), offset), createUnit(scales[position], "%")];
			}

			/**
			 * | `bottom left \<length>`	|	`left \<length> top 100`	|	-
			 * | `top left \<length>`			|	`left \<length> top 0`		|	-
			 */
			return [offset, createUnit(scales[position], "%")];
		}

		// | `center right \<length>`	|	`right \<length> top 50`	|	`left (100% - \<length-h>) top \<length-v>`	|	`left (100% - \<length-h>) top 50%`
		if (edge === "right") {
			return [subtract(createUnit(100, "%"), offset), createUnit(scales[position], "%")];
		}

		// | `center bottom \<length>`	|	`left 50% bottom \<length>`	|	`left \<length-h> top (100% - \<length-v>)` | `left 50% top (100% - \<length-v>)`
		if (edge === "bottom") {
			return [createUnit(scales[position], "%"), subtract(createUnit(100, "%"), offset)];
		}

		// | `center top \<length>`		|	`left 50% top \<length>`
		if (edge === "top") {
			return [createUnit(scales[position], "%"), offset];
		}

		// | `center left \<length>`	|	`left \<length> top 50%`
		return [offset, createUnit(scales[position], "%")];
	}

	return undefined;
}

// ****************************************** //
// *** FOUR COMPONENT VALUE NORMALIZATION *** //
// ****************************************** //

type FourComponentValue = Extract<
	InferDerivableValue<typeof PositionGrammar>,
	[unknown, unknown, unknown, unknown]
>;

function normalizeFourComponentValue(
	value: FourComponentValue & {},
): ["left", Length, "top", Length] | undefined {
	const [firstEdge, firstOffset, secondEdge, secondOffset] = value;

	// Vertical edge offset + Horizontal edge offset
	if (firstEdge === "top") {
		if (secondEdge === "left") {
			// | `top \<length-v> left \<length-h>`	|	`left \<length-h> top \<length-v>`
			return ["left", secondOffset, "top", firstOffset];
		}

		if (secondEdge === "right") {
			// | `top \<length-v> right \<length-h>`	|	`left (100% - \<length-h>) top \<length-v>`
			return ["left", subtract(createUnit(100, "%"), secondOffset), "top", firstOffset];
		}

		return undefined;
	}

	if (firstEdge === "bottom") {
		if (secondEdge === "left") {
			// | `bottom <length-v> left <length-h>`	|	`left <length-h> top (100% - <length-v>)`
			return ["left", secondOffset, "top", subtract(createUnit(100, "%"), firstOffset)];
		}

		if (secondEdge === "right") {
			// | `bottom <length-v> right <length-h>`	|	`left (100% - <length-h>) top (100% - <length-v>)`
			return [
				"left",
				subtract(createUnit(100, "%"), secondOffset),
				"top",
				subtract(createUnit(100, "%"), firstOffset),
			];
		}

		return undefined;
	}

	// Horizontal edge offset + vertical edge offset
	if (firstEdge === "left") {
		if (secondEdge === "bottom") {
			// | `left <length-h> bottom <length-v>`	|	`left <length-h> top (100% - <length-v>)`
			return ["left", firstOffset, "top", subtract(createUnit(100, "%"), secondOffset)];
		}

		if (secondEdge === "top") {
			// | `left <length-h> top <length-v>`	|	`left <length-h> top <length-v>` (implicit conversion in the table)
			return ["left", firstOffset, "top", secondOffset];
		}

		return undefined;
	}

	if (secondEdge === "bottom") {
		// | `right <length-h> bottom <length-v>`	|	`left (100% - <length-h>) top (100% - <length-v>)`
		return [
			"left",
			subtract(createUnit(100, "%"), firstOffset),
			"top",
			subtract(createUnit(100, "%"), secondOffset),
		];
	}

	if (secondEdge === "top") {
		// | `right <length-h> top <length-v>`	|	`left (100% - <length-h>) top <length-v>`
		return ["left", subtract(createUnit(100, "%"), firstOffset), "top", secondOffset];
	}

	return undefined;
}
