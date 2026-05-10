import { describe, it, expect } from "@jest/globals";
import { Entities } from "@sub37/server";
import TTMLAdapter from "../../lib/Adapter.js";

/**
 * Tests for the <initial> element in <styling>.
 * Per TTML2 §9.3.2, <initial> overrides the initial value of a style property
 * globally — it acts as the lowest layer of the cascade, below referential,
 * nested, and inline styles.
 */

function parseDoc(stylingContent, bodyContent) {
	const adapter = new TTMLAdapter();
	const { data: cues } = adapter.parse(`
		<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
			<head>
				<styling>
					${stylingContent}
				</styling>
				<layout>
					<region xml:id="r1" />
				</layout>
			</head>
			<body>
				<div region="r1">
					${bodyContent}
				</div>
			</body>
		</tt>
	`);
	return cues;
}

function getSpanStyles(cues, text) {
	const cue = cues.find((c) => c.content.trim() === text);
	return cue?.entities.find(Entities.isLocalStyleEntity)?.styles;
}

describe("<initial> element", () => {
	it("applies a property globally when no other style is specified", () => {
		const cues = parseDoc(
			`<initial tts:color="red" />`,
			`<p begin="0s" end="1s"><span>Hello</span></p>`,
		);
		const styles = getSpanStyles(cues, "Hello");
		expect(styles?.["color"]).toBe("red");
	});

	it("is overridden by an inline style on the element", () => {
		const cues = parseDoc(
			`<initial tts:color="red" />`,
			`<p begin="0s" end="1s"><span tts:color="blue">Hello</span></p>`,
		);
		const styles = getSpanStyles(cues, "Hello");
		expect(styles?.["color"]).toBe("blue");
	});

	it("is overridden by a referential style", () => {
		const cues = parseDoc(
			`
			<initial tts:color="red" />
			<style xml:id="s1" tts:color="green" />
			`,
			`<p begin="0s" end="1s"><span style="s1">Hello</span></p>`,
		);
		const styles = getSpanStyles(cues, "Hello");
		expect(styles?.["color"]).toBe("green");
	});

	it("last <initial> wins when multiple override the same property", () => {
		const cues = parseDoc(
			`
			<initial tts:color="red" />
			<initial tts:color="purple" />
			`,
			`<p begin="0s" end="1s"><span>Hello</span></p>`,
		);
		const styles = getSpanStyles(cues, "Hello");
		expect(styles?.["color"]).toBe("purple");
	});

	it("applies independently to multiple spans", () => {
		const cues = parseDoc(
			`<initial tts:color="red" />`,
			`
			<p begin="0s" end="1s"><span>First</span></p>
			<p begin="1s" end="2s"><span>Second</span></p>
			`,
		);
		expect(getSpanStyles(cues, "First")?.["color"]).toBe("red");
		expect(getSpanStyles(cues, "Second")?.["color"]).toBe("red");
	});
});
