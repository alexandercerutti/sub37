import type { RenderingModifiers } from "@sub37/server";

// const GROWING_LEFT = "rl";
// type GROWING_LEFT = typeof GROWING_LEFT;

// const GROWING_RIGHT = "lr";
// type GROWING_RIGHT = typeof GROWING_RIGHT;

// const HORIZONTAL = "";
// type HORIZONTAL = typeof HORIZONTAL;

const ALIGNMENT_NUMBER_IDENTIFIERS = {
	start: 1,
	left: 2,
	center: 3,
	right: 4,
	end: 5,
} as const;

export class WebVTTRenderingModifiers implements RenderingModifiers {
	public static fromString(source: string | undefined): WebVTTRenderingModifiers {
		const modifier = new WebVTTRenderingModifiers();

		if (!source?.length) {
			return modifier;
		}

		const properties: Record<string, string> = source.split(" ").reduce((acc, curr) => {
			const [key, value] = curr.split(":");
			return (key && value && { ...acc, [key]: value }) || acc;
		}, {});

		let position: number | "auto" = "auto";
		let positionAlignment: WebVTTRenderingModifiers["positionAlignment"] | "auto" = "auto";

		for (const [key, value] of Object.entries(properties)) {
			switch (key) {
				case "position": {
					/** e.g. position:30%,line-left */
					const [pos, posAlignment] = value.split(",");

					if (isPositionAlignmentStandard(posAlignment)) {
						positionAlignment = posAlignment;
					}

					if (pos !== "auto") {
						const integerPosition = (pos.endsWith("%") && parseInt(pos)) || NaN;

						if (!Number.isNaN(integerPosition)) {
							position = Math.min(Math.max(0, integerPosition), 100);
						}
					}

					break;
				}

				/** e.g. align:center */
				case "align": {
					if (isTextAlignmentStandard(value)) {
						modifier.align = value;
					}

					break;
				}

				/** e.g. region:fred */
				case "region": {
					modifier.region = value;
					break;
				}

				/** e.g. size:80% */
				case "size": {
					const integerSize = (value.endsWith("%") && parseInt(value)) || NaN;

					if (!Number.isNaN(integerSize)) {
						modifier.size = Math.min(Math.max(0, integerSize), 100);
					}

					break;
				}

				// case "vertical": {
				// 	if (isVerticalStandard(value)) {
				// 		modifier.vertical = value;
				// 	}

				// 	break;
				// }
			}
		}

		// **************************************************** //
		// ***************** DEPENDENCY PHASE ***************** //
		// *** Some properties final value depend on others *** //
		// **************************************************** //

		/**
		 * @see https://www.w3.org/TR/webvtt1/#webvtt-cue-position
		 */

		if (position === "auto") {
			switch (modifier.align) {
				case "left": {
					modifier.position = 0;
					break;
				}

				case "right": {
					modifier.position = 100;
					break;
				}

				default: {
					modifier.position = 50;
				}
			}
		} else {
			modifier.position = position;
		}

		if (positionAlignment === "auto") {
			switch (modifier.align) {
				case "left": {
					modifier.positionAlignment = "line-left";
					break;
				}

				case "right": {
					modifier.positionAlignment = "line-right";
					break;
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

					break;
				}

				default: {
					modifier.positionAlignment = "center";
				}
			}
		} else {
			modifier.positionAlignment = positionAlignment;
		}

		return modifier;
	}

	private position?: number = 50;
	private positionAlignment?: "line-left" | "center" | "line-right" = "center";
	private align?: "start" | "left" | "center" | "right" | "end" = "center";
	private region?: string;

	/**
	 * @TODO support vertical in renderer
	 * along with a new property "writing mode"
	 */
	// private vertical?: HORIZONTAL | GROWING_LEFT | GROWING_RIGHT = HORIZONTAL;

	private size: number = 100;

	public get id(): number {
		return Math.abs(this.width + this.leftOffset - ALIGNMENT_NUMBER_IDENTIFIERS[this.align]);
	}

	public get width(): number {
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

		switch (this.positionAlignment) {
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

				return Math.min(this.size, 100 - this.position);
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

				if (this.position <= 50) {
					return Math.min(this.size, this.position * 2);
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

				return Math.min(this.size, (100 - this.position) * 2);
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

				return Math.min(this.size, this.position);
			}
		}
	}

	public get leftOffset(): number {
		/**
		 * Width, and hence cuebox left offset, calculation is
		 * highly influenced by the alignment.
		 * In fact, we need to apply different formulas based on
		 * the point we start and the direction we want to proceed.
		 *
		 * In the same way, also leftOffset is influenced by alignment
		 * and highly tied to width.
		 */

		switch (this.positionAlignment) {
			case "line-left": {
				/**
				 * Cuebox's left edge matches at position
				 * point and ends at 100%.
				 *
				 * For schemas, refer to width on "center" case.
				 */

				return this.position;
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
				 * For schemas, refer to width on "center" case.
				 */

				if (this.position <= 50) {
					return 0;
				}

				const width = (100 - this.position) * 2;
				return 100 - width;
			}

			case "line-right": {
				/**
				 * Cuebox's right edge matches the position point
				 * and spans the available space on the left
				 * (to 0%)
				 *
				 * For schemas, refer to width on "line-right" case.
				 */

				return 0;
			}
		}
	}

	public get textAlignment(): typeof this.align {
		return this.align;
	}

	public get regionIdentifier(): string {
		return this.region;
	}
}

function isPositionAlignmentStandard(
	alignment: string,
): alignment is "line-left" | "center" | "line-right" {
	return ["line-left", "center", "line-right"].includes(alignment);
}

function isTextAlignmentStandard(
	alignment: string,
): alignment is "start" | "left" | "center" | "right" | "end" {
	return ["start", "left", "center", "right", "end"].includes(alignment);
}

// function isVerticalStandard(
// 	vertical: string,
// ): vertical is HORIZONTAL | GROWING_LEFT | GROWING_RIGHT {
// 	return [HORIZONTAL, GROWING_LEFT, GROWING_RIGHT].includes(vertical);
// }
