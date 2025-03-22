import { readScopeDocumentContext } from "./Scope/DocumentContext.js";
import type { Scope } from "./Scope/Scope.js";
import { getCellScalarPixelConversion, isCellScalar } from "./Units/cell.js";
import { toClamped } from "./Units/clamp.js";
import { isValidColor } from "./Units/color.js";
import type { Length } from "./Units/length.js";
import { isPercentage, toLength } from "./Units/length.js";
import { getSplittedLinearWhitespaceValues } from "./Units/lwsp.js";
import { createUnit } from "./Units/unit.js";
import { memoizationFactory } from "./memoizationFactory.js";

type StyleAttributeString = `tts:${string}`;

export interface TTMLStyle {
	id: string;

	/**
	 * Retrieves actualy styles for an element
	 *
	 * @param element
	 */
	apply(element: string): SupportedCSSProperties;
}

export const createStyleParser = memoizationFactory(function styleParserExecutor(
	/**
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-attribute-style
	 * @see https://www.w3.org/TR/xmlschema-2/#IDREFS
	 */
	stylesIDREFSStorage: Map<string, TTMLStyle>,
	scope: Scope,
	attributes: Record<string, string>,
): TTMLStyle {
	const style = {
		id: attributes["xml:id"],
		styleAttributes: extractStyleAttributes(attributes),
		apply(element: string): SupportedCSSProperties {
			return convertAttributesToCSS(this.styleAttributes, scope, element);
		},
	};

	/** @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential */
	stylesIDREFSStorage.set(style.id, style);

	return style;
});

function extractStyleAttributes(
	attributes: Record<string, string>,
): Record<StyleAttributeString, string> {
	const attrs: Record<StyleAttributeString, string> = {};

	for (const attr in attributes) {
		if (!isStyleAttribute(attr)) {
			continue;
		}

		attrs[attr] = attributes[attr];
	}

	return attrs;
}

export function isStyleAttribute(attribute: string): attribute is StyleAttributeString {
	return attribute.startsWith("tts:");
}

/**
 * @see https://www.w3.org/TR/ttml2/#style-attribute-derivation
 */

type PropertiesCollection<Props extends string[]> = {
	readonly [K in keyof Props]: [Props[K], string];
};

type PropertiesMapper<OutProperties extends string[]> = (
	scope: Scope,
	value: unknown,
) => PropertiesCollection<OutProperties>;

const AttributeFlags = {
	INHERITABLE: /***/ 0b0001,
} as const;

const AnimationFlags = {
	DISCRETE: /******/ 0b0100,
	CONTINUOUS: /****/ 0b0110,
} as const;

interface AttributeDefinition<DestinationProperties extends string[] = string[]> {
	readonly name: string;
	readonly appliesTo: string[];
	readonly default: unknown;
	readonly allowedValues: Set<unknown>;
	readonly namespace: string | undefined;
	readonly toCSS: PropertiesMapper<DestinationProperties>;

	flags: number;
}

function inheritable<Attr extends AttributeDefinition>(def: Attr): Readonly<Attr> {
	def.flags ^= AttributeFlags.INHERITABLE;
	return def;
}

function animatable<Attr extends AttributeDefinition>(attrs: number, def: Attr): Readonly<Attr> {
	def.flags ^= attrs;
	return def;
}

function resolveStyleDefinitionByName(propName: string): AttributeDefinition {
	if (!isMappedKey(propName)) {
		throw new Error(
			"Provided name is not a valid (mapped) style property. Cannot retrieve animation details.",
		);
	}

	return TTML_CSS_ATTRIBUTES_MAP[propName];
}

export function isPropertyContinuouslyAnimatable(name: string): boolean {
	const attribute = resolveStyleDefinitionByName(name);
	return Boolean(attribute.flags & AnimationFlags.CONTINUOUS);
}

export function isPropertyDiscretelyAnimatable(name: string): boolean {
	const attribute = resolveStyleDefinitionByName(name);
	return Boolean(attribute.flags & AnimationFlags.DISCRETE);
}

function createAttributeDefinition<
	DestinationProperties extends string[],
	const AllowedValues extends string,
