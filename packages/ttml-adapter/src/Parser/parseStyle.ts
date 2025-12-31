import { readScopeDocumentContext } from "./Scope/DocumentContext.js";
import type { Scope } from "./Scope/Scope.js";
import { memoizationFactory } from "./memoizationFactory.js";
import * as Syntaxes from "./Style/properties/index.js";
import type { Derivable } from "./Style/structure/operators.js";
import { isDerived, isRejected } from "./Style/structure/operators.js";

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

export type PropertiesCollection<Props extends string[]> =
	| {
			readonly [K in keyof Props]: [Props[K], string];
	  }
	| null;

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
	readonly syntax: SyntaxModuleDefinition;

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

interface SyntaxModuleDefinition<DestinationProperties extends string[] = string[]> {
	Grammar: Derivable;
	cssTransform?(scope: Scope, value: unknown): PropertiesCollection<DestinationProperties> | null;
}

function createAttributeDefinition<
	DestinationProperties extends string[],
	const AllowedValues extends string,
>(
	attributeName: string,
	appliesTo: string[],
	defaultValue: NoInfer<AllowedValues>,
	allowedValues: Set<AllowedValues> | undefined,
	syntax: SyntaxModuleDefinition<DestinationProperties>,
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
			value(this: AttributeDefinition<DestinationProperties>, scope: Scope, value: unknown) {
				if (typeof this.syntax.cssTransform !== "function") {
					return [];
				}

				return this.syntax.cssTransform(scope, value);
			},
		},
		namespace: {
			get(): string {
				const nameSlice = attributeName.split(":");
				return nameSlice.length >= 2 ? nameSlice[0] : undefined;
			},
		},
		syntax: {
			value: syntax,
		},
		flags: {
			value: 0,
			writable: true,
		},
	} satisfies PropertyDescriptorMap);
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
			Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
			Syntaxes.BackgroundPosition,
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
			Syntaxes.BackgroundRepeat,
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
			Syntaxes.Border,
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
			Syntaxes.Unavailable,
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
				//
				"tts:color",
				["span", ""],
				"white",
				undefined,
				Syntaxes.Color,
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
				Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
			Syntaxes.Display,
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
			Syntaxes.DisplayAlign,
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
			Syntaxes.Extent,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
			createAttributeDefinition(
				//
				"tts:fontShear",
				["span"],
				"0%",
				undefined,
				Syntaxes.Unavailable,
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-fontSize
	 * Syntax.Unavailable,
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
				Syntaxes.FontSize,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
				//
				"tts:lineHeight",
				["p"],
				"normal",
				undefined,
				Syntaxes.Unavailable,
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
			createAttributeDefinition(
				//
				"tts:lineShear",
				["p"],
				"0%",
				undefined,
				Syntaxes.Unavailable,
			),
		),
	),

	/**
	 * TTML Only
	 * Syntax.Unavailable,
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-luminanceGain
	 * @see https://w3c.github.io/ttml2/#derivation-luminanceGain
	 */
	"tts:luminanceGain": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:luminanceGain",
			["region"],
			"1.0",
			undefined,
			Syntaxes.Unavailable,
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-opacity
	 * @see https://w3c.github.io/ttml2/#derivation-opacity
	 * Syntax.Unavailable,
	 */
	"tts:opacity": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:opacity",
			["body", "div", "image", "p", "region", "span"],
			"1.0",
			undefined,
			Syntaxes.Unavailable,
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
			Syntaxes.Origin,
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
			Syntaxes.Unavailable,
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
			Syntaxes.Padding,
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
			Syntaxes.Position,
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
		Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
			createAttributeDefinition(
				//
				"tts:rubyReserve",
				["p"],
				"none",
				undefined,
				Syntaxes.Unavailable,
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-shear
	 * Syntax.Unavailable,
	 * @see https://w3c.github.io/ttml2/#derivation-shear
	 */
	"tts:shear": inheritable(
		animatable(
			AnimationFlags.DISCRETE,
			createAttributeDefinition(
				//
				"tts:shear",
				["p"],
				"0%",
				undefined,
				Syntaxes.Unavailable,
			),
		),
	),

	/**
	 * @see https://w3c.github.io/ttml2/#style-attribute-showBackground
	 * Syntax.Unavailable,
	 * @see https://w3c.github.io/ttml2/#derivation-showBackground
	 */
	"tts:showBackground": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			"tts:showBackground",
			["region"],
			"always",
			new Set(["always", "whenActive"]),
			Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
				Syntaxes.TextCombine,
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
				Syntaxes.TextDecoration,
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
				Syntaxes.TextEmphasis,
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
			Syntaxes.TextOrientation,
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
				Syntaxes.TextOutline,
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
				//
				"tts:textShadow",
				["span"],
				"none",
				undefined,
				Syntaxes.TextShadow,
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
			Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
				Syntaxes.Unavailable,
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
			Syntaxes.Unavailable,
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
		createAttributeDefinition(
			//
			"tts:zIndex",
			["region"],
			"auto",
			undefined,
			Syntaxes.Unavailable,
		),
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

	attributesLoop: for (const attributeKey in attributes) {
		if (!isMappedKey(attributeKey)) {
			continue;
		}

		const value = attributes[attributeKey];
		const definition = TTML_CSS_ATTRIBUTES_MAP[attributeKey];

		if (!definition || !styleAppliesToElement(definition, scope, sourceElementName)) {
			continue attributesLoop;
		}

		let definitionGrammar = definition.syntax.Grammar;

		/**
		 * All the properties are space-separated tokens, so derivation is built
		 * upon this principle.
		 */
		const tokens = value.split(/\s+/g);
		const collectedValues: unknown[] = [];

		while (tokens.length) {
			const token = tokens.shift();

			if (!token) {
				break;
			}

			const tokenDerivationResult = definitionGrammar.derive(token);

			if (isRejected(tokenDerivationResult)) {
				// A token couldn't be derived, skip entire attribute
				continue attributesLoop;
			}

			if (isDerived(tokenDerivationResult)) {
				definitionGrammar = tokenDerivationResult.nextNode;
				collectedValues.push(tokenDerivationResult.values[0]);
				continue;
			}

			if (tokens.length > 0) {
				// Derivation finished (done) but there are still tokens left, skip entire attribute
				continue attributesLoop;
			}

			collectedValues.push(tokenDerivationResult.values[0]);
		}

		const mapped = definition.toCSS(scope, collectedValues);

		if (mapped === null) {
			continue attributesLoop;
		}

		for (const [mappedKey, mappedValue] of mapped) {
			convertedAttributes[mappedKey] = mappedValue;
		}
	}

	return convertedAttributes;
}
