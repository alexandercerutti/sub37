import type { NodeWithScope } from "../../Adapter.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onMergeSymbol } from "./Scope.js";
import type { TimeDetails } from "../TimeBase/index.js";
import { getSplittedLinearWhitespaceValues } from "../lwsp.js";
import type { NodeTree, NodeWithRelationship } from "../Tags/NodeTree.js";
import type { Token } from "../Token.js";
import { resolveStyleDefinitionByName } from "../parseStyle.js";
import { parseAttributeValue } from "../grammar/parseAttributeValue.js";
import { isPixelScalar } from "../namespaces/tts/primitives/pixel.js";
import type { PixelScalar } from "../namespaces/tts/primitives/pixel.js";
import { readScopeErrorContext } from "./ErrorContext.js";

const documentContextSymbol = Symbol("document");

export interface DocumentAttributes extends TimeDetails {
	"ttp:displayAspectRatio": number[];
	"ttp:cellResolution": [number, number];
	"ttp:pixelAspectRatio"?: number[];
	"tts:extent"?: [PixelScalar, PixelScalar];
}

interface DocumentContext extends Context<DocumentContext, Record<string, string>> {
	attributes: DocumentAttributes;
	get currentNode(): NodeWithRelationship<Token & NodeWithScope>;
}

declare module "./Scope" {
	interface ContextDictionary {
		[documentContextSymbol]: DocumentContext;
	}
}

/**
 * @param nodeTree
 *	 > For the purpose of determining inherited styles, the element
 *	 > hierarchy of an intermediate synchronic document form of a
 *	 > document instance must" be used, where such intermediate forms
 *	 > are defined by 11.3.1.3 Intermediate Synchronic Document Construction."
 *
 * @param rawAttributes Attributes from the <tt> element
 */

export function createDocumentContext(
	nodeTree: NodeTree<Token & NodeWithScope>,
	rawAttributes: Record<string, string>,
): ContextFactory<DocumentContext> {
	return function (scope: Scope) {
		if (typeof rawAttributes["xml:lang"] === "undefined") {
			throw new Error(
				"Document failed to parse: <tt> element is lacking of 'xml:lang' attribute. The attribute is required, even if empty.",
			);
		}

		const attributes = parseDocumentSupportedAttributes(rawAttributes, scope);

		return {
			parent: undefined,
			identifier: documentContextSymbol,
			get args() {
				return rawAttributes;
			},
			[onMergeSymbol](_incomingContext) {
				throw new Error(
					"A document context is already existing. One document (context) can exists per TTML track. Merging is not allowed",
				);
			},
			attributes,
			get currentNode(): NodeWithRelationship<Token & NodeWithScope> {
				return nodeTree.currentNode;
			},
		};
	};
}

export function readScopeDocumentContext(scope: Scope): DocumentContext | undefined {
	return scope.getContextByIdentifier(documentContextSymbol);
}

