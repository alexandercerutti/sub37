import type { Entities, Region } from "@sub37/adapter-utils";

/**
 * @param rawRegionData
 */

export function parseRegion(rawRegionData: string | undefined): WebVTTRegion | undefined {
	if (!rawRegionData) {
		return undefined;
	}

	const region = new WebVTTRegion();
	const attributes = rawRegionData.split(/[\n\t\s]+/);

	for (let i = 0; i < attributes.length; i++) {
		const [key, value] = attributes[i]!.split(":") as [keyof WebVTTRegion, string];

		if (!value || !key) {
			continue;
		}

		switch (key) {
			case "regionanchor":
			case "viewportanchor": {
				const [x = "0%", y = "0%"] = value.split(",");

				if (!x.endsWith("%") || !y.endsWith("%")) {
					break;
				}

				const xInteger = parseInt(x);
				const yInteger = parseInt(y);

				if (Number.isNaN(xInteger) || Number.isNaN(yInteger)) {
					break;
				}

				const clampedX = Math.max(0, Math.min(xInteger, 100));
				const clampedY = Math.max(0, Math.min(yInteger, 100));

				region[key] = [clampedX, clampedY];
				break;
			}

			case "scroll": {
				if (value !== "up" && value !== "none") {
					break;
				}

				region[key] = value;
				break;
			}

			case "id": {
				region[key] = value;
				break;
			}

			case "lines": {
				region[key] = parseInt(value);
				break;
			}

			case "width": {
				region[key] = `${parseInt(value)}%`;
				break;
			}

			default:
				break;
		}
	}

	if (!region.id) {
		return undefined;
	}

	return region;
}

/**
 * One line's height in VH units.
 * This probably assumes that each line in renderer is
 * of the same height. So this might lead to some issues
 * in the future.
 *
 * I still don't have clear why Chrome does have this
 * constant while all the standard version of VTT standard
 * says "6vh".
 *
 * @see https://github.com/chromium/chromium/blob/c4d3c31083a2e1481253ff2d24298a1dfe19c754/third_party/blink/renderer/core/html/track/vtt/vtt_region.cc#L70
 * @see https://www.w3.org/TR/webvtt1/#processing-model
 */

const VH_LINE_HEIGHT = 5.33;

const DEFAULT_VIEWPORT_ANCHOR_X = 0;
const DEFAULT_VIEWPORT_ANCHOR_Y = 100;

const DEFAULT_REGION_ANCHOR_X = 0;
const DEFAULT_REGION_ANCHOR_Y = 100;

export class WebVTTRegion implements Region {
	public id: string = "";

	public entities: Entities.AllEntities[] = [];

	/**
	 * Region width expressed in percentage
	 */
	public width: string = "100%";
	public lines: number = 3;
	public scroll?: "up" | "none";

	/**
	 * Position of region based on video region.
	 * Couple of numbers expressed in percentage
	 */
	public viewportanchor?: [number, number];

	/**
	 * Position of region based on viewportAnchor
	 * Couple of numbers expressed in percentage
	 */
	public regionanchor?: [number, number];

	public getOrigin(): [x: string, y: string] {
		const height = VH_LINE_HEIGHT * this.lines;

		/**
		 * §4.3
		 * > If no WebVTT region anchor setting is given, the anchor defaults to 0%, 100%
		 * > (i.e. the bottom left corner).
		 *
		 * and
		 *
		 * > If no region viewport anchor is given, it defaults to 0%, 100%
		 * > (i.e. the bottom left corner of the video viewport).
		 */
		const [
			regionAnchorWidth = DEFAULT_REGION_ANCHOR_X,
			regionAnchorHeight = DEFAULT_REGION_ANCHOR_Y,
		] = this.regionanchor || [];

		const [
			viewportAnchorWidth = DEFAULT_VIEWPORT_ANCHOR_X,
			viewportAnchorHeight = DEFAULT_VIEWPORT_ANCHOR_Y,
		] = this.viewportanchor || [];

		/**
		 * It is still not very clear to me why we base on current width and height, but
		 * a thing that I know is that we need low numbers.
		 */

		const leftOffset = (regionAnchorWidth * parseFloat(this.width)) / 100;
		const topOffset = (regionAnchorHeight * height) / 100;

		const originX = `${viewportAnchorWidth - leftOffset}%`;
		const originY = `${viewportAnchorHeight - topOffset}%`;

		return [originX, originY];
	}
}

