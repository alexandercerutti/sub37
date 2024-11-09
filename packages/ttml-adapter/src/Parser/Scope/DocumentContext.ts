import type { Context, ContextFactory, Scope } from "./Scope";
import type { TimeDetails } from "../TimeBase/index.js";
import { getSplittedLinearWhitespaceValues } from "../Units/lwsp.js";
import { asNumbers, preventZeros } from "../Units/number.js";

const documentContextSymbol = Symbol("document");

export interface DocumentAttributes extends TimeDetails {
	"ttp:displayAspectRatio"?: number[];
	"ttp:pixelAspectRatio"?: number[];
	"ttp:cellResolution"?: number[];
	"tts:extent"?: number[];
}

interface DocumentContext extends Context<DocumentContext> {
	attributes: DocumentAttributes;
}

export function createDocumentContext(
	rawAttributes: Record<string, string>,
): ContextFactory<DocumentContext> {
	return function (scope: Scope) {
		const previousDocumentContext = readScopeDocumentContext(scope);

		if (previousDocumentContext) {
			throw new Error(
				"A document context is already existing. One document context is allowed per time",
			);
		}

		const attributes = parseDocumentSupportedAttributes(rawAttributes);

		/**
		 * tts:extent on tt right now is not supported.
		 *
		 * Although it can only have as values "auto", "contain",
		 * or "<length>px <length>px" (or "auto auto"), that would
		 * imply we can resize our rendering area, which we are not
		 * yet able to because adapters do not communicate any
		 * "document details" to the renderer, such how much wide
		 * should be the rendering area.
		 *
		 * If ever we'll be able to do that, we'll add a new style
		 * context to the scope like this:
		 *
		 * ```js
		 * if (attributes["tts:extent"]) {
		 * 	scope.addContext(
		 * 		createStyleContext({
		 * 			"tts:extent": rawAttributes["tts:extent"],
		 * 		}),
		 * 	);
		 * }
		 * ```
		 */

		return {
			parent: undefined,
			identifier: documentContextSymbol,
			mergeWith(context) {
				throw new Error(
					"Document context merge is not allowed. Only one document context can exists at the same time.",
				);
			},
			attributes,
		};
	};
}

export function readScopeDocumentContext(scope: Scope): DocumentContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(documentContextSymbol))) {
		return undefined;
	}

	return context as DocumentContext;
}

function parseDocumentSupportedAttributes(
	attributes: Record<string, string>,
): Readonly<DocumentAttributes> {
	/**
	 * "If not specified, the frame rate must be considered
	 * to be equal to some application defined frame rate,
	 * or if no application defined frame rate applies,
	 * then thirty (30) frames per second.
	 *
	 * If specified, then the frame rate must be greater
	 * than zero (0)."
	 *
	 * @see https://w3c.github.io/ttml2/#parameter-attribute-frameRate
	 *
	 * Application is not allowed to specify a custom fallback value (yet?).
	 */
	const frameRate = getFrameRateResolvedValue(attributes["ttp:frameRate"]);

	/**
	 * "If not specified, the sub-frame rate must be considered
	 * to be equal to some application defined sub-frame rate,
	 * or if no application defined sub-frame rate applies, then one (1).
	 * If specified, then the sub-frame rate must be greater than zero (0)"
	 *
	 * @see https://w3c.github.io/ttml2/#parameter-attribute-subFrameRate
	 *
	 * Application is not allowed to specify a custom fallback value (yet?).
	 */
	const subFrameRate = getFrameRateResolvedValue(attributes["ttp:subFrameRate"]);

	const tickRate = getTickRateResolvedValue(attributes["ttp:tickRate"], frameRate, subFrameRate);

	const extent = asNumbers(getSplittedLinearWhitespaceValues(attributes["tts:extent"]));

	return Object.freeze({
		/**
		 * Time Attributes
		 */
		"ttp:dropMode": getDropModeResolvedValue(attributes["ttp:dropMode"]),
		"ttp:frameRate": frameRate || 30,
		"ttp:subFrameRate": subFrameRate || 1,
		"ttp:frameRateMultiplier": getFrameRateMultiplerResolvedValue(
			attributes["ttp:frameRateMultiplier"],
		),
		"ttp:tickRate": tickRate,
		"ttp:timeBase": getTimeBaseResolvedValue(attributes["ttp:timeBase"]),
		"ttp:markerMode": getMarkerModeResolvedValue(attributes["ttp:markerMode"]),

		/**
		 * Container attributes
		 */
		"ttp:displayAspectRatio": asNumbers(
			getSplittedLinearWhitespaceValues(attributes["ttp:displayAspectRatio"]),
		),
		"ttp:pixelAspectRatio": getPixelAspectRatio(
			asNumbers(getSplittedLinearWhitespaceValues(attributes["ttp:pixelAspectRatio"])),
			extent,
		),
		"ttp:cellResolution": getCellResolutionComputedValue(attributes["ttp:cellResolution"]),
		"tts:extent": extent,
	} satisfies DocumentAttributes);
}

