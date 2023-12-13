import type { Token } from "../Token";
import { TTMLStyle, createStyleParser } from "../parseStyle";
import type { Context, Scope } from "./Scope";

const styleContextSymbol = Symbol("style");

type StyleParser = ReturnType<typeof createStyleParser>;

interface StyleContext extends Context<StyleContext> {
	styles: TTMLStyle[];
}

export function createStyleContext(styles: Token[]): StyleContext {
	const stylesParser: StyleParser = createStyleParser();

	return {
		parent: undefined,
		identifier: styleContextSymbol,
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
