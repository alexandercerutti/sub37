import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { DerivedValue, InferDerivableValue } from "../structure/operators.js";
import type { TextShadowGrammar } from "../syntax/text-shadow.js";
import type { Length } from "../../Units/length.js";
import { createUnit } from "../../Units/unit.js";

export { TextShadowGrammar as Grammar } from "../syntax/text-shadow.js";

/**
 * TextShadow allows splitting by commas to separate multiple shadows
 * @param input
 * @returns
 */
export function tokenizer(input: string): string[] {
	return input.split(/\s*(,)\s*|\s+/).filter(Boolean);
}

type SingleShadowComponent = [
	offsetX: DerivedValue<string, Length>,
	offsetY: DerivedValue<string, Length>,
	blurRadius: DerivedValue<string, Length> | undefined,
	color: DerivedValue<string, string> | undefined,
];

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextShadowGrammar>,
): PropertiesCollection<["text-shadow"]> | null {
	if (value.length === 1) {
		return [["text-shadow", "none"]];
	}

	const values = value.slice();
	const buffer: (Partial<DerivedValue> | undefined)[] = [];
	const shadows: SingleShadowComponent[] = [];

	while (values.length) {
		const token = values.shift();

		if (token?.value === ",") {
			shadows.push(buffer.slice() as SingleShadowComponent);
			buffer.length = 0;
			continue;
		}

		buffer.push(token);
	}

	shadows.push(buffer as SingleShadowComponent);

	const textShadows = shadows.map((shadow) => {
		const offsetX = shadow[0].value.toString();
		const offsetY = shadow[1].value.toString();
		const blurRadius = shadow[2]?.value.toString();
		const color = shadow[3]?.value;

		return [offsetX, offsetY, blurRadius, color].filter(Boolean).join("\x20");
	});

	return [["text-shadow", textShadows.join(",")]];
}

export function validateAnimation(
	keyframes: InferDerivableValue<typeof TextShadowGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	if (animationType === "discrete") {
		/**
		 * Probably we should use steps() here in CSS
		 * animation in order to fully achieve discrete animation.
		 */
		return true;
	}

	/**
	 * Color, other than optional, is the only component that
	 * can be animated continuously.
	 *
	 * We need to check other components for presence in all keyframes.
	 * They must not change. They cannot be none.
	 */
	const SHADOW_COMPONENTS_TOTAL_WITH_COMMA = 5;

	let previousShadow = replaceNoneWithEquivalent(keyframes[0]!);

	for (let i = 1; i < keyframes.length; i++) {
		const currentShadow = replaceNoneWithEquivalent(keyframes[i]!);

		const currentAmountOfCommaSeparatedShadows =
			currentShadow.length / SHADOW_COMPONENTS_TOTAL_WITH_COMMA;

		const previousAmountOfCommaSeparatedShadows =
			previousShadow.length / SHADOW_COMPONENTS_TOTAL_WITH_COMMA;

		if (currentAmountOfCommaSeparatedShadows !== previousAmountOfCommaSeparatedShadows) {
			return false;
		}

		for (let j = 0; j < currentAmountOfCommaSeparatedShadows; j++) {
			const currOffsetX = currentShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 0];
			const currOffsetY = currentShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 1];
			const currBlurRadius = currentShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 2];

			const prevOffsetX = previousShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 0];
			const prevOffsetY = previousShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 1];
			const prevBlurRadius = previousShadow[j * SHADOW_COMPONENTS_TOTAL_WITH_COMMA + 2];

			if (currOffsetX?.value.toString() !== prevOffsetX!.value.toString()) {
				return false;
			}

			if (currOffsetY?.value.toString() !== prevOffsetY!.value.toString()) {
				return false;
			}

			const prevBlurRadiusString = prevBlurRadius?.value
				? prevBlurRadius!.value.toString()
				: createUnit(0, "px").toString();

			const currBlurRadiusString = currBlurRadius?.value
				? currBlurRadius!.value.toString()
				: createUnit(0, "px").toString();

			if (currBlurRadiusString !== prevBlurRadiusString) {
				return false;
			}
		}

		previousShadow = currentShadow;
	}

	return true;
}

function replaceNoneWithEquivalent(
	shadow: InferDerivableValue<typeof TextShadowGrammar>,
): InferDerivableValue<typeof TextShadowGrammar> {
	if (shadow[0].value !== "none") {
		return shadow;
	}

	/**
	 * For CSS, text-shadow none is equivalent to 0 0 0 transparent
	 * and it interpolates correctly.
	 */

	return [
		{ type: "length", value: createUnit(0, "px") },
		{ type: "length", value: createUnit(0, "px") },
		{ type: "length", value: createUnit(0, "px") },
		{ type: "color", value: "transparent" },
		undefined,
	];
}
