import { length, NonNegativeConstraint } from "../structure/derivables/length";
import { sequence, zeroOrOne } from "../structure/operators";

/**
 * @syntax \<font-size>
 *  : \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-font-size
 */
export const FontSize = sequence([
	// When only one length specified, the first length
	// is the size for both horizontal and vertical for a glyph
	// Otherwise only the horizontal size.
	length(NonNegativeConstraint),
	zeroOrOne(
		// Vertical size of a glyph
		length(NonNegativeConstraint),
	),
]);
