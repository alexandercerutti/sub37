import type { TimeDetails } from "../TimeBase/index.js";
import { getTimeBaseProvider } from "../TimeBase/index.js";
import { matchClockTimeExpression } from "../TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "../TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "../TimeExpressions/matchers/wallclockTime.js";
import { readScopeDocumentContext } from "./DocumentContext.js";
import type { Context, ContextFactory, Scope } from "./Scope";
import { onMergeSymbol } from "./Scope.js";

const timeContextSymbol = Symbol("time");
const currentStateSymbol = Symbol("state");
const beginSymbol = Symbol("time.begin");
const endSymbol = Symbol("time.end");
const durSymbol = Symbol("time.dur");

export interface TimeContextData {
	begin?: string | undefined;
	end?: string | undefined;
	dur?: string | undefined;
	timeContainer?: string | undefined;
}

interface TimeContextState {
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
	[currentStateSymbol]: TimeContextState;
}

declare module "./Scope" {
	interface ContextDictionary {
		[timeContextSymbol]: TimeContext;
	}
}

export function createTimeContext(contextInput: TimeContextData = {}): ContextFactory<TimeContext> {
	return function (scope: Scope) {
		if (!Object.keys(contextInput).length) {
			return null;
		}

		const { attributes: documentAttributes } = readScopeDocumentContext(scope);

		const isDurAttributeForbidden =
			typeof contextInput.dur !== "undefined" &&
			documentAttributes["ttp:timeBase"] === "smpte" &&
			documentAttributes["ttp:markerMode"] === "discontinuous";

		if (isDurAttributeForbidden) {
			throw new Error(
				"Dur attribute cannot be specified when timeBase is set to 'smpte' and marker mode is 'discontinuous' (default).",
			);
		}

		const timeContainer = isTimeContainerStardardString(contextInput["timeContainer"])
			? contextInput["timeContainer"]
			: undefined;

		const state: TimeContextState = {
			begin: parseTimeString(contextInput.begin, documentAttributes),
			end: parseTimeString(contextInput.end, documentAttributes),
			dur: parseTimeString(contextInput.dur, documentAttributes),
			timeContainer,
		};

		return {
			parent: undefined,
			identifier: timeContextSymbol,
			[onMergeSymbol](context: TimeContext): void {
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
					/**
					 * If duration is missing, then we need to obtain the
					 * what-so-called "implicit duration". TTML States this:
					 *
					 * "The implicit duration of an anonymous span is defined as follows:
					 * if the anonymous span's parent time container is a parallel time
					 * container, then the implicit duration is equivalent to the indefinite
					 * duration value as defined by [SMIL 3.0];
					 *
					 * if the anonymous span's parent time container is a sequential time
					 * container, then the implicit duration is equivalent to zero."
					 *
					 * @see https://w3c.github.io/ttml2/#semantics-timing
					 */

					if (typeof dur !== "undefined") {
						return this.startTime + dur;
					}

					return timeContainer === "par" ? Infinity : 0;
				}

				if (typeof dur !== "undefined") {
					/**
					 * "In the context of the subset of [SMIL 3.0]
					 * semantics supported by this specification,
					 * the active duration of an element that
					 * specifies both end and dur attributes is
					 * equal to the lesser of the value of the dur
					 * attribute and the difference between the
					 * value of the end attribute and
					 * the element's begin time.
					 */
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
	};
}

export function readScopeTimeContext(scope: Scope): TimeContext | undefined {
	return scope.getContextByIdentifier(timeContextSymbol);
}

function isTimeContainerStardardString(timeContainer: string): timeContainer is "par" | "seq" {
	return timeContainer === "par" || timeContainer === "seq";
}

function parseTimeString(timeString: string, timeDetails: TimeDetails): number | undefined {
	if (!timeString) {
		return undefined;
	}

	const timeProvider = getTimeBaseProvider(timeDetails["ttp:timeBase"]);

	/**
	 * "[...] where referenceBegin is determined according to whether the nearest ancestor time container
	 * employs parallel (par) or sequential (seq) semantics: if parallel or if sequential and no prior
	 * sibling timed element exists, then referenceBegin is the media time that corresponds to the beginning
	 * of the nearest ancestor time container or zero (0) if this time container is the root temporal extent;
	 *
	 * otherwise, if sequential and a prior sibling timed element exists, then referenceBegin is the media
	 * time that corresponds to the active end of the immediately prior sibling timed element;"
	 *
	 * @FIXME pass the correct referenceBegin according above description
	 */

	const referenceBegin = 0;

	{
		const match = matchClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByClockTime(match, timeDetails, referenceBegin);
		}
	}

	{
		const match = matchOffsetTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByOffsetTime(match, timeDetails, referenceBegin);
		}
	}

	{
		const match = matchWallClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByWallClockTime(match);
		}
	}

	/**
	 * @TODO improve error type here
	 */

	throw new Error(
		"Time format didn't match any supported format (ClockTime, OffsetTime or WallClock);",
	);
}
