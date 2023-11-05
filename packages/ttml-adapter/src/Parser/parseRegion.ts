import type { Region } from "@sub37/server";
import type { Token } from "./Token";
import { parseStyleFactory, type TTMLStyle } from "./parseStyle";

/**
 * @param rawRegionData
 */

export function parseRegion(token: Token, nestedStylesTokens: Token[] = []): Region {
	const localStyleParser = parseStyleFactory();
	const region = new TTMLRegion();
	const nestedStyles: TTMLStyle[] = [];

	for (const styleToken of nestedStylesTokens) {
		const style = localStyleParser(styleToken);

		if (!style) {
			continue;
		}

		nestedStyles.push(style);
	}

	region.styles = nestedStyles;
	region.id = token.attributes["xml:id"];

	return region;
}

class TTMLRegion implements Region {
	public id: string;
	/**
	 * Region width expressed in percentage
	 */
	public width: number = 100;
	public lines: number = 2;

	public styles: TTMLStyle[] = [];

	public getOrigin(): [x: number, y: number] {
		/**
		 * @TODO implement. What will be the coordinates in TTML?
		 */

		return [0, 0];
	}
}
