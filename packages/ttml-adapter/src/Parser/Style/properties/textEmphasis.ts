import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextEmphasisGrammar } from "../syntax/text-emphasis.js";

export { TextEmphasisGrammar as Grammar } from "../syntax/text-emphasis.js";

type GetValuesForTEProperty<Prop extends string> = Extract<
	InferDerivableValue<typeof TextEmphasisGrammar>[number],
	{ type: Prop }
>["value"][number]["value"];

type TextEmphasisStyleValues = GetValuesForTEProperty<"text-emphasis-style">;
type TextEmphasisPositionValues = GetValuesForTEProperty<"text-emphasis-position">;
type TextEmphasisColorValues = GetValuesForTEProperty<"text-emphasis-color">;

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextEmphasisGrammar>,
): PropertiesCollection<
	["text-emphasis-style", "text-emphasis-color", "text-emphasis-position"]
> | null {
	let color: TextEmphasisColorValues | undefined = undefined;
	let style: TextEmphasisStyleValues | undefined = undefined;
	let position: TextEmphasisPositionValues | undefined = undefined;

	for (const item of value) {
		switch (item.type) {
			case "text-emphasis-color": {
				color = item.value[0].value;
				break;
			}

			case "text-emphasis-style": {
				style = item.value[0].value;
				break;
			}

			case "text-emphasis-position": {
				position = item.value[0].value;
				break;
			}
		}
	}

	if (!style && !position && !color) {
		return null;
	}

	return [
		["text-emphasis-style", style || ""],
		["text-emphasis-color", color || ""],
		["text-emphasis-position", position || ""],
	];
}

export function validateAnimation(
	keyframes: InferDerivableValue<typeof TextEmphasisGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	if (animationType === "discrete") {
		return true;
	}

	let previousKeyframeStyle: string | undefined = undefined;
	let previousKeyframePosition: string | undefined = undefined;

	for (const keyframe of keyframes) {
		let currentKeyframeStyle: string | undefined = undefined;
		let currentKeyframePosition: string | undefined = undefined;

		for (const item of keyframe) {
			switch (item.type) {
				case "text-emphasis-style": {
					currentKeyframeStyle = item.value[0].value;

					if (currentKeyframeStyle !== previousKeyframeStyle) {
						return false;
					}

					break;
				}

				case "text-emphasis-position": {
					currentKeyframePosition = item.value[0].value;

					if (currentKeyframePosition !== previousKeyframePosition) {
						return false;
					}

					break;
				}
			}
		}

		if (
			(!currentKeyframeStyle && previousKeyframeStyle) ||
			(!currentKeyframePosition && previousKeyframePosition)
		) {
			return false;
		}

		previousKeyframeStyle = currentKeyframeStyle;
		previousKeyframePosition = currentKeyframePosition;
	}

	return true;
}
