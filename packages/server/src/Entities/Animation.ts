import { Type } from "./index.js";
import type { EntityProtocol } from "./index.js";

export interface AnimationEntity extends EntityProtocol {
	type: Type.ANIMATION;
}

export function createAnimationEntity(
	attributes: Map<string, string | undefined>,
): AnimationEntity {
	return {
		type: Type.ANIMATION,
	};
}

export function isAnimationEntity(entity: EntityProtocol): entity is AnimationEntity {
	return entity.type === Type.ANIMATION;
}
