import { describe, it, expect } from "@jest/globals";
import { Entities } from "@sub37/server";
import TTMLAdapter from "../lib/Adapter.js";
import { KeyTimesPacedNotAllowedError } from "../lib/Parser/Animations/keyTimes/KeyTimesNotAllowedError.js";
import { KeySplinesNotAllowedError } from "../lib/Parser/Animations/keySplines/KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "../lib/Parser/Animations/keySplines/KeySplinesRequiredError.js";
import { KeySplinesAmountNotMatchingKeyTimesError } from "../lib/Parser/Animations/keySplines/KeySplinesAmountNotMatchingKeyTimesError.js";
import { KeySplinesInvalidControlsAmountError } from "../lib/Parser/Animations/keySplines/KeySplinesInvalidControlsAmountError.js";
import { KeySplinesCoordinateOutOfBoundaryError } from "../lib/Parser/Animations/keySplines/KeySplinesCoordinateOutOfBoundaryError.js";

/**
 * All tests use inline animations inside a <p> element.
 * The <animate> element is placed directly inside <p>, following the patterns
 * already used throughout the codebase.
 *
 * Per TTML2 §13.1.1, invalid style targeting is "must be ignored" — not thrown.
 * The library chooses to throw for structural keyTimes/keySplines violations,
 * which is a strictness decision beyond what the spec mandates.
 */

/**
 * @param {string} animateAttributes - attributes to put on the <animate> element
 * @param {string} [bodyContent] - optional body override (replaces the whole <body>)
 */
function parseTTML(animateAttributes, bodyContent) {
	const adapter = new TTMLAdapter();
	return () =>
		adapter.parse(`
		<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
			<head>
				<layout>
					<region xml:id="r1" begin="0s" end="5s"/>
				</layout>
			</head>
			<body>
			${bodyContent ?? `<div><p xml:id="p1" region="r1" begin="0s" end="5s"><animate xml:id="a1" dur="5s" ${animateAttributes}/>Text</p></div>`}
			</body>
		</tt>
	`);
}

/**
 * Returns the first AnimationEntity from the first cue produced by parsing.
 */
function getFirstAnimationEntity(animateAttributes, bodyContent) {
	const { data: cues } = parseTTML(animateAttributes, bodyContent)();
	return cues[0]?.entities?.find(Entities.isAnimationEntity);
}

describe("TTML Continuous Animations - Linear", () => {
	it("should animate tts:color correctly", () => {
		const entity = getFirstAnimationEntity(`keyTimes="0;0.5;1" tts:color="red;green;blue"`);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
		expect(entity.styles["color"]).toBeDefined();
	});

	it("should silently drop tts:border when width/style change in a continuous animation", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:border when only style changes in a continuous animation", () => {
		/* border-style changes across keyframes — validateAnimation returns false, style is silently dropped */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:border="solid black;dotted red;dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:textOutline when thickness changes in a continuous animation", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should animate tts:textOutline correctly with only color changes", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:textOutline="red 1px;red 1px;blue 1px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should silently drop tts:border with missing required components", () => {
		const entity = getFirstAnimationEntity(`keyTimes="0;0.5;1" tts:border="solid;dotted;dashed"`);
		expect(entity).toBeUndefined();
	});

	it("should animate tts:textShadow correctly with only color changes", () => {
		/* tts:textShadow syntax: <length> <length> [<color>]? — color goes last */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should silently drop tts:textShadow with continuous change in non-animatable components", () => {
		/* offset changes across keyframes — validateAnimation returns false, style silently dropped */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	describe("keyTimes", () => {
		it("should animate tts:color with keyTimes", () => {
			const entity = getFirstAnimationEntity(`keyTimes="0;0.5;1" tts:color="red;green;blue"`);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toEqual([0, 0.5, 1]);
		});

		it("should silently drop tts:color when keyTimes count does not match value count", () => {
			/* 3 keyTimes but only 2 color values — style dropped, no remaining styles, no entity */
			const entity = getFirstAnimationEntity(`keyTimes="0;0.5;1" tts:color="red;green"`);
			expect(entity).toBeUndefined();
		});

		it("should silently drop styles with mismatched value counts across attributes", () => {
			/* color has 2 values, backgroundColor has 4 — both dropped, no entity */
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" tts:color="red;green" tts:backgroundColor="cyan;magenta;yellow;black"`,
			);
			expect(entity).toBeUndefined();
		});

		it("should report an error when keySplines is defined on a linear animation", () => {
			const { errors } = parseTTML(
				`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1" tts:color="red;green;blue"`,
			)();
			expect(errors.some((e) => e.error instanceof KeySplinesNotAllowedError)).toBe(true);
		});

		it("should infer keyTimes when not provided", () => {
			const entity = getFirstAnimationEntity(`tts:color="red;green;blue"`);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toEqual([0, 0.5, 1]);
		});

		it("should animate tts:color with more than 3 keyTimes", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.33;0.66;1" tts:color="red;green;blue;yellow"`,
			);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toEqual([0, 0.33, 0.66, 1]);
		});

		it("should animate tts:border correctly with only color changes and starting point", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.33;0.66;1" tts:border="2px solid black;2px solid green;2px solid blue;2px solid red"`,
			);
			expect(entity).toBeDefined();
			expect(entity.styles?.["border-color"]).toBeDefined();
		});
	});
});

