import { InferDerivableValue } from "../structure/operators.js";
import { normalizePositionValue } from "../syntax/position.js";
import type { PositionGrammar } from "../syntax/position.js";

export { PositionGrammar as Grammar } from "../syntax/position.js";

export function cssTransform(value: InferDerivableValue<typeof PositionGrammar>): string | null {
	normalizePositionValue(value);
	return null;
}