>(
	attributeName: string,
	appliesTo: string[],
	defaultValue: NoInfer<AllowedValues>,
	allowedValues: Set<AllowedValues> | undefined,
	mapper: PropertiesMapper<DestinationProperties>,
): AttributeDefinition<DestinationProperties> {
	return Object.create(null, {
		name: {
			value: attributeName,
		},
		appliesTo: {
			value: appliesTo,
		},
		default: {
			value: defaultValue,
		},
		allowedValues: {
			value: allowedValues,
		},
		toCSS: {
			value: (scope: Scope, value: unknown): PropertiesCollection<DestinationProperties> => {
				if (allowedValues && !allowedValues.has(value as AllowedValues)) {
					return nullMapper(scope, value) as PropertiesCollection<DestinationProperties>;
				}

				return mapper(scope, value);
			},
		},
		namespace: {
			get(): string {
				const nameSlice = attributeName.split(":");
				return nameSlice.length >= 2 ? nameSlice[0] : undefined;
			},
		},
		flags: {
			value: 0,
			writable: true,
		},
	} satisfies PropertyDescriptorMap);
}

function defaultValueMapper(_scope: Scope, value: string): string {
	return value;
}

function nullMapper(_scope: Scope, _value: unknown): PropertiesCollection<never[]> {
	return [];
}

function createPassThroughMapper<
	const Destination extends string,
	const Mapper extends (scope: Scope, ...args: any[]) => string,
>(destinationValue: Destination, valueMapper?: Mapper): PropertiesMapper<[Destination]> {
	return function <const Param extends string>(
		scope: Scope,
		value: Param,
	): PropertiesCollection<[Destination]> {
		return [[destinationValue, (valueMapper || defaultValueMapper)(scope, value)]];
	};
}

