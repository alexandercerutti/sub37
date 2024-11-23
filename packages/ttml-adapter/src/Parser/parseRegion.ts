import type { Region } from "@sub37/server";
import { TokenType, type Token } from "./Token";
import { createStyleParser, type TTMLStyle } from "./parseStyle";
import { NodeWithRelationship } from "./Tags/NodeTree";
import { memoizationFactory } from "./memoizationFactory";
import { Scope } from "./Scope/Scope";
import { TimeContextData } from "./Scope/TimeContext";

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

	const nestedStyles = processStylesChildren(
		[
			...children,
			{
				content: {
					content: "style",
					attributes,
					type: TokenType.START_TAG,
				},
				children: [],
			},
		],
		styleParser,
	);

	const region = new TTMLRegion(attributes["xml:id"], nestedStyles, {
		begin: attributes["begin"],
		dur: attributes["dur"],
		end: attributes["end"],
		timeContainer: attributes["timeContainer"],
	});

	regionStorage.set(region.id, region);
	return region;
});

function processStylesChildren(
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

export class TTMLRegion implements Region {
	public id: string;
	public timingAttributes?: TimeContextData;
	public lines: number = 2;

	public styles: TTMLStyle[] = [];

	public constructor(id: string, styles: TTMLStyle[] = [], timingAttributes?: TimeContextData) {
		this.timingAttributes = timingAttributes;
		this.id = id;
		this.styles = styles;
	}

	public getOrigin(): [x: number, y: number] {
		return [0, 0];
	}

	public get width(): number {
		return 100;
	}
}
