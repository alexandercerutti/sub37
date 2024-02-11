/**
 * BRING YOUR OWN REGION.
 * Each adapter should be able to define the properties
 * in the structure, but letting us to use them
 * through a common interface.
 */

export interface Region {
	id: string;
	width: number;
	lines: number;

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
