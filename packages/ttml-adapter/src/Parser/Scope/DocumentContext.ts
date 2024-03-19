import type { Context, ContextFactory, Scope } from "./Scope";
import type { TimeDetails } from "../TimeBase/index.js";

const documentContextSymbol = Symbol("document");

export interface DocumentAttributes extends TimeDetails {
	"ttp:displayAspectRatio"?: number[];
	"ttp:pixelAspectRatio"?: number[];
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
	const frameRate = getFrameRateResolvedValue(attributes["ttp:frameRate"]);
	const subFrameRate = getFrameRateResolvedValue(attributes["ttp:subFrameRate"]);
	const tickRate = getTickRateResolvedValue(attributes["ttp:tickRate"], frameRate, subFrameRate);

	const extent = getLinearWhitespaceValuesAsNumbers(attributes["tts:extent"]);

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

		/**
		 * Container attributes
		 */
		"ttp:displayAspectRatio": getLinearWhitespaceValuesAsNumbers(
			attributes["ttp:displayAspectRatio"],
		),
		"ttp:pixelAspectRatio": getPixelAspectRatio(
			getLinearWhitespaceValuesAsNumbers(attributes["ttp:pixelAspectRatio"]),
			extent,
		),
		"tts:extent": extent,
	} satisfies DocumentAttributes);
}

function getLinearWhitespaceValuesAsNumbers(rawValue: string | undefined): number[] {
	if (!rawValue?.length) {
		return [];
	}

	return rawValue.split("\x20").map((e) => parseFloat(e));
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

	const parsed = getLinearWhitespaceValuesAsNumbers(frameRateMultiplier);

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
