const RGB_REGEX = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/;
const RGBA_REGEX = /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/;

// region <hex-digit>

/**
 * @see https://w3c.github.io/ttml2/#style-value-hex-digit
 */

type HexDigit =
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "A"
	| "B"
	| "C"
	| "D"
	| "E"
	| "F";

function isHexNumber(digitCode: number): boolean {
	return digitCode >= 48 && digitCode <= 57; // 0-9
}

function isHexLetter(digitCode: number): boolean {
	return (
		(digitCode >= 65 && digitCode <= 70) || // A-F
		(digitCode >= 97 && digitCode <= 102) // a-f
	);
}

function isHexDigit(digit: string): digit is HexDigit {
	const digitCode = digit.charCodeAt(0);
	return isHexNumber(digitCode) || isHexLetter(digitCode);
}

export function isHexColor(color: string): color is `#${string}` {
	if (!color.startsWith("#")) {
		return false;
	}

	const colorNoHash = color.slice(1);

	for (const comp of colorNoHash) {
		if (!isHexDigit(comp)) {
			return false;
		}
	}

	return true;
}

// region rrggbb / rrggbbaa

export function isRGBColor(
	color: string,
): color is `rgb(${number},${number},${number})` | `rgba(${number},${number},${number},${number})` {
	if (!color.startsWith("rgb") && !color.startsWith("rgba")) {
		return false;
	}

	const [, rValue, gValue, bValue, aValue = "255"] =
		color.match(RGB_REGEX) || color.match(RGBA_REGEX) || [];

	if (!rValue || !gValue || !bValue) {
		return false;
	}

	const isRed8Bit = !(parseInt(rValue) >> 8);
	const isGreen8Bit = !(parseInt(gValue) >> 8);
	const isBlue8Bit = !(parseInt(bValue) >> 8);
	const isAlpha8Bit = !(parseInt(aValue) >> 8);

	return isRed8Bit && isGreen8Bit && isBlue8Bit && isAlpha8Bit;
}

// region <named-color>

/**
 * @see https://w3c.github.io/ttml2/#style-value-named-color
 */

const NAMED_COLORS = [
	/**  #00000000 						*/ "transparent",
	/**  #000000ff 						*/ "black",
	/**  #c0c0c0ff 						*/ "silver",
	/**  #808080ff 						*/ "gray",
	/**  #ffffffff 						*/ "white",
	/**  #800000ff 						*/ "maroon",
	/**  #ff0000ff 						*/ "red",
	/**  #800080ff 						*/ "purple",
	/**  #ff00ffff 						*/ "fuchsia",
	/**  #ff00ffff (= fuchsia) */ "magenta",
	/**  #008000ff 						*/ "green",
	/**  #00ff00ff 						*/ "lime",
	/**  #808000ff 						*/ "olive",
	/**  #ffff00ff 						*/ "yellow",
	/**  #000080ff 						*/ "navy",
	/**  #0000ffff 						*/ "blue",
	/**  #008080ff 						*/ "teal",
	/**  #00ffffff 						*/ "aqua",
	/**  #00ffffff (= aqua) 		*/ "cyan",
] as const;

type NAMED_COLORS = typeof NAMED_COLORS;

function isNamedColor(color: string): color is NAMED_COLORS[number] {
	return NAMED_COLORS.includes(color as NAMED_COLORS[number]);
}

// region <color>

/**
 * Verifies if `color` satisfies `<color>` rules (see link below)
 *
 * @param color
 * @returns
 * @see https://w3c.github.io/ttml2/#style-value-color
 */

export function isValidColor(color: string): boolean {
	return isHexColor(color) || isRGBColor(color) || isNamedColor(color);
}
