import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import TTMLAdapter from "../../lib/Adapter.js";
import { parseResult } from "../helpers/parseResult.mjs";

/**
 * Recursively collect all .ttml files under a directory.
 * Returns entries as { topic, file, fullPath }.
 */
/** @param {string} name */
function isTTMLFile(name) {
	return name.endsWith(".ttml") || name.endsWith(".xml");
}

function collectTTML(dir) {
	/** @type {{ topic: string, file: string, fullPath: URL }[]} */
	const entries = [];

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			for (const child of readdirSync(new URL(`${entry.name}/`, dir), { withFileTypes: true })) {
				if (isTTMLFile(child.name)) {
					entries.push({
						topic: entry.name,
						file: child.name,
						fullPath: new URL(`${entry.name}/${child.name}`, dir),
					});
				}
			}
		} else if (isTTMLFile(entry.name)) {
			entries.push({
				topic: "(ungrouped)",
				file: entry.name,
				fullPath: new URL(entry.name, dir),
			});
		}
	}

	return entries;
}

const validDir = new URL("valid/", import.meta.url);
const entries = collectTTML(validDir);

for (const { topic, file, fullPath } of entries) {
	describe(`valid / ${topic}`, () => {
		it(file, () => {
			const content = readFileSync(fullPath, "utf-8");
			const adapter = new TTMLAdapter();
			const result = parseResult(adapter, content);
			expect(result.errors.filter((e) => e.isCritical)).toHaveLength(0);
		});
	});
}
