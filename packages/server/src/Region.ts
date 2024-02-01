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
	 * @returns {[x: string, y: string]} coordinates with measure unit
	 */

	getOrigin(): [x: string, y: string];

	/**
	 * Allows each parser how to express
	 * the position of the region based on runtime data
	 *
	 * @param viewportWidth
	 * @param viewportHeight
	 * @returns {[x: string, y: string]} coordinates with measure unit
	 */

	getOrigin(viewportWidth: number, viewportHeight: number): [x: string, y: string];
}
