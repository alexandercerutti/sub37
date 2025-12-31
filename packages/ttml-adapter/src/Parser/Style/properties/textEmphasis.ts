import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextEmphasisGrammar } from "../syntax/text-emphasis.js";

export { TextEmphasisGrammar as Grammar } from "../syntax/text-emphasis.js";

type GetValuesForTEProperty<Prop extends string> = Extract<
	InferDerivableValue<typeof TextEmphasisGrammar>[number],
	{ type: Prop }
>["value"][number];

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
				color = item.value[0];
				break;
			}

			case "text-emphasis-style": {
				style = item.value[0];
				break;
			}

			case "text-emphasis-position": {
				position = item.value[0];
				break;
			}
		}
	}

	if (!style && !position && !color) {
		return null;
	}

	return [
		["text-emphasis-style", style],
		["text-emphasis-color", color],
		["text-emphasis-position", position],
	];
}
