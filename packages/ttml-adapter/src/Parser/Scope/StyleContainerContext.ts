import { TTMLStyle, createStyleParser } from "../parseStyle.js";
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
		/**
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential
		 */
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

					const finalAttributes = Object.assign({}, styleAttributes);

					const chainedReferentialStylesIDRefs = new Set(
						(styleAttributes["style"] || "").split("\x20"),
					);

					if (chainedReferentialStylesIDRefs.size) {
						for (const idref of chainedReferentialStylesIDRefs) {
							/**
							 * A loop in a sequence of chained style references must be considered an error.
							 * @see https://w3c.github.io/ttml2/#semantics-style-association-chained-referential
							 *
							 * However, if this check of checking if an idref already exists will
							 * get removed, we'll have to find out a different way to track
							 * already used styles. Right now we save ourselves by blocking current
							 */

							if (!stylesIDREFSStorage.has(idref)) {
								console.warn(
									`Chained Style Referential: style '${idref}' not found or not yet defined. Will be ignored.`,
								);
								continue;
							}

							/**
							 * @see https://w3c.github.io/ttml2/#semantics-style-association-chained-referential
							 */
							const chainedReferentialStyles = stylesIDREFSStorage.get(idref);
							Object.assign(finalAttributes, chainedReferentialStyles);
						}
					}

					const currentStyleId = styleAttributes["xml:id"];
					const resolvedStyleId = resolveIDREFConflict(stylesIDREFSStorage, currentStyleId);

					stylesParser.process(
						Object.create(finalAttributes, {
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
