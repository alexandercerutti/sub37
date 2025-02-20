import { createNode, withSelfReference } from "./NodeRepresentation.js";
import * as Kleene from "./kleene.js";

/**
 * This is a tree representing how elements are allowed to be disposed in a
 * parent-child relationship, according to each element, starting from the
 * tt element. A 'null' element is the first one as we might not find
 * a tt.
 */

const TIMING_ATTRIBUTES = {
	begin: "begin",
	dur: "dur",
	end: "end",
	timeContainer: "timeContainer",
} as const;

const ANIMATION_ATTRIBUTES = {
	animate: "animate",
	repeatCount: "repeatCount",
	fill: "fill",
} as const;

const LAYOUT_ATTRIBUTES = {
	"tts:*": "tts:*",
	region: "region",
	style: "style",
} as const;

/**
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
const CONTENT_MODULE_ELEMENTS_ATTRIBUTES = new Set([
	"tts:*",
	"xml:id",
	TIMING_ATTRIBUTES.begin,
	TIMING_ATTRIBUTES.dur,
	TIMING_ATTRIBUTES.end,
	TIMING_ATTRIBUTES.timeContainer,
	ANIMATION_ATTRIBUTES.animate,
	LAYOUT_ATTRIBUTES["tts:*"],
	LAYOUT_ATTRIBUTES.region,
	LAYOUT_ATTRIBUTES.style,
] as const);

export const RepresentationTree = createNode(null, new Set([]), () => [
	createNode("tt", new Set(["tt:*", "tts:extent"]), () => [
		Kleene.zeroOrOne(
			createNode("head", new Set([]), () => [
				Kleene.zeroOrOne(
					createNode("styling", new Set([]), () => [
						Kleene.zeroOrMore(
							//
							createNode("initial", new Set([LAYOUT_ATTRIBUTES["tts:*"]])),
						),
						Kleene.zeroOrMore(Style()),
					]),
				),
				Kleene.zeroOrOne(
					createNode("layout", new Set([]), () => [
						//
						Kleene.zeroOrMore(LayoutClass()),
					]),
				),
				Kleene.zeroOrOne(
					createNode("animation", new Set([]), () => [
						//
						Kleene.zeroOrMore(AnimationClass()),
					]),
				),
			]),
		),
		Kleene.zeroOrOne(
			createNode("body", CONTENT_MODULE_ELEMENTS_ATTRIBUTES, () => [
				Kleene.zeroOrMore(AnimationClass()),
				Kleene.zeroOrMore(
					withSelfReference(
						createNode("div", CONTENT_MODULE_ELEMENTS_ATTRIBUTES, () => [
							Kleene.zeroOrMore(AnimationClass()),
							Kleene.zeroOrOne(LayoutClass()),
							Kleene.zeroOrMore(
								createNode("p", CONTENT_MODULE_ELEMENTS_ATTRIBUTES, () => [
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
	const REGION_ATTRIBUTES = new Set([
		"xml:id",
		LAYOUT_ATTRIBUTES["tts:*"],
		LAYOUT_ATTRIBUTES.style,
		TIMING_ATTRIBUTES.begin,
		TIMING_ATTRIBUTES.dur,
		TIMING_ATTRIBUTES.end,
		TIMING_ATTRIBUTES.timeContainer,
	] as const);

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
	const ANIMATE_ATTRIBUTES = new Set([
		LAYOUT_ATTRIBUTES["tts:*"],
		TIMING_ATTRIBUTES.begin,
		TIMING_ATTRIBUTES.dur,
		TIMING_ATTRIBUTES.end,
		ANIMATION_ATTRIBUTES.repeatCount,
		ANIMATION_ATTRIBUTES.fill,
		"calcMode",
		"keySplines",
		"keyTimes",
	] as const);

	const SET_ATTRIBUTES = new Set([
		LAYOUT_ATTRIBUTES["tts:*"],
		TIMING_ATTRIBUTES.begin,
		TIMING_ATTRIBUTES.dur,
		TIMING_ATTRIBUTES.end,
		ANIMATION_ATTRIBUTES.repeatCount,
		ANIMATION_ATTRIBUTES.fill,
	] as const);

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
	const SPAN_ATTRIBUTES = new Set([
		LAYOUT_ATTRIBUTES["tts:*"],
		LAYOUT_ATTRIBUTES.region,
		LAYOUT_ATTRIBUTES.style,
		ANIMATION_ATTRIBUTES.animate,
		TIMING_ATTRIBUTES.begin,
		TIMING_ATTRIBUTES.dur,
		TIMING_ATTRIBUTES.end,
		TIMING_ATTRIBUTES.timeContainer,
	] as const);

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
	const STYLE_ATTRIBUTES = new Set([
		LAYOUT_ATTRIBUTES["tts:*"],
		LAYOUT_ATTRIBUTES.style,
		"xml:id",
	] as const);

	return createNode("style", STYLE_ATTRIBUTES);
}
