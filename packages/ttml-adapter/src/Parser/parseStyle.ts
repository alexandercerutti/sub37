import { readScopeDocumentContext } from "./Scope/DocumentContext.js";
import type { Scope } from "./Scope/Scope.js";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import type { Token } from "./Token.js";
import * as Syntaxes from "./namespaces/tts/properties/index.js";
import type { Derivable } from "./namespaces/tts/structure/operators.js";
import type { GrammarDefinition } from "./grammar/parseAttributeValue.js";

export type StyleAttributeString = `tts:${string}`;

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
	elementAppliesTo: string,
) => PropertiesCollection<OutProperties>;

const AttributeFlags = {
	INHERITABLE: /***/ 0b0001,
} as const;

const AnimationFlags = {
	DISCRETE: /******/ 0b0100,
	CONTINUOUS: /****/ 0b0110,
} as const;

interface AttributeDefinition<
	Name extends string = string,
	DestinationProperties extends string[] = string[],
	Syntax extends SyntaxModuleDefinition = SyntaxModuleDefinition,
> {
	readonly name: Name;
	readonly appliesTo: string[];
	readonly default: unknown;
	readonly allowedValues: Set<unknown>;
	readonly namespace: string | undefined;
	readonly toCSS: PropertiesMapper<DestinationProperties>;
	readonly syntax: Syntax;

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

/**
 * Triple overload to allow us to have better typings when the property is known.
 * Otherwise Typescript can't correlate the input string with the keys of the map and we lose type information.
 */
export function resolveStyleDefinitionByName<Prop extends keyof TTML_CSS_ATTRIBUTES_MAP>(
	propName: Prop,
): TTML_CSS_ATTRIBUTES_MAP[Prop];

export function resolveStyleDefinitionByName(
	propName: string,
): TTML_CSS_ATTRIBUTES_MAP[keyof TTML_CSS_ATTRIBUTES_MAP] | undefined;

export function resolveStyleDefinitionByName(propName: string) {
	if (!isMappedKey(propName)) {
		return undefined;
	}

	return TTML_CSS_ATTRIBUTES_MAP[propName];
}

export function isPropertyContinuouslyAnimatable(definition: AttributeDefinition): boolean {
	return Boolean(definition.flags & AnimationFlags.CONTINUOUS);
}

export function isPropertyDiscretelyAnimatable(definition: AttributeDefinition): boolean {
	return Boolean(definition.flags & AnimationFlags.DISCRETE);
}

export interface SyntaxModuleDefinition<
	DestinationProperties extends string[] = string[],
	Grammar extends Derivable = Derivable,
> extends GrammarDefinition<Grammar> {
	cssTransform(
		scope: Scope,
		value: unknown,
		elementAppliesTo: string,
	): PropertiesCollection<DestinationProperties> | null;
}

function createAttributeDefinition<
	const Name extends string,
	DestinationProperties extends string[],
	const AllowedValues extends string,
	Syntax extends SyntaxModuleDefinition<DestinationProperties>,
>(
	attributeName: Name,
	appliesTo: string[],
	defaultValue: NoInfer<AllowedValues>,
	allowedValues: Set<AllowedValues> | undefined,
	syntax: Syntax,
): AttributeDefinition<Name, DestinationProperties, Syntax> {
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
			value(
				this: AttributeDefinition<Name, DestinationProperties>,
				scope: Scope,
				value: unknown,
				elementAppliesTo: string,
			) {
				if (typeof this.syntax.cssTransform !== "function") {
					return [];
				}

				return this.syntax.cssTransform(scope, value, elementAppliesTo);
			},
		},
		namespace: {
			get(): string | undefined {
				const nameSlice = attributeName.split(":");
				return nameSlice.length >= 2 ? nameSlice[0]! : undefined;
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
	 * Deferred — only meaningful when background images are in use.
	 * `tts:backgroundImage` is currently not supported.
	 *
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
			Syntaxes.BackgroundColor,
		),
	),

	/**
	 * Deferred — maps to CSS `background-size`, but has no practical
	 * effect until `tts:backgroundImage` is supported.
	 *
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
	 * Not supported — the adapter pipeline has no resource resolver;
	 * URLs and inline data URIs cannot be turned into values the
	 * renderer can consume. Audio and image content are out of scope.
	 *
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
	 * Deferred. Depends on `tts:backgroundImage`, which is currently not
	 * supported.
	 *
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
	 * Deferred — the block axis maps to CSS `height` in horizontal
	 * writing modes and `width` in vertical ones; cannot be emitted
	 * without knowing the active `tts:writingMode`. Blocked by the
	 * same writing-mode gap as `tts:ipd`.
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
	 * Skipped — the renderer splits a TTML `<p>` into one DOM `<p>`
	 * per word. Applying a single authored `direction` to all of them
	 * is incorrect for mixed-direction content; correct implementation
	 * requires per-line bidi analysis.
	 *
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
			//
			"tts:disparity",
			["region"],
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
		createAttributeDefinition(
			"tts:extent",
			["tt", "region", "image"],
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
				Syntaxes.FontFamily,
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
				Syntaxes.FontKerning,
			),
		),
	),

	/**
	 * No CSS equivalent — controls whether glyph selection is
	 * per-character or per-run. Browser shaping engines handle
	 * this automatically and cannot be overridden via CSS.
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
	 * Skipped — per-glyph distortion (synthetic oblique). No direct
	 * CSS equivalent; `transform: skewX()` would also skew the
	 * element's bounding box, misaligning surrounding geometry.
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
				Syntaxes.FontStyle,
			),
		),
	),

	/**
	 * Not supported yet. Maps to multiple CSS properties depending on
	 * value group: `font-variant-position`, `font-variant-east-asian`,
	 * `font-feature-settings`. Only `small-caps` has practical
	 * broadcast subtitle usage.
	 *
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
				Syntaxes.FontWeight,
			),
		),
	),

	/**
	 * Deferred — the inline axis maps to CSS `width` in horizontal
	 * writing modes and `height` in vertical ones; cannot be emitted
	 * without knowing the active `tts:writingMode`. Blocked by the
	 * same writing-mode gap as `tts:bpd`.
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
				Syntaxes.LetterSpacing,
			),
		),
	),

	/**
	 * Blocked by renderer — `captions-renderer` hardcodes
	 * `line-height: 1.5em` on spans, and `TreeOrchestrator` derives
	 * grid-snap and scroll-step from a uniform `offsetHeight`.
	 * Injecting an authored value corrupts row-height arithmetic.
	 *
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
	/**
	 * Skipped — tilts a whole text line. `transform: skewX()` would
	 * approximate the effect but also skews the element's bounding
	 * box, misaligning region geometry. No safe CSS equivalent.
	 *
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
	 * Won't implement — TTML-only concept with no CSS equivalent.
	 * `filter: brightness()` is not semantically equivalent as it
	 * also affects child elements and blends differently.
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
	 */
	"tts:opacity": animatable(
		AnimationFlags.DISCRETE | AnimationFlags.CONTINUOUS,
		createAttributeDefinition(
			"tts:opacity",
			["body", "div", "image", "p", "region", "span"],
			"1.0",
			undefined,
			Syntaxes.Opacity,
		),
	),

	/**
	 * No direct CSS property — used internally to position a region
	 * via `left`/`top` on the region element.
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-origin
	 * @see https://w3c.github.io/ttml2/#derivation-origin
	 */
	"tts:origin": animatable(
		AnimationFlags.DISCRETE,
		createAttributeDefinition(
			//
			"tts:origin",
			["region"],
			"auto",
			undefined,
			Syntaxes.Origin,
		),
	),

	/**
	 * Blocked by renderer — `RegionElement` hardcodes `overflow: hidden`;
	 * an authored value would be silently overridden.
	 *
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
			//
			"tts:position",
			["region"],
			"top left",
			undefined,
			Syntaxes.Position,
		),
	),

	/**
	 * Deferred — requires coordinating `ruby`, `rubyAlign`,
	 * `rubyPosition`, and `rubyReserve` across the full CSS ruby model.
	 *
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
	 * Deferred — part of the ruby model; see `tts:ruby`.
	 *
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
	 * Deferred — part of the ruby model; see `tts:ruby`.
	 *
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
	 * Deferred — part of the ruby model; see `tts:ruby`.
	 *
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
	 * Skipped — tilts the entire region. Same issue as `tts:lineShear`
	 * and `tts:fontShear`: `transform: skewX()` would misalign region
	 * geometry. No safe CSS equivalent.
	 *
	 * @see https://w3c.github.io/ttml2/#style-attribute-shear
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
	 * Partially supported by default — the renderer already implements
	 * `whenActive` semantics (regions are hidden when no cues are active).
	 * The `always` value (keep region background visible when idle) has
	 * no CSS mechanism in the current renderer.
	 *
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
			Syntaxes.TextAlign,
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
	 * Skipped — depends on `tts:direction`. Applying `unicode-bidi`
	 * in isolation without correct per-line `direction` context
	 * would produce incorrect bidi rendering.
	 *
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
				Syntaxes.Visibility,
			),
		),
	),

	/**
	 * No clean CSS derivation — spec §N.2.1.49 lists only XSL-FO
	 * `wrap-option`. The closest CSS approximation `white-space` also
	 * controls whitespace collapsing, which TTML governs separately
	 * via `xml:space`, making a lossless mapping impossible.
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
	 * Deferred — the engine has no concept of vertical or reversed
	 * text progression. The renderer's word-splitting and line-height
	 * geometry assumes horizontal LTR.
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
			Syntaxes.zIndex,
		),
	),
} as const;

type TTML_CSS_ATTRIBUTES_MAP = typeof TTML_CSS_ATTRIBUTES_MAP;

type GetCollectionKeys<Collection extends PropertiesCollection<string[]>> = Exclude<
	Collection,
	null
>[number][0];

export type SupportedTTMLAttributes = keyof TTML_CSS_ATTRIBUTES_MAP;

export type SupportedCSSProperties = {
	-readonly [K in keyof TTML_CSS_ATTRIBUTES_MAP as GetCollectionKeys<
		ReturnType<TTML_CSS_ATTRIBUTES_MAP[K]["toCSS"]>
	>]?: string;
};

function isMappedKey(key: string): key is keyof TTML_CSS_ATTRIBUTES_MAP {
	return TTML_CSS_ATTRIBUTES_MAP.hasOwnProperty(key);
}

export function styleAppliesToElement(
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

export function isInheritableStyle(styleDef: AttributeDefinition): boolean {
	return Boolean(styleDef.flags & AttributeFlags.INHERITABLE);
}

function styleAppliesByInheritance(styleDef: AttributeDefinition, scope: Scope): boolean {
	if (!isInheritableStyle(styleDef)) {
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
		if (!styleDef.appliesTo.includes(hierarchy[i]!)) {
			continue;
		}

		return true;
	}

	return false;
}

function getElementsHierarchyFromScope(scope: Scope): string[] {
	const documentContext = readScopeDocumentContext(scope)!;
	const hierarchy: string[] = [];

	let currentNode: NodeWithRelationship<Token> | null = documentContext.currentNode;

	while (currentNode !== null) {
		hierarchy.push(currentNode.content.content);
		currentNode = currentNode.parent || null;
	}

	return hierarchy;
}