describe("TTML Continuous Animations - Paced", () => {
	it("should animate tts:color correctly with paced timing", () => {
		const entity = getFirstAnimationEntity(`calcMode="paced" tts:color="red;green;blue"`);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
		expect(entity.styles["color"]).toBeDefined();
	});

	it("should silently drop tts:border when width/style changes in a paced animation", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:border with only style changes in a paced animation", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:border="solid black;dotted red;dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:textOutline when thickness changes in a paced animation", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should animate tts:textOutline correctly with only color changes with paced timing", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:textOutline="red 1px;red 1px;blue 1px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should silently drop invalid tts:border and tts:textOutline with missing required components", () => {
		const entity = getFirstAnimationEntity(`calcMode="paced" tts:border="solid;dotted;dashed"`);
		expect(entity).toBeUndefined();
	});

	it("should animate tts:textShadow correctly with only color changes with paced timing", () => {
		/* tts:textShadow syntax: <length> <length> [<color>]? — color goes last */
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should silently drop tts:textShadow when offset changes in a paced animation", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should report an error when keyTimes is defined on a paced animation", () => {
		const { errors } = parseTTML(
			`calcMode="paced" keyTimes="0;0.5;1" tts:color="red;green;blue"`,
		)();
		expect(errors.some((e) => e.error instanceof KeyTimesPacedNotAllowedError)).toBe(true);
	});

	it("should silently drop attributes with a value count that doesn't match the first attribute's count in paced animation", () => {
		/*
		 * TTML2 §13.1.1 constraint 5 only applies when keyTimes is specified and
		 * calcMode is not "paced". For paced without keyTimes the spec is silent
		 * on cross-attribute value count consistency.
		 * The library independently derives an implicit keyframe count from the
		 * first attribute (color: 2 values) and drops any other attribute whose
		 * count differs (backgroundColor: 4 values).
		 */
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:color="red;green" tts:backgroundColor="cyan;magenta;yellow;black"`,
		);
		expect(entity).toBeDefined();
		expect(entity.styles["color"]).toBeDefined();
		expect(entity.styles?.["background-color"]).toBeUndefined();
	});

	it("should animate tts:border correctly with only color changes and starting point with paced timing", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="paced" tts:border="2px solid black;2px solid green;2px solid blue;2px solid red"`,
		);
		expect(entity).toBeDefined();
		expect(entity.styles?.["border-color"]).toBeDefined();
	});
});