export function deriveRegionFromCueSettings(
	region: WebVTTRegion | undefined,
	cueSettings: Record<string, string>,
): Region | undefined {
	const derivedRegion = new WebVTTRegion();

	/**
	 * CueBox size expressed in percentage.
	 */
	let size: number = 100;

	if (cueSettings["size"] && cueSettings["size"].endsWith("%")) {
		const integerSize = parseInt(cueSettings["size"]) || NaN;

		if (!Number.isNaN(integerSize)) {
			size = Math.min(Math.max(0, integerSize), 100);
		}
	}

	let textAlignment: TextAlignment = "center";

	if (cueSettings["align"] && isTextAlignmentStandard(cueSettings["align"])) {
		textAlignment = cueSettings["align"];
	}

	const [position, positionAlignment] = getPositionAndAlignmentFromCueSettings(
		cueSettings,
		textAlignment,
	);

	const regionWidth = getRegionWidthByComputedCueSettings(position, positionAlignment, size);
	const regionLeftOffset = getRegionLeftOffsetByComputedCueSettings(position, positionAlignment);

	derivedRegion.width =
		typeof regionWidth === "number" ? `${regionWidth}%` : region?.width || "100%";

	derivedRegion.viewportanchor = [
		regionLeftOffset ?? region?.viewportanchor?.[0] ?? DEFAULT_VIEWPORT_ANCHOR_X,
		region?.viewportanchor?.[1] ?? DEFAULT_VIEWPORT_ANCHOR_Y,
	];

	derivedRegion.id = `derived:${region?.id ?? "default"}:${Math.floor(Math.random() * (500 - 100) + 100)}`;
	derivedRegion.lines = region?.lines ?? derivedRegion.lines;
	derivedRegion.scroll = region?.scroll ?? derivedRegion.scroll;
	derivedRegion.regionanchor = region?.regionanchor ?? derivedRegion.regionanchor;
	derivedRegion.entities = region?.entities ?? [];

	return derivedRegion;
}

/**
 * @see https://www.w3.org/TR/webvtt1/#webvtt-cue-position
 */

function getPositionAndAlignmentFromCueSettings(
	cueSettings: Record<string, string>,
	computedTextAlignment: TextAlignment,
): [number, PositionAlignment] {
	const position = cueSettings["position"] || "auto";

	let positionAlignment: PositionAlignment | "auto" = "auto";

	/** e.g. position:30%,line-left */
	const [pos, posAlignment] = position.split(",");

	if (isPositionAlignmentStandard(posAlignment)) {
		positionAlignment = posAlignment;
	} else {
		positionAlignment = inferPositionAlignmentByTextAlignment(computedTextAlignment);
	}

	if (!pos || pos === "auto") {
		switch (computedTextAlignment) {
			case "left": {
				return [0, positionAlignment];
			}

			case "right": {
				return [100, positionAlignment];
			}

			default: {
				return [50, positionAlignment];
			}
		}
	}

	const integerPosition = (pos.endsWith("%") && parseInt(pos)) || NaN;

	if (!Number.isNaN(integerPosition)) {
		return [Math.min(Math.max(0, integerPosition), 100), positionAlignment];
	}

	return [0, positionAlignment];
}

function inferPositionAlignmentByTextAlignment(textAlignment: TextAlignment): PositionAlignment {
	switch (textAlignment) {
		case "left": {
			return "line-left";
		}

		case "right": {
			return "line-right";
		}

		case "center": {
			return "center";
		}

		case "start":
		case "end": {
			/**
			 * @TODO to implement based on base direction
			 * base direction is detected with
			 *
			 * U+200E LEFT-TO-RIGHT MARK   ---> start: "line-left", end: "line-right"
			 * U+200F RIGHT-TO-LEFT MARK   ---> start: "line-right", end: "line-left"
			 */

			return "line-left";
		}
	}

	return "line-left";
}

type PositionAlignment = "line-left" | "center" | "line-right";

function isPositionAlignmentStandard(
	alignment: string | undefined,
): alignment is PositionAlignment {
	return ["line-left", "center", "line-right"].includes(alignment as PositionAlignment);
}

type TextAlignment = "start" | "left" | "center" | "right" | "end";

