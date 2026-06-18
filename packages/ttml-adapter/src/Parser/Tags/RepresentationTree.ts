import { createNode, NodeRepresentation } from "./NodeRepresentation.js";
import { oneOf, sequence, zeroOrMore, zeroOrOne } from "../structure/grammar.js";

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

export const RepresentationTree = zeroOrOne(
	createNode("tt", new Set(["ttp:*", "tts:extent", "xml:lang"]), () =>
		sequence([
			//
			zeroOrOne(headNode),
			zeroOrOne(bodyNode),
		]),
	),
);

const headNode = createNode("head", new Set([]), () =>
	sequence([
		zeroOrOne(
			createNode("styling", new Set([]), () =>
				sequence([
					zeroOrMore(createNode("initial", new Set([LAYOUT_ATTRIBUTES["tts:*"]]))),
					zeroOrMore(Style()),
				]),
			),
		),
		zeroOrOne(createNode("layout", new Set([]), () => zeroOrMore(LayoutClass()))),
		zeroOrOne(createNode("animation", new Set([]), () => zeroOrMore(AnimationClass()))),
	]),
);

const bodyNode = createNode("body", CONTENT_MODULE_ELEMENTS_ATTRIBUTES, () =>
	sequence([
		//
		zeroOrMore(AnimationClass()),
		zeroOrMore(divNode),
	]),
);

/*
 * div is self-referencing: it can contain other divs.
 * Type here is required for typescript to not invalidate
 * its type when recursively referencing itself.
 */
const divNode: NodeRepresentation<"div"> = createNode(
	"div",
	CONTENT_MODULE_ELEMENTS_ATTRIBUTES,
	() =>
		sequence([
			zeroOrMore(AnimationClass()),
			zeroOrOne(LayoutClass()),
			zeroOrMore(divNode),
			zeroOrMore(
				createNode("p", CONTENT_MODULE_ELEMENTS_ATTRIBUTES, () =>
					sequence([
						zeroOrMore(AnimationClass()),
						zeroOrOne(LayoutClass()),
						zeroOrMore(InlineClass()),
					]),
				),
			),
		]),
);

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
		ANIMATION_ATTRIBUTES.animate,
	] as const);

	return createNode("region", REGION_ATTRIBUTES, () =>
		sequence([
			//
			zeroOrMore(AnimationClass()),
			zeroOrMore(Style()),
		]),
	);
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

	return oneOf([
		//
		createNode("animate", ANIMATE_ATTRIBUTES),
		createNode("set", SET_ATTRIBUTES),
	]);
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

	const spanNode: NodeRepresentation<"span"> = createNode("span", SPAN_ATTRIBUTES, () =>
		sequence([
			//
			zeroOrMore(AnimationClass()),
			zeroOrMore(InlineClass()),
		]),
	);

	return oneOf([
		//
		spanNode,
		createNode("br"),
	]);
}

function Style() {
	const STYLE_ATTRIBUTES = new Set([
		LAYOUT_ATTRIBUTES["tts:*"],
		LAYOUT_ATTRIBUTES.style,
		"xml:id",
	] as const);

	return createNode("style", STYLE_ATTRIBUTES);
}