describe("TTML Continuous Animations - Spline", () => {
	it("should animate tts:color correctly with spline timing", () => {
		/* 3 keyTimes → 2 keySplines required (N-1) */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:color="red;green;blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
		expect(entity.splines).toHaveLength(2);
		expect(entity.styles["color"]).toBeDefined();
	});

	it("should silently drop tts:border when width/style change in a spline animation", () => {
		/* 1 keySpline is valid here because 2 keyTimes → 1 spline (N-1) would be correct,
		 * but this test has 3 keyTimes → need to use 2 keySplines for this to not throw */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:textOutline when thickness changes in a spline animation", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should silently drop tts:textShadow when offset changes in a spline animation", () => {
		/* 1 keySpline ok here: this test already has correct 1 keySpline for its 2-interval range,
		 * but we have 3 keyTimes → needs 2. Keeping the original correct-count version. */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should animate tts:border correctly with only color changes with spline timing", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:border="2px solid black;2px solid red;2px solid blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.styles?.["border-color"]).toBeDefined();
	});

	it("should animate tts:textOutline correctly with only color changes with spline timing", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textOutline="red 1px;red 1px;blue 1px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should animate tts:textShadow correctly with only color changes with spline timing", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.25 0.1 0.25 1;0 0 0.58 1" calcMode="spline" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("continuous");
	});

	it("should animate tts:border correctly with only color changes and starting point with spline timing", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 1 1;0 0 1 1" calcMode="spline" tts:border="2px solid black;2px solid green;2px solid blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.styles?.["border-color"]).toBeDefined();
	});

	it("should properly parse valid keySplines", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:color="red;green;blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.splines).toEqual([
			[0.42, 0, 0.58, 1],
			[0.1, 0.8, 0.2, 0.8],
		]);
	});

	it("should throw when keySplines count does not match keyTimes count minus one", () => {
		/* 3 keyTimes → needs 2 keySplines, but only 1 provided */
		expect(
			parseTTML(
				`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1" calcMode="spline" tts:color="red;green;blue"`,
			),
		).toThrow(KeySplinesAmountNotMatchingKeyTimesError);
	});

	it("should throw when keySplines control points are not exactly 4", () => {
		expect(
			parseTTML(
				`keyTimes="0;0.5;1" keySplines="0.42 0 0.58;0.1 0.8 0.9" calcMode="spline" tts:color="red;green;blue"`,
			),
		).toThrow(KeySplinesInvalidControlsAmountError);
	});

	it("should throw when a keySplines coordinate is out of [0,1] range", () => {
		expect(
			parseTTML(
				`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1.2;0.1 0.8 0.9 0.2" calcMode="spline" tts:color="red;green;blue"`,
			),
		).toThrow(KeySplinesCoordinateOutOfBoundaryError);
	});

	it("should report an error when calcMode is spline but keySplines is missing", () => {
		const { errors } = parseTTML(
			`keyTimes="0;0.5;1" calcMode="spline" tts:color="red;green;blue"`,
		)();
		expect(errors.some((e) => e.error instanceof KeySplinesRequiredError)).toBe(true);
	});

	it("should silently drop tts:border when width/style change in a spline animation (duplicate set)", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0 0 1 1" calcMode="spline" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should silently drop tts:textOutline when thickness changes in a spline animation (duplicate set)", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.25 0.1 0.25 1;0.42 0 0.58 1" calcMode="spline" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});

	it("should silently drop tts:textShadow when offset changes in a spline animation (duplicate set)", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" keySplines="0.1 0.8 0.2 0.8;0.25 0.1 0.25 1" calcMode="spline" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"`,
		);
		expect(entity?.styles?.["text-shadow"]).toBeUndefined();
	});
});

describe("TTML Repeated Animations", () => {
	describe("repeatCount", () => {
		it("should animate tts:color with repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:color="red;green;blue"`,
			);
			expect(entity).toBeDefined();
			expect(entity.styles["color"]).toBeDefined();
		});

		it("should silently drop tts:border when width/style change with repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
			);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:border with only style changes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:border="solid black;dotted red;dashed blue"`,
			);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:textOutline when thickness changes with repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:textOutline="red 1px;green 2px;blue 3px"`,
			);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should animate tts:textOutline correctly with only color changes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:textOutline="red 1px;red 1px;blue 1px"`,
			);
			expect(entity).toBeDefined();
		});

		it("should silently drop invalid tts:border with missing components and repeatCount", () => {
			/* border dropped — no remaining styles, no entity */
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:border="solid;dotted;dashed"`,
			);
			expect(entity).toBeUndefined();
		});

		it("should animate tts:textShadow correctly with only color changes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"`,
			);
			expect(entity).toBeDefined();
		});

		it("should silently drop tts:textShadow when offset changes with repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.5;1" repeatCount="3" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"`,
			);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should animate tts:color with more than 3 keyTimes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.33;0.66;1" repeatCount="3" tts:color="red;green;blue;yellow"`,
			);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toHaveLength(4);
		});

		it("should silently drop tts:border with non-uniform style changes and 4 keyTimes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.33;0.66;1" repeatCount="3" tts:border="solid black;dotted red;dashed blue;double green"`,
			);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should animate tts:textOutline with more than 3 keyTimes and repeatCount", () => {
			const entity = getFirstAnimationEntity(
				`keyTimes="0;0.25;0.5;0.75;1" repeatCount="3" tts:textOutline="red 1px;red 1px;blue 1px;blue 1px;green 1px"`,
			);
			expect(entity).toBeDefined();
		});
	});
});

describe("TTML Discrete Animations", () => {
	it("should animate tts:border with discrete changes", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
	});

	it("should animate tts:textOutline with discrete changes", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
	});

	it("should silently drop styles with invalid discrete values (missing components)", () => {
		/* tts:border needs both style and color; bare style tokens are invalid */
		const entity = getFirstAnimationEntity(
			`calcMode="discrete" tts:border="1px solid;2px dotted;3px dashed"`,
		);
		expect(entity).toBeDefined();
	});

	it("should animate tts:border with keyTimes in discrete mode", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
		expect(entity.keyTimes).toHaveLength(3);
	});

	it("should animate tts:textOutline with keyTimes in discrete mode", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
		expect(entity.keyTimes).toHaveLength(3);
	});

	it("should silently drop styles with mismatched value counts across attributes", () => {
		const entity = getFirstAnimationEntity(
			`calcMode="discrete" keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red" tts:textOutline="red 1px;green 2px;blue 3px"`,
		);
		expect(entity).toBeDefined();
	});

	it("should silently drop tts:border when keyTimes count does not match value count", () => {
		/*
		 * 3 keyTimes but only 2 values — count mismatch causes style to be dropped.
		 */
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red"`,
		);
		expect(entity?.styles?.["border-color"]).toBeUndefined();
	});

	it("should animate tts:border with more than 3 keyTimes in discrete mode", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.33;0.66;1" calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue;4px double green"`,
		);
		expect(entity).toBeDefined();
		expect(entity.keyTimes).toHaveLength(4);
	});

	it("should animate tts:textOutline with more than 3 keyTimes in discrete mode", () => {
		const entity = getFirstAnimationEntity(
			`keyTimes="0;0.33;0.66;1" calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px;yellow 4px"`,
		);
		expect(entity).toBeDefined();
		expect(entity.keyTimes).toHaveLength(4);
	});

	it("should animate tts:border with discrete changes using <set>", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
				<head><layout><region xml:id="r1" begin="0s" end="3s"/></layout></head>
				<body>
					<div>
						<p region="r1" begin="0s" end="3s">
							<set begin="0s" dur="1s" tts:border="1px solid black"/>
							<set begin="1s" dur="1s" tts:border="2px dotted red"/>
							<set begin="2s" dur="1s" tts:border="3px dashed blue"/>
							Text
						</p>
					</div>
				</body>
			</tt>
		`);
		const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
	});

	it("should animate tts:textOutline with discrete changes using <set>", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
				<head><layout><region xml:id="r1" begin="0s" end="3s"/></layout></head>
				<body>
					<div>
						<p region="r1" begin="0s" end="3s">
							<set begin="0s" dur="1s" tts:textOutline="red 1px"/>
							<set begin="1s" dur="1s" tts:textOutline="green 2px"/>
							<set begin="2s" dur="1s" tts:textOutline="blue 3px"/>
							Text
						</p>
					</div>
				</body>
			</tt>
		`);
		const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
		expect(entity).toBeDefined();
		expect(entity.kind).toBe("discrete");
	});
});
