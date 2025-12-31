import { describe, it, expect } from "@jest/globals";
import { createStyleParser } from "../lib/Parser/parseStyle.js";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createDocumentContext } from "../lib/Parser/Scope/DocumentContext.js";

describe("StyleProperties", () => {
	const mockNode = {
		currentNode: {
			content: { content: "region" },
			parent: null,
		},
	};

	const docContext = createDocumentContext(mockNode, {
		"xml:lang": "en",
		"tts:extent": "1280px 720px",
		"ttp:cellResolution": "32 15",
	});

	const scope = createScope(null, docContext);
	const stylesIDREFSStorage = new Map();

	it("should parse tts:position with 2 components (keywords)", () => {
		const attributes = {
			"xml:id": "style1",
			"tts:position": "left top",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "0%",
			top: "0%",
		});
	});

	it("should parse tts:position with 2 components (percentages)", () => {
		const attributes = {
			"xml:id": "style2",
			"tts:position": "10% 20%",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "10%",
			top: "20%",
		});
	});

	it("should parse tts:position with 2 components (pixels)", () => {
		const attributes = {
			"xml:id": "style3",
			"tts:position": "100px 200px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "100px",
			top: "200px",
		});
	});

	it("should parse tts:position with 1 component (center)", () => {
		const attributes = {
			"xml:id": "style4",
			"tts:position": "center",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "50%",
			top: "50%",
		});
	});

	it("should parse tts:position with 4 components (offsets)", () => {
		const attributes = {
			"xml:id": "style5",
			"tts:position": "left 10px top 20px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "10px",
			top: "20px",
		});
	});

	it("should parse tts:position with 4 components (offsets from right/bottom)", () => {
		const attributes = {
			"xml:id": "style6",
			"tts:position": "right 10px bottom 20px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			position: "absolute",
			left: "calc(100% - 10px)",
			top: "calc(100% - 20px)",
		});
	});

	it("should parse tts:origin", () => {
		const attributes = {
			"xml:id": "style7",
			"tts:origin": "10% 20%",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			x: "10%",
			y: "20%",
		});
	});

	it("should parse tts:extent", () => {
		const attributes = {
			"xml:id": "style8",
			"tts:extent": "100px 50px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			width: "100px",
			height: "50px",
		});
	});

	it("should parse tts:backgroundColor", () => {
		const attributes = {
			"xml:id": "style9",
			"tts:backgroundColor": "red",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"background-color": "red",
		});
	});

	it("should parse tts:color", () => {
		const attributes = {
			"xml:id": "style10",
			"tts:color": "#00FF00",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("span");

		expect(css).toEqual({
			color: "#00FF00",
		});
	});

	it("should parse tts:textAlign", () => {
		const attributes = {
			"xml:id": "style11",
			"tts:textAlign": "center",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("p");

		expect(css).toEqual({
			"text-align": "center",
		});
	});

	it("should parse tts:displayAlign", () => {
		const attributes = {
			"xml:id": "style12",
			"tts:displayAlign": "center",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"justify-content": "center",
			display: "flex",
			"flex-direction": "column",
			position: "absolute",
		});
	});

	it("should parse tts:fontSize", () => {
		const attributes = {
			"xml:id": "style13",
			"tts:fontSize": "20px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"font-size": "20px",
		});
	});

	it("should parse tts:padding", () => {
		const attributes = {
			"xml:id": "style22",
			"tts:padding": "10px 20px",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			padding: "10px 20px",
		});
	});

	it("should parse tts:opacity", () => {
		const attributes = {
			"xml:id": "style23",
			"tts:opacity": "0.5",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			opacity: "0.5",
		});
	});

	it.skip("should parse tts:fontFamily", () => {
		const attributes = {
			"xml:id": "style14",
			"tts:fontFamily": "Arial, sans-serif",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"font-family": "Arial, sans-serif",
		});
	});

	it.skip("should parse tts:fontWeight", () => {
		const attributes = {
			"xml:id": "style15",
			"tts:fontWeight": "bold",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"font-weight": "bold",
		});
	});

	it.skip("should parse tts:fontStyle", () => {
		const attributes = {
			"xml:id": "style16",
			"tts:fontStyle": "italic",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"font-style": "italic",
		});
	});

	it.skip("should parse tts:textDecoration", () => {
		const attributes = {
			"xml:id": "style17",
			"tts:textDecoration": "underline",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"text-decoration": "underline",
		});
	});

	it.skip("should parse tts:overflow", () => {
		const attributes = {
			"xml:id": "style21",
			"tts:overflow": "hidden",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			overflow: "hidden",
		});
	});

	it.skip("should parse tts:visibility", () => {
		const attributes = {
			"xml:id": "style24",
			"tts:visibility": "hidden",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			visibility: "hidden",
		});
	});

	it.skip("should parse tts:zIndex", () => {
		const attributes = {
			"xml:id": "style25",
			"tts:zIndex": "10",
		};

		const styleParser = createStyleParser(scope, stylesIDREFSStorage);
		const style = styleParser.process(attributes);
		const css = style.apply("region");

		expect(css).toEqual({
			"z-index": "10",
		});
	});
});
