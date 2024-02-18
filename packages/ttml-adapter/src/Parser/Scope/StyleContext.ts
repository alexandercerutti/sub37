import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, Scope } from "./Scope";

const styleContextSymbol = Symbol("style");
const styleParserGetterSymbol = Symbol("style.parser.getter");

type StyleParser = ReturnType<typeof createStyleParser>;

interface StyleContext extends Context<StyleContext> {
	styles: Map<string, TTMLStyle>;
	unprocessedStyles: Record<string, string>;
	[styleParserGetterSymbol]: StyleParser;
}

export function createStyleContext(
	initialStyles: Record<string, string> = {},
): StyleContext | null {
	const styles = Object.assign({}, initialStyles);
	const stylesParser: StyleParser = createStyleParser();

	return {
		parent: undefined,
		identifier: styleContextSymbol,
		mergeWith(context: StyleContext): void {
			if (stylesParser.size) {
				/**
				 * Styles have been already processed, so we
				 * must process context's too, if they
				 * haven't been already.
				 */

				stylesParser.push(...Object.entries(context.styles));
				return;
			}

			Object.assign(styles, context.unprocessedStyles);
		},
		get [styleParserGetterSymbol]() {
			return stylesParser;
		},
		get unprocessedStyles(): Record<string, string> {
			return styles;
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
}

export function readScopeStyleContext(scope: Scope): StyleContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(styleContextSymbol))) {
		return undefined;
	}

	return context as StyleContext;
}
