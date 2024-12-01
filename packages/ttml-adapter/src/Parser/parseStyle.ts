import { readScopeDocumentContext } from "./Scope/DocumentContext.js";
import type { Scope } from "./Scope/Scope.js";
import { getCellScalarPixelConversion, isCellScalar } from "./Units/cell.js";
import { toClamped } from "./Units/clamp.js";
import type { Length } from "./Units/length.js";
import { toLength } from "./Units/length.js";
import { getSplittedLinearWhitespaceValues } from "./Units/lwsp.js";
import { createUnit } from "./Units/unit.js";
import { memoizationFactory } from "./memoizationFactory";

type StyleAttributeString = `tts:${string}`;

export interface TTMLStyle {
	id: string;
	attributes: SupportedCSSProperties;
}

export const createStyleParser = memoizationFactory(function styleParserExecutor(
	/**
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-attribute-style
	 * @see https://www.w3.org/TR/xmlschema-2/#IDREFS
	 */
	stylesIDREFSStorage: Map<string, TTMLStyle>,
	scope: Scope,
	attributes: Record<string, string>,
): TTMLStyle | undefined {
	let styleCache: SupportedCSSProperties | undefined = undefined;

	const style = {
		id: attributes["xml:id"],
		get attributes(): TTMLStyle["attributes"] {
			if (typeof styleCache !== "undefined") {
				return styleCache;
			}

			styleCache = convertAttributesToCSS(extractStyleAttributes(attributes), scope);

			return styleCache;
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

function isStyleAttribute(attribute: string): attribute is StyleAttributeString {
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
	INHERITABLE: 0b0001,
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
	"tts:backgroundClip": createAttributeDefinition(
		"tts:backgroundClip",
		["body", "div", "image", "p", "region", "span"],
		"border",
		new Set(["border", "content", "padding"]),
		createPassThroughMapper("background-clip"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundColor
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundColor
	 */
	"tts:backgroundColor": createAttributeDefinition(
		"tts:backgroundColor",
		["body", "div", "image", "p", "region", "span"],
		"transparent",
		undefined,
		createPassThroughMapper("background-color"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundExtent
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundExtent
	 */
	"tts:backgroundExtent": createAttributeDefinition(
		"tts:backgroundExtent",
		["body", "div", "image", "p", "region", "span"],
		"",
		undefined,
		createPassThroughMapper("background-size"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundImage
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundImage
	 */
	"tts:backgroundImage": createAttributeDefinition(
		"tts:backgroundImage",
		["body", "div", "image", "p", "region", "span"],
		"none",
		undefined,
		createPassThroughMapper("background-image"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundOrigin
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundOrigin
	 */
	"tts:backgroundOrigin": createAttributeDefinition(
		"tts:backgroundOrigin",
		["body", "div", "image", "p", "region", "span"],
		"padding",
		new Set(["border", "content", "padding"]),
		createPassThroughMapper("background-origin"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundPosition
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundPosition
	 */
	"tts:backgroundPosition": createAttributeDefinition(
		"tts:backgroundPosition",
		["body", "div", "image", "p", "region", "span"],
		"0% 0%",
		undefined,
		createPassThroughMapper("background-position"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundRepeat
	 * @see https://w3c.github.io/ttml2/#derivation-backgroundRepeat
	 */
	"tts:backgroundRepeat": createAttributeDefinition(
		"tts:backgroundRepeat",
		["body", "div", "image", "p", "region", "span"],
		"repeat",
		new Set(["repeat", "repeatX", "repeatY", "noRepeat"]),
		createPassThroughMapper("background-repeat", backgroundRepeatValueMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-border
	 * @see https://w3c.github.io/ttml2/#derivation-border
	 */
	"tts:border": createAttributeDefinition(
		"tts:border",
		["body", "div", "image", "p", "region", "span"],
		"none",
		undefined,
		createPassThroughMapper("border"),
	),

	/**
	 * Not known
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-bpd
	 * @see https://w3c.github.io/ttml2/#derivation-bpd
	 */
	"tts:bpd": createAttributeDefinition(
		"tts:bpd",
		["body", "div", "p", "span"],
		"auto",
		undefined,
		nullMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-color
	 * @see https://w3c.github.io/ttml2/#derivation-color
	 */
	"tts:color": inheritable(
		createAttributeDefinition(
			"tts:color",
			["span", ""],
			"white",
			undefined,
			createPassThroughMapper("color"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-direction
	 * @see https://w3c.github.io/ttml2/#derivation-direction
	 */
	"tts:direction": inheritable(
		createAttributeDefinition(
			"tts:direction",
			["p", "span"],
			"ltr",
			new Set(["ltr", "rtl"]),
			createPassThroughMapper("direction"),
		),
	),
	// ttml-only
	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-disparity
	 * @see https://w3c.github.io/ttml2/#derivation-disparity
	 */
	"tts:disparity": createAttributeDefinition(
		"tts:disparity",
		["region", "div", "p"],
		"0px",
		undefined,
		nullMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-display
	 * @see https://w3c.github.io/ttml2/#derivation-display
	 */
	"tts:display": createAttributeDefinition(
		"tts:display",
		["body", "div", "image", "p", "region", "span"],
		"auto",
		new Set(["auto", "none", "inlineBlock"]),
		createPassThroughMapper("display"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
	 * @see https://w3c.github.io/ttml2/#derivation-displayAlign
	 */
	"tts:displayAlign": createAttributeDefinition(
		"tts:displayAlign",
		["body", "div", "p", "region"],
		"before",
		new Set(["before", "center", "after", "justify"]),
		createPassThroughMapper("justify-content", displayAlignValueMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-extent
	 * @see https://w3c.github.io/ttml2/#derivation-extent
	 */
	"tts:extent": createAttributeDefinition<["width", "height"], string>(
		"tts:extent",
		["tt", "region", "image", "div", "p"],
		"auto",
		undefined,
		extentMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontFamily
	 * @see https://w3c.github.io/ttml2/#derivation-fontFamily
	 */
	"tts:fontFamily": inheritable(
		createAttributeDefinition(
			"tts:fontFamily",
			["p", "span"],
			"default",
			undefined,
			createPassThroughMapper("font-family"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontKerning
	 * @see https://w3c.github.io/ttml2/#derivation-fontKerning
	 */
	"tts:fontKerning": inheritable(
		createAttributeDefinition(
			"tts:fontKerning",
			["span"],
			"normal",
			new Set(["none", "normal"]),
			createPassThroughMapper("font-kerning"),
		),
	),

	/**
	 * No CSS equivalent
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontSelectionStrategy
	 * @see https://w3c.github.io/ttml2/#derivation-fontSelectionStrategy
	 */
	"tts:fontSelectionStrategy": inheritable(
		createAttributeDefinition(
			"tts:fontSelectionStrategy",
			["p", "span"],
			"auto",
			new Set(["auto", "character"]),
			nullMapper,
		),
	),

	/**
	 * Maps to CSS values. Must be handled differently
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontShear
	 * @see https://w3c.github.io/ttml2/#derivation-fontShear
	 */
	"tts:fontShear": inheritable(
		createAttributeDefinition("tts:fontShear", ["span"], "0%", undefined, nullMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontSize
	 * @see https://w3c.github.io/ttml2/#derivation-fontSize
	 */
	"tts:fontSize": inheritable(
		createAttributeDefinition(
			"tts:fontSize",
			["p", "span", "region"],
			"1c",
			undefined,
			createPassThroughMapper("font-size", fontSizeValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontStyle
	 * @see https://w3c.github.io/ttml2/#derivation-fontStyle
	 */
	"tts:fontStyle": inheritable(
		createAttributeDefinition(
			"tts:fontStyle",
			["p", "span"],
			"normal",
			new Set(["normal", "italic", "oblique"]),
			createPassThroughMapper("font-style"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontVariant
	 * @see https://w3c.github.io/ttml2/#derivation-fontVariant
	 */
	"tts:fontVariant": inheritable(
		createAttributeDefinition(
			"tts:fontVariant",
			["p", "span"],
			"normal",
			undefined,
			nullMapper, // Maps to multiple values. Must be handled differently
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontWeight
	 * @see https://w3c.github.io/ttml2/#derivation-fontWeight
	 */
	"tts:fontWeight": inheritable(
		createAttributeDefinition(
			"tts:fontWeight",
			["p", "span"],
			"normal",
			new Set(["normal", "bold"]),
			createPassThroughMapper("font-weight"),
		),
	),

	/**
	 * Not known
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-ipd
	 * @see https://w3c.github.io/ttml2/#derivation-ipd
	 */
	"tts:ipd": createAttributeDefinition(
		"tts:ipd",
		["body", "div", "p", "span"],
		"auto",
		undefined,
		nullMapper, // ??????
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-letterSpacing
	 * @see https://w3c.github.io/ttml2/#derivation-letterSpacing
	 */
	"tts:letterSpacing": inheritable(
		createAttributeDefinition(
			"tts:letterSpacing",
			["p", "span"],
			"normal",
			undefined,
			createPassThroughMapper("letter-spacing"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-lineHeight
	 * @see https://w3c.github.io/ttml2/#derivation-lineHeight
	 */
	"tts:lineHeight": inheritable(
		createAttributeDefinition(
			"tts:lineHeight",
			["p"],
			"normal",
			undefined,
			createPassThroughMapper("line-height"),
		),
	),
	// Maps to CSS values. Must be handled differently
	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-lineShear
	 * @see https://w3c.github.io/ttml2/#derivation-lineShear
	 */
	"tts:lineShear": inheritable(
		createAttributeDefinition("tts:lineShear", ["p"], "0%", undefined, nullMapper),
	),

	/**
	 * TTML Only
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-luminanceGain
	 * @see https://w3c.github.io/ttml2/#derivation-luminanceGain
	 */
	"tts:luminanceGain": createAttributeDefinition(
		"tts:luminanceGain",
		["region"],
		"1.0",
		undefined,
		nullMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-opacity
	 * @see https://w3c.github.io/ttml2/#derivation-opacity
	 */
	"tts:opacity": createAttributeDefinition(
		"tts:opacity",
		["body", "div", "image", "p", "region", "span"],
		"1.0",
		undefined,
		createPassThroughMapper("opacity"),
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
	"tts:origin": createAttributeDefinition(
		"tts:origin",
		["region", "div", "p"],
		"auto",
		undefined,
		originMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-overflow
	 * @see https://w3c.github.io/ttml2/#derivation-overflow
	 */
	"tts:overflow": createAttributeDefinition(
		"tts:overflow",
		["region"],
		"hidden",
		new Set(["visible", "hidden"]),
		createPassThroughMapper("overflow"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-padding
	 * @see https://w3c.github.io/ttml2/#derivation-padding
	 */
	"tts:padding": createAttributeDefinition(
		"tts:padding",
		["body", "div", "image", "p", "region", "span"],
		"0px",
		undefined,
		createPassThroughMapper("padding", paddingValueMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-position
	 * @see https://w3c.github.io/ttml2/#derivation-position
	 */
	"tts:position": createAttributeDefinition(
		"tts:position",
		["region", "div", "p"],
		"top left",
		undefined,
		createPassThroughMapper("background-position"),
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
		createAttributeDefinition(
			"tts:rubyAlign",
			["span"],
			"center",
			new Set(["start", "center", "end", "spaceAround", "spaceBetween", "withBase"]),
			createPassThroughMapper("ruby-align"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-rubyPosition
	 * @see https://w3c.github.io/ttml2/#derivation-rubyPosition
	 */
	"tts:rubyPosition": inheritable(
		createAttributeDefinition(
			"tts:rubyPosition",
			["span"],
			"outside",
			new Set(["before", "after", "outside"]),
			createPassThroughMapper("ruby-position"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-rubyReserve
	 * @see https://w3c.github.io/ttml2/#derivation-rubyReserve
	 */
	"tts:rubyReserve": inheritable(
		createAttributeDefinition("tts:rubyReserve", ["p"], "none", undefined, nullMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-shear
	 * @see https://w3c.github.io/ttml2/#derivation-shear
	 */
	"tts:shear": inheritable(
		createAttributeDefinition("tts:shear", ["p"], "0%", undefined, nullMapper),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-showBackground
	 * @see https://w3c.github.io/ttml2/#derivation-showBackground
	 */
	"tts:showBackground": createAttributeDefinition(
		"tts:showBackground",
		["region"],
		"always",
		new Set(["always", "whenActive"]),
		nullMapper,
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textAlign
	 * @see https://w3c.github.io/ttml2/#derivation-textAlign
	 */
	"tts:textAlign": createAttributeDefinition(
		"tts:textAlign",
		["p"],
		"start",
		new Set(["left", "center", "right", "start", "end", "justify"]),
		createPassThroughMapper("text-align"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textCombine
	 * @see https://w3c.github.io/ttml2/#derivation-textCombine
	 */
	"tts:textCombine": inheritable(
		createAttributeDefinition(
			"tts:textCombine",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-combine-upright"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textDecoration
	 * @see https://w3c.github.io/ttml2/#derivation-textDecoration
	 */
	"tts:textDecoration": inheritable(
		createAttributeDefinition(
			"tts:textDecoration",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-decoration", textDecorationValueMapper),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textEmphasis
	 * @see https://w3c.github.io/ttml2/#derivation-textEmphasis
	 */
	"tts:textEmphasis": inheritable(
		createAttributeDefinition(
			"tts:textEmphasis",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-emphasis"),
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
		createAttributeDefinition(
			"tts:textOutline",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("outline"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-textShadow
	 * @see https://w3c.github.io/ttml2/#derivation-textShadow
	 */
	"tts:textShadow": inheritable(
		createAttributeDefinition(
			"tts:textShadow",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-shadow"),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-unicodeBidi
	 * @see https://w3c.github.io/ttml2/#derivation-unicodeBidi
	 */
	"tts:unicodeBidi": createAttributeDefinition(
		"tts:unicodeBidi",
		["p", "span"],
		"normal",
		new Set(["normal", "embed", "bidiOverride", "isolate"]),
		createPassThroughMapper("unicode-bidi"),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-visibility
	 * @see https://w3c.github.io/ttml2/#derivation-visibility
	 */
	"tts:visibility": inheritable(
		createAttributeDefinition(
			"tts:visibility",
			["body", "div", "image", "p", "region", "span"],
			"visible",
			new Set(["visible", "hidden"]),
			createPassThroughMapper("visibility"),
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
		createAttributeDefinition(
			"tts:wrapOption",
			["span"],
			"wrap",
			new Set(["wrap", "noWrap"]),
			nullMapper,
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
	"tts:writingMode": createAttributeDefinition(
		"tts:writingMode",
		["region"],
		"lrtb",
		new Set(["lrtb", "rltb", "tbrl", "tblr", "lr", "rl", "tb"]),
		nullMapper,
	),

	/**
	 * Z-index impacts on rendering (it is a valid CSS), but it won't be
	 * used until we won't paint on a new layer or an absolute element.
	 * @TODO
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-zIndex
	 * @see https://w3c.github.io/ttml2/#derivation-zIndex
	 */
	"tts:zIndex": createAttributeDefinition("tts:zIndex", ["region"], "auto", undefined, nullMapper),
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

export function convertAttributesToCSS(
	attributes: Record<string, string>,
	scope: Scope,
): SupportedCSSProperties {
	const convertedAttributes: SupportedCSSProperties = {};

	/**
	 * Not using Object.entries or "for..of" because they are not
	 * able to detect enumerable keys in prototype chain, and we
	 * are using them
	 */
	for (const attribute in attributes) {
		const [key, value] = attribute;

		if (!isMappedKey(key)) {
			continue;
		}

		const mapped = TTML_CSS_ATTRIBUTES_MAP[key].toCSS(scope, value);

		for (const [mappedKey, mappedValue] of mapped) {
			convertedAttributes[mappedKey] = mappedValue;
		}
	}

	return convertedAttributes;
}

// ******************* //
// *** CSS MAPPERS *** //
// ******************* //

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
