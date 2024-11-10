import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, ContextFactory, Scope } from "./Scope";

const styleContextSymbol = Symbol("style");
const styleParserGetterSymbol = Symbol("style.parser.getter");

type StyleParser = ReturnType<typeof createStyleParser>;
type StyleIDRef = string;
type StyleIndex = Record<StyleIDRef, Record<string, string>>;

interface StyleContainerContext extends Context<StyleContainerContext> {
	styles: Map<string, TTMLStyle>;
	registeredStyles: StyleIndex;
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
		const stylesIndex = Object.assign({}, registeredStyles);
		const stylesParser: StyleParser = createStyleParser(scope);

		return {
			parent: undefined,
			identifier: styleContextSymbol,
			mergeWith(context: StyleContainerContext): void {
				if (stylesParser.size) {
					/**
					 * Styles have been already processed, so we
					 * must process context's too, if they
					 * haven't been already.
					 */

					for (const idref in context.registeredStyles) {
						const style = context.registeredStyles[idref];

						stylesParser.process(idref, style);
					}

					return;
				}

				Object.assign(stylesIndex, context.registeredStyles);
			},
			get [styleParserGetterSymbol]() {
				return stylesParser;
			},
			get registeredStyles(): StyleIndex {
				return registeredStyles;
			},
			getStyleByIDRef(idref: string): TTMLStyle | undefined {
				if (!registeredStyles[idref]) {
					console.warn(`Cannot retrieve style id '${idref}'. Not provided.`);
					return this.parent?.getStyleByIDRef(idref);
				}

				const preprocessedStyle = stylesParser.get(idref);

				if (!preprocessedStyle) {
					return stylesParser.process(idref, stylesIndex[idref]);
				}

				return preprocessedStyle;
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
