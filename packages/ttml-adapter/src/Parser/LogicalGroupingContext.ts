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
const timeContainerSymbol = Symbol("timecontainer");

export class LogicalGroupingContext {
	private [parentSymbol]: LogicalGroupingContext | undefined;
	private [stylesSymbol]: TTMLStyle[] = [];

	private [beginTimeSymbol]: number | undefined;

	/**
	 * Also called "active end"
	 */

	private [endTimeSymbol]: number | undefined;

	/**
	 * SMIL Standard, from which TTML inherits some
	 * attributes behavior, defines that default for "dur"
	 * is 0 (or, as they call it, "indefinite").
	 *
	 * @see https://www.w3.org/TR/2008/REC-SMIL3-20081201/smil-timing.html#Timing-Ex:0DurDiscreteMedia
	 */

	private [durTimeSymbol]: number = 0;
	private [timeContainerSymbol]: "par" | "seq" = "par";

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

	public set end(timeExpression: number) {
		this[endTimeSymbol] = timeExpression;
	}

	public set dur(timeExpression: number) {
		if (typeof timeExpression === "undefined") {
			return;
		}

		this[durTimeSymbol] = timeExpression;
	}

	/**
	 * The begin of a cue can be inherited from parents.
	 * It's default is 0 for both timeContainers kind, 'par'
	 * and 'seq'.
	 *
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#timing-attribute-begin
	 */

	public get beginTime(): number {
		return this[beginTimeSymbol] || this.parent?.beginTime || 0;
	}

	/**
	 * The end of a cue should not be inherited implicitly
	 * as a check with "dur" is needed to be performed first.
	 *
	 * TTML states that for an element with both duration
	 * and end, the minimum between `end - begin` and `dur`
	 * should be used.
	 *
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#timing-attribute-dur
	 */

	public get endTime(): number {
		if (typeof this[endTimeSymbol] === "undefined") {
			return this[durTimeSymbol] || 0;
		}

		if (typeof this[durTimeSymbol] !== "undefined") {
			return Math.min(this[durTimeSymbol], this[endTimeSymbol] - this.beginTime);
		}

		return this[endTimeSymbol];
	}

	public set timeContainer(value: "par" | "seq") {
		if (value !== "par" && value !== "seq") {
			return;
		}

		this[timeContainerSymbol] = value;
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
