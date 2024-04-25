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

			const parentStyle = stylesIDREFSStorage.get(attributes["style"]);

			if (!parentStyle) {
				styleCache = convertAttributesToCSS(attrs, scope);
				return styleCache;
			}

			styleCache = Object.create(convertAttributesToCSS(attrs, scope));

			const parentStylesEntries = Object.entries(parentStyle.attributes) as Array<[keyof SupportedCSSProperties, string]>;

			for (const [styleName, value] of parentStylesEntries) {
				styleCache[styleName] = value;
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

function defaultValueMapper(_scope: Scope, value: string): string {
	return value;
}

type PropertiesCollection<Props extends string[]> = { readonly [K in keyof Props]: [Props[K], string] };
type PropertiesMapper<Properties extends string[]> = (scope: Scope, value: string) => PropertiesCollection<Properties>;

function nullMapper(): PropertiesCollection<[]> {
	return [];
}

function createPassThroughMapper<
	const Destination extends string,
	const Mapper extends (scope: Scope, ...args: any[]) => string
>(
	destinationValue: Destination,
	valueMapper?: Mapper,
): PropertiesMapper<[Destination]> {
	return function <const Param extends string>(scope: Scope, value: Param): PropertiesCollection<[Destination]> {
		return [[destinationValue, (valueMapper || defaultValueMapper)(scope, value)]];
	};
}

const TTML_CSS_ATTRIBUTES_MAP = {
	"tts:backgroundClip": createPassThroughMapper("background-clip"),
	"tts:backgroundColor": createPassThroughMapper("background-color"),
	"tts:backgroundExtent": createPassThroughMapper("background-size"),
	"tts:backgroundImage": createPassThroughMapper("background-image"),
	"tts:backgroundOrigin": createPassThroughMapper("background-origin"),
	"tts:backgroundPosition": createPassThroughMapper("background-position"),
	"tts:backgroundRepeat": createPassThroughMapper("background-repeat", backgroundRepeatValueMapper),
	"tts:border": createPassThroughMapper("border"),
	// not known
	"tts:bpd": nullMapper,
	"tts:color": createPassThroughMapper("color"),
	"tts:direction": createPassThroughMapper("direction"),
	// ttml-only
	"tts:disparity": nullMapper,
	"tts:display": createPassThroughMapper("display"),
	"tts:displayAlign": createPassThroughMapper("justify-content", displayAlignValueMapper),
	// Maps to two CSS. We handle this in a different way
	"tts:extent": nullMapper,
	"tts:fontFamily": createPassThroughMapper("font-family"),
	"tts:fontKerning": createPassThroughMapper("font-kerning"),
	// No CSS equivalent
	"tts:fontSelectionStrategy": nullMapper,
	// Maps to CSS values. Must be handled differently
	"tts:fontShear": nullMapper,
	"tts:fontSize": createPassThroughMapper("font-size", fontSizeValueMapper),
	"tts:fontStyle": createPassThroughMapper("font-style"),
	"tts:fontVariant": nullMapper, // Maps to multiple values. Must be handled differently
	"tts:fontWeight": createPassThroughMapper("font-weight"),
	"tts:ipd": nullMapper, // ???????
	"tts:letterSpacing": createPassThroughMapper("letter-spacing"),
	"tts:lineHeight": createPassThroughMapper("line-height"),
	// Maps to CSS values. Must be handled differently
	"tts:lineShear": nullMapper,
	// ttml only
	"tts:luminanceGain": nullMapper,
	"tts:opacity": createPassThroughMapper("opacity"),
	"tts:origin": nullMapper, // no css
	"tts:overflow": createPassThroughMapper("overflow"),
	"tts:padding": createPassThroughMapper("padding", paddingValueMapper),
	"tts:position": createPassThroughMapper("background-position"),
	"tts:ruby": nullMapper,
	"tts:rubyAlign": createPassThroughMapper("ruby-align"),
	"tts:rubyPosition": createPassThroughMapper("ruby-position"),
	"tts:rubyReserve": nullMapper,
	"tts:shear": nullMapper,
	"tts:showBackground": nullMapper,
	"tts:textAlign": createPassThroughMapper("text-align"),
	"tts:textCombine": createPassThroughMapper("text-combine-upright"),
	"tts:textDecoration": createPassThroughMapper("text-combine-upright", textDecorationValueMapper),
	"tts:textEmphasis": createPassThroughMapper("tts:textEmphasis"),
	"tts:textOrientation": createPassThroughMapper("text-orientation", textOrientationValueMapper),
	"tts:textOutline": createPassThroughMapper("outline"),
	"tts:textShadow": createPassThroughMapper("text-shadow"),
	"tts:unicodeBidi": createPassThroughMapper("unicode-bidi"),
	"tts:visibility": createPassThroughMapper("visibility"),
	// XLFO, not a direct mapping with CSS. Can use remap it somehow without impacting renderer?
	"tts:wrapOption": nullMapper,
	// Writing mode impacts rendering, so we must first verify nothing will break on that
	"tts:writingMode": nullMapper,
	// valid CSS, but it won't be used until we won't paint on a new layer or an absolute element...
	"tts:zIndex": nullMapper,
} as const;

type TTML_CSS_ATTRIBUTES_MAP = typeof TTML_CSS_ATTRIBUTES_MAP;

type GetCollectionKeys<Collection extends PropertiesCollection<string[]>> = Collection[number][0];

type SupportedCSSProperties = {
	-readonly [K in keyof TTML_CSS_ATTRIBUTES_MAP as GetCollectionKeys<ReturnType<TTML_CSS_ATTRIBUTES_MAP[K]>>]?: string
}

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

		const mapped = TTML_CSS_ATTRIBUTES_MAP[key](scope, value);

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
 * However, resetting a is a difficult matter, as it requires
 * creating a span and setting it to have `display: inline-block`.
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

function textOrientationValueMapper(_scope: Scope, value: string): "sideways" | "mixed" | "upright" | undefined {
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
	const { attributes: { "ttp:cellResolution": [, cellResolutionHeight], "tts:extent": [exHeight] }} = readScopeDocumentContext(scope);

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
		const { attributes: { "ttp:cellResolution": [, cellResolutionHeight], "tts:extent": [exHeight] }} = readScopeDocumentContext(scope);

		return createLength(
			getCellScalarPixelConversion(exHeight, cellResolutionHeight, length),
			"px"
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
		getCellScalarPixelConversion(
			dimension,
			cellResolutionDimension,
			createLength(1, "c")
		),
		"px"
	);
}
