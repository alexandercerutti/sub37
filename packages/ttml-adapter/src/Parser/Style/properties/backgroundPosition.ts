import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { normalizePositionValue } from "../syntax/position.js";
import type { PositionGrammar } from "../syntax/position.js";

export { PositionGrammar as Grammar } from "../syntax/position.js";

export function cssTransform(
	value: InferDerivableValue<typeof PositionGrammar>,
): PropertiesCollection<["background-position"]> | null {
	const normalizedValue = normalizePositionValue(value);

	if (!normalizedValue) {
		return null;
	}

	return [
		[
			"background-position",
			// left <length> top <length>
			`${normalizedValue[0]} ${normalizedValue[1].toString()} ${normalizedValue[2]} ${normalizedValue[3].toString()}`,
		],
	];
}
