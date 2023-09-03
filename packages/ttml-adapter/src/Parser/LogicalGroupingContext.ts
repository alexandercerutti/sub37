import { parseTimeString } from "./parseCue.js";
import type { TimeDetails } from "./TimeBase";
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

interface TimeContextualStorage {
	[beginTimeSymbol]: number;
	/**
	 * Also called "active end"
	 */
	[endTimeSymbol]: number;

	/**
	 * SMIL Standard, from which TTML inherits some
	 * attributes behavior, defines that default for "dur"
	 * is 0 (or, as they call it, "indefinite").
	 *
	 * @see https://www.w3.org/TR/2008/REC-SMIL3-20081201/smil-timing.html#Timing-Ex:0DurDiscreteMedia
	 */

	[durTimeSymbol]: number;

	[timeContainerSymbol]: "par" | "seq";

	[key: symbol]: unknown;
}

export class LogicalGroupingContext {
	private [parentSymbol]: LogicalGroupingContext | undefined;
	private [stylesSymbol]: TTMLStyle[] = [];

	public timeContext: TimeContextualStorage | undefined = undefined;

	public regionIdentifiers: string[] | undefined = [];

	constructor(parent?: LogicalGroupingContext) {
		this[parentSymbol] = parent;
	}

	public get parent(): LogicalGroupingContext {
		return this[parentSymbol];
	}

	public get regionsIdentifiers(): string[] {
		return [...this.regionIdentifiers, ...(this.parent?.regionsIdentifiers ?? [])];
	}

	public addStyles(...style: TTMLStyle[]): void {
		this[stylesSymbol].push(...style.filter(Boolean));
	}

	/**
	 * The begin of a cue can be inherited from parents.
	 * It's default is 0 for both timeContainers kind, 'par'
	 * and 'seq'.
	 *
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#timing-attribute-begin
	 */

	public get contextStartTime(): number {
		return this.timeContext?.[beginTimeSymbol] || this.parent?.contextStartTime || 0;
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

	public get contextEndTime(): number {
		if (!this.timeContext) {
			return this.parent?.contextEndTime || 0;
		}

		const { [endTimeSymbol]: end, [durTimeSymbol]: dur } = this.timeContext;

		if (typeof end === "undefined") {
			return dur || 0;
		}

		if (typeof dur !== "undefined") {
			const startTime = this.contextStartTime;
			const computedDuration = Math.min(dur, end - startTime);

			return startTime + computedDuration;
		}

		return end;
	}

	public get timeContainer(): "par" | "seq" {
		return this.timeContext?.[timeContainerSymbol] || this.parent?.timeContainer || "par";
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

function createTimeContextualStorage(context: LogicalGroupingContext): TimeContextualStorage {
	if (!context.timeContext) {
		context.timeContext = {
			[beginTimeSymbol]: undefined,
			[endTimeSymbol]: undefined,
			[durTimeSymbol]: undefined,
			[timeContainerSymbol]: "par",
		};
	}

	return context.timeContext;
}

function addTimeContextData(
	context: LogicalGroupingContext,
	key: symbol,
	value: string,
	timeDetails: TimeDetails,
): void {
	if (!value || typeof value !== "string") {
		return;
	}

	const timeContext = createTimeContextualStorage(context);
	timeContext[key] = parseTimeString(value, timeDetails);
}

export function addContextBeginPoint(
	context: LogicalGroupingContext,
	beginRawValue: string,
	timeDetails: TimeDetails,
): void {
	addTimeContextData(context, beginTimeSymbol, beginRawValue, timeDetails);
}

export function addContextEndPoint(
	context: LogicalGroupingContext,
	endRawValue: string,
	timeDetails: TimeDetails,
): void {
	addTimeContextData(context, endTimeSymbol, endRawValue, timeDetails);
}

export function addContextDuration(
	context: LogicalGroupingContext,
	durationRawValue: string,
	timeDetails: TimeDetails,
): void {
	addTimeContextData(context, durTimeSymbol, durationRawValue, timeDetails);
}

export function setTimeContainerType(context: LogicalGroupingContext, value: string) {
	if (value !== "par" && value !== "seq") {
		return;
	}

	const timeContext = createTimeContextualStorage(context);
	timeContext[timeContainerSymbol] = value;
}
