import { CueNode } from "@sub37/adapter-utils";

/**
 * Drains a ParseGenerator synchronously into { data, errors }.
 * Use this in tests instead of calling adapter.parse() directly,
 * since parse() is a generator that must be iterated to run.
 *
 * @param {import("../../lib/Adapter.js").default} adapter
 * @param {string} content
 * @returns {{ data: CueNode[], errors: import("@sub37/adapter-utils").ParseError[] }}
 */
export function parseResult(adapter, content) {
	const data = [];
	const errors = [];

	for (const chunk of adapter.parse(content)) {
		for (const item of chunk) {
			if (item instanceof CueNode) {
				data.push(item);
			} else {
				errors.push(item);
			}
		}
	}

	return { data, errors };
}
