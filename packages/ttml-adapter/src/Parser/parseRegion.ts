import type { Region } from "@sub37/server";
import { TokenType, type Token } from "./Token";
import { createStyleParser, type TTMLStyle } from "./parseStyle";
import { NodeWithRelationship } from "./Tags/NodeTree";
import { memoizationFactory } from "./memoizationFactory";
import { Scope } from "./Scope/Scope";
import { TimeContextData } from "./Scope/TimeContext";
import { readScopeStyleContainerContext } from "./Scope/StyleContainerContext";

type StyleParser = ReturnType<typeof createStyleParser>;

/**
 * @param rawRegionData
 */

export const createRegionParser = memoizationFactory(function regionParserExecutor(
	regionStorage: Map<string, TTMLRegion>,
	scope: Scope | undefined,
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

	let regionStylesCache: TTMLStyle[] = [];

	function stylesRetriever(): TTMLStyle[] {
		if (regionStylesCache.length) {
			return regionStylesCache;
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

		regionStylesCache = regionStylesCache.concat(nestedStyles);

		if (attributes["style"]) {
			const styleContext = readScopeStyleContainerContext(scope);

			if (styleContext) {
				const style = styleContext.getStyleByIDRef(attributes["style"]);
				regionStylesCache = regionStylesCache.concat(style);
			}
		}

		return regionStylesCache;
	}

	const region = new TTMLRegion(
		attributes["xml:id"],
		{
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		},
		stylesRetriever,
	);

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

	public stylesRetriever: () => TTMLStyle[];

	public constructor(
		id: string,
		timingAttributes: TimeContextData,
		stylesRetriever: TTMLRegion["stylesRetriever"],
	) {
		this.id = id;
		this.timingAttributes = timingAttributes;
		this.stylesRetriever = stylesRetriever;
	}

	public getOrigin(): [x: number, y: number] {
		return [0, 0];
	}

	public get width(): number {
		return 100;
	}

	public get styles(): TTMLStyle[] {
		return this.stylesRetriever() || [];
	}
}
