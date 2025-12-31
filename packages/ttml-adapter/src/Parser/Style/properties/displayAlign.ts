import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { DisplayAlignGrammar } from "../syntax/display-align.js";

export { DisplayAlignGrammar as Grammar } from "../syntax/display-align.js";

export function cssTransform(
	_scope: Scope,
	outcome: InferDerivableValue<typeof DisplayAlignGrammar>,
): PropertiesCollection<["display", "flex-direction", "position", "justify-content"]> {
	switch (outcome[0].value[0]) {
		case "before": {
			return [
				["display", "flex"],
				["flex-direction", "column"],
				["position", "absolute"],
				["justify-content", "flex-start"],
			];
		}

		case "center": {
			return [
				["display", "flex"],
				["flex-direction", "column"],
				["position", "absolute"],
				["justify-content", "center"],
			];
		}

		case "after": {
			return [
				["display", "flex"],
				["flex-direction", "column"],
				["position", "absolute"],
				["justify-content", "flex-end"],
			];
		}

		case "justify": {
			return [
				["display", "flex"],
				["flex-direction", "column"],
				["position", "absolute"],
				["justify-content", "space-between"],
			];
		}
	}
}
