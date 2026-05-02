import { Entities } from "@sub37/server";

function toAnimationName(id: string): string {
	return `s37-${id.replace(/[^a-zA-Z0-9-_]/g, "-")}`;
}

function buildKeyframesRule(animation: Entities.AnimationEntity): string {
	const name = toAnimationName(animation.id);

	return `
@keyframes ${name} {
  ${generateKeyFrames(animation)}
}
`;
}

function generateKeyFrames(animation: Entities.AnimationEntity): string {
	const { keyTimes, styles } = animation;

	let css = "";

	for (let i = 0; i < keyTimes.length; i++) {
		const pct = keyTimes[i]! * 100;

		css += `${pct}% {
	${getStylesForKeyframe(styles, i)}
	${i < keyTimes.length - 1 ? `animation-timing-function: ${getTimingFunction(animation, i)};` : ""}
	}`;

		if (i < keyTimes.length - 1) {
			css += "\n";
		}
	}

	return css;
}

function getStylesForKeyframe(styles: Record<string, string[]>, keyframeIndex: number): string {
	let css = "";

	const styleEnties = Object.entries(styles);

	for (let i = 0; i < styleEnties.length; i++) {
		const [prop, values] = styleEnties[i]!;

		if (values[keyframeIndex] == null) {
			continue;
		}

		css += `${prop}: ${values[keyframeIndex]};`;

		if (i < styleEnties.length - 1) {
			css += "\n";
		}
	}

	return css;
}

function getTimingFunction(animation: Entities.AnimationEntity, currentKeyTime: number): string {
	const isContinuous = animation.kind === "continuous";

	if (isContinuous) {
		return getContinuousTimingFunction(animation.splines[currentKeyTime]!);
	} else {
		return getDiscreteTimingFunction();
	}
}

function getContinuousTimingFunction(
	spline: (Entities.AnimationEntity & { kind: "continuous" })["splines"][number],
): string {
	const [x1, y1, x2, y2] = spline;
	return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

function getDiscreteTimingFunction(): string {
	return "steps(1, start)";
}

export function buildKeyframesCSS(animations: Entities.AnimationEntity[]): string {
	return animations.map(buildKeyframesRule).join("\n");
}

export function buildAnimationShorthand(animation: Entities.AnimationEntity): string {
	const name = toAnimationName(animation.id);
	const easing =
		animation.kind === "discrete"
			? getDiscreteTimingFunction()
			: getContinuousTimingFunction(animation.splines[0]!);

	const fillMode = animation.fill === "forwards" ? "forwards" : "none";

	/**
	 * Use `both` when the animation has a positive delay and a fill so that
	 * the first keyframe value is applied during the delay period.
	 *
	 * Example: `<set tts:display="auto">` with `begin="1s"` — the span must
	 * remain `display: none` during the 1s delay, then snap to `inline`.
	 * With `fill: both`, the `0% { display: none }` keyframe holds during the
	 * delay. With `forwards` alone the browser applies the base-sheet value
	 * (`inline-block`) during the delay because the animation hasn't started.
	 */
	// const fillMode = animation.fill === "forwards" && animation.delay > 0 ? "both" : animation.fill;

	const duration = `${animation.duration}ms`;
	const delay = `${animation.delay || 0}ms`;
	const iterationCount = 1;
	const direction = "normal";

	return `${name} ${duration} ${easing} ${delay} ${iterationCount} ${direction} ${fillMode}`;
}

export function buildAnimationSheet(animation: Entities.AnimationEntity): CSSStyleSheet {
	const sheet = new CSSStyleSheet();
	sheet.insertRule(buildKeyframesRule(animation));
	return sheet;
}
