import type { Region } from "@sub37/server";
import type { Token } from "./Token";
import { createStyleParser, type TTMLStyle } from "./parseStyle";
import { NodeWithRelationship } from "./Tags/NodeTree";
import { memoizationFactory } from "./memoizationFactory";

type StyleParser = ReturnType<typeof createStyleParser>;

/**
 * @param rawRegionData
 */

export const createRegionParser = memoizationFactory(function regionParserExecutor(
	regionStorage: Map<string, TTMLRegion>,
	attributes: Record<string, string>,
	children: NodeWithRelationship<Token>[],
	styleParser: StyleParser = createStyleParser(),
): Region | undefined {
	if (regionStorage.has(attributes["xml:id"])) {
		/**
		 * @TODO should we resolve the conflict here
		 * or just ignore the region? The spec seems
		 * to say nothing about this...
		 */
		return undefined;
	}

	const region = new TTMLRegion();
	const nestedStyles = extractStylesChildren(children, styleParser);

	region.styles = nestedStyles;
	region.id = attributes["xml:id"];

	regionStorage.set(region.id, region);
	return region;
});

function extractStylesChildren(
	regionChildren: NodeWithRelationship<Token>[],
	styleParser: StyleParser = createStyleParser(),
): TTMLStyle[] {
	const nestedStyles: TTMLStyle[] = [];

	for (const styleToken of regionChildren) {
		if (styleToken.content.content !== "style") {
			continue;
		}

		const style = styleParser.process(styleToken.content.attributes);

		if (!style) {
			continue;
		}

		nestedStyles.push(style);
	}

	return nestedStyles;
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