export function isTextAlignmentStandard(alignment: string | undefined): alignment is TextAlignment {
	return ["start", "left", "center", "right", "end"].includes(alignment as TextAlignment);
}

/**
 * Width, and hence cuebox left offset, calculation is
 * highly influenced by the alignment.
 *
 * In fact, we need to apply different formulas based on
 * the point we start and the direction we want to proceed.
 *
 * In the same way, also leftOffset is influenced by alignment
 * and highly tied to width.
 */

function getRegionWidthByComputedCueSettings(
	position: number,
	positionAlignment: PositionAlignment,
	size: number,
): number | undefined {
	switch (positionAlignment) {
		case "line-left": {
			/**
			 * Cuebox's left edge matches at position
			 * point and ends at 100%.
			 *
			 * @example scheme, 60%
			 * Calculation starts from right edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |                             |----|----|----|----|
			 * |         Left Offset         |    |--te|xt--|    |
			 * |                             |----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			return Math.min(size, 100 - position);
		}

		case "center": {
			/**
			 * Cuebox center matches the position point
			 * and spans in both direction.
			 *
			 * Based on the position point, we need to change
			 * the formula to begin calculating the width
			 * starting from one edge or the other.
			 *
			 * @example scheme, point < 50%
			 * Calculation start from left edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |              |                                  |
			 * |----|----|----|----|----|----|                   |
			 * |         |--te|xt--|         |                   |
			 * |----|----|----|----|----|----|                   |
			 * |              |                                  |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			if (position <= 50) {
				return Math.min(size, position * 2);
			}

			/**
			 * @example scheme, point > 50%
			 * Calculation starts from right edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |  Left   |----|----|----|----|----|----|----|----|
			 * |    -    |              |--te|xt--|              |
			 * |  Offset |----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			return Math.min(size, (100 - position) * 2);
		}

		case "line-right": {
			/**
			 * Cuebox's right edge matches the position point
			 * and spans the available space on the left
			 * (to 0%)
			 *
			 * @example scheme, 60%
			 * Calculation starts from left edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|                   |
			 * |         |--te|xt--|         |                   |
			 * |----|----|----|----|----|----|                   |
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			return Math.min(size, position);
		}
	}
}

/**
 * Width, and hence cuebox left offset, calculation is
 * highly influenced by the alignment.
 *
 * In fact, we need to apply different formulas based on
 * the point we start and the direction we want to proceed.
 *
 * In the same way, also leftOffset is influenced by alignment
 * and highly tied to width.
 */
function getRegionLeftOffsetByComputedCueSettings(
	position: number,
	positionAlignment: PositionAlignment,
): number | undefined {
	switch (positionAlignment) {
		case "line-left": {
			/**
			 * Cuebox's left edge matches at position
			 * point and ends at 100%.
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |                             |----|----|----|----|
			 * |         Left Offset         |    |--te|xt--|    |
			 * |                             |----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			return position;
		}

		case "center": {
			/**
			 * Cuebox center matches the position point
			 * and spans in both direction.
			 *
			 * Based on the position point, we need to change
			 * the formula to begin calculating the width,
			 * and hence the leftOffset, starting from one
			 * edge or the other.
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |              |                                  |
			 * |----|----|----|----|----|----|                   |
			 * |         |--te|xt--|         |                   |
			 * |----|----|----|----|----|----|                   |
			 * |              |                                  |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			if (position <= 50) {
				return 0;
			}

			/**
			 * @example scheme, point > 50%
			 * Calculation starts from right edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |  Left   |----|----|----|----|----|----|----|----|
			 * |    -    |              |--te|xt--|              |
			 * |  Offset |----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			const width = (100 - position) * 2;
			return 100 - width;
		}

		case "line-right": {
			/**
			 * Cuebox's right edge matches the position point
			 * and spans the available space on the left
			 * (to 0%)
			 *
			 * @example scheme, 60%
			 * Calculation starts from left edge
			 *
			 * 0%  10%  20%  30%  40%  50%  60%  70%  80%  90%  100%
			 * |----|----|----|----|----|----|----|----|----|----|
			 * |                             |                   |
			 * |----|----|----|----|----|----|                   |
			 * |         |--te|xt--|         |                   |
			 * |----|----|----|----|----|----|                   |
			 * |                             |                   |
			 * |----|----|----|----|----|----|----|----|----|----|
			 */

			return 0;
		}
	}
}