function parseDocumentSupportedAttributes(
	attributes: Record<string, string>,
	scope: Scope,
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

	const extent = getDocumentExtentResolvedValue(attributes["tts:extent"], scope);

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
		"ttp:displayAspectRatio":
			asNumbers(getSplittedLinearWhitespaceValues(attributes["ttp:displayAspectRatio"])) || 1,
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

function getPixelAspectRatio(
	values: number[],
	extent?: [PixelScalar, PixelScalar] | undefined,
): [number, number] | undefined {
	if (!values || values.length < 2 || !extent) {
		return undefined;
	}

	const [numerator, denominator] = values;

	if (!numerator || !denominator) {
		return undefined;
	}

	return [numerator, denominator];
}

function getDropModeResolvedValue(
	dropMode: string | undefined,
): DocumentAttributes["ttp:dropMode"] {
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
	frameRate: string | undefined,
): DocumentAttributes["ttp:frameRate"] {
	if (!frameRate) {
		return 1;
	}

	const parsed = parseFloat(frameRate);

	if (Number.isNaN(parsed) || parsed <= 0) {
		return 1;
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

	if (typeof numerator !== "number" || Number.isNaN(numerator)) {
		return 1;
	}

	if (typeof denominator !== "number" || Number.isNaN(denominator)) {
		/** Like `parsed[0] / 1` **/
		return numerator;
	}

	return numerator / denominator;
}

function getTickRateResolvedValue(
	tickRate: string | undefined,
	frameRate: number | undefined,
	subFrameRate: number | undefined,
): DocumentAttributes["ttp:tickRate"] {
	if (!tickRate) {
		return (frameRate ?? 0) * (subFrameRate ?? 1) || 1;
	}

	return parseFloat(tickRate);
}

function getTimeBaseResolvedValue(
	timeBase: string | undefined,
): DocumentAttributes["ttp:timeBase"] {
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
	resolutionString: string | undefined,
): DocumentAttributes["ttp:cellResolution"] {
	const DEFAULTS: [columns: number, rows: number] = [32, 15];

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

	const parsedValues = asNumbers(getSplittedLinearWhitespaceValues(resolutionString)) as [
		columns: number,
		rows: number,
	];

	return [
		// Negative values are not specified by the standard, but
		// it sounds logical to prevent them.
		parsedValues[0] < 1 ? DEFAULTS[0] : parsedValues[0],
		parsedValues[1] < 1 ? DEFAULTS[1] : parsedValues[1],
	];
}

function getMarkerModeResolvedValue(
	markerMode: string | undefined,
): DocumentAttributes["ttp:markerMode"] {
	if (markerMode === "continuous" || markerMode === "discontinuous") {
		return markerMode;
	}

	return "discontinuous";
}

function asNumbers(values: string[]): number[] {
	return values.map((e) => parseFloat(e));
}
/**
 * `tts:extent` applied to the root container (the <tt> element) acts as a
 * canvas size indicator (the equivalent of viewbox in SVG) and it is used
 * to determine the storage aspect ratio.
 *
 * §10.2.16
 *
 * > If a tts:extent attribute is specified on the tt element,
 * > then the specified value is restricted to one of the following:
 * > (1) the auto keyword,
 * > (2) the contain keyword, or
 * > (3) two <length> specifications, where these specifications are
 * > expressed as non-percentage, definite lengths using pixel units.
 * >
 * > All other syntactically legal values must not be used in this
 * > context, and, if used, must be considered an error and must be
 * > ignored for the purpose of presentation processing, in which case
 * > the initial value (auto) applies.
 * >
 * > [...]
 * >
 * > If the value of this attribute is auto, then the computed value of
 * > its associated property is determined as follows:
 * >    if the property applies to the tt element, then auto is
 * >    interpreted as if the value contain were specified;
 * > [...]
 * > If the value of this attribute is contain, then the computed value
 * > of its associated property is determined as follows:
 * >  if the property applies to the tt element, then contain is interpreted
 * >  as specified in H Root Container Region Semantics;
 *
 * § H.1 Aspect Ratios
 *
 * > When the tts:extent attribute is specified on the tt element, then
 * >   if the value of the tts:extent attribute consists of two pixel-valued
 * >   <length> expressions, the storage aspect ratio is considered to be
 * >   specified and having a numeric value equal to the width of the extent
 * >   divided by its height;
 * >
 * >   otherwise (the computed value is contain), the storage aspect ratio is
 * >   considered to be unspecified and is inferred using other information
 * >   described below.
 *
 * @see https://w3c.github.io/ttml2/#root-container-region-semantics-aspect-ratios
 *
 * @param extent
 * @returns
 */

function getDocumentExtentResolvedValue(
	extent: string | undefined,
	scope: Scope,
): DocumentAttributes["tts:extent"] | undefined {
	if (!extent) {
		return undefined;
	}

	const Syntax = resolveStyleDefinitionByName("tts:extent")!.syntax;

	try {
		const parsedExtentValue = parseAttributeValue(Syntax, extent);

		if (
			parsedExtentValue.length !== 2 ||
			// These two shouldn't be possible by grammar definition
			parsedExtentValue[0] === undefined ||
			parsedExtentValue[1] === undefined
		) {
			return undefined;
		}

		const [first, second] = parsedExtentValue;

		/**
		 * This omits "auto" and "contain" keywords as well, since
		 * they mean to auto-compute the size based.
		 */
		if (first.type !== "length" || second.type !== "length") {
			return undefined;
		}

		if (!isPixelScalar(first.value) || !isPixelScalar(second.value)) {
			return undefined;
		}

		return [first.value, second.value];
	} catch (err) {
		const errorContext = readScopeErrorContext(scope)!;
		errorContext.report(err instanceof Error ? err : new Error(String(err)), false);

		return undefined;
	}
}
