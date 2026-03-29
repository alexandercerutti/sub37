import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextOutlineGrammar } from "../syntax/text-outline.js";
import { createUnit } from "../../Units/unit.js";

export { TextOutlineGrammar as Grammar } from "../syntax/text-outline.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOutlineGrammar>,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> | null {
	if (value.length === 1) {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const outlineColor: string | undefined = value[0]?.value.value;
	const outlineThickness: string | undefined = value[1]?.value.value.toString();
	const outlineBlurRadius: string | undefined = value[2]?.value.value.toString();

	/**
	 * For some kind of reason, Web Animation API doesn't support animating `-webkit-text-stroke`
	 * but @keyframes do. Therefore we need to use style tags for animation generation
	 * instead of WAAPI in the caption-renderer.
	 */

	return [
		["text-shadow", `1px 1px ${outlineBlurRadius || 0}px ${outlineColor || "currentColor"}`],
		["-webkit-text-stroke", `${outlineThickness || 0}px ${outlineColor || "currentColor"}`],
	];
}

export function validateAnimation(
	keyframes: InferDerivableValue<typeof TextOutlineGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	if (animationType === "discrete") {
		return true;
	}

	/**
	 * Outline continuous animation is valid only on color.
	 * Other properties shouldn't change.
	 */

	let previousThickness: string | undefined = replaceNoneWithEquivalent(
		keyframes[0]!,
	)[1]!.value.value.toString();
	let previousBlurRadius: string | undefined =
		replaceNoneWithEquivalent(keyframes[0]!)[2]?.value.value.toString() || "0px";

	for (let i = 1; i < keyframes.length; i++) {
		const currentKeyframe = replaceNoneWithEquivalent(keyframes[i]!);
		const [, thickness, blurRadius] = currentKeyframe;

		const currentComputedThickness = thickness?.value.value.toString();
		const currentComputedBlurRadius = blurRadius?.value.value.toString() || "0px";

		if (thickness?.value.toString() !== previousThickness) {
			return false;
		}

		if ((blurRadius?.value.toString() || "0px") !== previousBlurRadius) {
			return false;
		}

		previousThickness = currentComputedThickness;
		previousBlurRadius = currentComputedBlurRadius;
	}

	return true;
}

function replaceNoneWithEquivalent(
	outline: InferDerivableValue<typeof TextOutlineGrammar>,
): InferDerivableValue<typeof TextOutlineGrammar> {
	if (outline[0]?.value !== "none") {
		return outline;
	}

	/**
	 * For CSS, text-shadow none is equivalent to 0 0 0 transparent
	 * and it interpolates correctly.
	 */

	return [
		{ type: "outline-color", value: { type: "color", value: "transparent" } },
		{ type: "outline-thickness", value: { type: "length", value: createUnit(0, "px") } },
		{ type: "outline-blur-radius", value: { type: "length", value: createUnit(0, "px") } },
	];
}
