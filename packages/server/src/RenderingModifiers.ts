/**
 * BRING YOUR OWN RENDERING MODIFIER.
 * Each adapter should be able to define the properties
 * in the structure, but letting us to use them
 * through a common interface.
 */

export interface RenderingModifiers {
	/**
	 * A unique id that uses the required props
	 * to allow us comparing two RenderingModifiers
	 * with some common properties, e.g. regionIdentifier
	 */
	id: number;

	width: number;

	leftOffset: number;

	textAlignment: "start" | "left" | "center" | "right" | "end";

	regionIdentifier?: string;
}
