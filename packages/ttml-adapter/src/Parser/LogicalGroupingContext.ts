import type { TTMLStyle } from "./parseStyle";

/**
 * A LogicalGroupingContext is meant to represent
 * a 'div' element or a global context that will
 * contain contextual information
 */

interface StylesIterableIterator extends IterableIterator<TTMLStyle> {
	length: number;
	find(predicate: (style: TTMLStyle) => boolean): TTMLStyle | undefined;
}

const parentSymbol = Symbol("parent");
const stylesSymbol = Symbol("styles");
const beginTimeSymbol = Symbol("begin");
const endTimeSymbol = Symbol("end");
const durTimeSymbol = Symbol("dur");

export class LogicalGroupingContext {
	private [parentSymbol]: LogicalGroupingContext | undefined;
	private [stylesSymbol]: TTMLStyle[] = [];

	private [beginTimeSymbol]: number | undefined;
	private [endTimeSymbol]: number | undefined;
	private [durTimeSymbol]: number | undefined;

	constructor(parent?: LogicalGroupingContext) {
		this[parentSymbol] = parent;
	}

	public get parent(): LogicalGroupingContext {
		return this[parentSymbol];
	}

	public addStyles(...style: TTMLStyle[]): void {
		this[stylesSymbol].push(...style.filter(Boolean));
	}

	public set begin(timeExpression: number) {
		this[beginTimeSymbol] = timeExpression;
	}

	public get begin(): number | undefined {
		return this[beginTimeSymbol] || this.parent?.begin;
	}

	public set end(timeExpression: number) {
		this[endTimeSymbol] = timeExpression;
	}

	public get end(): number | undefined {
		return this[endTimeSymbol] || this.parent?.end;
	}

	public set duration(timeExpression: number) {
		this[durTimeSymbol] = timeExpression;
	}

	public get duration(): number | undefined {
		return this[durTimeSymbol] || this.parent?.duration;
	}

	public get styles(): StylesIterableIterator {
		let groupStylesIndex = 0;
		const groupStyles = this[stylesSymbol];
		const parentIterator: StylesIterableIterator | undefined = this.parent?.styles;

		return {
			[Symbol.iterator]() {
				return this;
			},
			next() {
				/**
				 * Iterating over current group styles and (somehow recursively?)
				 * on parent styles, which will iterate over parent styles
				 */

				if (groupStylesIndex < groupStyles.length) {
					const value = groupStyles[groupStylesIndex];
					groupStylesIndex += 1;

					return {
						value,
						done: false,
					};
				}

				if (parentIterator) {
					return parentIterator.next();
				}

				return {
					value: undefined,
					done: true,
				};
			},
			length: groupStyles.length + (parentIterator?.length ?? 0),
			find(predicate: (style: TTMLStyle) => boolean): TTMLStyle | undefined {
				for (const style of this) {
					if (predicate(style)) {
						return style;
					}
				}

				return undefined;
			},
		};
	}
}
