import type { Context, Scope } from "./Scope";

const timeContextSymbol = Symbol("time");
const currentStateSymbol = Symbol("state");

interface TimeContextData {
	begin?: number | undefined;
	end?: number | undefined;
	dur?: number | undefined;
	timeContainer?: "par" | "seq";
}

interface TimeContext extends Context<TimeContext> {
	startTime: number;
	endTime: number;
	timeContainer: "par" | "seq";

	// Just to retrieve the parent
	[currentStateSymbol]: TimeContextData;
}

export function createTimeContext(state: TimeContextData = {}): TimeContext | null {
	if (!(state.begin && state.dur && state.end && state.timeContainer)) {
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
			const { end, dur, timeContainer } = state;

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
			return this.parent?.[currentStateSymbol].timeContainer || this.parent?.timeContainer || "par";
		},

		/**
		 * This getter helps us to retrieve the parent's timeContainer
		 * without affecting the elements.
		 */
		get [currentStateSymbol]() {
			return state;
		},
	};
}

export function readScopeTimeContext(scope: Scope): TimeContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(timeContextSymbol))) {
		return undefined;
	}

	return context as TimeContext;
}
