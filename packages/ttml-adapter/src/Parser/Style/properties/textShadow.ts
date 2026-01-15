import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { DerivedValue, InferDerivableValue } from "../structure/operators.js";
import type { TextShadowGrammar } from "../syntax/text-shadow.js";
import type { Length } from "../../Units/length.js";

export { TextShadowGrammar as Grammar } from "../syntax/text-shadow.js";

/**
 * TextShadow allows splitting by commas to separate multiple shadows
 * @param input
 * @returns
 */
export function tokenizer(input: string): string[] {
	return input.split(/\s*(,)\s*|\s+/).filter(Boolean);
}

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextShadowGrammar>,
): PropertiesCollection<["text-shadow"]> | null {
	if (value.length === 1) {
		return [["text-shadow", "none"]];
	}

	type DerivedShadow = [
		DerivedValue<string, Length>, // offset-x
		DerivedValue<string, Length>, // offset-y
		DerivedValue<string, Length> | undefined, // blur-radius
		DerivedValue<string, string> | undefined, // color
	];

	let values = value.slice();
	const buffer: Partial<DerivedValue>[] = [];
	const shadows: DerivedShadow[] = [];

	while (values.length) {
		const token = values.shift();

		if (!token) {
			shadows.push(buffer as DerivedShadow);
			buffer.length = 0;
			continue;
		}

		if (token.value === ",") {
			shadows.push(buffer as DerivedShadow);
			buffer.length = 0;
			continue;
		}

		buffer.push(token);
	}

	shadows.push(buffer as DerivedShadow);

	const textShadows = shadows.map((shadow) => {
		const offsetX = shadow[0].value.toString();
		const offsetY = shadow[1].value.toString();
		const blurRadius = shadow[2]?.value.toString();
		const color = shadow[3]?.value;

		return [offsetX, offsetY, blurRadius, color].filter(Boolean).join("\x20");
	});

	return [["text-shadow", textShadows.join(",")]];
}
