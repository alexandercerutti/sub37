import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, ContextFactory, Scope } from "./Scope";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";

const styleContextSymbol = Symbol("style");
const styleParserGetterSymbol = Symbol("style.parser.getter");

type StyleParser = ReturnType<typeof createStyleParser>;
type StyleIDRef = string;
type StyleIndex = Record<StyleIDRef, Record<string, string>>;

interface StyleContainerContext extends Context<StyleContainerContext, StyleIndex> {
	styles: Map<string, TTMLStyle>;
	getStyleByIDRef(idref: string): TTMLStyle | undefined;
	[styleParserGetterSymbol]: StyleParser;
}

declare module "./Scope" {
	interface ContextDictionary {
		[styleContextSymbol]: StyleContainerContext;
	}
}

export function createStyleContainerContext(
	registeredStyles: StyleIndex,
): ContextFactory<StyleContainerContext> | null {
	return function (scope: Scope) {
		const stylesIDREFSStorage = new Map<string, TTMLStyle>();
		const stylesParser: StyleParser = createStyleParser(scope, stylesIDREFSStorage);

		return {
			parent: undefined,
			identifier: styleContextSymbol,
			get args() {
				return registeredStyles;
			},
			[onAttachedSymbol]() {
				const { args } = this;

				for (const registeredStyle in args) {
					const styleAttributes = args[registeredStyle];

					if (!styleAttributes["xml:id"]) {
						console.warn("Style with unknown 'xml:id' attribute, got ignored.");
						continue;
					}

					const currentStyleId = styleAttributes["xml:id"];
					const resolvedStyleId = resolveIDREFConflict(stylesIDREFSStorage, currentStyleId);

					stylesParser.process(
						Object.create(styleAttributes, {
							"xml:id": {
								value: resolvedStyleId,
								enumerable: true,
							},
						}),
					);
				}
			},
			[onMergeSymbol](context: StyleContainerContext): void {
				const { args } = context;

				for (const styleIDRef in args) {
					stylesParser.process(args[styleIDRef]);
				}
			},
			get [styleParserGetterSymbol]() {
				return stylesParser;
			},
			getStyleByIDRef(idref: string): TTMLStyle | undefined {
				if (!stylesIDREFSStorage.has(idref)) {
					const styleFromParent = this.parent?.getStyleByIDRef(idref);

					if (!styleFromParent) {
						console.warn(`Cannot retrieve style id '${idref}'. Not provided.`);
						return undefined;
					}

					return styleFromParent;
				}

				return stylesParser.get(idref);
			},
			get styles(): Map<string, TTMLStyle> {
				const parentStyles = this.parent ? this.parent.styles : new Map<string, TTMLStyle>();

				if (!stylesParser.size) {
					/**
					 * Processing the actual styles first
					 */
					stylesParser.process(styles);
				}

				return new Map<string, TTMLStyle>([
					...parentStyles,
					...Object.entries(stylesParser.getAll()),
				]);
			},
		};
	};
}

export function readScopeStyleContainerContext(scope: Scope): StyleContainerContext | undefined {
	return scope.getContextByIdentifier(styleContextSymbol);
}

function resolveIDREFConflict(idrefsMap: Map<string, TTMLStyle>, id: string): string {
	if (!idrefsMap.has(id)) {
		return id;
	}

	let styleConflictOverrideIdentifier = parseInt(id.match(/--(\d{1,})/)?.[1]);

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return id;
	}

	while (idrefsMap.has(`${id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	return id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);
}
