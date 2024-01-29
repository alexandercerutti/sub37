import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, Scope } from "./Scope";

const styleContextSymbol = Symbol("style");
const styleParserGetterSymbol = Symbol("style.parser.getter");

type StyleParser = ReturnType<typeof createStyleParser>;

interface StyleContext extends Context<StyleContext> {
	styles: Map<string, TTMLStyle>;
	[styleParserGetterSymbol]: StyleParser;
}

export function createStyleContext(styles: Record<string, string> = {}): StyleContext | null {
	const stylesParser: StyleParser = createStyleParser();

	return {
		parent: undefined,
		identifier: styleContextSymbol,
		mergeWith(context: StyleContext): void {
			if (!stylesParser.size) {
				/**
				 * Processing the actual styles first
				 */
				stylesParser.process(styles);
			}

			const contextStyles = context[styleParserGetterSymbol].getAll();

			for (const [id, data] of Object.entries(contextStyles)) {
				stylesParser.push([id, data]);
			}
		},
		get [styleParserGetterSymbol]() {
			return stylesParser;
		},
		get styles(): Map<string, TTMLStyle> {
			const parentStyles = this.parent ? this.parent?.styles : new Map<string, TTMLStyle>();

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
}

export function readScopeStyleContext(scope: Scope): StyleContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(styleContextSymbol))) {
		return undefined;
	}

	return context as StyleContext;
}
