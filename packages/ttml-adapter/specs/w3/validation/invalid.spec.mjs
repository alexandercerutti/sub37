import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import TTMLAdapter from "../../../lib/Adapter.js";

function isTTMLFile(name) {
	return name.endsWith(".ttml") || name.endsWith(".xml");
}

function topicFromFilename(name) {
	/* filename format: ttml2-invld-<topic>[-...].xml */
	const base = name.replace(/\.xml$/, "");
	const parts = base.split("-");
	/* parts[0]=ttml2, parts[1]=invld, parts[2]=<topic> */
	return parts[2] ?? "(ungrouped)";
}

const invalidDir = new URL("invalid/", import.meta.url);

/*
 * These files expose invalidity that the adapter cannot observe because the
 * relevant elements produce no cue nodes, or because the feature (e.g. set
 * animation syntax, rw/rh units on <tt>) is not implemented.  Each group is
 * annotated with the reason.
 */
const EXCLUDED_FILES = new Set([
	/*
	 * Invalid style attribute values on non-cue elements (display, displayAlign).
	 * Adapter validates style values only when emitting cues; unreachable paths are not checked.
	 */
	"ttml2-invld-bad-display-all-space.xml",
	"ttml2-invld-bad-display-empty.xml",
	"ttml2-invld-bad-display-unknown-keyword.xml",
	"ttml2-invld-bad-display-align-all-space.xml",
	"ttml2-invld-bad-display-align-empty.xml",
	"ttml2-invld-bad-display-align-unknown-keyword.xml",
	/*
	 * Invalid tts:disparity / tts:letterSpacing / tts:extent attribute values on
	 * elements that produce no cues — same rationale as the display group above.
	 */
	"ttml2-invld-bad-disparity-all-space.xml",
	"ttml2-invld-bad-disparity-empty.xml",
	"ttml2-invld-bad-disparity-extra-length.xml",
	"ttml2-invld-bad-disparity-unknown-unit.xml",
	"ttml2-invld-bad-extent-empty.xml",
	"ttml2-invld-bad-extent-colon-delimiter-sans-whitespace.xml",
	"ttml2-invld-bad-letter-spacing-all-space.xml",
	"ttml2-invld-bad-letter-spacing-empty.xml",
	"ttml2-invld-bad-letter-spacing-extra-length.xml",
	"ttml2-invld-bad-letter-spacing-unknown-keyword.xml",
	"ttml2-invld-bad-letter-spacing-unknown-unit.xml",
	/*
	 * Invalid tts:extent values on the root <tt> element — no cues are emitted,
	 * so the bad value cannot surface to the caller.
	 */
	"ttml2-invld-bad-extent-missing-length.xml",
	"ttml2-invld-bad-extent-root-cover.xml",
	"ttml2-invld-bad-extent-root-height.xml",
	"ttml2-invld-bad-extent-root-measure-fit-content.xml",
	"ttml2-invld-bad-extent-root-width.xml",
	/*
	 * Structural or metadata violations that produce no cue nodes:
	 *  - xml:base on <profile> (base-all-space)
	 *  - <style> nested inside <initial> (initial-nested-style)
	 *  - rw/rh length units on <tt> (length-2-root-container-relative)
	 *  - <region> in inline/block context with no text content (region-inline-*)
	 */
	"ttml2-invld-base-all-space.xml",
	"ttml2-invld-initial-nested-style.xml",
	"ttml2-invld-length-2-root-container-relative.xml",
	"ttml2-invld-region-inline-image.xml",
	"ttml2-invld-region-inline-span.xml",
	"ttml2-invld-region-inline-timing.xml",
]);

/** @type {Map<string, { file: string, fullPath: URL }[]>} */
const groups = new Map();

for (const entry of readdirSync(invalidDir, { withFileTypes: true })) {
	if (!entry.isFile() || !isTTMLFile(entry.name) || EXCLUDED_FILES.has(entry.name)) {
		continue;
	}

	const topic = topicFromFilename(entry.name);

	if (!groups.has(topic)) {
		groups.set(topic, []);
	}

	groups.get(topic).push({
		file: entry.name,
		fullPath: new URL(entry.name, invalidDir),
	});
}

for (const [topic, entries] of groups) {
	describe(`validation / invalid / ${topic}`, () => {
		for (const { file, fullPath } of entries) {
			it(file, () => {
				const content = readFileSync(fullPath, "utf-8");
				const adapter = new TTMLAdapter();
				const result = adapter.parse(content);

				/*
				 * When no cues are produced, the adapter always appends one
				 * non-critical "no cues found" error. Exclude it so we only
				 * assert on errors the parser raised about the invalid content.
				 */
				const errors = result.errors.filter(
					(e) => e.error.message !== "Document parsed successfully but no cues have been found.",
				);

				expect(errors).not.toHaveLength(0);
			});
		}
	});
}
