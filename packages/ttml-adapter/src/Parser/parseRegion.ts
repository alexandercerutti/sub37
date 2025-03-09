import type { Region } from "@sub37/server";
import type { Token } from "./Token";
import type { TTMLStyle } from "./parseStyle";
import { createStyleParser, isStyleAttribute } from "./parseStyle.js";
import type { NodeWithRelationship } from "./Tags/NodeTree";
import { memoizationFactory } from "./memoizationFactory.js";
import type { Scope } from "./Scope/Scope";
import type { TimeContextData } from "./Scope/TimeContext";

/**
 * @param rawRegionData
 */

export const createRegionParser = memoizationFactory(function regionParserExecutor(
	regionStorage: Map<string, TTMLRegion>,
	scope: Scope | undefined,
	attributes: Record<string, string>,
	children: NodeWithRelationship<Token>[],
): TTMLRegion | undefined {
	if (attributes["xml:id"] && regionStorage.has(attributes["xml:id"])) {
		/**
		 * Region is ignored if the id is not unique in the document
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-inline-regions
		 */
		return undefined;
	}

	const styleParser = createStyleParser(scope);

	if (Object.keys(attributes).some(isStyleAttribute)) {
		styleParser.process(
			Object.create(attributes, {
				/**
				 * If attributes contains an xml:id, it is the region id.
				 * However, we want to define the id for the styles.
				 *
				 * The attributes will be filtered once the style will be
				 * processed when attributes getter in styleParser is accessed.
				 */
				"xml:id": {
					value: "inline",
					enumerable: true,
				},
			}),
		);
	}

	if (children.length) {
		styleParser.process(
			Object.create(extractNestedStylesChildren(children), {
				"xml:id": {
					value: "nested",
					enumerable: true,
				},
			}),
		);
	}

	function stylesRetriever(): TTMLStyle[] {
		return [styleParser.get("inline"), styleParser.get("nested")].filter(Boolean);
	}

	const regionTimingAttributes =
		(hasTimingAttributes(attributes) && {
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		}) ||
		undefined;

	const region = new TTMLRegion(
		attributes["xml:id"] || "inline",
		regionTimingAttributes,
		stylesRetriever,
	);

	regionStorage.set(region.id, region);
	return region;
});

function extractNestedStylesChildren(
	regionChildren: NodeWithRelationship<Token>[],
): Record<string, string> {
	const nestedStyles: Record<string, string> = {};

	for (const styleToken of regionChildren) {
		if (styleToken.content.content !== "style") {
			continue;
		}

		const { "xml:id": id, ...attributes } = styleToken.content.attributes;

		Object.assign(nestedStyles, attributes);
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
		timingAttributes: TimeContextData | undefined,
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

/**
 * Checks if the element is suitable for
 * containing time attributes and if it
 * actually have them
 *
 * @param token
 * @returns
 */
function hasTimingAttributes(attributes: Record<string, string>): boolean {
	return (
		"begin" in attributes ||
		"end" in attributes ||
		"dur" in attributes ||
		"timeContainer" in attributes
	);
}

// set styles(styles: TTMLStyle[]) {
// 	const stylesContainer: Record<`tts:${string}`, string> = {};

// 	const joinedStylesAttrs = Object.assign(
// 		{},
// 		...styles.map(({ attributes }) => attributes),
// 	) as Record<`tts:${string}`, string>;

// 	for (const attribute in joinedStylesAttrs) {
// 		switch (attribute) {
// 			case "tts:origin": {
// 				const [x = "0", y = "0"] = joinedStylesAttrs[attribute].split("\x20");
// 				this["origin"] = [`${parseFloat(x)}%`, `${parseFloat(y)}%`];

// 				break;
// 			}

// 			default: {
// 				const attr = attribute as `tts:${string}`;
// 				stylesContainer[attr] = joinedStylesAttrs[attr];
// 			}
// 		}
// 	}

// 	this[styleContainerSymbol] = stylesContainer;
// }

// get styles(): Record<`tts:${string}`, string> {
// 	return this[styleContainerSymbol];
// }

// public get height(): string {
// 	return this.extent[1];
// }
