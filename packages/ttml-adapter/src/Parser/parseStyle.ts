import type { Scope } from "./Scope/Scope.js";
import { memoizationFactory } from "./memoizationFactory";

type StyleAttributeString = `tts:${string}`;

export interface TTMLStyle {
	id: string;
	attributes: Record<StyleAttributeString, string>;
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
	let styleCache: Record<string, string> | undefined = undefined;

	const id = attributes["xml:id"] || `style-rdm:${Math.floor(Math.random() * 1000)}`;
	const attrs = extractStyleAttributes(attributes);

	if (!Object.keys(attrs).length) {
		return undefined;
	}

	if (!attributes["style"]) {
		styleCache = attrs;
	}

	const style = {
		id: resolveIDREFConflict(stylesIDREFSStorage, id),
		get attributes(): TTMLStyle["attributes"] {
			if (typeof styleCache !== "undefined") {
				return styleCache;
			}

			const parentStyle = stylesIDREFSStorage.get(attributes["style"]);

			if (!parentStyle) {
				styleCache = attrs;
				return styleCache;
			}

			styleCache = Object.create(attrs);

			for (const [styleName, value] of Object.entries(parentStyle.attributes)) {
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

	for (let attr in attributes) {
		if (!isStyleAttribute(attr)) {
			continue;
		}

		attrs[attr] = attributes[attr].replace("tts:", "");
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

function defaultValueMapper(value: string): string {
	return value;
}

type PropertiesCollection<Props extends string[]> = { readonly [K in keyof Props]: [Props[K], unknown] };
type PropertiesMapper<Properties extends string[]> = (value: string) => PropertiesCollection<Properties>;

function nullMapper(): PropertiesCollection<[]> {
	return [];
}

function createPassThroughMapper<const Destination extends string, const Mapper extends (...args: any[]) => unknown>(
	destinationValue: Destination,
	valueMapper?: Mapper,
): PropertiesMapper<[Destination]> {
	return function <const Param extends string>(value: Param): PropertiesCollection<[Destination]> {
		return [[destinationValue, (valueMapper || defaultValueMapper)(value)]];
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
	"tts:fontSize": createPassThroughMapper("font-size"),
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
	[K in keyof TTML_CSS_ATTRIBUTES_MAP as GetCollectionKeys<ReturnType<TTML_CSS_ATTRIBUTES_MAP[K]>>]: TTML_CSS_ATTRIBUTES_MAP[K] extends PropertiesMapper<infer Y> ? PropertiesCollection<Y> : never
}

function backgroundRepeatValueMapper(
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

function paddingValueMapper(value: string): string | undefined {
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

function textDecorationValueMapper(_value: string): string | undefined {
	// See note above
	return undefined;
}

function isTextOrientationSupportedCSSValue(
	value: string,
): value is "sideways" | "mixed" | "upright" {
	return ["sideways", "mixed", "upright"].includes(value);
}

function textOrientationValueMapper(value: string): "sideways" | "mixed" | "upright" | undefined {
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
