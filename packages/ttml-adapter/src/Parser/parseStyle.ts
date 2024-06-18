import { readScopeDocumentContext } from "./Scope/DocumentContext.js";
import type { Scope } from "./Scope/Scope.js";
import { getCellScalarPixelConversion, isCellScalar } from "./Units/cell.js";
import type { Length } from "./Units/length.js";
import { createLength, toLength } from "./Units/length.js";
import { getSplittedLinearWhitespaceValues } from "./Units/lwsp.js";
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
	/**
	 * All the attributes belonging to a tag.
	 * They'll be filtered out
	 */
	attributes: Record<string, string>,
): TTMLStyle | undefined {
	let styleCache: SupportedCSSProperties | undefined = undefined;

	const id = attributes["xml:id"] || `style-rdm:${Math.floor(Math.random() * 1000)}`;
	const attrs = extractStyleAttributes(attributes);

	if (!Object.keys(attrs).length) {
		return undefined;
	}

	if (!attributes["style"]) {
		styleCache = convertAttributesToCSS(attrs, scope);
	}

	const style = {
		id: resolveIDREFConflict(stylesIDREFSStorage, id),
		get attributes(): TTMLStyle["attributes"] {
			if (typeof styleCache !== "undefined") {
				return styleCache;
			}

			/**
			 * @see https://www.w3.org/TR/2004/REC-xmlschema-2-20041028/#IDREFS
			 */

			const styleIDREFSSet = new Set(attributes["style"].split("\x20"));

			for (const idref of styleIDREFSSet) {
				/**
				 * @TODO verify if an inherited style IDREF could be defined
				 * before one inheriting from it.
				 */

				/**
				 * A loop in a sequence of chained style references must be considered an error.
				 * @see https://w3c.github.io/ttml2/#semantics-style-association-chained-referential
				 *
				 * @TODO Maybe, some issue could happen in that case.
				 * We should, somehow, keeping track of which styles have
				 * been referenced when `attributes` is called.
				 */

				const parentStyle = stylesIDREFSStorage.get(idref);

				if (!parentStyle) {
					continue;
				}

				if (!styleCache) {
					styleCache = Object.create(convertAttributesToCSS(attrs, scope));
				}

				const parentStylesEntries = Object.entries(parentStyle.attributes) as Array<
					[keyof SupportedCSSProperties, string]
				>;

				Object.assign(styleCache, parentStylesEntries);
			}

			if (!styleCache) {
				styleCache = convertAttributesToCSS(attrs, scope);
			}

			return styleCache;
		},
	};

	/** @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential */
	stylesIDREFSStorage.set(id, style);

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

function resolveIDREFConflict(idrefsMap: Map<string, TTMLStyle>, id: string): string {
	if (!idrefsMap.has(id)) {
		return id;
	}

	let styleConflictOverrideIdentifier = parseInt(id.match(/--(\d{1,})/)?.[1]);

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return id;
	}

	while (idrefsMap.has(`${id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	return id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);
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
	"tts:backgroundClip": createAttributeDefinition(
		"tts:backgroundClip",
		["body", "div", "image", "p", "region", "span"],
		"border",
		new Set(["border", "content", "padding"]),
		createPassThroughMapper("background-clip"),
	),
	"tts:backgroundColor": createAttributeDefinition(
		"tts:backgroundColor",
		["body", "div", "image", "p", "region", "span"],
		"transparent",
		undefined,
		createPassThroughMapper("background-color"),
	),
	"tts:backgroundExtent": createAttributeDefinition(
		"tts:backgroundExtent",
		["body", "div", "image", "p", "region", "span"],
		"",
		undefined,
		createPassThroughMapper("background-size"),
	),
	"tts:backgroundImage": createAttributeDefinition(
		"tts:backgroundImage",
		["body", "div", "image", "p", "region", "span"],
		"none",
		undefined,
		createPassThroughMapper("background-image"),
	),
	"tts:backgroundOrigin": createAttributeDefinition(
		"tts:backgroundOrigin",
		["body", "div", "image", "p", "region", "span"],
		"padding",
		new Set(["border", "content", "padding"]),
		createPassThroughMapper("background-origin"),
	),
	"tts:backgroundPosition": createAttributeDefinition(
		"tts:backgroundPosition",
		["body", "div", "image", "p", "region", "span"],
		"0% 0%",
		undefined,
		createPassThroughMapper("background-position"),
	),
	"tts:backgroundRepeat": createAttributeDefinition(
		"tts:backgroundRepeat",
		["body", "div", "image", "p", "region", "span"],
		"repeat",
		new Set(["repeat", "repeatX", "repeatY", "noRepeat"]),
		createPassThroughMapper("background-repeat", backgroundRepeatValueMapper),
	),
	"tts:border": createAttributeDefinition(
		"tts:border",
		["body", "div", "image", "p", "region", "span"],
		"none",
		undefined,
		createPassThroughMapper("border"),
	),
	// not known
	"tts:bpd": createAttributeDefinition(
		"tts:bpd",
		["body", "div", "p", "span"],
		"auto",
		undefined,
		nullMapper,
	),
	"tts:color": inheritable(
		createAttributeDefinition(
			"tts:color",
			["span", ""],
			"white",
			undefined,
			createPassThroughMapper("color"),
		),
	),
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
	"tts:disparity": createAttributeDefinition(
		"tts:disparity",
		["region", "div", "p"],
		"0px",
		undefined,
		nullMapper,
	),
	"tts:display": createAttributeDefinition(
		"tts:display",
		["body", "div", "image", "p", "region", "span"],
		"auto",
		new Set(["auto", "none", "inlineBlock"]),
		createPassThroughMapper("display"),
	),
	"tts:displayAlign": createAttributeDefinition(
		"tts:displayAlign",
		["body", "div", "p", "region"],
		"before",
		new Set(["before", "center", "after", "justify"]),
		createPassThroughMapper("justify-content", displayAlignValueMapper),
	),
	// Maps to two CSS. We handle this in a different way yet
	"tts:extent": createAttributeDefinition(
		"tts:extent",
		["tt", "region", "image", "div", "p"],
		"auto",
		undefined,
		nullMapper,
	),
	"tts:fontFamily": inheritable(
		createAttributeDefinition(
			"tts:fontFamily",
			["p", "span"],
			"default",
			undefined,
			createPassThroughMapper("font-family"),
		),
	),
	"tts:fontKerning": inheritable(
		createAttributeDefinition(
			"tts:fontKerning",
			["span"],
			"normal",
			new Set(["none", "normal"]),
			createPassThroughMapper("font-kerning"),
		),
	),
	// No CSS equivalent
	"tts:fontSelectionStrategy": inheritable(
		createAttributeDefinition(
			"tts:fontSelectionStrategy",
			["p", "span"],
			"auto",
			new Set(["auto", "character"]),
			nullMapper,
		),
	),
	// Maps to CSS values. Must be handled differently
	"tts:fontShear": inheritable(
		createAttributeDefinition("tts:fontShear", ["span"], "0%", undefined, nullMapper),
	),
	"tts:fontSize": inheritable(
		createAttributeDefinition(
			"tts:fontSize",
			["p", "span", "region"],
			"1c",
			undefined,
			createPassThroughMapper("font-size", fontSizeValueMapper),
		),
	),
	"tts:fontStyle": inheritable(
		createAttributeDefinition(
			"tts:fontStyle",
			["p", "span"],
			"normal",
			new Set(["normal", "italic", "oblique"]),
			createPassThroughMapper("font-style"),
		),
	),
	"tts:fontVariant": inheritable(
		createAttributeDefinition(
			"tts:fontVariant",
			["p", "span"],
			"normal",
			undefined,
			nullMapper, // Maps to multiple values. Must be handled differently
		),
	),
	"tts:fontWeight": inheritable(
		createAttributeDefinition(
			"tts:fontWeight",
			["p", "span"],
			"normal",
			new Set(["normal", "bold"]),
			createPassThroughMapper("font-weight"),
		),
	),
	"tts:ipd": createAttributeDefinition(
		"tts:ipd",
		["body", "div", "p", "span"],
		"auto",
		undefined,
		nullMapper, // ??????
	),
	"tts:letterSpacing": inheritable(
		createAttributeDefinition(
			"tts:letterSpacing",
			["p", "span"],
			"normal",
			undefined,
			createPassThroughMapper("letter-spacing"),
		),
	),
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
	"tts:lineShear": inheritable(
		createAttributeDefinition("tts:lineShear", ["p"], "0%", undefined, nullMapper),
	),
	// ttml only
	"tts:luminanceGain": createAttributeDefinition(
		"tts:luminanceGain",
		["region"],
		"1.0",
		undefined,
		nullMapper,
	),
	"tts:opacity": createAttributeDefinition(
		"tts:opacity",
		["body", "div", "image", "p", "region", "span"],
		"1.0",
		undefined,
		createPassThroughMapper("opacity"),
	),
	"tts:origin": createAttributeDefinition(
		"tts:origin",
		["region", "div", "p"],
		"auto",
		undefined,
		nullMapper, // no css
	),
	"tts:overflow": createAttributeDefinition(
		"tts:overflow",
		["region"],
		"hidden",
		new Set(["visible", "hidden"]),
		createPassThroughMapper("overflow"),
	),
	"tts:padding": createAttributeDefinition(
		"tts:padding",
		["body", "div", "image", "p", "region", "span"],
		"0px",
		undefined,
		createPassThroughMapper("padding", paddingValueMapper),
	),
	"tts:position": createAttributeDefinition(
		"tts:position",
		["region", "div", "p"],
		"top left",
		undefined,
		createPassThroughMapper("background-position"),
	),
	"tts:ruby": createAttributeDefinition(
		"tts:ruby",
		["span"],
		"none",
		new Set(["none", "container", "base", "baseContainer", "text", "textContainer", "delimiter"]),
		nullMapper,
	),
	"tts:rubyAlign": inheritable(
		createAttributeDefinition(
			"tts:rubyAlign",
			["span"],
			"center",
			new Set(["start", "center", "end", "spaceAround", "spaceBetween", "withBase"]),
			createPassThroughMapper("ruby-align"),
		),
	),
	"tts:rubyPosition": inheritable(
		createAttributeDefinition(
			"tts:rubyPosition",
			["span"],
			"outside",
			new Set(["before", "after", "outside"]),
			createPassThroughMapper("ruby-position"),
		),
	),
	"tts:rubyReserve": inheritable(
		createAttributeDefinition("tts:rubyReserve", ["p"], "none", undefined, nullMapper),
	),
	"tts:shear": inheritable(
		createAttributeDefinition("tts:shear", ["p"], "0%", undefined, nullMapper),
	),
	"tts:showBackground": createAttributeDefinition(
		"tts:showBackground",
		["region"],
		"always",
		new Set(["always", "whenActive"]),
		nullMapper,
	),
	"tts:textAlign": createAttributeDefinition(
		"tts:textAlign",
		["p"],
		"start",
		new Set(["left", "center", "right", "start", "end", "justify"]),
		createPassThroughMapper("text-align"),
	),
	"tts:textCombine": inheritable(
		createAttributeDefinition(
			"tts:textCombine",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-combine-upright"),
		),
	),
	"tts:textDecoration": inheritable(
		createAttributeDefinition(
			"tts:textDecoration",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-decoration", textDecorationValueMapper),
		),
	),
	"tts:textEmphasis": inheritable(
		createAttributeDefinition(
			"tts:textEmphasis",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-emphasis"),
		),
	),
	"tts:textOrientation": inheritable(
		createAttributeDefinition(
			"tts:textOrientation",
			["span"],
			"mixed",
			new Set(["mixed", "sideways", "upright"]),
			createPassThroughMapper("text-orientation", textOrientationValueMapper),
		),
	),
	"tts:textOutline": inheritable(
		createAttributeDefinition(
			"tts:textOutline",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("outline"),
		),
	),
	"tts:textShadow": inheritable(
		createAttributeDefinition(
			"tts:textShadow",
			["span"],
			"none",
			undefined,
			createPassThroughMapper("text-shadow"),
		),
	),
	"tts:unicodeBidi": createAttributeDefinition(
		"tts:unicodeBidi",
		["p", "span"],
		"normal",
		new Set(["normal", "embed", "bidiOverride", "isolate"]),
		createPassThroughMapper("unicode-bidi"),
	),
	"tts:visibility": inheritable(
		createAttributeDefinition(
			"tts:visibility",
			["body", "div", "image", "p", "region", "span"],
			"visible",
			new Set(["visible", "hidden"]),
			createPassThroughMapper("visibility"),
		),
	),
	// XLFO, not a direct mapping with CSS. Can use remap it somehow without impacting renderer?
	"tts:wrapOption": inheritable(
		createAttributeDefinition(
			"tts:wrapOption",
			["span"],
			"wrap",
			new Set(["wrap", "noWrap"]),
			nullMapper,
		),
	),
	// Writing mode impacts rendering, so we must first verify nothing will break on that
	"tts:writingMode": createAttributeDefinition(
		"tts:writingMode",
		["region"],
		"lrtb",
		new Set(["lrtb", "rltb", "tbrl", "tblr", "lr", "rl", "tb"]),
		nullMapper,
	),
	// valid CSS, but it won't be used until we won't paint on a new layer or an absolute element...
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

	for (const [key, value] of Object.entries(attributes)) {
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

		if (horizonalGlyphSizeParsed.unit !== verticalGlyphSizeParsed.unit) {
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

		return createLength(
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
	return createLength(
		getCellScalarPixelConversion(dimension, cellResolutionDimension, createLength(1, "c")),
		"px",
	);
}
