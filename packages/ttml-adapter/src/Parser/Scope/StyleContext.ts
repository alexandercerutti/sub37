import type { Token } from "../Token";
import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, Scope } from "./Scope";

const styleContextSymbol = Symbol("style");
const styleParserGetterSymbol = Symbol("style.parser.getter");

type StyleParser = ReturnType<typeof createStyleParser>;

interface StyleContext extends Context<StyleContext> {
	styles: TTMLStyle[];
	[styleParserGetterSymbol]: StyleParser;
}

export function createStyleContext(styles: Token[] = []): StyleContext | null {
	if (!styles.length) {
		return null;
	}

	const stylesParser: StyleParser = createStyleParser();

	return {
		parent: undefined,
		identifier: styleContextSymbol,
		mergeWith(context: StyleContext): void {
			// Processing the actual styles first
			if (!stylesParser.size) {
				for (let i = 0; i < styles.length; i++) {
					stylesParser.process(styles[i]);
				}
			}

			const contextStyles = context[styleParserGetterSymbol].getAll();

			for (const [id, data] of Object.entries(contextStyles)) {
				stylesParser.push([id, data]);
			}
		},
		get [styleParserGetterSymbol]() {
			return stylesParser;
		},
		get styles(): TTMLStyle[] {
			const parentStyles: TTMLStyle[] = this.parent ? Object.values(this.parent?.styles) : [];

			if (!stylesParser.size) {
				for (let i = 0; i < styles.length; i++) {
					stylesParser.process(styles[i]);
				}
			}

			return [...Object.values(stylesParser.getAll()), ...parentStyles];
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
