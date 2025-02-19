import { createNode, withSelfReference } from "./NodeRepresentation.js";
import * as Kleene from "./kleene.js";

/**
 * This is a tree representing how elements are allowed to be disposed in a
 * parent-child relationship, according to each element, starting from the
 * tt element. A 'null' element is the first one as we might not find
 * a tt.
 */

const TIMING_ATTRIBUTES = ["begin", "dur", "end", "timeContainer"] as const;
const ANIMATION_ATTRIBUTES = ["animate"] as const;
const LAYOUT_ATTRIBUTES = ["tts:*", "region", "style"] as const;

/**
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
const CATALOG_CONTENT_ELEMENTS_ATTRIBUTES = ["tts:*", "xml:id"]
	.concat(TIMING_ATTRIBUTES)
	.concat(ANIMATION_ATTRIBUTES)
	.concat(LAYOUT_ATTRIBUTES);

export const RepresentationTree = createNode(null, [], () => [
	createNode("tt", ["tt:*", "tts:extent"], () => [
		Kleene.zeroOrOne(
			createNode("head", [], () => [
				Kleene.zeroOrOne(
					createNode("styling", [], () => [
						Kleene.zeroOrMore(
							//
							createNode("initial", ["tts:*"]),
						),
						Kleene.zeroOrMore(Style()),
					]),
				),
				Kleene.zeroOrOne(
					createNode("layout", [], () => [
						//
						Kleene.zeroOrMore(LayoutClass()),
					]),
				),
				Kleene.zeroOrOne(
					createNode("animation", [], () => [
						//
						Kleene.zeroOrMore(AnimationClass()),
					]),
				),
			]),
		),
		Kleene.zeroOrOne(
			createNode("body", CATALOG_CONTENT_ELEMENTS_ATTRIBUTES, () => [
				Kleene.zeroOrMore(AnimationClass()),
				Kleene.zeroOrMore(
					withSelfReference(
						createNode("div", CATALOG_CONTENT_ELEMENTS_ATTRIBUTES, () => [
							Kleene.zeroOrMore(AnimationClass()),
							Kleene.zeroOrOne(LayoutClass()),
							Kleene.zeroOrMore(
								createNode("p", CATALOG_CONTENT_ELEMENTS_ATTRIBUTES, () => [
									Kleene.zeroOrMore(AnimationClass()),
									Kleene.zeroOrOne(LayoutClass()),
									Kleene.zeroOrMore(InlineClass()),
								]),
							),
						]),
					),
				),
			]),
		),
	]),
]);

/**
 * Layout.class
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
function LayoutClass() {
	const REGION_ATTRIBUTES = ["xml:id"]
		/**
		 * Should omit "region" attribute from here
		 * however, we won't use it.
		 */
		.concat(LAYOUT_ATTRIBUTES)
		.concat(TIMING_ATTRIBUTES);

	return createNode("region", REGION_ATTRIBUTES, () => [
		Kleene.zeroOrMore(AnimationClass()),
		Kleene.zeroOrMore(Style()),
	]);
}

/**
 * Animation.class
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
function AnimationClass() {
	const ANIMATE_ATTRIBUTES = ["tts:*", "calcMode", "fill", "keySplines", "keyTimes", "repeatCount"]
		/**
		 * Should omit "timeContainer" from here
		 * however, we won't use it.
		 */
		.concat(TIMING_ATTRIBUTES);

	const SET_ATTRIBUTES = ["tts:*", "fill", "repeatCount"].concat(TIMING_ATTRIBUTES);

	return Kleene.or(
		//
		createNode("animate", ANIMATE_ATTRIBUTES),
		createNode("set", SET_ATTRIBUTES),
	);
}

/**
 * Inline.class
 * @see https://w3c.github.io/ttml2/#element-vocab-group-inline
 */
function InlineClass() {
	const SPAN_ATTRIBUTES: string[] = []
		.concat(TIMING_ATTRIBUTES)
		.concat(ANIMATION_ATTRIBUTES)
		.concat(LAYOUT_ATTRIBUTES);

	return Kleene.or(
		withSelfReference(
			createNode("span", SPAN_ATTRIBUTES, () => [
				//
				Kleene.zeroOrMore(AnimationClass()),
			]),
		),
		withSelfReference(
			//
			createNode("br"),
		),
	);
}

function Style() {
	return createNode("style", ["tts:*", "style", "xml:id"]);
}
