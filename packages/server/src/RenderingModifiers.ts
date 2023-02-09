/**
 * BRING YOUR OWN RENDERING MODIFIER.
 * Each adapter should be able to define the properties
 * in the structure, but letting us to use them
 * through a common interface.
 */

export interface RenderingModifiers {
	width: number;

	leftOffset: number;

	textAlignment: "start" | "left" | "center" | "right" | "end";

	regionIdentifier?: string;
}
