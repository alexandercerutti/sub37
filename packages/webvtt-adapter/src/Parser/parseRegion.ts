import type { Region } from "@sub37/server";

/**
 * @param rawRegionData
 */

export function parseRegion(rawRegionData: string): Region {
	const region = new WebVTTRegion();
	const attributes = rawRegionData.split(/[\n\t\s]+/);

	for (let i = 0; i < attributes.length; i++) {
		const [key, value] = attributes[i].split(":") as [keyof WebVTTRegion, string];

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

			case "lines":
			case "width": {
				region[key] = parseInt(value);
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

class WebVTTRegion implements Region {
	public id: string;
	/**
	 * Region width expressed in percentage
	 */
	public width: number = 100;
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

		const [regionAnchorWidth = 0, regionAnchorHeight = 0] = this.regionanchor || [];
		const [viewportAnchorWidth = 0, viewportAnchorHeight = 0] = this.viewportanchor || [];

		/**
		 * It is still not very clear to me why we base on current width and height, but
		 * a thing that I know is that we need low numbers.
		 */

		const leftOffset = (regionAnchorWidth * this.width) / 100;
		const topOffset = (regionAnchorHeight * height) / 100;

		const originX = `${viewportAnchorWidth - leftOffset}%`;
		const originY = `${viewportAnchorHeight - topOffset}%`;

		return [originX, originY];
	}
}
