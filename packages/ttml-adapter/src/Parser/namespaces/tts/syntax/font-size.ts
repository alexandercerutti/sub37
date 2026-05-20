import { alias } from "../structure/derivables/alias.js";
import { length, NonNegativeConstraint } from "../structure/derivables/length.js";
import { sequence, zeroOrOne } from "../structure/operators.js";

/**
 * @syntax \<font-size>
 *  : \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-font-size
 */
export const FontSizeGrammar = alias(
	"<font-size>",
	sequence([
		// When only one length specified, the first length
		// is the size for both horizontal and vertical for a glyph
		// Otherwise only the horizontal size.
		length(NonNegativeConstraint),
		zeroOrOne(
			// Vertical size of a glyph
			length(NonNegativeConstraint),
		),
	]),
);