/**
 * Having pixelAspectRatio without an extents is a standard
 * deprecated behavior.
 *
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-pixelAspectRatio
 *
 * Any undefined result of the function here, brings us
 * to a different Aspect Ration calculation procedure.
 *
 * @param values
 * @param extent
 * @returns
 */

function getPixelAspectRatio(values: number[], extent?: number[]): [number, number] | undefined {
	if (!values || values.length < 2 || !extent) {
		return undefined;
	}

	const [numerator, denominator] = values;

	if (!numerator || !denominator) {
		return undefined;
	}

	return [numerator, denominator];
}

function getDropModeResolvedValue(dropMode: string): DocumentAttributes["ttp:dropMode"] {
	if (!dropMode) {
		return "nonDrop";
	}

	const dropModes: ReadonlyArray<DocumentAttributes["ttp:dropMode"]> = [
		"dropNTSC",
		"dropPAL",
		"nonDrop",
	];

	return dropModes.find((e) => e === dropMode) ?? "nonDrop";
}

function getFrameRateResolvedValue(
	frameRate: string,
): DocumentAttributes["ttp:frameRate"] | undefined {
	const parsed = parseFloat(frameRate);

	if (Number.isNaN(parsed) || parsed <= 0) {
		return undefined;
	}

	return parsed;
}

function getFrameRateMultiplerResolvedValue(
	frameRateMultiplier: string | undefined,
): DocumentAttributes["ttp:frameRateMultiplier"] {
	if (!frameRateMultiplier) {
		return 1;
	}

	const parsed = asNumbers(getSplittedLinearWhitespaceValues(frameRateMultiplier));

	if (parsed.length < 2) {
		return 1;
	}

	const [numerator, denominator] = parsed;

	if (Number.isNaN(numerator)) {
		return 1;
	}

	if (Number.isNaN(denominator)) {
		/** Like `parsed[0] / 1` **/
		return numerator;
	}

	return numerator / denominator;
}

function getTickRateResolvedValue(
	tickRate: string,
	frameRate: number,
	subFrameRate: number,
): DocumentAttributes["ttp:tickRate"] {
	if (!tickRate) {
		return (frameRate ?? 0) * (subFrameRate ?? 1) || 1;
	}

	return parseFloat(tickRate);
}

function getTimeBaseResolvedValue(timeBase: string): DocumentAttributes["ttp:timeBase"] {
	const dropModes: ReadonlyArray<DocumentAttributes["ttp:timeBase"]> = ["media", "clock", "smpte"];

	return dropModes.find((e) => e === timeBase) ?? "media";
}

/**
 * It is not assumed that the presentation of text or
 * the alignment of individual glyph areas is coordinated
 * with this grid.
 *
 * Such alignment is possible, but requires the use of a
 * monospaced font and a font size whose EM square exactly
 * matches the cell size.
 *
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-cellResolution
 * @param resolutionString
 * @returns
 */

function getCellResolutionComputedValue(
	resolutionString: string,
): DocumentAttributes["ttp:cellResolution"] {
	const DEFAULTS = [32, 15];

	if (!resolutionString?.length) {
		/**
		 * If not specified, the number of columns and rows must be considered
		 * to be 32 and 15, respectively.
		 *
		 * The choice of values 32 and 15 are based on this being the maximum
		 * number of columns and rows defined by [CTA-608-E].
		 *
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#cta608e
		 */
		return DEFAULTS;
	}

	let splittedValues = preventZeros(
		asNumbers(getSplittedLinearWhitespaceValues(resolutionString)),
		DEFAULTS,
	);

	if (splittedValues.length === 1) {
		splittedValues = [splittedValues[0], splittedValues[0]];
	}

	return splittedValues;
}

function getMarkerModeResolvedValue(markerMode: string): DocumentAttributes["ttp:markerMode"] {
	if (markerMode === "continuous" || markerMode === "discontinuous") {
		return markerMode;
	}	
	
	return "discontinuous";
}