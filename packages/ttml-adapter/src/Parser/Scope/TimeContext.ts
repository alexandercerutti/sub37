import type { Context, Scope } from "./Scope";

const timeContextSymbol = Symbol("time");
const currentStateSymbol = Symbol("state");
const beginSymbol = Symbol("time.begin");
const endSymbol = Symbol("time.end");
const durSymbol = Symbol("time.dur");

interface TimeContextData {
	begin?: number | undefined;
	end?: number | undefined;
	dur?: number | undefined;
	timeContainer?: "par" | "seq";
}

interface TimeContext extends Context<TimeContext> {
	readonly startTime: number;
	readonly endTime: number;
	readonly timeContainer: "par" | "seq";

	readonly [beginSymbol]?: number | undefined;

	/**
	 * Also called "active end"
	 */
	readonly [endSymbol]?: number | undefined;

	/**
	 * SMIL Standard, from which TTML inherits some
	 * attributes behavior, defines that default for "dur"
	 * is 0 (or, as they call it, "indefinite").
	 *
	 * @see https://www.w3.org/TR/2008/REC-SMIL3-20081201/smil-timing.html#Timing-Ex:0DurDiscreteMedia
	 */

	readonly [durSymbol]?: number | undefined;

	// Just to retrieve the parent
	[currentStateSymbol]: TimeContextData;
}

export function createTimeContext(state: TimeContextData = {}): TimeContext | null {
	if (!Object.keys(state).length) {
		return null;
	}

	return {
		parent: undefined,
		identifier: timeContextSymbol,
		mergeWith(context: TimeContext): void {
			Object.assign(state, context[currentStateSymbol] || {});
		},
		/**
		 * The begin of a cue can be inherited from parents.
		 * It's default is 0 for both timeContainers kind, 'par'
		 * and 'seq'.
		 *
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#timing-attribute-begin
		 */
		get startTime() {
			if (typeof state.begin !== "undefined") {
				return state.begin;
			}

			return this.parent?.startTime || 0;
		},
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
		get endTime() {
			const end = this[endSymbol];
			const dur = this[durSymbol];
			const timeContainer = this.timeContainer;

			if (typeof end === "undefined") {
				return dur || timeContainer === "par" ? Infinity : 0;
			}

			if (typeof dur !== "undefined") {
				const startTime = this.startTime;
				const computedDuration = Math.min(dur, end - startTime);

				return startTime + computedDuration;
			}

			return end;
		},
		/**
		 * timecontainer is only inheritable but does not apply to the current element.
		 * So we look only at the parent when we get the context for the current element.
		 *
		 * As a case, we might look at this example:
		 *
		 * @example
		 * ```xml
		 *	<!-- par (default) -->	<body>
		 *	<!-- par (default) -->	  <div>
		 *	<!-- par (default) -->	    <p timeContainer="seq">
		 *	<!-- seq (inherit) -->	      Hello
		 *	<!-- seq (inherit) -->	      <span>
		 *	<!-- par (default) -->	        Guten
		 *	<!-- par (default) -->	        <span>
		 *	<!-- par (default) -->	          Tag
		 *	<!--               -->	        </span>
		 *	<!--               -->	      </span>
		 *	<!-- seq (inherit) -->	      Allo
		 *	<!--               -->	    </p>
		 *	<!--               -->	  </div>
		 *	<!--               -->	</body>
		 * ```
		 *
		 * In this example, explict `Anonymous Span`s that wraps "Guten" and "Tag" (latter
		 * is itself wrapped into another explicit `Anonymous Span`), do not inherit the
		 * property from the parent outside.
		 *
		 * Therefore, if we create a context for spans, each element will have to look
		 * only for their parent's timeContainer.
		 *
		 * This is also valid for span themselves.
		 *
		 * If "par" means "parallel" and "seq" means "sequential", seq elements
		 * have, by default, a duration or 0. "par" elements instead own
		 * an indefinite duration, so they will always be shown.
		 */
		get timeContainer() {
			return this.parent?.[currentStateSymbol].timeContainer || "par";
		},

		get [currentStateSymbol]() {
			return state;
		},
		get [endSymbol]() {
			return state.end || this.parent?.[endSymbol] || undefined;
		},
		get [beginSymbol]() {
			return state.begin || this.parent?.[beginSymbol] || undefined;
		},
		get [durSymbol]() {
			return state.dur || this.parent?.[durSymbol] || undefined;
		},
	};
}

export function readScopeTimeContext(scope: Scope): TimeContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(timeContextSymbol))) {
		return undefined;
	}

	return createTimeContextProxy(context as TimeContext);
}

/**
 * A TimeContext Proxy is needed to allow reading a context
 * like you were reading from a children of the associated
 * scope.
 *
 * This is for the special case of `timeContainer` getter,
 * which should read only its parent, and not its own property,
 * as when reading a scope, we are reading it as a child.
 *
 * @param context
 * @returns
 */

function createTimeContextProxy(context: TimeContext): TimeContext {
	return Object.create(context, {
		parent: {
			get() {
				return context;
			},
		},
	});
}

export function isTimeContainerStardardString(
	timeContainer: string,
): timeContainer is "par" | "seq" {
	return timeContainer === "par" || timeContainer === "seq";
}
