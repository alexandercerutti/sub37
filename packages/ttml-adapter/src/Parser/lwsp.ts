/**
 * Linear White SPace
 *
 * @param rawValue
 * @returns
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-value-lwsp
 */

export function getSplittedLinearWhitespaceValues(rawValue: string | undefined): string[] {
	if (!rawValue?.length) {
		return [];
	}

	return rawValue
		.replace(/\s+/, "\x20") // Replacing multiples with just one
		.split("\x20");
}
