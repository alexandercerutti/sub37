import type { AllEntities } from "./Entities/index.js";

/**
 * BRING YOUR OWN REGION.
 * Each adapter should be able to define the properties
 * in the structure, but letting us to use them
 * through a common interface.
 */

export interface Region {
	id: string;

	/**
	 * A length with unit (e.g. "100%", "192px", "10em").
	 * Number signature is deprecated.
	 */
	width: string | number;

	/**
	 * A length string with unit (e.g. "66px", "20%", "4.5em").
	 * When absent, height is derived from `lines` by the renderer.
	 * Number signature is deprecated.
	 */
	height?: string | number;

	lines: number;

	/**
	 * Entities to be directly applied directly to the region container.
	 */
	entities: AllEntities[];

	/**
	 * Allows each parser how to express
	 * the position of the region.
	 *
	 * @returns {[x: string | number, y: string | number]} coordinates with measure unit
	 */

	getOrigin(): [x: number | string, y: number | string];

	/**
	 * Allows each parser how to express
	 * the position of the region based on runtime data
	 *
	 * @param viewportWidth
	 * @param viewportHeight
	 */

	getOrigin(
		viewportWidth: number,
		viewportHeight: number,
	): [x: number | string, y: number | string];
}