const TTML_CSS_ATTRIBUTES_MAP = {
	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundClip
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundClip
	 */
	"tts:backgroundClip": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundClip",
			["body", "div", "image", "p", "region", "span"],
			"border",
			new Set(["border", "content", "padding"]),
			createPassThroughMapper("background-clip"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundColor
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundColor
	 */
	"tts:backgroundColor": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:backgroundColor",
			["body", "div", "image", "p", "region", "span"],
			"transparent",
			undefined,
			createPassThroughMapper("background-color"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundExtent
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundExtent
	 */
	"tts:backgroundExtent": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundExtent",
			["body", "div", "image", "p", "region", "span"],
			"",
			undefined,
			createPassThroughMapper("background-size"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundImage
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundImage
	 */
	"tts:backgroundImage": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundImage",
			["body", "div", "image", "p", "region", "span"],
			"none",
			undefined,
			createPassThroughMapper("background-image"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundOrigin
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundOrigin
	 */
	"tts:backgroundOrigin": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundOrigin",
			["body", "div", "image", "p", "region", "span"],
			"padding",
			new Set(["border", "content", "padding"]),
			createPassThroughMapper("background-origin"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundPosition
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundPosition
	 */
	"tts:backgroundPosition": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundPosition",
			["body", "div", "image", "p", "region", "span"],
			"0% 0%",
			undefined,
			createPassThroughMapper("background-position"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundRepeat
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundRepeat
	 */
	"tts:backgroundRepeat": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:backgroundRepeat",
			["body", "div", "image", "p", "region", "span"],
			"repeat",
			new Set(["repeat", "repeatX", "repeatY", "noRepeat"]),
			createPassThroughMapper("background-repeat", backgroundRepeatValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-border
	 * @see https://w3c.github.io/ttml2/#derivation-border
	 */
	"tts:border": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:border",
			["body", "div", "image", "p", "region", "span"],
			"none",
			undefined,
			borderMapper,
		),
	),

	/**
	 * This property defines the size an element should have
	 * while in the Block Progress Dimension (bpd) which will
	 * be vertical when writing mode is from left to right (or
	 * viceversa) and horizonal when writing mode is from top
	 * to bottom (or viceversa?)
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-bpd
	 * @see https://w3c.github.io/ttml2/#derivation-bpd
	 */
	"tts:bpd": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:bpd",
			["body", "div", "p", "span"],
			"auto",
			undefined,
			nullMapper,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-color
	 * @see https://w3c.github.io/ttml2/#derivation-color
	 */
	"tts:color": inheritable(
		animatable(
			AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
			createAttributeDefinition(
				"tts:color",
				["span", ""],
				"white",
				undefined,
				createPassThroughMapper("color"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-direction
	 * @see https://w3c.github.io/ttml2/#derivation-direction
	 */
	"tts:direction": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:direction",
				["p", "span"],
				"ltr",
				new Set(["ltr", "rtl"]),
				createPassThroughMapper("direction"),
			),
		),
	),
	// ttml-only
	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-disparity
	 * @see https://w3c.github.io/ttml2/#derivation-disparity
	 */
	"tts:disparity": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:disparity",
			["region", "div", "p"],
			"0px",
			undefined,
			nullMapper,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-display
	 * @see https://w3c.github.io/ttml2/#derivation-display
	 */
	"tts:display": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:display",
			["body", "div", "image", "p", "region", "span"],
			"auto",
			new Set(["auto", "none", "inlineBlock"]),
			createPassThroughMapper("display"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
	 * @see https://w3c.github.io/ttml2/#derivation-displayAlign
	 */
	"tts:displayAlign": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:displayAlign",
			["body", "div", "p", "region"],
			"before",
			new Set(["before", "center", "after", "justify"]),
			createPassThroughMapper("justify-content", displayAlignValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-extent
	 * @see https://w3c.github.io/ttml2/#derivation-extent
	 */
	"tts:extent": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition<["width", "height"], string>(
			"tts:extent",
			["tt", "region", "image", "div", "p"],
			"auto",
			undefined,
			extentMapper,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontFamily
	 * @see https://w3c.github.io/ttml2/#derivation-fontFamily
	 */
	"tts:fontFamily": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontFamily",
				["p", "span"],
				"default",
				undefined,
				createPassThroughMapper("font-family"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontKerning
	 * @see https://w3c.github.io/ttml2/#derivation-fontKerning
	 */
	"tts:fontKerning": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontKerning",
				["span"],
				"normal",
				new Set(["none", "normal"]),
				createPassThroughMapper("font-kerning"),
			),
		),
	),

	/**
	 * No CSS equivalent
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontSelectionStrategy
	 * @see https://w3c.github.io/ttml2/#derivation-fontSelectionStrategy
	 */
	"tts:fontSelectionStrategy": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontSelectionStrategy",
				["p", "span"],
				"auto",
				new Set(["auto", "character"]),
				nullMapper,
			),
		),
	),

	/**
	 * Maps to CSS values. Must be handled differently
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontShear
	 * @see https://w3c.github.io/ttml2/#derivation-fontShear
	 */
	"tts:fontShear": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition("tts:fontShear", ["span"], "0%", undefined, nullMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontSize
	 * @see https://w3c.github.io/ttml2/#derivation-fontSize
	 */
	"tts:fontSize": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontSize",
				["p", "span", "region"],
				"1c",
				undefined,
				createPassThroughMapper("font-size", fontSizeValueMapper),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontStyle
	 * @see https://w3c.github.io/ttml2/#derivation-fontStyle
	 */
	"tts:fontStyle": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontStyle",
				["p", "span"],
				"normal",
				new Set(["normal", "italic", "oblique"]),
				createPassThroughMapper("font-style"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontVariant
	 * @see https://w3c.github.io/ttml2/#derivation-fontVariant
	 */
	"tts:fontVariant": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontVariant",
				["p", "span"],
				"normal",
				undefined,
				nullMapper, // Maps to multiple values. Must be handled differently
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontWeight
	 * @see https://w3c.github.io/ttml2/#derivation-fontWeight
	 */
	"tts:fontWeight": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:fontWeight",
				["p", "span"],
				"normal",
				new Set(["normal", "bold"]),
				createPassThroughMapper("font-weight"),
			),
		),
	),

	/**
	 * This property defines the size an element should have
	 * while in the Inline Progress Dimension (ipd) which will
	 * be horizotal when writing mode is from left to right (or
	 * viceversa) and vertical when writing mode is from top
	 * to bottom (or viceversa?)
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-ipd
	 * @see https://w3c.github.io/ttml2/#derivation-ipd
	 */
	"tts:ipd": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:ipd",
			["body", "div", "p", "span"],
			"auto",
			undefined,
			nullMapper, // ??????
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-letterSpacing
	 * @see https://w3c.github.io/ttml2/#derivation-letterSpacing
	 */
	"tts:letterSpacing": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:letterSpacing",
				["p", "span"],
				"normal",
				undefined,
				createPassThroughMapper("letter-spacing"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-lineHeight
	 * @see https://w3c.github.io/ttml2/#derivation-lineHeight
	 */
	"tts:lineHeight": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:lineHeight",
				["p"],
				"normal",
				undefined,
				createPassThroughMapper("line-height"),
			),
		),
	),
	// Maps to CSS values. Must be handled differently
	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-lineShear
	 * @see https://w3c.github.io/ttml2/#derivation-lineShear
	 */
	"tts:lineShear": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition("tts:lineShear", ["p"], "0%", undefined, nullMapper),
		),
	),

	/**
	 * TTML Only
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-luminanceGain
	 * @see https://w3c.github.io/ttml2/#derivation-luminanceGain
	 */
	"tts:luminanceGain": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition("tts:luminanceGain", ["region"], "1.0", undefined, nullMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-opacity
	 * @see https://w3c.github.io/ttml2/#derivation-opacity
	 */
	"tts:opacity": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:opacity",
			["body", "div", "image", "p", "region", "span"],
			"1.0",
			undefined,
			createPassThroughMapper("opacity"),
		),
	),

	/**
	 * This attribute doesn't have a CSS property.
	 * However, it is used to determine the origin of
	 * a region.
	 *
	 * Having it to be a string: string as type is
	 * completely fine
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-origin
	 * @see https://w3c.github.io/ttml2/#derivation-origin
	 */
	"tts:origin": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:origin",
			["region", "div", "p"],
			"auto",
			undefined,
			originMapper,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-overflow
	 * @see https://w3c.github.io/ttml2/#derivation-overflow
	 */
	"tts:overflow": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:overflow",
			["region"],
			"hidden",
			new Set(["visible", "hidden"]),
			createPassThroughMapper("overflow"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-padding
	 * @see https://w3c.github.io/ttml2/#derivation-padding
	 */
	"tts:padding": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:padding",
			["body", "div", "image", "p", "region", "span"],
			"0px",
			undefined,
			createPassThroughMapper("padding", paddingValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-position
	 * @see https://w3c.github.io/ttml2/#derivation-position
	 */
	"tts:position": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:position",
			["region", "div", "p"],
			"top left",
			undefined,
			createPassThroughMapper("background-position"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-ruby
	 * @see https://w3c.github.io/ttml2/#derivation-ruby
	 */
	"tts:ruby": createAttributeDefinition(
		"tts:ruby",
		["span"],
		"none",
		new Set(["none", "container", "base", "baseContainer", "text", "textContainer", "delimiter"]),
		nullMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-rubyAlign
	 * @see https://w3c.github.io/ttml2/#derivation-rubyAlign
	 */
	"tts:rubyAlign": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:rubyAlign",
				["span"],
				"center",
				new Set(["start", "center", "end", "spaceAround", "spaceBetween", "withBase"]),
				createPassThroughMapper("ruby-align"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-rubyPosition
	 * @see https://w3c.github.io/ttml2/#derivation-rubyPosition
	 */
	"tts:rubyPosition": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:rubyPosition",
				["span"],
				"outside",
				new Set(["before", "after", "outside"]),
				createPassThroughMapper("ruby-position"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-rubyReserve
	 * @see https://w3c.github.io/ttml2/#derivation-rubyReserve
	 */
	"tts:rubyReserve": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition("tts:rubyReserve", ["p"], "none", undefined, nullMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-shear
	 * @see https://w3c.github.io/ttml2/#derivation-shear
	 */
	"tts:shear": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition("tts:shear", ["p"], "0%", undefined, nullMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-showBackground
	 * @see https://w3c.github.io/ttml2/#derivation-showBackground
	 */
	"tts:showBackground": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:showBackground",
			["region"],
			"always",
			new Set(["always", "whenActive"]),
			nullMapper,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textAlign
	 * @see https://w3c.github.io/ttml2/#derivation-textAlign
	 */
	"tts:textAlign": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:textAlign",
			["p"],
			"start",
			new Set(["left", "center", "right", "start", "end", "justify"]),
			createPassThroughMapper("text-align"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textCombine
	 * @see https://w3c.github.io/ttml2/#derivation-textCombine
	 */
	"tts:textCombine": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:textCombine",
				["span"],
				"none",
				undefined,
				createPassThroughMapper("text-combine-upright"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textDecoration
	 * @see https://w3c.github.io/ttml2/#derivation-textDecoration
	 */
	"tts:textDecoration": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:textDecoration",
				["span"],
				"none",
				undefined,
				createPassThroughMapper("text-decoration", textDecorationValueMapper),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textEmphasis
	 * @see https://w3c.github.io/ttml2/#derivation-textEmphasis
	 */
	"tts:textEmphasis": inheritable(
		animatable(
			AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
			createAttributeDefinition(
				"tts:textEmphasis",
				["span"],
				"none",
				undefined,
				createPassThroughMapper("text-emphasis"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textOrientation
	 * @see https://w3c.github.io/ttml2/#derivation-textOrientation
	 */
	"tts:textOrientation": inheritable(
		createAttributeDefinition(
			"tts:textOrientation",
			["span"],
			"mixed",
			new Set(["mixed", "sideways", "upright"]),
			createPassThroughMapper("text-orientation", textOrientationValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textOutline
	 * @see https://w3c.github.io/ttml2/#derivation-textOutline
	 */
	"tts:textOutline": inheritable(
		animatable(
			AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
			createAttributeDefinition(
				//
				"tts:textOutline",
				["span"],
				"none",
				undefined,
				textOutlineMapper,
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textShadow
	 * @see https://w3c.github.io/ttml2/#derivation-textShadow
	 */
	"tts:textShadow": inheritable(
		animatable(
			AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
			createAttributeDefinition(
				"tts:textShadow",
				["span"],
				"none",
				undefined,
				createPassThroughMapper("text-shadow"),
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-unicodeBidi
	 * @see https://w3c.github.io/ttml2/#derivation-unicodeBidi
	 */
	"tts:unicodeBidi": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:unicodeBidi",
			["p", "span"],
			"normal",
			new Set(["normal", "embed", "bidiOverride", "isolate"]),
			createPassThroughMapper("unicode-bidi"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-visibility
	 * @see https://w3c.github.io/ttml2/#derivation-visibility
	 */
	"tts:visibility": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:visibility",
				["body", "div", "image", "p", "region", "span"],
				"visible",
				new Set(["visible", "hidden"]),
				createPassThroughMapper("visibility"),
			),
		),
	),

	/**
	 * XLFO, not a direct mapping with CSS. Can use remap it somehow
	 * without impacting renderer?
	 *
	 * @TODO
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-wrapOption
	 * @see https://w3c.github.io/ttml2/#derivation-wrapOption
	 */
	"tts:wrapOption": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				"tts:wrapOption",
				["span"],
				"wrap",
				new Set(["wrap", "noWrap"]),
				nullMapper,
			),
		),
	),

	/**
	 * Writing mode impacts rendering, so we must first verify nothing
	 * will break on that front.
	 *
	 * @TODO
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-writingMode
	 * @see https://w3c.github.io/ttml2/#derivation-writingMode
	 */
	"tts:writingMode": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:writingMode",
			["region"],
			"lrtb",
			new Set(["lrtb", "rltb", "tbrl", "tblr", "lr", "rl", "tb"]),
			nullMapper,
		),
	),

	/**
	 * Z-index impacts on rendering (it is a valid CSS), but it won't be
	 * used until we won't paint on a new layer or an absolute element.
	 * @TODO
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-zIndex
	 * @see https://w3c.github.io/ttml2/#derivation-zIndex
	 */
	"tts:zIndex": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition("tts:zIndex", ["region"], "auto", undefined, nullMapper),
	),
} as const;

type TTML_CSS_ATTRIBUTES_MAP = typeof TTML_CSS_ATTRIBUTES_MAP;

type GetCollectionKeys<Collection extends PropertiesCollection<string[]>> = Collection[number][0];

type SupportedCSSProperties = {
	-readonly [K in keyof TTML_CSS_ATTRIBUTES_MAP as GetCollectionKeys<
		ReturnType<TTML_CSS_ATTRIBUTES_MAP[K]["toCSS"]>
	>]?: string;
};

function isMappedKey(key: string): key is keyof TTML_CSS_ATTRIBUTES_MAP {
	return TTML_CSS_ATTRIBUTES_MAP.hasOwnProperty(key);
}

function styleAppliesToElement(
	style: AttributeDefinition,
	scope: Scope,
	element?: string | undefined,
): boolean {
	if (!style.appliesTo.length) {
		return true;
	}

	if (!element) {
		return false;
	}

	return style.appliesTo.includes(element) || styleAppliesByInheritance(style, scope);
}

function styleAppliesByInheritance(styleDef: AttributeDefinition, scope: Scope): boolean {
	if (!(styleDef.flags & AttributeFlags.INHERITABLE)) {
		return false;
	}

	/**
	 * "For the purpose of determining inherited styles, the element
	 * hierarchy of an intermediate synchronic document form of a
	 * document instance must" be used, where such intermediate forms
	 * are defined by 11.3.1.3 Intermediate Synchronic Document Construction."
	 */

	const hierarchy = getElementsHierarchyFromScope(scope);

	for (let i = 0; i < hierarchy.length; i++) {
		if (!styleDef.appliesTo.includes(hierarchy[i])) {
			continue;
		}

		return true;
	}

	return false;
}

function getElementsHierarchyFromScope(scope: Scope): string[] {
	const documentContext = readScopeDocumentContext(scope);
	const hierarchy: string[] = [];

	let currentNode = documentContext.currentNode;

	while (currentNode !== null) {
		hierarchy.push(currentNode.content.content);
		currentNode = currentNode.parent;
	}

	return hierarchy;
}

function convertAttributesToCSS(
	attributes: Record<string, string>,
	scope: Scope,
	sourceElementName: string,
): SupportedCSSProperties {
	const convertedAttributes: SupportedCSSProperties = {};

	/**
	 * Not using Object.entries or "for..of" because they are not
	 * able to detect enumerable keys in prototype chain, and we
	 * are using them
	 */
	for (const attributeKey in attributes) {
		if (!isMappedKey(attributeKey)) {
			continue;
		}

		const value = attributes[attributeKey];
		const definition = TTML_CSS_ATTRIBUTES_MAP[attributeKey];

		if (!definition || !styleAppliesToElement(definition, scope, sourceElementName)) {
			continue;
		}

		const mapped = definition.toCSS(scope, value);

		for (const [mappedKey, mappedValue] of mapped) {
			convertedAttributes[mappedKey] = mappedValue;
		}
	}

	return convertedAttributes;
}

// ******************* //
// *** CSS MAPPERS *** //
// ******************* //

// region tts:backgroundRepeat

function backgroundRepeatValueMapper(
	_scope: Scope,
	value: "repeatX" | "repeatY" | "noRepeat" | "inherit",
): "repeat-x" | "repeat-y" | "no-repeat" | "inherit" {
	switch (value) {
		case "repeatX": {
			return "repeat-x";
		}

		case "repeatY": {
			return "repeat-y";
		}

		case "noRepeat": {
			return "no-repeat";
		}

		case "inherit": {
			return "inherit";
		}

		default: {
			return value;
		}
	}
}

// region tts:displayAlign

function displayAlignValueMapper(
	_scope: Scope,
	value: "before" | "center" | "after" | "justify",
): "flex-start" | "center" | "flex-end" | "space-between" | undefined {
	switch (value) {
		case "before": {
			return "flex-start";
		}

		case "center": {
			return "center";
		}

		case "after": {
			return "flex-end";
		}

		case "justify": {
			return "space-between";
		}

		default: {
			return undefined;
		}
	}
}

// region tts:padding

function paddingValueMapper(_scope: Scope, value: string): string | undefined {
	if (!value.length) {
		return undefined;
	}

	switch (value) {
		case "before": {
			return "block-start";
		}

		case "end": {
			return "inline-end";
		}

		case "after": {
			return "block-end";
		}

		case "start": {
			return "inline-start";
		}
	}

	return value;
}

// region tts:textDecoration

/**
 * @TODO TTML allows several values that CSS do not expect,
 * like `"noUnderline"`, `"noLineThrough"`, `"noOverline"`.
 *
 * However, resetting text-decoration is a difficult matter, as
 * it requires creating a span and setting it to have
 * `display: inline-block`.
 *
 * This is important as introducing such style, might compromise
 * the whole rendering in the captions-renderer.
 *
 * Further tests should be performed.
 *
 * Just for reference for when this will be implemented, to perform
 * a reset of text-decoration and apply a different effect, two nested
 * spans should be produced:
 *
 * @example
 * ```html
 * <div style="text-decoration: underline">
 * 	<p>
 * 		Lorem ipsum dolor sit amet, consectetur
 * 		<span style="text-decoration: none; display: inline-block">
 * 			<span style="text-decoration: line-through"> adipiscing elit </span>
 * 		</span>
 * 	</p>
 * 	. Curabitur tempor vitae augue lobortis rutrum. Nam nisi enim, lobortis
 * </div>
 * ```
 *
 * Producing two spans would mean, probably, to emit a "style reset entity"
 * or something like that.
 *
 * As this is right now too complex to achieve, I rathered to disable
 * the `text-decoration` property at all. Sorry folks.
 *
 * @see https://www.w3.org/TR/ttml2/#style-attribute-textDecoration
 */

function textDecorationValueMapper(_scope: Scope, _value: string): string | undefined {
	// See note above
	return undefined;
}

// region tts:textOrientation

function isTextOrientationSupportedCSSValue(
	value: string,
): value is "sideways" | "mixed" | "upright" {
	return ["sideways", "mixed", "upright"].includes(value);
}

function textOrientationValueMapper(
	_scope: Scope,
	value: string,
): "sideways" | "mixed" | "upright" | undefined {
	if (isTextOrientationSupportedCSSValue(value)) {
		return value;
	}

	switch (value) {
		case "sideways-left":
		// Kept only for compatibility. Remapping.
		case "sideways-right": {
			return "sideways";
		}

		case "use-glyph-orientation": {
			// Invalid, as it is used only for SVG
			return undefined;
		}
	}

	return undefined;
}

// region tts:fontSize

/**
 * TTML supports providing two <length> for `tts:fontSize`.
 * However, CSS supports only one dimension, the vertical one.
 *
 * To achieve the horizontal one, we are required to use
 * `transform: scale(x, y)`, with the appropriate scaling factors,
 * and create an element that should be putted to `display: inline-block`.
 *
 * Therefore, we should calculate the factor (how?) and change introduce
 * some style resetter or isolation in the renderer in order to achieve
 * such style.
 *
 * This element should probably wrap the whole subtitles elements.
 *
 * Not exactly the moment. Sorry folks.
 *
 * @param scope
 * @param value
 * @returns
 */

function fontSizeValueMapper(scope: Scope, value: string): string {
	const splittedValue = getSplittedLinearWhitespaceValues(value);
	const {
		attributes: {
			"ttp:cellResolution": [, cellResolutionHeight],
			"tts:extent": [exHeight],
		},
	} = readScopeDocumentContext(scope);

	if (!splittedValue.length) {
		return fontSizeValueDefaultLength(exHeight, cellResolutionHeight).toString();
	}

	if (splittedValue.length >= 2) {
		const horizonalGlyphSizeParsed = toLength(splittedValue[0]);
		const verticalGlyphSizeParsed = toLength(splittedValue[1]);

		if (horizonalGlyphSizeParsed.metric !== verticalGlyphSizeParsed.metric) {
			return fontSizeValueDefaultLength(exHeight, cellResolutionHeight).toString();
		}
	}

	const length = toLength(splittedValue[0]);

	if (isCellScalar(length)) {
		const {
			attributes: {
				"ttp:cellResolution": [, cellResolutionHeight],
				"tts:extent": [exHeight],
			},
		} = readScopeDocumentContext(scope);

		return createUnit(
			getCellScalarPixelConversion(exHeight, cellResolutionHeight, length),
			"px",
		).toString();
	}

	/**
	 * @TODO handle "rw" and "rh"
	 */

	return length.toString();
}

function fontSizeValueDefaultLength(dimension: number, cellResolutionDimension: number): Length {
	// Initial value is 1c
	return createUnit(
		getCellScalarPixelConversion(dimension, cellResolutionDimension, createUnit(1, "c")),
		"px",
	);
}

// region tts:extent

function isExtentSupportedKeyword(value: string): value is "auto" | "contain" | "cover" {
	return ["auto", "contain", "cover"].includes(value);
}

function extentMapper(
	_scope: Scope,
	value: "auto" | "contain" | "cover" | string,
): PropertiesCollection<["width", "height"]> {
	if (isExtentSupportedKeyword(value)) {
		switch (value) {
			case "auto": {
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}

			case "contain": {
				console.warn("Region extent 'contain' is not yet supported. Will be treated as 'auto'");
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}

			case "cover": {
				console.warn("Region extent 'cover' is not yet supported. Will be treated as 'auto'");
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}
		}
	}

	let [width, height] = getSplittedLinearWhitespaceValues(value) || ["0%", "0%"];

	if (width === "auto") {
		console.warn(
			"Region extent width set to auto with a parametrized height is not yet supported. Will be treated as 100%",
		);

		width = "100%";
	}

	if (height === "auto") {
		console.warn(
			"Region extent height set to auto with a parametrized width is not yet supported. Will be treated as 100%",
		);

		height = "100%";
	}

	const widthLength = toClamped(toLength(width), 0, 100) || createUnit(0, "%");
	const heightLength = toClamped(toLength(height), 0, 100) || createUnit(0, "%");

	return [
		["width", widthLength.toString()],
		["height", heightLength.toString()],
	];
}

// region tts:origin

function originMapper(_scope: Scope, value: "auto" | string): PropertiesCollection<["x", "y"]> {
	if (value === "auto") {
		/**
		 * @TODO might be wrong
		 *
		 * "If the value of this attribute is auto,
		 * then the computed value of the style
		 * property must be considered to be the
		 * same as the origin of the root container
		 * region."
		 *
		 * But we don't have this detail. So this should
		 * be calculated by the region it self in renderer?
		 */
		return [
			["x", "0px"],
			["y", "0px"],
		];
	}

	const [x, y] = getSplittedLinearWhitespaceValues(value);

	const xLength = toLength(x) || createUnit(0, "px");
	const yLength = toLength(y) || createUnit(0, "px");

	return [
		["x", xLength.toString()],
		["y", yLength.toString()],
	];
}

// region <border>

function borderMapper(
	_scope: Scope,
	value: string,
): PropertiesCollection<["border-width", "border-style", "border-color", "border-radius"]> {
	const border = {
		"border-width": "",
		"border-style": "",
		"border-color": "",
		"border-radius": "",
	};

	const uncategorizedComponents = getSplittedLinearWhitespaceValues(value);

	/**
	 * "Note that component order is not significant."
	 */
	for (const component of uncategorizedComponents) {
		if (!border["border-width"]) {
			const thickness = getBorderThickness(component);

			if (thickness) {
				border["border-width"] = thickness;
				continue;
			}
		}

		if (!border["border-style"] && isSupportedBorderStyle(component)) {
			border["border-style"] = component;
			continue;
		}

		// region <border-color>
		if (!border["border-color"] && isValidColor(component)) {
			border["border-color"] = component;
			continue;
		}

		if (!border["border-radius"]) {
			const borderRadiusCSS = getBorderRadii(component);

			if (borderRadiusCSS) {
				border["border-radius"] = borderRadiusCSS;
				continue;
			}
		}
	}

	return [
		["border-width", border["border-width"]],
		["border-style", border["border-style"] || "none"],
		["border-color", border["border-color"]],
		["border-radius", border["border-radius"]],
	];
}

// region <border-thickness>

function getBorderThickness(component: string): string | undefined {
	if (["thin", "medium", "thick"].includes(component)) {
		/**
		 * @TODO such keywords are implementation dependent
		 * and we don't know yet how to remap them.
		 */
		return undefined;
	}

	const borderThicknessLength = toLength(component);

	if (!borderThicknessLength || isPercentage(borderThicknessLength)) {
		return undefined;
	}

	return borderThicknessLength.toString();
}

// region <border-style>

/**
 * "At least one of the border style components must be present,
 * for example, a <border-style> component of value none."
 *
 * For this reason
 *
 * @param component
 */
function isSupportedBorderStyle(
	component: string,
): component is "none" | "dotted" | "dashed" | "solid" | "double" {
	return ["none", "dotted", "dashed", "solid", "double"].includes(component);
}

// region <border-radii>

/**
 * @structure `radii(" <lwsp>? <length> ( <lwsp>? "," <lwsp>? <length> )? <lwsp>? ")"`
 * @param component
 * @returns
 */

function getBorderRadii(component: string): string {
	if (!component.startsWith("radii(")) {
		return "";
	}

	const startParenthesisIndex = component.indexOf("(");
	const endParenthesisIndex = component.lastIndexOf(")");
	const splittedSections = component
		.substring(startParenthesisIndex + 1, endParenthesisIndex)
		.split(",");

	if (!splittedSections.length) {
		return "";
	}

	const firstQuarterEllipseRadius = splittedSections[0].trim();
	const secondQuarterEllipseRadius = (splittedSections[1] || firstQuarterEllipseRadius).trim();

	const fqerAsLength = toLength(firstQuarterEllipseRadius);

	if (!fqerAsLength) {
		return "";
	}

	const sqerAsLength = toLength(secondQuarterEllipseRadius) || createUnit(0, "px");

	return `${fqerAsLength.toString()} ${sqerAsLength.toString()}`;
}

// region tts:textOutline

function textOutlineMapper(
	_scope: Scope,
	value: string,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> {
	if (value === "none") {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const { color, thickness, blur } = getTextOutlineComponents(value);

	return [
		["text-shadow", `${color} 1px 1px ${blur}`],
		["-webkit-text-stroke", `${thickness} ${color}`],
	];
}

function getTextOutlineComponents(value: string): {
	color: string;
	thickness: string;
	blur: string;
} {
	const [param1, param2, param3] = getSplittedLinearWhitespaceValues(value);

	let outlineColor: string = "";
	let outlineThickness: Length;
	let outlineBlur: Length;

	if (isValidColor(param1)) {
		outlineColor = param1;
		outlineThickness = toLength(param2) || createUnit(1, "px");
		outlineBlur = toLength(param3) || createUnit(0, "px");
	} else {
		/** CSS Default */
		outlineColor = "white";

		outlineThickness = toLength(param1) || createUnit(1, "px");
		outlineBlur = toLength(param2) || createUnit(0, "px");
	}

	return {
		color: outlineColor,
		thickness: outlineThickness.toString(),
		blur: outlineBlur.toString(),
	};
}
