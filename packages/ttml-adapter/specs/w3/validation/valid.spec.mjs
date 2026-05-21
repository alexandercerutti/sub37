import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import TTMLAdapter from "../../../lib/Adapter.js";

function isTTMLFile(name) {
	return name.endsWith(".ttml") || name.endsWith(".xml");
}

/**
 * Group by the first feature segment of the filename.
 * e.g. "ttml2-valid-opacity-block.xml" → "opacity"
 *      "ttml2-valid-text-align-relative.xml" → "text"
 * We extract everything between "ttml2-valid-" and the next segment boundary
 * by taking the third dash-delimited token.
 */
function topicFromFilename(name) {
	/* filename format: ttml2-valid-<topic>[-...].xml */
	const base = name.replace(/\.xml$/, "");
	const parts = base.split("-");

	/* parts[0]=ttml2, parts[1]=valid, parts[2]=<topic> */
	return parts[2] ?? "(ungrouped)";
}

const validDir = new URL("valid/", import.meta.url);

/** @type {Map<string, { file: string, fullPath: URL }[]>} */
const groups = new Map();

for (const entry of readdirSync(validDir, { withFileTypes: true })) {
	if (!entry.isFile() || !isTTMLFile(entry.name)) {
		continue;
	}

	const topic = topicFromFilename(entry.name);

	if (!groups.has(topic)) {
		groups.set(topic, []);
	}

	groups.get(topic).push({
		file: entry.name,
		fullPath: new URL(entry.name, validDir),
	});
}

for (const [topic, entries] of groups) {
	describe(`validation / valid / ${topic}`, () => {
		for (const { file, fullPath } of entries) {
			it(file, () => {
				const content = readFileSync(fullPath, "utf-8");
				const adapter = new TTMLAdapter();
				const result = adapter.parse(content);
				expect(result.errors.filter((e) => e.isCritical)).toHaveLength(0);
			});
		}
	});
}
