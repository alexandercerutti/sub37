import { Type } from "./index.js";
import type { EntityProtocol } from "./index.js";

type Spline = [x1: number, y1: number, x2: number, y2: number];

/**
 * Discrete animations are meant to be remapped to a steps() function.
 */
interface DiscreteAnimation extends EntityProtocol {
	kind: "discrete";
}

/**
 * Every continuous animation is meant to be remapped to a
 * cubic-bezier function, which is defined by 4 coordinates: x1, y1, x2 and y2.
 *
 * This is valid for linear and paced animations as well, when talking about TTML.
 */
interface ContinuousAnimation extends EntityProtocol {
	kind: "continuous";
	splines: Spline[];
}

export type AnimationEntity = (DiscreteAnimation | ContinuousAnimation) & {
	type: Type.ANIMATION;
	id: string;
	duration: number;
	delay: number;
	fill: "forwards" | "none";
	keyTimes: number[];
	styles: Record<string, string[]>;
};

interface InputAnimationData {
	id: string;
	kind: "discrete" | "continuous";
	duration: number;
	delay?: number;
	fill?: "forwards" | "none";
	keyTimes: number[];
	splines?: Spline[];

	/**
	 * This property is a list of frames for a
	 * specific style, for this specific animation.
	 */
	styles: Record<string, string[]>;
}

export function createAnimationEntity(attributes: InputAnimationData): AnimationEntity {
	const delay = Math.min(0, attributes.delay || 0);
	const duration = Math.max(0, attributes.duration);
	const fill = attributes.fill || "forwards";
	const keyTimes = attributes.keyTimes || [];
	const styles = attributes.styles;
	const splines = attributes.splines || [];

	return {
		type: Type.ANIMATION,
		id: attributes.id,
		kind: attributes.kind,
		duration,
		delay,
		fill,
		keyTimes,
		styles,
		splines,
	};
}

export function isAnimationEntity(entity: EntityProtocol): entity is AnimationEntity {
	return entity.type === Type.ANIMATION;
}
