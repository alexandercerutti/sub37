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
	_scope: Scope | undefined,
	attributes: Record<string, string>,
	children: NodeWithRelationship<Token>[],
	styleParser: StyleParser = createStyleParser(),
): TTMLRegion | undefined {
	if (regionStorage.has(attributes["xml:id"])) {
		/**
		 * Region is ignored if the id is not unique in the document
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-inline-regions
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

		const id = styleToken.content.attributes["xml:id"] || "";
		const style = styleParser.process(id, styleToken.content.attributes);

		if (!style) {
			continue;
		}

		nestedStyles.push(style);
	}

	return nestedStyles;
}

class TTMLRegion implements Region {
	private extent: [number, number];
	private origin: [number, number];

	public id: string;
	/**
	 * Region width expressed in percentage
	 */
	public width: number = 100;
	public lines: number = 2;

	public styles: TTMLStyle[] = [];

	public constructor(origin?: string, extent?: string) {
		if (origin?.length) {
			const [x, y] = origin.split("\x20") || ["0px", "0px"];

			if (typeof x !== "undefined" && typeof y !== "undefined") {
				this.origin = [parseInt(x), parseInt(y)];
			}
		}

		if (extent?.length) {
			if (extent === "auto") {
				/**
				 * @TODO numbers probably should not be used, but we have
				 * to due to renderer forcing percentage. Not correct, but fine
				 * right now.
				 */
				this.extent = [100, 100];
			} else {
				const [x, y] = extent.split("\x20") || ["0px", "0px"];

				if (typeof x !== "undefined" && typeof y !== "undefined") {
					/**
					 * @TODO parseInt should probably not be used, but we have
					 * to due to renderer forcing percentage. Not correct, but fine
					 * right now.
					 */
					this.extent = [parseInt(x), parseInt(y)];
				}
			}
		}
	}

	public getOrigin(): [x: number, y: number] {
		/**
		 * @TODO implement. What will be the coordinates in TTML?
		 */

		return [0, 0];
	}
}
